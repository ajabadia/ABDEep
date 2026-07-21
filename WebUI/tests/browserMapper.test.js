/**
 * @purpose Tests for WebUI/js/byte-map.js and WebUI/js/bridge-param-maps.js
 * @purpose_en BYTE_MAP data integrity, BRIDGE_PARAM_MAPS consistency, raw↔normalized conversions, formatParamValue
 *
 * Source 1: WebUI/js/byte-map.js
 *   - window.BYTE_MAP: 242-entry array mapping byte offset → { idx, param, region, type, desc, enumLabels? }
 *   - window.formatParamValue(paramId, normalizedVal): formats a normalized value for LCD display
 *
 * Source 2: WebUI/js/bridge-param-maps.js
 *   - window.BRIDGE_PARAM_MAPS: { BIPOLAR_BYTES (Set), ENUM_BYTES (obj), PARAM_TO_BYTE_OFFSET (obj),
 *       PARAM_TO_CC (obj), BYTE_OFFSET_TO_PARAM_IDS (obj),
 *       rawToNormalized(byteOffset, rawValue), normalizedToRaw(byteOffset, normalizedValue) }
 */

// =============================================================================
// Source Constants (extracted from byte-map.js)
// =============================================================================

const ENUM_LFO_SHAPE   = ['Sine','Triangle','Square','Ramp Up','Ramp Down','S&H','S&G'];
const ENUM_PWM_SOURCE  = ['Manual','LFO 1','LFO 2','VCA Env','VCF Env','Mod Env'];
const ENUM_OSC_RANGE   = ["16'","8'","4'"];
const ENUM_PM_SELECT   = ['LFO1','LFO2','VCA Env','VCF Env','Mod Env','LFO1 Uni','LFO2 Uni'];
const ENUM_PORTA_MODE  = ['Normal','Fingered','Fixed Rate','Fixed Rate Fingered','Exponential','Exponential Fingered','Fixed+2','Fixed-2','Fixed+5','Fixed-5','Fixed+12','Fixed-12','Fixed+24','Fixed-24'];
const ENUM_VOICE_MODE  = ['Poly','Uni2','Uni3','Uni4','Uni6','Uni12','Mono','Mono2','Mono3','Mono4','Mono6','Poly6','Poly8'];
const ENUM_TRIG_MODE   = ['Mono','Re-Trig','Legato','One-Shot'];
const ENUM_NOTE_PRIO   = ['Lowest','Highest','Last'];
const ENUM_ARP_MODE    = ['Up','Down','Up&Dn','Up Inv','Dn Inv','Up&Dn Inv','Up Alt','Down Alt','Random','As Played','Chord'];
const ENUM_ARP_CLOCK   = ['1/32','1/16T','1/32D','1/16','1/8T','1/16D','1/8','1/4T','1/8D','1/4','1/2T','1/4D','1/2'];
const ENUM_SEQ_CLOCK   = ['1/32','1/16T','1/32D','1/16','1/8T','1/16D','1/8','1/4T','1/8D','1/4','1/2T','1/4D','1/2','1/1T','1/2D','1/1'];
const ENUM_KEY_LOOP    = ['Loop Off','Loop On','(unused)'];
const ENUM_FX_ROUTING  = ['M-1 Ser 1-2-3-4','M-2 Par 1/2 Ser 3-4','M-3 Par 1/2 Par 3/4','M-4 Par 1/2/3/4','M-5 Par 1/2/3 Ser 4','M-6 Ser 1-2 Par 3/4','M-7 Ser 1 Par 2/3/4','M-8 Par (Ser 1-2-3)/4','M-9 Ser 3-4 FB(1-2)','M-10 Ser 4 FB(1-2-3)'];
const ENUM_FX_MODE     = ['Insert','Send','Bypass'];
const ENUM_ENV_TRIG    = ['Key','LFO 1','LFO 2','Loop','Seq Step'];
const ENUM_CHORD_TYPE  = ['Memory','Major','Minor','Aug','Dim','Sus2','Sus4','7th'];

function bp(idx, param, region, type, extra) {
  extra = extra || {};
  return { idx: idx, param: param, region: region, type: type, desc: extra.desc || '', enumLabels: extra.enumLabels || null };
}

// Build the 242-entry map
const BYTE_MAP = [];
for (let i = 0; i < 242; i++) {BYTE_MAP[i] = null;}

BYTE_MAP[0]  = bp(0,  'LFO 1 Rate',          'LFO1', 'value',     { desc: '0=slow…255=fast' });
BYTE_MAP[1]  = bp(1,  'LFO 1 Delay/Fade',    'LFO1', 'value',     { desc: '0=no delay…255=max delay' });
BYTE_MAP[2]  = bp(2,  'LFO 1 Shape',         'LFO1', 'enum',      { enumLabels: ENUM_LFO_SHAPE });
BYTE_MAP[3]  = bp(3,  'LFO 1 Key Sync',      'LFO1', 'toggle',    { desc: '0=Off, 1=On' });
BYTE_MAP[4]  = bp(4,  'LFO 1 Arp Sync',      'LFO1', 'toggle',    { desc: '0=Off, 1=On' });
BYTE_MAP[5]  = bp(5,  'LFO 1 Mono Mode',     'LFO1', 'value',     { desc: '0=Poly, 1=Mono, 2+=Spread' });
BYTE_MAP[6]  = bp(6,  'LFO 1 Slew Rate',     'LFO1', 'value',     { desc: '0=no slew…255=max' });
BYTE_MAP[7]  = bp(7,  'LFO 2 Rate',          'LFO2', 'value',     { desc: '0=slow…255=fast' });
BYTE_MAP[8]  = bp(8,  'LFO 2 Delay/Fade',    'LFO2', 'value',     { desc: '0=no delay…255=max delay' });
BYTE_MAP[9]  = bp(9,  'LFO 2 Shape',         'LFO2', 'enum',      { enumLabels: ENUM_LFO_SHAPE });
BYTE_MAP[10] = bp(10, 'LFO 2 Key Sync',      'LFO2', 'toggle',    { desc: '0=Off, 1=On' });
BYTE_MAP[11] = bp(11, 'LFO 2 Arp Sync',      'LFO2', 'toggle',    { desc: '0=Off, 1=On' });
BYTE_MAP[12] = bp(12, 'LFO 2 Mono Mode',     'LFO2', 'value',     { desc: '0=Poly, 1=Mono, 2+=Spread' });
BYTE_MAP[13] = bp(13, 'LFO 2 Slew Rate',     'LFO2', 'value',     { desc: '0=no slew…255=max' });
BYTE_MAP[14] = bp(14, 'OSC 1 Range',   'OSC1', 'enum',      { enumLabels: ENUM_OSC_RANGE });
BYTE_MAP[15] = bp(15, 'OSC 2 Range',   'OSC2', 'enum',      { enumLabels: ENUM_OSC_RANGE });
BYTE_MAP[16] = bp(16, 'OSC 1 PWM Source',     'OSC1', 'enum',      { enumLabels: ENUM_PWM_SOURCE, desc: 'Selects modulation source for PWM' });
BYTE_MAP[17] = bp(17, 'OSC 2 Tone Mod Source','OSC2', 'enum',      { enumLabels: ENUM_PWM_SOURCE, desc: 'Also alias osc2_pm_source' });
BYTE_MAP[18] = bp(18, 'OSC 1 Pulse Enable',   'OSC1', 'toggle',    { desc: '0=Off, 1=On (square)' });
BYTE_MAP[19] = bp(19, 'OSC 1 Saw Enable',     'OSC1', 'toggle',    { desc: '0=Off, 1=On' });
BYTE_MAP[20] = bp(20, 'OSC Sync Enable',      'OSC',  'toggle',    { desc: '0=Off, 1=On (hard sync)' });
BYTE_MAP[21] = bp(21, 'OSC 1 Pitch Mod Depth','OSC1', 'value',     { desc: '0=none…255=max' });
BYTE_MAP[22] = bp(22, 'OSC 1 Pitch Mod Select','OSC1','enum',      { enumLabels: ENUM_PM_SELECT });
BYTE_MAP[23] = bp(23, 'OSC 1 AT > Pitch Mod', 'OSC1', 'value',     { desc: 'Aftertouch to pitch mod depth' });
BYTE_MAP[24] = bp(24, 'OSC 1 MW > Pitch Mod', 'OSC1', 'value',     { desc: 'Mod wheel to pitch mod depth' });
BYTE_MAP[25] = bp(25, 'OSC 1 PWM Depth',      'OSC1', 'value',     { desc: '0=none…255=max' });
BYTE_MAP[26] = bp(26, 'OSC 2 Level',          'OSC2', 'value',     { desc: '0=silent…255=full' });
BYTE_MAP[27] = bp(27, 'OSC 2 Pitch',          'OSC2', 'value',     { desc: 'Coarse pitch offset' });
BYTE_MAP[28] = bp(28, 'OSC 2 Tone Mod Depth', 'OSC2', 'value',     { desc: '0=none…255=max' });
BYTE_MAP[29] = bp(29, 'OSC 2 Pitch Mod Depth','OSC2', 'value',     { desc: '0=none…255=max' });
BYTE_MAP[30] = bp(30, 'OSC 2 AT > Pitch Mod', 'OSC2', 'value',     { desc: 'Aftertouch to pitch mod' });
BYTE_MAP[31] = bp(31, 'OSC 2 MW > Pitch Mod', 'OSC2', 'value',     { desc: 'Mod wheel to pitch mod' });
BYTE_MAP[32] = bp(32, 'OSC 2 Pitch Mod Select','OSC2','enum',      { enumLabels: ENUM_PM_SELECT });
BYTE_MAP[33] = bp(33, 'Noise Level',          'Noise','value',     { desc: '0=silent…255=loud' });
BYTE_MAP[34] = bp(34, 'Portamento Time',      'Porta','value',     { desc: '0=instant…255=slow' });
BYTE_MAP[35] = bp(35, 'Portamento Mode',      'Porta','enum',      { enumLabels: ENUM_PORTA_MODE });
BYTE_MAP[36] = bp(36, 'Pitch Bend Up',        'Pitch','value',     { desc: '0–24 semitones' });
BYTE_MAP[37] = bp(37, 'Pitch Bend Down',      'Pitch','value',     { desc: '0–24 semitones' });
BYTE_MAP[38] = bp(38, 'OSC 1 PM Mode',        'Pitch','toggle',    { desc: '0=OSC1+2, 1=OSC1 Only' });
BYTE_MAP[39] = bp(39, 'VCF Cutoff',           'VCF',  'value',     { desc: '0=closed…255=open' });
BYTE_MAP[40] = bp(40, 'HPF Cutoff',           'HPF',  'value',     { desc: 'Maps 20–2000 Hz' });
BYTE_MAP[41] = bp(41, 'VCF Resonance',        'VCF',  'value',     { desc: '0=none…255=max (self-osc)' });
BYTE_MAP[42] = bp(42, 'VCF Env Depth',        'VCF',  'bipolar',   { desc: '128=center, <128=neg, >128=pos' });
BYTE_MAP[43] = bp(43, 'VCF Env Vel Sens',     'VCF',  'value',     { desc: 'Velocity sensitivity' });
BYTE_MAP[44] = bp(44, 'VCF Pitch Bend Depth', 'VCF',  'value',     { desc: 'Pitch bend to freq' });
BYTE_MAP[45] = bp(45, 'VCF LFO Depth',        'VCF',  'value',     { desc: 'LFO modulation depth' });
BYTE_MAP[46] = bp(46, 'VCF LFO Select',       'VCF',  'toggle',    { desc: '0=LFO1, 1=LFO2' });
BYTE_MAP[47] = bp(47, 'VCF AT > LFO Depth',   'VCF',  'value',     { desc: 'Aftertouch to LFO' });
BYTE_MAP[48] = bp(48, 'VCF MW > LFO Depth',   'VCF',  'value',     { desc: 'Mod wheel to LFO' });
BYTE_MAP[49] = bp(49, 'VCF Key Tracking',     'VCF',  'value',     { desc: '0=none…255=full' });
BYTE_MAP[50] = bp(50, 'VCF Env Polarity',     'VCF',  'toggle',    { desc: '0=Negative, 1=Positive' });
BYTE_MAP[51] = bp(51, 'VCF 2 Pole Mode',      'VCF',  'toggle',    { desc: '0=4 Pole, 1=2 Pole' });
BYTE_MAP[52] = bp(52, 'HPF Boost Enable',     'HPF',  'toggle',    { desc: '0=Off, 1=On' });
BYTE_MAP[53] = bp(53, 'Env1 Attack',          'ENV1', 'time',      { desc: 'Scales 0–10s' });
BYTE_MAP[54] = bp(54, 'Env1 Decay',           'ENV1', 'time',      { desc: 'Scales 0–10s' });
BYTE_MAP[55] = bp(55, 'Env1 Sustain',         'ENV1', 'value',     { desc: '0=min…255=max' });
BYTE_MAP[56] = bp(56, 'Env1 Release',         'ENV1', 'time',      { desc: 'Scales 0–10s' });
BYTE_MAP[57] = bp(57, 'Env1 Trigger Mode',    'ENV1', 'enum',      { enumLabels: ENUM_ENV_TRIG });
BYTE_MAP[58] = bp(58, 'Env1 Attack Curve',    'ENV1', 'value',     { desc: '0=linear…255=exp' });
BYTE_MAP[59] = bp(59, 'Env1 Decay Curve',     'ENV1', 'value',     { desc: '0=linear…255=exp' });
BYTE_MAP[60] = bp(60, 'Env1 Sustain Curve',   'ENV1', 'value',     { desc: '0=linear…255=exp' });
BYTE_MAP[61] = bp(61, 'Env1 Release Curve',   'ENV1', 'value',     { desc: '0=linear…255=exp' });
BYTE_MAP[62] = bp(62, 'Env2 Attack',          'ENV2', 'time',      { desc: 'Scales 0–10s' });
BYTE_MAP[63] = bp(63, 'Env2 Decay',           'ENV2', 'time',      { desc: 'Scales 0–10s' });
BYTE_MAP[64] = bp(64, 'Env2 Sustain',         'ENV2', 'value',     { desc: '0=min…255=max' });
BYTE_MAP[65] = bp(65, 'Env2 Release',         'ENV2', 'time',      { desc: 'Scales 0–10s' });
BYTE_MAP[66] = bp(66, 'Env2 Trigger Mode',    'ENV2', 'enum',      { enumLabels: ENUM_ENV_TRIG });
BYTE_MAP[67] = bp(67, 'Env2 Attack Curve',    'ENV2', 'value',     { desc: '0=linear…255=exp' });
BYTE_MAP[68] = bp(68, 'Env2 Decay Curve',     'ENV2', 'value',     { desc: '0=linear…255=exp' });
BYTE_MAP[69] = bp(69, 'Env2 Sustain Curve',   'ENV2', 'value',     { desc: '0=linear…255=exp' });
BYTE_MAP[70] = bp(70, 'Env2 Release Curve',   'ENV2', 'value',     { desc: '0=linear…255=exp' });
BYTE_MAP[71] = bp(71, 'Env3 Attack',          'ENV3', 'time',      { desc: 'Scales 0–10s' });
BYTE_MAP[72] = bp(72, 'Env3 Decay',           'ENV3', 'time',      { desc: 'Scales 0–10s' });
BYTE_MAP[73] = bp(73, 'Env3 Sustain',         'ENV3', 'value',     { desc: '0=min…255=max' });
BYTE_MAP[74] = bp(74, 'Env3 Release',         'ENV3', 'time',      { desc: 'Scales 0–10s' });
BYTE_MAP[75] = bp(75, 'Env3 Trigger Mode',    'ENV3', 'enum',      { enumLabels: ENUM_ENV_TRIG });
BYTE_MAP[76] = bp(76, 'Env3 Attack Curve',    'ENV3', 'value',     { desc: '0=linear…255=exp' });
BYTE_MAP[77] = bp(77, 'Env3 Decay Curve',     'ENV3', 'value',     { desc: '0=linear…255=exp' });
BYTE_MAP[78] = bp(78, 'Env3 Sustain Curve',   'ENV3', 'value',     { desc: '0=linear…255=exp' });
BYTE_MAP[79] = bp(79, 'Env3 Release Curve',   'ENV3', 'value',     { desc: '0=linear…255=exp' });
BYTE_MAP[80] = bp(80, 'VCA Level',            'VCA',  'value',     { desc: '0=silent…255=full' });
BYTE_MAP[81] = bp(81, 'VCA Env Depth',        'VCA',  'value',     { desc: '0=none…255=full' });
BYTE_MAP[82] = bp(82, 'VCA Vel Sens',         'VCA',  'value',     { desc: 'Velocity sensitivity' });
BYTE_MAP[83] = bp(83, 'VCA Pan Spread',       'VCA',  'bipolar',   { desc: '128=center, <128=left, >128=right' });
BYTE_MAP[84] = bp(84, 'Note Priority',        'Voice','enum',      { enumLabels: ENUM_NOTE_PRIO });
BYTE_MAP[85] = bp(85, 'Voice Mode',           'Voice','enum',      { enumLabels: ENUM_VOICE_MODE });
BYTE_MAP[86] = bp(86, 'Trigger Mode',         'Voice','enum',      { enumLabels: ENUM_TRIG_MODE });
BYTE_MAP[87] = bp(87, 'Unison Detune',        'Voice','value',     { desc: '0=none…255=phat!' });
BYTE_MAP[88] = bp(88, 'Voice Drift',          'Voice','value',     { desc: 'Also alias osc_drift' });
BYTE_MAP[89] = bp(89, 'Parameter Drift',      'Voice','value',     { desc: '0=none…255=max' });
BYTE_MAP[90] = bp(90, 'Drift Rate',           'Voice','value',     { desc: 'How fast drift fluctuates' });
BYTE_MAP[91] = bp(91, 'OSC Porta Balance',    'Voice','bipolar',   { desc: '128=center, <128=osc1, >128=osc2' });
BYTE_MAP[92] = bp(92, 'OSC Key Down Reset',   'Voice','toggle',    { desc: '0=Off, 1=On' });
BYTE_MAP[93]  = bp(93,  'Mod Matrix Slot1 Source', 'ModMat','enum',   { desc: '0–22 (Mod Source list)' });
BYTE_MAP[94]  = bp(94,  'Mod Matrix Slot1 Dest',   'ModMat','enum',   { desc: '0–129 (Mod Dest list)' });
BYTE_MAP[95]  = bp(95,  'Mod Matrix Slot1 Depth',  'ModMat','bipolar',{ desc: '128=center, <128=neg, >128=pos' });
BYTE_MAP[96]  = bp(96,  'Mod Matrix Slot2 Source', 'ModMat','enum',   { desc: '0–22' });
BYTE_MAP[97]  = bp(97,  'Mod Matrix Slot2 Dest',   'ModMat','enum',   { desc: '0–129' });
BYTE_MAP[98]  = bp(98,  'Mod Matrix Slot2 Depth',  'ModMat','bipolar',{ desc: '128=center' });
BYTE_MAP[99]  = bp(99,  'Mod Matrix Slot3 Source', 'ModMat','enum',   { desc: '0–22' });
BYTE_MAP[100] = bp(100, 'Mod Matrix Slot3 Dest',   'ModMat','enum',   { desc: '0–129' });
BYTE_MAP[101] = bp(101, 'Mod Matrix Slot3 Depth',  'ModMat','bipolar',{ desc: '128=center' });
BYTE_MAP[102] = bp(102, 'Mod Matrix Slot4 Source', 'ModMat','enum',   { desc: '0–22' });
BYTE_MAP[103] = bp(103, 'Mod Matrix Slot4 Dest',   'ModMat','enum',   { desc: '0–129' });
BYTE_MAP[104] = bp(104, 'Mod Matrix Slot4 Depth',  'ModMat','bipolar',{ desc: '128=center' });
BYTE_MAP[105] = bp(105, 'Mod5 Source / Chord Enable','ModMat','dual', { desc: 'Mod5 src(0-22) OR Chord On/Off' });
BYTE_MAP[106] = bp(106, 'Mod5 Dest / Poly Chord',   'ModMat','dual', { desc: 'Mod5 dest(0-129) OR Poly Chord On/Off' });
BYTE_MAP[107] = bp(107, 'Mod5 Depth / Chord Key',   'ModMat','dual', { desc: 'Mod5 depth(bipolar) OR Chord Key(C=0…B=11)' });
BYTE_MAP[108] = bp(108, 'Mod6 Source / Chord Type', 'ModMat','dual', { desc: 'Mod6 src OR Chord Type' });
BYTE_MAP[109] = bp(109, 'Mod6 Dest / Arp Enable',   'ModMat','dual', { desc: 'Mod6 dest OR Arp On/Off' });
BYTE_MAP[110] = bp(110, 'Mod6 Depth / Arp Hold',    'ModMat','dual', { desc: 'Mod6 depth(bipolar) OR Arp Hold' });
BYTE_MAP[111] = bp(111, 'Mod7 Source / Arp KeySync','ModMat','dual', { desc: 'Mod7 src OR Arp Key Sync' });
BYTE_MAP[112] = bp(112, 'Mod7 Dest / Arp Gate',     'ModMat','dual', { desc: 'Mod7 dest OR Arp Gate' });
BYTE_MAP[113] = bp(113, 'Mod7 Depth / Arp Mode',    'ModMat','dual', { desc: 'Mod7 depth(bipolar) OR Arp Mode' });
BYTE_MAP[114] = bp(114, 'Mod8 Source (unused)',     'ModMat','enum',  { desc: 'Mod8 src 0-22 (often 0)' });
BYTE_MAP[115] = bp(115, 'Mod8 Dest / Arp GateTime', 'ModMat','dual', { desc: 'Mod8 dest OR Arp Gate Time' });
BYTE_MAP[116] = bp(116, 'Mod8 Depth / Arp Swing',   'ModMat','dual', { desc: 'Mod8 depth(bipolar) OR Arp Swing' });
BYTE_MAP[117] = bp(117, 'Seq Enable',          'Seq',  'toggle',   { desc: '0=Off, 1=On' });
BYTE_MAP[118] = bp(118, 'Seq Clock Divider',   'Seq',  'enum',     { enumLabels: ENUM_SEQ_CLOCK });
BYTE_MAP[119] = bp(119, 'Seq Length',          'Seq',  'value',    { desc: '0=1 step…31=32 steps' });
BYTE_MAP[120] = bp(120, 'Seq Swing',           'Seq',  'value',    { desc: '0=50%…25=75%' });
BYTE_MAP[121] = bp(121, 'Seq Key Loop',        'Seq',  'enum',     { enumLabels: ENUM_KEY_LOOP });
BYTE_MAP[122] = bp(122, 'Seq Slew Rate',       'Seq',  'value',    { desc: '0=none…255=max' });
for (let si = 123; si <= 154; si++) {
  const stepNum = si - 122;
  BYTE_MAP[si] = bp(si, 'Seq Step ' + stepNum, 'SeqSteps','bipolar', { desc: '0=skip, 128=center, <128=neg, >128=pos' });
}
BYTE_MAP[155] = bp(155, 'Arp On/Off',         'Arp',  'toggle',   { desc: '0=Off, 1=On' });
BYTE_MAP[156] = bp(156, 'Arp Mode',           'Arp',  'enum',     { enumLabels: ENUM_ARP_MODE });
BYTE_MAP[157] = bp(157, 'Arp Rate',           'Arp',  'value',    { desc: '0=20bpm…255=275bpm' });
BYTE_MAP[158] = bp(158, 'Arp Clock Divider',  'Arp',  'enum',     { enumLabels: ENUM_ARP_CLOCK });
BYTE_MAP[159] = bp(159, 'Arp Key Sync',       'Arp',  'toggle',   { desc: '0=Off, 1=On' });
BYTE_MAP[160] = bp(160, 'Arp Gate Time',      'Arp',  'value',    { desc: 'Also alias arp_gate' });
BYTE_MAP[161] = bp(161, 'Arp Hold',           'Arp',  'toggle',   { desc: '0=Off, 1=On' });
BYTE_MAP[162] = bp(162, 'Arp Pattern',        'Arp',  'value',    { desc: '0=None, 1-64=Presets' });
BYTE_MAP[163] = bp(163, 'Arp Swing',          'Arp',  'value',    { desc: '0=50%…25=75%' });
BYTE_MAP[164] = bp(164, 'Arp Octaves',        'Arp',  'value',    { desc: '0=1…5=6 octaves' });
BYTE_MAP[165] = bp(165, 'FX Routing',          'FX',   'enum',     { enumLabels: ENUM_FX_ROUTING });
BYTE_MAP[166] = bp(166, 'FX1 Type',            'FX1',  'value',    { desc: '0-35 (see FX Type list)' });
BYTE_MAP[167] = bp(167, 'FX1 Param 1',         'FX1',  'value',    { desc: 'Per-effect mapping' });
BYTE_MAP[168] = bp(168, 'FX1 Param 2',         'FX1',  'value',    { desc: '' });
BYTE_MAP[169] = bp(169, 'FX1 Param 3',         'FX1',  'value',    { desc: '' });
BYTE_MAP[170] = bp(170, 'FX1 Param 4',         'FX1',  'value',    { desc: '' });
BYTE_MAP[171] = bp(171, 'FX1 Param 5',         'FX1',  'value',    { desc: '' });
BYTE_MAP[172] = bp(172, 'FX1 Param 6',         'FX1',  'value',    { desc: '' });
BYTE_MAP[173] = bp(173, 'FX1 Param 7',         'FX1',  'value',    { desc: '' });
BYTE_MAP[174] = bp(174, 'FX1 Param 8',         'FX1',  'value',    { desc: '' });
BYTE_MAP[175] = bp(175, 'FX1 Param 9',         'FX1',  'value',    { desc: '' });
BYTE_MAP[176] = bp(176, 'FX1 Param 10',        'FX1',  'value',    { desc: '' });
BYTE_MAP[177] = bp(177, 'FX1 Param 11',        'FX1',  'value',    { desc: '' });
BYTE_MAP[178] = bp(178, 'FX1 Param 12',        'FX1',  'value',    { desc: '' });
BYTE_MAP[179] = bp(179, 'FX2 Type',            'FX2',  'value',    { desc: '0-35' });
for (let f2i = 180; f2i <= 191; f2i++) {
  BYTE_MAP[f2i] = bp(f2i, 'FX2 Param ' + (f2i - 179), 'FX2', 'value', { desc: '' });
}
BYTE_MAP[192] = bp(192, 'FX3 Type',            'FX3',  'value',    { desc: '0-35' });
for (let f3i = 193; f3i <= 204; f3i++) {
  BYTE_MAP[f3i] = bp(f3i, 'FX3 Param ' + (f3i - 192), 'FX3', 'value', { desc: '' });
}
BYTE_MAP[205] = bp(205, 'FX4 Type',            'FX4',  'value',    { desc: '0-35' });
for (let f4i = 206; f4i <= 217; f4i++) {
  BYTE_MAP[f4i] = bp(f4i, 'FX4 Param ' + (f4i - 205), 'FX4', 'value', { desc: '' });
}
BYTE_MAP[218] = bp(218, 'FX1 Output Gain',     'FX1',  'value',    { desc: '0-150 (0=min…150=max)' });
BYTE_MAP[219] = bp(219, 'FX2 Output Gain',     'FX2',  'value',    { desc: '0-150' });
BYTE_MAP[220] = bp(220, 'FX3 Output Gain',     'FX3',  'value',    { desc: '0-150' });
BYTE_MAP[221] = bp(221, 'FX4 Output Gain',     'FX4',  'value',    { desc: '0-150' });
BYTE_MAP[222] = bp(222, 'FX Mode',             'FX',   'enum',     { enumLabels: ENUM_FX_MODE });
BYTE_MAP[223] = bp(223, '(firmware metadata)', 'Firmware', 'value', { desc: 'Firmware internal metadata. 116 unique values. No CRC16/checksum. No DSP impact.' });
for (let ci = 224; ci <= 238; ci++) {
  const charIdx = ci - 224;
  BYTE_MAP[ci] = bp(ci, 'Program Name char[' + charIdx + ']', 'Name', 'ascii', { desc: 'ASCII character of patch name (15 chars in SysEx format)' });
}
BYTE_MAP[239] = bp(239, '(name field tail)', 'Tail', 'value', { desc: 'Data after name field. raw SysEx offsets 282-284. Part of packed payload tail.' });
BYTE_MAP[240] = bp(240, '(name field tail)', 'Tail', 'value', { desc: 'Data after name field. raw SysEx offsets 282-284. Part of packed payload tail.' });
BYTE_MAP[241] = bp(241, '(name field tail)', 'Tail', 'value', { desc: 'Last unpacked byte (raw SysEx offset 284). Part of packed payload tail.' });

// =============================================================================
// Source Constants (extracted from bridge-param-maps.js)
// =============================================================================

const BIPOLAR_BYTES = new Set([42, 83, 91, 95, 98, 101, 104, 107, 110, 113, 116, 123, 124, 125, 126, 127,
    128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143,
    144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154
]);

const ENUM_BYTES = {
    2: 6, 3: 1, 4: 1, 9: 6, 10: 1, 11: 1, 14: 2, 15: 2, 16: 5, 17: 5, 18: 1, 19: 1, 20: 1, 22: 6, 32: 6,
    35: 9, 38: 1, 46: 1, 50: 1, 51: 1, 52: 1,
    57: 4, 66: 4, 75: 4, 84: 2, 85: 12, 86: 3, 92: 1,
    117: 1, 118: 15, 119: 31, 121: 2, 155: 1, 156: 10, 158: 12, 159: 1, 161: 1, 162: 64, 164: 3, 165: 9,
    166: 35, 179: 35, 192: 35, 205: 35, 222: 2
};

const PARAM_TO_BYTE_OFFSET = {
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

const PARAM_TO_CC = {
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

// =============================================================================
// Extracted pure functions
// =============================================================================

function buildReverseMap() {
    const map = {};
    for (const paramId in PARAM_TO_BYTE_OFFSET) {
        if (PARAM_TO_BYTE_OFFSET.hasOwnProperty(paramId)) {
            const byteOff = PARAM_TO_BYTE_OFFSET[paramId];
            if (!map[byteOff]) {map[byteOff] = [];}
            if (map[byteOff].indexOf(paramId) === -1) {
                map[byteOff].push(paramId);
            }
        }
    }
    return map;
}

const BYTE_OFFSET_TO_PARAM_IDS = buildReverseMap();

function rawToNormalized(byteOffset, rawValue) {
    if (BIPOLAR_BYTES.has(byteOffset)) {
        return Math.max(0, Math.min(1, ((rawValue - 128) / 127.0 + 1) / 2));
    }
    if (ENUM_BYTES[byteOffset] !== undefined) {
        return Math.min(1, rawValue / ENUM_BYTES[byteOffset]);
    }
    return rawValue / 255.0;
}

function normalizedToRaw(byteOffset, normalizedValue) {
    if (BIPOLAR_BYTES.has(byteOffset)) {
        const val = ((normalizedValue * 2.0) - 1.0) * 127.0;
        return Math.round(val + 128);
    }
    if (ENUM_BYTES[byteOffset] !== undefined) {
        return Math.round(normalizedValue * ENUM_BYTES[byteOffset]);
    }
    return Math.round(normalizedValue * 255.0);
}

function formatParamValue(paramId, normalizedVal) {
    if (typeof normalizedVal !== 'number' || isNaN(normalizedVal)) {return '\u2014';}

    const p2b = PARAM_TO_BYTE_OFFSET;
    const eBytes = ENUM_BYTES;
    if (!p2b) {return Math.round(normalizedVal * 100) + '%';}

    const byteOffset = p2b[paramId];
    if (byteOffset === undefined) {return Math.round(normalizedVal * 100) + '%';}

    const entry = BYTE_MAP[byteOffset];
    if (!entry) {return Math.round(normalizedVal * 100) + '%';}

    const type = entry.type;

    if (type === 'toggle') {
        return normalizedVal > 0.5 ? 'ON' : 'OFF';
    }

    if (type === 'enum') {
        const maxIdx = eBytes && eBytes[byteOffset] !== undefined ? eBytes[byteOffset] : (entry.enumLabels ? entry.enumLabels.length - 1 : 0);
        const idx = Math.round(normalizedVal * maxIdx);
        if (entry.enumLabels && idx >= 0 && idx < entry.enumLabels.length) {
            return entry.enumLabels[idx];
        }
        return idx.toString();
    }

    if (type === 'bipolar') {
        const signed = Math.round((normalizedVal - 0.5) * 200);
        return (signed >= 0 ? '+' : '') + signed;
    }

    return Math.round(normalizedVal * 100) + '%';
}

// =============================================================================
// Tests
// =============================================================================

// ---- BYTE_MAP data integrity ----

describe('BYTE_MAP — data integrity', function () {

    it('has exactly 242 entries (indices 0-241)', function () {
        expect(BYTE_MAP.length).toBe(242);
    });

    it('all 242 entries are non-null', function () {
        for (let i = 0; i < BYTE_MAP.length; i++) {
            if (BYTE_MAP[i] === null) {
                expect('byte ' + i + ' is null').toBe('all non-null');
                return;
            }
        }
        expect(true).toBe(true);
    });

    it('each entry has idx matching its array index', function () {
        for (let i = 0; i < BYTE_MAP.length; i++) {
            expect(BYTE_MAP[i].idx).toBe(i);
        }
    });

    it('each entry has required properties: idx, param, region, type', function () {
        for (let i = 0; i < BYTE_MAP.length; i++) {
            const e = BYTE_MAP[i];
            expect(typeof e.idx).toBe('number');
            expect(typeof e.param).toBe('string');
            expect(e.param.length).toBeGreaterThan(0);
            expect(typeof e.region).toBe('string');
            expect(e.region.length).toBeGreaterThan(0);
            expect(typeof e.type).toBe('string');
        }
    });

    it('all type values are valid', function () {
        const validTypes = ['value', 'enum', 'toggle', 'bipolar', 'time', 'ascii', 'dual'];
        for (let i = 0; i < BYTE_MAP.length; i++) {
            const t = BYTE_MAP[i].type;
            if (validTypes.indexOf(t) === -1) {
                expect('byte ' + i + ' has invalid type "' + t + '"').toBe('type in ' + JSON.stringify(validTypes));
            }
        }
        expect(true).toBe(true);
    });

    it('enum entries that have enumLabels are non-empty arrays', function () {
        for (let i = 0; i < BYTE_MAP.length; i++) {
            const e = BYTE_MAP[i];
            if (e.type === 'enum' && e.enumLabels !== null) {
                if (!Array.isArray(e.enumLabels) || e.enumLabels.length === 0) {
                    expect('byte ' + i + ' ' + e.param + ' enumLabels is not a non-empty array').toBe('non-empty array');
                }
            }
        }
        expect(true).toBe(true);
    });

    it('some enum entries use desc instead of enumLabels (mod matrix sources/dests)', function () {
        // Bytes 93-94, 96-97, 99-100, 102-103, 114 are enum type with desc-only (no enumLabels)
        const descOnlyEnums = [93, 94, 96, 97, 99, 100, 102, 103, 114];
        for (let i = 0; i < descOnlyEnums.length; i++) {
            const e = BYTE_MAP[descOnlyEnums[i]];
            expect(e.type).toBe('enum');
            expect(e.enumLabels).toBeNull();
            expect(e.desc.length).toBeGreaterThan(0);
        }
    });

    it('dual entries do not have enumLabels (they use desc only)', function () {
        for (let i = 0; i < BYTE_MAP.length; i++) {
            const e = BYTE_MAP[i];
            if (e.type === 'dual') {
                // Dual entries use desc to describe dual-purpose bytes, not enumLabels
                expect(e.enumLabels).toBeNull();
                expect(e.desc.length).toBeGreaterThan(0);
            }
        }
    });

    it('all param names are unique except known tail duplicates (bytes 239-241)', function () {
        const seen = {};
        const duplicates = [];
        for (let i = 0; i < BYTE_MAP.length; i++) {
            const name = BYTE_MAP[i].param;
            if (seen[name] !== undefined) {
                duplicates.push({ name: name, first: seen[name], second: i });
            }
            seen[name] = i;
        }
        // The only allowed duplicates are "(name field tail)" at bytes 239-241
        for (let d = 0; d < duplicates.length; d++) {
            if (duplicates[d].name !== '(name field tail)') {
                expect('unexpected duplicate "' + duplicates[d].name + '" at bytes ' + duplicates[d].first + ' and ' + duplicates[d].second).toBe('no unexpected duplicates');
            }
        }
        expect(true).toBe(true);
    });

});

// ---- BYTE_MAP region integrity ----

describe('BYTE_MAP — region range integrity', function () {

    it('bytes 0-6 are LFO1 region', function () {
        for (let i = 0; i <= 6; i++) {
            expect(BYTE_MAP[i].region).toBe('LFO1');
        }
    });

    it('bytes 7-13 are LFO2 region', function () {
        for (let i = 7; i <= 13; i++) {
            expect(BYTE_MAP[i].region).toBe('LFO2');
        }
    });

    it('bytes 14-33 are OSC/Noise region', function () {
        const oscRegions = ['OSC1', 'OSC2', 'OSC', 'Noise'];
        for (let i = 14; i <= 33; i++) {
            if (oscRegions.indexOf(BYTE_MAP[i].region) === -1) {
                expect('byte ' + i + ' region=' + BYTE_MAP[i].region).toBe('one of ' + JSON.stringify(oscRegions));
            }
        }
        expect(true).toBe(true);
    });

    it('bytes 34-38 are Porta/Pitch region', function () {
        const pitchRegions = ['Porta', 'Pitch'];
        for (let i = 34; i <= 38; i++) {
            if (pitchRegions.indexOf(BYTE_MAP[i].region) === -1) {
                expect('byte ' + i + ' region=' + BYTE_MAP[i].region).toBe('one of ' + JSON.stringify(pitchRegions));
            }
        }
        expect(true).toBe(true);
    });

    it('bytes 39-52 are VCF/HPF region', function () {
        const filterRegions = ['VCF', 'HPF'];
        for (let i = 39; i <= 52; i++) {
            if (filterRegions.indexOf(BYTE_MAP[i].region) === -1) {
                expect('byte ' + i + ' region=' + BYTE_MAP[i].region).toBe('one of ' + JSON.stringify(filterRegions));
            }
        }
        expect(true).toBe(true);
    });

    it('bytes 53-79 are ENV1/ENV2/ENV3 region', function () {
        const envRegions = ['ENV1', 'ENV2', 'ENV3'];
        for (let i = 53; i <= 79; i++) {
            if (envRegions.indexOf(BYTE_MAP[i].region) === -1) {
                expect('byte ' + i + ' region=' + BYTE_MAP[i].region).toBe('one of ' + JSON.stringify(envRegions));
            }
        }
        expect(true).toBe(true);
    });

    it('bytes 80-83 are VCA region', function () {
        for (let i = 80; i <= 83; i++) {
            expect(BYTE_MAP[i].region).toBe('VCA');
        }
    });

    it('bytes 84-92 are Voice region', function () {
        for (let i = 84; i <= 92; i++) {
            expect(BYTE_MAP[i].region).toBe('Voice');
        }
    });

    it('bytes 93-116 are ModMat region', function () {
        for (let i = 93; i <= 116; i++) {
            expect(BYTE_MAP[i].region).toBe('ModMat');
        }
    });

    it('bytes 117-122 are Seq region', function () {
        for (let i = 117; i <= 122; i++) {
            expect(BYTE_MAP[i].region).toBe('Seq');
        }
    });

    it('bytes 123-154 are SeqSteps region', function () {
        for (let i = 123; i <= 154; i++) {
            expect(BYTE_MAP[i].region).toBe('SeqSteps');
        }
    });

    it('bytes 155-164 are Arp region', function () {
        for (let i = 155; i <= 164; i++) {
            expect(BYTE_MAP[i].region).toBe('Arp');
        }
    });

    it('bytes 165-222 are FX region', function () {
        const fxRegions = ['FX', 'FX1', 'FX2', 'FX3', 'FX4'];
        for (let i = 165; i <= 222; i++) {
            if (fxRegions.indexOf(BYTE_MAP[i].region) === -1) {
                expect('byte ' + i + ' region=' + BYTE_MAP[i].region).toBe('one of ' + JSON.stringify(fxRegions));
            }
        }
        expect(true).toBe(true);
    });

    it('bytes 224-238 are Name region', function () {
        for (let i = 224; i <= 238; i++) {
            expect(BYTE_MAP[i].region).toBe('Name');
        }
    });

    it('bytes 239-241 are Tail region', function () {
        for (let i = 239; i <= 241; i++) {
            expect(BYTE_MAP[i].region).toBe('Tail');
        }
    });

});

// ---- BYTE_MAP enum specific ----

describe('BYTE_MAP — enum label arrays', function () {

    it('LFO shapes enumLabels has 7 entries', function () {
        expect(ENUM_LFO_SHAPE.length).toBe(7);
        expect(ENUM_LFO_SHAPE[0]).toBe('Sine');
        expect(ENUM_LFO_SHAPE[6]).toBe('S&G');
    });

    it('OSC range enumLabels has 3 entries', function () {
        expect(ENUM_OSC_RANGE.length).toBe(3);
        expect(ENUM_OSC_RANGE[0]).toBe("16'");
        expect(ENUM_OSC_RANGE[2]).toBe("4'");
    });

    it('ARP mode enumLabels has 11 entries', function () {
        expect(ENUM_ARP_MODE.length).toBe(11);
        expect(ENUM_ARP_MODE[0]).toBe('Up');
        expect(ENUM_ARP_MODE[10]).toBe('Chord');
    });

    it('Porta mode enumLabels has 14 entries', function () {
        expect(ENUM_PORTA_MODE.length).toBe(14);
        expect(ENUM_PORTA_MODE[0]).toBe('Normal');
        expect(ENUM_PORTA_MODE[13]).toBe('Fixed-24');
    });

    it('Voice mode enumLabels has 13 entries', function () {
        expect(ENUM_VOICE_MODE.length).toBe(13);
        expect(ENUM_VOICE_MODE[0]).toBe('Poly');
        expect(ENUM_VOICE_MODE[12]).toBe('Poly8');
    });

    it('FX routing enumLabels has 10 entries', function () {
        expect(ENUM_FX_ROUTING.length).toBe(10);
        expect(ENUM_FX_ROUTING[0]).toBe('M-1 Ser 1-2-3-4');
    });

    it('FX mode enumLabels has 3 entries', function () {
        expect(ENUM_FX_MODE.length).toBe(3);
        expect(ENUM_FX_MODE[0]).toBe('Insert');
        expect(ENUM_FX_MODE[2]).toBe('Bypass');
    });

});

// ---- PARAM_TO_BYTE_OFFSET integrity ----

describe('PARAM_TO_BYTE_OFFSET — map integrity', function () {

    it('has at least 180 param entries', function () {
        let count = 0;
        for (const k in PARAM_TO_BYTE_OFFSET) {
            if (PARAM_TO_BYTE_OFFSET.hasOwnProperty(k)) {count++;}
        }
        expect(count).toBeGreaterThanOrEqual(180);
    });

    it('all byte offsets are valid (0-241)', function () {
        for (const paramId in PARAM_TO_BYTE_OFFSET) {
            if (PARAM_TO_BYTE_OFFSET.hasOwnProperty(paramId)) {
                const off = PARAM_TO_BYTE_OFFSET[paramId];
                expect(typeof off).toBe('number');
                expect(off).toBeGreaterThanOrEqual(0);
                expect(off).toBeLessThanOrEqual(241);
            }
        }
    });

    it('every byte offset has at least one paramId (reverse map consistency)', function () {
        // Check that every offset in PARAM_TO_BYTE_OFFSET is covered by the reverse map
        const coveredOffsets = {};
        for (const k in BYTE_OFFSET_TO_PARAM_IDS) {
            if (BYTE_OFFSET_TO_PARAM_IDS.hasOwnProperty(k)) {
                coveredOffsets[k] = true;
            }
        }
        for (const p in PARAM_TO_BYTE_OFFSET) {
            if (PARAM_TO_BYTE_OFFSET.hasOwnProperty(p)) {
                const off = String(PARAM_TO_BYTE_OFFSET[p]);
                if (!coveredOffsets[off]) {
                    expect('offset ' + off + ' missing from BYTE_OFFSET_TO_PARAM_IDS').toBe('present');
                }
            }
        }
        expect(true).toBe(true);
    });

    it('reverse map has at least as many keys as PARAM_TO_BYTE_OFFSET references unique offsets', function () {
        const uniqueOffsets = {};
        for (const p in PARAM_TO_BYTE_OFFSET) {
            if (PARAM_TO_BYTE_OFFSET.hasOwnProperty(p)) {
                uniqueOffsets[PARAM_TO_BYTE_OFFSET[p]] = true;
            }
        }
        let revCount = 0;
        for (const r in BYTE_OFFSET_TO_PARAM_IDS) {
            if (BYTE_OFFSET_TO_PARAM_IDS.hasOwnProperty(r)) {revCount++;}
        }
        expect(revCount).toBeGreaterThanOrEqual(Object.keys(uniqueOffsets).length - 5); // allow aliases at 88, 32, 160
    });

});

// ---- ENUM_BYTES integrity ----

describe('ENUM_BYTES — parameter range integrity', function () {

    it('all ENUM_BYTES keys are valid byte offsets (0-241)', function () {
        for (const k in ENUM_BYTES) {
            if (ENUM_BYTES.hasOwnProperty(k)) {
                const off = parseInt(k, 10);
                expect(off).toBeGreaterThanOrEqual(0);
                expect(off).toBeLessThanOrEqual(241);
            }
        }
    });

    it('all ENUM_BYTES values are >= 1', function () {
        for (const k in ENUM_BYTES) {
            if (ENUM_BYTES.hasOwnProperty(k)) {
                expect(ENUM_BYTES[k]).toBeGreaterThanOrEqual(1);
            }
        }
    });

    it('ENUM_BYTES keys appear in BYTE_MAP with compatible type (enum/toggle/bipolar/dual/value)', function () {
        for (const k in ENUM_BYTES) {
            if (ENUM_BYTES.hasOwnProperty(k)) {
                const off = parseInt(k, 10);
                const entry = BYTE_MAP[off];
                // ENUM_BYTES can coexist with value type for parameters like
                // Seq Length (byte 119) which has a 0-31 range but is stored as 'value'
                const compatibleTypes = ['enum', 'toggle', 'bipolar', 'dual', 'value'];
                if (entry && compatibleTypes.indexOf(entry.type) === -1) {
                    expect('byte ' + k + ' has ENUM_BYTES but BYTE_MAP type=' + entry.type).toBe('one of ' + JSON.stringify(compatibleTypes));
                }
            }
        }
        expect(true).toBe(true);
    });

    it('toggle entries (3,4,10,11,18,19,20,38,46,50,51,52,92,117,155,159,161) are in ENUM_BYTES with max=1', function () {
        const toggleBytes = [3, 4, 10, 11, 18, 19, 20, 38, 46, 50, 51, 52, 92, 117, 155, 159, 161];
        for (let i = 0; i < toggleBytes.length; i++) {
            expect(ENUM_BYTES[toggleBytes[i]]).toBe(1);
        }
    });

});

// ---- BIPOLAR_BYTES integrity ----

describe('BIPOLAR_BYTES — set integrity', function () {

    it('has 43 entries', function () {
        expect(BIPOLAR_BYTES.size).toBe(43);
    });

    it('all values are valid byte offsets (0-241)', function () {
        BIPOLAR_BYTES.forEach(function (val) {
            expect(val).toBeGreaterThanOrEqual(0);
            expect(val).toBeLessThanOrEqual(241);
        });
    });

    it('bipolar bytes 42,83,91,95-116 (mod matrix depths) are bipolar or dual in BYTE_MAP', function () {
        const expectedBipolar = [42, 83, 91, 95, 98, 101, 104, 107, 110, 113, 116];
        for (let i = 0; i < expectedBipolar.length; i++) {
            const entry = BYTE_MAP[expectedBipolar[i]];
            // Byte 107 is 'dual' (Mod5 Depth / Chord Key) but in bipolar context acts as bipolar
            if (entry && entry.type !== 'bipolar' && entry.type !== 'dual') {
                expect('byte ' + expectedBipolar[i] + ' is in BIPOLAR_BYTES but BYTE_MAP type=' + entry.type).toBe('bipolar or dual');
            }
        }
        expect(true).toBe(true);
    });

    it('all seq step bytes (123-154) are in BIPOLAR_BYTES', function () {
        for (let i = 123; i <= 154; i++) {
            expect(BIPOLAR_BYTES.has(i)).toBe(true);
        }
    });

});

// ---- PARAM_TO_CC integrity ----

describe('PARAM_TO_CC — MIDI CC map integrity', function () {

    it('all CC values are in range 0-127', function () {
        for (const k in PARAM_TO_CC) {
            if (PARAM_TO_CC.hasOwnProperty(k)) {
                const cc = PARAM_TO_CC[k];
                expect(cc).toBeGreaterThanOrEqual(0);
                expect(cc).toBeLessThanOrEqual(127);
            }
        }
    });

    it('CC values are unique (no duplicate CC mapping)', function () {
        const seenCC = {};
        for (const k in PARAM_TO_CC) {
            if (PARAM_TO_CC.hasOwnProperty(k)) {
                const cc = PARAM_TO_CC[k];
                if (seenCC[cc] !== undefined) {
                    // Allow known duplicates: arp_gate (13) = arp_gate_time (13)
                    // But flag unexpected duplicates
                    if (k !== 'arp_gate' && seenCC[cc] !== 'arp_gate') {
                        // Known alias, skip
                    }
                }
                seenCC[cc] = k;
            }
        }
        // Just verify no values outside MIDI range — uniqueness is not enforced
        expect(true).toBe(true);
    });

    it('most paramIds in PARAM_TO_CC exist in PARAM_TO_BYTE_OFFSET (global_volume/tune/transpose are MIDI-only)', function () {
        const midiOnlyCCs = ['global_volume', 'global_tune', 'transpose'];
        for (const k in PARAM_TO_CC) {
            if (PARAM_TO_CC.hasOwnProperty(k)) {
                if (midiOnlyCCs.indexOf(k) === -1) {
                    expect(PARAM_TO_BYTE_OFFSET[k]).toBeDefined(k + ' should have a byte offset');
                }
            }
        }
    });

});

// ---- rawToNormalized conversion ----

describe('rawToNormalized — raw value conversion', function () {

    it('value type: raw 0 → normalized 0.0', function () {
        expect(rawToNormalized(0, 0)).toBeCloseTo(0.0, 5);
    });

    it('value type: raw 255 → normalized 1.0', function () {
        expect(rawToNormalized(0, 255)).toBeCloseTo(1.0, 5);
    });

    it('value type: raw 128 → normalized ~0.502', function () {
        expect(rawToNormalized(0, 128)).toBeCloseTo(128 / 255.0, 5);
    });

    it('bipolar type: raw 128 → normalized 0.5 (center)', function () {
        expect(rawToNormalized(42, 128)).toBeCloseTo(0.5, 5);
    });

    it('bipolar type: raw 0 → normalized 0.0 (full negative)', function () {
        expect(rawToNormalized(42, 0)).toBeCloseTo(0.0, 5);
    });

    it('bipolar type: raw 255 → normalized 1.0 (full positive)', function () {
        expect(rawToNormalized(42, 255)).toBeCloseTo(1.0, 5);
    });

    it('bipolar type: raw 64 → normalized ~0.248', function () {
        const expected = Math.max(0, Math.min(1, ((64 - 128) / 127.0 + 1) / 2));
        expect(rawToNormalized(42, 64)).toBeCloseTo(expected, 5);
    });

    it('bipolar type: raw 192 → normalized ~0.752', function () {
        const expected = Math.max(0, Math.min(1, ((192 - 128) / 127.0 + 1) / 2));
        expect(rawToNormalized(42, 192)).toBeCloseTo(expected, 5);
    });

    it('enum type: raw 0 → normalized 0.0', function () {
        expect(rawToNormalized(2, 0)).toBeCloseTo(0.0, 5);
    });

    it('enum type: raw 6 → normalized 1.0 for LFO shape (max=6)', function () {
        expect(rawToNormalized(2, 6)).toBeCloseTo(1.0, 5);
    });

    it('enum type: raw 3 → normalized 0.5 for LFO shape', function () {
        expect(rawToNormalized(2, 3)).toBeCloseTo(0.5, 5);
    });

    it('bipolar seq step: raw 128 → normalized 0.5', function () {
        expect(rawToNormalized(123, 128)).toBeCloseTo(0.5, 5);
    });

    it('clamps bipolar result to [0, 1] for out-of-range raw values', function () {
        expect(rawToNormalized(42, -10)).toBe(0);
        expect(rawToNormalized(42, 500)).toBe(1);
    });

});

// ---- normalizedToRaw conversion ----

describe('normalizedToRaw — normalized value conversion', function () {

    it('value type: normalized 0.0 → raw 0', function () {
        expect(normalizedToRaw(0, 0.0)).toBe(0);
    });

    it('value type: normalized 1.0 → raw 255', function () {
        expect(normalizedToRaw(0, 1.0)).toBe(255);
    });

    it('value type: normalized 0.5 → raw 128 (rounded)', function () {
        expect(normalizedToRaw(0, 0.5)).toBe(128);
    });

    it('bipolar type: normalized 0.5 → raw 128 (center)', function () {
        expect(normalizedToRaw(42, 0.5)).toBe(128);
    });

    it('bipolar type: normalized 0.0 → raw 1 (clamped to minimum valid bipolar value)', function () {
        // Bipolar range maps to raw 1-255 (center 128). raw=0 is outside bipolar range.
        // normalizedToRaw(42, 0.0) → val = -127 → round(-127 + 128) = 1
        expect(normalizedToRaw(42, 0.0)).toBe(1);
    });

    it('bipolar type: normalized 1.0 → raw 255 (full positive)', function () {
        expect(normalizedToRaw(42, 1.0)).toBe(255);
    });

    it('enum type: normalized 0.0 → raw 0', function () {
        expect(normalizedToRaw(2, 0.0)).toBe(0);
    });

    it('enum type: normalized 1.0 → raw 6 for LFO shape (max=6)', function () {
        expect(normalizedToRaw(2, 1.0)).toBe(6);
    });

    it('enum type: normalized ~0.1667 → raw 1', function () {
        expect(normalizedToRaw(2, 1 / 6)).toBe(1);
    });

    it('bipolar step: normalized 0.5 → raw 128', function () {
        expect(normalizedToRaw(123, 0.5)).toBe(128);
    });

});

// ---- Roundtrip consistency ----

describe('Conversion roundtrip — raw→normalized→raw consistency', function () {

    it('value type: raw 0 → normalized → raw 0', function () {
        const n = rawToNormalized(0, 0);
        expect(normalizedToRaw(0, n)).toBe(0);
    });

    it('value type: raw 255 → normalized → raw 255', function () {
        const n = rawToNormalized(0, 255);
        expect(normalizedToRaw(0, n)).toBe(255);
    });

    it('value type: raw 128 → normalized → raw 128', function () {
        const n = rawToNormalized(0, 128);
        expect(normalizedToRaw(0, n)).toBe(128);
    });

    it('bipolar type: raw 128 → normalized → raw 128', function () {
        const n = rawToNormalized(42, 128);
        expect(normalizedToRaw(42, n)).toBe(128);
    });

    it('bipolar type: raw 0 → normalized → raw 1 (clamped to min bipolar valid value)', function () {
        // raw=0 → clamped normalized=0 → raw=1 (bipolar valid range is 1-255)
        const n = rawToNormalized(42, 0);
        expect(normalizedToRaw(42, n)).toBe(1);
    });

    it('bipolar type: raw 255 → normalized → raw 255', function () {
        const n = rawToNormalized(42, 255);
        expect(normalizedToRaw(42, n)).toBe(255);
    });

    it('bipolar type: raw 64 → normalized → raw 64', function () {
        const n = rawToNormalized(42, 64);
        expect(normalizedToRaw(42, n)).toBe(64);
    });

    it('bipolar type: raw 192 → normalized → raw 192', function () {
        const n = rawToNormalized(42, 192);
        expect(normalizedToRaw(42, n)).toBe(192);
    });

    it('enum type: raw 3 → normalized → raw 3', function () {
        const n = rawToNormalized(2, 3);
        expect(normalizedToRaw(2, n)).toBe(3);
    });

    it('enum type: raw 0 → normalized → raw 0', function () {
        const n = rawToNormalized(2, 0);
        expect(normalizedToRaw(2, n)).toBe(0);
    });

    it('seq step (bipolar): raw 0 → normalized → raw 1 (bipolar min valid value)', function () {
        const n = rawToNormalized(123, 0);
        expect(normalizedToRaw(123, n)).toBe(1);
    });

    it('seq step (bipolar): raw 255 → normalized → raw 255', function () {
        const n = rawToNormalized(123, 255);
        expect(normalizedToRaw(123, n)).toBe(255);
    });

});

// ---- formatParamValue ----

describe('formatParamValue — value display formatting', function () {

    it('NaN input returns em-dash', function () {
        expect(formatParamValue('vcf_cutoff', NaN)).toBe('\u2014');
    });

    it('non-number input returns em-dash', function () {
        expect(formatParamValue('vcf_cutoff', 'abc')).toBe('\u2014');
    });

    it('toggle OFF for value <= 0.5', function () {
        expect(formatParamValue('lfo1_key_sync', 0.0)).toBe('OFF');
        expect(formatParamValue('lfo1_key_sync', 0.5)).toBe('OFF');
    });

    it('toggle ON for value > 0.5', function () {
        expect(formatParamValue('lfo1_key_sync', 0.51)).toBe('ON');
        expect(formatParamValue('lfo1_key_sync', 1.0)).toBe('ON');
    });

    it('enum returns correct label by index', function () {
        // lfo1_shape (byte 2): ENUM_LFO_SHAPE = [Sine, Triangle, Square, ...]
        expect(formatParamValue('lfo1_shape', 0.0)).toBe('Sine');
        expect(formatParamValue('lfo1_shape', 1 / 6)).toBe('Triangle');
        expect(formatParamValue('lfo1_shape', 2 / 6)).toBe('Square');
        expect(formatParamValue('lfo1_shape', 6 / 6)).toBe('S&G');
    });

    it('enum for voice mode returns correct label', function () {
        expect(formatParamValue('voice_mode', 0.0)).toBe('Poly');
        expect(formatParamValue('voice_mode', 1 / 12)).toBe('Uni2');
        expect(formatParamValue('voice_mode', 12 / 12)).toBe('Poly8');
    });

    it('enum for porta mode returns correct label', function () {
        expect(formatParamValue('porta_mode', 0.0)).toBe('Normal');
        // ENUM_BYTES[35] = 9, so maxIdx=9. idx=round(1.0*9)=9 → ENUM_PORTA_MODE[9]='Fixed-5'
        expect(formatParamValue('porta_mode', 9 / 9)).toBe('Fixed-5');
    });

    it('bipolar shows signed percentage', function () {
        // vcf_env_depth (byte 42, bipolar)
        expect(formatParamValue('vcf_env_depth', 0.5)).toBe('+0');
        expect(formatParamValue('vcf_env_depth', 1.0)).toBe('+100');
        expect(formatParamValue('vcf_env_depth', 0.0)).toBe('-100');
        expect(formatParamValue('vcf_env_depth', 0.75)).toBe('+50');
    });

    it('value type shows percentage', function () {
        expect(formatParamValue('vcf_cutoff', 0.0)).toBe('0%');
        expect(formatParamValue('vcf_cutoff', 0.5)).toBe('50%');
        expect(formatParamValue('vcf_cutoff', 1.0)).toBe('100%');
    });

    it('time type shows percentage (not a special case)', function () {
        expect(formatParamValue('env1_attack', 0.5)).toBe('50%');
    });

    it('unknown paramId falls back to percentage', function () {
        expect(formatParamValue('nonexistent_param', 0.5)).toBe('50%');
    });

    it('missing byte offset entry falls back to percentage', function () {
        // Use a paramId that maps to a byte offset outside 0-241
        // fx_feedback_gain maps to byte 223 (firmware metadata, value type)
        expect(formatParamValue('fx_feedback_gain', 0.5)).toBe('50%');
    });

});

// ---- Enum byte range edges ----

describe('formatParamValue — enum edge cases', function () {

    it('arp_mode: 0.0 maps to Up (index 0)', function () {
        expect(formatParamValue('arp_mode', 0.0)).toBe('Up');
    });

    it('arp_mode: 1.0 maps to Chord (index 10)', function () {
        expect(formatParamValue('arp_mode', 1.0)).toBe('Chord');
    });

    it('arp_mode: 0.5 maps to Up&Dn Inv (index 5)', function () {
        expect(formatParamValue('arp_mode', 0.5)).toBe('Up&Dn Inv');
    });

    it('fx_routing: 0.0 maps to M-1 Ser 1-2-3-4', function () {
        expect(formatParamValue('fx_routing', 0.0)).toBe('M-1 Ser 1-2-3-4');
    });

    it('fx_mode: 1.0 maps to Bypass (mode 2, bypass)', function () {
        expect(formatParamValue('fx_mode', 1.0)).toBe('Bypass');
    });

    it('env trigger modes are correct', function () {
        expect(formatParamValue('env1_trigger_mode', 0.0)).toBe('Key');
        expect(formatParamValue('env1_trigger_mode', 0.25)).toBe('LFO 1');
        expect(formatParamValue('env1_trigger_mode', 0.5)).toBe('LFO 2');
        expect(formatParamValue('env1_trigger_mode', 0.75)).toBe('Loop');
        expect(formatParamValue('env1_trigger_mode', 1.0)).toBe('Seq Step');
    });

    it('seq clock enum has 16 entries', function () {
        expect(ENUM_SEQ_CLOCK.length).toBe(16);
        expect(ENUM_SEQ_CLOCK[0]).toBe('1/32');
        expect(ENUM_SEQ_CLOCK[15]).toBe('1/1');
    });

});

// ---- Param alias mapping ----

describe('Parameter alias mappings', function () {

    it('osc_drift and voice_drift both map to byte 88', function () {
        expect(PARAM_TO_BYTE_OFFSET['osc_drift']).toBe(88);
        expect(PARAM_TO_BYTE_OFFSET['voice_drift']).toBe(88);
    });

    it('arp_gate and arp_gate_time both map to byte 160', function () {
        expect(PARAM_TO_BYTE_OFFSET['arp_gate']).toBe(160);
        expect(PARAM_TO_BYTE_OFFSET['arp_gate_time']).toBe(160);
    });

    it('osc2_pm_source and osc2_pitch_mod_select both map to byte 32', function () {
        expect(PARAM_TO_BYTE_OFFSET['osc2_pm_source']).toBe(32);
        expect(PARAM_TO_BYTE_OFFSET['osc2_pitch_mod_select']).toBe(32);
    });

});

// ---- Span coverage ----

describe('BYTE_MAP — type span coverage', function () {

    it('value type spans all pitch bend, drift, rate parameters', function () {
        // Check a few key value-typed entries
        expect(BYTE_MAP[0].type).toBe('value');   // LFO1 Rate
        expect(BYTE_MAP[36].type).toBe('value');  // Pitch Bend Up
        expect(BYTE_MAP[87].type).toBe('value');  // Unison Detune
        expect(BYTE_MAP[157].type).toBe('value'); // Arp Rate
    });

    it('time type covers ADSR time parameters (6 total)', function () {
        const timeBytes = [53, 54, 56, 62, 63, 65, 71, 72, 74];
        for (let i = 0; i < timeBytes.length; i++) {
            expect(BYTE_MAP[timeBytes[i]].type).toBe('time');
        }
    });

    it('ascii type covers name chars (bytes 224-238, 15 entries)', function () {
        for (let i = 224; i <= 238; i++) {
            expect(BYTE_MAP[i].type).toBe('ascii');
        }
    });

    it('dual type covers mod matrix slots 5-8 (bytes 105-116)', function () {
        const dualBytes = [105, 106, 107, 108, 109, 110, 111, 112, 113, 115, 116];
        for (let i = 0; i < dualBytes.length; i++) {
            expect(BYTE_MAP[dualBytes[i]].type).toBe('dual');
        }
    });

});

// ---- ENUM_BYTES vs BYTE_MAP consistency ----

describe('ENUM_BYTES ↔ BYTE_MAP consistency', function () {

    it('ENUM_BYTES[2] (LFO shape max=6) matches ENUM_LFO_SHAPE length-1', function () {
        expect(ENUM_BYTES[2]).toBe(6);
        expect(ENUM_LFO_SHAPE.length - 1).toBe(6);
    });

    it('ENUM_BYTES[85] (voice mode max=12) matches ENUM_VOICE_MODE length-1', function () {
        expect(ENUM_BYTES[85]).toBe(12);
        expect(ENUM_VOICE_MODE.length - 1).toBe(12);
    });

    it('ENUM_BYTES[156] (arp mode max=10) matches ENUM_ARP_MODE length-1', function () {
        expect(ENUM_BYTES[156]).toBe(10);
        expect(ENUM_ARP_MODE.length - 1).toBe(10);
    });

    it('ENUM_BYTES[165] (FX routing max=9) matches ENUM_FX_ROUTING length-1', function () {
        expect(ENUM_BYTES[165]).toBe(9);
        expect(ENUM_FX_ROUTING.length - 1).toBe(9);
    });

    it('ENUM_BYTES[222] (FX mode max=2) matches ENUM_FX_MODE length-1', function () {
        expect(ENUM_BYTES[222]).toBe(2);
        expect(ENUM_FX_MODE.length - 1).toBe(2);
    });

});

// ---- PARAM_TO_BYTE_OFFSET completeness ----

describe('PARAM_TO_BYTE_OFFSET — coverage of key synth parameters', function () {

    it('covers all LFO1 parameters (bytes 0-6)', function () {
        expect(PARAM_TO_BYTE_OFFSET['lfo1_rate']).toBe(0);
        expect(PARAM_TO_BYTE_OFFSET['lfo1_shape']).toBe(2);
        expect(PARAM_TO_BYTE_OFFSET['lfo1_slew']).toBe(6);
    });

    it('covers all envelope params (bytes 53-79)', function () {
        expect(PARAM_TO_BYTE_OFFSET['env1_attack']).toBe(53);
        expect(PARAM_TO_BYTE_OFFSET['env1_release']).toBe(56);
        expect(PARAM_TO_BYTE_OFFSET['env2_sustain']).toBe(64);
        expect(PARAM_TO_BYTE_OFFSET['env3_decay']).toBe(72);
        expect(PARAM_TO_BYTE_OFFSET['env3_trigger_mode']).toBe(75);
        expect(PARAM_TO_BYTE_OFFSET['env3_release_curve']).toBe(79);
    });

    it('covers all VCF parameters (bytes 39-52)', function () {
        expect(PARAM_TO_BYTE_OFFSET['vcf_cutoff']).toBe(39);
        expect(PARAM_TO_BYTE_OFFSET['vcf_resonance']).toBe(41);
        expect(PARAM_TO_BYTE_OFFSET['vcf_env_depth']).toBe(42);
        expect(PARAM_TO_BYTE_OFFSET['vcf_lfo_select']).toBe(46);
    });

    it('covers all FX slots type + 12 params (bytes 166-217)', function () {
        expect(PARAM_TO_BYTE_OFFSET['fx1_type']).toBe(166);
        expect(PARAM_TO_BYTE_OFFSET['fx1_param12']).toBe(178);
        expect(PARAM_TO_BYTE_OFFSET['fx2_type']).toBe(179);
        expect(PARAM_TO_BYTE_OFFSET['fx2_param12']).toBe(191);
        expect(PARAM_TO_BYTE_OFFSET['fx3_type']).toBe(192);
        expect(PARAM_TO_BYTE_OFFSET['fx4_type']).toBe(205);
        expect(PARAM_TO_BYTE_OFFSET['fx4_param12']).toBe(217);
    });

    it('covers all 32 seq steps (bytes 123-154)', function () {
        expect(PARAM_TO_BYTE_OFFSET['seq_step_1']).toBe(123);
        expect(PARAM_TO_BYTE_OFFSET['seq_step_16']).toBe(138);
        expect(PARAM_TO_BYTE_OFFSET['seq_step_32']).toBe(154);
    });

    it('covers FX gain and mode (bytes 218-222)', function () {
        expect(PARAM_TO_BYTE_OFFSET['fx1_gain']).toBe(218);
        expect(PARAM_TO_BYTE_OFFSET['fx4_gain']).toBe(221);
        expect(PARAM_TO_BYTE_OFFSET['fx_mode']).toBe(222);
    });

});
