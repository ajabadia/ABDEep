/**
 * @purpose Data constants and helpers for the SysEx dump viewer.
 * @purpose_en Dump viewer data: region colors, tooltip formatting.
 */

const DUMP_REGION_COLORS = {
  'LFO1':    {bg:'#1a2a3a', fg:'#7fc8ff'},
  'LFO2':    {bg:'#1a2a3a', fg:'#7fc8ff'},
  'OSC1':    {bg:'#2a1a3a', fg:'#c87fff'},
  'OSC2':    {bg:'#2a1a3a', fg:'#c87fff'},
  'OSC':     {bg:'#2a1a3a', fg:'#c87fff'},
  'Noise':   {bg:'#1a1a2a', fg:'#7f7fff'},
  'Porta':   {bg:'#1a2a1a', fg:'#7fff7f'},
  'Pitch':   {bg:'#1a2a1a', fg:'#7fff7f'},
  'VCF':     {bg:'#1a3a2a', fg:'#7fffaf'},
  'HPF':     {bg:'#1a3a2a', fg:'#7fffaf'},
  'ENV1':    {bg:'#3a2a1a', fg:'#ffc87f'},
  'ENV2':    {bg:'#3a2a1a', fg:'#ffc87f'},
  'ENV3':    {bg:'#3a2a1a', fg:'#ffc87f'},
  'VCA':     {bg:'#2a3a1a', fg:'#afff7f'},
  'Voice':   {bg:'#2a1a1a', fg:'#ff7f7f'},
  'ModMat':  {bg:'#1a1a3a', fg:'#7f7fff'},
  'Seq':     {bg:'#2a2a1a', fg:'#ffff7f'},
  'SeqSteps':{bg:'#2a2a1a', fg:'#ffff7f'},
  'Arp':     {bg:'#1a2a2a', fg:'#7fffff'},
  'FX':      {bg:'#2a1a2a', fg:'#ff7fff'},
  'FX1':     {bg:'#2a1a2a', fg:'#ff7fff'},
  'FX2':     {bg:'#2a1a2a', fg:'#ff7fff'},
  'FX3':     {bg:'#2a1a2a', fg:'#ff7fff'},
  'FX4':     {bg:'#2a1a2a', fg:'#ff7fff'},
  'Name':    {bg:'#1a1a1a', fg:'#cccccc'},
  'Tail':     {bg:'#1e1a14', fg:'#998866'},
  'Firmware': {bg:'#141e28', fg:'#88aacc'},
  '?':        {bg:'#1a1a1a', fg:'#666666'},
};

const RESERVED_REGION = '?';
const DEFAULT_REGION_COLOR = {bg:'#111', fg:'#888'};

function getRegionColor(region) {
  return DUMP_REGION_COLORS[region] || DEFAULT_REGION_COLOR;
}

function formatTooltip(info, val) {
  const pct = (val / 255 * 100).toFixed(1);
  const lines = ['Byte ' + info.idx + ' \u2014 ' + info.param];
  lines.push('Region: ' + info.region + ' | Type: ' + info.type);
  lines.push('Value: ' + val + ' (0x' + val.toString(16).toUpperCase().padStart(2,'0') + ') [' + pct + '%]');

  if (info.type === 'toggle') {
    lines.push('\u2192 ' + (val > 0 ? 'ON (1)' : 'OFF (0)'));
  } else if (info.type === 'enum' && info.enumLabels) {
    const idx = Math.min(val, info.enumLabels.length - 1);
    lines.push('\u2192 ' + info.enumLabels[idx] + ' (index ' + idx + ')');
  } else if (info.type === 'bipolar') {
    const bipolar = val - 128;
    lines.push('\u2192 Bipolar: ' + bipolar + ' (center=0, range -128..+127)');
    if (val === 128) {lines.push('\u2192 Center (no modulation)');}
    else if (val === 0) {lines.push('\u2192 Skip step (seq) or min');}
  } else if (info.type === 'time') {
    const secs = (val / 255 * 10).toFixed(3);
    lines.push('\u2192 ' + secs + 's');
  } else if (info.type === 'ascii') {
    const ch = val >= 32 && val < 127 ? String.fromCharCode(val) : '\u00b7';
    lines.push('\u2192 \'' + ch + '\'');
  }

  if (info.desc) {lines.push('Note: ' + info.desc);}

  return lines.join('\n');
}
