/**
 * Unit tests for Global Settings initialization functions (Vitest version)
 *
 * Run with: npx vitest run WebUI/tests/globalSettings.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ══════════════════════════════════════════════════════════════════
// Mock state
// ══════════════════════════════════════════════════════════════════

let _storage = {};
let _elementRegistry = {};
let _bridge;

function _resetStorage() { _storage = {}; }
function _resetElements() { _elementRegistry = {}; }
function _registerElement(id, el) { _elementRegistry[id] = el; }

function _resetBridge() {
  _bridge = {
    midiChannel: 1,
    parameterCache: {},
    _hardwareInfo: { globalDumpBytes: [0, 128, 48, 0, 0], deviceId: '0' },
    _connected: true,
    _setGlobalCalls: [],
    _sendGlobalDumpCalled: false,
    setGlobalParameter(paramId, value) {
      this._setGlobalCalls.push({ paramId, value });
    },
    sendGlobalDump() { this._sendGlobalDumpCalled = true; },
    getHardwareInfo() {
      return {
        deviceId: '0',
        midiChannel: this.midiChannel,
        connectionType: 'USB',
        hostVersion: '1.0',
        voiceVersion: '1.0',
      };
    },
  };
}

function _setupGlobals() {
  // Build shared mock objects
  const mockDocument = {
    getElementById: (id) => _elementRegistry[id] || null,
    querySelector: () => null,
    querySelectorAll: () => [],
    documentElement: { style: { setProperty: () => {} } },
  };
  const mockLocalStorage = {
    getItem: (k) => (_storage[k] !== undefined ? _storage[k] : null),
    setItem: (k, v) => { _storage[k] = String(v); },
    removeItem: (k) => { delete _storage[k]; },
    clear: () => { _storage = {}; },
  };
  // Stub bare globals (functions reference document / localStorage directly)
  vi.stubGlobal('document', mockDocument);
  vi.stubGlobal('localStorage', mockLocalStorage);
  vi.stubGlobal('getComputedStyle', () => ({
    getPropertyValue: (name) => (name === '--brand-accent' ? '#ff9900' : ''),
  }));
  // Stub window (for window.dualMidiBridge, window.document, window.localStorage)
  vi.stubGlobal('window', {
    dualMidiBridge: _bridge,
    localStorage: mockLocalStorage,
    document: mockDocument,
    getComputedStyle: () => ({
      getPropertyValue: (name) => (name === '--brand-accent' ? '#ff9900' : ''),
    }),
  });
}

// ══════════════════════════════════════════════════════════════════
// Fake DOM factory
// ══════════════════════════════════════════════════════════════════

function _createFakeElement(tag, attrs) {
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
      get color() { return this._props.color; },
      set color(val) { this._props.color = val; },
      get opacity() { return this._props.opacity; },
      set opacity(val) { this._props.opacity = val; },
    },
    dataset: {},
    classList: {
      _classes: [],
      add(c) { if (!this._classes.includes(c)) this._classes.push(c); },
      remove(c) { this._classes = this._classes.filter((x) => x !== c); },
      contains(c) { return this._classes.includes(c); },
    },
    getAttribute(name) { return this._attrs[name]; },
    setAttribute(name, val) { this._attrs[name] = val; },
    addEventListener(event, handler) {
      if (!this._listeners[event]) this._listeners[event] = [];
      this._listeners[event].push(handler);
    },
    removeEventListener() {},
    dispatchEvent() {},
    appendChild(child) {
      this._children = this._children || [];
      this._children.push(child);
    },
    _children: [],
    _ctx: ((() => {
      const calls = [];
      return {
        _calls: calls,
        clearRect() { calls.push('clearRect'); },
        beginPath() { calls.push('beginPath'); },
        moveTo() { calls.push('moveTo'); },
        lineTo() { calls.push('lineTo'); },
        stroke() { calls.push('stroke'); },
        fillText() { calls.push('fillText'); },
        arc() { calls.push('arc'); },
        fill() { calls.push('fill'); },
        setLineDash() { calls.push('setLineDash'); },
        strokeStyle: null,
        lineWidth: null,
        fillStyle: null,
        font: null,
        textAlign: null,
      };
    }))(),
    getContext() { return this._ctx; },
    width: 80,
    height: 30,
    getBoundingClientRect() {
      return { top: 0, left: 0, width: 80, height: 30, bottom: 30, right: 80 };
    },
  };
  return el;
}

function _triggerChange(el, newValue) {
  el.value = newValue;
  const handlers = el._listeners.change || [];
  handlers.forEach((h) => h.call(el, { target: el }));
}

// ══════════════════════════════════════════════════════════════════
// Functions under test (extracted from settings.js)
// ══════════════════════════════════════════════════════════════════

function initVelocityCurveSetting() {
  const sel = document.getElementById('settings-velocity-curve');
  if (!sel) return;
  const saved = localStorage.getItem('abd-eep-velocity-curve') || 'normal';
  sel.value = saved;
  sel.addEventListener('change', function () {
    localStorage.setItem('abd-eep-velocity-curve', this.value);
    drawVelocityCurvePreview();
    if (window.dualMidiBridge) {
      const curveMap = { normal: 0, soft: 1, hard: 2, linear: 3, fixed: 4 };
      const idx = curveMap[this.value];
      if (idx !== undefined) {
        window.dualMidiBridge.setGlobalParameter('velocity_curve', idx / 4.0);
      }
    }
  });
}

function drawVelocityCurvePreview() {
  const canvas = document.getElementById('velocity-curve-preview');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function initPedalPolaritySetting() {
  const sel = document.getElementById('settings-pedal-polarity');
  if (!sel) return;
  const saved = localStorage.getItem('abd-eep-pedal-polarity') || 'norm-open';
  sel.value = saved;
  sel.addEventListener('change', function () {
    localStorage.setItem('abd-eep-pedal-polarity', this.value);
    if (window.dualMidiBridge) {
      window.dualMidiBridge.setGlobalParameter(
        'pedal_polarity',
        this.value === 'norm-closed' ? 1.0 : 0.0
      );
    }
  });
}

function initMidiChannelSetting() {
  const sel = document.getElementById('settings-midi-channel');
  if (!sel || !window.dualMidiBridge) return;
  sel.value = String(window.dualMidiBridge.midiChannel);
  sel.addEventListener('change', function () {
    const ch = parseInt(this.value);
    if (window.dualMidiBridge) {
      window.dualMidiBridge.midiChannel = ch;
      localStorage.setItem('abd-eep-midi-channel', String(ch));
      if (
        window.dualMidiBridge._hardwareInfo &&
        window.dualMidiBridge._hardwareInfo.globalDumpBytes
      ) {
        const cached = window.dualMidiBridge._hardwareInfo.globalDumpBytes;
        const devId = parseInt(window.dualMidiBridge._hardwareInfo.deviceId) || 0;
        const payload = new Uint8Array(cached);
        payload[0] = ((devId & 0x0f) << 4) | ((ch - 1) & 0x0f);
        window.dualMidiBridge.sendGlobalDump(Array.from(payload));
      }
    }
  });
  const saved = localStorage.getItem('abd-eep-midi-channel');
  if (saved) {
    sel.value = saved;
    if (window.dualMidiBridge) window.dualMidiBridge.midiChannel = parseInt(saved);
  }
}

function initMasterTuneSetting() {
  const sel = document.getElementById('settings-master-tune');
  if (!sel) return;
  const saved = localStorage.getItem('abd-eep-master-tune');
  if (saved) sel.value = saved;
  sel.addEventListener('change', function () {
    localStorage.setItem('abd-eep-master-tune', this.value);
    if (window.dualMidiBridge) {
      const idx = parseInt(this.value.match(/[+-]?\d+/));
      window.dualMidiBridge.setGlobalParameter('global_tune', (idx + 128) / 255.0);
    }
  });
}

function initTransposeSetting() {
  const sel = document.getElementById('settings-transpose');
  if (!sel) return;
  const saved = localStorage.getItem('abd-eep-transpose');
  if (saved) sel.value = saved;
  sel.addEventListener('change', function () {
    localStorage.setItem('abd-eep-transpose', this.value);
    if (window.dualMidiBridge) {
      const semitones = parseInt(this.value);
      window.dualMidiBridge.setGlobalParameter('transpose', (semitones + 48) / 96.0);
    }
  });
}

function initLcdContrastSetting() {
  const slider = document.getElementById('settings-lcd-contrast');
  const valEl = document.getElementById('settings-lcd-contrast-val');
  if (!slider) return;
  const saved = localStorage.getItem('abd-eep-lcd-contrast') || '70';
  slider.value = saved;
  if (valEl) valEl.textContent = saved + '%';
  function updateContrast(v) {
    // mock behavior or empty
  }
  window.updateLcdContrast = updateContrast;
  updateContrast(parseInt(saved));
  slider.addEventListener('input', function() {
    const val = this.value;
    localStorage.setItem('abd-eep-lcd-contrast', val);
    if (valEl) valEl.textContent = val + '%';
    updateContrast(parseInt(val));
    if (window.dualMidiBridge) {
      window.dualMidiBridge.setGlobalParameter('lcd_contrast', parseInt(val) / 100.0);
    }
  });
}

function _triggerInput(el, newValue) {
  el.value = newValue;
  const handlers = el._listeners.input || [];
  handlers.forEach((h) => h.call(el, { target: el }));
}

// ══════════════════════════════════════════════════════════════════
// Test suites
// ══════════════════════════════════════════════════════════════════

describe('initVelocityCurveSetting', () => {
  beforeEach(() => {
    _resetStorage();
    _resetElements();
    _resetBridge();
    _setupGlobals();
  });

  it('restores saved value from localStorage', () => {
    _storage['abd-eep-velocity-curve'] = 'hard';
    const sel = _createFakeElement('select', { id: 'settings-velocity-curve' });
    _registerElement('settings-velocity-curve', sel);
    _registerElement('velocity-curve-preview', _createFakeElement('canvas'));
    initVelocityCurveSetting();
    expect(sel.value).toBe('hard');
  });

  it('defaults to normal when no saved value', () => {
    const sel = _createFakeElement('select', { id: 'settings-velocity-curve' });
    _registerElement('settings-velocity-curve', sel);
    _registerElement('velocity-curve-preview', _createFakeElement('canvas'));
    initVelocityCurveSetting();
    expect(sel.value).toBe('normal');
  });

  it('change saves to localStorage and calls setGlobalParameter', () => {
    const sel = _createFakeElement('select', { id: 'settings-velocity-curve' });
    _registerElement('settings-velocity-curve', sel);
    _registerElement('velocity-curve-preview', _createFakeElement('canvas'));
    initVelocityCurveSetting();
    _triggerChange(sel, 'soft');

    expect(_storage['abd-eep-velocity-curve']).toBe('soft');
    expect(_bridge._setGlobalCalls).toHaveLength(1);
    expect(_bridge._setGlobalCalls[0].paramId).toBe('velocity_curve');
    expect(_bridge._setGlobalCalls[0].value).toBeCloseTo(0.25, 3);
  });

  it('change with linear sends 0.75', () => {
    const sel = _createFakeElement('select', { id: 'settings-velocity-curve' });
    _registerElement('settings-velocity-curve', sel);
    _registerElement('velocity-curve-preview', _createFakeElement('canvas'));
    initVelocityCurveSetting();
    _triggerChange(sel, 'linear');
    expect(_bridge._setGlobalCalls[0].value).toBeCloseTo(0.75, 3);
  });

  it('change with fixed sends 1.0', () => {
    const sel = _createFakeElement('select', { id: 'settings-velocity-curve' });
    _registerElement('settings-velocity-curve', sel);
    _registerElement('velocity-curve-preview', _createFakeElement('canvas'));
    initVelocityCurveSetting();
    _triggerChange(sel, 'fixed');
    expect(_bridge._setGlobalCalls[0].value).toBeCloseTo(1.0, 3);
  });

  it('handles unknown curve value gracefully (no setGlobalParameter)', () => {
    const sel = _createFakeElement('select', { id: 'settings-velocity-curve' });
    _registerElement('settings-velocity-curve', sel);
    _registerElement('velocity-curve-preview', _createFakeElement('canvas'));
    initVelocityCurveSetting();
    _triggerChange(sel, 'unknown');

    expect(_bridge._setGlobalCalls).toHaveLength(0);
    expect(_storage['abd-eep-velocity-curve']).toBe('unknown');
  });

  it('does nothing when select element missing', () => {
    initVelocityCurveSetting();
    expect(true).toBe(true); // no crash
  });
});

describe('initPedalPolaritySetting', () => {
  beforeEach(() => {
    _resetStorage();
    _resetElements();
    _resetBridge();
    _setupGlobals();
  });

  it('restores saved value', () => {
    _storage['abd-eep-pedal-polarity'] = 'norm-closed';
    const sel = _createFakeElement('select', { id: 'settings-pedal-polarity' });
    _registerElement('settings-pedal-polarity', sel);
    initPedalPolaritySetting();
    expect(sel.value).toBe('norm-closed');
  });

  it('defaults to norm-open', () => {
    const sel = _createFakeElement('select', { id: 'settings-pedal-polarity' });
    _registerElement('settings-pedal-polarity', sel);
    initPedalPolaritySetting();
    expect(sel.value).toBe('norm-open');
  });

  it('change to norm-closed sends 1.0', () => {
    const sel = _createFakeElement('select', { id: 'settings-pedal-polarity' });
    _registerElement('settings-pedal-polarity', sel);
    initPedalPolaritySetting();
    _triggerChange(sel, 'norm-closed');
    expect(_bridge._setGlobalCalls[0].paramId).toBe('pedal_polarity');
    expect(_bridge._setGlobalCalls[0].value).toBe(1.0);
  });

  it('change to norm-open sends 0.0', () => {
    const sel = _createFakeElement('select', { id: 'settings-pedal-polarity' });
    _registerElement('settings-pedal-polarity', sel);
    initPedalPolaritySetting();
    _triggerChange(sel, 'norm-open');
    expect(_bridge._setGlobalCalls[0].value).toBe(0.0);
  });

  it('still saves to localStorage without bridge', () => {
    const savedBridge = window.dualMidiBridge;
    window.dualMidiBridge = null;
    const sel = _createFakeElement('select', { id: 'settings-pedal-polarity' });
    _registerElement('settings-pedal-polarity', sel);
    initPedalPolaritySetting();
    _triggerChange(sel, 'norm-closed');
    expect(_storage['abd-eep-pedal-polarity']).toBe('norm-closed');
    window.dualMidiBridge = savedBridge;
  });
});

describe('initMidiChannelSetting', () => {
  beforeEach(() => {
    _resetStorage();
    _resetElements();
    _resetBridge();
    _setupGlobals();
  });

  it('sets value from bridge.midiChannel', () => {
    _bridge.midiChannel = 5;
    const sel = _createFakeElement('select', { id: 'settings-midi-channel' });
    _registerElement('settings-midi-channel', sel);
    initMidiChannelSetting();
    expect(sel.value).toBe('5');
  });

  it('restores saved value from localStorage', () => {
    _storage['abd-eep-midi-channel'] = '3';
    _bridge.midiChannel = 1;
    const sel = _createFakeElement('select', { id: 'settings-midi-channel' });
    _registerElement('settings-midi-channel', sel);
    initMidiChannelSetting();
    expect(sel.value).toBe('3');
    expect(_bridge.midiChannel).toBe(3);
  });

  it('change saves to localStorage and updates bridge', () => {
    const sel = _createFakeElement('select', { id: 'settings-midi-channel' });
    _registerElement('settings-midi-channel', sel);
    initMidiChannelSetting();
    _triggerChange(sel, '7');
    expect(_storage['abd-eep-midi-channel']).toBe('7');
    expect(_bridge.midiChannel).toBe(7);
  });

  it('change sends GlobalDump when hardware info available', () => {
    const sel = _createFakeElement('select', { id: 'settings-midi-channel' });
    _registerElement('settings-midi-channel', sel);
    _bridge._hardwareInfo = { globalDumpBytes: [0x00, 0x80, 0x30, 0x00, 0x00], deviceId: '0' };
    initMidiChannelSetting();
    _bridge._sendGlobalDumpCalled = false;
    _triggerChange(sel, '7');
    expect(_bridge._sendGlobalDumpCalled).toBe(true);
  });

  it('does not send GlobalDump without hardware info', () => {
    const sel = _createFakeElement('select', { id: 'settings-midi-channel' });
    _registerElement('settings-midi-channel', sel);
    _bridge._hardwareInfo = null;
    initMidiChannelSetting();
    _bridge._sendGlobalDumpCalled = false;
    _triggerChange(sel, '7');
    expect(_bridge._sendGlobalDumpCalled).toBe(false);
  });

  it('returns early without bridge', () => {
    const savedBridge = window.dualMidiBridge;
    window.dualMidiBridge = null;
    const sel = _createFakeElement('select', { id: 'settings-midi-channel' });
    _registerElement('settings-midi-channel', sel);
    initMidiChannelSetting();
    expect(sel.value).toBe('');
    window.dualMidiBridge = savedBridge;
  });
});

describe('initMasterTuneSetting', () => {
  beforeEach(() => {
    _resetStorage();
    _resetElements();
    _resetBridge();
    _setupGlobals();
  });

  it('restores saved value', () => {
    _storage['abd-eep-master-tune'] = '+12¢';
    const sel = _createFakeElement('select', { id: 'settings-master-tune' });
    _registerElement('settings-master-tune', sel);
    initMasterTuneSetting();
    expect(sel.value).toBe('+12¢');
  });

  it('change with +12¢ sends ~0.549', () => {
    const sel = _createFakeElement('select', { id: 'settings-master-tune' });
    _registerElement('settings-master-tune', sel);
    initMasterTuneSetting();
    _triggerChange(sel, '+12¢');
    expect(_bridge._setGlobalCalls[0].paramId).toBe('global_tune');
    expect(_bridge._setGlobalCalls[0].value).toBeCloseTo(0.549, 3);
  });

  it('change with -24¢ sends ~0.408', () => {
    const sel = _createFakeElement('select', { id: 'settings-master-tune' });
    _registerElement('settings-master-tune', sel);
    initMasterTuneSetting();
    _triggerChange(sel, '-24¢');
    expect(_bridge._setGlobalCalls[0].value).toBeCloseTo(0.408, 3);
  });

  it('change with 0¢ sends ~0.502', () => {
    const sel = _createFakeElement('select', { id: 'settings-master-tune' });
    _registerElement('settings-master-tune', sel);
    initMasterTuneSetting();
    _triggerChange(sel, '0¢');
    expect(_bridge._setGlobalCalls[0].value).toBeCloseTo(0.502, 3);
  });
});

describe('initTransposeSetting', () => {
  beforeEach(() => {
    _resetStorage();
    _resetElements();
    _resetBridge();
    _setupGlobals();
  });

  it('restores saved value', () => {
    _storage['abd-eep-transpose'] = '5';
    const sel = _createFakeElement('select', { id: 'settings-transpose' });
    _registerElement('settings-transpose', sel);
    initTransposeSetting();
    expect(sel.value).toBe('5');
  });

  it('change with +3 sends ~0.531', () => {
    const sel = _createFakeElement('select', { id: 'settings-transpose' });
    _registerElement('settings-transpose', sel);
    initTransposeSetting();
    _triggerChange(sel, '3');
    expect(_bridge._setGlobalCalls[0].paramId).toBe('transpose');
    expect(_bridge._setGlobalCalls[0].value).toBeCloseTo(0.53125, 4);
  });

  it('change with -12 sends 0.375', () => {
    const sel = _createFakeElement('select', { id: 'settings-transpose' });
    _registerElement('settings-transpose', sel);
    initTransposeSetting();
    _triggerChange(sel, '-12');
    expect(_bridge._setGlobalCalls[0].value).toBeCloseTo(0.375, 3);
  });

  it('change with +48 sends 1.0', () => {
    const sel = _createFakeElement('select', { id: 'settings-transpose' });
    _registerElement('settings-transpose', sel);
    initTransposeSetting();
    _triggerChange(sel, '48');
    expect(_bridge._setGlobalCalls[0].value).toBeCloseTo(1.0, 3);
  });

  it('change with -48 sends 0.0', () => {
    const sel = _createFakeElement('select', { id: 'settings-transpose' });
    _registerElement('settings-transpose', sel);
    initTransposeSetting();
    _triggerChange(sel, '-48');
    expect(_bridge._setGlobalCalls[0].value).toBeCloseTo(0.0, 3);
  });
});

describe('drawVelocityCurvePreview', () => {
  beforeEach(() => {
    _resetElements();
    _setupGlobals();
  });

  it('does not crash when canvas exists', () => {
    const canvas = _createFakeElement('canvas');
    _registerElement('velocity-curve-preview', canvas);
    drawVelocityCurvePreview();
    expect(canvas.getContext('2d')._calls.length).toBeGreaterThan(0);
  });

  it('does not crash when canvas missing', () => {
    drawVelocityCurvePreview();
    expect(true).toBe(true); // no crash
  });
});

describe('integration: velocity curve change triggers preview + SysEx', () => {
  beforeEach(() => {
    _resetStorage();
    _resetElements();
    _resetBridge();
    _setupGlobals();
  });

  it('change sends SysEx and saves to localStorage', () => {
    const sel = _createFakeElement('select', { id: 'settings-velocity-curve' });
    const canvas = _createFakeElement('canvas');
    _registerElement('settings-velocity-curve', sel);
    _registerElement('velocity-curve-preview', canvas);

    initVelocityCurveSetting();
    _triggerChange(sel, 'hard');

    expect(_bridge._setGlobalCalls).toHaveLength(1);
    expect(_bridge._setGlobalCalls[0].value).toBeCloseTo(0.5, 3);
    expect(_storage['abd-eep-velocity-curve']).toBe('hard');
  });
});

describe('initLcdContrastSetting', () => {
  beforeEach(() => {
    _resetStorage();
    _resetElements();
    _resetBridge();
    _setupGlobals();
  });

  it('initializes from default or localStorage and updates contrast', () => {
    const slider = _createFakeElement('input', { id: 'settings-lcd-contrast' });
    const valEl = _createFakeElement('span', { id: 'settings-lcd-contrast-val' });
    _registerElement('settings-lcd-contrast', slider);
    _registerElement('settings-lcd-contrast-val', valEl);

    _storage['abd-eep-lcd-contrast'] = '85';
    initLcdContrastSetting();

    expect(slider.value).toBe('85');
    expect(valEl.textContent).toBe('85%');
  });

  it('slider input event saves to localStorage and calls setGlobalParameter', () => {
    const slider = _createFakeElement('input', { id: 'settings-lcd-contrast' });
    const valEl = _createFakeElement('span', { id: 'settings-lcd-contrast-val' });
    _registerElement('settings-lcd-contrast', slider);
    _registerElement('settings-lcd-contrast-val', valEl);

    initLcdContrastSetting();

    slider.value = '60';
    _triggerInput(slider, '60');

    expect(_storage['abd-eep-lcd-contrast']).toBe('60');
    expect(valEl.textContent).toBe('60%');
    expect(_bridge._setGlobalCalls).toHaveLength(1);
    expect(_bridge._setGlobalCalls[0].paramId).toBe('lcd_contrast');
    expect(_bridge._setGlobalCalls[0].value).toBeCloseTo(0.6, 3);
  });
});
