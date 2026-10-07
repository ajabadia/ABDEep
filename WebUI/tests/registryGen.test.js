/**
 * registryGen.test.js — Fase 1 · Paridad del registro generado (schemaVersion 1)
 *
 * Verifica que WebUI/js/registry.gen.js (artefacto .gen emitido por
 * scripts/registry_generator.js) es una proyección FIEL de sus fuentes:
 *   - WebUI/js/bridge-param-maps.js   (PARAM_TO_BYTE_OFFSET / PARAM_TO_CC /
 *                                      BIPOLAR_BYTES / ENUM_BYTES — canónico)
 *   - WebUI/js/byte_map_data.js       (BYTE_MAP, 242 bytes físicos)
 *   - resources/parameters_spec.json  (metadatos legacy)
 *   - Source/Core/ParametersSpec_*.cpp (el spec que declara el host)
 *
 * Cobertura:
 *   - schemaVersion === 1 e invariantes estructurales del esquema
 *   - Paridad de ids ↔ byteOffset con PARAM_TO_BYTE_OFFSET (sin pérdida/ganancia)
 *   - Paridad de codecType con BIPOLAR_BYTES / ENUM_BYTES
 *   - Paridad de cc con PARAM_TO_CC
 *   - Los TRES guards: ningún id del registro fuera del spec del host, ningún
 *     byte con dos ids, ningún spec-only sin consumidor (§5c)
 *   - Categorías física / extendida / virtual
 *   - BYTE_MAP canónico: 242 entradas contiguas, regiones y desc preservadas
 *   - Metadatos legacy fusionados (name/desc/defaultValue) + specOnly
 *   - Coherencia rawToNormalized / normalizedToRaw del registro con el bridge
 *   - sourceHashes calculados sobre la forma CANÓNICA de cada fuente (no los bytes
 *     del fichero): formato/comentarios no re-sellan el registro
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { nuevoArbol, ejecutaGenerador, borraArbol, huellaDeArtefactos, digest } from './helpers/arbolTemporal.js';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// La forma canónica, y ahora hay UN solo sitio donde vive: el propio generador.
// Antes venía de `scripts/registry_core.ts`, el núcleo del `registry_generator.ts`
// que convivía con el `.js` —los dos escribían los mismos cuatro artefactos, y el
// `.ts` además leía mal `BIPOLAR_BYTES` y perdía los 43 parámetros bipolares—.
// Con un único generador, importar sus funciones puras es seguro: `main()` solo
// se llama cuando el fichero es el punto de entrada, así que este import no
// escribe nada.
import { canonicalizeSource } from '../../scripts/registry_generator.js';

import registry from '../js/registry.gen.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
// El spec del host. Son cinco ficheros, no uno: por eso se lee el directorio.
const SPEC_CPP_DIR = path.join(ROOT, 'Source', 'Core');

// ── Cargar fuentes reales (mismo sandbox que registry_generator.js) ──
function loadJsGlobal(relPath) {
  const code = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
  const sandbox = { window: {} };
  const fn = new Function('window', code + '\n;return window;');
  return fn(sandbox.window);
}

const bridgeWin = loadJsGlobal('WebUI/js/bridge-param-maps.js');
const BRIDGE = bridgeWin.BRIDGE_PARAM_MAPS;
const byteWin = loadJsGlobal('WebUI/js/byte_map_data.js');
const BYTE_MAP = byteWin.BYTE_MAP;
const SPEC = JSON.parse(fs.readFileSync(path.join(ROOT, 'resources', 'parameters_spec.json'), 'utf8')).parameters;
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas', 'parameter-registry.data.json'), 'utf8'));

// ════════════════════════════════════════════════════════════════
// 1. Estructura del registro
// ════════════════════════════════════════════════════════════════

describe('registry.gen.js — estructura (schemaVersion 1)', () => {
  it('expone schemaVersion === 1', () => {
    expect(registry.schemaVersion).toBe(1);
  });

  it('expone generatedAt ISO y sourceHashes de las 4 fuentes', () => {
    // La cuarta es el spec del host (Source/Core/ParametersSpec_*.cpp). Se
    // sella también: si el spec cambia y el registro no, el guard 1 lo ve, pero
    // el hash deja constancia en el artefacto de que el registro se generó
    // contra una versión del spec que ya no es la del repo.
    expect(registry.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(Object.keys(registry.sourceHashes).sort()).toEqual(
      ['bridgeParamMaps', 'byteMapData', 'parametersSpec', 'parametersSpecCpp'].sort()
    );
    for (const h of Object.values(registry.sourceHashes)) {
      expect(h).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('tiene exactamente los parámetros del bridge (235) con index contiguo', () => {
    expect(registry.parameters.length).toBe(Object.keys(BRIDGE.PARAM_TO_BYTE_OFFSET).length);
    registry.parameters.forEach((p, i) => expect(p.index).toBe(i));
  });

  it('todos los ids cumplen el patrón y los cppName son identificadores únicos', () => {
    const cpp = new Set();
    for (const p of registry.parameters) {
      expect(p.id).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(p.cppName).toMatch(/^[A-Z][A-Za-z0-9]*$/);
      expect(cpp.has(p.cppName)).toBe(false);
      cpp.add(p.cppName);
    }
  });

  it('no hay ids duplicados ni offsets fuera de rango', () => {
    const ids = new Set();
    for (const p of registry.parameters) {
      expect(ids.has(p.id)).toBe(false);
      ids.add(p.id);
      expect(p.byteOffset).toBeGreaterThanOrEqual(0);
      expect(p.byteOffset).toBeLessThanOrEqual(399);
    }
  });

  it('resumen consistente con los datos', () => {
    const s = registry.summary;
    expect(s.total).toBe(registry.parameters.length);
    expect(s.physical + s.extended + s.virtual).toBe(s.total);
    expect(s.enumCount + s.bipolarCount + s.valueCount).toBe(s.total);
  });
});

// ════════════════════════════════════════════════════════════════
// 2. Paridad con PARAM_TO_BYTE_OFFSET
// ════════════════════════════════════════════════════════════════

describe('registry.gen.js — paridad byteOffset', () => {
  it('cada id del bridge → mismo byteOffset en el registro (sin pérdida ni ganancia)', () => {
    for (const [id, off] of Object.entries(BRIDGE.PARAM_TO_BYTE_OFFSET)) {
      const p = registry.byId[id];
      expect(p, `falta ${id} en el registro`).toBeDefined();
      expect(p.byteOffset, `offset distinto para ${id}`).toBe(Number(off));
    }
    expect(Object.keys(registry.byId).length).toBe(Object.keys(BRIDGE.PARAM_TO_BYTE_OFFSET).length);
  });

  it('byOffset devuelve todos los ids de cada offset', () => {
    const bySource = {};
    for (const [id, off] of Object.entries(BRIDGE.PARAM_TO_BYTE_OFFSET)) {
      (bySource[off] = bySource[off] || []).push(id);
    }
    for (const [off, ids] of Object.entries(bySource)) {
      const got = registry.byOffset[off];
      expect(got).toBeDefined();
      expect([...got].sort()).toEqual([...ids].sort());
    }
  });

  // El guard 2 del generador (NRPN_COLLISION) hace que un byte con dos ids sea
  // un ERROR, no un alias conocido. Este test es el otro lado de la puerta: si
  // alguien reintrodujera un byte con dos nombres, el generador ya lo impediría,
  // y si alguien lo metiera por la puerta de atrás (editando el .gen a mano),
  // este test lo vería.
  it('ningún byte tiene dos ids (el guard 2 lo vuelve error)', () => {
    const multi = Object.entries(registry.byOffset).filter(([, ids]) => ids.length > 1);
    expect(multi.map(([off, ids]) => `byte ${off}: ${ids.join(' + ')}`)).toEqual([]);
    expect(registry.summary.aliasGroups).toBe(0);

    // Y ningún parámetro arrastra un alias: con aliasGroups=0, aliases es siempre [].
    for (const p of registry.parameters) {
      expect(p.aliases, `${p.id} tiene aliases pero su byte es único`).toEqual([]);
    }
  });

  // `chord_key` (byte 302) fue eliminado del registro por decision de diseno: el
  // hardware DeepMind tiene Chord Memory como memoria global sin raiz editable
  // (la raiz es la nota que se pulsa al grabar). El registro, la spec y el APVTS
  // ya no lo declaran; esta assertion esperaba los 7 virtuales antiguos y se
  // quedo atras. Ver SynthEngineUnitTests_VirtualParams.cpp (testChordKeyEliminado).
  it('categorías: 223 físicos · 3 extendidos (245-247) · 6 virtuales (300-306, sin 302)', () => {
    const ext = registry.parameters.filter((p) => p.category === 'extended');
    const virt = registry.parameters.filter((p) => p.category === 'virtual');
    expect(ext.map((p) => p.id).sort()).toEqual(['vcf_korg_submode', 'vcf_model', 'vcf_moog_submode']);
    expect(ext.map((p) => p.byteOffset).sort()).toEqual([245, 246, 247]);
    expect(virt.map((p) => p.id).sort()).toEqual([
      'chord_enable', 'chord_type', 'fx_feedback_gain', 'fx_send_level', 'poly_chord_enable',
      'vcf_voicing_mode',
    ]);
    expect(virt.map((p) => p.byteOffset).sort()).toEqual([300, 301, 303, 304, 305, 306]);
    expect(registry.summary.physical).toBe(223);
    expect(registry.summary.virtual).toBe(6);
  });
});

// ════════════════════════════════════════════════════════════════
// 3. Paridad de tipos (codec) y CC
// ════════════════════════════════════════════════════════════════

describe('registry.gen.js — codecType y CC', () => {
  it('codecType coincide con BIPOLAR_BYTES y ENUM_BYTES', () => {
    for (const p of registry.parameters) {
      const isBipolar = BRIDGE.BIPOLAR_BYTES.has(p.byteOffset);
      const isEnum = Object.prototype.hasOwnProperty.call(BRIDGE.ENUM_BYTES, String(p.byteOffset));
      if (isBipolar && isEnum) {
        // invariante de las fuentes: un byte no es ambas cosas
        expect(true).toBe(false);
      }
      const expected = isEnum ? 'enum' : (isBipolar ? 'bipolar' : 'value');
      expect(p.codecType, `codecType erróneo para ${p.id}`).toBe(expected);
    }
  });

  it('enumMax coincide con ENUM_BYTES para enums', () => {
    for (const p of registry.parameters.filter((p) => p.codecType === 'enum')) {
      expect(p.enumMax).toBe(Number(BRIDGE.ENUM_BYTES[String(p.byteOffset)]));
    }
  });

  it('cc coincide con PARAM_TO_CC (canónico) y registra legacyCC divergente', () => {
    for (const p of registry.parameters) {
      const canonical = BRIDGE.PARAM_TO_CC[p.id];
      if (canonical !== undefined) {
        expect(p.cc, `cc canónico para ${p.id}`).toBe(Number(canonical));
        // conflicto legítimo cuando ambas fuentes definen CC distintos
        expect(p.ccConflict).toBe(p.legacyCC !== null && p.legacyCC !== p.cc);
      } else if (p.legacyCC !== null) {
        expect(p.cc).toBeNull();
        expect(p.ccConflict).toBe(false);
      } else {
        expect(p.cc).toBeNull();
        expect(p.ccConflict).toBe(false);
      }
    }
    // 8 divergencias legacy conocidas (comparisonMode §6)
    expect(registry.parameters.filter((p) => p.ccConflict).length).toBe(8);
  });
});

// ════════════════════════════════════════════════════════════════
// 4. BYTE_MAP canónico
// ════════════════════════════════════════════════════════════════

describe('registry.gen.js — byteMap canónico (242 bytes)', () => {
  it('242 entradas contiguas con param/region/type preservados', () => {
    expect(registry.byteMap.length).toBe(242);
    registry.byteMap.forEach((b, i) => {
      expect(b.idx).toBe(i);
      expect(BYTE_MAP[i]).toBeDefined();
      expect(b.param).toBe(BYTE_MAP[i].param);
      expect(b.region).toBe(BYTE_MAP[i].region);
      expect(b.type).toBe(BYTE_MAP[i].type);
      expect(b.desc).toBe(BYTE_MAP[i].desc || null);
    });
  });

  it('los bytes físicos con parámetro apuntan al id correcto (y los gaps a null)', () => {
    for (const b of registry.byteMap) {
      const ids = registry.byOffset[b.idx];
      if (ids && ids.length > 0) {
        expect(b.id).toBe(ids[0]);
      } else {
        expect(b.id).toBeNull();
      }
    }
    // Región reservada del preset (nombre del patch 223-238 + cola 239-241):
    // ningún byte puede tener id tras el fix de fx_feedback_gain/fx_send_level.
    for (let i = 223; i <= 241; i++) {expect(registry.byteMap[i].id).toBeNull();}
  });
});

// ════════════════════════════════════════════════════════════════
// 5. Metadatos legacy fusionados
// ════════════════════════════════════════════════════════════════

describe('registry.gen.js — fusión con parameters_spec.json', () => {
  it('name/desc/defaultValue de la spec se fusionan cuando el id coincide', () => {
    const cutoff = registry.byId.vcf_cutoff;
    expect(cutoff.name).toBe('VCF Cutoff');
    expect(cutoff.desc).toContain('corte del filtro');
    expect(cutoff.defaultValue).toBeCloseTo(1.0, 5); // spec default 1.0 en [0..1]
    const pwm = registry.byId.osc1_pwm_amount;
    expect(pwm.defaultValue).toBeCloseTo(0.5, 5);    // spec default 0.5 en [0..1]
    const range = registry.byId.osc1_range;
    expect(range.enumLabels).toEqual(["16'", "8'", "4'"]); // BYTE_MAP sí define labels
    expect(range.defaultValue).toBeCloseTo(0.5, 5);          // "8'" es el índice 1 de ["16'","8'","4'"]
  });

  // El guard 3 (SPECONLY_UNCONSUMED) borra del spec lo que nadie consume. Los dos
  // restos de otra nomenclatura (`slot_a_type` / `slot_b_type`, con opciones
  // OSC1_Style/OSC2_Style que este synth no tiene) se borraron del spec y del
  // JSON, así que ya no queda ningún spec-only en el JSON legacy.
  it('no queda ningún spec-only en el JSON legacy', () => {
    expect(registry.specOnly.map((s) => s.id)).toEqual([]);
    expect(registry.summary.specOnlyCount).toBe(0);
  });

  it('warnings documentan las divergencias CC legacy (no fatales)', () => {
    expect(registry.warnings.length).toBe(8);
    for (const w of registry.warnings) {
      expect(w.code).toBe('CC_LEGACY_DIVERGENCE');
      expect(w.message).toContain('comparisonMode');
    }
  });
});

// ════════════════════════════════════════════════════════════════
// 5c. Los tres guards: el registro no se contradice con el spec
// ════════════════════════════════════════════════════════════════
//
// Estos tres son el otro lado de los guards del generador. El generador los
// aplica al CONSTRUIR; estos comprueban el resultado ya escrito, así que también
// cazan a alguien que edite un .gen a mano o que suba artefactos viejos.

describe('los tres guards — el registro no se contradice con el spec del host', () => {
  // El spec que declara el host: las entradas `{ "id", "Name", "block", "type" }`
  // de Source/Core/ParametersSpec_*.cpp. El JSON legacy son 15 metadatos, no el
  // spec, y compararlos daría 220 falsos positivos.
  const SPEC_CPP_RE = /\{\s*"([a-z0-9_]+)"\s*,\s*"([^"]*)"\s*,\s*"([^"]*)"\s*,\s*"([a-z]+)"/g;
  const specCppIds = fs
    .readdirSync(SPEC_CPP_DIR)
    .filter((f) => /^ParametersSpec(_[A-Za-z]+)?\.cpp$/.test(f))
    .flatMap((f) => {
      const text = fs.readFileSync(path.join(SPEC_CPP_DIR, f), 'utf8');
      return [...text.matchAll(SPEC_CPP_RE)].map((m) => m[1]);
    });
  const specCppSet = new Set(specCppIds);

  it('GUARD 1: todo id del registro lo declara el host (ninguna escritura sin destino)', () => {
    const huerfanos = registry.parameters.filter((p) => !specCppSet.has(p.id));
    expect(huerfanos.map((p) => `${p.id} @byte ${p.byteOffset}`)).toEqual([]);
  });

  it('GUARD 1: y tampoco hay ids sin declarar en PARAM_TO_CC', () => {
    // El mapa del puente tiene DOS tablas de ids. Un id que solo aparece en la
    // de CC es un CC que responde a un mando que el host no declara: el mismo
    // defecto que el del byte, pero que además se puede mover desde el MIDI
    // externo. El generador lo mira en las dos (CC_ID_NOT_IN_SPEC).
    const huerfanosCC = Object.keys(BRIDGE.PARAM_TO_CC || {}).filter(
      (id) => !specCppSet.has(id)
    );
    expect(huerfanosCC).toEqual([]);
  });

  it('GUARD 1: los CC sin byte son los globales de la APVTS, y están declarados', () => {
    // Estos tres sí son legítimos: son de la APVTS y no tienen byte en el preset
    // porque no son del sintet. No necesitan lista de escapes — están en el spec.
    const ccSinByte = Object.keys(BRIDGE.PARAM_TO_CC || {}).filter(
      (id) => !Object.prototype.hasOwnProperty.call(BRIDGE.PARAM_TO_BYTE_OFFSET, id)
    );
    expect(ccSinByte.sort()).toEqual(['global_tune', 'global_volume', 'transpose']);
    for (const id of ccSinByte) expect(specCppSet.has(id)).toBe(true);
  });

  it('GUARD 1: los dos huérfanos que existían no vuelven', () => {
    // `osc2_pitch_mod_select` pisaba el byte 32 de `osc2_pm_source`, que sí suena;
    // `arp_gate` duplicaba el byte 160 y el CC 13 de `arp_gate_time`. Los dos
    // estaban en el mapa del puente sin estar en el spec.
    expect(specCppSet.has('osc2_pitch_mod_select')).toBe(false);
    expect(specCppSet.has('arp_gate')).toBe(false);
    expect(BRIDGE.PARAM_TO_BYTE_OFFSET['osc2_pitch_mod_select']).toBeUndefined();
    expect(BRIDGE.PARAM_TO_BYTE_OFFSET['arp_gate']).toBeUndefined();
    // El byte que pisaban sigue siendo del parámetro que sí suena.
    expect(registry.byId.osc2_pm_source.byteOffset).toBe(32);
    expect(registry.byId.arp_gate_time.byteOffset).toBe(160);
  });

  it('GUARD 2: ningún byteOffset aparece en dos ids', () => {
    const byOffset = {};
    for (const p of registry.parameters) (byOffset[p.byteOffset] ??= []).push(p.id);
    const colisiones = Object.entries(byOffset).filter(([, ids]) => ids.length > 1);
    expect(colisiones.map(([b, ids]) => `byte ${b}: ${ids.join(' + ')}`)).toEqual([]);
  });

  it('GUARD 2: los tres bytes que compartían ya no comparten', () => {
    const byOffset = {};
    for (const p of registry.parameters) (byOffset[p.byteOffset] ??= []).push(p.id);
    // 32 = osc2_pm_source (+ el huérfano), 88 = voice_drift (+ osc_drift),
    // 160 = arp_gate_time (+ arp_gate). Los tres se han repartido.
    expect(byOffset[32]).toEqual(['osc2_pm_source']);
    expect(byOffset[88]).toEqual(['voice_drift']);
    expect(byOffset[160]).toEqual(['arp_gate_time']);
    // Y `osc_drift` ya no está en el mapa del puente (el drift tiene tres
    // parámetros vivos: voice_drift, param_drift, drift_rate).
    expect(BRIDGE.PARAM_TO_BYTE_OFFSET['osc_drift']).toBeUndefined();
  });

  it('GUARD 3: ningún spec del host sin byte se queda fuera de la lista de consumidos', () => {
    // Los 16 declarados-sin-byte que quedan son globales de la APVTS o ids que
    // el motor construye por prefijo. Este test carga la MISMA lista que el
    // generador, para que las dos no puedan separarse.
    const consumidos = new Set(
      fs
        .readFileSync(path.join(ROOT, 'scripts', 'registry_generator.js'), 'utf8')
        .match(/SPECONLY_CONSUMIDOS = new Map\(\[([\s\S]*?)\n\]\)/)[1]
        .matchAll(/\['([a-z0-9_]+)'/g)
        .map((m) => m[1]),
    );
    const sinByte = specCppIds.filter((id) => !Object.prototype.hasOwnProperty.call(BRIDGE.PARAM_TO_BYTE_OFFSET, id));
    const sinConsumidor = sinByte.filter((id) => !consumidos.has(id));
    expect(sinConsumidor).toEqual([]);
    // Y la lista no tiene entradas muertas (SPECONLY_ALLOWLIST_STALE).
    const muertas = [...consumidos].filter((id) => !sinByte.includes(id));
    expect(muertas).toEqual([]);
  });

  it('GUARD 3: el byte 0 no se confunde con "sin byte"', () => {
    // `lfo1_rate` está en el byte 0, y `!0` es `true`: un guard escrito con
    // truthiness declararía sin byte al primer parámetro del registro. El
    // generador usa hasOwnProperty por esto, y aquí se comprueba.
    expect(BRIDGE.PARAM_TO_BYTE_OFFSET['lfo1_rate']).toBe(0);
    expect(sinByte()).not.toContain('lfo1_rate');
    function sinByte() {
      return specCppIds.filter((id) => !Object.prototype.hasOwnProperty.call(BRIDGE.PARAM_TO_BYTE_OFFSET, id));
    }
  });
});

// ════════════════════════════════════════════════════════════════
// 5b. Consistencia data.json ↔ registry.gen.js
// ════════════════════════════════════════════════════════════════

describe('registry.gen.js — consistencia con schemas/parameter-registry.data.json', () => {
  it('mismos schemaVersion, parámetros, byteMap y summary que la instancia canónica', () => {
    expect(registry.schemaVersion).toBe(DATA.schemaVersion);
    expect(registry.parameters.length).toBe(DATA.parameters.length);
    expect(registry.byteMap.length).toBe(DATA.byteMap.length);
    expect(registry.summary).toEqual(DATA.summary);
  });

  it('cada parámetro del data.json existe con los mismos campos esenciales en el registro', () => {
    for (const p of DATA.parameters) {
      const r = registry.byId[p.id];
      expect(r, `falta ${p.id} en registry.gen.js`).toBeDefined();
      expect(r.byteOffset).toBe(p.byteOffset);
      expect(r.codecType).toBe(p.codecType);
      expect(r.cc).toBe(p.cc);
      expect(r.legacyCC).toBe(p.legacyCC);
      expect(r.cppName).toBe(p.cppName);
      expect(r.index).toBe(p.index);
    }
  });

  it('los sourceHashes del data.json cubren las 3 fuentes y el byteMap canónico coincide', () => {
    for (const k of ['parametersSpec', 'bridgeParamMaps', 'byteMapData']) {
      expect(DATA.sourceHashes[k]).toMatch(/^[0-9a-f]{64}$/);
    }
    for (let i = 0; i < 242; i++) {
      expect(registry.byteMap[i].id).toBe(DATA.byteMap[i].id);
      expect(registry.byteMap[i].region).toBe(DATA.byteMap[i].region);
    }
  });
});

// ════════════════════════════════════════════════════════════════
// 5b-bis. sourceHashes sobre la forma CANÓNICA (no los bytes)
// ════════════════════════════════════════════════════════════════

describe('registry.gen.js — sourceHashes canónicos (estables ante formato/comentarios)', () => {
  // `canonicalizeSource` devuelve el VALOR canónico; el hash es de su JSON (igual que
  // hacen los generadores: sha256(JSON.stringify(canonicalizeSource(fuente)))).
  const hash = (value) => createHash('sha256')
    .update(JSON.stringify(canonicalizeSource(value))).digest('hex');

  it('coinciden con el hash de la forma canónica de cada fuente', () => {
    // `canonicalizeSource` y el hash que sale en el artefacto los produce el MISMO
    // fichero ahora, así que esto ya no es una comprobación de paridad entre dos
    // implementaciones: es que el generador es reproducible, que es lo que
    // quiere decir un `sourceHashes`.
    expect(registry.sourceHashes.parametersSpec).toBe(hash(SPEC));
    expect(registry.sourceHashes.bridgeParamMaps).toBe(hash(BRIDGE));
    expect(registry.sourceHashes.byteMapData).toBe(hash(BYTE_MAP));
  });

  it('reformatear el JSON de la spec (indentación/espacios) NO cambia el hash', () => {
    const fileText = fs.readFileSync(path.join(ROOT, 'resources', 'parameters_spec.json'), 'utf8');
    // El generador hashea el ARRAY de parámetros (raw.parameters), no el envoltorio.
    const value = JSON.parse(fileText).parameters;
    // Serializaciones distintas (compacta, 2 y 8 espacios con saltos extra) que parsean
    // al MISMO valor: el hash canónico debe ser idéntico en todas.
    const variants = [
      JSON.stringify(value),
      JSON.stringify(value, null, 2) + '\n',
      '\n\n' + JSON.stringify(value, null, 8) + '\n\n',
    ];
    expect(new Set(variants).size).toBe(variants.length); // los formatos difieren entre sí
    expect(variants.some((t) => t !== fileText)).toBe(true); // y del fichero commiteado
    for (const text of variants) {
      expect(hash(JSON.parse(text))).toBe(registry.sourceHashes.parametersSpec);
    }
  });

  it('un cambio REAL de datos (no de formato) SÍ cambia el hash', () => {
    const tweaked = JSON.parse(JSON.stringify(SPEC));
    tweaked[0].default = 'VALOR_DISTINTO';
    expect(hash(tweaked)).not.toBe(registry.sourceHashes.parametersSpec);
  });

  it('el orden de las claves de un objeto no afecta al hash', () => {
    // Mismas entradas que BRIDGE (los datos, sin las funciones) pero en orden INVERTIDO.
    const entries = Object.entries(BRIDGE)
      .filter(([, v]) => typeof v !== 'function')
      .reverse();
    expect(hash(Object.fromEntries(entries))).toBe(registry.sourceHashes.bridgeParamMaps);
  });

  it('el Set BIPOLAR_BYTES cuenta en el hash (JSON.stringify(Set) sería "{}")', () => {
    // Guardia del caso `Set`: sin normalizarlo, el hash del bridge ignoraría en
    // silencio la lista de bytes bipolares (que es la mitad del codec del bridge).
    expect(JSON.stringify(BRIDGE.BIPOLAR_BYTES)).toBe('{}');
    const tweaked = { ...BRIDGE, BIPOLAR_BYTES: new Set([...BRIDGE.BIPOLAR_BYTES].slice(1)) };
    expect(hash(tweaked)).not.toBe(registry.sourceHashes.bridgeParamMaps);
  });
});

// ════════════════════════════════════════════════════════════════
// 5c. Validación de regiones reservadas (RESERVED_BYTE_COLLISION)
// ════════════════════════════════════════════════════════════════

describe('registry_generator.js — regiones reservadas del preset', () => {
  it('el byteMap 223-241 queda sin id (nombre del patch + cola del payload)', () => {
    for (let i = 223; i <= 241; i++) {expect(registry.byteMap[i].id).toBeNull();}
  });

  it('el generador rechaza un parámetro físico en la región reservada (223-241)', () => {
    // El generador deriva ROOT de su propia ubicación, y `verificarRutas`
    // exige además que `path.relative(ROOT, OUT[...])` coincida con el manifiesto
    // ARTEFACTOS. La forma que se usaba antes —copiar el fuente del generador y
    // reescribir por texto las cuatro rutas de salida— choca con las dos cosas:
    // sale con MANIFIESTO_DESINCRONIZADO antes de llegar al byte 223, y encima
    // el `replace` de ROOT buscaba `__dirname` cuando el generador usa
    // `import.meta.dirname`, así que no aplicaba: ROOT apuntaba al temporal por
    // casualidad, que es lo único que separaba al test del repo.
    //
    // Con la COPIA del árbol, ROOT es el temporal y las cuatro salidas caen
    // dentro de él por construcción. No queda ninguna cadena que pueda dejar de
    // coincidir, y la mutilación se hace sobre la copia: el bridge de la copia
    // con un parámetro que usurpa el byte 223.
    const antes = huellaDeArtefactos();
    const arbol = nuevoArbol();
    try {
      const puente = path.join(arbol, 'WebUI', 'js', 'bridge-param-maps.js');
      const codigo = fs.readFileSync(puente, 'utf8');
      expect(codigo, 'el bridge ya no declara fx_feedback_gain en el byte 304').toContain("'fx_feedback_gain': 304");
      fs.writeFileSync(puente, codigo.replace("'fx_feedback_gain': 304", "'fx_feedback_gain': 223"));

      const r = ejecutaGenerador(arbol);
      expect(r.codigo, `el generador debería salir con 1, y salió con ${r.codigo}:\n${r.salida}`).toBe(1);
      expect(r.salida).toContain('RESERVED_BYTE_COLLISION');
      expect(r.salida).toContain('fx_feedback_gain');

      // Lo que se comprueba de verdad: que el caso negativo no se ha colado en el
      // repo. Si algún día esto se ejecutara contra el repo, el byteMap commiteado
      // se reescribiría con la colisión dentro y el rojo aparecería en el sitio
      // equivocado —en el repo, entre archivos de otra sesión— en vez de aquí.
      for (const [rel, huella] of antes) {
        expect(
          digest(fs.readFileSync(path.join(ROOT, rel), 'utf8')),
          `${rel} ha cambiado: este test no debe escribir en el repo`,
        ).toBe(huella);
      }
    } finally {
      borraArbol(arbol);
    }
  });
}, 30000);

// ════════════════════════════════════════════════════════════════
// 6. Coherencia del codec del registro vs bridge
// ════════════════════════════════════════════════════════════════

describe('registry.gen.js — codec coherente con bridge-param-maps', () => {
  it('rawToNormalized coincide con bridge para value/bipolar/enum', () => {
    const samples = [0, 1, 42, 64, 127, 128, 200, 254, 255];
    for (const p of registry.parameters) {
      for (const raw of samples) {
        const mine = registry.rawToNormalized(p.byteOffset, raw);
        const theirs = BRIDGE.rawToNormalized(p.byteOffset, raw);
        expect(mine, `rawToNormalized(${p.id}, ${raw})`).toBeCloseTo(theirs, 5);
      }
    }
  });

  it('normalizedToRaw coincide con bridge para value/bipolar/enum', () => {
    const samples = [0.0, 0.1, 0.25, 0.5, 0.75, 0.9, 1.0];
    for (const p of registry.parameters) {
      for (const n of samples) {
        const mine = registry.normalizedToRaw(p.byteOffset, n);
        const theirs = BRIDGE.normalizedToRaw(p.byteOffset, n);
        expect(mine, `normalizedToRaw(${p.id}, ${n})`).toBe(theirs);
      }
    }
  });

  it('round-trip raw → normalized → raw es estable (±1) para raw válido', () => {
    for (const p of registry.parameters) {
      // para enums, el raw válido es [0..enumMax] (fuera de rango hace clamp, igual que el bridge)
      const maxRaw = p.codecType === 'enum' ? p.enumMax : 255;
      for (let raw = 0; raw <= maxRaw; raw += Math.max(1, Math.floor(maxRaw / 8))) {
        const norm = registry.rawToNormalized(p.byteOffset, raw);
        const back = registry.normalizedToRaw(p.byteOffset, norm);
        expect(Math.abs(back - raw), `round-trip ${p.id} raw=${raw}`).toBeLessThanOrEqual(1);
      }
    }
  });
});
