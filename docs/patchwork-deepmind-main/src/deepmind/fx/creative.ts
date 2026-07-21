import type { DecodedValueMeta } from '../decoded-patch-map.js';

import { DELAY_TIME_SYNC_VALUE_MAP } from './delay.js';
import { MODULATION_FAMILY_SPEED_SYNC_VALUE_MAP } from './modulation.js';

// ============================================================================
// Creative Effects
// ============================================================================

export const DUAL_PITCH_PARAM_KEYS = [
  'semi1',
  'cent1',
  'delay1',
  'gain1',
  'pan1',
  'mix',
  'semi2',
  'cent2',
  'delay2',
  'gain2',
  'pan2',
  'hiCut'
] as const;

export const DUAL_PITCH_UI_BY_KEY: Record<string, { abbr?: string; name?: string }> = {
  semi1: { abbr: 'SM1', name: 'Semi1' },
  cent1: { abbr: 'CN1', name: 'Cent1' },
  delay1: { abbr: 'DL1', name: 'Delay1' },
  gain1: { abbr: 'GN1', name: 'Gain1' },
  pan1: { abbr: 'PN1', name: 'Pan1' },
  mix: { abbr: 'MIX', name: 'Mix' },
  semi2: { abbr: 'SM2', name: 'Semi2' },
  cent2: { abbr: 'CN2', name: 'Cent2' },
  delay2: { abbr: 'DL2', name: 'Delay2' },
  gain2: { abbr: 'GN2', name: 'Gain2' },
  pan2: { abbr: 'PN2', name: 'Pan2' },
  hiCut: { abbr: 'HIC', name: 'HiCut' },
};

export const DUAL_PITCH_VALUE_BY_KEY: Record<string, DecodedValueMeta> = {
  semi1: { min: -12.0, max: 12.0, modDestination: true },
  cent1: { min: -50.0, max: 50.0, modDestination: true },
  delay1: { units: 'ms', min: 1.0, max: 500.0 },
  gain1: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  pan1: { units: '%', min: -100.0, max: 100.0, modDestination: true },
  mix: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  semi2: { min: -12.0, max: 12.0, modDestination: true },
  cent2: { min: -50.0, max: 50.0, modDestination: true },
  delay2: { units: 'ms', min: 1.0, max: 500.0 },
  gain2: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  pan2: { units: '%', min: -100.0, max: 100.0, modDestination: true },
  hiCut: { units: 'Hz', min: 200.0, max: 20000.0, modDestination: true },
};

export const DUAL_PITCH_VALUE_MAP_BY_KEY: Record<string, Record<number, string>> = {
  delay1: DELAY_TIME_SYNC_VALUE_MAP,
  delay2: DELAY_TIME_SYNC_VALUE_MAP,
};

export const DUAL_PITCH_NOTES_BY_KEY: Record<string, string> = {
  semi1: 'Adjusts the pitch of the first channel in semitones.',
  cent1: 'Adjusts the pitch of the first channel in cents.',
  delay1: 'Live-confirmed: raw 0..19 uses the standard sync block from 4 to 1/64 bars, while raw 20..100 spans 1.0 to 500.0 ms for the time difference between wet and dry signals.',
  gain1: 'Allows gain compensation to be applied to the first channel.',
  pan1: 'Allows panning of the first channel.',
  mix: 'Controls the mix (ratio) of wet (processed) and dry (unprocessed) signals.',
  semi2: 'Adjusts the pitch of the second channel in semitones.',
  cent2: 'Adjusts the pitch of the second channel in cents.',
  delay2: 'Live-confirmed: raw 0..19 uses the standard sync block from 4 to 1/64 bars, while raw 20..100 spans 1.0 to 500.0 ms for the time difference between wet and dry signals.',
  gain2: 'Allows gain compensation to be applied to the second channel.',
  pan2: 'Allows panning of the second channel.',
  hiCut: 'Allows the high frequencies affected by the pitch shifting to be reduced.',
};

export const VINTG_PITCH_PARAM_KEYS = [
  'semi1',
  'cent1',
  'delay1',
  'feedback1',
  'pan1',
  'mix',
  'semi2',
  'cent2',
  'delay2',
  'feedback2',
  'pan2',
  'hiCut'
] as const;

export const VINTG_PITCH_UI_BY_KEY: Record<string, { abbr?: string; name?: string }> = {
  semi1: { abbr: 'SM1', name: 'Semi1' },
  cent1: { abbr: 'CN1', name: 'Cent1' },
  delay1: { abbr: 'DL1', name: 'Delay1' },
  feedback1: { abbr: 'FB1', name: 'Feedback1' },
  pan1: { abbr: 'PN1', name: 'Pan1' },
  mix: { abbr: 'MIX', name: 'Mix' },
  semi2: { abbr: 'SM2', name: 'Semi2' },
  cent2: { abbr: 'CN2', name: 'Cent2' },
  delay2: { abbr: 'DL2', name: 'Delay2' },
  feedback2: { abbr: 'FB2', name: 'Feedback2' },
  pan2: { abbr: 'PN2', name: 'Pan2' },
  hiCut: { abbr: 'HIC', name: 'HiCut' },
};

export const VINTG_PITCH_VALUE_BY_KEY: Record<string, DecodedValueMeta> = {
  semi1: { min: -12.0, max: 12.0, modDestination: true },
  cent1: { min: -50.0, max: 50.0, modDestination: true },
  delay1: { units: 'ms', min: 1.0, max: 500.0 },
  feedback1: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  pan1: { units: '%', min: -100.0, max: 100.0, modDestination: true },
  mix: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  semi2: { min: -12.0, max: 12.0, modDestination: true },
  cent2: { min: -50.0, max: 50.0, modDestination: true },
  delay2: { units: 'ms', min: 1.0, max: 500.0 },
  feedback2: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  pan2: { units: '%', min: -100.0, max: 100.0, modDestination: true },
  hiCut: { units: 'Hz', min: 200.0, max: 20000.0, modDestination: true },
};

export const VINTG_PITCH_VALUE_MAP_BY_KEY: Record<string, Record<number, string>> = {
  delay1: DELAY_TIME_SYNC_VALUE_MAP,
  delay2: DELAY_TIME_SYNC_VALUE_MAP,
};

export const VINTG_PITCH_NOTES_BY_KEY: Record<string, string> = {
  semi1: 'Adjusts the pitch of the first channel in semitones.',
  cent1: 'Adjusts the pitch of the first channel in cents.',
  delay1: 'Adjusts the time difference between the wet and dry signals. Sync options from 4 to 1/64 bars.',
  feedback1: 'Allows feedback to be applied to the first channel.',
  pan1: 'Allows panning of the first channel.',
  mix: 'Controls the mix (ratio) of wet (processed) and dry (unprocessed) signals.',
  semi2: 'Adjusts the pitch of the second channel in semitones.',
  cent2: 'Adjusts the pitch of the second channel in cents.',
  delay2: 'Adjusts the time difference between the wet and dry signals. Sync options from 4 to 1/64 bars.',
  feedback2: 'Allows feedback to be applied to the second channel.',
  pan2: 'Allows panning of the second channel.',
  hiCut: 'Allows the high frequencies affected by the pitch shifting to be reduced.',
};

export const MOOD_FILTER_PARAM_KEYS = [
  'speed',
  'depth',
  'reso',
  'base freq',
  'type',
  'mix',
  'wave',
  'envMod',
  'attack',
  'release',
  'drive',
  'poles',
] as const;

export const MOOD_FILTER_UI_BY_KEY: Record<string, { abbr?: string; name?: string }> = {
  speed: { abbr: 'SPD', name: 'Speed' },
  depth: { abbr: 'DEP', name: 'Depth' },
  reso: { abbr: 'RES', name: 'Resonance' },
  'base freq': { abbr: 'FRQ', name: 'Base Freq' },
  type: { abbr: 'TYP', name: 'Type' },
  mix: { abbr: 'MIX', name: 'Mix' },
  wave: { abbr: 'WAV', name: 'Wave' },
  envMod: { abbr: 'ENV', name: 'EnvMod' },
  attack: { abbr: 'ATK', name: 'Attack' },
  release: { abbr: 'REL', name: 'Release' },
  drive: { abbr: 'DRV', name: 'Drive' },
  poles: { abbr: '4P', name: '4-Pole' },
};

export const MOOD_FILTER_SPEED_HZ_DISPLAY_BUCKETS = [
  { rawMin: 20, rawMax: 29, label: '0.0' },
  { rawMin: 30, rawMax: 38, label: '0.1' },
  { rawMin: 39, rawMax: 43, label: '0.2' },
  { rawMin: 44, rawMax: 47, label: '0.3' },
  { rawMin: 48, rawMax: 50, label: '0.4' },
  { rawMin: 51, rawMax: 53, label: '0.5' },
  { rawMin: 54, rawMax: 55, label: '0.6' },
  { rawMin: 56, rawMax: 57, label: '0.7' },
  { rawMin: 58, rawMax: 58, label: '0.8' },
  { rawMin: 59, rawMax: 59, label: '0.9' },
  { rawMin: 60, rawMax: 61, label: '1.0' },
  { rawMin: 62, rawMax: 62, label: '1.1' },
  { rawMin: 63, rawMax: 63, label: '1.2' },
  { rawMin: 64, rawMax: 64, label: '1.3' },
  { rawMin: 65, rawMax: 65, label: '1.4' },
  { rawMin: 66, rawMax: 66, label: '1.5' },
  { rawMin: 67, rawMax: 67, label: '1.6' },
  { rawMin: 68, rawMax: 68, label: '1.8' },
  { rawMin: 69, rawMax: 69, label: '1.9' },
  { rawMin: 70, rawMax: 70, label: '2.1' },
  { rawMin: 71, rawMax: 71, label: '2.2' },
  { rawMin: 72, rawMax: 72, label: '2.4' },
  { rawMin: 73, rawMax: 73, label: '2.6' },
  { rawMin: 74, rawMax: 74, label: '2.8' },
  { rawMin: 75, rawMax: 75, label: '3.0' },
  { rawMin: 76, rawMax: 76, label: '3.3' },
  { rawMin: 77, rawMax: 77, label: '3.5' },
  { rawMin: 78, rawMax: 78, label: '3.8' },
  { rawMin: 79, rawMax: 79, label: '4.1' },
  { rawMin: 80, rawMax: 80, label: '4.4' },
  { rawMin: 81, rawMax: 81, label: '4.8' },
  { rawMin: 82, rawMax: 82, label: '5.1' },
  { rawMin: 83, rawMax: 83, label: '5.5' },
  { rawMin: 84, rawMax: 84, label: '6.0' },
  { rawMin: 85, rawMax: 85, label: '6.5' },
  { rawMin: 86, rawMax: 86, label: '7.0' },
  { rawMin: 87, rawMax: 87, label: '7.5' },
  { rawMin: 88, rawMax: 88, label: '8.1' },
  { rawMin: 89, rawMax: 89, label: '8.7' },
  { rawMin: 90, rawMax: 90, label: '9.4' },
  { rawMin: 91, rawMax: 91, label: '10.1' },
  { rawMin: 92, rawMax: 92, label: '10.9' },
  { rawMin: 93, rawMax: 93, label: '11.8' },
  { rawMin: 94, rawMax: 94, label: '12.7' },
  { rawMin: 95, rawMax: 95, label: '13.7' },
  { rawMin: 96, rawMax: 96, label: '14.8' },
  { rawMin: 97, rawMax: 97, label: '15.9' },
  { rawMin: 98, rawMax: 98, label: '17.2' },
  { rawMin: 99, rawMax: 99, label: '18.5' },
  { rawMin: 100, rawMax: 100, label: '20.0' },
] as const;

export const MOOD_FILTER_TYPE_VALUE_MAP: Record<number, string> = {
  0: 'Lowpass',
  1: 'Highpass',
  2: 'Bandpass',
  3: 'Notch',
};

export const MOOD_FILTER_WAVE_VALUE_MAP: Record<number, string> = {
  0: 'Triangle',
  1: 'Sine',
  2: 'Saw+',
  3: 'Saw-',
  4: 'Ramp',
  5: 'Square',
  6: 'Random',
};

export const MOOD_FILTER_POLES_VALUE_MAP: Record<number, string> = {
  0: '2P',
  1: '4P',
};

export const MOOD_FILTER_VALUE_BY_KEY: Record<string, DecodedValueMeta> = {
  speed: { units: 'Hz', min: 0.0, max: 20.0, displayBuckets: [...MOOD_FILTER_SPEED_HZ_DISPLAY_BUCKETS] },
  depth: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  reso: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  'base freq': { units: 'Hz', min: 20.0, max: 15000.0, modDestination: true },
  type: {},
  mix: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  wave: {},
  envMod: { units: '%', min: -100.0, max: 100.0, modDestination: true },
  attack: { units: 'ms', min: 10.0, max: 249.9, modDestination: true },
  release: { units: 'ms', min: 10.0, max: 500.0, modDestination: true },
  drive: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  poles: {},
};

export const MOOD_FILTER_SPEED_SYNC_VALUE_MAP = MODULATION_FAMILY_SPEED_SYNC_VALUE_MAP;

export const MOOD_FILTER_VALUE_MAP_BY_KEY: Record<string, Record<number, string>> = {
  speed: MOOD_FILTER_SPEED_SYNC_VALUE_MAP,
  type: MOOD_FILTER_TYPE_VALUE_MAP,
  wave: MOOD_FILTER_WAVE_VALUE_MAP,
  poles: MOOD_FILTER_POLES_VALUE_MAP,
};

export const MOOD_FILTER_NOTES_BY_KEY: Record<string, string> = {
  speed: 'Live-confirmed: Mood Filter keeps the same raw 0..19 synchronized bar settings as the 5.0 Hz modulation family, but uses its own free-rate Hz buckets from raw 20..100 up to 20.0 Hz. Time-synchronized options span 4 to 1/64 bars.',
  depth: 'Controls the depth (amount) of modulation.',
  reso: 'Adjusts the resonance of the filter.',
  'base freq': 'Sets the filter base frequency.',
  type: 'Selects the filter mode: Lowpass, Highpass, Bandpass, or Notch.',
  mix: 'Controls the mix ratio of wet (processed) and dry (unprocessed) signals.',
  wave: 'Selects the modulation waveform: Triangle, Sine, Saw Up, Saw Down, Ramp, Square, or Random.',
  envMod: 'Adjusts the level of positive or negative envelope modulation.',
  attack: 'Controls the filter attack time.',
  release: 'Controls the filter release time.',
  drive: 'Adjusts the level and adds an overdrive effect when pushed hard.',
  poles: 'Adjusts the slope of the filter from 2-pole to 4-pole (steeper).',
};

export const RACK_AMP_PARAM_KEYS = [
  'preAmp',
  'buzz',
  'punch',
  'crunch',
  'drive',
  'level',
  'low',
  'high',
  'cabinet',
] as const;

export const RACK_AMP_UI_BY_KEY: Record<string, { abbr?: string; name?: string }> = {
  preAmp: { abbr: 'PRE', name: 'PreAmp' },
  buzz: { abbr: 'BUZ', name: 'Buzz' },
  punch: { abbr: 'PNC', name: 'Punch' },
  crunch: { abbr: 'CRN', name: 'Crunch' },
  drive: { abbr: 'DRV', name: 'Drive' },
  level: { abbr: 'LVL', name: 'Level' },
  low: { abbr: 'LOW', name: 'Low' },
  high: { abbr: 'HI', name: 'High' },
  cabinet: { abbr: 'CAB', name: 'Cabinet' },
};

export const RACK_AMP_CABINET_VALUE_MAP: Record<number, string> = {
  0: 'OFF',
  1: 'ON',
};

export const RACK_AMP_VALUE_MAP_BY_KEY: Record<string, Record<number, string>> = {
  cabinet: RACK_AMP_CABINET_VALUE_MAP,
};

export const RACK_AMP_VALUE_BY_KEY: Record<string, import('../decoded-patch-map.js').DecodedValueMeta> = {
  preAmp: { min: 0.0, max: 10.0, rawMax: 40, modDestination: true },
  buzz: { min: 0.0, max: 10.0, rawMax: 40, modDestination: true },
  punch: { min: 0.0, max: 10.0, rawMax: 40, modDestination: true },
  crunch: { min: 0.0, max: 10.0, rawMax: 40, modDestination: true },
  drive: { min: 0.0, max: 10.0, rawMax: 40, modDestination: true },
  level: { min: 0.0, max: 10.0, rawMax: 40, modDestination: true },
  low: { min: 0.0, max: 10.0, rawMax: 40, modDestination: true },
  high: { min: 0.0, max: 10.0, rawMax: 40, modDestination: true },
  cabinet: {},
};

export const RACK_AMP_NOTES_BY_KEY: Record<string, string> = {
  preAmp: 'Live-confirmed: all amp params share the same scale — 41 steps alternating +0.2/+0.3 (raw 0=0.0 to raw 40=10.0). Synth clamps at raw 40; values 41–255 display as 10.0.',
  buzz: 'Live-confirmed: same 41-step scale as preAmp (raw 0=0.0 to raw 40=10.0). Synth clamps at raw 40.',
  punch: 'Live-confirmed: same 41-step scale as preAmp (raw 0=0.0 to raw 40=10.0). Synth clamps at raw 40.',
  crunch: 'Live-confirmed: same 41-step scale as preAmp (raw 0=0.0 to raw 40=10.0). Synth clamps at raw 40.',
  drive: 'Live-confirmed: same 41-step scale as preAmp (raw 0=0.0 to raw 40=10.0). Synth clamps at raw 40.',
  level: 'Live-confirmed: same 41-step scale as preAmp (raw 0=0.0 to raw 40=10.0). Synth clamps at raw 40.',
  low: 'Live-confirmed: same 41-step scale as preAmp (raw 0=0.0 to raw 40=10.0). Synth clamps at raw 40.',
  high: 'Live-confirmed: same 41-step scale as preAmp (raw 0=0.0 to raw 40=10.0). Synth clamps at raw 40.',
  cabinet: 'Boolean toggle: raw 0=OFF, raw 1=ON. Not a mod destination.',
};

export const EDISON_EX1_PARAM_KEYS = [
  'on',
  'inMode',
  'outMode',
  'stSpread',
  'lmfSpread',
  'balance',
  'cntrDist',
  'gain'
] as const;

export const EDISON_EX1_UI_BY_KEY: Record<string, { abbr?: string; name?: string }> = {
  on: { abbr: 'ON', name: 'On' },
  inMode: { abbr: 'IMD', name: 'InMode' },
  outMode: { abbr: 'OMD', name: 'OutMode' },
  stSpread: { abbr: 'STS', name: 'StSpread' },
  lmfSpread: { abbr: 'LMF', name: 'LMFSpread' },
  balance: { abbr: 'BAL', name: 'Balance' },
  cntrDist: { abbr: 'CNT', name: 'CntrDist' },
  gain: { abbr: 'GN', name: 'Gain' },
};

export const EDISON_EX1_ON_VALUE_MAP: Record<number, string> = { 0: 'OFF', 1: 'ON' };
export const EDISON_EX1_MODE_VALUE_MAP: Record<number, string> = { 0: 'ST', 1: 'M/S' };

export const EDISON_EX1_VALUE_MAP_BY_KEY: Record<string, Record<number, string>> = {
  on: EDISON_EX1_ON_VALUE_MAP,
  inMode: EDISON_EX1_MODE_VALUE_MAP,
  outMode: EDISON_EX1_MODE_VALUE_MAP,
};

export const EDISON_EX1_VALUE_BY_KEY: Record<string, import('../decoded-patch-map.js').DecodedValueMeta> = {
  on: {},
  inMode: {},
  outMode: {},
  stSpread: { min: -50, max: 50, rawMax: 50, modDestination: true },
  lmfSpread: { min: -50, max: 50, rawMax: 50, modDestination: true },
  balance: { min: -50, max: 50, rawMax: 50, modDestination: true },
  cntrDist: { min: -50, max: 50, rawMax: 50, modDestination: true },
  gain: { units: 'dB', min: -12.0, max: 12.0, rawMax: 48, modDestination: true },
};

export const EDISON_EX1_NOTES_BY_KEY: Record<string, string> = {
  stSpread: 'Range −50 to 50 in steps of 2 (51 discrete values). Raw 0=−50, raw 50=50.',
  lmfSpread: 'Range −50 to 50 in steps of 2 (51 discrete values). Raw 0=−50, raw 50=50.',
  balance: 'Range −50 to 50 in steps of 2 (51 discrete values). Raw 0=−50, raw 50=50.',
  cntrDist: 'Range −50 to 50 in steps of 2 (51 discrete values). Raw 0=−50, raw 50=50.',
  gain: 'Range −12.0 to 12.0 dB in steps of 0.5 (49 discrete values). Raw 0=−12.0 dB, raw 48=12.0 dB.',
};
