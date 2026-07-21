// ============================================================================
// Delay Effects
// ============================================================================

export const DELAY_PARAM_KEYS = [
  'mix',
  'time',
  'mode',
  'factorL',
  'factorR',
  'offset',
  'loCut',
  'hiCut',
  'feedLc',
  'feedL',
  'feedR',
  'feedHC',
] as const;

export const DELAY_UI_BY_KEY: Record<string, { abbr?: string; name?: string }> = {
  mix: { abbr: 'MIX', name: 'Mix' },
  time: { abbr: 'TIM', name: 'Time' },
  mode: { abbr: 'MOD', name: 'Mode' },
  factorL: { abbr: 'FCL', name: 'FactorL' },
  factorR: { abbr: 'FCR', name: 'FactorR' },
  offset: { abbr: 'OFS', name: 'Offset' },
  loCut: { abbr: 'LC', name: 'LC' },
  hiCut: { abbr: 'HC', name: 'HC' },
  feedLc: { abbr: 'FLC', name: 'FeedLC' },
  feedL: { abbr: 'FBL', name: 'FeedL' },
  feedR: { abbr: 'FBR', name: 'FeedR' },
  feedHC: { abbr: 'FHC', name: 'FeedHC' },
};

export const DELAY_MODE_VALUE_MAP: Record<number, string> = {
  0: 'ST',
  1: 'X',
  2: 'M',
  3: 'P-P',
};

export const DELAY_FACTOR_VALUE_MAP: Record<number, string> = {
  0: '1/4',
  1: '3/8',
  2: '1/2',
  3: '2/3',
  4: '1',
  5: '4/3',
  6: '3/2',
  7: '2',
  8: '3',
};

export const DELAY_TIME_SYNC_VALUE_MAP: Record<number, string> = {
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

export const DELAY_VALUE_MAP_BY_KEY: Record<string, Record<number, string>> = {
  time: DELAY_TIME_SYNC_VALUE_MAP,
  mode: DELAY_MODE_VALUE_MAP,
  factorL: DELAY_FACTOR_VALUE_MAP,
  factorR: DELAY_FACTOR_VALUE_MAP,
};

export const DELAY_VALUE_BY_KEY: Record<string, import('../decoded-patch-map.js').DecodedValueMeta> = {
  mix: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  time: { units: 'ms', min: 1.0, max: 1500.0 },
  mode: {},
  factorL: {},
  factorR: {},
  offset: { units: 'ms', min: -100.0, max: 100.0 },
  loCut: { units: 'Hz', min: 10.0, max: 500.0, modDestination: true },
  hiCut: { units: 'Hz', min: 200.0, max: 20000.0, modDestination: true },
  feedLc: { units: 'Hz', min: 10.0, max: 500.0, modDestination: true },
  feedL: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  feedR: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  feedHC: { units: 'Hz', min: 200.0, max: 20000.0, modDestination: true },
};

export const DELAY_NOTES_BY_KEY: Record<string, string> = {
  mix: 'Controls the mix (or ratio) of wet (processed) and dry (unprocessed) signals.',
  time: 'Live-confirmed: raw values 0..19 are time-synchronized bar settings from 4 down to 1/64. Higher raw values enter the millisecond region, but those raw-to-ms breakpoints are not yet confirmed.',
  mode: 'Delay mode: ST = stereo feedback, X = crossed feedback between channels, M = mono mix in feedback chain, P-P = ping pong (feedback-right is disabled in this mode).',
  factorL: 'Sets left delay to rhythmic fractions of the master delay (1/4, 3/8, 1/2, 2/3, 1, 4/3, 3/2, 2, 3).',
  factorR: 'Sets right delay to rhythmic fractions of the master delay (1/4, 3/8, 1/2, 2/3, 1, 4/3, 3/2, 2, 3).',
  offset: 'Adds a delay difference between the left and right delayed signals.',
  loCut: 'Adjusts the low frequency cut, allowing lower frequencies to remain unaffected by the delay.',
  hiCut: 'Adjusts the high frequency cut, allowing higher frequencies to remain unaffected by the delay.',
  feedLc: 'Adjusts the low cut filter frequency in the feedback paths.',
  feedL: 'Controls the amount of feedback for the left channel.',
  feedR: 'Controls the amount of feedback for the right channel.',
  feedHC: 'Adjusts the high cut filter frequency in the feedback paths.',
};

export const THREE_TAP_DELAY_PARAM_KEYS = [
  'time',
  'gainT',
  'panT',
  'feedback',
  'factorA',
  'gainA',
  'panA',
  'factorB',
  'gainB',
  'panB',
  'x-feed',
  'mix',
] as const;

export const THREE_TAP_DELAY_UI_BY_KEY: Record<string, { abbr?: string; name?: string }> = {
  time: { abbr: 'TIM', name: 'Time' },
  gainT: { abbr: 'GNT', name: 'GainT' },
  panT: { abbr: 'PNT', name: 'PanT' },
  feedback: { abbr: 'FBK', name: 'Feedback' },
  factorA: { abbr: 'FCA', name: 'FactorA' },
  gainA: { abbr: 'GNA', name: 'GainA' },
  panA: { abbr: 'PNA', name: 'PanA' },
  factorB: { abbr: 'FCB', name: 'FactorB' },
  gainB: { abbr: 'GNB', name: 'GainB' },
  panB: { abbr: 'PNB', name: 'PanB' },
  'x-feed': { abbr: 'XFD', name: 'X-Feed' },
  mix: { abbr: 'MIX', name: 'Mix' },
};

export const THREE_TAP_DELAY_X_FEED_VALUE_MAP: Record<number, string> = {
  0: 'OFF',
  1: 'ON',
};

export const THREE_TAP_DELAY_VALUE_MAP_BY_KEY: Record<string, Record<number, string>> = {
  time: DELAY_TIME_SYNC_VALUE_MAP,
  factorA: DELAY_FACTOR_VALUE_MAP,
  factorB: DELAY_FACTOR_VALUE_MAP,
  'x-feed': THREE_TAP_DELAY_X_FEED_VALUE_MAP,
};

export const THREE_TAP_DELAY_VALUE_BY_KEY: Record<string, import('../decoded-patch-map.js').DecodedValueMeta> = {
  time: { units: 'ms', min: 1.0, max: 1500.0 },
  gainT: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  panT: { units: '%', min: -100.0, max: 100.0, modDestination: true },
  feedback: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  factorA: {},
  gainA: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  panA: { units: '%', min: -100.0, max: 100.0, modDestination: true },
  factorB: {},
  gainB: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  panB: { units: '%', min: -100.0, max: 100.0, modDestination: true },
  'x-feed': {},
  mix: { units: '%', min: 0.0, max: 100.0, modDestination: true },
};

export const THREE_TAP_DELAY_NOTES_BY_KEY: Record<string, string> = {
  time: 'Live-confirmed structure: raw values 0..19 are time-synchronized bar settings from 4 down to 1/64. Higher raw values enter the millisecond region, but those raw-to-ms breakpoints are not yet confirmed for 3-Tap Delay.',
  gainT: 'Sets the gain level of the first stage of the delay.',
  panT: 'Sets the position of the first delay stage in the stereo field.',
  feedback: 'Adjusts the amount of feedback.',
  factorA: 'Controls the delay time in the second stage of the delay (1/4, 3/8, 1/2, 2/3, 1, 4/3, 3/2, 2, 3).',
  gainA: 'Controls the gain level of the second delay stage.',
  panA: 'Sets the position of the second delay stage in the stereo field.',
  factorB: 'Controls the delay time in the third stage of the delay (1/4, 3/8, 1/2, 2/3, 1, 4/3, 3/2, 2, 3).',
  gainB: 'Controls the gain level of the third delay stage.',
  panB: 'Sets the position of the third gain stage in the stereo field.',
  'x-feed': 'Turns the stereo cross-feedback of the delays on or off.',
  mix: 'Controls the mix (or ratio) of wet (processed) and dry (unprocessed) signals.',
};

export const FOUR_TAP_DELAY_PARAM_KEYS = [
  'time',
  'gain',
  'feedback',
  'spread',
  'factorA',
  'gainA',
  'factorB',
  'gainB',
  'factorC',
  'gainC',
  'x-feed',
  'mix',
] as const;

export const FOUR_TAP_DELAY_UI_BY_KEY: Record<string, { abbr?: string; name?: string }> = {
  time: { abbr: 'TIM', name: 'Time' },
  gain: { abbr: 'GN', name: 'Gain' },
  feedback: { abbr: 'FBK', name: 'Feedback' },
  spread: { abbr: 'SPR', name: 'Spread' },
  factorA: { abbr: 'FCA', name: 'FactorA' },
  gainA: { abbr: 'GNA', name: 'GainA' },
  factorB: { abbr: 'FCB', name: 'FactorB' },
  gainB: { abbr: 'GNB', name: 'GainB' },
  factorC: { abbr: 'FCC', name: 'FactorC' },
  gainC: { abbr: 'GNC', name: 'GainC' },
  'x-feed': { abbr: 'XFD', name: 'X-Feed' },
  mix: { abbr: 'MIX', name: 'Mix' },
};

export const FOUR_TAP_DELAY_X_FEED_VALUE_MAP: Record<number, string> = {
  0: 'OFF',
  1: 'ON',
};

export const FOUR_TAP_DELAY_VALUE_MAP_BY_KEY: Record<string, Record<number, string>> = {
  factorA: DELAY_FACTOR_VALUE_MAP,
  factorB: DELAY_FACTOR_VALUE_MAP,
  factorC: DELAY_FACTOR_VALUE_MAP,
  'x-feed': FOUR_TAP_DELAY_X_FEED_VALUE_MAP,
};

export const FOUR_TAP_DELAY_VALUE_BY_KEY: Record<string, import('../decoded-patch-map.js').DecodedValueMeta> = {
  time: { units: 'ms', min: 1.0, max: 1500.0 },
  gain: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  feedback: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  spread: { min: 0.0, max: 6.0 },
  factorA: {},
  gainA: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  factorB: {},
  gainB: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  factorC: {},
  gainC: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  'x-feed': { min: 0.0, max: 1.0 },
  mix: { units: '%', min: 0.0, max: 100.0, modDestination: true },
};

export const FOUR_TAP_DELAY_NOTES_BY_KEY: Record<string, string> = {
  time: 'Sets the master delay time, and the first stage. Time synchronised options from 4 to 1/64 bars.',
  gain: 'Sets the gain level of the first stage of the delay.',
  feedback: 'Adjusts the amount of feedback.',
  spread: 'Positions the first delay stage in the stereo field.',
  factorA: 'Controls the delay time in the second stage of the delay (1/4, 3/8, 1/2, 2/3, 1, 4/3, 3/2, 2, 3).',
  gainA: 'Controls the gain level of the second delay stage.',
  factorB: 'Controls the delay time in the third stage of the delay (1/4, 3/8, 1/2, 2/3, 1, 4/3, 3/2, 2, 3).',
  gainB: 'Controls the gain level of the third delay stage.',
  factorC: 'Controls the delay time in the fourth stage of the delay (1/4, 3/8, 1/2, 2/3, 1, 4/3, 3/2, 2, 3).',
  gainC: 'Controls the gain level of the fourth delay stage.',
  'x-feed': 'Turns the stereo cross-feedback of the delays on or off.',
  mix: 'Controls the mix (or ratio) of wet (processed) and dry (unprocessed) signals.',
};

export const T_RAY_DELAY_PARAM_KEYS = [
  'mix',
  'delay',
  'sustain',
  'wobble',
  'tone'
] as const;

export const T_RAY_DELAY_UI_BY_KEY: Record<string, { abbr?: string; name?: string }> = {
  mix: { abbr: 'MIX', name: 'Mix' },
  delay: { abbr: 'DLY', name: 'Delay' },
  sustain: { abbr: 'SUS', name: 'Sustain' },
  wobble: { abbr: 'WOB', name: 'Wobble' },
  tone: { abbr: 'TON', name: 'Tone' },
};

export const T_RAY_DELAY_VALUE_BY_KEY: Record<string, import('../decoded-patch-map.js').DecodedValueMeta> = {
  mix: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  delay: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  sustain: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  wobble: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  tone: { units: '%', min: 0.0, max: 100.0, modDestination: true },
};

export const T_RAY_DELAY_NOTES_BY_KEY: Record<string, string> = {
  mix: 'Controls the mix (or ratio) of wet (processed) and dry (unprocessed) signals.',
  delay: 'Adjusts the master delay time.',
  sustain: 'Controls how long the delay is sustained for. Warning: at 100% build up will occur.',
  wobble: 'Adjusts the amount of wobble caused by age and quality of build/materials.',
  tone: 'Controls the tone of the delays.',
};

export const DECIM_DELAY_PARAM_KEYS = [
  'mix',
  'time',
  'downSample',
  'factorL',
  'factorR',
  'bitReduce',
  'cutoff',
  'resonance',
  'type',
  'feedL',
  'feedR',
  'decimate'
] as const;

export const DECIM_DELAY_UI_BY_KEY: Record<string, { abbr?: string; name?: string }> = {
  mix: { abbr: 'MIX', name: 'Mix' },
  time: { abbr: 'TIM', name: 'Time' },
  downSample: { abbr: 'DSM', name: 'Downsample' },
  factorL: { abbr: 'FCL', name: 'FactorL' },
  factorR: { abbr: 'FCR', name: 'FactorR' },
  bitReduce: { abbr: 'BRC', name: 'Bit-Reduce' },
  cutoff: { abbr: 'FC', name: 'Cutoff' },
  resonance: { abbr: 'RES', name: 'Resonance' },
  type: { abbr: 'FLT', name: 'Type' },
  feedL: { abbr: 'FBL', name: 'FeedL' },
  feedR: { abbr: 'FBR', name: 'FeedR' },
  decimate: { abbr: 'DMT', name: 'Decimate' },
};

export const DECIM_DELAY_TYPE_VALUE_MAP: Record<number, string> = {
  0: 'Lowpass',
  1: 'Highpass',
  2: 'Bandpass',
  3: 'Notch',
};

export const DECIM_DELAY_DECIMATE_VALUE_MAP: Record<number, string> = {
  0: 'PRE',
  1: 'POST',
};

export const DECIM_DELAY_VALUE_MAP_BY_KEY: Record<string, Record<number, string>> = {
  factorL: DELAY_FACTOR_VALUE_MAP,
  factorR: DELAY_FACTOR_VALUE_MAP,
  type: DECIM_DELAY_TYPE_VALUE_MAP,
  decimate: DECIM_DELAY_DECIMATE_VALUE_MAP,
};

export const DECIM_DELAY_VALUE_BY_KEY: Record<string, import('../decoded-patch-map.js').DecodedValueMeta> = {
  mix: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  time: { units: 'ms', min: 1.0, max: 1500.0 },
  downSample: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  factorL: {},
  factorR: {},
  bitReduce: { min: 1.0, max: 24.0 },
  cutoff: { units: 'Hz', min: 30.0, max: 20000.0, modDestination: true },
  resonance: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  type: {},
  feedL: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  feedR: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  decimate: {},
};

export const DECIM_DELAY_NOTES_BY_KEY: Record<string, string> = {
  mix: 'Controls the mix (or ratio) of wet (processed) and dry (unprocessed) signals.',
  time: 'Adjusts the master delay time. Time synchronized options from 4 to 1/64 bars.',
  downSample: 'Decimates the signal by reducing the sampling frequency.',
  factorL: 'Sets left delay to rhythmic fractions of the master delay (1/4, 3/8, 1/2, 2/3, 1, 4/3, 3/2, 2, 3).',
  factorR: 'Sets right delay to rhythmic fractions of the master delay (1/4, 3/8, 1/2, 2/3, 1, 4/3, 3/2, 2, 3).',
  bitReduce: 'Decimates the signal by reducing the bit-depth.',
  cutoff: 'Adjusts the cutoff frequency of the filter, allowing specific frequencies to be affected by the delay.',
  resonance: 'Adjusts the resonance of the filter.',
  type: 'Sets the filter type (Lowpass, Highpass, Bandpass, Notch).',
  feedL: 'Controls the amount of feedback for the left channel.',
  feedR: 'Controls the amount of feedback for the right channel.',
  decimate: 'Sets the decimation on the input signal (PRE) or only on the delay (POST).',
};
