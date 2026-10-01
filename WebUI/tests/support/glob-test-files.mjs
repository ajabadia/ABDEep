/**
 * glob-test-files.mjs — imprime (stdout, JSON) los test files que recoge vitest.
 *
 * Se ejecuta como PROCESO HIJO desde `vitestSuite.js` para no crear una instancia de
 * Vitest anidada dentro de un worker ya en marcha. Delega en el propio glob/config de
 * vitest (`createVitest().globTestFiles()`), así que la lista es autoritativa en
 * cualquier versión (no reimplementa el include ni las exclusiones).
 *
 * Salida: una única línea `__GLOB__[...]` (rutas ABSOLUTAS) para que el proceso padre
 * pueda ignorar cualquier log que vitest escriba en stdout.
 */

import { createVitest } from 'vitest/node';

const vitest = await createVitest('test', { run: true, watch: false });
try {
  // `globTestFiles()` devuelve WorkspaceSpec[] = [proyecto, ruta].
  const specs = await vitest.globTestFiles();
  process.stdout.write('__GLOB__' + JSON.stringify(specs.map((spec) => spec[1])) + '\n');
} finally {
  await vitest.close();
}
