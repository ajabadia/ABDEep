/**
 * Unit tests for bar generator functions (_genFillBar, _genPosBar, _genBarHtml).
 *
 * Migrated from legacy WebUI/tests/test_bar_generators.js (18 tests) to Vitest,
 * with expanded coverage including _genBarHtml and additional edge cases.
 *
 * Run with: npx vitest run WebUI/tests/barGenerators.test.js
 *
 * Source: WebUI/js/script.js (window._genFillBar, window._genPosBar, window._genBarHtml)
 *
 * Covers:
 *   - _genFillBar: fill/total length, defaults, clamping, rounding
 *   - _genPosBar: position markers, clamping, rounding, defaults
 *   - _genBarHtml: span wrapper, color, letterSpacing, suffix options
 *   - Edge cases: empty strings, out-of-bounds, custom chars, identity
 *   - Round-trip: genFillBar → genBarHtml HTML output verification
 */

import { describe, it, expect } from 'vitest';

// ══════════════════════════════════════════════════════════════════
// Functions under test (copied verbatim from script.js lines 1978-2019)
// ══════════════════════════════════════════════════════════════════

const FILL = '\u2588';  // █
const EMPTY = '\u2591'; // ░

function _genFillBar(fillLen, totalLen, fillChar, emptyChar) {
  if (totalLen === undefined) totalLen = 18;
  if (fillChar === undefined) fillChar = FILL;
  if (emptyChar === undefined) emptyChar = EMPTY;
  fillLen = Math.max(0, Math.round(fillLen));
  return fillChar.repeat(Math.min(fillLen, totalLen)) + emptyChar.repeat(Math.max(0, totalLen - fillLen));
}

function _genPosBar(pos, totalLen, fillChar, emptyChar) {
  if (totalLen === undefined) totalLen = 18;
  if (fillChar === undefined) fillChar = FILL;
  if (emptyChar === undefined) emptyChar = EMPTY;
  pos = Math.max(0, Math.min(Math.round(pos), totalLen - 1));
  return emptyChar.repeat(pos) + fillChar + emptyChar.repeat(Math.max(0, totalLen - pos - 1));
}

function _genBarHtml(bar, opts) {
  opts = opts || {};
  var colorStyle = opts.color ? 'color:' + opts.color + ';' : '';
  var lsStyle = opts.letterSpacing !== undefined ? 'letter-spacing:' + opts.letterSpacing + ';' : '';
  var suffix = opts.suffix || '';
  return '<span style="font-size:12px;' + colorStyle + lsStyle + '">' + bar + '</span>' + suffix;
}

// ══════════════════════════════════════════════════════════════════
// _genFillBar
// ══════════════════════════════════════════════════════════════════

describe('_genFillBar', () => {

  it('fillLen=0 → all empty chars', () => {
    const result = _genFillBar(0, 10);
    expect(result.length).toBe(10);
    expect(result).toBe(EMPTY.repeat(10));
    expect(result).not.toContain(FILL);
  });

  it('fillLen=totalLen → full bar', () => {
    const result = _genFillBar(10, 10);
    expect(result.length).toBe(10);
    expect(result).toBe(FILL.repeat(10));
    expect(result).not.toContain(EMPTY);
  });

  it('fillLen > totalLen → clamped to totalLen', () => {
    const result = _genFillBar(20, 10);
    expect(result.length).toBe(10);
    expect(result).toBe(FILL.repeat(10));
  });

  it('fillLen half → 5 fill + 5 empty', () => {
    const result = _genFillBar(5, 10);
    expect(result.length).toBe(10);
    expect(result).toBe(FILL.repeat(5) + EMPTY.repeat(5));
  });

  it('fillLen negative → clamped to 0 (all empty)', () => {
    const result = _genFillBar(-5, 10);
    expect(result.length).toBe(10);
    expect(result).toBe(EMPTY.repeat(10));
  });

  it('fillLen float → rounded via Math.round', () => {
    const result = _genFillBar(3.7, 10);
    expect(result.length).toBe(10);
    expect(result).toBe(FILL.repeat(4) + EMPTY.repeat(6)); // 3.7 → round(3.7) = 4
  });

  it('default totalLen = 18', () => {
    const result = _genFillBar(5);
    expect(result.length).toBe(18);
    expect(result).toBe(FILL.repeat(5) + EMPTY.repeat(13));
  });

  it('custom fillChar and emptyChar', () => {
    const result = _genFillBar(4, 8, '*', '.');
    expect(result).toBe('****....');
  });

  it('totalLen=0 → empty string', () => {
    const result = _genFillBar(0, 0);
    expect(result.length).toBe(0);
    expect(result).toBe('');
  });

  it('totalLen=1 edge cases', () => {
    expect(_genFillBar(0, 1)).toBe(EMPTY);
    expect(_genFillBar(1, 1)).toBe(FILL);
    expect(_genFillBar(5, 1)).toBe(FILL); // clamped
  });

  it('fillChar longer than 1 char (string pattern)', () => {
    const result = _genFillBar(3, 5, '##');
    // fillChar='##' repeated 3 times = '######', then empty (░) x 2
    expect(result).toBe('######' + EMPTY.repeat(2));
    // Note: length exceeds totalLen when fillChar is multi-character
    expect(result.length).toBe(8); // 3*'##' + 2*'░'
  });

  it('fillLen exactly 0 with large totalLen', () => {
    const result = _genFillBar(0, 100);
    expect(result.length).toBe(100);
    expect(result).toBe(EMPTY.repeat(100));
  });

  it('fillLen exactly at totalLen boundary', () => {
    const result = _genFillBar(18, 18);
    expect(result.length).toBe(18);
    expect(result).toBe(FILL.repeat(18));
  });

  it('fillLen float near integer (0.1 → 0, 0.9 → 1)', () => {
    expect(_genFillBar(0.1, 5)).toBe(EMPTY.repeat(5)); // round(0.1) = 0
    expect(_genFillBar(0.9, 5)).toBe(FILL + EMPTY.repeat(4)); // round(0.9) = 1
  });

  it('fillLen non-integer default totalLen', () => {
    const result = _genFillBar(9.2);
    expect(result.length).toBe(18);
    expect(result).toBe(FILL.repeat(9) + EMPTY.repeat(9));
  });

  it('identity: full bar with custom empty has no empty chars', () => {
    const result = _genFillBar(8, 8, '#', '-');
    expect(result).toBe('########');
    expect(result).not.toContain('-');
  });

  it('identity: empty bar with custom fill has no fill chars', () => {
    const result = _genFillBar(0, 8, '#', '-');
    expect(result).toBe('--------');
    expect(result).not.toContain('#');
  });

  it('output length always equals totalLen (positive)', () => {
    for (let fill = 0; fill <= 12; fill++) {
      const result = _genFillBar(fill, 12);
      expect(result.length).toBe(12);
    }
  });

  it('unchanged when totalLen omitted and fillLen=totalLen', () => {
    const result = _genFillBar(18);
    expect(result).toBe(FILL.repeat(18));
  });
});

// ══════════════════════════════════════════════════════════════════
// _genPosBar
// ══════════════════════════════════════════════════════════════════

describe('_genPosBar', () => {

  it('pos=0 → fill at first position', () => {
    const result = _genPosBar(0, 10);
    expect(result.length).toBe(10);
    expect(result).toBe(FILL + EMPTY.repeat(9));
  });

  it('pos=last (totalLen-1) → fill at last position', () => {
    const result = _genPosBar(9, 10);
    expect(result.length).toBe(10);
    expect(result).toBe(EMPTY.repeat(9) + FILL);
  });

  it('pos negative → clamped to 0', () => {
    const result = _genPosBar(-3, 10);
    expect(result.length).toBe(10);
    expect(result).toBe(FILL + EMPTY.repeat(9));
  });

  it('pos > totalLen-1 → clamped to last position', () => {
    const result = _genPosBar(20, 10);
    expect(result.length).toBe(10);
    expect(result).toBe(EMPTY.repeat(9) + FILL);
  });

  it('pos float → rounded via Math.round', () => {
    const result = _genPosBar(3.7, 10);
    expect(result.length).toBe(10);
    expect(result).toBe(EMPTY.repeat(4) + FILL + EMPTY.repeat(5)); // round(3.7) = 4
  });

  it('default totalLen = 18', () => {
    const result = _genPosBar(5);
    expect(result.length).toBe(18);
    expect(result[5]).toBe(FILL);
    expect(result.indexOf(FILL)).toBe(5); // exactly one fill char
  });

  it('custom fillChar and emptyChar', () => {
    const result = _genPosBar(3, 8, 'X', '_');
    expect(result).toBe('___X____');
  });

  it('totalLen=1 → always single fill char', () => {
    expect(_genPosBar(0, 1)).toBe(FILL);
    expect(_genPosBar(5, 1)).toBe(FILL);  // clamped
    expect(_genPosBar(-2, 1)).toBe(FILL); // clamped
  });

  it('exactly 1 fill character at correct position', () => {
    const result = _genPosBar(7, 15);
    const fillCount = (result.match(/\u2588/g) || []).length;
    expect(fillCount).toBe(1);
    expect(result[7]).toBe(FILL);
  });

  it('pos=midpoint (5) in length 11 → position 5', () => {
    const result = _genPosBar(5, 11);
    expect(result.length).toBe(11);
    expect(result).toBe(EMPTY.repeat(5) + FILL + EMPTY.repeat(5));
  });

  it('pos float near integer (0.1 → 0, 0.9 → 1)', () => {
    expect(_genPosBar(0.1, 5)).toBe(FILL + EMPTY.repeat(4)); // round(0.1) = 0
    expect(_genPosBar(0.9, 5)).toBe(EMPTY + FILL + EMPTY.repeat(3)); // round(0.9) = 1
  });

  it('pos exactly at totalLen-1 boundary', () => {
    const result = _genPosBar(17, 18);
    expect(result.length).toBe(18);
    expect(result).toBe(EMPTY.repeat(17) + FILL);
  });

  it('default totalLen = 18 for pos=0', () => {
    const result = _genPosBar(0);
    expect(result.length).toBe(18);
    expect(result).toBe(FILL + EMPTY.repeat(17));
  });

  it('unchanged when totalLen omitted and pos=0', () => {
    const result = _genPosBar(0);
    expect(result.length).toBe(18);
    expect(result[0]).toBe(FILL);
  });

  it('fill char appears exactly once regardless of position', () => {
    for (let pos = 0; pos < 10; pos++) {
      const result = _genPosBar(pos, 10);
      const fillCount = (result.match(/\u2588/g) || []).length;
      expect(fillCount).toBe(1);
    }
  });
});

// ══════════════════════════════════════════════════════════════════
// _genBarHtml
// ══════════════════════════════════════════════════════════════════

describe('_genBarHtml', () => {

  it('wraps bar string in span with default style', () => {
    const bar = FILL.repeat(5) + EMPTY.repeat(5);
    const result = _genBarHtml(bar);
    expect(result).toContain('<span');
    expect(result).toContain('</span>');
    expect(result).toContain('font-size:12px');
    expect(result).toContain(bar);
  });

  it('adds color option as inline style', () => {
    const result = _genBarHtml('█████', { color: 'var(--accent-green)' });
    expect(result).toContain('color:var(--accent-green)');
  });

  it('adds letterSpacing option as inline style', () => {
    const result = _genBarHtml('█████', { letterSpacing: '0' });
    expect(result).toContain('letter-spacing:0');
  });

  it('adds suffix after closing span', () => {
    const result = _genBarHtml('██', { suffix: ' <span>extra</span>' });
    expect(result).toMatch(/<\/span>\s*<span>extra<\/span>$/);
  });

  it('combines color, letterSpacing, and suffix', () => {
    const result = _genBarHtml('█████', {
      color: 'var(--accent-pink)',
      letterSpacing: '2px',
      suffix: ' 100%',
    });
    expect(result).toContain('color:var(--accent-pink)');
    expect(result).toContain('letter-spacing:2px');
    expect(result).toContain('100%');
  });

  it('returns span even for empty bar string', () => {
    const result = _genBarHtml('');
    expect(result).toBe('<span style="font-size:12px;"></span>');
  });

  it('handles opts=undefined gracefully (defaults)', () => {
    const result = _genBarHtml('██', undefined);
    expect(result).toBe('<span style="font-size:12px;">██</span>');
  });

  it('handles opts={} (no extra styles)', () => {
    const result = _genBarHtml('██', {});
    expect(result).toBe('<span style="font-size:12px;">██</span>');
  });

  it('suffix can be empty string', () => {
    const result = _genBarHtml('██', { suffix: '' });
    expect(result).toBe('<span style="font-size:12px;">██</span>');
    expect(result).not.toMatch(/undefined/);
  });

  it('color option with semicolons does not break HTML', () => {
    // Multiple CSS properties as color (malicious input test)
    const result = _genBarHtml('██', { color: 'red;background:green' });
    expect(result).toContain('color:red;background:green');
    expect(result).toContain('</span>');
  });
});

// ══════════════════════════════════════════════════════════════════
// _genLcdBarHtml — 3 types: arp, seq, seq_preset
// ══════════════════════════════════════════════════════════════════
// Source: script.js window._genLcdBarHtml(type, opts)
//   - arp:    color=var(--accent-primary), header + stepInfo + bar
//   - seq:    color=var(--accent-pink),    header + stepInfo + bar
//   - seq_preset: color=var(--accent-pink), header + presetName + bar + meta
//   - decorated: opcional, cambia headerStyle a font-size:7px con color

function _genLcdBarHtml(type, opts) {
  var barColor = (type === 'seq' || type === 'seq_preset') ? 'var(--accent-pink)' : 'var(--accent-primary)';
  var bar = opts.bar || '';

  if (type === 'seq_preset') {
    return '<span style="font-size:9px; opacity:0.6;">' + opts.header + '</span><br>'
      + '<strong style="color:' + barColor + ';font-size:9px;">' + opts.presetName + '</strong><br>'
      + '<span style="font-size:7px; letter-spacing:1px; color:var(--text-faint);">' + bar + '</span><br>'
      + '<span style="font-size:7px; color:var(--text-dim);">' + opts.meta + '</span>';
  }

  var headerStyle = opts.decorated
    ? 'font-size:7px; opacity:0.6; color:' + barColor + ';'
    : 'font-size:9px; opacity:0.6;';

  return '<span style="' + headerStyle + '">' + opts.header + '</span><br>'
    + '<span style="font-size:9px; color:' + barColor + '; font-weight:bold;">' + opts.stepInfo + '</span><br>'
    + '<span style="font-size:7px; letter-spacing:1px; color:var(--text-faint);">' + bar + '</span>';
}

describe('_genLcdBarHtml — type arp', () => {
  it('produces header, stepInfo, and bar in correct structure', () => {
    const result = _genLcdBarHtml('arp', {
      header: 'ARP RESET #1',
      stepInfo: 'Step 3 · 5 notes held',
      bar: FILL.repeat(8) + EMPTY.repeat(10),
    });
    expect(result).toContain('ARP RESET #1');
    expect(result).toContain('Step 3 · 5 notes held');
    expect(result).toContain(FILL.repeat(8) + EMPTY.repeat(10));
    expect(result).toContain('var(--accent-primary)');
  });

  it('header span uses font-size:9px opacity:0.6 by default', () => {
    const result = _genLcdBarHtml('arp', {
      header: 'TEST',
      stepInfo: 'Info',
      bar: '█',
    });
    expect(result).toContain('<span style="font-size:9px; opacity:0.6;">');
    expect(result).toContain('TEST');
    expect(result).toContain('</span><br>');
  });

  it('decorated=true uses font-size:7px with accent color in header', () => {
    const result = _genLcdBarHtml('arp', {
      header: '─── ARP RESET #2 ───',
      stepInfo: 'Step 0 · 0 notes held',
      bar: '',
      decorated: true,
    });
    expect(result).toContain('font-size:7px; opacity:0.6; color:var(--accent-primary);');
    expect(result).toContain('─── ARP RESET #2 ───');
  });

  it('stepInfo span uses bold, 9px, and barColor', () => {
    const result = _genLcdBarHtml('arp', {
      header: 'H',
      stepInfo: 'My Step Info',
      bar: '█',
    });
    expect(result).toContain('<span style="font-size:9px; color:var(--accent-primary); font-weight:bold;">');
    expect(result).toContain('My Step Info');
  });

  it('bar span uses 7px, letter-spacing:1px, text-faint', () => {
    const result = _genLcdBarHtml('arp', {
      header: 'H',
      stepInfo: 'S',
      bar: '████',
    });
    expect(result).toContain('<span style="font-size:7px; letter-spacing:1px; color:var(--text-faint);">');
    expect(result).toContain('████');
  });

  it('empty bar defaults to empty string', () => {
    const result = _genLcdBarHtml('arp', {
      header: 'H',
      stepInfo: 'S',
    });
    expect(result).toContain('font-size:7px; letter-spacing:1px; color:var(--text-faint);">');
  });

  it('output has exactly 2 <br> separators (header + stepInfo, no <br> after bar)', () => {
    const result = _genLcdBarHtml('arp', {
      header: 'H',
      stepInfo: 'S',
      bar: '█',
    });
    const breaks = (result.match(/<br>/g) || []).length;
    expect(breaks).toBe(2);
  });

  it('no decorated option defaults to decorated=false', () => {
    const noOpt = _genLcdBarHtml('arp', { header: 'H', stepInfo: 'S', bar: '█' });
    const explicit = _genLcdBarHtml('arp', { header: 'H', stepInfo: 'S', bar: '█', decorated: false });
    expect(noOpt).toBe(explicit);
  });
});

describe('_genLcdBarHtml — type seq', () => {
  it('produces header, stepInfo, and bar in correct structure', () => {
    const result = _genLcdBarHtml('seq', {
      header: 'SEQUENCER RESET #1',
      stepInfo: 'Step 7 · 3 notes · 16 steps',
      bar: FILL.repeat(12) + EMPTY.repeat(6),
    });
    expect(result).toContain('SEQUENCER RESET #1');
    expect(result).toContain('Step 7 · 3 notes · 16 steps');
    expect(result).toContain(FILL.repeat(12) + EMPTY.repeat(6));
    expect(result).toContain('var(--accent-pink)');
  });

  it('color is var(--accent-pink) instead of var(--accent-primary)', () => {
    const arpResult = _genLcdBarHtml('arp', { header: 'H', stepInfo: 'S', bar: '█' });
    const seqResult = _genLcdBarHtml('seq', { header: 'H', stepInfo: 'S', bar: '█' });
    expect(arpResult).toContain('var(--accent-primary)');
    expect(seqResult).toContain('var(--accent-pink)');
    expect(seqResult).not.toContain('var(--accent-primary)');
  });

  it('decorated=true uses font-size:7px with accent-pink in header', () => {
    const result = _genLcdBarHtml('seq', {
      header: '─── SEQ RESET #3 ───',
      stepInfo: 'Step 5 · 2 notes · 8 steps',
      bar: '',
      decorated: true,
    });
    expect(result).toContain('font-size:7px; opacity:0.6; color:var(--accent-pink);');
    expect(result).toContain('─── SEQ RESET #3 ───');
  });

  it('decorated=false explicit matches default behavior', () => {
    const decorated = _genLcdBarHtml('seq', { header: 'H', stepInfo: 'S', bar: '█', decorated: true });
    const notDecorated = _genLcdBarHtml('seq', { header: 'H', stepInfo: 'S', bar: '█', decorated: false });
    expect(notDecorated).toContain('font-size:9px; opacity:0.6;');
    expect(decorated).not.toContain('font-size:9px; opacity:0.6;');
    expect(decorated).toContain('font-size:7px');
  });

  it('bar appears after stepInfo in the output string', () => {
    const result = _genLcdBarHtml('seq', {
      header: 'HEADER',
      stepInfo: 'STEPINFO',
      bar: '███',
    });
    const stepInfoIdx = result.indexOf('STEPINFO');
    const barIdx = result.indexOf('███');
    expect(barIdx).toBeGreaterThan(stepInfoIdx);
  });

  it('last <br> appears before bar', () => {
    const result = _genLcdBarHtml('seq', {
      header: 'H',
      stepInfo: 'S',
      bar: 'BAR',
    });
    const lastBr = result.lastIndexOf('<br>');
    const barIdx = result.indexOf('BAR');
    expect(barIdx).toBeGreaterThan(lastBr);
  });
});

describe('_genLcdBarHtml — type seq_preset', () => {
  it('produces header, presetName, bar, and meta in correct structure', () => {
    const result = _genLcdBarHtml('seq_preset', {
      header: 'SEQ PRESET LOADED',
      presetName: 'Staircase Ramp',
      bar: EMPTY.repeat(5) + FILL + EMPTY.repeat(12),
      meta: '32 steps · avg pos: 16',
    });
    expect(result).toContain('SEQ PRESET LOADED');
    expect(result).toContain('Staircase Ramp');
    expect(result).toContain(EMPTY.repeat(5) + FILL + EMPTY.repeat(12));
    expect(result).toContain('32 steps · avg pos: 16');
    expect(result).toContain('var(--accent-pink)');
  });

  it('has different HTML structure than arp/seq (4 lines vs 3)', () => {
    const seqPreset = _genLcdBarHtml('seq_preset', {
      header: 'H', presetName: 'P', bar: '█', meta: 'M' });
    const seq = _genLcdBarHtml('seq', { header: 'H', stepInfo: 'S', bar: '█' });
    const presetBrCount = (seqPreset.match(/<br>/g) || []).length;
    const seqBrCount = (seq.match(/<br>/g) || []).length;
    expect(presetBrCount).toBe(3); // seq_preset has 3 <br> (header, presetName, bar)
    expect(seqBrCount).toBe(2);     // seq has 2 <br> (header, stepInfo)
  });

  it('presetName uses strong tag with 9px and barColor', () => {
    const result = _genLcdBarHtml('seq_preset', {
      header: 'H', presetName: 'Triangle', bar: '█', meta: 'M' });
    expect(result).toContain('<strong style="color:var(--accent-pink);font-size:9px;">Triangle</strong>');
  });

  it('meta span uses 7px and text-dim', () => {
    const result = _genLcdBarHtml('seq_preset', {
      header: 'H', presetName: 'P', bar: '█', meta: '32 steps' });
    expect(result).toContain('<span style="font-size:7px; color:var(--text-dim);">32 steps</span>');
  });

  it('header span uses 9px opacity:0.6 (no decorated option for seq_preset)', () => {
    const result = _genLcdBarHtml('seq_preset', {
      header: 'LOADED', presetName: 'P', bar: '█', meta: 'M' });
    expect(result).toContain('<span style="font-size:9px; opacity:0.6;">LOADED</span>');
  });

  it('color matches seq (accent-pink) since seq_preset also uses accent-pink', () => {
    const presetResult = _genLcdBarHtml('seq_preset', {
      header: 'H', presetName: 'P', bar: '█', meta: 'M' });
    expect(presetResult).toContain('var(--accent-pink)');
    expect(presetResult).not.toContain('var(--accent-primary)');
  });
});

describe('_genLcdBarHtml — edge cases', () => {
  it('unknown type falls through to arp/seq structure (not seq_preset)', () => {
    const result = _genLcdBarHtml('unknown', {
      header: 'H', stepInfo: 'S', bar: '█' });
    // arp/seq path uses stepInfo param in the output
    expect(result).toContain('S');
    // seq_preset path uses presetName — should NOT appear
    expect(result).not.toContain('presetName');
    // unknown types use default accent-primary color (not accent-pink)
    expect(result).toContain('var(--accent-primary)');
    expect(result).not.toContain('var(--accent-pink)');
  });

  it('unknown type defaults to var(--accent-primary) color', () => {
    const result = _genLcdBarHtml('custom', {
      header: 'H', stepInfo: 'S', bar: '█' });
    expect(result).toContain('var(--accent-primary)');
    expect(result).not.toContain('var(--accent-pink)');
  });

  it('handles opts with missing bar gracefully (bar defaults to "")', () => {
    const result = _genLcdBarHtml('arp', { header: 'H', stepInfo: 'S' });
    expect(result).toContain('H');
    expect(result).toContain('S');
    expect(result).toContain('font-size:7px; letter-spacing:1px; color:var(--text-faint);">');
  });

  it('entirely empty opts object does not crash (header/stepInfo undefined)', () => {
    const result = _genLcdBarHtml('seq', {});
    // Source passes opts values directly so `undefined` appears as text
    expect(result).toContain('undefined');
    expect(result).toContain('font-size:7px');
  });

  it('bar with unicode characters renders correctly', () => {
    const bar = '\u2502' + FILL.repeat(5) + EMPTY.repeat(5);
    const result = _genLcdBarHtml('seq', { header: 'H', stepInfo: 'S', bar: bar });
    expect(result).toContain('\u2502');
    expect(result).toContain(FILL.repeat(5));
    expect(result).toContain(EMPTY.repeat(5));
  });

  it('all 3 types produce valid HTML with balanced <span> tags', () => {
    const types = ['arp', 'seq', 'seq_preset'];
    types.forEach(t => {
      const opts = t === 'seq_preset'
        ? { header: 'H', presetName: 'P', bar: '█', meta: 'M' }
        : { header: 'H', stepInfo: 'S', bar: '█' };
      const result = _genLcdBarHtml(t, opts);
      const openSpans = (result.match(/<span/g) || []).length;
      const closeSpans = (result.match(/<\/span>/g) || []).length;
      expect(openSpans).toBe(closeSpans);
    });
  });

  it('integration with _genFillBar output as bar argument', () => {
    const fillBar = _genFillBar(8, 18);
    const result = _genLcdBarHtml('arp', {
      header: 'ARP TEST',
      stepInfo: 'Step 1 · 5 notes',
      bar: fillBar,
    });
    expect(result).toContain(FILL.repeat(8) + EMPTY.repeat(10));
    expect(result).toContain('ARP TEST');
  });

  it('integration with _genPosBar output as bar argument', () => {
    const posBar = _genPosBar(9, 18);
    const result = _genLcdBarHtml('seq', {
      header: 'SEQ TEST',
      stepInfo: 'Step 5 · 3 notes · 16 steps',
      bar: posBar,
    });
    expect(result).toContain(EMPTY.repeat(9) + FILL + EMPTY.repeat(8));
  });

  it('integration with _genFillBar in seq_preset meta field', () => {
    const posBar = _genPosBar(16, 18);
    const result = _genLcdBarHtml('seq_preset', {
      header: 'PRESET LOADED',
      presetName: 'My Preset',
      bar: posBar,
      meta: '32 steps completed',
    });
    expect(result).toContain('32 steps completed');
    expect(result).toContain('PRESET LOADED');
    expect(result).toContain('My Preset');
  });
});

// ══════════════════════════════════════════════════════════════════
// Integration: _genFillBar + _genBarHtml
// ══════════════════════════════════════════════════════════════════

describe('Integration: _genFillBar + _genBarHtml', () => {

  it('produces valid HTML span wrapping a bar', () => {
    const bar = _genFillBar(8, 18);
    const html = _genBarHtml(bar, { color: 'var(--accent-green)' });
    expect(html).toContain('<span');
    expect(html).toContain('</span>');
    expect(html).toContain(FILL.repeat(8));
    expect(html).toContain(EMPTY.repeat(10));
  });

  it('produces valid HTML for full bar (100%)', () => {
    const bar = _genFillBar(18, 18);
    const html = _genBarHtml(bar);
    expect(html).toContain(FILL.repeat(18));
    expect(html).not.toContain(EMPTY);
  });

  it('produces valid HTML for empty bar (0%)', () => {
    const bar = _genFillBar(0, 18);
    const html = _genBarHtml(bar);
    expect(html).toContain(EMPTY.repeat(18));
    expect(html).not.toContain(FILL);
  });

  it('bar position marker wrapped in colored span', () => {
    const bar = _genPosBar(9, 18);
    const html = _genBarHtml(bar, { color: 'var(--accent-pink)' });
    expect(html).toContain('var(--accent-pink)');
    expect(html).toContain(FILL);   // position marker
    expect(html).toContain(EMPTY);  // empty positions
  });

  it('span suffix appended correctly with full integration', () => {
    const bar = _genFillBar(12, 18);
    const html = _genBarHtml(bar, { suffix: ' 75%' });
    expect(html).toMatch(/<\/span>\s*75%$/);
  });

  it('letterSpacing integration for pitch bend bars', () => {
    const leftBar = _genFillBar(0, 10);
    const rightBar = _genFillBar(5, 10);
    const centerMarker = '\u2502';
    const combined = leftBar + centerMarker + rightBar;
    const html = _genBarHtml(combined, { letterSpacing: '0' });
    expect(html).toContain('letter-spacing:0');
    expect(html).toContain(combined);
  });
});

// ══════════════════════════════════════════════════════════════════
// _genFillBar + _genPosBar consistency
// ══════════════════════════════════════════════════════════════════

describe('Consistency between _genFillBar and _genPosBar', () => {

  it('both produce same length for same totalLen', () => {
    const fillResult = _genFillBar(5, 20);
    const posResult = _genPosBar(5, 20);
    expect(fillResult.length).toBe(20);
    expect(posResult.length).toBe(20);
  });

  it('both use same default totalLen (18)', () => {
    expect(_genFillBar(5).length).toBe(18);
    expect(_genPosBar(5).length).toBe(18);
  });

  it('both accept custom fill/empty chars', () => {
    const fillResult = _genFillBar(3, 8, '#', '.');
    const posResult = _genPosBar(3, 8, '#', '.');
    expect(fillResult).toBe('###.....');
    expect(posResult).toBe('...#....');
  });

  it('genFillBar at half and genPosBar at center produce different patterns', () => {
    // fill bar fills from left; pos bar marks a single position
    const fill = _genFillBar(9, 18);
    const pos = _genPosBar(9, 18);
    expect(fill).toBe(FILL.repeat(9) + EMPTY.repeat(9));
    expect(pos).toBe(EMPTY.repeat(9) + FILL + EMPTY.repeat(8));
    // fill has 9 FILL chars, pos has exactly 1 FILL char
    expect((fill.match(/\u2588/g) || []).length).toBe(9);
    expect((pos.match(/\u2588/g) || []).length).toBe(1);
  });
});
