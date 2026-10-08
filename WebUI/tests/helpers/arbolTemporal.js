/**
 * arbolTemporal.js — una COPIA del árbol mínimo que lee `registry_generator.js`,
 * en el temporal, para poder ejecutarlo de verdad sin que pueda tocar el repo.
 *
 * POR QUÉ EXISTE ESTE HELPER Y NO UNAS CUATRO LÍNEAS EN CADA TEST
 *
 * El generador deriva `ROOT` de su propia ubicación:
 *
 *   const ROOT = path.resolve(import.meta.dirname, '..');
 *
 * No hay variable de entorno, ni flag, ni argumento para redirigirlo. La única
 * manera de ejecutar el camino de escritura sin escribir en el repo es poner el
 * propio generador en otro sitio: que su `ROOT` SEA el temporal.
 *
 * La forma que se había probado antes —copiar el fuente del generador a un
 * temporal y reescribir por texto las cuatro rutas de salida con
 * `String.replace`— no vale, y por dos motivos que se midieron:
 *
 *   1. `replace` con un patrón de cadena es un no-op silencioso si el texto no
 *      coincide. No avisa, no lanza, y el test sigue en verde ejecutando el
 *      generador real contra el repo. Para que sirva tiene que acertar con la
 *      forma LITERAL de cuatro líneas del generador, y basta con que alguien
 *      escriba `"WebUI/js/bridge-param-maps.js"` en vez de
 *      `path.join(ROOT, 'WebUI', 'js', 'bridge-param-maps.js')` para que la
 *      redirección desaparezca sin que nadie se entere.
 *
 *   2. El patrón de `ROOT` que se buscaba (`__dirname`) llevaba tiempo sin
 *      existir: el generador usa `import.meta.dirname`. Ese `replace` ya no
 *      aplicaba, así que `ROOT` apuntaba al temporal por casualidad y no por
 * *      diseño — el repo se salvaba de rebote, no porque el test lo garantizara.
 *
 * Y hay una tercera razón, ya impuesta por el propio generador: `verificarRutas`
 * compara `path.relative(ROOT, OUT[...])` contra el manifiesto `ARTEFACTOS` y
 * sale con `MANIFIESTO_DESINCRONIZADO` en cuanto no coinciden. Las cuatro
 * rutas de salida SI se pueden mover, siempre que caigan DENTRO de `ROOT`. Con
 * una copia del árbol, caen dentro por construcción y sin tocar el generador.
 *
 * CON LA COPIA, EL TEST ES SEGURO POR CONSTRUCCIÓN Y NO POR DISCIPLINA
 *
 * Aquí no hay ninguna cadena que pueda dejar de coincidir. Todo lo que el
 * generador puede leer o escribir cae dentro del temporal, así que no puede
 * llegar al repo ni por accidente —tampoco si la validación del byteMap se
 * desactivara, ni si alguien añadiera una quinta salida al manifiesto. Y como
 * el árbol es una copia, se puede mutilar a gusto: es lo que hace falta para
 * provocar el caso negativo.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** Raíz del repo: este fichero vive en `<raiz>/WebUI/tests/helpers/`. */
export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/**
 * Lo que lee el generador: las cinco claves de `const SRC` más el propio script.
 * `Source/Core` va aparte porque de ahí saca los ids de la APVTS con el glob
 * /^ParametersSpec(_[A-Za-z]+)?\.cpp$/; se copia entero para no replicar aquí un
 * patrón que vive en el generador.
 *
 * Si el generador algún día lee algo más, esto falla con un «no such file» del
 * propio generador. Es el fallo que conviene: dice que la lista de aquí está
 * vieja, en vez de dejar que el test siga en verde sin comprobar la mitad.
 */
export const ENTRADAS = [
  'scripts/registry_generator.js',
  'WebUI/js/bridge-param-maps.js',
  'WebUI/js/byte_map_data.js',
  'resources/parameters_spec.json',
  'schemas/parameter-registry.json',
  // La quinta fuente: el spec de la capa de traduccion. Sin esto, el generador
  // de la copia temporal falla con ENOENT al leerla (que es justo el fallo que
  // este helper documenta: la lista de aqui tiene que seguir al generador).
  'schemas/parameter-conversion.json',
];

export const DIRECTORIOS = ['Source/Core'];

/**
 * Los cuatro artefactos canónicos que declara el generador en su manifiesto:
 * cuatro del registro (schemaVersion 1).
 */
export const ARTEFACTOS = [
  'Source/Core/ParameterRegistry.gen.h',
  'Source/Core/ParameterRegistry.gen.cpp',
  'schemas/parameter-registry.data.json',
  'WebUI/js/registry.gen.js',
];

/** Cómo ejecuta el CI el generador: `node scripts/registry_generator.js`. */
export const GENERADOR = 'scripts/registry_generator.js';

function copiaEn(origen, destino) {
  fs.mkdirSync(path.dirname(destino), { recursive: true});
  fs.cpSync(origen, destino, {recursive: true});
}

/**
 * Monta un árbol mínimo en el temporal: fuentes dentro, salidas dentro.
 *
 * Las cuatro rutas de salida NO se crean. `verificarRutas` las crea ella misma
 * en modo escritura (`fs.mkdirSync(dir, {recursive: true})`), y es el
 * generador quien debe hacerlo: si el test las crea de antemano, deja de
 * probarse ese camino y una regresión ahí pasa desapercibida.
 */
export function nuevoArbol() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'abdeep-registry-'));
  for (const rel of ENTRADAS) {copiaEn(path.join(RAIZ, rel), path.join(tmp, rel));}
  for (const rel of DIRECTORIOS) {copiaEn(path.join(RAIZ, rel), path.join(tmp, rel));}
  return tmp;
}

/** Ejecuta el generador de una copia y devuelve código de salida y salida junta. */
export function ejecutaGenerador(arbol) {
  const r = spawnSync(process.execPath, [path.join(arbol, GENERADOR)], {
    cwd: arbol,
    encoding: 'utf8',
  });
  return {
    codigo: r.status,
    salida: `${r.stdout || ''}${r.stderr || ''}`,
  };
}

/** Borra la copia. Acepta `null` para no reventar en un `finally`. */
export function borraArbol(arbol) {
  if (arbol !== null && arbol !== undefined) {
    fs.rmSync(arbol, {recursive: true, force: true});
  }
}

/** Digest del contenido, para que un fallo de comparación no escupe 25 kB. */
export function digest(texto) {
  return crypto.createHash('sha256').update(texto, 'utf8').digest('hex');
}

/**
 * Huella de los cuatro artefactos del REPO.
 *
 * Sin esto, un test que escribe en el repo pasaría igual de verde que uno que no
 * escribe: la huella es lo que permite afirmar, al final, que el repo está
 * intacto. Tomarla ANTES de ejecutar el generador es lo que la vuelve una
 * prueba y no un adorno.
 */
export function huellaDeArtefactos() {
  return new Map(ARTEFACTOS.map((rel) => [rel, digest(fs.readFileSync(path.join(RAIZ, rel), 'utf8'))]));
}