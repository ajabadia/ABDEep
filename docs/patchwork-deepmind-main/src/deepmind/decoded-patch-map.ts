// Import FX metadata from modular fx/ directory to keep this file manageable.
import {
  // Reverb effects
  HALL_REV_PARAM_KEYS,
  HALL_REV_UI_BY_KEY,
  HALL_REV_VALUE_BY_KEY,
  HALL_REV_NOTES_BY_KEY,
  PLATE_REV_PARAM_KEYS,
  PLATE_REV_UI_BY_KEY,
  PLATE_REV_VALUE_BY_KEY,
  PLATE_REV_NOTES_BY_KEY,
  RICH_PLT_REV_PARAM_KEYS,
  RICH_PLT_REV_UI_BY_KEY,
  RICH_PLT_REV_VALUE_BY_KEY,
  RICH_PLT_REV_NOTES_BY_KEY,
  AMB_VERB_PARAM_KEYS,
  AMB_VERB_UI_BY_KEY,
  AMB_VERB_VALUE_BY_KEY,
  GATED_REV_PARAM_KEYS,
  GATED_REV_UI_BY_KEY,
  GATED_REV_VALUE_BY_KEY,
  GATED_REV_NOTES_BY_KEY,
  REVERSE_REV_PARAM_KEYS,
  REVERSE_REV_UI_BY_KEY,
  REVERSE_REV_VALUE_BY_KEY,
  REVERSE_REV_NOTES_BY_KEY,
  CHAMBER_REV_PARAM_KEYS,
  CHAMBER_REV_UI_BY_KEY,
  CHAMBER_REV_VALUE_BY_KEY,
  CHAMBER_REV_NOTES_BY_KEY,
  ROOM_REV_PARAM_KEYS,
  ROOM_REV_UI_BY_KEY,
  ROOM_REV_VALUE_BY_KEY,
  VINTAGE_REV_PARAM_KEYS,
  VINTAGE_REV_UI_BY_KEY,
  VINTAGE_REV_VALUE_BY_KEY,
  VINTAGE_REV_FREEZE_VALUE_MAP,
  // TC Deep Reverb
  TC_DEEP_RVRB_PARAM_KEYS,
  TC_DEEP_RVRB_PRESET_VALUE_MAP,
  TC_DEEP_RVRB_UI_BY_KEY,
  TC_DEEP_RVRB_VALUE_BY_KEY,
  // Verb combos
  FLANG_VERB_PARAM_KEYS,
  FLANG_VERB_UI_BY_KEY,
  FLANG_VERB_VALUE_BY_KEY,
  FLANG_VERB_SPEED_SYNC_VALUE_MAP,
  FLANG_VERB_NOTES_BY_KEY,
  CHORUS_VERB_PARAM_KEYS,
  CHORUS_VERB_UI_BY_KEY,
  CHORUS_VERB_VALUE_BY_KEY,
  CHORUS_VERB_SPEED_SYNC_VALUE_MAP,
  CHORUS_VERB_NOTES_BY_KEY,
  DELAY_VERB_PARAM_KEYS,
  DELAY_VERB_UI_BY_KEY,
  DELAY_VERB_VALUE_BY_KEY,
  DELAY_VERB_PATTERN_VALUE_MAP,
  DELAY_VERB_NOTES_BY_KEY,
  MOD_DLYT_REV_PARAM_KEYS,
  MOD_DLYT_REV_UI_BY_KEY,
  MOD_DLYT_REV_VALUE_BY_KEY,
  MOD_DLYT_REV_VALUE_MAP_BY_KEY,
  MOD_DLYT_REV_NOTES_BY_KEY,
  // Delay
  DELAY_PARAM_KEYS,
  DELAY_UI_BY_KEY,
  DELAY_VALUE_BY_KEY,
  DELAY_VALUE_MAP_BY_KEY,
  DELAY_NOTES_BY_KEY,
  THREE_TAP_DELAY_PARAM_KEYS,
  THREE_TAP_DELAY_UI_BY_KEY,
  THREE_TAP_DELAY_VALUE_BY_KEY,
  THREE_TAP_DELAY_VALUE_MAP_BY_KEY,
  THREE_TAP_DELAY_NOTES_BY_KEY,
  FOUR_TAP_DELAY_PARAM_KEYS,
  FOUR_TAP_DELAY_UI_BY_KEY,
  FOUR_TAP_DELAY_VALUE_BY_KEY,
  FOUR_TAP_DELAY_VALUE_MAP_BY_KEY,
  FOUR_TAP_DELAY_NOTES_BY_KEY,
  T_RAY_DELAY_PARAM_KEYS,
  T_RAY_DELAY_UI_BY_KEY,
  T_RAY_DELAY_VALUE_BY_KEY,
  T_RAY_DELAY_NOTES_BY_KEY,
  DECIM_DELAY_PARAM_KEYS,
  DECIM_DELAY_UI_BY_KEY,
  DECIM_DELAY_VALUE_BY_KEY,
  DECIM_DELAY_VALUE_MAP_BY_KEY,
  DECIM_DELAY_NOTES_BY_KEY,
  // Modulation
  CHORUS_PARAM_KEYS,
  CHORUS_UI_BY_KEY,
  CHORUS_VALUE_BY_KEY,
  CHORUS_SPEED_SYNC_VALUE_MAP,
  CHORUS_NOTES_BY_KEY,
  CHORUS_D_PARAM_KEYS,
  CHORUS_D_UI_BY_KEY,
  CHORUS_D_VALUE_BY_KEY,
  CHORUS_D_VALUE_MAP_BY_KEY,
  CHORUS_D_NOTES_BY_KEY,
  FLANGER_PARAM_KEYS,
  FLANGER_UI_BY_KEY,
  FLANGER_VALUE_BY_KEY,
  FLANGER_SPEED_SYNC_VALUE_MAP,
  FLANGER_NOTES_BY_KEY,
  PHASER_PARAM_KEYS,
  PHASER_UI_BY_KEY,
  PHASER_VALUE_BY_KEY,
  PHASER_SPEED_SYNC_VALUE_MAP,
  PHASER_NOTES_BY_KEY,
  AUTO_PAN_PARAM_KEYS,
  AUTO_PAN_UI_BY_KEY,
  AUTO_PAN_VALUE_BY_KEY,
  AUTO_PAN_SPEED_SYNC_VALUE_MAP,
  AUTO_PAN_NOTES_BY_KEY,
  ROTARY_SPKR_PARAM_KEYS,
  ROTARY_SPKR_UI_BY_KEY,
  ROTARY_SPKR_VALUE_BY_KEY,
  ROTARY_SPKR_VALUE_MAP_BY_KEY,
  ROTARY_SPKR_NOTES_BY_KEY,
  // Processing
  MIDAS_EQ_PARAM_KEYS,
  MIDAS_EQ_UI_BY_KEY,
  MIDAS_EQ_VALUE_BY_KEY,
  MIDAS_EQ_VALUE_MAP_BY_KEY,
  MIDAS_EQ_NOTES_BY_KEY,
  FAIR_COMP_PARAM_KEYS,
  FAIR_COMP_UI_BY_KEY,
  FAIR_COMP_VALUE_BY_KEY,
  FAIR_COMP_VALUE_MAP_BY_KEY,
  FAIR_COMP_NOTES_BY_KEY,
  MUL_BND_DIST_PARAM_KEYS,
  MUL_BND_DIST_UI_BY_KEY,
  MUL_BND_DIST_VALUE_BY_KEY,
  MUL_BND_DIST_VALUE_MAP_BY_KEY,
  MUL_BND_DIST_NOTES_BY_KEY,
  NOISE_GATE_PARAM_KEYS,
  NOISE_GATE_UI_BY_KEY,
  NOISE_GATE_VALUE_BY_KEY,
  NOISE_GATE_VALUE_MAP_BY_KEY,
  NOISE_GATE_NOTES_BY_KEY,
  ENHANCER_PARAM_KEYS,
  ENHANCER_UI_BY_KEY,
  ENHANCER_VALUE_BY_KEY,
  ENHANCER_VALUE_MAP_BY_KEY,
  ENHANCER_NOTES_BY_KEY,
  // Creative
  DUAL_PITCH_PARAM_KEYS,
  DUAL_PITCH_UI_BY_KEY,
  DUAL_PITCH_VALUE_BY_KEY,
  DUAL_PITCH_VALUE_MAP_BY_KEY,
  DUAL_PITCH_NOTES_BY_KEY,
  VINTG_PITCH_PARAM_KEYS,
  VINTG_PITCH_UI_BY_KEY,
  VINTG_PITCH_VALUE_BY_KEY,
  VINTG_PITCH_VALUE_MAP_BY_KEY,
  VINTG_PITCH_NOTES_BY_KEY,
  MOOD_FILTER_PARAM_KEYS,
  MOOD_FILTER_UI_BY_KEY,
  MOOD_FILTER_VALUE_BY_KEY,
  MOOD_FILTER_VALUE_MAP_BY_KEY,
  MOOD_FILTER_NOTES_BY_KEY,
  RACK_AMP_PARAM_KEYS,
  RACK_AMP_UI_BY_KEY,
  RACK_AMP_VALUE_BY_KEY,
  RACK_AMP_VALUE_MAP_BY_KEY,
  RACK_AMP_NOTES_BY_KEY,
  EDISON_EX1_PARAM_KEYS,
  EDISON_EX1_UI_BY_KEY,
  EDISON_EX1_VALUE_BY_KEY,
  EDISON_EX1_VALUE_MAP_BY_KEY,
  EDISON_EX1_NOTES_BY_KEY,
} from './fx/index.js';

export type DecodedValueKind =
  | { type: 'u8' }
  | { type: 'u7' }
  | { type: 'u14_be'; offsetMsb: number; offsetLsb: number };
export type DecodedDisplayBucket = {
  rawMin: number;
  rawMax: number;
  label: string;
};

export type DecodedValueMeta = {
  /** Display units (e.g., ms, Hz, %, s). */
  units?: string;
  /** Display-space min (not necessarily raw min). */
  min?: number;
  /** Display-space max (not necessarily raw max). */
  max?: number;
  /** Actual usable raw max (overrides bit-width default when the synth clamps before 255/127). */
  rawMax?: number;
  /** Whether this parameter is available as a Mod Matrix destination. */
  modDestination?: boolean;
  /** Optional raw-value buckets for mixed-mode displays (e.g. sync labels then Hz buckets). */
  displayBuckets?: DecodedDisplayBucket[];
};

export type DecodedFieldSpec = {
  /** Structured param name (prefer canonical when available). */
  name: string;
  /** 0-based byte offset into the *decoded* edit-buffer payload. */
  offset: number;
  kind: DecodedValueKind;
  /** Optional mapping for enum-like parameters (raw -> label). */
  valueMap?: Record<number, string>;
  /** Optional condition to determine when this field should be included. */
  condition?: { field: string; equals: number };
  /** Optional UI hints (e.g., synth screen label + full name). */
  ui?: { abbr?: string; name?: string; index?: number };
  /** Optional value metadata (units, ranges, and other hints). */
  value?: DecodedValueMeta;
  notes?: string;
};

export type DerivedValue = {
  raw: number;
  normalized?: number;
  label?: string;
  description?: string;
  ui?: { abbr?: string; name?: string; index?: number };
};

export const FX_TYPE_VALUE_MAP: Record<number, string> = {
  0: 'None',
  1: 'HallRev',
  2: 'PlateRev',
  3: 'RichPltRev',
  4: 'AmbVerb',
  5: 'GatedRev',
  6: 'ReverseRev',
  7: 'RackAmp',
  8: 'MoodFilter',
  9: 'Phaser',
  10: 'Chorus',
  11: 'Flanger',
  12: 'ModDlytRev',
  13: 'Delay',
  14: '3TapDelay',
  15: '4TapDelay',
  16: 'RotarySpkr',
  17: 'Chorus-D',
  18: 'Enhancer',
  19: 'EdisonEX1',
  20: 'Auto Pan',
  21: 'T-RayDelay',
  22: 'tcDeepRvrb',
  23: 'flangVerb',
  24: 'chorusVerb',
  25: 'delayVerb',
  26: 'chamberRev',
  27: 'roomRev',
  28: 'vintageRev',
  29: 'dualPitch',
  30: 'midasEQ',
  31: 'fairComp',
  32: 'mulBndDist',
  33: 'noiseGate',
  34: 'decimDelay',
  35: 'vintgPitch',
};

// From the owner's manual “Modulation Sources” list.
// Note: The manual numbers are 1-based. We include an explicit 0="None" entry.
const MOD_MATRIX_SOURCE_VALUE_MAP: Record<number, string> = {
  0: 'None',
  1: 'Pitch Bend',
  2: 'Mod Wheel',
  3: 'Foot Ctrl',
  4: 'BreathCtrl',
  5: 'Pressure',
  6: 'Expression',
  7: 'LFO 1',
  8: 'LFO 2',
  9: 'Env 1 (VCA)',
  10: 'Env 2 (VCF)',
  11: 'Env 3 (Mod)',
  12: 'Note Num',
  13: 'Note Vel',
  14: 'Note Off Vel',
  15: 'Ctrl Seq',
  16: 'LFO 1 (Uni)',
  17: 'LFO 2 (Uni)',
  18: 'LFO 1 (Fade)',
  19: 'LFO 2 (Fade)',
  20: 'Voice Num',
  21: 'Uni Voice',
  22: 'CC X (115)',
  23: 'CC Y (116)',
  24: 'CC Z (117)',
};

// From the owner's manual "Modulation Destinations" list (pp. 93–94).
// We include an explicit 0="None" entry.
const MOD_MATRIX_DEST_VALUE_MAP: Record<number, string> = {
  0: 'None',
  1: 'LFO 1 Rate',
  2: 'LFO 1 Delay',
  3: 'LFO 1 Slew',
  4: 'LFO 1 Shape',
  5: 'LFO 2 Rate',
  6: 'LFO 2 Delay',
  7: 'LFO 2 Slew',
  8: 'LFO 2 Shape',
  9: 'OSC 1+2 Pitch',
  10: 'OSC 1+2 Fine',
  11: 'OSC 1 Pitch',
  12: 'OSC 1 Fine',
  13: 'OSC 2 Pitch',
  14: 'OSC 2 Fine',
  15: 'OSC 1 PM Dep',
  16: 'PWM Depth',
  17: 'TMod Depth',
  18: 'OSC 2 PM Dep',
  19: 'Porta Time',
  20: 'VCF Freq',
  21: 'VCF Res',
  22: 'VCF Env',
  23: 'VCF LFO',
  24: 'Env Rates',
  25: 'All Attack',
  26: 'All Decay',
  27: 'All Sus',
  28: 'All Rel',
  29: 'Env1 Rates',
  30: 'Env2 Rates',
  31: 'Env3 Rates',
  32: 'Env1 Curves',
  33: 'Env2 Curves',
  34: 'Env3 Curves',
  35: 'Env1 Attack',
  36: 'Env1 Decay',
  37: 'Env1 Sus',
  38: 'Env1 Rel',
  39: 'Env1 AttCur',
  40: 'Env1 DcyCur',
  41: 'Env1 SusCur',
  42: 'Env1 RelCur',
  43: 'Env2 Attack',
  44: 'Env2 Decay',
  45: 'Env2 Sus',
  46: 'Env2 Rel',
  47: 'Env2 AtCur',
  48: 'Env2 DcyCur',
  49: 'Env2 SusCur',
  50: 'Env2 RelCur',
  51: 'Env3 Attack',
  52: 'Env3 Decay',
  53: 'Env3 Sus',
  54: 'Env3 Rel',
  55: 'Env3 AtCur',
  56: 'Env3 DcyCur',
  57: 'Env3 SusCur',
  58: 'Env3 RelCur',
  59: 'VCA All',
  60: 'VCA Active',
  61: 'VCA EnvDep',
  62: 'Pan Spread',
  63: 'VCA Pan',
  64: 'OSC2 Lvl',
  65: 'Noise Lvl',
  66: 'HP Freq',
  67: 'Uni Detune',
  68: 'OSC Drift',
  69: 'Param Drift',
  70: 'Drift Rate',
  71: 'Arp Gate',
  72: 'Seq Slew',
  73: 'Mod 1 Dep',
  74: 'Mod 2 Dep',
  75: 'Mod 3 Dep',
  76: 'Mod 4 Dep',
  77: 'Mod 5 Dep',
  78: 'Mod 6 Dep',
  79: 'Mod 7 Dep',
  80: 'Mod 8 Dep',
  // 81–92: FX 1 Params (effect-dependent, resolved dynamically)
  // 93–104: FX 2 Params
  // 105–116: FX 3 Params
  // 117–128: FX 4 Params
  129: 'Fx 1 Level',
  130: 'Fx 2 Level',
  131: 'Fx 3 Level',
  132: 'Fx 4 Level',
};

function readU8(bytes: Uint8Array, offset: number): number {
  if (offset < 0 || offset >= bytes.length) {
    throw new Error(`Offset ${offset} out of range (len=${bytes.length})`);
  }
  return bytes[offset] ?? 0;
}

function decodeBySpec(bytes: Uint8Array, spec: DecodedFieldSpec): number {
  switch (spec.kind.type) {
    case 'u7':
      return readU8(bytes, spec.offset) & 0x7f;
    case 'u8':
      return readU8(bytes, spec.offset);
    case 'u14_be': {
      const msb = readU8(bytes, spec.kind.offsetMsb) & 0x7f;
      const lsb = readU8(bytes, spec.kind.offsetLsb) & 0x7f;
      return (msb << 7) | lsb;
    }
    default: {
      const _exhaustive: never = spec.kind;
      return _exhaustive;
    }
  }
}

function maybeNormalize(kind: DecodedValueKind, raw: number): number | undefined {
  switch (kind.type) {
    case 'u7':
      return raw / 127;
    case 'u8':
      return raw / 255;
    case 'u14_be':
      return raw / 16383;
  }
}

/**
 * Incremental, reverse-engineered map of decoded edit-buffer bytes.
 *
 * Important: This is *not* from the official SysEx docs; it’s learned by
 * sweeping a parameter (NRPN) and diffing snapshots.
 */
export const DECODED_EDIT_BUFFER_MAP: readonly DecodedFieldSpec[] = [
  {
    name: 'filter.cutoff',
    offset: 39,
    kind: { type: 'u8' },
    ui: { abbr: 'CUT', name: 'Cutoff' },
    value: { units: 'Hz', min: 50, max: 20000, modDestination: true },
    notes: 'Discovered by sweep+diff; decoded edit-buffer payload byte[39] (0-based). Display range 50 Hz–20 kHz (logarithmic curve). Default raw 255 = fully open. Musical sweet spots: raw 80–180 for pads, raw 40–100 for bass.',
  },
  {
    name: 'filter.hpfCutoff',
    offset: 40,
    kind: { type: 'u8' },
    ui: { abbr: 'HPF', name: 'HpfCutoff' },
    value: { units: 'Hz', min: 20, max: 2000, modDestination: true },
    notes: 'Discovered by NRPN 40 test; decoded edit-buffer payload byte[40] (0-based). Default raw 0 = 20 Hz (fully open, no bass cut). Sits after the VCA in the signal chain — affects all summed voices simultaneously. -6 dB/octave (gentle slope).',
  },
  {
    name: 'filter.resonance',
    offset: 41,
    kind: { type: 'u8' },
    ui: { abbr: 'RES', name: 'Resonance' },
    value: { units: '%', min: 0, max: 100, modDestination: true },
    notes: 'Discovered by sweep+diff; decoded edit-buffer payload byte[41] (0-based). Emphasizes frequencies around the cutoff. Above raw ~220 the filter self-oscillates, producing a pitch-tracked sine-like tone usable as a 3rd oscillator.',
  },
  {
    name: 'filter.envDepth',
    offset: 42,
    kind: { type: 'u8' },
    ui: { abbr: 'END', name: 'EnvDepth' },
    value: { units: '%', min: 0, max: 100, modDestination: true },
    notes: 'Discovered by NRPN 42 test; decoded edit-buffer payload byte[42] (0-based). How much the VCF Envelope sweeps the cutoff. Works with filter.envPolarity — Normal sweeps up, Inverted sweeps down. Default 0.',
  },
  {
    name: 'filter.envVelocity',
    offset: 43,
    kind: { type: 'u8' },
    ui: { abbr: 'ENV', name: 'EnvVelocity' },
    value: { units: '%', min: 0, max: 100 },
    notes: 'Discovered by NRPN 43 test; decoded edit-buffer payload byte[43] (0-based). How much key velocity scales VCF envelope depth. Default raw 128 = moderate sensitivity. Raw 0 = velocity ignored.',
  },
  {
    name: 'filter.pitchBendToCutoff',
    offset: 44,
    kind: { type: 'u8' },
    ui: { abbr: 'PBC', name: 'PBendCutoff' },
    value: { units: '%', min: 0, max: 100 },
    notes: 'Discovered by NRPN 44 test; decoded edit-buffer payload byte[44] (0-based). Pitch bend wheel → cutoff. Forward = brighter, back = darker. Default raw 128 = moderate. Set to raw 0 to disable.',
  },
  {
    name: 'filter.lfoDepth',
    offset: 45,
    kind: { type: 'u8' },
    ui: { abbr: 'LFD', name: 'LfoDepth' },
    value: { units: '%', min: 0, max: 100, modDestination: true },
    notes: 'Discovered by NRPN 45 test; decoded edit-buffer payload byte[45] (0-based). LFO → cutoff modulation depth. Raw 0–60 for subtle wah, raw 150+ for aggressive wobble. Default 0.',
  },
  {
    name: 'filter.lfoSelect',
    offset: 46,
    kind: { type: 'u8' },
    ui: { abbr: 'LFS', name: 'LfoSelect' },
    valueMap: {
      0: 'LFO 1',
      1: 'LFO 2',
    },
    notes:
      'Discovered by NRPN 46 test; decoded edit-buffer payload byte[46] (0-based). Default LFO 2 (1), keeping LFO 1 free for pitch vibrato. Requires nonzero filter.lfoDepth to have effect.',
  },
  {
    name: 'filter.aftertouchToLfoDepth',
    offset: 47,
    kind: { type: 'u8' },
    ui: { abbr: 'ATL', name: 'ATchLfoDepth' },
    value: { units: '%', min: 0, max: 100 },
    notes: 'Discovered by NRPN 47 test; decoded edit-buffer payload byte[47] (0-based). Aftertouch scales the VCF LFO depth additively on top of filter.lfoDepth. Default 0.',
  },
  {
    name: 'filter.modWheelToLfoDepth',
    offset: 48,
    kind: { type: 'u8' },
    ui: { abbr: 'MWL', name: 'MWheelLfoDepth' },
    value: { units: '%', min: 0, max: 100 },
    notes: 'Discovered by NRPN 48 test; decoded edit-buffer payload byte[48] (0-based). Mod wheel scales the VCF LFO depth additively on top of filter.lfoDepth. Default 0.',
  },
  {
    name: 'filter.keyTracking',
    offset: 49,
    kind: { type: 'u8' },
    ui: { abbr: 'KTR', name: 'KeyTracking' },
    value: { units: '%', min: 0, max: 100, modDestination: true },
    notes: 'Discovered by NRPN 49 test; decoded edit-buffer payload byte[49] (0-based). Cutoff follows keyboard pitch from middle C. Raw 0 = no tracking, raw 255 = 100% (1:1 pitch tracking). Default 0.',
  },
  {
    name: 'filter.envPolarity',
    offset: 50,
    kind: { type: 'u8' },
    ui: { abbr: 'EPL', name: 'EnvPolarity' },
    valueMap: {
      0: 'Inverted',
      1: 'Normal',
    },
    notes:
      'Discovered by NRPN 50 test; decoded edit-buffer payload byte[50] (0-based). Normal (1) = envelope opens filter upward. Inverted (0) = envelope sweeps cutoff downward. Panel INVERT LED is ON at raw 0.',
  },
  {
    name: 'filter.twoPoleMode',
    offset: 51,
    kind: { type: 'u8' },
    ui: { abbr: '2PL', name: 'TwoPoleMode' },
    valueMap: {
      0: '4 Pole',
      1: '2 Pole',
    },
    notes:
      'Discovered by NRPN 51 test; decoded edit-buffer payload byte[51] (0-based). 4-Pole (0) = 24 dB/oct, steeper/deeper. 2-Pole (1) = 12 dB/oct, gentler/brighter. Panel 2-POLE LED ON at raw 1.',
  },
  {
    name: 'filter.bassBoost',
    offset: 52,
    kind: { type: 'u8' },
    ui: { abbr: 'BST', name: 'BassBoost' },
    valueMap: {
      0: 'Off',
      1: 'On',
    },
    notes: 'Discovered by NRPN 52 test; decoded edit-buffer payload byte[52] (0-based). Analog shelving boost ~+6 dB at 100 Hz with DC blocking. Mirrors the physical BOOST switch. Adds body to bass and pads.',
  },
  {
    name: 'osc1.range',
    offset: 14,
    kind: { type: 'u8' },
    valueMap: {
      0: "16'",
      1: "8'",
      2: "4'",
    },
    notes: 'Discovered by NRPN 14 test (0=16\', 1=8\', 2=4\'); decoded edit-buffer payload byte[14] (0-based).',
  },
  {
    name: 'osc1.pwmSource',
    offset: 16,
    kind: { type: 'u8' },
    valueMap: {
      0: 'Manual',
      1: 'LFO 1',
      2: 'LFO 2',
      3: 'VCA Env',
      4: 'VCF Env',
      5: 'Mod Env',
    },
    notes: 'Discovered by NRPN 16 test; decoded edit-buffer payload byte[16] (0-based).',
  },
  {
    name: 'osc1.pitchModSelect',
    offset: 22,
    kind: { type: 'u8' },
    valueMap: {
      0: 'LFO 1',
      1: 'LFO 2',
      2: 'VCA Env',
      3: 'VCF Env',
      4: 'Mod Env',
      5: 'Unipolar (LFO 1)',
      6: 'Unipolar (LFO 2)',
    },
    notes: 'Discovered by NRPN 22 test; decoded edit-buffer payload byte[22] (0-based). Confirmed: 0=LFO 1, 1=LFO 2 (matches manual and osc2.pitchModSelect).',
  },
  {
    name: 'osc1.aftertouch.pitchMod',
    offset: 23,
    kind: { type: 'u8' },
    notes: 'Discovered by NRPN 23 test; decoded edit-buffer payload byte[23] (0-based).',
  },
  {
    name: 'osc1.modWheel.pitchMod',
    offset: 24,
    kind: { type: 'u8' },
    notes: 'Discovered by NRPN 24 test; decoded edit-buffer payload byte[24] (0-based).',
  },
  {
    name: 'osc2.toneModSource',
    offset: 17,
    kind: { type: 'u8' },
    valueMap: {
      0: 'Manual',
      1: 'LFO 1',
      2: 'LFO 2',
      3: 'VCA Env',
      4: 'VCF Env',
      5: 'Mod Env',
    },
    notes: 'Discovered by NRPN 17 test; decoded edit-buffer payload byte[17] (0-based).',
  },
  {
    name: 'osc2.range',
    offset: 15,
    kind: { type: 'u8' },
    valueMap: {
      0: "16'",
      1: "8'",
      2: "4'",
    },
    notes: 'Discovered by NRPN 15 test (0=16\', 1=8\', 2=4\'); decoded edit-buffer payload byte[15] (0-based).',
  },
  {
    name: 'env.amp.attack',
    offset: 53,
    kind: { type: 'u8' },
    ui: { abbr: 'ATK', name: 'AmpAttack' },
    notes: 'Discovered by sweep+diff; decoded edit-buffer payload byte[53] (0-based). Raw 0 = instant attack. Higher = slower rise. Non-linear: 0–50 = fast, 200+ = very slow. Default 0.',
  },
  {
    name: 'env.amp.decay',
    offset: 54,
    kind: { type: 'u8' },
    ui: { abbr: 'DCY', name: 'AmpDecay' },
    notes: 'Discovered by sweep+diff; decoded edit-buffer payload byte[54] (0-based). Time from peak to sustain level. Raw 0 = instant drop to sustain. Default 50.',
  },
  {
    name: 'env.amp.sustain',
    offset: 55,
    kind: { type: 'u8' },
    ui: { abbr: 'SUS', name: 'AmpSustain' },
    value: { min: 0, max: 255 },
    notes: 'Discovered by sweep+diff; decoded edit-buffer payload byte[55] (0-based). Level (not time). Raw 0 = silent, raw 255 = full volume held during key press. Default 255.',
  },
  {
    name: 'env.amp.release',
    offset: 56,
    kind: { type: 'u8' },
    ui: { abbr: 'REL', name: 'AmpRelease' },
    notes: 'Discovered by sweep+diff; decoded edit-buffer payload byte[56] (0-based). Time after key release until silence. Raw 0 = instant cutoff. Raw 50–100 for pads. Default 50.',
  },
  {
    name: 'env.amp.triggerMode',
    offset: 57,
    kind: { type: 'u8' },
    ui: { abbr: 'TRG', name: 'AmpTrigMode' },
    valueMap: {
      0: 'Key',
      1: 'LFO 1',
      2: 'LFO 2',
      3: 'Loop',
      4: 'Control Sequencer Step',
    },
    notes: 'Discovered by NRPN 57 test; decoded edit-buffer payload byte[57] (0-based). Key (0) = triggered by note-on. Loop (3) = envelope cycles, skipping sustain. Non-Key modes ignore sustain stage.',
  },
  {
    name: 'env.amp.attackCurve',
    offset: 58,
    kind: { type: 'u8' },
    ui: { abbr: 'ATC', name: 'AmpAtkCurve' },
    notes: 'Discovered by NRPN 58 test; decoded edit-buffer payload byte[58] (0-based). Raw 0 = exponential (punchy, fast initial rise). Raw 128 = linear. Raw 255 = logarithmic (gradual swell). Default 0.',
  },
  {
    name: 'env.amp.decayCurve',
    offset: 59,
    kind: { type: 'u8' },
    ui: { abbr: 'DCC', name: 'AmpDcyCurve' },
    notes: 'Discovered by NRPN 59 test; decoded edit-buffer payload byte[59] (0-based). Raw 0 = exponential (natural-sounding fade). Raw 128 = linear. Raw 255 = logarithmic. Default 0.',
  },
  {
    name: 'env.amp.sustainCurve',
    offset: 60,
    kind: { type: 'u8' },
    ui: { abbr: 'SUC', name: 'AmpSusCurve' },
    notes: 'Discovered by NRPN 60 test; decoded edit-buffer payload byte[60] (0-based). Controls slope during sustain stage. Raw 0 = falling (tremolo/swell-out), raw 128 = flat (classic sustain), raw 255 = rising (volume swell). Default 128.',
  },
  {
    name: 'env.amp.releaseCurve',
    offset: 61,
    kind: { type: 'u8' },
    ui: { abbr: 'RLC', name: 'AmpRelCurve' },
    notes: 'Discovered by NRPN 61 test; decoded edit-buffer payload byte[61] (0-based). Raw 0 = exponential (natural fade). Raw 128 = linear. Raw 255 = logarithmic. Default 0.',
  },
  {
    name: 'env.filter.attack',
    offset: 62,
    kind: { type: 'u8' },
    ui: { abbr: 'ATK', name: 'VcfAttack' },
    notes: 'Discovered by NRPN 62 test; decoded edit-buffer payload byte[62] (0-based). VCF Envelope attack time. Raw 0 = instant. Higher = slower cutoff sweep rise. Default 0.',
  },
  {
    name: 'env.filter.decay',
    offset: 63,
    kind: { type: 'u8' },
    ui: { abbr: 'DCY', name: 'VcfDecay' },
    notes: 'Discovered by NRPN 63 test; decoded edit-buffer payload byte[63] (0-based). VCF Envelope decay time. Raw 0 = instant drop to sustain level. Default 64.',
  },
  {
    name: 'env.filter.sustain',
    offset: 64,
    kind: { type: 'u8' },
    ui: { abbr: 'SUS', name: 'VcfSustain' },
    value: { min: 0, max: 255 },
    notes: 'Discovered by NRPN 64 test; decoded edit-buffer payload byte[64] (0-based). VCF Envelope sustain level (not time). Raw 0 = cutoff returns to base, raw 255 = full envelope depth held. Default 0.',
  },
  {
    name: 'env.filter.release',
    offset: 65,
    kind: { type: 'u8' },
    ui: { abbr: 'REL', name: 'VcfRelease' },
    notes: 'Discovered by NRPN 65 test; decoded edit-buffer payload byte[65] (0-based). VCF Envelope release time. Raw 0 = instant cutoff return to base. Default 50.',
  },
  {
    name: 'env.filter.triggerMode',
    offset: 66,
    kind: { type: 'u8' },
    ui: { abbr: 'TRG', name: 'VcfTrigMode' },
    valueMap: {
      0: 'Key',
      1: 'LFO 1',
      2: 'LFO 2',
      3: 'Loop',
      4: 'Control Sequencer Step',
    },
    notes: 'Discovered by NRPN 66 test; decoded edit-buffer payload byte[66] (0-based). Key (0) = note-on triggered. Loop (3) = auto-cycling envelope. Non-Key modes ignore sustain stage.',
  },
  {
    name: 'env.filter.attackCurve',
    offset: 67,
    kind: { type: 'u8' },
    ui: { abbr: 'ATC', name: 'VcfAtkCurve' },
    notes: 'Discovered by NRPN 67 test; decoded edit-buffer payload byte[67] (0-based). Raw 0 = exponential (fast initial rise). Raw 128 = linear. Raw 255 = logarithmic (gradual swell). Default 0.',
  },
  {
    name: 'env.filter.decayCurve',
    offset: 68,
    kind: { type: 'u8' },
    ui: { abbr: 'DCC', name: 'VcfDcyCurve' },
    notes:
      'Discovered by NRPN 68 test; decoded edit-buffer payload byte[68] (0-based). Raw 0 = exponential (natural decay). Raw 128 = linear. Raw 255 = logarithmic. Large deltas needed to observe reliably. Default 0.',
  },
  {
    name: 'env.filter.sustainCurve',
    offset: 69,
    kind: { type: 'u8' },
    ui: { abbr: 'SUC', name: 'VcfSusCurve' },
    notes: 'Discovered by NRPN 69 test; decoded edit-buffer payload byte[69] (0-based). Raw 0 = falling during sustain, raw 128 = flat, raw 255 = rising. Default 128.',
  },
  {
    name: 'env.filter.releaseCurve',
    offset: 70,
    kind: { type: 'u8' },
    ui: { abbr: 'RLC', name: 'VcfRelCurve' },
    notes: 'Discovered by NRPN 70 test; decoded edit-buffer payload byte[70] (0-based). Raw 0 = exponential. Raw 128 = linear. Raw 255 = logarithmic. Default 0.',
  },
  {
    name: 'env.mod.attack',
    offset: 71,
    kind: { type: 'u8' },
    ui: { abbr: 'ATK', name: 'ModAttack' },
    notes: 'Discovered by NRPN 71 test; decoded edit-buffer payload byte[71] (0-based). Mod Envelope attack time. Raw 0 = instant. Default 0.',
  },
  {
    name: 'env.mod.decay',
    offset: 72,
    kind: { type: 'u8' },
    ui: { abbr: 'DCY', name: 'ModDecay' },
    notes: 'Discovered by NRPN 72 test; decoded edit-buffer payload byte[72] (0-based). Mod Envelope decay time. Default 64.',
  },
  {
    name: 'env.mod.sustain',
    offset: 73,
    kind: { type: 'u8' },
    ui: { abbr: 'SUS', name: 'ModSustain' },
    value: { min: 0, max: 255 },
    notes: 'Discovered by NRPN 73 test; decoded edit-buffer payload byte[73] (0-based). Mod Envelope sustain level (not time). Raw 0 = drops to zero at sustain stage. Default 0.',
  },
  {
    name: 'env.mod.release',
    offset: 74,
    kind: { type: 'u8' },
    ui: { abbr: 'REL', name: 'ModRelease' },
    notes: 'Discovered by NRPN 74 test; decoded edit-buffer payload byte[74] (0-based). Mod Envelope release time. Default 50.',
  },
  {
    name: 'env.mod.triggerMode',
    offset: 75,
    kind: { type: 'u8' },
    ui: { abbr: 'TRG', name: 'ModTrigMode' },
    valueMap: {
      0: 'Key',
      1: 'LFO 1',
      2: 'LFO 2',
      3: 'Loop',
      4: 'Control Sequencer Step',
    },
    notes: 'Discovered by NRPN 75 test; decoded edit-buffer payload byte[75] (0-based). Key (0) = note-on triggered. Loop (3) = auto-cycling. Non-Key modes ignore sustain stage.',
  },
  {
    name: 'env.mod.attackCurve',
    offset: 76,
    kind: { type: 'u8' },
    ui: { abbr: 'ATC', name: 'ModAtkCurve' },
    notes: 'Discovered by NRPN 76 test; decoded edit-buffer payload byte[76] (0-based). Raw 0 = exponential (punchy). Raw 128 = linear. Raw 255 = logarithmic (swell). Default 0.',
  },
  {
    name: 'env.mod.decayCurve',
    offset: 77,
    kind: { type: 'u8' },
    ui: { abbr: 'DCC', name: 'ModDcyCurve' },
    notes: 'Discovered by NRPN 77 test; decoded edit-buffer payload byte[77] (0-based). Raw 0 = exponential. Raw 128 = linear. Raw 255 = logarithmic. Default 0.',
  },
  {
    name: 'env.mod.sustainCurve',
    offset: 78,
    kind: { type: 'u8' },
    ui: { abbr: 'SUC', name: 'ModSusCurve' },
    notes: 'Discovered by NRPN 78 test; decoded edit-buffer payload byte[78] (0-based). Raw 0 = falling during sustain, raw 128 = flat, raw 255 = rising. Default 128.',
  },
  {
    name: 'env.mod.releaseCurve',
    offset: 79,
    kind: { type: 'u8' },
    ui: { abbr: 'RLC', name: 'ModRelCurve' },
    notes: 'Discovered by NRPN 79 test; decoded edit-buffer payload byte[79] (0-based). Raw 0 = exponential. Raw 128 = linear. Raw 255 = logarithmic. Default 0.',
  },
  {
    name: 'vca.level',
    offset: 80,
    kind: { type: 'u8' },
    ui: { abbr: 'LVL', name: 'VcaLevel' },
    value: { units: 'dB', min: -12, max: 6 },
    notes: 'Discovered by NRPN 80 test; decoded edit-buffer payload byte[80] (0-based). Raw 128 = 0 dB (unity). Raw 0 = −12 dB. Raw 255 = +6 dB. Trim level for the overall voice output.',
  },
  {
    name: 'vca.envDepth',
    offset: 81,
    kind: { type: 'u8' },
    ui: { abbr: 'END', name: 'VcaEnvDepth' },
    notes: 'Discovered by NRPN 81 test; decoded edit-buffer payload byte[81] (0-based). How much the VCA Envelope controls amplitude. Raw 0 = envelope inaudible (flat DC). Raw 255 = full envelope control. Default 255.',
  },
  {
    name: 'vca.envVelocity',
    offset: 82,
    kind: { type: 'u8' },
    ui: { abbr: 'VEL', name: 'VcaEnvVel' },
    notes: 'Discovered by NRPN 82 test; decoded edit-buffer payload byte[82] (0-based). How much key velocity scales VCA envelope depth. Raw 0 = constant volume, raw 128 = moderate dynamics, raw 255 = maximum dynamics. Default 128.',
  },
  {
    name: 'vca.panSpread',
    offset: 83,
    kind: { type: 'u8' },
    ui: { abbr: 'PAN', name: 'PanSpread' },
    notes:
      'Discovered by NRPN 83 test; decoded edit-buffer payload byte[83] (0-based). Bipolar: raw 128 = center (mono). Display = raw - 128 (raw 0 = −128, raw 255 = +127). Spreads voices across stereo field. Default 128.',
  },
  {
    name: 'voice.priorityMode',
    offset: 84,
    kind: { type: 'u8' },
    ui: { abbr: 'PRI', name: 'Priority' },
    valueMap: {
      0: 'Lowest',
      1: 'Highest',
      2: 'Last',
    },
    notes:
      'Discovered by NRPN 84 test; decoded edit-buffer payload byte[84] (0-based). Active in Mono/Unison modes. Last (2) = most recently played note wins. Default Last.',
  },
  {
    name: 'voice.polyphonyMode',
    offset: 85,
    kind: { type: 'u8' },
    ui: { abbr: 'PLY', name: 'PolyMode' },
    valueMap: {
      0: 'Poly',
      1: 'Unison 2',
      2: 'Unison 3',
      3: 'Unison 4',
      4: 'Unison 6',
      5: 'Unison 12',
      6: 'Mono',
      7: 'Mono 2',
      8: 'Mono 3',
      9: 'Mono 4',
      10: 'Mono 6',
      11: 'Poly 6',
      12: 'Poly 8',
    },
    notes: 'Discovered by NRPN 85 test; decoded edit-buffer payload byte[85] (0-based). Poly (0) = up to 12 voices. Unison modes stack voices on one note. Mono = single voice with portamento.',
  },
  {
    name: 'voice.envelopeTriggerMode',
    offset: 86,
    kind: { type: 'u8' },
    ui: { abbr: 'ETR', name: 'EnvTrigMode' },
    valueMap: {
      0: 'Mono',
      1: 'Re-Trigger',
      2: 'Legato',
      3: 'One-Shot',
    },
    notes: 'Discovered by NRPN 86 test; decoded edit-buffer payload byte[86] (0-based). Mono (0) = re-trigger only when no note held (classic mono). Re-Trigger (1) = always re-trigger. Legato (2) = glide without re-trigger. One-Shot (3) = ignore note-off.',
  },
  {
    name: 'voice.unisonDetune',
    offset: 87,
    kind: { type: 'u8' },
    ui: { abbr: 'DET', name: 'UnisonDetune' },
    value: { units: 'cents', min: 0, max: 50 },
    notes:
      'Discovered by NRPN 87 test; decoded edit-buffer payload byte[87] (0-based). Spreads stacked Unison voices in pitch. Raw 0 = unison (no spread), raw 255 = ±50 cents (maximum spread). Only applies in Unison polyphony modes.',
  },
  {
    name: 'voice.drift',
    offset: 88,
    kind: { type: 'u8' },
    ui: { abbr: 'DRF', name: 'OscDrift' },
    notes: 'Discovered by NRPN 88 test; decoded edit-buffer payload byte[88] (0-based). Simulates analog pitch instability on OSC 1 and OSC 2. Raw 0 = none, raw 255 = maximum drift. Adds warmth and organic quality.',
  },
  {
    name: 'voice.parameterDrift',
    offset: 89,
    kind: { type: 'u8' },
    ui: { abbr: 'PDR', name: 'ParamDrift' },
    notes: 'Discovered by NRPN 89 test; decoded edit-buffer payload byte[89] (0-based). Extends analog drift to VCF cutoff, resonance, and PWM. Default 0.',
  },
  {
    name: 'voice.driftRate',
    offset: 90,
    kind: { type: 'u8' },
    ui: { abbr: 'DRR', name: 'DriftRate' },
    notes: 'Discovered by NRPN 90 test; decoded edit-buffer payload byte[90] (0-based). Controls how quickly drift values change. Raw 0 = 25–50 ms (fast shimmer), raw 255 = 2.5–5.0 s (slow undulation). Default 128.',
  },
  {
    name: 'portamento.balance',
    offset: 91,
    kind: { type: 'u8' },
    ui: { abbr: 'PBL', name: 'PortaBalance' },
    notes:
      'Discovered by NRPN 91 test; decoded edit-buffer payload byte[91] (0-based). Bipolar: controls glide balance between OSC 1 and OSC 2. Display = raw - 128 (raw 0 = −128 = only OSC 2 glides, raw 128 = both glide, raw 255 = only OSC 1 glides).',
  },
  {
    name: 'osc.keyDownReset',
    offset: 92,
    kind: { type: 'u8' },
    ui: { abbr: 'KDR', name: 'KeyDnReset' },
    valueMap: {
      0: 'Off',
      1: 'On',
    },
    notes: 'Discovered by NRPN 92 test; decoded edit-buffer payload byte[92] (0-based). When On, oscillator phases reset to zero on each note-on. Creates consistent attack transients.',
  },
  {
    name: 'modMatrix.1.source',
    offset: 93,
    kind: { type: 'u8' },
    ui: { abbr: 'SRC', name: 'MM1Source' },
    valueMap: MOD_MATRIX_SOURCE_VALUE_MAP,
    notes:
      'Discovered by NRPN 93 test; decoded edit-buffer payload byte[93] (0-based). Range per NRPN table: 0–24 (see Mod Matrix Source list).',
  },
  {
    name: 'modMatrix.1.destination',
    offset: 94,
    kind: { type: 'u8' },
    ui: { abbr: 'DST', name: 'MM1Dest' },
    valueMap: MOD_MATRIX_DEST_VALUE_MAP,
    notes:
      'Discovered by NRPN 94 test; decoded edit-buffer payload byte[94] (0-based). Range per NRPN table: 0–129 (see Mod Matrix Destination list).',
  },
  {
    name: 'modMatrix.1.depth',
    offset: 95,
    kind: { type: 'u8' },
    ui: { abbr: 'DPT', name: 'MM1Depth' },
    notes:
      'Discovered by NRPN 95 test; decoded edit-buffer payload byte[95] (0-based). Bipolar: raw 0 = −128 (full negative), raw 128 = 0 (no mod), raw 255 = +127 (full positive). Display = raw − 128.',
  },
  {
    name: 'modMatrix.2.source',
    offset: 96,
    kind: { type: 'u8' },
    ui: { abbr: 'SRC', name: 'MM2Source' },
    valueMap: MOD_MATRIX_SOURCE_VALUE_MAP,
    notes:
      'Assumed by extrapolation from Mod Matrix slot 1 (NRPN 93–95): decoded edit-buffer payload byte[96] (0-based). Range per NRPN table: 0–24 (see Mod Matrix Source list).',
  },
  {
    name: 'modMatrix.2.destination',
    offset: 97,
    kind: { type: 'u8' },
    ui: { abbr: 'DST', name: 'MM2Dest' },
    valueMap: MOD_MATRIX_DEST_VALUE_MAP,
    notes:
      'Assumed by extrapolation from Mod Matrix slot 1 (NRPN 93–95): decoded edit-buffer payload byte[97] (0-based). Range per NRPN table: 0–129 (see Mod Matrix Destination list).',
  },
  {
    name: 'modMatrix.2.depth',
    offset: 98,
    kind: { type: 'u8' },
    ui: { abbr: 'DPT', name: 'MM2Depth' },
    notes:
      'Assumed by extrapolation from Mod Matrix slot 1 (NRPN 93–95): decoded edit-buffer payload byte[98] (0-based). Bipolar: raw 0 = −128 (full negative), raw 128 = 0 (no mod), raw 255 = +127 (full positive). Display = raw − 128.',
  },
  {
    name: 'modMatrix.3.source',
    offset: 99,
    kind: { type: 'u8' },
    ui: { abbr: 'SRC', name: 'MM3Source' },
    valueMap: MOD_MATRIX_SOURCE_VALUE_MAP,
    notes:
      'Assumed by extrapolation from Mod Matrix slot 1 (NRPN 93–95): decoded edit-buffer payload byte[99] (0-based). Range per NRPN table: 0–24 (see Mod Matrix Source list).',
  },
  {
    name: 'modMatrix.3.destination',
    offset: 100,
    kind: { type: 'u8' },
    ui: { abbr: 'DST', name: 'MM3Dest' },
    valueMap: MOD_MATRIX_DEST_VALUE_MAP,
    notes:
      'Assumed by extrapolation from Mod Matrix slot 1 (NRPN 93–95): decoded edit-buffer payload byte[100] (0-based). Range per NRPN table: 0–129 (see Mod Matrix Destination list).',
  },
  {
    name: 'modMatrix.3.depth',
    offset: 101,
    kind: { type: 'u8' },
    ui: { abbr: 'DPT', name: 'MM3Depth' },
    notes:
      'Assumed by extrapolation from Mod Matrix slot 1 (NRPN 93–95): decoded edit-buffer payload byte[101] (0-based). Bipolar: raw 0 = −128 (full negative), raw 128 = 0 (no mod), raw 255 = +127 (full positive). Display = raw − 128.',
  },
  {
    name: 'modMatrix.4.source',
    offset: 102,
    kind: { type: 'u8' },
    ui: { abbr: 'SRC', name: 'MM4Source' },
    valueMap: MOD_MATRIX_SOURCE_VALUE_MAP,
    notes:
      'Assumed by extrapolation from Mod Matrix slot 1 (NRPN 93–95): decoded edit-buffer payload byte[102] (0-based). Range per NRPN table: 0–24 (see Mod Matrix Source list).',
  },
  {
    name: 'modMatrix.4.destination',
    offset: 103,
    kind: { type: 'u8' },
    ui: { abbr: 'DST', name: 'MM4Dest' },
    valueMap: MOD_MATRIX_DEST_VALUE_MAP,
    notes:
      'Assumed by extrapolation from Mod Matrix slot 1 (NRPN 93–95): decoded edit-buffer payload byte[103] (0-based). Range per NRPN table: 0–129 (see Mod Matrix Destination list).',
  },
  {
    name: 'modMatrix.4.depth',
    offset: 104,
    kind: { type: 'u8' },
    ui: { abbr: 'DPT', name: 'MM4Depth' },
    notes:
      'Assumed by extrapolation from Mod Matrix slot 1 (NRPN 93–95): decoded edit-buffer payload byte[104] (0-based). Bipolar: raw 0 = −128 (full negative), raw 128 = 0 (no mod), raw 255 = +127 (full positive). Display = raw − 128.',
  },
  {
    name: 'modMatrix.5.source',
    offset: 105,
    kind: { type: 'u8' },
    ui: { abbr: 'SRC', name: 'MM5Source' },
    valueMap: MOD_MATRIX_SOURCE_VALUE_MAP,
    notes:
      'Assumed by extrapolation from Mod Matrix slot 1 (NRPN 93–95): decoded edit-buffer payload byte[105] (0-based). Range per NRPN table: 0–24 (see Mod Matrix Source list).',
  },
  {
    name: 'modMatrix.5.destination',
    offset: 106,
    kind: { type: 'u8' },
    ui: { abbr: 'DST', name: 'MM5Dest' },
    valueMap: MOD_MATRIX_DEST_VALUE_MAP,
    notes:
      'Assumed by extrapolation from Mod Matrix slot 1 (NRPN 93–95): decoded edit-buffer payload byte[106] (0-based). Range per NRPN table: 0–129 (see Mod Matrix Destination list).',
  },
  {
    name: 'modMatrix.5.depth',
    offset: 107,
    kind: { type: 'u8' },
    ui: { abbr: 'DPT', name: 'MM5Depth' },
    notes:
      'Assumed by extrapolation from Mod Matrix slot 1 (NRPN 93–95): decoded edit-buffer payload byte[107] (0-based). Bipolar: raw 0 = −128 (full negative), raw 128 = 0 (no mod), raw 255 = +127 (full positive). Display = raw − 128.',
  },
  {
    name: 'modMatrix.6.source',
    offset: 108,
    kind: { type: 'u8' },
    ui: { abbr: 'SRC', name: 'MM6Source' },
    valueMap: MOD_MATRIX_SOURCE_VALUE_MAP,
    notes:
      'Assumed by extrapolation from Mod Matrix slot 1 (NRPN 93–95): decoded edit-buffer payload byte[108] (0-based). Range per NRPN table: 0–24 (see Mod Matrix Source list).',
  },
  {
    name: 'modMatrix.6.destination',
    offset: 109,
    kind: { type: 'u8' },
    ui: { abbr: 'DST', name: 'MM6Dest' },
    valueMap: MOD_MATRIX_DEST_VALUE_MAP,
    notes:
      'Assumed by extrapolation from Mod Matrix slot 1 (NRPN 93–95): decoded edit-buffer payload byte[109] (0-based). Range per NRPN table: 0–129 (see Mod Matrix Destination list).',
  },
  {
    name: 'modMatrix.6.depth',
    offset: 110,
    kind: { type: 'u8' },
    ui: { abbr: 'DPT', name: 'MM6Depth' },
    notes:
      'Assumed by extrapolation from Mod Matrix slot 1 (NRPN 93–95): decoded edit-buffer payload byte[110] (0-based). Bipolar: raw 0 = −128 (full negative), raw 128 = 0 (no mod), raw 255 = +127 (full positive). Display = raw − 128.',
  },
  {
    name: 'modMatrix.7.source',
    offset: 111,
    kind: { type: 'u8' },
    ui: { abbr: 'SRC', name: 'MM7Source' },
    valueMap: MOD_MATRIX_SOURCE_VALUE_MAP,
    notes:
      'Assumed by extrapolation from Mod Matrix slot 1 (NRPN 93–95): decoded edit-buffer payload byte[111] (0-based). Range per NRPN table: 0–24 (see Mod Matrix Source list).',
  },
  {
    name: 'modMatrix.7.destination',
    offset: 112,
    kind: { type: 'u8' },
    ui: { abbr: 'DST', name: 'MM7Dest' },
    valueMap: MOD_MATRIX_DEST_VALUE_MAP,
    notes:
      'Assumed by extrapolation from Mod Matrix slot 1 (NRPN 93–95): decoded edit-buffer payload byte[112] (0-based). Range per NRPN table: 0–129 (see Mod Matrix Destination list).',
  },
  {
    name: 'modMatrix.7.depth',
    offset: 113,
    kind: { type: 'u8' },
    ui: { abbr: 'DPT', name: 'MM7Depth' },
    notes:
      'Assumed by extrapolation from Mod Matrix slot 1 (NRPN 93–95): decoded edit-buffer payload byte[113] (0-based). Bipolar: raw 0 = −128 (full negative), raw 128 = 0 (no mod), raw 255 = +127 (full positive). Display = raw − 128.',
  },
  {
    name: 'modMatrix.8.source',
    offset: 114,
    kind: { type: 'u8' },
    ui: { abbr: 'SRC', name: 'MM8Source' },
    valueMap: MOD_MATRIX_SOURCE_VALUE_MAP,
    notes:
      'Assumed by extrapolation from Mod Matrix slot 1 (NRPN 93–95): decoded edit-buffer payload byte[114] (0-based). Range per NRPN table: 0–24 (see Mod Matrix Source list).',
  },
  {
    name: 'modMatrix.8.destination',
    offset: 115,
    kind: { type: 'u8' },
    ui: { abbr: 'DST', name: 'MM8Dest' },
    valueMap: MOD_MATRIX_DEST_VALUE_MAP,
    notes:
      'Assumed by extrapolation from Mod Matrix slot 1 (NRPN 93–95): decoded edit-buffer payload byte[115] (0-based). Range per NRPN table: 0–129 (see Mod Matrix Destination list).',
  },
  {
    name: 'modMatrix.8.depth',
    offset: 116,
    kind: { type: 'u8' },
    ui: { abbr: 'DPT', name: 'MM8Depth' },
    notes:
      'Assumed by extrapolation from Mod Matrix slot 1 (NRPN 93–95): decoded edit-buffer payload byte[116] (0-based). Bipolar: raw 0 = −128 (full negative), raw 128 = 0 (no mod), raw 255 = +127 (full positive). Display = raw − 128.',
  },
  {
    name: 'controlSeq.enabled',
    offset: 117,
    kind: { type: 'u8' },
    ui: { abbr: 'CSE', name: 'CtrlSeqEn' },
    valueMap: {
      0: 'Off',
      1: 'On',
    },
    notes: 'Discovered by NRPN 117 test; decoded edit-buffer payload byte[117] (0-based).',
  },
  {
    name: 'controlSeq.clockDivider',
    offset: 118,
    kind: { type: 'u8' },
    ui: { abbr: 'DIV', name: 'CtrlSeqDiv' },
    valueMap: {
      0: '4',
      1: '3',
      2: '2',
      3: '1',
      4: '1/2',
      5: '3/8',
      6: '1/3',
      7: '1/4',
      8: '3/16',
      9: '1/6',
      10: '1/8',
      11: '3/32',
      12: '1/12',
      13: '1/16',
      14: '3/64',
      15: '1/24',
    },
    notes:
      'Discovered by NRPN 118 test; decoded edit-buffer payload byte[118] (0-based). Range per NRPN table: 0–15 (see Control Sequencer divider table).',
  },
  {
    name: 'controlSeq.length',
    offset: 119,
    kind: { type: 'u8' },
    notes:
      'Discovered by NRPN 119 test; decoded edit-buffer payload byte[119] (0-based). Range per NRPN table: 0–31, representing 1 (0) to 32 (31) steps.',
  },
  {
    name: 'controlSeq.swing',
    offset: 120,
    kind: { type: 'u8' },
    value: { units: '%', min: 50, max: 75 },
    notes:
      'Discovered by NRPN 120 test; decoded edit-buffer payload byte[120] (0-based). Range per NRPN table: 0–25, representing 50% (0) to 75% (25).',
  },
  {
    name: 'controlSeq.keySyncLoop',
    offset: 121,
    kind: { type: 'u8' },
    valueMap: {
      0: 'Loop On',
      1: 'Key Sync On',
      2: 'Loop & Key Sync On',
    },
    notes: 'Discovered by NRPN 121 test; decoded edit-buffer payload byte[121] (0-based).',
  },
  {
    name: 'controlSeq.slewRate',
    offset: 122,
    kind: { type: 'u8' },
    notes: 'Discovered by NRPN 122 test; decoded edit-buffer payload byte[122] (0-based).',
  },
  {
    name: 'controlSeq.step.1.value',
    offset: 123,
    kind: { type: 'u8' },
    notes:
      'Discovered by NRPN 123 test; decoded edit-buffer payload byte[123] (0-based). Value 0 = skip step. Values 1..255 represent bipolar -127..+127 (value - 128).',
  },
  {
    name: 'controlSeq.step.2.value',
    offset: 124,
    kind: { type: 'u8' },
    notes:
      'Assumed contiguous step block (NRPN 123–154): decoded edit-buffer payload byte[124] (0-based). Value 0 = skip step. Values 1..255 represent bipolar -127..+127 (value - 128).',
  },
  {
    name: 'controlSeq.step.3.value',
    offset: 125,
    kind: { type: 'u8' },
    notes:
      'Assumed contiguous step block (NRPN 123–154): decoded edit-buffer payload byte[125] (0-based). Value 0 = skip step. Values 1..255 represent bipolar -127..+127 (value - 128).',
  },
  {
    name: 'controlSeq.step.4.value',
    offset: 126,
    kind: { type: 'u8' },
    notes:
      'Assumed contiguous step block (NRPN 123–154): decoded edit-buffer payload byte[126] (0-based). Value 0 = skip step. Values 1..255 represent bipolar -127..+127 (value - 128).',
  },
  {
    name: 'controlSeq.step.5.value',
    offset: 127,
    kind: { type: 'u8' },
    notes:
      'Assumed contiguous step block (NRPN 123–154): decoded edit-buffer payload byte[127] (0-based). Value 0 = skip step. Values 1..255 represent bipolar -127..+127 (value - 128).',
  },
  {
    name: 'controlSeq.step.6.value',
    offset: 128,
    kind: { type: 'u8' },
    notes:
      'Assumed contiguous step block (NRPN 123–154): decoded edit-buffer payload byte[128] (0-based). Value 0 = skip step. Values 1..255 represent bipolar -127..+127 (value - 128).',
  },
  {
    name: 'controlSeq.step.7.value',
    offset: 129,
    kind: { type: 'u8' },
    notes:
      'Assumed contiguous step block (NRPN 123–154): decoded edit-buffer payload byte[129] (0-based). Value 0 = skip step. Values 1..255 represent bipolar -127..+127 (value - 128).',
  },
  {
    name: 'controlSeq.step.8.value',
    offset: 130,
    kind: { type: 'u8' },
    notes:
      'Assumed contiguous step block (NRPN 123–154): decoded edit-buffer payload byte[130] (0-based). Value 0 = skip step. Values 1..255 represent bipolar -127..+127 (value - 128).',
  },
  {
    name: 'controlSeq.step.9.value',
    offset: 131,
    kind: { type: 'u8' },
    notes:
      'Assumed contiguous step block (NRPN 123–154): decoded edit-buffer payload byte[131] (0-based). Value 0 = skip step. Values 1..255 represent bipolar -127..+127 (value - 128).',
  },
  {
    name: 'controlSeq.step.10.value',
    offset: 132,
    kind: { type: 'u8' },
    notes:
      'Assumed contiguous step block (NRPN 123–154): decoded edit-buffer payload byte[132] (0-based). Value 0 = skip step. Values 1..255 represent bipolar -127..+127 (value - 128).',
  },
  {
    name: 'controlSeq.step.11.value',
    offset: 133,
    kind: { type: 'u8' },
    notes:
      'Assumed contiguous step block (NRPN 123–154): decoded edit-buffer payload byte[133] (0-based). Value 0 = skip step. Values 1..255 represent bipolar -127..+127 (value - 128).',
  },
  {
    name: 'controlSeq.step.12.value',
    offset: 134,
    kind: { type: 'u8' },
    notes:
      'Assumed contiguous step block (NRPN 123–154): decoded edit-buffer payload byte[134] (0-based). Value 0 = skip step. Values 1..255 represent bipolar -127..+127 (value - 128).',
  },
  {
    name: 'controlSeq.step.13.value',
    offset: 135,
    kind: { type: 'u8' },
    notes:
      'Assumed contiguous step block (NRPN 123–154): decoded edit-buffer payload byte[135] (0-based). Value 0 = skip step. Values 1..255 represent bipolar -127..+127 (value - 128).',
  },
  {
    name: 'controlSeq.step.14.value',
    offset: 136,
    kind: { type: 'u8' },
    notes:
      'Assumed contiguous step block (NRPN 123–154): decoded edit-buffer payload byte[136] (0-based). Value 0 = skip step. Values 1..255 represent bipolar -127..+127 (value - 128).',
  },
  {
    name: 'controlSeq.step.15.value',
    offset: 137,
    kind: { type: 'u8' },
    notes:
      'Assumed contiguous step block (NRPN 123–154): decoded edit-buffer payload byte[137] (0-based). Value 0 = skip step. Values 1..255 represent bipolar -127..+127 (value - 128).',
  },
  {
    name: 'controlSeq.step.16.value',
    offset: 138,
    kind: { type: 'u8' },
    notes:
      'Assumed contiguous step block (NRPN 123–154): decoded edit-buffer payload byte[138] (0-based). Value 0 = skip step. Values 1..255 represent bipolar -127..+127 (value - 128).',
  },
  {
    name: 'controlSeq.step.17.value',
    offset: 139,
    kind: { type: 'u8' },
    notes:
      'Assumed contiguous step block (NRPN 123–154): decoded edit-buffer payload byte[139] (0-based). Value 0 = skip step. Values 1..255 represent bipolar -127..+127 (value - 128).',
  },
  {
    name: 'controlSeq.step.18.value',
    offset: 140,
    kind: { type: 'u8' },
    notes:
      'Assumed contiguous step block (NRPN 123–154): decoded edit-buffer payload byte[140] (0-based). Value 0 = skip step. Values 1..255 represent bipolar -127..+127 (value - 128).',
  },
  {
    name: 'controlSeq.step.19.value',
    offset: 141,
    kind: { type: 'u8' },
    notes:
      'Assumed contiguous step block (NRPN 123–154): decoded edit-buffer payload byte[141] (0-based). Value 0 = skip step. Values 1..255 represent bipolar -127..+127 (value - 128).',
  },
  {
    name: 'controlSeq.step.20.value',
    offset: 142,
    kind: { type: 'u8' },
    notes:
      'Assumed contiguous step block (NRPN 123–154): decoded edit-buffer payload byte[142] (0-based). Value 0 = skip step. Values 1..255 represent bipolar -127..+127 (value - 128).',
  },
  {
    name: 'controlSeq.step.21.value',
    offset: 143,
    kind: { type: 'u8' },
    notes:
      'Assumed contiguous step block (NRPN 123–154): decoded edit-buffer payload byte[143] (0-based). Value 0 = skip step. Values 1..255 represent bipolar -127..+127 (value - 128).',
  },
  {
    name: 'controlSeq.step.22.value',
    offset: 144,
    kind: { type: 'u8' },
    notes:
      'Assumed contiguous step block (NRPN 123–154): decoded edit-buffer payload byte[144] (0-based). Value 0 = skip step. Values 1..255 represent bipolar -127..+127 (value - 128).',
  },
  {
    name: 'controlSeq.step.23.value',
    offset: 145,
    kind: { type: 'u8' },
    notes:
      'Assumed contiguous step block (NRPN 123–154): decoded edit-buffer payload byte[145] (0-based). Value 0 = skip step. Values 1..255 represent bipolar -127..+127 (value - 128).',
  },
  {
    name: 'controlSeq.step.24.value',
    offset: 146,
    kind: { type: 'u8' },
    notes:
      'Assumed contiguous step block (NRPN 123–154): decoded edit-buffer payload byte[146] (0-based). Value 0 = skip step. Values 1..255 represent bipolar -127..+127 (value - 128).',
  },
  {
    name: 'controlSeq.step.25.value',
    offset: 147,
    kind: { type: 'u8' },
    notes:
      'Assumed contiguous step block (NRPN 123–154): decoded edit-buffer payload byte[147] (0-based). Value 0 = skip step. Values 1..255 represent bipolar -127..+127 (value - 128).',
  },
  {
    name: 'controlSeq.step.26.value',
    offset: 148,
    kind: { type: 'u8' },
    notes:
      'Assumed contiguous step block (NRPN 123–154): decoded edit-buffer payload byte[148] (0-based). Value 0 = skip step. Values 1..255 represent bipolar -127..+127 (value - 128).',
  },
  {
    name: 'controlSeq.step.27.value',
    offset: 149,
    kind: { type: 'u8' },
    notes:
      'Assumed contiguous step block (NRPN 123–154): decoded edit-buffer payload byte[149] (0-based). Value 0 = skip step. Values 1..255 represent bipolar -127..+127 (value - 128).',
  },
  {
    name: 'controlSeq.step.28.value',
    offset: 150,
    kind: { type: 'u8' },
    notes:
      'Assumed contiguous step block (NRPN 123–154): decoded edit-buffer payload byte[150] (0-based). Value 0 = skip step. Values 1..255 represent bipolar -127..+127 (value - 128).',
  },
  {
    name: 'controlSeq.step.29.value',
    offset: 151,
    kind: { type: 'u8' },
    notes:
      'Assumed contiguous step block (NRPN 123–154): decoded edit-buffer payload byte[151] (0-based). Value 0 = skip step. Values 1..255 represent bipolar -127..+127 (value - 128).',
  },
  {
    name: 'controlSeq.step.30.value',
    offset: 152,
    kind: { type: 'u8' },
    notes:
      'Assumed contiguous step block (NRPN 123–154): decoded edit-buffer payload byte[152] (0-based). Value 0 = skip step. Values 1..255 represent bipolar -127..+127 (value - 128).',
  },
  {
    name: 'controlSeq.step.31.value',
    offset: 153,
    kind: { type: 'u8' },
    notes:
      'Assumed contiguous step block (NRPN 123–154): decoded edit-buffer payload byte[153] (0-based). Value 0 = skip step. Values 1..255 represent bipolar -127..+127 (value - 128).',
  },
  {
    name: 'controlSeq.step.32.value',
    offset: 154,
    kind: { type: 'u8' },
    notes:
      'Spot-checked by NRPN 154 test; decoded edit-buffer payload byte[154] (0-based). Value 0 = skip step. Values 1..255 represent bipolar -127..+127 (value - 128).',
  },
  {
    name: 'arp.enabled',
    offset: 155,
    kind: { type: 'u8' },
    valueMap: {
      0: 'Off',
      1: 'On',
    },
    notes: 'Spot-checked by NRPN 155 test; decoded edit-buffer payload byte[155] (0-based).',
  },
  {
    name: 'arp.mode',
    offset: 156,
    kind: { type: 'u8' },
    valueMap: {
      0: 'Up',
      1: 'Down',
      2: 'Up&Down',
      3: 'Up Inv',
      4: 'Down Inv',
      5: 'Up&Down Inv',
      6: 'Up Alt',
      7: 'Down Alt',
      8: 'Random',
      9: 'As Played',
      10: 'Chord',
    },
    notes: 'Assumed contiguous ARP block (NRPN 155–164): decoded edit-buffer payload byte[156] (0-based).',
  },
  {
    name: 'arp.rate',
    offset: 157,
    kind: { type: 'u8' },
    notes:
      'Assumed contiguous ARP block (NRPN 155–164): decoded edit-buffer payload byte[157] (0-based). Range per NRPN table: 0–255, representing 20 bpm (0) to 275 bpm (255).',
  },
  {
    name: 'arp.clock',
    offset: 158,
    kind: { type: 'u8' },
    valueMap: {
      0: '1/2',
      1: '3/8',
      2: '1/3',
      3: '1/4',
      4: '3/16',
      5: '1/6',
      6: '1/8',
      7: '3/32',
      8: '1/12',
      9: '1/16',
      10: '1/24',
      11: '1/32',
      12: '1/48',
    },
    notes:
      'Assumed contiguous ARP block (NRPN 155–164): decoded edit-buffer payload byte[158] (0-based). Range per NRPN table: 0–12 (see Arpeggiator clock divider table).',
  },
  {
    name: 'arp.keySync',
    offset: 159,
    kind: { type: 'u8' },
    valueMap: {
      0: 'Off',
      1: 'On',
    },
    notes: 'Assumed contiguous ARP block (NRPN 155–164): decoded edit-buffer payload byte[159] (0-based).',
  },
  {
    name: 'arp.gateTime',
    offset: 160,
    kind: { type: 'u8' },
    notes: 'Assumed contiguous ARP block (NRPN 155–164): decoded edit-buffer payload byte[160] (0-based).',
  },
  {
    name: 'arp.hold',
    offset: 161,
    kind: { type: 'u8' },
    valueMap: {
      0: 'Off',
      1: 'On',
    },
    notes: 'Assumed contiguous ARP block (NRPN 155–164): decoded edit-buffer payload byte[161] (0-based).',
  },
  {
    name: 'arp.pattern',
    offset: 162,
    kind: { type: 'u8' },
    valueMap: (() => {
      const map: Record<number, string> = { 0: 'None' };
      for (let i = 1; i <= 32; i++) {
        map[i] = `Preset-${i}`;
      }
      for (let i = 33; i <= 64; i++) {
        map[i] = `User-${i - 32}`;
      }
      return map;
    })(),
    notes: 'Assumed contiguous ARP block (NRPN 155–164): decoded edit-buffer payload byte[162] (0-based).',
  },
  {
    name: 'arp.swing',
    offset: 163,
    kind: { type: 'u8' },
    value: { units: '%', min: 50, max: 75 },
    notes:
      'Assumed contiguous ARP block (NRPN 155–164): decoded edit-buffer payload byte[163] (0-based). Range per NRPN table: 0–25, representing 50% (0) to 75% (25).',
  },
  {
    name: 'arp.octaves',
    offset: 164,
    kind: { type: 'u8' },
    notes:
      'Spot-checked by NRPN 164 test; decoded edit-buffer payload byte[164] (0-based). Range per NRPN table: 0–5, representing 1 to 6 octaves.',
  },
  {
    name: 'fx.routing',
    offset: 165,
    kind: { type: 'u8' },
    valueMap: {
      0: 'M-1 Serial 1-2-3-4',
      1: 'M-2 Parallel 1/2 Serial 3-4',
      2: 'M-3 Parallel 1/2 Parallel 3/4',
      3: 'M-4 Parallel 1/2/3/4',
      4: 'M-5 Parallel 1/2/3 Serial 4',
      5: 'M-6 Serial 1-2 Parallel 3/4',
      6: 'M-7 Serial 1 Parallel 2/3/4',
      7: 'M-8 Parallel (Serial 1-2-3)/4',
      8: 'M-9 Serial 3-4 Feedback(1-2)',
      9: 'M-10 Serial 4 Feedback(1-2-3)',
    },
    notes:
      'Observed in snapshots and aligns with NRPN 165 (FX Routing). ValueMap labels are taken from the manual (M-1..M-10) and were spot-checked live: NRPN values 0..9 match M-1..M-10 order.',
  },
  {
    name: 'fx1.type',
    offset: 166,
    kind: { type: 'u8' },
    valueMap: FX_TYPE_VALUE_MAP,
    notes:
      'Spot-checked by live NRPN + snapshot: decoded edit-buffer payload byte[166] (0-based). Important: FX type values are not ordered like the manual list; build this enum by sweep+observe.',
  },
  ...((): DecodedFieldSpec[] => {
    const out: DecodedFieldSpec[] = [];

    function addFxTypedParams(opts: {
      slot: 1 | 2 | 3 | 4;
      baseOffset: number;
      typeField: 'fx1.type' | 'fx2.type' | 'fx3.type' | 'fx4.type';
      effectName:
        | 'hallRev'
        | 'plateRev'
        | 'richPltRev'
        | 'ambVerb'
        | 'gatedRev'
        | 'reverseRev'
        | 'rackAmp'
        | 'moodFilter'
        | 'phaser'
        | 'chorus'
        | 'flanger'
        | 'modDlytRev'
        | 'delay'
        | 'threeTapDelay'
        | 'fourTapDelay'
        | 'rotarySpkr'
        | 'chorusD'
        | 'enhancer'
        | 'edisonEx1'
        | 'autoPan'
        | 'tRayDelay'
        | 'tcDeepRvrb'
        | 'flangVerb'
        | 'chorusVerb'
        | 'delayVerb'
        | 'chamberRev'
        | 'roomRev'
        | 'vintageRev'
        | 'dualPitch'
        | 'midasEQ'
        | 'fairComp'
        | 'mulBndDist'
        | 'noiseGate'
        | 'decimDelay'
        | 'vintgPitch';
      typeValue: number;
      keys: readonly string[];
      uiByKey?: Record<string, { abbr?: string; name?: string }>;
      valueMapByKey?: Record<string, Record<number, string>>;
      valueByKey?: Record<string, DecodedValueMeta>;
      notesByKey?: Record<string, string>;
    }): void {
      for (let i = 0; i < opts.keys.length; i++) {
        const key = String(opts.keys[i]);
        const uiExtra = opts.uiByKey?.[key];
        const ui = uiExtra ? { index: i + 1, ...uiExtra } : { index: i + 1 };
        const defaultNotes = `FX${opts.slot} ${opts.effectName} (type=${opts.typeValue}) parameter.`;
        const extraNotes = opts.notesByKey?.[key];
        out.push({
          name: `fx${opts.slot}.${opts.effectName}.${key}`,
          offset: opts.baseOffset + i,
          kind: { type: 'u8' },
          valueMap: opts.valueMapByKey?.[key],
          condition: { field: opts.typeField, equals: opts.typeValue },
          ui,
          value: opts.valueByKey?.[key],
          notes: extraNotes ? `${defaultNotes} ${extraNotes}` : defaultNotes,
        });
      }
    }

    // FX1 params: offsets 167..178 (12 bytes)
    for (let i = 1; i <= 12; i++) {
      out.push({
        name: `fx1.param.${i}`,
        offset: 166 + i,
        kind: { type: 'u8' },
        notes:
          'FX slot 1 param. Meaning depends on fx1.type (per-effect). Stored as raw 0–255. Param index order matches the UI param grid (left-to-right, top-to-bottom).',
      });
    }

    // Typed FX param labels are effect-specific and apply to any slot.
    addFxTypedParams({
      slot: 1,
      baseOffset: 167,
      typeField: 'fx1.type',
      effectName: 'hallRev',
      typeValue: 1,
      keys: HALL_REV_PARAM_KEYS,
      uiByKey: HALL_REV_UI_BY_KEY,
      valueByKey: HALL_REV_VALUE_BY_KEY,
      notesByKey: HALL_REV_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 1,
      baseOffset: 167,
      typeField: 'fx1.type',
      effectName: 'plateRev',
      typeValue: 2,
      keys: PLATE_REV_PARAM_KEYS,
      uiByKey: PLATE_REV_UI_BY_KEY,
      valueByKey: PLATE_REV_VALUE_BY_KEY,
      notesByKey: PLATE_REV_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 1,
      baseOffset: 167,
      typeField: 'fx1.type',
      effectName: 'richPltRev',
      typeValue: 3,
      keys: RICH_PLT_REV_PARAM_KEYS,
      uiByKey: RICH_PLT_REV_UI_BY_KEY,
      valueByKey: RICH_PLT_REV_VALUE_BY_KEY,
      notesByKey: RICH_PLT_REV_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 1,
      baseOffset: 167,
      typeField: 'fx1.type',
      effectName: 'ambVerb',
      typeValue: 4,
      keys: AMB_VERB_PARAM_KEYS,
      uiByKey: AMB_VERB_UI_BY_KEY,
      valueByKey: AMB_VERB_VALUE_BY_KEY,
    });
    addFxTypedParams({
      slot: 1,
      baseOffset: 167,
      typeField: 'fx1.type',
      effectName: 'gatedRev',
      typeValue: 5,
      keys: GATED_REV_PARAM_KEYS,
      uiByKey: GATED_REV_UI_BY_KEY,
      valueByKey: GATED_REV_VALUE_BY_KEY,
      notesByKey: GATED_REV_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 1,
      baseOffset: 167,
      typeField: 'fx1.type',
      effectName: 'reverseRev',
      typeValue: 6,
      keys: REVERSE_REV_PARAM_KEYS,
      uiByKey: REVERSE_REV_UI_BY_KEY,
      valueByKey: REVERSE_REV_VALUE_BY_KEY,
      notesByKey: REVERSE_REV_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 1,
      baseOffset: 167,
      typeField: 'fx1.type',
      effectName: 'rackAmp',
      typeValue: 7,
      keys: RACK_AMP_PARAM_KEYS,
      uiByKey: RACK_AMP_UI_BY_KEY,
      valueByKey: RACK_AMP_VALUE_BY_KEY,
      valueMapByKey: RACK_AMP_VALUE_MAP_BY_KEY,
      notesByKey: RACK_AMP_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 1,
      baseOffset: 167,
      typeField: 'fx1.type',
      effectName: 'moodFilter',
      typeValue: 8,
      keys: MOOD_FILTER_PARAM_KEYS,
      uiByKey: MOOD_FILTER_UI_BY_KEY,
      valueMapByKey: MOOD_FILTER_VALUE_MAP_BY_KEY,
      valueByKey: MOOD_FILTER_VALUE_BY_KEY,
      notesByKey: MOOD_FILTER_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 1,
      baseOffset: 167,
      typeField: 'fx1.type',
      effectName: 'phaser',
      typeValue: 9,
      keys: PHASER_PARAM_KEYS,
      uiByKey: PHASER_UI_BY_KEY,
      valueMapByKey: { speed: PHASER_SPEED_SYNC_VALUE_MAP },
      valueByKey: PHASER_VALUE_BY_KEY,
      notesByKey: PHASER_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 1,
      baseOffset: 167,
      typeField: 'fx1.type',
      effectName: 'chorus',
      typeValue: 10,
      keys: CHORUS_PARAM_KEYS,
      uiByKey: CHORUS_UI_BY_KEY,
      valueMapByKey: { speed: CHORUS_SPEED_SYNC_VALUE_MAP },
      valueByKey: CHORUS_VALUE_BY_KEY,
      notesByKey: CHORUS_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 1,
      baseOffset: 167,
      typeField: 'fx1.type',
      effectName: 'flanger',
      typeValue: 11,
      keys: FLANGER_PARAM_KEYS,
      uiByKey: FLANGER_UI_BY_KEY,
      valueMapByKey: { speed: FLANGER_SPEED_SYNC_VALUE_MAP },
      valueByKey: FLANGER_VALUE_BY_KEY,
      notesByKey: FLANGER_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 1,
      baseOffset: 167,
      typeField: 'fx1.type',
      effectName: 'modDlytRev',
      typeValue: 12,
      keys: MOD_DLYT_REV_PARAM_KEYS,
      uiByKey: MOD_DLYT_REV_UI_BY_KEY,
      valueByKey: MOD_DLYT_REV_VALUE_BY_KEY,
      valueMapByKey: MOD_DLYT_REV_VALUE_MAP_BY_KEY,
      notesByKey: MOD_DLYT_REV_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 1,
      baseOffset: 167,
      typeField: 'fx1.type',
      effectName: 'delay',
      typeValue: 13,
      keys: DELAY_PARAM_KEYS,
      uiByKey: DELAY_UI_BY_KEY,
      valueMapByKey: DELAY_VALUE_MAP_BY_KEY,
      valueByKey: DELAY_VALUE_BY_KEY,
      notesByKey: DELAY_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 1,
      baseOffset: 167,
      typeField: 'fx1.type',
      effectName: 'threeTapDelay',
      typeValue: 14,
      keys: THREE_TAP_DELAY_PARAM_KEYS,
      uiByKey: THREE_TAP_DELAY_UI_BY_KEY,
      valueMapByKey: THREE_TAP_DELAY_VALUE_MAP_BY_KEY,
      valueByKey: THREE_TAP_DELAY_VALUE_BY_KEY,
      notesByKey: THREE_TAP_DELAY_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 1,
      baseOffset: 167,
      typeField: 'fx1.type',
      effectName: 'fourTapDelay',
      typeValue: 15,
      keys: FOUR_TAP_DELAY_PARAM_KEYS,
      uiByKey: FOUR_TAP_DELAY_UI_BY_KEY,
      valueMapByKey: FOUR_TAP_DELAY_VALUE_MAP_BY_KEY,
      valueByKey: FOUR_TAP_DELAY_VALUE_BY_KEY,
      notesByKey: FOUR_TAP_DELAY_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 1,
      baseOffset: 167,
      typeField: 'fx1.type',
      effectName: 'rotarySpkr',
      typeValue: 16,
      keys: ROTARY_SPKR_PARAM_KEYS,
      uiByKey: ROTARY_SPKR_UI_BY_KEY,
      valueMapByKey: ROTARY_SPKR_VALUE_MAP_BY_KEY,
      valueByKey: ROTARY_SPKR_VALUE_BY_KEY,
      notesByKey: ROTARY_SPKR_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 1,
      baseOffset: 167,
      typeField: 'fx1.type',
      effectName: 'chorusD',
      typeValue: 17,
      keys: CHORUS_D_PARAM_KEYS,
      uiByKey: CHORUS_D_UI_BY_KEY,
      valueByKey: CHORUS_D_VALUE_BY_KEY,
      valueMapByKey: CHORUS_D_VALUE_MAP_BY_KEY,
      notesByKey: CHORUS_D_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 1,
      baseOffset: 167,
      typeField: 'fx1.type',
      effectName: 'enhancer',
      typeValue: 18,
      keys: ENHANCER_PARAM_KEYS,
      uiByKey: ENHANCER_UI_BY_KEY,
      valueByKey: ENHANCER_VALUE_BY_KEY,
      valueMapByKey: ENHANCER_VALUE_MAP_BY_KEY,
      notesByKey: ENHANCER_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 1,
      baseOffset: 167,
      typeField: 'fx1.type',
      effectName: 'edisonEx1',
      typeValue: 19,
      keys: EDISON_EX1_PARAM_KEYS,
      uiByKey: EDISON_EX1_UI_BY_KEY,
      valueByKey: EDISON_EX1_VALUE_BY_KEY,
      valueMapByKey: EDISON_EX1_VALUE_MAP_BY_KEY,
      notesByKey: EDISON_EX1_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 1,
      baseOffset: 167,
      typeField: 'fx1.type',
      effectName: 'autoPan',
      typeValue: 20,
      keys: AUTO_PAN_PARAM_KEYS,
      uiByKey: AUTO_PAN_UI_BY_KEY,
      valueMapByKey: { speed: AUTO_PAN_SPEED_SYNC_VALUE_MAP },
      valueByKey: AUTO_PAN_VALUE_BY_KEY,
      notesByKey: AUTO_PAN_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 1,
      baseOffset: 167,
      typeField: 'fx1.type',
      effectName: 'tRayDelay',
      typeValue: 21,
      keys: T_RAY_DELAY_PARAM_KEYS,
      uiByKey: T_RAY_DELAY_UI_BY_KEY,
      valueByKey: T_RAY_DELAY_VALUE_BY_KEY,
      notesByKey: T_RAY_DELAY_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 1,
      baseOffset: 167,
      typeField: 'fx1.type',
      effectName: 'tcDeepRvrb',
      typeValue: 22,
      keys: TC_DEEP_RVRB_PARAM_KEYS,
      uiByKey: TC_DEEP_RVRB_UI_BY_KEY,
      valueMapByKey: { preset: TC_DEEP_RVRB_PRESET_VALUE_MAP },
      valueByKey: TC_DEEP_RVRB_VALUE_BY_KEY,
    });

    addFxTypedParams({
      slot: 1,
      baseOffset: 167,
      typeField: 'fx1.type',
      effectName: 'flangVerb',
      typeValue: 23,
      keys: FLANG_VERB_PARAM_KEYS,
      uiByKey: FLANG_VERB_UI_BY_KEY,
      valueByKey: FLANG_VERB_VALUE_BY_KEY,
      valueMapByKey: { speed: FLANG_VERB_SPEED_SYNC_VALUE_MAP },
      notesByKey: FLANG_VERB_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 1,
      baseOffset: 167,
      typeField: 'fx1.type',
      effectName: 'chorusVerb',
      typeValue: 24,
      keys: CHORUS_VERB_PARAM_KEYS,
      uiByKey: CHORUS_VERB_UI_BY_KEY,
      valueByKey: CHORUS_VERB_VALUE_BY_KEY,
      valueMapByKey: { speed: CHORUS_VERB_SPEED_SYNC_VALUE_MAP },
      notesByKey: CHORUS_VERB_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 1,
      baseOffset: 167,
      typeField: 'fx1.type',
      effectName: 'delayVerb',
      typeValue: 25,
      keys: DELAY_VERB_PARAM_KEYS,
      uiByKey: DELAY_VERB_UI_BY_KEY,
      valueByKey: DELAY_VERB_VALUE_BY_KEY,
      valueMapByKey: { pattern: DELAY_VERB_PATTERN_VALUE_MAP },
      notesByKey: DELAY_VERB_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 1,
      baseOffset: 167,
      typeField: 'fx1.type',
      effectName: 'chamberRev',
      typeValue: 26,
      keys: CHAMBER_REV_PARAM_KEYS,
      uiByKey: CHAMBER_REV_UI_BY_KEY,
      valueByKey: CHAMBER_REV_VALUE_BY_KEY,
      notesByKey: CHAMBER_REV_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 1,
      baseOffset: 167,
      typeField: 'fx1.type',
      effectName: 'roomRev',
      typeValue: 27,
      keys: ROOM_REV_PARAM_KEYS,
      uiByKey: ROOM_REV_UI_BY_KEY,
      valueByKey: ROOM_REV_VALUE_BY_KEY,
    });

    addFxTypedParams({
      slot: 1,
      baseOffset: 167,
      typeField: 'fx1.type',
      effectName: 'vintageRev',
      typeValue: 28,
      keys: VINTAGE_REV_PARAM_KEYS,
      uiByKey: VINTAGE_REV_UI_BY_KEY,
      valueByKey: VINTAGE_REV_VALUE_BY_KEY,
      valueMapByKey: { freeze: VINTAGE_REV_FREEZE_VALUE_MAP },
    });

    addFxTypedParams({
      slot: 1,
      baseOffset: 167,
      typeField: 'fx1.type',
      effectName: 'dualPitch',
      typeValue: 29,
      keys: DUAL_PITCH_PARAM_KEYS,
      uiByKey: DUAL_PITCH_UI_BY_KEY,
      valueByKey: DUAL_PITCH_VALUE_BY_KEY,
      valueMapByKey: DUAL_PITCH_VALUE_MAP_BY_KEY,
      notesByKey: DUAL_PITCH_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 1,
      baseOffset: 167,
      typeField: 'fx1.type',
      effectName: 'midasEQ',
      typeValue: 30,
      keys: MIDAS_EQ_PARAM_KEYS,
      uiByKey: MIDAS_EQ_UI_BY_KEY,
      valueMapByKey: MIDAS_EQ_VALUE_MAP_BY_KEY,
      valueByKey: MIDAS_EQ_VALUE_BY_KEY,
      notesByKey: MIDAS_EQ_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 1,
      baseOffset: 167,
      typeField: 'fx1.type',
      effectName: 'fairComp',
      typeValue: 31,
      keys: FAIR_COMP_PARAM_KEYS,
      uiByKey: FAIR_COMP_UI_BY_KEY,
      valueMapByKey: FAIR_COMP_VALUE_MAP_BY_KEY,
      valueByKey: FAIR_COMP_VALUE_BY_KEY,
      notesByKey: FAIR_COMP_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 1,
      baseOffset: 167,
      typeField: 'fx1.type',
      effectName: 'mulBndDist',
      typeValue: 32,
      keys: MUL_BND_DIST_PARAM_KEYS,
      uiByKey: MUL_BND_DIST_UI_BY_KEY,
      valueMapByKey: MUL_BND_DIST_VALUE_MAP_BY_KEY,
      valueByKey: MUL_BND_DIST_VALUE_BY_KEY,
      notesByKey: MUL_BND_DIST_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 1,
      baseOffset: 167,
      typeField: 'fx1.type',
      effectName: 'noiseGate',
      typeValue: 33,
      keys: NOISE_GATE_PARAM_KEYS,
      uiByKey: NOISE_GATE_UI_BY_KEY,
      valueMapByKey: NOISE_GATE_VALUE_MAP_BY_KEY,
      valueByKey: NOISE_GATE_VALUE_BY_KEY,
      notesByKey: NOISE_GATE_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 1,
      baseOffset: 167,
      typeField: 'fx1.type',
      effectName: 'decimDelay',
      typeValue: 34,
      keys: DECIM_DELAY_PARAM_KEYS,
      uiByKey: DECIM_DELAY_UI_BY_KEY,
      valueMapByKey: DECIM_DELAY_VALUE_MAP_BY_KEY,
      valueByKey: DECIM_DELAY_VALUE_BY_KEY,
      notesByKey: DECIM_DELAY_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 1,
      baseOffset: 167,
      typeField: 'fx1.type',
      effectName: 'vintgPitch',
      typeValue: 35,
      keys: VINTG_PITCH_PARAM_KEYS,
      uiByKey: VINTG_PITCH_UI_BY_KEY,
      valueByKey: VINTG_PITCH_VALUE_BY_KEY,
      valueMapByKey: VINTG_PITCH_VALUE_MAP_BY_KEY,
      notesByKey: VINTG_PITCH_NOTES_BY_KEY,
    });

    // FX2 type + params
    out.push({
      name: 'fx2.type',
      offset: 179,
      kind: { type: 'u8' },
      valueMap: FX_TYPE_VALUE_MAP,
      notes:
        'Observed in snapshots and aligns with NRPN 179 (FX 2 Type). Uses the same enum mapping as fx1.type (0..35).',
    });
    for (let i = 1; i <= 12; i++) {
      out.push({
        name: `fx2.param.${i}`,
        offset: 179 + i,
        kind: { type: 'u8' },
        notes:
          'FX slot 2 param. Meaning depends on fx2.type (per-effect). Stored as raw 0–255.',
      });
    }

    addFxTypedParams({
      slot: 2,
      baseOffset: 180,
      typeField: 'fx2.type',
      effectName: 'hallRev',
      typeValue: 1,
      keys: HALL_REV_PARAM_KEYS,
      uiByKey: HALL_REV_UI_BY_KEY,
      valueByKey: HALL_REV_VALUE_BY_KEY,
      notesByKey: HALL_REV_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 2,
      baseOffset: 180,
      typeField: 'fx2.type',
      effectName: 'plateRev',
      typeValue: 2,
      keys: PLATE_REV_PARAM_KEYS,
      uiByKey: PLATE_REV_UI_BY_KEY,
      valueByKey: PLATE_REV_VALUE_BY_KEY,
      notesByKey: PLATE_REV_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 2,
      baseOffset: 180,
      typeField: 'fx2.type',
      effectName: 'richPltRev',
      typeValue: 3,
      keys: RICH_PLT_REV_PARAM_KEYS,
      uiByKey: RICH_PLT_REV_UI_BY_KEY,
      valueByKey: RICH_PLT_REV_VALUE_BY_KEY,
      notesByKey: RICH_PLT_REV_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 2,
      baseOffset: 180,
      typeField: 'fx2.type',
      effectName: 'ambVerb',
      typeValue: 4,
      keys: AMB_VERB_PARAM_KEYS,
      uiByKey: AMB_VERB_UI_BY_KEY,
      valueByKey: AMB_VERB_VALUE_BY_KEY,
    });
    addFxTypedParams({
      slot: 2,
      baseOffset: 180,
      typeField: 'fx2.type',
      effectName: 'gatedRev',
      typeValue: 5,
      keys: GATED_REV_PARAM_KEYS,
      uiByKey: GATED_REV_UI_BY_KEY,
      valueByKey: GATED_REV_VALUE_BY_KEY,
      notesByKey: GATED_REV_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 2,
      baseOffset: 180,
      typeField: 'fx2.type',
      effectName: 'reverseRev',
      typeValue: 6,
      keys: REVERSE_REV_PARAM_KEYS,
      uiByKey: REVERSE_REV_UI_BY_KEY,
      valueByKey: REVERSE_REV_VALUE_BY_KEY,
      notesByKey: REVERSE_REV_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 2,
      baseOffset: 180,
      typeField: 'fx2.type',
      effectName: 'rackAmp',
      typeValue: 7,
      keys: RACK_AMP_PARAM_KEYS,
      uiByKey: RACK_AMP_UI_BY_KEY,
      valueByKey: RACK_AMP_VALUE_BY_KEY,
      valueMapByKey: RACK_AMP_VALUE_MAP_BY_KEY,
      notesByKey: RACK_AMP_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 2,
      baseOffset: 180,
      typeField: 'fx2.type',
      effectName: 'moodFilter',
      typeValue: 8,
      keys: MOOD_FILTER_PARAM_KEYS,
      uiByKey: MOOD_FILTER_UI_BY_KEY,
      valueMapByKey: MOOD_FILTER_VALUE_MAP_BY_KEY,
      valueByKey: MOOD_FILTER_VALUE_BY_KEY,
      notesByKey: MOOD_FILTER_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 2,
      baseOffset: 180,
      typeField: 'fx2.type',
      effectName: 'phaser',
      typeValue: 9,
      keys: PHASER_PARAM_KEYS,
      uiByKey: PHASER_UI_BY_KEY,
      valueMapByKey: { speed: PHASER_SPEED_SYNC_VALUE_MAP },
      valueByKey: PHASER_VALUE_BY_KEY,
      notesByKey: PHASER_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 2,
      baseOffset: 180,
      typeField: 'fx2.type',
      effectName: 'chorus',
      typeValue: 10,
      keys: CHORUS_PARAM_KEYS,
      uiByKey: CHORUS_UI_BY_KEY,
      valueMapByKey: { speed: CHORUS_SPEED_SYNC_VALUE_MAP },
      valueByKey: CHORUS_VALUE_BY_KEY,
      notesByKey: CHORUS_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 2,
      baseOffset: 180,
      typeField: 'fx2.type',
      effectName: 'flanger',
      typeValue: 11,
      keys: FLANGER_PARAM_KEYS,
      uiByKey: FLANGER_UI_BY_KEY,
      valueMapByKey: { speed: FLANGER_SPEED_SYNC_VALUE_MAP },
      valueByKey: FLANGER_VALUE_BY_KEY,
      notesByKey: FLANGER_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 2,
      baseOffset: 180,
      typeField: 'fx2.type',
      effectName: 'modDlytRev',
      typeValue: 12,
      keys: MOD_DLYT_REV_PARAM_KEYS,
      uiByKey: MOD_DLYT_REV_UI_BY_KEY,
      valueByKey: MOD_DLYT_REV_VALUE_BY_KEY,
      valueMapByKey: MOD_DLYT_REV_VALUE_MAP_BY_KEY,
      notesByKey: MOD_DLYT_REV_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 2,
      baseOffset: 180,
      typeField: 'fx2.type',
      effectName: 'delay',
      typeValue: 13,
      keys: DELAY_PARAM_KEYS,
      uiByKey: DELAY_UI_BY_KEY,
      valueMapByKey: DELAY_VALUE_MAP_BY_KEY,
      valueByKey: DELAY_VALUE_BY_KEY,
      notesByKey: DELAY_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 2,
      baseOffset: 180,
      typeField: 'fx2.type',
      effectName: 'threeTapDelay',
      typeValue: 14,
      keys: THREE_TAP_DELAY_PARAM_KEYS,
      uiByKey: THREE_TAP_DELAY_UI_BY_KEY,
      valueMapByKey: THREE_TAP_DELAY_VALUE_MAP_BY_KEY,
      valueByKey: THREE_TAP_DELAY_VALUE_BY_KEY,
      notesByKey: THREE_TAP_DELAY_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 2,
      baseOffset: 180,
      typeField: 'fx2.type',
      effectName: 'fourTapDelay',
      typeValue: 15,
      keys: FOUR_TAP_DELAY_PARAM_KEYS,
      uiByKey: FOUR_TAP_DELAY_UI_BY_KEY,
      valueMapByKey: FOUR_TAP_DELAY_VALUE_MAP_BY_KEY,
      valueByKey: FOUR_TAP_DELAY_VALUE_BY_KEY,
      notesByKey: FOUR_TAP_DELAY_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 2,
      baseOffset: 180,
      typeField: 'fx2.type',
      effectName: 'rotarySpkr',
      typeValue: 16,
      keys: ROTARY_SPKR_PARAM_KEYS,
      uiByKey: ROTARY_SPKR_UI_BY_KEY,
      valueMapByKey: ROTARY_SPKR_VALUE_MAP_BY_KEY,
      valueByKey: ROTARY_SPKR_VALUE_BY_KEY,
      notesByKey: ROTARY_SPKR_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 2,
      baseOffset: 180,
      typeField: 'fx2.type',
      effectName: 'chorusD',
      typeValue: 17,
      keys: CHORUS_D_PARAM_KEYS,
      uiByKey: CHORUS_D_UI_BY_KEY,
      valueByKey: CHORUS_D_VALUE_BY_KEY,
      valueMapByKey: CHORUS_D_VALUE_MAP_BY_KEY,
      notesByKey: CHORUS_D_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 2,
      baseOffset: 180,
      typeField: 'fx2.type',
      effectName: 'enhancer',
      typeValue: 18,
      keys: ENHANCER_PARAM_KEYS,
      uiByKey: ENHANCER_UI_BY_KEY,
      valueByKey: ENHANCER_VALUE_BY_KEY,
      valueMapByKey: ENHANCER_VALUE_MAP_BY_KEY,
      notesByKey: ENHANCER_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 2,
      baseOffset: 180,
      typeField: 'fx2.type',
      effectName: 'edisonEx1',
      typeValue: 19,
      keys: EDISON_EX1_PARAM_KEYS,
      uiByKey: EDISON_EX1_UI_BY_KEY,
      valueByKey: EDISON_EX1_VALUE_BY_KEY,
      valueMapByKey: EDISON_EX1_VALUE_MAP_BY_KEY,
      notesByKey: EDISON_EX1_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 2,
      baseOffset: 180,
      typeField: 'fx2.type',
      effectName: 'autoPan',
      typeValue: 20,
      keys: AUTO_PAN_PARAM_KEYS,
      uiByKey: AUTO_PAN_UI_BY_KEY,
      valueMapByKey: { speed: AUTO_PAN_SPEED_SYNC_VALUE_MAP },
      valueByKey: AUTO_PAN_VALUE_BY_KEY,
      notesByKey: AUTO_PAN_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 2,
      baseOffset: 180,
      typeField: 'fx2.type',
      effectName: 'tRayDelay',
      typeValue: 21,
      keys: T_RAY_DELAY_PARAM_KEYS,
      uiByKey: T_RAY_DELAY_UI_BY_KEY,
      valueByKey: T_RAY_DELAY_VALUE_BY_KEY,
      notesByKey: T_RAY_DELAY_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 2,
      baseOffset: 180,
      typeField: 'fx2.type',
      effectName: 'tcDeepRvrb',
      typeValue: 22,
      keys: TC_DEEP_RVRB_PARAM_KEYS,
      uiByKey: TC_DEEP_RVRB_UI_BY_KEY,
      valueMapByKey: { preset: TC_DEEP_RVRB_PRESET_VALUE_MAP },
      valueByKey: TC_DEEP_RVRB_VALUE_BY_KEY,
    });

    addFxTypedParams({
      slot: 2,
      baseOffset: 180,
      typeField: 'fx2.type',
      effectName: 'flangVerb',
      typeValue: 23,
      keys: FLANG_VERB_PARAM_KEYS,
      uiByKey: FLANG_VERB_UI_BY_KEY,
      valueByKey: FLANG_VERB_VALUE_BY_KEY,
      valueMapByKey: { speed: FLANG_VERB_SPEED_SYNC_VALUE_MAP },
      notesByKey: FLANG_VERB_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 2,
      baseOffset: 180,
      typeField: 'fx2.type',
      effectName: 'chorusVerb',
      typeValue: 24,
      keys: CHORUS_VERB_PARAM_KEYS,
      uiByKey: CHORUS_VERB_UI_BY_KEY,
      valueByKey: CHORUS_VERB_VALUE_BY_KEY,
      valueMapByKey: { speed: CHORUS_VERB_SPEED_SYNC_VALUE_MAP },
      notesByKey: CHORUS_VERB_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 2,
      baseOffset: 180,
      typeField: 'fx2.type',
      effectName: 'delayVerb',
      typeValue: 25,
      keys: DELAY_VERB_PARAM_KEYS,
      uiByKey: DELAY_VERB_UI_BY_KEY,
      valueByKey: DELAY_VERB_VALUE_BY_KEY,
      valueMapByKey: { pattern: DELAY_VERB_PATTERN_VALUE_MAP },
      notesByKey: DELAY_VERB_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 2,
      baseOffset: 180,
      typeField: 'fx2.type',
      effectName: 'chamberRev',
      typeValue: 26,
      keys: CHAMBER_REV_PARAM_KEYS,
      uiByKey: CHAMBER_REV_UI_BY_KEY,
      valueByKey: CHAMBER_REV_VALUE_BY_KEY,
      notesByKey: CHAMBER_REV_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 2,
      baseOffset: 180,
      typeField: 'fx2.type',
      effectName: 'roomRev',
      typeValue: 27,
      keys: ROOM_REV_PARAM_KEYS,
      uiByKey: ROOM_REV_UI_BY_KEY,
      valueByKey: ROOM_REV_VALUE_BY_KEY,
    });

    addFxTypedParams({
      slot: 2,
      baseOffset: 180,
      typeField: 'fx2.type',
      effectName: 'vintageRev',
      typeValue: 28,
      keys: VINTAGE_REV_PARAM_KEYS,
      uiByKey: VINTAGE_REV_UI_BY_KEY,
      valueByKey: VINTAGE_REV_VALUE_BY_KEY,
      valueMapByKey: { freeze: VINTAGE_REV_FREEZE_VALUE_MAP },
    });

    addFxTypedParams({
      slot: 2,
      baseOffset: 180,
      typeField: 'fx2.type',
      effectName: 'dualPitch',
      typeValue: 29,
      keys: DUAL_PITCH_PARAM_KEYS,
      uiByKey: DUAL_PITCH_UI_BY_KEY,
      valueByKey: DUAL_PITCH_VALUE_BY_KEY,
      valueMapByKey: DUAL_PITCH_VALUE_MAP_BY_KEY,
      notesByKey: DUAL_PITCH_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 2,
      baseOffset: 180,
      typeField: 'fx2.type',
      effectName: 'midasEQ',
      typeValue: 30,
      keys: MIDAS_EQ_PARAM_KEYS,
      uiByKey: MIDAS_EQ_UI_BY_KEY,
      valueMapByKey: MIDAS_EQ_VALUE_MAP_BY_KEY,
      valueByKey: MIDAS_EQ_VALUE_BY_KEY,
      notesByKey: MIDAS_EQ_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 2,
      baseOffset: 180,
      typeField: 'fx2.type',
      effectName: 'fairComp',
      typeValue: 31,
      keys: FAIR_COMP_PARAM_KEYS,
      uiByKey: FAIR_COMP_UI_BY_KEY,
      valueMapByKey: FAIR_COMP_VALUE_MAP_BY_KEY,
      valueByKey: FAIR_COMP_VALUE_BY_KEY,
      notesByKey: FAIR_COMP_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 2,
      baseOffset: 180,
      typeField: 'fx2.type',
      effectName: 'mulBndDist',
      typeValue: 32,
      keys: MUL_BND_DIST_PARAM_KEYS,
      uiByKey: MUL_BND_DIST_UI_BY_KEY,
      valueMapByKey: MUL_BND_DIST_VALUE_MAP_BY_KEY,
      valueByKey: MUL_BND_DIST_VALUE_BY_KEY,
      notesByKey: MUL_BND_DIST_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 2,
      baseOffset: 180,
      typeField: 'fx2.type',
      effectName: 'noiseGate',
      typeValue: 33,
      keys: NOISE_GATE_PARAM_KEYS,
      uiByKey: NOISE_GATE_UI_BY_KEY,
      valueMapByKey: NOISE_GATE_VALUE_MAP_BY_KEY,
      valueByKey: NOISE_GATE_VALUE_BY_KEY,
      notesByKey: NOISE_GATE_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 2,
      baseOffset: 180,
      typeField: 'fx2.type',
      effectName: 'decimDelay',
      typeValue: 34,
      keys: DECIM_DELAY_PARAM_KEYS,
      uiByKey: DECIM_DELAY_UI_BY_KEY,
      valueMapByKey: DECIM_DELAY_VALUE_MAP_BY_KEY,
      valueByKey: DECIM_DELAY_VALUE_BY_KEY,
      notesByKey: DECIM_DELAY_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 2,
      baseOffset: 180,
      typeField: 'fx2.type',
      effectName: 'vintgPitch',
      typeValue: 35,
      keys: VINTG_PITCH_PARAM_KEYS,
      uiByKey: VINTG_PITCH_UI_BY_KEY,
      valueByKey: VINTG_PITCH_VALUE_BY_KEY,
      valueMapByKey: VINTG_PITCH_VALUE_MAP_BY_KEY,
      notesByKey: VINTG_PITCH_NOTES_BY_KEY,
    });
    // FX3 type + params
    out.push({
      name: 'fx3.type',
      offset: 192,
      kind: { type: 'u8' },
      valueMap: FX_TYPE_VALUE_MAP,
      notes:
        'Observed in snapshots and aligns with NRPN 192 (FX 3 Type). Uses the same enum mapping as fx1.type (0..35).',
    });
    for (let i = 1; i <= 12; i++) {
      out.push({
        name: `fx3.param.${i}`,
        offset: 192 + i,
        kind: { type: 'u8' },
        notes:
          'FX slot 3 param. Meaning depends on fx3.type (per-effect). Stored as raw 0–255.',
      });
    }

    addFxTypedParams({
      slot: 3,
      baseOffset: 193,
      typeField: 'fx3.type',
      effectName: 'hallRev',
      typeValue: 1,
      keys: HALL_REV_PARAM_KEYS,
      uiByKey: HALL_REV_UI_BY_KEY,
      valueByKey: HALL_REV_VALUE_BY_KEY,
      notesByKey: HALL_REV_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 3,
      baseOffset: 193,
      typeField: 'fx3.type',
      effectName: 'plateRev',
      typeValue: 2,
      keys: PLATE_REV_PARAM_KEYS,
      uiByKey: PLATE_REV_UI_BY_KEY,
      valueByKey: PLATE_REV_VALUE_BY_KEY,
      notesByKey: PLATE_REV_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 3,
      baseOffset: 193,
      typeField: 'fx3.type',
      effectName: 'richPltRev',
      typeValue: 3,
      keys: RICH_PLT_REV_PARAM_KEYS,
      uiByKey: RICH_PLT_REV_UI_BY_KEY,
      valueByKey: RICH_PLT_REV_VALUE_BY_KEY,
      notesByKey: RICH_PLT_REV_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 3,
      baseOffset: 193,
      typeField: 'fx3.type',
      effectName: 'ambVerb',
      typeValue: 4,
      keys: AMB_VERB_PARAM_KEYS,
      uiByKey: AMB_VERB_UI_BY_KEY,
      valueByKey: AMB_VERB_VALUE_BY_KEY,
    });
    addFxTypedParams({
      slot: 3,
      baseOffset: 193,
      typeField: 'fx3.type',
      effectName: 'gatedRev',
      typeValue: 5,
      keys: GATED_REV_PARAM_KEYS,
      uiByKey: GATED_REV_UI_BY_KEY,
      valueByKey: GATED_REV_VALUE_BY_KEY,
      notesByKey: GATED_REV_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 3,
      baseOffset: 193,
      typeField: 'fx3.type',
      effectName: 'reverseRev',
      typeValue: 6,
      keys: REVERSE_REV_PARAM_KEYS,
      uiByKey: REVERSE_REV_UI_BY_KEY,
      valueByKey: REVERSE_REV_VALUE_BY_KEY,
      notesByKey: REVERSE_REV_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 3,
      baseOffset: 193,
      typeField: 'fx3.type',
      effectName: 'rackAmp',
      typeValue: 7,
      keys: RACK_AMP_PARAM_KEYS,
      uiByKey: RACK_AMP_UI_BY_KEY,
      valueByKey: RACK_AMP_VALUE_BY_KEY,
      valueMapByKey: RACK_AMP_VALUE_MAP_BY_KEY,
      notesByKey: RACK_AMP_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 3,
      baseOffset: 193,
      typeField: 'fx3.type',
      effectName: 'moodFilter',
      typeValue: 8,
      keys: MOOD_FILTER_PARAM_KEYS,
      uiByKey: MOOD_FILTER_UI_BY_KEY,
      valueMapByKey: MOOD_FILTER_VALUE_MAP_BY_KEY,
      valueByKey: MOOD_FILTER_VALUE_BY_KEY,
      notesByKey: MOOD_FILTER_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 3,
      baseOffset: 193,
      typeField: 'fx3.type',
      effectName: 'phaser',
      typeValue: 9,
      keys: PHASER_PARAM_KEYS,
      uiByKey: PHASER_UI_BY_KEY,
      valueMapByKey: { speed: PHASER_SPEED_SYNC_VALUE_MAP },
      valueByKey: PHASER_VALUE_BY_KEY,
      notesByKey: PHASER_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 3,
      baseOffset: 193,
      typeField: 'fx3.type',
      effectName: 'chorus',
      typeValue: 10,
      keys: CHORUS_PARAM_KEYS,
      uiByKey: CHORUS_UI_BY_KEY,
      valueMapByKey: { speed: CHORUS_SPEED_SYNC_VALUE_MAP },
      valueByKey: CHORUS_VALUE_BY_KEY,
      notesByKey: CHORUS_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 3,
      baseOffset: 193,
      typeField: 'fx3.type',
      effectName: 'flanger',
      typeValue: 11,
      keys: FLANGER_PARAM_KEYS,
      uiByKey: FLANGER_UI_BY_KEY,
      valueMapByKey: { speed: FLANGER_SPEED_SYNC_VALUE_MAP },
      valueByKey: FLANGER_VALUE_BY_KEY,
      notesByKey: FLANGER_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 3,
      baseOffset: 193,
      typeField: 'fx3.type',
      effectName: 'modDlytRev',
      typeValue: 12,
      keys: MOD_DLYT_REV_PARAM_KEYS,
      uiByKey: MOD_DLYT_REV_UI_BY_KEY,
      valueByKey: MOD_DLYT_REV_VALUE_BY_KEY,
      valueMapByKey: MOD_DLYT_REV_VALUE_MAP_BY_KEY,
      notesByKey: MOD_DLYT_REV_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 3,
      baseOffset: 193,
      typeField: 'fx3.type',
      effectName: 'delay',
      typeValue: 13,
      keys: DELAY_PARAM_KEYS,
      uiByKey: DELAY_UI_BY_KEY,
      valueMapByKey: DELAY_VALUE_MAP_BY_KEY,
      valueByKey: DELAY_VALUE_BY_KEY,
      notesByKey: DELAY_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 3,
      baseOffset: 193,
      typeField: 'fx3.type',
      effectName: 'threeTapDelay',
      typeValue: 14,
      keys: THREE_TAP_DELAY_PARAM_KEYS,
      uiByKey: THREE_TAP_DELAY_UI_BY_KEY,
      valueMapByKey: THREE_TAP_DELAY_VALUE_MAP_BY_KEY,
      valueByKey: THREE_TAP_DELAY_VALUE_BY_KEY,
      notesByKey: THREE_TAP_DELAY_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 3,
      baseOffset: 193,
      typeField: 'fx3.type',
      effectName: 'fourTapDelay',
      typeValue: 15,
      keys: FOUR_TAP_DELAY_PARAM_KEYS,
      uiByKey: FOUR_TAP_DELAY_UI_BY_KEY,
      valueMapByKey: FOUR_TAP_DELAY_VALUE_MAP_BY_KEY,
      valueByKey: FOUR_TAP_DELAY_VALUE_BY_KEY,
      notesByKey: FOUR_TAP_DELAY_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 3,
      baseOffset: 193,
      typeField: 'fx3.type',
      effectName: 'rotarySpkr',
      typeValue: 16,
      keys: ROTARY_SPKR_PARAM_KEYS,
      uiByKey: ROTARY_SPKR_UI_BY_KEY,
      valueMapByKey: ROTARY_SPKR_VALUE_MAP_BY_KEY,
      valueByKey: ROTARY_SPKR_VALUE_BY_KEY,
      notesByKey: ROTARY_SPKR_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 3,
      baseOffset: 193,
      typeField: 'fx3.type',
      effectName: 'chorusD',
      typeValue: 17,
      keys: CHORUS_D_PARAM_KEYS,
      uiByKey: CHORUS_D_UI_BY_KEY,
      valueByKey: CHORUS_D_VALUE_BY_KEY,
      valueMapByKey: CHORUS_D_VALUE_MAP_BY_KEY,
      notesByKey: CHORUS_D_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 3,
      baseOffset: 193,
      typeField: 'fx3.type',
      effectName: 'enhancer',
      typeValue: 18,
      keys: ENHANCER_PARAM_KEYS,
      uiByKey: ENHANCER_UI_BY_KEY,
      valueByKey: ENHANCER_VALUE_BY_KEY,
      valueMapByKey: ENHANCER_VALUE_MAP_BY_KEY,
      notesByKey: ENHANCER_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 3,
      baseOffset: 193,
      typeField: 'fx3.type',
      effectName: 'edisonEx1',
      typeValue: 19,
      keys: EDISON_EX1_PARAM_KEYS,
      uiByKey: EDISON_EX1_UI_BY_KEY,
      valueByKey: EDISON_EX1_VALUE_BY_KEY,
      valueMapByKey: EDISON_EX1_VALUE_MAP_BY_KEY,
      notesByKey: EDISON_EX1_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 3,
      baseOffset: 193,
      typeField: 'fx3.type',
      effectName: 'autoPan',
      typeValue: 20,
      keys: AUTO_PAN_PARAM_KEYS,
      uiByKey: AUTO_PAN_UI_BY_KEY,
      valueMapByKey: { speed: AUTO_PAN_SPEED_SYNC_VALUE_MAP },
      valueByKey: AUTO_PAN_VALUE_BY_KEY,
      notesByKey: AUTO_PAN_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 3,
      baseOffset: 193,
      typeField: 'fx3.type',
      effectName: 'tRayDelay',
      typeValue: 21,
      keys: T_RAY_DELAY_PARAM_KEYS,
      uiByKey: T_RAY_DELAY_UI_BY_KEY,
      valueByKey: T_RAY_DELAY_VALUE_BY_KEY,
      notesByKey: T_RAY_DELAY_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 3,
      baseOffset: 193,
      typeField: 'fx3.type',
      effectName: 'tcDeepRvrb',
      typeValue: 22,
      keys: TC_DEEP_RVRB_PARAM_KEYS,
      uiByKey: TC_DEEP_RVRB_UI_BY_KEY,
      valueMapByKey: { preset: TC_DEEP_RVRB_PRESET_VALUE_MAP },
      valueByKey: TC_DEEP_RVRB_VALUE_BY_KEY,
    });

    addFxTypedParams({
      slot: 3,
      baseOffset: 193,
      typeField: 'fx3.type',
      effectName: 'flangVerb',
      typeValue: 23,
      keys: FLANG_VERB_PARAM_KEYS,
      uiByKey: FLANG_VERB_UI_BY_KEY,
      valueByKey: FLANG_VERB_VALUE_BY_KEY,
      valueMapByKey: { speed: FLANG_VERB_SPEED_SYNC_VALUE_MAP },
      notesByKey: FLANG_VERB_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 3,
      baseOffset: 193,
      typeField: 'fx3.type',
      effectName: 'chorusVerb',
      typeValue: 24,
      keys: CHORUS_VERB_PARAM_KEYS,
      uiByKey: CHORUS_VERB_UI_BY_KEY,
      valueByKey: CHORUS_VERB_VALUE_BY_KEY,
      valueMapByKey: { speed: CHORUS_VERB_SPEED_SYNC_VALUE_MAP },
      notesByKey: CHORUS_VERB_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 3,
      baseOffset: 193,
      typeField: 'fx3.type',
      effectName: 'delayVerb',
      typeValue: 25,
      keys: DELAY_VERB_PARAM_KEYS,
      uiByKey: DELAY_VERB_UI_BY_KEY,
      valueByKey: DELAY_VERB_VALUE_BY_KEY,
      valueMapByKey: { pattern: DELAY_VERB_PATTERN_VALUE_MAP },
      notesByKey: DELAY_VERB_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 3,
      baseOffset: 193,
      typeField: 'fx3.type',
      effectName: 'chamberRev',
      typeValue: 26,
      keys: CHAMBER_REV_PARAM_KEYS,
      uiByKey: CHAMBER_REV_UI_BY_KEY,
      valueByKey: CHAMBER_REV_VALUE_BY_KEY,
      notesByKey: CHAMBER_REV_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 3,
      baseOffset: 193,
      typeField: 'fx3.type',
      effectName: 'roomRev',
      typeValue: 27,
      keys: ROOM_REV_PARAM_KEYS,
      uiByKey: ROOM_REV_UI_BY_KEY,
      valueByKey: ROOM_REV_VALUE_BY_KEY,
    });

    addFxTypedParams({
      slot: 3,
      baseOffset: 193,
      typeField: 'fx3.type',
      effectName: 'vintageRev',
      typeValue: 28,
      keys: VINTAGE_REV_PARAM_KEYS,
      uiByKey: VINTAGE_REV_UI_BY_KEY,
      valueByKey: VINTAGE_REV_VALUE_BY_KEY,
      valueMapByKey: { freeze: VINTAGE_REV_FREEZE_VALUE_MAP },
    });

    addFxTypedParams({
      slot: 3,
      baseOffset: 193,
      typeField: 'fx3.type',
      effectName: 'dualPitch',
      typeValue: 29,
      keys: DUAL_PITCH_PARAM_KEYS,
      uiByKey: DUAL_PITCH_UI_BY_KEY,
      valueByKey: DUAL_PITCH_VALUE_BY_KEY,
      valueMapByKey: DUAL_PITCH_VALUE_MAP_BY_KEY,
      notesByKey: DUAL_PITCH_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 3,
      baseOffset: 193,
      typeField: 'fx3.type',
      effectName: 'midasEQ',
      typeValue: 30,
      keys: MIDAS_EQ_PARAM_KEYS,
      uiByKey: MIDAS_EQ_UI_BY_KEY,
      valueMapByKey: MIDAS_EQ_VALUE_MAP_BY_KEY,
      valueByKey: MIDAS_EQ_VALUE_BY_KEY,
      notesByKey: MIDAS_EQ_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 3,
      baseOffset: 193,
      typeField: 'fx3.type',
      effectName: 'fairComp',
      typeValue: 31,
      keys: FAIR_COMP_PARAM_KEYS,
      uiByKey: FAIR_COMP_UI_BY_KEY,
      valueMapByKey: FAIR_COMP_VALUE_MAP_BY_KEY,
      valueByKey: FAIR_COMP_VALUE_BY_KEY,
      notesByKey: FAIR_COMP_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 3,
      baseOffset: 193,
      typeField: 'fx3.type',
      effectName: 'mulBndDist',
      typeValue: 32,
      keys: MUL_BND_DIST_PARAM_KEYS,
      uiByKey: MUL_BND_DIST_UI_BY_KEY,
      valueMapByKey: MUL_BND_DIST_VALUE_MAP_BY_KEY,
      valueByKey: MUL_BND_DIST_VALUE_BY_KEY,
      notesByKey: MUL_BND_DIST_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 3,
      baseOffset: 193,
      typeField: 'fx3.type',
      effectName: 'noiseGate',
      typeValue: 33,
      keys: NOISE_GATE_PARAM_KEYS,
      uiByKey: NOISE_GATE_UI_BY_KEY,
      valueMapByKey: NOISE_GATE_VALUE_MAP_BY_KEY,
      valueByKey: NOISE_GATE_VALUE_BY_KEY,
      notesByKey: NOISE_GATE_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 3,
      baseOffset: 193,
      typeField: 'fx3.type',
      effectName: 'decimDelay',
      typeValue: 34,
      keys: DECIM_DELAY_PARAM_KEYS,
      uiByKey: DECIM_DELAY_UI_BY_KEY,
      valueMapByKey: DECIM_DELAY_VALUE_MAP_BY_KEY,
      valueByKey: DECIM_DELAY_VALUE_BY_KEY,
      notesByKey: DECIM_DELAY_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 3,
      baseOffset: 193,
      typeField: 'fx3.type',
      effectName: 'vintgPitch',
      typeValue: 35,
      keys: VINTG_PITCH_PARAM_KEYS,
      uiByKey: VINTG_PITCH_UI_BY_KEY,
      valueByKey: VINTG_PITCH_VALUE_BY_KEY,
      valueMapByKey: VINTG_PITCH_VALUE_MAP_BY_KEY,
      notesByKey: VINTG_PITCH_NOTES_BY_KEY,
    });
    // FX4 type + params
    out.push({
      name: 'fx4.type',
      offset: 205,
      kind: { type: 'u8' },
      valueMap: FX_TYPE_VALUE_MAP,
      notes:
        'Observed in snapshots and aligns with NRPN 205 (FX 4 Type). Uses the same enum mapping as fx1.type (0..35).',
    });
    for (let i = 1; i <= 12; i++) {
      out.push({
        name: `fx4.param.${i}`,
        offset: 205 + i,
        kind: { type: 'u8' },
        notes:
          'FX slot 4 param. Meaning depends on fx4.type (per-effect). Stored as raw 0–255.',
      });
    }

    addFxTypedParams({
      slot: 4,
      baseOffset: 206,
      typeField: 'fx4.type',
      effectName: 'hallRev',
      typeValue: 1,
      keys: HALL_REV_PARAM_KEYS,
      uiByKey: HALL_REV_UI_BY_KEY,
      valueByKey: HALL_REV_VALUE_BY_KEY,
      notesByKey: HALL_REV_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 4,
      baseOffset: 206,
      typeField: 'fx4.type',
      effectName: 'plateRev',
      typeValue: 2,
      keys: PLATE_REV_PARAM_KEYS,
      uiByKey: PLATE_REV_UI_BY_KEY,
      valueByKey: PLATE_REV_VALUE_BY_KEY,
      notesByKey: PLATE_REV_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 4,
      baseOffset: 206,
      typeField: 'fx4.type',
      effectName: 'richPltRev',
      typeValue: 3,
      keys: RICH_PLT_REV_PARAM_KEYS,
      uiByKey: RICH_PLT_REV_UI_BY_KEY,
      valueByKey: RICH_PLT_REV_VALUE_BY_KEY,
      notesByKey: RICH_PLT_REV_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 4,
      baseOffset: 206,
      typeField: 'fx4.type',
      effectName: 'ambVerb',
      typeValue: 4,
      keys: AMB_VERB_PARAM_KEYS,
      uiByKey: AMB_VERB_UI_BY_KEY,
      valueByKey: AMB_VERB_VALUE_BY_KEY,
    });
    addFxTypedParams({
      slot: 4,
      baseOffset: 206,
      typeField: 'fx4.type',
      effectName: 'gatedRev',
      typeValue: 5,
      keys: GATED_REV_PARAM_KEYS,
      uiByKey: GATED_REV_UI_BY_KEY,
      valueByKey: GATED_REV_VALUE_BY_KEY,
      notesByKey: GATED_REV_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 4,
      baseOffset: 206,
      typeField: 'fx4.type',
      effectName: 'reverseRev',
      typeValue: 6,
      keys: REVERSE_REV_PARAM_KEYS,
      uiByKey: REVERSE_REV_UI_BY_KEY,
      valueByKey: REVERSE_REV_VALUE_BY_KEY,
      notesByKey: REVERSE_REV_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 4,
      baseOffset: 206,
      typeField: 'fx4.type',
      effectName: 'rackAmp',
      typeValue: 7,
      keys: RACK_AMP_PARAM_KEYS,
      uiByKey: RACK_AMP_UI_BY_KEY,
      valueByKey: RACK_AMP_VALUE_BY_KEY,
      valueMapByKey: RACK_AMP_VALUE_MAP_BY_KEY,
      notesByKey: RACK_AMP_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 4,
      baseOffset: 206,
      typeField: 'fx4.type',
      effectName: 'moodFilter',
      typeValue: 8,
      keys: MOOD_FILTER_PARAM_KEYS,
      uiByKey: MOOD_FILTER_UI_BY_KEY,
      valueMapByKey: MOOD_FILTER_VALUE_MAP_BY_KEY,
      valueByKey: MOOD_FILTER_VALUE_BY_KEY,
      notesByKey: MOOD_FILTER_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 4,
      baseOffset: 206,
      typeField: 'fx4.type',
      effectName: 'phaser',
      typeValue: 9,
      keys: PHASER_PARAM_KEYS,
      uiByKey: PHASER_UI_BY_KEY,
      valueMapByKey: { speed: PHASER_SPEED_SYNC_VALUE_MAP },
      valueByKey: PHASER_VALUE_BY_KEY,
      notesByKey: PHASER_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 4,
      baseOffset: 206,
      typeField: 'fx4.type',
      effectName: 'chorus',
      typeValue: 10,
      keys: CHORUS_PARAM_KEYS,
      uiByKey: CHORUS_UI_BY_KEY,
      valueMapByKey: { speed: CHORUS_SPEED_SYNC_VALUE_MAP },
      valueByKey: CHORUS_VALUE_BY_KEY,
      notesByKey: CHORUS_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 4,
      baseOffset: 206,
      typeField: 'fx4.type',
      effectName: 'flanger',
      typeValue: 11,
      keys: FLANGER_PARAM_KEYS,
      uiByKey: FLANGER_UI_BY_KEY,
      valueMapByKey: { speed: FLANGER_SPEED_SYNC_VALUE_MAP },
      valueByKey: FLANGER_VALUE_BY_KEY,
      notesByKey: FLANGER_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 4,
      baseOffset: 206,
      typeField: 'fx4.type',
      effectName: 'modDlytRev',
      typeValue: 12,
      keys: MOD_DLYT_REV_PARAM_KEYS,
      uiByKey: MOD_DLYT_REV_UI_BY_KEY,
      valueByKey: MOD_DLYT_REV_VALUE_BY_KEY,
      valueMapByKey: MOD_DLYT_REV_VALUE_MAP_BY_KEY,
      notesByKey: MOD_DLYT_REV_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 4,
      baseOffset: 206,
      typeField: 'fx4.type',
      effectName: 'delay',
      typeValue: 13,
      keys: DELAY_PARAM_KEYS,
      uiByKey: DELAY_UI_BY_KEY,
      valueMapByKey: DELAY_VALUE_MAP_BY_KEY,
      valueByKey: DELAY_VALUE_BY_KEY,
      notesByKey: DELAY_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 4,
      baseOffset: 206,
      typeField: 'fx4.type',
      effectName: 'threeTapDelay',
      typeValue: 14,
      keys: THREE_TAP_DELAY_PARAM_KEYS,
      uiByKey: THREE_TAP_DELAY_UI_BY_KEY,
      valueMapByKey: THREE_TAP_DELAY_VALUE_MAP_BY_KEY,
      valueByKey: THREE_TAP_DELAY_VALUE_BY_KEY,
      notesByKey: THREE_TAP_DELAY_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 4,
      baseOffset: 206,
      typeField: 'fx4.type',
      effectName: 'fourTapDelay',
      typeValue: 15,
      keys: FOUR_TAP_DELAY_PARAM_KEYS,
      uiByKey: FOUR_TAP_DELAY_UI_BY_KEY,
      valueMapByKey: FOUR_TAP_DELAY_VALUE_MAP_BY_KEY,
      valueByKey: FOUR_TAP_DELAY_VALUE_BY_KEY,
      notesByKey: FOUR_TAP_DELAY_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 4,
      baseOffset: 206,
      typeField: 'fx4.type',
      effectName: 'rotarySpkr',
      typeValue: 16,
      keys: ROTARY_SPKR_PARAM_KEYS,
      uiByKey: ROTARY_SPKR_UI_BY_KEY,
      valueMapByKey: ROTARY_SPKR_VALUE_MAP_BY_KEY,
      valueByKey: ROTARY_SPKR_VALUE_BY_KEY,
      notesByKey: ROTARY_SPKR_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 4,
      baseOffset: 206,
      typeField: 'fx4.type',
      effectName: 'chorusD',
      typeValue: 17,
      keys: CHORUS_D_PARAM_KEYS,
      uiByKey: CHORUS_D_UI_BY_KEY,
      valueByKey: CHORUS_D_VALUE_BY_KEY,
      valueMapByKey: CHORUS_D_VALUE_MAP_BY_KEY,
      notesByKey: CHORUS_D_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 4,
      baseOffset: 206,
      typeField: 'fx4.type',
      effectName: 'enhancer',
      typeValue: 18,
      keys: ENHANCER_PARAM_KEYS,
      uiByKey: ENHANCER_UI_BY_KEY,
      valueByKey: ENHANCER_VALUE_BY_KEY,
      valueMapByKey: ENHANCER_VALUE_MAP_BY_KEY,
      notesByKey: ENHANCER_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 4,
      baseOffset: 206,
      typeField: 'fx4.type',
      effectName: 'edisonEx1',
      typeValue: 19,
      keys: EDISON_EX1_PARAM_KEYS,
      uiByKey: EDISON_EX1_UI_BY_KEY,
      valueByKey: EDISON_EX1_VALUE_BY_KEY,
      valueMapByKey: EDISON_EX1_VALUE_MAP_BY_KEY,
      notesByKey: EDISON_EX1_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 4,
      baseOffset: 206,
      typeField: 'fx4.type',
      effectName: 'autoPan',
      typeValue: 20,
      keys: AUTO_PAN_PARAM_KEYS,
      uiByKey: AUTO_PAN_UI_BY_KEY,
      valueMapByKey: { speed: AUTO_PAN_SPEED_SYNC_VALUE_MAP },
      valueByKey: AUTO_PAN_VALUE_BY_KEY,
      notesByKey: AUTO_PAN_NOTES_BY_KEY,
    });
    addFxTypedParams({
      slot: 4,
      baseOffset: 206,
      typeField: 'fx4.type',
      effectName: 'tRayDelay',
      typeValue: 21,
      keys: T_RAY_DELAY_PARAM_KEYS,
      uiByKey: T_RAY_DELAY_UI_BY_KEY,
      valueByKey: T_RAY_DELAY_VALUE_BY_KEY,
      notesByKey: T_RAY_DELAY_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 4,
      baseOffset: 206,
      typeField: 'fx4.type',
      effectName: 'tcDeepRvrb',
      typeValue: 22,
      keys: TC_DEEP_RVRB_PARAM_KEYS,
      uiByKey: TC_DEEP_RVRB_UI_BY_KEY,
      valueMapByKey: { preset: TC_DEEP_RVRB_PRESET_VALUE_MAP },
      valueByKey: TC_DEEP_RVRB_VALUE_BY_KEY,
    });

    addFxTypedParams({
      slot: 4,
      baseOffset: 206,
      typeField: 'fx4.type',
      effectName: 'flangVerb',
      typeValue: 23,
      keys: FLANG_VERB_PARAM_KEYS,
      uiByKey: FLANG_VERB_UI_BY_KEY,
      valueByKey: FLANG_VERB_VALUE_BY_KEY,
      valueMapByKey: { speed: FLANG_VERB_SPEED_SYNC_VALUE_MAP },
      notesByKey: FLANG_VERB_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 4,
      baseOffset: 206,
      typeField: 'fx4.type',
      effectName: 'chorusVerb',
      typeValue: 24,
      keys: CHORUS_VERB_PARAM_KEYS,
      uiByKey: CHORUS_VERB_UI_BY_KEY,
      valueByKey: CHORUS_VERB_VALUE_BY_KEY,
      valueMapByKey: { speed: CHORUS_VERB_SPEED_SYNC_VALUE_MAP },
      notesByKey: CHORUS_VERB_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 4,
      baseOffset: 206,
      typeField: 'fx4.type',
      effectName: 'delayVerb',
      typeValue: 25,
      keys: DELAY_VERB_PARAM_KEYS,
      uiByKey: DELAY_VERB_UI_BY_KEY,
      valueByKey: DELAY_VERB_VALUE_BY_KEY,
      valueMapByKey: { pattern: DELAY_VERB_PATTERN_VALUE_MAP },
      notesByKey: DELAY_VERB_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 4,
      baseOffset: 206,
      typeField: 'fx4.type',
      effectName: 'chamberRev',
      typeValue: 26,
      keys: CHAMBER_REV_PARAM_KEYS,
      uiByKey: CHAMBER_REV_UI_BY_KEY,
      valueByKey: CHAMBER_REV_VALUE_BY_KEY,
      notesByKey: CHAMBER_REV_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 4,
      baseOffset: 206,
      typeField: 'fx4.type',
      effectName: 'roomRev',
      typeValue: 27,
      keys: ROOM_REV_PARAM_KEYS,
      uiByKey: ROOM_REV_UI_BY_KEY,
      valueByKey: ROOM_REV_VALUE_BY_KEY,
    });

    addFxTypedParams({
      slot: 4,
      baseOffset: 206,
      typeField: 'fx4.type',
      effectName: 'vintageRev',
      typeValue: 28,
      keys: VINTAGE_REV_PARAM_KEYS,
      uiByKey: VINTAGE_REV_UI_BY_KEY,
      valueByKey: VINTAGE_REV_VALUE_BY_KEY,
      valueMapByKey: { freeze: VINTAGE_REV_FREEZE_VALUE_MAP },
    });

    addFxTypedParams({
      slot: 4,
      baseOffset: 206,
      typeField: 'fx4.type',
      effectName: 'dualPitch',
      typeValue: 29,
      keys: DUAL_PITCH_PARAM_KEYS,
      uiByKey: DUAL_PITCH_UI_BY_KEY,
      valueByKey: DUAL_PITCH_VALUE_BY_KEY,
      valueMapByKey: DUAL_PITCH_VALUE_MAP_BY_KEY,
      notesByKey: DUAL_PITCH_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 4,
      baseOffset: 206,
      typeField: 'fx4.type',
      effectName: 'midasEQ',
      typeValue: 30,
      keys: MIDAS_EQ_PARAM_KEYS,
      uiByKey: MIDAS_EQ_UI_BY_KEY,
      valueMapByKey: MIDAS_EQ_VALUE_MAP_BY_KEY,
      valueByKey: MIDAS_EQ_VALUE_BY_KEY,
      notesByKey: MIDAS_EQ_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 4,
      baseOffset: 206,
      typeField: 'fx4.type',
      effectName: 'fairComp',
      typeValue: 31,
      keys: FAIR_COMP_PARAM_KEYS,
      uiByKey: FAIR_COMP_UI_BY_KEY,
      valueMapByKey: FAIR_COMP_VALUE_MAP_BY_KEY,
      valueByKey: FAIR_COMP_VALUE_BY_KEY,
      notesByKey: FAIR_COMP_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 4,
      baseOffset: 206,
      typeField: 'fx4.type',
      effectName: 'mulBndDist',
      typeValue: 32,
      keys: MUL_BND_DIST_PARAM_KEYS,
      uiByKey: MUL_BND_DIST_UI_BY_KEY,
      valueMapByKey: MUL_BND_DIST_VALUE_MAP_BY_KEY,
      valueByKey: MUL_BND_DIST_VALUE_BY_KEY,
      notesByKey: MUL_BND_DIST_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 4,
      baseOffset: 206,
      typeField: 'fx4.type',
      effectName: 'noiseGate',
      typeValue: 33,
      keys: NOISE_GATE_PARAM_KEYS,
      uiByKey: NOISE_GATE_UI_BY_KEY,
      valueMapByKey: NOISE_GATE_VALUE_MAP_BY_KEY,
      valueByKey: NOISE_GATE_VALUE_BY_KEY,
      notesByKey: NOISE_GATE_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 4,
      baseOffset: 206,
      typeField: 'fx4.type',
      effectName: 'decimDelay',
      typeValue: 34,
      keys: DECIM_DELAY_PARAM_KEYS,
      uiByKey: DECIM_DELAY_UI_BY_KEY,
      valueMapByKey: DECIM_DELAY_VALUE_MAP_BY_KEY,
      valueByKey: DECIM_DELAY_VALUE_BY_KEY,
      notesByKey: DECIM_DELAY_NOTES_BY_KEY,
    });

    addFxTypedParams({
      slot: 4,
      baseOffset: 206,
      typeField: 'fx4.type',
      effectName: 'vintgPitch',
      typeValue: 35,
      keys: VINTG_PITCH_PARAM_KEYS,
      uiByKey: VINTG_PITCH_UI_BY_KEY,
      valueByKey: VINTG_PITCH_VALUE_BY_KEY,
      valueMapByKey: VINTG_PITCH_VALUE_MAP_BY_KEY,
      notesByKey: VINTG_PITCH_NOTES_BY_KEY,
    });

    // Output gains + mode
    out.push(
      {
        name: 'fx1.outputGain',
        offset: 218,
        kind: { type: 'u8' },
        notes: 'Observed in snapshots and aligns with NRPN 218 (FX 1 Output Gain). Range per NRPN table: 0–150.',
      },
      {
        name: 'fx2.outputGain',
        offset: 219,
        kind: { type: 'u8' },
        notes: 'Observed in snapshots and aligns with NRPN 219 (FX 2 Output Gain). Range per NRPN table: 0–150.',
      },
      {
        name: 'fx3.outputGain',
        offset: 220,
        kind: { type: 'u8' },
        notes: 'Observed in snapshots and aligns with NRPN 220 (FX 3 Output Gain). Range per NRPN table: 0–150.',
      },
      {
        name: 'fx4.outputGain',
        offset: 221,
        kind: { type: 'u8' },
        notes: 'Observed in snapshots and aligns with NRPN 221 (FX 4 Output Gain). Range per NRPN table: 0–150.',
      },
      {
        name: 'fx.mode',
        offset: 222,
        kind: { type: 'u8' },
        valueMap: {
          0: 'Insert',
          1: 'Send',
          2: 'Bypass',
        },
        notes: 'Verified by NRPN sweep+snapshot diff: NRPN 222 changes only byte[222] (0-based). Raw values observed: 0=Insert, 1=Send, 2=Bypass.',
      },
    );

    return out;
  })(),
  {
    name: 'panel.arpSeq.rate',
    offset: 157,
    kind: { type: 'u8' },
    ui: { abbr: 'RTE', name: 'ArpRate' },
    notes: 'Discovered by before/after diff while moving the physical ARP/SEQ Rate slider; decoded edit-buffer payload byte[157] (0-based).',
  },
  {
    name: 'panel.arpSeq.gateTime',
    offset: 160,
    kind: { type: 'u8' },
    ui: { abbr: 'GAT', name: 'ArpGate' },
    notes: 'Discovered by before/after diff while moving the physical ARP/SEQ Gate Time slider; decoded edit-buffer payload byte[160] (0-based).',
  },
  {
    name: 'osc1.square',
    offset: 18,
    kind: { type: 'u8' },
    ui: { abbr: 'SQR', name: 'Osc1Square' },
    valueMap: {
      0: 'Off',
      1: 'On',
    },
    notes: 'Discovered by before/after diff while toggling OSC 1 Square waveform switch; decoded edit-buffer payload byte[18] (0-based).',
  },
  {
    name: 'osc1.sawtooth',
    offset: 19,
    kind: { type: 'u8' },
    ui: { abbr: 'SAW', name: 'Osc1Saw' },
    valueMap: {
      0: 'Off',
      1: 'On',
    },
    notes: 'Discovered by before/after diff while toggling OSC 1 Sawtooth waveform switch; decoded edit-buffer payload byte[19] (0-based).',
  },
  {
    name: 'osc1.pitchMod',
    offset: 21,
    kind: { type: 'u8' },
    ui: { abbr: 'PM1', name: 'Osc1PitchMod' },
    value: { min: 0, max: 36, modDestination: true },
    notes: 'Discovered by before/after diff while adjusting OSC 1 Pitch Mod slider; decoded edit-buffer payload byte[21] (0-based). Non-linear: most resolution at low values (0–10 ≈ 0–2 semitones, 200+ ≈ up to 36 semitones). Keep below raw 20 for subtle vibrato.',
  },
  {
    name: 'osc1.pwm',
    offset: 25,
    kind: { type: 'u8' },
    ui: { abbr: 'PWM', name: 'Osc1Pwm' },
    value: { units: '%', min: 50, max: 99 },
    notes: 'Discovered by before/after diff while adjusting OSC 1 PWM slider; decoded edit-buffer payload byte[25] (0-based). When source=Manual: raw 0=50% (square wave), raw 255=99% (narrow pulse). When modulated: raw sets depth (0 to ±49%). Only affects the square waveform.',
  },
  {
    name: 'osc2.sync',
    offset: 20,
    kind: { type: 'u8' },
    ui: { abbr: 'SYN', name: 'Osc2Sync' },
    valueMap: {
      0: 'Off',
      1: 'On',
    },
    notes: 'Discovered by before/after diff while enabling OSC 2 Sync; decoded edit-buffer payload byte[20] (0-based). Hard-syncs OSC 2 to OSC 1. Sweeping osc2.pitch with sync on creates classic sync-sweep timbres.',
  },
  {
    name: 'osc2.level',
    offset: 26,
    kind: { type: 'u8' },
    ui: { abbr: 'LV2', name: 'Osc2Level' },
    value: { units: 'dB', min: -48, max: 0 },
    notes: 'Discovered by before/after diff while adjusting OSC 2 Level slider; decoded edit-buffer payload byte[26] (0-based). Raw 0 = Off (silent). For balanced two-oscillator sounds set to raw 255 (0.0 dB). Reduce for subtle layering.',
  },
  {
    name: 'osc2.pitch',
    offset: 27,
    kind: { type: 'u8' },
    ui: { abbr: 'PT2', name: 'Osc2Pitch' },
    value: { min: -12, max: 12, modDestination: true },
    notes: 'Discovered by before/after diff while adjusting OSC 2 Pitch slider; decoded edit-buffer payload byte[27] (0-based). Raw 128 = unison with OSC 1. Fine resolution near center in cents. Slight detune (raw 125–131) creates width; raw 116=−12st, raw 140=+12st.',
  },
  {
    name: 'osc2.toneMod',
    offset: 28,
    kind: { type: 'u8' },
    ui: { abbr: 'TM2', name: 'Osc2ToneMod' },
    value: { units: '%', min: 50, max: 100 },
    notes: 'Discovered by before/after diff while adjusting OSC 2 Tone Mod slider; decoded edit-buffer payload byte[28] (0-based). Splits the square wave cycle with a pulse insert — creates metallic, bell-like timbres. Higher values = wider pulse interrupt. Good for complex textures.',
  },
  {
    name: 'osc2.pitchMod',
    offset: 29,
    kind: { type: 'u8' },
    ui: { abbr: 'PM2', name: 'Osc2PitchMod' },
    value: { min: 0, max: 36, modDestination: true },
    notes: 'Discovered by before/after diff while adjusting OSC 2 Pitch Mod slider; decoded edit-buffer payload byte[29] (0-based). Non-linear same as osc1.pitchMod: 0–10 ≈ 0–2 semitones, 200+ ≈ 36 semitones.',
  },
  {
    name: 'osc2.aftertouch.pitchMod',
    offset: 30,
    kind: { type: 'u8' },
    ui: { abbr: 'AT2', name: 'Osc2ATchPM' },
    value: { units: '%', min: 0, max: 100 },
    notes: 'Discovered by NRPN 30 test; decoded edit-buffer payload byte[30] (0-based). Aftertouch scales OSC 2 pitch mod depth. Default 0.',
  },
  {
    name: 'osc2.modWheel.pitchMod',
    offset: 31,
    kind: { type: 'u8' },
    ui: { abbr: 'MW2', name: 'Osc2MWheelPM' },
    value: { units: '%', min: 0, max: 100 },
    notes: 'Discovered by NRPN 31 test; decoded edit-buffer payload byte[31] (0-based). Mod wheel scales OSC 2 pitch mod depth. Default 0.',
  },
  {
    name: 'osc2.pitchModSelect',
    offset: 32,
    kind: { type: 'u8' },
    ui: { abbr: 'PS2', name: 'Osc2PitchModSrc' },
    valueMap: {
      0: 'LFO 1',
      1: 'LFO 2',
      2: 'VCA Env',
      3: 'VCF Env',
      4: 'Mod Env',
      5: 'Unipolar (LFO 1)',
      6: 'Unipolar (LFO 2)',
    },
    notes: 'Discovered by NRPN 32 test; decoded edit-buffer payload byte[32] (0-based).',
  },
  {
    name: 'noise.level',
    offset: 33,
    kind: { type: 'u8' },
    ui: { abbr: 'NOI', name: 'NoiseLevel' },
    value: { units: 'dB', min: -48, max: 0 },
    notes: 'Discovered by NRPN 33 test; decoded edit-buffer payload byte[33] (0-based). Pink noise with low-frequency roll-off. Raw 0 = Off (silent). Raw 100–150 for breathy/atmospheric textures. Raw 255 = 0.0 dB (full level).',
  },
  {
    name: 'portamento.time',
    offset: 34,
    kind: { type: 'u8' },
    ui: { abbr: 'PRT', name: 'PortaTime' },
    value: { units: 's', min: 0, max: 10 },
    notes: 'Discovered by NRPN 34 test; decoded edit-buffer payload byte[34] (0-based). Raw 0 = 0.00 s (instant/off), raw 255 = 10.00 s. Default 0.',
  },
  {
    name: 'portamento.mode',
    offset: 35,
    kind: { type: 'u8' },
    ui: { abbr: 'PRM', name: 'PortaMode' },
    valueMap: {
      0: 'Normal',
      1: 'Fingered',
      2: 'Fixed Rate',
      3: 'Fixed Rate Fingered',
      4: 'Exponential',
      5: 'Exponential Fingered',
      6: 'Fixed +2',
      7: 'Fixed -2',
      8: 'Fixed +5',
      9: 'Fixed -5',
      10: 'Fixed +12',
      11: 'Fixed -12',
      12: 'Fixed +24',
      13: 'Fixed -24',
    },
    notes: 'Discovered by NRPN 35 test; decoded edit-buffer payload byte[35] (0-based).',
  },
  {
    name: 'pitchBend.upDepth',
    offset: 36,
    kind: { type: 'u8' },
    ui: { abbr: 'PBU', name: 'PBendUp' },
    value: { min: 0, max: 24 },
    notes:
      'Discovered by NRPN 36 test; decoded edit-buffer payload byte[36] (0-based). Range 0–24 semitones. Buffer stores as signed int8 with offset: byte ≈ (value - 24) mod 256. Default +2 semitones.',
  },
  {
    name: 'pitchBend.downDepth',
    offset: 37,
    kind: { type: 'u8' },
    ui: { abbr: 'PBD', name: 'PBendDown' },
    value: { min: 0, max: 24 },
    notes:
      'Discovered by NRPN 37 test; decoded edit-buffer payload byte[37] (0-based). Range 0–24 semitones. Same encoding as pitchBend.upDepth: byte ≈ (value - 24) mod 256. Default -2 semitones.',
  },
  {
    name: 'osc1.pitchModMode',
    offset: 38,
    kind: { type: 'u8' },
    ui: { abbr: 'PMM', name: 'PitchModMode' },
    valueMap: {
      0: 'OSC 1+2',
      1: 'OSC 1 Only',
    },
    notes: 'Discovered by NRPN 38 test; decoded edit-buffer payload byte[38] (0-based). When OSC 1 Only (1), LFO pitch mod only affects OSC 1 — useful for classic one-oscillator vibrato while OSC 2 stays stable.',
  },
  {
    name: 'lfo1.rate',
    offset: 0,
    kind: { type: 'u8' },
    ui: { abbr: 'RAT', name: 'Lfo1Rate' },
    value: { units: 'Hz', min: 0.041, max: 65.4 },
    condition: { field: 'lfo1.arpSeq.sync', equals: 0 },
    notes: 'Discovered by before/after diff while moving the physical LFO 1 Rate slider; decoded edit-buffer payload byte[0] (0-based). Non-linear: raw 0 = 0.041 Hz (24 s cycle), raw 255 = 65.4 Hz (audio-rate FM). When ARP Sync is Off, this parameter controls free-running LFO rate.',
  },
  {
    name: 'lfo1.clockDivide',
    offset: 0,
    kind: { type: 'u8' },
    ui: { abbr: 'DIV', name: 'Lfo1Div' },
    condition: { field: 'lfo1.arpSeq.sync', equals: 1 },
    valueMap: {
      255: '1/64',
      242: '1/48',
      229: '3/128',
      216: '1/32',
      203: '1/24',
      190: '3/64',
      177: '1/16',
      164: '1/12',
      151: '3/32',
      138: '1/8',
      125: '1/6',
      112: '3/16',
      99: '1/4',
      86: '1/3',
      73: '3/8',
      60: '1/2',
      47: '1',
      34: '2',
      21: '3',
      8: '4',
    },
    notes: 'Same offset as lfo1.rate; decoded edit-buffer payload byte[0] (0-based). When ARP Sync is On (lfo1.arpSeq.sync=On), this parameter becomes tempo-synced clock division. Use lfo1.arpSeq.sync to determine which interpretation applies.',
  },
  {
    name: 'lfo1.delayTime',
    offset: 1,
    kind: { type: 'u8' },
    ui: { abbr: 'DLY', name: 'Lfo1Delay' },
    value: { units: 's', min: 0, max: 6.59 },
    notes: 'Discovered by before/after diff while moving the physical LFO 1 Delay Time slider; decoded edit-buffer payload byte[1] (0-based). Raw 0 = no delay (LFO starts immediately). Higher values delay onset; 40% pure delay then 60% fade-in. Max raw 255 ≈ 6.59 s.',
  },
  {
    name: 'lfo1.shape',
    offset: 2,
    kind: { type: 'u8' },
    ui: { abbr: 'SHP', name: 'Lfo1Shape' },
    valueMap: {
      0: 'Sine',
      1: 'Triangle',
      2: 'Square',
      3: 'Ramp Up',
      4: 'Ramp Down',
      5: 'S&H',
      6: 'S&H Glide',
    },
    notes: 'Discovered by before/after diff while changing LFO 1 Shape in the edit menu; decoded edit-buffer payload byte[2] (0-based).',
  },
  {
    name: 'lfo1.keySync',
    offset: 3,
    kind: { type: 'u8' },
    ui: { abbr: 'KSY', name: 'Lfo1KeySync' },
    valueMap: {
      0: 'Off',
      1: 'On',
    },
    notes: 'Discovered by before/after diff while toggling LFO 1 Key Sync in the edit menu; decoded edit-buffer payload byte[3] (0-based). When On, LFO phase resets on each note-on.',
  },
  {
    name: 'lfo1.arpSeq.sync',
    offset: 4,
    kind: { type: 'u8' },
    ui: { abbr: 'ASY', name: 'Lfo1ArpSync' },
    valueMap: {
      0: 'Off',
      1: 'On',
    },
    notes: 'Discovered by before/after diff while toggling ARP Sync; decoded edit-buffer payload byte[4] (0-based). When On, lfo1.rate is interpreted as lfo1.clockDivide (tempo-synced division).',
  },
  {
    name: 'lfo1.phase',
    offset: 5,
    kind: { type: 'u8' },
    ui: { abbr: 'PHS', name: 'Lfo1Phase' },
    valueMap: (() => {
      const map: Record<number, string> = { 0: 'Poly', 1: 'Mono' };
      for (let i = 2; i <= 255; i++) {
        map[i] = `Spread-${i - 1}`;
      }
      return map;
    })(),
    notes: 'Discovered by before/after diff while changing LFO 1 Phase; decoded edit-buffer payload byte[5] (0-based). Values: 0=Poly (independent per voice), 1=Mono (shared), 2-255=Spread-1 through Spread-254.',
  },
  {
    name: 'lfo1.slewRate',
    offset: 6,
    kind: { type: 'u8' },
    ui: { abbr: 'SLW', name: 'Lfo1Slew' },
    notes: 'Discovered by before/after diff while changing Slew Rate from 0 to 255; decoded edit-buffer payload byte[6] (0-based). Raw 0 = sharp (no smoothing). Higher values round waveform edges, especially square and S&H transitions.',
  },
  {
    name: 'lfo2.rate',
    offset: 7,
    kind: { type: 'u8' },
    ui: { abbr: 'RAT', name: 'Lfo2Rate' },
    value: { units: 'Hz', min: 0.054, max: 65.4 },
    condition: { field: 'lfo2.arpSeq.sync', equals: 0 },
    notes: 'Discovered by before/after diff while moving the physical LFO 2 Rate slider; decoded edit-buffer payload byte[7] (0-based). Non-linear: raw 0 = 0.054 Hz, raw 255 = 65.4 Hz (audio-rate). When ARP Sync is Off, this parameter controls free-running LFO rate.',
  },
  {
    name: 'lfo2.clockDivide',
    offset: 7,
    kind: { type: 'u8' },
    ui: { abbr: 'DIV', name: 'Lfo2Div' },
    condition: { field: 'lfo2.arpSeq.sync', equals: 1 },
    valueMap: {
      255: '1/64',
      242: '1/48',
      229: '3/128',
      216: '1/32',
      203: '1/24',
      190: '3/64',
      177: '1/16',
      164: '1/12',
      151: '3/32',
      138: '1/8',
      125: '1/6',
      112: '3/16',
      99: '1/4',
      86: '1/3',
      73: '3/8',
      60: '1/2',
      47: '1',
      34: '2',
      21: '3',
      8: '4',
    },
    notes: 'Same offset as lfo2.rate; decoded edit-buffer payload byte[7] (0-based). When ARP Sync is On (lfo2.arpSeq.sync=On), this parameter becomes tempo-synced clock division. Use lfo2.arpSeq.sync to determine which interpretation applies.',
  },
  {
    name: 'lfo2.delayTime',
    offset: 8,
    kind: { type: 'u8' },
    ui: { abbr: 'DLY', name: 'Lfo2Delay' },
    value: { units: 's', min: 0, max: 6.59 },
    notes: 'Discovered by before/after diff while moving the physical LFO 2 Delay Time slider; decoded edit-buffer payload byte[8] (0-based). Raw 0 = immediate. Max raw 255 ≈ 6.59 s. 40% pure delay + 60% fade-in.',
  },
  {
    name: 'lfo2.shape',
    offset: 9,
    kind: { type: 'u8' },
    ui: { abbr: 'SHP', name: 'Lfo2Shape' },
    valueMap: {
      0: 'Sine',
      1: 'Triangle',
      2: 'Square',
      3: 'Ramp Up',
      4: 'Ramp Down',
      5: 'S&H',
      6: 'S&H Glide',
    },
    notes: 'Discovered by before/after diff while changing LFO 2 Shape in the edit menu; decoded edit-buffer payload byte[9] (0-based). Assumed to match LFO 1 shape enum.',
  },
  {
    name: 'lfo2.keySync',
    offset: 10,
    kind: { type: 'u8' },
    ui: { abbr: 'KSY', name: 'Lfo2KeySync' },
    valueMap: {
      0: 'Off',
      1: 'On',
    },
    notes: 'Discovered by before/after diff while toggling LFO 2 Key Sync; decoded edit-buffer payload byte[10] (0-based). When On, LFO phase resets on each note-on.',
  },
  {
    name: 'lfo2.arpSeq.sync',
    offset: 11,
    kind: { type: 'u8' },
    ui: { abbr: 'ASY', name: 'Lfo2ArpSync' },
    valueMap: {
      0: 'Off',
      1: 'On',
    },
    notes: 'Discovered by before/after diff while toggling LFO 2 ARP Sync; decoded edit-buffer payload byte[11] (0-based). When On, lfo2.rate is interpreted as lfo2.clockDivide (tempo-synced division).',
  },
  {
    name: 'lfo2.phase',
    offset: 12,
    kind: { type: 'u8' },
    ui: { abbr: 'PHS', name: 'Lfo2Phase' },
    valueMap: (() => {
      const map: Record<number, string> = {
        0: 'Poly',
        1: 'Mono',
      };
      for (let i = 2; i <= 255; i++) {
        map[i] = `Spread-${i - 1}`;
      }
      return map;
    })(),
    notes: 'Discovered by before/after diff while changing LFO 2 Phase from Poly to Mono; decoded edit-buffer payload byte[12] (0-based). Values: 0=Poly (independent per voice), 1=Mono (shared), 2-255=Spread-1 through Spread-254.',
  },
  {
    name: 'lfo2.slewRate',
    offset: 13,
    kind: { type: 'u8' },
    ui: { abbr: 'SLW', name: 'Lfo2Slew' },
    notes: 'Discovered by before/after diff while adjusting LFO 2 Slew Rate; decoded edit-buffer payload byte[13] (0-based). Raw 0 = sharp (no smoothing). Higher values round waveform edges.',
  },
];

export function decodeDerivedFieldsFromEditBuffer(decodedTrimmed242: Uint8Array): Record<string, DerivedValue> {
  const out: Record<string, DerivedValue> = {};
  
  // First pass: decode all unconditional fields
  for (const spec of DECODED_EDIT_BUFFER_MAP) {
    if (spec.condition) continue;
    const raw = decodeBySpec(decodedTrimmed242, spec);
    out[spec.name] = {
      raw,
      normalized: maybeNormalize(spec.kind, raw),
      label: spec.valueMap ? spec.valueMap[raw] : undefined,
      description: spec.notes,
      ui: spec.ui,
    };
  }
  
  // Second pass: decode conditional fields that pass their conditions
  for (const spec of DECODED_EDIT_BUFFER_MAP) {
    if (!spec.condition) continue;
    const conditionField = out[spec.condition.field];
    if (conditionField?.raw === spec.condition.equals) {
      const raw = decodeBySpec(decodedTrimmed242, spec);
      out[spec.name] = {
        raw,
        normalized: maybeNormalize(spec.kind, raw),
        label: spec.valueMap ? spec.valueMap[raw] : undefined,
        description: spec.notes,
        ui: spec.ui,
      };
    }
  }
  
  return out;
}

export function getDecodedFieldSpec(name: string): DecodedFieldSpec | undefined {
  return DECODED_EDIT_BUFFER_MAP.find((s) => s.name === name);
}

export function listDecodedFieldSpecs(): readonly DecodedFieldSpec[] {
  return DECODED_EDIT_BUFFER_MAP;
}
