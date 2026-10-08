/**
 * timeoutDeSubprocesos.test.js — todo test que lanza un subproceso tiene margen.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ EXISTE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Vitest 4 cambió el pool por defecto de `threads` a `forks`. Con 129 ficheros
 * levantando procesos hijo a la vez, los tests que lanzan `cmd.exe` o `node`
 * compiten por la CPU y se pasan de los **5 s por defecto**.
 *
 * MEDIDO, y no es una suposición: un test de `buildWebUiFailureDiagnostic` tarda
 * **485 ms aislado** y **5355 ms en la suite**, unas 11×. El peor caso del grupo
 * (`roundtripCorpusScript`) tarda **887 ms aislado**, que con esa contención se va
 * a ~10 s: el doble del default. El margen no es prudencia, es la medida.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ EL TIMEOUT VA EN EL `describe` Y NO EN CADA `it`
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Esto ya se intentó de la otra manera y falló. Se le puso el timeout al `it` que
 * había salido rojo, y la corrida siguiente falló en el test **hermano**, del mismo
 * bloque y por la misma causa. Arreglar de uno en uno es jugar a Whac-A-Mole con
 * el pool: cada corrida saca un rojo distinto del mismo grupo.
 *
 * El guard acepta **cualquiera de los dos** —timeout en el `describe` o en el `it`—
 * y solo exige lo que de verdad importa: que el test **no se quede en el default
 * de 5 s**. Fijar el mecanismo sería imponer una forma sobre un hecho.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LO QUE HACE FALTA MIRAR: EL SPAWN SE ESCONDE EN UN HELPER
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * La primera versión de este guard buscaba `spawnSync` en el cuerpo del `describe`,
 * y daba **cero ofensores** sobre un repo donde 13 ficheros lanzan subprocesos. Era
 * un guard que no vigilaba, y lo peor es que salía en verde.
 *
 * El motivo es que casi nadie lanza dentro del test. El patrón del repo es otro:
 *
 *     function runScript(args) {            // a nivel de módulo
 *       stdout = execFileSync(process.execPath, [SCRIPT, ...args], { ... });
 *     }
 *     describe('lo que sea', () => {
 *       it('hace tal cosa', () => runScript(['--json']));   // el spawn está aquí
 *     });
 *
 * Así que hay que resolver **un nivel** de indirección: buscar los helpers de módulo
 * que lanzan, y contar como "lanza" al bloque que llama a uno de ellos.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL SEGUNDO NIVEL, Y CÓMO SE SABE QUE HACE FALTA
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * El primer nivel tampoco era suficiente, y no porque fuera poco keen: hay ficheros
 * donde el `execFileSync` no está ni en el fichero ni en sus helpers, sino en un
 * módulo que este fichero **importa**.
 *
 *     // recuentoPorRecoleccion.test.js
 *     import { collectedDetail } from './support/vitestSuite.js';
 *     describe('...', () => {
 *       it('...', () => collectedDetail([SELF]));   // el spawn está en vitestSuite.js
 *     });
 *
 * MEDIDO, y no es hipotético: con el guard en su primera forma, estos dos ficheros
 * se quedaban **sin timeout** y por eso se caían. En la corrida completa
 * `recuentoPorRecoleccion` mide **1100 ms aislado** y se pasa de los **5 s** por
 * defecto; `contratosDeDependencias` likewise. El rojo que sale de ahí es
 * `STACK_TRACE_ERROR`, que es el sentinel que vitest lanza cuando el test expira —
 * un timeout sin decir QUE lo produjo.
 *
 * Así que el detector sigue además los imports **relativos**, hasta tres saltos, y
 * si el módulo importado lanza (en su cuerpo de módulo o en un helper suyo), da por
 * lanzadores todos los nombres que trae de ese módulo. Es conservador a proposito:
 * `vitestSuite.js` tambien exporta `ROOT` y `TESTS_DIR`, que son constantes y no se
 * llaman nunca, asi que declararlos lanzadores no produce falsos positivos; lo que
 * se busca despues es una LLAMADA (`nombre(`), no un uso.
 *
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA REGLA, Y POR QUÉ NO ES MÁS ANCHA
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Solo se exige timeout en los bloques que lanzan de verdad. En este repo hay 13
 * ficheros que lanzan, con 37 `describe` de nivel superior, y **27 sin timeout**:
 * la mayoría son bloques de texto puro que nunca hacen I/O. Exigírselo a todos
 * serían 17 timeouts escritos para callar un guard, y un guard que obliga a tocar
 * medio repo acaba mirándose como estilo y deja de avisar de lo único que avisa.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TESTS_DIR = __dirname;

/** Las tres formas de lanzar un subproceso que usa este repo. */
const LANZA = /\b(?:spawnSync|execFileSync|execSync)\s*\(/;

/**
 * Apertura de un describe de nivel superior, en las dos formas del repo:
 *   describe('nombre', () => { ... })
 *   describe.skipIf(!hayCorpus)('nombre', () => { ... })
 *
 * La condición del `skipIf` va EN MEDIO, y por eso el patrón tiene que tolerarla.
 * MEDIDO: con `.skipIf\()` a secas no se veía ni uno, y son los bloques más pesados
 * del repo: el corpus de 1024 presets y los dumps de hardware.
 */
const ABRE = /^describe(?:\.skipIf\([^)]*\))?\(/;

/**
 * Cierre de columna 0, con o sin timeout. Lo anidado va indentado, y así no hay que
 * contar llaves —que en este repo hay alguna DENTRO de cadenas, `'{no es json'`.
 */
const CIERRE = /^\}(?:, (\d+))?\);$/;

/** Función de módulo: `function f(` o `const f = (...) => {`. */
const HELPER = /^(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{)/;

/**
 * Import LOCAL: `import { a, b } from './support/x.js'`.
 *
 * Solo los relativos. Un `from 'vitest'` o `from 'node:fs'` no se puede seguir en
 * el arbol del repo, y no hace falta: la pregunta nunca es «¿este fichero lanza?»
 * sino «¿el spawn vive en otro fichero y este lo usa?».
 */
const IMPORTA_LOCAL = /^\s*import\s+(.+?)\s+from\s+['"](\.[^'"]+)['"]/;

/**
 * Las líneas de un trozo que son CÓDIGO: sin comentarios y sin contenido de cadenas.
 *
 * Los comentarios se quitan porque el repo escribe mucho sobre subprocesos en prosa.
 * El contenido de las cadenas se quita por lo mismo, y por un caso que se dio de
 * verdad: MEDIDO, este propio fichero salía como ofensor de SÍ MISMO, porque sus
 * fixtures llevan un `execFileSync` dentro de una cadena. Es texto que se le pasa al
 * detector, no una llamada que se ejecute.
 *
 * Vaciar las cadenas es seguro: lo que se busca es el nombre de la función, que va
 * fuera de ellas.
 *
 * @param {string} texto
 * @returns {string}
 */
function soloCodigo(texto) {
  return sinComentarios(texto)
    .split(/\r?\n/)
    .map((l) => l
      .replace(/'(?:[^'\\]|\\.)*'/g, "''")
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      .replace(/`(?:[^`\\]|\\.)*`/g, '``'))
    .join('\n');
}

/**
 * Los describes de nivel superior de un fichero, con su cuerpo y su timeout.
 *
 * El cuerpo va del apertura hasta el **siguiente** apertura de columna 0, no hasta
 * el cierre: para buscar texto no hace falta más, y así no hay dos detecciones de
 * cierre que puedan discrepar.
 *
 * @param {string} fuente
 * @returns {Array<{linea: number, nombre: string, cuerpo: string, timeout: string|null}>}
 */
export function describesDeNivelSuperior(fuente) {
  const lineas = fuente.split(/\r?\n/);
  const aperturas = lineas
    .map((l, i) => (ABRE.test(l) ? i : -1))
    .filter((i) => i >= 0);

  return aperturas.map((desde, k) => {
    const hasta = k + 1 < aperturas.length ? aperturas[k + 1] : lineas.length;
    const cuerpo = lineas.slice(desde, hasta).join('\n');
    let timeout = null;
    for (let i = desde + 1; i < hasta; i++) {
      const m = CIERRE.exec(lineas[i]);
      if (m !== null) { timeout = m[1] ?? null; break; }
    }
    const nombre = (lineas[desde].match(/(['"])(.*?)\1/) || [, , '?'])[2];
    return {linea: desde + 1, nombre, cuerpo, timeout, timeoutDeIt: timeoutDeAlgunIt(cuerpo)};
  });
}

/**
 * ¿Alguno de los `it` del bloque lleva su propio timeout?
 *
 * MEDIDO: faltaba esto, y el efecto era el peor de los dos. `baselineGuard.test.js`
 * cierra su bloque con `}, 240000);` en el **`it`** y con `});` en el `describe`.
 * Su timeout estaba puesto y bien puesto; el guard lo listaba como ofensor porque
 * solo miraba el cierre del `describe`, y asi obligaba a tocar un fichero que ya
 * estaba bien.
 *
 * Se aceptan las dos formas que usa el repo: el cierre `  }, 240000);` y el tercer
 * argumento `it('x', fn, 240000)`.
 *
 * @param {string} cuerpo
 * @returns {string|null}
 */
export function timeoutDeAlgunIt(cuerpo) {
  for (const l of cuerpo.split(/\r?\n/)) {
    const cierre = /^\s*\},\s*(\d+)\);/.exec(l);
    if (cierre !== null) {return cierre[1];}
  }
  for (const l of cuerpo.split(/\r?\n/)) {
    const tercer = /^\s*it\b.*,\s*(\d+)\s*\)\s*;/.exec(l);
    if (tercer !== null) {return tercer[1];}
  }
  return null;
}

/**
 * Los helpers de NIVEL DE MÓDULO cuyo cuerpo lanza un subproceso.
 *
 * Se lee desde la apertura del helper hasta la siguiente línea de columna 0 que no
 * sea suyo: otra apertura de describe, otro helper, o una llave de cierre.
 *
 * @param {string} fuente
 * @returns {string[]} nombres de los helpers que lanzan
 */
export function helpersLocalesQueLanzan(fuente) {
  const lineas = fuente.split(/\r?\n/);

  // Primero el cuerpo de cada helper, por nombre. El cuerpo va desde la apertura
  // hasta la siguiente linea de columna 0 que no sea suyo.
  const cuerpos = new Map();
  for (let i = 0; i < lineas.length; i++) {
    if (ABRE.test(lineas[i])) {continue;}
    const m = HELPER.exec(lineas[i]);
    if (m === null) {continue;}
    const cuerpo = [];
    for (let j = i + 1; j < lineas.length; j++) {
      if (ABRE.test(lineas[j]) || HELPER.test(lineas[j])) {break;}
      if (/^\}/.test(lineas[j])) {break;}
      cuerpo.push(lineas[j]);
    }
    cuerpos.set(m[1] ?? m[2], cuerpo.join('\n'));
  }

  // Y despues, PUNTO FIJO. MEDIDO: mirar solo si el cuerpo llama a `execFileSync`
  // de verdad no basta, porque los helpers tambien se llaman entre si.
  //
  //     function correrScript(s, a) { return execFileSync(...); }   <- lanza
  //     function formaDelSpec() { return correrScript(...); }        <- tambien
  //     describe('CONTRATO 2', () => { it('...', () => formaDelSpec()); });
  //
  // Ese describe no contiene ni un `execFileSync` ni una llamada a
  // `correrScript`: llama a `formaDelSpec`, y ahi se rompe la cadena. Con el
  // detector de un solo salto el bloque salia limpio y se caia en la suite.
  // Con dos saltos ya no, y con tres tampoco, porque se itira hasta que no
  // aparezca nadie nuevo.
  const lanzan = new Set();
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (const [nombre, cuerpo] of cuerpos) {
      if (lanzan.has(nombre)) {continue;}
      const codigo = soloCodigo(cuerpo);
      if (LANZA.test(codigo)) {lanzan.add(nombre); cambio = true; continue;}
      for (const otro of lanzan) {
        if (new RegExp(`\\b${otro}\\s*\\(`).test(codigo)) {
          lanzan.add(nombre); cambio = true; break;
        }
      }
    }
  }
  return [...lanzan];
}

/**
 * Las lineas de un trozo que no son COMENTARIO, dejando las cadenas INTACTAS.
 *
 * `soloCodigo()` no sirve aqui, y el fallo es instructivo: vacia tambien el
 * contenido de las cadenas, que en un `import` es justo lo que dice de donde
 * viene el modulo. Con el se leia `from ''` y no se encontraba ni un import.
 *
 * Y el ORDEN importa, que es lo que hacia esta version. La primera quitaba antes
 * las lineas que empiezan por asterisco y despues hacia el comentario de bloque. Al
 * haberse llevado los cierres de los JSDoc, la apertura de la cabecera se quedaba
 * sin cerrar y el patron se comia codigo de verdad. MEDIDO, en
 * `recuentoPorRecoleccion.test.js` se leian 0 imports de los 1 que tiene. Por eso
 * esto lleva un escaner con estado en vez de una expresion regular: el orden ya no
 * puede importarle.
 *
 * @param {string} texto
 * @returns {string}
 */
export function sinComentarios(texto) {
  const salida = [];
  let enBloque = false;
  for (const linea of texto.split(/\r?\n/)) {
    const t = linea.trimStart();
    if (enBloque) {
      // La linea de cierre `*/` tambien se tira: es la que cierra, no codigo.
      if (t.includes('*/')) {enBloque = false;}
      continue;
    }
    if (t.startsWith('/*')) {
      // `/** doc */` en una linea: abre y cierra aqui, asi que no hay bloque abierto.
      if (!t.slice(t.indexOf('/*') + 2).includes('*/')) {enBloque = true;}
      continue;
    }
    if (t.startsWith('//')) {continue;}
    salida.push(linea);
  }
  return salida.join('\n');
}

/** Los `import ... from './algo.js'` de una fuente: qué se trae y de dónde. */
export function importacionesLocales(fuente) {
  const salida = [];
  for (const linea of sinComentarios(fuente).split(/\r?\n/)) {
    const m = IMPORTA_LOCAL.exec(linea);
    if (m === null) {continue;}
    const [, clausula, ruta] = m;
    const nombres = [];
    const llaves = clausula.match(/\{([^}]*)\}/);
    if (llaves) {
      for (const parte of llaves[1].split(',')) {
        const s = parte.trim().replace(/^type\s+/, '');
        if (s === '') {continue;}
        const alias = s.match(/\bas\s+(\w+)$/);
        nombres.push(alias ? alias[1] : s);
      }
    }
    const fuera = clausula.replace(/\{[^}]*\}/g, ' ').replace(/,/g, ' ').trim();
    const simple = fuera.match(/^(?:\*\s+as\s+)?(\w+)$/);
    if (simple) {nombres.push(simple[1]);}
    salida.push({nombres, ruta});
  }
  return salida;
}

/**
 * ¿Lanza este módulo, en su cuerpo de módulo o dentro de un helper suyo?
 *
 * @param {string} fuente
 * @returns {boolean}
 */
export function moduloLanza(fuente) {
  const codigo = soloCodigo(fuente);
  if (LANZA.test(codigo)) {return true;}
  return helpersLocalesQueLanzan(codigo).length > 0;
}

/**
 * El cuerpo de cada función declarada a nivel de módulo, por nombre.
 *
 * Se aceptan las dos formas del repo: `function f(` (con o sin `export`) y
 * `const f = (...) => {`.
 *
 * @param {string} fuente
 * @returns {Map<string,string>} nombre → cuerpo
 */
export function cuerposDeFunciones(fuente) {
  const lineas = sinComentarios(fuente).split(/\r?\n/);
  const mapa = new Map();
  const CABEZA = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(\w+)\s*\(/;
  const FLECHA = /^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/;
  for (let i = 0; i < lineas.length; i++) {
    const m = CABEZA.exec(lineas[i]) ?? FLECHA.exec(lineas[i]);
    if (m === null) {continue;}
    const nombre = m[1];
    // El cuerpo empieza en la PROPIA linea de apertura: una funcion entera en una
    // sola linea es legal y es como esta escrito el codigo de prueba de mas de un
    // modulo. MEDIDO: sin esto, `export function f() { return execFileSync('x'); }`
    // se leia con el cuerpo VACIO y ninguna funcion parecia lanzar.
    const cola = lineas[i].slice(lineas[i].indexOf('{') + 1);
    const cuerpo = cola === '' ? [] : [cola];
    for (let j = i + 1; j < lineas.length; j++) {
      if (/^\}/.test(lineas[j])) {break;}
      if (/^(?:export\s+)?(?:const|let|function|class)\s/.test(lineas[j])) {break;}
      cuerpo.push(lineas[j]);
    }
    mapa.set(nombre, cuerpo.join('\n'));
  }
  return mapa;
}

/**
 * Qué FUNCIONES de este módulo lanzan, y no solo qué módulo.
 *
 * MEDIDO por qué hace falta el detalle. Con la regla gruesa —«si el módulo
 * importa lanza, todos sus nombres son lanzadores»— `registryGen.test.js:440`
 * salía como ofensor: `canonicalizeSource` viene de
 * `scripts/registry_generator.js`, que sí lanza… pero en OTRAS funciones. Ese
 * bloque solo calcula hashes y no lanza nada. Un guard que obliga a poner un
 * timeout donde no hace falta entrena a ignorar al guard.
 *
 * Se resuelve por tanto dentro del módulo: una función es lanzadora si su cuerpo
 * llama a `execFileSync` de verdad, o si llama a otra función del MISMO módulo que
 * lo hace. Lo segundo se itera hasta punto fijo, para que una cadena de tres
 * saltos también llegue.
 *
 * @param {string} fuente
 * @returns {Set<string>}
 */
export function funcionesQueLanzan(fuente) {
  const cuerpos = cuerposDeFunciones(fuente);
  const lanzan = new Set();
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (const [nombre, cuerpo] of cuerpos) {
      if (lanzan.has(nombre)) {continue;}
      const codigo = soloCodigo(cuerpo);
      if (LANZA.test(codigo)) {lanzan.add(nombre); cambio = true; continue;}
      for (const otro of lanzan) {
        if (new RegExp(`\\b${otro}\\s*\\(`).test(codigo)) {
          lanzan.add(nombre); cambio = true; break;
        }
      }
    }
  }
  return lanzan;
}

/**
 * Los nombres que este fichero trae de un módulo IMPORTADO que lanza.
 *
 * Se sigue la cadena de imports relativos hasta `PROFUNDIDAD` saltos, que es de
 * sobra para este repo: `test -> support/vitestSuite.js -> support/glob-test-files.mjs`.
 * El conjunto de visitados evita los ciclos, que en un grafo de imports no son
 * una hipotesis.
 *
 * @param {string} dirBase directorio del fichero que se esta mirando
 * @param {string} fuente su codigo
 * @returns {Set<string>}
 */
export function lanzadoresImportados(dirBase, fuente, PROFUNDIDAD = 3) {
  const vistos = new Set();
  const cola = [{dir: dirBase, fuente}];
  const lanzan = new Set();

  while (cola.length > 0 && PROFUNDIDAD > 0) {
    PROFUNDIDAD--;
    const actual = cola.shift();
    for (const {nombres, ruta} of importacionesLocales(actual.fuente)) {
      const absoluta = path.resolve(actual.dir, ruta);
      if (vistos.has(absoluta) || !fs.existsSync(absoluta)) {continue;}
      vistos.add(absoluta);
      let contenido;
      try { contenido = fs.readFileSync(absoluta, 'utf8'); }
      catch {continue;}
      const lanzadoras = funcionesQueLanzan(contenido);
      for (const n of nombres) {
        if (lanzadoras.has(n)) {lanzan.add(n); continue;}
        // Un nombre que NO es una funcion de ese modulo es una constante: no
        // puede lanzar por si sola, asi que no se cuenta. `ROOT` y `TESTS_DIR`
        // de vitestSuite.js entran aqui.
        if (!cuerposDeFunciones(contenido).has(n) && LANZA.test(soloCodigo(contenido))) {
          lanzan.add(n);
        }
      }
      cola.push({dir: path.dirname(absoluta), fuente: contenido});
    }
  }
  return lanzan;
}

/**
 * Los helpers cuyo cuerpo lanza un subproceso, incluidos los que llegan por
 * `import` desde un modulo que lanza.
 *
 * @param {string} fuente
 * @param {string} [dir] directorio del fichero. Sin el, NO se siguen imports:
 *   las fuentes de los tests unitarios viven en memoria y no tienen de donde.
 * @returns {string[]}
 */
export function helpersQueLanzan(fuente, dir) {
  const nombres = helpersLocalesQueLanzan(fuente);
  if (typeof dir === 'string') {
    for (const n of lanzadoresImportados(dir, fuente)) {nombres.push(n);}
  }
  return [...new Set(nombres)];
}

/**
 * Los bloques que lanzan un subproceso —directamente, por un helper local o por un
 * modulo importado que lanza— y no tienen timeout de `describe`.
 *
 * @param {string} fuente
 * @param {string} [dir] directorio del fichero, para seguir imports relativos
 * @returns {Array<{linea: number, nombre: string}>}
 */
export function bloquesSinTimeout(fuente, dir) {
  const helpers = helpersQueLanzan(fuente, dir);
  const usoHelper = helpers.length > 0
    ? new RegExp(`\\b(?:${helpers.join('|')})\\s*\\(`)
    : /$^/;
  return describesDeNivelSuperior(fuente)
    .filter((d) => d.timeout === null && d.timeoutDeIt === null)
    .filter((d) => {
      const codigo = soloCodigo(d.cuerpo);
      return LANZA.test(codigo) || usoHelper.test(codigo);
    })
    .map((d) => ({linea: d.linea, nombre: d.nombre}));
}

/** Ficheros de test del repo. */
export function ficherosDeTest() {
  return fs.readdirSync(TESTS_DIR).filter((f) => f.endsWith('.test.js')).sort();
}

/**
 * ¿Lanza este fichero, de cualquier manera?
 *
 * MEDIDO, y el fallo era de los que se esconden: la puerta de entrada era
 * `LANZA.test(fuente)`, o sea «el texto crudo contiene execFileSync». Eso ya
 * descarta justo los ficheros del segundo caso —los que lanzan a traves de un
 * modulo importado—, y el guard se ponia en verde con los ofensores delante,
 * porque nunca llegaba a mirarlos.
 *
 * @param {string} fuente
 * @param {string} [dir]
 * @returns {boolean}
 */
export function ficheroLanza(fuente, dir) {
  if (LANZA.test(soloCodigo(fuente))) {return true;}
  return helpersQueLanzan(fuente, dir).length > 0;
}

describe('los tests que lanzan subprocesos tienen timeout', () => {
  it('ve las dos formas de describe, incluida la condicion del skipIf', () => {
    const fuente = [
      "describe('uno', () => {",
      '  it("a", () => {});',
      '});',
      '',
      "describe.skipIf(!hayCorpus)('dos', () => {",
      '  it("b", () => {});',
      '});',
    ].join('\n');
    const bloques = describesDeNivelSuperior(fuente);
    expect(bloques.length).toBe(2);
    expect(bloques[0].nombre).toBe('uno');
    expect(bloques[1].nombre).toBe('dos');
  });

  it('lee el timeout del describe y no el de la linea de al lado', () => {
    // MEDIDO: una version anterior leia la linea `cierre + 1`, de modo que daba
    // "sin timeout" a describes que si lo traian, y el guard habria puesto rojo el
    // repo entero. Aqui se fija con un caso de cada signo.
    const conTimeout = ["describe('a', () => {", '  it("x", () => {});', '}, 30000);', 'otra();'].join('\n');
    const sinTimeout = ["describe('b', () => {", '  it("y", () => {});', '});', 'otra();'].join('\n');
    expect(describesDeNivelSuperior(conTimeout)[0].timeout).toBe('30000');
    expect(describesDeNivelSuperior(sinTimeout)[0].timeout).toBeNull();
  });

  it('un comentario que menciona un subproceso no convierte el bloque en uno que lanza', () => {
    // El repo escribe mucho sobre esto en prosa. Sin el filtro, casi todos los
    // bloques de texto parecerian bloques que lanzan.
    const fuente = [
      "describe('solo texto', () => {",
      '  // aqui se llama a spawnSync en otro sitio',
      '  it("x", () => {expect(1).toBe(1);});',
      '});',
    ].join('\n');
    expect(bloquesSinTimeout(fuente)).toEqual([]);
  });

  it('un spawn dentro de una cadena no es un spawn', () => {
    // MEDIDO: sin esto, ESTE FICHERO salia como ofensor de si mismo, porque sus
    // propios fixtures llevan un `execFileSync` dentro de una cadena. Es texto que
    // se le pasa al detector, no una llamada que se ejecute.
    const fuente = [
      "describe('con fixture', () => {",
      '  it("monta el texto", () => {',
      '    const texto = "  return execFileSync(process.execPath, []);";',
      '    expect(typeof texto).toBe("string");',
      '  });',
      '});',
    ].join('\n');
    expect(bloquesSinTimeout(fuente)).toEqual([]);
  });

  it('el spawn escondido en un helper de modulo tambien se ve', () => {
    // El fallo de la primera version: buscaba el spawn en el cuerpo del describe y
    // daba cero ofensores sobre un repo con 13 ficheros que lanzan. El patron real
    // es un helper de modulo al que el test llama.
    const fuente = [
      "import { execFileSync } from 'node:child_process';",
      '',
      'function runScript(args) {',
      "  return execFileSync(process.execPath, ['x', ...args], {encoding: 'utf8'});",
      '}',
      '',
      "describe('usa el helper', () => {",
      "  it('llama al script', () => { runScript(['--json']); });",
      '});',
    ].join('\n');
    expect(helpersQueLanzan(fuente)).toEqual(['runScript']);
    const ofensores = bloquesSinTimeout(fuente);
    expect(ofensores.length, 'el bloque llama a un helper que lanza, y no se ha visto')
      .toBe(1);
    expect(ofensores[0].nombre).toBe('usa el helper');
  });

  it('un timeout puesto en el it basta, y el del describe no hace falta', () => {
      // MEDIDO: faltaba esta regla y el guard listaba a `baselineGuard.test.js` como
      // ofensor. Su timeout estaba puesto y bien puesto, pero en el `it`:
      //
      //     it('los counts...', () => { ... }, 240000);
      // });
      //
      // Obligar a tocar un fichero que ya estaba bien es como se entrena a la gente
      // a ignorar al guard, asi que el timeout del `it` cuenta igual que el del
      // `describe`. Lo que se exige es no quedarse en el default.
    const enElIt = [
      "describe('a', () => {",
      "  it('x', () => { execFileSync('cmd'); }, 240000);",
      '});',
    ].join('\n');
    expect(describesDeNivelSuperior(enElIt)[0].timeout).toBeNull();
    expect(describesDeNivelSuperior(enElIt)[0].timeoutDeIt).toBe('240000');
    expect(bloquesSinTimeout(enElIt),
      'un timeout en el it es suficiente, y el guard lo estaba exigiendo en el describe')
      .toEqual([]);

    const sinNinguno = [
      "describe('b', () => {",
      "  it('y', () => { execFileSync('cmd'); });",
      '});',
    ].join('\n');
    expect(bloquesSinTimeout(sinNinguno).length).toBe(1);
    });

    it('el spawn que vive en un modulo IMPORTADO tambien se ve', () => {
      // El segundo caso, y el que se ha dado de verdad. Con el guard en su primera
      // forma estos dos ficheros se quedaban SIN timeout y por eso se caian: el
      // `execFileSync` no estaba ni en el fichero ni en sus helpers, sino en
      // `./support/vitestSuite.js`, que este fichero importa.
      //
      // Se comprueba contra los ficheros REALES del repo, no contra un fixture: un
      // fixture tambien pasaria si el detector se hubiera roto de otra manera, y
      // ademas estos dos son los que de verdad se caian.
      for (const f of ['recuentoPorRecoleccion.test.js', 'contratosDeDependencias.test.js']) {
        const fuente = fs.readFileSync(path.join(TESTS_DIR, f), 'utf8');
        expect(importacionesLocales(fuente).length,
          `${f} no tiene ningun import local: el detector de imports esta roto`)
          .toBeGreaterThan(0);
        expect(lanzadoresImportados(TESTS_DIR, fuente).size,
          `${f} importa de un modulo que lanza y el guard no lo ve`)
          .toBeGreaterThan(0);
      }
    });

    it('un modulo que lanza, pero cuya funcion NO lanza, no marca el bloque', () => {
      // El falso positivo que la regla gruesa producia, y que se midio de verdad.
      // `canonicalizeSource` viene de `scripts/registry_generator.js`, que SI lanza
      // en otras funciones; el bloque que la usa solo calcula hashes.
      //
      // Si esta regla se afloja, el guard obliga a poner un timeout donde no hace
      // falta, y eso es exactamente como se deja de mirar un guard.
      const modulo = [
        'export function pura(x) { return JSON.stringify(x); }',
        "export function lanzadora() { return execFileSync('cmd'); }",
      ].join('\n');
      expect([...funcionesQueLanzan(modulo)]).toEqual(['lanzadora']);

      const cadena = [
        "function interna() { return execFileSync('cmd'); }",
        'export function media() { return interna(); }',
        'export function pura() { return 1; }',
      ].join('\n');
      const lanzan = funcionesQueLanzan(cadena);
      expect(lanzan.has('interna'), 'una funcion que llama directamente debe lanzar').toBe(true);
      expect(lanzan.has('media'), 'el segundo salto de la cadena tambien debe llegar').toBe(true);
      expect(lanzan.has('pura'), 'una funcion que no toca nada no debe marcarse').toBe(false);
    });

  it('el spawn escondido a DOS saltos de un helper tambien se ve', () => {
      // El caso que ha dado el susto. MEDIDO: con el detector de un solo salto,
      // `describe('CONTRATO 2')` de `contratosDeDependencias.test.js` salía limpio y
      // se caía en la suite. La cadena es:
      //
      //     function correrScript(...) { return execFileSync(...); }  // lanza
      //     function formaDelSpec() { return correrScript(...); }   // tambien
      //     describe(..., () => { it(..., () => formaDelSpec()); });
      //
      // El describe no tiene ni un `execFileSync` ni una llamada a `correrScript`:
      // llama a `formaDelSpec`, y ahí se rompía la cadena. Por eso los helpers se
      // resuelven a punto fijo y no de un solo salto.
      const fuente = [
        "import { execFileSync } from 'node:child_process';",
        '',
        'function correrScript(script, args = []) {',
        "  return execFileSync(process.execPath, [script, ...args], {encoding: 'utf8'});",
        '}',
        '',
        'function formaDelSpec() {',
        '  return correrScript(SHAPE_SCRIPT, [VITEST_NODE]);',
        '}',
        '',
        "describe('CONTRATO 2', () => {",
        "  it('la forma del spec', () => { formaDelSpec(); });",
        '});',
      ].join('\n');
      expect(helpersQueLanzan(fuente).sort()).toEqual(['correrScript', 'formaDelSpec']);
      const ofensores = bloquesSinTimeout(fuente);
      expect(ofensores.length,
        'el bloque llama a un helper que lanza a traves de otro helper, y no se ha visto')
        .toBe(1);
      expect(ofensores[0].nombre).toBe('CONTRATO 2');
    });

  it('un bloque que llama a un helper que NO lanza no se marca', () => {
    // La otra mitad del filtro: si se marcara todo, el guard seria ruido.
    const fuente = [
      'function suma(a, b) { return a + b; }',
      '',
      "describe('no lanza', () => {",
      '  it("suma", () => { expect(suma(1, 2)).toBe(3); });',
      '});',
    ].join('\n');
    expect(helpersQueLanzan(fuente)).toEqual([]);
    expect(bloquesSinTimeout(fuente)).toEqual([]);
  });

  it('NINGUN describe que lance un subproceso se queda en el default de 5 s', () => {
    const ofensores = [];
    for (const f of ficherosDeTest()) {
      const fuente = fs.readFileSync(path.join(TESTS_DIR, f), 'utf8');
      if (!ficheroLanza(fuente, TESTS_DIR)) {continue;}
      for (const b of bloquesSinTimeout(fuente, TESTS_DIR)) {
        ofensores.push(`${f}:${b.linea}  ${b.nombre}`);
      }
    }

    expect(
      ofensores,
      `${ofensores.length} describe(s) que lanzan subprocesos sin timeout explicito, y se `
      + 'quedan en los 5 s por defecto. MEDIDO: con el pool `forks` de vitest 4 y 129 '
      + 'ficheros compitiendo, un test que tarda 485 ms aislado tarda 5355 ms. Anade el '
      + `timeout al describe que cierra la linea de estos:\n  - ${ofensores.join('\n  - ')}`,
    ).toEqual([]);
  });

  it('el detector mira de verdad: encuentra ficheros, helpers y bloques', () => {
    // Un guard que no encuentra nada porque no busca nada tambien sale en verde.
    let ficheros = 0;
    let helpers = 0;
    let bloquesQueLanzan = 0;
    let conTimeout = 0;

    for (const f of ficherosDeTest()) {
      const fuente = fs.readFileSync(path.join(TESTS_DIR, f), 'utf8');
      if (!ficheroLanza(fuente, TESTS_DIR)) {continue;}
      ficheros++;
      helpers += helpersQueLanzan(fuente, TESTS_DIR).length;
      for (const d of describesDeNivelSuperior(fuente)) {
        const codigo = soloCodigo(d.cuerpo);
        const lanza = LANZA.test(codigo)
          || helpersQueLanzan(fuente, TESTS_DIR).some((h) => new RegExp(`\\b${h}\\s*\\(`).test(codigo));
        if (!lanza) {continue;}
        bloquesQueLanzan++;
        if (d.timeout !== null) {conTimeout++;}
      }
    }

    expect(ficheros, 'no se ha encontrado ningun fichero que lance subprocesos').toBeGreaterThan(5);
    expect(helpers, 'no se ha encontrado ningun helper que lance: el detector no resuelve la indireccion')
      .toBeGreaterThan(2);
    expect(bloquesQueLanzan, 'no se ha encontrado ningun bloque que lance').toBeGreaterThan(2);
    expect(conTimeout, 'ningun bloque tiene timeout: puede que se este leyendo mal')
      .toBeGreaterThan(0);
  });
});