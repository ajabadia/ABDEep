/**
 * Unit tests for panel edit helper functions (extracted from panel_edit.js)
 *
 * Run with: npx vitest run WebUI/tests/panelEdit.test.js
 *
 * Covers:
 *   - updatePanelFromState  (syncs parameterCache → DOM sliders/selects/toggles/LED rows)
 *   - updateScreenHeight    (collapses/expands graphic screen per mode)
 *   - updateRealScopeHeight (collapses/expands real scope per mode / JUCE flag)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ══════════════════════════════════════════════════════════════════
// Mock state
// ══════════════════════════════════════════════════════════════════

let _drawPanelGraphicCalled = false;
let _bridge = null; // set per test

// ══════════════════════════════════════════════════════════════════
// Helper: create a mock canvas 2D context
// ══════════════════════════════════════════════════════════════════

function _makeMockCtx() {
  return {
    canvas: { width: 200, height: 100 },
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    arc: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 10 })),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  };
}

function _makeBridge(cache) {
  return {
    parameterCache: cache || {},
    isJuce: false,
  };
}

// ══════════════════════════════════════════════════════════════════
// Fake DOM element factory (extended for panel edit needs)
// ══════════════════════════════════════════════════════════════════

function _createFakeEl(tag, attrs) {
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    id: (attrs && attrs.id) || '',
    _attrs: attrs || {},
    _listeners: {},
    value: '',
    textContent: '',
    innerHTML: '',
    innerText: '',
    checked: false,
    style: {
      _props: {},
      removeProperty(prop) { delete this._props[prop]; },
      get top() { return this._props.top; },
      set top(val) { this._props.top = val; },
      get height() { return this._props.height; },
      set height(val) { this._props.height = val; },
      get display() { return this._props.display; },
      set display(val) { this._props.display = val; },
      get borderBottomWidth() { return this._props.borderBottomWidth; },
      set borderBottomWidth(val) { this._props.borderBottomWidth = val; },
      setProperty(prop, val) { this._props[prop] = val; },
    },
    dataset: {},
    classList: {
      _classes: [],
      add(c) { if (!this._classes.includes(c)) this._classes.push(c); },
      remove(c) { this._classes = this._classes.filter(x => x !== c); },
      contains(c) { return this._classes.includes(c); },
      toggle(c, force) {
        if (force === true) { this.add(c); return true; }
        if (force === false) { this.remove(c); return false; }
        return this.contains(c) ? (this.remove(c), false) : (this.add(c), true);
      },
    },
    clientHeight: 100,
    getAttribute(name) { return this._attrs[name] || null; },
    setAttribute(name, val) { this._attrs[name] = val; },
    hasAttribute(name) { return name in this._attrs; },
    addEventListener(event, handler) {
      if (!this._listeners[event]) this._listeners[event] = [];
      this._listeners[event].push(handler);
    },
    removeEventListener() {},
    dispatchEvent() {},
    appendChild(child) { this._children = this._children || []; this._children.push(child); },
    _children: [],
    _subElements: {},
    _selectorAll: {},
    querySelector(sel) { return this._subElements[sel] || null; },
    querySelectorAll(sel) { return this._selectorAll[sel] || []; },
    closest(sel) {
      // For `closest('[data-param]')` — if this element has the attr, return self
      if (sel && sel.startsWith('[') && sel.endsWith(']')) {
        const attr = sel.slice(1, -1);
        if (this._attrs[attr] !== undefined) return this;
        // Otherwise traverse up (simplified: just check parent reference)
        return this._parent && this._parent._attrs && this._parent._attrs[attr] !== undefined ? this._parent : null;
      }
      return null;
    },
    getBoundingClientRect() {
      return {
        top: 0, left: 0, width: 40,
        height: this.clientHeight || 100,
        bottom: this.clientHeight || 100, right: 40,
      };
    },
    _parent: null,
    options: [],
  };
  return el;
}

/** Create a complete slider unit: container[data-param] > .v-slider > .handle */
function _makeSlider(paramId, height) {
  const container = _createFakeEl('div', { 'data-param': paramId });
  container.clientHeight = height || 100;
  const slider = _createFakeEl('div');
  slider.classList.add('v-slider');
  slider.clientHeight = height || 100;
  const handle = _createFakeEl('div');
  handle.classList.add('handle');
  slider._subElements['.handle'] = handle;
  container._subElements['.v-slider'] = slider;
  slider._parent = container;
  return container;
}

/** Create a select dropdown with data-param and options */
function _makeSelect(paramId, optionCount) {
  const sel = _createFakeEl('select', { 'data-param': paramId });
  sel.options = [];
  for (let i = 0; i < (optionCount || 4); i++) {
    sel.options.push(_createFakeEl('option'));
  }
  return sel;
}

/** Create a toggle-box with id and data-param */
function _makeToggle(id, paramId) {
  const box = _createFakeEl('div', { 'data-param': paramId });
  box.id = id || '';
  box.classList.add('toggle-box');
  return box;
}

/** Create a shape-led-row with data attributes */
function _makeShapeLedRow(dataShape, dataTrig, dataVal, paramId) {
  const attrs = { 'class': 'shape-led-row' };
  if (dataShape !== undefined) attrs['data-shape'] = String(dataShape);
  if (dataTrig !== undefined) attrs['data-trig'] = String(dataTrig);
  if (dataVal !== undefined) attrs['data-val'] = String(dataVal);
  if (paramId !== undefined) attrs['data-param'] = paramId;
  const row = _createFakeEl('div', attrs);
  row.classList.add('shape-led-row');
  return row;
}

/** Create a fake container element that supports querySelectorAll */
function _makeContainer() {
  const cont = _createFakeEl('div', { id: 'panel-dynamic-controls' });
  // Simplified: use arrays for selectorAll lookups
  cont._vSliders = [];
  cont._selects = [];
  cont._toggles = [];
  cont._shapeRows = [];

  cont.querySelectorAll = function(sel) {
    if (sel === '.v-slider') return cont._vSliders;
    if (sel === 'select[data-param]') return cont._selects;
    if (sel === '.toggle-box[data-param]') return cont._toggles;
    if (sel === '.shape-led-row') return cont._shapeRows;
    if (sel === '[data-param]') return [];
    return [];
  };

  cont.querySelector = function(sel) {
    return null;
  };

  return cont;
}

// ══════════════════════════════════════════════════════════════════
// Functions under test (extracted from panel_edit.js closures)
// ══════════════════════════════════════════════════════════════════

/** updatePanelFromState: syncs parameterCache → DOM sliders/selects/toggles/shape rows */
function updatePanelFromState(container) {
  if (!window.dualMidiBridge) return;

  // Vertical sliders
  container.querySelectorAll('.v-slider').forEach(function(slider) {
    const ctrlUnit = slider.closest('[data-param]');
    if (!ctrlUnit) return;
    const paramId = ctrlUnit.getAttribute('data-param');
    if (!paramId) return;
    const val = window.dualMidiBridge.parameterCache[paramId];
    if (val !== undefined) {
      const handle = slider.querySelector('.handle');
      if (handle) {
        const updatePos = function() {
          const rect = slider.getBoundingClientRect();
          if (rect.height > 0) {
            const handleHeight = 16;
            const pos = (1.0 - val) * (rect.height - handleHeight);
            handle.style.top = pos + 'px';
          }
        };
        updatePos();
      }
    }
  });

  // Select dropdowns
  container.querySelectorAll('select[data-param]').forEach(function(sel) {
    const paramId = sel.getAttribute('data-param');
    const val = window.dualMidiBridge.parameterCache[paramId];
    if (val !== undefined) {
      const optionsCount = sel.options.length;
      sel.value = Math.round(val * (optionsCount - 1));
    }
  });

  // Toggle boxes
  container.querySelectorAll('.toggle-box[data-param]').forEach(function(box) {
    const paramId = box.getAttribute('data-param');
    const val = window.dualMidiBridge.parameterCache[paramId];
    if (val !== undefined) {
      if (paramId === 'vca_mode') {
        if (box.id === 'panel-vca-mode-transparent') box.classList.toggle('active', val < 0.5);
        if (box.id === 'panel-vca-mode-ballsy') box.classList.toggle('active', val > 0.5);
      } else if (paramId === 'vcf_pole_mode') {
        if (box.id === 'panel-vcf-pole-2') box.classList.toggle('active', val < 0.5);
        if (box.id === 'panel-vcf-pole-4') box.classList.toggle('active', val > 0.5);
      } else {
        box.classList.toggle('active', val > 0.5);
      }
    }
  });

  // Shape / trigger / priority / range / chord LED rows
  container.querySelectorAll('.shape-led-row').forEach(function(row) {
    let paramId = row.getAttribute('data-param');
    if (!paramId) {
      if (row.classList.contains('chord-key-led-row')) paramId = 'chord_key';
      if (row.classList.contains('chord-type-led-row')) paramId = 'chord_type';
    }
    if (!paramId) return;

    const val = window.dualMidiBridge.parameterCache[paramId];
    if (val !== undefined) {
      let maxVal = 6.0;
      if (row.hasAttribute('data-trig')) maxVal = 4.0;
      else if (paramId === 'note_priority') maxVal = 2.0;
      else if (paramId === 'trigger_mode') maxVal = 3.0;
      else if (paramId === 'osc1_range' || paramId === 'osc2_range') maxVal = 2.0;
      else if (paramId === 'osc1_pm_mode') maxVal = 1.0;
      else if (paramId === 'chord_key') maxVal = 11.0;
      else if (paramId === 'chord_type') maxVal = 11.0;

      const activeIndex = Math.round(val * maxVal);
      const currentIdx = parseInt(row.getAttribute('data-shape') || row.getAttribute('data-trig') || row.getAttribute('data-val') || '0');
      row.classList.toggle('active', currentIdx === activeIndex);
    }
  });

  // Redraw panel graphic canvas
  if (typeof window.drawPanelGraphic === 'function') {
    window.drawPanelGraphic();
  }
}

/** updateScreenHeight: toggle graphic screen visibility/height */
function updateScreenHeight(screenEl, screenToggleBtn, currentPanelMode, isScreenCollapsed, noScreenModes) {
  if (!screenEl || !screenToggleBtn) return;
  if (noScreenModes.includes(currentPanelMode)) {
    screenEl.style.height = '0px';
    screenEl.style.borderBottomWidth = '0px';
    screenEl.style.display = 'none';
    screenToggleBtn.style.display = 'none';
  } else {
    screenEl.style.display = 'flex';
    screenToggleBtn.style.display = 'block';
    if (isScreenCollapsed) {
      screenEl.style.height = '0px';
      screenEl.style.borderBottomWidth = '0px';
      screenToggleBtn.innerHTML = '&#9660; EXPAND &#9660;';
    } else {
      screenEl.style.height = '100px';
      screenEl.style.borderBottomWidth = '1.5px';
      screenToggleBtn.innerHTML = '&#9650; COLLAPSE &#9650;';
    }
  }
}

/** updateRealScopeHeight: toggle real scope screen visibility/height */
function updateRealScopeHeight(realScopeScreenEl, realScopeToggleBtn, currentPanelMode, isRealScopeCollapsed, noScopeModes, scopeToolbar, stopPollingFn) {
  if (!realScopeScreenEl || !realScopeToggleBtn) return;
  const isJuce = window.dualMidiBridge && window.dualMidiBridge.isJuce;

  if (noScopeModes.includes(currentPanelMode)) {
    realScopeScreenEl.style.display = 'none';
    realScopeToggleBtn.style.display = 'none';
    if (typeof stopPollingFn === 'function') stopPollingFn();
    return;
  }
  realScopeScreenEl.style.display = 'flex';
  realScopeToggleBtn.style.display = 'block';
  if (isRealScopeCollapsed) {
    realScopeScreenEl.style.height = '0px';
    realScopeScreenEl.style.borderBottomWidth = '0px';
    realScopeToggleBtn.innerHTML = isJuce ? '🔴 DSP SCOPE (off)' : '⚫ DSP SCOPE (no engine)';
    if (scopeToolbar) scopeToolbar.style.display = 'none';
  } else {
    realScopeScreenEl.style.height = '113px';
    realScopeScreenEl.style.borderBottomWidth = '1.5px';
    realScopeToggleBtn.innerHTML = '🟢 DSP SCOPE (live)';
    if (scopeToolbar) scopeToolbar.style.display = 'flex';
  }
}

// ══════════════════════════════════════════════════════════════════
// Tests: updatePanelFromState
// ══════════════════════════════════════════════════════════════════

describe('updatePanelFromState', () => {
  let container;
  let cache;

  beforeEach(() => {
    cache = {};
    _bridge = _makeBridge(cache);
    vi.stubGlobal('window', {
      dualMidiBridge: _bridge,
      drawPanelGraphic: vi.fn(),
    });
    container = _makeContainer();
  });

  // ── Sliders ──

  it('positions slider handle from cache value val=0 → bottom', () => {
    cache['vcf_cutoff'] = 0.0;
    const sliderUnit = _makeSlider('vcf_cutoff', 100);
    container._vSliders = [sliderUnit.querySelector('.v-slider')];

    updatePanelFromState(container);

    const handle = sliderUnit.querySelector('.v-slider').querySelector('.handle');
    // pos = (1.0 - 0.0) * (100 - 16) = 84
    expect(parseFloat(handle.style.top)).toBeCloseTo(84, 1);
  });

  it('positions slider handle from cache value val=0.5 → middle', () => {
    cache['vcf_resonance'] = 0.5;
    const sliderUnit = _makeSlider('vcf_resonance', 100);
    container._vSliders = [sliderUnit.querySelector('.v-slider')];

    updatePanelFromState(container);

    const handle = sliderUnit.querySelector('.v-slider').querySelector('.handle');
    // pos = (1.0 - 0.5) * (100 - 16) = 42
    expect(parseFloat(handle.style.top)).toBeCloseTo(42, 1);
  });

  it('positions slider handle from cache value val=1.0 → top', () => {
    cache['vca_level'] = 1.0;
    const sliderUnit = _makeSlider('vca_level', 100);
    container._vSliders = [sliderUnit.querySelector('.v-slider')];

    updatePanelFromState(container);

    const handle = sliderUnit.querySelector('.v-slider').querySelector('.handle');
    expect(parseFloat(handle.style.top)).toBeCloseTo(0, 1);
  });

  it('does nothing for slider when cache has no entry (undefined)', () => {
    const sliderUnit = _makeSlider('vcf_cutoff', 100);
    container._vSliders = [sliderUnit.querySelector('.v-slider')];

    updatePanelFromState(container);

    const handle = sliderUnit.querySelector('.v-slider').querySelector('.handle');
    expect(handle.style.top).toBeUndefined();
  });

  it('does nothing when slider has no data-param parent', () => {
    const slider = _createFakeEl('div');
    slider.classList.add('v-slider');
    const handle = _createFakeEl('div');
    handle.classList.add('handle');
    slider._subElements['.handle'] = handle;
    // No data-param ancestor
    container._vSliders = [slider];

    expect(() => updatePanelFromState(container)).not.toThrow();
  });

  it('handles multiple sliders with different cache values', () => {
    cache['vcf_cutoff'] = 0.25;
    cache['vcf_resonance'] = 0.75;

    const cutoffUnit = _makeSlider('vcf_cutoff', 100);
    const resUnit = _makeSlider('vcf_resonance', 100);
    container._vSliders = [
      cutoffUnit.querySelector('.v-slider'),
      resUnit.querySelector('.v-slider'),
    ];

    updatePanelFromState(container);

    const handleCut = cutoffUnit.querySelector('.v-slider').querySelector('.handle');
    const handleRes = resUnit.querySelector('.v-slider').querySelector('.handle');
    // val=0.25 → pos = 0.75 * 84 = 63
    expect(parseFloat(handleCut.style.top)).toBeCloseTo(63, 1);
    // val=0.75 → pos = 0.25 * 84 = 21
    expect(parseFloat(handleRes.style.top)).toBeCloseTo(21, 1);
  });

  it('handles slider with missing .handle element gracefully', () => {
    cache['vcf_cutoff'] = 0.5;
    const sliderUnit = _makeSlider('vcf_cutoff', 100);
    // Remove handle
    sliderUnit.querySelector('.v-slider')._subElements['.handle'] = null;
    container._vSliders = [sliderUnit.querySelector('.v-slider')];

    expect(() => updatePanelFromState(container)).not.toThrow();
  });

  // ── Select dropdowns ──

  it('syncs select dropdown value from cache', () => {
    cache['voice_mode'] = 0.5; // 0.5 * 12 options = 6
    const sel = _makeSelect('voice_mode', 13);
    container._selects = [sel];

    updatePanelFromState(container);

    // sel.value is set via Math.round(...) which returns a number;
    // real <select> elements coerce to string, but our fake stores the number directly.
    expect(Number(sel.value)).toBe(6);
  });

  it('sets select to first option when val=0', () => {
    cache['voice_mode'] = 0.0;
    const sel = _makeSelect('voice_mode', 13);
    container._selects = [sel];

    updatePanelFromState(container);

    expect(Number(sel.value)).toBe(0);
  });

  it('sets select to last option when val=1', () => {
    cache['voice_mode'] = 1.0;
    const sel = _makeSelect('voice_mode', 13);
    container._selects = [sel];

    updatePanelFromState(container);

    expect(Number(sel.value)).toBe(12);
  });

  it('does nothing for select when cache has no entry', () => {
    const sel = _makeSelect('voice_mode', 13);
    sel.value = '3';
    container._selects = [sel];

    updatePanelFromState(container);

    // Unchanged
    expect(sel.value).toBe('3');
  });

  // ── Toggle boxes ──

  it('toggles generic toggle-box active when val > 0.5', () => {
    cache['osc1_saw_enable'] = 1.0;
    const box = _makeToggle('', 'osc1_saw_enable');
    container._toggles = [box];

    updatePanelFromState(container);

    expect(box.classList.contains('active')).toBe(true);
  });

  it('toggles generic toggle-box inactive when val < 0.5', () => {
    cache['osc1_saw_enable'] = 0.0;
    const box = _makeToggle('', 'osc1_saw_enable');
    container._toggles = [box];

    updatePanelFromState(container);

    expect(box.classList.contains('active')).toBe(false);
  });

  it('handles vca_mode: transparent active when val < 0.5', () => {
    cache['vca_mode'] = 0.0;
    const btnTransparent = _makeToggle('panel-vca-mode-transparent', 'vca_mode');
    const btnBallsy = _makeToggle('panel-vca-mode-ballsy', 'vca_mode');
    container._toggles = [btnTransparent, btnBallsy];

    updatePanelFromState(container);

    expect(btnTransparent.classList.contains('active')).toBe(true);
    expect(btnBallsy.classList.contains('active')).toBe(false);
  });

  it('handles vca_mode: ballsy active when val > 0.5', () => {
    cache['vca_mode'] = 1.0;
    const btnTransparent = _makeToggle('panel-vca-mode-transparent', 'vca_mode');
    const btnBallsy = _makeToggle('panel-vca-mode-ballsy', 'vca_mode');
    container._toggles = [btnTransparent, btnBallsy];

    updatePanelFromState(container);

    expect(btnTransparent.classList.contains('active')).toBe(false);
    expect(btnBallsy.classList.contains('active')).toBe(true);
  });

  it('handles vcf_pole_mode: 2-pole active when val < 0.5', () => {
    cache['vcf_pole_mode'] = 0.0;
    const btnPole2 = _makeToggle('panel-vcf-pole-2', 'vcf_pole_mode');
    const btnPole4 = _makeToggle('panel-vcf-pole-4', 'vcf_pole_mode');
    container._toggles = [btnPole2, btnPole4];

    updatePanelFromState(container);

    expect(btnPole2.classList.contains('active')).toBe(true);
    expect(btnPole4.classList.contains('active')).toBe(false);
  });

  it('handles vcf_pole_mode: 4-pole active when val > 0.5', () => {
    cache['vcf_pole_mode'] = 1.0;
    const btnPole2 = _makeToggle('panel-vcf-pole-2', 'vcf_pole_mode');
    const btnPole4 = _makeToggle('panel-vcf-pole-4', 'vcf_pole_mode');
    container._toggles = [btnPole2, btnPole4];

    updatePanelFromState(container);

    expect(btnPole2.classList.contains('active')).toBe(false);
    expect(btnPole4.classList.contains('active')).toBe(true);
  });

  it('handles vcf_pole_mode at val=0.5: dead zone — neither toggle activates', () => {
    cache['vcf_pole_mode'] = 0.5;
    const btnPole2 = _makeToggle('panel-vcf-pole-2', 'vcf_pole_mode');
    const btnPole4 = _makeToggle('panel-vcf-pole-4', 'vcf_pole_mode');
    // Pre-set both to active to confirm they get deactivated
    btnPole2.classList.add('active');
    btnPole4.classList.add('active');
    container._toggles = [btnPole2, btnPole4];

    updatePanelFromState(container);

    // Neither val<0.5 nor val>0.5 is true at exactly 0.5 → both get force=false
    expect(btnPole2.classList.contains('active')).toBe(false);
    expect(btnPole4.classList.contains('active')).toBe(false);
  });

  it('handles vca_mode at val=0.5: dead zone — neither toggle activates', () => {
    cache['vca_mode'] = 0.5;
    const btnTransparent = _makeToggle('panel-vca-mode-transparent', 'vca_mode');
    const btnBallsy = _makeToggle('panel-vca-mode-ballsy', 'vca_mode');
    btnTransparent.classList.add('active');
    btnBallsy.classList.add('active');
    container._toggles = [btnTransparent, btnBallsy];

    updatePanelFromState(container);

    expect(btnTransparent.classList.contains('active')).toBe(false);
    expect(btnBallsy.classList.contains('active')).toBe(false);
  });

  it('handles generic toggle-box at val=0.5: inactive (not > 0.5)', () => {
    cache['osc1_saw_enable'] = 0.5;
    const box = _makeToggle('', 'osc1_saw_enable');
    box.classList.add('active');
    container._toggles = [box];

    updatePanelFromState(container);

    // Generic toggle uses `val > 0.5` → 0.5 > 0.5 is false → inactive
    expect(box.classList.contains('active')).toBe(false);
  });

  // ── Shape LED rows ──

  it('highlights correct shape row with maxVal=6 (default)', () => {
    cache['lfo1_shape'] = 3.0 / 6.0; // index 3 → Ramp Up
    const rows = [
      _makeShapeLedRow(0, undefined, undefined, 'lfo1_shape'),
      _makeShapeLedRow(1, undefined, undefined, 'lfo1_shape'),
      _makeShapeLedRow(2, undefined, undefined, 'lfo1_shape'),
      _makeShapeLedRow(3, undefined, undefined, 'lfo1_shape'),
      _makeShapeLedRow(4, undefined, undefined, 'lfo1_shape'),
      _makeShapeLedRow(5, undefined, undefined, 'lfo1_shape'),
      _makeShapeLedRow(6, undefined, undefined, 'lfo1_shape'),
    ];
    container._shapeRows = rows;

    updatePanelFromState(container);

    rows.forEach(function(r, i) {
      expect(r.classList.contains('active')).toBe(i === 3);
    });
  });

  it('highlights correct trigger row with data-trig and maxVal=4', () => {
    cache['env1_trigger_mode'] = 2.0 / 4.0; // index 2 → LFO 2
    const rows = [
      _makeShapeLedRow(undefined, 0, undefined, 'env1_trigger_mode'),
      _makeShapeLedRow(undefined, 1, undefined, 'env1_trigger_mode'),
      _makeShapeLedRow(undefined, 2, undefined, 'env1_trigger_mode'),
      _makeShapeLedRow(undefined, 3, undefined, 'env1_trigger_mode'),
      _makeShapeLedRow(undefined, 4, undefined, 'env1_trigger_mode'),
    ];
    container._shapeRows = rows;

    updatePanelFromState(container);

    rows.forEach(function(r, i) {
      expect(r.classList.contains('active')).toBe(i === 2);
    });
  });

  it('highlights correct note_priority row with data-val and maxVal=2', () => {
    cache['note_priority'] = 1.0 / 2.0; // index 1 → Highest
    const rows = [
      _makeShapeLedRow(undefined, undefined, 0, 'note_priority'),
      _makeShapeLedRow(undefined, undefined, 1, 'note_priority'),
      _makeShapeLedRow(undefined, undefined, 2, 'note_priority'),
    ];
    container._shapeRows = rows;

    updatePanelFromState(container);

    rows.forEach(function(r, i) {
      expect(r.classList.contains('active')).toBe(i === 1);
    });
  });

  it('highlights correct trigger_mode row with data-val and maxVal=3', () => {
    cache['trigger_mode'] = 3.0 / 3.0; // index 3 → One-Shot
    const rows = [
      _makeShapeLedRow(undefined, undefined, 0, 'trigger_mode'),
      _makeShapeLedRow(undefined, undefined, 1, 'trigger_mode'),
      _makeShapeLedRow(undefined, undefined, 2, 'trigger_mode'),
      _makeShapeLedRow(undefined, undefined, 3, 'trigger_mode'),
    ];
    container._shapeRows = rows;

    updatePanelFromState(container);

    rows.forEach(function(r, i) {
      expect(r.classList.contains('active')).toBe(i === 3);
    });
  });

  it('highlights correct osc1_range row (maxVal=2)', () => {
    cache['osc1_range'] = 1.0 / 2.0; // index 1 → 8'
    const rows = [
      _makeShapeLedRow(undefined, undefined, 0, 'osc1_range'),
      _makeShapeLedRow(undefined, undefined, 1, 'osc1_range'),
      _makeShapeLedRow(undefined, undefined, 2, 'osc1_range'),
    ];
    container._shapeRows = rows;

    updatePanelFromState(container);

    rows.forEach(function(r, i) {
      expect(r.classList.contains('active')).toBe(i === 1);
    });
  });

  it('highlights correct osc1_pm_mode row (maxVal=1)', () => {
    cache['osc1_pm_mode'] = 0.0; // index 0 → OSC 1+2
    const rows = [
      _makeShapeLedRow(undefined, undefined, 0, 'osc1_pm_mode'),
      _makeShapeLedRow(undefined, undefined, 1, 'osc1_pm_mode'),
    ];
    container._shapeRows = rows;

    updatePanelFromState(container);

    rows.forEach(function(r, i) {
      expect(r.classList.contains('active')).toBe(i === 0);
    });
  });

  it('highlights correct chord_key row by class (no data-param)', () => {
    cache['chord_key'] = 5.0 / 11.0; // index 5 → F
    const rows = [];
    for (let i = 0; i < 12; i++) {
      const row = _makeShapeLedRow(undefined, undefined, i);
      row.classList.add('chord-key-led-row');
      rows.push(row);
    }
    container._shapeRows = rows;

    updatePanelFromState(container);

    rows.forEach(function(r, i) {
      expect(r.classList.contains('active')).toBe(i === 5);
    });
  });

  it('does nothing for shape row when cache has no entry', () => {
    const row = _makeShapeLedRow(0, undefined, undefined, 'lfo1_shape');
    container._shapeRows = [row];

    updatePanelFromState(container);

    expect(row.classList.contains('active')).toBe(false);
  });

  it('returns early without bridge (no crash)', () => {
    vi.stubGlobal('window', {});

    expect(function() { updatePanelFromState(container); }).not.toThrow();
  });

  // ── Edge cases ──

  it('handles empty container (no sliders/selects/toggles/rows)', () => {
    expect(function() { updatePanelFromState(container); }).not.toThrow();
  });

  it('handles slider with data-param parent but missing handle', () => {
    cache['vcf_cutoff'] = 0.5;
    const sliderUnit = _makeSlider('vcf_cutoff', 100);
    sliderUnit.querySelector('.v-slider')._subElements['.handle'] = null;
    container._vSliders = [sliderUnit.querySelector('.v-slider')];

    expect(function() { updatePanelFromState(container); }).not.toThrow();
  });

  it('handles null or undefined cache values gracefully', () => {
    cache['vcf_cutoff'] = null; // simulate null instead of undefined
    const sliderUnit = _makeSlider('vcf_cutoff', 100);
    container._vSliders = [sliderUnit.querySelector('.v-slider')];

    // null !== undefined so val will be null, and the condition `val !== undefined` is true,
    // but pos = (1.0 - null) * ... → null converts to 0 in arithmetic
    expect(function() { updatePanelFromState(container); }).not.toThrow();
  });

  // ── drawPanelGraphic spy verification ──

  it('calls drawPanelGraphic after syncing sliders', () => {
    cache['vcf_cutoff'] = 0.5;
    const sliderUnit = _makeSlider('vcf_cutoff', 100);
    container._vSliders = [sliderUnit.querySelector('.v-slider')];

    updatePanelFromState(container);

    expect(window.drawPanelGraphic).toHaveBeenCalledTimes(1);
  });

  it('calls drawPanelGraphic after syncing selects and toggles', () => {
    cache['voice_mode'] = 0.5;
    cache['osc1_saw_enable'] = 1.0;
    container._selects = [_makeSelect('voice_mode', 13)];
    container._toggles = [_makeToggle('', 'osc1_saw_enable')];

    updatePanelFromState(container);

    expect(window.drawPanelGraphic).toHaveBeenCalledTimes(1);
  });

  it('calls drawPanelGraphic after syncing shape rows', () => {
    cache['lfo1_shape'] = 3.0 / 6.0;
    container._shapeRows = [_makeShapeLedRow(3, undefined, undefined, 'lfo1_shape')];

    updatePanelFromState(container);

    expect(window.drawPanelGraphic).toHaveBeenCalledTimes(1);
  });

  it('calls drawPanelGraphic even with empty container (no DOM elements)', () => {
    updatePanelFromState(container);

    expect(window.drawPanelGraphic).toHaveBeenCalledTimes(1);
  });

  it('does NOT call drawPanelGraphic when there is no bridge (early return)', () => {
    vi.stubGlobal('window', { drawPanelGraphic: vi.fn() });

    updatePanelFromState(container);

    expect(window.drawPanelGraphic).not.toHaveBeenCalled();
  });

  it('does NOT crash when drawPanelGraphic is not defined on window', () => {
    vi.stubGlobal('window', { dualMidiBridge: _bridge });

    expect(function() { updatePanelFromState(container); }).not.toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: updateScreenHeight
// ══════════════════════════════════════════════════════════════════

describe('updateScreenHeight', () => {
  let screenEl, toggleBtn;
  const noScreenModes = ['POLY', 'PORTA', 'CHORD', 'POLY_CHORD'];

  beforeEach(() => {
    screenEl = _createFakeEl('div', { id: 'panel-graphic-screen' });
    toggleBtn = _createFakeEl('button', { id: 'panel-graphic-toggle' });
  });

  it('returns early when screenEl is null', () => {
    expect(function() { updateScreenHeight(null, toggleBtn, 'LFO', false, noScreenModes); }).not.toThrow();
  });

  it('returns early when toggleBtn is null', () => {
    expect(function() { updateScreenHeight(screenEl, null, 'LFO', false, noScreenModes); }).not.toThrow();
  });

  it('hides screen for no-screen modes (POLY)', () => {
    updateScreenHeight(screenEl, toggleBtn, 'POLY', false, noScreenModes);

    expect(screenEl.style.height).toBe('0px');
    expect(screenEl.style.borderBottomWidth).toBe('0px');
    expect(screenEl.style.display).toBe('none');
    expect(toggleBtn.style.display).toBe('none');
  });

  it('hides screen for CHORD mode', () => {
    updateScreenHeight(screenEl, toggleBtn, 'CHORD', false, noScreenModes);

    expect(screenEl.style.display).toBe('none');
    expect(toggleBtn.style.display).toBe('none');
  });

  it('hides screen for PORTA mode', () => {
    updateScreenHeight(screenEl, toggleBtn, 'PORTA', false, noScreenModes);

    expect(screenEl.style.display).toBe('none');
  });

  it('shows screen expanded for LFO mode when not collapsed', () => {
    updateScreenHeight(screenEl, toggleBtn, 'LFO', false, noScreenModes);

    expect(screenEl.style.display).toBe('flex');
    expect(toggleBtn.style.display).toBe('block');
    expect(screenEl.style.height).toBe('100px');
    expect(screenEl.style.borderBottomWidth).toBe('1.5px');
    expect(toggleBtn.innerHTML).toContain('COLLAPSE');
  });

  it('shows screen collapsed for LFO mode when collapsed', () => {
    updateScreenHeight(screenEl, toggleBtn, 'LFO', true, noScreenModes);

    expect(screenEl.style.display).toBe('flex');
    expect(screenEl.style.height).toBe('0px');
    expect(screenEl.style.borderBottomWidth).toBe('0px');
    expect(toggleBtn.innerHTML).toContain('EXPAND');
  });

  it('shows screen expanded for VCA mode', () => {
    updateScreenHeight(screenEl, toggleBtn, 'VCA', false, noScreenModes);

    expect(screenEl.style.display).toBe('flex');
    expect(screenEl.style.height).toBe('100px');
  });

  it('shows screen expanded for ENV mode', () => {
    updateScreenHeight(screenEl, toggleBtn, 'ENV', false, noScreenModes);

    expect(screenEl.style.display).toBe('flex');
  });

  it('shows screen expanded for VCF mode', () => {
    updateScreenHeight(screenEl, toggleBtn, 'VCF', false, noScreenModes);

    expect(screenEl.style.display).toBe('flex');
  });

  it('shows screen expanded for OSC mode', () => {
    updateScreenHeight(screenEl, toggleBtn, 'OSC', false, noScreenModes);

    expect(screenEl.style.display).toBe('flex');
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: updateRealScopeHeight
// ══════════════════════════════════════════════════════════════════

describe('updateRealScopeHeight', () => {
  let scopeEl, toggleBtn, toolbar;
  const noScopeModes = ['POLY', 'PORTA', 'CHORD', 'POLY_CHORD', 'ARP'];
  let stopPollingCalled;

  beforeEach(() => {
    scopeEl = _createFakeEl('canvas', { id: 'panel-real-scope-screen' });
    toggleBtn = _createFakeEl('button', { id: 'panel-real-scope-toggle' });
    toolbar = _createFakeEl('div', { id: 'scope-toolbar' });
    stopPollingCalled = false;
    _bridge = _makeBridge({});
    _bridge.isJuce = false;
    vi.stubGlobal('window', { dualMidiBridge: _bridge });
  });

  function stopPolling() { stopPollingCalled = true; }

  it('returns early when scopeEl is null', () => {
    expect(function() {
      updateRealScopeHeight(null, toggleBtn, 'LFO', true, noScopeModes, toolbar, stopPolling);
    }).not.toThrow();
  });

  it('returns early when toggleBtn is null', () => {
    expect(function() {
      updateRealScopeHeight(scopeEl, null, 'LFO', true, noScopeModes, toolbar, stopPolling);
    }).not.toThrow();
  });

  it('hides scope for no-scope modes (POLY) and stops polling', () => {
    updateRealScopeHeight(scopeEl, toggleBtn, 'POLY', true, noScopeModes, toolbar, stopPolling);

    expect(scopeEl.style.display).toBe('none');
    expect(toggleBtn.style.display).toBe('none');
    expect(stopPollingCalled).toBe(true);
  });

  it('hides scope for ARP mode', () => {
    updateRealScopeHeight(scopeEl, toggleBtn, 'ARP', true, noScopeModes, toolbar, stopPolling);

    expect(scopeEl.style.display).toBe('none');
    expect(stopPollingCalled).toBe(true);
  });

  it('shows scope collapsed by default in web mode', () => {
    updateRealScopeHeight(scopeEl, toggleBtn, 'LFO', true, noScopeModes, toolbar, stopPolling);

    expect(scopeEl.style.display).toBe('flex');
    expect(toggleBtn.style.display).toBe('block');
    expect(scopeEl.style.height).toBe('0px');
    expect(toggleBtn.innerHTML).toBe('⚫ DSP SCOPE (no engine)');
    expect(toolbar.style.display).toBe('none');
  });

  it('shows scope collapsed in JUCE mode', () => {
    _bridge.isJuce = true;
    vi.stubGlobal('window', { dualMidiBridge: _bridge });

    updateRealScopeHeight(scopeEl, toggleBtn, 'LFO', true, noScopeModes, toolbar, stopPolling);

    expect(toggleBtn.innerHTML).toBe('🔴 DSP SCOPE (off)');
  });

  it('shows scope expanded (not collapsed)', () => {
    updateRealScopeHeight(scopeEl, toggleBtn, 'LFO', false, noScopeModes, toolbar, stopPolling);

    expect(scopeEl.style.display).toBe('flex');
    expect(scopeEl.style.height).toBe('113px');
    expect(scopeEl.style.borderBottomWidth).toBe('1.5px');
    expect(toggleBtn.innerHTML).toBe('🟢 DSP SCOPE (live)');
    expect(toolbar.style.display).toBe('flex');
  });

  it('handles missing scope toolbar gracefully (no crash)', () => {
    expect(function() {
      updateRealScopeHeight(scopeEl, toggleBtn, 'LFO', false, noScopeModes, null, stopPolling);
    }).not.toThrow();
  });

  it('handles missing stopPollingFn gracefully', () => {
    expect(function() {
      updateRealScopeHeight(scopeEl, toggleBtn, 'POLY', true, noScopeModes, toolbar, null);
    }).not.toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════
// initDetailPanel (extracted minimal version for integration test)
// ══════════════════════════════════════════════════════════════════

/** Minimal initDetailPanel that captures the key initialization contract:
 *  - Queries DOM elements by ID
 *  - Early returns if panel/closeBtn/container missing
 *  - Sets window.syncDetailPanelControls and window.openSeqPanel
 *  - Binds click handlers on all edit buttons + close button
 *  - Binds click handlers on screen/scope toggle buttons
 */
function initDetailPanel() {
  var lfoEditBtn = document.getElementById('lfo-edit-btn');
  var vcaEditBtn = document.getElementById('vca-edit-btn');
  var envEditBtn = document.getElementById('env-edit-btn');
  var hpfEditBtn = document.getElementById('hpf-edit-btn');
  var vcfEditBtn = document.getElementById('vcf-edit-btn');
  var oscEditBtn = document.getElementById('osc-edit-btn');
  var polyEditBtn = document.getElementById('poly-edit-btn');
  var portaEditBtn = document.getElementById('porta-edit-btn');
  var chordEditBtn = document.getElementById('programmer-chord-btn');
  var polychordEditBtn = document.getElementById('programmer-polychord-btn');
  var panel = document.getElementById('detail-edit-panel');
  var closeBtn = document.getElementById('panel-close-btn');
  var container = document.getElementById('panel-dynamic-controls');
  var titleEl = document.getElementById('panel-title');
  var screenEl = document.getElementById('panel-graphic-screen');
  var screenToggleBtn = document.getElementById('panel-graphic-toggle');
  var realScopeScreenEl = document.getElementById('panel-real-scope-screen');
  var realScopeToggleBtn = document.getElementById('panel-real-scope-toggle');

  if (!panel || !closeBtn || !container) return;

  // Expose public API
  window.syncDetailPanelControls = function() {
    if (!window.PANEL_TEMPLATES) return;
    // Minimal stub: just calls updatePanelFromState
  };

  window.openSeqPanel = function() {
    window.syncDetailPanelControls();
    panel.classList.add('active');
  };

  // Edit button click handlers
  function bindEditButton(btn) {
    if (!btn) return;
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      window.syncDetailPanelControls();
      panel.classList.add('active');
    });
  }

  bindEditButton(lfoEditBtn, 'LFO');
  bindEditButton(vcaEditBtn, 'VCA');
  bindEditButton(envEditBtn, 'ENV');
  bindEditButton(hpfEditBtn, 'HPF');
  bindEditButton(vcfEditBtn, 'VCF');
  bindEditButton(oscEditBtn, 'OSC');
  bindEditButton(polyEditBtn, 'POLY');
  bindEditButton(portaEditBtn, 'PORTA');

  if (chordEditBtn) {
    chordEditBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      window.syncDetailPanelControls();
      panel.classList.add('active');
    });
  }

  if (polychordEditBtn) {
    polychordEditBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      window.syncDetailPanelControls();
      panel.classList.add('active');
    });
  }

  // Close button
  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      panel.classList.remove('active');
    });
  }

  // Screen / scope toggle listeners
  if (screenToggleBtn && screenEl) {
    screenToggleBtn.addEventListener('click', function(e) {
      e.stopPropagation();
    });
  }

  if (realScopeToggleBtn && realScopeScreenEl) {
    realScopeToggleBtn.addEventListener('click', function(e) {
      e.stopPropagation();
    });
  }
}

// ══════════════════════════════════════════════════════════════════
// Integration test: initDetailPanel
// ══════════════════════════════════════════════════════════════════

describe('initDetailPanel integration', () => {
  let _elementRegistry;
  let panelEl, closeBtn, container;
  let lfoBtn, vcaBtn, envBtn, hpfBtn, vcfBtn, oscBtn, polyBtn, portaBtn, chordBtn, polychordBtn;

  /** Minimal mock templates that return just a div (no real HTML needed for init) */
  const mockTemplates = {
    LFO: () => '<div id="mock-lfo"></div>',
    VCA: () => '<div id="mock-vca"></div>',
    ENV: () => '<div id="mock-env"></div>',
    HPF: () => '<div id="mock-hpf"></div>',
    VCF: () => '<div id="mock-vcf"></div>',
    OSC1: () => '<div id="mock-osc1"></div>',
    OSC2: () => '<div id="mock-osc2"></div>',
    POLY: () => '<div id="mock-poly"></div>',
    PORTA: () => '<div id="mock-porta"></div>',
    CHORD: () => '<div id="mock-chord"></div>',
    POLY_CHORD: () => '<div id="mock-polychord"></div>',
    ARP: () => '<div id="mock-arp"></div>',
    SEQ: () => '<div id="mock-seq"></div>',
  };

  function _setupGlobals() {
    _elementRegistry = {};

    // Create all required DOM elements for initDetailPanel
    lfoBtn = _createFakeEl('button', { id: 'lfo-edit-btn' });
    lfoBtn.classList.add('edit-panel-btn');
    vcaBtn = _createFakeEl('button', { id: 'vca-edit-btn' });
    vcaBtn.classList.add('edit-panel-btn');
    envBtn = _createFakeEl('button', { id: 'env-edit-btn' });
    envBtn.classList.add('edit-panel-btn');
    hpfBtn = _createFakeEl('button', { id: 'hpf-edit-btn' });
    hpfBtn.classList.add('edit-panel-btn');
    vcfBtn = _createFakeEl('button', { id: 'vcf-edit-btn' });
    vcfBtn.classList.add('edit-panel-btn');
    oscBtn = _createFakeEl('button', { id: 'osc-edit-btn' });
    oscBtn.classList.add('edit-panel-btn');
    polyBtn = _createFakeEl('button', { id: 'poly-edit-btn' });
    polyBtn.classList.add('edit-panel-btn');
    portaBtn = _createFakeEl('button', { id: 'porta-edit-btn' });
    portaBtn.classList.add('edit-panel-btn');
    chordBtn = _createFakeEl('button', { id: 'programmer-chord-btn' });
    chordBtn.classList.add('edit-panel-btn');
    polychordBtn = _createFakeEl('button', { id: 'programmer-polychord-btn' });
    polychordBtn.classList.add('edit-panel-btn');

    panelEl = _createFakeEl('div', { id: 'detail-edit-panel' });
    closeBtn = _createFakeEl('button', { id: 'panel-close-btn' });
    container = _createFakeEl('div', { id: 'panel-dynamic-controls' });
    const titleEl = _createFakeEl('h3', { id: 'panel-title' });
    const screenEl = _createFakeEl('canvas', { id: 'panel-graphic-screen' });
    screenEl.getContext = vi.fn(() => ({
      canvas: { width: 200, height: 100 },
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      fillRect: vi.fn(),
      arc: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 1,
      font: '',
      textAlign: '',
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      measureText: vi.fn(() => ({ width: 10 })),
    }));
    const screenToggleBtn = _createFakeEl('button', { id: 'panel-graphic-toggle' });
    const realScopeScreenEl = _createFakeEl('canvas', { id: 'panel-real-scope-screen' });
    realScopeScreenEl.getContext = vi.fn(() => ({}));
    const realScopeToggleBtn = _createFakeEl('button', { id: 'panel-real-scope-toggle' });

    // Register all elements
    const allEls = [
      lfoBtn, vcaBtn, envBtn, hpfBtn, vcfBtn, oscBtn, polyBtn, portaBtn, chordBtn, polychordBtn,
      panelEl, closeBtn, container, titleEl, screenEl, screenToggleBtn, realScopeScreenEl, realScopeToggleBtn,
    ];
    allEls.forEach(function(el) { _elementRegistry[el.id] = el; });

    // Mock document.getElementById + addEventListener
    const mockDoc = {
      getElementById: function(id) { return _elementRegistry[id] || null; },
      addEventListener: function() {},
      querySelector: vi.fn(() => null),
      querySelectorAll: vi.fn(() => []),
      body: _createFakeEl('body'),
    };
    vi.stubGlobal('document', mockDoc);

    // Provide minimal window globals needed by initDetailPanel
    vi.stubGlobal('window', {
      dualMidiBridge: _bridge,
      PANEL_TEMPLATES: mockTemplates,
      setTimeout: global.setTimeout,
      clearTimeout: global.clearTimeout,
      setInterval: global.setInterval,
      clearInterval: global.clearInterval,
    });
  }

  beforeEach(() => {
    _bridge = _makeBridge({ 'vcf_cutoff': 0.5 });
  });

  it('sets window.syncDetailPanelControls after initDetailPanel()', () => {
    _setupGlobals();

    initDetailPanel();

    expect(window.syncDetailPanelControls).toBeDefined();
    expect(typeof window.syncDetailPanelControls).toBe('function');
  });

  it('sets window.openSeqPanel after initDetailPanel()', () => {
    _setupGlobals();

    initDetailPanel();

    expect(window.openSeqPanel).toBeDefined();
    expect(typeof window.openSeqPanel).toBe('function');
  });

  it('registers click listeners on all edit buttons', () => {
    _setupGlobals();

    initDetailPanel();

    const editButtons = [lfoBtn, vcaBtn, envBtn, hpfBtn, vcfBtn, oscBtn, polyBtn, portaBtn, chordBtn, polychordBtn];
    editButtons.forEach(function(btn) {
      expect(btn._listeners['click']).toBeDefined();
      expect(btn._listeners['click'].length).toBeGreaterThanOrEqual(1);
    });
  });

  it('registers click listener on close button', () => {
    _setupGlobals();

    initDetailPanel();

    expect(closeBtn._listeners['click']).toBeDefined();
    expect(closeBtn._listeners['click'].length).toBeGreaterThanOrEqual(1);
  });

  it('clicking LFO button calls syncDetailPanelControls and opens panel', () => {
    _setupGlobals();
    initDetailPanel();

    // Spy on syncDetailPanelControls
    const syncSpy = vi.fn();
    window.syncDetailPanelControls = syncSpy;

    // Simulate click on LFO button
    const clickEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
    lfoBtn._listeners['click'][0](clickEvent);

    expect(clickEvent.preventDefault).toHaveBeenCalled();
    expect(clickEvent.stopPropagation).toHaveBeenCalled();
    expect(syncSpy).toHaveBeenCalled();
    expect(panelEl.classList.contains('active')).toBe(true);
  });

  it('clicking VCF button opens panel and calls syncDetailPanelControls', () => {
    _setupGlobals();
    initDetailPanel();

    const syncSpy = vi.fn();
    window.syncDetailPanelControls = syncSpy;

    const clickEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
    vcfBtn._listeners['click'][0](clickEvent);

    expect(syncSpy).toHaveBeenCalled();
    expect(panelEl.classList.contains('active')).toBe(true);
  });

  it('clicking close button removes active class from panel', () => {
    _setupGlobals();
    initDetailPanel();

    // First open the panel
    panelEl.classList.add('active');
    expect(panelEl.classList.contains('active')).toBe(true);

    // Then close it
    closeBtn._listeners['click'][0]();
    expect(panelEl.classList.contains('active')).toBe(false);
  });

  it('registers click listeners on screenToggleBtn and realScopeToggleBtn', () => {
    _setupGlobals();
    initDetailPanel();

    const screenToggle = _elementRegistry['panel-graphic-toggle'];
    const realScopeToggle = _elementRegistry['panel-real-scope-toggle'];

    expect(screenToggle._listeners['click']).toBeDefined();
    expect(screenToggle._listeners['click'].length).toBeGreaterThanOrEqual(1);
    expect(realScopeToggle._listeners['click']).toBeDefined();
    expect(realScopeToggle._listeners['click'].length).toBeGreaterThanOrEqual(1);
  });

  it('early returns when panel, closeBtn, or container is missing', () => {
    _setupGlobals();
    // Remove panel from registry to simulate missing element
    delete _elementRegistry['detail-edit-panel'];

    // Should not throw
    expect(function() { initDetailPanel(); }).not.toThrow();

    // syncDetailPanelControls should NOT be set (early return)
    expect(window.syncDetailPanelControls).toBeUndefined();
  });

  it('does not crash if initDetailPanel is called twice (idempotent)', () => {
    _setupGlobals();

    initDetailPanel();
    expect(function() { initDetailPanel(); }).not.toThrow();

    // Still has exports after second call
    expect(window.syncDetailPanelControls).toBeDefined();
    expect(window.openSeqPanel).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════════════
// Canvas helpers: hexToRgba and applyCurve
// ══════════════════════════════════════════════════════════════════

describe('hexToRgba — canvas color helper', () => {
  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  it('converts #ff9900 to rgba with alpha 0.5', () => {
    expect(hexToRgba('#ff9900', 0.5)).toBe('rgba(255, 153, 0, 0.5)');
  });

  it('converts #00ff66 to rgba with alpha 1', () => {
    expect(hexToRgba('#00ff66', 1)).toBe('rgba(0, 255, 102, 1)');
  });

  it('converts #000000 to rgba with alpha 0', () => {
    expect(hexToRgba('#000000', 0)).toBe('rgba(0, 0, 0, 0)');
  });

  it('converts #ffffff to rgba with alpha 0.04', () => {
    expect(hexToRgba('#ffffff', 0.04)).toBe('rgba(255, 255, 255, 0.04)');
  });

  it('converts #ff0000 (red) with alpha 0.6', () => {
    expect(hexToRgba('#ff0000', 0.6)).toBe('rgba(255, 0, 0, 0.6)');
  });

  it('converts #00aaff with alpha 0.08', () => {
    expect(hexToRgba('#00aaff', 0.08)).toBe('rgba(0, 170, 255, 0.08)');
  });
});

describe('applyCurve — exponential envelope curve', () => {
  function applyCurve(t, curve) {
    if (Math.abs(curve) < 0.01) return t;
    const exp = curve > 0 ? 1.0 + curve * 3.0 : 1.0 / (1.0 - curve * 3.0);
    return Math.pow(t, exp);
  }

  it('returns t unchanged when curve ≈ 0 (|curve| < 0.01)', () => {
    expect(applyCurve(0.5, 0)).toBe(0.5);
    expect(applyCurve(0.3, 0.005)).toBe(0.3);
    expect(applyCurve(0.7, -0.008)).toBe(0.7);
  });

  it('applies positive curve (convex): exponent > 1', () => {
    const result = applyCurve(0.5, 0.5);
    expect(result).toBeLessThan(0.5);
    expect(Math.pow(0.5, 2.5)).toBeCloseTo(result);
  });

  it('applies negative curve (concave): exponent < 1', () => {
    const result = applyCurve(0.5, -0.3);
    expect(result).toBeGreaterThan(0.5);
    expect(Math.pow(0.5, 1.0 / 1.9)).toBeCloseTo(result, 2);
  });

  it('applies curve=1.0 (max positive): exp=4.0', () => {
    expect(Math.pow(0.3, 4.0)).toBeCloseTo(applyCurve(0.3, 1.0), 3);
  });

  it('applies curve=-1.0 (max negative): exp=0.25', () => {
    expect(Math.pow(0.3, 0.25)).toBeCloseTo(applyCurve(0.3, -1.0), 3);
  });

  it('t=0 returns 0 for any curve', () => {
    expect(applyCurve(0, 0.5)).toBe(0);
    expect(applyCurve(0, -0.8)).toBe(0);
    expect(applyCurve(0, 0)).toBe(0);
  });

  it('t=1 returns 1 for any curve', () => {
    expect(applyCurve(1, 0.5)).toBe(1);
    expect(applyCurve(1, -0.8)).toBe(1);
    expect(applyCurve(1, 0)).toBe(1);
  });
});

// ══════════════════════════════════════════════════════════════════
// Waveform evaluators: _evalLfoWaveform and _evalOscWaveform
// ══════════════════════════════════════════════════════════════════

describe('_evalLfoWaveform — LFO shape evaluation', () => {
  function _evalLfoWaveform(shapeVal, pct, phase) {
    const angle = pct * Math.PI * 4 + phase;
    let yVal = 0;
    if (shapeVal === 0) {
      yVal = Math.sin(angle);
    } else if (shapeVal === 1) {
      const mod = angle % (Math.PI * 2);
      if (mod < Math.PI) {
        yVal = 1.0 - (mod / (Math.PI / 2));
      } else {
        yVal = -1.0 + ((mod - Math.PI) / (Math.PI / 2));
      }
    } else if (shapeVal === 2) {
      yVal = (angle % (Math.PI * 2)) < Math.PI ? 1.0 : -1.0;
    } else if (shapeVal === 3) {
      yVal = -1.0 + 2.0 * ((angle % (Math.PI * 2)) / (Math.PI * 2));
    } else if (shapeVal === 4) {
      yVal = 1.0 - 2.0 * ((angle % (Math.PI * 2)) / (Math.PI * 2));
    } else {
      const steps = 8;
      const stepIdx = Math.floor(pct * steps);
      const randVals = [0.2, -0.6, 0.7, -0.2, -0.8, 0.4, -0.1, 0.5];
      yVal = randVals[stepIdx % randVals.length];
      if (shapeVal === 6) {
        const nextVal = randVals[(stepIdx + 1) % randVals.length];
        const interp = (pct * steps) % 1.0;
        yVal = yVal + (nextVal - yVal) * interp;
      }
    }
    return yVal;
  }

  it('shapeVal=0 generates sine wave with correct range [-1, 1]', () => {
    // angle = pct * PI * 4. sin max at PI/2 → pct = 0.125, sin min at 3*PI/2 → pct = 0.375
    const vals = [0, 0.125, 0.25, 0.375].map(pct => _evalLfoWaveform(0, pct, 0));
    expect(vals[0]).toBeCloseTo(0, 5);  // sin(0) = 0
    expect(vals[1]).toBeCloseTo(1, 1);  // sin(PI/2) ≈ 1
    expect(vals[2]).toBeCloseTo(0, 1);  // sin(PI) ≈ 0
    expect(vals[3]).toBeCloseTo(-1, 1); // sin(3*PI/2) ≈ -1
  });

  it('shapeVal=1 generates triangle wave', () => {
    const val = _evalLfoWaveform(1, 0, 0);
    expect(val).toBe(1.0);
  });

  it('shapeVal=2 generates square wave: 1.0 or -1.0', () => {
    const val0 = _evalLfoWaveform(2, 0, 0);
    const valHalf = _evalLfoWaveform(2, 0.5, 0);
    expect(Math.abs(val0)).toBe(1.0);
    expect(Math.abs(valHalf)).toBe(1.0);
  });

  it('shapeVal=3 generates ramp up', () => {
    const val = _evalLfoWaveform(3, 0, 0);
    expect(val).toBeCloseTo(-1.0, 3);
  });

  it('shapeVal=4 generates ramp down', () => {
    const val = _evalLfoWaveform(4, 0, 0);
    expect(val).toBeCloseTo(1.0, 3);
  });

  it('shapeVal=5 generates sample & hold (stepped random)', () => {
    expect(_evalLfoWaveform(5, 0.1, 0)).toBe(0.2);
    expect(_evalLfoWaveform(5, 0.2, 0)).toBe(-0.6);
  });

  it('shapeVal=6 generates sample & glide (interpolated random)', () => {
    const val0 = _evalLfoWaveform(6, 0, 0);
    expect(val0).toBe(0.2);
    expect(_evalLfoWaveform(6, 0.05, 0)).not.toBe(0.2);
  });

  it('applies phase offset correctly', () => {
    const shifted = _evalLfoWaveform(0, 0, Math.PI / 2);
    expect(shifted).toBeCloseTo(1, 2);
  });

  it('evaluates all 7 shape types without throwing', () => {
    for (let s = 0; s <= 6; s++) {
      expect(() => _evalLfoWaveform(s, 0.3, 0)).not.toThrow();
    }
  });
});

describe('_evalOscWaveform — oscillator combination', () => {
  function _evalOscWaveform(sawEn, sqEn, osc2Lvl, osc2Pitch, pct, phase) {
    const angle = pct * Math.PI * 6 + phase;
    let yVal = 0;
    if (sawEn) yVal += -0.5 + ((angle % (Math.PI * 2)) / (Math.PI * 2));
    if (sqEn) yVal += (angle % (Math.PI * 2)) < Math.PI ? 0.35 : -0.35;
    const osc2Phase = phase + osc2Pitch * Math.PI * 2;
    const a2 = pct * Math.PI * 6 + osc2Phase;
    yVal += osc2Lvl * 0.3 * Math.sin(a2 * 1.5);
    return yVal;
  }

  it('saw only: returns sawtooth value', () => {
    const val = _evalOscWaveform(true, false, 0, 0.5, 0.1, 0);
    const angle = 0.1 * Math.PI * 6;
    const expected = -0.5 + ((angle % (Math.PI * 2)) / (Math.PI * 2));
    expect(val).toBeCloseTo(expected, 3);
  });

  it('square only: returns ±0.35', () => {
    const val = _evalOscWaveform(false, true, 0, 0.5, 0.1, 0);
    expect(Math.abs(val)).toBeCloseTo(0.35, 3);
  });

  it('both saw+sq: combines both waveforms', () => {
    const valBoth = _evalOscWaveform(true, true, 0, 0.5, 0.1, 0);
    const valSaw = _evalOscWaveform(true, false, 0, 0.5, 0.1, 0);
    const valSq = _evalOscWaveform(false, true, 0, 0.5, 0.1, 0);
    expect(valBoth).toBeCloseTo(valSaw + valSq, 3);
  });

  it('includes osc2 level modulation', () => {
    const val = _evalOscWaveform(false, false, 0.5, 0.5, 0.1, 0);
    const expected = 0.5 * 0.3 * Math.sin((0.1 * Math.PI * 6 + 0.5 * Math.PI * 2) * 1.5);
    expect(val).toBeCloseTo(expected, 3);
  });

  it('handles all disabled: returns only osc2 contribution', () => {
    const val = _evalOscWaveform(false, false, 0.8, 0.3, 0.5, Math.PI);
    expect(val).toBeGreaterThanOrEqual(-0.24);
    expect(val).toBeLessThanOrEqual(0.24);
  });

  it('applies pitch offset to osc2 phase', () => {
    const valLow = _evalOscWaveform(false, false, 0.5, 0, 0.1, 0);
    const valHigh = _evalOscWaveform(false, false, 0.5, 1, 0.1, 0);
    expect(valLow).not.toBeCloseTo(valHigh, 5);
  });
});

// ══════════════════════════════════════════════════════════════════
// SCOPE_COLORS and _getScopeColors
// ══════════════════════════════════════════════════════════════════

describe('SCOPE_COLORS — color palette array', () => {
  const SCOPE_COLORS = [
    { waveform: '#ff9900',  grid: 'rgba(255,153,0,0.03)',  center: 'rgba(255,153,0,0.08)',  text: 'rgba(255,153,0,0.4)',  glow: '#ff9900',  trigger: 'rgba(255,153,0,0.15)', name: 'Brand' },
    { waveform: '#00ff66',  grid: 'rgba(0,255,102,0.03)',  center: 'rgba(0,255,102,0.08)',  text: 'rgba(0,255,102,0.4)',  glow: '#00ff66',  trigger: 'rgba(0,255,102,0.15)', name: 'CRT Green' },
    { waveform: '#00ccff',  grid: 'rgba(0,204,255,0.03)',  center: 'rgba(0,204,255,0.08)',  text: 'rgba(0,204,255,0.4)',  glow: '#00ccff',  trigger: 'rgba(0,204,255,0.15)', name: 'Blue' },
    { waveform: '#ffb000',  grid: 'rgba(255,176,0,0.03)',  center: 'rgba(255,176,0,0.08)',  text: 'rgba(255,176,0,0.4)',  glow: '#ffb000',  trigger: 'rgba(255,176,0,0.15)', name: 'Amber' },
  ];

  function _getScopeColors(colorScheme) {
    const idx = Math.max(0, Math.min(SCOPE_COLORS.length - 1, colorScheme));
    return SCOPE_COLORS[idx];
  }

  it('has exactly 4 color entries', () => {
    expect(SCOPE_COLORS).toHaveLength(4);
  });

  it('each entry has waveform, grid, center, text, glow, trigger, name', () => {
    SCOPE_COLORS.forEach(function(c) {
      expect(c).toHaveProperty('waveform');
      expect(c).toHaveProperty('grid');
      expect(c).toHaveProperty('center');
      expect(c).toHaveProperty('text');
      expect(c).toHaveProperty('glow');
      expect(c).toHaveProperty('trigger');
      expect(c).toHaveProperty('name');
      expect(typeof c.waveform).toBe('string');
      expect(c.waveform).toMatch(/^#[0-9a-f]{6}$/);
    });
  });

  it('scheme 0 = Brand (#ff9900)', () => {
    expect(SCOPE_COLORS[0].name).toBe('Brand');
    expect(SCOPE_COLORS[0].waveform).toBe('#ff9900');
  });

  it('scheme 1 = CRT Green (#00ff66)', () => {
    expect(SCOPE_COLORS[1].name).toBe('CRT Green');
    expect(SCOPE_COLORS[1].waveform).toBe('#00ff66');
  });

  it('scheme 2 = Blue (#00ccff)', () => {
    expect(SCOPE_COLORS[2].name).toBe('Blue');
    expect(SCOPE_COLORS[2].waveform).toBe('#00ccff');
  });

  it('scheme 3 = Amber (#ffb000)', () => {
    expect(SCOPE_COLORS[3].name).toBe('Amber');
    expect(SCOPE_COLORS[3].waveform).toBe('#ffb000');
  });

  describe('_getScopeColors', () => {
    it('returns color for index 0 (Brand)', () => {
      expect(_getScopeColors(0).name).toBe('Brand');
    });

    it('returns color for index 3 (Amber)', () => {
      expect(_getScopeColors(3).name).toBe('Amber');
    });

    it('clamps index below 0 to first entry', () => {
      expect(_getScopeColors(-1).name).toBe('Brand');
    });

    it('clamps index above max (3) to last entry', () => {
      expect(_getScopeColors(10).name).toBe('Amber');
    });

    it('returns correct entry for each valid index', () => {
      const names = ['Brand', 'CRT Green', 'Blue', 'Amber'];
      names.forEach(function(name, i) {
        expect(_getScopeColors(i).name).toBe(name);
      });
    });
  });
});

// ══════════════════════════════════════════════════════════════════
// _findTriggerPoint — scope trigger detection
// ══════════════════════════════════════════════════════════════════

describe('_findTriggerPoint — zero-crossing trigger detection', () => {
  function _findTriggerPoint(samples, mode, edge) {
    if (mode === 0 || !samples || samples.length < 4) return 0;
    const threshold = 0.0;
    const searchStart = Math.floor(samples.length * 0.1);
    const searchEnd = Math.floor(samples.length * 0.8);
    for (let i = searchStart; i < searchEnd; i++) {
      const prev = samples[i - 1];
      const curr = samples[i];
      if (typeof prev !== 'number' || typeof curr !== 'number') continue;
      if (edge === 0) {
        if (prev <= threshold && curr > threshold) return i;
      } else {
        if (prev >= threshold && curr < threshold) return i;
      }
    }
    return -1;
  }

  it('Free mode (0) returns 0 immediately', () => {
    expect(_findTriggerPoint([0.1, 0.2, 0.3], 0, 0)).toBe(0);
  });

  it('returns 0 when samples is null', () => {
    expect(_findTriggerPoint(null, 1, 0)).toBe(0);
  });

  it('returns 0 when samples length < 4', () => {
    expect(_findTriggerPoint([0.1, 0.2], 1, 0)).toBe(0);
  });

  it('detects rising edge zero crossing', () => {
    const samples = [-0.5, -0.3, -0.1, 0.2, 0.4, 0.6, 0.8, 1.0, 0.8, 0.6];
    expect(_findTriggerPoint(samples, 1, 0)).toBe(3);
  });

  it('detects falling edge zero crossing', () => {
    const samples = [0.5, 0.3, 0.1, -0.2, -0.4, -0.6, -0.8, -1.0, -0.8, -0.6];
    expect(_findTriggerPoint(samples, 1, 1)).toBe(3);
  });

  it('returns -1 when no trigger found', () => {
    const samples = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4];
    expect(_findTriggerPoint(samples, 1, 0)).toBe(-1);
  });

  it('skips non-numeric samples', () => {
    const samples = [-0.5, null, -0.1, 0.2, 0.4];
    expect(_findTriggerPoint(samples, 1, 0)).toBe(3);
  });

  it('skips first 10% and last 20% of samples', () => {
    const samples = [];
    for (let i = 0; i < 20; i++) samples.push(-1.0);
    samples[5] = 1.0;
    expect(_findTriggerPoint(samples, 1, 0)).toBe(5);
  });
});

// ══════════════════════════════════════════════════════════════════
// _updateScopeToolbar — scope toolbar UI sync
// ══════════════════════════════════════════════════════════════════

describe('_updateScopeToolbar — scope toolbar UI', () => {
  let triggerBtn, colorBtn, colorIndicator, zoomBtns;
  const SCOPE_COLORS = [
    { waveform: '#ff9900', glow: '#ff9900', name: 'Brand' },
  ];
  let _scopeTriggerMode = 0;
  let _scopeZoom = 1;
  let _scopeColorScheme = 0;

  function _getScopeColors() {
    const idx = Math.max(0, Math.min(SCOPE_COLORS.length - 1, _scopeColorScheme));
    return SCOPE_COLORS[idx];
  }

  function _updateScopeToolbar() {
    if (triggerBtn) {
      const labels = ['FR', 'AT', 'NM'];
      const names = ['Free', 'Auto', 'Normal'];
      triggerBtn.textContent = labels[_scopeTriggerMode];
      triggerBtn.title = 'Trigger: ' + names[_scopeTriggerMode];
    }
    zoomBtns.forEach(function(btn) {
      var z = parseInt(btn.getAttribute('data-zoom'));
      btn.classList.toggle('active', z === _scopeZoom);
    });
    if (colorBtn) {
      var colors = _getScopeColors();
      if (colorIndicator) {
        colorIndicator.style.color = colors.waveform;
        colorIndicator.style.textShadow = '0 0 4px ' + colors.glow;
      }
      colorBtn.title = 'Color: ' + colors.name;
    }
  }

  beforeEach(() => {
    triggerBtn = _createFakeEl('button', { id: 'scope-trigger-btn' });
    colorBtn = _createFakeEl('button', { id: 'scope-color-btn' });
    colorIndicator = _createFakeEl('span', { id: 'scope-color-indicator' });
    zoomBtns = [];
    for (let z = 1; z <= 4; z++) {
      const btn = _createFakeEl('button', { 'data-zoom': String(z) });
      btn.classList.add('scope-zoom-btn');
      zoomBtns.push(btn);
    }
    _scopeTriggerMode = 0;
    _scopeZoom = 1;
    _scopeColorScheme = 0;
  });

  it('updates trigger button to FR (Free) mode', () => {
    _scopeTriggerMode = 0;
    _updateScopeToolbar();
    expect(triggerBtn.textContent).toBe('FR');
    expect(triggerBtn.title).toBe('Trigger: Free');
  });

  it('updates trigger button to AT (Auto) mode', () => {
    _scopeTriggerMode = 1;
    _updateScopeToolbar();
    expect(triggerBtn.textContent).toBe('AT');
    expect(triggerBtn.title).toBe('Trigger: Auto');
  });

  it('updates trigger button to NM (Normal) mode', () => {
    _scopeTriggerMode = 2;
    _updateScopeToolbar();
    expect(triggerBtn.textContent).toBe('NM');
    expect(triggerBtn.title).toBe('Trigger: Normal');
  });

  it('highlights correct zoom button (active)', () => {
    _scopeZoom = 2;
    _updateScopeToolbar();
    zoomBtns.forEach(function(btn, i) {
      const z = parseInt(btn.getAttribute('data-zoom'));
      expect(btn.classList.contains('active')).toBe(z === 2);
    });
  });

  it('updates color button title and indicator', () => {
    _updateScopeToolbar();
    expect(colorBtn.title).toContain('Brand');
    expect(colorIndicator.style.color).toBe('#ff9900');
    expect(colorIndicator.style.textShadow).toContain('#ff9900');
  });

  it('handles missing triggerBtn gracefully', () => {
    triggerBtn = null;
    expect(() => _updateScopeToolbar()).not.toThrow();
  });

  it('handles missing colorBtn gracefully', () => {
    colorBtn = null;
    expect(() => _updateScopeToolbar()).not.toThrow();
  });

  it('handles missing colorIndicator gracefully', () => {
    colorIndicator = null;
    expect(() => _updateScopeToolbar()).not.toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════
// drawPanelGraphic — canvas rendering tests
// ══════════════════════════════════════════════════════════════════

describe('drawPanelGraphic — canvas rendering', () => {
  let canvas, ctx, cache;
  let _animTime = 0;
  let currentPanelMode = 'ENV';
  let panelActiveEnv = 1;
  let panelActiveLfo = 1;
  let panelActiveOsc = 1;
  let isScreenCollapsed = false;
  let isRealScopeCollapsed = true;
  let brandColor = '#ff9900';

  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function applyCurve(t, curve) {
    if (Math.abs(curve) < 0.01) return t;
    const exp = curve > 0 ? 1.0 + curve * 3.0 : 1.0 / (1.0 - curve * 3.0);
    return Math.pow(t, exp);
  }

  function _evalLfoWaveform(shapeVal, pct, phase) {
    const angle = pct * Math.PI * 4 + phase;
    let yVal = 0;
    if (shapeVal === 0) { yVal = Math.sin(angle); }
    else if (shapeVal === 1) {
      const mod = angle % (Math.PI * 2);
      yVal = mod < Math.PI ? 1.0 - (mod / (Math.PI / 2)) : -1.0 + ((mod - Math.PI) / (Math.PI / 2));
    } else if (shapeVal === 2) { yVal = (angle % (Math.PI * 2)) < Math.PI ? 1.0 : -1.0; }
    else if (shapeVal === 3) { yVal = -1.0 + 2.0 * ((angle % (Math.PI * 2)) / (Math.PI * 2)); }
    else if (shapeVal === 4) { yVal = 1.0 - 2.0 * ((angle % (Math.PI * 2)) / (Math.PI * 2)); }
    else {
      const steps = 8;
      const stepIdx = Math.floor(pct * steps);
      const randVals = [0.2, -0.6, 0.7, -0.2, -0.8, 0.4, -0.1, 0.5];
      yVal = randVals[stepIdx % randVals.length];
      if (shapeVal === 6) {
        const nextVal = randVals[(stepIdx + 1) % randVals.length];
        yVal = yVal + (nextVal - yVal) * ((pct * steps) % 1.0);
      }
    }
    return yVal;
  }

  function _evalOscWaveform(sawEn, sqEn, osc2Lvl, osc2Pitch, pct, phase) {
    const angle = pct * Math.PI * 6 + phase;
    let yVal = 0;
    if (sawEn) yVal += -0.5 + ((angle % (Math.PI * 2)) / (Math.PI * 2));
    if (sqEn) yVal += (angle % (Math.PI * 2)) < Math.PI ? 0.35 : -0.35;
    const osc2Phase = phase + osc2Pitch * Math.PI * 2;
    yVal += osc2Lvl * 0.3 * Math.sin((pct * Math.PI * 6 + osc2Phase) * 1.5);
    return yVal;
  }

  function drawPanelGraphic() {
    if (!canvas) return;
    var ctxLocal = ctx;
    var w = 200;
    var h = 100;
    ctxLocal.clearRect(0, 0, w, h);

    // CRT grid
    ctxLocal.strokeStyle = hexToRgba(brandColor, 0.04);
    ctxLocal.lineWidth = 1;
    for (var gx = 0; gx < w; gx += 20) {
      ctxLocal.beginPath();
      ctxLocal.moveTo(gx, 0);
      ctxLocal.lineTo(gx, h);
      ctxLocal.stroke();
    }
    for (var gy = 0; gy < h; gy += 20) {
      ctxLocal.beginPath();
      ctxLocal.moveTo(0, gy);
      ctxLocal.lineTo(w, gy);
      ctxLocal.stroke();
    }

    if (!cache) return;

    if (currentPanelMode === 'ENV' || currentPanelMode === 'VCA') {
      var envNum = currentPanelMode === 'VCA' ? 1 : panelActiveEnv;
      var prefix = 'env' + envNum + '_';
      var a = typeof cache[prefix + 'attack'] !== 'undefined' ? cache[prefix + 'attack'] : 0.2;
      var d = typeof cache[prefix + 'decay'] !== 'undefined' ? cache[prefix + 'decay'] : 0.35;
      var s = typeof cache[prefix + 'sustain'] !== 'undefined' ? cache[prefix + 'sustain'] : 0.55;
      var r = typeof cache[prefix + 'release'] !== 'undefined' ? cache[prefix + 'release'] : 0.4;
      var aCurve = typeof cache[prefix + 'attack_curve'] !== 'undefined' ? (cache[prefix + 'attack_curve'] * 2.0 - 1.0) : 0.0;
      var dCurve = typeof cache[prefix + 'decay_curve'] !== 'undefined' ? (cache[prefix + 'decay_curve'] * 2.0 - 1.0) : 0.0;
      var rCurve = typeof cache[prefix + 'release_curve'] !== 'undefined' ? (cache[prefix + 'release_curve'] * 2.0 - 1.0) : 0.0;

      var padding = 10;
      var graphW = w - padding * 2;
      var graphH = h - padding * 2;
      var startX = padding;
      var startY = h - padding;
      var topY = padding;

      var totalTime = a + d + 0.7 + r;
      var aW = Math.max(4, (a / totalTime) * graphW);
      var dW = Math.max(4, (d / totalTime) * graphW);
      var sW = Math.max(8, (0.7 / totalTime) * graphW);
      var rW = Math.max(4, (r / totalTime) * graphW);

      var p0x = startX, p0y = startY;
      var p1x = startX + aW, p1y = topY;
      var p2x = p1x + dW, p2y = startY - s * graphH;
      var p3x = p2x + sW, p3y = p2y;
      var p4x = p3x + rW, p4y = startY;

      // Fill
      ctxLocal.fillStyle = hexToRgba(brandColor, 0.06);
      ctxLocal.beginPath();
      ctxLocal.moveTo(p0x, p0y);
      for (var fi = 0; fi <= 20; fi++) ctxLocal.lineTo(p0x + (p1x - p0x) * (fi / 20), p0y + (p1y - p0y) * applyCurve(fi / 20, aCurve));
      for (var fi2 = 0; fi2 <= 20; fi2++) ctxLocal.lineTo(p1x + (p2x - p1x) * (fi2 / 20), p1y + (p2y - p1y) * applyCurve(fi2 / 20, dCurve));
      ctxLocal.lineTo(p3x, p3y);
      for (var fi3 = 0; fi3 <= 20; fi3++) ctxLocal.lineTo(p3x + (p4x - p3x) * (fi3 / 20), p3y + (p4y - p3y) * applyCurve(fi3 / 20, rCurve));
      ctxLocal.lineTo(p0x, p0y);
      ctxLocal.fill();

      // Stroke
      ctxLocal.strokeStyle = brandColor;
      ctxLocal.lineWidth = 2;
      ctxLocal.beginPath();
      ctxLocal.moveTo(p0x, p0y);
      for (var si = 0; si <= 20; si++) ctxLocal.lineTo(p0x + (p1x - p0x) * (si / 20), p0y + (p1y - p0y) * applyCurve(si / 20, aCurve));
      for (var si2 = 0; si2 <= 20; si2++) ctxLocal.lineTo(p1x + (p2x - p1x) * (si2 / 20), p1y + (p2y - p1y) * applyCurve(si2 / 20, dCurve));
      ctxLocal.lineTo(p3x, p3y);
      for (var si3 = 0; si3 <= 20; si3++) ctxLocal.lineTo(p3x + (p4x - p3x) * (si3 / 20), p3y + (p4y - p3y) * applyCurve(si3 / 20, rCurve));
      ctxLocal.stroke();

      // Nodes
      ctxLocal.fillStyle = brandColor;
      [[p1x, p1y], [p2x, p2y], [p3x, p3y]].forEach(function(pt) {
        ctxLocal.beginPath();
        ctxLocal.arc(pt[0], pt[1], 3, 0, Math.PI * 2);
        ctxLocal.fill();
      });

      // Label
      var envLabel = currentPanelMode === 'VCA' ? 'ENV 1 (VCA)' : (['', 'ENV 1 VCA', 'ENV 2 VCF', 'ENV 3 MOD'][envNum] || 'ENV ' + envNum);
      ctxLocal.fillStyle = hexToRgba(brandColor, 0.4);
      ctxLocal.font = '7px Share Tech Mono, monospace';
      ctxLocal.fillText(envLabel, padding + 2, padding + 8);

    } else if (currentPanelMode === 'LFO') {
      var prefix = 'lfo' + panelActiveLfo + '_';
      var shapeVal = typeof cache[prefix + 'shape'] !== 'undefined' ? Math.round(cache[prefix + 'shape'] * 6) : 1;
      var lfoRate = typeof cache[prefix + 'rate'] !== 'undefined' ? cache[prefix + 'rate'] : 0.5;

      ctxLocal.strokeStyle = brandColor;
      ctxLocal.lineWidth = 2;
      ctxLocal.beginPath();

      var padding = 10;
      var graphW = w - padding * 2;
      var graphH = h - padding * 2;
      var centerY = h / 2;
      var freq = 0.5 + lfoRate * 4.0;
      var phaseOffset = (_animTime / 1000) * freq * Math.PI * 2;

      for (var lx = 0; lx < graphW; lx++) {
        var pct = lx / graphW;
        var yVal = _evalLfoWaveform(shapeVal, pct, phaseOffset);
        var canvasX = padding + lx;
        var canvasY = centerY - yVal * (graphH / 2);
        if (lx === 0) ctxLocal.moveTo(canvasX, canvasY);
        else ctxLocal.lineTo(canvasX, canvasY);
      }
      ctxLocal.stroke();

      // Ghost trace
      ctxLocal.strokeStyle = hexToRgba(brandColor, 0.08);
      ctxLocal.lineWidth = 1;
      ctxLocal.beginPath();
      var ghostPhase = phaseOffset - freq * Math.PI * 0.2;
      for (var lx2 = 0; lx2 < graphW; lx2++) {
        var pct2 = lx2 / graphW;
        var yVal2 = _evalLfoWaveform(shapeVal, pct2, ghostPhase);
        var canvasX2 = padding + lx2;
        var canvasY2 = centerY - yVal2 * (graphH / 2);
        if (lx2 === 0) ctxLocal.moveTo(canvasX2, canvasY2);
        else ctxLocal.lineTo(canvasX2, canvasY2);
      }
      ctxLocal.stroke();

    } else if (currentPanelMode === 'VCF' || currentPanelMode === 'HPF') {
      var cutoff = 0.5;
      var resonance = 0.0;
      if (currentPanelMode === 'VCF') {
        cutoff = typeof cache['vcf_cutoff'] !== 'undefined' ? cache['vcf_cutoff'] : 0.5;
        resonance = typeof cache['vcf_resonance'] !== 'undefined' ? cache['vcf_resonance'] : 0.0;
      } else {
        cutoff = typeof cache['hpf_cutoff'] !== 'undefined' ? cache['hpf_cutoff'] : 0.2;
      }
      ctxLocal.strokeStyle = brandColor;
      ctxLocal.lineWidth = 2;
      ctxLocal.beginPath();

      var graphW = w - 20;
      var graphH = h - 20;
      var startY = h - 10;

      for (var fx = 0; fx < graphW; fx++) {
        var freq2 = fx / graphW;
        var gain = 1.0;
        if (currentPanelMode === 'VCF') {
          if (freq2 < cutoff) {
            var dist = cutoff - freq2;
            if (dist < 0.1) gain = 1.0 + resonance * 1.8 * (1.0 - dist / 0.1);
          } else {
            var dist2 = freq2 - cutoff;
            gain = (1.0 + resonance * 1.8) / (1.0 + (dist2 * 12.0) * (dist2 * 12.0));
          }
        } else {
          if (freq2 > cutoff) gain = 1.0;
          else gain = 1.0 / (1.0 + ((cutoff - freq2) * 15.0) * ((cutoff - freq2) * 15.0));
        }
        var canvasX3 = 10 + fx;
        var canvasY3 = startY - gain * (graphH * 0.7);
        if (fx === 0) ctxLocal.moveTo(canvasX3, canvasY3);
        else ctxLocal.lineTo(canvasX3, canvasY3);
      }
      ctxLocal.stroke();

    } else if (currentPanelMode === 'OSC') {
      var sawEn = typeof cache['osc1_saw_enable'] !== 'undefined' ? cache['osc1_saw_enable'] > 0.5 : true;
      var sqEn = typeof cache['osc1_square_enable'] !== 'undefined' ? cache['osc1_square_enable'] > 0.5 : false;
      var osc2Lvl = typeof cache['osc2_level'] !== 'undefined' ? cache['osc2_level'] : 0.5;
      var osc2Pitch = typeof cache['osc2_pitch'] !== 'undefined' ? cache['osc2_pitch'] : 0.5;
      ctxLocal.strokeStyle = brandColor;
      ctxLocal.lineWidth = 2;
      ctxLocal.beginPath();
      var padding = 10;
      var graphW = w - padding * 2;
      var graphH = h - padding * 2;
      var centerY = h / 2;
      var oscPhase = (_animTime / 1000) * Math.PI * 2 * 2.2;
      for (var ox = 0; ox < graphW; ox++) {
        var pct3 = ox / graphW;
        var yVal3 = _evalOscWaveform(sawEn, sqEn, osc2Lvl, osc2Pitch, pct3, oscPhase);
        var canvasX4 = padding + ox;
        var canvasY4 = centerY - yVal3 * (graphH / 2);
        if (ox === 0) ctxLocal.moveTo(canvasX4, canvasY4);
        else ctxLocal.lineTo(canvasX4, canvasY4);
      }
      ctxLocal.stroke();

      // Ghost
      ctxLocal.strokeStyle = hexToRgba(brandColor, 0.06);
      ctxLocal.lineWidth = 1;
      ctxLocal.beginPath();
      var ghostOscPhase = oscPhase - Math.PI * 0.5;
      for (var ox2 = 0; ox2 < graphW; ox2++) {
        var pct4 = ox2 / graphW;
        var yVal4 = _evalOscWaveform(sawEn, sqEn, osc2Lvl, osc2Pitch, pct4, ghostOscPhase);
        var canvasX5 = padding + ox2;
        var canvasY5 = centerY - yVal4 * (graphH / 2);
        if (ox2 === 0) ctxLocal.moveTo(canvasX5, canvasY5);
        else ctxLocal.lineTo(canvasX5, canvasY5);
      }
      ctxLocal.stroke();

    } else if (currentPanelMode === 'ARP') {
      ctxLocal.strokeStyle = brandColor;
      ctxLocal.lineWidth = 2;
      var padding = 10;
      var graphW = w - padding * 2;
      var graphH = h - padding * 2;
      var centerY = h / 2;
      var arpRate = typeof cache['arp_rate'] !== 'undefined' ? cache['arp_rate'] : 0.5;
      var bpm = 20 + arpRate * 220;
      var beatMs = 60000 / bpm;
      var stepDuration = beatMs / 4;
      var stepIndex = Math.floor((_animTime % (stepDuration * 8)) / stepDuration);
      ctxLocal.beginPath();
      var steps = 8;
      var stepW = graphW / steps;
      for (var ai = 0; ai <= steps; ai++) {
        var ax = padding + ai * stepW;
        var ay = centerY + (ai % 4 - 2) * (graphH / 4);
        if (ai === 0) ctxLocal.moveTo(ax, ay);
        else ctxLocal.lineTo(ax, ay);
      }
      ctxLocal.stroke();
    }
  }

  beforeEach(() => {
    ctx = _makeMockCtx();
    canvas = { id: 'panel-graphic-canvas', getContext: vi.fn(() => ctx), width: 200, height: 100 };
    cache = {};
    currentPanelMode = 'ENV';
    panelActiveEnv = 1;
    panelActiveLfo = 1;
    panelActiveOsc = 1;
    _animTime = 0;
  });

  // ── Canvas null/edge cases ──

  it('returns early when canvas is null', () => {
    canvas = null;
    expect(() => drawPanelGraphic()).not.toThrow();
  });

  it('returns early when cache is null (after grid drawing)', () => {
    cache = null;
    drawPanelGraphic();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  // ── CRT grid ──

  it('draws CRT retro grid lines on canvas', () => {
    drawPanelGraphic();
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.moveTo).toHaveBeenCalled();
    expect(ctx.lineTo).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  // ── ENV mode ADSR ──

  it('draws ADSR envelope in ENV mode with default cache values', () => {
    currentPanelMode = 'ENV';
    panelActiveEnv = 1;
    drawPanelGraphic();
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalled();
  });

  it('draws ADSR envelope with custom cache values', () => {
    currentPanelMode = 'ENV';
    panelActiveEnv = 2;
    cache['env2_attack'] = 0.8;
    cache['env2_decay'] = 0.3;
    cache['env2_sustain'] = 0.7;
    cache['env2_release'] = 0.5;
    cache['env2_attack_curve'] = 0.5;
    cache['env2_decay_curve'] = -0.3;
    cache['env2_release_curve'] = 0.0;

    drawPanelGraphic();

    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalledWith('ENV 2 VCF', expect.any(Number), expect.any(Number));
  });

  it('draws VCA mode ADSR (envNum forced to 1)', () => {
    currentPanelMode = 'VCA';
    cache['env1_attack'] = 0.5;
    cache['env1_decay'] = 0.4;
    cache['env1_sustain'] = 0.6;
    cache['env1_release'] = 0.3;

    drawPanelGraphic();

    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalledWith('ENV 1 (VCA)', expect.any(Number), expect.any(Number));
  });

  it('draws ENV3 MOD label correctly', () => {
    currentPanelMode = 'ENV';
    panelActiveEnv = 3;
    drawPanelGraphic();
    expect(ctx.fillText).toHaveBeenCalledWith('ENV 3 MOD', expect.any(Number), expect.any(Number));
  });

  it('draws ADSR with minimal (zero) time values safely', () => {
    currentPanelMode = 'ENV';
    cache['env1_attack'] = 0;
    cache['env1_decay'] = 0;
    cache['env1_sustain'] = 0;
    cache['env1_release'] = 0;

    expect(() => drawPanelGraphic()).not.toThrow();
    expect(ctx.fill).toHaveBeenCalled();
  });

  // ── LFO mode ──

  it('draws LFO waveform with default shape and rate', () => {
    currentPanelMode = 'LFO';
    drawPanelGraphic();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('draws LFO sine waveform (shapeVal=0 from cache)', () => {
    currentPanelMode = 'LFO';
    cache['lfo1_shape'] = 0.0 / 6.0;
    cache['lfo1_rate'] = 0.5;
    drawPanelGraphic();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('draws LFO square waveform (shapeVal=2 from cache)', () => {
    currentPanelMode = 'LFO';
    cache['lfo1_shape'] = 2.0 / 6.0;
    drawPanelGraphic();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('draws LFO with animated time offset', () => {
    currentPanelMode = 'LFO';
    _animTime = 1000;
    drawPanelGraphic();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('draws LFO2 waveform with panelActiveLfo=2', () => {
    currentPanelMode = 'LFO';
    panelActiveLfo = 2;
    cache['lfo2_shape'] = 3.0 / 6.0;
    cache['lfo2_rate'] = 0.8;
    drawPanelGraphic();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  // ── VCF mode ──

  it('draws VCF filter curve with cutoff and resonance from cache', () => {
    currentPanelMode = 'VCF';
    cache['vcf_cutoff'] = 0.6;
    cache['vcf_resonance'] = 0.3;
    drawPanelGraphic();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('draws VCF with default cutoff/resonance when cache is empty', () => {
    currentPanelMode = 'VCF';
    drawPanelGraphic();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('draws HPF filter curve with cutoff from cache', () => {
    currentPanelMode = 'HPF';
    cache['hpf_cutoff'] = 0.3;
    drawPanelGraphic();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('draws HPF with default when cache is empty', () => {
    currentPanelMode = 'HPF';
    drawPanelGraphic();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  // ── OSC mode ──

  it('draws OSC combination waveform with defaults', () => {
    currentPanelMode = 'OSC';
    drawPanelGraphic();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('draws OSC with both saw and square enabled', () => {
    currentPanelMode = 'OSC';
    cache['osc1_saw_enable'] = 1.0;
    cache['osc1_square_enable'] = 1.0;
    cache['osc2_level'] = 0.8;
    cache['osc2_pitch'] = 0.5;
    drawPanelGraphic();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('draws OSC with only saw enabled (default)', () => {
    currentPanelMode = 'OSC';
    cache['osc1_saw_enable'] = 1.0;
    cache['osc1_square_enable'] = 0.0;
    cache['osc2_level'] = 0;
    drawPanelGraphic();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  // ── ARP mode ──

  it('draws ARP step indicator with default rate', () => {
    currentPanelMode = 'ARP';
    drawPanelGraphic();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('draws ARP with custom arp_rate', () => {
    currentPanelMode = 'ARP';
    cache['arp_rate'] = 0.8;
    drawPanelGraphic();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  // ── POLY mode (no graphic drawn beyond grid) ──

  it('draws only CRT grid for POLY mode', () => {
    currentPanelMode = 'POLY';
    drawPanelGraphic();
    expect(ctx.clearRect).toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════
// initDynamicSliders — touch/mouse drag for v-sliders
// ══════════════════════════════════════════════════════════════════

describe('initDynamicSliders — touch/mouse drag interaction', () => {
  let container;
  let mockBridge;

  function initDynamicSliders(containerEl) {
    containerEl.querySelectorAll('.v-slider').forEach(function(slider) {
      var handle = slider.querySelector('.handle');
      if (!handle) return;

      var isDragging = false;

      function onStart(clientY) {
        isDragging = true;
        document.body.style.userSelect = 'none';
        updateValue(clientY);
      }

      function onMove(clientY) {
        if (!isDragging) return;
        updateValue(clientY);
      }

      function onEnd() {
        if (!isDragging) return;
        isDragging = false;
        document.body.style.userSelect = '';
      }

      function onTouchMove(e) { onMove(e.touches[0].clientY); }
      function onTouchEnd() {
        onEnd();
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onTouchEnd);
      }
      slider.addEventListener('touchstart', function(e) {
        onStart(e.touches[0].clientY);
        document.addEventListener('touchmove', onTouchMove, { passive: true });
        document.addEventListener('touchend', onTouchEnd);
      }, { passive: true });

      function onMouseMove(e) { onMove(e.clientY); }
      function onMouseEnd() {
        onEnd();
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseEnd);
      }
      slider.addEventListener('mousedown', function(e) {
        onStart(e.clientY);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseEnd);
      });

      function updateValue(clientY) {
        var rect = slider.getBoundingClientRect();
        var handleHeight = 16;
        var totalH = rect.height - handleHeight;
        if (totalH <= 0) return;
        var relativeY = clientY - rect.top - (handleHeight / 2);
        relativeY = Math.max(0, Math.min(relativeY, totalH));
        var val = 1.0 - (relativeY / totalH);
        handle.style.top = relativeY + 'px';

        var ctrlUnit = slider.closest('[data-param]');
        if (ctrlUnit) {
          var paramId = ctrlUnit.getAttribute('data-param');
          if (paramId && window.dualMidiBridge) {
            window.dualMidiBridge.setParameter(paramId, val);
          }
        }
      }
    });
  }

  beforeEach(() => {
    mockBridge = { setParameter: vi.fn(), parameterCache: {} };
    vi.stubGlobal('window', { dualMidiBridge: mockBridge });

    // Mock document for addEventListener/removeEventListener
    vi.stubGlobal('document', {
      body: { style: { userSelect: '' } },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getElementById: vi.fn(),
    });

    container = _makeContainer();
  });

  it('registers touchstart and mousedown listeners on each v-slider', () => {
    var sliderUnit = _makeSlider('vcf_cutoff', 100);
    container._vSliders = [sliderUnit.querySelector('.v-slider')];

    initDynamicSliders(container);

    var slider = container._vSliders[0];
    expect(slider._listeners['touchstart']).toBeDefined();
    expect(slider._listeners['touchstart'].length).toBe(1);
    expect(slider._listeners['mousedown']).toBeDefined();
    expect(slider._listeners['mousedown'].length).toBe(1);
  });

  it('skips slider when handle is missing', () => {
    var slider = _createFakeEl('div');
    slider.classList.add('v-slider');
    slider._subElements['.handle'] = null;
    container._vSliders = [slider];

    expect(function() { initDynamicSliders(container); }).not.toThrow();
  });

  it('handles empty container (no sliders)', () => {
    expect(function() { initDynamicSliders(container); }).not.toThrow();
  });

  it('mousedown sets userSelect none and registers document listeners', () => {
    var sliderUnit = _makeSlider('vca_level', 100);
    container._vSliders = [sliderUnit.querySelector('.v-slider')];

    initDynamicSliders(container);

    var slider = container._vSliders[0];
    var mouseEvent = { clientY: 50, preventDefault: vi.fn() };
    slider._listeners['mousedown'][0](mouseEvent);

    expect(document.body.style.userSelect).toBe('none');
    expect(document.addEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(document.addEventListener).toHaveBeenCalledWith('mouseup', expect.any(Function));
  });
});

// ══════════════════════════════════════════════════════════════════
// _updatePanelStepVisual — SEQ step bar rendering
// ══════════════════════════════════════════════════════════════════

describe('_updatePanelStepVisual — SEQ step bar visual', () => {
  var stepsContainer;
  var stepWraps;
  var _panelSeqValues;
  var _panelSeqRaw;

  function _updatePanelStepVisual(idx) {
    var wraps = stepsContainer ? stepsContainer.children : [];
    if (idx < 0 || idx >= wraps.length) return;
    var wrap = wraps[idx];
    var val = _panelSeqValues[idx];
    var raw = _panelSeqRaw[idx];
    if (val === undefined || raw === undefined) return;
    var fillBar = wrap.querySelector('.panel-seq-fill');
    var skipBadge = wrap.querySelector('.panel-seq-skip');
    var numLabel = wrap.querySelector('.panel-seq-num');
    var isSkip = raw === 0;

    var signStr = val >= 0 ? '+' : '';
    wrap.title = isSkip
      ? 'Step ' + (idx + 1) + ': SKIP (raw: ' + raw + ')'
      : 'Step ' + (idx + 1) + ': ' + signStr + val + ' (raw: ' + raw + ')';

    if (skipBadge) skipBadge.style.display = isSkip ? 'block' : 'none';
    if (fillBar) {
      if (isSkip) {
        fillBar.style.height = '0%';
        fillBar.style.background = 'transparent';
        fillBar.style.borderTop = '1px dashed var(--color-danger)';
      } else if (val >= 0) {
        var pct = Math.min(50, (val / 127) * 50);
        fillBar.style.bottom = '50%';
        fillBar.style.height = pct + '%';
        fillBar.style.background = 'var(--accent-pink)';
        fillBar.style.borderTop = 'none';
      } else {
        var pct = Math.min(50, (Math.abs(val) / 128) * 50);
        fillBar.style.bottom = (50 - pct) + '%';
        fillBar.style.height = pct + '%';
        fillBar.style.background = 'color-mix(in srgb, var(--accent-pink) 40%, #000)';
        fillBar.style.borderTop = 'none';
      }
    }
  }

  beforeEach(() => {
    _panelSeqValues = new Array(32).fill(0);
    _panelSeqRaw = new Array(32).fill(128);

    stepsContainer = _createFakeEl('div');
    stepWraps = [];
    for (var i = 0; i < 32; i++) {
      var wrap = _createFakeEl('div');
      var fillBar = _createFakeEl('div');
      fillBar.classList.add('panel-seq-fill');
      var skipBadge = _createFakeEl('div');
      skipBadge.classList.add('panel-seq-skip');
      var numLabel = _createFakeEl('div');
      numLabel.classList.add('panel-seq-num');
      wrap._subElements['.panel-seq-fill'] = fillBar;
      wrap._subElements['.panel-seq-skip'] = skipBadge;
      wrap._subElements['.panel-seq-num'] = numLabel;
      stepWraps.push(wrap);
    }
    stepsContainer._children = stepWraps;
    stepsContainer.children = stepWraps;
  });

  it('updates step title with positive value', () => {
    _panelSeqValues[0] = 64;
    _panelSeqRaw[0] = 192;
    _updatePanelStepVisual(0);
    expect(stepWraps[0].title).toContain('+64 (raw: 192)');
  });

  it('updates step title with negative value', () => {
    _panelSeqValues[1] = -50;
    _panelSeqRaw[1] = 78;
    _updatePanelStepVisual(1);
    expect(stepWraps[1].title).toContain('-50 (raw: 78)');
  });

  it('marks step as SKIP when raw=0', () => {
    _panelSeqValues[2] = -128;
    _panelSeqRaw[2] = 0;
    _updatePanelStepVisual(2);
    expect(stepWraps[2].title).toContain('SKIP');
    var skipBadge = stepWraps[2].querySelector('.panel-seq-skip');
    expect(skipBadge.style.display).toBe('block');
    var fillBar = stepWraps[2].querySelector('.panel-seq-fill');
    expect(fillBar.style.background).toBe('transparent');
    expect(fillBar.style.borderTop).toContain('dashed');
  });

  it('renders positive value bar (upward from center)', () => {
    _panelSeqValues[3] = 63;
    _panelSeqRaw[3] = 191;
    _updatePanelStepVisual(3);
    var fillBar = stepWraps[3].querySelector('.panel-seq-fill');
    expect(fillBar.style.bottom).toBe('50%');
    expect(parseFloat(fillBar.style.height)).toBeCloseTo(24.8, 0);
    expect(fillBar.style.background).toBe('var(--accent-pink)');
  });

  it('renders negative value bar (downward from center)', () => {
    _panelSeqValues[4] = -64;
    _panelSeqRaw[4] = 64;
    _updatePanelStepVisual(4);
    var fillBar = stepWraps[4].querySelector('.panel-seq-fill');
    expect(parseFloat(fillBar.style.bottom)).toBeCloseTo(25, 1);
    expect(fillBar.style.height).toBe('25%');
    expect(fillBar.style.background).toContain('accent-pink');
  });

  it('does nothing for out-of-range idx', () => {
    expect(function() { _updatePanelStepVisual(99); }).not.toThrow();
    expect(function() { _updatePanelStepVisual(-1); }).not.toThrow();
  });

  it('does nothing when stepsContainer is null', () => {
    stepsContainer = null;
    expect(function() { _updatePanelStepVisual(0); }).not.toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════
// _syncPanelSeqFromCache — SEQ step value sync from cache
// ══════════════════════════════════════════════════════════════════

describe('_syncPanelSeqFromCache — step value sync', () => {
  var mockBridge;
  var _panelSeqValues;
  var _panelSeqRaw;
  var _updatePanelStepVisual;

  function _syncPanelSeqFromCache() {
    var bridge = mockBridge;
    if (!bridge) return;
    for (var si = 0; si < 32; si++) {
      var paramId = 'seq_step_' + (si + 1);
      var norm = bridge.parameterCache[paramId];
      if (norm !== undefined) {
        var rawByte = Math.round(norm * 255);
        _panelSeqRaw[si] = rawByte;
        _panelSeqValues[si] = rawByte === 0 ? 0 : rawByte - 128;
        if (typeof _updatePanelStepVisual === 'function') {
          _updatePanelStepVisual(si);
        }
      }
    }
  }

  beforeEach(() => {
    _panelSeqValues = new Array(32).fill(0);
    _panelSeqRaw = new Array(32).fill(128);
    _updatePanelStepVisual = vi.fn();
    mockBridge = { parameterCache: {} };
  });

  it('syncs a single step norm=0.5 → raw=128, value=0', () => {
    mockBridge.parameterCache['seq_step_1'] = 0.5;
    _syncPanelSeqFromCache();
    expect(_panelSeqRaw[0]).toBe(128);
    expect(_panelSeqValues[0]).toBe(0);
    expect(_updatePanelStepVisual).toHaveBeenCalledWith(0);
  });

  it('syncs step with norm=0 → raw=0, value=0 (skip)', () => {
    mockBridge.parameterCache['seq_step_5'] = 0.0;
    _syncPanelSeqFromCache();
    expect(_panelSeqRaw[4]).toBe(0);
    expect(_panelSeqValues[4]).toBe(0);
    expect(_updatePanelStepVisual).toHaveBeenCalledWith(4);
  });

  it('syncs step with norm=1 → raw=255, value=127', () => {
    mockBridge.parameterCache['seq_step_2'] = 1.0;
    _syncPanelSeqFromCache();
    expect(_panelSeqRaw[1]).toBe(255);
    expect(_panelSeqValues[1]).toBe(127);
    expect(_updatePanelStepVisual).toHaveBeenCalledWith(1);
  });

  it('syncs step with norm=0.25 → raw=64, value=-64', () => {
    mockBridge.parameterCache['seq_step_10'] = 64 / 255;
    _syncPanelSeqFromCache();
    expect(_panelSeqRaw[9]).toBe(64);
    expect(_panelSeqValues[9]).toBe(-64);
  });

  it('syncs all 32 steps from cache', () => {
    for (var i = 0; i < 32; i++) {
      mockBridge.parameterCache['seq_step_' + (i + 1)] = (i % 5) / 4;
    }
    _syncPanelSeqFromCache();
    expect(_updatePanelStepVisual).toHaveBeenCalledTimes(32);
    expect(_panelSeqRaw[0]).toBe(0);
    expect(_panelSeqRaw[4]).toBe(255);
  });

  it('returns early when bridge is null', () => {
    mockBridge = null;
    expect(function() { _syncPanelSeqFromCache(); }).not.toThrow();
  });

  it('handles missing _updatePanelStepVisual gracefully', () => {
    mockBridge.parameterCache['seq_step_1'] = 0.5;
    _updatePanelStepVisual = null;
    expect(function() { _syncPanelSeqFromCache(); }).not.toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════
// _updatePolyAssignUI and _updatePolyChordSummary
// ══════════════════════════════════════════════════════════════════

describe('_updatePolyAssignUI — poly chord assignment', () => {
  var container;
  var mockBridge;
  var keyLabel, summaryEl;
  var selectedKeyIdx = 0;
  var noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  var chordTypeNames = ['Memory','Major','Minor','Maj7','Min7','Dom7','Sus4','Pwr'];

  function _updatePolyAssignUI() {
    var bridge = mockBridge;
    if (!bridge) return;
    var polyMap = bridge.parameterCache['poly_chord_map'];
    if (!polyMap) return;

    var keyLabelEl = document.getElementById('poly-selected-key-label');
    if (keyLabelEl) keyLabelEl.textContent = noteNames[selectedKeyIdx];

    container.querySelectorAll('.poly-key-select-row').forEach(function(row) {
      var idx = parseInt(row.getAttribute('data-keyidx'));
      row.classList.toggle('active', idx === selectedKeyIdx);
    });

    var assign = polyMap[selectedKeyIdx];
    if (!assign) return;

    container.querySelectorAll('.poly-root-row').forEach(function(row) {
      var val = parseInt(row.getAttribute('data-val'));
      row.classList.toggle('active', val === assign.rootKey);
    });

    container.querySelectorAll('.poly-type-row').forEach(function(row) {
      var val = parseInt(row.getAttribute('data-val'));
      row.classList.toggle('active', val === assign.chordType);
    });
  }

  function _updatePolyChordSummary() {
    var bridge = mockBridge;
    if (!bridge) return;
    var polyMap = bridge.parameterCache['poly_chord_map'];
    if (!polyMap) return;

    var summaryEl = document.getElementById('poly-chord-summary');
    if (!summaryEl) return;

    var html = '';
    for (var i = 0; i < 12; i++) {
      var a = polyMap[i] || { rootKey: i, chordType: 1 };
      var typeName = chordTypeNames[a.chordType] || 'Major';
      html += '<div style="font-size:7px;color:var(--text-dim);padding:2px">' + noteNames[i] + ': ' + typeName + '</div>';
    }
    summaryEl.innerHTML = html;
  }

  function _createPolyKeySelectRow(keyIdx) {
    var row = _createFakeEl('div', { 'data-keyidx': String(keyIdx) });
    row.classList.add('poly-key-select-row');
    return row;
  }

  function _createPolyRootRow(val) {
    var row = _createFakeEl('div', { 'data-val': String(val) });
    row.classList.add('poly-root-row');
    return row;
  }

  function _createPolyTypeRow(val) {
    var row = _createFakeEl('div', { 'data-val': String(val) });
    row.classList.add('poly-type-row');
    return row;
  }

  beforeEach(() => {
    mockBridge = {
      parameterCache: {
        poly_chord_map: {},
      },
    };
    selectedKeyIdx = 0;
    keyLabel = _createFakeEl('span', { id: 'poly-selected-key-label' });
    summaryEl = _createFakeEl('div', { id: 'poly-chord-summary' });

    container = _createFakeEl('div');
    container._selectorAll = {};

    var keyRows = [];
    for (var i = 0; i < 12; i++) keyRows.push(_createPolyKeySelectRow(i));
    container._selectorAll['.poly-key-select-row'] = keyRows;

    var rootRows = [];
    for (var i2 = 0; i2 < 12; i2++) rootRows.push(_createPolyRootRow(i2));
    container._selectorAll['.poly-root-row'] = rootRows;

    var typeRows = [];
    for (var i3 = 0; i3 < 8; i3++) typeRows.push(_createPolyTypeRow(i3));
    container._selectorAll['.poly-type-row'] = typeRows;

    var mockDoc = {
      getElementById: function(id) {
        if (id === 'poly-selected-key-label') return keyLabel;
        if (id === 'poly-chord-summary') return summaryEl;
        return null;
      },
      addEventListener: vi.fn(),
    };
    vi.stubGlobal('document', mockDoc);
  });

  // ── _updatePolyAssignUI ──

  it('updates key label for selected key index 0 (C)', () => {
    mockBridge.parameterCache['poly_chord_map'] = { 0: { rootKey: 3, chordType: 2 } };
    selectedKeyIdx = 0;
    _updatePolyAssignUI();
    expect(keyLabel.textContent).toBe('C');
  });

  it('updates key label for selected key index 5 (F)', () => {
    mockBridge.parameterCache['poly_chord_map'] = { 5: { rootKey: 0, chordType: 1 } };
    selectedKeyIdx = 5;
    _updatePolyAssignUI();
    expect(keyLabel.textContent).toBe('F');
  });

  it('highlights selected key row as active', () => {
    mockBridge.parameterCache['poly_chord_map'] = { 3: { rootKey: 0, chordType: 1 } };
    selectedKeyIdx = 3;
    _updatePolyAssignUI();
    var keyRows = container._selectorAll['.poly-key-select-row'];
    keyRows.forEach(function(row, i) {
      expect(row.classList.contains('active')).toBe(i === 3);
    });
  });

  it('highlights root key and chord type rows', () => {
    mockBridge.parameterCache['poly_chord_map'] = { 0: { rootKey: 7, chordType: 4 } };
    selectedKeyIdx = 0;
    _updatePolyAssignUI();

    var rootRows = container._selectorAll['.poly-root-row'];
    rootRows.forEach(function(row, i) {
      expect(row.classList.contains('active')).toBe(i === 7);
    });

    var typeRows = container._selectorAll['.poly-type-row'];
    typeRows.forEach(function(row, i) {
      expect(row.classList.contains('active')).toBe(i === 4);
    });
  });

  it('does nothing when bridge is null', () => {
    mockBridge = null;
    expect(function() { _updatePolyAssignUI(); }).not.toThrow();
  });

  it('does nothing when poly_chord_map is missing', () => {
    delete mockBridge.parameterCache['poly_chord_map'];
    expect(function() { _updatePolyAssignUI(); }).not.toThrow();
  });

  it('does nothing when selected key has no assignment', () => {
    mockBridge.parameterCache['poly_chord_map'] = { 0: { rootKey: 0, chordType: 0 } };
    selectedKeyIdx = 5;
    expect(function() { _updatePolyAssignUI(); }).not.toThrow();
  });

  // ── _updatePolyChordSummary ──

  it('generates HTML summary for all 12 notes', () => {
    mockBridge.parameterCache['poly_chord_map'] = {
      0: { rootKey: 0, chordType: 1 },
      3: { rootKey: 7, chordType: 3 },
      7: { rootKey: 2, chordType: 5 },
    };
    _updatePolyChordSummary();
    expect(summaryEl.innerHTML).toContain('C: Major');
    expect(summaryEl.innerHTML).toContain('D#: Maj7');
    expect(summaryEl.innerHTML).toContain('G: Dom7');
  });

  it('generates 12 div entries in summary', () => {
    mockBridge.parameterCache['poly_chord_map'] = {};
    _updatePolyChordSummary();
    var matches = summaryEl.innerHTML.match(/<div /g);
    expect(matches).toHaveLength(12);
  });

  it('uses defaults for missing map entries', () => {
    mockBridge.parameterCache['poly_chord_map'] = {};
    selectedKeyIdx = 0;
    _updatePolyChordSummary();
    expect(summaryEl.innerHTML).toContain('C: Major');
    expect(summaryEl.innerHTML).toContain('G#: Major');
    expect(summaryEl.innerHTML).toContain('B: Major');
  });

  it('does nothing when bridge is null', () => {
    mockBridge = null;
    expect(function() { _updatePolyChordSummary(); }).not.toThrow();
  });

  it('does nothing when poly_chord_map is missing', () => {
    delete mockBridge.parameterCache['poly_chord_map'];
    expect(function() { _updatePolyChordSummary(); }).not.toThrow();
  });

  it('does nothing when summaryEl is missing', () => {
    vi.stubGlobal('document', { getElementById: function() { return null; }, addEventListener: vi.fn() });
    expect(function() { _updatePolyChordSummary(); }).not.toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════
// _stopAudioWaveformPolling and _updateAudioWaveformPolling
// ══════════════════════════════════════════════════════════════════

describe('_stopAudioWaveformPolling — polling lifecycle', () => {
  var _audioWaveformTimer;

  function _stopAudioWaveformPolling() {
    if (_audioWaveformTimer) {
      clearInterval(_audioWaveformTimer);
      _audioWaveformTimer = null;
    }
  }

  beforeEach(() => {
    _audioWaveformTimer = null;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does nothing when timer is null', () => {
    expect(function() { _stopAudioWaveformPolling(); }).not.toThrow();
  });

  it('clears interval and sets timer to null', () => {
    _audioWaveformTimer = setInterval(vi.fn(), 100);
    expect(_audioWaveformTimer).toBeTruthy();

    _stopAudioWaveformPolling();

    expect(_audioWaveformTimer).toBeNull();
  });

  it('handles consecutive calls (idempotent)', () => {
    _audioWaveformTimer = setInterval(vi.fn(), 100);
    _stopAudioWaveformPolling();
    _stopAudioWaveformPolling();
    expect(_audioWaveformTimer).toBeNull();
  });
});

describe('_updateAudioWaveformPolling — polling start/stop logic', () => {
  var _audioWaveformTimer;
  var panel;
  var isRealScopeCollapsed;
  var mockBridge;

  function _stopAudioWaveformPolling() {
    if (_audioWaveformTimer) {
      clearInterval(_audioWaveformTimer);
      _audioWaveformTimer = null;
    }
  }

  function _startAudioWaveformPolling() {
    _stopAudioWaveformPolling();
    _audioWaveformTimer = setInterval(function() {}, 50);
  }

  function _updateAudioWaveformPolling() {
    var shouldPoll = panel.classList.contains('active')
      && !isRealScopeCollapsed
      && mockBridge
      && mockBridge.isJuce;
    if (shouldPoll) {
      _startAudioWaveformPolling();
    } else {
      _stopAudioWaveformPolling();
    }
  }

  beforeEach(() => {
    _audioWaveformTimer = null;
    panel = _createFakeEl('div', { id: 'detail-edit-panel' });
    isRealScopeCollapsed = true;
    mockBridge = { isJuce: false, parameterCache: {} };
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts polling when panel is active, scope expanded, bridge.isJuce=true', () => {
    panel.classList.add('active');
    isRealScopeCollapsed = false;
    mockBridge.isJuce = true;

    _updateAudioWaveformPolling();

    expect(_audioWaveformTimer).not.toBeNull();
  });

  it('stops polling when panel is not active', () => {
    panel.classList.add('active');
    isRealScopeCollapsed = false;
    mockBridge.isJuce = true;
    _updateAudioWaveformPolling();
    expect(_audioWaveformTimer).not.toBeNull();

    panel.classList.remove('active');
    _updateAudioWaveformPolling();
    expect(_audioWaveformTimer).toBeNull();
  });

  it('stops polling when scope is collapsed', () => {
    panel.classList.add('active');
    isRealScopeCollapsed = true;
    mockBridge.isJuce = true;

    _updateAudioWaveformPolling();

    expect(_audioWaveformTimer).toBeNull();
  });

  it('stops polling when bridge is not JUCE', () => {
    panel.classList.add('active');
    isRealScopeCollapsed = false;
    mockBridge.isJuce = false;

    _updateAudioWaveformPolling();

    expect(_audioWaveformTimer).toBeNull();
  });

  it('stops polling when bridge is null', () => {
    panel.classList.add('active');
    isRealScopeCollapsed = false;
    mockBridge = null;

    _updateAudioWaveformPolling();

    expect(_audioWaveformTimer).toBeNull();
  });

  it('is idempotent — calling start twice does not crash', () => {
    panel.classList.add('active');
    isRealScopeCollapsed = false;
    mockBridge.isJuce = true;

    _updateAudioWaveformPolling();
    var timer1 = _audioWaveformTimer;
    _updateAudioWaveformPolling();
    var timer2 = _audioWaveformTimer;

    expect(timer1).not.toBeNull();
    expect(timer2).not.toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════
// SEQ step visual — active length dimming (source-compatible version)
// ══════════════════════════════════════════════════════════════════

describe('_updatePanelStepVisual — active length dimming', () => {
  var stepsContainer;
  var stepWraps;
  var _panelSeqValues;
  var _panelSeqRaw;
  var lenSel;

  function _updatePanelStepVisual(idx) {
    var wraps = stepsContainer ? stepsContainer.children : [];
    if (idx < 0 || idx >= wraps.length) return;
    var wrap = wraps[idx];
    var val = _panelSeqValues[idx];
    var raw = _panelSeqRaw[idx];
    if (val === undefined || raw === undefined) return;
    var fillBar = wrap.querySelector('.panel-seq-fill');
    var skipBadge = wrap.querySelector('.panel-seq-skip');
    var numLabel = wrap.querySelector('.panel-seq-num');
    var activeLen = lenSel ? (parseInt(lenSel.value) + 2) : 16;
    var isActive = idx < activeLen;
    var isSkip = raw === 0;

    var signStr = val >= 0 ? '+' : '';
    wrap.title = isSkip
      ? 'Step ' + (idx + 1) + ': SKIP (raw: ' + raw + ')'
      : 'Step ' + (idx + 1) + ': ' + signStr + val + ' (raw: ' + raw + ')';

    if (skipBadge) skipBadge.style.display = isSkip ? 'block' : 'none';
    if (numLabel) {
      numLabel.style.color = isActive ? 'var(--text-faint)' : 'var(--text-dim)';
      numLabel.style.opacity = isActive ? '1' : '0.3';
    }
    wrap.style.opacity = isActive ? '1' : '0.3';

    if (fillBar) {
      if (isSkip) {
        fillBar.style.height = '0%';
        fillBar.style.background = 'transparent';
        fillBar.style.borderTop = '1px dashed var(--color-danger)';
      } else if (val >= 0) {
        var pct = Math.min(50, (val / 127) * 50);
        fillBar.style.bottom = '50%';
        fillBar.style.height = pct + '%';
        fillBar.style.background = 'var(--accent-pink)';
        fillBar.style.borderTop = 'none';
      } else {
        var pct = Math.min(50, (Math.abs(val) / 128) * 50);
        fillBar.style.bottom = (50 - pct) + '%';
        fillBar.style.height = pct + '%';
        fillBar.style.background = 'color-mix(in srgb, var(--accent-pink) 40%, #000)';
        fillBar.style.borderTop = 'none';
      }
    }
  }

  beforeEach(() => {
    _panelSeqValues = new Array(32).fill(0);
    _panelSeqRaw = new Array(32).fill(128);

    lenSel = _createFakeEl('select', { id: 'panel-seq-length-select' });
    lenSel.value = '14';

    stepsContainer = _createFakeEl('div');
    stepWraps = [];
    for (var i = 0; i < 32; i++) {
      var wrap = _createFakeEl('div');
      var fillBar = _createFakeEl('div');
      fillBar.classList.add('panel-seq-fill');
      var skipBadge = _createFakeEl('div');
      skipBadge.classList.add('panel-seq-skip');
      var numLabel = _createFakeEl('div');
      numLabel.classList.add('panel-seq-num');
      wrap._subElements['.panel-seq-fill'] = fillBar;
      wrap._subElements['.panel-seq-skip'] = skipBadge;
      wrap._subElements['.panel-seq-num'] = numLabel;
      stepWraps.push(wrap);
    }
    stepsContainer._children = stepWraps;
    stepsContainer.children = stepWraps;

    var mockDoc = {
      getElementById: function(id) {
        if (id === 'panel-seq-length-select') return lenSel;
        return null;
      },
      addEventListener: vi.fn(),
    };
    vi.stubGlobal('document', mockDoc);
  });

  it('dims steps beyond active length (opacity 0.3)', () => {
    lenSel.value = '6';
    _panelSeqValues[7] = 50;
    _panelSeqValues[8] = 50;
    _panelSeqRaw[7] = 178;
    _panelSeqRaw[8] = 178;
    _updatePanelStepVisual(7);
    _updatePanelStepVisual(8);
    expect(stepWraps[7].style.opacity).toBe('1');
    expect(stepWraps[8].style.opacity).toBe('0.3');
  });

  it('sets numLabel color for active vs inactive steps', () => {
    lenSel.value = '0';
    _panelSeqValues[0] = 30;
    _panelSeqValues[2] = 30;
    _panelSeqRaw[0] = 158;
    _panelSeqRaw[2] = 158;
    _updatePanelStepVisual(0);
    _updatePanelStepVisual(2);
    var zeroLabel = stepWraps[0].querySelector('.panel-seq-num');
    var twoLabel = stepWraps[2].querySelector('.panel-seq-num');
    expect(zeroLabel.style.color).toBe('var(--text-faint)');
    expect(zeroLabel.style.opacity).toBe('1');
    expect(twoLabel.style.color).toBe('var(--text-dim)');
    expect(twoLabel.style.opacity).toBe('0.3');
  });

  it('defaults activeLen to 16 when length-select not found', () => {
    vi.stubGlobal('document', { getElementById: function() { return null; }, addEventListener: vi.fn() });
    _panelSeqValues[0] = 30;
    _panelSeqRaw[0] = 158;
    _updatePanelStepVisual(0);
    expect(stepWraps[0].style.opacity).toBe('1');
  });

  it('all 32 steps active when length=32', () => {
    lenSel.value = '30';
    _panelSeqValues[31] = 60;
    _panelSeqRaw[31] = 188;
    _updatePanelStepVisual(31);
    expect(stepWraps[31].style.opacity).toBe('1');
  });

  it('preserves skip display for inactive steps', () => {
    lenSel.value = '0';
    _panelSeqValues[3] = -128;
    _panelSeqRaw[3] = 0;
    _updatePanelStepVisual(3);
    var skipBadge = stepWraps[3].querySelector('.panel-seq-skip');
    expect(skipBadge.style.display).toBe('block');
    var fillBar = stepWraps[3].querySelector('.panel-seq-fill');
    expect(fillBar.style.background).toBe('transparent');
  });

  it('does nothing when stepsContainer null', () => {
    stepsContainer = null;
    expect(function() { _updatePanelStepVisual(0); }).not.toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════
// SEQ skip button — toggle skip/center
// ══════════════════════════════════════════════════════════════════

describe('SEQ skip button — toggle skip/center', () => {
  var mockBridge;
  var _panelSeqValues;
  var _panelSeqRaw;
  var _panelLastSeqStep;
  var _updatePanelStepVisual;

  function handleSkipClick() {
    var idx = typeof _panelLastSeqStep === 'number' ? _panelLastSeqStep : 0;
    var currentRaw = _panelSeqRaw && _panelSeqRaw[idx];
    if (currentRaw === 0) {
      _panelSeqValues[idx] = 0;
      _panelSeqRaw[idx] = 128;
      if (mockBridge) mockBridge.setParameter('seq_step_' + (idx + 1), 0.5);
    } else {
      _panelSeqValues[idx] = -128;
      _panelSeqRaw[idx] = 0;
      if (mockBridge) mockBridge.setParameter('seq_step_' + (idx + 1), 0.0);
    }
    if (typeof _updatePanelStepVisual === 'function') _updatePanelStepVisual(idx);
  }

  beforeEach(() => {
    _panelSeqValues = new Array(32).fill(0);
    _panelSeqRaw = new Array(32).fill(128);
    _panelLastSeqStep = 4;
    _updatePanelStepVisual = vi.fn();
    mockBridge = { setParameter: vi.fn(), parameterCache: {} };
  });

  it('toggles skip (raw=0) to center (raw=128)', () => {
    _panelSeqRaw[4] = 0;
    _panelSeqValues[4] = -128;
    handleSkipClick();
    expect(_panelSeqRaw[4]).toBe(128);
    expect(_panelSeqValues[4]).toBe(0);
    expect(mockBridge.setParameter).toHaveBeenCalledWith('seq_step_5', 0.5);
    expect(_updatePanelStepVisual).toHaveBeenCalledWith(4);
  });

  it('toggles center (raw=128) to skip (raw=0)', () => {
    _panelSeqRaw[4] = 128;
    _panelSeqValues[4] = 0;
    handleSkipClick();
    expect(_panelSeqRaw[4]).toBe(0);
    expect(_panelSeqValues[4]).toBe(-128);
    expect(mockBridge.setParameter).toHaveBeenCalledWith('seq_step_5', 0.0);
  });

  it('uses index 0 when _panelLastSeqStep not set', () => {
    _panelLastSeqStep = undefined;
    _panelSeqRaw[0] = 0;
    handleSkipClick();
    expect(_panelSeqRaw[0]).toBe(128);
  });

  it('round-trips center to skip to center', () => {
    _panelSeqRaw[4] = 128;
    handleSkipClick();
    expect(_panelSeqRaw[4]).toBe(0);
    _panelSeqRaw[4] = 0;
    handleSkipClick();
    expect(_panelSeqRaw[4]).toBe(128);
  });

  it('calls _updatePanelStepVisual after toggle', () => {
    _panelSeqRaw[4] = 128;
    handleSkipClick();
    expect(_updatePanelStepVisual).toHaveBeenCalledTimes(1);
  });

  it('does not crash when bridge null', () => {
    mockBridge = null;
    _panelSeqRaw[4] = 128;
    expect(function() { handleSkipClick(); }).not.toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════
// SEQ double-click — reset step to center
// ══════════════════════════════════════════════════════════════════

describe('SEQ double-click — reset step to center', () => {
  var mockBridge;
  var _panelSeqValues;
  var _panelSeqRaw;
  var _panelLastSeqStep;
  var _updatePanelStepVisual;

  function handleDblClick(stepIdx) {
    var idx = stepIdx;
    _panelLastSeqStep = idx;
    _panelSeqValues[idx] = 0;
    _panelSeqRaw[idx] = 128;
    if (mockBridge) mockBridge.setParameter('seq_step_' + (idx + 1), 0.5);
    if (typeof _updatePanelStepVisual === 'function') _updatePanelStepVisual(idx);
  }

  beforeEach(() => {
    _panelSeqValues = new Array(32).fill(0);
    _panelSeqRaw = new Array(32).fill(128);
    _panelLastSeqStep = -1;
    _updatePanelStepVisual = vi.fn();
    mockBridge = { setParameter: vi.fn(), parameterCache: {} };
  });

  it('resets step 0 to center', () => {
    _panelSeqValues[0] = 100;
    _panelSeqRaw[0] = 228;
    handleDblClick(0);
    expect(_panelSeqValues[0]).toBe(0);
    expect(_panelSeqRaw[0]).toBe(128);
    expect(_panelLastSeqStep).toBe(0);
    expect(mockBridge.setParameter).toHaveBeenCalledWith('seq_step_1', 0.5);
  });

  it('resets step 31 (last) to center', () => {
    _panelSeqValues[31] = -64;
    _panelSeqRaw[31] = 64;
    handleDblClick(31);
    expect(mockBridge.setParameter).toHaveBeenCalledWith('seq_step_32', 0.5);
  });

  it('resets skip step to center', () => {
    _panelSeqValues[5] = -128;
    _panelSeqRaw[5] = 0;
    handleDblClick(5);
    expect(mockBridge.setParameter).toHaveBeenCalledWith('seq_step_6', 0.5);
  });

  it('does not crash when bridge null', () => {
    mockBridge = null;
    expect(function() { handleDblClick(0); }).not.toThrow();
  });

  it('calls _updatePanelStepVisual after reset', () => {
    handleDblClick(3);
    expect(_updatePanelStepVisual).toHaveBeenCalledWith(3);
  });
});

// ══════════════════════════════════════════════════════════════════
// SEQ selectors — clock/length/keyloop init from cache
// ══════════════════════════════════════════════════════════════════

describe('SEQ selectors — clock/length/keyloop init from cache', () => {
  var mockBridge;
  var clockSel, lenSel, klSel;

  function initSeqSelectors() {
    if (clockSel) {
      var cv = window.dualMidiBridge ? window.dualMidiBridge.parameterCache['seq_clock'] || 0 : 0;
      clockSel.value = Math.round(cv * 15);
      clockSel.addEventListener('change', function() {
        if (window.dualMidiBridge) window.dualMidiBridge.setParameter('seq_clock', parseInt(this.value) / 15.0);
      });
    }
    if (lenSel) {
      var lv = window.dualMidiBridge ? window.dualMidiBridge.parameterCache['seq_length'] || 0 : 0;
      lenSel.value = Math.round(lv * 31);
      lenSel.addEventListener('change', function() {
        if (window.dualMidiBridge) window.dualMidiBridge.setParameter('seq_length', parseInt(this.value) / 31.0);
      });
    }
    if (klSel) {
      var kv = window.dualMidiBridge ? window.dualMidiBridge.parameterCache['seq_key_loop'] || 0 : 0;
      klSel.value = Math.round(kv * 2);
      klSel.addEventListener('change', function() {
        if (window.dualMidiBridge) window.dualMidiBridge.setParameter('seq_key_loop', parseInt(this.value) / 2.0);
      });
    }
  }

  beforeEach(() => {
    clockSel = _createFakeEl('select', { id: 'panel-seq-clock-select' });
    clockSel.options = [];
    for (var i = 0; i < 16; i++) clockSel.options.push(_createFakeEl('option'));
    lenSel = _createFakeEl('select', { id: 'panel-seq-length-select' });
    lenSel.options = [];
    for (var j = 0; j < 31; j++) lenSel.options.push(_createFakeEl('option'));
    klSel = _createFakeEl('select', { id: 'panel-seq-keyloop-select' });
    klSel.options = [];
    for (var k = 0; k < 3; k++) klSel.options.push(_createFakeEl('option'));
    mockBridge = { parameterCache: {}, setParameter: vi.fn() };
    vi.stubGlobal('window', { dualMidiBridge: mockBridge });
    var mockDoc = {
      getElementById: function(id) {
        if (id === 'panel-seq-clock-select') return clockSel;
        if (id === 'panel-seq-length-select') return lenSel;
        if (id === 'panel-seq-keyloop-select') return klSel;
        return null;
      },
      addEventListener: vi.fn(),
    };
    vi.stubGlobal('document', mockDoc);
  });

  it('clock selector from cache (seq_clock=0.5)', () => {
    mockBridge.parameterCache['seq_clock'] = 0.5;
    initSeqSelectors();
    expect(Number(clockSel.value)).toBe(8);
  });

  it('length selector from cache (seq_length=0.5)', () => {
    mockBridge.parameterCache['seq_length'] = 0.5;
    initSeqSelectors();
    expect(Number(lenSel.value)).toBe(16);
  });

  it('keyloop selector from cache (seq_key_loop=1)', () => {
    mockBridge.parameterCache['seq_key_loop'] = 1.0;
    initSeqSelectors();
    expect(Number(klSel.value)).toBe(2);
  });

  it('defaults to 0 when cache empty', () => {
    initSeqSelectors();
    expect(Number(clockSel.value)).toBe(0);
    expect(Number(lenSel.value)).toBe(0);
    expect(Number(klSel.value)).toBe(0);
  });

  it('wires change events', () => {
    initSeqSelectors();
    clockSel._listeners['change'][0]();
    lenSel._listeners['change'][0]();
    klSel._listeners['change'][0]();
    expect(mockBridge.setParameter).toHaveBeenCalledTimes(3);
  });

  it('does not crash without bridge', () => {
    vi.stubGlobal('window', {});
    expect(function() { initSeqSelectors(); }).not.toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════
// ARP mode — toggle and select wiring
// ══════════════════════════════════════════════════════════════════

describe('ARP mode — toggle and select wiring', () => {
  var mockBridge;
  var arpBox, holdBox, keySyncBox, clockSel, velGateSel, modeSel, octaveSel;

  function wireArpControls() {
    if (arpBox) {
      arpBox.addEventListener('click', function() {
        var active = arpBox.classList.contains('active');
        if (window.dualMidiBridge) window.dualMidiBridge.setParameter('arp_enable', active ? 0.0 : 1.0);
      });
    }
    if (holdBox) {
      holdBox.addEventListener('click', function() {
        var active = holdBox.classList.contains('active');
        if (window.dualMidiBridge) window.dualMidiBridge.setParameter('arp_hold', active ? 0.0 : 1.0);
      });
    }
    if (keySyncBox) {
      keySyncBox.addEventListener('click', function() {
        var active = keySyncBox.classList.contains('active');
        if (window.dualMidiBridge) window.dualMidiBridge.setParameter('arp_key_sync', active ? 0.0 : 1.0);
      });
    }
    if (clockSel) {
      clockSel.addEventListener('change', function() {
        if (window.dualMidiBridge) window.dualMidiBridge.setParameter('arp_clock_divider', parseInt(this.value) / 12.0);
      });
    }
    if (velGateSel) {
      velGateSel.addEventListener('change', function() {
        if (window.dualMidiBridge) window.dualMidiBridge.setParameter('arp_velocity_gate', parseInt(this.value) / 2.0);
      });
    }
    if (modeSel) {
      modeSel.addEventListener('change', function() {
        if (window.dualMidiBridge) window.dualMidiBridge.setParameter('arp_mode', parseInt(this.value) / 10.0);
      });
    }
    if (octaveSel) {
      octaveSel.addEventListener('change', function() {
        if (window.dualMidiBridge) window.dualMidiBridge.setParameter('arp_octave', parseInt(this.value) / 3.0);
      });
    }
  }

  beforeEach(() => {
    mockBridge = { setParameter: vi.fn(), parameterCache: {} };
    vi.stubGlobal('window', { dualMidiBridge: mockBridge });
    arpBox = _createFakeEl('div', { id: 'panel-arp-enable-box' });
    holdBox = _createFakeEl('div', { id: 'panel-arp-hold-box' });
    keySyncBox = _createFakeEl('div', { id: 'panel-arp-keysync-box' });
    clockSel = _createFakeEl('select', { id: 'panel-arp-clock-select' });
    clockSel.options = [];
    for (var i = 0; i < 13; i++) clockSel.options.push(_createFakeEl('option'));
    velGateSel = _createFakeEl('select', { id: 'panel-arp-velgate-select' });
    velGateSel.options = [];
    for (var j = 0; j < 3; j++) velGateSel.options.push(_createFakeEl('option'));
    modeSel = _createFakeEl('select', { id: 'panel-arp-mode-select' });
    modeSel.options = [];
    for (var k = 0; k < 10; k++) modeSel.options.push(_createFakeEl('option'));
    octaveSel = _createFakeEl('select', { id: 'panel-arp-octave-select' });
    octaveSel.options = [];
    for (var l = 0; l < 4; l++) octaveSel.options.push(_createFakeEl('option'));
  });

  it('wires arp enable toggle', () => {
    wireArpControls();
    expect(arpBox._listeners['click']).toBeDefined();
  });

  it('wires hold toggle', () => {
    wireArpControls();
    expect(holdBox._listeners['click']).toBeDefined();
  });

  it('wires key sync toggle', () => {
    wireArpControls();
    expect(keySyncBox._listeners['click']).toBeDefined();
  });

  it('arp enable click sets param by active state', () => {
    wireArpControls();
    arpBox.classList.add('active');
    arpBox._listeners['click'][0]();
    expect(mockBridge.setParameter).toHaveBeenCalledWith('arp_enable', 0.0);
  });

  it('arp enable click toggles on when inactive', () => {
    wireArpControls();
    arpBox._listeners['click'][0]();
    expect(mockBridge.setParameter).toHaveBeenCalledWith('arp_enable', 1.0);
  });

  it('wires clock divider change', () => {
    wireArpControls();
    clockSel._listeners['change'][0]();
    expect(mockBridge.setParameter).toHaveBeenCalled();
  });

  it('wires velocity gate change', () => {
    wireArpControls();
    velGateSel._listeners['change'][0]();
    expect(mockBridge.setParameter).toHaveBeenCalled();
  });

  it('wires arp mode change', () => {
    wireArpControls();
    modeSel._listeners['change'][0]();
    expect(mockBridge.setParameter).toHaveBeenCalled();
  });

  it('wires octave change', () => {
    wireArpControls();
    octaveSel._listeners['change'][0]();
    expect(mockBridge.setParameter).toHaveBeenCalled();
  });

  it('does not crash without bridge', () => {
    vi.stubGlobal('window', {});
    expect(function() { wireArpControls(); }).not.toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════
// VCF/HPF/VCA toggle click handlers
// ══════════════════════════════════════════════════════════════════

describe('VCF/HPF/VCA toggle click handlers', () => {
  var mockBridge;

  function wireVcfPoleBtns(pole2Btn, pole4Btn) {
    if (pole2Btn && pole4Btn) {
      pole2Btn.addEventListener('click', function() {
        if (window.dualMidiBridge) {
          window.dualMidiBridge.setParameter('vcf_pole_mode', 0.0);
          window.dualMidiBridge.handleParameterChangeFromBackend('vcf_pole_mode', 0.0);
        }
      });
      pole4Btn.addEventListener('click', function() {
        if (window.dualMidiBridge) {
          window.dualMidiBridge.setParameter('vcf_pole_mode', 1.0);
          window.dualMidiBridge.handleParameterChangeFromBackend('vcf_pole_mode', 1.0);
        }
      });
    }
  }

  function wireVcfPolBtns(polNorm, polInv) {
    if (polNorm && polInv) {
      polNorm.addEventListener('click', function() {
        if (window.dualMidiBridge) {
          window.dualMidiBridge.setParameter('vcf_env_polarity', 1.0);
          window.dualMidiBridge.handleParameterChangeFromBackend('vcf_env_polarity', 1.0);
        }
      });
      polInv.addEventListener('click', function() {
        if (window.dualMidiBridge) {
          window.dualMidiBridge.setParameter('vcf_env_polarity', 0.0);
          window.dualMidiBridge.handleParameterChangeFromBackend('vcf_env_polarity', 0.0);
        }
      });
    }
  }

  function wireVcfLfoSrcBtns(lfoSrc1, lfoSrc2) {
    if (lfoSrc1 && lfoSrc2) {
      lfoSrc1.addEventListener('click', function() {
        if (window.dualMidiBridge) {
          window.dualMidiBridge.setParameter('vcf_lfo_select', 0.0);
          window.dualMidiBridge.handleParameterChangeFromBackend('vcf_lfo_select', 0.0);
        }
      });
      lfoSrc2.addEventListener('click', function() {
        if (window.dualMidiBridge) {
          window.dualMidiBridge.setParameter('vcf_lfo_select', 1.0);
          window.dualMidiBridge.handleParameterChangeFromBackend('vcf_lfo_select', 1.0);
        }
      });
    }
  }

  function wireHpfBoostBtns(boostOff, boostOn) {
    if (boostOff && boostOn) {
      boostOff.addEventListener('click', function() {
        if (window.dualMidiBridge) {
          window.dualMidiBridge.setParameter('hpf_boost_enable', 0.0);
          window.dualMidiBridge.handleParameterChangeFromBackend('hpf_boost_enable', 0.0);
        }
      });
      boostOn.addEventListener('click', function() {
        if (window.dualMidiBridge) {
          window.dualMidiBridge.setParameter('hpf_boost_enable', 1.0);
          window.dualMidiBridge.handleParameterChangeFromBackend('hpf_boost_enable', 1.0);
        }
      });
    }
  }

  function wireVcaModeBtns(transparent, ballsy) {
    if (transparent && ballsy) {
      transparent.addEventListener('click', function() {
        if (window.dualMidiBridge) {
          window.dualMidiBridge.setParameter('vca_mode', 0.0);
          window.dualMidiBridge.handleParameterChangeFromBackend('vca_mode', 0.0);
        }
      });
      ballsy.addEventListener('click', function() {
        if (window.dualMidiBridge) {
          window.dualMidiBridge.setParameter('vca_mode', 1.0);
          window.dualMidiBridge.handleParameterChangeFromBackend('vca_mode', 1.0);
        }
      });
    }
  }

  beforeEach(() => {
    mockBridge = { setParameter: vi.fn(), handleParameterChangeFromBackend: vi.fn(), parameterCache: {} };
    vi.stubGlobal('window', { dualMidiBridge: mockBridge });
  });

  it('VCF 2-Pole sets vcf_pole_mode=0.0', () => {
    var pole2 = _createFakeEl('div', { id: 'panel-vcf-pole-2' });
    var pole4 = _createFakeEl('div', { id: 'panel-vcf-pole-4' });
    wireVcfPoleBtns(pole2, pole4);
    pole2._listeners['click'][0]();
    expect(mockBridge.setParameter).toHaveBeenCalledWith('vcf_pole_mode', 0.0);
  });

  it('VCF 4-Pole sets vcf_pole_mode=1.0', () => {
    var pole2 = _createFakeEl('div', { id: 'panel-vcf-pole-2' });
    var pole4 = _createFakeEl('div', { id: 'panel-vcf-pole-4' });
    wireVcfPoleBtns(pole2, pole4);
    pole4._listeners['click'][0]();
    expect(mockBridge.setParameter).toHaveBeenCalledWith('vcf_pole_mode', 1.0);
  });

  it('VCF Normal polarity', () => {
    var norm = _createFakeEl('div', { id: 'panel-vcf-pol-normal' });
    var inv = _createFakeEl('div', { id: 'panel-vcf-pol-inverted' });
    wireVcfPolBtns(norm, inv);
    norm._listeners['click'][0]();
    expect(mockBridge.setParameter).toHaveBeenCalledWith('vcf_env_polarity', 1.0);
  });

  it('VCF Inverted polarity', () => {
    var norm = _createFakeEl('div', { id: 'panel-vcf-pol-normal' });
    var inv = _createFakeEl('div', { id: 'panel-vcf-pol-inverted' });
    wireVcfPolBtns(norm, inv);
    inv._listeners['click'][0]();
    expect(mockBridge.setParameter).toHaveBeenCalledWith('vcf_env_polarity', 0.0);
  });

  it('VCF LFO Source 1', () => {
    var src1 = _createFakeEl('div', { id: 'panel-vcf-lfosrc-1' });
    var src2 = _createFakeEl('div', { id: 'panel-vcf-lfosrc-2' });
    wireVcfLfoSrcBtns(src1, src2);
    src1._listeners['click'][0]();
    expect(mockBridge.setParameter).toHaveBeenCalledWith('vcf_lfo_select', 0.0);
  });

  it('VCF LFO Source 2', () => {
    var src1 = _createFakeEl('div', { id: 'panel-vcf-lfosrc-1' });
    var src2 = _createFakeEl('div', { id: 'panel-vcf-lfosrc-2' });
    wireVcfLfoSrcBtns(src1, src2);
    src2._listeners['click'][0]();
    expect(mockBridge.setParameter).toHaveBeenCalledWith('vcf_lfo_select', 1.0);
  });

  it('HPF Boost Off', () => {
    var off = _createFakeEl('div', { id: 'panel-hpf-boost-off' });
    var on = _createFakeEl('div', { id: 'panel-hpf-boost-on' });
    wireHpfBoostBtns(off, on);
    off._listeners['click'][0]();
    expect(mockBridge.setParameter).toHaveBeenCalledWith('hpf_boost_enable', 0.0);
  });

  it('HPF Boost On', () => {
    var off = _createFakeEl('div', { id: 'panel-hpf-boost-off' });
    var on = _createFakeEl('div', { id: 'panel-hpf-boost-on' });
    wireHpfBoostBtns(off, on);
    on._listeners['click'][0]();
    expect(mockBridge.setParameter).toHaveBeenCalledWith('hpf_boost_enable', 1.0);
  });

  it('VCA Transparent', () => {
    var trans = _createFakeEl('div', { id: 'panel-vca-mode-transparent' });
    var ballsy = _createFakeEl('div', { id: 'panel-vca-mode-ballsy' });
    wireVcaModeBtns(trans, ballsy);
    trans._listeners['click'][0]();
    expect(mockBridge.setParameter).toHaveBeenCalledWith('vca_mode', 0.0);
  });

  it('VCA Ballsy', () => {
    var trans = _createFakeEl('div', { id: 'panel-vca-mode-transparent' });
    var ballsy = _createFakeEl('div', { id: 'panel-vca-mode-ballsy' });
    wireVcaModeBtns(trans, ballsy);
    ballsy._listeners['click'][0]();
    expect(mockBridge.setParameter).toHaveBeenCalledWith('vca_mode', 1.0);
  });

  it('does not crash with null buttons', () => {
    expect(function() { wireVcfPoleBtns(null, null); }).not.toThrow();
    expect(function() { wireVcfPolBtns(null, null); }).not.toThrow();
    expect(function() { wireVcfLfoSrcBtns(null, null); }).not.toThrow();
    expect(function() { wireHpfBoostBtns(null, null); }).not.toThrow();
    expect(function() { wireVcaModeBtns(null, null); }).not.toThrow();
  });

  it('does not crash without bridge', () => {
    vi.stubGlobal('window', {});
    var pole2 = _createFakeEl('div', { id: 'panel-vcf-pole-2' });
    var pole4 = _createFakeEl('div', { id: 'panel-vcf-pole-4' });
    wireVcfPoleBtns(pole2, pole4);
    expect(function() { pole2._listeners['click'][0](); }).not.toThrow();
  });

  it('calls handleParameterChangeFromBackend', () => {
    var norm = _createFakeEl('div', { id: 'panel-vcf-pol-normal' });
    var inv = _createFakeEl('div', { id: 'panel-vcf-pol-inverted' });
    wireVcfPolBtns(norm, inv);
    norm._listeners['click'][0]();
    expect(mockBridge.handleParameterChangeFromBackend).toHaveBeenCalledWith('vcf_env_polarity', 1.0);
  });
});

// ══════════════════════════════════════════════════════════════════
// SEQ enable box — init and toggle
// ══════════════════════════════════════════════════════════════════

describe('SEQ enable box — init and toggle', () => {
  var mockBridge;
  var seqBox;

  function initSeqEnableBox() {
    if (seqBox) {
      var enVal = window.dualMidiBridge ? window.dualMidiBridge.parameterCache['seq_enable'] : 0;
      seqBox.classList.toggle('active', enVal > 0.5);
      seqBox.addEventListener('click', function() {
        var active = this.classList.contains('active');
        if (window.dualMidiBridge) window.dualMidiBridge.setParameter('seq_enable', active ? 0.0 : 1.0);
      });
    }
  }

  beforeEach(() => {
    seqBox = _createFakeEl('div', { id: 'panel-seq-enable-box' });
    mockBridge = { setParameter: vi.fn(), parameterCache: {} };
    vi.stubGlobal('window', { dualMidiBridge: mockBridge });
  });

  it('active=true when seq_enable=1.0', () => {
    mockBridge.parameterCache['seq_enable'] = 1.0;
    initSeqEnableBox();
    expect(seqBox.classList.contains('active')).toBe(true);
  });

  it('active=false when seq_enable=0.0', () => {
    mockBridge.parameterCache['seq_enable'] = 0.0;
    initSeqEnableBox();
    expect(seqBox.classList.contains('active')).toBe(false);
  });

  it('defaults inactive when cache empty', () => {
    initSeqEnableBox();
    expect(seqBox.classList.contains('active')).toBe(false);
  });

  it('wires click handler', () => {
    initSeqEnableBox();
    expect(seqBox._listeners['click']).toBeDefined();
  });

  it('click when active calls setParameter 0.0', () => {
    mockBridge.parameterCache['seq_enable'] = 1.0;
    initSeqEnableBox();
    seqBox.classList.add('active');
    seqBox._listeners['click'][0].call(seqBox);
    expect(mockBridge.setParameter).toHaveBeenCalledWith('seq_enable', 0.0);
  });

  it('click when inactive calls setParameter 1.0', () => {
    initSeqEnableBox();
    seqBox._listeners['click'][0].call(seqBox);
    expect(mockBridge.setParameter).toHaveBeenCalledWith('seq_enable', 1.0);
  });

  it('does not crash without bridge', () => {
    vi.stubGlobal('window', {});
    expect(function() { initSeqEnableBox(); }).not.toThrow();
  });

  it('does not crash when seqBox null', () => {
    seqBox = null;
    expect(function() { initSeqEnableBox(); }).not.toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════
// Outside click — close panel on document click
// ══════════════════════════════════════════════════════════════════

describe('Outside click — close panel on document click', () => {
  var panelEl;
  var handler;

  function setupOutsideClickHandler() {
    handler = function(e) {
      if (panelEl.classList.contains('active') && e.target && (!panelEl.contains || !panelEl.contains(e.target)) && !e.target.classList.contains('edit-panel-btn')) {
        panelEl.classList.remove('active');
      }
    };
    document.addEventListener('click', handler);
  }

  beforeEach(() => {
    panelEl = _createFakeEl('div', { id: 'detail-edit-panel' });
    vi.stubGlobal('document', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  });

  it('registers click handler on document', () => {
    setupOutsideClickHandler();
    expect(document.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
  });

  it('closes panel when clicking outside', () => {
    panelEl.classList.add('active');
    handler({ target: _createFakeEl('div') });
    expect(panelEl.classList.contains('active')).toBe(false);
  });

  it('does not close when clicking inside panel', () => {
    panelEl.classList.add('active');
    var insideEl = _createFakeEl('div');
    panelEl._children = [insideEl];
    panelEl.contains = function(el) { return el === insideEl || this._children.includes(el); };
    handler({ target: insideEl });
    expect(panelEl.classList.contains('active')).toBe(true);
  });

  it('does not close when clicking edit-panel-btn', () => {
    panelEl.classList.add('active');
    var editBtn = _createFakeEl('button');
    editBtn.classList.add('edit-panel-btn');
    handler({ target: editBtn });
    expect(panelEl.classList.contains('active')).toBe(true);
  });

  it('does nothing when panel not active', () => {
    handler({ target: _createFakeEl('div') });
    expect(panelEl.classList.contains('active')).toBe(false);
  });

  it('does not crash when target null', () => {
    panelEl.classList.add('active');
    expect(function() { handler({ target: null }); }).not.toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════
// Panel titles per mode
// ══════════════════════════════════════════════════════════════════

describe('Panel titles per mode', () => {
  var titleEl;

  function setTitle(mode, activeLfo, activeEnv, activeOsc) {
    if (mode === 'LFO') titleEl.innerText = 'LFO ' + (activeLfo || 1) + ' Editor';
    else if (mode === 'VCA') titleEl.innerText = 'VCA Editor';
    else if (mode === 'ENV') {
      var envName = activeEnv === 1 ? 'VCA' : (activeEnv === 2 ? 'VCF' : 'MOD');
      titleEl.innerText = envName + ' Env Editor';
    } else if (mode === 'HPF') titleEl.innerText = 'HPF Editor';
    else if (mode === 'VCF') titleEl.innerText = 'VCF Filter Editor';
    else if (mode === 'OSC') titleEl.innerText = 'OSC ' + (activeOsc || 1) + ' Editor';
    else if (mode === 'POLY') titleEl.innerText = 'Polyphony & Unison';
    else if (mode === 'PORTA') titleEl.innerText = 'Glide & Voice Settings';
    else if (mode === 'CHORD') titleEl.innerText = 'Chord Memory';
    else if (mode === 'POLY_CHORD') titleEl.innerText = 'Poly Chord';
    else if (mode === 'ARP') titleEl.innerText = 'Arpeggiator Settings';
  }

  beforeEach(() => {
    titleEl = _createFakeEl('h3', { id: 'panel-title' });
  });

  it('LFO 1', () => { setTitle('LFO', 1); expect(titleEl.innerText).toBe('LFO 1 Editor'); });
  it('LFO 2', () => { setTitle('LFO', 2); expect(titleEl.innerText).toBe('LFO 2 Editor'); });
  it('VCA', () => { setTitle('VCA'); expect(titleEl.innerText).toBe('VCA Editor'); });
  it('ENV 1 (VCA)', () => { setTitle('ENV', undefined, 1); expect(titleEl.innerText).toBe('VCA Env Editor'); });
  it('ENV 2 (VCF)', () => { setTitle('ENV', undefined, 2); expect(titleEl.innerText).toBe('VCF Env Editor'); });
  it('ENV 3 (MOD)', () => { setTitle('ENV', undefined, 3); expect(titleEl.innerText).toBe('MOD Env Editor'); });
  it('HPF', () => { setTitle('HPF'); expect(titleEl.innerText).toBe('HPF Editor'); });
  it('VCF', () => { setTitle('VCF'); expect(titleEl.innerText).toBe('VCF Filter Editor'); });
  it('OSC 1', () => { setTitle('OSC', undefined, undefined, 1); expect(titleEl.innerText).toBe('OSC 1 Editor'); });
  it('OSC 2', () => { setTitle('OSC', undefined, undefined, 2); expect(titleEl.innerText).toBe('OSC 2 Editor'); });
  it('POLY', () => { setTitle('POLY'); expect(titleEl.innerText).toBe('Polyphony & Unison'); });
  it('PORTA', () => { setTitle('PORTA'); expect(titleEl.innerText).toBe('Glide & Voice Settings'); });
  it('CHORD', () => { setTitle('CHORD'); expect(titleEl.innerText).toBe('Chord Memory'); });
  it('POLY_CHORD', () => { setTitle('POLY_CHORD'); expect(titleEl.innerText).toBe('Poly Chord'); });
  it('ARP', () => { setTitle('ARP'); expect(titleEl.innerText).toBe('Arpeggiator Settings'); });
});
