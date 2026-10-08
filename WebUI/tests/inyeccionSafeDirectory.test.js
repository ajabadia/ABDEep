/**
 * inyeccionSafeDirectory.test.js — La suite funciona sin tocar la config de git
 * ============================================================================
 *
 * En Windows, git se niega a trabajar en un repositorio cuyo propietario no es
 * el usuario que lo invoca, y dice:
 *
 *   fatal: detected dubious ownership in repository at 'D:/.../ABDEep'
 *
 * Lo normal es arreglarlo con `git config --global --add safe.directory <ruta>`.
 * Eso es estado de la maquina, no del proyecto: el siguiente que clone el repo
 * tiene el mismo problema, y nadie ve el arreglo al leer el codigo.
 *
 * Aqui no se hace. La excepcion se inyecta en el entorno de la corrida
 * (`GIT_CONFIG_COUNT` / `GIT_CONFIG_KEY_0` / `GIT_CONFIG_VALUE_0`, montado en
 * `vitest.config.js`), y git la aplica a cualquier subproceso que nazca de un
 * test. Al terminar la corrida no queda rastro.
 *
 * Que «funcione» no se comprueba mirando que los tests pasan: si la maquina que
 * corre la suite tiene el repo en su `~/.gitconfig`, la suite pasa igual con la
 * inyeccion quitada, y el guard no distinguiria un caso del otro. Por eso lo que
 * se prueba aqui es de donde sale el valor: tiene que venir de la linea de
 * ordenes, nunca de un fichero. Asi el test sigue mordiendo en una maquina
 * limpia, que es donde un guard tiene que valer.
 *
 * Estos tests leen `process.env` y no importan `vitest.config.js`. Es lo que
 * git recibe de verdad, no lo que la configuracion quiso poner: entre una cosa y
 * otra hay un worker, y lo que importa es lo que llega al otro lado.
 *
 * Run: npx vitest run WebUI/tests/inyeccionSafeDirectory.test.js
 */

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { GIT, RAIZ } from './helpers/gitSeguro.js';

/**
 * Las entradas `GIT_CONFIG_*` tal como estan en el entorno de la corrida.
 *
 * No se supone que la de `safe.directory` sea la numero 0: `vitest.config.js`
 * appenda en vez de pisar, para no romper a quien ya traia algo inyectado. Este
 * helper encuentra el hueco real en vez de asumirlo, que es justo el error que
 * harian los tests que lo dieran por hecho — y darian por hecho el caso bueno.
 *
 * @returns {{indice: number, valor: string}} donde esta la excepcion.
 */
function entradaInyectada() {
  const total = Number.parseInt(process.env.GIT_CONFIG_COUNT ?? '', 10);
  for (let i = 0; i < total; i += 1) {
    if (process.env[`GIT_CONFIG_KEY_${i}`] === 'safe.directory') {
      return { indice: i, valor: process.env[`GIT_CONFIG_VALUE_${i}`] ?? '' };
    }
  }
  throw new Error(
    `la corrida no lleva safe.directory inyectado: GIT_CONFIG_COUNT=${process.env.GIT_CONFIG_COUNT}`,
  );
}

/** Todas las entradas `GIT_CONFIG_*` que declara el entorno. */
function entradasDelEntorno() {
  const total = Number.parseInt(process.env.GIT_CONFIG_COUNT ?? '', 10);
  return Array.from({ length: total }, (_, i) => ({
    indice: i,
    clave: process.env[`GIT_CONFIG_KEY_${i}`],
    valor: process.env[`GIT_CONFIG_VALUE_${i}`],
  }));
}

/**
 * Corre git sin ninguna excepcion anadida por nosotros: sin `-c`, y con el
 * entorno tal cual. Todo lo que git sepa de este repo, lo ha sabido por la
 * inyeccion o por la maquina — y estos tests miran cual de las dos.
 *
 * @param {string[]} args el subcomando y sus argumentos.
 * @returns {string} la salida de git.
 */
function gitSinManetas(args) {
  return execFileSync('git', args, {
    cwd: RAIZ,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** Descompone la salida de `git config --show-origin`, que es `origen<TAB>valor`. */
function origenesDe(consulta) {
  return gitSinManetas(['config', '--show-origin', '--get-all', consulta])
    .split('\n')
    .filter((linea) => linea.length > 0)
    .map((linea) => {
      const [origen, ...resto] = linea.split('\t');
      return { origen, valor: resto.join('\t') };
    });
}

describe('inyeccion de safe.directory', () => {

// MEDIDO con vitest 4.1.11: este bloque lanza un subproceso, y por eso tiene
// timeout aqui, en el `describe`, y no en cada `it`.
//
// MEDIDO: aislado, el test mas lento de este fichero tarda 46 ms. Con el pool
// `forks` de vitest 4 y el resto de la suite compitiendo, eso sube a ~11x: un
// bloque sin timeout se queda en los 5 s por defecto y cae. Por eso 30 s, que
// son unas siete veces el peor caso medido.
//
// Lo vigila `WebUI/tests/timeoutDeSubprocesos.test.js`, que ademas comprueba
// que el problema siga existiendo: si el patron del spawn cambia, el guard avisa
// en vez de quedarse mirando.
  it('la excepcion esta en el entorno de la corrida', () => {
    const { indice, valor } = entradaInyectada();
    expect(indice).toBeGreaterThanOrEqual(0);
    expect(valor).toBeTruthy();
  });

  it('la cuenta y la lista de entradas cuentan lo mismo', () => {
    // Si `GIT_CONFIG_COUNT` dice 2 pero falta la clave 1, la cuenta y la lista
    // no cuentan lo mismo, y git se come el hueco de forma distinta en cada
    // version. Es el fallo que hace que la inyeccion «funcione en mi maquina»:
    // los indices se calculan al vuelo y nadie mira que sean contiguos.
    for (const entrada of entradasDelEntorno()) {
      expect(entrada.clave).toBeTruthy();
      expect(entrada.valor).toBeTruthy();
    }
  });

  it('un git a pelo, sin -c y sin tocar la config, ya funciona', () => {
    // El caso que de verdad importa: no el de los tests que usan `gitSeguro` —
    // que se apanan solos con su `-c`—, sino el de cualquiera que lance git sin
    // saber nada de esto. Si aqui falla, la inyeccion no ha llegado al entorno.
    const ficheros = gitSinManetas(['ls-files']);
    expect(ficheros.split('\n').filter(Boolean).length).toBeGreaterThan(100);
  });

  it('el valor que usa git viene de la linea de ordenes, no de un fichero', () => {
    // El guard de verdad. Distingue los dos mundos que el resto de este fichero
    // no puede: en una maquina con el repo en `~/.gitconfig`, quitar la
    // inyeccion deja los tests en verde; aqui el origen pasa de `command line:`
    // a `file:...` y el rojo aparece.
    const { valor } = entradaInyectada();
    const nuestros = origenesDe('safe.directory').filter((e) => e.valor === valor);
    expect(nuestros.length).toBeGreaterThan(0);
    for (const entrada of nuestros) {
      expect(entrada.origen).toBe('command line:');
    }
  });

  it('no queda rastro en la configuracion global de la maquina', () => {
    // La otra mitad del trato: la excepcion vive mientras dura la corrida. Si
    // alguien escribio la ruta a mano en `~/.gitconfig`, esto lo delata — y el
    // fallo lo dice con nombre, porque un guard que falla sin explicar por que
    // es el peor de todos.
    const { valor } = entradaInyectada();
    const desdeFichero = origenesDe('safe.directory').filter(
      (e) => e.valor === valor && e.origen !== 'command line:',
    );
    expect(desdeFichero).toEqual([]);
  });

  it('la inyeccion y gitSeguro ponen la MISMA ruta', () => {
    // Hay dos caminos que llegan a git —el entorno de la corrida y el `-c` de
    // `gitSeguro`— y se calculan por separado, en ficheros distintos, con una
    // normalizacion de barras escrita a mano en los dos. Cuando se separan, el
    // sintoma es un `dubious ownership` que solo aparece en la maquina donde se
    // separaron, y `gitSeguro` se lleva la culpa de algo que no ha hecho.
    const { valor } = entradaInyectada();
    const entrada = GIT.find((arg) => arg.startsWith('safe.directory='));
    expect(entrada).toBeTruthy();
    expect(entrada.slice('safe.directory='.length)).toBe(valor);
  });

  it('la ruta inyectada es la de este checkout, no una escrita a mano', () => {
    // `D:/desarrollos/ABDSynths/ABDEep` en la config vale en esta maquina y en
    // ninguna otra: en un checkout limpio la ruta no existe y el preflight se
    // pone rojo por un path que nadie ha pedido. Sale de `import.meta.url`, asi
    // que cambiar de carpeta no la rompe.
    const { valor } = entradaInyectada();
    expect(valor.replace(/\\/g, '/')).toBe(RAIZ.replace(/\\/g, '/'));
    expect(valor).not.toMatch(/[\\/]$/);
  });
}, 30000);
