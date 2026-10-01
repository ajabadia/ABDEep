// registry_core.test.ts — Unit tests for registry_core.ts
// Run: npm test (requires vitest)

import { describe, it, expect, vi } from 'vitest';
import {
  toPascalCase,
  formatCppFloat,
  normalizeSpecType,
  computeDefaultNormalized,
  determineCodecType,
  determineCategory,
  checkReservedRegions,
  validateAndBuildRegistry,
  parseSpecCppIds,
  indexSpecCppIds,
  SPECONLY_CONSUMIDOS,
  generateRegistryOutput,
  KNOWN_ALIAS_OFFSETS,
  RESERVED_PHYSICAL_REGIONS,
} from './registry_core.ts';

// Mock crypto.subtle for tests
const mockSha256 = vi.fn(async (text: string) => 'abc123');
vi.stubGlobal('crypto', {
  subtle: { digest: mockSha256 },
});

describe('registry_core', () => {
  describe('toPascalCase', () => {
    it('converts snake_case to PascalCase', () => {
      expect(toPascalCase('osc1_wave')).toBe('Osc1Wave');
      expect(toPascalCase('filter_cutoff')).toBe('FilterCutoff');
    });
    it('handles multiple underscores', () => {
      expect(toPascalCase('lfo_1_rate')).toBe('Lfo1Rate');
    });
    it('handles single word', () => {
      expect(toPascalCase('volume')).toBe('Volume');
    });
  });

  describe('formatCppFloat', () => {
    it('adds f suffix to floats', () => {
      expect(formatCppFloat(1.0)).toBe('1.0f');
      expect(formatCppFloat(0.5)).toBe('0.5f');
    });
    it('adds .0f to integers', () => {
      expect(formatCppFloat(42)).toBe('42.0f');
      expect(formatCppFloat(0)).toBe('0.0f');
    });
    it('handles null', () => {
      expect(formatCppFloat(null)).toBe('-1.0f');
    });
  });

  describe('normalizeSpecType', () => {
    it('resolves aliases', () => {
      expect(normalizeSpecType('bool')).toBe('boolean');
      expect(normalizeSpecType('int')).toBe('integer');
      expect(normalizeSpecType('float')).toBe('continuous');
    });
    it('passes through unknown types', () => {
      expect(normalizeSpecType('custom')).toBe('custom');
    });
    it('handles undefined', () => {
      expect(normalizeSpecType(undefined)).toBe('continuous');
    });
  });

  describe('computeDefaultNormalized', () => {
    it('handles boolean true/false', () => {
      expect(computeDefaultNormalized({ type: 'bool', default: true })).toBe(1);
      expect(computeDefaultNormalized({ type: 'bool', default: false })).toBe(0);
    });
    it('normalizes numeric range', () => {
      const spec = { type: 'continuous', min: 0, max: 100, default: 50 };
      expect(computeDefaultNormalized(spec)).toBe(0.5);
    });
    it('clamps out of range', () => {
      const spec = { type: 'continuous', min: 0, max: 100, default: 150 };
      expect(computeDefaultNormalized(spec)).toBe(1);
    });
    it('handles enum with string default', () => {
      const spec = { type: 'enum', options: ['A', 'B', 'C'], default: 'B' };
      expect(computeDefaultNormalized(spec)).toBe(0.5);
    });
    it('returns null for unknown', () => {
      expect(computeDefaultNormalized(undefined)).toBeNull();
    });
  });

  describe('determineCodecType', () => {
    it('returns enum for enum bytes', () => {
      const enumBytes = { '32': 3 };
      const bipolarBytes = new Set<number>();
      expect(determineCodecType(32, enumBytes, bipolarBytes)).toBe('enum');
    });
    it('returns bipolar for bipolar bytes', () => {
      const enumBytes = {};
      const bipolarBytes = new Set([45]);
      expect(determineCodecType(45, enumBytes, bipolarBytes)).toBe('bipolar');
    });
    it('returns value as default', () => {
      const enumBytes = {};
      const bipolarBytes = new Set<number>();
      expect(determineCodecType(99, enumBytes, bipolarBytes)).toBe('value');
    });
  });

  describe('determineCategory', () => {
    it('returns physical for 0-241', () => {
      expect(determineCategory(0)).toBe('physical');
      expect(determineCategory(241)).toBe('physical');
    });
    it('returns extended for 242-299', () => {
      expect(determineCategory(242)).toBe('extended');
      expect(determineCategory(299)).toBe('extended');
    });
    it('returns virtual for >=300', () => {
      expect(determineCategory(300)).toBe('virtual');
      expect(determineCategory(399)).toBe('virtual');
    });
  });

  describe('checkReservedRegions', () => {
    it('flags patch name region (223-238)', () => {
      const errors: string[] = [];
      checkReservedRegions('test_param', 225, errors);
      expect(errors.length).toBe(1);
      expect(errors[0]).toContain('RESERVED_BYTE_COLLISION');
      expect(errors[0]).toContain('patch name');
    });
    it('flags payload tail region (239-241)', () => {
      const errors: string[] = [];
      checkReservedRegions('test_param', 240, errors);
      expect(errors.length).toBe(1);
      expect(errors[0]).toContain('payload tail');
    });
    it('allows physical bytes outside reserved', () => {
      const errors: string[] = [];
      checkReservedRegions('test_param', 100, errors);
      expect(errors.length).toBe(0);
    });
    it('allows extended bytes (>=242)', () => {
      const errors: string[] = [];
      checkReservedRegions('test_param', 250, errors);
      expect(errors.length).toBe(0);
    });
    it('allows virtual bytes (>=300)', () => {
      const errors: string[] = [];
      checkReservedRegions('test_param', 305, errors);
      expect(errors.length).toBe(0);
    });
  });

  describe('KNOWN_ALIAS_OFFSETS', () => {
    // La lista queda vacía a propósito: los escapes que contenía (32, 88, 160)
    // eran exactamente los tres bytes con dos ids que el guard 2 tiene que
    // cazar. Si alguien los vuelve a meter aquí, un byte con dos respuestas
    // vuelve a pasar por un alias bueno.
    it('está vacía: ningún byte puede librarse de NRPN_COLLISION', () => {
      expect(KNOWN_ALIAS_OFFSETS.size).toBe(0);
    });

    it('los tres ids que se repartían los bytes ya no están en el puente', () => {
      // Se comprueba aquí y no solo en el comentario: la constante vacía es
      // fácil de rellenar sin querer.
      expect(KNOWN_ALIAS_OFFSETS.has(32)).toBe(false);
      expect(KNOWN_ALIAS_OFFSETS.has(88)).toBe(false);
      expect(KNOWN_ALIAS_OFFSETS.has(160)).toBe(false);
    });
  });

  describe('parseSpecCppIds / indexSpecCppIds', () => {
    it('extrae los ids de las líneas del spec', () => {
      const texto = [
        '{ "global_portamento", "Global Portamento", "performance", "float", 0.0f, 1.0f, 0.0f, 5, 34, {} },',
        '{ "voice_drift", "Voice Drift", "unison", "float", 0.0f, 1.0f, 0.0f, -1, 88, {} },',
      ].join('\n');
      expect(parseSpecCppIds(texto)).toEqual(['global_portamento', 'voice_drift']);
    });

    it('no se cuela una tabla de opciones con el mismo shape', () => {
      // El cuarto campo (el tipo) es la clave del match: sin él, un array de
      // strings que empezara por dos comillas contiguas contaría como parámetro.
      const texto = '{ "porta_mode", "Porta Mode", "performance", "enum", 0.0f, 13.0f, 0.0f, -1, 35, { "Normal", "Fingered" } },';
      expect(parseSpecCppIds(texto)).toEqual(['porta_mode']);
    });

    it('devuelve una lista vacía si no hay spec', () => {
      expect(parseSpecCppIds('// nada aquí\n')).toEqual([]);
    });

    it('detecta un id declarado dos veces', () => {
      const { set, duplicados } = indexSpecCppIds(['a', 'b', 'a']);
      expect(set.size).toBe(2);
      expect(duplicados.map(([id]) => id)).toEqual(['a']);
    });
  });

  describe('SPECONLY_CONSUMIDOS', () => {
    it('cada entrada dice por qué está', () => {
      for (const c of SPECONLY_CONSUMIDOS) {
        expect(c.id).toMatch(/^[a-z0-9_]+$/);
        expect(c.porque.length).toBeGreaterThan(10);
      }
    });

    it('no tiene ids repetidos', () => {
      const ids = SPECONLY_CONSUMIDOS.map(c => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('los restos de otra nomenclatura ya no están', () => {
      // `slot_a_type` / `slot_b_type` con opciones OSC1_Style/OSC2_Style: este
      // synth tiene osc1_* y osc2_*, no ranuras A y B. Se borraron del spec.
      const ids = SPECONLY_CONSUMIDOS.map(c => c.id);
      expect(ids).not.toContain('slot_a_type');
      expect(ids).not.toContain('slot_b_type');
      expect(ids).not.toContain('osc_drift');
    });
  });

  describe('RESERVED_PHYSICAL_REGIONS', () => {
    it('has correct regions', () => {
      expect(RESERVED_PHYSICAL_REGIONS).toHaveLength(2);
      expect(RESERVED_PHYSICAL_REGIONS[0]).toEqual({ start: 223, end: 238, label: 'patch name (223-238)' });
      expect(RESERVED_PHYSICAL_REGIONS[1]).toEqual({ start: 239, end: 241, label: 'payload tail (239-241)' });
    });
  });

  describe('validateAndBuildRegistry (integration)', () => {
    const minimalBridge = {
      PARAM_TO_BYTE_OFFSET: { 'osc1_wave': 0 },
      PARAM_TO_CC: { 'osc1_wave': 74 },
      ENUM_BYTES: { '0': 5 },
      BIPOLAR_BYTES: {},
      BYTE_OFFSET_TO_PARAM_IDS: { '0': ['osc1_wave'] },
    };

    const minimalByteMap = Array.from({ length: 242 }, (_, i) => ({
      idx: i,
      param: `param_${i}`,
      region: 'OSC',
      type: 'value',
      desc: null,
      enumLabels: null,
      id: i === 0 ? 'osc1_wave' : null,
    }));

    const minimalSpec = [
      { id: 'osc1_wave', name: 'OSC1 Wave', type: 'enum', min: 0, max: 5, default: 0, midi_cc: 74 },
    ];

    it('builds registry without errors for minimal valid input', async () => {
      const result = await validateAndBuildRegistry(minimalBridge, minimalByteMap, minimalSpec);
      expect(result.errors).toHaveLength(0);
      expect(result.processed).toHaveLength(1);
      expect(result.processed[0].id).toBe('osc1_wave');
      expect(result.processed[0].codecType).toBe('enum');
      expect(result.processed[0].enumMax).toBe(5);
    });

    it('detects reserved byte collision', async () => {
      const bridgeWithReserved = {
        ...minimalBridge,
        PARAM_TO_BYTE_OFFSET: { 'bad_param': 230 }, // In patch name region
        BYTE_OFFSET_TO_PARAM_IDS: { '230': ['bad_param'] },
      };
      const specWithReserved = [
        { id: 'bad_param', name: 'Bad', type: 'continuous', min: 0, max: 1, default: 0.5 },
      ];

      const result = await validateAndBuildRegistry(bridgeWithReserved, minimalByteMap, specWithReserved);
      expect(result.errors.some(e => e.startsWith('RESERVED_BYTE_COLLISION'))).toBe(true);
    });

    it('detects NRPN collision for unknown aliases', async () => {
      const bridgeCollision = {
        ...minimalBridge,
        PARAM_TO_BYTE_OFFSET: { 'osc1_wave': 0, 'osc2_wave': 0 }, // Same offset, not in known aliases
        BYTE_OFFSET_TO_PARAM_IDS: { '0': ['osc1_wave', 'osc2_wave'] },
      };
      const specCollision = [
        { id: 'osc1_wave', name: 'OSC1', type: 'continuous', min: 0, max: 1, default: 0 },
        { id: 'osc2_wave', name: 'OSC2', type: 'continuous', min: 0, max: 1, default: 0 },
      ];

      const result = await validateAndBuildRegistry(bridgeCollision, minimalByteMap, specCollision);
      expect(result.errors.some(e => e.startsWith('NRPN_COLLISION'))).toBe(true);
    });

    it('rechaza los que antes eran "alias conocidos" (bytes 32, 88, 160)', async () => {
      // El test viejo decía que estos offsets se permitían. Ahora son un error
      // como cualquier otro: la lista de escapes se vació porque contenía
      // justo los tres defectos que el guard tenía que cazar.
      const bridgeAlias = {
        ...minimalBridge,
        PARAM_TO_BYTE_OFFSET: { 'param_a': 32, 'param_b': 32 },
        BYTE_OFFSET_TO_PARAM_IDS: { '32': ['param_a', 'param_b'] },
      };
      const specAlias = [
        { id: 'param_a', name: 'A', type: 'continuous', min: 0, max: 1, default: 0 },
        { id: 'param_b', name: 'B', type: 'continuous', min: 0, max: 1, default: 0 },
      ];

      const result = await validateAndBuildRegistry(bridgeAlias, minimalByteMap, specAlias);
      const colisiones = result.errors.filter(e => e.startsWith('NRPN_COLLISION'));
      expect(colisiones).toHaveLength(1);
      expect(colisiones[0]).toContain('Byte 32');
      expect(colisiones[0]).toContain('param_a, param_b');
    });

    // ── GUARD 1 ──────────────────────────────────────────────────────
    describe('GUARD 1 — ningún id del registro fuera del spec del host', () => {
      const bridgeHuerfano = {
        ...minimalBridge,
        PARAM_TO_BYTE_OFFSET: { 'osc1_wave': 0, 'inventado': 33 },
        BYTE_OFFSET_TO_PARAM_IDS: { '0': ['osc1_wave'], '33': ['inventado'] },
      };

      it('falla si el puente trae un id que el host no declara', async () => {
        const result = await validateAndBuildRegistry(
          bridgeHuerfano, minimalByteMap, minimalSpec, ['osc1_wave']
        );
        const fallos = result.errors.filter(e => e.startsWith('REGISTRY_ID_NOT_IN_SPEC'));
        expect(fallos).toHaveLength(1);
        expect(fallos[0]).toContain('"inventado"');
      });

      it('pasa si todos los ids del puente están declarados', async () => {
        const result = await validateAndBuildRegistry(
          bridgeHuerfano, minimalByteMap, minimalSpec, ['osc1_wave', 'inventado']
        );
        expect(result.errors.filter(e => e.startsWith('REGISTRY_ID_NOT_IN_SPEC'))).toHaveLength(0);
      });

      it('sin la lista de ids no falla (es el estado previo, no un error)', async () => {
        const result = await validateAndBuildRegistry(bridgeHuerfano, minimalByteMap, minimalSpec);
        expect(result.errors.filter(e => e.startsWith('REGISTRY_ID_NOT_IN_SPEC'))).toHaveLength(0);
      });

      it('un id en el byte 0 no se confunde con "fuera del spec"', async () => {
        // `lfo1_rate` está en el byte 0 y `!0` es `true`: un guard escrito con
        // truthiness declararía fuera del spec al primer parámetro del registro.
        const soloCero = {
          ...minimalBridge,
          PARAM_TO_BYTE_OFFSET: { 'lfo1_rate': 0 },
          BYTE_OFFSET_TO_PARAM_IDS: { '0': ['lfo1_rate'] },
        };
        const result = await validateAndBuildRegistry(soloCero, minimalByteMap, [], ['lfo1_rate']);
        expect(result.errors.filter(e => e.startsWith('REGISTRY_ID_NOT_IN_SPEC'))).toHaveLength(0);
        expect(result.specOnly.filter(s => s.id === 'lfo1_rate')).toHaveLength(0);
      });

      it('mira también PARAM_TO_CC, no solo el mapa de bytes', async () => {
        // El mapa del puente tiene dos tablas de ids. Un id que solo aparece en
        // la de CC es un CC que responde a un mando que el host no declara: el
        // mismo defecto que el del byte, pero que además se mueve desde el MIDI
        // externo. Sin esta comprobación pasaba de largo.
        const bridgeCC = {
          ...minimalBridge,
          PARAM_TO_CC: { 'osc1_wave': 74, 'fantasma_cc': 99 },
        };
        const result = await validateAndBuildRegistry(bridgeCC, minimalByteMap, [], ['osc1_wave']);
        const fallos = result.errors.filter(e => e.startsWith('CC_ID_NOT_IN_SPEC'));
        expect(fallos).toHaveLength(1);
        expect(fallos[0]).toContain('"fantasma_cc"');
        expect(fallos[0]).toContain('CC=99');
      });

      it('un CC de un global sin byte es legítimo si el host lo declara', async () => {
        // `global_volume`, `global_tune` y `transpose` son de la APVTS y no
        // tienen byte en el preset porque no son del sintet. No necesitan lista
        // de escapes: están en el spec, y eso es lo que se mira.
        const bridgeGlobal = {
          ...minimalBridge,
          PARAM_TO_CC: { 'global_volume': 7 },
        };
        const result = await validateAndBuildRegistry(
          bridgeGlobal, minimalByteMap, [], ['osc1_wave', 'global_volume']
        );
        expect(result.errors.filter(e => e.startsWith('CC_ID_NOT_IN_SPEC'))).toHaveLength(0);
      });
    });

    // ── GUARD 3 ──────────────────────────────────────────────────────
    describe('GUARD 3 — un spec-only que nadie consume es un error', () => {
      it('falla si el spec declara algo sin byte que no está en la lista', async () => {
        const result = await validateAndBuildRegistry(
          minimalBridge, minimalByteMap, [], ['osc1_wave', 'nuevo_colgado']
        );
        const fallos = result.errors.filter(e => e.startsWith('SPECONLY_UNCONSUMED'));
        expect(fallos).toHaveLength(1);
        expect(fallos[0]).toContain('"nuevo_colgado"');
      });

      it('pasa si está en SPECONLY_CONSUMIDOS con su porqué', async () => {
        const consumido = SPECONLY_CONSUMIDOS[0].id; // uno de los fx*_mix
        const result = await validateAndBuildRegistry(
          minimalBridge, minimalByteMap, [], ['osc1_wave', consumido]
        );
        expect(result.errors.filter(e => e.startsWith('SPECONLY_UNCONSUMED'))).toHaveLength(0);
      });

      it('avisa (no falla) si la lista tiene una entrada que ya no aplica', async () => {
        // `arp_velocity_gate` está en la lista; si le damos byte, la lista queda
        // con deuda cerrada. Es aviso, no error: el fallo real lo vería el guard 1.
        const consumo = SPECONLY_CONSUMIDOS.find(c => c.id === 'arp_velocity_gate')!;
        const bridgeConArp = {
          ...minimalBridge,
          PARAM_TO_BYTE_OFFSET: { 'osc1_wave': 0, 'arp_velocity_gate': 34 },
          BYTE_OFFSET_TO_PARAM_IDS: { '0': ['osc1_wave'], '34': ['arp_velocity_gate'] },
        };
        const result = await validateAndBuildRegistry(
          bridgeConArp, minimalByteMap, [], ['osc1_wave', consumo.id]
        );
        expect(result.errors.filter(e => e.startsWith('SPECONLY_UNCONSUMED'))).toHaveLength(0);
        expect(result.warnings.some(w => w.code === 'SPECONLY_ALLOWLIST_STALE')).toBe(true);
      });

      it('sin la lista de ids no falla (es el estado previo, no un error)', async () => {
        const result = await validateAndBuildRegistry(minimalBridge, minimalByteMap, []);
        expect(result.errors.filter(e => e.startsWith('SPECONLY_UNCONSUMED'))).toHaveLength(0);
      });
    });
  });
});