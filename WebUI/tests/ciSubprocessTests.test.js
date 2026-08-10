/**
 * ciSubprocessTests.test.js — auditoría de tests con subprocesos (plan v3.2 Fase 7).
 *
 * Algunos tests de la suite dependen de SCRIPTS EXTERNOS (child_process con
 * execFileSync/execSync, o `require`/string-literal de `scripts/*.js`). Este test
 * garantiza que TODOS ellos quedan recogidos por el job `vitest` de webui-ci
 * (`.github/workflows/webui-ci.yml` → `npm test`):
 *
 *   1. Detección estática: todo test file de `WebUI/tests/` que use child_process o
 *      referencie un script de `scripts/` se detecta automáticamente (sin lista
 *      manual que mantener).
 *   2. Existencia: cada script del que depende un test existe en `scripts/`.
 *   3. Recogida real: `vitest list` (la misma colección que corre `npm test`) incluye
 *      cada test file detectado.
 *   4. Sin filtros: webui-ci ejecuta `npm test` y vitest.config.js NO define
 *      `include:` (usa la convención por defecto: todos los *.test.js de WebUI).
 *
 * Fuentes auditadas (esperadas): roundtripCorpusScript, fuzzRoundtripScript,
 * domSanitize (security_scan), verifyDocsCiJobs, registryGen, checkWasmBuild,
 * baselineGuard y exportCalibrationRun.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const TESTS_DIR = path.join(ROOT, 'WebUI', 'tests');
const SCRIPTS_DIR = path.join(ROOT, 'scripts');
const WEBUI_SCRIPTS_DIR = path.join(ROOT, 'WebUI', 'scripts');
const VITEST_BIN = path.join(ROOT, 'node_modules', 'vitest', 'vitest.mjs');
const VITEST_CONFIG = path.join(ROOT, 'vitest.config.js');
const WEBUI_WF = path.join(ROOT, '.github', 'workflows', 'webui-ci.yml');
const SELF_FILE = path.basename(fileURLToPath(import.meta.url));

/**
 * Detecta dependencias a subprocesos/scripts externos en el contenido de un test:
 *   - child_process: imports `node:child_process` o `child_process` (exec/spawn).
 *   - scripts: cualquier referencia a `scripts/<nombre>.js` (require, path.join,
 *     string literal, comentario de uso…).
 * Devuelve un array ordenado de nombres (sin 'child_process' si no procede).
 */
export function detectScriptDeps(content) {
  const deps = new Set();
  if (/from\s+['"](?:node:)?child_process['"]|require\(['"](?:node:)?child_process['"]\)/.test(content)) {
    deps.add('child_process');
  }
  // `scripts` seguido de separadores varios (/, ', ", espacios, comas) y un nombre
  // de archivo con extensión .js — cubre path.join(ROOT, 'scripts', '<name>.js') y
  // 'scripts/<name>.js'. (Ojo: este propio archivo NO se auto-escanea; el ejemplo
  // usa <name> para no casar con la regex.)
  const re = /scripts['"\\/\s,]+([a-zA-Z0-9_.\-]+\.js)/g;
  let m;
  while ((m = re.exec(content)) !== null) { deps.add(m[1]); }
  return [...deps].sort();
}

/** Resuelve si un script existe en scripts/ o en WebUI/scripts/ (dos ubicaciones usadas). */
function scriptExists(name) {
  return fs.existsSync(path.join(SCRIPTS_DIR, name)) ||
         fs.existsSync(path.join(WEBUI_SCRIPTS_DIR, name));
}

/** Devuelve [{ file, deps }] para cada test file de WebUI/tests que depende de algo externo. */
export function allScriptDependentTests() {
  const result = [];
  for (const f of fs.readdirSync(TESTS_DIR)) {
    // El propio auditor no se auto-escanea: solo menciona `scripts/` en su docstring.
    if (!f.endsWith('.test.js') || f === SELF_FILE) { continue; }
    const content = fs.readFileSync(path.join(TESTS_DIR, f), 'utf8');
    const deps = detectScriptDeps(content);
    if (deps.length > 0) { result.push({ file: 'WebUI/tests/' + f, deps }); }
  }
  return result.sort((a, b) => a.file.localeCompare(b.file));
}

/** Corre `vitest list` en subproceso (misma colección que `npm test`) y devuelve el stdout. */
function vitestListOutput() {
  try {
    return execFileSync(process.execPath, [VITEST_BIN, 'list'], {
      cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000,
    });
  } catch (err) {
    throw new Error('vitest list (subproceso) falló: ' + String(err.stderr || err.message).slice(0, 500));
  }
}

describe('auditoría de tests con subprocesos (webui-ci → npm test)', () => {
  it('detecta los tests dependientes de scripts conocidos (smoke)', () => {
    const all = allScriptDependentTests();
    const byFile = Object.fromEntries(all.map((x) => [x.file, x.deps]));
    expect(byFile['WebUI/tests/roundtripCorpusScript.test.js']).toContain('roundtrip_corpus.js');
    expect(byFile['WebUI/tests/fuzzRoundtripScript.test.js']).toContain('fuzz_roundtrip.js');
    expect(byFile['WebUI/tests/domSanitize.test.js']).toContain('security_scan.js');
    expect(byFile['WebUI/tests/verifyDocsCiJobs.test.js']).toContain('verify_docs_ci_jobs.js');
    expect(byFile['WebUI/tests/baselineGuard.test.js']).toContain('child_process');
  });

  it('todo script referenciado por un test existe en scripts/', () => {
    const all = allScriptDependentTests();
    const missing = [];
    for (const { file, deps } of all) {
      for (const dep of deps) {
        if (dep === 'child_process') { continue; }
        if (!scriptExists(dep)) { missing.push(file + ' → ' + dep); }
      }
    }
    expect(missing).toEqual([]);
  });

  it('todos los tests dependientes de scripts se recogen en vitest list (colección de npm test)', () => {
    const all = allScriptDependentTests();
    expect(all.length).toBeGreaterThanOrEqual(7);
    const listing = vitestListOutput();
    for (const { file } of all) {
      expect(listing.includes(file), file + ' no aparece en la colección de vitest').toBe(true);
    }
  }, 120000);

  it('webui-ci.yml corre `npm test` sin filtros de include en vitest.config.js', () => {
    const wf = fs.readFileSync(WEBUI_WF, 'utf8');
    expect(wf).toMatch(/run:\s*npm test/);
    expect(wf).not.toMatch(/vitest run [a-zA-Z0-9_./-]+/); // sin paths restringidos
    const config = fs.readFileSync(VITEST_CONFIG, 'utf8');
    expect(config).not.toMatch(/\binclude\s*:/); // convención por defecto de vitest
  });
});
