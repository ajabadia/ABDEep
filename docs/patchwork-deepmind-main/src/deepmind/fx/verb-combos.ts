import type { DecodedValueMeta } from '../decoded-patch-map.js';

import { DELAY_TIME_SYNC_VALUE_MAP } from './delay.js';

// ============================================================================
// Reverb Combo Effects (FlangVerb, ChorusVerb, DelayVerb)
// ============================================================================

export const FLANG_VERB_PARAM_KEYS = [
  'speed',
  'depth',
  'delay',
  'phase',
  'feed',
  'balance',
  'preDelay',
  'decay',
  'size',
  'damping',
  'loCut',
  'mix'
] as const;

export const FLANG_VERB_UI_BY_KEY: Record<string, { abbr?: string; name?: string }> = {
  speed: { abbr: 'SPD', name: 'Speed' },
  depth: { abbr: 'DEP', name: 'Depth' },
  delay: { abbr: 'DLY', name: 'Delay' },
  phase: { abbr: 'PHS', name: 'Phase' },
  feed: { abbr: 'FBK', name: 'Feed' },
  balance: { abbr: 'BAL', name: 'Balance' },
  preDelay: { abbr: 'PRE', name: 'PreDelay' },
  decay: { abbr: 'DCY', name: 'Decay' },
  size: { abbr: 'SIZ', name: 'Size' },
  damping: { abbr: 'DMP', name: 'Damping' },
  loCut: { abbr: 'LC', name: 'LoCut' },
  mix: { abbr: 'MIX', name: 'Mix' },
};

export const FX_SPEED_HZ_DISPLAY_BUCKETS = [
  { rawMin: 20, rawMax: 32, label: '0.0' },
  { rawMin: 33, rawMax: 45, label: '0.1' },
  { rawMin: 46, rawMax: 52, label: '0.2' },
  { rawMin: 53, rawMax: 57, label: '0.3' },
  { rawMin: 58, rawMax: 62, label: '0.4' },
  { rawMin: 63, rawMax: 65, label: '0.5' },
  { rawMin: 66, rawMax: 68, label: '0.6' },
  { rawMin: 69, rawMax: 71, label: '0.7' },
  { rawMin: 72, rawMax: 73, label: '0.8' },
  { rawMin: 74, rawMax: 75, label: '0.9' },
  { rawMin: 76, rawMax: 77, label: '1.0' },
  { rawMin: 78, rawMax: 79, label: '1.1' },
  { rawMin: 80, rawMax: 80, label: '1.2' },
  { rawMin: 81, rawMax: 81, label: '1.3' },
  { rawMin: 82, rawMax: 83, label: '1.4' },
  { rawMin: 84, rawMax: 84, label: '1.5' },
  { rawMin: 85, rawMax: 85, label: '1.6' },
  { rawMin: 86, rawMax: 86, label: '1.7' },
  { rawMin: 87, rawMax: 87, label: '1.8' },
  { rawMin: 88, rawMax: 88, label: '1.9' },
  { rawMin: 89, rawMax: 89, label: '2.0' },
  { rawMin: 90, rawMax: 90, label: '2.1' },
  { rawMin: 91, rawMax: 91, label: '2.3' },
  { rawMin: 92, rawMax: 92, label: '2.4' },
  { rawMin: 93, rawMax: 93, label: '2.7' },
  { rawMin: 94, rawMax: 94, label: '2.8' },
  { rawMin: 95, rawMax: 95, label: '3.0' },
  { rawMin: 96, rawMax: 96, label: '3.2' },
  { rawMin: 97, rawMax: 97, label: '3.3' },
  { rawMin: 98, rawMax: 98, label: '3.5' },
  { rawMin: 99, rawMax: 99, label: '3.7' },
  { rawMin: 100, rawMax: 100, label: '4.0' },
] as const;

export const FLANG_VERB_VALUE_BY_KEY: Record<string, DecodedValueMeta> = {
  speed: { units: 'Hz', min: 0.0, max: 4.0, modDestination: true, displayBuckets: [...FX_SPEED_HZ_DISPLAY_BUCKETS] },
  depth: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  delay: { units: 'ms', min: 0.5, max: 20.0 },
  phase: { min: 0.0, max: 180.0, modDestination: true },
  feed: { units: '%', min: -90.0, max: 90.0, modDestination: true },
  balance: { min: -100.0, max: 100.0, modDestination: true },
  preDelay: { units: 'ms', min: 0.0, max: 200.0 },
  decay: { units: 's', min: 0.1, max: 5.0, modDestination: true },
  size: { min: 2.0, max: 200.0 },
  damping: { units: 'Hz', min: 1000.0, max: 20000.0, modDestination: true },
  loCut: { units: 'Hz', min: 10.0, max: 500.0, modDestination: true },
  mix: { units: '%', min: 0.0, max: 100.0, modDestination: true },
};

export const FLANG_VERB_SPEED_SYNC_VALUE_MAP: Record<number, string> = {
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
  16: '1/32',
  17: '3/128',
  18: '1/48',
  19: '1/64',
};

export const CHORUS_VERB_SPEED_SYNC_VALUE_MAP = FLANG_VERB_SPEED_SYNC_VALUE_MAP;

export const FLANG_VERB_NOTES_BY_KEY: Record<string, string> = {
  speed: 'Time-synchronized options occupy raw values 0..19 before free-rate Hz display buckets. Free-rate buckets are currently confirmed for raw 20..100.',
};

export const CHORUS_VERB_PARAM_KEYS = [
  'speed',
  'depth',
  'delay',
  'phase',
  'wave',
  'balance',
  'preDelay',
  'decay',
  'size',
  'damping',
  'loCut',
  'mix'
] as const;

export const CHORUS_VERB_UI_BY_KEY: Record<string, { abbr?: string; name?: string }> = {
  speed: { abbr: 'SPD', name: 'Speed' },
  depth: { abbr: 'DEP', name: 'Depth' },
  delay: { abbr: 'DLY', name: 'Delay' },
  phase: { abbr: 'PHS', name: 'Phase' },
  wave: { abbr: 'WAV', name: 'Wave' },
  balance: { abbr: 'BAL', name: 'Balance' },
  preDelay: { abbr: 'PRE', name: 'PreDelay' },
  decay: { abbr: 'DCY', name: 'Decay' },
  size: { abbr: 'SIZ', name: 'Size' },
  damping: { abbr: 'DMP', name: 'Damping' },
  loCut: { abbr: 'LC', name: 'LoCut' },
  mix: { abbr: 'MIX', name: 'Mix' },
};

export const CHORUS_VERB_VALUE_BY_KEY: Record<string, DecodedValueMeta> = {
  speed: { units: 'Hz', min: 0.0, max: 4.0, modDestination: true, displayBuckets: [...FX_SPEED_HZ_DISPLAY_BUCKETS] },
  depth: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  delay: { units: 'ms', min: 0.5, max: 50.0 },
  phase: { min: 0.0, max: 180.0, modDestination: true },
  wave: { units: '%', min: 0.0, max: 100.0 },
  balance: { min: -100.0, max: 100.0, modDestination: true },
  preDelay: { units: 'ms', min: 0.0, max: 200.0 },
  decay: { units: 's', min: 0.1, max: 5.0, modDestination: true },
  size: { min: 2.0, max: 200.0 },
  damping: { units: 'Hz', min: 1000.0, max: 20000.0, modDestination: true },
  loCut: { units: 'Hz', min: 10.0, max: 500.0, modDestination: true },
  mix: { units: '%', min: 0.0, max: 100.0, modDestination: true },
};

export const CHORUS_VERB_NOTES_BY_KEY: Record<string, string> = {
  speed: 'Time-synchronized options occupy raw values 0..19 before free-rate Hz display buckets. Free-rate buckets are currently confirmed for raw 20..100.',
  wave: 'Adjusts the LFO waveform from a sine wave to triangular wave.',
};

export const DELAY_VERB_PARAM_KEYS = [
  'time',
  'pattern',
  'feedHC',
  'feedback',
  'xFeed',
  'balance',
  'preDelay',
  'decay',
  'size',
  'damping',
  'loCut',
  'mix'
] as const;

export const DELAY_VERB_PATTERN_VALUE_MAP: Record<number, string> = {
  0: '1/4',
  1: '1/3',
  2: '3/8',
  3: '1/2',
  4: '2/3',
  5: '3/4',
  6: '1',
  7: '1/4X',
  8: '1/3X',
  9: '3/8X',
  10: '1/2X',
  11: '2/3X',
  12: '3/4X',
  13: '1X',
};

export const DELAY_VERB_UI_BY_KEY: Record<string, { abbr?: string; name?: string }> = {
  time: { abbr: 'TIM', name: 'Time' },
  pattern: { abbr: 'PAT', name: 'Pattern' },
  feedHC: { abbr: 'FHC', name: 'FeedHC' },
  feedback: { abbr: 'FBK', name: 'Feedback' },
  xFeed: { abbr: 'XFD', name: 'X-Feed' },
  balance: { abbr: 'BAL', name: 'Balance' },
  preDelay: { abbr: 'PRE', name: 'PreDelay' },
  decay: { abbr: 'DCY', name: 'Decay' },
  size: { abbr: 'SIZ', name: 'Size' },
  damping: { abbr: 'DMP', name: 'Damping' },
  loCut: { abbr: 'LC', name: 'LoCut' },
  mix: { abbr: 'MIX', name: 'Mix' },
};

export const DELAY_VERB_VALUE_BY_KEY: Record<string, DecodedValueMeta> = {
  time: { units: 'ms', min: 1.0, max: 1500.0 },
  pattern: {},
  feedHC: { units: 'Hz', min: 200.0, max: 20000.0, modDestination: true },
  feedback: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  xFeed: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  balance: { min: -100.0, max: 100.0, modDestination: true },
  preDelay: { units: 'ms', min: 0.0, max: 200.0 },
  decay: { units: 's', min: 0.1, max: 5.0, modDestination: true },
  size: { min: 2.0, max: 200.0 },
  damping: { units: 'Hz', min: 1000.0, max: 20000.0, modDestination: true },
  loCut: { units: 'Hz', min: 10.0, max: 500.0, modDestination: true },
  mix: { units: '%', min: 0.0, max: 100.0, modDestination: true },
};

export const DELAY_VERB_NOTES_BY_KEY: Record<string, string> = {
  time: 'Time-synchronized options from 4 to 1/64 bars.',
};

export const MOD_DLYT_REV_PARAM_KEYS = [
  'time',
  'factor',
  'feedback',
  'feedHC',
  'depth',
  'speed',
  'mode',
  'rType',
  'decay',
  'damping',
  'balance',
  'mix',
] as const;

export const MOD_DLYT_REV_FACTOR_VALUE_MAP: Record<number, string> = {
  0: '1',
  1: '1/2',
  2: '2/3',
  3: '3/2',
};

export const MOD_DLYT_REV_MODE_VALUE_MAP: Record<number, string> = {
  0: 'PAR',
  1: 'SER',
};

export const MOD_DLYT_REV_RTYPE_VALUE_MAP: Record<number, string> = {
  0: 'AMB',
  1: 'CLUB',
  2: 'HALL',
};

export const MOD_DLYT_REV_UI_BY_KEY: Record<string, { abbr?: string; name?: string }> = {
  time: { abbr: 'TIM', name: 'Time' },
  factor: { abbr: 'FAC', name: 'Factor' },
  feedback: { abbr: 'FBK', name: 'Feedback' },
  feedHC: { abbr: 'FHC', name: 'FeedHC' },
  depth: { abbr: 'DEP', name: 'Depth' },
  speed: { abbr: 'SPD', name: 'Speed' },
  mode: { abbr: 'MOD', name: 'Mode' },
  rType: { abbr: 'RTY', name: 'Rtype' },
  decay: { abbr: 'DCY', name: 'Decay' },
  damping: { abbr: 'DMP', name: 'Damping' },
  balance: { abbr: 'BAL', name: 'Balance' },
  mix: { abbr: 'MIX', name: 'Mix' },
};

export const MOD_DLYT_REV_VALUE_BY_KEY: Record<string, DecodedValueMeta> = {
  time: { units: 'ms', min: 1.0, max: 1500.0 },
  factor: {},
  feedback: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  feedHC: { units: 'Hz', min: 200.0, max: 20000.0, modDestination: true },
  depth: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  speed: { units: 'Hz', min: 0.0, max: 10.0, modDestination: true },
  mode: {},
  rType: {},
  decay: { min: 1.0, max: 10.0, modDestination: true },
  damping: { units: 'Hz', min: 1000.0, max: 20000.0, modDestination: true },
  balance: { min: -100.0, max: 100.0, modDestination: true },
  mix: { units: '%', min: 0.0, max: 100.0, modDestination: true },
};

export const MOD_DLYT_REV_VALUE_MAP_BY_KEY: Record<string, Record<number, string>> = {
  time: DELAY_TIME_SYNC_VALUE_MAP,
  factor: MOD_DLYT_REV_FACTOR_VALUE_MAP,
  mode: MOD_DLYT_REV_MODE_VALUE_MAP,
  rType: MOD_DLYT_REV_RTYPE_VALUE_MAP,
};

export const MOD_DLYT_REV_NOTES_BY_KEY: Record<string, string> = {
  time: 'Live-confirmed: raw 0..19 reuses the standard delay-family sync block from 4 to 1/64 bars, and raw 20 begins the millisecond region at 1.0 ms.',
  factor: 'Sets the delay to rhythmic fractions: 1, 1/2, 2/3, or 3/2.',
  feedback: 'Controls the percentage of positive feedback.',
  feedHC: 'Adjusts the high-cut filter frequency in the feedback path.',
  depth: 'Controls the depth (amount) of modulation.',
  speed: 'Live-confirmed: this is a free-rate Hz control, not a sync-label block. Observed probes: raw 0=0.0 Hz, raw 1=0.0 Hz, raw 20=0.1 Hz, raw 100=10.0 Hz.',
  mode: 'Controls the processor chain routing: Parallel or Serial.',
  rType: 'Selects the reverb type: Ambience, Club, or Hall.',
  decay: 'Controls the amount of time it takes for the reverb to dissipate.',
  damping: 'Determines the decay of high frequencies within the reverb tail.',
  balance: 'Adjusts the ratio of the delay signal to the reverb signal.',
  mix: 'Controls the wet/dry mix between processed and unprocessed signals.',
};
