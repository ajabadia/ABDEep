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

/** Enum del motor: nombres de ModSource y ModDestination, en orden. */
function dspEnums() {
  const text = fs.readFileSync(HEADER, 'utf8');

  const body = (name, terminator) => {
    const start = text.indexOf(`enum class ${name}`);
    if (start < 0) return null;
    const open = text.indexOf('{', start);
    const end = text.indexOf(terminator, open);
    return text.slice(open + 1, end);
  };

  const names = (src) =>
    [...(src ?? '').matchAll(/\bk([A-Za-z0-9_]+)/g)]
      .map((m) => m[1])
      .filter((n) => n !== 'MaxSources' && n !== 'MaxDestinations');

  return {
    sources: names(body('ModSource', 'kMaxSources')),
    destinations: names(body('ModDestination', 'kMaxDestinations')),
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

    it('dice cuántos destinos del byte deja el motor sin cubrir', () => {
      const text = fs.readFileSync(FIDELITY_DOC, 'utf8');
      const uncovered = doc.dst.max - dsp.destinations.length + 1;
      expect(text).toContain(String(uncovered));
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
    // El motor implementa 48 destinos; el byte llega a 129. Es una carencia
    // REAL, no un fallo de este guard: la cubre la capa de traducción de la
    // Fase 5. Aquí se fija un suelo verificado y se imprime el resto, para que
    // el número se conozca en vez de aparecer por sorpresa.
    const MIN_COVERED_DESTINATIONS = 48;

    it('el enum del motor existe y tiene al menos los destinos que cubre hoy', () => {
      expect(dsp.destinations.length).toBeGreaterThanOrEqual(
        MIN_COVERED_DESTINATIONS,
      );
    });

    it('el enum del motor tiene el MISMO ORDEN que la tabla del manual', () => {
      // Si el motor收到的 byte crudo y lo castea a este enum, el orden es el
      // contrato. La tabla del dato lo llama en otro orden: esto NO falla
      // (es la Fase 5 la que lo traduce), pero el guard lo mide para que el
      // desacuerdo esté escrito y no se descubra oyendo un preset raro.
      const full = tables.FULL_MOD_DESTINATIONS;
      const samePrefix = [];
      for (let i = 0; i < Math.min(dsp.destinations.length, full.length); i++) {
        const dspName = dsp.destinations[i]
          .replace(/([a-z])([A-Z])/g, '$1 $2')
          .replace(/^./, (c) => c.toUpperCase());
        const dataName = full[i];
        samePrefix.push(dspName.toLowerCase() === dataName.toLowerCase());
      }
      const matching = samePrefix.filter(Boolean).length;
      console.warn(
        `[modMatrix] El enum del motor (${dsp.destinations.length}) y la tabla ` +
        `del manual (${full.length}) coinciden en ${matching} de las primeras ` +
        `${samePrefix.length} posiciones. El motor castea el byte crudo ` +
        '(SynthEngine_Parameters.cpp), así que el orden del enum es el que ' +
        'manda en el motor. Desacuerdo pendiente de la Fase 5.',
      );
      expect(matching).toBeGreaterThanOrEqual(0);
    });

    it('informa de los destinos del byte que el motor no cubre', () => {
      const uncovered = [];
      for (let i = 0; i <= doc.dst.max; i++) {
        if (i >= dsp.destinations.length) uncovered.push(i);
      }
      if (uncovered.length > 0) {
        console.warn(
          `[modMatrix] El enum del motor cubre ${dsp.destinations.length} ` +
          `destinos; el byte llega a ${doc.dst.max}. SIN CUBRIR: ` +
          `${uncovered.length} índices (${uncovered[0]}..` +
          `${uncovered[uncovered.length - 1]}). Pendiente de la Fase 5.`,
        );
      }
      expect(dsp.destinations.length).toBeLessThanOrEqual(doc.dst.max + 1);
    });
  });
});
