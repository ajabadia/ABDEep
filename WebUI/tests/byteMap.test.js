/**
 * Unit tests for byte-map.js — BYTE_MAP structure, formatParamValue.
 *
 * Run with: npx vitest run WebUI/tests/byteMap.test.js
 *
 * Covers:
 *   - BYTE_MAP has 242 entries, all populated, correct structure
 *   - Spot-check specific byte offsets known to be correct
 *   - Valid entry types and regions
 *   - formatParamValue: toggle → ON/OFF, enum → label, bipolar → ±100, value → %
 *   - Fallback behaviors (missing BRIDGE_PARAM_MAPS, missing byteOffset, missing entry)
 *   - Edge cases: val=0, val=1, val=0.5, NaN, non-number
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// ══════════════════════════════════════════════════════════════════
// Full BYTE_MAP (exact copy from byte-map.js IIFE)
// ══════════════════════════════════════════════════════════════════

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

function bp(idx, param, region, type, extra = {}) {
  return { idx, param, region, type, ...extra };
}

function buildByteMap() {
  const map = [];
  for (let i = 0; i < 242; i++) map[i] = null;

  map[0]  = bp(0,  'LFO 1 Rate',          'LFO1', 'value',     { desc: '0=slow…255=fast' });
  map[1]  = bp(1,  'LFO 1 Delay/Fade',    'LFO1', 'value',     { desc: '0=no delay…255=max delay' });
  map[2]  = bp(2,  'LFO 1 Shape',         'LFO1', 'enum',      { enumLabels: ENUM_LFO_SHAPE });
  map[3]  = bp(3,  'LFO 1 Key Sync',      'LFO1', 'toggle',    { desc: '0=Off, 1=On' });
  map[4]  = bp(4,  'LFO 1 Arp Sync',      'LFO1', 'toggle',    { desc: '0=Off, 1=On' });
  map[5]  = bp(5,  'LFO 1 Mono Mode',     'LFO1', 'value',     { desc: '0=Poly, 1=Mono, 2+=Spread' });
  map[6]  = bp(6,  'LFO 1 Slew Rate',     'LFO1', 'value',     { desc: '0=no slew…255=max' });
  map[7]  = bp(7,  'LFO 2 Rate',          'LFO2', 'value',     { desc: '0=slow…255=fast' });
  map[8]  = bp(8,  'LFO 2 Delay/Fade',    'LFO2', 'value',     { desc: '0=no delay…255=max delay' });
  map[9]  = bp(9,  'LFO 2 Shape',         'LFO2', 'enum',      { enumLabels: ENUM_LFO_SHAPE });
  map[10] = bp(10, 'LFO 2 Key Sync',      'LFO2', 'toggle',    { desc: '0=Off, 1=On' });
  map[11] = bp(11, 'LFO 2 Arp Sync',      'LFO2', 'toggle',    { desc: '0=Off, 1=On' });
  map[12] = bp(12, 'LFO 2 Mono Mode',     'LFO2', 'value',     { desc: '0=Poly, 1=Mono, 2+=Spread' });
  map[13] = bp(13, 'LFO 2 Slew Rate',     'LFO2', 'value',     { desc: '0=no slew…255=max' });
  map[14] = bp(14, 'OSC 1 Range',         'OSC1', 'enum',      { enumLabels: ENUM_OSC_RANGE });
  map[15] = bp(15, 'OSC 2 Range',         'OSC2', 'enum',      { enumLabels: ENUM_OSC_RANGE });
  map[16] = bp(16, 'OSC 1 PWM Source',    'OSC1', 'enum',      { enumLabels: ENUM_PWM_SOURCE, desc: 'Selects modulation source for PWM' });
  map[17] = bp(17, 'OSC 2 Tone Mod Source','OSC2','enum',      { enumLabels: ENUM_PWM_SOURCE, desc: 'Also alias osc2_pm_source' });
  map[18] = bp(18, 'OSC 1 Pulse Enable',  'OSC1', 'toggle',    { desc: '0=Off, 1=On (square)' });
  map[19] = bp(19, 'OSC 1 Saw Enable',    'OSC1', 'toggle',    { desc: '0=Off, 1=On' });
  map[20] = bp(20, 'OSC Sync Enable',     'OSC',  'toggle',    { desc: '0=Off, 1=On (hard sync)' });
  map[21] = bp(21, 'OSC 1 Pitch Mod Depth','OSC1','value',     { desc: '0=none…255=max' });
  map[22] = bp(22, 'OSC 1 Pitch Mod Select','OSC1','enum',     { enumLabels: ENUM_PM_SELECT });
  map[23] = bp(23, 'OSC 1 AT > Pitch Mod','OSC1', 'value',     { desc: 'Aftertouch to pitch mod depth' });
  map[24] = bp(24, 'OSC 1 MW > Pitch Mod','OSC1', 'value',     { desc: 'Mod wheel to pitch mod depth' });
  map[25] = bp(25, 'OSC 1 PWM Depth',     'OSC1', 'value',     { desc: '0=none…255=max' });
  map[26] = bp(26, 'OSC 2 Level',         'OSC2', 'value',     { desc: '0=silent…255=full' });
  map[27] = bp(27, 'OSC 2 Pitch',         'OSC2', 'value',     { desc: 'Coarse pitch offset' });
  map[28] = bp(28, 'OSC 2 Tone Mod Depth','OSC2', 'value',     { desc: '0=none…255=max' });
  map[29] = bp(29, 'OSC 2 Pitch Mod Depth','OSC2','value',     { desc: '0=none…255=max' });
  map[30] = bp(30, 'OSC 2 AT > Pitch Mod','OSC2', 'value',     { desc: 'Aftertouch to pitch mod' });
  map[31] = bp(31, 'OSC 2 MW > Pitch Mod','OSC2', 'value',     { desc: 'Mod wheel to pitch mod' });
  map[32] = bp(32, 'OSC 2 Pitch Mod Select','OSC2','enum',     { enumLabels: ENUM_PM_SELECT });
  map[33] = bp(33, 'Noise Level',         'Noise','value',     { desc: '0=silent…255=loud' });
  map[34] = bp(34, 'Portamento Time',     'Porta','value',     { desc: '0=instant…255=slow' });
  map[35] = bp(35, 'Portamento Mode',     'Porta','enum',      { enumLabels: ENUM_PORTA_MODE });
  map[36] = bp(36, 'Pitch Bend Up',       'Pitch','value',     { desc: '0–24 semitones' });
  map[37] = bp(37, 'Pitch Bend Down',     'Pitch','value',     { desc: '0–24 semitones' });
  map[38] = bp(38, 'OSC 1 PM Mode',       'Pitch','toggle',    { desc: '0=OSC1+2, 1=OSC1 Only' });
  map[39] = bp(39, 'VCF Cutoff',          'VCF',  'value',     { desc: '0=closed…255=open' });
  map[40] = bp(40, 'HPF Cutoff',          'HPF',  'value',     { desc: 'Maps 20–2000 Hz' });
  map[41] = bp(41, 'VCF Resonance',       'VCF',  'value',     { desc: '0=none…255=max (self-osc)' });
  map[42] = bp(42, 'VCF Env Depth',       'VCF',  'bipolar',   { desc: '128=center, <128=neg, >128=pos' });
  map[43] = bp(43, 'VCF Env Vel Sens',    'VCF',  'value',     { desc: 'Velocity sensitivity' });
  map[44] = bp(44, 'VCF Pitch Bend Depth','VCF',  'value',     { desc: 'Pitch bend to freq' });
  map[45] = bp(45, 'VCF LFO Depth',       'VCF',  'value',     { desc: 'LFO modulation depth' });
  map[46] = bp(46, 'VCF LFO Select',      'VCF',  'toggle',    { desc: '0=LFO1, 1=LFO2' });
  map[47] = bp(47, 'VCF AT > LFO Depth',  'VCF',  'value',     { desc: 'Aftertouch to LFO' });
  map[48] = bp(48, 'VCF MW > LFO Depth',  'VCF',  'value',     { desc: 'Mod wheel to LFO' });
  map[49] = bp(49, 'VCF Key Tracking',    'VCF',  'value',     { desc: '0=none…255=full' });
  map[50] = bp(50, 'VCF Env Polarity',    'VCF',  'toggle',    { desc: '0=Negative, 1=Positive' });
  map[51] = bp(51, 'VCF 2 Pole Mode',     'VCF',  'toggle',    { desc: '0=4 Pole, 1=2 Pole' });
  map[52] = bp(52, 'HPF Boost Enable',    'HPF',  'toggle',    { desc: '0=Off, 1=On' });
  map[53] = bp(53, 'Env1 Attack',         'ENV1', 'time',      { desc: 'Scales 0–10s' });
  map[54] = bp(54, 'Env1 Decay',          'ENV1', 'time',      { desc: 'Scales 0–10s' });
  map[55] = bp(55, 'Env1 Sustain',        'ENV1', 'value',     { desc: '0=min…255=max' });
  map[56] = bp(56, 'Env1 Release',        'ENV1', 'time',      { desc: 'Scales 0–10s' });
  map[57] = bp(57, 'Env1 Trigger Mode',   'ENV1', 'enum',      { enumLabels: ENUM_ENV_TRIG });
  map[58] = bp(58, 'Env1 Attack Curve',   'ENV1', 'value',     { desc: '0=linear…255=exp' });
  map[59] = bp(59, 'Env1 Decay Curve',    'ENV1', 'value',     { desc: '0=linear…255=exp' });
  map[60] = bp(60, 'Env1 Sustain Curve',  'ENV1', 'value',     { desc: '0=linear…255=exp' });
  map[61] = bp(61, 'Env1 Release Curve',  'ENV1', 'value',     { desc: '0=linear…255=exp' });
  map[62] = bp(62, 'Env2 Attack',         'ENV2', 'time',      { desc: 'Scales 0–10s' });
  map[63] = bp(63, 'Env2 Decay',          'ENV2', 'time',      { desc: 'Scales 0–10s' });
  map[64] = bp(64, 'Env2 Sustain',        'ENV2', 'value',     { desc: '0=min…255=max' });
  map[65] = bp(65, 'Env2 Release',        'ENV2', 'time',      { desc: 'Scales 0–10s' });
  map[66] = bp(66, 'Env2 Trigger Mode',   'ENV2', 'enum',      { enumLabels: ENUM_ENV_TRIG });
  map[67] = bp(67, 'Env2 Attack Curve',   'ENV2', 'value',     { desc: '0=linear…255=exp' });
  map[68] = bp(68, 'Env2 Decay Curve',    'ENV2', 'value',     { desc: '0=linear…255=exp' });
  map[69] = bp(69, 'Env2 Sustain Curve',  'ENV2', 'value',     { desc: '0=linear…255=exp' });
  map[70] = bp(70, 'Env2 Release Curve',  'ENV2', 'value',     { desc: '0=linear…255=exp' });
  map[71] = bp(71, 'Env3 Attack',         'ENV3', 'time',      { desc: 'Scales 0–10s' });
  map[72] = bp(72, 'Env3 Decay',          'ENV3', 'time',      { desc: 'Scales 0–10s' });
  map[73] = bp(73, 'Env3 Sustain',        'ENV3', 'value',     { desc: '0=min…255=max' });
  map[74] = bp(74, 'Env3 Release',        'ENV3', 'time',      { desc: 'Scales 0–10s' });
  map[75] = bp(75, 'Env3 Trigger Mode',   'ENV3', 'enum',      { enumLabels: ENUM_ENV_TRIG });
  map[76] = bp(76, 'Env3 Attack Curve',   'ENV3', 'value',     { desc: '0=linear…255=exp' });
  map[77] = bp(77, 'Env3 Decay Curve',    'ENV3', 'value',     { desc: '0=linear…255=exp' });
  map[78] = bp(78, 'Env3 Sustain Curve',  'ENV3', 'value',     { desc: '0=linear…255=exp' });
  map[79] = bp(79, 'Env3 Release Curve',  'ENV3', 'value',     { desc: '0=linear…255=exp' });
  map[80] = bp(80, 'VCA Level',           'VCA',  'value',     { desc: '0=silent…255=full' });
  map[81] = bp(81, 'VCA Env Depth',       'VCA',  'value',     { desc: '0=none…255=full' });
  map[82] = bp(82, 'VCA Vel Sens',        'VCA',  'value',     { desc: 'Velocity sensitivity' });
  map[83] = bp(83, 'VCA Pan Spread',      'VCA',  'bipolar',   { desc: '128=center, <128=left, >128=right' });
  map[84] = bp(84, 'Note Priority',       'Voice','enum',      { enumLabels: ENUM_NOTE_PRIO });
  map[85] = bp(85, 'Voice Mode',          'Voice','enum',      { enumLabels: ENUM_VOICE_MODE });
  map[86] = bp(86, 'Trigger Mode',        'Voice','enum',      { enumLabels: ENUM_TRIG_MODE });
  map[87] = bp(87, 'Unison Detune',       'Voice','value',     { desc: '0=none…255=phat!' });
  map[88] = bp(88, 'Voice Drift',         'Voice','value',     { desc: 'Also alias osc_drift' });
  map[89] = bp(89, 'Parameter Drift',     'Voice','value',     { desc: '0=none…255=max' });
  map[90] = bp(90, 'Drift Rate',          'Voice','value',     { desc: 'How fast drift fluctuates' });
  map[91] = bp(91, 'OSC Porta Balance',   'Voice','bipolar',   { desc: '128=center, <128=osc1, >128=osc2' });
  map[92] = bp(92, 'OSC Key Down Reset',  'Voice','toggle',    { desc: '0=Off, 1=On' });
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
  map[115] = bp(115, 'Mod8 Dest / Arp GateTime', 'ModMat','dual',  { desc: 'Mod8 dest OR Arp Gate Time' });
  map[116] = bp(116, 'Mod8 Depth / Arp Swing',   'ModMat','dual',  { desc: 'Mod8 depth(bipolar) OR Arp Swing' });
  map[117] = bp(117, 'Seq Enable',               'Seq',  'toggle', { desc: '0=Off, 1=On' });
  map[118] = bp(118, 'Seq Clock Divider',        'Seq',  'enum',   { enumLabels: ENUM_SEQ_CLOCK });
  map[119] = bp(119, 'Seq Length',               'Seq',  'value',  { desc: '0=1 step…31=32 steps' });
  map[120] = bp(120, 'Seq Swing',                'Seq',  'value',  { desc: '0=50%…25=75%' });
  map[121] = bp(121, 'Seq Key Loop',             'Seq',  'enum',   { enumLabels: ENUM_KEY_LOOP });
  map[122] = bp(122, 'Seq Slew Rate',            'Seq',  'value',  { desc: '0=none…255=max' });

  for (let i = 123; i <= 154; i++) {
    const stepNum = i - 122;
    map[i] = bp(i, 'Seq Step ' + stepNum, 'SeqSteps', 'bipolar', { desc: '0=skip, 128=center, <128=neg, >128=pos' });
  }

  map[155] = bp(155, 'Arp On/Off',        'Arp',  'toggle',   { desc: '0=Off, 1=On' });
  map[156] = bp(156, 'Arp Mode',          'Arp',  'enum',     { enumLabels: ENUM_ARP_MODE });
  map[157] = bp(157, 'Arp Rate',           'Arp', 'value',    { desc: '0=20bpm…255=275bpm' });
  map[158] = bp(158, 'Arp Clock Divider',  'Arp', 'enum',     { enumLabels: ENUM_ARP_CLOCK });
  map[159] = bp(159, 'Arp Key Sync',       'Arp', 'toggle',   { desc: '0=Off, 1=On' });
  map[160] = bp(160, 'Arp Gate Time',      'Arp', 'value',    { desc: 'Also alias arp_gate' });
  map[161] = bp(161, 'Arp Hold',           'Arp', 'toggle',   { desc: '0=Off, 1=On' });
  map[162] = bp(162, 'Arp Pattern',        'Arp', 'value',    { desc: '0=None, 1-64=Presets' });
  map[163] = bp(163, 'Arp Swing',          'Arp', 'value',    { desc: '0=50%…25=75%' });
  map[164] = bp(164, 'Arp Octaves',        'Arp', 'value',    { desc: '0=1…5=6 octaves' });

  map[165] = bp(165, 'FX Routing',          'FX',  'enum',     { enumLabels: ENUM_FX_ROUTING });
  map[166] = bp(166, 'FX1 Type',            'FX1', 'value',    { desc: '0-35 (see FX Type list)' });
  map[167] = bp(167, 'FX1 Param 1',         'FX1', 'value',    { desc: 'Per-effect mapping' });
  map[168] = bp(168, 'FX1 Param 2',         'FX1', 'value',    { desc: '' });
  map[169] = bp(169, 'FX1 Param 3',         'FX1', 'value',    { desc: '' });
  map[170] = bp(170, 'FX1 Param 4',         'FX1', 'value',    { desc: '' });
  map[171] = bp(171, 'FX1 Param 5',         'FX1', 'value',    { desc: '' });
  map[172] = bp(172, 'FX1 Param 6',         'FX1', 'value',    { desc: '' });
  map[173] = bp(173, 'FX1 Param 7',         'FX1', 'value',    { desc: '' });
  map[174] = bp(174, 'FX1 Param 8',         'FX1', 'value',    { desc: '' });
  map[175] = bp(175, 'FX1 Param 9',         'FX1', 'value',    { desc: '' });
  map[176] = bp(176, 'FX1 Param 10',        'FX1', 'value',    { desc: '' });
  map[177] = bp(177, 'FX1 Param 11',        'FX1', 'value',    { desc: '' });
  map[178] = bp(178, 'FX1 Param 12',        'FX1', 'value',    { desc: '' });
  map[179] = bp(179, 'FX2 Type',            'FX2', 'value',    { desc: '0-35' });

  for (let i = 180; i <= 191; i++) {
    map[i] = bp(i, 'FX2 Param ' + (i - 179), 'FX2', 'value', { desc: '' });
  }

  map[192] = bp(192, 'FX3 Type',            'FX3', 'value',    { desc: '0-35' });
  for (let i = 193; i <= 204; i++) {
    map[i] = bp(i, 'FX3 Param ' + (i - 192), 'FX3', 'value', { desc: '' });
  }

  map[205] = bp(205, 'FX4 Type',            'FX4', 'value',    { desc: '0-35' });
  for (let i = 206; i <= 217; i++) {
    map[i] = bp(i, 'FX4 Param ' + (i - 205), 'FX4', 'value', { desc: '' });
  }

  map[218] = bp(218, 'FX1 Output Gain',     'FX1', 'value',    { desc: '0-150 (0=min…150=max)' });
  map[219] = bp(219, 'FX2 Output Gain',     'FX2', 'value',    { desc: '0-150' });
  map[220] = bp(220, 'FX3 Output Gain',     'FX3', 'value',    { desc: '0-150' });
  map[221] = bp(221, 'FX4 Output Gain',     'FX4', 'value',    { desc: '0-150' });
  map[222] = bp(222, 'FX Mode',             'FX',   'enum',    { enumLabels: ENUM_FX_MODE });
  map[223] = bp(223, '(firmware metadata)', 'Firmware', 'value', { desc: 'Firmware internal metadata. 116 unique values. Not CRC16/checksum. No DSP impact.' });

  for (let i = 224; i <= 238; i++) {
    const charIdx = i - 224;
    map[i] = bp(i, 'Program Name char[' + charIdx + ']', 'Name', 'ascii', { desc: 'ASCII character of patch name (15 chars in SysEx format)' });
  }

  map[239] = bp(239, '(name field tail)', 'Tail', 'value', { desc: 'Data after name field. raw SysEx offsets 282-284. Part of packed payload tail.' });
  map[240] = bp(240, '(name field tail)', 'Tail', 'value', { desc: 'Data after name field. raw SysEx offsets 282-284. Part of packed payload tail.' });
  map[241] = bp(241, '(name field tail)', 'Tail', 'value', { desc: 'Last unpacked byte (raw SysEx offset 284). Part of packed payload tail.' });

  return map;
}

// ══════════════════════════════════════════════════════════════════
// formatParamValue (extracted from byte-map.js)
// ══════════════════════════════════════════════════════════════════

function formatParamValue(paramId, normalizedVal) {
  if (typeof normalizedVal !== 'number' || isNaN(normalizedVal)) return '\u2014';

  var p2b = window.BRIDGE_PARAM_MAPS && window.BRIDGE_PARAM_MAPS.PARAM_TO_BYTE_OFFSET;
  var eBytes = window.BRIDGE_PARAM_MAPS && window.BRIDGE_PARAM_MAPS.ENUM_BYTES;
  if (!p2b) return Math.round(normalizedVal * 100) + '%';

  var byteOffset = p2b[paramId];
  if (byteOffset === undefined) return Math.round(normalizedVal * 100) + '%';

  var entry = window.BYTE_MAP ? window.BYTE_MAP[byteOffset] : undefined;
  if (!entry) return Math.round(normalizedVal * 100) + '%';

  var type = entry.type;

  if (type === 'toggle') {
    return normalizedVal > 0.5 ? 'ON' : 'OFF';
  }

  if (type === 'enum') {
    var maxIdx = eBytes && eBytes[byteOffset] !== undefined ? eBytes[byteOffset] : (entry.enumLabels ? entry.enumLabels.length - 1 : 0);
    var idx = Math.round(normalizedVal * maxIdx);
    if (entry.enumLabels && idx >= 0 && idx < entry.enumLabels.length) {
      return entry.enumLabels[idx];
    }
    return idx.toString();
  }

  if (type === 'bipolar') {
    var signed = Math.round((normalizedVal - 0.5) * 200);
    return (signed >= 0 ? '+' : '') + signed;
  }

  return Math.round(normalizedVal * 100) + '%';
}

// ══════════════════════════════════════════════════════════════════
// Tests: BYTE_MAP Structure
// ══════════════════════════════════════════════════════════════════

describe('BYTE_MAP structure', () => {
  let byteMap;

  beforeEach(() => {
    byteMap = buildByteMap();
  });

  it('has exactly 242 entries (indices 0-241)', () => {
    expect(byteMap.length).toBe(242);
  });

  it('has all entries populated (no null entries)', () => {
    for (let i = 0; i < 242; i++) {
      expect(byteMap[i]).not.toBeNull();
    }
  });

  it('each entry has required fields: idx, param, region, type', () => {
    for (let i = 0; i < 242; i++) {
      const entry = byteMap[i];
      expect(entry).toHaveProperty('idx');
      expect(entry).toHaveProperty('param');
      expect(entry).toHaveProperty('region');
      expect(entry).toHaveProperty('type');
    }
  });

  it('each entry index matches its array position', () => {
    for (let i = 0; i < 242; i++) {
      expect(byteMap[i].idx).toBe(i);
    }
  });

  it('has valid entry types only', () => {
    const validTypes = ['value', 'toggle', 'enum', 'bipolar', 'time', 'ascii', 'dual'];
    for (let i = 0; i < 242; i++) {
      expect(validTypes).toContain(byteMap[i].type);
    }
  });

  it('has known regions only', () => {
    const validRegions = ['LFO1','LFO2','OSC1','OSC2','OSC','Noise','Porta','Pitch','VCF','HPF',
      'ENV1','ENV2','ENV3','VCA','Voice','ModMat','Seq','SeqSteps','Arp','FX','FX1','FX2','FX3','FX4','Firmware','Name','Tail'];
    for (let i = 0; i < 242; i++) {
      expect(validRegions).toContain(byteMap[i].region);
    }
  });

  it('has correct idx for boundary positions (0, 241)', () => {
    expect(byteMap[0].idx).toBe(0);
    expect(byteMap[0].param).toBe('LFO 1 Rate');
    expect(byteMap[241].idx).toBe(241);
    expect(byteMap[241].param).toContain('tail');
  });

  it('spot-check: byte 39 is VCF Cutoff (value)', () => {
    const entry = byteMap[39];
    expect(entry.param).toBe('VCF Cutoff');
    expect(entry.region).toBe('VCF');
    expect(entry.type).toBe('value');
  });

  it('spot-check: byte 2 is LFO 1 Shape (enum with 7 labels)', () => {
    const entry = byteMap[2];
    expect(entry.param).toBe('LFO 1 Shape');
    expect(entry.region).toBe('LFO1');
    expect(entry.type).toBe('enum');
    expect(entry.enumLabels).toEqual(['Sine','Triangle','Square','Ramp Up','Ramp Down','S&H','S&G']);
  });

  it('spot-check: byte 42 is VCF Env Depth (bipolar)', () => {
    const entry = byteMap[42];
    expect(entry.param).toBe('VCF Env Depth');
    expect(entry.type).toBe('bipolar');
  });

  it('spot-check: byte 3 is LFO 1 Key Sync (toggle)', () => {
    const entry = byteMap[3];
    expect(entry.param).toBe('LFO 1 Key Sync');
    expect(entry.type).toBe('toggle');
  });

  it('spot-check: byte 85 is Voice Mode (enum with 13 labels)', () => {
    const entry = byteMap[85];
    expect(entry.param).toBe('Voice Mode');
    expect(entry.region).toBe('Voice');
    expect(entry.type).toBe('enum');
    expect(entry.enumLabels.length).toBe(13);
  });

  it('spot-check: byte 53 is Env1 Attack (time)', () => {
    const entry = byteMap[53];
    expect(entry.param).toBe('Env1 Attack');
    expect(entry.type).toBe('time');
  });

  it('spot-check: byte 105 has dual type (chord overlap)', () => {
    const entry = byteMap[105];
    expect(entry.type).toBe('dual');
    expect(entry.param).toContain('Chord');
  });

  it('spot-check: bytes 123-154 are Seq Steps (bipolar, 32 entries)', () => {
    for (let i = 123; i <= 154; i++) {
      expect(byteMap[i].region).toBe('SeqSteps');
      expect(byteMap[i].type).toBe('bipolar');
      expect(byteMap[i].param).toContain('Seq Step');
    }
  });

  it('spot-check: bytes 224-238 are Program Name chars (ascii, 15 entries)', () => {
    for (let i = 224; i <= 238; i++) {
      expect(byteMap[i].region).toBe('Name');
      expect(byteMap[i].type).toBe('ascii');
      expect(byteMap[i].param).toContain('Program Name char');
    }
  });

  it('enum entries have either enumLabels array or string desc', () => {
    for (let i = 0; i < 242; i++) {
      if (byteMap[i].type === 'enum') {
        // Some enum entries (e.g. Mod Matrix source/dest slots 0-22, 0-129)
        // are too large to enumerate and only have desc.
        const hasEnumLabels = Array.isArray(byteMap[i].enumLabels);
        const hasDesc = typeof byteMap[i].desc === 'string';
        expect(hasEnumLabels || hasDesc).toBe(true);
        if (hasEnumLabels) {
          expect(byteMap[i].enumLabels.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('toggle entries do NOT have enumLabels', () => {
    for (let i = 0; i < 242; i++) {
      if (byteMap[i].type === 'toggle') {
        expect(byteMap[i].enumLabels).toBeUndefined();
      }
    }
  });

  it('value and time entries have string description (may be empty)', () => {
    for (let i = 0; i < 242; i++) {
      if (byteMap[i].type === 'value' || byteMap[i].type === 'time') {
        expect(typeof byteMap[i].desc).toBe('string');
      }
    }
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: formatParamValue
// ══════════════════════════════════════════════════════════════════

describe('formatParamValue', () => {
  /** Mock BRIDGE_PARAM_MAPS for the test scope */
  const mockBridgeParamMaps = {
    PARAM_TO_BYTE_OFFSET: {
      'vcf_cutoff': 39,
      'lfo1_shape': 2,
      'lfo1_key_sync': 3,
      'vcf_env_depth': 42,
      'env1_attack': 53,
      'vcf_pole_mode': 51,
      'unknown_param': undefined,
    },
    ENUM_BYTES: {
      2: 6,   // LFO1 Shape: 0-6
      51: 1,  // VCF pole mode: 0-1
    },
  };

  let byteMap;

  beforeEach(() => {
    byteMap = buildByteMap();
    vi.stubGlobal('window', {
      BYTE_MAP: byteMap,
      BRIDGE_PARAM_MAPS: mockBridgeParamMaps,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── Edge cases ──

  it('returns em-dash for NaN input', () => {
    expect(formatParamValue('vcf_cutoff', NaN)).toBe('\u2014');
  });

  it('returns em-dash for non-number input', () => {
    expect(formatParamValue('vcf_cutoff', 'abc')).toBe('\u2014');
    expect(formatParamValue('vcf_cutoff', null)).toBe('\u2014');
    expect(formatParamValue('vcf_cutoff', undefined)).toBe('\u2014');
  });

  // ── Value type (default percentage) ──

  it('returns percentage for value type', () => {
    expect(formatParamValue('vcf_cutoff', 0.5)).toBe('50%');
    expect(formatParamValue('vcf_cutoff', 0.0)).toBe('0%');
    expect(formatParamValue('vcf_cutoff', 1.0)).toBe('100%');
    expect(formatParamValue('vcf_cutoff', 0.333)).toBe('33%');
  });

  // ── Toggle type ──

  it('returns ON for toggle when val > 0.5', () => {
    expect(formatParamValue('lfo1_key_sync', 1.0)).toBe('ON');
    expect(formatParamValue('lfo1_key_sync', 0.51)).toBe('ON');
  });

  it('returns OFF for toggle when val <= 0.5', () => {
    expect(formatParamValue('lfo1_key_sync', 0.0)).toBe('OFF');
    expect(formatParamValue('lfo1_key_sync', 0.5)).toBe('OFF');
    expect(formatParamValue('lfo1_key_sync', 0.49)).toBe('OFF');
  });

  it('handles vcf_pole_mode toggle with byte offset 51', () => {
    // byte 51 type is 'toggle' with desc "0=4 Pole, 1=2 Pole"
    expect(formatParamValue('vcf_pole_mode', 0.0)).toBe('OFF');
    expect(formatParamValue('vcf_pole_mode', 1.0)).toBe('ON');
  });

  // ── Enum type ──

  it('returns enum label from ENUM_BYTES mapping', () => {
    // lfo1_shape byteOffset=2, ENUM_BYTES[2]=6, val=3/6=0.5 → idx=3 → 'Ramp Up'
    expect(formatParamValue('lfo1_shape', 3.0 / 6.0)).toBe('Ramp Up');
  });

  it('returns enum label at max value (index 6)', () => {
    // val=1.0 → idx=6 → 'S&G'
    expect(formatParamValue('lfo1_shape', 1.0)).toBe('S&G');
  });

  it('returns enum label at min value (index 0)', () => {
    expect(formatParamValue('lfo1_shape', 0.0)).toBe('Sine');
  });

  it('returns enum label from enumLabels length when ENUM_BYTES missing', () => {
    // Use byte 85 (Voice Mode) which has 13 enumLabels but no ENUM_BYTES entry
    vi.stubGlobal('window', {
      BYTE_MAP: byteMap,
      BRIDGE_PARAM_MAPS: {
        ...mockBridgeParamMaps,
        PARAM_TO_BYTE_OFFSET: { 'voice_mode': 85 },
        ENUM_BYTES: {},
      },
    });
    // val=0 → idx=0 → 'Poly'
    expect(formatParamValue('voice_mode', 0.0)).toBe('Poly');
    // val=1.0 → idx=12 → 'Poly8'  (13 labels, maxIdx=12)
    expect(formatParamValue('voice_mode', 1.0)).toBe('Poly8');
  });

  it('returns numeric index when enumLabels is missing', () => {
    // Use byte 93 (Mod Matrix Slot1 Source) which is enum but no enumLabels in entry
    vi.stubGlobal('window', {
      BYTE_MAP: byteMap,
      BRIDGE_PARAM_MAPS: {
        ...mockBridgeParamMaps,
        PARAM_TO_BYTE_OFFSET: { 'mod_slot1_source': 93 },
        ENUM_BYTES: { 93: 22 },
      },
    });
    expect(formatParamValue('mod_slot1_source', 0.0)).toBe('0');
    expect(formatParamValue('mod_slot1_source', 0.5)).toBe('11');
    expect(formatParamValue('mod_slot1_source', 1.0)).toBe('22');
  });

  // ── Bipolar type ──

  it('returns bipolar format: val=0.5 → +0 (center)', () => {
    expect(formatParamValue('vcf_env_depth', 0.5)).toBe('+0');
  });

  it('returns bipolar format: val=0 → -100', () => {
    expect(formatParamValue('vcf_env_depth', 0.0)).toBe('-100');
  });

  it('returns bipolar format: val=1 → +100', () => {
    expect(formatParamValue('vcf_env_depth', 1.0)).toBe('+100');
  });

  it('returns bipolar format: val=0.25 → -50', () => {
    // (0.25 - 0.5) * 200 = -50
    expect(formatParamValue('vcf_env_depth', 0.25)).toBe('-50');
  });

  it('returns bipolar format: val=0.75 → +50', () => {
    // (0.75 - 0.5) * 200 = 50
    expect(formatParamValue('vcf_env_depth', 0.75)).toBe('+50');
  });

  // ── Fallback behaviors ──

  it('falls back to percentage when BRIDGE_PARAM_MAPS is missing', () => {
    vi.stubGlobal('window', { BYTE_MAP: byteMap });
    expect(formatParamValue('vcf_cutoff', 0.5)).toBe('50%');
  });

  it('falls back to percentage when PARAM_TO_BYTE_OFFSET is missing', () => {
    vi.stubGlobal('window', {
      BYTE_MAP: byteMap,
      BRIDGE_PARAM_MAPS: {},
    });
    expect(formatParamValue('vcf_cutoff', 0.5)).toBe('50%');
  });

  it('falls back to percentage when byteOffset not found for paramId', () => {
    expect(formatParamValue('unknown_param', 0.5)).toBe('50%');
  });

  it('falls back to percentage when BYTE_MAP entry missing for byteOffset', () => {
    // Use a byteOffset that's not in BYTE_MAP (shouldn't happen in practice)
    vi.stubGlobal('window', {
      BYTE_MAP: byteMap,
      BRIDGE_PARAM_MAPS: {
        PARAM_TO_BYTE_OFFSET: { 'fake_param': 999 },
      },
    });
    expect(formatParamValue('fake_param', 0.5)).toBe('50%');
  });

  it('falls back to percentage when BYTE_MAP is not defined', () => {
    vi.stubGlobal('window', {
      BRIDGE_PARAM_MAPS: mockBridgeParamMaps,
    });
    expect(formatParamValue('vcf_cutoff', 0.5)).toBe('50%');
  });

  // ── Time type (treated as value → percentage) ──

  it('returns percentage for time type', () => {
    expect(formatParamValue('env1_attack', 0.5)).toBe('50%');
    expect(formatParamValue('env1_attack', 0.0)).toBe('0%');
    expect(formatParamValue('env1_attack', 1.0)).toBe('100%');
  });
});
