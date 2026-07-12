/**
 * Unit tests for bridge-param-maps.js — NRPN encoding/decoding (rawToNormalized, normalizedToRaw),
 * parameter maps (PARAM_TO_BYTE_OFFSET, PARAM_TO_CC, ENUM_BYTES, BIPOLAR_BYTES).
 *
 * Run with: npx vitest run WebUI/tests/bridgeParamMaps.test.js
 *
 * Covers:
 *   - rawToNormalized for value/bipolar/enum types
 *   - normalizedToRaw for value/bipolar/enum types
 *   - PARAM_TO_BYTE_OFFSET structure and alias validation
 *   - PARAM_TO_CC spot-check entries
 *   - ENUM_BYTES spot-check entries
 *   - BIPOLAR_BYTES spot-check entries
 *   - BYTE_OFFSET_TO_PARAM_IDS reverse lookup (multi-param at same offset)
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ══════════════════════════════════════════════════════════════════
// Full BRIDGE_PARAM_MAPS (exact copy from bridge-param-maps.js IIFE)
// ══════════════════════════════════════════════════════════════════

function buildBridgeParamMaps() {

  var BIPOLAR_BYTES = new Set([42, 83, 91, 95, 98, 101, 104, 107, 110, 113, 116, 123, 124, 125, 126, 127,
    128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143,
    144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154
  ]);

  var ENUM_BYTES = {
    2: 6, 3: 1, 4: 1, 9: 6, 10: 1, 11: 1, 14: 2, 15: 2, 16: 5, 17: 5, 18: 1, 19: 1, 20: 1, 22: 6, 32: 6,
    35: 9, 38: 1, 46: 1, 50: 1, 51: 1, 52: 1,
    57: 4, 66: 4, 75: 4, 84: 2, 85: 12, 86: 3, 92: 1,
    117: 1, 118: 15, 119: 31, 121: 2, 155: 1, 156: 10, 158: 12, 159: 1, 161: 1, 162: 64, 164: 3, 165: 9,
    166: 35, 179: 35, 192: 35, 205: 35, 222: 2
  };

  var PARAM_TO_BYTE_OFFSET = {
    'lfo1_rate': 0, 'lfo1_delay': 1, 'lfo1_shape': 2, 'lfo1_key_sync': 3,
    'lfo1_arp_sync': 4, 'lfo1_mono_mode': 5, 'lfo1_slew': 6,
    'lfo2_rate': 7, 'lfo2_delay': 8, 'lfo2_shape': 9, 'lfo2_key_sync': 10,
    'lfo2_arp_sync': 11, 'lfo2_mono_mode': 12, 'lfo2_slew': 13,
    'osc1_range': 14, 'osc2_range': 15,
    'osc1_pwm_source': 16, 'osc2_pm_source': 32, 'osc2_tpm_source': 17,
    'osc1_square_enable': 18, 'osc1_saw_enable': 19, 'osc_sync_enable': 20,
    'osc1_pitch_mod': 21, 'osc1_pm_source': 22,
    'osc1_lfo_aftertouch': 23, 'osc1_lfo_modwheel': 24, 'osc1_pwm_amount': 25,
    'osc2_level': 26, 'osc2_pitch': 27, 'osc2_tone_mod': 28, 'osc2_pitch_mod': 29,
    'osc2_aftertouch_pitch': 30, 'osc2_modwheel_pitch': 31, 'osc2_pitch_mod_select': 32,
    'noise_level': 33,
    'global_portamento': 34, 'porta_mode': 35,
    'pitch_bend_up': 36, 'pitch_bend_down': 37, 'osc1_pm_mode': 38,
    'vcf_cutoff': 39, 'hpf_cutoff': 40, 'vcf_resonance': 41, 'vcf_env_depth': 42,
    'vcf_env_vel': 43, 'vcf_pitch_bend': 44, 'vcf_lfo_depth': 45,
    'vcf_lfo_select': 46, 'vcf_aftertouch_lfo': 47, 'vcf_modwheel_lfo': 48,
    'vcf_key_tracking': 49, 'vcf_env_polarity': 50, 'vcf_pole_mode': 51, 'hpf_boost_enable': 52,
    'env1_attack': 53, 'env1_decay': 54, 'env1_sustain': 55, 'env1_release': 56,
    'env1_trigger_mode': 57, 'env1_attack_curve': 58, 'env1_decay_curve': 59,
    'env1_sustain_curve': 60, 'env1_release_curve': 61,
    'env2_attack': 62, 'env2_decay': 63, 'env2_sustain': 64, 'env2_release': 65,
    'env2_trigger_mode': 66, 'env2_attack_curve': 67, 'env2_decay_curve': 68,
    'env2_sustain_curve': 69, 'env2_release_curve': 70,
    'env3_attack': 71, 'env3_decay': 72, 'env3_sustain': 73, 'env3_release': 74,
    'env3_trigger_mode': 75, 'env3_attack_curve': 76, 'env3_decay_curve': 77,
    'env3_sustain_curve': 78, 'env3_release_curve': 79,
    'vca_level': 80, 'vca_env_depth': 81, 'vca_vel_sens': 82, 'vca_pan_spread': 83,
    'note_priority': 84, 'voice_mode': 85, 'trigger_mode': 86,
    'unison_detune': 87, 'voice_drift': 88, 'osc_drift': 88,
    'param_drift': 89, 'drift_rate': 90, 'porta_osc_bal': 91, 'osc_key_reset': 92,
    'mod_matrix_slot1_src': 93, 'mod_matrix_slot1_dest': 94, 'mod_matrix_slot1_depth': 95,
    'mod_matrix_slot2_src': 96, 'mod_matrix_slot2_dest': 97, 'mod_matrix_slot2_depth': 98,
    'mod_matrix_slot3_src': 99, 'mod_matrix_slot3_dest': 100, 'mod_matrix_slot3_depth': 101,
    'mod_matrix_slot4_src': 102, 'mod_matrix_slot4_dest': 103, 'mod_matrix_slot4_depth': 104,
    'mod_matrix_slot5_src': 105, 'mod_matrix_slot5_dest': 106, 'mod_matrix_slot5_depth': 107,
    'mod_matrix_slot6_src': 108, 'mod_matrix_slot6_dest': 109, 'mod_matrix_slot6_depth': 110,
    'mod_matrix_slot7_src': 111, 'mod_matrix_slot7_dest': 112, 'mod_matrix_slot7_depth': 113,
    'mod_matrix_slot8_src': 114, 'mod_matrix_slot8_dest': 115, 'mod_matrix_slot8_depth': 116,
    'seq_enable': 117, 'seq_clock': 118, 'seq_length': 119,
    'seq_swing': 120, 'seq_key_loop': 121, 'seq_slew_rate': 122,
    'seq_step_1': 123, 'seq_step_2': 124, 'seq_step_3': 125, 'seq_step_4': 126, 'seq_step_5': 127,
    'seq_step_6': 128, 'seq_step_7': 129, 'seq_step_8': 130, 'seq_step_9': 131, 'seq_step_10': 132,
    'seq_step_11': 133, 'seq_step_12': 134, 'seq_step_13': 135, 'seq_step_14': 136, 'seq_step_15': 137,
    'seq_step_16': 138, 'seq_step_17': 139, 'seq_step_18': 140, 'seq_step_19': 141, 'seq_step_20': 142,
    'seq_step_21': 143, 'seq_step_22': 144, 'seq_step_23': 145, 'seq_step_24': 146, 'seq_step_25': 147,
    'seq_step_26': 148, 'seq_step_27': 149, 'seq_step_28': 150, 'seq_step_29': 151, 'seq_step_30': 152,
    'seq_step_31': 153, 'seq_step_32': 154,
    'chord_enable': 105, 'poly_chord_enable': 106, 'chord_key': 107, 'chord_type': 108,
    'arp_enable': 155, 'arp_mode': 156, 'arp_rate': 157, 'arp_clock_divider': 158,
    'arp_key_sync': 159, 'arp_gate_time': 160, 'arp_gate': 160,
    'arp_hold': 161, 'arp_pattern': 162, 'arp_swing': 163, 'arp_octave': 164,
    'fx_routing': 165,
    'fx1_type': 166, 'fx1_param1': 167, 'fx1_param2': 168, 'fx1_param3': 169,
    'fx1_param4': 170, 'fx1_param5': 171, 'fx1_param6': 172, 'fx1_param7': 173,
    'fx1_param8': 174, 'fx1_param9': 175, 'fx1_param10': 176, 'fx1_param11': 177, 'fx1_param12': 178,
    'fx2_type': 179, 'fx2_param1': 180, 'fx2_param2': 181, 'fx2_param3': 182,
    'fx2_param4': 183, 'fx2_param5': 184, 'fx2_param6': 185, 'fx2_param7': 186,
    'fx2_param8': 187, 'fx2_param9': 188, 'fx2_param10': 189, 'fx2_param11': 190, 'fx2_param12': 191,
    'fx3_type': 192, 'fx3_param1': 193, 'fx3_param2': 194, 'fx3_param3': 195,
    'fx3_param4': 196, 'fx3_param5': 197, 'fx3_param6': 198, 'fx3_param7': 199,
    'fx3_param8': 200, 'fx3_param9': 201, 'fx3_param10': 202, 'fx3_param11': 203, 'fx3_param12': 204,
    'fx4_type': 205, 'fx4_param1': 206, 'fx4_param2': 207, 'fx4_param3': 208,
    'fx4_param4': 209, 'fx4_param5': 210, 'fx4_param6': 211, 'fx4_param7': 212,
    'fx4_param8': 213, 'fx4_param9': 214, 'fx4_param10': 215, 'fx4_param11': 216, 'fx4_param12': 217,
    'fx1_gain': 218, 'fx2_gain': 219, 'fx3_gain': 220, 'fx4_gain': 221,
    'fx_mode': 222,
    'fx_feedback_gain': 223,
    'fx_send_level': 225
  };

  var PARAM_TO_CC = {
    'lfo1_rate': 16, 'lfo1_delay': 17,
    'osc1_pitch_mod': 20, 'osc1_pwm_amount': 21,
    'osc2_pitch_mod': 23, 'osc2_tone_mod': 24, 'osc2_pitch': 25, 'osc2_level': 26,
    'noise_level': 27,
    'global_portamento': 5,
    'vcf_cutoff': 29, 'vcf_resonance': 30, 'vcf_env_depth': 31,
    'vcf_lfo_depth': 33, 'vcf_key_tracking': 34, 'hpf_cutoff': 35,
    'vca_level': 36,
    'env1_attack': 37, 'env1_decay': 39, 'env1_sustain': 40, 'env1_release': 41,
    'env2_attack': 42, 'env2_decay': 43, 'env2_sustain': 44, 'env2_release': 45,
    'env3_attack': 46, 'env3_decay': 47, 'env3_sustain': 48, 'env3_release': 49,
    'unison_detune': 28,
    'arp_rate': 12, 'arp_gate_time': 13, 'arp_gate': 13,
    'global_volume': 7,
    'global_tune': 81,
    'transpose': 82
  };

  function buildReverseMap() {
    var map = {};
    for (var paramId in PARAM_TO_BYTE_OFFSET) {
      if (PARAM_TO_BYTE_OFFSET.hasOwnProperty(paramId)) {
        var byteOff = PARAM_TO_BYTE_OFFSET[paramId];
        if (!map[byteOff]) map[byteOff] = [];
        if (map[byteOff].indexOf(paramId) === -1) {
          map[byteOff].push(paramId);
        }
      }
    }
    return map;
  }

  var BYTE_OFFSET_TO_PARAM_IDS = buildReverseMap();

  return {
    BIPOLAR_BYTES: BIPOLAR_BYTES,
    ENUM_BYTES: ENUM_BYTES,
    PARAM_TO_BYTE_OFFSET: PARAM_TO_BYTE_OFFSET,
    PARAM_TO_CC: PARAM_TO_CC,
    BYTE_OFFSET_TO_PARAM_IDS: BYTE_OFFSET_TO_PARAM_IDS,

    rawToNormalized: function(byteOffset, rawValue) {
      if (BIPOLAR_BYTES.has(byteOffset)) {
        return Math.max(0, Math.min(1, ((rawValue - 128) / 127.0 + 1) / 2));
      }
      if (ENUM_BYTES[byteOffset] !== undefined) {
        return Math.min(1, rawValue / ENUM_BYTES[byteOffset]);
      }
      return rawValue / 255.0;
    },

    normalizedToRaw: function(byteOffset, normalizedValue) {
      if (BIPOLAR_BYTES.has(byteOffset)) {
        var val = ((normalizedValue * 2.0) - 1.0) * 127.0;
        return Math.round(val + 128);
      }
      if (ENUM_BYTES[byteOffset] !== undefined) {
        return Math.round(normalizedValue * ENUM_BYTES[byteOffset]);
      }
      return Math.round(normalizedValue * 255.0);
    }
  };
}

// ══════════════════════════════════════════════════════════════════
// Tests: rawToNormalized (NRPN decoding: raw 0-255 → normalized 0-1)
// ══════════════════════════════════════════════════════════════════

describe('rawToNormalized (NRPN decode)', () => {
  let maps;

  beforeEach(() => {
    maps = buildBridgeParamMaps();
  });

  // ── Value type (default: raw / 255.0) ──

  it('value type: raw=0 → 0.0', () => {
    // byteOffset 39 = VCF Cutoff (value type)
    expect(maps.rawToNormalized(39, 0)).toBeCloseTo(0.0, 5);
  });

  it('value type: raw=255 → 1.0', () => {
    expect(maps.rawToNormalized(39, 255)).toBeCloseTo(1.0, 5);
  });

  it('value type: raw=128 → ~0.502', () => {
    expect(maps.rawToNormalized(39, 128)).toBeCloseTo(128 / 255, 5);
  });

  it('value type: raw=64 → ~0.251', () => {
    expect(maps.rawToNormalized(39, 64)).toBeCloseTo(64 / 255, 5);
  });

  // ── Bipolar type (center=128 → 0.5) ──

  it('bipolar: raw=128 (center) → 0.5', () => {
    // byteOffset 42 = VCF Env Depth (bipolar)
    expect(maps.rawToNormalized(42, 128)).toBeCloseTo(0.5, 4);
  });

  it('bipolar: raw=0 → 0.0', () => {
    // ((0 - 128) / 127 + 1) / 2 = (-128/127 + 1) / 2 = (-1.0079 + 1) / 2 = -0.0079/2 = -0.0039 → clamped to 0
    expect(maps.rawToNormalized(42, 0)).toBeCloseTo(0.0, 4);
  });

  it('bipolar: raw=255 → 1.0', () => {
    // ((255 - 128) / 127 + 1) / 2 = (127/127 + 1) / 2 = (1 + 1) / 2 = 1.0
    expect(maps.rawToNormalized(42, 255)).toBeCloseTo(1.0, 4);
  });

  it('bipolar: raw=64 → ~0.248', () => {
    // ((64 - 128) / 127 + 1) / 2 = (-64/127 + 1) / 2 = (-0.5039 + 1) / 2 = 0.4961/2 = 0.248
    expect(maps.rawToNormalized(42, 64)).toBeCloseTo(0.248, 2);
  });

  it('bipolar: raw=192 → ~0.752', () => {
    // ((192 - 128) / 127 + 1) / 2 = (64/127 + 1) / 2 = (0.5039 + 1) / 2 = 1.5039/2 = 0.752
    expect(maps.rawToNormalized(42, 192)).toBeCloseTo(0.752, 2);
  });

  // ── Enum type ──

  it('enum: raw=0 → 0.0', () => {
    // byteOffset 2 = LFO1 Shape (enum, maxIdx=6)
    expect(maps.rawToNormalized(2, 0)).toBeCloseTo(0.0, 4);
  });

  it('enum: raw=maxIdx → 1.0', () => {
    // ENUM_BYTES[2] = 6, raw=6 → 6/6 = 1.0
    expect(maps.rawToNormalized(2, 6)).toBeCloseTo(1.0, 4);
  });

  it('enum: clamps to max when raw > maxIdx', () => {
    // ENUM_BYTES[2] = 6, raw=20 → min(1, 20/6) = min(1, 3.33) = 1.0
    expect(maps.rawToNormalized(2, 20)).toBeCloseTo(1.0, 4);
  });

  it('enum: raw=3 → 0.5', () => {
    // 3/6 = 0.5
    expect(maps.rawToNormalized(2, 3)).toBeCloseTo(0.5, 4);
  });

  // ── Edge cases ──

  it('handles byteOffset not in any special set (value type fallback)', () => {
    // byteOffset 999 is not in BIPOLAR_BYTES or ENUM_BYTES → value fallback
    expect(maps.rawToNormalized(999, 0)).toBeCloseTo(0.0, 4);
    expect(maps.rawToNormalized(999, 128)).toBeCloseTo(128 / 255, 4);
    expect(maps.rawToNormalized(999, 255)).toBeCloseTo(1.0, 4);
  });

  it('handles raw=255 for all types via clamp', () => {
    // For bipolar: raw=255 → 1.0
    expect(maps.rawToNormalized(42, 255)).toBeCloseTo(1.0, 4);
    // For enum: raw=255 → clamped to 1.0
    expect(maps.rawToNormalized(2, 255)).toBeCloseTo(1.0, 4);
    // For value: raw=255 → 1.0
    expect(maps.rawToNormalized(39, 255)).toBeCloseTo(1.0, 4);
  });

  it('handles partial byteOffset boundary (VCA Pan Spread bipolar)', () => {
    // byteOffset 83 = VCA Pan Spread (bipolar)
    expect(maps.rawToNormalized(83, 128)).toBeCloseTo(0.5, 4);
    expect(maps.rawToNormalized(83, 0)).toBeCloseTo(0.0, 4);
    expect(maps.rawToNormalized(83, 255)).toBeCloseTo(1.0, 4);
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: normalizedToRaw (NRPN encoding: normalized 0-1 → raw 0-255)
// ══════════════════════════════════════════════════════════════════

describe('normalizedToRaw (NRPN encode)', () => {
  let maps;

  beforeEach(() => {
    maps = buildBridgeParamMaps();
  });

  // ── Value type (default: round(normalized * 255.0)) ──

  it('value type: 0.0 → 0', () => {
    expect(maps.normalizedToRaw(39, 0.0)).toBe(0);
  });

  it('value type: 1.0 → 255', () => {
    expect(maps.normalizedToRaw(39, 1.0)).toBe(255);
  });

  it('value type: 0.5 → 128', () => {
    expect(maps.normalizedToRaw(39, 0.5)).toBe(128);
  });

  it('value type: 0.251 → 64', () => {
    expect(maps.normalizedToRaw(39, 0.251)).toBe(64);
  });

  // ── Bipolar type ──

  it('bipolar: 0.5 (center) → 128', () => {
    // ((0.5 * 2 - 1) * 127) + 128 = ((1 - 1) * 127) + 128 = 0 + 128 = 128
    expect(maps.normalizedToRaw(42, 0.5)).toBe(128);
  });

  it('bipolar: 0.0 → 1 (raw=0 is sub-zero clamped zone)', () => {
    // ((0 * 2 - 1) * 127) + 128 = (-1 * 127) + 128 = 1
    // raw=0 maps to normalized≈-0.0039 which clamps to 0.0;
    // the reverse formula gives raw=1 as the minimum non-clamped value.
    expect(maps.normalizedToRaw(42, 0.0)).toBe(1);
  });

  it('bipolar: 1.0 → 255', () => {
    // ((1 * 2 - 1) * 127) + 128 = (1 * 127) + 128 = 255
    expect(maps.normalizedToRaw(42, 1.0)).toBe(255);
  });

  it('bipolar: 0.25 → ~65', () => {
    // ((0.25 * 2 - 1) * 127) + 128 = ((0.5 - 1) * 127) + 128 = (-0.5 * 127) + 128 = -63.5 + 128 = 64.5 → round(64.5) = 65
    const result = maps.normalizedToRaw(42, 0.25);
    expect(result).toBeGreaterThanOrEqual(64);
    expect(result).toBeLessThanOrEqual(65);
  });

  it('bipolar: 0.75 → ~191', () => {
    // ((0.75 * 2 - 1) * 127) + 128 = ((1.5 - 1) * 127) + 128 = (0.5 * 127) + 128 = 63.5 + 128 = 191.5 → round 192
    const result = maps.normalizedToRaw(42, 0.75);
    expect(result).toBeGreaterThanOrEqual(191);
    expect(result).toBeLessThanOrEqual(192);
  });

  // ── Enum type ──

  it('enum: 0.0 → 0', () => {
    expect(maps.normalizedToRaw(2, 0.0)).toBe(0);
  });

  it('enum: 1.0 → maxIdx', () => {
    // ENUM_BYTES[2] = 6, round(1.0 * 6) = 6
    expect(maps.normalizedToRaw(2, 1.0)).toBe(6);
  });

  it('enum: 0.5 → 3', () => {
    // round(0.5 * 6) = 3
    expect(maps.normalizedToRaw(2, 0.5)).toBe(3);
  });

  it('enum: Voice Mode (byte 85, maxIdx=12) 1.0 → 12', () => {
    expect(maps.normalizedToRaw(85, 1.0)).toBe(12);
  });

  it('enum: Voice Mode (byte 85) 0.0 → 0', () => {
    expect(maps.normalizedToRaw(85, 0.0)).toBe(0);
  });

  // ── Edge cases ──

  it('handles byteOffset not in any special set (value type fallback)', () => {
    expect(maps.normalizedToRaw(999, 0.5)).toBe(128);
    expect(maps.normalizedToRaw(999, 0.0)).toBe(0);
    expect(maps.normalizedToRaw(999, 1.0)).toBe(255);
  });

  it('bipolar outside bounds clamped by rawToNormalized (round-trip)', () => {
    // Round-trip: bipolar normalize → convert back should give same result
    const rawValues = [0, 64, 128, 192, 255];
    for (const raw of rawValues) {
      const normalized = maps.rawToNormalized(42, raw);
      const rawBack = maps.normalizedToRaw(42, normalized);
      // Allow ±1 rounding difference
      expect(Math.abs(rawBack - raw)).toBeLessThanOrEqual(1);
    }
  });

  it('value type round-trip: raw → normalized → raw', () => {
    const rawValues = [0, 1, 64, 127, 128, 200, 254, 255];
    for (const raw of rawValues) {
      const normalized = maps.rawToNormalized(39, raw);
      const rawBack = maps.normalizedToRaw(39, normalized);
      expect(Math.abs(rawBack - raw)).toBeLessThanOrEqual(1);
    }
  });

  it('enum type round-trip: raw → normalized → raw', () => {
    for (let raw = 0; raw <= 6; raw++) {
      const normalized = maps.rawToNormalized(2, raw);
      const rawBack = maps.normalizedToRaw(2, normalized);
      expect(rawBack).toBe(raw);
    }
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: PARAM_TO_BYTE_OFFSET structure
// ══════════════════════════════════════════════════════════════════

describe('PARAM_TO_BYTE_OFFSET', () => {
  let maps;

  beforeEach(() => {
    maps = buildBridgeParamMaps();
  });

  it('has all known parameter IDs with valid byte offsets (0-241)', () => {
    for (const paramId in maps.PARAM_TO_BYTE_OFFSET) {
      const byteOff = maps.PARAM_TO_BYTE_OFFSET[paramId];
      expect(byteOff).toBeGreaterThanOrEqual(0);
      expect(byteOff).toBeLessThanOrEqual(241);
    }
  });

  it('has alias pair: voice_drift and osc_drift both map to byte 88', () => {
    expect(maps.PARAM_TO_BYTE_OFFSET['voice_drift']).toBe(88);
    expect(maps.PARAM_TO_BYTE_OFFSET['osc_drift']).toBe(88);
  });

  it('has alias pair: arp_gate_time and arp_gate both map to byte 160', () => {
    expect(maps.PARAM_TO_BYTE_OFFSET['arp_gate_time']).toBe(160);
    expect(maps.PARAM_TO_BYTE_OFFSET['arp_gate']).toBe(160);
  });

  it('has alias: osc2_pitch_mod_select maps to byte 32 (same as osc2_pm_source)', () => {
    expect(maps.PARAM_TO_BYTE_OFFSET['osc2_pitch_mod_select']).toBe(32);
    expect(maps.PARAM_TO_BYTE_OFFSET['osc2_pm_source']).toBe(32);
  });

  it('spot-check: vcf_cutoff → byte 39', () => {
    expect(maps.PARAM_TO_BYTE_OFFSET['vcf_cutoff']).toBe(39);
  });

  it('spot-check: arp_enable → byte 155', () => {
    expect(maps.PARAM_TO_BYTE_OFFSET['arp_enable']).toBe(155);
  });

  it('spot-check: fx_routing → byte 165', () => {
    expect(maps.PARAM_TO_BYTE_OFFSET['fx_routing']).toBe(165);
  });

  it('spot-check: seq_step_1 → byte 123 and seq_step_32 → byte 154', () => {
    expect(maps.PARAM_TO_BYTE_OFFSET['seq_step_1']).toBe(123);
    expect(maps.PARAM_TO_BYTE_OFFSET['seq_step_32']).toBe(154);
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: PARAM_TO_CC
// ══════════════════════════════════════════════════════════════════

describe('PARAM_TO_CC', () => {
  let maps;

  beforeEach(() => {
    maps = buildBridgeParamMaps();
  });

  it('has valid CC numbers (0-127)', () => {
    for (const paramId in maps.PARAM_TO_CC) {
      const cc = maps.PARAM_TO_CC[paramId];
      expect(cc).toBeGreaterThanOrEqual(0);
      expect(cc).toBeLessThanOrEqual(127);
    }
  });

  it('spot-check: vcf_cutoff → CC 29', () => {
    expect(maps.PARAM_TO_CC['vcf_cutoff']).toBe(29);
  });

  it('spot-check: vcf_resonance → CC 30', () => {
    expect(maps.PARAM_TO_CC['vcf_resonance']).toBe(30);
  });

  it('spot-check: global_volume → CC 7', () => {
    expect(maps.PARAM_TO_CC['global_volume']).toBe(7);
  });

  it('spot-check: global_portamento → CC 5', () => {
    expect(maps.PARAM_TO_CC['global_portamento']).toBe(5);
  });

  it('has alias: arp_gate_time and arp_gate both map to CC 13', () => {
    expect(maps.PARAM_TO_CC['arp_gate_time']).toBe(13);
    expect(maps.PARAM_TO_CC['arp_gate']).toBe(13);
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: BYTE_OFFSET_TO_PARAM_IDS (reverse lookup)
// ══════════════════════════════════════════════════════════════════

describe('BYTE_OFFSET_TO_PARAM_IDS (reverse lookup)', () => {
  let maps;

  beforeEach(() => {
    maps = buildBridgeParamMaps();
  });

  it('maps byte offset 88 back to both voice_drift and osc_drift', () => {
    const ids = maps.BYTE_OFFSET_TO_PARAM_IDS[88];
    expect(ids).toBeDefined();
    expect(ids).toContain('voice_drift');
    expect(ids).toContain('osc_drift');
  });

  it('maps byte offset 160 back to arp_gate_time and arp_gate', () => {
    const ids = maps.BYTE_OFFSET_TO_PARAM_IDS[160];
    expect(ids).toContain('arp_gate_time');
    expect(ids).toContain('arp_gate');
  });

  it('maps byte offset 39 back to vcf_cutoff', () => {
    const ids = maps.BYTE_OFFSET_TO_PARAM_IDS[39];
    expect(ids).toContain('vcf_cutoff');
    expect(ids.length).toBe(1);
  });

  it('has exactly as many entries as unique byte offsets', () => {
    const uniqueOffsets = new Set();
    for (const paramId in maps.PARAM_TO_BYTE_OFFSET) {
      uniqueOffsets.add(maps.PARAM_TO_BYTE_OFFSET[paramId]);
    }
    expect(Object.keys(maps.BYTE_OFFSET_TO_PARAM_IDS).length).toBe(uniqueOffsets.size);
  });

  it('each reverse entry contains paramId from original map', () => {
    for (const paramId in maps.PARAM_TO_BYTE_OFFSET) {
      const byteOff = maps.PARAM_TO_BYTE_OFFSET[paramId];
      const ids = maps.BYTE_OFFSET_TO_PARAM_IDS[byteOff];
      expect(ids).toContain(paramId);
    }
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: BIPOLAR_BYTES
// ══════════════════════════════════════════════════════════════════

describe('BIPOLAR_BYTES', () => {
  let maps;

  beforeEach(() => {
    maps = buildBridgeParamMaps();
  });

  it('contains VCF Env Depth (42) because it is bipolar', () => {
    expect(maps.BIPOLAR_BYTES.has(42)).toBe(true);
  });

  it('contains VCA Pan Spread (83)', () => {
    expect(maps.BIPOLAR_BYTES.has(83)).toBe(true);
  });

  it('does NOT contain VCF Cutoff (39) — value type', () => {
    expect(maps.BIPOLAR_BYTES.has(39)).toBe(false);
  });

  it('does NOT contain LFO1 Shape (2) — enum type', () => {
    expect(maps.BIPOLAR_BYTES.has(2)).toBe(false);
  });

  it('contains all bipolar bytes from the spec (42, 83, 91, 95, 98...)', () => {
    const expectedBipolar = [42, 83, 91, 95, 98, 101, 104, 107, 110, 113, 116, 123, 124, 125, 126, 127,
      128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143,
      144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154];
    for (const b of expectedBipolar) {
      expect(maps.BIPOLAR_BYTES.has(b)).toBe(true);
    }
    expect(maps.BIPOLAR_BYTES.size).toBe(expectedBipolar.length);
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: ENUM_BYTES
// ══════════════════════════════════════════════════════════════════

describe('ENUM_BYTES', () => {
  let maps;

  beforeEach(() => {
    maps = buildBridgeParamMaps();
  });

  it('spot-check: LFO1 Shape (2) has maxIdx=6', () => {
    expect(maps.ENUM_BYTES[2]).toBe(6);
  });

  it('spot-check: Voice Mode (85) has maxIdx=12', () => {
    expect(maps.ENUM_BYTES[85]).toBe(12);
  });

  it('spot-check: FX1 Type (166) has maxIdx=35', () => {
    expect(maps.ENUM_BYTES[166]).toBe(35);
  });

  it('spot-check: Trigger Mode (86) has maxIdx=3', () => {
    expect(maps.ENUM_BYTES[86]).toBe(3);
  });

  it('spot-check: Note Priority (84) has maxIdx=2', () => {
    expect(maps.ENUM_BYTES[84]).toBe(2);
  });

  it('spot-check: Arp Octave (164) has maxIdx=3', () => {
    expect(maps.ENUM_BYTES[164]).toBe(3);
  });

  it('spot-check: Octave Range (14 and 15) have maxIdx=2', () => {
    expect(maps.ENUM_BYTES[14]).toBe(2);
    expect(maps.ENUM_BYTES[15]).toBe(2);
  });

  it('does NOT have non-enum byte (39 = VCF Cutoff)', () => {
    expect(maps.ENUM_BYTES[39]).toBeUndefined();
  });

  it('does NOT have non-enum byte (42 = VCF Env Depth, bipolar)', () => {
    expect(maps.ENUM_BYTES[42]).toBeUndefined();
  });

  it('all enum entries are >= 1', () => {
    for (const offset in maps.ENUM_BYTES) {
      expect(maps.ENUM_BYTES[offset]).toBeGreaterThanOrEqual(1);
    }
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: NB: SysEx parsing (unpack) lives in MidiTranslationEngine.h (C++)
// The byte-map.js file only contains BYTE_MAP data + formatParamValue.
// The actual NRPN encoding/decoding functions (rawToNormalized, normalizedToRaw)
// live in bridge-param-maps.js and are tested above.
// ══════════════════════════════════════════════════════════════════
