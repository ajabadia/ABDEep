import type { DecodedValueMeta } from '../decoded-patch-map.js';

// ============================================================================
// TC-DeepVRB (TC DEEP REVERB)
// ============================================================================

export const TC_DEEP_RVRB_PARAM_KEYS = [
  'preset',
  'decay',
  'tone',
  'preDelay',
  'mix'
] as const;

// From the owner's manual "TC-DeepVRB (TC Deep Reverb)" effect parameters table.
// Note: We assume the preset option order maps to raw values 0..N in the same order.
// If a future sweep+snapshot disproves this, update this mapping.
export const TC_DEEP_RVRB_PRESET_VALUE_MAP: Record<number, string> = {
  0: 'Ambience',
  1: 'Church',
  2: 'Gate',
  3: 'Hall',
  4: 'Lo Fi',
  5: 'Modulated',
  6: 'Plate',
  7: 'Room',
  8: 'Spring',
  9: 'Tile',
  10: 'Default',
};

export const TC_DEEP_RVRB_UI_BY_KEY: Record<string, { abbr?: string; name?: string }> = {
  preset: { abbr: 'PST', name: 'Preset' },
  decay: { abbr: 'DCY', name: 'Decay' },
  tone: { abbr: 'TON', name: 'Tone' },
  preDelay: { abbr: 'PDY', name: 'PreDelay' },
  mix: { abbr: 'MIX', name: 'Mix' },
};

// From the owner's manual "TC-DeepVRB (TC Deep Reverb)" effect parameters table.
// Note: These are *display* ranges/units; raw storage is 0..255.
export const TC_DEEP_RVRB_VALUE_BY_KEY: Record<string, DecodedValueMeta> = {
  // Preset has discrete options (see valueMap); the manual does not provide min/max.
  preset: {},
  decay: { units: 's', min: 0.1, max: 6.0, modDestination: true },
  tone: { units: '%', min: -50.0, max: 50.0, modDestination: true },
  preDelay: { units: 'ms', min: 0.0, max: 200.0 },
  mix: { units: '%', min: 0.0, max: 100.0, modDestination: true },
};
