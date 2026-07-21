import type { DecodedValueMeta } from '../decoded-patch-map.js';

// ============================================================================
// Modulation Effects
// ============================================================================

export const CHORUS_PARAM_KEYS = [
  'speed',
  'widthL',
  'widthR',
  'delayL',
  'delayR',
  'mix',
  'loCut',
  'hiCut',
  'phase',
  'wave',
  'spread',
] as const;

export const CHORUS_UI_BY_KEY: Record<string, { abbr?: string; name?: string }> = {
  speed: { abbr: 'SPD', name: 'Speed' },
  widthL: { abbr: 'WDL', name: 'WidthL' },
  widthR: { abbr: 'WDR', name: 'WidthR' },
  delayL: { abbr: 'DLL', name: 'DelayL' },
  delayR: { abbr: 'DLR', name: 'DelayR' },
  mix: { abbr: 'MIX', name: 'Mix' },
  loCut: { abbr: 'LC', name: 'LoCut' },
  hiCut: { abbr: 'HC', name: 'HiCut' },
  phase: { abbr: 'PHS', name: 'Phase' },
  wave: { abbr: 'WAV', name: 'Wave' },
  spread: { abbr: 'SPR', name: 'Spread' },
};

export const CHORUS_SPEED_HZ_DISPLAY_BUCKETS = [
  { rawMin: 20, rawMax: 32, label: '0.0' },
  { rawMin: 33, rawMax: 44, label: '0.1' },
  { rawMin: 45, rawMax: 51, label: '0.2' },
  { rawMin: 52, rawMax: 56, label: '0.3' },
  { rawMin: 57, rawMax: 59, label: '0.4' },
  { rawMin: 60, rawMax: 63, label: '0.5' },
  { rawMin: 64, rawMax: 65, label: '0.6' },
  { rawMin: 66, rawMax: 68, label: '0.7' },
  { rawMin: 69, rawMax: 70, label: '0.8' },
  { rawMin: 71, rawMax: 72, label: '0.9' },
  { rawMin: 73, rawMax: 73, label: '1.0' },
  { rawMin: 74, rawMax: 75, label: '1.1' },
  { rawMin: 76, rawMax: 76, label: '1.2' },
  { rawMin: 77, rawMax: 77, label: '1.3' },
  { rawMin: 78, rawMax: 79, label: '1.4' },
  { rawMin: 80, rawMax: 80, label: '1.5' },
  { rawMin: 81, rawMax: 81, label: '1.6' },
  { rawMin: 82, rawMax: 82, label: '1.7' },
  { rawMin: 83, rawMax: 83, label: '1.8' },
  { rawMin: 84, rawMax: 84, label: '1.9' },
  { rawMin: 85, rawMax: 85, label: '2.1' },
  { rawMin: 86, rawMax: 86, label: '2.2' },
  { rawMin: 87, rawMax: 87, label: '2.3' },
  { rawMin: 88, rawMax: 88, label: '2.5' },
  { rawMin: 89, rawMax: 89, label: '2.6' },
  { rawMin: 90, rawMax: 90, label: '2.8' },
  { rawMin: 91, rawMax: 91, label: '2.9' },
  { rawMin: 92, rawMax: 92, label: '3.1' },
  { rawMin: 93, rawMax: 93, label: '3.3' },
  { rawMin: 94, rawMax: 94, label: '3.5' },
  { rawMin: 95, rawMax: 95, label: '3.7' },
  { rawMin: 96, rawMax: 96, label: '3.9' },
  { rawMin: 97, rawMax: 97, label: '4.2' },
  { rawMin: 98, rawMax: 98, label: '4.4' },
  { rawMin: 99, rawMax: 99, label: '4.7' },
  { rawMin: 100, rawMax: 100, label: '5.0' },
] as const;

export const CHORUS_VALUE_BY_KEY: Record<string, DecodedValueMeta> = {
  speed: { units: 'Hz', min: 0.0, max: 5.0, modDestination: true, displayBuckets: [...CHORUS_SPEED_HZ_DISPLAY_BUCKETS] },
  widthL: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  widthR: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  delayL: { units: 'ms', min: 0.5, max: 50.0 },
  delayR: { units: 'ms', min: 0.5, max: 50.0 },
  mix: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  loCut: { units: 'Hz', min: 10.0, max: 500.0, modDestination: true },
  hiCut: { units: 'Hz', min: 200.0, max: 20000.0, modDestination: true },
  phase: { min: 0.0, max: 100.0 },
  wave: { units: '%', min: 0.0, max: 100.0 },
  spread: { units: '%', min: 0.0, max: 100.0, modDestination: true },
};

export const CHORUS_SPEED_SYNC_VALUE_MAP: Record<number, string> = {
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

export const MODULATION_FAMILY_SPEED_VALUE: DecodedValueMeta = {
  units: 'Hz',
  min: 0.0,
  max: 5.0,
  modDestination: true,
  displayBuckets: [...CHORUS_SPEED_HZ_DISPLAY_BUCKETS],
};

export const MODULATION_FAMILY_SPEED_SYNC_VALUE_MAP = CHORUS_SPEED_SYNC_VALUE_MAP;

export const MODULATION_FAMILY_SPEED_NOTE =
  'Live-confirmed: this speed parameter uses the same mixed-mode mapping as Chorus, with raw values 0..19 covering time-synchronized bar settings from 4 down to 1/64 and raw 20..100 covering the free-rate Hz region up to 5.0 Hz.';

export const CHORUS_NOTES_BY_KEY: Record<string, string> = {
  speed: 'Live-confirmed: raw values 0..19 are time-synchronized bar settings, from 4 down to 1/64, before the display switches into the free-rate Hz region. Free-rate display buckets are currently confirmed for raw 20..100.',
  wave: 'Blends between digital triangular and classic analog sine waveforms.',
};

export const CHORUS_D_PARAM_KEYS = [
  'on',
  'mode',
  'mix',
  'sw1',
  'sw2',
  'sw3',
  'sw4',
] as const;

export const CHORUS_D_UI_BY_KEY: Record<string, { abbr?: string; name?: string }> = {
  on: { abbr: 'PWR', name: 'Power' },
  mode: { abbr: 'MOD', name: 'Mode' },
  mix: { abbr: 'MIX', name: 'Mix' },
  sw1: { abbr: 'SW1', name: 'Sw1' },
  sw2: { abbr: 'SW2', name: 'Sw2' },
  sw3: { abbr: 'SW3', name: 'Sw3' },
  sw4: { abbr: 'SW4', name: 'Sw4' },
};

export const CHORUS_D_ON_VALUE_MAP: Record<number, string> = { 0: 'OFF', 1: 'ON' };
export const CHORUS_D_MODE_VALUE_MAP: Record<number, string> = { 0: 'M', 1: 'ST' };
export const CHORUS_D_SW_VALUE_MAP: Record<number, string> = { 0: 'OFF', 1: 'ON' };

export const CHORUS_D_VALUE_MAP_BY_KEY: Record<string, Record<number, string>> = {
  on: CHORUS_D_ON_VALUE_MAP,
  mode: CHORUS_D_MODE_VALUE_MAP,
  sw1: CHORUS_D_SW_VALUE_MAP,
  sw2: CHORUS_D_SW_VALUE_MAP,
  sw3: CHORUS_D_SW_VALUE_MAP,
  sw4: CHORUS_D_SW_VALUE_MAP,
};

export const CHORUS_D_VALUE_BY_KEY: Record<string, import('../decoded-patch-map.js').DecodedValueMeta> = {
  on: {},
  mode: {},
  mix: { units: '%', min: 0, max: 100, modDestination: true },
  sw1: {},
  sw2: {},
  sw3: {},
  sw4: {},
};

export const CHORUS_D_NOTES_BY_KEY: Record<string, string> = {
  mode: 'M = Mono, ST = Stereo.',
  sw1: 'Engages level one intensity (minimum).',
  sw2: 'Engages level two intensity.',
  sw3: 'Engages level three intensity.',
  sw4: 'Engages level four intensity (maximum).',
};

export const FLANGER_PARAM_KEYS = [
  'speed',
  'widthL',
  'widthR',
  'delayL',
  'delayR',
  'mix',
  'loCut',
  'hiCut',
  'phase',
  'feedLC',
  'feedHC',
  'feed',
] as const;

export const FLANGER_UI_BY_KEY: Record<string, { abbr?: string; name?: string }> = {
  speed: { abbr: 'SPD', name: 'Speed' },
  widthL: { abbr: 'WDL', name: 'WidthL' },
  widthR: { abbr: 'WDR', name: 'WidthR' },
  delayL: { abbr: 'DLL', name: 'DelayL' },
  delayR: { abbr: 'DLR', name: 'DelayR' },
  mix: { abbr: 'MIX', name: 'Mix' },
  loCut: { abbr: 'LC', name: 'LoCut' },
  hiCut: { abbr: 'HC', name: 'HiCut' },
  phase: { abbr: 'PHS', name: 'Phase' },
  feedLC: { abbr: 'FLC', name: 'FeedLC' },
  feedHC: { abbr: 'FHC', name: 'FeedHC' },
  feed: { abbr: 'FD', name: 'Feed' },
};

export const FLANGER_VALUE_BY_KEY: Record<string, DecodedValueMeta> = {
  speed: MODULATION_FAMILY_SPEED_VALUE,
  widthL: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  widthR: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  delayL: { units: 'ms', min: 0.5, max: 20.0 },
  delayR: { units: 'ms', min: 0.5, max: 20.0 },
  mix: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  loCut: { units: 'Hz', min: 10.0, max: 500.0, modDestination: true },
  hiCut: { units: 'Hz', min: 200.0, max: 20000.0, modDestination: true },
  phase: { min: 0.0, max: 180.0 },
  feedLC: { units: 'Hz', min: 10.0, max: 500.0, modDestination: true },
  feedHC: { units: 'Hz', min: 200.0, max: 20000.0, modDestination: true },
  feed: { units: '%', min: -90.0, max: 90.0, modDestination: true },
};

export const FLANGER_SPEED_SYNC_VALUE_MAP = MODULATION_FAMILY_SPEED_SYNC_VALUE_MAP;

export const FLANGER_NOTES_BY_KEY: Record<string, string> = {
  speed: MODULATION_FAMILY_SPEED_NOTE,
};

export const PHASER_PARAM_KEYS = [
  'speed',
  'depth',
  'reso',
  'base',
  'stages',
  'mix',
  'wave',
  'phase',
  'envMod',
  'attack',
  'hold',
  'release',
] as const;

export const PHASER_UI_BY_KEY: Record<string, { abbr?: string; name?: string }> = {
  speed: { abbr: 'SPD', name: 'Speed' },
  depth: { abbr: 'DEP', name: 'Depth' },
  reso: { abbr: 'RES', name: 'Reso' },
  base: { abbr: 'BAS', name: 'Base Freq' },
  stages: { abbr: 'STG', name: 'Stages' },
  mix: { abbr: 'MIX', name: 'Mix' },
  wave: { abbr: 'WAV', name: 'Wave' },
  phase: { abbr: 'PHS', name: 'Phase' },
  envMod: { abbr: 'ENV', name: 'EnvMod' },
  attack: { abbr: 'ATK', name: 'Attack' },
  hold: { abbr: 'HLD', name: 'Hold' },
  release: { abbr: 'REL', name: 'Release' },
};

export const PHASER_VALUE_BY_KEY: Record<string, DecodedValueMeta> = {
  speed: MODULATION_FAMILY_SPEED_VALUE,
  depth: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  reso: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  base: { units: 'Hz', min: 20.0, max: 15000.0, modDestination: true },
  stages: { min: 2.0, max: 12.0 },
  mix: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  wave: { min: -50.0, max: 50.0 },
  phase: { units: 'deg', min: 0.0, max: 180.0 },
  envMod: { units: '%', min: -100.0, max: 100.0, modDestination: true },
  attack: { units: 'ms', min: 10.0, max: 1000.0, modDestination: true },
  hold: { units: 'ms', min: 1.0, max: 2000.0, modDestination: true },
  release: { units: 'ms', min: 10.0, max: 1000.0, modDestination: true },
};

export const PHASER_SPEED_SYNC_VALUE_MAP = MODULATION_FAMILY_SPEED_SYNC_VALUE_MAP;

export const PHASER_NOTES_BY_KEY: Record<string, string> = {
  speed: MODULATION_FAMILY_SPEED_NOTE,
  wave: 'Controls LFO waveform symmetry.',
};

export const AUTO_PAN_PARAM_KEYS = [
  'speed',
  'phase',
  'wave',
  'depth',
  'envSpd',
  'envDepth',
  'attack',
  'hold',
  'release',
] as const;

export const AUTO_PAN_UI_BY_KEY: Record<string, { abbr?: string; name?: string }> = {
  speed: { abbr: 'SPD', name: 'Speed' },
  phase: { abbr: 'PHS', name: 'Phase' },
  wave: { abbr: 'WAV', name: 'Wave' },
  depth: { abbr: 'DEP', name: 'Depth' },
  envSpd: { abbr: 'ESP', name: 'EnvSpd' },
  envDepth: { abbr: 'EDP', name: 'EnvDepth' },
  attack: { abbr: 'ATK', name: 'Attack' },
  hold: { abbr: 'HLD', name: 'Hold' },
  release: { abbr: 'REL', name: 'Release' },
};

export const AUTO_PAN_VALUE_BY_KEY: Record<string, DecodedValueMeta> = {
  speed: MODULATION_FAMILY_SPEED_VALUE,
  phase: { min: 0.0, max: 180.0, modDestination: true },
  wave: { min: -50.0, max: 50.0, modDestination: true },
  depth: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  envSpd: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  envDepth: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  attack: { units: 'ms', min: 10.0, max: 1000.0, modDestination: true },
  hold: { units: 'ms', min: 1.0, max: 2000.0, modDestination: true },
  release: { units: 'ms', min: 10.0, max: 1000.0, modDestination: true },
};

export const AUTO_PAN_SPEED_SYNC_VALUE_MAP = MODULATION_FAMILY_SPEED_SYNC_VALUE_MAP;

export const AUTO_PAN_NOTES_BY_KEY: Record<string, string> = {
  speed: MODULATION_FAMILY_SPEED_NOTE,
  wave: 'LFO shape sweeps from triangular toward square.',
};

export const ROTARY_SPKR_PARAM_KEYS = [
  'loSpeed',
  'hiSpeed',
  'accel',
  'distance',
  'balance',
  'mix',
  'motor',
  'speed',
] as const;

export const ROTARY_SPKR_UI_BY_KEY: Record<string, { abbr?: string; name?: string }> = {
  loSpeed: { abbr: 'LOS', name: 'LoSpeed' },
  hiSpeed: { abbr: 'HIS', name: 'HiSpeed' },
  accel: { abbr: 'ACC', name: 'Accel' },
  distance: { abbr: 'DIS', name: 'Distance' },
  balance: { abbr: 'BAL', name: 'Balance' },
  mix: { abbr: 'MIX', name: 'Mix' },
  motor: { abbr: 'MOT', name: 'Motor' },
  speed: { abbr: 'SPD', name: 'Speed' },
};

export const ROTARY_SPKR_MOTOR_VALUE_MAP: Record<number, string> = {
  0: 'RUN',
  1: 'STOP',
};

export const ROTARY_SPKR_SPEED_VALUE_MAP: Record<number, string> = {
  0: 'SLOW',
  1: 'FAST',
};

export const ROTARY_SPKR_VALUE_MAP_BY_KEY: Record<string, Record<number, string>> = {
  motor: ROTARY_SPKR_MOTOR_VALUE_MAP,
  speed: ROTARY_SPKR_SPEED_VALUE_MAP,
};

export const ROTARY_SPKR_VALUE_BY_KEY: Record<string, DecodedValueMeta> = {
  loSpeed: { units: 'Hz', min: 0.1, max: 4.0, modDestination: true },
  hiSpeed: { units: 'Hz', min: 2.0, max: 9.9, modDestination: true },
  accel: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  distance: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  balance: { min: -100.0, max: 100.0, modDestination: true },
  mix: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  motor: { modDestination: true },
  speed: { modDestination: true },
};

export const ROTARY_SPKR_NOTES_BY_KEY: Record<string, string> = {
  loSpeed: 'Adjusts the rotational speed when the Low Speed operation is selected.',
  hiSpeed: 'Adjusts the rotational speed when the High Speed operation is selected.',
  accel: 'Adjusts how quickly the speed increases and decreases from the Slow mode to the Fast mode.',
  distance: 'Adjusts the distance between the Rotary speakers and the virtual microphone.',
  balance: 'Adjusts the balance between the virtual horn and virtual drum controlling the signal tone.',
  mix: 'Controls the mix (or ratio) of wet (processed) and dry (unprocessed) signals.',
  motor: 'Allows the rotation effect of the motor to be disengaged (STOP).',
  speed: 'Selects either the slow or fast speeds for rotation.',
};
