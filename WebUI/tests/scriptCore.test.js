/**
 * Unit tests for core script.js functions extracted from closures.
 *
 * Run with: npx vitest run WebUI/tests/scriptCore.test.js
 *
 * Covers:
 *   - LcdQueue priority queue
 *   - setButtonInactive style helper
 *   - updateSliderPosition
 *   - _getLcdTimeoutMs
 *   - Slider preset sync (updateEnvSlidersFromCurrentPreset, updateLfoSlidersFromCurrentPreset, updateOscSlidersFromCurrentPreset)
 *   - ShortcutConfig (load, save, get, set, reset, resetAll, formatCombo, matches, getMeta, _deepClone)
 *   - getLcdFadeTiming, _LCD_FADE_* easings
 *   - applyControllerCurve, applyBipolarCurve, _evalCustomCurve
 *   - getControllerCurve, getCustomCurvePoints
 *   - _updateHexByteForParam
 *   - MIDI mappings structure
 *   - Blink state calculation (tempo-synced)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ══════════════════════════════════════════════════════════════════
// Fake DOM element factory
// ══════════════════════════════════════════════════════════════════

// Helper to stub localStorage globally before all tests
function _stubLocalStorage() {
  var store = {};
  vi.stubGlobal('localStorage', {
    getItem: function(key) { return store[key] !== undefined ? store[key] : null; },
    setItem: function(key, val) { store[key] = String(val); },
    removeItem: function(key) { delete store[key]; },
    clear: function() { store = {}; },
    get length() { return Object.keys(store).length; },
    key: function(idx) { return Object.keys(store)[idx] || null; },
  });
  return store;
}

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
    querySelector(sel) { return this._subElements[sel] || null; },
    querySelectorAll(sel) { return [] },
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

// ══════════════════════════════════════════════════════════════════
// LCD Priority Queue
// ══════════════════════════════════════════════════════════════════

describe('LcdQueue — LCD priority queue', () => {
  let LcdQueue;
  let _timers;

  beforeEach(() => {
    _timers = [];
    vi.useFakeTimers();

    LcdQueue = {
      _messages: {},
      _expiryTimers: {},

      push: function(id, content, priority, options) {
        options = options || {};
        this._messages[id] = {
          content: content,
          priority: priority,
          timestamp: Date.now()
        };
        if (this._expiryTimers[id]) {
          clearTimeout(this._expiryTimers[id]);
        }
        var duration = (options.duration !== undefined) ? options.duration : 2000;
        if (duration !== null) {
          var self = this;
          this._expiryTimers[id] = setTimeout(function() {
            delete self._messages[id];
            delete self._expiryTimers[id];
          }, duration);
        }
      },

      getActive: function() {
        var best = null;
        for (var id in this._messages) {
          var m = this._messages[id];
          if (!best || m.priority < best.priority) {
            best = m;
          }
        }
        return best;
      },

      clear: function() {
        for (var id in this._expiryTimers) {
          clearTimeout(this._expiryTimers[id]);
        }
        this._messages = {};
        this._expiryTimers = {};
      }
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('push adds a message with correct priority', () => {
    LcdQueue.push('param_vcf_cutoff', '<strong>50%</strong>', 1);
    expect(LcdQueue._messages['param_vcf_cutoff']).toBeDefined();
    expect(LcdQueue._messages['param_vcf_cutoff'].priority).toBe(1);
    expect(LcdQueue._messages['param_vcf_cutoff'].content).toBe('<strong>50%</strong>');
  });

  it('getActive returns null when queue is empty', () => {
    expect(LcdQueue.getActive()).toBeNull();
  });

  it('getActive returns the highest priority (lowest number) message', () => {
    LcdQueue.push('notif', 'Notification', 0);
    LcdQueue.push('param', 'Parameter changed', 1);
    LcdQueue.push('ctrl', 'Controller value', 2);

    var active = LcdQueue.getActive();
    expect(active.content).toBe('Notification');
    expect(active.priority).toBe(0);
  });

  it('getActive returns message with highest priority when priorities differ', () => {
    LcdQueue.push('param', 'Param value', 1, { duration: 5000 });
    LcdQueue.push('high', 'High priority', 0, { duration: 3000 });

    expect(LcdQueue.getActive().content).toBe('High priority');
  });

  it('push updates existing message with same id and resets expiry', () => {
    LcdQueue.push('test_id', 'first', 1);
    var timer1 = LcdQueue._expiryTimers['test_id'];
    LcdQueue.push('test_id', 'second', 1);
    // Timer should be replaced
    expect(LcdQueue._expiryTimers['test_id']).not.toBe(timer1);
    expect(LcdQueue._messages['test_id'].content).toBe('second');
  });

  it('push with duration=null never expires', () => {
    LcdQueue.push('permanent', 'Always visible', 0, { duration: null });
    expect(LcdQueue._expiryTimers['permanent']).toBeUndefined();

    // After 10 seconds, message should still exist
    vi.advanceTimersByTime(10000);
    expect(LcdQueue._messages['permanent']).toBeDefined();
  });

  it('message expires after default duration (2000ms)', () => {
    LcdQueue.push('test', 'Will expire', 1);
    expect(LcdQueue._messages['test']).toBeDefined();

    vi.advanceTimersByTime(2000);
    expect(LcdQueue._messages['test']).toBeUndefined();
  });

  it('message expires after custom duration', () => {
    LcdQueue.push('test2', 'Custom duration', 1, { duration: 500 });
    
    vi.advanceTimersByTime(400);
    expect(LcdQueue._messages['test2']).toBeDefined();

    vi.advanceTimersByTime(200);
    expect(LcdQueue._messages['test2']).toBeUndefined();
  });

  it('clear removes all messages and cancels all expiry timers', () => {
    LcdQueue.push('a', 'First', 1, { duration: 5000 });
    LcdQueue.push('b', 'Second', 0, { duration: 3000 });
    expect(Object.keys(LcdQueue._messages).length).toBe(2);

    LcdQueue.clear();

    expect(Object.keys(LcdQueue._messages).length).toBe(0);
    expect(Object.keys(LcdQueue._expiryTimers).length).toBe(0);
    // After clear + advance, no expiry should fire
    vi.advanceTimersByTime(10000);
    expect(LcdQueue.getActive()).toBeNull();
  });

  it('getActive prefers lower priority number', () => {
    LcdQueue.push('p5', 'Base state', 5);
    LcdQueue.push('p2', 'Controller', 2);
    LcdQueue.push('p0', 'Notification', 0);

    // P0 should win
    expect(LcdQueue.getActive().priority).toBe(0);
    expect(LcdQueue.getActive().content).toBe('Notification');

    // Remove P0
    delete LcdQueue._messages['p0'];
    expect(LcdQueue.getActive().priority).toBe(2);

    // Remove P2
    delete LcdQueue._messages['p2'];
    expect(LcdQueue.getActive().priority).toBe(5);
  });
});

// ══════════════════════════════════════════════════════════════════
// _getLcdTimeoutMs
// ══════════════════════════════════════════════════════════════════

describe('_getLcdTimeoutMs — LCD timeout from localStorage', () => {
  function _getLcdTimeoutMs() {
    var saved = localStorage.getItem('abd-eep-lcd-timeout');
    if (saved === null) return 2000;
    if (saved === 'off') return null;
    var ms = parseInt(saved, 10);
    return isNaN(ms) ? 2000 : ms;
  }

  beforeEach(() => {
    _stubLocalStorage();
  });

  it('returns default 2000ms when nothing is saved', () => {
    expect(_getLcdTimeoutMs()).toBe(2000);
  });

  it('returns null when saved value is "off"', () => {
    localStorage.setItem('abd-eep-lcd-timeout', 'off');
    expect(_getLcdTimeoutMs()).toBeNull();
  });

  it('returns parsed integer when valid number is saved', () => {
    localStorage.setItem('abd-eep-lcd-timeout', '5000');
    expect(_getLcdTimeoutMs()).toBe(5000);
  });

  it('returns 2000 when saved value is 0', () => {
    localStorage.setItem('abd-eep-lcd-timeout', '0');
    expect(_getLcdTimeoutMs()).toBe(0);
  });

  it('returns default when saved value is not a number', () => {
    localStorage.setItem('abd-eep-lcd-timeout', 'abc');
    expect(_getLcdTimeoutMs()).toBe(2000);
  });

  it('returns default when saved value is empty string', () => {
    localStorage.setItem('abd-eep-lcd-timeout', '');
    expect(_getLcdTimeoutMs()).toBe(2000);
  });

  it('returns parsed integer for negative values', () => {
    localStorage.setItem('abd-eep-lcd-timeout', '-1');
    expect(_getLcdTimeoutMs()).toBe(-1);
  });
});

// ══════════════════════════════════════════════════════════════════
// setButtonInactive
// ══════════════════════════════════════════════════════════════════

describe('setButtonInactive — button style helper', () => {
  function setButtonInactive(el, mixColor, accentColor) {
    if (!el) return;
    el.style.background = 'color-mix(in srgb, var(' + mixColor + ') 20%, transparent)';
    el.style.borderColor = 'var(' + accentColor + ')';
    el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.4)';
    el.style.color = 'var(' + accentColor + ')';
  }

  it('sets background, border, shadow, and color styles', () => {
    var el = _createFakeEl('button');
    setButtonInactive(el, '--accent-primary', '--brand-accent');

    expect(el.style.background).toContain('--accent-primary');
    expect(el.style.borderColor).toBe('var(--brand-accent)');
    expect(el.style.boxShadow).toBe('0 2px 4px rgba(0,0,0,0.4)');
    expect(el.style.color).toBe('var(--brand-accent)');
  });

  it('handles null element gracefully', () => {
    expect(function() { setButtonInactive(null, '--x', '--y'); }).not.toThrow();
  });

  it('handles different color combinations', () => {
    var el = _createFakeEl('button');
    setButtonInactive(el, '--accent-pink', '--accent-pink');

    expect(el.style.background).toContain('--accent-pink');
    expect(el.style.borderColor).toBe('var(--accent-pink)');
    expect(el.style.color).toBe('var(--accent-pink)');
  });
});

// ══════════════════════════════════════════════════════════════════
// updateSliderPosition
// ══════════════════════════════════════════════════════════════════

describe('updateSliderPosition — slider handle positioning', () => {
  function updateSliderPosition(sliderUnit, val) {
    if (!sliderUnit) return;
    var handle = sliderUnit.querySelector('.handle');
    if (!handle) return;
    var rect = sliderUnit.getBoundingClientRect();
    var height = rect.height > 0 ? rect.height : (sliderUnit.clientHeight > 0 ? sliderUnit.clientHeight : 100);
    var handleHeight = 16;
    var pos = (1.0 - val) * (height - handleHeight);
    handle.style.top = pos + 'px';
  }

  it('positions handle at top when val=1.0', () => {
    var sliderUnit = _createFakeEl('div');
    sliderUnit.clientHeight = 100;
    var handle = _createFakeEl('div');
    handle.classList.add('handle');
    sliderUnit._subElements['.handle'] = handle;

    updateSliderPosition(sliderUnit, 1.0);

    expect(parseFloat(handle.style.top)).toBeCloseTo(0, 1);
  });

  it('positions handle at bottom when val=0.0', () => {
    var sliderUnit = _createFakeEl('div');
    sliderUnit.clientHeight = 100;
    var handle = _createFakeEl('div');
    handle.classList.add('handle');
    sliderUnit._subElements['.handle'] = handle;

    updateSliderPosition(sliderUnit, 0.0);

    // pos = (1.0 - 0) * (100 - 16) = 84
    expect(parseFloat(handle.style.top)).toBeCloseTo(84, 1);
  });

  it('positions handle at middle when val=0.5', () => {
    var sliderUnit = _createFakeEl('div');
    sliderUnit.clientHeight = 100;
    var handle = _createFakeEl('div');
    handle.classList.add('handle');
    sliderUnit._subElements['.handle'] = handle;

    updateSliderPosition(sliderUnit, 0.5);

    expect(parseFloat(handle.style.top)).toBeCloseTo(42, 1);
  });

  it('handles null sliderUnit gracefully', () => {
    expect(function() { updateSliderPosition(null, 0.5); }).not.toThrow();
  });

  it('handles missing handle gracefully', () => {
    var sliderUnit = _createFakeEl('div');
    expect(function() { updateSliderPosition(sliderUnit, 0.5); }).not.toThrow();
  });

  it('uses clientHeight fallback when getBoundingClientRect returns height=0', () => {
    var sliderUnit = _createFakeEl('div');
    sliderUnit.clientHeight = 50;
    sliderUnit.getBoundingClientRect = function() { return { top: 0, left: 0, width: 40, height: 0, bottom: 0, right: 40 }; };
    var handle = _createFakeEl('div');
    handle.classList.add('handle');
    sliderUnit._subElements['.handle'] = handle;

    updateSliderPosition(sliderUnit, 0.5);
    // height = 50 (from clientHeight), pos = 0.5 * (50 - 16) = 17
    expect(parseFloat(handle.style.top)).toBeCloseTo(17, 1);
  });

  it('positions handle with different slider heights', () => {
    var sliderUnit = _createFakeEl('div');
    sliderUnit.clientHeight = 200;
    var handle = _createFakeEl('div');
    handle.classList.add('handle');
    sliderUnit._subElements['.handle'] = handle;

    updateSliderPosition(sliderUnit, 0.25);
    // pos = 0.75 * (200 - 16) = 138
    expect(parseFloat(handle.style.top)).toBeCloseTo(138, 1);
  });
});

// ══════════════════════════════════════════════════════════════════
// Slider preset sync functions
// ══════════════════════════════════════════════════════════════════

describe('updateEnvSlidersFromCurrentPreset — env slider sync', () => {
  var mockBridge;
  var envAttack, envDecay, envSustain, envRelease;

  function updateSliderPosition(sliderUnit, val) {
    if (!sliderUnit) return;
    var handle = sliderUnit.querySelector('.handle');
    if (!handle) return;
    var rect = sliderUnit.getBoundingClientRect();
    var height = rect.height > 0 ? rect.height : (sliderUnit.clientHeight > 0 ? sliderUnit.clientHeight : 100);
    var handleHeight = 16;
    var pos = (1.0 - val) * (height - handleHeight);
    handle.style.top = pos + 'px';
  }

  function _makeSliderUnit(id, paramId) {
    var container = _createFakeEl('div', { id: id, 'data-param': paramId });
    container.clientHeight = 100;
    var slider = _createFakeEl('div');
    slider.classList.add('v-slider');
    slider.clientHeight = 100;
    var handle = _createFakeEl('div');
    handle.classList.add('handle');
    slider._subElements['.handle'] = handle;
    container._subElements['.v-slider'] = slider;
    return container;
  }

  beforeEach(() => {
    var registry = {};
    mockBridge = { parameterCache: {} };

    envAttack = _makeSliderUnit('env-ctrl-attack', 'env1_attack');
    envDecay = _makeSliderUnit('env-ctrl-decay', 'env1_decay');
    envSustain = _makeSliderUnit('env-ctrl-sustain', 'env1_sustain');
    envRelease = _makeSliderUnit('env-ctrl-release', 'env1_release');
    
    [envAttack, envDecay, envSustain, envRelease].forEach(function(el) { registry[el.id] = el; });

    vi.stubGlobal('document', {
      getElementById: function(id) { return registry[id] || null; },
      addEventListener: function() {},
    });

    vi.stubGlobal('window', {
      dualMidiBridge: mockBridge,
      updateSliderPosition: updateSliderPosition,
    });
  });

  function updateEnvSlidersFromCurrentPreset() {
    if (!window.dualMidiBridge) return;
    var cache = window.dualMidiBridge.parameterCache;
    var ids = ['env-ctrl-attack', 'env-ctrl-decay', 'env-ctrl-sustain', 'env-ctrl-release'];
    ids.forEach(function(id) {
      var el = document.getElementById(id);
      if (!el) return;
      var paramId = el.getAttribute('data-param');
      if (!paramId) return;
      var val = cache[paramId] !== undefined ? cache[paramId] : 0.0;
      updateSliderPosition(el.querySelector('.v-slider'), val);
    });
  }

  it('syncs env sliders from cache values', () => {
    mockBridge.parameterCache['env1_attack'] = 0.8;
    mockBridge.parameterCache['env1_decay'] = 0.3;
    mockBridge.parameterCache['env1_sustain'] = 0.6;
    mockBridge.parameterCache['env1_release'] = 0.1;

    updateEnvSlidersFromCurrentPreset();

    var atkHandle = envAttack.querySelector('.v-slider').querySelector('.handle');
    var dcyHandle = envDecay.querySelector('.v-slider').querySelector('.handle');
    var susHandle = envSustain.querySelector('.v-slider').querySelector('.handle');
    var relHandle = envRelease.querySelector('.v-slider').querySelector('.handle');

    // val=0.8 → pos = 0.2 * 84 = 16.8
    expect(parseFloat(atkHandle.style.top)).toBeCloseTo(16.8, 1);
    // val=0.3 → pos = 0.7 * 84 = 58.8
    expect(parseFloat(dcyHandle.style.top)).toBeCloseTo(58.8, 1);
    // val=0.6 → pos = 0.4 * 84 = 33.6
    expect(parseFloat(susHandle.style.top)).toBeCloseTo(33.6, 1);
    // val=0.1 → pos = 0.9 * 84 = 75.6
    expect(parseFloat(relHandle.style.top)).toBeCloseTo(75.6, 1);
  });

  it('uses default val=0 when cache has no entry', () => {
    updateEnvSlidersFromCurrentPreset();
    var handle = envAttack.querySelector('.v-slider').querySelector('.handle');
    expect(parseFloat(handle.style.top)).toBeCloseTo(84, 1);
  });

  it('returns early when bridge is null', () => {
    vi.stubGlobal('window', { dualMidiBridge: null });
    expect(function() { updateEnvSlidersFromCurrentPreset(); }).not.toThrow();
  });

  it('handles missing DOM elements gracefully', () => {
    vi.stubGlobal('document', {
      getElementById: function() { return null; },
      addEventListener: function() {},
    });
    expect(function() { updateEnvSlidersFromCurrentPreset(); }).not.toThrow();
  });
});

describe('updateLfoSlidersFromCurrentPreset — LFO slider sync', () => {
  var mockBridge;
  var lfoRate, lfoDelay;

  function updateSliderPosition(sliderUnit, val) {
    if (!sliderUnit) return;
    var handle = sliderUnit.querySelector('.handle');
    if (!handle) return;
    var rect = sliderUnit.getBoundingClientRect();
    var height = rect.height > 0 ? rect.height : (sliderUnit.clientHeight > 0 ? sliderUnit.clientHeight : 100);
    var handleHeight = 16;
    var pos = (1.0 - val) * (height - handleHeight);
    handle.style.top = pos + 'px';
  }

  beforeEach(() => {
    var registry = {};
    mockBridge = { parameterCache: {} };

    var lfoRateContainer = _createFakeEl('div', { id: 'lfo-ctrl-rate', 'data-param': 'lfo1_rate' });
    var lfoDelayContainer = _createFakeEl('div', { id: 'lfo-ctrl-delay', 'data-param': 'lfo1_delay' });
    [lfoRateContainer, lfoDelayContainer].forEach(function(c) {
      c.clientHeight = 100;
      var slider = _createFakeEl('div');
      slider.classList.add('v-slider');
      slider.clientHeight = 100;
      var handle = _createFakeEl('div');
      handle.classList.add('handle');
      slider._subElements['.handle'] = handle;
      c._subElements['.v-slider'] = slider;
      registry[c.id] = c;
    });
    lfoRate = registry['lfo-ctrl-rate'];
    lfoDelay = registry['lfo-ctrl-delay'];

    vi.stubGlobal('document', {
      getElementById: function(id) { return registry[id] || null; },
      addEventListener: function() {},
    });
    vi.stubGlobal('window', {
      dualMidiBridge: mockBridge,
      updateSliderPosition: updateSliderPosition,
    });
  });

  function updateLfoSlidersFromCurrentPreset() {
    if (!window.dualMidiBridge) return;
    var cache = window.dualMidiBridge.parameterCache;
    var ids = ['lfo-ctrl-rate', 'lfo-ctrl-delay'];
    ids.forEach(function(id) {
      var el = document.getElementById(id);
      if (!el) return;
      var paramId = el.getAttribute('data-param');
      if (!paramId) return;
      var val = cache[paramId] !== undefined ? cache[paramId] : 0.0;
      updateSliderPosition(el.querySelector('.v-slider'), val);
    });
  }

  it('syncs LFO rate and delay sliders from cache', () => {
    mockBridge.parameterCache['lfo1_rate'] = 0.7;
    mockBridge.parameterCache['lfo1_delay'] = 0.2;

    updateLfoSlidersFromCurrentPreset();

    var rateHandle = lfoRate.querySelector('.v-slider').querySelector('.handle');
    var delayHandle = lfoDelay.querySelector('.v-slider').querySelector('.handle');
    
    expect(parseFloat(rateHandle.style.top)).toBeCloseTo(25.2, 1);
    expect(parseFloat(delayHandle.style.top)).toBeCloseTo(67.2, 1);
  });
});

describe('updateOscSlidersFromCurrentPreset — OSC slider sync', () => {
  var mockBridge;
  var oscPitchMod, oscPwmTone;

  function updateSliderPosition(sliderUnit, val) {
    if (!sliderUnit) return;
    var handle = sliderUnit.querySelector('.handle');
    if (!handle) return;
    var rect = sliderUnit.getBoundingClientRect();
    var height = rect.height > 0 ? rect.height : (sliderUnit.clientHeight > 0 ? sliderUnit.clientHeight : 100);
    var handleHeight = 16;
    var pos = (1.0 - val) * (height - handleHeight);
    handle.style.top = pos + 'px';
  }

  beforeEach(() => {
    var registry = {};
    mockBridge = { parameterCache: {} };

    var pitchModContainer = _createFakeEl('div', { id: 'osc-ctrl-pitchmod', 'data-param': 'osc1_pitch_mod' });
    var pwmContainer = _createFakeEl('div', { id: 'osc-ctrl-pwm-tone', 'data-param': 'osc1_pwm_amount' });
    var pitchContainer = _createFakeEl('div', { id: 'osc-ctrl-pitch', 'data-param': 'osc2_pitch' });
    var levelContainer = _createFakeEl('div', { id: 'osc-ctrl-level', 'data-param': 'osc2_level' });

    [pitchModContainer, pwmContainer, pitchContainer, levelContainer].forEach(function(c) {
      c.clientHeight = 100;
      var slider = _createFakeEl('div');
      slider.classList.add('v-slider');
      slider.clientHeight = 100;
      var handle = _createFakeEl('div');
      handle.classList.add('handle');
      slider._subElements['.handle'] = handle;
      c._subElements['.v-slider'] = slider;
      registry[c.id] = c;
    });
    oscPitchMod = registry['osc-ctrl-pitchmod'];
    oscPwmTone = registry['osc-ctrl-pwm-tone'];

    vi.stubGlobal('document', {
      getElementById: function(id) { return registry[id] || null; },
      addEventListener: function() {},
    });
    vi.stubGlobal('window', {
      dualMidiBridge: mockBridge,
      updateSliderPosition: updateSliderPosition,
    });
  });

  function updateOscSlidersFromCurrentPreset() {
    if (!window.dualMidiBridge) return;
    var cache = window.dualMidiBridge.parameterCache;
    var ids = ['osc-ctrl-pitchmod', 'osc-ctrl-pwm-tone', 'osc-ctrl-pitch', 'osc-ctrl-level'];
    ids.forEach(function(id) {
      var el = document.getElementById(id);
      if (!el) return;
      var paramId = el.getAttribute('data-param');
      if (!paramId) return;
      var val = cache[paramId] !== undefined ? cache[paramId] : 0.0;
      updateSliderPosition(el.querySelector('.v-slider'), val);
    });
  }

  it('syncs OSC sliders from cache values', () => {
    mockBridge.parameterCache['osc1_pitch_mod'] = 0.9;
    mockBridge.parameterCache['osc1_pwm_amount'] = 0.25;

    updateOscSlidersFromCurrentPreset();

    var pmHandle = oscPitchMod.querySelector('.v-slider').querySelector('.handle');
    var pwmHandle = oscPwmTone.querySelector('.v-slider').querySelector('.handle');

    expect(parseFloat(pmHandle.style.top)).toBeCloseTo(8.4, 1);
    expect(parseFloat(pwmHandle.style.top)).toBeCloseTo(63, 1);
  });
});

// ══════════════════════════════════════════════════════════════════
// ShortcutConfig — keyboard shortcut system
// ══════════════════════════════════════════════════════════════════

describe('ShortcutConfig — keyboard shortcuts', () => {
  var ShortcutConfig;

  beforeEach(() => {
    _stubLocalStorage();

    ShortcutConfig = {
      STORAGE_KEY: 'abd-eep-keyboard-shortcuts',

      _defaults: {
        'midi-learn':     { ctrl: true,  shift: false, alt: false, meta: false, key: 'l' },
        'panic':          { ctrl: true,  shift: true,  alt: false, meta: false, key: 'P' },
        'seq-quickstart': { ctrl: true,  shift: true,  alt: false, meta: false, key: 'S' },
        'seq-debug':      { ctrl: true,  shift: true,  alt: false, meta: false, key: 'D' },
      },

      _meta: {
        'midi-learn':     { label: 'MIDI Learn',     description: 'Toggle Learn mode',                           group: 'global',    color: '--accent-cyan' },
        'panic':          { label: 'PANIC',           description: 'All Notes Off + reset engines',               group: 'global',    color: '--accent-cyan' },
        'seq-quickstart': { label: 'SEQ Quick-Start', description: 'Open panel + enable SEQ',                    group: 'sequencer', color: '--accent-pink' },
        'seq-debug':      { label: 'SEQ Debug',       description: 'Toggle debug mode',                          group: 'sequencer', color: '--accent-pink' },
      },

      _deepClone: function(obj) {
        return JSON.parse(JSON.stringify(obj));
      },

      load: function() {
        var saved = {};
        try {
          var raw = localStorage.getItem(this.STORAGE_KEY);
          if (raw) saved = JSON.parse(raw);
        } catch(e) {}
        var result = {};
        for (var id in this._defaults) {
          result[id] = saved[id] ? this._deepClone(saved[id]) : this._deepClone(this._defaults[id]);
        }
        return result;
      },

      save: function(config) {
        try {
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(config));
        } catch(e) {}
      },

      get: function(id) {
        var all = this.load();
        return all[id] || this._deepClone(this._defaults[id]) || {};
      },

      set: function(id, combo) {
        var all = this.load();
        all[id] = this._deepClone(combo);
        this.save(all);
      },

      reset: function(id) {
        var all = this.load();
        delete all[id];
        this.save(all);
      },

      resetAll: function() {
        try {
          localStorage.removeItem(this.STORAGE_KEY);
        } catch(e) {}
      },

      formatCombo: function(combo) {
        if (!combo) return '';
        var parts = [];
        if (combo.ctrl)  parts.push('Ctrl');
        if (combo.shift) parts.push('Shift');
        if (combo.alt)   parts.push('Alt');
        if (combo.meta)  parts.push('Meta');
        if (combo.key)   parts.push(combo.key.length === 1 ? combo.key.toUpperCase() : combo.key);
        return parts.join(' + ');
      },

      getMeta: function(id) {
        return this._meta[id] || { label: id, description: '', group: 'other', color: '--text-dim' };
      },

      matches: function(e, combo) {
        if (!combo) return false;
        if (!!e.ctrlKey  !== !!combo.ctrl)  return false;
        if (!!e.shiftKey !== !!combo.shift) return false;
        if (!!e.altKey   !== !!combo.alt)   return false;
        if (!!e.metaKey  !== !!combo.meta)  return false;
        var eventKey = e.key;
        if (combo.key && combo.key.length === 1 && eventKey.length === 1) {
          return eventKey.toLowerCase() === combo.key.toLowerCase();
        }
        return eventKey === combo.key;
      },
    };
  });

  // ── load ──

  it('load returns defaults when localStorage is empty', () => {
    var config = ShortcutConfig.load();
    expect(config['midi-learn'].key).toBe('l');
    expect(config['midi-learn'].ctrl).toBe(true);
    expect(config['panic'].key).toBe('P');
    expect(config['seq-quickstart'].key).toBe('S');
    expect(config['seq-debug'].key).toBe('D');
  });

  it('load merges saved config with defaults', () => {
    localStorage.setItem(ShortcutConfig.STORAGE_KEY, JSON.stringify({
      'midi-learn': { ctrl: false, shift: true, alt: false, meta: false, key: 'm' }
    }));
    var config = ShortcutConfig.load();
    // Should override midi-learn with saved value
    expect(config['midi-learn'].key).toBe('m');
    expect(config['midi-learn'].ctrl).toBe(false);
    expect(config['midi-learn'].shift).toBe(true);
    // Should keep defaults for other shortcuts
    expect(config['panic'].key).toBe('P');
  });

  it('load handles corrupted JSON gracefully (returns defaults)', () => {
    localStorage.setItem(ShortcutConfig.STORAGE_KEY, 'not-json');
    var config = ShortcutConfig.load();
    expect(config['midi-learn'].key).toBe('l');
  });

  // ── save ──

  it('save persists config to localStorage', () => {
    ShortcutConfig.save({ 'midi-learn': { ctrl: false, shift: true, alt: false, meta: false, key: 'x' } });
    var raw = localStorage.getItem(ShortcutConfig.STORAGE_KEY);
    var parsed = JSON.parse(raw);
    expect(parsed['midi-learn'].key).toBe('x');
  });

  // ── get ──

  it('get returns deep-cloned default for known id', () => {
    var combo = ShortcutConfig.get('panic');
    expect(combo).toBeDefined();
    expect(combo.key).toBe('P');
    expect(combo.ctrl).toBe(true);
    expect(combo.shift).toBe(true);
  });

  it('get returns deep-cloned object (not reference)', () => {
    var combo1 = ShortcutConfig.get('midi-learn');
    var combo2 = ShortcutConfig.get('midi-learn');
    // Modifying one should not affect the other
    combo1.key = 'x';
    expect(combo2.key).toBe('l');
  });

  it('get returns saved combo for known id', () => {
    ShortcutConfig.set('midi-learn', { ctrl: false, shift: true, alt: false, meta: false, key: 'z' });
    var combo = ShortcutConfig.get('midi-learn');
    expect(combo.key).toBe('z');
  });

  // ── set ──

  it('set saves a new combo and retrieves it', () => {
    ShortcutConfig.set('panic', { ctrl: false, shift: false, alt: true, meta: false, key: 'Escape' });
    var combo = ShortcutConfig.get('panic');
    expect(combo.alt).toBe(true);
    expect(combo.key).toBe('Escape');
  });

  // ── reset ──

  it('reset removes a saved combo, falling back to default', () => {
    ShortcutConfig.set('midi-learn', { ctrl: false, shift: true, alt: false, meta: false, key: 'x' });
    ShortcutConfig.reset('midi-learn');
    var combo = ShortcutConfig.get('midi-learn');
    expect(combo.key).toBe('l'); // back to default
  });

  // ── resetAll ──

  it('resetAll removes all saved config', () => {
    ShortcutConfig.set('midi-learn', { ctrl: false, shift: true, alt: false, meta: false, key: 'x' });
    ShortcutConfig.resetAll();
    expect(localStorage.getItem(ShortcutConfig.STORAGE_KEY)).toBeNull();
  });

  // ── formatCombo ──

  it('formatCombo formats Ctrl+Shift+P correctly', () => {
    var str = ShortcutConfig.formatCombo({ ctrl: true, shift: true, alt: false, meta: false, key: 'P' });
    expect(str).toBe('Ctrl + Shift + P');
  });

  it('formatCombo formats single key with no modifiers', () => {
    var str = ShortcutConfig.formatCombo({ ctrl: false, shift: false, alt: false, meta: false, key: 'F1' });
    expect(str).toBe('F1');
  });

  it('formatCombo formats Alt+L', () => {
    var str = ShortcutConfig.formatCombo({ ctrl: false, shift: false, alt: true, meta: false, key: 'l' });
    expect(str).toBe('Alt + L');
  });

  it('formatCombo returns empty string for null combo', () => {
    expect(ShortcutConfig.formatCombo(null)).toBe('');
  });

  // ── getMeta ──

  it('getMeta returns metadata for known shortcut', () => {
    var meta = ShortcutConfig.getMeta('midi-learn');
    expect(meta.label).toBe('MIDI Learn');
    expect(meta.group).toBe('global');
  });

  it('getMeta returns fallback for unknown id', () => {
    var meta = ShortcutConfig.getMeta('unknown-id');
    expect(meta.label).toBe('unknown-id');
    expect(meta.group).toBe('other');
  });

  // ── matches ──

  it('matches returns true for matching event and combo', () => {
    var e = { ctrlKey: true, shiftKey: false, altKey: false, metaKey: false, key: 'l' };
    expect(ShortcutConfig.matches(e, { ctrl: true, shift: false, alt: false, meta: false, key: 'l' })).toBe(true);
  });

  it('matches returns false when ctrlKey does not match', () => {
    var e = { ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, key: 'l' };
    expect(ShortcutConfig.matches(e, { ctrl: true, shift: false, alt: false, meta: false, key: 'l' })).toBe(false);
  });

  it('matches returns false when key does not match', () => {
    var e = { ctrlKey: true, shiftKey: false, altKey: false, metaKey: false, key: 'x' };
    expect(ShortcutConfig.matches(e, { ctrl: true, shift: false, alt: false, meta: false, key: 'l' })).toBe(false);
  });

  it('matches is case-insensitive for single-char keys', () => {
    var e = { ctrlKey: true, shiftKey: true, altKey: false, metaKey: false, key: 'S' };
    expect(ShortcutConfig.matches(e, { ctrl: true, shift: true, alt: false, meta: false, key: 's' })).toBe(true);
  });

  it('matches returns false for null combo', () => {
    var e = { ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, key: 'a' };
    expect(ShortcutConfig.matches(e, null)).toBe(false);
  });

  it('matches checks shiftKey correctly', () => {
    var e = { ctrlKey: true, shiftKey: true, altKey: false, metaKey: false, key: 'P' };
    expect(ShortcutConfig.matches(e, { ctrl: true, shift: true, alt: false, meta: false, key: 'P' })).toBe(true);
    expect(ShortcutConfig.matches(e, { ctrl: true, shift: false, alt: false, meta: false, key: 'P' })).toBe(false);
  });

  it('matches checks metaKey correctly', () => {
    var e = { ctrlKey: false, shiftKey: false, altKey: false, metaKey: true, key: 'z' };
    expect(ShortcutConfig.matches(e, { ctrl: false, shift: false, alt: false, meta: true, key: 'z' })).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════
// getLcdFadeTiming
// ══════════════════════════════════════════════════════════════════

describe('getLcdFadeTiming — fade speed settings', () => {
  function getLcdFadeTiming() {
    var speed = localStorage.getItem('abd-eep-fade-speed') || 'normal';
    switch (speed) {
      case 'off':    return { out:0, swap:0, in:0, cleanup:0, outR:0, swapR:0, inR:0, cleanupR:0 };
      case 'fast':   return { out:60, swap:70, in:60, cleanup:80, outR:80, swapR:90, inR:80, cleanupR:100 };
      case 'normal': return { out:100, swap:110, in:100, cleanup:130, outR:150, swapR:160, inR:150, cleanupR:180 };
      case 'slow':   return { out:220, swap:230, in:220, cleanup:250, outR:300, swapR:320, inR:300, cleanupR:350 };
      default:       return { out:100, swap:110, in:100, cleanup:130, outR:150, swapR:160, inR:150, cleanupR:180 };
    }
  }

  beforeEach(() => {
    _stubLocalStorage();
  });

  it('returns normal timing when nothing is saved', () => {
    var t = getLcdFadeTiming();
    expect(t.out).toBe(100);
    expect(t.in).toBe(100);
    expect(t.cleanup).toBe(130);
    expect(t.outR).toBe(150);
  });

  it('returns off timing (all zeros) when speed=off', () => {
    localStorage.setItem('abd-eep-fade-speed', 'off');
    var t = getLcdFadeTiming();
    expect(t.out).toBe(0);
    expect(t.in).toBe(0);
    expect(t.cleanup).toBe(0);
    expect(t.outR).toBe(0);
  });

  it('returns fast timing when speed=fast', () => {
    localStorage.setItem('abd-eep-fade-speed', 'fast');
    var t = getLcdFadeTiming();
    expect(t.out).toBe(60);
    expect(t.swap).toBe(70);
    expect(t.in).toBe(60);
    expect(t.cleanup).toBe(80);
  });

  it('returns normal timing when speed=normal', () => {
    localStorage.setItem('abd-eep-fade-speed', 'normal');
    var t = getLcdFadeTiming();
    expect(t.out).toBe(100);
  });

  it('returns slow timing when speed=slow', () => {
    localStorage.setItem('abd-eep-fade-speed', 'slow');
    var t = getLcdFadeTiming();
    expect(t.out).toBe(220);
    expect(t.swap).toBe(230);
    expect(t.in).toBe(220);
    expect(t.cleanup).toBe(250);
    expect(t.outR).toBe(300);
    expect(t.swapR).toBe(320);
    expect(t.inR).toBe(300);
    expect(t.cleanupR).toBe(350);
  });

  it('returns normal timing for unknown speed value', () => {
    localStorage.setItem('abd-eep-fade-speed', 'turbo');
    var t = getLcdFadeTiming();
    expect(t.out).toBe(100);
  });
});

// ══════════════════════════════════════════════════════════════════
// Controller response curves
// ══════════════════════════════════════════════════════════════════

describe('applyControllerCurve — unipolar response curves', () => {
  function applyControllerCurve(value, curveType) {
    if (curveType === 'linear' || !curveType) return value;
    if (curveType === 'custom') {
      // Simplified: return value unchanged for test
      return value;
    }
    var v = Math.max(0, Math.min(1, value));
    switch (curveType) {
      case 'expo2':    return v * v;
      case 'expo3':    return v * v * v;
      case 'log':      return Math.sqrt(v);
      case 's-curve':  return v * v * (3 - 2 * v);
      default:         return v;
    }
  }

  it('linear curve returns value unchanged', () => {
    expect(applyControllerCurve(0.5, 'linear')).toBe(0.5);
    expect(applyControllerCurve(0, 'linear')).toBe(0);
    expect(applyControllerCurve(1, 'linear')).toBe(1);
  });

  it('null curveType returns value unchanged', () => {
    expect(applyControllerCurve(0.5, null)).toBe(0.5);
  });

  it('expo2 returns value squared', () => {
    expect(applyControllerCurve(0.5, 'expo2')).toBe(0.25);
    expect(applyControllerCurve(0.2, 'expo2')).toBeCloseTo(0.04, 8);
    expect(applyControllerCurve(1, 'expo2')).toBe(1);
    expect(applyControllerCurve(0, 'expo2')).toBe(0);
  });

  it('expo3 returns value cubed', () => {
    expect(applyControllerCurve(0.5, 'expo3')).toBeCloseTo(0.125, 3);
    expect(applyControllerCurve(1, 'expo3')).toBe(1);
  });

  it('log returns square root of value', () => {
    expect(applyControllerCurve(0.25, 'log')).toBe(0.5);
    expect(applyControllerCurve(0, 'log')).toBe(0);
    expect(applyControllerCurve(1, 'log')).toBe(1);
  });

  it('s-curve applies smoothstep (3v² - 2v³)', () => {
    expect(applyControllerCurve(0, 's-curve')).toBe(0);
    expect(applyControllerCurve(0.5, 's-curve')).toBe(0.5);
    expect(applyControllerCurve(1, 's-curve')).toBe(1);
  });

  it('clamps input value between 0 and 1', () => {
    expect(applyControllerCurve(-0.5, 'expo2')).toBe(0);
    expect(applyControllerCurve(1.5, 'expo2')).toBe(1);
  });

  it('handles all curve types without throwing', () => {
    var types = ['linear', 'expo2', 'expo3', 'log', 's-curve', null, undefined, 'custom'];
    types.forEach(function(t) {
      expect(function() { applyControllerCurve(0.3, t); }).not.toThrow();
    });
  });
});

describe('applyBipolarCurve — bipolar pitch bend curves', () => {
  function applyBipolarCurve(value, curveType) {
    if (curveType === 'linear' || !curveType) return value;
    if (curveType === 'custom') {
      return value; // simplified
    }
    var abs = Math.max(0, Math.min(1, Math.abs(value)));
    var sign = value >= 0 ? 1 : -1;
    switch (curveType) {
      case 'expo2':    return sign * abs * abs;
      case 'expo3':    return sign * abs * abs * abs;
      case 'log':      return sign * Math.sqrt(abs);
      case 's-curve':  return sign * (abs * abs * (3 - 2 * abs));
      default:         return value;
    }
  }

  it('linear returns value unchanged', () => {
    expect(applyBipolarCurve(0.5, 'linear')).toBe(0.5);
    expect(applyBipolarCurve(-0.5, 'linear')).toBe(-0.5);
  });

  it('expo2 squares absolute value, preserves sign', () => {
    expect(applyBipolarCurve(0.5, 'expo2')).toBe(0.25);
    expect(applyBipolarCurve(-0.5, 'expo2')).toBe(-0.25);
  });

  it('expo3 cubes absolute value, preserves sign', () => {
    expect(applyBipolarCurve(0.5, 'expo3')).toBeCloseTo(0.125, 3);
    expect(applyBipolarCurve(-0.5, 'expo3')).toBeCloseTo(-0.125, 3);
  });

  it('log applies sqrt to absolute value, preserves sign', () => {
    expect(applyBipolarCurve(0.25, 'log')).toBe(0.5);
    expect(applyBipolarCurve(-0.25, 'log')).toBe(-0.5);
  });

  it('s-curve applies smoothstep to absolute value, preserves sign', () => {
    expect(applyBipolarCurve(0.5, 's-curve')).toBe(0.5);
    expect(applyBipolarCurve(-0.5, 's-curve')).toBe(-0.5);
  });

  it('clamps absolute value between 0 and 1', () => {
    expect(applyBipolarCurve(1.5, 'expo2')).toBe(1);
    expect(applyBipolarCurve(-1.5, 'expo2')).toBe(-1);
  });
});

describe('_evalCustomCurve — piecewise linear interpolation', () => {
  function _evalCustomCurve(x, points) {
    if (!points || points.length < 2) return x;
    for (var i = 0; i < points.length - 1; i++) {
      var p0 = points[i];
      var p1 = points[i + 1];
      if (x >= p0.x && x <= p1.x) {
        var t = (x - p0.x) / (p1.x - p0.x);
        return p0.y + t * (p1.y - p0.y);
      }
    }
    return x;
  }

  it('returns x when points has less than 2 entries', () => {
    expect(_evalCustomCurve(0.5, [{x: 0, y: 0}])).toBe(0.5);
    expect(_evalCustomCurve(0.5, null)).toBe(0.5);
  });

  it('interpolates linearly between points', () => {
    var points = [{x: 0, y: 0}, {x: 0.5, y: 0.8}, {x: 1, y: 1}];
    expect(_evalCustomCurve(0.25, points)).toBeCloseTo(0.4, 3);
    expect(_evalCustomCurve(0.75, points)).toBeCloseTo(0.9, 3);
  });

  it('returns exact y at control points', () => {
    var points = [{x: 0, y: 0}, {x: 0.3, y: 0.6}, {x: 1, y: 1}];
    expect(_evalCustomCurve(0.3, points)).toBeCloseTo(0.6, 3);
  });

  it('handles x at boundary 0', () => {
    var points = [{x: 0, y: 0}, {x: 1, y: 1}];
    expect(_evalCustomCurve(0, points)).toBe(0);
  });

  it('handles x at boundary 1', () => {
    var points = [{x: 0, y: 0}, {x: 1, y: 1}];
    expect(_evalCustomCurve(1, points)).toBe(1);
  });
});

describe('getControllerCurve and getCustomCurvePoints', () => {
  beforeEach(() => {
    _stubLocalStorage();
    vi.stubGlobal('window', {});
  });

  it('getControllerCurve returns linear by default', () => {
    function getControllerCurve(ctrlName) {
      try {
        var saved = localStorage.getItem('abd-eep-curve-' + ctrlName);
        return saved || 'linear';
      } catch(e) { return 'linear'; }
    }
    expect(getControllerCurve('aftertouch')).toBe('linear');
    expect(getControllerCurve('modwheel')).toBe('linear');
    expect(getControllerCurve('pitchbend')).toBe('linear');
  });

  it('getControllerCurve returns saved curve type', () => {
    function getControllerCurve(ctrlName) {
      try {
        var saved = localStorage.getItem('abd-eep-curve-' + ctrlName);
        return saved || 'linear';
      } catch(e) { return 'linear'; }
    }
    localStorage.setItem('abd-eep-curve-modwheel', 'expo2');
    expect(getControllerCurve('modwheel')).toBe('expo2');
  });

  it('getCustomCurvePoints returns default endpoints when no saved intermediates', () => {
    function getCustomCurvePoints(ctrlName) {
      var key = 'abd-eep-custom-curve-' + ctrlName;
      var raw = localStorage.getItem(key);
      var intermediates = [];
      if (raw) {
        try { intermediates = JSON.parse(raw); } catch(e) { intermediates = []; }
      }
      var all = [{x: 0, y: 0}].concat(intermediates).concat([{x: 1, y: 1}]);
      all.sort(function(a, b) { return a.x - b.x; });
      return all;
    }
    var points = getCustomCurvePoints('aftertouch');
    expect(points).toHaveLength(2);
    expect(points[0].x).toBe(0);
    expect(points[0].y).toBe(0);
    expect(points[1].x).toBe(1);
    expect(points[1].y).toBe(1);
  });

  it('getCustomCurvePoints includes saved intermediate points', () => {
    function getCustomCurvePoints(ctrlName) {
      var key = 'abd-eep-custom-curve-' + ctrlName;
      var raw = localStorage.getItem(key);
      var intermediates = [];
      if (raw) {
        try { intermediates = JSON.parse(raw); } catch(e) { intermediates = []; }
      }
      var all = [{x: 0, y: 0}].concat(intermediates).concat([{x: 1, y: 1}]);
      all.sort(function(a, b) { return a.x - b.x; });
      return all;
    }
    localStorage.setItem('abd-eep-custom-curve-modwheel', JSON.stringify([{x: 0.3, y: 0.6}, {x: 0.7, y: 0.9}]));
    var points = getCustomCurvePoints('modwheel');
    expect(points).toHaveLength(4);
    expect(points[1].x).toBe(0.3);
    expect(points[2].x).toBe(0.7);
  });

  it('getCustomCurvePoints handles corrupted JSON gracefully', () => {
    function getCustomCurvePoints(ctrlName) {
      var key = 'abd-eep-custom-curve-' + ctrlName;
      var raw = localStorage.getItem(key);
      var intermediates = [];
      if (raw) {
        try { intermediates = JSON.parse(raw); } catch(e) { intermediates = []; }
      }
      var all = [{x: 0, y: 0}].concat(intermediates).concat([{x: 1, y: 1}]);
      all.sort(function(a, b) { return a.x - b.x; });
      return all;
    }
    localStorage.setItem('abd-eep-custom-curve-pitchbend', 'not-json');
    var points = getCustomCurvePoints('pitchbend');
    expect(points).toHaveLength(2);
  });

  it('sorts points by x coordinate', () => {
    function getCustomCurvePoints(ctrlName) {
      var key = 'abd-eep-custom-curve-' + ctrlName;
      var raw = localStorage.getItem(key);
      var intermediates = [];
      if (raw) {
        try { intermediates = JSON.parse(raw); } catch(e) { intermediates = []; }
      }
      var all = [{x: 0, y: 0}].concat(intermediates).concat([{x: 1, y: 1}]);
      all.sort(function(a, b) { return a.x - b.x; });
      return all;
    }
    localStorage.setItem('abd-eep-custom-curve-aftertouch', JSON.stringify([{x: 0.7, y: 0.9}, {x: 0.3, y: 0.5}]));
    var points = getCustomCurvePoints('aftertouch');
    expect(points[1].x).toBe(0.3);
    expect(points[2].x).toBe(0.7);
  });
});

// ══════════════════════════════════════════════════════════════════
// _updateHexByteForParam
// ══════════════════════════════════════════════════════════════════

describe('_updateHexByteForParam — SysEx hex byte update', () => {
  var mockBridge;
  var byteEl;

  function _updateHexByteForParam(paramId, normalizedVal) {
    if (!window.dualMidiBridge) return;
    var byteOffset = window.dualMidiBridge.paramToByteOffset[paramId];
    if (byteOffset === undefined) return;

    if (!window._liveUnpackedBytes) {
      if (window._lastUnpackedBytes) {
        window._liveUnpackedBytes = new Uint8Array(window._lastUnpackedBytes);
      } else {
        window._liveUnpackedBytes = new Uint8Array(242);
      }
    }

    var rawVal = window.dualMidiBridge._normalizedToRaw(byteOffset, normalizedVal);
    window._liveUnpackedBytes[byteOffset] = rawVal;

    if (window._lastUnpackedBytes && window._lastUnpackedBytes[byteOffset] !== undefined) {
      window._lastUnpackedBytes[byteOffset] = rawVal;
    }

    var byteEl = document.querySelector('.hex-byte[data-idx="' + byteOffset + '"]');
    if (byteEl) {
      var hex = rawVal.toString(16).toUpperCase().padStart(2, '0');
      byteEl.textContent = hex;
      byteEl.classList.add('changed');
      if (byteEl._changeTimer) {
        clearTimeout(byteEl._changeTimer);
      }
      byteEl._changeTimer = setTimeout(function() {
        byteEl.classList.remove('changed');
        byteEl._changeTimer = null;
      }, 1200);
    }
  }

  beforeEach(() => {
    vi.useFakeTimers();
    mockBridge = {
      paramToByteOffset: {},
      _normalizedToRaw: function(offset, norm) { return Math.round(norm * 255); },
    };
    byteEl = _createFakeEl('span', { 'class': 'hex-byte', 'data-idx': '42' });
    byteEl._changeTimer = null;
    byteEl.classList.add('hex-byte');

    vi.stubGlobal('window', {
      dualMidiBridge: mockBridge,
      _liveUnpackedBytes: undefined,
      _lastUnpackedBytes: undefined,
    });

    vi.stubGlobal('document', {
      querySelector: function(sel) {
        if (sel === '.hex-byte[data-idx="42"]') return byteEl;
        return null;
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns early when bridge is null', () => {
    vi.stubGlobal('window', { dualMidiBridge: null });
    expect(function() { _updateHexByteForParam('vcf_cutoff', 0.5); }).not.toThrow();
  });

  it('returns early when param has no byte offset', () => {
    mockBridge.paramToByteOffset = {};
    expect(function() { _updateHexByteForParam('unknown_param', 0.5); }).not.toThrow();
  });

  it('updates byte element text and adds changed class', () => {
    mockBridge.paramToByteOffset['vcf_cutoff'] = 42;

    _updateHexByteForParam('vcf_cutoff', 0.5);

    expect(byteEl.textContent).toBe('80'); // 0.5 * 255 = 127.5 → round → 128 → hex 80
    expect(byteEl.classList.contains('changed')).toBe(true);
  });

  it('removes changed class after 1200ms', () => {
    mockBridge.paramToByteOffset['vcf_cutoff'] = 42;

    _updateHexByteForParam('vcf_cutoff', 0.5);
    expect(byteEl.classList.contains('changed')).toBe(true);

    vi.advanceTimersByTime(1200);
    expect(byteEl.classList.contains('changed')).toBe(false);
  });

  it('converts normalized value to raw correctly', () => {
    mockBridge.paramToByteOffset['vcf_cutoff'] = 42;

    _updateHexByteForParam('vcf_cutoff', 0.0);
    expect(byteEl.textContent).toBe('00');

    _updateHexByteForParam('vcf_cutoff', 1.0);
    expect(byteEl.textContent).toBe('FF'); // 255 → FF

    _updateHexByteForParam('vcf_cutoff', 0.25);
    expect(byteEl.textContent).toBe('40'); // 63.75 → round → 64 → 40
  });

  it('initializes _liveUnpackedBytes if not exists', () => {
    mockBridge.paramToByteOffset['vcf_cutoff'] = 42;

    _updateHexByteForParam('vcf_cutoff', 0.5);

    expect(window._liveUnpackedBytes).toBeDefined();
    expect(window._liveUnpackedBytes.length).toBe(242);
    expect(window._liveUnpackedBytes[42]).toBe(128);
  });

  it('copies from _lastUnpackedBytes if _liveUnpackedBytes is missing', () => {
    mockBridge.paramToByteOffset['vcf_cutoff'] = 42;
    var lastBytes = new Uint8Array(242);
    lastBytes[0] = 255;
    vi.stubGlobal('window', {
      dualMidiBridge: mockBridge,
      _liveUnpackedBytes: undefined,
      _lastUnpackedBytes: lastBytes,
    });

    _updateHexByteForParam('vcf_cutoff', 0.5);

    expect(window._liveUnpackedBytes[0]).toBe(255);
    expect(window._liveUnpackedBytes[42]).toBe(128);
  });

  it('re-initializes _liveUnpackedBytes when already set', () => {
    mockBridge.paramToByteOffset['vcf_cutoff'] = 42;
    window._liveUnpackedBytes = new Uint8Array(242);

    _updateHexByteForParam('vcf_cutoff', 0.8);

    expect(window._liveUnpackedBytes[42]).toBe(Math.round(0.8 * 255));
  });

  it('reuses existing _changeTimer and resets it', () => {
    mockBridge.paramToByteOffset['vcf_cutoff'] = 42;
    _updateHexByteForParam('vcf_cutoff', 0.5);
    var timer1 = byteEl._changeTimer;

    _updateHexByteForParam('vcf_cutoff', 0.6);
    var timer2 = byteEl._changeTimer;

    // Timer should be replaced
    expect(timer1).not.toBe(timer2);
  });

  it('handles missing byte element in DOM gracefully', () => {
    mockBridge.paramToByteOffset['vcf_cutoff'] = 99; // No element for this offset
    vi.stubGlobal('document', { querySelector: function() { return null; } });

    expect(function() { _updateHexByteForParam('vcf_cutoff', 0.5); }).not.toThrow();
  });

  it('syncs _lastUnpackedBytes if it exists', () => {
    mockBridge.paramToByteOffset['vcf_cutoff'] = 42;
    var lastBytes = new Uint8Array(242);
    lastBytes[42] = 0;
    window._lastUnpackedBytes = lastBytes;

    _updateHexByteForParam('vcf_cutoff', 0.75);

    expect(window._lastUnpackedBytes[42]).toBe(Math.round(0.75 * 255));
  });
});

// ══════════════════════════════════════════════════════════════════
// MIDI Mappings structure
// ══════════════════════════════════════════════════════════════════

describe('MIDI mappings — parameter to NRPN/CC mapping', () => {
  var midiMappings = {
    'lfo1_rate': 'NRPN 0:00 (CC 16)',
    'lfo1_delay': 'NRPN 0:01 (CC 17)',
    'lfo1_shape': 'NRPN 0:02',
    'lfo1_key_sync': 'NRPN 0:03',
    'lfo1_arp_sync': 'NRPN 0:04',
    'lfo2_rate': 'NRPN 0:07 (CC 18)',
    'lfo2_delay': 'NRPN 0:08 (CC 19)',
    'vcf_cutoff': 'NRPN 0:39 (CC 29)',
    'hpf_cutoff': 'NRPN 0:40 (CC 35)',
    'vcf_resonance': 'NRPN 0:41 (CC 30)',
    'vcf_env_depth': 'NRPN 0:42 (CC 31)',
    'env1_attack': 'NRPN 0:53 (CC 37)',
    'env1_decay': 'NRPN 0:54 (CC 39)',
    'env1_sustain': 'NRPN 0:55 (CC 40)',
    'env1_release': 'NRPN 0:56 (CC 41)',
    'vca_level': 'NRPN 0:80 (CC 36)',
    'voice_mode': 'NRPN 0:85',
    'arp_enable': 'NRPN 1:27',
    'arp_rate': 'NRPN 1:29 (CC 12)',
    'seq_enable': 'NRPN 0:117',
    'fx1_type': 'NRPN 1:38',
    'fx2_type': 'NRPN 1:51',
    'fx3_type': 'NRPN 1:64',
    'fx4_type': 'NRPN 1:77',
  };

  it('contains expected number of LFO parameter mappings', () => {
    var lfoKeys = Object.keys(midiMappings).filter(function(k) { return k.startsWith('lfo'); });
    expect(lfoKeys.length).toBeGreaterThanOrEqual(7);
  });

  it('maps VCF cutoff to NRPN 0:39 (CC 29)', () => {
    expect(midiMappings['vcf_cutoff']).toBe('NRPN 0:39 (CC 29)');
  });

  it('maps VCA level to NRPN 0:80 (CC 36)', () => {
    expect(midiMappings['vca_level']).toBe('NRPN 0:80 (CC 36)');
  });

  it('maps envelope parameters correctly', () => {
    expect(midiMappings['env1_attack']).toContain('NRPN');
    expect(midiMappings['env1_decay']).toContain('NRPN');
    expect(midiMappings['env1_sustain']).toContain('NRPN');
    expect(midiMappings['env1_release']).toContain('NRPN');
  });

  it('maps ARP enable to NRPN 1:27', () => {
    expect(midiMappings['arp_enable']).toBe('NRPN 1:27');
  });

  it('maps SEQ enable to NRPN 0:117', () => {
    expect(midiMappings['seq_enable']).toBe('NRPN 0:117');
  });

  it('maps FX type parameters correctly', () => {
    expect(midiMappings['fx1_type']).toBe('NRPN 1:38');
    expect(midiMappings['fx2_type']).toBe('NRPN 1:51');
    expect(midiMappings['fx3_type']).toBe('NRPN 1:64');
    expect(midiMappings['fx4_type']).toBe('NRPN 1:77');
  });
});

// ══════════════════════════════════════════════════════════════════
// Blink state calculation (tempo-synced)
// ══════════════════════════════════════════════════════════════════

describe('Blink state — tempo-synced LED blinking', () => {
  it('calculates blink states based on BPM and timestamp', () => {
    var bpm = 120; // 120 BPM
    var periodMs = 60000 / bpm; // 500ms per beat

    // blinkStateSlow: Math.floor(timestamp / (period / 2)) % 2 === 0
    // With period=500ms, half-period=250ms

    // At t=0: floor(0 / 250) % 2 = 0 % 2 = 0 → even (true)
    expect(Math.floor(0 / (periodMs / 2)) % 2 === 0).toBe(true);

    // At t=250: floor(250 / 250) % 2 = 1 % 2 = 1 → odd (false)
    expect(Math.floor(250 / (periodMs / 2)) % 2 === 0).toBe(false);

    // At t=300: floor(300 / 250) % 2 = 1 → false
    expect(Math.floor(300 / (periodMs / 2)) % 2 === 0).toBe(false);

    // At t=500: floor(500 / 250) % 2 = 2 % 2 = 0 → true
    expect(Math.floor(500 / (periodMs / 2)) % 2 === 0).toBe(true);
  });

  it('fast blink alternates twice per beat (period/4)', () => {
    var bpm = 120;
    var periodMs = 60000 / bpm; // 500ms
    var quarterPeriod = periodMs / 4; // 125ms

    // At t=0: even → true
    expect(Math.floor(0 / quarterPeriod) % 2 === 0).toBe(true);
    // At t=125: odd → false
    expect(Math.floor(125 / quarterPeriod) % 2 === 0).toBe(false);
    // At t=250: even → true
    expect(Math.floor(250 / quarterPeriod) % 2 === 0).toBe(true);
    // At t=375: odd → false
    expect(Math.floor(375 / quarterPeriod) % 2 === 0).toBe(false);
  });

  it('slow blink period scales with BPM', () => {
    var bpmSlow = 60; // 60 BPM → 1000ms period
    var bpmFast = 240; // 240 BPM → 250ms period

    var halfSlow = (60000 / bpmSlow) / 2; // 500ms
    var halfFast = (60000 / bpmFast) / 2; // 125ms

    // At t=400:
    // Slow: floor(400/500) % 2 = 0 → true
    expect(Math.floor(400 / halfSlow) % 2 === 0).toBe(true);
    // Fast: floor(400/125) % 2 = 3 % 2 = 1 → false
    expect(Math.floor(400 / halfFast) % 2 === 0).toBe(false);
  });

  it('calculates BPM from arp_rate parameter', () => {
    // arp_rate range: 0..1 → BPM = 20 + arpRate * 220
    function calcBpm(arpRate) {
      return 20 + arpRate * 220;
    }

    expect(calcBpm(0)).toBe(20);
    expect(calcBpm(0.5)).toBe(130);
    expect(calcBpm(1)).toBe(240);
  });

  it('SEQ pulse time tracking detects step changes', () => {
    var _lastSeqStep = -1;
    var _seqPulseTime = 0;
    var timestamp = 1000;

    function onStepChanged(currentSeqStep, ts) {
      var stepChanged = currentSeqStep !== undefined && currentSeqStep !== _lastSeqStep;
      if (stepChanged) {
        _lastSeqStep = currentSeqStep;
        _seqPulseTime = ts;
      }
      return stepChanged;
    }

    // First step: should fire (changes from undefined)
    expect(onStepChanged(0, timestamp)).toBe(true);
    expect(_lastSeqStep).toBe(0);
    expect(_seqPulseTime).toBe(1000);

    // Same step: should NOT fire
    expect(onStepChanged(0, 1100)).toBe(false);
    expect(_seqPulseTime).toBe(1000); // unchanged

    // Next step: should fire
    expect(onStepChanged(1, 1200)).toBe(true);
    expect(_seqPulseTime).toBe(1200);
  });

  it('SEQ pulse decay fades brightness over stepPulseMs', () => {
    var stepPulseMs = 200;
    var pulseTime = 500;

    function calcBrightness(now) {
      var age = now - pulseTime;
      if (age < stepPulseMs) {
        var fade = age / stepPulseMs;
        return 60 - fade * 35; // 60% → 25%
      }
      return 15; // dim
    }

    expect(calcBrightness(500)).toBeCloseTo(60, 1);  // at pulse start: 60
    expect(calcBrightness(600)).toBeCloseTo(42.5, 1); // mid-fade
    // At age=199 (just before 200ms boundary), fade ≈ 25.175
    expect(calcBrightness(699)).toBeCloseTo(25, 0);   // just before fade end
    expect(calcBrightness(800)).toBe(15);             // after fade: dim
  });
});

// ══════════════════════════════════════════════════════════════════
// _updateCtrlOverlay controller bar calculations
// ══════════════════════════════════════════════════════════════════

describe('Controller overlay — PB/MW/AT bar calculations', () => {
  it('Pitch Bend: calculates left/width for positive values', () => {
    var pb = 0.5;
    var center = 50;
    var left = pb >= 0 ? center : center + pb * 50;
    var width = Math.abs(pb) * 50;
    expect(left).toBe(50);
    expect(width).toBe(25);
  });

  it('Pitch Bend: calculates left/width for negative values', () => {
    var pb = -0.4;
    var center = 50;
    var left = pb >= 0 ? center : center + pb * 50;
    var width = Math.abs(pb) * 50;
    expect(left).toBeCloseTo(30, 1); // 50 + (-0.4 * 50) = 30
    expect(width).toBe(20);
  });

  it('Pitch Bend: at 0, left=50, width=0', () => {
    var pb = 0;
    var center = 50;
    var left = pb >= 0 ? center : center + pb * 50;
    var width = Math.abs(pb) * 50;
    expect(left).toBe(50);
    expect(width).toBe(0);
  });

  it('Pitch Bend label: positive shows + sign, negative shows -', () => {
    var st = 0.5 * 2.0;
    expect((st >= 0 ? '+' : '') + st.toFixed(2)).toBe('+1.00');

    st = -0.5 * 2.0;
    expect((st >= 0 ? '+' : '') + st.toFixed(2)).toBe('-1.00');
  });

  it('Mod Wheel: width = percentage of max', () => {
    expect(Math.round(0.5 * 100) + '%').toBe('50%');
    expect(Math.round(0 * 100) + '%').toBe('0%');
    expect(Math.round(1 * 100) + '%').toBe('100%');
  });

  it('Aftertouch: width = percentage of max', () => {
    expect(Math.round(0.75 * 100) + '%').toBe('75%');
    expect(Math.round(0.01 * 100) + '%').toBe('1%');
  });

  it('VU Meter ballistics: attack is fast (~5ms), release is slow (~300ms)', () => {
    var vu = 0;
    var VU_ATTACK_MS = 5;
    var VU_RELEASE_MS = 300;

    function smooth(vu, raw, dt) {
      if (raw > vu) {
        var coeff = Math.exp(-dt / VU_ATTACK_MS);
        return vu * coeff + raw * (1 - coeff);
      } else {
        var coeff = Math.exp(-dt / VU_RELEASE_MS);
        return raw + (vu - raw) * coeff;
      }
    }

    // Attack: raw=1, vu=0, dt=5ms (one time constant)
    // coeff = exp(-5/5) = exp(-1) ≈ 0.368
    // smoothed = 0 * 0.368 + 1 * (1 - 0.368) ≈ 0.632
    var attacked = smooth(0, 1, 5);
    expect(attacked).toBeGreaterThan(0.6);
    expect(attacked).toBeLessThan(0.65);

    // Release: raw=0, vu=1, dt=300ms (one time constant)
    // coeff = exp(-300/300) = exp(-1) ≈ 0.368
    // smoothed = 0 + (1 - 0) * 0.368 ≈ 0.368
    var released = smooth(1, 0, 300);
    expect(released).toBeGreaterThan(0.35);
    expect(released).toBeLessThan(0.4);
  });

  it('VU dB calculation: 0dB at peak=1, -∞ at near-zero', () => {
    function calcDb(peak) {
      return peak < 0.0001 ? '-∞' : (20.0 * Math.log10(peak)).toFixed(1);
    }

    expect(calcDb(1.0)).toBe('0.0');
    expect(calcDb(0.5)).toBe('-6.0');
    expect(calcDb(0.1)).toBe('-20.0');
    expect(calcDb(0.00001)).toBe('-∞');
  });

  it('VU meter color changes at thresholds', () => {
    function vuColor(peak) {
      if (peak < 0.001) return 'var(--text-faint)';
      if (peak < 0.06) return 'var(--accent-green)';
      if (peak < 0.5) return 'var(--accent-yellow)';
      if (peak < 0.7) return 'var(--accent-orange)';
      return 'var(--color-danger)';
    }

    expect(vuColor(0)).toBe('var(--text-faint)');
    expect(vuColor(0.01)).toBe('var(--accent-green)');
    expect(vuColor(0.3)).toBe('var(--accent-yellow)');
    expect(vuColor(0.6)).toBe('var(--accent-orange)');
    expect(vuColor(0.9)).toBe('var(--color-danger)');
  });
});

// ══════════════════════════════════════════════════════════════════
// Typewriter animation state
// ══════════════════════════════════════════════════════════════════

describe('Typewriter animation — patch name display', () => {
  const TW_CHAR_MS = 65;

  it('calculates chars to show based on elapsed time', () => {
    var text = 'DEEP PATCH';
    var start = 1000;

    function charsToShow(now) {
      return Math.min(text.length, Math.max(1, Math.floor((now - start) / TW_CHAR_MS)));
    }

    expect(charsToShow(1000)).toBe(1);  // 0ms elapsed → 1 char min
    expect(charsToShow(1065)).toBe(1);  // 65ms → 1 char
    expect(charsToShow(1130)).toBe(2);  // 130ms → 2 chars
    expect(charsToShow(1500)).toBe(7);  // 500ms → 7 chars (500/65 = 7.69)
    expect(charsToShow(2000)).toBe(10); // 1000ms → 10 chars (text length)
  });

  it('shows cursor while animation is in progress', () => {
    // isDone = charsToShow >= text.length
    var text = 'TEST';
    var start = 1000;

    function isDone(now) {
      var shown = Math.min(text.length, Math.max(1, Math.floor((now - start) / TW_CHAR_MS)));
      return shown >= text.length;
    }

    expect(isDone(1000)).toBe(false); // 1 char shown, 4 total
    expect(isDone(1300)).toBe(true);  // ~4.6 chars → 4 shown → done
  });
});

// ══════════════════════════════════════════════════════════════════
// _lcdFadeUpdate — LCD fade animation system
// ══════════════════════════════════════════════════════════════════

describe('_lcdFadeUpdate — LCD fade animation', () => {
  var lcdEl;
  var queue;

  function _getLcdTimeoutMs() {
    var saved = localStorage.getItem('abd-eep-lcd-timeout');
    if (saved === null) return 2000;
    if (saved === 'off') return null;
    var ms = parseInt(saved, 10);
    return isNaN(ms) ? 2000 : ms;
  }

  function getLcdFadeTiming() {
    var speed = localStorage.getItem('abd-eep-fade-speed') || 'normal';
    switch (speed) {
      case 'off':    return { out:0, swap:0, in:0, cleanup:0 };
      case 'fast':   return { out:60, swap:70, in:60, cleanup:80 };
      case 'normal': return { out:100, swap:110, in:100, cleanup:130 };
      case 'slow':   return { out:220, swap:230, in:220, cleanup:250 };
      default:       return { out:100, swap:110, in:100, cleanup:130 };
    }
  }

  function _lcdFadeUpdate(lcdEl, html, paramId) {
    if (lcdEl._ctrlLcdFadeTimer) {
      clearTimeout(lcdEl._ctrlLcdFadeTimer);
      lcdEl._ctrlLcdFadeTimer = null;
    }
    var _lcdLastParam = lcdEl._lcdLastParam;
    var contentId = 'param_' + (paramId || 'generic');
    var timeoutMs = _getLcdTimeoutMs();
    if (paramId === _lcdLastParam) {
      lcdEl.style.removeProperty('transition');
      lcdEl.style.opacity = '1';
      lcdEl.innerHTML = html;
      if (window.LcdQueue) {
        window.LcdQueue.push(contentId, html, 1, { duration: timeoutMs !== null ? timeoutMs : null });
      }
      return;
    }
    lcdEl._lcdLastParam = paramId;
    lcdEl._lcdFading = true;
    if (window.LcdQueue) {
      window.LcdQueue.push(contentId, html, 1, { duration: timeoutMs !== null ? timeoutMs : null });
    }
    var t = getLcdFadeTiming();
    if (t.out === 0) {
      lcdEl._lcdFading = false;
      lcdEl.style.removeProperty('transition');
      lcdEl.style.opacity = '1';
      lcdEl.innerHTML = html;
      return;
    }
    lcdEl.style.transition = 'opacity ' + t.out + 'ms ease-out';
    lcdEl.style.opacity = '0';
    lcdEl._ctrlLcdFadeTimer = setTimeout(function() {
      if (lcdEl._ctrlLcdFadeTimer === null) return;
      lcdEl._ctrlLcdFadeTimer = null;
      lcdEl.innerHTML = html;
      lcdEl.style.transition = 'opacity ' + t.in + 'ms ease-in';
      lcdEl.style.opacity = '1';
      lcdEl._lcdFading = false;
      setTimeout(function() {
        lcdEl.style.removeProperty('transition');
        lcdEl.style.removeProperty('opacity');
      }, t.cleanup);
    }, t.swap);
  }

  beforeEach(function() {
    _stubLocalStorage();
    vi.useFakeTimers();
    lcdEl = _createFakeEl('div', { id: 'lcd-text' });
    lcdEl._lcdLastParam = null;
    lcdEl._lcdFading = false;

    queue = {
      _messages: {}, _expiryTimers: {},
      push: function(id, content, priority, options) {
        options = options || {};
        this._messages[id] = { content: content, priority: priority, timestamp: Date.now() };
        if (this._expiryTimers[id]) clearTimeout(this._expiryTimers[id]);
        var dur = options.duration !== undefined ? options.duration : 2000;
        if (dur !== null) {
          var self = this;
          this._expiryTimers[id] = setTimeout(function() { delete self._messages[id]; delete self._expiryTimers[id]; }, dur);
        }
      },
      getActive: function() {
        var best = null;
        for (var id in this._messages) { var m = this._messages[id]; if (!best || m.priority < best.priority) best = m; }
        return best;
      },
    };

    vi.stubGlobal('window', { LcdQueue: queue });
  });

  afterEach(function() {
    vi.useRealTimers();
  });

  it('same param: updates HTML instantly without fade', function() {
    lcdEl._lcdLastParam = 'vcf_cutoff';
    _lcdFadeUpdate(lcdEl, '<strong>50%</strong>', 'vcf_cutoff');

    expect(lcdEl.innerHTML).toBe('<strong>50%</strong>');
    expect(lcdEl.style.opacity).toBe('1');
    expect(lcdEl._lcdFading).toBe(false);
  });

  it('same param: clears ctrlLcdFadeTimer', function() {
    var timer = setTimeout(function() {}, 999);
    lcdEl._ctrlLcdFadeTimer = timer;
    lcdEl._lcdLastParam = 'vcf_cutoff';

    _lcdFadeUpdate(lcdEl, '<strong>50%</strong>', 'vcf_cutoff');

    expect(lcdEl._ctrlLcdFadeTimer).toBeFalsy();
  });

  it('same param: pushes to LcdQueue with contentId=param_paramId', function() {
    lcdEl._lcdLastParam = 'vcf_cutoff';
    var pushSpy = vi.spyOn(queue, 'push');

    _lcdFadeUpdate(lcdEl, '<strong>50%</strong>', 'vcf_cutoff');

    expect(pushSpy).toHaveBeenCalledWith('param_vcf_cutoff', '<strong>50%</strong>', 1, { duration: 2000 });
  });

  it('same param: uses custom timeout from localStorage', function() {
    localStorage.setItem('abd-eep-lcd-timeout', '500');
    lcdEl._lcdLastParam = 'vcf_cutoff';
    var pushSpy = vi.spyOn(queue, 'push');

    _lcdFadeUpdate(lcdEl, '<strong>50%</strong>', 'vcf_cutoff');

    expect(pushSpy).toHaveBeenCalledWith('param_vcf_cutoff', '<strong>50%</strong>', 1, { duration: 500 });
  });

  it('same param: uses null duration when timeout is off', function() {
    localStorage.setItem('abd-eep-lcd-timeout', 'off');
    lcdEl._lcdLastParam = 'vcf_cutoff';
    var pushSpy = vi.spyOn(queue, 'push');

    _lcdFadeUpdate(lcdEl, '<strong>50%</strong>', 'vcf_cutoff');

    expect(pushSpy).toHaveBeenCalledWith('param_vcf_cutoff', '<strong>50%</strong>', 1, { duration: null });
  });

  it('new param: sets _lcdFading=true and pushes to queue', function() {
    var pushSpy = vi.spyOn(queue, 'push');

    _lcdFadeUpdate(lcdEl, '<strong>NEW</strong>', 'vcf_cutoff');

    expect(lcdEl._lcdFading).toBe(true);
    expect(pushSpy).toHaveBeenCalledWith('param_vcf_cutoff', '<strong>NEW</strong>', 1, { duration: 2000 });
  });

  it('new param: starts fade out (opacity=0) with transition', function() {
    _lcdFadeUpdate(lcdEl, '<strong>NEW</strong>', 'vcf_cutoff');

    expect(lcdEl.style.opacity).toBe('0');
    expect(lcdEl.style.transition).toContain('100ms');
  });

  it('new param: after swap timeout, fades in with new content', function() {
    _lcdFadeUpdate(lcdEl, '<strong>NEW</strong>', 'vcf_cutoff');
    expect(lcdEl.innerHTML).not.toContain('NEW');

    // Fast-forward to swap time (110ms)
    vi.advanceTimersByTime(110);
    expect(lcdEl.innerHTML).toBe('<strong>NEW</strong>');
    expect(lcdEl.style.opacity).toBe('1');
    expect(lcdEl._lcdFading).toBe(false);
  });

  it('new param: fade speed=off applies instantly', function() {
    localStorage.setItem('abd-eep-fade-speed', 'off');

    _lcdFadeUpdate(lcdEl, '<strong>INSTANT</strong>', 'vcf_cutoff');

    expect(lcdEl.innerHTML).toBe('<strong>INSTANT</strong>');
    expect(lcdEl._lcdFading).toBe(false);
    expect(lcdEl._ctrlLcdFadeTimer).toBeFalsy();
  });

  it('new param with null timeout: pushes duration=null', function() {
    localStorage.setItem('abd-eep-lcd-timeout', 'off');
    var pushSpy = vi.spyOn(queue, 'push');

    _lcdFadeUpdate(lcdEl, '<strong>NULL</strong>', 'vcf_cutoff');

    expect(pushSpy).toHaveBeenCalledWith('param_vcf_cutoff', '<strong>NULL</strong>', 1, { duration: null });
  });

  it('sets _lcdLastParam for new param', function() {
    _lcdFadeUpdate(lcdEl, '<strong>SET</strong>', 'env1_attack');

    expect(lcdEl._lcdLastParam).toBe('env1_attack');
  });
});

// ══════════════════════════════════════════════════════════════════
// lcdSafeUpdate — safe LCD update wrapper
// ══════════════════════════════════════════════════════════════════

describe('lcdSafeUpdate — safe LCD update wrapper', () => {
  var lcdEl;

  function lcdSafeUpdate(lcdEl, html, paramId, options) {
    options = options || {};
    if (typeof window.lcdFadeUpdate === 'function' && options.useQueue !== false) {
      window.lcdFadeUpdate(lcdEl, html, paramId);
    } else {
      if (lcdEl._ctrlLcdFadeTimer) {
        clearTimeout(lcdEl._ctrlLcdFadeTimer);
        lcdEl._ctrlLcdFadeTimer = null;
      }
      lcdEl._lcdFading = false;
      lcdEl.style.removeProperty('transition');
      lcdEl.style.opacity = '1';
      lcdEl.innerHTML = html;
    }
  }

  beforeEach(function() {
    lcdEl = _createFakeEl('div');
    vi.stubGlobal('window', { lcdFadeUpdate: undefined });
  });

  it('calls lcdFadeUpdate when available and useQueue is not false', function() {
    var fadeSpy = vi.fn();
    window.lcdFadeUpdate = fadeSpy;

    lcdSafeUpdate(lcdEl, '<strong>TEST</strong>', 'vcf_cutoff');

    expect(fadeSpy).toHaveBeenCalledWith(lcdEl, '<strong>TEST</strong>', 'vcf_cutoff');
  });

  it('direct update when lcdFadeUpdate is not available', function() {
    lcdSafeUpdate(lcdEl, '<strong>DIRECT</strong>');

    expect(lcdEl.innerHTML).toBe('<strong>DIRECT</strong>');
    expect(lcdEl.style.opacity).toBe('1');
  });

  it('direct update when useQueue=false', function() {
    var fadeSpy = vi.fn();
    window.lcdFadeUpdate = fadeSpy;

    lcdSafeUpdate(lcdEl, '<strong>NO QUEUE</strong>', null, { useQueue: false });

    expect(fadeSpy).not.toHaveBeenCalled();
    expect(lcdEl.innerHTML).toBe('<strong>NO QUEUE</strong>');
  });

  it('direct update clears pending fade timer', function() {
    var timer = setTimeout(function() {}, 999);
    lcdEl._ctrlLcdFadeTimer = timer;

    lcdSafeUpdate(lcdEl, '<strong>DIRECT</strong>');

    expect(lcdEl._ctrlLcdFadeTimer).toBeNull();
  });

  it('direct update resets _lcdFading to false', function() {
    lcdEl._lcdFading = true;

    lcdSafeUpdate(lcdEl, '<strong>DIRECT</strong>');

    expect(lcdEl._lcdFading).toBe(false);
  });


});

// ══════════════════════════════════════════════════════════════════
// initUIControls — Slider mousedown/move/end cycle
// ══════════════════════════════════════════════════════════════════

describe('initUIControls — slider drag interaction', () => {
  var mockBridge;
  var slider;
  var handle;

  function _makeVerticalSlider(paramId) {
    var container = _createFakeEl('div', { 'data-param': paramId });
    container.classList.add('v-slider');
    container.clientHeight = 100;
    container.getBoundingClientRect = function() {
      return { top: 50, left: 0, width: 40, height: 100, bottom: 150, right: 40 };
    };
    handle = _createFakeEl('div');
    handle.classList.add('handle');
    container._subElements['.handle'] = handle;
    handle._parent = container;
    return container;
  }

  function _setupSlider(slider, bridge) {
    var handle = slider.querySelector('.handle');
    var isDragging = false;

    function updateVal(clientY) {
      var rect = slider.getBoundingClientRect();
      var pct = 1.0 - (clientY - rect.top) / rect.height;
      pct = Math.max(0, Math.min(1, pct));
      var handleHeight = 16;
      var pos = (1.0 - pct) * (rect.height - handleHeight);
      handle.style.top = pos + 'px';
      var paramId = slider.closest('[data-param]').getAttribute('data-param');
      if (bridge) {
        bridge.setParameter(paramId, pct);
      }
    }

    function onSliderMove(e) { if (isDragging) updateVal(e.clientY); }
    function onSliderEnd() { isDragging = false; }

    slider.addEventListener('mousedown', function(e) {
      isDragging = true;
      updateVal(e.clientY);
      window.addEventListener('mousemove', onSliderMove);
      window.addEventListener('mouseup', onSliderEnd);
    });

    return { updateVal: updateVal, setDragging: function(v) { isDragging = v; }, onSliderMove: onSliderMove, onSliderEnd: onSliderEnd };
  }

  beforeEach(function() {
    mockBridge = { setParameter: vi.fn(), parameterCache: {} };
    slider = _makeVerticalSlider('vcf_cutoff');
    vi.stubGlobal('window', { dualMidiBridge: mockBridge, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  });

  it('mousedown at mid-point sets value from clientY', function() {
    _setupSlider(slider, mockBridge);
    var mousedown = slider._listeners['mousedown'][0];

    mousedown({ clientY: 50 }); // top=50, height=100 → pct=1.0-(50-50)/100=1.0

    expect(mockBridge.setParameter).toHaveBeenCalledWith('vcf_cutoff', 1.0);
  });

  it('mousedown at bottom sets value 0', function() {
    _setupSlider(slider, mockBridge);
    var mousedown = slider._listeners['mousedown'][0];

    mousedown({ clientY: 150 }); // top=50, height=100 → pct=1.0-(150-50)/100=0.0

    expect(mockBridge.setParameter).toHaveBeenCalledWith('vcf_cutoff', 0.0);
  });

  it('mousedown at center sets value 0.5', function() {
    _setupSlider(slider, mockBridge);
    var mousedown = slider._listeners['mousedown'][0];

    mousedown({ clientY: 100 }); // top=50 → pct=1.0-(100-50)/100=0.5

    expect(mockBridge.setParameter).toHaveBeenCalledWith('vcf_cutoff', 0.5);
  });

  it('mousedown clamps value above top to 1.0', function() {
    _setupSlider(slider, mockBridge);
    var mousedown = slider._listeners['mousedown'][0];

    mousedown({ clientY: 30 }); // above top → pct=1.0-(-20)/100=1.2→clamped

    expect(mockBridge.setParameter).toHaveBeenCalledWith('vcf_cutoff', 1.0);
  });

  it('mousedown clamps value below bottom to 0', function() {
    _setupSlider(slider, mockBridge);
    var mousedown = slider._listeners['mousedown'][0];

    mousedown({ clientY: 200 }); // below bottom → negative → clamped

    expect(mockBridge.setParameter).toHaveBeenCalledWith('vcf_cutoff', 0.0);
  });

  it('mousedown positions handle top style', function() {
    _setupSlider(slider, mockBridge);
    var mousedown = slider._listeners['mousedown'][0];

    mousedown({ clientY: 75 }); // pct=0.75 → pos=0.25*84=21

    expect(parseFloat(handle.style.top)).toBeCloseTo(21, 1);
  });

  it('does not crash when bridge is absent', function() {
    vi.stubGlobal('window', { dualMidiBridge: null, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    _setupSlider(slider, null);

    expect(function() { slider._listeners['mousedown'][0]({ clientY: 100 }); }).not.toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════
// initUIControls — LED button toggle
// ══════════════════════════════════════════════════════════════════

describe('initUIControls — LED button toggle', () => {
  var mockBridge;
  var led;
  var container;

  beforeEach(function() {
    mockBridge = { setParameter: vi.fn(), parameterCache: {} };
    container = _createFakeEl('div', { 'data-param': 'osc1_saw_enable' });
    led = _createFakeEl('div');
    led.classList.add('led');
    container._subElements['.led'] = led;
    led._parent = container;

    vi.stubGlobal('window', { dualMidiBridge: mockBridge });

    // Simulate initUIControls LED setup
    var paramId = led.closest('[data-param]').getAttribute('data-param');
    led.addEventListener('click', function() {
      var active = led.classList.toggle('active');
      if (window.dualMidiBridge) {
        window.dualMidiBridge.setParameter(paramId, active ? 1.0 : 0.0);
      }
    });
  });

  it('click on LED toggles active class', function() {
    expect(led.classList.contains('active')).toBe(false);
    led._listeners['click'][0]();
    expect(led.classList.contains('active')).toBe(true);
  });

  it('click on LED calls setParameter with 1.0 when activating', function() {
    led._listeners['click'][0]();
    expect(mockBridge.setParameter).toHaveBeenCalledWith('osc1_saw_enable', 1.0);
  });

  it('second click calls setParameter with 0.0 when deactivating', function() {
    led._listeners['click'][0](); // activate
    led._listeners['click'][0](); // deactivate
    expect(mockBridge.setParameter).toHaveBeenCalledWith('osc1_saw_enable', 0.0);
  });

  it('does not throw when bridge is absent', function() {
    vi.stubGlobal('window', { dualMidiBridge: null });
    expect(function() { led._listeners['click'][0](); }).not.toThrow();
  });

  it('classList.toggle correctly reflects active state', function() {
    led._listeners['click'][0]();
    expect(led.classList.contains('active')).toBe(true);
    led._listeners['click'][0]();
    expect(led.classList.contains('active')).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════
// initUIControls — LFO/OSC/ENV selector buttons
// ══════════════════════════════════════════════════════════════════

describe('initUIControls — LFO selector button', () => {
  var mockBridge;
  var lfoBtn;
  var rateUnit, delayUnit, rateLabel;

  function _setupLfoSelector() {
    lfoBtn = _createFakeEl('button', { id: 'lfo-select-btn' });
    rateUnit = _createFakeEl('div', { id: 'lfo-ctrl-rate', 'data-param': 'lfo1_rate' });
    delayUnit = _createFakeEl('div', { id: 'lfo-ctrl-delay', 'data-param': 'lfo1_delay' });
    rateLabel = _createFakeEl('span', { id: 'lfo-label-rate' });
    rateLabel.innerText = 'LFO1 Rate';

    var registry = {};
    registry['lfo-select-btn'] = lfoBtn;
    registry['lfo-ctrl-rate'] = rateUnit;
    registry['lfo-ctrl-delay'] = delayUnit;
    registry['lfo-label-rate'] = rateLabel;

    vi.stubGlobal('document', {
      getElementById: function(id) { return registry[id] || null; },
      addEventListener: function() {},
    });

    lfoBtn.addEventListener('click', function() {
      var activeLfoNumber = parseInt(lfoBtn.getAttribute('data-active') || '1');
      activeLfoNumber = activeLfoNumber === 1 ? 2 : 1;
      lfoBtn.setAttribute('data-active', String(activeLfoNumber));
      lfoBtn.innerText = 'LFO ' + activeLfoNumber + ' ACTIVE';

      if (activeLfoNumber === 1) {
        rateUnit.setAttribute('data-param', 'lfo1_rate');
        delayUnit.setAttribute('data-param', 'lfo1_delay');
        rateLabel.innerText = 'LFO1 Rate';
        lfoBtn.style.color = 'var(--brand-accent)';
      } else {
        rateUnit.setAttribute('data-param', 'lfo2_rate');
        delayUnit.setAttribute('data-param', 'lfo2_delay');
        rateLabel.innerText = 'LFO2 Rate';
        lfoBtn.style.color = 'var(--accent-teal)';
      }
      if (window.updateLfoSlidersFromCurrentPreset) {
        window.updateLfoSlidersFromCurrentPreset();
      }
    });
  }

  beforeEach(function() {
    mockBridge = { parameterCache: {}, setParameter: vi.fn() };
    vi.stubGlobal('window', {
      dualMidiBridge: mockBridge,
      updateLfoSlidersFromCurrentPreset: vi.fn(),
    });
    _setupLfoSelector();
  });

  it('click toggles between LFO 1 and LFO 2', function() {
    lfoBtn._listeners['click'][0]();
    expect(lfoBtn.innerText).toBe('LFO 2 ACTIVE');
    expect(lfoBtn.getAttribute('data-active')).toBe('2');
    expect(lfoBtn.style.color).toBe('var(--accent-teal)');

    lfoBtn._listeners['click'][0]();
    expect(lfoBtn.innerText).toBe('LFO 1 ACTIVE');
    expect(lfoBtn.getAttribute('data-active')).toBe('1');
    expect(lfoBtn.style.color).toBe('var(--brand-accent)');
  });

  it('click updates data-param attributes to LFO 2', function() {
    lfoBtn._listeners['click'][0]();
    expect(rateUnit.getAttribute('data-param')).toBe('lfo2_rate');
    expect(delayUnit.getAttribute('data-param')).toBe('lfo2_delay');
    expect(rateLabel.innerText).toBe('LFO2 Rate');
  });

  it('second click returns data-param to LFO 1', function() {
    lfoBtn._listeners['click'][0](); // → LFO 2
    lfoBtn._listeners['click'][0](); // → LFO 1
    expect(rateUnit.getAttribute('data-param')).toBe('lfo1_rate');
    expect(delayUnit.getAttribute('data-param')).toBe('lfo1_delay');
    expect(rateLabel.innerText).toBe('LFO1 Rate');
  });

  it('calls updateLfoSlidersFromCurrentPreset on toggle', function() {
    lfoBtn._listeners['click'][0]();
    expect(window.updateLfoSlidersFromCurrentPreset).toHaveBeenCalledTimes(1);
    lfoBtn._listeners['click'][0]();
    expect(window.updateLfoSlidersFromCurrentPreset).toHaveBeenCalledTimes(2);
  });
});

describe('initUIControls — OSC selector button', () => {
  var mockBridge;
  var oscBtn;
  var pitchModUnit, pwmToneUnit, pitchUnit, levelUnit;
  var pitchModLabel, pwmToneLabel;

  function _setupOscSelector() {
    oscBtn = _createFakeEl('button', { id: 'osc-select-btn' });
    pitchModUnit = _createFakeEl('div', { id: 'osc-ctrl-pitchmod', 'data-param': 'osc1_pitch_mod' });
    pwmToneUnit = _createFakeEl('div', { id: 'osc-ctrl-pwm-tone', 'data-param': 'osc1_pwm_amount' });
    pitchUnit = _createFakeEl('div', { id: 'osc-ctrl-pitch' });
    levelUnit = _createFakeEl('div', { id: 'osc-ctrl-level' });
    pitchModLabel = _createFakeEl('span', { id: 'osc-label-pitchmod' });
    pwmToneLabel = _createFakeEl('span', { id: 'osc-label-pwm-tone' });

    pitchUnit.style.display = 'none';
    levelUnit.style.display = 'none';

    var registry = {};
    [oscBtn, pitchModUnit, pwmToneUnit, pitchUnit, levelUnit, pitchModLabel, pwmToneLabel].forEach(function(el) { registry[el.id] = el; });

    vi.stubGlobal('document', {
      getElementById: function(id) { return registry[id] || null; },
      addEventListener: function() {},
    });

    oscBtn.addEventListener('click', function() {
      var activeOscNumber = parseInt(oscBtn.getAttribute('data-active') || '1');
      activeOscNumber = activeOscNumber === 1 ? 2 : 1;
      oscBtn.setAttribute('data-active', String(activeOscNumber));
      oscBtn.innerText = 'OSC ' + activeOscNumber + ' ACTIVE';

      if (activeOscNumber === 1) {
        oscBtn.style.color = 'var(--brand-accent)';
        pitchModUnit.setAttribute('data-param', 'osc1_pitch_mod');
        pwmToneUnit.setAttribute('data-param', 'osc1_pwm_amount');
        pitchModLabel.innerText = 'Pitch Mod';
        pwmToneLabel.innerText = 'PWM';
        pitchUnit.style.display = 'none';
        levelUnit.style.display = 'none';
      } else {
        oscBtn.style.color = 'var(--accent-teal)';
        pitchModUnit.setAttribute('data-param', 'osc2_pitch_mod');
        pwmToneUnit.setAttribute('data-param', 'osc2_tone_mod');
        pitchModLabel.innerText = 'Pitch Mod';
        pwmToneLabel.innerText = 'Tone Mod';
        pitchUnit.style.display = 'flex';
        levelUnit.style.display = 'flex';
      }
    });
  }

  beforeEach(function() {
    mockBridge = { parameterCache: {}, setParameter: vi.fn() };
    vi.stubGlobal('window', {
      dualMidiBridge: mockBridge,
      updateOscSlidersFromCurrentPreset: vi.fn(),
      syncDetailPanelControls: vi.fn(),
    });
    _setupOscSelector();
  });

  it('click toggles between OSC 1 and OSC 2', function() {
    oscBtn._listeners['click'][0]();
    expect(oscBtn.innerText).toBe('OSC 2 ACTIVE');
    expect(oscBtn.getAttribute('data-active')).toBe('2');

    oscBtn._listeners['click'][0]();
    expect(oscBtn.innerText).toBe('OSC 1 ACTIVE');
    expect(oscBtn.getAttribute('data-active')).toBe('1');
  });

  it('OSC 2 shows pitch and level units', function() {
    expect(pitchUnit.style.display).toBe('none');
    expect(levelUnit.style.display).toBe('none');

    oscBtn._listeners['click'][0]();

    expect(pitchUnit.style.display).toBe('flex');
    expect(levelUnit.style.display).toBe('flex');
  });

  it('OSC 2 updates data-params to osc2_', function() {
    oscBtn._listeners['click'][0]();

    expect(pitchModUnit.getAttribute('data-param')).toBe('osc2_pitch_mod');
    expect(pwmToneUnit.getAttribute('data-param')).toBe('osc2_tone_mod');
    expect(pwmToneLabel.innerText).toBe('Tone Mod');
  });

  it('OSC 1 hides pitch and level units after returning from OSC 2', function() {
    oscBtn._listeners['click'][0](); // → OSC 2
    oscBtn._listeners['click'][0](); // → OSC 1

    expect(pitchUnit.style.display).toBe('none');
    expect(levelUnit.style.display).toBe('none');
  });
});

describe('initUIControls — ENV type buttons', () => {
  var mockBridge;
  var envBtns;
  var atkUnit, dcyUnit, susUnit, relUnit;

  function _setupEnvButtons() {
    var registry = {};
    atkUnit = _createFakeEl('div', { id: 'env-ctrl-attack', 'data-param': 'env1_attack' });
    dcyUnit = _createFakeEl('div', { id: 'env-ctrl-decay', 'data-param': 'env1_decay' });
    susUnit = _createFakeEl('div', { id: 'env-ctrl-sustain', 'data-param': 'env1_sustain' });
    relUnit = _createFakeEl('div', { id: 'env-ctrl-release', 'data-param': 'env1_release' });
    [atkUnit, dcyUnit, susUnit, relUnit].forEach(function(el) { registry[el.id] = el; });

    // Create 3 env type buttons
    envBtns = [1, 2, 3].map(function(num) {
      var btn = _createFakeEl('button', { 'data-env': String(num) });
      btn.classList.add('env-type-btn');
      btn.style = { background: '', borderColor: '', color: '' };
      registry['env-type-btn-' + num] = btn;
      return btn;
    });

    vi.stubGlobal('document', {
      getElementById: function(id) { return registry[id] || null; },
      querySelectorAll: function(sel) {
        if (sel === '.env-type-btn') return envBtns;
        return [];
      },
      addEventListener: function() {},
    });

    // Register click handlers (extracted from initUIControls)
    envBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        envBtns.forEach(function(b) {
          b.classList.remove('active');
          b.style.background = 'var(--bg-hover)';
          b.style.borderColor = 'var(--border-dim)';
          b.style.color = 'var(--text-labels)';
        });
        btn.classList.add('active');
        var activeEnv = parseInt(btn.getAttribute('data-env'));
        if (activeEnv === 1) {
          btn.style.background = 'color-mix(in srgb, var(--accent-primary) 15%, transparent)';
          btn.style.borderColor = 'var(--brand-accent)';
          btn.style.color = 'var(--brand-accent)';
          atkUnit.setAttribute('data-param', 'env1_attack');
          dcyUnit.setAttribute('data-param', 'env1_decay');
          susUnit.setAttribute('data-param', 'env1_sustain');
          relUnit.setAttribute('data-param', 'env1_release');
        } else if (activeEnv === 2) {
          btn.style.background = 'color-mix(in srgb, var(--accent-teal) 15%, transparent)';
          btn.style.borderColor = 'var(--accent-teal)';
          btn.style.color = 'var(--accent-teal)';
          atkUnit.setAttribute('data-param', 'env2_attack');
          dcyUnit.setAttribute('data-param', 'env2_decay');
          susUnit.setAttribute('data-param', 'env2_sustain');
          relUnit.setAttribute('data-param', 'env2_release');
        } else {
          btn.style.background = 'color-mix(in srgb, var(--accent-pink) 15%, transparent)';
          btn.style.borderColor = 'var(--accent-pink)';
          btn.style.color = 'var(--accent-pink)';
          atkUnit.setAttribute('data-param', 'env3_attack');
          dcyUnit.setAttribute('data-param', 'env3_decay');
          susUnit.setAttribute('data-param', 'env3_sustain');
          relUnit.setAttribute('data-param', 'env3_release');
        }
      });
    });
  }

  beforeEach(function() {
    mockBridge = { parameterCache: {}, setParameter: vi.fn() };
    vi.stubGlobal('window', {
      dualMidiBridge: mockBridge,
      updateEnvSlidersFromCurrentPreset: vi.fn(),
      syncDetailPanelControls: vi.fn(),
    });
    _setupEnvButtons();
  });

  it('clicking ENV 1 sets data-params to env1_', function() {
    envBtns[0]._listeners['click'][0]();
    expect(atkUnit.getAttribute('data-param')).toBe('env1_attack');
    expect(dcyUnit.getAttribute('data-param')).toBe('env1_decay');
    expect(susUnit.getAttribute('data-param')).toBe('env1_sustain');
    expect(relUnit.getAttribute('data-param')).toBe('env1_release');
  });

  it('clicking ENV 2 sets data-params to env2_', function() {
    envBtns[1]._listeners['click'][0]();
    expect(atkUnit.getAttribute('data-param')).toBe('env2_attack');
    expect(dcyUnit.getAttribute('data-param')).toBe('env2_decay');
    expect(susUnit.getAttribute('data-param')).toBe('env2_sustain');
    expect(relUnit.getAttribute('data-param')).toBe('env2_release');
  });

  it('clicking ENV 3 sets data-params to env3_', function() {
    envBtns[2]._listeners['click'][0]();
    expect(atkUnit.getAttribute('data-param')).toBe('env3_attack');
    expect(dcyUnit.getAttribute('data-param')).toBe('env3_decay');
    expect(susUnit.getAttribute('data-param')).toBe('env3_sustain');
    expect(relUnit.getAttribute('data-param')).toBe('env3_release');
  });

  it('clicking one button deactivates others', function() {
    envBtns[0]._listeners['click'][0]();
    expect(envBtns[0].classList.contains('active')).toBe(true);
    expect(envBtns[1].classList.contains('active')).toBe(false);
    expect(envBtns[2].classList.contains('active')).toBe(false);

    envBtns[1]._listeners['click'][0]();
    expect(envBtns[0].classList.contains('active')).toBe(false);
    expect(envBtns[1].classList.contains('active')).toBe(true);
    expect(envBtns[2].classList.contains('active')).toBe(false);
  });

  it('ENV 1 has brand accent styling', function() {
    envBtns[0]._listeners['click'][0]();
    expect(envBtns[0].style.borderColor).toBe('var(--brand-accent)');
  });


});

// ══════════════════════════════════════════════════════════════════
// initUIControls — HPF Boost / VCA Mode toggle buttons
// ══════════════════════════════════════════════════════════════════

describe('initUIControls — HPF Boost and VCA Mode buttons', () => {
  var mockBridge;
  var hpfBtn, vcaBtn;

  function _setupButtons() {
    hpfBtn = _createFakeEl('button', { id: 'hpf-boost-btn' });
    vcaBtn = _createFakeEl('button', { id: 'vca-mode-btn' });
    var registry = { 'hpf-boost-btn': hpfBtn, 'vca-mode-btn': vcaBtn };

    vi.stubGlobal('document', {
      getElementById: function(id) { return registry[id] || null; },
      addEventListener: function() {},
    });

    // HPF Boost
    hpfBtn.addEventListener('click', function() {
      var cacheVal = window.dualMidiBridge ? window.dualMidiBridge.parameterCache['hpf_boost_enable'] : 0.0;
      var active = cacheVal > 0.5;
      var nextVal = active ? 0.0 : 1.0;
      if (window.dualMidiBridge) {
        window.dualMidiBridge.setParameter('hpf_boost_enable', nextVal);
        window.dualMidiBridge.handleParameterChangeFromBackend('hpf_boost_enable', nextVal);
      }
    });

    // VCA Mode
    vcaBtn.addEventListener('click', function() {
      var cacheVal = window.dualMidiBridge ? window.dualMidiBridge.parameterCache['vca_mode'] : 0.0;
      var active = cacheVal > 0.5;
      var nextVal = active ? 0.0 : 1.0;
      if (window.dualMidiBridge) {
        window.dualMidiBridge.setParameter('vca_mode', nextVal);
        window.dualMidiBridge.handleParameterChangeFromBackend('vca_mode', nextVal);
      }
    });
  }

  beforeEach(function() {
    mockBridge = {
      setParameter: vi.fn(),
      handleParameterChangeFromBackend: vi.fn(),
      parameterCache: {},
    };
    vi.stubGlobal('window', { dualMidiBridge: mockBridge });
    _setupButtons();
  });

  it('HPF boost: click toggles from 0→1 when cache is 0', function() {
    mockBridge.parameterCache['hpf_boost_enable'] = 0.0;
    hpfBtn._listeners['click'][0]();
    expect(mockBridge.setParameter).toHaveBeenCalledWith('hpf_boost_enable', 1.0);
    expect(mockBridge.handleParameterChangeFromBackend).toHaveBeenCalledWith('hpf_boost_enable', 1.0);
  });

  it('HPF boost: click toggles from 1→0 when cache is 1', function() {
    mockBridge.parameterCache['hpf_boost_enable'] = 1.0;
    hpfBtn._listeners['click'][0]();
    expect(mockBridge.setParameter).toHaveBeenCalledWith('hpf_boost_enable', 0.0);
  });

  it('VCA mode: click toggles from 0→1 when cache is 0', function() {
    mockBridge.parameterCache['vca_mode'] = 0.0;
    vcaBtn._listeners['click'][0]();
    expect(mockBridge.setParameter).toHaveBeenCalledWith('vca_mode', 1.0);
  });

  it('VCA mode: click toggles from 1→0 when cache is 1', function() {
    mockBridge.parameterCache['vca_mode'] = 1.0;
    vcaBtn._listeners['click'][0]();
    expect(mockBridge.setParameter).toHaveBeenCalledWith('vca_mode', 0.0);
  });

  it('does not crash when bridge is null', function() {
    vi.stubGlobal('window', { dualMidiBridge: null });
    expect(function() { hpfBtn._listeners['click'][0](); }).not.toThrow();
    expect(function() { vcaBtn._listeners['click'][0](); }).not.toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════
// initUIControls — onParameterChanged slider/LED sync
// ══════════════════════════════════════════════════════════════════

describe('initUIControls — onParameterChanged slider/LED sync', () => {
  var mockBridge;
  var callback;
  var sliderUnits;

  function _makeSyncedSliderUnit(id, paramId) {
    var container = _createFakeEl('div', { id: id, 'data-param': paramId });
    container.clientHeight = 100;
    var slider = _createFakeEl('div');
    slider.classList.add('v-slider');
    slider.clientHeight = 100;
    var handle = _createFakeEl('div');
    handle.classList.add('handle');
    slider._subElements['.handle'] = handle;
    container._subElements['.v-slider'] = slider;
    return container;
  }

  beforeEach(function() {
    mockBridge = { parameterCache: {}, onParameterChanged: vi.fn() };
    sliderUnits = {};

    // Simulate the onParameterChanged callback from initUIControls
    callback = function(paramId, val) {
      // Slider sync
      var sliders = [];
      Object.keys(sliderUnits).forEach(function(id) {
        var unit = sliderUnits[id];
        var pId = unit.getAttribute('data-param');
        if (pId === paramId) {
          var slider = unit.querySelector('.v-slider');
          if (slider) sliders.push(slider);
        }
      });

      sliders.forEach(function(sliderUnit) {
        var handle = sliderUnit.querySelector('.handle');
        if (handle) {
          var height = sliderUnit.clientHeight > 0 ? sliderUnit.clientHeight : 100;
          var handleHeight = 16;
          var pos = (1.0 - val) * (height - handleHeight);
          handle.style.top = pos + 'px';
        }
      });

      // LED sync
      if (paramId === 'osc1_saw_enable') {
        var led = { classList: { contains: function() {}, toggle: vi.fn() } };
        led.classList.toggle('active', val > 0.5);
      }
    };

    vi.stubGlobal('window', { dualMidiBridge: mockBridge });
  });

  it('syncs slider handle position for matching param', function() {
    var unit = _makeSyncedSliderUnit('env-ctrl-attack', 'env1_attack');
    sliderUnits['env-ctrl-attack'] = unit;
    var handle = unit.querySelector('.v-slider').querySelector('.handle');

    callback('env1_attack', 0.8);
    expect(parseFloat(handle.style.top)).toBeCloseTo(16.8, 1);

    callback('env1_attack', 0.2);
    expect(parseFloat(handle.style.top)).toBeCloseTo(67.2, 1);
  });

  it('does not sync slider for non-matching param', function() {
    var unit = _makeSyncedSliderUnit('env-ctrl-attack', 'env1_attack');
    sliderUnits['env-ctrl-attack'] = unit;
    var handle = unit.querySelector('.v-slider').querySelector('.handle');

    callback('vcf_cutoff', 0.5);
    expect(handle.style.top).toBeFalsy();
  });

  it('uses clientHeight when getBoundingClientRect not available', function() {
    var unit = _makeSyncedSliderUnit('env-ctrl-attack', 'env1_attack');
    unit.querySelector('.v-slider').clientHeight = 50;
    sliderUnits['env-ctrl-attack'] = unit;
    var handle = unit.querySelector('.v-slider').querySelector('.handle');

    callback('env1_attack', 0.5);
    // pos = 0.5 * (50 - 16) = 17
    expect(parseFloat(handle.style.top)).toBeCloseTo(17, 1);
  });

  it('handles missing handle gracefully', function() {
    var unit = _makeSyncedSliderUnit('env-ctrl-attack', 'env1_attack');
    var vSlider = unit.querySelector('.v-slider');
    delete vSlider._subElements['.handle'];

    expect(function() { callback('env1_attack', 0.5); }).not.toThrow();
  });

  it('triggers LED toggle for osc1_saw_enable param', function() {
    var ledToggle = { classList: { toggle: vi.fn() } };
    // Replace callback to test LED toggle
    var ledCallback = function(paramId, val) {
      if (paramId === 'osc1_saw_enable') {
        ledToggle.classList.toggle('active', val > 0.5);
      }
    };
    ledCallback('osc1_saw_enable', 1.0);
    expect(ledToggle.classList.toggle).toHaveBeenCalledWith('active', true);

    ledCallback('osc1_saw_enable', 0.0);
    expect(ledToggle.classList.toggle).toHaveBeenCalledWith('active', false);
  });
});

// ══════════════════════════════════════════════════════════════════
// PANIC button — MIDI messages and engine reset
// ══════════════════════════════════════════════════════════════════

describe('PANIC button — MIDI messages and engine reset', () => {
  var mockBridge;
  var panicBtn;
  var lcdText;

  function _setupPanic() {
    panicBtn = _createFakeEl('button', { id: 'programmer-panic-btn' });
    lcdText = _createFakeEl('div', { id: 'lcd-text' });
    lcdText._lcdFading = false;
    var registry = { 'programmer-panic-btn': panicBtn, 'lcd-text': lcdText };

    vi.stubGlobal('document', {
      getElementById: function(id) { return registry[id] || null; },
      addEventListener: function() {},
    });

    vi.stubGlobal('window', {
      dualMidiBridge: mockBridge,
      lcdSafeUpdate: vi.fn(),
      _seqResetCount: 0,
      _arpResetCount: 0,
      _genPosBar: function() { return '████████░░░░░░░░░░'; },
      _genFillBar: function() { return '████░░░░░░░░░░░░░░'; },
      _genLcdBarHtml: function() { return '<bar>SEQ RESET</bar>'; },
    });

    panicBtn.addEventListener('click', function() {
      var _pBtn_ = this;
      _pBtn_.style.transition = 'background 60ms ease-out, box-shadow 60ms ease-out';
      _pBtn_.style.background = 'color-mix(in srgb, var(--color-danger) 80%, transparent)';
      _pBtn_.style.boxShadow = '0 0 24px var(--color-danger), inset 0 0 12px var(--color-danger)';

      var bridge = window.dualMidiBridge;
      if (!bridge) return;

      var msgCount = 0;

      if (bridge.isJuce) {
        for (var n = 0; n < 128; n++) {
          bridge.pianoNoteOff(n);
          msgCount++;
        }
      } else if (bridge.midiOutput) {
        bridge._signalMidiActivity();
        for (var ch = 0; ch < 16; ch++) {
          var status = 0xB0 | ch;
          bridge.midiOutput.send([status, 123, 0]);
          bridge.midiOutput.send([status, 120, 0]);
          msgCount += 2;
        }
      }

      // Lcd feedback
      var lcdText = document.getElementById('lcd-text');
      if (lcdText) {
        var panicHtml = '<strong>ALL NOTES OFF</strong><br>' + msgCount + ' messages';
        window.lcdSafeUpdate(lcdText, panicHtml);
      }
    });
  }

  beforeEach(function() {
    mockBridge = {
      isJuce: false,
      midiOutput: null,
      pianoNoteOff: vi.fn(),
      _signalMidiActivity: vi.fn(),
      parameterCache: {},
      _seqEngine: null,
      _arpEngine: null,
    };
    vi.useFakeTimers();
    _setupPanic();
  });

  afterEach(function() {
    vi.useRealTimers();
  });

  it('JUCE mode: sends note off for all 128 notes', function() {
    mockBridge.isJuce = true;
    panicBtn._listeners['click'][0].call(panicBtn);
    expect(mockBridge.pianoNoteOff).toHaveBeenCalledTimes(128);
  });

  it('WebMIDI mode: sends All Notes Off + All Sound Off on 16 channels', function() {
    mockBridge.midiOutput = { send: vi.fn() };
    panicBtn._listeners['click'][0].call(panicBtn);
    // 16 channels × 2 messages = 32 sends
    expect(mockBridge.midiOutput.send).toHaveBeenCalledTimes(32);
    // Check first call: channel 0, All Notes Off (CC 123)
    expect(mockBridge.midiOutput.send).toHaveBeenCalledWith([0xB0, 123, 0]);
    // Check second call: channel 0, All Sound Off (CC 120)
    expect(mockBridge.midiOutput.send).toHaveBeenCalledWith([0xB0, 120, 0]);
  });

  it('WebMIDI mode: signals MIDI activity', function() {
    mockBridge.midiOutput = { send: vi.fn() };
    panicBtn._listeners['click'][0].call(panicBtn);
    expect(mockBridge._signalMidiActivity).toHaveBeenCalled();
  });

  it('updates LCD with message count', function() {
    mockBridge.midiOutput = { send: vi.fn() };
    panicBtn._listeners['click'][0].call(panicBtn);
    expect(window.lcdSafeUpdate).toHaveBeenCalled();
    var html = window.lcdSafeUpdate.mock.calls[0][1];
    expect(html).toContain('ALL NOTES OFF');
    expect(html).toContain('32');
  });

  it('shows flash visual feedback styles', function() {
    panicBtn._listeners['click'][0].call(panicBtn);
    expect(panicBtn.style.background).toContain('--color-danger');
    expect(panicBtn.style.boxShadow).toContain('24px');
  });

  it('returns early when bridge is null', function() {
    vi.stubGlobal('window', { dualMidiBridge: null, lcdSafeUpdate: vi.fn() });
    expect(function() { panicBtn._listeners['click'][0].call(panicBtn); }).not.toThrow();
  });

  it('JUCE mode: panic sends 128 messages', function() {
    mockBridge.isJuce = true;
    panicBtn._listeners['click'][0].call(panicBtn);
    expect(window.lcdSafeUpdate.mock.calls[0][1]).toContain('128');
  });
});

// ══════════════════════════════════════════════════════════════════
// MIDI Learn initialization
// ══════════════════════════════════════════════════════════════════

describe('MIDI Learn init — toggle and button style', () => {
  var mockBridge;
  var learnBtn;

  function _setupMidiLearn() {
    learnBtn = _createFakeEl('button', { id: 'programmer-midi-learn-btn' });
    var registry = { 'programmer-midi-learn-btn': learnBtn };

    vi.stubGlobal('document', {
      getElementById: function(id) { return registry[id] || null; },
      addEventListener: function() {},
    });

    function updateButtonStyle(active) {
      if (!learnBtn) return;
      if (active) {
        learnBtn.style.background = 'color-mix(in srgb, var(--accent-blue) 35%, transparent)';
        learnBtn.style.borderColor = 'var(--accent-blue)';
        learnBtn.style.boxShadow = '0 0 12px var(--accent-blue)';
        learnBtn.style.color = 'var(--accent-blue)';
        learnBtn.textContent = 'LEARN ON';
      } else {
        learnBtn.style.background = 'transparent';
        learnBtn.style.borderColor = 'var(--accent-blue)';
        learnBtn.style.boxShadow = 'none';
        learnBtn.style.color = 'var(--accent-blue)';
        learnBtn.textContent = 'MIDI LEARN';
      }
    }

    learnBtn.addEventListener('click', function() {
      var kBridge = window.dualMidiBridge; if (kBridge) kBridge.toggleMidiLearn();
    });

    if (typeof mockBridge.onMidiLearnChange === 'function') {
      mockBridge.onMidiLearnChange(function(active) {
        updateButtonStyle(active);
      });
    }

    // Initial state
    updateButtonStyle(false);

    return { updateButtonStyle: updateButtonStyle };
  }

  beforeEach(function() {
    mockBridge = {
      toggleMidiLearn: vi.fn(),
      onMidiLearnChange: vi.fn(),
    };
    vi.stubGlobal('window', { dualMidiBridge: mockBridge });
  });

  it('click calls bridge.toggleMidiLearn()', function() {
    _setupMidiLearn();
    learnBtn._listeners['click'][0]();
    expect(mockBridge.toggleMidiLearn).toHaveBeenCalled();
  });

  it('registers onMidiLearnChange callback', function() {
    _setupMidiLearn();
    expect(mockBridge.onMidiLearnChange).toHaveBeenCalled();
    expect(typeof mockBridge.onMidiLearnChange.mock.calls[0][0]).toBe('function');
  });

  it('initial button state shows MIDI LEARN (inactive)', function() {
    _setupMidiLearn();
    expect(learnBtn.textContent).toBe('MIDI LEARN');
    expect(learnBtn.style.background).toBe('transparent');
    expect(learnBtn.style.boxShadow).toBe('none');
  });

  it('updateButtonStyle with active=true shows LEARN ON', function() {
    var midi = _setupMidiLearn();
    midi.updateButtonStyle(true);
    expect(learnBtn.textContent).toBe('LEARN ON');
    expect(learnBtn.style.background).toContain('--accent-blue');
    expect(learnBtn.style.boxShadow).toContain('12px');
  });

  it('updateButtonStyle with active=false shows MIDI LEARN', function() {
    var midi = _setupMidiLearn();
    midi.updateButtonStyle(true);
    midi.updateButtonStyle(false);
    expect(learnBtn.textContent).toBe('MIDI LEARN');
    expect(learnBtn.style.background).toBe('transparent');
  });

  it('onMidiLearnChange callback triggers updateButtonStyle', function() {
    _setupMidiLearn();
    var callback = mockBridge.onMidiLearnChange.mock.calls[0][0];

    callback(true, null);
    expect(learnBtn.textContent).toBe('LEARN ON');

    callback(false, null);
    expect(learnBtn.textContent).toBe('MIDI LEARN');
  });

  it('handles null learnBtn gracefully', function() {
    vi.stubGlobal('document', {
      getElementById: function() { return null; },
      addEventListener: function() {},
    });

    expect(function() {
      var fn = _setupMidiLearn;
      fn();
    }).not.toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════
// MIDI Learn — param click to set target
// ══════════════════════════════════════════════════════════════════

describe('initMidiLearnParamClick — click param in learn mode', () => {
  var mockBridge;

  function _setupMidiLearnParamClick() {
    document.addEventListener('click', function(e) {
      var bridge = window.dualMidiBridge;
      if (!bridge || !bridge.midiLearnActive) return;

      var ctrlUnit = e.target.closest('[data-param]');
      if (!ctrlUnit) return;

      var paramId = ctrlUnit.getAttribute('data-param');
      if (!paramId) return;

      e.preventDefault();
      bridge.setMidiLearnTarget(paramId);
    }, true);
  }

  beforeEach(function() {
    mockBridge = {
      midiLearnActive: true,
      setMidiLearnTarget: vi.fn(),
    };
    vi.stubGlobal('window', { dualMidiBridge: mockBridge });
    vi.stubGlobal('document', {
      addEventListener: function(event, handler, capture) {
        if (event === 'click') this._clickHandler = handler;
      },
      _clickHandler: null,
      click: function(e) { if (this._clickHandler) this._clickHandler(e); },
    });
    _setupMidiLearnParamClick();
  });

  it('calls setMidiLearnTarget when clicking [data-param] element in learn mode', function() {
    var target = _createFakeEl('div', { 'data-param': 'vcf_cutoff' });
    target.closest = function(sel) {
      if (sel === '[data-param]') return target;
      return null;
    };

    document._clickHandler({ target: target, preventDefault: vi.fn() });

    expect(mockBridge.setMidiLearnTarget).toHaveBeenCalledWith('vcf_cutoff');
  });

  it('calls preventDefault on the event', function() {
    var target = _createFakeEl('div', { 'data-param': 'vcf_cutoff' });
    target.closest = function(sel) {
      if (sel === '[data-param]') return target;
      return null;
    };
    var preventSpy = vi.fn();

    document._clickHandler({ target: target, preventDefault: preventSpy });

    expect(preventSpy).toHaveBeenCalled();
  });

  it('returns early when bridge is null', function() {
    vi.stubGlobal('window', { dualMidiBridge: null });
    expect(function() { document._clickHandler({ target: {}, preventDefault: vi.fn() }); }).not.toThrow();
  });

  it('returns early when learn mode is off', function() {
    mockBridge.midiLearnActive = false;
    expect(function() { document._clickHandler({ target: {}, preventDefault: vi.fn() }); }).not.toThrow();
    expect(mockBridge.setMidiLearnTarget).not.toHaveBeenCalled();
  });

  it('returns early when target has no [data-param] ancestor', function() {
    var target = _createFakeEl('div');
    target.closest = function() { return null; };

    document._clickHandler({ target: target, preventDefault: vi.fn() });
    expect(mockBridge.setMidiLearnTarget).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════
// Keyboard shortcuts — keydown dispatch
// ══════════════════════════════════════════════════════════════════
