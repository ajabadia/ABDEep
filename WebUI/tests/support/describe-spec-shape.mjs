/**
 * describe-spec-shape.mjs — vuelca la FORMA de un `TestSpecification`, en JSON.
 *
 * Hermano de `glob-test-files.mjs`, y por el mismo motivo: hace falta una
 * instancia de Vitest para ver lo que devuelve su API interna, y eso no se puede
 * hacer dentro de un worker que ya tiene una instancia en marcha. Por eso esto es
 * un PROCESO HIJO y no una funcion.
 *
 * Que volque la FORMA y no la lista de ficheros es a proposito. A `glob-test-files`
 * le basta con las rutas, y por eso al romperse `moduleId` se rompia EN SILENCIO:
 * `spec[1]` sobre un objeto devuelve `undefined` sin lanzar nada. Este vuelca las
 * CLAVES de un spec, asi que un cambio de API se ve como un cambio de contrato y no
 * como un recuento que de repente vale cero.
 *
 * El path de `vitest/node` llega por argv y lo resuelve el padre, para que se mida
 * el vitest que esta CORRIENDO los tests y no el que se encontraria subiendo desde
 * este fichero. Con pnpm, los dos pueden ser distintos.
 *
 * Salida: una unica linea `__SHAPE__{json}`, con la misma idea del marcador que
 * usa `glob-test-files.mjs`: el padre ignora cualquier otra cosa que vitest escriba
 * en stdout.
 */

import { createRequire } from 'node:module';

const [, , dondeVitestNode] = process.argv;

if (!dondeVitestNode) {
  console.error('falta la ruta de vitest/node');
  process.exit(2);
}

// `createRequire` y no `import()`: ver la nota de
// `vitestNodeSuperficie.mjs`. Un import dinamico lo transforma Vite, que le
// antepone el alias `@id/` a la ruta y rompe la resolucion.
const nodeApi = createRequire(import.meta.url)(dondeVitestNode);

if (typeof nodeApi.createVitest !== 'function') {
  // No es un fallo de este script: es el contrato roto, y conviene que el padre
  // lo vea con el mensaje de vitest y no con el mio.
  console.error('__SHAPE__{"error":"createVitest no es funcion"}');
  process.exit(1);
}

const vitest = await nodeApi.createVitest('test', { run: true, watch: false });
try {
  const specs = await vitest.globTestSpecifications();

  if (specs.length === 0) {
    // Con cero specs NO se puede deducir la forma, y el contrato necesita por lo
    // menos uno. Se dice con nombre propio para no confundirlo con "la API cambio".
    console.error('__SHAPE__{"error":"globTestSpecifications devolvio 0 specs"}');
    process.exit(1);
  }

  const primero = specs[0];
  const forma = {
    // La clase de la que viene. Si mañana es otra, el contrato lo ve.
    constructor: primero.constructor?.name ?? '(sin constructor)',
    // Las claves, ordenadas: el contrato se fija en el JUEGO de claves.
    claves: Object.keys(primero).sort(),
    // Si todas las entradas traen las mismas. Si no, la forma depende de la
    // entrada y la formula de arriba solo valdria para algunas.
    homogeneas: new Set(specs.map((s) => Object.keys(s).sort().join(','))).size === 1,
    // Que `moduleId` este en todas y sea ruta de verdad.
    moduleIdEnTodas: specs.every((s) => typeof s.moduleId === 'string' && s.moduleId !== ''),
    // Lo que la API de 1.6.1 daba: pares [proyecto, ruta]. Si esto volviera a ser
    // un array, `spec[1]` volveria a funcionar y el codigo de 4 dejaria de lado la
    // ruta correcta sin avisar.
    esArray: Array.isArray(primero),
    // Y la formula vieja aplicada a lo de ahora: si esto dejara de ser todo
    // `undefined`, el salto a medias habria cambiado de signo.
    spec1EsUndefinedEnTodas: specs.every((s) => s[1] === undefined),
    // Un ejemplo, para leer el contrato y ver a que se parece.
    ejemploModuleId: primero.moduleId,
    // Que claves de las medidas estan ausentes: es el mismo dato que `claves`, pero
    // en la forma que hace falta para escribir "esta YA NO EXISTE" sin tener que
    // comparar a ojo con una lista de 54 exports.
    pool: primero.pool ?? null,
  };

  process.stdout.write('__SHAPE__' + JSON.stringify(forma) + '\n');
} finally {
  await vitest.close();
}