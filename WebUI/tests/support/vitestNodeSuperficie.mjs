/**
 * vitestNodeSuperficie.mjs — la SUPERFICIE de `vitest/node`, medida fuera del worker.
 *
 * Existe por un motivo concreto, MEDIDO: si un fichero de test importa
 * `vitest/node` directamente, la cadena de resolución de Node pasa por
 * `magic-string`, que vive en el store de pnpm y da EPERM desde el sandbox. El test
 * entero deja de importar y sale con 0 tests, que es peor que rojo: parece que no
 * hay tests, no que hay un problema.
 *
 * Así que aquí la superficie se pide a un PROCESO HIJO, que la importa fuera del
 * worker. Mismo patrón y mismo motivo que `glob-test-files.mjs`.
 *
 * Lo que devuelve son los TIPOS de lo que hace falta, no los objetos: el test
 * necesita comprobar que `createVitest` es función y que devuelve algo con
 * `globTestSpecifications` y `close`. Comprobarlo aquí evita crear una instancia de
 * Vitest DENTRO del worker, que es lo que no se debe hacer.
 *
 * Un dato que salió de medir y que no se esperaba: `vitest` (el barrel) NO exporta
 * `version` en 4.1.11, pero `vitest/node` SÍ. Por eso la version sale de aquí.
 */

import { createRequire } from 'node:module';

/**
 * Tipos de la superficie que usa `glob-test-files.mjs`.
 *
 * @param {string} dondeVitestNode ruta resuelta de `vitest/node`
 * @returns {Promise<{createVitest: string, globTestFiles: string,
 *   instanceGlobTestSpecifications: string, instanceClose: string,
 *   version: string|null, exportCount: number}>}
 */
export async function superficieDeVitestNode(dondeVitestNode) {
  // `createRequire` y no `import()`: un `import(dinamico)` dentro de este
  // fichero pasa por el transformador de Vite cuando lo ejecuta el worker, y vite
  // le antepone su alias `@id/` a lo que ve. MEDIDO: al darle la ruta absoluta
  // salia `D:\@id\D:\...\vitest\dist\node.js`, que no existe, y el error no
  // decia nada de como se le habia dado el nombre.
  //
  // Resolver con `require` es resolucion de Node normal, y es lo que ya hacia
  // `glob-test-files.mjs` con `import ... from 'vitest/node'`.
  const req = createRequire(import.meta.url);
  const mod = req(dondeVitestNode);
  const {createVitest} = mod;

  if (typeof createVitest !== 'function') {
    return {
      createVitest: typeof createVitest,
      globTestFiles: typeof mod.globTestFiles,
      instanceGlobTestSpecifications: '(sin instancia)',
      instanceClose: '(sin instancia)',
      version: null,
      exportCount: Object.keys(mod).length,
    };
  }

  // Se crea y se cierra: la forma de la instancia es parte del contrato, y sin
  // mirar el objeto real estariamos suponiendo lo que trae.
  const vitest = await createVitest('test', {run: true, watch: false});
  try {
    return {
      createVitest: typeof createVitest,
      globTestFiles: typeof mod.globTestFiles,
      instanceGlobTestSpecifications: typeof vitest.globTestSpecifications,
      instanceClose: typeof vitest.close,
      version: typeof mod.version === 'string' ? mod.version : null,
      exportCount: Object.keys(mod).length,
    };
  } finally {
    await vitest.close();
  }
}

/**
 * La version que declara `vitest/node`, o `null` si no la declara.
 *
 * @param {string} dondeVitestNode
 * @returns {Promise<string|null>}
 */
export function versionDeVitestNode(dondeVitestNode) {
  const mod = createRequire(import.meta.url)(dondeVitestNode);
  return typeof mod.version === 'string' ? mod.version : null;
}