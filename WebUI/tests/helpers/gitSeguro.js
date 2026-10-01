/**
 * Llama a `git` de una forma que funciona en una maquina concreta, y no solo
 * en la de quien escribio el test.
 *
 * COPIA GESTIONADA. El mismo fichero, con el mismo nombre y el mismo
 * comportamiento, existe en `ABDSharedAssets/tests/helpers/gitSeguro.js`. Aqui
 * cambia UNA sola cosa: `RAIZ` sube tres niveles en vez de dos, porque aqui los
 * tests viven en `WebUI/tests/`, no en `tests/`. Copiar de mas es un riesgo
 * —las dos copias se desincronizan y el guard deja de ser el mismo—, asi que
 * esto no es una traduccion: si algo cambia en una, cambia en las dos.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POR QUE ESTE FICHERO EXISTE
 *
 * En Windows, git se niega a trabajar en un repositorio cuyo propietario no es
 * el usuario que lo invoca, y dice:
 *
 *   fatal: detected dubious ownership in repository at 'D:/.../ABDEep'
 *
 * El aviso acierta en el proposito (esa proteccion existe por algo) y en la
 * practica estorba en el caso de este workspace, donde el repositorio lo creo
 * otro usuario de la misma maquina. La salida de git es la que estos tests
 * necesitan: `ls-files` para saber que ficheros existen de verdad, `show` para
 * leer el blob de un fichero y no lo que hay en disco, `check-attr` para
 * preguntar a git que eol ve en cada uno.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LA TRAMPA, Y POR QUE NO SE RESUELVE CON `-c safe.directory` A SECO
 *
 * Cuando `git ls-files` falla, `listaTrackeada()` devuelve una lista VACIA, y
 * el primer test se pone rojo diciendo que no ha mirado nada. Eso esta bien
 * pensado y es lo unico que impidio dar por bueno un guard que no comprobaba
 * una sola cosa. PERO el rojo de verdad —`git ls-files` fallo`— se quedaba en
 * un `console.error` que nadie leia, y el que veia el fallo era el equivocado:
 * «el guard no descubre ningun artefacto», cuando lo que habia pasado es que
 * git no habia cooperado. Ese es el fallo mas caro de todos, porque el test no
 * esta roto: lo que esta roto es el diagnostico que da.
 *
 * Asi que no basta con que git funcione: si vuelve a fallar, el fallo tiene que
 * SER de git y decir por que.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POR QUE `safe.directory` SE CALCULA Y NO SE ESCRIBE
 *
 * Escribir la ruta absoluta a mano (`safe.directory=D:/desarrollos/ABDSynths/ABDEep`)
 * funciona en esta maquina y en ninguna otra: en un checkout limpio, o en una
 * copia del repo en otro sitio, el preflight se pondria rojo por un path que no
 * existe. Un guard que depende de una maquina no es un guard, es una costumbre.
 *
 * Por eso la ruta sale de `import.meta.url`: el fichero sabe donde esta, y por
 * tanto sabe que repositorio es. Asi funciona en un checkout, en una copia, en
 * un CI, y en una carpeta movida de sitio.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LO QUE NO HACE
 *
 * No toca la configuracion global de git, ni escribe en `~/.gitconfig`, ni
 * llama a `git config --global`. Eso seria cambiar el equipo entero de
 * maquina para arreglar un problema de un test, y ademas el efecto no se ve
 * cuando se lee el codigo. Aqui la excepcion va en el comando, que es donde se
 * puede ver, y solo dura lo que dura ese comando.
 */

import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));

/**
 * La raiz del repo, deducida de donde esta ESTE fichero, no escrita a mano.
 *
 * Este fichero vive en `WebUI/tests/helpers/`, y el repo esta TRES niveles por
 * encima. Si el test se moviera de sitio, el numero de `..` es lo unico que
 * hay que cambiar, y por eso estan juntos y en este orden.
 */
export const RAIZ = resolve(aqui, '..', '..', '..');

/**
 * Git acepta la ruta de varias formas, pero en Windows lo que entiende sin
 * sorpresas es la CON VIGULILLAS HACIA ADELANTE y sin barra final. Con
 * `\` en vez de `/` el valor no casa y git vuelve a quejarse de dubious
 * ownership, que es el fallo mas dificil de ver de todos porque parece que la
 * opcion no se esta aplicando.
 */
const rutaParaGit = (ruta) => ruta.replace(/\\/g, '/').replace(/\/+$/, '');

/**
 * Los argumentos que abren TODA llamada a git: la excepcion de
 * `safe.directory`, primero, antes que el subcomando.
 *
 * Se declara una vez y se concatena en cada llamada. Es lo contrario de
 * repetirlo cinco veces en cinco sitios, que es como una excepcion se
 * desincroniza: se arreglo una llamada y se olvidaron las otras cuatro.
 */
export const GIT = ['-c', `safe.directory=${rutaParaGit(RAIZ)}`];

/**
 * Corre un subcomando de git en este repositorio, con la excepcion puesta.
 *
 * @param {string[]} args el subcomando y sus argumentos, SIN el `git` delante.
 * @param {object} [opciones] opciones de `execFileSync`. `cwd` y `encoding`
 *   se rellenan si no vienen.
 * @returns {string} la salida de git, como texto.
 */
export function gitSeguro(args, opciones = {}) {
  return execFileSync('git', [...GIT, ...args], {
    cwd: opciones.cwd || RAIZ,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    ...opciones
  });
}

/**
 * Igual que `gitSeguro`, pero devuelve `null` en vez de lanzar.
 *
 * Para los sitios donde la pregunta tiene respuesta buena Y mala, y las dos
 * son un resultado valido —«¿tiene historial?» puede que si y puede que no—.
 * Devolver `null` obliga a decidir que hacer, mientras que capturar el error
 * dentro del `catch` deja la exception a medio camino.
 *
 * @param {string[]} args el subcomando y sus argumentos.
 * @param {object} [opciones] opciones de `execFileSync`.
 * @returns {string|null} la salida de git, o `null` si git fallo.
 */
export function gitSeguroONull(args, opciones = {}) {
  try {
    return gitSeguro(args, opciones);
  }
  catch (e) {
    return null;
  }
}