/**
 * @purpose Tests for WebUI/js/panel_controls_binder.js
 * @purpose_en Tests for updatePanelFromState() — DOM sync from bridge cache
 *
 * Source: WebUI/js/panel_controls_binder.js
 *   - updatePanelFromState(container): syncs v-sliders, selects, toggle-boxes,
 *     shape-led-rows from dualMidiBridge.parameterCache
 *   - Syncs: slider handle top position, select value, toggle-box active class,
 *     shape-led-row active class, drawPanelGraphic callback
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ══════════════════════════════════════════════════════════════════
// Mock state
// ══════════════════════════════════════════════════════════════════

let _bridge = null;

function _makeBridge(cache) {
  return {
    parameterCache: cache || {},
    setParameter: vi.fn(),
  };
}

// ══════════════════════════════════════════════════════════════════
// Fake DOM element factory (adapted from panelEdit.test.js)
// ══════════════════════════════════════════════════════════════════

function _createFakeEl(tag, attrs) {
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    _attrs: attrs || {},
    _listeners: {},
    value: '',
    textContent: '',
    innerHTML: '',
    checked: false,
    style: {
      _props: {},
      removeProperty(prop) { delete this._props[prop]; },
      get top() { return this._props.top; },
      set top(val) { this._props.top = val; },
      get display() { return this._props.display; },
      set display(val) { this._props.display = val; },
      setProperty(prop, val) { this._props[prop] = val; },
      get height() { return this._props.height; },
      set height(val) { this._props.height = val; },
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
      if (sel && sel.startsWith('[') && sel.endsWith(']')) {
        const attr = sel.slice(1, -1);
        if (this._attrs[attr] !== undefined) return this;
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
    const opt = _createFakeEl('option');
    opt.value = String(i);
    sel.options.push(opt);
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
  const attrs = {};
  if (dataShape !== undefined) attrs['data-shape'] = String(dataShape);
  if (dataTrig !== undefined) attrs['data-trig'] = String(dataTrig);
  if (dataVal !== undefined) attrs['data-val'] = String(dataVal);
  if (paramId !== undefined) attrs['data-param'] = paramId;
  const row = _createFakeEl('div', attrs);
  row.classList.add('shape-led-row');
  return row;
}

/** Create a fake container element that supports querySelectorAll lookups */
function _makeContainer() {
  const cont = _createFakeEl('div', { id: 'panel-dynamic-controls' });
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

  cont.querySelector = function() { return null; };
  return cont;
}

// ══════════════════════════════════════════════════════════════════
// Functions under test (extracted from panel_controls_binder.js)
// ══════════════════════════════════════════════════════════════════

function updatePanelFromState(container) {
  if (!window.dualMidiBridge) return;

  // V-sliders
  container.querySelectorAll('.v-slider').forEach(function(slider) {
    const ctrlUnit = slider.closest('[data-param]');
    if (!ctrlUnit) return;
    const paramId = ctrlUnit.getAttribute('data-param');
    if (!paramId) return;
    const val = window.dualMidiBridge.parameterCache[paramId];
    if (val !== undefined) {
      const handle = slider.querySelector('.handle');
      if (handle) {
        const rect = slider.getBoundingClientRect();
        if (rect.height > 0) {
          const handleHeight = 16;
          const pos = (1.0 - val) * (rect.height - handleHeight);
          handle.style.top = pos + 'px';
        }
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

  // Shape LED rows
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

  // Redraw panel graphic
  if (typeof window.drawPanelGraphic === 'function') {
    window.drawPanelGraphic();
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

  it('positions slider handle from cache val=0 → bottom', () => {
    cache['vcf_cutoff'] = 0.0;
    const sliderUnit = _makeSlider('vcf_cutoff', 100);
    container._vSliders = [sliderUnit.querySelector('.v-slider')];

    updatePanelFromState(container);

    const handle = sliderUnit.querySelector('.v-slider').querySelector('.handle');
    // pos = (1.0 - 0.0) * (100 - 16) = 84
    expect(parseFloat(handle.style.top)).toBeCloseTo(84, 1);
  });

  it('positions slider handle from cache val=0.5 → middle', () => {
    cache['vcf_resonance'] = 0.5;
    const sliderUnit = _makeSlider('vcf_resonance', 100);
    container._vSliders = [sliderUnit.querySelector('.v-slider')];

    updatePanelFromState(container);

    const handle = sliderUnit.querySelector('.v-slider').querySelector('.handle');
    expect(parseFloat(handle.style.top)).toBeCloseTo(42, 1);
  });

  it('positions slider handle from cache val=1.0 → top', () => {
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
    container._vSliders = [slider];

    expect(() => updatePanelFromState(container)).not.toThrow();
  });

  it('handles multiple sliders with different cache values', () => {
    cache['vcf_cutoff'] = 0.25;
    cache['vcf_resonance'] = 0.75;

    const cutoffUnit = _makeSlider('vcf_cutoff', 100);
    const resUnit = _makeSlider('vcf_resonance', 100);
    container._vSliders = [cutoffUnit.querySelector('.v-slider'), resUnit.querySelector('.v-slider')];

    updatePanelFromState(container);

    const handleCut = cutoffUnit.querySelector('.v-slider').querySelector('.handle');
    const handleRes = resUnit.querySelector('.v-slider').querySelector('.handle');
    expect(parseFloat(handleCut.style.top)).toBeCloseTo(63, 1);
    expect(parseFloat(handleRes.style.top)).toBeCloseTo(21, 1);
  });

  it('handles slider with missing .handle gracefully', () => {
    cache['vcf_cutoff'] = 0.5;
    const sliderUnit = _makeSlider('vcf_cutoff', 100);
    sliderUnit.querySelector('.v-slider')._subElements['.handle'] = null;
    container._vSliders = [sliderUnit.querySelector('.v-slider')];

    expect(() => updatePanelFromState(container)).not.toThrow();
  });

  // ── Select dropdowns ──

  it('syncs select dropdown value from cache', () => {
    cache['voice_mode'] = 0.5;
    const sel = _makeSelect('voice_mode', 13);
    container._selects = [sel];

    updatePanelFromState(container);

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

  it('handles vcf_pole_mode at val=0.5: neither toggle activates (strict inequality)', () => {
    cache['vcf_pole_mode'] = 0.5;
    const btnPole2 = _makeToggle('panel-vcf-pole-2', 'vcf_pole_mode');
    const btnPole4 = _makeToggle('panel-vcf-pole-4', 'vcf_pole_mode');
    btnPole2.classList.add('active');
    btnPole4.classList.add('active');
    container._toggles = [btnPole2, btnPole4];

    updatePanelFromState(container);

    expect(btnPole2.classList.contains('active')).toBe(false);
    expect(btnPole4.classList.contains('active')).toBe(false);
  });

  it('handles vca_mode at val=0.5: neither activates', () => {
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

  it('handles generic toggle at val=0.5: inactive', () => {
    cache['osc1_saw_enable'] = 0.5;
    const box = _makeToggle('', 'osc1_saw_enable');
    box.classList.add('active');
    container._toggles = [box];

    updatePanelFromState(container);
    expect(box.classList.contains('active')).toBe(false);
  });

  // ── Shape LED rows ──

  it('highlights correct shape row with maxVal=6 (default)', () => {
    cache['lfo1_shape'] = 3.0 / 6.0;
    const rows = [0,1,2,3,4,5,6].map(i => _makeShapeLedRow(i, undefined, undefined, 'lfo1_shape'));
    container._shapeRows = rows;

    updatePanelFromState(container);

    rows.forEach(function(r, i) { expect(r.classList.contains('active')).toBe(i === 3); });
  });

  it('highlights trigger row with data-trig and maxVal=4', () => {
    cache['env1_trigger_mode'] = 2.0 / 4.0;
    const rows = [0,1,2,3,4].map(i => _makeShapeLedRow(undefined, i, undefined, 'env1_trigger_mode'));
    container._shapeRows = rows;

    updatePanelFromState(container);

    rows.forEach(function(r, i) { expect(r.classList.contains('active')).toBe(i === 2); });
  });

  it('highlights note_priority row with maxVal=2', () => {
    cache['note_priority'] = 1.0 / 2.0;
    const rows = [0,1,2].map(i => _makeShapeLedRow(undefined, undefined, i, 'note_priority'));
    container._shapeRows = rows;

    updatePanelFromState(container);

    rows.forEach(function(r, i) { expect(r.classList.contains('active')).toBe(i === 1); });
  });

  it('highlights trigger_mode row with maxVal=3', () => {
    cache['trigger_mode'] = 3.0 / 3.0;
    const rows = [0,1,2,3].map(i => _makeShapeLedRow(undefined, undefined, i, 'trigger_mode'));
    container._shapeRows = rows;

    updatePanelFromState(container);

    rows.forEach(function(r, i) { expect(r.classList.contains('active')).toBe(i === 3); });
  });

  it('highlights osc1_range row with maxVal=2', () => {
    cache['osc1_range'] = 1.0 / 2.0;
    const rows = [0,1,2].map(i => _makeShapeLedRow(undefined, undefined, i, 'osc1_range'));
    container._shapeRows = rows;

    updatePanelFromState(container);

    rows.forEach(function(r, i) { expect(r.classList.contains('active')).toBe(i === 1); });
  });

  it('highlights osc1_pm_mode row with maxVal=1', () => {
    cache['osc1_pm_mode'] = 0.0;
    const rows = [0,1].map(i => _makeShapeLedRow(undefined, undefined, i, 'osc1_pm_mode'));
    container._shapeRows = rows;

    updatePanelFromState(container);

    rows.forEach(function(r, i) { expect(r.classList.contains('active')).toBe(i === 0); });
  });

  it('highlights chord_key row by class fallback (no data-param)', () => {
    cache['chord_key'] = 5.0 / 11.0;
    const rows = [];
    for (let i = 0; i < 12; i++) {
      const row = _makeShapeLedRow(undefined, undefined, i);
      row.classList.add('chord-key-led-row');
      rows.push(row);
    }
    container._shapeRows = rows;

    updatePanelFromState(container);

    rows.forEach(function(r, i) { expect(r.classList.contains('active')).toBe(i === 5); });
  });

  it('highlights chord_type row by class fallback', () => {
    cache['chord_type'] = 3.0 / 11.0;
    const rows = [];
    for (let i = 0; i < 12; i++) {
      const row = _makeShapeLedRow(undefined, undefined, i);
      row.classList.add('chord-type-led-row');
      rows.push(row);
    }
    container._shapeRows = rows;

    updatePanelFromState(container);

    rows.forEach(function(r, i) { expect(r.classList.contains('active')).toBe(i === 3); });
  });

  it('does nothing for shape row when cache has no entry', () => {
    const row = _makeShapeLedRow(0, undefined, undefined, 'lfo1_shape');
    container._shapeRows = [row];

    updatePanelFromState(container);
    expect(row.classList.contains('active')).toBe(false);
  });

  it('does nothing for shape row when no paramId can be resolved', () => {
    cache['lfo1_shape'] = 0.5;
    const row = _makeShapeLedRow(0, undefined, undefined);
    row.classList.remove('shape-led-row'); // won't be selected anyway
    container._shapeRows = [row];

    updatePanelFromState(container);
    // No crash expected
    expect(true).toBe(true);
  });

  // ── drawPanelGraphic callback ──

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

  it('calls drawPanelGraphic even with empty container', () => {
    updatePanelFromState(container);
    expect(window.drawPanelGraphic).toHaveBeenCalledTimes(1);
  });

  it('does NOT call drawPanelGraphic when there is no bridge (early return)', () => {
    vi.stubGlobal('window', { drawPanelGraphic: vi.fn() });

    updatePanelFromState(container);
    expect(window.drawPanelGraphic).not.toHaveBeenCalled();
  });

  it('does NOT crash when drawPanelGraphic is not defined', () => {
    vi.stubGlobal('window', { dualMidiBridge: _bridge });

    expect(function() { updatePanelFromState(container); }).not.toThrow();
  });

  // ── Edge cases ──

  it('returns early without bridge (no crash)', () => {
    vi.stubGlobal('window', {});
    expect(function() { updatePanelFromState(container); }).not.toThrow();
  });

  it('handles empty container (no sliders/selects/toggles/rows)', () => {
    expect(function() { updatePanelFromState(container); }).not.toThrow();
  });

  it('handles slider with data-param but missing handle', () => {
    cache['vcf_cutoff'] = 0.5;
    const sliderUnit = _makeSlider('vcf_cutoff', 100);
    sliderUnit.querySelector('.v-slider')._subElements['.handle'] = null;
    container._vSliders = [sliderUnit.querySelector('.v-slider')];

    expect(function() { updatePanelFromState(container); }).not.toThrow();
  });
});
