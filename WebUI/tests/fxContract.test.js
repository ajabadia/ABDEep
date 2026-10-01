/**
 * El contrato de efectos no puede desincronizarse del C++.
 *
 *   npx vitest run WebUI/tests/fxContract.test.js
 *
 * QUE ATA ESTE FICHERO, Y POR QUE HACE FALTA
 *
 * Hay cuatro sitios que tienen que coincidir en el MISMO numero de efecto:
 *
 *   1. `Source/DSP/FX/FXSlot_Factory.cpp`  — quien de verdad construye el DSP.
 *   2. `ABDSharedAssets/contracts/fx-effects.json` — el contrato compartido.
 *   3. `WebUI/js/fx_contract.gen.js`       — lo que lee la web.
 *   4. `WebUI/js/components/fx_modal_templates.js` — el desplegable del rack.
 *
 * El 4 era una lista POR SU CUENTA, escrita a mano, y era la que el usuario
 * tenia delante de los ojos: ponia "Ambience" en el id 1 (que la fabrica
 * construye como Hall), "Delay" en el 22 (Deep Verb) y "DecimatorDelay" en el
 * 26 (Chamber), y ofrecia ademas los ids 57-63, que la fabrica NO construye.
 * Ver el ultimo `describe` de este fichero.
 *
 * Con 2, 3 y 4 duplicados a mano, el que se olvida de actualizar gana siempre, y
 * no da ningun error: la etiqueta del desplegable simplemente se equivoca y
 * nadie se entera hasta que alguien con el rack abierto se queja de que el
 * "Ambience" le suena a Hall. Eso ya paso una vez, por eso existen estos tests.
 *
 * Aqui se atan las cuatro:
 *
 *   - el .gen commiteado tiene que ser EXACTAMENTE lo que genera el contrato
 *     compartido (se regenera en memoria y se compara byte a byte, que es lo
 *     mismo que hace `generate_fx_contract.mjs --check` en CI);
 *   - el contrato tiene que estar alineado con la FABRICA de C++, que se lee
 *     del propio `.cpp` y no de una copia;
 *   - `effects_data.js` tiene que DERIVAR los nombres y no tenerlos escritos,
 *     para que no vuelva a colarse una lista a mano por la puerta de atras.
 */

import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync, existsSync, mkdirSync, mkdtempSync,
  readFileSync, rmSync, statSync, writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const suiteRoot = resolve(repoRoot, '..');

const CONTRACT = join(suiteRoot, 'ABDSharedAssets', 'contracts', 'fx-effects.json');
const GENERATOR = join(repoRoot, 'scripts', 'generate_fx_contract.mjs');
const FACTORY = join(repoRoot, 'Source', 'DSP', 'FX', 'FXSlot_Factory.cpp');
const GENERATED = join(repoRoot, 'WebUI', 'js', 'fx_contract.gen.js');
const EFFECTS_DATA = join(repoRoot, 'WebUI', 'js', 'effects_data.js');
const INDEX_HTML = join(repoRoot, 'WebUI', 'index.html');
const WORKFLOW = join(repoRoot, '.github', 'workflows', 'fx-contract-generation.yml');

// ── El .gen tal cual lo carga el WebView ────────────────────────────────────

function loadGenerated () {
  const context = { window: null, self: null };
  context.window = context;
  context.self = context;
  vm.createContext(context);

  vm.runInContext(readFileSync(GENERATED, 'utf8'), context, { filename: 'fx_contract.gen.js' });

  return context.FxEffectsContract;
}

const generated = loadGenerated();

/**
 * Las claves de PROCEDENCIA: las que el generador tiene que copiar del
 * contrato tal cual, sin inventar y sin omitir.
 *
 * Se comprueba que la lista no este vacia porque un `for` sobre una lista
 * vacia no falla nunca: si alguien la vacia, el guard deja de mirar y sigue
 * en verde. Ver el aserto que la comprueba.
 */
const CLAVES_DE_PROCEDENCIA = ['generatedFrom'];

/**
 * QUE PROCEDENCIA SE HA PERDIDO O INVENTADO, en texto.
 *
 * Devuelve una lista de problemas, vacia si todo cuadra. Es una FUNCION PURA a
 * proposito —no un `it`— para que este mismo fichero le pueda dar un contrato y
 * un .gen falsos y comprobar que los ve. Un guard que solo se puede evaluar
 * contra los ficheros de verdad no se puede verificar: si un dia dejara de
 * mirar nada, seguiria en verde y nadie lo notaria.
 *
 * La regla, en las dos direcciones, que es lo que la asercion original perdia:
 * lo que el contrato declara, el .gen lo copia; y lo que el contrato NO declara,
 * el .gen no puede aparecer con una. Con la clave ausente en ambos, comparar
 * undefined con undefined era un test que no podia fallar.
 */
function problemasDeProcedencia (ctto, gen) {
  const problemas = [];

  for (const clave of CLAVES_DE_PROCEDENCIA) {
    const delContrato = ctto[clave];
    const delGen = gen[clave];

    if (delContrato === undefined) {
      if (delGen !== undefined) {
        problemas.push(`${clave}: el contrato no lo declara y el .gen se lo ha inventado ("${delGen}")`);
      }
    } else if (delGen !== delContrato) {
      problemas.push(`${clave}: el contrato declara "${delContrato}" y el .gen dice "${delGen}"`);
    }
  }

  return problemas;
}

/** Una cadena literal, de comillas simples o dobles. */
const CADENA_LITERAL = /'([^'\\\n]*)'|"([^"\\\n]*)"/g;

/**
 * Quita comentarios de linea y de bloque, y SOLO eso: una cadena que contiene
 * `//` es una cadena y se queda.
 *
 * POR QUE IMPORTA. Sin esto, `effects_data.js` —que tiene un comentario
 * explicandO que la lista vieja llamaba "Ambience" al 1— sale con un nombre del
 * contrato y el guard se pone rojo. Y ese es el peor fallo posible de un guard:
 * que salte cuando el codigo esta BIEN. El primero que lo ve apaga el paso y
 * ya no lo vuelve a mirar.
 */
function sinComentarios (source) {
  let out = '';
  let i = 0;

  while (i < source.length) {
    const c = source[i];
    const siguiente = source[i + 1];

    if (c === '/' && siguiente === '/') {
      while (i < source.length && source[i] !== '\n') i++;
    } else if (c === '/' && siguiente === '*') {
      i += 2;
      while (i + 1 < source.length && !(source[i] === '*' && source[i + 1] === '/')) i++;
      i += 2;
    } else {
      out += c;
      i++;
    }
  }

  return out;
}

/**
 * SI HAY UNA LISTA DE NOMBRES ESCRITA A MANO, y por que se cree que lo hay.
 *
 * UNA FUNCION PURA, y eso es lo que la hace verificable: este mismo fichero
 * le puede pasar un array a mano, un objeto a mano y una lista encubierta en
 * una cadena, y comprobar que los tres los ve. El guard viejo no podia hacer
 * eso, porque era un `if` dentro de un `it` y su unico caso era el codigo real.
 *
 * QUE CAZA, y por que cada forma importa:
 *
 *   - un ARRAY plano o partido por el formateador: la forma de siempre.
 *   - un OBJETO `{0: 'Hall', 1: 'Plate'}`. El regex viejo NO lo ve porque no
 *     hay ningun array. Y es la refactorizacion mas natural que puede hacer
 *     alguien que odie los indices sueltos.
 *   - una CADENA con los nombres separados por comas y un `.split(',')`. Tampoco
 *     la ve el viejo, y es la forma mas compacta de todos.
 *
 * QUE NO CAZA, y por que eso tambien es un requisito:
 *
 *   - UN nombre suelto: citar 'Hall' al hablar del efecto 1 no es una lista.
 *   - Los comentarios: por eso se limpia el codigo antes de mirar.
 *   - Las clases de Tailwind y los literales de plantilla del desplegable, que
 *     son tan numerosos como una lista. Un detector de densidad los chillaba;
 *     uno que mira NOMBRES CONCRETOS no puede, porque 'track' y 'handle' no son
 *     nombres de efecto.
 */
function detectarListaAMano (source) {
  const codigo = sinComentarios(source);
  const sueltos = new Set();
  const encerradas = [];
  let m;

  CADENA_LITERAL.lastIndex = 0;
  while ((m = CADENA_LITERAL.exec(codigo)) !== null) {
    const s = m[1] !== undefined ? m[1] : m[2];

    if (NOMBRES_DEL_CONTRATO.has(s)) {
      sueltos.add(s);
    } else {
      // Una sola cadena con muchos nombres dentro: lista encubierta.
      //
      // EL UMBRAL ES 8 Y ESTA MEDIDO, NO ADIVINADO. Con 3 —que era por donde
      // empezo— el detector marcaba `name: 'Vintage Room Ambience'` en
      // effects_presets_data.js: es el nombre de un PRESET, pero la subcadena
      // contiene tres nombres del contrato. Un guard que se pone rojo sobre el
      // codigo correcto se apaga en su primer falso positivo, y a partir de ahi
      // no lo mira nadie.
      //
      // Los numeros, medidos sobre los 277 .js reales de la WebUI:
      //   el maximo en codigo correcto ......  3   (el nombre del preset)
      //   la lista encubierta mas corta .... 10   (diez nombres en un split)
      //   la de verdad ...................... 61
      //
      // O sea: 3 no sirve, 10 basta. 8 se queda en medio, con margen a los dos
      // lados. Si alguien lo baja, que mire estos numeros antes.
      const dentro = [...NOMBRES_DEL_CONTRATO].filter((n) => s.includes(n));

      if (dentro.length >= 8) {
        encerradas.push(`una cadena con ${dentro.length} nombres: "${s.slice(0, 48)}..."`);
      }
    }
  }

  const motivos = [];

  if (sueltos.size >= 2) {
    motivos.push(`${sueltos.size} nombres del contrato como literales: ${[...sueltos].slice(0, 6).join(', ')}`);
  }

  motivos.push(...encerradas);

  return { esLista: motivos.length > 0, motivos };
}

/**
 * Lo que EXPONE un `effects_data.js` concreto: se monta con el contrato real
 * delante y se lee lo que deja publicado.
 *
 * Recibe el TEXTO en vez de leer el fichero del disco, y eso es lo que la
 * vuelve pura. Antes la decision vivia dentro de un `it` que se limitaba a
 * leer el fichero bueno, asi que no habia ninguna forma de darle nada malo y
 * comprobar que lo notaba: el guard podia quedarse en `expect(...).toEqual(...)`
 * sobre una expresion vacia y seguir verde.
 *
 * Devuelve tambien si el fichero MONTÓ. Un `effects_data.js` que revienta al
 * cargarse tiene que salir en rojo por aqui, no con un `undefined` que
 * cualquiera se pueda comparar con cualquier cosa.
 */
function nombresExpuestosPor (source) {
  const context = { window: null, self: null };
  context.window = context;
  context.self = context;
  vm.createContext(context);
  vm.runInContext(readFileSync(GENERATED, 'utf8'), context, { filename: 'fx_contract.gen.js' });

  try {
    vm.runInContext(source, context, { filename: 'effects_data.js' });
  } catch (e) {
    return { nombres: null, monta: false, error: String(e && e.message) };
  }

  const nombres = Array.isArray(context.FX_TYPE_NAMES) ? context.FX_TYPE_NAMES : null;

  return { nombres, monta: nombres !== null, error: nombres === null ? 'no publica un array FX_TYPE_NAMES' : null };
}

/**
 * Los pares `[id, etiqueta]` que deja un desplegable concreto, montado con el
 * contrato delante. Misma idea que la de arriba: recibe el texto, distingue
 * "no monto" de "monte pero no coincide", y por eso se puede usar al reves.
 */
function opcionesDe (source) {
  const context = { window: null, self: null, console: { warn () {} } };
  context.window = context;
  context.self = context;
  vm.createContext(context);
  vm.runInContext(readFileSync(GENERATED, 'utf8'), context, { filename: 'fx_contract.gen.js' });

  let opciones;

  try {
    vm.runInContext(source, context, { filename: 'fx_modal_templates.js' });
    opciones = [...String(context.FX_TYPE_OPTIONS ?? '').matchAll(/<option value="(\d+)">([^<]*)<\/option>/g)]
      .map((m) => [Number(m[1]), m[2]]);
  } catch (e) {
    return { opciones: [], monta: false, error: String(e && e.message) };
  }

  return { opciones, monta: true, error: null };
}

/**
 * Las REGLAS de `.gitattributes` que tocan a `ruta`, en el subconjunto que
 * importa aqui: las que Seen `text` con `eol=lf`.
 *
 * Se parsea en vez de hacer `toContain('WebUI/js/fx_contract.gen.js text eol=lf')`
 * porque asi el guard distingue las tres cosas que hay que distinguir: que no
 * hay ninguna regla, que hay una que dice otra cosa (`eol=crlf`), y que hay una
 * regla con glob que SI cubre el fichero. Un `toContain` solo veria la tercera.
 */
function reglasPara (ruta, texto) {
  return texto
    .split('\n')
    .map((linea) => linea.trim())
    .filter((linea) => linea !== '' && !linea.startsWith('#'))
    .filter((regla) => {
      const patron = regla.split(/\s+/)[0];

      if (!patron || patron.startsWith('"')) {return false;}

      const rx = new RegExp(
        '^' + patron
          .replace(/[.+^${}()|[\]\\]/g, '\\$&')
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.')
          .replace(/\//g, '\\/')
          + '$'
      );

      return rx.test(ruta);
    });
}

/** Si alguna de esas reglas obliga a LF en checkout. */
function fijaLf (reglas) {
  return reglas.some((regla) => /(?:^|\s)text(?:\s|=|$)/.test(regla) && /(?:^|\s)eol=lf(?:\s|$)/.test(regla));
}

/** Los saltos CRLF de un texto. Cero es lo unico aceptable en un .gen. */
function cuentaCrlf (texto) {
  return (texto.match(/\r\n/g) || []).length;
}

/** El sha256 de los BYTES del contrato, que es lo que hashea el generador. */
function hashContrato () {
  return createHash('sha256').update(readFileSync(CONTRACT)).digest('hex');
}
const contract = JSON.parse(readFileSync(CONTRACT, 'utf8'));
const effects = contract.effects ?? contract;

/**
 * Los NOMBRES del contrato, como conjunto. Es la lista de lo que delata una
 * lista escrita a mano en estos ficheros: los nombres de efecto son
 * exactamente estos, y poner dos o mas como literal en el codigo es la senal.
 */
const NOMBRES_DEL_CONTRATO = new Set(effects.map((e) => e.name));

// ══════════════════════════════════════════════════════════════════════════

describe('fx_contract.gen.js esta al dia respecto al contrato compartido', () => {
  it('el fichero commiteado es byte a byte lo que genera el script', () => {
    // Es la MISMA comprobacion que hace `generate_fx_contract.mjs --check` en CI,
    // pero en el test: si el contrato cambia y nadie regenera, esto falla aqui
    // tambien, sin depender de que el job de CI se haya ejecutado.
    expect(() => execFileSync(process.execPath, [GENERATOR, '--check'], { cwd: repoRoot }))
      .not.toThrow();
  });

  it('el .gen declara que viene del contrato, para que se sepa de donde', () => {
    expect(generated.source).toBe('ABDSharedAssets/contracts/fx-effects.json');
  });

  it('la procedencia que el .gen declara es la que declara el contrato', () => {
    // ESTA ASERCION ERA VACUA Y AHORA NO. Decia
    //   expect(generated.generatedFrom).toBe(contract.generatedFrom)
    // pero el contrato ya NO trae esa clave, asi que comparaba undefined con
    // undefined y pasaba siempre: un test que no puede fallar.
    //
    // Ahora la regla vive en `problemasDeProcedencia`, en las dos direcciones,
    // y este `it` solo mira que salga vacia. Que la regla sea correcta de verdad
    // —que vea los dos fallos— lo comprueban los tests del final del fichero,
    // que le dan un par de contrato/.gen falsos.
    expect(problemasDeProcedencia(contract, generated)).toEqual([]);
  });

  it('la comprobacion de procedencia mira AL MENOS una clave', () => {
    // Un `for` sobre una lista vacia no falla nunca. Si alguien vacia
    // CLAVES_DE_PROCEDENCIA, el aserto de arriba pasaria con los ficheros que
    // hubiera y no miraria nada: verde y muerto. Esto es lo que le quita la
    // ultima costura al guard para volverse adorno.
    expect(CLAVES_DE_PROCEDENCIA.length).toBeGreaterThan(0);
  });

  it('el .gen tiene la cabecera AUTO-GENERATED y no una lista a mano', () => {
    const header = readFileSync(GENERATED, 'utf8').split('\n').slice(0, 2).join('\n');

    expect(header).toMatch(/AUTO-GENERATED/);
    expect(header).toMatch(/DO NOT EDIT/);
  });

  it('los nombres del .gen coinciden uno a uno con los del contrato', () => {
    // OJO con el orden: el array `effects` del contrato va AGRUPADO POR FAMILIA
    // (bypass, reverb, delay, tape, ...), no ordenado por id. Los ids se saltan
    // de un grupo a otro: al final del array se leen 55, 39, 16, 19, 43, 49,
    // 54, 56. Por eso la comparacion ordena por id antes, y no se asume que
    // `names` siga el orden del array.
    const byId = [...effects].sort((a, b) => a.id - b.id);

    expect(generated.names).toEqual(byId.map((e) => e.name));
  });

  it('el array del contrato esta agrupado por familia, no por id', () => {
    // Se fija a proposito: es la propiedad que hace peligroso indexar el
    // contrato por posicion en vez de por id.
    const ids = effects.map((e) => e.id);
    const sorted = ids.every((id, i) => i === 0 || ids[i - 1] < id);

    expect(sorted, 'si el contrato pasa a estar ordenado por id, este test se puede quitar').toBe(false);
  });

  it('el hash de origen del .gen es el del contrato de verdad', () => {
    // ESTA TAMBIEN ERA DE FORMADO, NO DE VALOR: `toMatch(/^[0-9a-f]{64}$/)`
    // solo comprueba que sean 64 hex, asi que un .gen regenerado de otro
    // contrato con los MISMOS 61 efectos pasaba en verde. El comentario de
    // arriba ya decia lo que hay que comprobar; aqui se comprueba de verdad,
    // hasheando el contrato otra vez.
    expect(generated.sourceHash).toBe(hashContrato());
  });
});

// ══════════════════════════════════════════════════════════════════════════

describe('el detector de listas a mano ve todas las formas y no las de mas', () => {
  /** Los nombres que el detector usa: tres del contrato, sacados de el. */
  const [A, B, C] = [...NOMBRES_DEL_CONTRATO];

  describe('las tres formas por las que se colaba una lista', () => {
    it('un ARRAY plano, la forma de siempre', () => {
      const { esLista } = detectarListaAMano(`const FX = ['${A}', '${B}', '${C}'];`);

      expect(esLista).toBe(true);
    });

    it('un OBJETO id -> nombre, que el regex viejo no veia porque no hay array', () => {
      // Esta es la que mas importa. `const FX = {0: 'Hall', 1: 'Plate'}` es la
      // refactorizacion mas natural que puede hacer alguien que odie los
      // indices sueltos, y el guard viejo —que buscaba `/\[[^\]]{200,}\]/`—
      // no la miraba. Verde y con la lista a mano.
      const { esLista, motivos } = detectarListaAMano(
        `const FX = { 0: '${A}', 1: '${B}', 2: '${C}' };`
      );

      expect(esLista).toBe(true);
      expect(motivos[0]).toMatch(/nombres del contrato/);
    });

    it('una CADENA con split, que tampoco tiene array', () => {
      // Los 61 nombres de verdad, no tres: tres en un split no son una lista, y
      // un caso de prueba que miente hace que el detector parezca menos capaz
      // de lo que es y deja el hueco abierto de verdad.
      const { esLista, motivos } = detectarListaAMano(
        `const FX = '${[...NOMBRES_DEL_CONTRATO].join(',')}'.split(',');`
      );

      expect(esLista).toBe(true);
      expect(motivos[0]).toMatch(/cadena con \d+ nombres/);
    });

    it('y con la lista mas CORTA que aun es una lista', () => {
      // Diez nombres en un split. Es el borde inferior que importa: por debajo
      // de ocho, el detector se calla a proposito (un preset con tres nombres
      // en su etiqueta existe de verdad, y hay que dejarlo pasar).
      const diez = [...NOMBRES_DEL_CONTRATO].slice(0, 10);

      expect(detectarListaAMano(`const FX = '${diez.join(',')}'.split(',');`).esLista).toBe(true);
      expect(detectarListaAMano(`const FX = '${diez.slice(0, 3).join(',')}'.split(',');`).esLista).toBe(false);
    });
  });

  describe('y lo que NO es una lista, que tambien hay que comprobar', () => {
    it('un nombre suelto no es una lista', () => {
      // Citar 'Hall' al hablar del efecto 1 es correcto y no puede hacer
      // saltar el guard, o el primer uso legitimo lo apaga para siempre.
      const { esLista } = detectarListaAMano(`const etiqueta = '${A}';`);

      expect(esLista).toBe(false);
    });

    it('un nombre en un comentario no es codigo', () => {
      // `effects_data.js` tiene un comentario que explica que la lista vieja
      // llamaba 'Ambience' al 1. Sin `sinComentarios()`, ese guard se ponia
      // rojo con el fichero CORRECTO, que es el peor fallo de un guard.
      const { esLista } = detectarListaAMano(
        `// antes decia '${A}' y '${B}' en vez de lo que dice el contrato\nconst x = 1;`
      );

      expect(esLista).toBe(false);
    });

    it('los literales de plantilla y las clases de estilo no son una lista', () => {
      // Un detector por DENSIDAD de cadenas los confundia con una lista: el
      // desplegable tiene 'track', 'handle', 'flex-row' y media docena mas, y
      // son tan numeros como 61 nombres. Este los deja pasar porque no son
      // nombres de efecto, que es justo lo que se le pide al detector.
      const codigo = `
        const clase = ['track', 'handle', 'flex-row', 'flex-col', 'items-center',
                       'label text-xs', 'v-slider', 'knob', 'fx-knobs'];
      `;
      const { esLista } = detectarListaAMano(codigo);

      expect(esLista).toBe(false);
    });
  });

  it('el codigo real de los dos ficheros se deja pasar', () => {
    // El contraluz, que es el unico que importa de verdad: si el detector
    // chillara sobre el codigo correcto, habria que apagarlo y el guard se
    // habria perdido. Los dos ficheros que vigila, tal y como estan.
    for (const ruta of [EFFECTS_DATA, resolve(repoRoot, 'WebUI', 'js', 'components', 'fx_modal_templates.js')]) {
      const { esLista, motivos } = detectarListaAMano(readFileSync(ruta, 'utf8'));

      expect(esLista, `${basename(ruta)} sale como lista a mano: ${motivos.join('; ')}`).toBe(false);
    }
  });

  it('el conjunto de nombres del contrato no esta vacio', () => {
    // Un `new Set()` vacio haria que el detector no encontrase NUNCA y pasase
    // siempre: verde y muerto. La misma costura que se cosio en
    // CLAVES_DE_PROCEDENCIA, y por el mismo motivo.
    expect(NOMBRES_DEL_CONTRATO.size).toBeGreaterThan(2);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// EL GUARD VERIFICANDO AL GUARD
// ══════════════════════════════════════════════════════════════════════════
//
// Un guard en verde no prueba que mire. Estos tests le dan a cada guard un caso
// que TIENE que estar roto, y exigen que lo detecte. Si alguno dejara de
// detectar, el fallo sale aqui y no tres meses despues, cuando un contrato
// cambie y nadie se entere.

describe('el guard de procedencia ve los dos fallos', () => {
  it('detecta que el .gen se inventa una procedencia que el contrato no tiene', () => {
    // Este es el fallo que la asercion original no podia ver: comparaba
    // undefined con undefined, asi que un .gen con una procedencia INVENTADA
    // pasaba en verde.
    const problemas = problemasDeProcedencia({}, { generatedFrom: 'inventado.js' });

    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toMatch(/inventado/);
  });

  it('detecta que el .gen se calla una procedencia que el contrato declara', () => {
    // Y el simetrico: el contrato dice de donde sale el .gen y el .gen no lo
    // dice. Sin esto, nadie sabe de donde viene el fichero que lee la web.
    const problemas = problemasDeProcedencia({ generatedFrom: 'FXSlot_Factory.cpp' }, {});

    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toMatch(/FXSlot_Factory/);
  });

  it('detecta que el .gen se equivoca al copiar la procedencia', () => {
    // El caso que no cubrian los dos anteriores: los dos lados la declaran,
    // pero distinta. Un `toBe` entre los dos lados lo ve; compararlos solo
    // contra "esta o no esta" no.
    const problemas = problemasDeProcedencia(
      { generatedFrom: 'la-fabrica.cpp' },
      { generatedFrom: 'otro-fichero.cpp' }
    );

    expect(problemas).toHaveLength(1);
  });

  it('no inventa problemas cuando los dos lados coinciden', () => {
    // El contrapeso: una funcion que siempre dice "problema" tambien es un
    // guard que no sirve. Tiene que estar callada cuando de verdad cuadra.
    expect(problemasDeProcedencia({}, {})).toEqual([]);
    expect(problemasDeProcedencia({ generatedFrom: 'a.cpp' }, { generatedFrom: 'a.cpp' })).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════════════

describe('el --check del generador detecta un .gen desincronizado', () => {
  /**
   * Monta un arbol de dos repos en un temporal, con el .gen DELIBERADAMENTE
   * desincronizado, y devuelve la raiz.
   *
   * Por que un temporal y no el arbol de verdad: porque el test tiene que
   * comprobar que el `--check` SALTA cuando el .gen esta mal. Con el .gen real,
   * que esta bien, el check pasaria tanto si mira como si no mira: en verde y
   * sin decir nada. Aqui se le da algo roto a proposito y se le exige que lo
   * note.
   *
   * No se toca el repo: el generador se copia, el contrato se copia y el .gen
   * se escribe desde el bueno mas un cambio. Nada fuera del temporal se mueve.
   */
  function arbolConGenDesincronizado () {
    const raiz = mkdtempSync(join(tmpdir(), 'fx-contract-check-'));

    // El generador resuelve el contrato como HERMANO:
    //   resolve(repoRoot, '..', 'ABDSharedAssets', 'contracts', 'fx-effects.json')
    // asi que la estructura de directorios es parte del contrato con el.
    mkdirSync(join(raiz, 'ABDEep', 'scripts'), { recursive: true });
    mkdirSync(join(raiz, 'ABDSharedAssets', 'contracts'), { recursive: true });
    mkdirSync(join(raiz, 'ABDEep', 'WebUI', 'js'), { recursive: true });

    copyFileSync(GENERATOR, join(raiz, 'ABDEep', 'scripts', 'generate_fx_contract.mjs'));
    copyFileSync(CONTRACT, join(raiz, 'ABDSharedAssets', 'contracts', 'fx-effects.json'));

    // El .gen bueno + un byte. Suficiente para que no case, sin tocar el
    // contenido que el generador lee.
    const bueno = readFileSync(GENERATED, 'utf8');
    writeFileSync(join(raiz, 'ABDEep', 'WebUI', 'js', 'fx_contract.gen.js'), bueno + '\n');

    return raiz;
  }

  it('sale con 1 y dice STALE cuando el .gen no coincide', () => {
    const raiz = arbolConGenDesincronizado();

    try {
      const r = spawnSync(process.execPath, ['scripts/generate_fx_contract.mjs', '--check'], {
        cwd: join(raiz, 'ABDEep'),
        encoding: 'utf8'
      });

      expect(r.status, 'el --check tendria que salir con 1').toBe(1);
      expect(r.stderr).toMatch(/STALE/);
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  });

  it('y un .gen con CRLF se detecta como lo que es, no como STALE generico', () => {
    // El caso que no existia y que Justamente es el de Windows. Un checkout
    // con core.autocrlf=true deja el .gen con CRLF, y el comparador es de
    // cadena completa, asi que falla. Lo grave no era que fallara: era que el
    // mensaje decia "el contrato cambio, o alguien edito el .gen a mano", las
    // dos cosas mentira, y encolaba a regenerar.
    //
    // Y REGENERAR NO LO ARREGLA, que es lo que lo hacia permanente: el parser
    // de JavaScript normaliza los saltos de linea del fuente, el .gen vuelve
    // a salir con LF, el checkout lo vuelve a convertir a CRLF, y aqui
    // estamos otra vez. Por eso el mensaje tiene que decir otra cosa.
    const raiz = mkdtempSync(join(tmpdir(), 'fx-contract-crlf-'));

    try {
      mkdirSync(join(raiz, 'ABDEep', 'scripts'), { recursive: true });
      mkdirSync(join(raiz, 'ABDSharedAssets', 'contracts'), { recursive: true });
      mkdirSync(join(raiz, 'ABDEep', 'WebUI', 'js'), { recursive: true });

      copyFileSync(GENERATOR, join(raiz, 'ABDEep', 'scripts', 'generate_fx_contract.mjs'));
      copyFileSync(CONTRACT, join(raiz, 'ABDSharedAssets', 'contracts', 'fx-effects.json'));
      // El mismo contenido, un byte por linea distinto.
      writeFileSync(
        join(raiz, 'ABDEep', 'WebUI', 'js', 'fx_contract.gen.js'),
        readFileSync(GENERATED, 'utf8').replace(/\n/g, '\r\n'),
        'utf8'
      );

      const r = spawnSync(process.execPath, ['scripts/generate_fx_contract.mjs', '--check'], {
        cwd: join(raiz, 'ABDEep'),
        encoding: 'utf8'
      });

      expect(r.status, 'el --check tendria que salir con 1').toBe(1);
      // Y tiene que decir QUE es. Si vuelve al mensaje generico, alguien vuelve
      // a perder una tarde persiguiendo un cambio de contrato que no existe.
      expect(r.stderr).toMatch(/FIN DE LINEA/);
      expect(r.stderr).not.toMatch(/alguien edito el \.gen a mano/);
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  });

  it('y sale con 0 cuando el .gen SI coincide', () => {
    // El contrapeso del anterior: si el check fallara siempre, el primer test
    // pasaria y el guard no valdria nada. Tiene que ser capaz de decir que si.
    const raiz = mkdtempSync(join(tmpdir(), 'fx-contract-ok-'));

    try {
      mkdirSync(join(raiz, 'ABDEep', 'scripts'), { recursive: true });
      mkdirSync(join(raiz, 'ABDSharedAssets', 'contracts'), { recursive: true });
      mkdirSync(join(raiz, 'ABDEep', 'WebUI', 'js'), { recursive: true });

      copyFileSync(GENERATOR, join(raiz, 'ABDEep', 'scripts', 'generate_fx_contract.mjs'));
      copyFileSync(CONTRACT, join(raiz, 'ABDSharedAssets', 'contracts', 'fx-effects.json'));
      copyFileSync(GENERATED, join(raiz, 'ABDEep', 'WebUI', 'js', 'fx_contract.gen.js'));

      const r = spawnSync(process.execPath, ['scripts/generate_fx_contract.mjs', '--check'], {
        cwd: join(raiz, 'ABDEep'),
        encoding: 'utf8'
      });

      expect(r.status, 'el --check tendria que salir con 0').toBe(0);
      expect(r.stdout).toMatch(/al dia/);
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  });

  it('el --check NO ESCRIBE el .gen commiteado, ni siquiera con el mismo contenido', () => {
    // ESTE ASERTO NECESITA LA FECHA, NO SOLO EL TEXTO, Y POR ESO.
    //
    // Comparar el contenido antes y despues parece suficiente y no lo es: si el
    // `--check` reescribe el `.gen` con el contenido CORRECTO —que es
    // exactamente lo que haria una "optimizacion" del tipo "si no cuadra, lo
    // arreglo y aviso"—, el texto resultante es IDENTICO al de antes y la
    // comparacion pasa en verde. Se comprobo: esa mutacion deja este test
    // verde, y es justo la que hay que cazar.
    //
    // El sintoma que persigue es el mas dificil de ver de todo este modulo: un
    // guard que se ARREGLA SOLO. El `.gen` queda al dia, el `--check` sale con
    // el codigo que le toca, y el unico rastro es un fichero commiteado que se
    // toco sin motivo. Nada rojo, nada que leer.
    //
    // Por eso se mira `mtimeMs`, que cambia con CUALQUIER escritura, y `size`,
    // que es el segundo testigo por si el sistema de ficheros no resuelve bien
    // el reloj. Se comparan los dos contra si mismos despues del `--check`.
    const antesTexto = readFileSync(GENERATED, 'utf8');
    const antesStat = statSync(GENERATED);

    const r = spawnSync(process.execPath, [GENERATOR, '--check'], {
      cwd: repoRoot,
      encoding: 'utf8'
    });

    expect(r.status).toBe(0);

    const despuesStat = statSync(GENERATED);

    expect(readFileSync(GENERATED, 'utf8'), 'el --check ha MODIFICADO el contenido del .gen commiteado').toBe(antesTexto);
    expect(despuesStat.mtimeMs, 'el --check ha REESCRITO el .gen (mtime cambiado)').toBe(antesStat.mtimeMs);
    expect(despuesStat.size, 'el --check ha reescrito el .gen con otro tamano').toBe(antesStat.size);
  });
});

// ══════════════════════════════════════════════════════════════════════════

describe('CI corre este check de verdad, no solo el test', () => {
  it('el workflow del contrato existe', () => {
    // Sin esto, el unico guard es este fichero de test, que no corre en ningun
    // sitio salvo que alguien lo lance a mano. El dia que este test pasara por
    // alto en un CI, el contrato podria desincronizarse sin que nadie se entere
    // hasta que un usuario mire el desplegable y vea mal las etiquetas.
    expect(existsSync(WORKFLOW), `no esta el workflow ${WORKFLOW}`).toBe(true);
  });

  it('el workflow invoca el generador con --check', () => {
    const yml = readFileSync(WORKFLOW, 'utf8');

    // Se busca la invocacion real, no la palabra `--check` suelta: un workflow
    // que menciona el check en un comentario y no lo corre pasaria con un
    // `toContain('--check')`, que es justo el tipo de asercion de forma que
    // este fichero acaba de dejar de usar.
    const invoca = /run:.*generate_fx_contract\.mjs[^\n]*--check/.test(yml);

    expect(invoca, 'el workflow no corre `generate_fx_contract.mjs --check` en ningun paso').toBe(true);
  });

  it('el workflow se dispara en push a main, no solo a mano', () => {
    const yml = readFileSync(WORKFLOW, 'utf8');

    // Solo `workflow_dispatch` seria un guard que nadie tira. Tiene que
    // dispararse solo cuando llega un commit a main.
    const seccionPush = /push:[\s\S]*?branches:[\s\S]*?main/.test(yml);

    expect(seccionPush, 'el workflow no se dispara solo en push a main').toBe(true);
  });

  it('el workflow saca el contrato del repo HERMANO', () => {
    const yml = readFileSync(WORKFLOW, 'utf8');

    // El contrato vive en ABDSharedAssets. Un checkout que no lo traiga hace
    // que el generador salga con su codigo 2 ("no se encuentra el contrato"), que
    // es un fallo de infrastructure y no una prueba de nada.
    expect(yml).toMatch(/repository:\s*ajabadia\/ABDSharedAssets/);
  });

  it('el workflow corre ESTE script, no otro generador', () => {
    // Traba el ultimo cable flojo: que el job existente sea el de este script.
    // Si alguien renombra `generate_fx_contract.mjs`, el paso del workflow se
    // quedaapuntando a un fichero que no existe y el job falla por infraestructura,
    // que es un fallo difícil de leer como "el nombre cambio".
    const yml = readFileSync(WORKFLOW, 'utf8');

    // El nombre sale del propio generador, de como se documenta a si mismo, y
    // no de una constante escrita aqui al lado: si las dos fuentes se
    // separan, este aserto compara el nombre viejo con el viejo y no lo nota.
    const nombre = readFileSync(GENERATOR, 'utf8').match(/scripts\/generate_[a-z_]+\.mjs/);

    expect(nombre, 'el generador ya no se documenta con su propia ruta').not.toBeNull();
    expect(yml).toContain(nombre[0]);
  });
});

// ══════════════════════════════════════════════════════════════════════════

describe('el contrato esta alineado con FXSlot_Factory.cpp', () => {
  const factory = readFileSync(FACTORY, 'utf8');

  /**
   * Lee la fabrica y devuelve `id -> clase construida`.
   *
   * NO se puede con un regex suelto, y el intento fallo de la forma mas
   * traicionera posible: la fabrica escribe
   *
   *     case 11: // Flanger
   *         return std::make_unique<FXFlanger>();
   *
   *     case 23: // flangVerb
   *     case 24: // chorusVerb
   *     case 25: // delayVerb
   *         return std::make_unique<FXHybridReverb>(newType);
   *
   * o sea, hay un comentario entre `:` y el `return`, y hay `case` en cascada
   * donde UN solo return sirve a varias etiquetas. Un `/case (\d+):\s*return/`
   * encuentra 47 de 56 ids y deja huecos en 10, 11, 13, 14, 15, 17, 23, 24 y 25
   * — ids que la fabrica construye perfectamente. Peor: como la asercion era
   * "todo lo que construye la fabrica esta en el contrato", un subconjunto la
   * cumple igual y el test pasaba en verde sin comprobar casi nada.
   *
   * Asi que se recorre linea a linea: cada `case N:` se apila, y el siguiente
   * `make_unique<T>` se asigna a TODAS las etiquetas apiladas (que es lo que
   * hace el compilador con la cascada).
   */
  function parseFactory (source) {
    const built = new Map();
    let pending = [];

    for (const line of source.split(/\r?\n/)) {
      const caseMatch = line.match(/^\s*case\s+(\d+)\s*:/);

      if (caseMatch) pending.push(Number(caseMatch[1]));

      // Un `default` cierra la cascada sin construir nada (Bypass).
      if (/^\s*default\s*:/.test(line)) {
        pending = [];
        continue;
      }

      // OJO: no hay `continue` despues del `case`, porque la fabrica escribe las
      // primeras diez en una sola linea — `case 1:  return
      // std::make_unique<FXSimpleReverb>(1);` — y con el `continue` se perdian
      // justo esos, que son los reverbs que este test va a mirar.
      const ctor = line.match(/std::make_unique<\s*(\w+)/);

      if (ctor && pending.length > 0) {
        for (const id of pending) built.set(id, ctor[1]);
        pending = [];
      }
    }

    return built;
  }

  const built = parseFactory(factory);

  it('la fabrica construye exactamente los ids 1..56', () => {
    // El id 0 (Bypass) no pasa por la fabrica: lo resuelve `FXSlot` antes, y la
    // fabrica cae en `default: return nullptr`.
    const ids = [...built.keys()].sort((a, b) => a - b);

    expect(ids).toEqual(Array.from({ length: 56 }, (_, i) => i + 1));
  });

  it('los ids que construye la fabrica son ids que el contrato conoce', () => {
    const known = new Set(effects.map((e) => e.id));
    const orphans = [...built.keys()].filter((id) => ! known.has(id));

    expect(orphans).toEqual([]);
  });

  it('el contrato declara la MISMA clase que construye la fabrica', () => {
    // El contrato llama "engine" a lo que la fabrica construye con prefijo FX.
    // Es la union mas fuerte de las dos: si alguien cambia el id 39 a otro
    // efecto en la fabrica, el nombre de aqui no cuadra y salta.
    const mismatches = [];

    for (const [id, className] of built) {
      const engine = generated.byId[id]?.engine;

      if (engine !== className.replace(/^FX/, '')) {
        mismatches.push(`${id}: fabrica=${className} contrato=${engine}`);
      }
    }

    expect(mismatches).toEqual([]);
  });

  it('los diez reverbs salen en los ids que la fabrica construye', () => {
    // El caso que ya se rompio una vez: la lista de la web ponia los diez
    // reverbs en 1..10, pero la fabrica construye el 22 y el 26-28.
    const factoryReverbs = [...built.entries()]
      .filter(([, className]) => className === 'FXSimpleReverb')
      .map(([id]) => id)
      .sort((a, b) => a - b);

    expect(factoryReverbs).toEqual([1, 2, 3, 4, 5, 6, 22, 26, 27, 28]);

    // Y el contrato los declara en ESOS ids, con la variante correcta.
    for (const id of factoryReverbs) {
      const entry = generated.byId[id];

      expect(entry, `el contrato no conoce el reverb ${id}`).toBeDefined();
      expect(entry.engine).toBe('SimpleReverb');
      expect(entry.variant).toBe(id);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════

describe('effects_data.js deriva del contrato y no los escribe', () => {
  const source = readFileSync(EFFECTS_DATA, 'utf8');

  it('no contiene una lista de nombres de efecto escrita a mano', () => {
    // ESTE GUARD ERA DE FORMA Y SE ESCAPABAN TRES COSAS. Buscaba
    //   source.match(/\[[^\]]{200,}\]/s)
    // o sea, un ARRAY de mas de 200 caracteres. Se pasaban por debajo, sin
    // ruido: un objeto `{0: 'Hall', 1: 'Plate'}` (la refactorizacion mas
    // natural que puede hacer alguien que odie los indices sueltos, y que no
    // tiene ni un array), y una cadena con `.split(',')`, y un array corto.
    //
    // Ahora lo mira `detectarListaAMano`, que pregunta por los NOMBRES
    // CONCRETOS del contrato en vez de por la forma del codigo. Se verifica
    // al final del fichero.
    const { esLista, motivos } = detectarListaAMano(source);

    expect(esLista, `effects_data.js ha vuelto a escribir la lista de nombres:\n  ${motivos.join('\n  ')}`).toBe(false);
  });

  it('no menciona los nombres que solo existian en la lista vieja', () => {
    // Varios de estos eran nombres inventados para la lista y no coinciden con
    // el contrato. Si aparecen aqui, alguien ha pegado la lista otra vez.
    for (const stale of ['HallReverb', 'Plate Reverb', 'Gated Reverb', 'tcDeepVerb']) {
      expect(source, `effects_data.js menciona "${stale}", que viene de la lista vieja`).not.toContain(stale);
    }
  });

  it('expone la lista que se espera, leida del contrato', () => {
    // La decision va en `nombresExpuestosPor`, que recibe el texto: asi al
    // final del fichero se le puede dar un `effects_data.js` ROTO y exigir que
    // lo note. Aqui solo se afirma sobre el bueno.
    const { nombres, monta, error } = nombresExpuestosPor(source);

    expect(monta, `effects_data.js no monta con el contrato delante: ${error}`).toBe(true);
    expect(nombres).toEqual(generated.names);
    expect(nombres[0]).toBe('Bypass');
    expect(nombres[1]).toBe('Hall');
    expect(nombres[22]).toBe('Deep Verb');
    expect(nombres[26]).toBe('Chamber');
  });

  it('fxTypeName devuelve undefined para un id que no existe, y el nombre si', () => {
    const context = { window: null, self: null };
    context.window = context;
    context.self = context;
    vm.createContext(context);

    vm.runInContext(readFileSync(GENERATED, 'utf8'), context, { filename: 'fx_contract.gen.js' });
    vm.runInContext(source, context, { filename: 'effects_data.js' });

    expect(context.fxTypeName(6)).toBe('Reverse');
    expect(context.fxTypeName(999)).toBeUndefined();
  });
});

// ══════════════════════════════════════════════════════════════════════════

describe('index.html carga el contrato antes de derivar de el', () => {
  it('el script del .gen aparece antes que effects_data.js', () => {
    const html = readFileSync(INDEX_HTML, 'utf8');

    const gen = html.indexOf('js/fx_contract.gen.js');
    const data = html.indexOf('js/effects_data.js');

    expect(gen).toBeGreaterThan(-1);
    expect(data).toBeGreaterThan(-1);
    // Si el orden se invierte, effects_data.js no encuentra el contrato y la
    // lista se queda sin definir, que es el fallo silencioso que se quiere evitar.
    expect(gen).toBeLessThan(data);
  });
});

// ══════════════════════════════════════════════════════════════════════════

describe('el desplegable del rack deriva del contrato', () => {
  /**
   * Cuarto sitio que tiene que saber el MISMO numero de efecto que la fabrica.
   *
   * Este era el que quedaba fuera: `fx_modal_templates.js` tenia su PROPIA
   * cadena de `<option>` y su propio objeto de etiquetas, los dos escritos a
   * mano, y los dos desplazados. Ponia "Ambience" en el id 1 (que la fabrica
   * construye como Hall), "tcDeepVerb" en el 2 (Plate), "Delay" en el 22 (Deep
   * Verb) y "DecimatorDelay" en el 26 (Chamber). Ademas ofrecia los ids 57-63,
   * que la fabrica NO construye: se podian elegir y la ranura se quedaba muda.
   *
   * Que ya no quede ninguna lista escrita a mano en ese fichero es la garantia
   * de que esto no se puede volver a desalinear.
   */
  const TEMPLATES = resolve(repoRoot, 'WebUI', 'js', 'components', 'fx_modal_templates.js');

  /** Monta el componente con el contrato cargado, como hace la pagina. */
  function loadTemplates (withContract = true) {
    const context = { window: null, self: null, console: { warn () {} } };
    context.window = context;
    context.self = context;
    vm.createContext(context);

    if (withContract) {
      vm.runInContext(readFileSync(GENERATED, 'utf8'), context, { filename: 'fx_contract.gen.js' });
    }

    vm.runInContext(readFileSync(TEMPLATES, 'utf8'), context, { filename: 'fx_modal_templates.js' });

    return context;
  }

  /** Los pares `[id, etiqueta]` que salen del desplegable montado. */
  function optionsOf (context) {
    return [...context.FX_TYPE_OPTIONS.matchAll(/<option value="(\d+)">([^<]*)<\/option>/g)]
      .map((m) => [Number(m[1]), m[2]]);
  }

  it('no tiene ninguna lista de nombres escrita a mano', () => {
    const source = readFileSync(TEMPLATES, 'utf8');

    // Estas cuatro son etiquetas que solo existian en la lista vieja del
    // desplegable. Se quedan como una comprobacion MAS, no como la unica: son
    // cuatro literales concretos y no cubren una lista nueva escrita con otros
    // nombres, que es justo el caso que se quiere cazar.
    for (const stale of ['HallReverb', 'Plate Reverb', 'Gated Reverb', 'tcDeepVerb']) {
      expect(source, `fx_modal_templates.js menciona "${stale}", que viene de la lista vieja`).not.toContain(stale);
    }

    // Y ahora la que de verdad protege: nombres del contrato como literales, en
    // cualquier forma. El guard viejo se quedaba en `toContain('FxEffectsContract')`,
    // que lo pasa un fichero que menciona la palabra en un comentario y sigue
    // con la lista escrita a mano.
    const { esLista, motivos } = detectarListaAMano(source);

    expect(esLista, `fx_modal_templates.js ha vuelto a escribir la lista de nombres:\n  ${motivos.join('\n  ')}`).toBe(false);
  });

  it('cada opcion lleva el nombre que tiene el contrato', () => {
    const source = readFileSync(TEMPLATES, 'utf8');
    const { opciones, monta, error } = opcionesDe(source);

    // Montar y no montar no son lo mismo: sin esta linea, un desplegable que
    // reventara al cargarse llegaria aqui con `opciones` vacio y pasaria.
    expect(monta, `fx_modal_templates.js no monta con el contrato delante: ${error}`).toBe(true);

    const mismatches = opciones
      .filter(([id, label]) => generated.byId[id]?.name !== label)
      .map(([id, label]) => `${id}: desplegable=${label} contrato=${generated.byId[id]?.name}`);

    expect(mismatches).toEqual([]);
  });

  it('ofrece exactamente los ids del contrato, ni uno mas ni uno menos', () => {
    const context = loadTemplates();

    const ids = optionsOf(context).map(([id]) => id);

    // Los 57 del contrato, ordenados y SIN repetir. La lista vieja tinha 64
    // opciones: los ids 57-63 no los construye la fabrica, y elegirlos dejaba la
    // ranura sin efecto sin dar ningun error.
    expect(ids).toEqual(effects.map((e) => e.id).sort((a, b) => a - b));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('los diez reverbs salen en los ids que construye la fabrica', () => {
    const context = loadTemplates();
    const options = Object.fromEntries(optionsOf(context));

    // El caso que se rompio dos veces: el desplegable ponia los reverbs en
    // 1..10 y luego en otra lista distinta, y la fabrica construye el 22 y el
    // 26-28. Este aserto no deja que vuelvan a deslizarse.
    expect(options[1]).toBe('Hall');
    expect(options[2]).toBe('Plate');
    expect(options[3]).toBe('Rich Plate');
    expect(options[4]).toBe('Ambience');
    expect(options[5]).toBe('Gated');
    expect(options[6]).toBe('Reverse');
    expect(options[22]).toBe('Deep Verb');
    expect(options[26]).toBe('Chamber');
    expect(options[27]).toBe('Room');
    expect(options[28]).toBe('Vintage');
  });

  it('cada id cae en un solo grupo, y los grupos no se solapan', () => {
    const context = loadTemplates();

    const groups = [...context.FX_TYPE_OPTIONS.matchAll(/<optgroup label="[^"]*">(.*?)<\/optgroup>/g)]
      .map((m) => [...m[1].matchAll(/value="(\d+)"/g)].map((v) => Number(v[1])));

    expect(groups.length).toBe(2);
    expect(groups[0]).toEqual(effects.map((e) => e.id).filter((id) => id <= 35).sort((a, b) => a - b));
    expect(groups[1]).toEqual(effects.map((e) => e.id).filter((id) => id > 35).sort((a, b) => a - b));
    // El bug que se metio al arreglar esto: el segundo grupo no tenia `from`, se
    // comia los ids del primero y el desplegable salia con 93 opciones y duplicadas.
    expect(groups[0].filter((id) => groups[1].includes(id))).toEqual([]);
  });

  it('sin contrato avisa y deja el desplegable en Bypass, no en una lista vieja', () => {
    const context = loadTemplates(false);

    expect(optionsOf(context)).toEqual([[0, 'Bypass']]);
    // La plantilla tiene que seguir montando: cuatro ranuras, un desplegable
    // cada una. Un desplegable vacio se ve; una lista vieja equivocada no.
    expect((context.FX_MODAL_TEMPLATE.match(/fx-type-select/g) || []).length).toBe(4);
  });

  it('las etiquetas cortas del rack tambien vienen del contrato', () => {
    const context = loadTemplates();

    expect(context.FX_TYPE_LABELS[1]).toBe('Hall');
    expect(context.FX_TYPE_LABELS[22]).toBe('Deep Verb');
    expect(context.FX_TYPE_LABELS[26]).toBe('Chamber');
    expect(Object.keys(context.FX_TYPE_LABELS).length).toBe(effects.length);
  });

  it('la plantilla no pone un nombre de efecto inventado por defecto', () => {
    const context = loadTemplates();

    // Antes la ranura 1 salia con "Ambience" y la 2 con "VintageRoom" escritos en
    // el HTML, o sea contradiciendo el desplegable que tienen justo encima hasta
    // que el usuario tocaba algo. Ahora arrancan en Bypass, que es la verdad.
    expect(context.FX_MODAL_TEMPLATE).not.toContain('Ambience</div>');
    expect(context.FX_MODAL_TEMPLATE).not.toContain('VintageRoom</div>');
  });
});

// ══════════════════════════════════════════════════════════════════════════
// LOS GUARDS DE LOS DOS FICHEROS, VERIFICANDOSE A SI MISMOS
// ══════════════════════════════════════════════════════════════════════════
//
// Arriba, `detectarListaAMano` se verifica a si misma: casos que TIENEN que
// estar rotos. Eso demuestra que el detector mira.
//
// Lo que faltaba era la otra mitad: que los guards que usan el detector, y las
// comparaciones que hacen montando el fichero en una VM, tambien se puedan ver
// rotas. Un guard que compara `context.FX_TYPE_NAMES` con el contrato pasa en
// verde igual si el fichero publica un array vacio, si el desplegable deja de
// montar, o si la expresion se typo y devuelve `undefined`. aqui se les da
// exactamente esos casos.
//
// La regla que se repite en cada test: si una comparacion de un guard dejara de
// mirar, ESTE bloque tiene que ponerse rojo. Por eso las comprobaciones repiten
// la comparacion literal del guard en vez de llamar al guard entero.

describe('los guards de effects_data.js y del desplegable, con un fichero roto delante', () => {
  const GOOD_EFFECTS = readFileSync(EFFECTS_DATA, 'utf8');
  const GOOD_TEMPLATES = readFileSync(resolve(repoRoot, 'WebUI', 'js', 'components', 'fx_modal_templates.js'), 'utf8');

  /** La linea REAL por la que el fichero bueno deriva del contrato. */
  const DERIVA_EFFECTS = 'const names = Object.freeze(contract.names.slice());';
  const ANCLA_TEMPLATES = "let html = '';";

  // Las dos piezas de verdad, tal cual, para partir de ellas y romperlas.
  const CON_LISTA_A_MANO = GOOD_EFFECTS.replace(
    DERIVA_EFFECTS,
    "const names = ['Bypass', 'Hall', 'Plate', 'Reverse'];"
  );
  const CON_ETIQUETA_MOVIDA = GOOD_TEMPLATES.replace(
    ANCLA_TEMPLATES,
    ANCLA_TEMPLATES + "\n        if (effects.length) { return effects.map((e) => "
    + "'<option value=\"' + e.id + '\">' + (e.id === 1 ? 'Ambience' : e.name) + '</option>').join(''); }"
  );
  const CON_ID_DE_MAS = GOOD_TEMPLATES.replace(
    ANCLA_TEMPLATES,
    ANCLA_TEMPLATES + "\n        if (effects.length) { return effects.map((e) => "
    + "'<option value=\"' + e.id + '\">' + e.name + '</option>').join('') "
    + "+ '<option value=\"ID_FANTASMA\">Plata inventada</option>'; }"
  );

  it('las tres mutaciones se aplican de verdad, o este bloque no prueba nada', () => {
    // La costura de todo lo de abajo. Si el fichero bueno cambia y estas
    // cadenas ya no casan, el `replace` no hace nada y el source roto sale
    // IDENTICO al bueno: el guard de mas abajo pasaria porque no hay nada roto,
    // y el bloque entero daria verde sin haber comprobado nada.
    expect(GOOD_EFFECTS).toContain(DERIVA_EFFECTS);
    expect(GOOD_TEMPLATES).toContain(ANCLA_TEMPLATES);
    expect(CON_LISTA_A_MANO).not.toBe(GOOD_EFFECTS);
    expect(CON_ETIQUETA_MOVIDA).not.toBe(GOOD_TEMPLATES);
    expect(CON_ID_DE_MAS).not.toBe(GOOD_TEMPLATES);
  });

  describe('effects_data.js', () => {
    it('con la lista a mano, el guard de nombres lo nota', () => {
      const { nombres, monta } = nombresExpuestosPor(CON_LISTA_A_MANO);

      // La misma comparacion que hace el guard de arriba.
      expect(monta).toBe(true);
      expect(nombres).not.toEqual(generated.names);
      expect(detectarListaAMano(CON_LISTA_A_MANO).esLista).toBe(true);
    });

    it('y con el fichero bueno, el mismo guard pasa', () => {
      // El contrapeso: un guard que dijera "problema" siempre tampoco seria un
      // guard. Este par es el que hace que el test de arriba signifique algo.
      const { nombres, monta } = nombresExpuestosPor(GOOD_EFFECTS);

      expect(monta).toBe(true);
      expect(nombres).toEqual(generated.names);
      expect(detectarListaAMano(GOOD_EFFECTS).esLista).toBe(false);
    });

    it('un fichero que no monta no puede pasar por publicando cualquier cosa', () => {
      // El `monta` distingue "no se puede cargar" de "carga y no coincide". Sin
      // el, un `effects_data.js` reventado daria `undefined`, y comparar
      // `undefined` con la lista daria error, no un fallo limpio.
      expect(nombresExpuestosPor('throw new Error("reventado");').monta).toBe(false);
    });

    it('un fichero que carga pero no publica la lista tampoco', () => {
      // Monta sin reventar y sin publicar nada: el caso silencioso.
      expect(nombresExpuestosPor('const x = 1;').monta).toBe(false);
    });

    it('el contrato entero pasa de largo al resultado que el guard compara', () => {
      // Si `generated.names` se vaciara, `toEqual` compararia lista vacia con
      // lista vacia y el guard pasaria sin mirar.
      expect(nombresExpuestosPor(GOOD_EFFECTS).nombres).toHaveLength(effects.length);
      expect(generated.names).toHaveLength(effects.length);
    });
  });

  describe('fx_modal_templates.js', () => {
    it('una etiqueta descolocada la nota el guard de nombres', () => {
      // El bug historico exacto: id 1 ponia "Ambience" cuando la fabrica
      // construye Hall. 57 opciones, todas las que deben, y una mal.
      const { opciones, monta } = opcionesDe(CON_ETIQUETA_MOVIDA);
      const fuera = opciones.filter(([id, label]) => generated.byId[id]?.name !== label);

      expect(monta).toBe(true);
      expect(opciones).toHaveLength(effects.length);
      expect(fuera.map(([id, label]) => `${id}: ${label}`)).toEqual(['1: Ambience']);
    });

    it('un id que el contrato no tiene lo nota el guard de ids', () => {
      // El id se calcula como uno MAS ALLA del maximo del contrato, no como un
      // numero escrito a mano. El 57 que se puso primero SI existe en el
      // contrato --los ids van de 0 a 60--, asi que el guard no lo veia, el
      // numero de opciones seguia cuadrando y el test se ponia rojo por un
      // motivo equivocado: por el `.not.toEqual`, no por la comprobacion del id.
      const fantasma = Math.max(...effects.map((e) => e.id)) + 1;
      const { opciones, monta } = opcionesDe(CON_ID_DE_MAS.replace('ID_FANTASMA', String(fantasma)));
      const ids = opciones.map(([id]) => id);

      expect(monta).toBe(true);
      expect(ids).not.toEqual(effects.map((e) => e.id).sort((a, b) => a - b));
      expect(ids.filter((id) => !generated.byId[id])).toEqual([fantasma]);
    });

    it('y con el desplegable bueno, los mismos dos guards pasan', () => {
      const { opciones, monta } = opcionesDe(GOOD_TEMPLATES);
      const ids = opciones.map(([id]) => id);

      expect(monta).toBe(true);
      expect(opciones.filter(([id, label]) => generated.byId[id]?.name !== label)).toEqual([]);
      expect(ids).toEqual(effects.map((e) => e.id).sort((a, b) => a - b));
    });

    it('un desplegable que no monta sale por el `monta`, no por el `opciones`', () => {
      // Un desplegable roto que dejara `FX_TYPE_OPTIONS` sin definir daria
      // `opciones: []`, y `expect([]).toEqual([])` en el guard de ids seria
      // verde. Por eso `monta` va por delante.
      expect(opcionesDe('throw new Error("reventado");').monta).toBe(false);
      expect(opcionesDe('const x = 1;').opciones).toEqual([]);
    });

    it('el guard de ids no puede pasar porque las dos listas se hayan vaciado', () => {
      // Las dos comparaciones del guard, con las dos listas no vacias delante.
      // Si `effects` o el desplegable se quedaran vacios por un cambio de
      // contrato, `[]` compararia con `[]` y el guard no miraria nada.
      const { opciones } = opcionesDe(GOOD_TEMPLATES);

      expect(opciones).toHaveLength(effects.length);
      expect(effects.length).toBeGreaterThan(2);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════
// EL .GEN SOBREVIVE A UN CHECKOUT DE WINDOWS
// ══════════════════════════════════════════════════════════════════════════
//
// El `.gen` es lo unico de esta cadena que se compara como DATO y no como
// CODIGO. `generate_fx_contract.mjs` lee el fichero commiteado y lo compara
// con una cadena, caracter a caracter. El resto de la cadena --el contrato, el
// generador-- se lee de otra manera, y el parser de JavaScript normaliza los
// saltos de linea del fuente, asi que ahi el CRLF no llega a existir.
//
// Consecuencia: un checkout en Windows con core.autocrlf=true deja el `.gen`
// con CRLF, la comparacion falla, y el fallo es de UNA SOLA PLATAFORMA. El
// workflow lo ejecutaba en ubuntu, donde no puede pasar, asi que el unico
// sitio donde se veía era la maquina de un desarrollador, con un mensaje que
// decia que el contrato habia cambiado.
//
// Estos tests son la version determinista: corren en todas partes, y miran el
// `.gitattributes`, que es la regla que lo arregla. El workflow
// `fx-contract-generation.yml` hace ademas la comprobacion cruzada, con
// core.autocrlf puesto a mano en las dos plataformas.

describe('el .gen esta protegido de un checkout de Windows', () => {
  const GITATTRIBUTES = resolve(repoRoot, '.gitattributes');
  const GITATTRIBUTES_HERMANO = resolve(suiteRoot, 'ABDSharedAssets', '.gitattributes');

  it('este repo fija el .gen a LF en checkout', () => {
    const reglas = reglasPara('WebUI/js/fx_contract.gen.js', readFileSync(GITATTRIBUTES, 'utf8'));

    expect(reglas, 'no hay ninguna regla que hable del .gen').not.toEqual([]);
    expect(fijaLf(reglas)).toBe(true);
  });

  it('y fija tambien el generador, para que el blob sea el mismo en todas partes', () => {
    const reglas = reglasPara('scripts/generate_fx_contract.mjs', readFileSync(GITATTRIBUTES, 'utf8'));

    expect(reglas).not.toEqual([]);
    expect(fijaLf(reglas)).toBe(true);
  });

  it('el hermano fija el contrato, que es lo que se hashea', () => {
    // El generador hashea los BYTES del contrato. Si el hermano no lo fijara,
    // el hash seria distinto en cada plataforma y el `.gen` no podria ser el
    // mismo fichero en las dos. ABDSharedAssets lo fija con `*.json text
    // eol=lf`, asi que aqui se comprueba esa regla y no una suelta.
    //
    // El `existsSync` va antes porque este fichero ya necesita el hermano para
    // el contrato, pero sin el fallaba con un ENOENT del `.gitattributes`
    // en vez de decir que lo que falta es un checkout. Un error que no dice que
    // hacer es un error que se pierde.
    expect(
      existsSync(GITATTRIBUTES_HERMANO),
      'no esta ABDSharedAssets/.gitattributes: este test lee el contrato del hermano, ' +
      'hace falta el checkout de ABDSharedAssets un nivel por encima (es lo que hace el workflow)'
    ).toBe(true);

    const reglas = reglasPara('contracts/fx-effects.json', readFileSync(GITATTRIBUTES_HERMANO, 'utf8'));

    expect(reglas).not.toEqual([]);
    expect(fijaLf(reglas)).toBe(true);
  });

  it('el .gen de ESTE checkout no tiene ni un CRLF', () => {
    // El guard de verdad. Las reglas de `.gitattributes` son una intencion; esto
    // es el estado. Si alguien regenera el `.gen` desde un editor de Windows sin
    // el `.gitattributes` puesto, esta linea se pone roja aunque las reglas
    // sigan ahi, que es justo cuando hace falta.
    const crlf = cuentaCrlf(readFileSync(GENERATED, 'utf8'));

    expect(crlf, `fx_contract.gen.js tiene ${crlf} saltos CRLF`).toBe(0);
  });

  it('ni el contrato', () => {
    expect(cuentaCrlf(readFileSync(CONTRACT, 'utf8'))).toBe(0);
  });

  describe('y el parser de reglas se equivoca en todos los sentidos que importan', () => {
    // Sin esto, un `reglasPara` que devolviera siempre `[]` haria que el primer
    // test de arriba pasara por el `not.toEqual` y el resto no miraria nada.
    it('sin ninguna regla, no hay nada que fije', () => {
      expect(fijaLf(reglasPara('WebUI/js/fx_contract.gen.js', '# solo comentarios\n'))).toBe(false);
    });

    it('una regla que dice eol=crlf NO cuenta', () => {
      expect(fijaLf(reglasPara('WebUI/js/fx_contract.gen.js', 'WebUI/js/fx_contract.gen.js text eol=crlf\n'))).toBe(false);
    });

    it('una regla sin `text` NO cuenta', () => {
      expect(fijaLf(reglasPara('WebUI/js/fx_contract.gen.js', 'WebUI/js/fx_contract.gen.js -text eol=lf\n'))).toBe(false);
    });

    it('pero un glob que SI cubre el fichero, cuenta igual', () => {
      // El `.gitattributes` real podria cambiar de forma: lo que importa es si
      // cubre el fichero, no si la regla esta escrita con su ruta entera.
      expect(fijaLf(reglasPara('WebUI/js/fx_contract.gen.js', '*.gen.js text eol=lf\n'))).toBe(true);
      expect(fijaLf(reglasPara('WebUI/js/registry.gen.js', '*.gen.js text eol=lf\n'))).toBe(true);
    });

    it('y el glob no se come lo que no le toca', () => {
      expect(reglasPara('WebUI/js/effects_data.js', '*.gen.js text eol=lf\n')).toEqual([]);
    });

    it('el .gitattributes real se lee entero, no solo la primera linea', () => {
      const lineas = readFileSync(GITATTRIBUTES, 'utf8').split('\n').filter((l) => l.trim() !== '' && !l.trim().startsWith('#'));

      // Si el parser se quedara en la primera linea, devolveria una sola regla y
      // el `.gen` --que esta mas abajo-- no tendria ninguna. Este es el fallo que
      // hace que un parser "funcione" en los tests y falle en el fichero real.
      expect(lineas.length).toBeGreaterThan(5);
    });

    it('cuentaCrlf ve los CRLF y no ve los LF', () => {
      expect(cuentaCrlf('a\nb\nc')).toBe(0);
      expect(cuentaCrlf('a\r\nb\r\nc')).toBe(2);
    });
  });
});
