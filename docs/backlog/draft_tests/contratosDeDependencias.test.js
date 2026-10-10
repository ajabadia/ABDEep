/**
 * contratosDeDependencias.test.js — pruebas de CONTRATO de lo que este repo le
 * pide a sus dependencias por API interna.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ EXISTE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `WebUI/tests/support/glob-test-files.mjs` usa `vitest/node`: `createVitest()`,
 * `globTestSpecifications()`, `spec.moduleId` y `vitest.close()`. Eso NO es API
 * pública de vitest, es su interior, y por lo tanto **no tiene garantía de
 * compatibilidad entre versions**.
 *
 * Cuando se subio de 1.6.1 a 4.1.11, ese fichero se rompio — dos veces: el metodo
 * cambio de nombre y la forma de lo que devuelve cambio de pares a objetos— y
 * **se rompió en silencio**. Con la API de 1 sobre los objetos de 4, `spec[1]`
 * devuelve `undefined` sin lanzar nada: la lista sale vacía, el recuento es 0, y un
 * cero no se parece a un fallo. La cabeza de la cadena de guards
 * (`baselineGuard` → `vitestSuite.enumerateSuite()` → `collectedTestFiles()` →
 * este script) se queda mirando un documento en blanco sin decir palabra.
 *
 * Este fichero convierte eso en una propiedad que se **revalida en cada corrida**,
 * con la version que haya instalada. En vez de descubrir el proximo salto a medias
 * leyendo un log raro, sale un test rojo que dice exactamente qué cambio.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CUATRO CONTRATOS, Y POR QUÉ ESOS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * La auditoria del repo (imports profundos y APIs internas de vitest, vite, jspdf y
 * midi) deja UN consumidor de API interna: este script. Los otros son API publica.
 * Pero "un consumidor" no es "un contrato", porque el daño se reparte en tres sitios
 * distintos y cada uno se rompe de una manera:
 *
 *   1. LA SUPERFICIE   — que existan `createVitest`, `globTestSpecifications` y
 *                        `close`. Si falta uno, el script lanza al arrancar: se ve.
 *   2. LA FORMA        — que un spec traiga `moduleId` con una ruta. Si no, el
 *                        script devuelve una lista vacia: NO se ve. Este es el
 *                        contrato peligroso y por eso tiene mas tests.
 *   3. EL PROTOCOLO    — que el script saque `__GLOB__` + JSON de rutas ABSOLUTAS,
 *                        que es lo que `vitestSuite.js` se pone a parsear. Un cambio
 *                        de Aqui es un fallo de contrato entre dos ficheros NUESTROS.
 *   4. LA ENTRADA      — que `node_modules/vitest/vitest.mjs` exista y sea la misma
 *                        version que corre los tests. `vitestSuite.js` lanza vitest
 *                        como subproceso por ahi: si la ruta se mueve, los guards
 *                        enumeran cero ficheros y tampoco se ve.
 *
 * Las 2, 3 y 4 fallan TODAS de la misma manera, que es devolviendose sin error. Por
 * eso el contrato no se limita a "no lanza": mira que lo que sale sea lo que tiene
 * que salir.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CÓMO SE MIDEN, Y POR QUÉ EL PROCESO HIJO
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Los contratos 2 y 3 necesitan una instancia de Vitest, y no se puede crear una
 * dentro de un worker que ya tiene una: de ahi que `describe-spec-shape.mjs` y
 * `glob-test-files.mjs` sean procesos hijos. El path de `vitest/node` se les pasa
 * resuelto desde aqui, para que se mida el vitest que esta CORRIENDO los tests y
 * no el que se encontraria subiendo desde el fichero del helper.
 *
 * Todo lo que lanza un proceso lleva timeout explicito, por lo MEDIDO: vitest 4
 * cambio el pool por defecto de `threads` a `forks`, y con 129 ficheros
 * levantando procesos hijo a la vez, uno que tarda 400 ms aislado se va a 5 s.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { ROOT, VITEST_BIN, collectedTestFiles } from './support/vitestSuite.js';
import { superficieDeVitestNode, versionDeVitestNode } from './support/vitestNodeSuperficie.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHAPE_SCRIPT = path.join(HERE, 'support', 'describe-spec-shape.mjs');
const GLOB_SCRIPT = path.join(HERE, 'support', 'glob-test-files.mjs');

// El NOMBRE del modulo, no su ruta. Deliberado, y medido: darle la ruta
// absoluta hace que vite le anteponga su alias `@id/` y el import falla con un
// `D:\@id\D:\...` que no existe. Resolviendolo por nombre en el proceso hijo,
// con `createRequire`, es resolucion de Node normal.
//
// Y `from AQUI`, no desde el helper: lo que se quiere medir es el vitest que esta
// CORRIENDO estos tests.
const VITEST_NODE = 'vitest/node';

/** Corre un script de soporte y devuelve su stdout. Lanza si el proceso falla. */
function correrScript(script, args = []) {
  return execFileSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 180000,
  });
}

/** La linea `__GLOB__` del script de glob, parseada. */
function salidaGlob() {
  const salida = correrScript(GLOB_SCRIPT);
  const linea = String(salida).split(/\r?\n/).find((l) => l.startsWith('__GLOB__'));
  expect(linea, `glob-test-files.mjs no devolvio __GLOB__. Salida: ${String(salida).slice(-300)}`)
    .toBeTruthy();
  return { cruda: linea, rutas: JSON.parse(linea.slice('__GLOB__'.length)) };
}

/**
 * La superficie de `vitest/node`, desde un proceso hijo.
 *
 * Va en un hijo, y no en un import, por un motivo MEDIDO: importar
 * `vitest/node` desde un fichero de test hace que la resolucion pase por
 * `magic-string`, que esta en el store de pnpm y da EPERM desde el sandbox. El
 * test entero deja de importar y sale con 0 tests, que es peor que rojo: parece
 * que no hay tests, no que hay un problema.
 *
 * @returns {Promise<object>} los tipos de la superficie que usa el script
 */
async function superficie() {
  const mod = await import('./support/vitestNodeSuperficie.mjs');
  return mod.superficieDeVitestNode(VITEST_NODE);
}

/** La version que declara `vitest/node`, o `null`. */
async function versionDeNode() {
  const mod = await import('./support/vitestNodeSuperficie.mjs');
  return mod.versionDeVitestNode(VITEST_NODE);
}
/** La forma del spec, desde el proceso hijo que crea la instancia de Vitest. */
function formaDelSpec() {
  const salida = correrScript(SHAPE_SCRIPT, [VITEST_NODE]);
  const linea = String(salida).split(/\r?\n/).find((l) => l.startsWith('__SHAPE__'));
  expect(linea, `describe-spec-shape.mjs no devolvio __SHAPE__. Salida: ${String(salida).slice(-300)}`)
    .toBeTruthy();
  return JSON.parse(linea.slice('__SHAPE__'.length));
}

describe('CONTRATO 1 — la superficie de vitest/node que usa glob-test-files.mjs', () => {
  it('createVitest es una funcion', async () => {
    // El primer peldano. Si esto no es funcion, el script muere al arrancar, que
    // es la clase de fallo que SI se ve. Esta aqui para que el mensaje lo diga
    // antes que el error de "no es constructor".
    expect((await superficie()).createVitest).toBe('function');
  }, 60000);

  it('globTestFiles YA NO existe: el que se usa es globTestSpecifications', async () => {
    // El nombre viejo tiene que seguir SIN estar. Si vuelve, el salto a medias se
    // ha dado la vuelta y el codigo de 4 estaria llamando a una API de 1 que
    // existe otra vez: dos caminos a la verdad, y solo uno probado.
    //
    // MEDIDO: en 4.1.11 `vitest/node` exporta 54 simbolos y ninguno es este.
    expect((await superficie()).globTestFiles).toBe('undefined');
  }, 60000);

  it('la instancia de createVitest tiene los dos metodos que el script usa', async () => {
    // `createVitest` es asincrono: se mira la instancia RESUELTA, no la promesa.
    // Comprobar la promesa sin esperarla siempre sale bien y no mide nada, que es
    // la forma mas comoda de tener un test inutil.
    const s = await superficie();
    expect(s.instanceGlobTestSpecifications).toBe('function');
    expect(s.instanceClose).toBe('function');
  }, 60000);

  it('la version que declara vitest/node es la del repo', async () => {
    // `vitest/node` SI exporta `version` —MEDIDO, a diferencia del barrel
    // `vitest`, que en 4.1.11 NO la exporta—, y es el punto mas barato de la
    // suite para detectar que lo que se esta midiendo no es lo del repo.
    const declarada = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
      .devDependencies.vitest;
    const version = await versionDeNode();
    expect(version, 'vitest/node no exporta version').not.toBeNull();
    expect(
      version.startsWith(declarada.replace(/^[\^~]/, '')),
      `vitest/node dice "${version}" y package.json declara "${declarada}"`,
    ).toBe(true);
  }, 60000);
});

// MEDIDO contra 4.1.11 con build/medir-forma-spec.mjs: el spec es una
// `TestSpecification` con ESTAS claves, el mismo juego en todas las entradas.
const CLAVES_MEDIDAS = [
  'moduleId', 'pool', 'project', 'taskId', 'testIds',
  'testLines', 'testNamePattern', 'testTagsFilter',
];

describe('CONTRATO 2 — la forma de lo que devuelve globTestSpecifications', () => {
  it('un spec NO es un array: la API de 1.6.1 devolvia pares [proyecto, ruta]', () => {
    // Si esto volviera a ser array, `spec[1]` volveria a funcionar y el codigo de
    // 4 dejaria de mirar `moduleId` sin avisar: el fallo pasaria de "lista vacia"
    // a "rutas de otro proyecto", que es peor porque parece que funcionan.
    expect(formaDelSpec().esArray).toBe(false);
  });

  it('spec[1] da undefined en TODAS las entradas', () => {
    // La comprobacion del SILENCIO, hecha explicita. Es la que convierte
    // "la lista sale vacia" en "la lista sale vacia PORQUE spec[1] es undefined".
    expect(formaDelSpec().spec1EsUndefinedEnTodas).toBe(true);
  });

  it('moduleId es una ruta no vacia en TODAS las entradas', () => {
    // La propiedad que de verdad lleva la ruta. El script la lee y el guard interno
    // lanza si alguna falta; este test es el que dice que la forma es la que se
    // espera, sin depender de que el guard se entere.
    expect(formaDelSpec().moduleIdEnTodas).toBe(true);
  });

  it('trae EXACTAMENTE las claves medidas, y son las mismas en todas', () => {
    // Congelar el juego de claves entero, y no solo `moduleId`. Una clave que
    // desaparece no rompe el script —que solo lee `moduleId`—, pero suele ser la
    // primera senal de que la API se esta moviendo.
    const forma = formaDelSpec();
    expect(forma.claves).toEqual(CLAVES_MEDIDAS);
    expect(forma.homogeneas).toBe(true);
  });

  it('la clase se llama TestSpecification', () => {
    // La clase es mas estable que las claves. Si el nombre cambia, hay que revisar
    // las dos cosas; si las claves cambian y el nombre no, casi seguro es un
    // añadido inocuo en vez de una ruptura.
    expect(formaDelSpec().constructor).toBe('TestSpecification');
  });
}, 240000);

describe('CONTRATO 3 — el protocolo __GLOB__ entre glob-test-files.mjs y vitestSuite.js', () => {
  it('devuelve una lista NO vacia de rutas absolutas que existen en disco', () => {
    const { rutas } = salidaGlob();
    // No vacia. Con 0, `collectedTestFiles()` devuelve [] y el baselineGuard
    // compararia la lista vacia contra el documento y no encajaria... salvo que el
    // documento dijese 0, que es justo el estado en el que un guard de recuento se
    // vuelve inofensivo sin querer.
    expect(rutas.length, 'glob devolvio 0 ficheros').toBeGreaterThan(100);
    for (const r of rutas) {
      expect(path.isAbsolute(r), `no es absoluta: ${r}`).toBe(true);
      expect(fs.existsSync(r), `no existe en disco: ${r}`).toBe(true);
    }
  });

  it('las rutas son de ficheros de test, no de cualquier cosa', () => {
    // Una ruta que existe pero no es un test seria el modo de fallo nuevo: el
    // recuento de ficheros contaria scripts de `scripts/`, que es legitimo, pero
    // tambien cualquier `.js` que se colara.
    const { rutas } = salidaGlob();
    const noTest = rutas.filter((r) => !/\.(test|spec)\.(js|mjs|cjs|ts|mts|cts|jsx|tsx)$/.test(r));
    expect(noTest, `ficheros recogidos que no son tests: ${noTest.slice(0, 5).join(', ')}`)
      .toEqual([]);
  });

  it('respeta los excludes de vitest.config.js: nada de build/ ni node_modules/', () => {
    // El exclude de `build/` esta escrito specifically porque dos copias de otros
    // reposPosts en `build/` se volvieron parte de la suite y aportaron 502 tests en
    // rojo. Si `glob-test-files.mjs` dejara de delegar en el glob de vitest y
    // empezara a reimplementar el include, esto caeria.
    const { rutas } = salidaGlob();
    const malos = rutas.filter((r) => /[\\/]build[\\/]/.test(r) || /[\\/]node_modules[\\/]/.test(r));
    expect(malos, `recogidos pese al exclude: ${malos.slice(0, 5).join(', ')}`).toEqual([]);
  });

  it('el helper que lo consume devuelve rutas RELATIVAS y ordenadas', () => {
    // El otro lado del contrato: `vitestSuite.js` quita el prefijo del repo y
    // ordena. Si el script empezara a devolver rutas ya relativas, este helper
    // devolveria `WebUI/tests/WebUI/tests/...` y el guard no encontraria nada.
    const archivos = collectedTestFiles();
    expect(archivos.length).toBeGreaterThan(100);
    for (const a of archivos) {
      expect(path.isAbsolute(a), `sigue siendo absoluta: ${a}`).toBe(false);
      expect(a.startsWith('WebUI/') || a.startsWith('scripts/') || a.includes('/'),
        `ruta rara: ${a}`).toBe(true);
    }
    const ordenados = [...archivos].sort();
    expect(archivos).toEqual(ordenados);
  });

  it('el marcador __GLOB__ es una linea propia y la salida es parseable como JSON', () => {
    // El padre busca una linea que EMPIECE por el marcador y hace
    // `slice('__GLOB__'.length)`. Si el JSON fuera multilinea, `find` cortaria por
    // la primera linea y `JSON.parse` fallaria con un error de sintaxis que no
    // explica nada. Esto ata esa suposicion.
    const { cruda } = salidaGlob();
    expect(cruda.startsWith('__GLOB__[')).toBe(true);
    expect(cruda.includes('\n')).toBe(false);
    expect(() => JSON.parse(cruda.slice('__GLOB__'.length))).not.toThrow();
  });
}, 120000);

describe('CONTRATO 4 — la entrada node_modules/vitest/vitest.mjs que lanza vitestSuite.js', () => {
  it('ese fichero existe y es un fichero', () => {
    // `vitestSuite.js` no llama a `npx`: llama a `execFileSync(node,
    // [node_modules/vitest/vitest.mjs])`. Si ese path se mueve en una subida de
    // version, elEnumeracion devuelve excepcion… que si se ve. Lo que NO se ve es
    // lo de despues: que ese mismo script se use para el recuento por RECOLECCION,
    // que es donde el numero del baseline se decide.
    expect(fs.existsSync(VITEST_BIN), `no existe: ${VITEST_BIN}`).toBe(true);
    expect(fs.statSync(VITEST_BIN).isFile(), `no es un fichero: ${VITEST_BIN}`).toBe(true);
  });

  it('el manifest de al lado dice la MISMA version que expone vitest/node', async () => {
    // Con pnpm, `node_modules/vitest` es un symlink al store. El subproceso y los
    // workers podrian, en teoria, mirar copias distintas si algo se desincroniza.
    // Aqui se compara la version del manifest con la que la propia API declara.
    const manifest = JSON.parse(fs.readFileSync(
      path.join(ROOT, 'node_modules', 'vitest', 'package.json'), 'utf8',
    ));
    expect(manifest.version).toBe(await versionDeNode());
  }, 60000);

  it('ningun test escribe a mano la ruta que este contrato vigila', () => {
    // El fallo MEDIDO que casi se cuela: el contrato 4 comprobaba una ruta escrita
    // a mano mientras `vitestSuite.js` tenia su propia constante. Al romper la
    // constante de verdad, el test seguia verde con 0 caidos: vigilaba una copia.
    //
    // Ahora usa `VITEST_BIN` importada. Este test ata que siga haciendolo: si
    // alguien vuelve a escribir la ruta a mano en un test, aqui sale rojo, que es
    // mucho antes de que se rompa el recuento del baseline.
    const fuente = fs.readFileSync(import.meta.filename, 'utf8');
    // Solo el CODIGO, no la prosa. Sin esto el test se detecta a si mismo: su
    // cabecera menciona `vitest.mjs` al explicar el contrato, y su `describe` lo
    // nombra. MEDIDO: asi salia un falso positivo con las dos lineas citadas.
    //
    // Y no basta con quitar los comentarios: lo que se busca es una EXPRESION que
    // construya la ruta, que es lo que congela la copia. Se distingue porque
    // `vitestSuite.js` la escribe en dos trozos —`'vitest'` y luego
    // `'vitest.mjs'`—, mientras que cualquier mencion en prosa la lleva entera.
    // El criterio es una LLAMADA a `path.join` con los dos trozos de la ruta. Lo
    // anterior buscaba la cadena `vitest.mjs` en el codigo, y por eso el guard se
    // detectaba a si mismo: su propio filtro es codigo que contiene esa cadena.
    // MEDIDO: salia un rojo con el mensaje VACIO, porque el filtro se contaba a si
    // mismo y por eso no cuadraba la cuenta.
    const construyen = fuente.split('\n')
      .filter((l) => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*'))
      .filter((l) => /path\.join\([^)]*['"]vitest['"][^)]*['"]vitest\.mjs['"]/.test(l));
    // La LISTA, no su longitud: `expect(0).toEqual([])` falla siempre, porque
    // un numero no es un array. MEDIDO: por eso salia un rojo con la lista
    // correctamente vacia.
    expect(
      construyen,
      `el contrato vuelve a construir la ruta a mano (${construyen.length}) en vez de `
        + `usar VITEST_BIN: ${construyen.join(' | ')}`,
    ).toEqual([]);
  });

  it('el subproceso y los workers usan el MISMO vitest, no dos copias', () => {
    // Las dos rutas por las que se llega a vitest: el manifest que hay junto al
    // ejecutable, y la resolucion normal desde el repo. Con pnpm pueden apuntar a
    // carpetas distintas del store sin que nada avise.
    const porManifest = fs.realpathSync(
      path.join(ROOT, 'node_modules', 'vitest', 'package.json'),
    );
    const porResolucion = fs.realpathSync(
      createRequire(path.join(ROOT, 'package.json')).resolve('vitest/package.json'),
    );
    expect(porManifest, `${porManifest} != ${porResolucion}`).toBe(porResolucion);
  });
});