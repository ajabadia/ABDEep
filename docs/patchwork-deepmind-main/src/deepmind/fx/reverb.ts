import type { DecodedValueMeta } from '../decoded-patch-map.js';

// ============================================================================
// HallRev (HALL REVERB)
// ============================================================================

export const HALL_REV_PARAM_KEYS = [
  'preDelay',
  'decay',
  'size',
  'damping',
  'diffusion',
  'mix',
  'loCut',
  'hiCut',
  'bassMult',
  'spread',
  'shape',
  'modSpeed',
] as const;

// From the owner's manual "HallRev (HALL REVERB)" effect parameters table.
export const HALL_REV_UI_BY_KEY: Record<string, { abbr?: string; name?: string }> = {
  preDelay: { abbr: 'PD', name: 'PreDelay' },
  decay: { abbr: 'DCY', name: 'Decay' },
  size: { abbr: 'SIZ', name: 'Size' },
  damping: { abbr: 'DMP', name: 'Damping' },
  diffusion: { abbr: 'DIF', name: 'Diffusion' },
  mix: { abbr: 'MIX', name: 'Mix' },
  loCut: { abbr: 'LC', name: 'LoCut' },
  hiCut: { abbr: 'HC', name: 'HiCut' },
  bassMult: { abbr: 'LFX', name: 'BassMult' },
  spread: { abbr: 'SPR', name: 'Spread' },
  shape: { abbr: 'SHP', name: 'Shape' },
  modSpeed: { abbr: 'MOD', name: 'ModSpeed' },
};

// From the owner's manual "HallRev (HALL REVERB)" effect parameters table.
// Note: These are *display* ranges/units; raw storage is 0..255.
export const HALL_REV_VALUE_BY_KEY: Record<string, DecodedValueMeta> = {
  preDelay: { units: 'ms', min: 0.0, max: 200.0 },
  decay: { units: 's', min: 0.2, max: 4.9, modDestination: true },
  size: { min: 2.0, max: 100.0 },
  damping: { units: 'Hz', min: 1000, max: 20000, modDestination: true },
  diffusion: { units: '%', min: 0.0, max: 100.0 },
  mix: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  loCut: { units: 'Hz', min: 10.0, max: 500.0, modDestination: true },
  hiCut: { units: 'Hz', min: 200.0, max: 20000.0, modDestination: true },
  bassMult: { min: 0.5, max: 2.0, modDestination: true },
  spread: { min: 0.0, max: 50.0 },
  shape: { min: 0.0, max: 250.0, modDestination: true },
  modSpeed: { min: 0.0, max: 100.0 },
};

export const HALL_REV_NOTES_BY_KEY: Record<string, string> = {
  size: 'Live-confirmed: manual documents max 200.0 but observed display max is 100.0. 50 steps of 2.0 (raw 0=2.0 to raw 49=100.0).',
  decay: 'Non-linear curve. Live-confirmed: ~50 discrete display values from 0.2 s to 4.9 s.',
  damping: 'Logarithmic. Live-confirmed: 25 discrete steps (raw 0=1000.0 Hz to raw 24=20000.0 Hz).',
  diffusion: 'Live-confirmed: display shows 0%–100% in 30 discrete steps (raw 0–29), ~3.4% per step. Manual incorrectly lists range as 1.0–30.0.',
  loCut: 'Logarithmic. Live-confirmed: 50 discrete steps (raw 0=10.0 Hz to raw 49=500.0 Hz).',
  hiCut: 'Logarithmic. Live-confirmed: 52 discrete steps (raw 0=200.0 Hz to raw 51=20000.0 Hz).',
  bassMult: 'Stepped display. Live-confirmed buckets: raw 0–6=0.5, 7–12=0.6, 13–16=0.7, 17–18=0.8, 19–21=0.9, 22–25=1.0, 26–28=1.1, 29–31=1.2, 32–34=1.3, 35–36=1.4, 37–38=1.5, 39–41=1.6, 42–43=1.7, 44–45=1.8, 46+=2.0.',
  spread: 'Linear. Live-confirmed: raw 0=0 to raw 50=50 in steps of 1.',
  shape: 'Linear. Live-confirmed: raw 0=0 to raw 50=250 in steps of 5.',
  modSpeed: 'Linear. Live-confirmed: raw 0=0 to raw 20=100 in steps of 5.',
};

// ============================================================================
// PlateRev (PLATE REVERB)
// ============================================================================

export const PLATE_REV_PARAM_KEYS = [
  'preDelay',
  'decay',
  'size',
  'damping',
  'diffusion',
  'mix',
  'loCut',
  'hiCut',
  'bassMult',
  'xover',
  'modDepth',
  'modSpeed',
] as const;

// From the owner's manual "PlateRev (PLATE REVERB)" effect parameters table.
export const PLATE_REV_UI_BY_KEY: Record<string, { abbr?: string; name?: string }> = {
  preDelay: { abbr: 'PD', name: 'PreDelay' },
  decay: { abbr: 'DCY', name: 'Decay' },
  size: { abbr: 'SIZ', name: 'Size' },
  damping: { abbr: 'DMP', name: 'Damping' },
  diffusion: { abbr: 'DIF', name: 'Diffusion' },
  mix: { abbr: 'MIX', name: 'Mix' },
  loCut: { abbr: 'LC', name: 'LoCut' },
  hiCut: { abbr: 'HC', name: 'HiCut' },
  bassMult: { abbr: 'LFX', name: 'BassMult' },
  xover: { abbr: 'XOV', name: 'Xover' },
  modDepth: { abbr: 'MOD', name: 'ModDepth' },
  modSpeed: { abbr: 'MDS', name: 'ModSpeed' },
};

// From the owner's manual "PlateRev (PLATE REVERB)" effect parameters table.
// Note: These are *display* ranges/units; raw storage is 0..255.
export const PLATE_REV_VALUE_BY_KEY: Record<string, DecodedValueMeta> = {
  preDelay: { units: 'ms', min: 0.0, max: 200.0 },
  decay: { units: 's', min: 0.5, max: 10.0, modDestination: true },
  size: { min: 2.0, max: 100.0 },
  damping: { units: 'Hz', min: 1000, max: 20000, modDestination: true },
  diffusion: { units: '%', min: 0.0, max: 100.0 },
  mix: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  loCut: { units: 'Hz', min: 10.0, max: 500.0, modDestination: true },
  hiCut: { units: 'Hz', min: 200.0, max: 20000.0, modDestination: true },
  bassMult: { min: 0.5, max: 2.0, modDestination: true },
  xover: { units: 'Hz', min: 10.0, max: 500.0, modDestination: true },
  modDepth: { min: 1.0, max: 50.0 },
  modSpeed: { min: 0.0, max: 100.0 },
};

export const PLATE_REV_NOTES_BY_KEY: Record<string, string> = {
  preDelay: 'Same scale as HallRev: 101 steps of 2.0 ms (raw 0=0.0 ms to raw 100=200.0 ms).',
  decay: 'Non-linear curve. Live-confirmed: 51 discrete display values from 0.5 s to 10.0 s (raw 0–50).',
  size: 'Live-confirmed: max is 100.0 (manual states 200.0 incorrectly). 50 steps of 2.0 (raw 0=2.0 to raw 49=100.0).',
  damping: 'Same logarithmic scale as HallRev. Live-confirmed: 25 discrete steps (raw 0=1000.0 Hz to raw 24=20000.0 Hz).',
  diffusion: 'Same scale as HallRev. Live-confirmed: 0%–100% in 30 steps (raw 0–29), ~3.4% per step. Manual incorrectly lists 1.0–30.0.',
  loCut: 'Same logarithmic scale as HallRev. 50 discrete steps (raw 0=10.0 Hz to raw 49=500.0 Hz).',
  hiCut: 'Same logarithmic scale as HallRev. 52 discrete steps (raw 0=200.0 Hz to raw 51=20000.0 Hz).',
  bassMult: 'Same stepped display as HallRev. Buckets: raw 0–6=0.5, 7–12=0.6, 13–16=0.7, 17–18=0.8, 19–21=0.9, 22–25=1.0, 26–28=1.1, 29–31=1.2, 32–34=1.3, 35–36=1.4, 37–38=1.5, 39–41=1.6, 42–43=1.7, 44–45=1.8, 46+=2.0.',
  xover: 'Same logarithmic scale as LoCut. 50 discrete steps (raw 0=10.0 Hz to raw 49=500.0 Hz).',
  modDepth: 'Linear. Live-confirmed: raw 0=1.0 to raw 49=50.0 in steps of 1.',
  modSpeed: 'Same scale as HallRev. Linear: raw 0=0 to raw 20=100 in steps of 5.',
};

// ============================================================================
// RichPltRev (RICH PLATE REVERB)
// ============================================================================

export const RICH_PLT_REV_PARAM_KEYS = [
  'preDelay',
  'decay',
  'size',
  'damping',
  'diffusion',
  'mix',
  'loCut',
  'hiCut',
  'bassMult',
  'spread',
  'attack',
  'spin',
] as const;

// From the owner's manual "RichPltRev (RICH PLATE REVERB)" effect parameters table.
export const RICH_PLT_REV_UI_BY_KEY: Record<string, { abbr?: string; name?: string }> = {
  preDelay: { abbr: 'PD', name: 'PreDelay' },
  decay: { abbr: 'DCY', name: 'Decay' },
  size: { abbr: 'SIZ', name: 'Size' },
  damping: { abbr: 'DMP', name: 'Damping' },
  diffusion: { abbr: 'DIF', name: 'Diffusion' },
  mix: { abbr: 'MIX', name: 'Mix' },
  loCut: { abbr: 'LC', name: 'LoCut' },
  hiCut: { abbr: 'HC', name: 'HiCut' },
  bassMult: { abbr: 'LFX', name: 'BassMult' },
  spread: { abbr: 'SPR', name: 'Spread' },
  attack: { abbr: 'ATK', name: 'Attack' },
  spin: { abbr: 'SPN', name: 'Spin' },
};

// From the owner's manual "RichPltRev (RICH PLATE REVERB)" effect parameters table.
// Note: These are *display* ranges/units; raw storage is 0..255.
export const RICH_PLT_REV_VALUE_BY_KEY: Record<string, DecodedValueMeta> = {
  preDelay: { units: 'ms', min: 0.0, max: 200.0 },
  decay: { units: 's', min: 0.5, max: 10.0, modDestination: true },
  size: { units: 'm', min: 4.0, max: 39.0 },
  damping: { units: 'Hz', min: 1000, max: 20000, modDestination: true },
  diffusion: { units: '%', min: 0.0, max: 100.0 },
  mix: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  loCut: { units: 'Hz', min: 10.0, max: 500.0, modDestination: true },
  hiCut: { units: 'Hz', min: 200.0, max: 20000.0, modDestination: true },
  bassMult: { min: 0.2, max: 4.0, modDestination: true },
  spread: { min: 0.0, max: 50.0 },
  attack: { min: 0.0, max: 100.0, modDestination: true },
  spin: { units: '%', min: 0.0, max: 100.0, modDestination: true },
};

export const RICH_PLT_REV_NOTES_BY_KEY: Record<string, string> = {
  preDelay: 'Same scale as HallRev: 101 steps of 2.0 ms (raw 0=0.0 ms to raw 100=200.0 ms).',
  decay: 'Same non-linear curve as PlateRev. Live-confirmed: 51 discrete display values from 0.5 s to 10.0 s. Manual incorrectly lists 0.3 s–28.9 s.',
  size: 'Linear. Live-confirmed: raw 0=4.0 m to raw 35=39.0 m in steps of 1.',
  damping: 'Same logarithmic scale as HallRev. Live-confirmed: 25 discrete steps (raw 0=1000.0 Hz to raw 24=20000.0 Hz).',
  diffusion: 'Live-confirmed: 26 steps of ~4% (raw 0=0% to raw 25=100%).',
  mix: 'Live-confirmed: max is 100%. Linear: raw 0=0% to raw 100=100% in steps of 1%.',
  loCut: 'Same logarithmic scale as HallRev. 50 discrete steps (raw 0=10.0 Hz to raw 49=500.0 Hz).',
  hiCut: 'Same logarithmic scale as HallRev. 52 discrete steps (raw 0=200.0 Hz to raw 51=20000.0 Hz).',
  bassMult: 'Stepped display, wider range than HallRev (0.2–4.0). Live-confirmed buckets: raw 0–3=0.2, 4=0.3, 5–8=0.4, 9–12=0.5, 13–15=0.6, 16–17=0.7, 18–20=0.8, 21=0.9, 22–23=1.0, 24–25=1.1, 26=1.2, 27–28=1.3, 29=1.4, 30=1.5, 31=1.6, 32–33=1.7, 34=1.9, 35=2.0, 36=2.1, 37=2.2, 38=2.3, 39=2.4, 40=2.6, 41=2.7, 42=2.9, 43=3.0, 44=3.2, 45=3.4, 46=3.5, 47=3.7, 48=4.0.',
  spread: 'Same scale as HallRev. Linear: raw 0=0 to raw 50=50 in steps of 1.',
  attack: 'Linear. Live-confirmed: raw 0=0 to raw 50=100 in steps of 2.',
  spin: 'Linear. Live-confirmed: raw 0=0% to raw 50=100% in steps of 2%.',
};

// ============================================================================
// AmbVerb (AMBIENT REVERB)
// ============================================================================

export const AMB_VERB_PARAM_KEYS = [
  'preDelay',
  'decay',
  'size',
  'damping',
  'diffusion',
  'mix',
  'loCut',
  'hiCut',
  'mod',
  'tailGain',
] as const;

// From the owner's manual "AmbVerb (AMBIENT REVERB)" effect parameters table.
export const AMB_VERB_UI_BY_KEY: Record<string, { abbr?: string; name?: string }> = {
  preDelay: { abbr: 'PD', name: 'PreDelay' },
  decay: { abbr: 'DCY', name: 'Decay' },
  size: { abbr: 'SIZ', name: 'Size' },
  damping: { abbr: 'DMP', name: 'Damping' },
  diffusion: { abbr: 'DIF', name: 'Diffusion' },
  mix: { abbr: 'MIX', name: 'Mix' },
  loCut: { abbr: 'LC', name: 'LoCut' },
  hiCut: { abbr: 'HC', name: 'HiCut' },
  mod: { abbr: 'MOD', name: 'Mod' },
  tailGain: { abbr: 'TGN', name: 'TailGain' },
};

// From the owner's manual "AmbVerb (AMBIENT REVERB)" effect parameters table.
// Note: These are *display* ranges/units; raw storage is 0..255.
export const AMB_VERB_VALUE_BY_KEY: Record<string, DecodedValueMeta> = {
  preDelay: { units: 'ms', min: 0.0, max: 200.0 },
  decay: { units: 's', min: 0.2, max: 7.3, modDestination: true },
  size: { min: 2.0, max: 100.0 },
  damping: { units: 'Hz', min: 1000, max: 20000, modDestination: true },
  diffusion: { min: 1.0, max: 30.0 },
  mix: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  loCut: { units: 'Hz', min: 10.0, max: 500.0, modDestination: true },
  hiCut: { units: 'Hz', min: 200.0, max: 20000.0, modDestination: true },
  mod: { units: '%', min: 0.0, max: 100.0 },
  tailGain: { units: '%', min: 0.0, max: 100.0, modDestination: true },
};

// ============================================================================
// GatedRev (GATED REVERB)
// ============================================================================

export const GATED_REV_PARAM_KEYS = [
  'preDelay',
  'decay',
  'attack',
  'density',
  'spread',
  'mix',
  'loCut',
  'hiSvFreq',
  'hiSvGain',
  'diffusion',
] as const;

// From the owner's manual "GatedRev (GATED REVERB)" effect parameters table.
export const GATED_REV_UI_BY_KEY: Record<string, { abbr?: string; name?: string }> = {
  preDelay: { abbr: 'PD', name: 'PreDelay' },
  decay: { abbr: 'DCY', name: 'Decay' },
  attack: { abbr: 'ATK', name: 'Attack' },
  density: { abbr: 'DEN', name: 'Density' },
  spread: { abbr: 'SPR', name: 'Spread' },
  mix: { abbr: 'MIX', name: 'Mix' },
  loCut: { abbr: 'LC', name: 'LoCut' },
  hiSvFreq: { abbr: 'HIF', name: 'HiSvFreq' },
  hiSvGain: { abbr: 'HIG', name: 'HiSvGain' },
  diffusion: { abbr: 'DIF', name: 'Diffusion' },
};

// From the owner's manual "GatedRev (GATED REVERB)" effect parameters table.
// Note: These are *display* ranges/units; raw storage is 0..255.
export const GATED_REV_VALUE_BY_KEY: Record<string, DecodedValueMeta> = {
  preDelay: { units: 'ms', min: 0.0, max: 200.0 },
  decay: { units: 'ms', min: 140.0, max: 1000.0 },
  attack: { min: 0.0, max: 30.0, modDestination: true },
  density: { min: 1.0, max: 50.0, modDestination: true },
  spread: { min: 0.0, max: 100.0 },
  mix: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  loCut: { units: 'Hz', min: 10.0, max: 500.0, modDestination: true },
  hiSvFreq: { units: 'Hz', min: 200.0, max: 20000.0, modDestination: true },
  hiSvGain: { units: 'dB', min: -30.0, max: 0.0, modDestination: true },
  diffusion: { units: '%', min: 0.0, max: 100.0 },
};

export const GATED_REV_NOTES_BY_KEY: Record<string, string> = {
  preDelay: 'Controls the amount of time before the reverb is heard following the source signal.',
  decay: 'Controls the amount of time it takes for the reverb to dissipate.',
  attack: 'Adjusts the contour of the reverberation envelope.',
  density: 'Manipulates the reflection density in the simulated room.',
  spread: 'Emphasizes the stereo effect of the reverb.',
  mix: 'Controls the mix (or ratio) of wet (processed) and dry (unprocessed) signals.',
  loCut: 'Allows the low frequencies affected by the reverb to be reduced.',
  hiSvFreq: 'Adjusts the frequency of a Hi-Shelving filter at the input of the reverb effect.',
  hiSvGain: 'Adjusts the gain of a Hi-Shelving filter at the input of the reverb effect.',
  diffusion: 'Controls the initial reflection density.',
};

// ============================================================================
// ReverseRev (REVERSE REVERB)
// ============================================================================

export const REVERSE_REV_PARAM_KEYS = [
  'preDelay',
  'decay',
  'rise',
  'diffusion',
  'spread',
  'mix',
  'loCut',
  'hiSvFreq',
  'hiSvGain',
] as const;

// From the owner's manual "Reverse (REVERSE REVERB)" effect parameters table.
export const REVERSE_REV_UI_BY_KEY: Record<string, { abbr?: string; name?: string }> = {
  preDelay: { abbr: 'PD', name: 'PreDelay' },
  decay: { abbr: 'DCY', name: 'Decay' },
  rise: { abbr: 'RIS', name: 'Rise' },
  diffusion: { abbr: 'DIF', name: 'Diffusion' },
  spread: { abbr: 'SPR', name: 'Spread' },
  mix: { abbr: 'MIX', name: 'Mix' },
  loCut: { abbr: 'LC', name: 'LoCut' },
  hiSvFreq: { abbr: 'HIF', name: 'HiSvFreq' },
  hiSvGain: { abbr: 'HIG', name: 'HiSvGain' },
};

// From the owner's manual "Reverse (REVERSE REVERB)" effect parameters table.
// Note: These are *display* ranges/units; raw storage is 0..255.
export const REVERSE_REV_VALUE_BY_KEY: Record<string, DecodedValueMeta> = {
  preDelay: { units: 'ms', min: 0.0, max: 200.0 },
  decay: { units: 'ms', min: 140.0, max: 1000.0 },
  rise: { min: 0.0, max: 50.0, modDestination: true },
  diffusion: { min: 1.0, max: 30.0 },
  spread: { min: 0.0, max: 100.0 },
  mix: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  loCut: { units: 'Hz', min: 10.0, max: 500.0, modDestination: true },
  hiSvFreq: { units: 'Hz', min: 200.0, max: 20000.0, modDestination: true },
  hiSvGain: { units: 'dB', min: -30.0, max: 0.0, modDestination: true },
};

export const REVERSE_REV_NOTES_BY_KEY: Record<string, string> = {
  preDelay: 'Controls the amount of time before the reverb is heard following the source signal.',
  decay: 'Controls the amount of time it takes for the reverb to dissipate.',
  rise: 'Controls how quickly the effect builds up.',
  diffusion: 'Controls the initial reflection density.',
  spread: 'Controls how the reflection is distributed through the envelope of the reverb.',
  mix: 'Controls the mix (or ratio) of wet (processed) and dry (unprocessed) signals.',
  loCut: 'Allows the low frequencies affected by the reverb to be reduced.',
  hiSvFreq: 'Adjusts the frequency of a Hi-Shelving filter at the input of the reverb effect.',
  hiSvGain: 'Adjusts the gain of a Hi-Shelving filter at the input of the reverb effect.',
};

// ============================================================================
// ChamberRev (CHAMBER REVERB)
// ============================================================================

export const CHAMBER_REV_PARAM_KEYS = [
  'preDelay',
  'decay',
  'size',
  'damping',
  'diffusion',
  'mix',
  'loCut',
  'hiCut',
  'bassMult',
  'spread',
  'shape',
  'spin'
] as const;

// From the owner's manual "ChamberRev (CHAMBER REVERB)" effect parameters table.
export const CHAMBER_REV_UI_BY_KEY: Record<string, { abbr?: string; name?: string }> = {
  preDelay: { abbr: 'PRE', name: 'PreDelay' },
  decay: { abbr: 'DCY', name: 'Decay' },
  size: { abbr: 'SIZ', name: 'Size' },
  damping: { abbr: 'DMP', name: 'Damping' },
  diffusion: { abbr: 'DIF', name: 'Diffusion' },
  mix: { abbr: 'MIX', name: 'Mix' },
  loCut: { abbr: 'LC', name: 'LoCut' },
  hiCut: { abbr: 'HC', name: 'HiCut' },
  bassMult: { abbr: 'LFX', name: 'BassMult' },
  spread: { abbr: 'SPR', name: 'Spread' },
  shape: { abbr: 'SHP', name: 'Shape' },
  spin: { abbr: 'SPI', name: 'Spin' },
};

// From the owner's manual "ChamberRev (CHAMBER REVERB)" effect parameters table.
// Note: These are *display* ranges/units; raw storage is 0..255.
export const CHAMBER_REV_VALUE_BY_KEY: Record<string, DecodedValueMeta> = {
  preDelay: { units: 'ms', min: 0.0, max: 200.0 },
  decay: { units: 's', min: 0.5, max: 10.0, modDestination: true },
  size: { units: 'm', min: 4.0, max: 76.0 },
  damping: { units: 'Hz', min: 1000, max: 20000, modDestination: true },
  diffusion: { units: '%', min: 0.0, max: 100.0 },
  mix: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  loCut: { units: 'Hz', min: 10.0, max: 500.0, modDestination: true },
  hiCut: { units: 'Hz', min: 200.0, max: 20000.0 },
  bassMult: { min: 0.2, max: 4.0, modDestination: true },
  spread: { min: 0.0, max: 50.0 },
  shape: { min: 0.0, max: 250.0, modDestination: true },
  spin: { units: '%', min: 0.0, max: 100.0 },
};

export const CHAMBER_REV_NOTES_BY_KEY: Record<string, string> = {
  preDelay: 'Live-confirmed: much higher resolution than other reverbs. 255 steps at ~0.787 ms each (raw 0=0.0 ms to raw 254=200.0 ms).',
  decay: 'Same non-linear curve as PlateRev. Live-confirmed: 51 discrete display values from 0.5 s to 10.0 s. Manual incorrectly lists 0.3 s–28.9 s.',
  size: 'Linear. Live-confirmed: raw 0=4.0 m to raw 36=76.0 m in steps of 2.',
  damping: 'Same logarithmic scale as HallRev. Live-confirmed: 25 discrete steps (raw 0=1000.0 Hz to raw 24=20000.0 Hz).',
  diffusion: 'Same scale as RichPltRev. Live-confirmed: 26 steps of ~4% (raw 0=0% to raw 25=100%).',
  mix: 'Linear. Live-confirmed: raw 0=0% to raw 50=100% in steps of 2%.',
  loCut: 'Same logarithmic scale as HallRev. 50 discrete steps (raw 0=10.0 Hz to raw 49=500.0 Hz).',
  hiCut: 'Same logarithmic scale as HallRev. 52 discrete steps (raw 0=200.0 Hz to raw 51=20000.0 Hz). Not a mod destination in ChamberRev.',
  bassMult: 'Same stepped display as RichPltRev (0.2–4.0). See RichPltRev notes for full bucket list.',
  spread: 'Linear. Live-confirmed: raw 0=0 to raw 50=50 in steps of 1.',
  shape: 'Linear. Live-confirmed: raw 0=0 to raw 50=250 in steps of 5.',
  spin: 'Linear. Live-confirmed: raw 0=0% to raw 20=100% in steps of 5%.',
};

// ============================================================================
// RoomRev (ROOM REVERB)
// ============================================================================

export const ROOM_REV_PARAM_KEYS = [
  'preDelay',
  'decay',
  'size',
  'damping',
  'diffusion',
  'mix',
  'loCut',
  'hiCut',
  'bassMult',
  'spread',
  'shape',
  'spin'
] as const;

// From the owner's manual "RoomRev (ROOM REVERB)" effect parameters table.
export const ROOM_REV_UI_BY_KEY: Record<string, { abbr?: string; name?: string }> = {
  preDelay: { abbr: 'PRE', name: 'PreDelay' },
  decay: { abbr: 'DCY', name: 'Decay' },
  size: { abbr: 'SIZ', name: 'Size' },
  damping: { abbr: 'DMP', name: 'Damping' },
  diffusion: { abbr: 'DIF', name: 'Diffusion' },
  mix: { abbr: 'MIX', name: 'Mix' },
  loCut: { abbr: 'LC', name: 'LoCut' },
  hiCut: { abbr: 'HC', name: 'HiCut' },
  bassMult: { abbr: 'LFX', name: 'BassMult' },
  spread: { abbr: 'SPR', name: 'Spread' },
  shape: { abbr: 'SHP', name: 'Shape' },
  spin: { abbr: 'SPI', name: 'Spin' },
};

// From the owner's manual "RoomRev (ROOM REVERB)" effect parameters table.
// Note: These are *display* ranges/units; raw storage is 0..255.
export const ROOM_REV_VALUE_BY_KEY: Record<string, DecodedValueMeta> = {
  preDelay: { units: 'ms', min: 0.0, max: 200.0 },
  decay: { units: 's', min: 0.3, max: 28.9, modDestination: true },
  size: { units: 'm', min: 4.0, max: 76.0 },
  damping: { units: 'Hz', min: 1000, max: 20000, modDestination: true },
  diffusion: { units: '%', min: 0.0, max: 100.0 },
  mix: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  loCut: { units: 'Hz', min: 10.0, max: 500.0, modDestination: true },
  hiCut: { units: 'Hz', min: 200.0, max: 20000.0, modDestination: true },
  bassMult: { min: 0.2, max: 4.0, modDestination: true },
  spread: { min: 0.0, max: 50.0 },
  shape: { min: 0.0, max: 250.0, modDestination: true },
  spin: { units: '%', min: 0.0, max: 100.0 },
};

// ============================================================================
// VintageRev (VINTAGE REVERB)
// ============================================================================

export const VINTAGE_REV_PARAM_KEYS = [
  'preDelay',
  'size',
  'decay',
  'loMult',
  'hiMult',
  'density',
  'loCut',
  'hiCut',
  'erLevel',
  'erDelay',
  'mix',
  'freeze'
] as const;

// From the owner's manual "VintageRev (VINTAGE REVERB)" effect parameters table.
export const VINTAGE_REV_UI_BY_KEY: Record<string, { abbr?: string; name?: string }> = {
  preDelay: { abbr: 'PRE', name: 'PreDelay' },
  size: { abbr: 'SIZ', name: 'Size' },
  decay: { abbr: 'DCY', name: 'Decay' },
  loMult: { abbr: 'LFX', name: 'Lo Mult' },
  hiMult: { abbr: 'HFX', name: 'Hi Mult' },
  density: { abbr: 'DEN', name: 'Density' },
  loCut: { abbr: 'LC', name: 'LoCut' },
  hiCut: { abbr: 'HC', name: 'HiCut' },
  erLevel: { abbr: 'ERL', name: 'ER Level' },
  erDelay: { abbr: 'ERD', name: 'ER Delay' },
  mix: { abbr: 'MIX', name: 'Mix' },
  freeze: { abbr: 'FRZ', name: 'Freeze' },
};

// From the owner's manual "VintageRev (VINTAGE REVERB)" effect parameters table.
// Note: These are *display* ranges/units; raw storage is 0..255.
export const VINTAGE_REV_VALUE_BY_KEY: Record<string, DecodedValueMeta> = {
  preDelay: { units: 'ms', min: 0.0, max: 200.0 },
  size: { units: '%', min: 1.0, max: 100.0 },
  decay: { units: 's', min: 0.1, max: 20.7, modDestination: true },
  loMult: { min: 0.1, max: 10.0, modDestination: true },
  hiMult: { min: 0.1, max: 10.0, modDestination: true },
  density: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  loCut: { units: 'Hz', min: 10.0, max: 500.0, modDestination: true },
  hiCut: { units: 'Hz', min: 200.0, max: 20000.0, modDestination: true },
  erLevel: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  erDelay: { units: 'ms', min: 0.0, max: 200.0 },
  mix: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  freeze: { modDestination: true },
};

// Freeze is an ON/OFF toggle. Assuming raw 0=OFF, 1=ON.
export const VINTAGE_REV_FREEZE_VALUE_MAP: Record<number, string> = {
  0: 'OFF',
  1: 'ON',
};
