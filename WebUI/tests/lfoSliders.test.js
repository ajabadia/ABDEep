/**
 * Unit tests for LFO / ENV / OSC slider update functions (Vitest version)
 *
 * Run with: npx vitest run WebUI/tests/lfoSliders.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ══════════════════════════════════════════════════════════════════
// Mock state
// ══════════════════════════════════════════════════════════════════

let _parameterCache = {};
const _bridge = { parameterCache: _parameterCache };
let _elementRegistry = {};

function _resetCache() {
  _parameterCache = {};
  _bridge.parameterCache = _parameterCache;
}

function _resetElements() { _elementRegistry = {}; }
function _registerElement(id, el) { _elementRegistry[id] = el; }

function _setupGlobals() {
  const mockDocument = {
    getElementById: (id) => _elementRegistry[id] || null,
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  vi.stubGlobal('document', mockDocument);
  vi.stubGlobal('window', {
    dualMidiBridge: _bridge,
    document: mockDocument,
    updateEnvSlidersFromCurrentPreset,
    updateLfoSlidersFromCurrentPreset,
    updateOscSlidersFromCurrentPreset,
  });
}

// ══════════════════════════════════════════════════════════════════
// Fake DOM factory
// ══════════════════════════════════════════════════════════════════

function _createFakeElement(tag, attrs) {
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    id: (attrs && attrs.id) || '',
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
      setProperty(prop, val) { this._props[prop] = val; },
    },
    dataset: {},
    classList: {
      _classes: [],
      add(c) { if (!this._classes.includes(c)) {this._classes.push(c);} },
      remove(c) { this._classes = this._classes.filter((x) => x !== c); },
      contains(c) { return this._classes.includes(c); },
    },
    clientHeight: 100,
    getAttribute(name) { return this._attrs[name] || null; },
    setAttribute(name, val) { this._attrs[name] = val; },
    addEventListener(event, handler) {
      if (!this._listeners[event]) {this._listeners[event] = [];}
      this._listeners[event].push(handler);
    },
    removeEventListener() {},
    dispatchEvent() {},
    appendChild(child) {
      this._children = this._children || [];
      this._children.push(child);
    },
    _children: [],
    _subElements: {},
    querySelector(sel) { return this._subElements[sel] || null; },
    querySelectorAll(sel) { return this._subElements[sel] ? [this._subElements[sel]] : []; },
    closest() { return null; },
    getBoundingClientRect() {
      return {
        top: 0,
        left: 0,
        width: 40,
        height: this.clientHeight || 100,
        bottom: this.clientHeight || 100,
        right: 40,
      };
    },
  };
  return el;
}

function _makeSliderUnit(id, paramId, height) {
  const container = _createFakeElement('div', { id });
  container.setAttribute('data-param', paramId);
  container.clientHeight = height || 100;
  const slider = _createFakeElement('div');
  slider.classList.add('v-slider');
  slider.clientHeight = height || 100;
  const handle = _createFakeElement('div');
  handle.classList.add('handle');
  slider._subElements['.handle'] = handle;
  container._subElements['.v-slider'] = slider;
  return container;
}

// ══════════════════════════════════════════════════════════════════
// Functions under test (extracted from script.js)
// ══════════════════════════════════════════════════════════════════

function updateSliderPosition(sliderUnit, val) {
  if (!sliderUnit) {return;}
  const handle = sliderUnit.querySelector('.handle');
  if (!handle) {return;}
  const rect = sliderUnit.getBoundingClientRect();
  const height = rect.height > 0 ? rect.height : (sliderUnit.clientHeight > 0 ? sliderUnit.clientHeight : 100);
  const handleHeight = 16;
  const pos = (1.0 - val) * (height - handleHeight);
  handle.style.top = pos + 'px';
}

function updateEnvSlidersFromCurrentPreset() {
  if (!window.dualMidiBridge) {return;}
  const cache = window.dualMidiBridge.parameterCache;
  const ids = ['env-ctrl-attack', 'env-ctrl-decay', 'env-ctrl-sustain', 'env-ctrl-release'];
  ids.forEach(function (id) {
    const el = document.getElementById(id);
    if (!el) {return;}
    const paramId = el.getAttribute('data-param');
    if (!paramId) {return;}
    const val = cache[paramId] !== undefined ? cache[paramId] : 0.0;
    updateSliderPosition(el.querySelector('.v-slider'), val);
  });
}

function updateLfoSlidersFromCurrentPreset() {
  if (!window.dualMidiBridge) {return;}
  const cache = window.dualMidiBridge.parameterCache;
  const ids = ['lfo-ctrl-rate', 'lfo-ctrl-delay'];
  ids.forEach(function (id) {
    const el = document.getElementById(id);
    if (!el) {return;}
    const paramId = el.getAttribute('data-param');
    if (!paramId) {return;}
    const val = cache[paramId] !== undefined ? cache[paramId] : 0.0;
    updateSliderPosition(el.querySelector('.v-slider'), val);
  });
}

function updateOscSlidersFromCurrentPreset() {
  if (!window.dualMidiBridge) {return;}
  const cache = window.dualMidiBridge.parameterCache;
  const ids = ['osc-ctrl-pitchmod', 'osc-ctrl-pwm-tone', 'osc-ctrl-pitch', 'osc-ctrl-level'];
  ids.forEach(function (id) {
    const el = document.getElementById(id);
    if (!el) {return;}
    const paramId = el.getAttribute('data-param');
    if (!paramId) {return;}
    const val = cache[paramId] !== undefined ? cache[paramId] : 0.0;
    updateSliderPosition(el.querySelector('.v-slider'), val);
  });
}

// ══════════════════════════════════════════════════════════════════
// Helper: assert handle style.top
// ══════════════════════════════════════════════════════════════════

function _assertSliderTop(container, expected, tolerance) {
  const slider = container.querySelector('.v-slider') || container;
  const handle = slider.querySelector('.handle');
  const actual = parseFloat(handle.style.top);
  expect(actual).not.toBeNaN();
  expect(actual).toBeCloseTo(expected, tolerance || 1);
}

// ══════════════════════════════════════════════════════════════════
// Tests: updateSliderPosition
// ══════════════════════════════════════════════════════════════════

describe('updateSliderPosition', () => {
  it('val=0 → handle at bottom (top=84)', () => {
    const slider = _createFakeElement('div');
    const handle = _createFakeElement('div');
    handle.classList.add('handle');
    slider._subElements['.handle'] = handle;
    slider.clientHeight = 100;

    updateSliderPosition(slider, 0.0);

    // pos = (1.0 - 0.0) * (100 - 16) = 1.0 * 84 = 84
    _assertSliderTop(slider, 84);
  });

  it('val=0.5 → handle at middle (top=42)', () => {
    const slider = _createFakeElement('div');
    const handle = _createFakeElement('div');
    handle.classList.add('handle');
    slider._subElements['.handle'] = handle;
    slider.clientHeight = 100;

    updateSliderPosition(slider, 0.5);

    _assertSliderTop(slider, 42);
  });

  it('val=1.0 → handle at top (top=0)', () => {
    const slider = _createFakeElement('div');
    const handle = _createFakeElement('div');
    handle.classList.add('handle');
    slider._subElements['.handle'] = handle;
    slider.clientHeight = 100;

    updateSliderPosition(slider, 1.0);

    _assertSliderTop(slider, 0);
  });

  it('val=0.25 → handle at 3/4 from top (top=63)', () => {
    const slider = _createFakeElement('div');
    const handle = _createFakeElement('div');
    handle.classList.add('handle');
    slider._subElements['.handle'] = handle;
    slider.clientHeight = 100;

    updateSliderPosition(slider, 0.25);

    _assertSliderTop(slider, 63);
  });

  it('val=0.75 → handle at 1/4 from top (top=21)', () => {
    const slider = _createFakeElement('div');
    const handle = _createFakeElement('div');
    handle.classList.add('handle');
    slider._subElements['.handle'] = handle;
    slider.clientHeight = 100;

    updateSliderPosition(slider, 0.75);

    _assertSliderTop(slider, 21);
  });

  it('different slider height (80px) → val=0.5 → top=32', () => {
    const slider = _createFakeElement('div');
    const handle = _createFakeElement('div');
    handle.classList.add('handle');
    slider._subElements['.handle'] = handle;
    slider.clientHeight = 80;

    updateSliderPosition(slider, 0.5);

    // pos = 0.5 * (80 - 16) = 0.5 * 64 = 32
    _assertSliderTop(slider, 32);
  });

  it('does nothing when slider is null', () => {
    expect(() => updateSliderPosition(null, 0.5)).not.toThrow();
  });

  it('does nothing when handle is missing', () => {
    const slider = _createFakeElement('div');
    expect(() => updateSliderPosition(slider, 0.5)).not.toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: updateLfoSlidersFromCurrentPreset
// ══════════════════════════════════════════════════════════════════

describe('updateLfoSlidersFromCurrentPreset', () => {
  beforeEach(() => {
    _resetCache();
    _resetElements();
    _setupGlobals();
  });

  it('positions lfo1_rate and lfo1_delay from cache', () => {
    _parameterCache['lfo1_rate'] = 0.75;
    _parameterCache['lfo1_delay'] = 0.25;

    const rateUnit = _makeSliderUnit('lfo-ctrl-rate', 'lfo1_rate', 100);
    const delayUnit = _makeSliderUnit('lfo-ctrl-delay', 'lfo1_delay', 100);
    _registerElement('lfo-ctrl-rate', rateUnit);
    _registerElement('lfo-ctrl-delay', delayUnit);

    updateLfoSlidersFromCurrentPreset();

    // lfo1_rate=0.75 → top = 0.25 * 84 = 21
    _assertSliderTop(rateUnit, 21);
    // lfo1_delay=0.25 → top = 0.75 * 84 = 63
    _assertSliderTop(delayUnit, 63);
  });

  it('defaults to 0 when cache missing', () => {
    const rateUnit = _makeSliderUnit('lfo-ctrl-rate', 'lfo1_rate', 100);
    const delayUnit = _makeSliderUnit('lfo-ctrl-delay', 'lfo1_delay', 100);
    _registerElement('lfo-ctrl-rate', rateUnit);
    _registerElement('lfo-ctrl-delay', delayUnit);

    updateLfoSlidersFromCurrentPreset();

    _assertSliderTop(rateUnit, 84);
    _assertSliderTop(delayUnit, 84);
  });

  it('handles missing elements gracefully', () => {
    expect(() => updateLfoSlidersFromCurrentPreset()).not.toThrow();
  });

  it('returns early when no bridge', () => {
    window.dualMidiBridge = null;
    expect(() => updateLfoSlidersFromCurrentPreset()).not.toThrow();
  });

  it('handles element without data-param', () => {
    const el = _createFakeElement('div', { id: 'lfo-ctrl-rate' });
    _registerElement('lfo-ctrl-rate', el);
    expect(() => updateLfoSlidersFromCurrentPreset()).not.toThrow();
  });

  it('handles element without .v-slider child', () => {
    const el = _createFakeElement('div', { id: 'lfo-ctrl-rate' });
    el.setAttribute('data-param', 'lfo1_rate');
    _registerElement('lfo-ctrl-rate', el);
    expect(() => updateLfoSlidersFromCurrentPreset()).not.toThrow();
  });

  it('LFO2 params when selector is on LFO2', () => {
    _parameterCache['lfo2_rate'] = 0.3;
    _parameterCache['lfo2_delay'] = 0.8;

    const rateUnit = _makeSliderUnit('lfo-ctrl-rate', 'lfo2_rate', 100);
    const delayUnit = _makeSliderUnit('lfo-ctrl-delay', 'lfo2_delay', 100);
    _registerElement('lfo-ctrl-rate', rateUnit);
    _registerElement('lfo-ctrl-delay', delayUnit);

    updateLfoSlidersFromCurrentPreset();

    // lfo2_rate=0.3 → top = 0.7 * 84 = 58.8
    _assertSliderTop(rateUnit, 58.8, 1);
    // lfo2_delay=0.8 → top = 0.2 * 84 = 16.8
    _assertSliderTop(delayUnit, 16.8, 1);
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: updateEnvSlidersFromCurrentPreset
// ══════════════════════════════════════════════════════════════════

describe('updateEnvSlidersFromCurrentPreset', () => {
  beforeEach(() => {
    _resetCache();
    _resetElements();
    _setupGlobals();
  });

  it('positions all 4 envelope sliders from cache', () => {
    _parameterCache['env1_attack'] = 0.1;
    _parameterCache['env1_decay'] = 0.4;
    _parameterCache['env1_sustain'] = 0.7;
    _parameterCache['env1_release'] = 0.9;

    const atkUnit = _makeSliderUnit('env-ctrl-attack', 'env1_attack', 100);
    const dcyUnit = _makeSliderUnit('env-ctrl-decay', 'env1_decay', 100);
    const susUnit = _makeSliderUnit('env-ctrl-sustain', 'env1_sustain', 100);
    const relUnit = _makeSliderUnit('env-ctrl-release', 'env1_release', 100);
    _registerElement('env-ctrl-attack', atkUnit);
    _registerElement('env-ctrl-decay', dcyUnit);
    _registerElement('env-ctrl-sustain', susUnit);
    _registerElement('env-ctrl-release', relUnit);

    updateEnvSlidersFromCurrentPreset();

    _assertSliderTop(atkUnit, 75.6, 1);  // 0.9 * 84
    _assertSliderTop(dcyUnit, 50.4, 1);  // 0.6 * 84
    _assertSliderTop(susUnit, 25.2, 1);  // 0.3 * 84
    _assertSliderTop(relUnit, 8.4, 1);   // 0.1 * 84
  });

  it('defaults to 0 when cache missing', () => {
    const atkUnit = _makeSliderUnit('env-ctrl-attack', 'env1_attack', 100);
    const dcyUnit = _makeSliderUnit('env-ctrl-decay', 'env1_decay', 100);
    const susUnit = _makeSliderUnit('env-ctrl-sustain', 'env1_sustain', 100);
    const relUnit = _makeSliderUnit('env-ctrl-release', 'env1_release', 100);
    _registerElement('env-ctrl-attack', atkUnit);
    _registerElement('env-ctrl-decay', dcyUnit);
    _registerElement('env-ctrl-sustain', susUnit);
    _registerElement('env-ctrl-release', relUnit);

    updateEnvSlidersFromCurrentPreset();

    _assertSliderTop(atkUnit, 84);
    _assertSliderTop(relUnit, 84);
  });

  it('returns early when no bridge', () => {
    window.dualMidiBridge = null;
    expect(() => updateEnvSlidersFromCurrentPreset()).not.toThrow();
  });

  it('handles missing elements gracefully', () => {
    expect(() => updateEnvSlidersFromCurrentPreset()).not.toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: updateOscSlidersFromCurrentPreset
// ══════════════════════════════════════════════════════════════════

describe('updateOscSlidersFromCurrentPreset', () => {
  beforeEach(() => {
    _resetCache();
    _resetElements();
    _setupGlobals();
  });

  it('positions OSC1 sliders from cache', () => {
    _parameterCache['osc1_pitch_mod'] = 0.2;
    _parameterCache['osc1_pwm_amount'] = 0.65;

    const pmUnit = _makeSliderUnit('osc-ctrl-pitchmod', 'osc1_pitch_mod', 100);
    const pwmUnit = _makeSliderUnit('osc-ctrl-pwm-tone', 'osc1_pwm_amount', 100);
    _registerElement('osc-ctrl-pitchmod', pmUnit);
    _registerElement('osc-ctrl-pwm-tone', pwmUnit);

    updateOscSlidersFromCurrentPreset();

    _assertSliderTop(pmUnit, 67.2, 1);  // 0.8 * 84
    _assertSliderTop(pwmUnit, 29.4, 1); // 0.35 * 84
  });

  it('positions OSC2 sliders from cache', () => {
    _parameterCache['osc2_pitch_mod'] = 0.5;
    _parameterCache['osc2_tone_mod'] = 0.3;
    _parameterCache['osc2_pitch'] = 0.4;
    _parameterCache['osc2_level'] = 0.8;

    const pmUnit = _makeSliderUnit('osc-ctrl-pitchmod', 'osc2_pitch_mod', 100);
    const toneUnit = _makeSliderUnit('osc-ctrl-pwm-tone', 'osc2_tone_mod', 100);
    const pitchUnit = _makeSliderUnit('osc-ctrl-pitch', 'osc2_pitch', 100);
    const levelUnit = _makeSliderUnit('osc-ctrl-level', 'osc2_level', 100);
    _registerElement('osc-ctrl-pitchmod', pmUnit);
    _registerElement('osc-ctrl-pwm-tone', toneUnit);
    _registerElement('osc-ctrl-pitch', pitchUnit);
    _registerElement('osc-ctrl-level', levelUnit);

    updateOscSlidersFromCurrentPreset();

    _assertSliderTop(pmUnit, 42);
    _assertSliderTop(toneUnit, 58.8, 1);
    _assertSliderTop(pitchUnit, 50.4, 1);
    _assertSliderTop(levelUnit, 16.8, 1);
  });

  it('defaults to 0 when cache missing', () => {
    const pmUnit = _makeSliderUnit('osc-ctrl-pitchmod', 'osc1_pitch_mod', 100);
    const pwmUnit = _makeSliderUnit('osc-ctrl-pwm-tone', 'osc1_pwm_amount', 100);
    _registerElement('osc-ctrl-pitchmod', pmUnit);
    _registerElement('osc-ctrl-pwm-tone', pwmUnit);

    updateOscSlidersFromCurrentPreset();

    _assertSliderTop(pmUnit, 84);
    _assertSliderTop(pwmUnit, 84);
  });

  it('returns early when no bridge', () => {
    window.dualMidiBridge = null;
    expect(() => updateOscSlidersFromCurrentPreset()).not.toThrow();
  });

  it('handles missing elements gracefully', () => {
    expect(() => updateOscSlidersFromCurrentPreset()).not.toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════
// Integration: LFO selector switch
// ══════════════════════════════════════════════════════════════════

describe('LFO selector switch integration', () => {
  beforeEach(() => {
    _resetCache();
    _resetElements();
    _setupGlobals();
  });

  it('same DOM IDs with different data-param (LFO1→LFO2 toggle)', () => {
    _parameterCache['lfo2_rate'] = 1.0;

    const rateUnit = _makeSliderUnit('lfo-ctrl-rate', 'lfo2_rate', 100);
    _registerElement('lfo-ctrl-rate', rateUnit);

    updateLfoSlidersFromCurrentPreset();

    // lfo2_rate=1.0 → top = 0 * 84 = 0
    _assertSliderTop(rateUnit, 0);
  });
});

// ══════════════════════════════════════════════════════════════════
// Edge cases: updateSliderPosition
// ══════════════════════════════════════════════════════════════════

describe('updateSliderPosition edge cases', () => {
  it('height=0 defaults to clientHeight', () => {
    const slider = _createFakeElement('div');
    const handle = _createFakeElement('div');
    handle.classList.add('handle');
    slider._subElements['.handle'] = handle;
    slider.clientHeight = 60;
    slider.getBoundingClientRect = () => ({ top: 0, left: 0, width: 40, height: 0, bottom: 0, right: 40 });

    updateSliderPosition(slider, 1.0);

    // Falls back to clientHeight=60, pos = 0 * (60-16) = 0
    const handleEl = slider.querySelector('.handle');
    expect(parseFloat(handleEl.style.top)).toBe(0);
  });

  it('extreme values: val > 1 and val < 0 produce unclamped positions', () => {
    const slider = _createFakeElement('div');
    const handle = _createFakeElement('div');
    handle.classList.add('handle');
    slider._subElements['.handle'] = handle;
    slider.clientHeight = 100;

    // val=2.0 → pos = (1-2) * 84 = -84 (above top, no clamping)
    updateSliderPosition(slider, 2.0);
    _assertSliderTop(slider, -84);

    // val=-0.5 → pos = (1-(-0.5)) * 84 = 126 (below bottom, no clamping)
    updateSliderPosition(slider, -0.5);
    _assertSliderTop(slider, 126);
  });
});
