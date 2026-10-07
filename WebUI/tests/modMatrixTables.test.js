import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const HEADER = path.join(ROOT, 'Source', 'DSP', 'ModulationMatrix.h');
const DATA_JS = path.join(ROOT, 'WebUI', 'js', 'modmatrix_data.js');
const CANVAS_DATA_JS = path.join(
  ROOT, 'WebUI', 'js', 'components', 'mod-matrix-canvas_data.js',
);
const DOC = path.join(ROOT, 'docs', 'sysex_format.md');
const DUMPS = path.join(ROOT, 'resources', 'hardware_dumps', '2026-08-10');
const FIDELITY_DOC = path.join(ROOT, 'docs', 'mod_matrix_hardware_fidelity.md');
const FX_CONTRACT = path.join(ROOT, 'WebUI', 'js', 'fx_contract.gen.js');
const MODEL_CAPABILITIES = path.join(ROOT, 'WebUI', 'js', 'model_capabilities.js');

const MOD_MATRIX_FIRST_BYTE = 93;
const MOD_MATRIX_SLOTS = 8;

/**
 * Rango del byte SEGÚN `docs/sysex_format.md`, no según una constante de aquí:
 * el documento es el contrato, y si el documento cambia, este guard lo ve.
 *
 * El doc nombra el destino "Mod Slot 1 Destination" (no "Dest"), y la nota
 * del rango es la ÚLTIMA celda: `| 93 | Mod Slot 1 Source | enum | 93 | 0–22 |`.
 */
function docRanges() {
  const text = fs.readFileSync(DOC, 'utf8');
  const rows = [...text.matchAll(/^\|\s*(\d+)\s*\|([^|]*)\|([^|]*)\|[^|]*\|([^|]*)\|/gm)];

  const find = (re) => rows.find(([, , name]) => re.test(name));

  const range = (row) => {
    if (!row) return null;
    const m = row[4].match(/(\d+)\s*[–-]\s*(\d+)/);
    return m ? { min: Number(m[1]), max: Number(m[2]) } : null;
  };

  const srcRow = find(/Mod Slot 1 Source/i);
  const dstRow = find(/Mod Slot 1 Destination/i);
  const depthRow = find(/Mod Slot 1 Depth/i);

  return {
    srcByte: srcRow ? Number(srcRow[1]) : null,
    dstByte: dstRow ? Number(dstRow[1]) : null,
    depthByte: depthRow ? Number(depthRow[1]) : null,
    src: range(srcRow),
    dst: range(dstRow),
  };
}

/**
 * Enum del motor: nombres de ModSource y ModDestination, en orden.
 *
 * Y POR QUE SE QUITAN LOS COMENTARIOS ANTES DE MIRA. La extraccion es una
 * regex sobre el texto del enum, y un enum bien documentado menciona nombres
 * viejos en sus comentarios ("el enum declaraba `kFx1Param1` y `kFx1Param2`").
 * Sin quitar los comentarios, esos dos nombres entran en la lista como si
 * fueran destinos vivos, el recuento se infla y el guard miente en la direccion
 * contraria: diria que el motor cubre mas destinos de los que cubre.
 */
function dspEnums() {
  const text = fs.readFileSync(HEADER, 'utf8');

  const sinComentarios = (src) =>
    (src ?? '')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\/\/.*$/gm, ' ');

  const body = (name, terminator) => {
    const start = text.indexOf(`enum class ${name}`);
    if (start < 0) return null;
    const open = text.indexOf('{', start);
    const end = text.indexOf(terminator, open);
    return text.slice(open + 1, end);
  };

  const names = (src) =>
    [...sinComentarios(src).matchAll(/\bk([A-Za-z0-9_]+)/g)]
      .map((m) => m[1])
      .filter((n) => n !== 'MaxSources' && n !== 'MaxDestinations');

  return {
    sources: names(body('ModSource', 'kMaxSources')),
    destinations: names(body('ModDestination', 'kMaxDestinations')),
    // El MISMO enum, pero con el codigo de cada entrada. `destinations` mira el
    // orden de escritura, que desde que el enum lleva `= N` explicito no es el
    // codigo del byte; para el bloque de fx y de niveles hace falta el numero.
    destEntries: dspDestEntries(),
  };
}

/**
 * El enum de destinos CON SU CÓDIGO, no solo con su nombre.
 *
 * Y POR QUÉ HACE FALTA EL CÓDIGO Y NO BASTA EL ORDEN. `dspEnums` saca los
 * nombres en el orden en que están escritos, y ese orden solo coincide con el
 * byte cuando no hay ningún `= N` explícito. Desde que el enum numera con los
 * códigos del manual —el bloque de fx va de 81 a 128 y el de niveles de 129 a
 * 132— el orden de escritura y el código son cosas distintas, y un guard que
 * mirase solo el orden estaría mirando la letra y creyendo que es el número.
 *
 * El valor de una entrada es su `= N` explícito, o el correlativo de la
 * anterior. Igual que en `build/fase2-verificar.mjs`, y por el mismo motivo:
 * el enum es la verdad y hay que leerlo, no reescribirlo aquí.
 */
function dspDestEntries() {
  const text = fs.readFileSync(HEADER, 'utf8');
  const sinComentarios = (src) =>
    (src ?? '')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\/\/.*$/gm, ' ');

  const ini = text.indexOf('enum class ModDestination');
  const llave = text.indexOf('{', ini);
  const cierre = text.indexOf('};', llave);
  const cuerpo = sinComentarios(text.slice(llave + 1, cierre));

  const entradas = [];
  let correlativo = 0;
  // Multiples enumeradores POR LINEA. El bloque de fx escribe cuatro en cada
  // linea (`kFx1Param1 = 81,  kFx1Param2,  kFx1Param3, ...`), asi que una
  // regex que exigiera una linea entera solo leeria el primero de cada grupo y
  // el 82 al 128 saldrian sin entrada. Es un parser, no un resumen: el enum es
  // la verdad y hay que leerlo entero.
  for (const m of cuerpo.matchAll(/\b(k[A-Za-z0-9_]+)\s*(?:=\s*(\d+))?\s*(?=,|\s*$)/gm)) {
    // `kMaxDestinations` es el tope que CIERRA el rango del byte, no un
    // destino: ni se cuenta ni arrastra el correlativo, que es lo que haria
    // que las tres capacidades de motor de detras se leyeran desplazadas.
    if (m[1] === 'kMaxDestinations') continue;
    const codigo = m[2] !== undefined ? Number(m[2]) : correlativo;
    entradas.push({ nombre: m[1], codigo });
    correlativo = codigo + 1;
  }

  // `kMaxDestinations` se lee del FICHERO, no del cuerpo recortado: el corte
  // para el parser ocurre en el cierre del enum, asi que el tope sigue dentro.
  const tope = text.match(/kMaxDestinations\s*=\s*(\d+)/);
  return {
    entradas,
    porCodigo: new Map(entradas.map((e) => [e.codigo, e.nombre])),
    maxDestinations: tope ? Number(tope[1]) : null,
  };
}

/**
 * Carga los dos ficheros de la vista de la matriz en UN sandbox, en el MISMO
 * orden que `index.html` (la vista de grafos primero) y con `window` y
 * `globalThis` apuntando al mismo objeto, como en el navegador.
 *
 * El orden importa: `mod-matrix-canvas_data.js` se carga ANTES que
 * `modmatrix_data.js`, y sus accesores leen la tabla del dato perezosamente.
 * Por eso el orden de carga no puede cambiar, y por eso los accesores existen
 * en vez de ser literales.
 */
function loadMatrixView() {
  const sandbox = { window: {} };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(CANVAS_DATA_JS, 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync(DATA_JS, 'utf8'), sandbox);
  return sandbox;
}

/** ¿El fichero de la vista de grafos sigue TENIENDO literales de tabla? */
function canvasHasLiteralTables() {
  const text = fs.readFileSync(CANVAS_DATA_JS, 'utf8');
  return /MOD_(SOURCES|DESTS)_(SHORT|LONG)\s*=\s*\[/.test(text);
}

/**
 * Carga `model_capabilities.js` como lo carga `index.html`: el contrato FX
 * PRIMERO (linea 49) y las capabilities despues (linea 129). El orden no es
 * decorativo — los conteos de FX se derivan del contrato al construir el
 * modulo—, asi que un sandbox que los cargara al reves estaria midiendo otra
 * cosa y avisaria de un 0 que en el navegador no existe.
 */
function loadModelCapabilities() {
  const sandbox = { window: {}, console: { warn() {} } };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  sandbox.module = undefined;   // se carga como script clasico, no como modulo
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(FX_CONTRACT, 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync(MODEL_CAPABILITIES, 'utf8'), sandbox);
  return sandbox.window.ModelCapabilities;
}

/**
 * Categoría de color de un índice, según CADA una de las dos copias.
 * Se comparan las CATEGORÍAS, no el literal: lo que importa es que las dos
 * digan "esto es un LFO" y "esto es un oscilador", no que coincidan el color.
 *
 * Una copia usa variables CSS (`var(--accent-blue)`) y la otra hex. El hex no
 * contiene el nombre de la familia, así que se traduce por el valor conocido
 * de cada family's hex en la vista de grafos.
 */
const HEX_FAMILY = {
  '#5b9bd5': 'blue',
  '#4ecdc4': 'teal',
  '#6abf69': 'green',
  '#d4a843': 'gold',
  '#e68a8a': 'pink',
  '#888': 'other',
};

function familyOf(color) {
  if (!color) return 'none';
  const s = String(color).toLowerCase();
  if (HEX_FAMILY[s]) return HEX_FAMILY[s];
  for (const name of ['blue', 'teal', 'green', 'gold', 'pink']) {
    if (s.includes(name)) return name;
  }
  return 'other';
}

function categoryByIndex(tables, canvas, kind, index) {
  const data = kind === 'src'
    ? tables.getSrcCategoryColor(index)
    : tables.getDestCategoryColor(index);
  const canvasColor = kind === 'src'
    ? canvas.modSrcColor(index)
    : canvas.modDstColor(index);
  return [familyOf(data), familyOf(canvasColor)];
}

/* ── El hardware: rango REAL observado en los bancos de fábrica ───────────── */

/** Desempaqueta el payload 7-a-8 igual que `WebUI/js/browser_packer.js`. */
function unpack7to8(packed) {
  const out = new Uint8Array(242);
  let write = 0;
  for (let i = 0; i < packed.length && write < 242; i += 8) {
    const msb = packed[i] & 0x7f;
    for (let j = 0; j < 7 && write < 242; j++) {
      if (i + 1 + j >= packed.length) break;
      out[write++] = (packed[i + 1 + j] & 0x7f) | (((msb >> j) & 1) << 7);
    }
  }
  return out;
}

let hardwareCache = null;

/**
 * Recorre los 8 bancos volcados del equipo y junta el rango que el hardware
 * EJERCE de verdad: 1024 presets x 8 slots = 8192 rutas (muchas apagadas).
 *
 * El formato es de tamaño FIJO (291 B por mensaje, cabecera de 10 B), no
 * longitud 7-a-8: `scripts/hw_bank_dump.js` ensambla 128 x 291 B canónicos.
 */
function hardwareEnvelope() {
  if (hardwareCache) return hardwareCache;

  const files = fs.readdirSync(DUMPS)
    .filter((f) => /^Synth Bank .\.syx$/.test(f));
  expect(files.length).toBe(8);

  const src = new Set();
  const dst = new Set();
  const depth = new Set();
  let presets = 0;
  let slots = 0;

  for (const file of files) {
    const buf = fs.readFileSync(path.join(DUMPS, file));
    for (let off = 0; off + 291 <= buf.length; off += 291) {
      if (buf[off] !== 0xf0) continue;
      const u = unpack7to8(buf.subarray(off + 10, off + 10 + 278));
      if (u.length < MOD_MATRIX_FIRST_BYTE + 3) continue;
      presets++;
      for (let s = 0; s < MOD_MATRIX_SLOTS; s++) {
        const base = MOD_MATRIX_FIRST_BYTE + s * 3;
        if (base + 2 >= u.length) break;
        src.add(u[base]);
        dst.add(u[base + 1]);
        depth.add(u[base + 2]);
        slots++;
      }
    }
  }

  hardwareCache = {
    files: files.length,
    presets,
    slots,
    srcMax: Math.max(...src),
    dstMax: Math.max(...dst),
    depthMin: Math.min(...depth),
    depthMax: Math.max(...depth),
    hasDepthCentre: depth.has(128),
  };
  return hardwareCache;
}

/* ── Los tests ────────────────────────────────────────────────────────────── */

describe('modMatrixTables — la matriz de modulación contra el hardware', () => {
  const doc = docRanges();
  const dsp = dspEnums();
  const view = loadMatrixView();
  const tables = view;
  const canvas = view;

  describe('el contrato de bytes (docs/sysex_format.md)', () => {
    it('los bytes 93/94/95 son el primer slot de la matriz', () => {
      expect(doc.srcByte).toBe(MOD_MATRIX_FIRST_BYTE);
      expect(doc.dstByte).toBe(MOD_MATRIX_FIRST_BYTE + 1);
      expect(doc.depthByte).toBe(MOD_MATRIX_FIRST_BYTE + 2);
    });

    it('declara un rango de fuentes y de destinos, y son coherentes', () => {
      expect(doc.src).not.toBeNull();
      expect(doc.dst).not.toBeNull();
      expect(doc.src.min).toBe(0);
      expect(doc.dst.min).toBe(0);
      expect(doc.dst.max).toBeGreaterThan(doc.src.max);
    });
  });

  describe('el rango real que el hardware ejerce', () => {
    it('lee los 8 bancos de fábrica y las 8192 rutas', () => {
      const hw = hardwareEnvelope();
      expect(hw.files).toBe(8);
      expect(hw.presets).toBe(1024);
      expect(hw.slots).toBe(8192);
    });

    it('la profundidad es bipolar 0..255 y el centro 128 se usa de verdad', () => {
      const hw = hardwareEnvelope();
      expect(hw.depthMin).toBe(0);
      expect(hw.depthMax).toBe(255);
      expect(hw.hasDepthCentre).toBe(true);
    });

    it('el hardware nunca pide un destino por encima del rango del doc', () => {
      const hw = hardwareEnvelope();
      expect(hw.dstMax).toBeLessThanOrEqual(doc.dst.max);
    });

    it('el hardware nunca pide una fuente por encima del rango del doc', () => {
      const hw = hardwareEnvelope();
      expect(hw.srcMax).toBeLessThanOrEqual(doc.src.max);
    });
  });

  describe('la tabla del dato cubre lo que el hardware pide', () => {
    it('la tabla de destinos llega al último índice que pide el hardware', () => {
      const hw = hardwareEnvelope();
      expect(tables.FULL_MOD_DESTINATIONS.length).toBeGreaterThan(hw.dstMax);
    });

    it('ningún destino observado por el hardware falta en la tabla', () => {
      const hw = hardwareEnvelope();
      const full = tables.FULL_MOD_DESTINATIONS;
      for (let i = 0; i <= hw.dstMax; i++) {
        expect(typeof full[i], `destino ${i}`).toBe('string');
        expect(full[i].length, `destino ${i}`).toBeGreaterThan(0);
      }
    });

    it('ninguna fuente observada por el hardware falta en la tabla', () => {
      const hw = hardwareEnvelope();
      expect(tables.MOD_SOURCES.length).toBeGreaterThan(hw.srcMax);
    });
  });

  describe('la tabla de la vista de grafos ya no es una copia', () => {
    it('no vuelve a declarar literales de fuentes/destinos', () => {
      expect(canvasHasLiteralTables()).toBe(false);
    });

    it('el nombre que pinta el grafo es el de la tabla del dato', () => {
      const full = tables.FULL_MOD_DESTINATIONS;
      for (const index of [0, 1, 20, 64, 129]) {
        if (index >= full.length) continue;
        expect(canvas.modDestShort(index)).toBe(full[index]);
      }
    });

    it('el nombre de fuente que pinta el grafo es el de la tabla del dato', () => {
      for (const index of [0, 1, 7, 19]) {
        if (index >= tables.MOD_SOURCES.length) continue;
        expect(canvas.modSrcShort(index)).toBe(tables.MOD_SOURCES[index]);
      }
    });
  });

  describe('las dos copias del color coinciden en CATEGORÍA', () => {
    it('las fuentes se clasifican igual en las dos vistas', () => {
      for (let i = 0; i < tables.MOD_SOURCES.length; i++) {
        const [a, b] = categoryByIndex(tables, canvas, 'src', i);
        expect(b, `fuente ${i} (${tables.MOD_SOURCES[i]})`).toBe(a);
      }
    });

    it('los destinos se clasifican igual en las dos vistas', () => {
      const full = tables.FULL_MOD_DESTINATIONS;
      for (let i = 0; i < full.length; i++) {
        const [a, b] = categoryByIndex(tables, canvas, 'dst', i);
        expect(b, `destino ${i} (${full[i]})`).toBe(a);
      }
    });
  });

  describe('la decisión escrita', () => {
    // El guard pasa en verde porque la decisión está ESCRITA. Si el hardware o
    // las tablas cambian, este bloque obliga a actualizar el documento en vez de
    // dejar que se quede viejo: compara lo que el doc afirma con lo que la
    // medición de este mismo run acaba de observar.
    it('el documento de fidelidad existe', () => {
      expect(fs.existsSync(FIDELITY_DOC)).toBe(true);
    });

    it('cita el rango de fuentes que el hardware ejerce', () => {
      const hw = hardwareEnvelope();
      const text = fs.readFileSync(FIDELITY_DOC, 'utf8');
      expect(text).toContain(String(hw.srcMax));
    });

    it('cita el rango de destinos que el hardware ejerce', () => {
      const hw = hardwareEnvelope();
      const text = fs.readFileSync(FIDELITY_DOC, 'utf8');
      expect(text).toContain(String(hw.dstMax));
    });

    it('dice el rango de destinos del byte que el motor cubre', () => {
      // Y POR QUE SE MIDE CONTANDO Y NO RESTANDO. La version anterior hacia
      // `doc.dst.max - dsp.destinations.length + 1`: el rango del doc menos
      // cuantos destinos declara el enum, mas uno. Era una resta de dos numeros
      // que solo significaba algo mientras el enum fuera mas corto que el byte.
      // Al renumerar el enum con los codigos del manual, el enum tiene MAS
      // entradas que el rango del byte y la resta daba un numero negativo de
      // destinos sin cubrir, que no existe. Ahora se declara la COBERTURA: que
      // codigos del byte tiene el enum, del primero al ultimo. Asi el guard vale
      // igual si falta la mitad que si no falta ninguno.
      //
      // Y POR QUE SE PARSEA EL DOC Y NO SE BUSCA UN SUBSTRING. Con la cuenta
      // en cero, `toContain('0')` pasa porque el documento tiene un cero en
      // cualquier parte —una tabla, un rango— y el guard quedaria en verde
      // mientras el doc dijera 86. Un guard que no puede fallar no es un guard.
      // Asi que se lee lo que el documento AFIRMA y se compara con lo medido: si
      // el doc se queda viejo, este falla diciendo el numero que le toca.
      const text = fs.readFileSync(FIDELITY_DOC, 'utf8');
      const entries = dsp.destEntries;

      // Cobertura MEDIDA: los codigos que el enum declara, contados de verdad.
      const cubiertos = [];
      for (let codigo = 0; codigo < entries.maxDestinations; codigo++) {
        if (entries.porCodigo.has(codigo)) cubiertos.push(codigo);
      }
      const medido = {
        desde: cubiertos[0],
        hasta: cubiertos[cubiertos.length - 1],
        cuenta: cubiertos.length,
      };
      expect(medido.cuenta, 'el enum no puede tener huecos internos: si los tiene, '
        + 'el guard tiene que saberlo antes de exigirle nada al doc')
        .toBe(medido.hasta - medido.desde + 1);

      const afirmacion = text.match(
        /Los destinos (\d+)\s*[–-]\s*(\d+)\s*\((\d+)\s*índices?\)\s*(?:no )?los cubre el motor/,
      );
      expect(afirmacion,
        'El documento de fidelidad ya no dice que rango de destinos del byte cubre '
        + 'el motor. Ese parrafo es el que obliga a escribir la cifra a mano; '
        + `hoy la cifra medida es ${medido.cuenta}.`)
        .not.toBeNull();

      // El rango que el doc declara y el numero de destinos que cuenta tienen
      // que ser el mismo hecho de dos maneras.
      const [desde, hasta, cuenta] = afirmacion.slice(1).map(Number);
      expect(cuenta, 'el documento cuenta un numero de destinos distinto del que'
        + ' cubre el rango que declara')
        .toBe(hasta - desde + 1);
      expect({ desde, hasta, cuenta },
        'El documento de fidelidad esta viejo: el enum cubre los codigos '
        + `${medido.desde}-${medido.hasta} (${medido.cuenta} indices).`
        + ' Lo que el doc dice es otra cosa.')
        .toEqual(medido);
    });

    it('no afirma que la profundidad tenga otro centro que 128', () => {
      // El centro bipolar en 128 es lo que asume el código; el hardware lo
      // confirma (128 es su valor más frecuente). Si algún día el centro se
      // moviera, el doc tiene que decirlo explícitamente.
      const hw = hardwareEnvelope();
      expect(hw.hasDepthCentre).toBe(true);
    });
  });

  describe('el enum del motor contra el byte (AVISO, no fallo)', () => {
    // El motor implementaba 48 destinos y el byte llega a 129. Es una carencia
    // REAL, no un fallo de este guard: la cubre la capa de traducción de la
    // Fase 5. Aquí se fija un suelo verificado y se imprime el resto, para que
    // el número se conozca en vez de aparecer por sorpresa.
    //
    // El suelo subio de 36 a 44 con el bus de fx: el bloque pasa a 74-81 y son
    // ocho destinos mas que antes, con nombre y leidos por el motor.
    const MIN_COVERED_DESTINATIONS = 44;

    it('los buses del motor y los que declara la UI son el MISMO numero', () => {
      // Este guard existe porque los dos numeros estaban escritos a mano en los
      // dos sitios —`kNumSlots` en ModulationMatrix.h y
      // `modulationSlotCountForMode` en model_capabilities.js— y nada miraba
      // que Agreearan. Es el mismo patron que se acaba de cerrar en los FX: dos
      // verdades escritas a mano se separan en silencio y el sintoma (una UI
      // que ofrece buses que el motor no tiene, o al reves) no senala quien
      // miente.
      //
      // El motor decide con una constante de preprocesador, no con un enum que
      // contar, asi que se leen las DOS ramas del #if y se comparan con lo que
      // la UI dice para cada modelo.
      //
      // NO se lee el comentario de la linea: seria una cuarta fuente y se
      // desincroniza del valor sin que nada se entere. De cada rama se saca el
      // NUMERO, y la rama se identifica por la condicion del #if que la trae.
      const header = fs.readFileSync(HEADER, 'utf8');
      const propSlots = (texto) => {
        const m = texto.match(/kNumSlots\s*=\s*(\d+)/);
        return m ? Number(m[1]) : null;
      };

      const iPro = header.indexOf('#if DEEP_TARGET_MODEL >= 2');
      const iElse = header.indexOf('#else', iPro);
      const iEnd = header.indexOf('#endif', iElse);
      expect(iPro, 'No se encuentra el #if DEEP_TARGET_MODEL >= 2 de kNumSlots')
        .toBeGreaterThan(-1);
      expect(iElse).toBeGreaterThan(iPro);
      expect(iEnd).toBeGreaterThan(iElse);

      const busesPro = propSlots(header.slice(iPro, iElse));
      const busesClasico = propSlots(header.slice(iElse, iEnd));
      expect(busesPro, 'La rama Pro de kNumSlots no declara un numero').not.toBeNull();
      expect(busesClasico, 'La rama clasica de kNumSlots no declara un numero').not.toBeNull();

      // Ahora el cruce con la UI. Se carga el modulo real en el orden que usa
      // index.html: un numero escrito aqui seria una tercera verdad, no una
      // comprobacion.
      const caps = loadModelCapabilities();
      const slotsPorModelo = {
        dm12_hardware: caps.getModelCapabilities('dm12_hardware').modulationSlotCount,
        abyssmind_pro: caps.getModelCapabilities('abyssmind_pro').modulationSlotCount,
      };

      // Y lo que resuelve un modo de UI tiene que dar lo mismo que su modelo:
      // es la funcion que leen browser_mapper y modmatrix para decidir cuantos
      // buses escriben y pintan.
      expect(caps.modulationSlotCountForMode('deepmind_hw_controller')).toBe(slotsPorModelo.dm12_hardware);
      expect(caps.modulationSlotCountForMode('deepmind_web_standalone')).toBe(slotsPorModelo.dm12_hardware);
      expect(caps.modulationSlotCountForMode('abyssmind_pro')).toBe(slotsPorModelo.abyssmind_pro);
      // Un modo desconocido cae al fiel: el fallback del modelo y el de los
      // buses tienen que contar la misma historia.
      expect(caps.modulationSlotCountForMode('modo_inexistente')).toBe(slotsPorModelo.dm12_hardware);

      // Y el crux del guard: motor y UI, el mismo numero en cada modelo.
      expect(busesClasico,
        `ModulationMatrix.h declara ${busesClasico} buses para el modo clasico y `
        + `model_capabilities.js declara ${slotsPorModelo.dm12_hardware}. `
        + 'El motor ejecutaria un numero distinto del que la UI escribe y pinta.')
        .toBe(slotsPorModelo.dm12_hardware);
      expect(busesPro,
        `ModulationMatrix.h declara ${busesPro} buses para el modo Pro y `
        + `model_capabilities.js declara ${slotsPorModelo.abyssmind_pro}.`)
        .toBe(slotsPorModelo.abyssmind_pro);

      // Los dos numeros del manual: 8 buses en el DeepMind 12, y el Pro los
      // amplia. Si esto se mueve, el modo clasico deja de ser el clasico.
      expect(slotsPorModelo.dm12_hardware).toBe(8);
      expect(slotsPorModelo.abyssmind_pro).toBe(32);

      // Y el parche #if del motor tiene que declarar los mismos dos numeros que
      // la UI, cada uno en su rama.
    });

    it('el bloque de fx del enum es el del manual: doce parametros por hueco y el nivel', () => {
      // El byte de destino ES el manual y el motor lo castea tal cual, asi que
      // el codigo del enum tiene que ser el del manual. Si esto se mueve, la
      // ruta que elige el usuario y la que suena se separan en silencio.
      //
      // Y POR QUE NO SON OCHO. Durante un tiempo el enum traia ocho destinos de
      // fx —`Fx 1..4 Parameters` y `Fx 1..4 Level`— en 74-81. Eso no lo dice el
      // manual: el manual da UN destino por parametro, doce por hueco, con el
      // codigo `80 + (hueco - 1) * 12 + parametro`, y el nivel de cada hueco
      // aparte. El bloque de ocho estaba donde ya habia numeros escritos en el
      // enum, y la tabla del dato se movio para encajar con el.
      const entries = dsp.destEntries;
      const codigoDe = (nombre) => entries.entradas.find((e) => e.nombre === nombre)?.codigo;

      // Los doce del hueco 1, y el final del bloque entero.
      expect(codigoDe('kFx1Param1')).toBe(81);
      expect(codigoDe('kFx1Param12')).toBe(92);
      expect(codigoDe('kFx2Param1')).toBe(93);
      expect(codigoDe('kFx4Param12')).toBe(128);

      // Los cuarenta y ocho por la cuenta del manual. Esto no mira nombres: mira
      // que el codigo que el motor le da a cada par coincide con el que la
      // cuenta dice, y si alguien cambia el 12 por otro numero aqui se ve.
      let fx = 0;
      for (let hueco = 1; hueco <= 4; hueco++) {
        for (let param = 1; param <= 12; param++) {
          const esperado = 80 + (hueco - 1) * 12 + param;
          expect(codigoDe(`kFx${hueco}Param${param}`),
            `hueco ${hueco}, parametro ${param}: el manual lo numera ${esperado}`)
            .toBe(esperado);
          fx++;
        }
      }
      expect(fx).toBe(48);

      // Y los cuatro niveles, con el 129 como el tope que alcanza el byte.
      expect(codigoDe('kFx1Level')).toBe(129);
      expect(codigoDe('kFx4Level')).toBe(132);

      // Y los ocho de meta-modulacion, que el bloque de ocho ocupaba. Ahora
      // son la profundidad de cada bus, y no suenan: mueven otro bus.
      expect(codigoDe('kMod1Depth')).toBe(73);
      expect(codigoDe('kMod8Depth')).toBe(80);

      // Y que no quede el nombre del bus de ocho: `Fx N Parameters` movia a la
      // vez todos los parametros del hueco, que es justo lo que el hardware no
      // hace. Los cuatro `kFx N Level` que quedan SI son los buenos, y estan
      // asentos en 129-132 mas arriba.
      const nombres = entries.entradas.map((e) => e.nombre);
      expect(nombres.filter((n) => /^kFx\dParameters$/.test(n))).toEqual([]);
    });

it('la tabla del dato nombra la meta-modulacion y los destinos de fx en los mismos codigos', () => {
      // Los 74-81 que ocupaba el bus de fx no eran un bus: eran la meta-
      // modulacion (73-80) y los cuarenta y ocho parametros de fx (81-128),
      // con los cuatro niveles de hueco al final (129-132). Este bloque escribe
      // los nombres A MANO porque comparar la tabla consigo misma no puede
      // fallar: si el nombre se saca de la tabla, renombrar `FX 1 Level` a
      // cualquier otra cosa deja el guard en verde.
      const full = tables.FULL_MOD_DESTINATIONS;
      const entries = dsp.destEntries;

      // ── 73-80: la profundidad de cada bus, que mueve otro bus ──────────────
      const META = [
        'Mod 1 Depth', 'Mod 2 Depth', 'Mod 3 Depth', 'Mod 4 Depth',
        'Mod 5 Depth', 'Mod 6 Depth', 'Mod 7 Depth', 'Mod 8 Depth',
      ];
      expect(Object.keys(tables.META_MOD_DESTINATIONS).map(Number).sort((a, b) => a - b))
        .toEqual([73, 74, 75, 76, 77, 78, 79, 80]);
      for (let i = 0; i < META.length; i++) {
        const codigo = 73 + i;
        expect(full[codigo], `meta ${codigo}`).toBe(META[i]);
        expect(entries.porCodigo.get(codigo), `enum del meta ${codigo}`)
          .toBe(`kMod${i + 1}Depth`);
      }

      // ── 81-128: los cuarenta y ocho parametros, por la cuenta del manual ────
      // El codigo no se lee de la tabla: se cuenta como lo cuenta el manual,
      // `80 + (hueco - 1) * 12 + parametro`, y se comprueba en las dos tablas.
      for (let hueco = 1; hueco <= 4; hueco++) {
        for (let param = 1; param <= 12; param++) {
          const codigo = 80 + (hueco - 1) * 12 + param;
          expect(full[codigo], `fx ${hueco}.${param}`)
            .toBe(`FX ${hueco} Param ${param}`);
          expect(entries.porCodigo.get(codigo), `enum de fx ${hueco}.${param}`)
            .toBe(`kFx${hueco}Param${param}`);
        }
      }

      // ── 129-132: el nivel de cada hueco, el tope que alcanza el byte ────────
      const NIVELES = ['FX 1 Level', 'FX 2 Level', 'FX 3 Level', 'FX 4 Level'];
      expect(Object.keys(tables.FX_LEVEL_DESTINATIONS).map(Number).sort((a, b) => a - b))
        .toEqual([129, 130, 131, 132]);
      for (let i = 0; i < NIVELES.length; i++) {
        expect(full[129 + i], `nivel ${129 + i}`).toBe(NIVELES[i]);
        expect(entries.porCodigo.get(129 + i), `enum del nivel ${129 + i}`)
          .toBe(`kFx${i + 1}Level`);
      }

      // ── Y el bus de ocho que ocupaba el 74-81 ya no existe ─────────────────
      // Que la UI no lo declare por su cuenta: mientras la tabla del dato se
      // quedaba en 73 entradas, la lista solo ofrecia hasta el 72 y el 73 era
      // un hueco sin etiqueta.
      expect(tables.FX_BUS_DESTINATIONS).toBeUndefined();
      expect(tables.MOD_DESTINATIONS.length).toBe(73);

      // ── Y la cuenta entera, sin un solo nombre inventado ───────────────────
      // Los 133 codigos que alcanza el byte: 73 de sintesis, 8 de meta, 48 de
      // parametros de fx y 4 de nivel de hueco. Si alguno se queda sin
      // evidencia de etiqueta, el nombre honesto es `Dest N`, y este guard lo
      // dice en vez de dejar que aparezca solo en la lista.
      const rellenos = full
        .map((nombre, codigo) => ({ nombre, codigo }))
        .filter(({ nombre, codigo }) => nombre === `Dest ${codigo}`);
      expect(rellenos.map(({ codigo }) => codigo)).toEqual([]);

      // ── Y los numeros de la cuenta, cruzados entre JS y C++ ───────────────
      // Los dos ficheros calculan el codigo del parametro, y cada uno con sus
      // numeros. Si uno cambia y el otro no, la lista y el motor eligen
      // distinto hueco sin que nada lo note.
      const header = fs.readFileSync(HEADER, 'utf8');
      const cte = (nombre) => {
        const m = header.match(new RegExp(`${nombre}\\s*=\\s*(\\d+)`));
        return m ? Number(m[1]) : null;
      };
      expect(tables.FX_PARAMS_FIRST_CODE).toBe(cte('kFxParamsFirstCode'));
      expect(tables.FX_PARAMS_PER_SLOT).toBe(cte('kFxParamsPerSlot'));
      expect(cte('kMetaFirstCode')).toBe(73);
      expect(cte('kFxLevelFirstCode')).toBe(129);
      expect(cte('kNumMetaSlots')).toBe(8);
    });

    it('los destinos que el manual no nombra no se inventan', () => {
      // El plan de la Fase 2 pide que lo que no tenga evidencia de etiqueta se
      // quede como `Dest N`. Hoy, con la guia de parametros encima, los 133
      // codigos tienen nombre: este guard no es una lista de pendientes, es el
      // que AVISA si vuelve a haber un hueco. Si manana se anaden codigos al
      // enum y el manual no los cubre, este falla con el codigo exacto en vez
      // de dejar que `Dest N` llegue a la lista sin que nadie mire.
      const full = tables.FULL_MOD_DESTINATIONS;
      const entradas = dsp.destEntries;

      expect(full.length).toBe(133);

      // Cada codigo del byte tiene nombre en la tabla, y el nombre no es un
      // relleno con el numero del lado.
      for (let codigo = 0; codigo < full.length; codigo++) {
        expect(full[codigo], `el codigo ${codigo} no tiene nombre`).not.toBe(`Dest ${codigo}`);
        expect(full[codigo], `el codigo ${codigo}`).toBeTruthy();
      }

      // Y que no haya nombres repetidos: dos codigos con el mismo nombre
      // significan que el usuario elige entre dos rutas que suenan igual.
      const repetidos = [...new Set(full)]
        .filter((nombre) => full.filter((n) => n === nombre).length > 1);
      expect(repetidos, `nombres repetidos en la tabla: ${repetidos.join(', ')}`).toEqual([]);

      // Y el enum del motor no puede tener dos entradas en el mismo codigo ni
      // un codigo repetido: `porCodigo` se construye con un Map, que se queda
      // con el ultimo, asi que un `= 81` repetido pasaria inadvertido.
      const codigos = entradas.entradas.map((e) => e.codigo);
      expect(codigos.length).toBe(new Set(codigos).size);
    });

    it('el enum del motor existe y tiene al menos los destinos que cubre hoy', () => {
      expect(dsp.destinations.length).toBeGreaterThanOrEqual(
        MIN_COVERED_DESTINATIONS,
      );
    });

    it('el enum del motor tiene el MISMO ORDEN que la tabla del manual', () => {
      // Si el motor recibe el byte crudo y lo castea a este enum, el código ES el
      // contrato. Antes esto solo avisaba: el enum traía sus destinos agrupados
      // por módulo —osciladores, filtro, amplificador, LFO, envolventes— y la
      // tabla del manual los trae agrupados como el manual —LFO, osciladores,
      // filtro, envolventes, amplificador—, así que de 44 entradas solo una
      // caía en su sitio. Las 4697 rutas de los 1024 presets de fábrica que hay
      // commiteados elegían un destino y sonaban otro: medido en
      // `build/fase2-desajuste.mjs`, que antes de la Fase 2 daba 0 de 4697
      // correctas.
      //
      // Ahora el enum lleva el código del byte en el MISMO enumerador, y este
      // guard compara las dos tablas código a código.
      const full = tables.FULL_MOD_DESTINATIONS;
      const entries = dsp.destEntries;

      // EL ANCLA, Y POR QUÉ LOS NOMBRES ESTÁN ESCRITOS AQUÍ.
      //
      // El nombre del enum y el de la tabla no se parecen: `kLfo1Rate` frente a
      // `LFO1 Rate`. Compararlos por texto daría un falso positivo con dos
      // reglas de normalización y un falso negativo con cada abreviatura
      // distinta, así que la tabla que se cruza se escribe aquí, a mano, con el
      // nombre del enum y el del manual uno al lado. Es el mismo motivo por el
      // que el guard del bus de fx escribe los ocho nombres dentro: comparar la
      // tabla consigo misma no puede fallar.
      //
      // Solo van aquí los destinos que el motor LEE de verdad. Declarar los 132
      // sería escribir el manual dos veces, y de los declarados la mayoría no
      // tiene consumidor: declararlos no los hace sonar.
      const ANCLA = [
        // código, nombre del enum, nombre que ve el usuario
        [0, 'kNone', 'None'],
        [1, 'kLfo1Rate', 'LFO1 Rate'],
        [2, 'kLfo1Delay', 'LFO1 Delay'],
        [3, 'kLfo1Slew', 'LFO1 Slew'],
        [5, 'kLfo2Rate', 'LFO2 Rate'],
        [6, 'kLfo2Delay', 'LFO2 Delay'],
        [7, 'kLfo2Slew', 'LFO2 Slew'],
        [11, 'kOsc1Pitch', 'OSC 1 Pitch'],
        [13, 'kOsc2Pitch', 'OSC 2 Pitch'],
        [16, 'kOsc1SquareWidth', 'PWM Depth'],
        [17, 'kOsc2ToneMod', 'TMod Depth'],
        [20, 'kFilterCutoff', 'VCF Freq'],
        [21, 'kFilterResonance', 'VCF Res'],
        [22, 'kFilterEnvDepth', 'VCF Env'],
        [23, 'kFilterLfoDepth', 'VCF LFO'],
        [35, 'kEnv1Attack', 'Env1 Attack'],
        [36, 'kEnv1Decay', 'Env1 Decay'],
        [37, 'kEnv1Sustain', 'Env1 Sus'],
        [38, 'kEnv1Release', 'Env1 Rel'],
        [43, 'kEnv2Attack', 'Env2 Attack'],
        [44, 'kEnv2Decay', 'Env2 Decay'],
        [45, 'kEnv2Sustain', 'Env2 Sus'],
        [46, 'kEnv2Release', 'Env2 Rel'],
        [51, 'kEnv3Attack', 'Env3 Attack'],
        [52, 'kEnv3Decay', 'Env3 Decay'],
        [53, 'kEnv3Sustain', 'Env3 Sus'],
        [54, 'kEnv3Release', 'Env3 Rel'],
        [59, 'kAmpLevel', 'VCA All'],
        [62, 'kAmpPanSpread', 'Pan Spread'],
        [63, 'kAmpPan', 'VCA Pan'],
        [64, 'kOsc2Level', 'OSC2 Lvl'],
        [65, 'kNoiseLevel', 'Noise Lvl'],
        [66, 'kFilterHPFCutoff', 'HP Freq'],
      ];

      for (const [codigo, nombreEnum, nombreTabla] of ANCLA) {
        expect(entries.porCodigo.get(codigo),
          `el motor ejecuta ${nombreEnum} en el ${codigo}, y el usuario ve "${full[codigo]}"`)
          .toBe(nombreEnum);
        expect(full[codigo], `el destino ${codigo}`).toBe(nombreTabla);
      }

      // Y el rango entero tiene que estar en las dos: ni un código del byte sin
      // entrada en el enum, ni una entrada del enum dentro del rango del byte
      // que la tabla no nombre. El primero es un destino que el motor no ejecuta;
      // el segundo es un nombre que el motor ejecuta y el usuario no ve.
      for (let codigo = 0; codigo < full.length; codigo++) {
        expect(entries.porCodigo.has(codigo),
          `la tabla tiene "${full[codigo]}" en el ${codigo} y el enum no`).toBe(true);
      }

      // Y los tres destinos que quedan detrás del byte —nivel del oscilador 1,
      // nivel del sub-oscilador y seguimiento de teclado— tienen que estar
      // FUERA del rango que el byte alcanza. Dentro, un parche con un destino
      // corrupto caería en uno y modularía algo que nadie eligió.
      const fueraDelByte = entries.entradas.filter((e) => e.codigo >= full.length);
      expect(fueraDelByte.map((e) => e.nombre)).toEqual(
        ['kOsc1Level', 'kSubOscLevel', 'kFilterKeyTrack'],
      );
    });

    it('informa de los destinos del byte que el motor no cubre', () => {
      // Antes esto solo avisaba. Ahora no hay destinos del byte sin cubrir: el
      // enum llega hasta el 132 y el tope que declara, `kMaxDestinations`, es el
      // número de códigos del byte más uno. Si el enum se quedara corto, este
      // guard falla en vez de escribir un número que nadie miraba.
      const entries = dsp.destEntries;

      // El tope declarado tiene que ser el del manual: 133 códigos, de 0 a 132.
      expect(entries.maxDestinations).toBe(133);

      // Ningún código del byte sin entrada en el enum.
      const sinCubrir = [];
      for (let codigo = 0; codigo < entries.maxDestinations; codigo++) {
        if (!entries.porCodigo.has(codigo)) sinCubrir.push(codigo);
      }
      expect(sinCubrir,
        `el motor no cubre ${sinCubrir.length} códigos del byte: ${sinCubrir.join(',')}`)
        .toEqual([]);

      // Y el tope tiene que cubrir la tabla entera, que llega al 132.
      expect(entries.maxDestinations).toBeGreaterThanOrEqual(
        tables.FULL_MOD_DESTINATIONS.length,
      );
    });
  });
});
