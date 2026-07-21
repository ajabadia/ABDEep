// ============================================================================
// Processing Effects
// ============================================================================

export const MIDAS_EQ_PARAM_KEYS = [
  'loShelfGain',
  'loShelfFreq',
  'loMidGain',
  'loMidFreq',
  'loMidQ',
  'hiMidGain',
  'hiMidFreq',
  'hiMidQ',
  'hiShelfGain',
  'hiShelfFreq',
  'eq'
] as const;

export const MIDAS_EQ_UI_BY_KEY: Record<string, { abbr?: string; name?: string }> = {
  loShelfGain: { abbr: 'LSG', name: 'LoShelfGain' },
  loShelfFreq: { abbr: 'LSF', name: 'LoShelfFreq' },
  loMidGain: { abbr: 'LMG', name: 'LoMidGain' },
  loMidFreq: { abbr: 'LMF', name: 'LoMidFreq' },
  loMidQ: { abbr: 'LMQ', name: 'LoMidQ' },
  hiMidGain: { abbr: 'HMG', name: 'HiMidGain' },
  hiMidFreq: { abbr: 'HMF', name: 'HiMidFreq' },
  hiMidQ: { abbr: 'HMQ', name: 'HiMidQ' },
  hiShelfGain: { abbr: 'HSG', name: 'HiShelfGain' },
  hiShelfFreq: { abbr: 'HSF', name: 'HiShelfFreq' },
  eq: { abbr: 'EQ', name: 'EQ' },
};

export const MIDAS_EQ_EQ_VALUE_MAP: Record<number, string> = {
  0: 'IN',
  1: 'OUT',
};

export const MIDAS_EQ_VALUE_MAP_BY_KEY: Record<string, Record<number, string>> = {
  eq: MIDAS_EQ_EQ_VALUE_MAP,
};

export const MIDAS_EQ_VALUE_BY_KEY: Record<string, import('../decoded-patch-map.js').DecodedValueMeta> = {
  loShelfGain: { units: 'dB', min: -12.0, max: 12.0, modDestination: true },
  loShelfFreq: { units: 'Hz', min: 30.0, max: 20000.0, modDestination: true },
  loMidGain: { units: 'dB', min: -12.0, max: 12.0, modDestination: true },
  loMidFreq: { units: 'Hz', min: 30.0, max: 20000.0, modDestination: true },
  loMidQ: { min: 0.3, max: 5.0, modDestination: true },
  hiMidGain: { units: 'dB', min: -12.0, max: 12.0, modDestination: true },
  hiMidFreq: { units: 'Hz', min: 30.0, max: 20000.0, modDestination: true },
  hiMidQ: { min: 0.3, max: 5.0, modDestination: true },
  hiShelfGain: { units: 'dB', min: -12.0, max: 12.0, modDestination: true },
  hiShelfFreq: { units: 'Hz', min: 30.0, max: 20000.0, modDestination: true },
  eq: { modDestination: true },
};

export const MIDAS_EQ_NOTES_BY_KEY: Record<string, string> = {
  loShelfGain: 'Adjusts the gain of the low band.',
  loShelfFreq: 'Adjusts the frequency of the low band.',
  loMidGain: 'Adjusts the gain of the low-mid band.',
  loMidFreq: 'Adjusts the frequency of the low-mid band.',
  loMidQ: 'Adjusts the Q-factor of the low-mid band.',
  hiMidGain: 'Adjusts the gain of the high-mid band.',
  hiMidFreq: 'Adjusts the frequency of the high-mid band.',
  hiMidQ: 'Adjusts the Q-factor of the high-mid band.',
  hiShelfGain: 'Adjusts the gain of the high band.',
  hiShelfFreq: 'Adjusts the frequency of the high band.',
  eq: 'Enables or bypasses the EQ. The manual description for this row appears to be a copy/paste error from the high-shelf frequency row.',
};

export const FAIR_COMP_PARAM_KEYS = [
  'mode',
  'inGainLM',
  'threshLM',
  'timeLM',
  'dcBiasLM',
  'outGainLM',
  'biasBal',
  'inGainRS',
  'threshRS',
  'timeRS',
  'dcBiasRS',
  'outGainRS'
] as const;

export const FAIR_COMP_UI_BY_KEY: Record<string, { abbr?: string; name?: string }> = {
  mode: { abbr: 'MOD', name: 'Mode' },
  inGainLM: { abbr: 'INL', name: 'InGainL/M' },
  threshLM: { abbr: 'THL', name: 'ThreshL/M' },
  timeLM: { abbr: 'TML', name: 'TimeL/M' },
  dcBiasLM: { abbr: 'DCL', name: 'DCBiasL/M' },
  outGainLM: { abbr: 'OGL', name: 'OutGainL/M' },
  biasBal: { abbr: 'BAL', name: 'Bias Bal' },
  inGainRS: { abbr: 'INR', name: 'InGainR/S' },
  threshRS: { abbr: 'THR', name: 'ThreshR/S' },
  timeRS: { abbr: 'TMR', name: 'TimeR/S' },
  dcBiasRS: { abbr: 'DCR', name: 'DCBiasR/S' },
  outGainRS: { abbr: 'OGR', name: 'OutGainR/S' },
};

export const FAIR_COMP_MODE_VALUE_MAP: Record<number, string> = {
  0: 'OFF',
  1: 'ST',
  2: 'DUA',
  3: 'M/S',
};

export const FAIR_COMP_VALUE_MAP_BY_KEY: Record<string, Record<number, string>> = {
  mode: FAIR_COMP_MODE_VALUE_MAP,
};

export const FAIR_COMP_VALUE_BY_KEY: Record<string, import('../decoded-patch-map.js').DecodedValueMeta> = {
  mode: {},
  inGainLM: { min: -20.0, max: 0.0, modDestination: true },
  threshLM: { min: 0.0, max: 10.0, modDestination: true },
  timeLM: { min: 1.0, max: 6.0 },
  dcBiasLM: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  outGainLM: { units: 'dB', min: -18.0, max: 6.0, modDestination: true },
  biasBal: { units: '%', min: -100.0, max: 100.0, modDestination: true },
  inGainRS: { min: -20.0, max: 0.0, modDestination: true },
  threshRS: { min: 0.0, max: 10.0, modDestination: true },
  timeRS: { min: 1.0, max: 6.0 },
  dcBiasRS: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  outGainRS: { units: 'dB', min: -18.0, max: 6.0, modDestination: true },
};

export const FAIR_COMP_NOTES_BY_KEY: Record<string, string> = {
  mode: 'Selects Off, Stereo, Dual, or Mid/Side compressor operation.',
  inGainLM: 'Controls the input gain for the Left/Mid signal.',
  threshLM: 'Controls the threshold for the Left/Mid signal.',
  timeLM: 'Controls the attack and release time for the Left/Mid signal.',
  dcBiasLM: 'Adjusts the ratio and knee of the compression curve for the Left/Mid signal.',
  outGainLM: 'Controls the output gain for the Left/Mid signal.',
  biasBal: 'Adjusts the bias current, creating accentuation of attacks.',
  inGainRS: 'Controls the input gain for the Right/Side signal.',
  threshRS: 'Controls the threshold for the Right/Side signal.',
  timeRS: 'Controls the attack and release time for the Right/Side signal.',
  dcBiasRS: 'Adjusts the ratio and knee of the compression curve for the Right/Side signal.',
  outGainRS: 'Controls the output gain for the Right/Side signal.',
};

export const MUL_BND_DIST_PARAM_KEYS = [
  'inGain',
  'distType',
  'lowBandLev',
  'lowDrive',
  'xoverLowMid',
  'midBandLev',
  'midDrive',
  'xoverMidHi',
  'hiBandLev',
  'hiDrive',
  'cabinet',
  'outGain'
] as const;

export const MUL_BND_DIST_UI_BY_KEY: Record<string, { abbr?: string; name?: string }> = {
  inGain: { abbr: 'IPG', name: 'InputGain' },
  distType: { abbr: 'DST', name: 'Dist Types' },
  lowBandLev: { abbr: 'LBL', name: 'Low Level' },
  lowDrive: { abbr: 'LDR', name: 'Low Drive' },
  xoverLowMid: { abbr: 'XV1', name: 'XoverFreq1' },
  midBandLev: { abbr: 'MBL', name: 'Mid Level' },
  midDrive: { abbr: 'MDR', name: 'Mid Drive' },
  xoverMidHi: { abbr: 'XV2', name: 'XoverFreq2' },
  hiBandLev: { abbr: 'HBL', name: 'High Level' },
  hiDrive: { abbr: 'HDR', name: 'High Drive' },
  cabinet: { abbr: 'CAB', name: 'Cabinet' },
  outGain: { abbr: 'OPG', name: 'OutputGain' },
};

export const MUL_BND_DIST_TYPE_VALUE_MAP: Record<number, string> = {
  0: 'valve',
  1: 'saturate',
  2: 'tube',
  3: 'postfiltval',
  4: 'postfiltsat',
  5: 'postfilttub',
};

export const MUL_BND_DIST_CABINET_VALUE_MAP: Record<number, string> = {
  0: 'OFF',
  1: 'VTw',
  2: 'VBs',
  3: 'A10',
  4: 'Mid',
  5: 'BFC',
  6: 'B60',
  7: 'V30',
  8: 'S78',
  9: 'Oax',
  10: 'A12',
  11: 'Rck',
};

export const MUL_BND_DIST_VALUE_MAP_BY_KEY: Record<string, Record<number, string>> = {
  distType: MUL_BND_DIST_TYPE_VALUE_MAP,
  cabinet: MUL_BND_DIST_CABINET_VALUE_MAP,
};

export const MUL_BND_DIST_VALUE_BY_KEY: Record<string, import('../decoded-patch-map.js').DecodedValueMeta> = {
  inGain: { units: 'dB', min: -24.0, max: 24.0, modDestination: true },
  distType: {},
  lowBandLev: { units: 'dB', min: -12.0, max: 12.0, modDestination: true },
  lowDrive: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  xoverLowMid: { units: 'Hz', min: 30.0, max: 9000.0, modDestination: true },
  midBandLev: { units: 'dB', min: -12.0, max: 12.0, modDestination: true },
  midDrive: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  xoverMidHi: { units: 'Hz', min: 30.0, max: 9000.0, modDestination: true },
  hiBandLev: { units: 'dB', min: -12.0, max: 12.0, modDestination: true },
  hiDrive: { units: '%', min: 0.0, max: 100.0, modDestination: true },
  cabinet: {},
  outGain: { units: 'dB', min: -12.0, max: 12.0, modDestination: true },
};

export const MUL_BND_DIST_NOTES_BY_KEY: Record<string, string> = {
  inGain: 'Controls the amount of input gain applied to the signal.',
  distType: 'Selects the distortion type: Valve, Saturation, Tube, or the corresponding post-filter variants.',
  lowBandLev: 'Controls the level of the frequencies below XoverFreq1.',
  lowDrive: 'Controls the percentage of distortion introduced below XoverFreq1.',
  xoverLowMid: 'Sets the lower crossover frequency.',
  midBandLev: 'Controls the level of the frequencies between Xover1 Freq and Xover2 Freq.',
  midDrive: 'Controls the percentage of distortion introduced between Xover1 Freq and Xover2 Freq.',
  xoverMidHi: 'Sets the upper crossover frequency.',
  hiBandLev: 'Controls the level of the frequencies above XoverFreq2. The manual row appears to say below XoverFreq2, which is likely a typo.',
  hiDrive: 'Controls the percentage of distortion introduced above XoverFreq2.',
  cabinet: 'Selects the cabinet type: OFF, VTw, VBs, A10, Mid, BFC, B60, V30, S78, Oax, A12, or Rck.',
  outGain: 'Controls the amount of output gain applied to the signal.',
};

export const NOISE_GATE_PARAM_KEYS = [
  'threshold',
  'range',
  'attack',
  'release',
  'hold',
  'punch',
  'mode',
  'power'
] as const;

export const NOISE_GATE_UI_BY_KEY: Record<string, { abbr?: string; name?: string }> = {
  threshold: { abbr: 'THR', name: 'Threshold' },
  range: { abbr: 'RNG', name: 'Range' },
  attack: { abbr: 'ATT', name: 'Attack' },
  release: { abbr: 'REL', name: 'Release' },
  hold: { abbr: 'HLD', name: 'Hold' },
  punch: { abbr: 'PUN', name: 'Punch' },
  mode: { abbr: 'MOD', name: 'Mode' },
  power: { abbr: 'PWR', name: 'Power' },
};

export const NOISE_GATE_MODE_VALUE_MAP: Record<number, string> = {
  0: 'GAT',
  1: 'TRN',
  2: 'DUC',
};

export const NOISE_GATE_POWER_VALUE_MAP: Record<number, string> = {
  0: 'ON',
  1: 'OFF',
};

export const NOISE_GATE_VALUE_MAP_BY_KEY: Record<string, Record<number, string>> = {
  mode: NOISE_GATE_MODE_VALUE_MAP,
  power: NOISE_GATE_POWER_VALUE_MAP,
};

export const NOISE_GATE_VALUE_BY_KEY: Record<string, import('../decoded-patch-map.js').DecodedValueMeta> = {
  threshold: { units: 'dB', min: -50.0, max: 0.0, modDestination: true },
  range: { units: 'dB', min: -100.0, max: 0.0, modDestination: true },
  attack: { units: 'ms', min: 0.0, max: 20.0, modDestination: true },
  release: { units: 'ms', min: 2.0, max: 1999.9, modDestination: true },
  hold: { units: 'ms', min: 2.0, max: 1999.9, modDestination: true },
  punch: { min: -6.0, max: 6.0, modDestination: true },
  mode: {},
  power: {},
};

export const NOISE_GATE_NOTES_BY_KEY: Record<string, string> = {
  threshold: 'Sets the signal level at which the gate opens.',
  range: 'Adjusts the amount of gain reduction applied to the signal below threshold.',
  attack: 'Adjusts the time taken for the gate to open after an over-threshold signal.',
  release: 'Adjusts the time taken for the gate to close after programme material falls back below threshold.',
  hold: 'Defines the waiting period before the gate starts to close.',
  punch: 'Used to increase tonal shaping or reduce gated breathing, delay, or resonant howl-round.',
  mode: 'Selects Gate, Transient Gate, or Ducker processing.',
  power: 'Enables the gate in the signal path. When switched off, the gate is bypassed.',
};

export const ENHANCER_PARAM_KEYS = [
  'outGain',
  'spread',
  'bassGain',
  'bassFreq',
  'midGain',
  'midQ',
  'hiGain',
  'hiFreq',
  'solo',
] as const;

export const ENHANCER_UI_BY_KEY: Record<string, { abbr?: string; name?: string }> = {
  outGain: { abbr: 'OGN', name: 'OutGain' },
  spread: { abbr: 'SPR', name: 'Spread' },
  bassGain: { abbr: 'BGN', name: 'BassGain' },
  bassFreq: { abbr: 'BFR', name: 'BassFreq' },
  midGain: { abbr: 'MGN', name: 'MidGain' },
  midQ: { abbr: 'MIQ', name: 'MidQ' },
  hiGain: { abbr: 'HIG', name: 'HiGain' },
  hiFreq: { abbr: 'HIF', name: 'HiFreq' },
  solo: { abbr: 'SOL', name: 'FactorC' },
};

export const ENHANCER_SOLO_VALUE_MAP: Record<number, string> = { 0: 'OFF', 1: 'ON' };

export const ENHANCER_VALUE_MAP_BY_KEY: Record<string, Record<number, string>> = {
  solo: ENHANCER_SOLO_VALUE_MAP,
};

export const ENHANCER_VALUE_BY_KEY: Record<string, import('../decoded-patch-map.js').DecodedValueMeta> = {
  outGain: { units: 'dB', min: -12.0, max: 12.0, rawMax: 48, modDestination: true },
  spread: { units: '%', min: 0, max: 100, rawMax: 100, modDestination: true },
  bassGain: { units: '%', min: 0, max: 100, rawMax: 50, modDestination: true },
  bassFreq: { min: 1, max: 50, rawMax: 49, modDestination: true },
  midGain: { units: '%', min: 0, max: 100, rawMax: 50, modDestination: true },
  midQ: { min: 1, max: 50, rawMax: 49, modDestination: true },
  hiGain: { units: '%', min: 0, max: 100, rawMax: 50, modDestination: true },
  hiFreq: { min: 1, max: 50, rawMax: 49, modDestination: true },
  solo: {},
};

export const ENHANCER_NOTES_BY_KEY: Record<string, string> = {
  outGain: 'Range −12.0 to 12.0 dB in steps of 0.5 (49 discrete values). Raw 0=−12.0 dB, raw 48=12.0 dB.',
  spread: 'Range 0% to 100% in steps of 1% (101 discrete values). Raw 0=0%, raw 100=100%.',
  bassGain: 'Range 0% to 100% in steps of 2% (51 discrete values). Raw 0=0%, raw 50=100%.',
  bassFreq: 'Range 1.0 to 50.0 in steps of 1 (50 discrete values). Raw 0=1, raw 49=50.',
  midGain: 'Range 0% to 100% in steps of 2% (51 discrete values). Raw 0=0%, raw 50=100%.',
  midQ: 'Range 1.0 to 50.0 in steps of 1 (50 discrete values). Raw 0=1, raw 49=50.',
  hiGain: 'Range 0% to 100% in steps of 2% (51 discrete values). Raw 0=0%, raw 50=100%.',
  hiFreq: 'Range 1.0 to 50.0 in steps of 1 (50 discrete values). Raw 0=1, raw 49=50.',
  solo: 'Solo mode — isolates only the audio resulting from the effect. Not a mod destination.',
};
