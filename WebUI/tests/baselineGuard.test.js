/**
 * baselineGuard.test.js — guard de baseline (plan v3.2 Fase 0 / baseline_fase0_v32.md §2).
 *
 * Verifica que los counts documentados en `docs/baseline_fase0_v32.md` §2 (test files /
 * tests) coinciden con la suite real. El guard corre la suite en un subproceso
 * EXCLUYÉNDOSE a sí mismo (`SELF_FILE`, derivado de import.meta.url) y reconcilia:
 *
 *     subproceso (sin guard) + propio archivo y tests == baseline documentada
 *
 * Si el count real cambia (nuevo test file, nuevos tests, renombrado), este test
 * falla y obliga a actualizar §2 (y §7 si referencia counts) — es el anti-drift de
 * la baseline. La suite completa (`npm test`) incluye este guard: sus números
 * documentados cubren la suite completa (guard incluido).
 *
 * NOTA: este guard verifica COUNTS (nº de test files y tests), no que los tests
 * pasen — si un test se marca `.skip` el total se mantiene y el guard no lo detecta
 * (eso lo hace la propia suite al fallar).
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const DOC = path.join(ROOT, 'docs', 'baseline_fase0_v32.md');
const VITEST_BIN = path.join(ROOT, 'node_modules', 'vitest', 'vitest.mjs');
const TESTS_DIR = path.join(ROOT, 'WebUI', 'tests');
const SELF_FILE = path.basename(fileURLToPath(import.meta.url));

/**
 * Nº de tests que declara ESTE archivo. Es una CONSTANTE verificada (no un parseo
 * del propio fuente, que sería frágil): 1 `it()` de reconcile + 3 unit tests del
 * parseo (`parseChildSummary`). Si se añade un test nuevo aquí, este número debe
 * subir en la misma proporción.
 */
const SELF_TEST_COUNT = 4;
expect(SELF_TEST_COUNT).toBeGreaterThan(0);

/** Lee {files, tests} documentados en §2 de la baseline (formato `| Test files | **N** |`). */
function readDocBaseline() {
  const text = fs.readFileSync(DOC, 'utf8');
  const section = text.match(/## 2\. Baseline WebUI[\s\S]*?(?=\n## 3\.)/);
  if (!section) {
    throw new Error('sección "## 2. Baseline WebUI" no encontrada en baseline_fase0_v32.md');
  }
  const files = section[0].match(/\| Test files \| \*\*(\d+)\*\*/);
  const tests = section[0].match(/\| Tests \| \*\*(\d+)\*\*/);
  if (!files || !tests) {
    throw new Error('formato de counts de §2 no parseable — esperaba | Test files | **N** | y | Tests | **N** |');
  }
  return { files: Number(files[1]), tests: Number(tests[1]) };
}

/**
 * Parsea el resumen de un subproceso vitest ({files, tests}) tras limpiar ANSI.
 * `tests` = passed + skipped (el total documentado en §2 incluye los skipped).
 * Función pura y exportable para poder testearla con fixtures.
 */
export function parseChildSummary(stdoutRaw) {
  const stdout = String(stdoutRaw).replace(/\u001b\[[0-9;]*m/g, '');
  const filesMatch = stdout.match(/Test Files\s+\d+ passed/);
  const testsMatch = stdout.match(/Tests\s+\d+ passed(?:\s+\|\s+\d+ skipped)?/);
  if (!filesMatch || !testsMatch) {
    throw new Error('no se pudo parsear el resumen del subproceso vitest (últimas líneas):\n' + stdout.slice(-600));
  }
  const fileCount = Number(filesMatch[0].match(/\d+/)[0]);
  const passed = Number(testsMatch[0].match(/\d+/)[0]);
  const skippedMatch = testsMatch[0].match(/(\d+) skipped/);
  const skipped = skippedMatch ? Number(skippedMatch[1]) : 0;
  return { files: fileCount, tests: passed + skipped };
}

/** Corre la suite real en subproceso con todos los test files EXCEPTO este guard. */
function runChildSuite() {
  const files = fs.readdirSync(TESTS_DIR)
    .filter((f) => f.endsWith('.test.js') && f !== SELF_FILE)
    .map((f) => 'WebUI/tests/' + f); // rutas relativas con '/' (filtros de vitest)
  let stdout = '';
  let status = 0;
  try {
    stdout = execFileSync(process.execPath, [VITEST_BIN, 'run', ...files], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 180000,
    });
  } catch (err) {
    // El subproceso termina con exit != 0 si algún test del child falla. NO lo
    // enmascaramos: el guard debe fallar (la suite real está rota) con el stderr.
    status = err.status;
    stdout = (err.stdout || '') + (err.stderr || '');
    throw new Error(
      'el subproceso de la suite real terminó con exit code ' + status +
      ' (la suite está rota — no es un problema del guard). Primeras líneas del stderr:\n' +
      String(err.stderr || '').slice(0, 800),
    );
  }
  return parseChildSummary(stdout);
}

describe('Baseline guard (baseline_fase0_v32.md §2 vs suite real)', () => {
  it('los counts documentados coinciden con la suite real (subproceso + guard)',
    () => {
      const doc = readDocBaseline();
      const child = runChildSuite();

      // child.tests ya incluye los skipped del subproceso; al guard le sumamos sus
      // propios tests (no hay skipped aquí).
      const projectedFiles = child.files + 1; // este archivo no corre en el subproceso
      const projectedTests = child.tests + SELF_TEST_COUNT;

      const message =
        'Baseline §2 documenta ' + doc.files + ' files / ' + doc.tests + ' tests, pero la suite ' +
        'real proyecta ' + projectedFiles + ' files / ' + projectedTests + ' tests ' +
        '(subproceso sin guard: ' + child.files + ' files / ' + child.tests + ' tests, +' +
        SELF_TEST_COUNT + ' tests del guard). Actualiza docs/baseline_fase0_v32.md §2 (y §7 ' +
        'si referencia counts).';

      expect({ files: doc.files, tests: doc.tests }, message)
        .toEqual({ files: projectedFiles, tests: projectedTests });
    },
    120000); // la suite hija (sin guard) tarda ~15s; el subproceso interno tiene su propio timeout de 180s

  it('parseChildSummary parses ANSI, passed and skipped counts', () => {
    const raw = '\u001b[32m✓\u001b[0m file (1 test)\n\n Test Files  99 passed (99)\n' +
      '      Tests  4647 passed | 2 skipped (4649)\n';
    expect(parseChildSummary(raw)).toEqual({ files: 99, tests: 4649 });
  });

  it('parseChildSummary parses a summary without skipped tests', () => {
    const raw = '\n Test Files  10 passed (10)\n      Tests  25 passed (25)\n';
    expect(parseChildSummary(raw)).toEqual({ files: 10, tests: 25 });
  });

  it('parseChildSummary throws on a non-parseable summary', () => {
    expect(() => parseChildSummary('some garbage output')).toThrow(/no se pudo parsear/);
  });
});
