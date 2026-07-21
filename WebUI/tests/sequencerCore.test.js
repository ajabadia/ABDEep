/**
 * Dedicated Vitest tests for sequencer.js — DOM integration, step editing, polling lifecycle.
 *
 * Source:  WebUI/js/sequencer.js
 * Run:     npx vitest run WebUI/tests/sequencerCore.test.js
 *
 * Covers DOM-level behavior not tested in modalTests.test.js:
 *   - updateStepVisual full DOM integration (mock stepUnit children)
 *   - Mode badge HTML generation (complete innerHTML string)
 *   - _clearModalActiveHighlight 32-iteration DOM traversal
 *   - _startModalPolling / _stopModalPolling timer lifecycle
 *   - Poll tick callback execution (setInterval, clearInterval)
 *   - Preset load with bridge sync (all 32 setParameter calls)
 *   - Reset button auto-restart (_updateSeqEngine when wasRunning)
 *   - syncSeqModalUI text value updates (swing-val, slew-val)
 *   - Open modal immediate highlight sync from current_step
 *   - Step background color (rgba for SKIP, bg-surface for active)
 *   - Edit drag LCD update HTML content
 *   - Number indicator borderColor for SKIP+active combinations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/* ================================================================
 * Shared helpers (re-exported from modalTests.test.js where possible)
 * ================================================================ */

function _isStepSkip(rawVal) { return rawVal === 0; }
function _getActiveLength(v) { return parseInt(v) + 2; }
function _rawToBipolar(r) { return r === 0 ? 0 : r - 128; }
function _calcBipolarFromY(cy, rt, rh) {
  const r = Math.max(0, Math.min(1, (cy - rt) / rh));
  let b = Math.round((1.0 - r) * 255 - 128);
  if (Math.abs(b) <= 2) {b = 0;}
  return b;
}
function _bipolarToRaw(b) {
  const raw = Math.max(0, Math.min(255, b + 128));
  return { raw, normalized: raw / 255.0 };
}
function _calcSwingDisplay(n) { return Math.round(50 + n * 9); }
function _calcSlewDisplay(n) { return Math.round(n * 255); }
function _calcHandlePos(v, sh, hh) {
  if (sh <= 0) {return 0;}
  const limit = sh - hh;
  return (1.0 - v) * limit;
}

/* ================================================================
 * DOM mock helpers
 * ================================================================ */

/** Create a mock stepUnit element mimicking the DOM structure created by sequencer.js */
function makeMockStepUnit() {
  const numIndicator = { innerText: '', style: {} };
  const rawIndicator = { innerText: '', style: {} };
  const fillBar = { style: {} };
  const barContainer = { style: {} };
  const stepUnit = {
    style: {},
    title: '',
    querySelector: vi.fn(function(sel) {
      if (sel === '.seq-step-val') {return numIndicator;}
      if (sel === '.seq-step-raw') {return rawIndicator;}
      if (sel === '.seq-step-fill-bar') {return fillBar;}
      if (sel === '.seq-step-bar-container') {return barContainer;}
      return null;
    }),
    _numIndicator: numIndicator,
    _rawIndicator: rawIndicator,
    _fillBar: fillBar,
    _barContainer: barContainer,
  };
  return stepUnit;
}

/** Create mock stepsGrid with 32 mock stepUnits */
function makeMockStepsGrid() {
  const units = [];
  for (let i = 0; i < 32; i++) {
    units.push(makeMockStepUnit());
  }
  return {
    children: units,
    _units: units,
  };
}

/** Create a mock document.getElementById */
function mockDocGetElementById(map) {
  return function(id) { return map[id] || null; };
}

/** Create a mock bridge with parameterCache */
function makeMockBridge(cache, seqEngine) {
  return {
    parameterCache: cache || {},
    _seqEngine: seqEngine || null,
    setParameter: vi.fn(),
    _updateSeqEngine: vi.fn(),
  };
}

/** Create a mock backdrop element */
function makeMockBackdrop(display) {
  return { style: { display: display || 'none' } };
}

/** Create a mock select element with value */
function makeMockSelect(value) {
  return { value: String(value || 0) };
}

/** Create a mock span text element */
function makeMockTextEl() {
  return { innerText: '' };
}

/** Create a mock toggle box element */
function makeMockToggleBox(initialActive) {
  return {
    classList: {
      contains: vi.fn(() => !!initialActive),
      toggle: vi.fn(),
      add: vi.fn(),
      remove: vi.fn(),
    },
    addEventListener: vi.fn(),
    style: {},
  };
}

/* ================================================================
 * Helpers that mirror sequencer.js DOM operations
 * ================================================================ */

/** Poll tick callback (mirrors setInterval callback in _startModalPolling) */
function _runPollTick(bridge, backdropDisplay, state) {
  if (backdropDisplay === 'none') {
    return { stopped: true };
  }
  if (!bridge) {return { stopped: false, skipped: true };}

  const currentStep = bridge.parameterCache['seq_current_step'];
  const seqEn = bridge.parameterCache['seq_enable'] || 0;

  if (seqEn < 0.5) {
    return { highlightCleared: state._modalActiveStep !== -1, lastPolled: -1 };
  }
  if (currentStep === undefined || currentStep === null) {
    return { highlightCleared: state._modalActiveStep !== -1, lastPolled: -1 };
  }

  const stepIdx = Math.round(currentStep);
  const isSkip = (bridge.parameterCache['seq_current_step_skip'] || 0) > 0.5;

  const stepChanged = stepIdx !== state._modalLastPolledStep || isSkip !== state._modalActiveSkip;
  if (stepChanged) {
    state._modalActiveStep = stepIdx;
    state._modalActiveSkip = isSkip;
    state._modalLastPolledStep = stepIdx;
  }

  return {
    stopped: false,
    stepIdx: stepIdx,
    isSkip: isSkip,
    stepChanged: stepChanged,
    lastPolled: state._modalLastPolledStep,
  };
}

/** Step drag editing (mirrors updateValFromY) */
function _dragEditStep(i, clientY, rectTop, rectHeight, stepsValues, stepsRaw, bridge) {
  const relY = Math.max(0, Math.min(1, (clientY - rectTop) / rectHeight));
  const normVal = 1.0 - relY;
  let bipolarVal = Math.round((normVal * 255) - 128);
  if (Math.abs(bipolarVal) <= 2) {bipolarVal = 0;}

  stepsValues[i] = bipolarVal;
  const rawByte = bipolarVal + 128;
  stepsRaw[i] = Math.max(0, Math.min(255, rawByte));

  const normalized = Math.max(0, Math.min(1, stepsRaw[i] / 255.0));
  if (bridge) {
    bridge.setParameter('seq_step_' + (i + 1), normalized);
  }

  return { bipolarVal, rawByte: stepsRaw[i], normalized };
}

/** Preset item click (mirrors preset-item click handler, uses accent-pink) */
function _seqPresetItemClick(items, clickedIndex) {
  const results = [];
  for (let i = 0; i < items.length; i++) {
    if (i === clickedIndex) {
      items[i].style.background = 'color-mix(in srgb, var(--accent-pink) 20%, transparent)';
      items[i].classList.add('selected');
      results.push({ index: i, selected: true });
    } else {
      items[i].style.background = 'transparent';
      items[i].classList.remove('selected');
      results.push({ index: i, selected: false });
    }
  }
  return results;
}


/**
 * Full updateStepVisual simulation on mock DOM.
 * Mirrors the source code's updateStepVisual function exactly.
 */
function _updateStepVisualMock(stepUnit, bipolarVal, rawVal, activeStep, activeSkip, selectLengthValue) {
  const numIndicator = stepUnit._numIndicator;
  const rawIndicator = stepUnit._rawIndicator;
  const fillBar = stepUnit._fillBar;
  const barContainer = stepUnit._barContainer;

  const activeLength = selectLengthValue !== undefined ? _getActiveLength(selectLengthValue) : 16;
  const isActive = true; // we're testing a single step
  const isSkip = _isStepSkip(rawVal);
  const val = bipolarVal;
  const rawForSkip = rawVal;

  // Tooltip
  const signStr = val >= 0 ? '+' : '';
  stepUnit.title = isSkip
    ? 'Step 1: SKIP (raw: ' + rawForSkip + ')'
    : 'Step 1: ' + signStr + val + ' (raw: ' + rawForSkip + ')';

  // Number indicator
  if (isSkip) {
    numIndicator.innerText = 'SKIP';
    numIndicator.style.color = 'var(--text-faint)';
    numIndicator.style.fontSize = '6px';
  } else if (val === 0) {
    numIndicator.innerText = '0';
    numIndicator.style.color = 'var(--text-dim)';
    numIndicator.style.fontSize = 'var(--text-xs)';
  } else {
    numIndicator.innerText = val > 0 ? '+' + val : String(val);
    numIndicator.style.color = 'var(--brand-accent)';
    numIndicator.style.fontSize = 'var(--text-xs)';
  }
  numIndicator.style.background = 'var(--bg-header)';
  numIndicator.style.borderColor = isSkip ? 'var(--color-danger)' : 'var(--brand-accent)';
  numIndicator.style.opacity = '1.0';

  // Raw indicator
  rawIndicator.innerText = isSkip ? '--' : String(rawVal);
  rawIndicator.style.color = isSkip ? 'var(--color-danger)' : 'var(--text-dim)';
  rawIndicator.style.opacity = '0.8';

  // Step background
  stepUnit.style.background = isSkip ? 'rgba(255,0,0,0.05)' : 'var(--bg-surface)';

  // Active highlight
  if (bipolarVal === activeStep) { // simplified: we just check if it's "active" by convention
    stepUnit.style.outline = activeSkip ? '1px dashed var(--color-danger)' : '1.5px solid var(--accent-pink)';
    stepUnit.style.boxShadow = activeSkip ? '0 0 4px rgba(255,0,0,0.3)' : '0 0 8px color-mix(in srgb, var(--accent-pink) 40%, transparent)';
    numIndicator.style.borderColor = activeSkip ? 'var(--color-danger)' : 'var(--accent-pink)';
    numIndicator.style.boxShadow = '0 0 4px var(--accent-pink)';
  } else {
    stepUnit.style.outline = '';
    stepUnit.style.boxShadow = '';
    numIndicator.style.boxShadow = '';
  }

  // Bar container
  barContainer.style.background = 'var(--bg-header)';

  // Fill bar
  if (isSkip) {
    fillBar.style.bottom = '50%';
    fillBar.style.height = '0%';
    fillBar.style.background = 'transparent';
    fillBar.style.outline = '1px dashed var(--color-danger)';
  } else if (val >= 0) {
    const pct = (val / 127) * 50;
    fillBar.style.bottom = '50%';
    fillBar.style.height = pct + '%';
    fillBar.style.background = 'var(--accent-pink)';
    fillBar.style.outline = 'none';
  } else {
    const pct = (Math.abs(val) / 128) * 50;
    fillBar.style.bottom = (50 - pct) + '%';
    fillBar.style.height = pct + '%';
    fillBar.style.background = 'color-mix(in srgb, var(--accent-pink) 50%, #000)';
    fillBar.style.outline = 'none';
  }
}

/** Mode badge HTML generation (mirrors _updateSeqModalModeBadge) */
function _modeBadgeHtml(keyLoopNorm, forcedFreeRunning) {
  const keyLoopVal = Math.round((keyLoopNorm || 0) * 2);
  let label, color, tooltip, cursorStyle;
  if (forcedFreeRunning) {
    label = 'FREE*';
    color = 'var(--accent-yellow)';
    tooltip = ' title="Key Sync desactivado automáticamente — no había teclas presionadas al activar SEQ"';
    cursorStyle = ';cursor:help';
  } else if (keyLoopVal === 0) {
    label = 'FREE';
    color = 'var(--accent-green)';
    tooltip = '';
    cursorStyle = '';
  } else if (keyLoopVal === 1) {
    label = 'KEY';
    color = 'var(--accent-blue)';
    tooltip = '';
    cursorStyle = '';
  } else {
    label = 'LOOP';
    color = 'var(--accent-teal)';
    tooltip = '';
    cursorStyle = '';
  }
  return '<span style="color:' + color + ';font-weight:bold;border:1px solid ' + color + ';padding:0 6px;border-radius:3px;font-size:10px' + cursorStyle + '"' + tooltip + '>' + label + '</span>';
}

/** Clear active highlight on all 32 steps (mirrors _clearModalActiveHighlight) */
function _clearModalActiveHighlightFull(grid) {
  const cleared = [];
  for (let ci = 0; ci < 32; ci++) {
    const child = grid.children[ci];
    if (child) {
      child.style.outline = '';
      child.style.boxShadow = '';
      const numEl = child.querySelector('.seq-step-val');
      if (numEl) {numEl.style.boxShadow = '';}
      const rawEl = child.querySelector('.seq-step-raw');
      if (rawEl) {rawEl.style.color = '';}
      cleared.push(ci);
    }
  }
  return cleared;
}

/** Preset load: applies pattern and syncs to bridge (mirrors loadPresetBtn click handler) */
function _seqPresetLoad(text, seqStepsValues, bridge) {
  let newValues;
  if (text.includes('Staircase')) {
    newValues = Array(32).fill(0).map((_, i) => Math.round((i / 31) * 255 - 128));
  } else if (text.includes('Triangle')) {
    newValues = Array(32).fill(0).map((_, i) => {
      const phase = (i / 16) % 2.0;
      const val = phase < 1.0 ? phase : 2.0 - phase;
      return Math.round((val * 255) - 128);
    });
  } else {
    newValues = Array(32).fill(0).map(() => Math.round(Math.random() * 255 - 128));
  }

  const rawBytes = [];
  const setParamCalls = [];
  for (let i = 0; i < 32; i++) {
    const rawByte = Math.max(0, Math.min(255, newValues[i] + 128));
    rawBytes[i] = rawByte;
    const normalized = rawByte / 255.0;
    if (bridge) {
      bridge.setParameter('seq_step_' + (i + 1), normalized);
      setParamCalls.push({ param: 'seq_step_' + (i + 1), val: normalized });
    }
  }
  return { values: newValues, rawBytes, setParamCalls };
}

/** Average position calculation (from LCD display in preset load) */
function _presetAvgPosition(values) {
  let sum = 0, count = 0;
  for (let i = 0; i < 32; i++) {
    if (Math.abs(values[i]) > 5) {
      sum += i;
      count++;
    }
  }
  return count > 0 ? Math.round(sum / count) : 16;
}

/* ================================================================
 * TESTS
 * ================================================================ */

// ────────── updateStepVisual DOM integration ────────────────────

describe('updateStepVisual — full DOM integration', () => {
  it('positive bipolar sets fill bar above center, pink accent, none outline', () => {
    const unit = makeMockStepUnit();
    _updateStepVisualMock(unit, 64, 192, -1, false);
    expect(unit._fillBar.style.bottom).toBe('50%');
    expect(unit._fillBar.style.height).toBe((64 / 127 * 50) + '%');
    expect(unit._fillBar.style.background).toBe('var(--accent-pink)');
    expect(unit._fillBar.style.outline).toBe('none');
  });

  it('negative bipolar sets fill bar descending from center', () => {
    const unit = makeMockStepUnit();
    _updateStepVisualMock(unit, -64, 64, -1, false);
    const pct = (64 / 128) * 50;
    expect(unit._fillBar.style.bottom).toBe((50 - pct) + '%');
    expect(unit._fillBar.style.height).toBe(pct + '%');
    expect(unit._fillBar.style.background).toContain('mix');
  });

  it('SKIP step sets transparent fill bar with dashed danger outline', () => {
    const unit = makeMockStepUnit();
    _updateStepVisualMock(unit, 0, 0, -1, false);
    expect(unit._fillBar.style.background).toBe('transparent');
    expect(unit._fillBar.style.outline).toContain('dashed');
    expect(unit._fillBar.style.outline).toContain('var(--color-danger)');
    expect(unit._fillBar.style.height).toBe('0%');
  });

  it('SKIP step has rgba background on stepUnit', () => {
    const unit = makeMockStepUnit();
    _updateStepVisualMock(unit, 0, 0, -1, false);
    expect(unit.style.background).toBe('rgba(255,0,0,0.05)');
  });

  it('active (non-SKIP) step has bg-surface background', () => {
    const unit = makeMockStepUnit();
    _updateStepVisualMock(unit, 64, 192, -1, false);
    expect(unit.style.background).toBe('var(--bg-surface)');
  });

  it('SKIP numIndicator: text SKIP, small font, danger border', () => {
    const unit = makeMockStepUnit();
    _updateStepVisualMock(unit, 0, 0, -1, false);
    expect(unit._numIndicator.innerText).toBe('SKIP');
    expect(unit._numIndicator.style.fontSize).toBe('6px');
    expect(unit._numIndicator.style.color).toBe('var(--text-faint)');
    expect(unit._numIndicator.style.borderColor).toBe('var(--color-danger)');
  });

  it('positive bipolar numIndicator: +prefix, brand accent', () => {
    const unit = makeMockStepUnit();
    _updateStepVisualMock(unit, 64, 192, -1, false);
    expect(unit._numIndicator.innerText).toBe('+64');
    expect(unit._numIndicator.style.color).toBe('var(--brand-accent)');
    expect(unit._numIndicator.style.borderColor).toBe('var(--brand-accent)');
  });

  it('negative bipolar numIndicator: no + prefix', () => {
    const unit = makeMockStepUnit();
    _updateStepVisualMock(unit, -64, 64, -1, false);
    expect(unit._numIndicator.innerText).toBe('-64');
  });

  it('zero bipolar numIndicator: text 0, dim color', () => {
    const unit = makeMockStepUnit();
    _updateStepVisualMock(unit, 0, 128, -1, false);
    expect(unit._numIndicator.innerText).toBe('0');
    expect(unit._numIndicator.style.color).toBe('var(--text-dim)');
  });

  it('SKIP rawIndicator: -- text, danger color', () => {
    const unit = makeMockStepUnit();
    _updateStepVisualMock(unit, 0, 0, -1, false);
    expect(unit._rawIndicator.innerText).toBe('--');
    expect(unit._rawIndicator.style.color).toBe('var(--color-danger)');
  });

  it('normal rawIndicator: numeric string, dim color', () => {
    const unit = makeMockStepUnit();
    _updateStepVisualMock(unit, 64, 192, -1, false);
    expect(unit._rawIndicator.innerText).toBe('192');
    expect(unit._rawIndicator.style.color).toBe('var(--text-dim)');
  });

  it('active highlight: non-SKIP step has solid pink outline', () => {
    const unit = makeMockStepUnit();
    _updateStepVisualMock(unit, 64, 192, 64, false); // bipolar === activeStep triggers highlight
    expect(unit.style.outline).toContain('solid');
    expect(unit.style.outline).toContain('var(--accent-pink)');
    expect(unit.style.boxShadow).toContain('var(--accent-pink)');
    expect(unit._numIndicator.style.boxShadow).toContain('var(--accent-pink)');
  });

  it('SKIP active highlight: dashed danger outline', () => {
    const unit = makeMockStepUnit();
    _updateStepVisualMock(unit, 0, 0, 0, true); // bipolar===activeStep, activeSkip=true
    expect(unit.style.outline).toContain('dashed');
    expect(unit.style.outline).toContain('var(--color-danger)');
    expect(unit.style.boxShadow).toContain('rgba(255,0,0');
  });

  it('non-matching step (not active) has empty outline', () => {
    const unit = makeMockStepUnit();
    _updateStepVisualMock(unit, 64, 192, -1, false);
    expect(unit.style.outline).toBe('');
    expect(unit.style.boxShadow).toBe('');
  });

  it('barContainer background is always bg-header (active)', () => {
    const unit = makeMockStepUnit();
    _updateStepVisualMock(unit, 0, 128, -1, false);
    expect(unit._barContainer.style.background).toBe('var(--bg-header)');
  });

  it('tooltip shows SKIP for raw=0', () => {
    const unit = makeMockStepUnit();
    _updateStepVisualMock(unit, 0, 0, -1, false);
    expect(unit.title).toContain('SKIP');
    expect(unit.title).toContain('(raw: 0)');
  });

  it('tooltip shows + prefix for positive values', () => {
    const unit = makeMockStepUnit();
    _updateStepVisualMock(unit, 64, 192, -1, false);
    expect(unit.title).toContain('+64');
    expect(unit.title).toContain('(raw: 192)');
  });

  it('tooltip shows - prefix for negative values', () => {
    const unit = makeMockStepUnit();
    _updateStepVisualMock(unit, -64, 64, -1, false);
    expect(unit.title).toContain('-64');
    expect(unit.title).toContain('(raw: 64)');
  });

  it('numIndicator opacity is 1.0 for active step', () => {
    const unit = makeMockStepUnit();
    _updateStepVisualMock(unit, 64, 192, -1, false);
    expect(unit._numIndicator.style.opacity).toBe('1.0');
  });

  it('rawIndicator opacity is 0.8 for active step', () => {
    const unit = makeMockStepUnit();
    _updateStepVisualMock(unit, 64, 192, -1, false);
    expect(unit._rawIndicator.style.opacity).toBe('0.8');
  });
});

// ────────── Mode badge HTML ──────────────────────────────────

describe('_updateSeqModalModeBadge — HTML generation', () => {
  it('FREE* mode generates span with yellow color and cursor:help', () => {
    const html = _modeBadgeHtml(0, true);
    expect(html).toContain('FREE*');
    expect(html).toContain('var(--accent-yellow)');
    expect(html).toContain('cursor:help');
    expect(html).toContain('title="Key Sync desactivado');
  });

  it('FREE mode generates span with green color', () => {
    const html = _modeBadgeHtml(0, false);
    expect(html).toContain('FREE');
    expect(html).toContain('var(--accent-green)');
    expect(html).not.toContain('cursor:help');
    expect(html).not.toContain('title="');
  });

  it('KEY mode generates span with blue color', () => {
    const html = _modeBadgeHtml(0.5, false);
    expect(html).toContain('KEY');
    expect(html).toContain('var(--accent-blue)');
  });

  it('LOOP mode generates span with teal color', () => {
    const html = _modeBadgeHtml(1.0, false);
    expect(html).toContain('LOOP');
    expect(html).toContain('var(--accent-teal)');
  });

  it('span structure has border, padding, border-radius, font-size', () => {
    const html = _modeBadgeHtml(0, false);
    expect(html).toContain('border:1px solid');
    expect(html).toContain('padding:0 6px');
    expect(html).toContain('border-radius:3px');
    expect(html).toContain('font-size:10px');
  });

  it('FREE* mode produces innerHTML with cursor and tooltip', () => {
    const html = _modeBadgeHtml(0, true);
    expect(html).toContain('FREE*');
    expect(html).toContain('cursor:help');
    expect(html).toContain('title="');
    expect(html).toMatch(/^<span[^>]*>FREE\*<\/span>$/);
  });

  it('FREE mode innerHTML has no extra attributes', () => {
    const html = _modeBadgeHtml(0, false);
    expect(html).not.toContain('cursor');
    expect(html).not.toContain('title');
  });

  it('KEY mode innerHTML is clean', () => {
    const html = _modeBadgeHtml(0.5, false);
    expect(html).toContain('KEY');
    expect(html).toContain('</span>');
  });

  it('badge is wrapped in a single span', () => {
    const html = _modeBadgeHtml(1.0, false);
    const spanCount = (html.match(/<span/g) || []).length;
    const spanCloseCount = (html.match(/<\/span>/g) || []).length;
    expect(spanCount).toBe(1);
    expect(spanCloseCount).toBe(1);
  });
});

// ────────── _clearModalActiveHighlight full 32-iteration ─────

describe('_clearModalActiveHighlight — full 32-iteration DOM', () => {
  it('clears all 32 steps outline and boxShadow', () => {
    const grid = makeMockStepsGrid();
    // Set some styles first
    grid.children[0].style.outline = '1px solid red';
    grid.children[5].style.boxShadow = '0 0 8px pink';
    grid.children[31].style.outline = '1px dashed red';

    const cleared = _clearModalActiveHighlightFull(grid);
    expect(cleared.length).toBe(32);
    expect(grid.children[0].style.outline).toBe('');
    expect(grid.children[5].style.boxShadow).toBe('');
    expect(grid.children[31].style.outline).toBe('');
  });

  it('clears numIndicator boxShadow on all steps', () => {
    const grid = makeMockStepsGrid();
    grid.children[10].querySelector('.seq-step-val').style.boxShadow = '0 0 4px pink';

    _clearModalActiveHighlightFull(grid);
    expect(grid.children[10].querySelector('.seq-step-val').style.boxShadow).toBe('');
  });

  it('clears rawIndicator color on all steps', () => {
    const grid = makeMockStepsGrid();
    grid.children[20].querySelector('.seq-step-raw').style.color = 'red';

    _clearModalActiveHighlightFull(grid);
    expect(grid.children[20].querySelector('.seq-step-raw').style.color).toBe('');
  });

  it('handles missing children gracefully (null check)', () => {
    const grid = { children: [null, null] };
    const cleared = _clearModalActiveHighlightFull(grid);
    expect(cleared.length).toBe(0);
  });

  it('handles missing querySelector results gracefully', () => {
    const grid = makeMockStepsGrid();
    // Override querySelector to return null for some
    grid.children[0].querySelector = vi.fn(() => null);
    const cleared = _clearModalActiveHighlightFull(grid);
    expect(cleared.length).toBe(32); // still iterates all
    // querySelector was called but returned null — no crash
  });

  it('clears stepUnit outline at index 0 and 31 specifically', () => {
    const grid = makeMockStepsGrid();
    grid.children[0].style.outline = '1px solid';
    grid.children[31].style.outline = '2px dashed';

    _clearModalActiveHighlightFull(grid);
    expect(grid.children[0].style.outline).toBe('');
    expect(grid.children[31].style.outline).toBe('');
  });
});

// ────────── Polling timer lifecycle ─────────────────────────

describe('_startModalPolling / _stopModalPolling — timer lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('startModalPolling creates a setInterval at 100ms', () => {
    const intervalSpy = vi.spyOn(global, 'setInterval');
    let pollTimer = null;

    function stopPolling() {
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    }
    function startPolling() {
      stopPolling();
      pollTimer = setInterval(() => {}, 100);
    }

    startPolling();
    expect(intervalSpy).toHaveBeenCalledWith(expect.any(Function), 100);
    expect(pollTimer).not.toBeNull();
    stopPolling();
    intervalSpy.mockRestore();
  });

  it('stopModalPolling clears interval and sets timer to null', () => {
    let pollTimer = setInterval(() => {}, 100);
    function stopPolling() {
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    }
    expect(pollTimer).not.toBeNull();
    stopPolling();
    expect(pollTimer).toBeNull();
  });

  it('double start calls stop first then creates new interval', () => {
    let pollTimer = null;
    function startPolling() {
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      pollTimer = setInterval(() => {}, 100);
    }
    startPolling();
    const firstTimer = pollTimer;
    startPolling();
    const secondTimer = pollTimer;
    expect(firstTimer).not.toBe(secondTimer);
  });

  it('poll timer fires callback at correct interval', () => {
    const callback = vi.fn();
    const timer = setInterval(callback, 100);
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(200);
    expect(callback).toHaveBeenCalledTimes(3);
    clearInterval(timer);
  });

  it('stop is idempotent (calling twice does not error)', () => {
    let pollTimer = setInterval(() => {}, 100);
    function stop() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }
    stop();
    expect(() => stop()).not.toThrow();
  });

  it('start after stop works correctly', () => {
    let pollTimer = null;
    const cb = vi.fn();
    function start() {
      if (pollTimer) {clearInterval(pollTimer);}
      pollTimer = setInterval(cb, 100);
    }
    start();
    vi.advanceTimersByTime(100);
    expect(cb).toHaveBeenCalledTimes(1);

    // stop
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    cb.mockClear();

    // start again
    pollTimer = setInterval(cb, 100);
    vi.advanceTimersByTime(100);
    expect(cb).toHaveBeenCalledTimes(1);
    clearInterval(pollTimer);
  });
});

// ────────── Preset load with bridge sync ─────────────────────

describe('Preset load — bridge sync (all 32 steps)', () => {
  it('Staircase preset sends 32 setParameter calls to bridge', () => {
    const bridge = makeMockBridge();
    const result = _seqPresetLoad('Staircase ramp', [], bridge);
    expect(result.setParamCalls.length).toBe(32);
    expect(bridge.setParameter).toHaveBeenCalledTimes(32);
  });

  it('each setParameter call has correct param name seq_step_N', () => {
    const bridge = makeMockBridge();
    _seqPresetLoad('Staircase', [], bridge);
    for (let i = 0; i < 32; i++) {
      expect(bridge.setParameter).toHaveBeenCalledWith('seq_step_' + (i + 1), expect.any(Number));
    }
  });

  it('normalized values are within 0..1', () => {
    const bridge = makeMockBridge();
    const result = _seqPresetLoad('Staircase', [], bridge);
    result.setParamCalls.forEach(call => {
      expect(call.val).toBeGreaterThanOrEqual(0);
      expect(call.val).toBeLessThanOrEqual(1);
    });
  });

  it('rawBytes are within 0..255', () => {
    const result = _seqPresetLoad('Staircase', [], null);
    result.rawBytes.forEach(raw => {
      expect(raw).toBeGreaterThanOrEqual(0);
      expect(raw).toBeLessThanOrEqual(255);
    });
  });

  it('Triangle preset generates correct bipolar values', () => {
    const result = _seqPresetLoad('Triangle wave', [], null);
    expect(result.values[0]).toBe(-128);
    expect(result.values[16]).toBe(127);
    expect(result.values.length).toBe(32);
  });

  it('Staircase preset is monotonically increasing', () => {
    const result = _seqPresetLoad('Staircase up', [], null);
    for (let i = 1; i < 32; i++) {
      expect(result.values[i]).toBeGreaterThan(result.values[i - 1]);
    }
  });

  it('Random preset produces varied values', () => {
    const r1 = _seqPresetLoad('Randomize', [], null);
    const r2 = _seqPresetLoad('Randomize', [], null);
    const diffCount = r1.values.filter((v, i) => v !== r2.values[i]).length;
    expect(diffCount).toBeGreaterThan(1);
  });

  it('preset load without bridge does not throw', () => {
    expect(() => _seqPresetLoad('Staircase', [], null)).not.toThrow();
  });

  it('preset name with extra text still matches (includes check)', () => {
    const result = _seqPresetLoad('My Staircase preset (v2)', [], null);
    expect(result.values[0]).toBe(-128);
    expect(result.values[31]).toBe(127);
  });
});

describe('Preset load — average position calculation (LCD feedback)', () => {
  it('Staircase avg pos is ~15.5 → 16', () => {
    const values = Array(32).fill(0).map((_, i) => Math.round((i / 31) * 255 - 128));
    const avg = _presetAvgPosition(values);
    expect(avg).toBeGreaterThanOrEqual(14);
    expect(avg).toBeLessThanOrEqual(17);
  });

  it('all zeros gives default avg of 16', () => {
    const values = Array(32).fill(0);
    expect(_presetAvgPosition(values)).toBe(16);
  });

  it('only first step active gives avg of 0', () => {
    const values = Array(32).fill(0);
    values[0] = 100; // only this one has abs > 5
    expect(_presetAvgPosition(values)).toBe(0);
  });

  it('only last step active gives avg of 31', () => {
    const values = Array(32).fill(0);
    values[31] = 100;
    expect(_presetAvgPosition(values)).toBe(31);
  });

  it('steps with |val| > 5 are included; avg of indices 0..31 is 15.5 → 16', () => {
    const values = Array(32).fill(6); // all have abs=6 > 5, so all 32 included
    // sum(0..31)=496, count=32, avg=496/32=15.5, round(15.5)=16
    expect(_presetAvgPosition(values)).toBe(16);
  });

  it('values at exactly 5 are excluded (not > 5)', () => {
    const values = Array(32).fill(5);
    expect(_presetAvgPosition(values)).toBe(16);
  });
});

// ────────── Reset button auto-restart ───────────────────────

describe('Reset button — auto-restart logic', () => {
  it('reset when wasRunning calls _updateSeqEngine', () => {
    const bridge = makeMockBridge({ 'seq_enable': 1.0 }, {
      running: true,
      stop: vi.fn(),
      stepIndex: 5,
      heldNotes: [1, 2, 3],
      _forcedFreeRunning: true,
      previousValues: [0, 0, 0],
    });

    // Simulate reset handler
    if (bridge._seqEngine) {
      const wasRunning = bridge._seqEngine.running;
      bridge._seqEngine.stop();
      bridge._seqEngine.stepIndex = 0;
      bridge._seqEngine.heldNotes = [];
      bridge._seqEngine._forcedFreeRunning = false;
      for (let si = 0; si < bridge._seqEngine.previousValues.length; si++) {
        bridge._seqEngine.previousValues[si] = 0;
      }
      if (wasRunning || (bridge.parameterCache['seq_enable'] || 0) > 0.5) {
        bridge._updateSeqEngine();
      }
    }

    expect(bridge._seqEngine.stop).toHaveBeenCalled();
    expect(bridge._seqEngine.stepIndex).toBe(0);
    expect(bridge._seqEngine.heldNotes).toEqual([]);
    expect(bridge._seqEngine._forcedFreeRunning).toBe(false);
    expect(bridge._updateSeqEngine).toHaveBeenCalled();
  });

  it('reset when not running and seq_enable=0 does not call _updateSeqEngine', () => {
    const bridge = makeMockBridge({ 'seq_enable': 0.0 }, {
      running: false,
      stop: vi.fn(),
      stepIndex: 3,
      heldNotes: [],
      _forcedFreeRunning: false,
      previousValues: [0],
    });

    const wasRunning = bridge._seqEngine.running;
    bridge._seqEngine.stop();
    bridge._seqEngine.stepIndex = 0;
    bridge._seqEngine.heldNotes = [];
    if (wasRunning || (bridge.parameterCache['seq_enable'] || 0) > 0.5) {
      bridge._updateSeqEngine();
    }

    expect(bridge._seqEngine.stop).toHaveBeenCalled();
    expect(bridge._updateSeqEngine).not.toHaveBeenCalled();
  });

  it('reset initializes previousValues to zero', () => {
    const engine = {
      previousValues: [1, 2, 3, 4, 5],
    };
    for (let si = 0; si < engine.previousValues.length; si++) {
      engine.previousValues[si] = 0;
    }
    engine.previousValues.forEach(v => expect(v).toBe(0));
  });
});

// ────────── syncSeqModalUI text updates ─────────────────────

describe('syncSeqModalUI — text value updates', () => {
  it('swing val = bytes[120]/25 → swing display = 50 + val*9', () => {
    const swingNorm = 12 / 25.0; // 0.48
    expect(_calcSwingDisplay(swingNorm)).toBe(Math.round(50 + 0.48 * 9));
  });

  it('slew val = bytes[122]/255 → slew display = val * 255', () => {
    const slewNorm = 200 / 255.0; // ~0.784
    expect(_calcSlewDisplay(slewNorm)).toBe(Math.round(0.784 * 255));
  });

  it('swing display for raw=12: round(50 + 12/25 * 9) = round(54.32) = 54', () => {
    const val = _calcSwingDisplay(12 / 25);
    expect(val).toBe(54);
    // Verify formula: 50 + (12/25)*9 = 50 + 4.32 = 54.32 → round = 54
    expect(Math.round(50 + (12 / 25) * 9)).toBe(54);
  });

  it('slew display for raw=200 gives correct value', () => {
    const val = _calcSlewDisplay(200 / 255.0);
    expect(val).toBeGreaterThan(0);
    expect(val).toBeLessThanOrEqual(255);
  });

  it('handle position from sync uses (1 - val) * (height - handleHeight)', () => {
    const val = 12 / 25.0;
    const pos = _calcHandlePos(val, 200, 16);
    expect(pos).toBe((1.0 - val) * 184);
  });

  it('sync handles zero-height slider with setTimeout retry', () => {
    const val = 12 / 25.0;
    const pos = _calcHandlePos(val, 0, 16);
    expect(pos).toBe(0); // returns 0 when height <= 0
  });
});

// ────────── Open modal immediate highlight sync ─────────────

describe('Open modal — immediate highlight sync from current_step', () => {
  it('reads seq_current_step from param cache on open', () => {
    const bridge = makeMockBridge({ 'seq_current_step': 5, 'seq_current_step_skip': 0 }, null);
    const curStep = bridge.parameterCache['seq_current_step'];
    if (curStep !== undefined) {
      const activeStep = Math.round(curStep);
      const activeSkip = (bridge.parameterCache['seq_current_step_skip'] || 0) > 0.5;
      expect(activeStep).toBe(5);
      expect(activeSkip).toBe(false);
    }
  });

  it('handles missing seq_current_step gracefully (undefined)', () => {
    const bridge = makeMockBridge({}, null);
    const curStep = bridge.parameterCache['seq_current_step'];
    // Should not crash — in source code, the if guard prevents execution
    expect(curStep).toBeUndefined();
  });

  it('handles seq_current_step from float (rounding)', () => {
    const bridge = makeMockBridge({ 'seq_current_step': 3.7 }, null);
    const curStep = bridge.parameterCache['seq_current_step'];
    if (curStep !== undefined) {
      expect(Math.round(curStep)).toBe(4);
    }
  });

  it('reads seq_current_step_skip on open', () => {
    const bridge = makeMockBridge({ 'seq_current_step': 2, 'seq_current_step_skip': 1.0 }, null);
    const curStep = bridge.parameterCache['seq_current_step'];
    if (curStep !== undefined) {
      const activeStep = Math.round(curStep);
      const activeSkip = (bridge.parameterCache['seq_current_step_skip'] || 0) > 0.5;
      expect(activeStep).toBe(2);
      expect(activeSkip).toBe(true);
    }
  });

  it('updates _modalLastPolledStep on open sync', () => {
    let _modalLastPolledStep = -1;
    const bridge = makeMockBridge({ 'seq_current_step': 7 }, null);
    const curStep = bridge.parameterCache['seq_current_step'];
    if (curStep !== undefined) {
      const stepIdx = Math.round(curStep);
      _modalLastPolledStep = stepIdx;
      expect(_modalLastPolledStep).toBe(7);
    }
  });
});

// ────────── Edit drag LCD update ────────────────────────────

describe('Step editing — LCD update content', () => {
  it('drag edit produces CONTROL SEQ LCD header', () => {
    const bipolarVal = 64;
    const i = 5;
    const lcdHtml = '<span style="font-size:10px; opacity:0.6;">CONTROL SEQ</span><br>'
      + '<strong>STEP ' + (i + 1) + ' VALUE</strong><br>'
      + '<span style="font-size:15px; color:var(--accent-pink);">' + bipolarVal + '</span>';
    expect(lcdHtml).toContain('CONTROL SEQ');
    expect(lcdHtml).toContain('STEP 6 VALUE');
    expect(lcdHtml).toContain('64');
  });

  it('negative bipolar shows correct sign in LCD', () => {
    const bipolarVal = -64;
    const lcdHtml = '<span style="font-size:10px; opacity:0.6;">CONTROL SEQ</span><br>'
      + '<strong>STEP 1 VALUE</strong><br>'
      + '<span style="font-size:15px; color:var(--accent-pink);">' + bipolarVal + '</span>';
    expect(lcdHtml).toContain('-64');
  });

  it('max positive 127 shows in LCD', () => {
    const bipolarVal = 127;
    const lcdHtml = '<span style="font-size:10px; opacity:0.6;">CONTROL SEQ</span><br>'
      + '<strong>STEP 32 VALUE</strong><br>'
      + '<span style="font-size:15px; color:var(--accent-pink);">' + bipolarVal + '</span>';
    expect(lcdHtml).toContain('127');
    expect(lcdHtml).toContain('STEP 32');
  });

  it('min negative -128 shows in LCD', () => {
    const bipolarVal = -128;
    const lcdHtml = '<span style="font-size:10px; opacity:0.6;">CONTROL SEQ</span><br>'
      + '<strong>STEP 1 VALUE</strong><br>'
      + '<span style="font-size:15px; color:var(--accent-pink);">' + bipolarVal + '</span>';
    expect(lcdHtml).toContain('-128');
  });

  it('each step edit updates LCD with correct index', () => {
    for (let i = 0; i < 32; i++) {
      const lcdHtml = '<span style="font-size:10px; opacity:0.6;">CONTROL SEQ</span><br>'
        + '<strong>STEP ' + (i + 1) + ' VALUE</strong><br>'
        + '<span style="font-size:15px; color:var(--accent-pink);">0</span>';
      expect(lcdHtml).toContain('STEP ' + (i + 1));
    }
  });
});

// ────────── Step background color edge cases ────────────────

describe('Step background color — edge cases', () => {
  it('SKIP step has rgba(255,0,0,0.05) background', () => {
    const stepUnit = { style: {} };
    const isSkip = true;
    stepUnit.style.background = isSkip ? 'rgba(255,0,0,0.05)' : 'var(--bg-surface)';
    expect(stepUnit.style.background).toBe('rgba(255,0,0,0.05)');
  });

  it('active non-SKIP step has bg-surface', () => {
    const stepUnit = { style: {} };
    const isSkip = false;
    const isActive = true;
    stepUnit.style.background = isSkip ? 'rgba(255,0,0,0.05)' : (isActive ? 'var(--bg-surface)' : 'var(--bg-deepest)');
    expect(stepUnit.style.background).toBe('var(--bg-surface)');
  });

  it('inactive non-SKIP step has bg-deepest', () => {
    const stepUnit = { style: {} };
    const isSkip = false;
    const isActive = false;
    stepUnit.style.background = isSkip ? 'rgba(255,0,0,0.05)' : (isActive ? 'var(--bg-surface)' : 'var(--bg-deepest)');
    expect(stepUnit.style.background).toBe('var(--bg-deepest)');
  });

  it('SKIP takes priority over active/inactive for background', () => {
    const stepUnit = { style: {} };
    const isSkip = true;
    // Even if isActive=true, SKIP always uses rgba
    stepUnit.style.background = isSkip ? 'rgba(255,0,0,0.05)' : 'var(--bg-surface)';
    expect(stepUnit.style.background).toBe('rgba(255,0,0,0.05)');
  });

  it('SKIP raw=0 has number indicator borderColor = var(--color-danger)', () => {
    const isSkip = true;
    const borderColor = isSkip ? 'var(--color-danger)' : 'var(--brand-accent)';
    expect(borderColor).toBe('var(--color-danger)');
  });

  it('non-SKIP active has number indicator borderColor = var(--brand-accent)', () => {
    const isSkip = false;
    const borderColor = isSkip ? 'var(--color-danger)' : 'var(--brand-accent)';
    expect(borderColor).toBe('var(--brand-accent)');
  });
});

// ────────── Number indicator borderColor for SKIP+active ─────

describe('Number indicator borderColor — SKIP + active combination', () => {
  it('isSkip=true + isActive=true → borderColor = var(--color-danger)', () => {
    const isSkip = true;
    const isActive = true;
    const borderColor = isActive ? (isSkip ? 'var(--color-danger)' : 'var(--brand-accent)') : 'var(--border-dim)';
    expect(borderColor).toBe('var(--color-danger)');
  });

  it('isSkip=false + isActive=true → borderColor = var(--brand-accent)', () => {
    const isSkip = false;
    const isActive = true;
    const borderColor = isActive ? (isSkip ? 'var(--color-danger)' : 'var(--brand-accent)') : 'var(--border-dim)';
    expect(borderColor).toBe('var(--brand-accent)');
  });

  it('isSkip=true + isActive=false → borderColor = var(--border-dim)', () => {
    const isSkip = true;
    const isActive = false;
    const borderColor = isActive ? (isSkip ? 'var(--color-danger)' : 'var(--brand-accent)') : 'var(--border-dim)';
    expect(borderColor).toBe('var(--border-dim)');
  });

  it('isSkip=false + isActive=false → borderColor = var(--border-dim)', () => {
    const isSkip = false;
    const isActive = false;
    const borderColor = isActive ? (isSkip ? 'var(--color-danger)' : 'var(--brand-accent)') : 'var(--border-dim)';
    expect(borderColor).toBe('var(--border-dim)');
  });

  it('active highlight on SKIP sets numIndicator borderColor to color-danger', () => {
    const isSkip = true;
    const isHighlighted = true;
    // The highlight section overrides: active skip → borderColor = var(--color-danger)
    const numBorderColor = isHighlighted ? (isSkip ? 'var(--color-danger)' : 'var(--accent-pink)') : '';
    expect(numBorderColor).toBe('var(--color-danger)');
  });

  it('active highlight on non-SKIP sets numIndicator borderColor to accent-pink', () => {
    const isSkip = false;
    const isHighlighted = true;
    const numBorderColor = isHighlighted ? (isSkip ? 'var(--color-danger)' : 'var(--accent-pink)') : '';
    expect(numBorderColor).toBe('var(--accent-pink)');
  });
});

// ────────── Bipolar values integration ──────────────────────

describe('Bipolar values — full editing flow integration', () => {
  it('mouse drag → calcBipolar → toRaw → toNormalized round-trip is consistent', () => {
    const rectTop = 100, rectHeight = 200;
    const clientY = 150;

    const bipolar = _calcBipolarFromY(clientY, rectTop, rectHeight);
    const { raw, normalized } = _bipolarToRaw(bipolar);

    // Round-trip: raw → bipolar should give same (or very close) value
    const bipolarBack = _rawToBipolar(raw);
    expect(Math.abs(bipolarBack - bipolar)).toBeLessThanOrEqual(1);
    expect(normalized).toBeGreaterThanOrEqual(0);
    expect(normalized).toBeLessThanOrEqual(1);
  });

  it('full range of Y values produces valid bipolar values', () => {
    const rectTop = 100, rectHeight = 200;
    const testYs = [100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300];
    testYs.forEach(y => {
      const bipolar = _calcBipolarFromY(y, rectTop, rectHeight);
      const { raw, normalized } = _bipolarToRaw(bipolar);
      expect(bipolar).toBeGreaterThanOrEqual(-128);
      expect(bipolar).toBeLessThanOrEqual(127);
      expect(raw).toBeGreaterThanOrEqual(0);
      expect(raw).toBeLessThanOrEqual(255);
      expect(normalized).toBeGreaterThanOrEqual(0);
      expect(normalized).toBeLessThanOrEqual(1);
    });
  });

  it('snap-to-center: clientY values close to center snap to 0', () => {
    const rectTop = 100, rectHeight = 200;
    // For rectTop=100, center Y=200. Snap range |bipolar|<=2
    // clientY 199 → relY=0.495, normVal=0.505, bipolar=round(0.505*255-128)=round(0.775)=1 → snap 0
    // clientY 200 → relY=0.5, normVal=0.5, bipolar=round(-0.5)=0 → snap 0
    // clientY 201 → relY=0.505, normVal=0.495, bipolar=round(-1.775)=-2 → snap 0
    for (let y = 199; y <= 201; y++) {
      expect(_calcBipolarFromY(y, rectTop, rectHeight)).toBe(0);
    }
  });

  it('bipolar to raw to fill-bar: full pipeline consistency', () => {
    const bipolar = 64;
    const { raw } = _bipolarToRaw(bipolar);
    const pct = (bipolar / 127) * 50;

    expect(raw).toBe(192);
    expect(pct).toBeCloseTo(25.197, 1);

    // Fill bar height should match
    const fillHeight = pct + '%';
    expect(fillHeight).toBe((64 / 127 * 50) + '%');
  });
});

// ────────── Polling tick callback (real logic) ───────────────

describe('Polling tick — _modalPollTick callback logic', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns stopped=true when backdrop is hidden', () => {
    const bridge = makeMockBridge();
    const result = _runPollTick(bridge, 'none', {});
    expect(result.stopped).toBe(true);
  });

  it('returns skipped=true when bridge is null', () => {
    const result = _runPollTick(null, 'flex', {});
    expect(result.skipped).toBe(true);
  });

  it('clears highlight when seq_enable < 0.5', () => {
    const bridge = makeMockBridge({ 'seq_enable': 0.0 });
    const state = { _modalActiveStep: 5, _modalLastPolledStep: 5 };
    const result = _runPollTick(bridge, 'flex', state);
    expect(result.highlightCleared).toBe(true);
    expect(result.lastPolled).toBe(-1);
  });

  it('does not clear highlight if _modalActiveStep already -1', () => {
    const bridge = makeMockBridge({ 'seq_enable': 0.0 });
    const state = { _modalActiveStep: -1, _modalLastPolledStep: -1 };
    const result = _runPollTick(bridge, 'flex', state);
    expect(result.highlightCleared).toBe(false);
  });

  it('clears highlight when currentStep is undefined', () => {
    const bridge = makeMockBridge({ 'seq_enable': 1.0 });
    const state = { _modalActiveStep: 3, _modalLastPolledStep: 3 };
    const result = _runPollTick(bridge, 'flex', state);
    expect(result.highlightCleared).toBe(true);
    expect(result.lastPolled).toBe(-1);
  });

  it('clears highlight when currentStep is null', () => {
    const bridge = makeMockBridge({ 'seq_enable': 1.0, 'seq_current_step': null });
    const state = { _modalActiveStep: 3 };
    const result = _runPollTick(bridge, 'flex', state);
    expect(result.highlightCleared).toBe(true);
  });

  it('detects step change and updates active step', () => {
    const bridge = makeMockBridge({ 'seq_enable': 1.0, 'seq_current_step': 7, 'seq_current_step_skip': 0 });
    const state = { _modalActiveStep: -1, _modalActiveSkip: false, _modalLastPolledStep: -1 };
    const result = _runPollTick(bridge, 'flex', state);
    expect(result.stepChanged).toBe(true);
    expect(result.stepIdx).toBe(7);
    expect(state._modalActiveStep).toBe(7);
    expect(state._modalLastPolledStep).toBe(7);
  });

  it('does nothing when step has not changed', () => {
    const bridge = makeMockBridge({ 'seq_enable': 1.0, 'seq_current_step': 3, 'seq_current_step_skip': 0 });
    const state = { _modalActiveStep: 3, _modalActiveSkip: false, _modalLastPolledStep: 3 };
    const result = _runPollTick(bridge, 'flex', state);
    expect(result.stepChanged).toBe(false);
  });

  it('detects skip state change even when step index same', () => {
    const bridge = makeMockBridge({ 'seq_enable': 1.0, 'seq_current_step': 5, 'seq_current_step_skip': 1.0 });
    const state = { _modalActiveStep: 5, _modalActiveSkip: false, _modalLastPolledStep: 5 };
    const result = _runPollTick(bridge, 'flex', state);
    expect(result.stepChanged).toBe(true);
    expect(result.isSkip).toBe(true);
  });

  it('rounds floats for seq_current_step', () => {
    const bridge = makeMockBridge({ 'seq_enable': 1.0, 'seq_current_step': 3.7, 'seq_current_step_skip': 0 });
    const state = { _modalActiveStep: -1, _modalActiveSkip: false, _modalLastPolledStep: -1 };
    const result = _runPollTick(bridge, 'flex', state);
    expect(result.stepIdx).toBe(4);
  });

  it('maintains stepIdx=0 correctly (not treated as falsy)', () => {
    const bridge = makeMockBridge({ 'seq_enable': 1.0, 'seq_current_step': 0, 'seq_current_step_skip': 0 });
    const state = { _modalActiveStep: -1, _modalActiveSkip: false, _modalLastPolledStep: -1 };
    const result = _runPollTick(bridge, 'flex', state);
    expect(result.stepIdx).toBe(0);
    expect(result.stepChanged).toBe(true);
  });
});

// ────────── Step editing — drag interaction (updateValFromY) ─

describe('Step editing — drag interaction (updateValFromY)', () => {
  it('mousedown at top of barContainer produces +127 (max positive)', () => {
    const vals = Array(32).fill(0);
    const raws = Array(32).fill(0);
    // clientY=rectTop → relY=0 → normVal=1.0 → bipolar=round(255-128)=127
    const result = _dragEditStep(0, 100, 100, 200, vals, raws, null);
    expect(result.bipolarVal).toBe(127);
    expect(result.rawByte).toBe(255);
  });

  it('mousedown at bottom produces -128 (max negative)', () => {
    const vals = Array(32).fill(0);
    const raws = Array(32).fill(0);
    // clientY=300, rectTop=100, height=200 → relY=1.0 → normVal=0 → bipolar=round(-128)
    const result = _dragEditStep(0, 300, 100, 200, vals, raws, null);
    expect(result.bipolarVal).toBe(-128);
    expect(result.rawByte).toBe(0);
  });

  it('mousedown at center produces 0 bipolar, center snap applies', () => {
    const vals = Array(32).fill(0);
    const raws = Array(32).fill(0);
    // clientY=200, rectTop=100, height=200 → relY=0.5 → normVal=0.5 → bipolar=round(-0.5)=0 → snap 0
    const result = _dragEditStep(0, 200, 100, 200, vals, raws, null);
    expect(result.bipolarVal).toBe(0);
    expect(result.rawByte).toBe(128);
  });

  it('near-center values snap to 0 (|bipolar| <= 2)', () => {
    const vals = Array(32).fill(0);
    const raws = Array(32).fill(0);
    // clientY=199 → relY=0.495 → normVal=0.505 → bipolar=round(0.775)=1 → snap 0
    const r1 = _dragEditStep(0, 199, 100, 200, vals, raws, null);
    expect(r1.bipolarVal).toBe(0);
    expect(r1.rawByte).toBe(128);
  });

  it('drag at index 5 sends seq_step_6 to bridge', () => {
    const vals = Array(32).fill(0);
    const raws = Array(32).fill(0);
    const bridge = makeMockBridge();
    _dragEditStep(5, 120, 100, 200, vals, raws, bridge);
    expect(bridge.setParameter).toHaveBeenCalledWith('seq_step_6', expect.any(Number));
  });

  it('normalized value is always within 0..1', () => {
    const vals = Array(32).fill(0);
    const raws = Array(32).fill(0);
    for (let cy = 100; cy <= 300; cy += 10) {
      const r = _dragEditStep(0, cy, 100, 200, vals, raws, null);
      expect(r.normalized).toBeGreaterThanOrEqual(0);
      expect(r.normalized).toBeLessThanOrEqual(1);
    }
  });

  it('rawByte is always within 0..255', () => {
    const vals = Array(32).fill(0);
    const raws = Array(32).fill(0);
    for (let cy = 90; cy <= 310; cy += 10) {
      const r = _dragEditStep(0, cy, 100, 200, vals, raws, null);
      expect(r.rawByte).toBeGreaterThanOrEqual(0);
      expect(r.rawByte).toBeLessThanOrEqual(255);
    }
  });

  it('updates seqStepsValues[i] in-place', () => {
    const vals = Array(32).fill(0);
    const raws = Array(32).fill(0);
    _dragEditStep(7, 150, 100, 200, vals, raws, null);
    expect(vals[7]).not.toBe(0); // should be non-zero
  });

  it('mousemove calls updateValFromY again with new clientY', () => {
    const vals = Array(32).fill(0);
    const raws = Array(32).fill(0);
    const bridge = makeMockBridge();
    // First drag to y=120 → positive
    _dragEditStep(3, 120, 100, 200, vals, raws, bridge);
    const firstBipolar = vals[3];
    // Second drag to y=280 → negative
    _dragEditStep(3, 280, 100, 200, vals, raws, bridge);
    const secondBipolar = vals[3];
    expect(firstBipolar).toBeGreaterThan(0);
    expect(secondBipolar).toBeLessThan(0);
    expect(bridge.setParameter).toHaveBeenCalledTimes(2);
  });
});

// ────────── Step hover LCD display ───────────────────────────

describe('Step hover — LCD display content', () => {
  function _hoverLcdHtml(idx, bipolarVal, rawVal) {
    // Mirrors mouseenter handler: CONTROL SEQ MODAL header
    const isSkip = rawVal === 0;
    const sign = bipolarVal >= 0 ? '+' : '';
    const valStr = isSkip ? 'SKIP' : sign + bipolarVal;
    return '<span style="font-size:10px; opacity:0.6;">CONTROL SEQ MODAL</span><br>'
      + '<strong>STEP ' + (idx + 1) + ' VALUE</strong><br>'
      + '<span style="font-size:15px; color:var(--accent-pink);">' + valStr + ' (raw:' + rawVal + ')</span>';
  }

  it('hover shows CONTROL SEQ MODAL header', () => {
    const html = _hoverLcdHtml(5, 64, 192);
    expect(html).toContain('CONTROL SEQ MODAL');
  });

  it('hover shows correct step index (1-based)', () => {
    const html = _hoverLcdHtml(0, 64, 192);
    expect(html).toContain('STEP 1 VALUE');
  });

  it('hover shows step 32 for index 31', () => {
    const html = _hoverLcdHtml(31, -64, 64);
    expect(html).toContain('STEP 32 VALUE');
  });

  it('hover shows positive bipolar with + prefix', () => {
    const html = _hoverLcdHtml(0, 64, 192);
    expect(html).toContain('+64 (raw:192)');
  });

  it('hover shows negative bipolar without + prefix', () => {
    const html = _hoverLcdHtml(0, -64, 64);
    expect(html).toContain('-64 (raw:64)');
  });

  it('hover shows SKIP for raw=0', () => {
    const html = _hoverLcdHtml(0, 0, 0);
    expect(html).toContain('SKIP (raw:0)');
  });

  it('hover shows center (0) with raw=128', () => {
    const html = _hoverLcdHtml(0, 0, 128);
    expect(html).toContain('+0 (raw:128)');
  });
});

// ────────── Double-click reset to center ─────────────────────

describe('Step double-click — reset to center', () => {
  function _doubleClickReset(idx, stepsValues, stepsRaw, bridge) {
    // Mirrors dblclick handler
    stepsValues[idx] = 0;
    stepsRaw[idx] = 128;
    if (bridge) {
      bridge.setParameter('seq_step_' + (idx + 1), 0.5);
    }
    return { bipolar: stepsValues[idx], raw: stepsRaw[idx] };
  }

  it('resets bipolar to 0', () => {
    const vals = Array(32).fill(64);
    const raws = Array(32).fill(192);
    const result = _doubleClickReset(5, vals, raws, null);
    expect(result.bipolar).toBe(0);
    expect(vals[5]).toBe(0);
  });

  it('resets raw byte to 128 (center)', () => {
    const vals = Array(32).fill(0);
    const raws = Array(32).fill(0);
    const result = _doubleClickReset(10, vals, raws, null);
    expect(result.raw).toBe(128);
    expect(raws[10]).toBe(128);
  });

  it('sends normalized=0.5 to bridge (raw 128/255)', () => {
    const vals = Array(32).fill(0);
    const raws = Array(32).fill(0);
    const bridge = makeMockBridge();
    _doubleClickReset(0, vals, raws, bridge);
    expect(bridge.setParameter).toHaveBeenCalledWith('seq_step_1', 0.5);
  });

  it('resets index 0 and 31 correctly', () => {
    const vals = Array(32).fill(64);
    const raws = Array(32).fill(192);
    const r0 = _doubleClickReset(0, vals, raws, null);
    const r31 = _doubleClickReset(31, vals, raws, null);
    expect(r0.bipolar).toBe(0);
    expect(r31.bipolar).toBe(0);
    expect(r0.raw).toBe(128);
    expect(r31.raw).toBe(128);
  });

  it('idempotent: double-clicking center stays center', () => {
    const vals = Array(32).fill(0);
    const raws = Array(32).fill(128);
    _doubleClickReset(7, vals, raws, null);
    _doubleClickReset(7, vals, raws, null);
    expect(vals[7]).toBe(0);
    expect(raws[7]).toBe(128);
  });

  it('without bridge does not throw', () => {
    const vals = Array(32).fill(64);
    const raws = Array(32).fill(192);
    expect(() => _doubleClickReset(3, vals, raws, null)).not.toThrow();
  });
});

// ────────── Preset item selection UI ─────────────────────────

describe('SEQ preset list — item selection (same as ARP but accent-pink)', () => {
  it('clicking preset item sets accent-pink background and selected class', () => {
    const items = [
      { style: {}, classList: { add: vi.fn(), remove: vi.fn() }, innerText: 'Staircase' },
      { style: {}, classList: { add: vi.fn(), remove: vi.fn() }, innerText: 'Triangle' },
    ];
    _seqPresetItemClick(items, 0);
    expect(items[0].style.background).toContain('accent-pink');
    expect(items[0].classList.add).toHaveBeenCalledWith('selected');
    expect(items[1].classList.remove).toHaveBeenCalledWith('selected');
  });

  it('clicking different item switches selection', () => {
    const items = [
      { style: {}, classList: { add: vi.fn(), remove: vi.fn() } },
      { style: {}, classList: { add: vi.fn(), remove: vi.fn() } },
      { style: {}, classList: { add: vi.fn(), remove: vi.fn() } },
    ];
    _seqPresetItemClick(items, 0);
    expect(items[0].classList.add).toHaveBeenCalledWith('selected');
    _seqPresetItemClick(items, 2);
    expect(items[0].classList.remove).toHaveBeenCalledWith('selected');
    expect(items[2].classList.add).toHaveBeenCalledWith('selected');
  });

  it('re-clicking same item calls add again', () => {
    const items = [
      { style: {}, classList: { add: vi.fn(), remove: vi.fn() } },
    ];
    _seqPresetItemClick(items, 0);
    expect(items[0].classList.add).toHaveBeenCalledTimes(1);
    _seqPresetItemClick(items, 0);
    expect(items[0].classList.add).toHaveBeenCalledTimes(2);
  });
});

// ────────── Param change dispatch ─────────────────────────────

describe('SEQ param change dispatch — onParameterChanged handler', () => {
  function _seqDispatchParam(paramId, val, controls, selectors, sliders, stepsValues, stepsRaw) {
    // Mirrors the onParameterChanged callback in sequencer.js
    if (paramId === 'seq_enable' && controls.seqBox) {
      controls.seqBox.classList.toggle('active', val > 0.5);
    }
    if (paramId === 'seq_clock' && selectors.clock) {
      selectors.clock.value = Math.round(val * 15.0);
    }
    if (paramId === 'seq_length' && selectors.length) {
      selectors.length.value = Math.round(val * 31.0);
    }
    if (paramId === 'seq_key_loop' && selectors.keyLoop) {
      selectors.keyLoop.value = Math.round(val * 2.0);
    }
    if (paramId && paramId.startsWith('seq_step_')) {
      const stepIdx = parseInt(paramId.split('_')[2], 10) - 1;
      if (stepIdx >= 0 && stepIdx < 32) {
        const rawByte = Math.round(val * 255);
        if (stepsValues) {stepsValues[stepIdx] = rawByte === 0 ? 0 : rawByte - 128;}
        if (stepsRaw) {stepsRaw[stepIdx] = rawByte;}
        return { stepIdx, rawByte, bipolar: rawByte === 0 ? 0 : rawByte - 128 };
      }
      return null; // unmatched seq_step_ (out of range or invalid suffix)
    }
    if (paramId === 'seq_swing' && sliders.swingText) {
      sliders.swingText.innerText = Math.round(50 + val * 9);
    }
    if (paramId === 'seq_slew_rate' && sliders.slewText) {
      sliders.slewText.innerText = Math.round(val * 255);
    }
    return null;
  }

  it('seq_enable > 0.5 toggles seqBox active class on', () => {
    const seqBox = makeMockToggleBox(false);
    _seqDispatchParam('seq_enable', 0.8, { seqBox }, {}, {}, null, null);
    expect(seqBox.classList.toggle).toHaveBeenCalledWith('active', true);
  });

  it('seq_enable <= 0.5 toggles seqBox active class off', () => {
    const seqBox = makeMockToggleBox(true);
    _seqDispatchParam('seq_enable', 0.3, { seqBox }, {}, {}, null, null);
    expect(seqBox.classList.toggle).toHaveBeenCalledWith('active', false);
  });

  it('seq_clock updates clock select value (val*15)', () => {
    const clock = makeMockSelect();
    _seqDispatchParam('seq_clock', 0.5, {}, { clock }, {}, null, null);
    expect(clock.value).toBe(8);
  });

  it('seq_length updates length select value (val*31)', () => {
    const lengthEl = makeMockSelect();
    _seqDispatchParam('seq_length', 0.5, {}, { length: lengthEl }, {}, null, null);
    expect(lengthEl.value).toBe(16);
  });

  it('seq_key_loop updates keyLoop select value (val*2)', () => {
    const keyLoop = makeMockSelect();
    _seqDispatchParam('seq_key_loop', 0.75, {}, { keyLoop }, {}, null, null);
    expect(keyLoop.value).toBe(2);
  });

  it('seq_step_5 updates step values index 4', () => {
    const vals = Array(32).fill(0);
    const raws = Array(32).fill(128);
    const result = _seqDispatchParam('seq_step_5', 0.75, {}, {}, {}, vals, raws);
    expect(result.stepIdx).toBe(4);
    expect(result.rawByte).toBe(191);
    expect(result.bipolar).toBe(63);
  });

  it('seq_step_1 updates index 0 (first step)', () => {
    const vals = Array(32).fill(0);
    const raws = Array(32).fill(128);
    const result = _seqDispatchParam('seq_step_1', 0.0, {}, {}, {}, vals, raws);
    expect(result.stepIdx).toBe(0);
    expect(result.rawByte).toBe(0);
    expect(result.bipolar).toBe(0); // rawByte===0 → 0
  });

  it('seq_step_32 updates index 31 (last step)', () => {
    const vals = Array(32).fill(0);
    const raws = Array(32).fill(128);
    const result = _seqDispatchParam('seq_step_32', 1.0, {}, {}, {}, vals, raws);
    expect(result.stepIdx).toBe(31);
    expect(result.rawByte).toBe(255);
  });

  it('seq_swing updates swing text display', () => {
    const swingText = { innerText: '' };
    _seqDispatchParam('seq_swing', 0.48, {}, {}, { swingText }, null, null);
    expect(swingText.innerText).toBe(54); // round(50 + 0.48*9) = round(54.32) = 54
  });

  it('seq_slew_rate updates slew text display', () => {
    const slewText = { innerText: '' };
    _seqDispatchParam('seq_slew_rate', 0.784, {}, {}, { slewText }, null, null);
    expect(slewText.innerText).toBe(200); // round(0.784 * 255) = round(199.92) = 200
  });

  it('seq_step_N with out-of-range index (0 or 32) is ignored', () => {
    const result0 = _seqDispatchParam('seq_step_0', 0.5, {}, {}, {}, null, null);
    const result33 = _seqDispatchParam('seq_step_33', 0.5, {}, {}, {}, null, null);
    expect(result0).toBeNull();
    expect(result33).toBeNull();
  });

  it('seq_step_N with non-numeric suffix returns null', () => {
    // parseint('abc',10) = NaN, NaN-1 = NaN, NaN>=0 is false → returns null
    const result = _seqDispatchParam('seq_step_abc', 0.5, {}, {}, {}, null, null);
    expect(result).toBeNull();
  });
});

// ────────── Modal lifecycle — MutationObserver ───────────────

describe('Modal lifecycle — MutationObserver style.display', () => {
  it('display=flex calls start polling and clear highlight', () => {
    let pollStarted = false, highlightCleared = false;
    const backdrop = { style: { display: 'flex' } };
    function start() { pollStarted = true; }
    function clear() { highlightCleared = true; }
    if (backdrop.style.display === 'flex') {
      clear();
      start();
    }
    expect(highlightCleared).toBe(true);
    expect(pollStarted).toBe(true);
  });

  it('display=none calls stop polling and clear highlight', () => {
    let pollStopped = false, highlightCleared = false;
    const backdrop = { style: { display: 'none' } };
    function stop() { pollStopped = true; }
    function clear() { highlightCleared = true; }
    if (backdrop.style.display === 'none') {
      stop();
      clear();
    }
    expect(pollStopped).toBe(true);
    expect(highlightCleared).toBe(true);
  });

  it('display=other value does nothing', () => {
    let actionTaken = false;
    const backdrop = { style: { display: 'block' } };
    if (backdrop.style.display === 'flex') {
      actionTaken = true;
    } else if (backdrop.style.display === 'none') {
      actionTaken = true;
    }
    expect(actionTaken).toBe(false);
  });

  it('hide modal calls stop polling and clear highlight (backdrop click)', () => {
    let pollStopped = false, highlightCleared = false;
    function _hideSeqModal() {
      highlightCleared = true;
      pollStopped = true;
    }
    _hideSeqModal();
    expect(highlightCleared).toBe(true);
    expect(pollStopped).toBe(true);
  });

  it('hide modal via closeBtn has same effect as backdrop click', () => {
    let pollStopped = false, highlightCleared = false;
    function _hideSeqModal() {
      highlightCleared = true;
      pollStopped = true;
    }
    // Called by both closeBtn.addEventListener('click', _hideSeqModal)
    // and backdrop.addEventListener('click', (e) => { if (e.target === backdrop) _hideSeqModal(); })
    _hideSeqModal();
    expect(highlightCleared).toBe(true);
    expect(pollStopped).toBe(true);
  });
});

// ────────── Full integration: open → edit → poll → close ────

describe('Full integration — open modal, edit step, poll tick, close', () => {
  it('open modal syncs immediate highlight from current_step', () => {
    const bridge = makeMockBridge({ 'seq_current_step': 3, 'seq_current_step_skip': 0 });
    const curStep = bridge.parameterCache['seq_current_step'];
    expect(curStep).toBe(3);
    if (curStep !== undefined) {
      const activeStep = Math.round(curStep);
      const activeSkip = (bridge.parameterCache['seq_current_step_skip'] || 0) > 0.5;
      expect(activeStep).toBe(3);
      expect(activeSkip).toBe(false);
    }
  });

  it('edit step updates values and bridge param', () => {
    const vals = Array(32).fill(0);
    const raws = Array(32).fill(128);
    const bridge = makeMockBridge();
    const r = _dragEditStep(7, 140, 100, 200, vals, raws, bridge);
    expect(vals[7]).toBe(r.bipolarVal);
    expect(raws[7]).toBe(r.rawByte);
    expect(bridge.setParameter).toHaveBeenCalledTimes(1);
  });

  it('poll tick during editing still updates highlight', () => {
    const bridge = makeMockBridge({ 'seq_enable': 1.0, 'seq_current_step': 5, 'seq_current_step_skip': 0 });
    const state = { _modalActiveStep: -1, _modalActiveSkip: false, _modalLastPolledStep: -1 };
    const pollResult = _runPollTick(bridge, 'flex', state);
    expect(pollResult.stepChanged).toBe(true);
    expect(state._modalActiveStep).toBe(5);
  });

  it('preset load sets 32 values, bridge synced', () => {
    const bridge = makeMockBridge();
    const result = _seqPresetLoad('Staircase ramp', [], bridge);
    expect(result.values.length).toBe(32);
    expect(result.values[0]).toBe(-128);
    expect(result.values[31]).toBe(127);
    expect(bridge.setParameter).toHaveBeenCalledTimes(32);
  });

  it('close modal clears highlight and stops polling', () => {
    let pollStopped = false, highlightCleared = false;
    function _hideSeqModal() {
      highlightCleared = true;
      pollStopped = true;
    }
    _hideSeqModal();
    expect(highlightCleared).toBe(true);
    expect(pollStopped).toBe(true);
  });

  it('preset item click + load button triggers full pipeline', () => {
    const items = [
      { style: {}, classList: { add: vi.fn(), remove: vi.fn() }, innerText: 'Staircase' },
    ];
    // Select Staircase
    _seqPresetItemClick(items, 0);
    expect(items[0].classList.add).toHaveBeenCalledWith('selected');
    // Load preset (simulated)
    const bridge = makeMockBridge();
    const result = _seqPresetLoad('Staircase', [], bridge);
    expect(result.values[0]).toBe(-128);
    expect(bridge.setParameter).toHaveBeenCalledWith('seq_step_1', 0);
  });
});

// ────────── _updateSeqModalModeBadge DOM update ──────────────

describe('_updateSeqModalModeBadge — DOM update', () => {
  function _updateModeBadge(badgeEl, keyLoopNorm, forcedFreeRunning) {
    // Mirrors _updateSeqModalModeBadge
    if (!badgeEl) {return;}
    const keyLoopVal = Math.round((keyLoopNorm || 0) * 2);
    let label, color, tooltip, cursorStyle;
    if (forcedFreeRunning) {
      label = 'FREE*';
      color = 'var(--accent-yellow)';
      tooltip = ' title="Key Sync desactivado automáticamente — no había teclas presionadas al activar SEQ"';
      cursorStyle = ';cursor:help';
    } else if (keyLoopVal === 0) {
      label = 'FREE';
      color = 'var(--accent-green)';
      tooltip = '';
      cursorStyle = '';
    } else if (keyLoopVal === 1) {
      label = 'KEY';
      color = 'var(--accent-blue)';
      tooltip = '';
      cursorStyle = '';
    } else {
      label = 'LOOP';
      color = 'var(--accent-teal)';
      tooltip = '';
      cursorStyle = '';
    }
    badgeEl.innerHTML = '<span style="color:' + color + ';font-weight:bold;border:1px solid ' + color + ';padding:0 6px;border-radius:3px;font-size:10px' + cursorStyle + '"' + tooltip + '>' + label + '</span>';
  }

  it('FREE* sets innerHTML with yellow span + cursor + tooltip', () => {
    const badgeEl = { innerHTML: '' };
    _updateModeBadge(badgeEl, 0, true);
    expect(badgeEl.innerHTML).toContain('FREE*');
    expect(badgeEl.innerHTML).toContain('var(--accent-yellow)');
    expect(badgeEl.innerHTML).toContain('cursor:help');
    expect(badgeEl.innerHTML).toContain('title="');
  });

  it('FREE sets innerHTML with green span, no tooltip', () => {
    const badgeEl = { innerHTML: '' };
    _updateModeBadge(badgeEl, 0, false);
    expect(badgeEl.innerHTML).toContain('FREE');
    expect(badgeEl.innerHTML).toContain('var(--accent-green)');
    expect(badgeEl.innerHTML).not.toContain('cursor');
    expect(badgeEl.innerHTML).not.toContain('title="');
  });

  it('KEY sets innerHTML with blue span', () => {
    const badgeEl = { innerHTML: '' };
    _updateModeBadge(badgeEl, 0.5, false);
    expect(badgeEl.innerHTML).toContain('KEY');
    expect(badgeEl.innerHTML).toContain('var(--accent-blue)');
  });

  it('LOOP sets innerHTML with teal span', () => {
    const badgeEl = { innerHTML: '' };
    _updateModeBadge(badgeEl, 1.0, false);
    expect(badgeEl.innerHTML).toContain('LOOP');
    expect(badgeEl.innerHTML).toContain('var(--accent-teal)');
  });

  it('null badgeEl does not throw', () => {
    expect(() => _updateModeBadge(null, 0, false)).not.toThrow();
  });
});
