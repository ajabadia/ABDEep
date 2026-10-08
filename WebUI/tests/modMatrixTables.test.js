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
      expect(medido.cuenta, 'el enum cubre exactamente las 46 entradas declaradas').toBe(46);
      expect(medido.desde).toBe(0);
      expect(medido.hasta).toBe(81);

      const afirmacion = text.match(
        /Los destinos (\d+)\s*[–-]\s*(\d+)\s*\((\d+)\s*índices?\)\s*(?:no )?los cubre el motor/,
      );
      expect(afirmacion,
        'El documento de fidelidad ya no dice que rango de destinos del byte cubre '
        + 'el motor. Ese parrafo es el que obliga a escribir la cifra a mano; '
        + `hoy la cifra medida es ${medido.cuenta}.`)
        .not.toBeNull();

      const [desde, hasta, cuenta] = afirmacion.slice(1).map(Number);
      expect(cuenta).toBe(medido.cuenta);
      expect(desde).toBe(medido.desde);
      expect(hasta).toBe(medido.hasta);
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
      expect(busesPro).toBe(32);
      expect(slotsPorModelo.dm12_hardware).toBe(8);
    });

    it('el bloque de fx del enum declara los ocho destinos del hardware (74-81)', () => {
      const entries = dsp.destEntries;
      const codigoDe = (nombre) => entries.entradas.find((e) => e.nombre === nombre)?.codigo;

      expect(codigoDe('kFx1Parameters')).toBe(74);
      expect(codigoDe('kFx2Parameters')).toBe(75);
      expect(codigoDe('kFx3Parameters')).toBe(76);
      expect(codigoDe('kFx4Parameters')).toBe(77);
      expect(codigoDe('kFx1Level')).toBe(78);
      expect(codigoDe('kFx2Level')).toBe(79);
      expect(codigoDe('kFx3Level')).toBe(80);
      expect(codigoDe('kFx4Level')).toBe(81);

      // Puerta del arp y slew del seq inmediatamente antes
      expect(codigoDe('kArpGate')).toBe(71);
      expect(codigoDe('kSeqSlew')).toBe(72);

      // El tope declarado en el motor es kMaxDestinations = 82
      expect(entries.maxDestinations).toBe(82);
    });

    it('la tabla del dato nombra el bloque comun y los destinos de fx en los mismos codigos', () => {
      const full = tables.FULL_MOD_DESTINATIONS;
      const entries = dsp.destEntries;

      // Arp y Secuenciador en 71 y 72
      expect(full[71]).toBe('Arp Gate');
      expect(entries.porCodigo.get(71)).toBe('kArpGate');
      expect(full[72]).toBe('Seq Slew');
      expect(entries.porCodigo.get(72)).toBe('kSeqSlew');

      // Los ocho de FX en el enum C++ (74-81)
      expect(entries.porCodigo.get(74)).toBe('kFx1Parameters');
      expect(entries.porCodigo.get(75)).toBe('kFx2Parameters');
      expect(entries.porCodigo.get(76)).toBe('kFx3Parameters');
      expect(entries.porCodigo.get(77)).toBe('kFx4Parameters');
      expect(entries.porCodigo.get(78)).toBe('kFx1Level');
      expect(entries.porCodigo.get(79)).toBe('kFx2Level');
      expect(entries.porCodigo.get(80)).toBe('kFx3Level');
      expect(entries.porCodigo.get(81)).toBe('kFx4Level');

      // MOD_DESTINATIONS tiene 73 elementos de sintesis base (0-72)
      expect(tables.MOD_DESTINATIONS.length).toBe(73);
    });

    it('los destinos que el manual no nombra no se inventan', () => {
      const full = tables.FULL_MOD_DESTINATIONS;
      const entradas = dsp.destEntries;

      expect(full.length).toBe(133);

      for (let codigo = 0; codigo < full.length; codigo++) {
        expect(full[codigo], `el codigo ${codigo} no tiene nombre`).not.toBe(`Dest ${codigo}`);
        expect(full[codigo], `el codigo ${codigo}`).toBeTruthy();
      }

      const repetidos = [...new Set(full)]
        .filter((nombre) => full.filter((n) => n === nombre).length > 1);
      expect(repetidos, `nombres repetidos en la tabla: ${repetidos.join(', ')}`).toEqual([]);

      const codigos = entradas.entradas.map((e) => e.codigo);
      expect(codigos.length).toBe(new Set(codigos).size);
    });

    it('el enum del motor existe y tiene al menos los destinos que cubre hoy', () => {
      expect(dsp.destinations.length).toBeGreaterThanOrEqual(
        MIN_COVERED_DESTINATIONS,
      );
    });

    it('el enum del motor contiene los destinos organizados por modulo', () => {
      const entries = dsp.destEntries;

      const ANCLA = [
        [0, 'kNone'],
        [1, 'kOsc1Pitch'],
        [2, 'kOsc2Pitch'],
        [3, 'kOsc1SquareWidth'],
        [4, 'kOsc2ToneMod'],
        [5, 'kOsc1Level'],
        [6, 'kOsc2Level'],
        [7, 'kSubOscLevel'],
        [8, 'kNoiseLevel'],
        [9, 'kFilterCutoff'],
        [10, 'kFilterResonance'],
        [11, 'kFilterEnvDepth'],
        [12, 'kFilterLfoDepth'],
        [13, 'kFilterKeyTrack'],
        [14, 'kFilterHPFCutoff'],
        [15, 'kAmpLevel'],
        [16, 'kAmpPan'],
        [17, 'kAmpPanSpread'],
        [18, 'kLfo1Rate'],
        [19, 'kLfo1Delay'],
        [20, 'kLfo1Slew'],
        [21, 'kLfo2Rate'],
        [22, 'kLfo2Delay'],
        [23, 'kLfo2Slew'],
        [24, 'kEnv1Attack'],
        [25, 'kEnv1Decay'],
        [26, 'kEnv1Sustain'],
        [27, 'kEnv1Release'],
        [28, 'kEnv2Attack'],
        [29, 'kEnv2Decay'],
        [30, 'kEnv2Sustain'],
        [31, 'kEnv2Release'],
        [32, 'kEnv3Attack'],
        [33, 'kEnv3Decay'],
        [34, 'kEnv3Sustain'],
        [35, 'kEnv3Release'],
        [71, 'kArpGate'],
        [72, 'kSeqSlew'],
        [74, 'kFx1Parameters'],
        [75, 'kFx2Parameters'],
        [76, 'kFx3Parameters'],
        [77, 'kFx4Parameters'],
        [78, 'kFx1Level'],
        [79, 'kFx2Level'],
        [80, 'kFx3Level'],
        [81, 'kFx4Level'],
      ];

      for (const [codigo, nombreEnum] of ANCLA) {
        expect(entries.porCodigo.get(codigo),
          `el motor ejecuta ${nombreEnum} en el ${codigo}`)
          .toBe(nombreEnum);
      }
      expect(entries.entradas.length).toBe(46);
    });

    it('informa de los destinos del byte que el motor cubre', () => {
      const entries = dsp.destEntries;

      // El tope declarado en el motor es kMaxDestinations = 82
      expect(entries.maxDestinations).toBe(82);

      // Número total de enumeradores declarados en C++
      expect(entries.entradas.length).toBe(46);

      // Ningún código está fuera del rango [0, 81]
      for (const e of entries.entradas) {
        expect(e.codigo).toBeGreaterThanOrEqual(0);
        expect(e.codigo).toBeLessThan(82);
      }
    });
  });
});
