/**
 * registryGen.test.js — Fase 1 · Paridad del registro generado (schemaVersion 1)
 *
 * Verifica que WebUI/js/registry.gen.js (artefacto .gen emitido por
 * scripts/registry_generator.js) es una proyección FIEL de sus tres fuentes:
 *   - WebUI/js/bridge-param-maps.js   (PARAM_TO_BYTE_OFFSET / PARAM_TO_CC /
 *                                      BIPOLAR_BYTES / ENUM_BYTES — canónico)
 *   - WebUI/js/byte_map_data.js       (BYTE_MAP, 242 bytes físicos)
 *   - resources/parameters_spec.json  (metadatos legacy)
 *
 * Cobertura:
 *   - schemaVersion === 1 e invariantes estructurales del esquema
 *   - Paridad de ids ↔ byteOffset con PARAM_TO_BYTE_OFFSET (sin pérdida/ganancia)
 *   - Paridad de codecType con BIPOLAR_BYTES / ENUM_BYTES
 *   - Paridad de cc con PARAM_TO_CC
 *   - Aliases conocidos {32, 88, 160} y sin colisiones NRPN nuevas
 *   - Categorías física / extendida / virtual
 *   - BYTE_MAP canónico: 242 entradas contiguas, regiones y desc preservadas
 *   - Metadatos legacy fusionados (name/desc/defaultValue) + specOnly
 *   - Coherencia rawToNormalized / normalizedToRaw del registro con el bridge
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import registry from '../js/registry.gen.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

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

  it('expone generatedAt ISO y sourceHashes de las 3 fuentes', () => {
    expect(registry.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(Object.keys(registry.sourceHashes).sort()).toEqual(
      ['bridgeParamMaps', 'byteMapData', 'parametersSpec'].sort()
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

  it('los únicos grupos multi-id son los alias conocidos {32, 88, 160}', () => {
    const multi = Object.entries(registry.byOffset).filter(([, ids]) => ids.length > 1);
    expect(multi.map(([o]) => Number(o)).sort((a, b) => a - b)).toEqual([32, 88, 160]);
    const expectedAliasPairs = [
      ['osc2_pm_source', 'osc2_pitch_mod_select'],
      ['voice_drift', 'osc_drift'],
      ['arp_gate_time', 'arp_gate'],
    ];
    for (const [o, ids] of multi) {
      const a = [...ids].sort();
      const exp = expectedAliasPairs.find(([x, y]) => a.includes(x) && a.includes(y));
      expect(exp, `grupo inesperado en ${o}`).toBeDefined();
      expect(a).toEqual([...exp].sort());
    }
    // aliases registrados bidireccionalmente
    for (const p of registry.parameters) {
      const others = registry.byOffset[p.byteOffset].filter((id) => id !== p.id);
      expect([...p.aliases].sort()).toEqual([...others].sort());
    }
  });

  it('categorías: 226 físicos · 3 extendidos (245-247) · 6 virtuales (300-305)', () => {
    const ext = registry.parameters.filter((p) => p.category === 'extended');
    const virt = registry.parameters.filter((p) => p.category === 'virtual');
    expect(ext.map((p) => p.id).sort()).toEqual(['vcf_korg_submode', 'vcf_model', 'vcf_moog_submode']);
    expect(ext.map((p) => p.byteOffset).sort()).toEqual([245, 246, 247]);
    expect(virt.map((p) => p.id).sort()).toEqual([
      'chord_enable', 'chord_key', 'chord_type', 'fx_feedback_gain', 'fx_send_level', 'poly_chord_enable',
    ]);
    expect(virt.map((p) => p.byteOffset).sort()).toEqual([300, 301, 302, 303, 304, 305]);
    expect(registry.summary.physical).toBe(226);
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

  it('parámetros spec-only quedan registrados sin byte físico', () => {
    expect(registry.specOnly.map((s) => s.id).sort()).toEqual(['slot_a_type', 'slot_b_type']);
    for (const s of registry.specOnly) {
      expect(registry.byId[s.id]).toBeUndefined();
      expect(s.block).toBe('custom');
    }
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
// 5c. Validación de regiones reservadas (RESERVED_BYTE_COLLISION)
// ════════════════════════════════════════════════════════════════

describe('registry_generator.js — regiones reservadas del preset', () => {
  it('el byteMap 223-241 queda sin id (nombre del patch + cola del payload)', () => {
    for (let i = 223; i <= 241; i++) {expect(registry.byteMap[i].id).toBeNull();}
  });

  it('el generador rechaza un parámetro físico en la región reservada (223-241)', () => {
    const { execFileSync } = require('node:child_process');
    const { tmpdir } = require('node:os');
    const fsMod = require('node:fs');

    // Copia temporal del bridge con un parámetro que usurpa el byte 223
    const srcBridge = path.join(ROOT, 'WebUI', 'js', 'bridge-param-maps.js');
    const tmpBridge = path.join(tmpdir(), 'bridge-param-maps-reserved-test.js');
    let code = fsMod.readFileSync(srcBridge, 'utf8');
    expect(code).toContain("'fx_feedback_gain': 304"); // guardia: el replace debe tener efecto
    code = code.replace("'fx_feedback_gain': 304", "'fx_feedback_gain': 223");
    fsMod.writeFileSync(tmpBridge, code);

    // Ejecuta el generador con REGISTRY_BRIDGE sobreescrito y artefactos de salida
    // APUNTANDO A UN DIR TEMPORAL (nunca toca los .gen commiteados aunque la
    // validación regresara y la generación llegara a completarse).
    const tmpOutDir = path.join(tmpdir(), 'registry-reserved-test-out');
    fsMod.mkdirSync(tmpOutDir, { recursive: true });
    const genSrc = fsMod.readFileSync(path.join(ROOT, 'scripts', 'registry_generator.js'), 'utf8');
    const tmpGen = path.join(tmpdir(), 'registry_generator-reserved-test.js');
    fsMod.writeFileSync(tmpGen, genSrc
      .replace('const ROOT = path.resolve(__dirname, \'..\');', 'const ROOT = ' + JSON.stringify(ROOT) + ';')
      .replace(
        "path.join(ROOT, 'WebUI', 'js', 'bridge-param-maps.js')",
        JSON.stringify(tmpBridge)
      )
      .replace(
        "path.join(ROOT, 'schemas', 'parameter-registry.data.json')",
        JSON.stringify(path.join(tmpOutDir, 'data.json'))
      )
      .replace(
        "path.join(ROOT, 'WebUI', 'js', 'registry.gen.js')",
        JSON.stringify(path.join(tmpOutDir, 'registry.gen.js'))
      )
      .replace(
        "path.join(ROOT, 'Source', 'Core', 'ParameterRegistry.gen.h')",
        JSON.stringify(path.join(tmpOutDir, 'ParameterRegistry.gen.h'))
      )
      .replace(
        "path.join(ROOT, 'Source', 'Core', 'ParameterRegistry.gen.cpp')",
        JSON.stringify(path.join(tmpOutDir, 'ParameterRegistry.gen.cpp'))
      ));

    let output = '';
    let exitCode = 0;
    try {
      execFileSync(process.execPath, [tmpGen], { cwd: ROOT, encoding: 'utf8' });
    } catch (e) {
      exitCode = e.status ?? 1;
      output = String(e.stdout || '') + String(e.stderr || '');
    }
    expect(exitCode).toBe(1);
    expect(output).toContain('RESERVED_BYTE_COLLISION');
    expect(output).toContain('fx_feedback_gain');

    // Limpieza
    fsMod.rmSync(tmpBridge, { force: true });
    fsMod.rmSync(tmpGen, { force: true });
    fsMod.rmSync(tmpOutDir, { recursive: true, force: true });
  });
});

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
