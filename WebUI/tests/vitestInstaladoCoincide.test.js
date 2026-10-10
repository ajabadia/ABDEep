/**
 * vitestInstaladoCoincide.test.js — el vitest INSTALADO es el que dice package.json.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE ESTE GUARD EXISTE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Un salto de version a medias es invisible hasta que rompe. El caso de este repo
 * es el que motivating: `package.json` decia `vitest: ^4.1.11` mientras lo
 * instalado seguia siendo 1.6.1, porque los pines viven en el lockfile de la raiz
 * del monorepo (`D:/desarrollos/ABDSynths/`), FUERA de este proyecto. El salto se
 * escribia en un fichero y se aplicaba en otro, y no habia nada que lo dijera:
 *
 *   - Los tests PASABAN. Con 1.6.1Instalado y `^4.1.11` declarado, todo verde.
 *   - El codigo ya estaba portado a la API de la 4, y con la 1 no se ejercitaba.
 *   - Nadie se enteraba hasta que se corria `pnpm install` en la raiz.
 *
 * O sea: el rojo llega tarde y de forma indirecta. Este guard lo pone rojo AL
 *principio, en el sitio donde se declara la intencion.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUE COMPRUEBA, Y QUE NO
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Compara DOS fuentes independientes, a proposito:
 *
 *   1. El RANGO declarado en `package.json` (`devDependencies.vitest`).
 *   2. La VERSION REAL que resuelve el repo, via `createRequire`, que es
 *      exactamente la que usa el resto de la suite al importar `vitest`.
 *
 * Que coincidan dice: "el codigo de los tests se esta ejecutando contra la version
 * que el repo dice querer". Si divergen, el repo esta a medias.
 *
 * NO comprueba que lo instalado sea la ULTIMA, ni que el lockfile cuadre, ni que
 * haya una sola copia en el store. Lo ultimo a proposito: con pnpm el store
 * conserva versiones viejas que ya no usa nadie —MEDIDO, este mismo repo tiene
 * `vitest@1.6.1` y `vitest@1.6.1` (otro hash de peers) junto al `vitest@4.1.11`— y
 * un guard que las contara se pondria rojo sin que nada este mal. Lo que importa
 * es a que version apunta el repo, no quantas hay en la caja.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL RANGO, SIN DEPENDENCIAS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * No hay `semver` en el arbol, y anadirlo para comprobar tres numeros no compensa.
 * Se implementa lo justo: `^`, `~`, exacto, y `*`/`latest`. Un rango con operadores
 * que no se saben leer (`>=`, `||`, espacios, ...) **no se acepta en silencio**: el
 * helper lanza. Un guard que no entiende el rango y aun asi pasa es un guard que
 * no vigila, que es la forma mas comoda de no tener un guard.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const PKG_PATH = path.join(ROOT, 'package.json');

/** Los paquetes cuyo binario tiene que ser el que dice el rango. */
const VIGILADOS = ['vitest', '@vitest/coverage-v8'];

/**
 * Partir una version en sus numeros, sin prerelease ni build metadata.
 *
 * @param {string} version `4.1.11`
 * @returns {number[]} `[4, 1, 11]`
 */
export function aNumeros(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (m === null) throw new Error(`no es una version de tres numeros: "${version}"`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/**
 * Compara dos versiones de tres numeros.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} `-1`, `0` o `1`
 */
export function comparar(a, b) {
  const na = aNumeros(a);
  const nb = aNumeros(b);
  for (let i = 0; i < 3; i++) {
    if (na[i] !== nb[i]) return na[i] < nb[i] ? -1 : 1;
  }
  return 0;
}

/**
 * ¿La version instalada CAE dentro del rango declarado?
 *
 * Se soporta lo que este repo usa de verdad y, ante cualquier otra cosa, se LANZA.
 *
 * @param {string} rango `^4.1.11`, `~5.4.21`, `4.1.11`, `*`
 * @param {string} version `4.1.11`
 * @returns {boolean}
 */
export function cumpleRango(rango, version) {
  if (rango === '*' || rango === 'latest' || rango === '') return true;

  // La FORMA del rango se comprueba ANTES de interpretarlo, y no despues. Si se
  // interpretara primero, un `^4 || ^5` reventaria dentro de `aNumeros` con un
  // error de VERSION, y quien lea el rojo pensaria que la version instalada esta
  // mal en vez de que el rango tiene una forma que este guard no lee. La
  // distincion es la que hace falta para arreglarlo: uno se arregla instalando,
  // el otro editando el helper.
  if (!/^[\^~]?\d+\.\d+\.\d+$/.test(rango)) {
    throw new Error(
      `rango "${rango}" no soportado por este guard (usa ^, ~, exacto o *). `
      + 'Si hace falta soportarlo, aniadelo aqui CON su test.',
    );
  }

  const v = aNumeros(version);

  // Exacto: `4.1.11`.
  if (/^\d+\.\d+\.\d+$/.test(rango)) {
    return comparar(version, rango) === 0;
  }

  // Caret: `^4.1.11` -> >=4.1.11 <5.0.0. Con `^0.x` el techo es 0.(x+1).0, que es lo
  // que dice el spec y lo que hace `semver`.
  if (rango.startsWith('^')) {
    const base = aNumeros(rango.slice(1));
    if (comparar(version, rango.slice(1)) < 0) return false;
    // El techo se compara como VERSION ENTERA, no componente a componente. La
    // diferencia muerde: con techo [5, 0, 0] y version [4, 1, 11], un
    // `every` por componentes da `1 < 0` = falso y rechaza la propia 4.1.11.
    //
    // Y el techo depende de cuantos ceros lleva delante, que es el caso que
    // ROMPIO la primera implementacion (medido: `^0.0.3` aceptaba `0.0.4`, y
    // semver dice que no). El spec fija el patch cuando es `0.0.x`, porque en
    // `0.0.x` cualquier cambio ya rompe la API:
    //
    //   ^1.2.3 -> <2.0.0    ^0.2.3 -> <0.3.0    ^0.0.3 -> <0.0.4
    const techo = base[0] !== 0
      ? `${base[0] + 1}.0.0`
      : (base[1] !== 0 ? `0.${base[1] + 1}.0` : `0.0.${base[2] + 1}`);
    return comparar(version, techo) < 0;
  }

  // Tilde: `~5.4.21` -> >=5.4.21 <5.5.0.
  if (rango.startsWith('~')) {
    const base = aNumeros(rango.slice(1));
    if (comparar(version, rango.slice(1)) < 0) return false;
    return aNumeros(version)[0] === base[0] && aNumeros(version)[1] === base[1];
  }

  // Lo que no se sabe leer, no se pasa por alto.
  throw new Error(
    `rango "${rango}" no soportado por este guard (usa ^, ~, exacto o *). `
    + 'Si hace falta soportarlo, aniadelo aqui CON su test.',
  );
}

/**
 * La version que el repo RESUELVE de verdad, no la que hay escrita en un sitio.
 *
 * `createRequire` es la misma resolucion que usa el resto de la suite al importar
 * `vitest`: si esto dice 4.1.11, los tests se estan corriendo con 4.1.11.
 *
 * @param {string} nombreDelPaquete
 * @returns {{version: string, ruta: string}}
 */
export function instaladoEnDisco(nombreDelPaquete) {
  const req = createRequire(path.join(ROOT, 'package.json'));
  const manifest = path.join(ROOT, 'node_modules', ...nombreDelPaquete.split('/'), 'package.json');
  if (!fs.existsSync(manifest)) {
    throw new Error(
      `${nombreDelPaquete} no esta instalado en node_modules. `
      + 'El lockfile vive en la raiz del monorepo: sin `pnpm install` ahi, el repo '
      + 'tiene lo declarado y no lo instalado.',
    );
  }
  const version = JSON.parse(fs.readFileSync(manifest, 'utf8')).version;
  // Que el modulo RESUELVA tambien: si el manifest esta pero el paquete no carga,
  // hay un arbol a medios igualmente.
  const ruta = req.resolve(nombreDelPaquete);

  // El manifest RESUELTO por el import, no el del repo. Se devuelven los dos
  // porque no son la misma ruta: `resolve` devuelve el entry point
  // (`.../index.cjs`) y el manifest esta en su directorio. Compararlos entre si
  // daria falso siempre, asi que quien los use tiene que saber cual necesita.
  const req2 = createRequire(ruta);
  const rutaDelManifest = req2.resolve(`${nombreDelPaquete}/package.json`);

  return { version, ruta, rutaDelManifest };
}

describe('el vitest instalado es el que package.json declara', () => {
  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));

  it('package.json declara un rango de vitest que este guard sabe leer', () => {
    // Si esto falla, el resto del guard estaria comparando contra la nada.
    const rango = pkg.devDependencies?.vitest;
    expect(rango, 'package.json no declara devDependencies.vitest').toBeTruthy();
    expect(() => aNumeros(rango.replace(/^[\^~]/, ''))).not.toThrow();
  });

  for (const nombre of VIGILADOS) {
    it(`lo instalado de ${nombre} cae dentro del rango declarado`, () => {
      const rango = pkg.devDependencies?.[nombre];
      expect(rango, `package.json no declara ${nombre}`).toBeTruthy();

      const { version } = instaladoEnDisco(nombre);

      // El mensaje lleva LAS DOS cifras: sin las dos, quien lo lea tiene que ir a
      // buscar cual de las dos se ha movido.
      expect(
        cumpleRango(rango, version),
        `${nombre}: package.json declara "${rango}" pero lo instalado es "${version}". `
        + 'Si el salto es a proposito, cambia el rango y corre `pnpm install` en la '
        + 'raiz del monorepo; si ya se corrio, el arbol esta a medias.',
      ).toBe(true);
    });
  }

  it('la version que resuelve el repo es la del node_modules del repo', () => {
    // La resolucion tiene que salir del `node_modules` DEL REPO. Si un dia el
    // helper apuntara a otro sitio (un store, una sonda), este se pondria rojo:
    // que es justo cuando dejaria de medir lo que dice medir.
    const { ruta } = instaladoEnDisco('vitest');
    const desdeRepo = path.resolve(ROOT, 'node_modules', 'vitest');
    const relativo = path.relative(desdeRepo, ruta);
    // Con pnpm la ruta resuelta sale por un symlink, asi que se compara el
    // prefijo en vez de pedir igualdad exacta.
    const saleDelRepo = relativo.startsWith('..') === false
      || ruta.includes(`${path.sep}node_modules${path.sep}vitest${path.sep}`);
    expect(saleDelRepo, `vitest se resuelve fuera del node_modules del repo: ${ruta}`).toBe(true);
  });

  it('un paquete declarado y NO instalado se dice que falta, no que esta mal', () => {
    // La TERCERA forma de quedar a medias, y la que mas confunde: si el paquete no
    // esta, no hay manifest contra el que comparar, y el fallo sale como un error
    // de import en cualquier otro sitio. Aqui se dice lo que es, y se dice DONDE
    // se arregla, que es la raiz del monorepo y no este repo.
    expect(() => instaladoEnDisco('@abdsynths/este-paqueto-no-existe-nada')).toThrow(
      /no esta instalado/,
    );
    expect(() => instaladoEnDisco('@abdsynths/este-paqueto-no-existe-nada')).toThrow(
      /raiz del monorepo/,
    );
  });

  it('el manifest que se importa es el del node_modules del repo', () => {
    // El store de pnpm puede conservar muchas versiones —MEDIDO: este repo tiene
    // dos `vitest@1.6.1` y un `vitest@4.1.11` en `.pnpm`—. Eso es NORMAL y no es un
    // fallo. Lo que no valeria es que el `node_modules/vitest` del repo fuera un
    // symlink a OTRA copia de la que se importa.
    //
    // Se comparan los dos MANIFEST, y no el entry point: `resolve('vitest')`
    // devuelve `index.cjs`, no `package.json`, asi que comparar el entry point
    // contra un manifest daria falso SIEMPRE. El manifest es lo que dice que
    // version es, que es justo lo que este guard vigila.
    const manifestDelRepo = path.join(ROOT, 'node_modules', 'vitest', 'package.json');
    const { rutaDelManifest } = instaladoEnDisco('vitest');
    expect(
      fs.realpathSync(manifestDelRepo) === fs.realpathSync(rutaDelManifest),
      `el import de vitest (${rutaDelManifest}) y node_modules/vitest (`
        + `${manifestDelRepo}) no son el mismo paquete`,
    ).toBe(true);
  });
});

describe('el comprobador de rangos, con dientes', () => {
  // Un guard de comparacion de versiones que no se prueba a si mismo es un guard
  // que puede estar comparando mal y poniendo verde igual. Estas son las filas que
  // lo muerden si el helper se rompe.

  it('^ acepta el minimo y rechaza el siguiente major', () => {
    expect(cumpleRango('^4.1.11', '4.1.11')).toBe(true);
    expect(cumpleRango('^4.1.11', '4.9.0')).toBe(true);
    expect(cumpleRango('^4.1.11', '4.1.10')).toBe(false);
    expect(cumpleRango('^4.1.11', '5.0.0')).toBe(false);
  });

  it('^ con 0.x tiene el techo del minor, como dice el spec', () => {
    expect(cumpleRango('^0.5.2', '0.5.9')).toBe(true);
    expect(cumpleRango('^0.5.2', '0.6.0')).toBe(false);
  });

  it('^ con 0.0.x fija el techo en el patch: ahi cualquier cambio rompe', () => {
    // Fila que se anadio MEDIDO, contrastando contra semver 7.8.5 en 390
    // combinaciones (build/contrastar-semver.mjs). La primera implementacion
    // ponia el techo en el minor y admitia 0.0.4; el spec no lo hace, porque en
    // 0.0.x la API se puede romper en cualquier patch.
    expect(cumpleRango('^0.0.3', '0.0.3')).toBe(true);
    expect(cumpleRango('^0.0.3', '0.0.4')).toBe(false);
    expect(cumpleRango('^0.0.3', '0.1.0')).toBe(false);
  });

  it('~ sube el minor y no el major', () => {
    expect(cumpleRango('~5.4.21', '5.4.99')).toBe(true);
    expect(cumpleRango('~5.4.21', '5.5.0')).toBe(false);
    expect(cumpleRango('~5.4.21', '5.4.20')).toBe(false);
  });

  it('el exacto solo admite ese numero', () => {
    expect(cumpleRango('4.1.11', '4.1.11')).toBe(true);
    expect(cumpleRango('4.1.11', '4.1.12')).toBe(false);
  });

  it('un rango que no sabe leer LANZA en vez de pasar', () => {
    // Este es el test que hace que el guard sirva: sin el, un rango raro se
    // aceptaria en silencio y el guard dejaria de vigilar justo cuando el
    // package.json cambia de forma.
    expect(() => cumpleRango('>=4.1.11', '4.1.11')).toThrow(/no soportado/);
    expect(() => cumpleRango('^4 || ^5', '4.1.11')).toThrow(/no soportado/);
    expect(() => cumpleRango('4.x', '4.1.11')).toThrow(/no soportado/);
  });

  it('* acepta cualquier version', () => {
    expect(cumpleRango('*', '4.1.11')).toBe(true);
    expect(cumpleRango('*', '1.6.1')).toBe(true);
  });
});