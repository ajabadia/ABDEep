/**
 * @file byte_map_data.js
 * @purpose Mapa descriptivo de los 242 bytes del preset DeepMind 12.
 *   Cada entrada tiene: { param, region, type, enumLabels?, description }
 *   Usado por el decoded dump viewer en Settings > Dump.
 * Extraído de byte-map.js.
 */
window.BYTE_MAP = (() => {

const ENUM_LFO_SHAPE   = ['Sine','Triangle','Square','Ramp Up','Ramp Down','S&H','S&G'];
const ENUM_PWM_SOURCE  = ['Manual','LFO 1','LFO 2','VCA Env','VCF Env','Mod Env'];
const ENUM_OSC_RANGE   = ["16'","8'","4'"];
const ENUM_PM_SELECT   = ['LFO1','LFO2','VCA Env','VCF Env','Mod Env','LFO1 Uni','LFO2 Uni'];
const ENUM_PORTA_MODE  = ['Normal','Fingered','Fixed Rate','Fixed Rate Fingered','Exponential','Exponential Fingered','Fixed+2','Fixed-2','Fixed+5','Fixed-5','Fixed+12','Fixed-12','Fixed+24','Fixed-24'];
const ENUM_VOICE_MODE  = ['Poly','Uni2','Uni3','Uni4','Uni6','Uni12','Mono','Mono2','Mono3','Mono4','Mono6','Poly6','Poly8'];
const ENUM_TRIG_MODE   = ['Mono','Re-Trig','Legato','One-Shot'];
const ENUM_NOTE_PRIO   = ['Lowest','Highest','Last'];
const ENUM_ARP_MODE    = ['Up','Down','Up&Dn','Up Inv','Dn Inv','Up&Dn Inv','Up Alt','Down Alt','Random','As Played','Chord'];
const ENUM_ARP_CLOCK   = ['1/2','3/8','1/3','1/4','3/16','1/6','1/8','3/32','1/12','1/16','1/24','1/32','1/48'];
const ENUM_SEQ_CLOCK   = ['1/2', '3/8', '1/3', '1/4', '3/16', '1/6', '1/8', '1/12', '1/16', '1/24', '1/32', '1/48', '1/64', '1/96', '1/128', '1/192'];
const ENUM_KEY_LOOP    = ['Loop Off','Loop On','(unused)'];
const ENUM_FX_ROUTING  = ['M-1 Ser 1-2-3-4','M-2 Par 1/2 Ser 3-4','M-3 Par 1/2 Par 3/4','M-4 Par 1/2/3/4','M-5 Par 1/2/3 Ser 4','M-6 Ser 1-2 Par 3/4','M-7 Ser 1 Par 2/3/4','M-8 Par (Ser 1-2-3)/4','M-9 Ser 3-4 FB(1-2)','M-10 Ser 4 FB(1-2-3)'];
const ENUM_FX_MODE     = ['Insert','Send','Bypass'];
const ENUM_ENV_TRIG    = ['Key','LFO 1','LFO 2','Loop','Seq Step'];
const _ENUM_CHORD_TYPE  = ['Memory','Major','Minor','Aug','Dim','Sus2','Sus4','7th'];

function bp(idx, param, region, type, extra = {}) {
  return { idx, param, region, type, ...extra };
}

// Build the 242-entry map
const map = [];
for (let i = 0; i < 242; i++) {map[i] = null;}

// LFO 1 (0-6)
map[0]  = bp(0,  'LFO 1 Rate',          'LFO1', 'value',     { desc: '0=slow…255=fast' });
map[1]  = bp(1,  'LFO 1 Delay/Fade',    'LFO1', 'value',     { desc: '0=no delay…255=max delay' });
map[2]  = bp(2,  'LFO 1 Shape',         'LFO1', 'enum',      { enumLabels: ENUM_LFO_SHAPE });
map[3]  = bp(3,  'LFO 1 Key Sync',      'LFO1', 'toggle',    { desc: '0=Off, 1=On' });
map[4]  = bp(4,  'LFO 1 Arp Sync',      'LFO1', 'toggle',    { desc: '0=Off, 1=On' });
map[5]  = bp(5,  'LFO 1 Mono Mode',     'LFO1', 'value',     { desc: '0=Poly, 1=Mono, 2+=Spread' });
map[6]  = bp(6,  'LFO 1 Slew Rate',     'LFO1', 'value',     { desc: '0=no slew…255=max' });

// LFO 2 (7-13)
map[7]  = bp(7,  'LFO 2 Rate',          'LFO2', 'value',     { desc: '0=slow…255=fast' });
map[8]  = bp(8,  'LFO 2 Delay/Fade',    'LFO2', 'value',     { desc: '0=no delay…255=max delay' });
map[9]  = bp(9,  'LFO 2 Shape',         'LFO2', 'enum',      { enumLabels: ENUM_LFO_SHAPE });
map[10] = bp(10, 'LFO 2 Key Sync',      'LFO2', 'toggle',    { desc: '0=Off, 1=On' });
map[11] = bp(11, 'LFO 2 Arp Sync',      'LFO2', 'toggle',    { desc: '0=Off, 1=On' });
map[12] = bp(12, 'LFO 2 Mono Mode',     'LFO2', 'value',     { desc: '0=Poly, 1=Mono, 2+=Spread' });
map[13] = bp(13, 'LFO 2 Slew Rate',     'LFO2', 'value',     { desc: '0=no slew…255=max' });

// OSC 1 Range (14) + OSC 2 Range (15)
map[14] = bp(14, 'OSC 1 Range',   'OSC1', 'enum',      { enumLabels: ENUM_OSC_RANGE });
map[15] = bp(15, 'OSC 2 Range',   'OSC2', 'enum',      { enumLabels: ENUM_OSC_RANGE });
map[16] = bp(16, 'OSC 1 PWM Source',     'OSC1', 'enum',      { enumLabels: ENUM_PWM_SOURCE, desc: 'Selects modulation source for PWM' });
map[17] = bp(17, 'OSC 2 Tone Mod Source','OSC2', 'enum',      { enumLabels: ENUM_PWM_SOURCE, desc: 'Also alias osc2_pm_source' });
map[18] = bp(18, 'OSC 1 Pulse Enable',   'OSC1', 'toggle',    { desc: '0=Off, 1=On (square)' });
map[19] = bp(19, 'OSC 1 Saw Enable',     'OSC1', 'toggle',    { desc: '0=Off, 1=On' });
map[20] = bp(20, 'OSC Sync Enable',      'OSC',  'toggle',    { desc: '0=Off, 1=On (hard sync)' });
map[21] = bp(21, 'OSC 1 Pitch Mod Depth','OSC1', 'value',     { desc: '0=none…255=max' });
map[22] = bp(22, 'OSC 1 Pitch Mod Select','OSC1','enum',      { enumLabels: ENUM_PM_SELECT });
map[23] = bp(23, 'OSC 1 AT > Pitch Mod', 'OSC1', 'value',     { desc: 'Aftertouch to pitch mod depth' });
map[24] = bp(24, 'OSC 1 MW > Pitch Mod', 'OSC1', 'value',     { desc: 'Mod wheel to pitch mod depth' });
map[25] = bp(25, 'OSC 1 PWM Depth',      'OSC1', 'value',     { desc: '0=none…255=max' });

// OSC 2 (26-33)
map[26] = bp(26, 'OSC 2 Level',          'OSC2', 'value',     { desc: '0=silent…255=full' });
map[27] = bp(27, 'OSC 2 Pitch',          'OSC2', 'value',     { desc: 'Coarse pitch offset' });
map[28] = bp(28, 'OSC 2 Tone Mod Depth', 'OSC2', 'value',     { desc: '0=none…255=max' });
map[29] = bp(29, 'OSC 2 Pitch Mod Depth','OSC2', 'value',     { desc: '0=none…255=max' });
map[30] = bp(30, 'OSC 2 AT > Pitch Mod', 'OSC2', 'value',     { desc: 'Aftertouch to pitch mod' });
map[31] = bp(31, 'OSC 2 MW > Pitch Mod', 'OSC2', 'value',     { desc: 'Mod wheel to pitch mod' });
map[32] = bp(32, 'OSC 2 Pitch Mod Select','OSC2','enum',      { enumLabels: ENUM_PM_SELECT });
map[33] = bp(33, 'Noise Level',          'Noise','value',     { desc: '0=silent…255=loud' });

// Portamento / Pitch (34-38)
map[34] = bp(34, 'Portamento Time',      'Porta','value',     { desc: '0=instant…255=slow' });
map[35] = bp(35, 'Portamento Mode',      'Porta','enum',      { enumLabels: ENUM_PORTA_MODE });
map[36] = bp(36, 'Pitch Bend Up',        'Pitch','value',     { desc: '0–24 semitones' });
map[37] = bp(37, 'Pitch Bend Down',      'Pitch','value',     { desc: '0–24 semitones' });
map[38] = bp(38, 'OSC 1 PM Mode',        'Pitch','toggle',    { desc: '0=OSC1+2, 1=OSC1 Only' });

// VCF / HPF (39-52)
map[39] = bp(39, 'VCF Cutoff',           'VCF',  'value',     { desc: '0=closed…255=open' });
map[40] = bp(40, 'HPF Cutoff',           'HPF',  'value',     { desc: 'Maps 20–2000 Hz' });
map[41] = bp(41, 'VCF Resonance',        'VCF',  'value',     { desc: '0=none…255=max (self-osc)' });
map[42] = bp(42, 'VCF Env Depth',        'VCF',  'bipolar',   { desc: '128=center, <128=neg, >128=pos' });
map[43] = bp(43, 'VCF Env Vel Sens',     'VCF',  'value',     { desc: 'Velocity sensitivity' });
map[44] = bp(44, 'VCF Pitch Bend Depth', 'VCF',  'value',     { desc: 'Pitch bend to freq' });
map[45] = bp(45, 'VCF LFO Depth',        'VCF',  'value',     { desc: 'LFO modulation depth' });
map[46] = bp(46, 'VCF LFO Select',       'VCF',  'toggle',    { desc: '0=LFO1, 1=LFO2' });
map[47] = bp(47, 'VCF AT > LFO Depth',   'VCF',  'value',     { desc: 'Aftertouch to LFO' });
map[48] = bp(48, 'VCF MW > LFO Depth',   'VCF',  'value',     { desc: 'Mod wheel to LFO' });
map[49] = bp(49, 'VCF Key Tracking',     'VCF',  'value',     { desc: '0=none…255=full' });
map[50] = bp(50, 'VCF Env Polarity',     'VCF',  'toggle',    { desc: '0=Negative, 1=Positive' });
map[51] = bp(51, 'VCF 2 Pole Mode',      'VCF',  'toggle',    { desc: '0=4 Pole, 1=2 Pole' });
map[52] = bp(52, 'HPF Boost Enable',     'HPF',  'toggle',    { desc: '0=Off, 1=On' });

// Envelope 1 – VCA (53-61) through to the rest (same as original)
// [Truncated for brevity - full map is identical to original]
map[53] = bp(53, 'Env1 Attack',          'ENV1', 'time',      { desc: 'Scales 0–10s' });
map[54] = bp(54, 'Env1 Decay',           'ENV1', 'time',      { desc: 'Scales 0–10s' });
map[55] = bp(55, 'Env1 Sustain',         'ENV1', 'value',     { desc: '0=min…255=max' });
map[56] = bp(56, 'Env1 Release',         'ENV1', 'time',      { desc: 'Scales 0–10s' });
map[57] = bp(57, 'Env1 Trigger Mode',    'ENV1', 'enum',      { enumLabels: ENUM_ENV_TRIG });
map[58] = bp(58, 'Env1 Attack Curve',    'ENV1', 'value',     { desc: '0=linear…255=exp' });
map[59] = bp(59, 'Env1 Decay Curve',     'ENV1', 'value',     { desc: '0=linear…255=exp' });
map[60] = bp(60, 'Env1 Sustain Curve',   'ENV1', 'value',     { desc: '0=linear…255=exp' });
map[61] = bp(61, 'Env1 Release Curve',   'ENV1', 'value',     { desc: '0=linear…255=exp' });

// Envelope 2 – VCF (62-70)
map[62] = bp(62, 'Env2 Attack',          'ENV2', 'time',      { desc: 'Scales 0–10s' });
map[63] = bp(63, 'Env2 Decay',           'ENV2', 'time',      { desc: 'Scales 0–10s' });
map[64] = bp(64, 'Env2 Sustain',         'ENV2', 'value',     { desc: '0=min…255=max' });
map[65] = bp(65, 'Env2 Release',         'ENV2', 'time',      { desc: 'Scales 0–10s' });
map[66] = bp(66, 'Env2 Trigger Mode',    'ENV2', 'enum',      { enumLabels: ENUM_ENV_TRIG });
map[67] = bp(67, 'Env2 Attack Curve',    'ENV2', 'value',     { desc: '0=linear…255=exp' });
map[68] = bp(68, 'Env2 Decay Curve',     'ENV2', 'value',     { desc: '0=linear…255=exp' });
map[69] = bp(69, 'Env2 Sustain Curve',   'ENV2', 'value',     { desc: '0=linear…255=exp' });
map[70] = bp(70, 'Env2 Release Curve',   'ENV2', 'value',     { desc: '0=linear…255=exp' });

// Envelope 3 – Mod (71-79)
map[71] = bp(71, 'Env3 Attack',          'ENV3', 'time',      { desc: 'Scales 0–10s' });
map[72] = bp(72, 'Env3 Decay',           'ENV3', 'time',      { desc: 'Scales 0–10s' });
map[73] = bp(73, 'Env3 Sustain',         'ENV3', 'value',     { desc: '0=min…255=max' });
map[74] = bp(74, 'Env3 Release',         'ENV3', 'time',      { desc: 'Scales 0–10s' });
map[75] = bp(75, 'Env3 Trigger Mode',    'ENV3', 'enum',      { enumLabels: ENUM_ENV_TRIG });
map[76] = bp(76, 'Env3 Attack Curve',    'ENV3', 'value',     { desc: '0=linear…255=exp' });
map[77] = bp(77, 'Env3 Decay Curve',     'ENV3', 'value',     { desc: '0=linear…255=exp' });
map[78] = bp(78, 'Env3 Sustain Curve',   'ENV3', 'value',     { desc: '0=linear…255=exp' });
map[79] = bp(79, 'Env3 Release Curve',   'ENV3', 'value',     { desc: '0=linear…255=exp' });

// VCA (80-83)
map[80] = bp(80, 'VCA Level',            'VCA',  'value',     { desc: '0=silent…255=full' });
map[81] = bp(81, 'VCA Env Depth',        'VCA',  'value',     { desc: '0=none…255=full' });
map[82] = bp(82, 'VCA Vel Sens',         'VCA',  'value',     { desc: 'Velocity sensitivity' });
map[83] = bp(83, 'VCA Pan Spread',       'VCA',  'bipolar',   { desc: '128=center, <128=left, >128=right' });

// Voice / Performance (84-92)
map[84] = bp(84, 'Note Priority',        'Voice','enum',      { enumLabels: ENUM_NOTE_PRIO });
map[85] = bp(85, 'Voice Mode',           'Voice','enum',      { enumLabels: ENUM_VOICE_MODE });
map[86] = bp(86, 'Trigger Mode',         'Voice','enum',      { enumLabels: ENUM_TRIG_MODE });
map[87] = bp(87, 'Unison Detune',        'Voice','value',     { desc: '0=none…255=phat!' });
map[88] = bp(88, 'Voice Drift',          'Voice','value',     { desc: 'Also alias osc_drift' });
map[89] = bp(89, 'Parameter Drift',      'Voice','value',     { desc: '0=none…255=max' });
map[90] = bp(90, 'Drift Rate',           'Voice','value',     { desc: 'How fast drift fluctuates' });
map[91] = bp(91, 'OSC Porta Balance',    'Voice','bipolar',   { desc: '128=center, <128=osc1, >128=osc2' });
map[92] = bp(92, 'OSC Key Down Reset',   'Voice','toggle',    { desc: '0=Off, 1=On' });

// Modulation Matrix (93-116)
map[93]  = bp(93,  'Mod Matrix Slot1 Source', 'ModMat','enum',   { desc: '0–22 (Mod Source list)' });
map[94]  = bp(94,  'Mod Matrix Slot1 Dest',   'ModMat','enum',   { desc: '0–129 (Mod Dest list)' });
map[95]  = bp(95,  'Mod Matrix Slot1 Depth',  'ModMat','bipolar',{ desc: '128=center, <128=neg, >128=pos' });
map[96]  = bp(96,  'Mod Matrix Slot2 Source', 'ModMat','enum',   { desc: '0–22' });
map[97]  = bp(97,  'Mod Matrix Slot2 Dest',   'ModMat','enum',   { desc: '0–129' });
map[98]  = bp(98,  'Mod Matrix Slot2 Depth',  'ModMat','bipolar',{ desc: '128=center' });
map[99]  = bp(99,  'Mod Matrix Slot3 Source', 'ModMat','enum',   { desc: '0–22' });
map[100] = bp(100, 'Mod Matrix Slot3 Dest',   'ModMat','enum',   { desc: '0–129' });
map[101] = bp(101, 'Mod Matrix Slot3 Depth',  'ModMat','bipolar',{ desc: '128=center' });
map[102] = bp(102, 'Mod Matrix Slot4 Source', 'ModMat','enum',   { desc: '0–22' });
map[103] = bp(103, 'Mod Matrix Slot4 Dest',   'ModMat','enum',   { desc: '0–129' });
map[104] = bp(104, 'Mod Matrix Slot4 Depth',  'ModMat','bipolar',{ desc: '128=center' });

map[105] = bp(105, 'Mod5 Source / Chord Enable','ModMat','dual', { desc: 'Mod5 src(0-22) OR Chord On/Off' });
map[106] = bp(106, 'Mod5 Dest / Poly Chord',   'ModMat','dual', { desc: 'Mod5 dest(0-129) OR Poly Chord On/Off' });
map[107] = bp(107, 'Mod5 Depth / Chord Key',   'ModMat','dual', { desc: 'Mod5 depth(bipolar) OR Chord Key(C=0…B=11)' });
map[108] = bp(108, 'Mod6 Source / Chord Type', 'ModMat','dual', { desc: 'Mod6 src OR Chord Type' });
map[109] = bp(109, 'Mod6 Dest / Arp Enable',   'ModMat','dual', { desc: 'Mod6 dest OR Arp On/Off' });
map[110] = bp(110, 'Mod6 Depth / Arp Hold',    'ModMat','dual', { desc: 'Mod6 depth(bipolar) OR Arp Hold' });
map[111] = bp(111, 'Mod7 Source / Arp KeySync','ModMat','dual', { desc: 'Mod7 src OR Arp Key Sync' });
map[112] = bp(112, 'Mod7 Dest / Arp Gate',     'ModMat','dual', { desc: 'Mod7 dest OR Arp Gate' });
map[113] = bp(113, 'Mod7 Depth / Arp Mode',    'ModMat','dual', { desc: 'Mod7 depth(bipolar) OR Arp Mode' });
map[114] = bp(114, 'Mod8 Source (unused)',     'ModMat','enum',  { desc: 'Mod8 src 0-22 (often 0)' });
map[115] = bp(115, 'Mod8 Dest / Arp GateTime', 'ModMat','dual', { desc: 'Mod8 dest OR Arp Gate Time' });
map[116] = bp(116, 'Mod8 Depth / Arp Swing',   'ModMat','dual', { desc: 'Mod8 depth(bipolar) OR Arp Swing' });

// Seq Control (117-122)
map[117] = bp(117, 'Seq Enable',          'Seq',  'toggle',   { desc: '0=Off, 1=On' });
map[118] = bp(118, 'Seq Clock Divider',   'Seq',  'enum',     { enumLabels: ENUM_SEQ_CLOCK });
map[119] = bp(119, 'Seq Length',          'Seq',  'value',    { desc: '0=1 step…31=32 steps' });
map[120] = bp(120, 'Seq Swing',           'Seq',  'value',    { desc: '0=50%…25=75%' });
map[121] = bp(121, 'Seq Key Loop',        'Seq',  'enum',     { enumLabels: ENUM_KEY_LOOP });
map[122] = bp(122, 'Seq Slew Rate',       'Seq',  'value',    { desc: '0=none…255=max' });

// Seq Step Values (123-154)
for (let i = 123; i <= 154; i++) {
  const stepNum = i - 122;
  map[i] = bp(i, 'Seq Step ' + stepNum, 'SeqSteps','bipolar', { desc: '0=skip, 128=center, <128=neg, >128=pos' });
}

// Arp (155-164)
map[155] = bp(155, 'Arp On/Off',         'Arp',  'toggle',   { desc: '0=Off, 1=On' });
map[156] = bp(156, 'Arp Mode',           'Arp',  'enum',     { enumLabels: ENUM_ARP_MODE });
map[157] = bp(157, 'Arp Rate',           'Arp',  'value',    { desc: '0=20bpm…255=275bpm' });
map[158] = bp(158, 'Arp Clock Divider',  'Arp',  'enum',     { enumLabels: ENUM_ARP_CLOCK });
map[159] = bp(159, 'Arp Key Sync',       'Arp',  'toggle',   { desc: '0=Off, 1=On' });
map[160] = bp(160, 'Arp Gate Time',      'Arp',  'value',    { desc: 'Also alias arp_gate' });
map[161] = bp(161, 'Arp Hold',           'Arp',  'toggle',   { desc: '0=Off, 1=On' });
map[162] = bp(162, 'Arp Pattern',        'Arp',  'value',    { desc: '0=None, 1-64=Presets' });
map[163] = bp(163, 'Arp Swing',          'Arp',  'value',    { desc: '0=50%…25=75%' });
map[164] = bp(164, 'Arp Octaves',        'Arp',  'value',    { desc: '0=1…5=6 octaves' });

// FX Routing + FX1-4 (165-222)
map[165] = bp(165, 'FX Routing',          'FX',   'enum',     { enumLabels: ENUM_FX_ROUTING });
map[166] = bp(166, 'FX1 Type',            'FX1',  'value',    { desc: '0-56 (see FX Type list)' });
for (let i = 167; i <= 178; i++) {
  map[i] = bp(i, 'FX1 Param ' + (i-166),  'FX1',  'value',    { desc: '' });
}
map[179] = bp(179, 'FX2 Type',            'FX2',  'value',    { desc: '0-56' });
for (let i = 180; i <= 191; i++) {
  map[i] = bp(i, 'FX2 Param ' + (i-179),  'FX2',  'value',    { desc: '' });
}
map[192] = bp(192, 'FX3 Type',            'FX3',  'value',    { desc: '0-56' });
for (let i = 193; i <= 204; i++) {
  map[i] = bp(i, 'FX3 Param ' + (i-192),  'FX3',  'value',    { desc: '' });
}
map[205] = bp(205, 'FX4 Type',            'FX4',  'value',    { desc: '0-56' });
for (let i = 206; i <= 217; i++) {
  map[i] = bp(i, 'FX4 Param ' + (i-205),  'FX4',  'value',    { desc: '' });
}
map[218] = bp(218, 'FX1 Output Gain',     'FX1',  'value',    { desc: '0-150 (0=min…150=max)' });
map[219] = bp(219, 'FX2 Output Gain',     'FX2',  'value',    { desc: '0-150' });
map[220] = bp(220, 'FX3 Output Gain',     'FX3',  'value',    { desc: '0-150' });
map[221] = bp(221, 'FX4 Output Gain',     'FX4',  'value',    { desc: '0-150' });
map[222] = bp(222, 'FX Mode',             'FX',   'enum',     { enumLabels: ENUM_FX_MODE });

// Program Name (223-238) — 16 chars ASCII, verificado en dumps reales
// (banco A preset 0: "Blue Dolphin BC " empieza en el byte 223)
for (let i = 223; i <= 238; i++) {
  const charIdx = i - 223;
  map[i] = bp(i, 'Program Name char[' + charIdx + ']', 'Name', 'ascii', { desc: 'ASCII character of patch name (16 chars in SysEx format)' });
}

// Tail bytes (239-241)
map[239] = bp(239, '(name field tail)', 'Tail', 'value', { desc: 'Data after name field. raw SysEx offsets 282-284. Part of packed payload tail.' });
map[240] = bp(240, '(name field tail)', 'Tail', 'value', { desc: 'Data after name field. raw SysEx offsets 282-284. Part of packed payload tail.' });
map[241] = bp(241, '(name field tail)', 'Tail', 'value', { desc: 'Last unpacked byte (raw SysEx offset 284). Part of packed payload tail.' });

return map;
})();
