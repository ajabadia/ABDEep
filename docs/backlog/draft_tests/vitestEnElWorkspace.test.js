/**
 * vitestEnElWorkspace.test.js — todos los paquetes del workspace declaran la MISMA
 * version de vitest, y ABDEep incluido.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE ESTE GUARD EXISTE, Y POR QUE NO BASTA EL DE AL LADO
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `vitestInstaladoCoincide.test.js` vigila OTRA cosa: que lo instalado en disco
 * caiga dentro de lo que declara ESTE repo. Es decir, mira una sola columna. Este
 * mira la RELACION entre repos, y sin el otro guard esta serie de tests se
 * pondria verde de aqui al otro lado del workspace con cuatro versiones distintas
 * declaradas a la vez.
 *
 * El salto de vitest 1.6.1 a 4.1.11 (2026-10-03) es justo el caso. Se cambio el
 * `package.json` de cinco repos uno por uno, y durante esa ventana los cuatro
 * primeros ya decian `^4.1.11` mientras el quinto seguia en `^1.6.1`. Nada se
 * puso rojo: cada repo era coherente consigo mismo, que es lo unico que miraba el
 * otro guard. Un desajuste de este tipo no se ve desde dentro de un repo, porque
 * un repo no se compara con nadie.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE COMPARA LA VERSION BASE Y NO LA CADENA
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * MEDIDO, hoy mismo, en este workspace:
 *
 *   package.json (raiz)          devDependencies.vitest = "4.1.11"   <- exacto
 *   ABDEep                       devDependencies.vitest = "^4.1.11"
 *   ABDSharedAssets              "^4.1.11"
 *   ABDSharedCode/MidiKeyboard   "^4.1.11"
 *   ABDMS2000                    "^4.1.11"
 *   ABDCZ101                     "^4.1.11"
 *
 * La raiz lo fija EXACTO a proposito —es el lockfile que gobierna a todos los
 * miembros—, y los miembros ponen el caret que necesitan. Un guard que comparara
 * las cadenas a pelo estaria en rojo desde el primer dia por una diferencia de
 * formalismo que no significa nada. Asi que lo que se compara es la version
 * BASE, el numero detras del operador.
 *
 * Y lo que NO se hace es exigir el mismo OPERADOR: que la raizoue lo mismo que
 * los miembros es correcto y no es el objeto de este guard. Fijar el rango lo
 * decide quien hace el salto; lo que este guard dice es que no se queden dos
 * numeros distintos repartidos por cinco repos.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DE DONDE SALE LA LISTA DE MIEMBROS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * De `pnpm-workspace.yaml`, leido de la raiz del workspace. NO esta escrita aqui
 * como constante, y es deliberado: una lista copiada a mano se queda vieja el dia
 * que se meta un sexto miembro, y un guard que vigila cuatro de cinco no dice
 * nada. Leyendola, un miembro nuevo entra en vigilancia sin tocar este fichero.
 *
 * Lo que NO incluye la lista son `ABDBankManager` (vitest ^2.0.0) y `ABDScope`
 * (^2.1.8), que tambien declaran vitest y estan en el mismo disco. Ninguno de los
 * dos es miembro del workspace —ABDBankManager es ademas un workspace pnpm
 * interno, y pnpm no anida— asi que quedan fuera por la misma razon que quedan
 * fuera del resto del workspace. Si alguno entra en `packages:`, este guard lo
 * cogera sin que nadie tenga que acordarse.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUE PASA CUANDO UN HERMANO NO ESTA EN DISCO
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * El bootstrap de `webui-ci.yml` deja ABDSharedAssets y ABDSharedCode como
 * hermanos de ABDEep, pero no se puede dar por hecho que traiga los cinco. Un
 * checkout de un solo repo no tiene con quien compararse, y ahi el guard no puede
 * decir nada: no es que pase, es que no tiene sujeto.
 *
 * Asi que un miembro ausente se CUENTA como ausente y se nombra, y no como
 * discrepancia. Un guard que se pone rojo porque el CI no clona un repo teaches
 * a la gente a correrlo con `--exclude` y a no mirarlo nunca, que es peor que no
 * tenerlo. Pero tampoco se deja pasar en silencio: hay un test que exige que se
 * lea al menos ABDEep y la raiz, que siempre estan.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const SUITE = path.resolve(ROOT, '..');
const WORKSPACE_YAML = path.join(SUITE, 'pnpm-workspace.yaml');
const RAIZ_PKG = path.join(SUITE, 'package.json');

// ─────────────────────────────────────────────────────────────────────────────
// LOS HELPERS, EXPORTADOS Y PUESTOS A PROBAR SEPARADOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Los miembros del workspace, tal cual los declara `pnpm-workspace.yaml`.
 *
 * El bloque `packages:` es una lista de lineas `  - RUTA`. Se corta en la primera
 * linea sin sangrar que no sea de la lista, que es donde empieza `allowBuilds:`.
 * Una linea de la lista que no sea `- RUTA` LANZA en vez de ignorarse: un parser
 * que se come lo que no entiende deja de mirar justo cuando el fichero cambia de
 * forma, que es lo unico que un guard no puede permitirse.
 *
 * La regla es `- ` seguido de UN token sin espacios, y no "lo que haya hasta el
 * fin de linea", por una razon que la suite hizo ver con dientes: `- ABDNeural  #
 * todavia no` empieza por `- ` igual que un miembro de verdad, asi que una
 * comprobacion floja lo aceptaba y el guard vigilaba un miembro llamado
 * `ABDNeural  # todavia no`, que no existe —verde, y mirando al vacio. Un miembro
 * del workspace es una RUTA, y una ruta no lleva espacios dentro.
 *
 * @param {string} yaml contenido de `pnpm-workspace.yaml`
 * @returns {string[]} rutas relativas a la raiz del workspace
 */
export function leerMiembros(yaml) {
  const bloque = /^packages:[ \t]*\r?\n((?:[ \t]+-[^\n]*\r?\n?)+)/m.exec(yaml);
  if (!bloque) {
    throw new Error(
      'pnpm-workspace.yaml no tiene un bloque "packages:" con la lista de miembros. '
      + 'Si le han cambiado el formato, actualiza leerMiembros() CON su test.',
    );
  }
  return bloque[1]
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter(Boolean)
    .map((linea) => {
      const m = /^-\s+(\S+)$/.exec(linea);
      if (!m) {
        throw new Error(
          `linea de "packages:" que este guard no sabe leer: "${linea}". `
          + 'Se admiten miembros de la forma "- RUTA", con RUTA sin espacios, y nada mas.',
        );
      }
      return m[1];
    });
}

/**
 * La version BASE de un rango declarado: el numero detras de `^` o `~`.
 *
 * `4.1.11`, `^4.1.11` y `~4.1.11` dan las tres `4.1.11`. Todo lo demas LANZA,
 * y por el mismo motivo que en `vitestInstaladoCoincide.test.js`: un rango que no
 * se sabe leer, en silencio, es un guard que ha dejado de vigilar. `*` y `latest`
 * tambien lanzan —y no es capricho: `*` pasa en CUALQUIER comprobacion de rango,
 * asi que aqui seria un agujero. Un miembro en `*` es un miembro que no ha dicho
 * que version quiere, y este guard viene precisamente a que no se queden sin
 * decirlo.
 *
 * @param {string} rango
 * @returns {string} `4.1.11`
 */
export function versionBase(rango) {
  if (typeof rango !== 'string' || rango.trim() === '') {
    throw new Error(`rango vacio o de tipo ${typeof rango}: no dice que version se quiere`);
  }
  const m = /^[\^~]?(\d+\.\d+\.\d+)$/.exec(rango.trim());
  if (!m) {
    throw new Error(
      `rango "${rango}" no soportado por este guard (usa ^, ~ o exacto, de tres numeros). `
      + 'Si hace falta soportarlo, aniadelo aqui CON su test.',
    );
  }
  return m[1];
}

/**
 * Compara dos versiones de tres numeros.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} `-1`, `0` o `1`
 */
export function compararVersiones(a, b) {
  const na = a.split('.').map(Number);
  const nb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (na[i] !== nb[i]) {
      return na[i] < nb[i] ? -1 : 1;
    }
  }
  return 0;
}

/**
 * Cruza las declaraciones de todos los miembros contra la version de referencia.
 *
 * PURA A PROPOSITO: no toca el disco. Toda la lectura de ficheros vive en el
 * `describe` de abajo, y esta funcion se prueba con entradas inventadas —incluida
 * una desfasada— para que se pueda demostrar que muerde sin tener que romper un
 * `package.json` de verdad.
 *
 * Un miembro con `estado: 'ausente'` NO es una discrepancia: no esta en disco, no
 * hay nada que comparar. Uno presente que no declara vitest sale en `sinDeclarar`,
 * que tampoco es discrepancia pero es un agujero: un miembro del workspace que no
 * dice que version quiere no puede dar su palabra sobre la del resto.
 *
 * @param {{nombre: string, ruta: string, estado: 'declarada'|'ausente', rango?: string}[]} entradas
 * @param {string} referencia version base contra la que se compara
 */
export function cruzarDeclaraciones(entradas, referencia) {
  const declaradas = [];
  const ausentes = [];
  const sinDeclarar = [];
  const distintas = [];

  for (const e of entradas) {
    if (e.estado === 'ausente') {
      ausentes.push(e.nombre);
      continue;
    }
    if (typeof e.rango !== 'string' || e.rango.trim() === '') {
      sinDeclarar.push(e);
      continue;
    }
    const base = versionBase(e.rango);
    if (base !== referencia) {
      distintas.push({ ...e, base });
      continue;
    }
    declaradas.push(e.nombre);
  }

  return { declaradas, ausentes, sinDeclarar, distintas };
}

// ─────────────────────────────────────────────────────────────────────────────
// LA LECTURA REAL
// ─────────────────────────────────────────────────────────────────────────────

/** Sin `pnpm-workspace.yaml` al lado no hay workspace, y no hay nada que cruzar. */
const HAY_WORKSPACE = fs.existsSync(WORKSPACE_YAML) && fs.existsSync(RAIZ_PKG);

const miembros = HAY_WORKSPACE
  ? leerMiembros(fs.readFileSync(WORKSPACE_YAML, 'utf8'))
  : [];

/** La version que gobierna a todos: la que declara la raiz del workspace. */
const REFERENCIA = HAY_WORKSPACE
  ? versionBase(JSON.parse(fs.readFileSync(RAIZ_PKG, 'utf8')).devDependencies?.vitest)
  : null;

/** Una entrada por miembro del workspace, leida de su propio `package.json`. */
const entradas = miembros.map((nombre) => {
  const ruta = path.join(SUITE, ...nombre.split('/'), 'package.json');
  if (!fs.existsSync(ruta)) {
    return { nombre, ruta, estado: 'ausente' };
  }
  const pkg = JSON.parse(fs.readFileSync(ruta, 'utf8'));
  return { nombre, ruta, estado: 'declarada', rango: pkg.devDependencies?.vitest };
});

const cruce = HAY_WORKSPACE ? cruzarDeclaraciones(entradas, REFERENCIA) : null;

describe('la lista de miembros del workspace', () => {
  it('pnpm-workspace.yaml se lee y da una lista no vacia', () => {
    expect(HAY_WORKSPACE, 'no hay pnpm-workspace.yaml junto a ABDEep: sin workspace no hay nada que cruzar').toBe(true);
    expect(miembros.length, 'la lista de "packages:" ha salido vacia: el guard no vigilaria a nadie').toBeGreaterThan(0);
  });

  it('ABDEep esta en su propia lista de miembros', () => {
    // Si el repo se saliera del workspace, todo lo de abajo compararia el conjunto
    // de los otros contra una referencia externa y no contra si mismo. Es la fila
    // que mas rectifica si algún dia cambia el layout.
    expect(miembros).toContain('ABDEep');
  });

  it('la raiz del workspace declara una version de vitest que este guard sabe leer', () => {
    const pkg = JSON.parse(fs.readFileSync(RAIZ_PKG, 'utf8'));
    expect(pkg.devDependencies?.vitest, 'la raiz no declara devDependencies.vitest').toBeTruthy();
    expect(() => versionBase(pkg.devDependencies.vitest)).not.toThrow();
  });
});

describe('vitest es la misma version en todo el workspace', () => {
  // `describe.skipIf` y no un `return` dentro del bloque: asi queda el hueco
  // VISIBLE en el recuento en vez de desaparecer. Un bloque saltado sigue
  // aportan sus tests a la recoleccion, que es justo lo que permite que se vea
  // que aqui habria tests que no se han corrido.
  describe.skipIf(!HAY_WORKSPACE)('miembros legibles del workspace', () => {
    it('ABDEep declara la misma version base que la raiz del workspace', () => {
      const abdeep = entradas.find((e) => e.nombre === 'ABDEep');
      expect(abdeep.estado, 'el package.json de ABDEep no se encuentra').toBe('declarada');
      expect(versionBase(abdeep.rango)).toBe(REFERENCIA);
    });

    it('ningun miembro declara una version distinta', () => {
      // El mensaje NOMBRA a quien se ha quedado atrás y con que numero, porque un
      // "vitest mismatcha" sin mas no dice ni donde cambiarlo ni hacia donde.
      expect(
        cruce.distintas.map((d) => `${d.nombre} declara "${d.rango}" (base ${d.base}) y la raiz va en ${REFERENCIA}`),
        'miembros con otra version de vitest que la raiz del workspace',
      ).toEqual([]);
    });

    it('ningun miembro presente se salta declarar vitest', () => {
      // Un miembro del workspace sin `devDependencies.vitest` no es una
      // discrepancia de version, es un agujero: se contaria como "correcto" sin
      // haber dicho nada. Se nombra aparte para que se vea cual es.
      expect(
        cruce.sinDeclarar.map((e) => `${e.nombre} (${e.ruta}) no declara devDependencies.vitest`),
        'miembros del workspace que no declaran vitest: o lo anaden, o salen de "packages:"',
      ).toEqual([]);
    });

    it('se han leido al menos este repo y otro mas', () => {
      // La version por la que este bloque puede quedarse mirando el vacio sin que se
      // note: si el CI deja de clonar hermanos, `distintas` seguiria vacio y el
      // guard pasaria sin haber comparado nada. Se exige al menos DOS declaraciones
      // leidas, y ademas se imprime cuales son los ausentes para que la perdida se
      // vea en el log y no solo en un numero.
      expect(cruce.declaradas.length, `solo se ha podido leer ${cruce.declaradas.length} declaracion(es). Ausentes: ${cruce.ausentes.join(', ') || 'ninguno'}`).toBeGreaterThanOrEqual(2);
      // eslint-disable-next-line no-console -- en un test, imprimir es el punto.
      console.log(`[vitestEnElWorkspace] leidos: ${cruce.declaradas.join(', ')} | ausentes: ${cruce.ausentes.join(', ') || 'ninguno'}`);
    });
  });
});

describe('el rango declarado, con dientes', () => {
  it('^, ~ y el exacto dan la MISMA version base', () => {
    // Es la razon de ser del guard: la raiz dice "4.1.11" y los miembros "^4.1.11".
    // Si esto no fuera cierto, el guard estaria en rojo hoy por un formalismo.
    expect(versionBase('4.1.11')).toBe('4.1.11');
    expect(versionBase('^4.1.11')).toBe('4.1.11');
    expect(versionBase('~4.1.11')).toBe('4.1.11');
    expect(versionBase('^4.1.11')).toBe(versionBase('4.1.11'));
  });

  it('el operador NO tiene que ser el mismo entre repos', () => {
    // Lo que se compara es el numero, no el formalismo. Si este test falla,
    // significa que el guard ha empezado a exigir tambien el operador, que no es
    // lo que se le pidio.
    expect(versionBase('^4.1.11') === versionBase('4.1.11')).toBe(true);
    expect(versionBase('~4.1.11') === versionBase('^4.1.11')).toBe(true);
  });

  it('una version distinta da una version base distinta', () => {
    expect(versionBase('^4.1.12')).not.toBe('^4.1.11');
    expect(versionBase('^3.0.0')).not.toBe(versionBase('^4.0.0'));
  });

  it('un rango que no sabe leer LANZA en vez de pasar', () => {
    // El test que hace que el guard sirva. Sin el, un rango raro se aceptaria en
    // silencio y el guard dejaria de vigilar justo cuando el package.json cambia
    // de forma —que es cuando hace falta.
    expect(() => versionBase('>=4.1.11')).toThrow(/no soportado/);
    expect(() => versionBase('^4 || ^5')).toThrow(/no soportado/);
    expect(() => versionBase('4.x')).toThrow(/no soportado/);
    expect(() => versionBase('workspace:*')).toThrow(/no soportado/);
  });

  it('un rango que no dice version LANZA tambien', () => {
    // `*` y `latest` SIEMPRE pasan en cualquier comprobacion de rango, y aqui eso
    // seria un agujero: un miembro en `*` es un miembro que no ha dicho nada, y
    // este guard viene precisamente a que no se queden sin decir nada.
    expect(() => versionBase('*')).toThrow(/no soportado/);
    expect(() => versionBase('latest')).toThrow(/no soportado/);
    expect(() => versionBase('')).toThrow(/no dice que version/);
    expect(() => versionBase(undefined)).toThrow(/no dice que version/);
  });
});

describe('el cruce, con dientes', () => {
  const base = [
    { nombre: 'A', ruta: '/w/A/package.json', estado: 'declarada', rango: '^4.1.11' },
    { nombre: 'B', ruta: '/w/B/package.json', estado: 'declarada', rango: '^4.1.11' },
    { nombre: 'C', ruta: '/w/C/package.json', estado: 'declarada', rango: '4.1.11' },
  ];

  it('un workspace coherente no da ninguna discrepancia', () => {
    const r = cruzarDeclaraciones(base, '4.1.11');
    expect(r.distintas).toEqual([]);
    expect(r.sinDeclarar).toEqual([]);
    expect(r.declaradas).toEqual(['A', 'B', 'C']);
  });

  it('un miembro desfasado se NOMBRA, y solo ese', () => {
    // La fila que demuestra que el guard muerde. Un guard de consistencia que
    // devuelve `[]` siempre pasa igual: aqui se le da algo roto a proposito y se
    // le exige que lo note, SIN tocar el package.json de ningun repo de verdad.
    const r = cruzarDeclaraciones(
      [...base, { nombre: 'VIEJO', ruta: '/w/VIEJO/package.json', estado: 'declarada', rango: '^1.6.1' }],
      '4.1.11',
    );
    expect(r.distintas).toHaveLength(1);
    expect(r.distintas[0].nombre).toBe('VIEJO');
    expect(r.distintas[0].base).toBe('1.6.1');
    // Y el que esta bien sigue en la lista de los que pasan: el fallo senala a uno,
    // no borra a todos.
    expect(r.declaradas).toEqual(['A', 'B', 'C']);
  });

  it('el salto parcial de una vez REAL es el caso que acabaria en rojo', () => {
    // La forma exacta del fallo que motivo el guard: cuatro repos ya movidos y el
    // quinto sin tocar. Todos son coherentes consigo mismos, que es lo unico que
    // vigila el otro guard.
    const aMedias = [
      { nombre: 'ABDEep', ruta: '/w/ABDEep/package.json', estado: 'declarada', rango: '^4.1.11' },
      { nombre: 'ABDSharedAssets', ruta: '/w/ABDSharedAssets/package.json', estado: 'declarada', rango: '^4.1.11' },
      { nombre: 'ABDSharedCode/MidiKeyboard', ruta: '/w/ABDSharedCode/MidiKeyboard/package.json', estado: 'declarada', rango: '^4.1.11' },
      { nombre: 'ABDMS2000', ruta: '/w/ABDMS2000/package.json', estado: 'declarada', rango: '^4.1.11' },
      { nombre: 'ABDCZ101', ruta: '/w/ABDCZ101/package.json', estado: 'declarada', rango: '^1.6.1' },
    ];
    const r = cruzarDeclaraciones(aMedias, '4.1.11');
    expect(r.distintas.map((d) => d.nombre)).toEqual(['ABDCZ101']);
  });

  it('un miembro AUSENTE no es una discrepancia, se cuenta aparte', () => {
    // Sin esta distincion, el guard se pondria rojo en cualquier checkout de un
    // solo repo, y quien lo suffered acabaria dejandolo de correr.
    const r = cruzarDeclaraciones(
      [...base, { nombre: 'AUSENTE', ruta: '/w/AUSENTE/package.json', estado: 'ausente' }],
      '4.1.11',
    );
    expect(r.distintas).toEqual([]);
    expect(r.ausentes).toEqual(['AUSENTE']);
    expect(r.declaradas).toEqual(['A', 'B', 'C']);
  });

  it('un miembro presente SIN declarar vitest sale como `sinDeclarar`, no se ignora', () => {
    // El agujero silencioso: sin esta fila, un miembro sin declaracion se
    // contaria como si estuviera bien, y el guard pasaria sin haber mirado.
    const r = cruzarDeclaraciones(
      [...base, { nombre: 'MUDO', ruta: '/w/MUDO/package.json', estado: 'declarada', rango: undefined }],
      '4.1.11',
    );
    expect(r.sinDeclarar.map((e) => e.nombre)).toEqual(['MUDO']);
    expect(r.distintas).toEqual([]);
    expect(r.declaradas).toEqual(['A', 'B', 'C']);
  });

  it('un rango ilegible hace LANZAR el cruce, no pasar en silencio', () => {
    // El error sale del helper de version, no se traga por el camino. Un guard
    // que se come un rango raro y pone verde es peor que no tener guard.
    expect(() => cruzarDeclaraciones(
      [...base, { nombre: 'RARO', ruta: '/w/RARO/package.json', estado: 'declarada', rango: '^4.x' }],
      '4.1.11',
    )).toThrow(/no soportado/);
  });
});

describe('el lector de miembros, con dientes', () => {
  it('lee una lista de una linea', () => {
    expect(leerMiembros('packages:\n  - ABDEep\n')).toEqual(['ABDEep']);
  });

  it('lee una lista de varias lineas y para en la siguiente clave', () => {
    // `allowBuilds:` viene despues y es un mapa, no una lista. Si el corte no
    // esta, `allowBuilds` se comeria una entrada mas y el guard vigilaria un
    // miembro que no existe.
    const yaml = 'packages:\n  - ABDSharedAssets\n  - ABDEep\nallowBuilds:\n  esbuild: true\n';
    expect(leerMiembros(yaml)).toEqual(['ABDSharedAssets', 'ABDEep']);
  });

  it('lee una ruta con barra, que es un miembro de dos niveles', () => {
    expect(leerMiembros('packages:\n  - ABDSharedCode/MidiKeyboard\n')).toEqual(['ABDSharedCode/MidiKeyboard']);
  });

  it('un fichero SIN bloque packages LANZA', () => {
    // Sin este, `leerMiembros` devolvia una lista vacia, el cruce se hacia contra
    // nada y el guard pasaba en verde mirando al vacio.
    expect(() => leerMiembros('allowBuilds:\n  esbuild: true\n')).toThrow(/packages:/);
    expect(() => leerMiembros('packages: []\n')).toThrow(/packages:/);
  });

  it('una linea de la lista que no es "- RUTA" LANZA en vez de ignorarse', () => {
    // MEDIDO, con la fila que lo destapo: un comentario al final de la linea
    // empieza por `- ` igual que un miembro, y el parser lo aceptaba como nombre.
    // El guard vigilaba un miembro que no existe y se ponia en verde.
    expect(() => leerMiembros('packages:\n  - ABDEep\n  - ABDNeural  # todavia no\n')).toThrow(/no sabe leer/);
    expect(() => leerMiembros('packages:\n  - ABDEep\n  - dos palabras\n')).toThrow(/no sabe leer/);
    expect(() => leerMiembros('packages:\n  - ABDEep\n  -sinespacio\n')).toThrow(/no sabe leer/);
  });

  it('compararVersiones ordena por numero, no por texto', () => {
    // La version que dice cual va mas atras. Con texto, "10.0.0" < "9.0.0".
    expect(compararVersiones('4.1.11', '4.1.12')).toBe(-1);
    expect(compararVersiones('4.1.12', '4.1.11')).toBe(1);
    expect(compararVersiones('4.1.11', '4.1.11')).toBe(0);
    expect(compararVersiones('10.0.0', '9.0.0')).toBe(1);
    expect(compararVersiones('4.10.0', '4.9.0')).toBe(1);
  });
});