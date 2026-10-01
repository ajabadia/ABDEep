/**
 * vitestSuite.js — enumerar la suite SIN ejecutar sus tests (utilidad COMPARTIDA).
 * ===============================================================================
 *
 * Los guards que vigilan la forma de la suite (baselineGuard, ciSubprocessTests)
 * necesitan lo mismo: saber qué ficheros y qué tests recoge la colección de vitest.
 * Ese cálculo vivía duplicado; aquí está una sola vez, con la capacidad del vitest
 * INSTALADO como única variable.
 *
 * FICHEROS — autoritativos SIEMPRE, sin ejecutar nada
 *   `globTestFiles()` (vía el proceso hijo `glob-test-files.mjs`) usa el propio
 *   include/config de vitest, así que la lista es exacta en cualquier versión y no
 *   reimplementa globs (incluye, p.ej., `scripts/registry_core.test.ts`, que vive
 *   fuera de `WebUI/tests/`).
 *
 * TESTS — solo si el toolchain puede enumerarlos
 *   `vitest list` enumera tests SIN ejecutarlos, pero existe desde vitest 3. Con
 *   vitest < 3 el recuento real exige EJECUTAR la suite entera (~200 s), justo lo
 *   que estos guards evitan; por eso `tests` es `null` en ese caso.
 *   `list` NO enumera los tests en pending (`describe.skipIf`, `.skip`) — verificado
 *   con vitest 4.1.11 — así que `withSkipped` añade `numPendingTests` de un barrido
 *   `--reporter=json` sobre los ficheros con `skipIf` (ligero: solo esos).
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(HERE, '..', '..', '..');
export const TESTS_DIR = path.join(ROOT, 'WebUI', 'tests');
const GLOB_SCRIPT = path.join(HERE, 'glob-test-files.mjs');
const VITEST_PKG = path.join(ROOT, 'node_modules', 'vitest', 'package.json');
const VITEST_BIN = path.join(ROOT, 'node_modules', 'vitest', 'vitest.mjs');

/** Versión instalada de vitest (la que decide qué comandos existen). */
export function vitestVersion() {
  return JSON.parse(fs.readFileSync(VITEST_PKG, 'utf8')).version;
}

/** `vitest list` existe desde vitest 3. */
export function hasListCommand() {
  return Number(vitestVersion().split('.')[0]) >= 3;
}

/** Ruta absoluta → relativa a ROOT con separadores '/'. */
function relFromRoot(abs) {
  return path.relative(ROOT, abs).split(path.sep).join('/');
}

/** Test files que recoge vitest (rutas relativas a ROOT), sin ejecutar tests. */
export function collectedTestFiles() {
  const out = execFileSync(process.execPath, [GLOB_SCRIPT], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 180000,
  });
  const line = String(out).split(/\r?\n/).find((l) => l.startsWith('__GLOB__'));
  if (!line) {
    throw new Error('glob-test-files.mjs no devolvió la línea __GLOB__ (salida: ' +
      String(out).slice(-400) + ')');
  }
  return JSON.parse(line.slice('__GLOB__'.length)).map(relFromRoot).sort();
}

/** Ficheros de `files` que declaran skips condicionales (`skipIf`). */
function conditionalSkipFiles(files) {
  return files.filter((f) => /\bskipIf\b/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
}

/** Tests en pending (skips condicionales) de `files`, vía `--reporter=json`. */
function countPendingTests(files) {
  const conditional = conditionalSkipFiles(files);
  if (conditional.length === 0) { return 0; }
  const out = execFileSync(
    process.execPath,
    // --maxWorkers 1: huella mínima por si la suite principal corre en paralelo.
    [VITEST_BIN, 'run', '--reporter=json', '--maxWorkers', '1', ...conditional],
    { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000 },
  );
  return JSON.parse(out).numPendingTests || 0;
}

/**
 * Enumera la suite sin ejecutar sus tests.
 *
 * @param {{exclude?: string|null, withSkipped?: boolean}} [opts]
 *   `exclude`  nombre de fichero a omitir (p.ej. el propio guard, que no se enumera
 *              a sí mismo). `withSkipped` añade al total los tests en pending que
 *              `list` no enumera (ver cabecera).
 * @returns {{files: string[], tests: number|null, reason: string|null}}
 *   `files` son rutas relativas a ROOT; `tests` es el total (con skipped si se pidió)
 *   o `null` si el vitest instalado no puede enumerar tests sin ejecutarlos.
 * @throws si la enumeración falla (eso SÍ es un error real, no una falta de capacidad).
 */
export function enumerateSuite(opts = {}) {
  const exclude = opts.exclude ?? null;
  const files = collectedTestFiles().filter((f) => f !== exclude && !f.endsWith('/' + exclude));

  if (! hasListCommand()) {
    return {
      files,
      tests: null,
      reason: 'vitest ' + vitestVersion() +
        ' no tiene el comando `list` (existe desde vitest 3): los tests no se pueden ' +
        'enumerar sin ejecutar la suite entera',
    };
  }

  const out = execFileSync(process.execPath, [VITEST_BIN, 'list', ...files], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 180000,
  });
  const lines = String(out).split(/\r?\n/).filter((l) => l.trim().length > 0);
  const pending = opts.withSkipped ? countPendingTests(files) : 0;

  return { files, tests: lines.length + pending, reason: null };
}
