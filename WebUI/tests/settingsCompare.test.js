/**
 * Unit tests for settings_compare.js — Compare Mode (snapshot/restore, diff count, LCD indicators)
 *
 * Run with: npx vitest run WebUI/tests/settingsCompare.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ══════════════════════════════════════════════════════════════════
// Mock state helpers
// ══════════════════════════════════════════════════════════════════

let _storage = {};
let _elementRegistry = {};
let _bridge;

function _resetStorage() { _storage = {}; }
function _resetElements() { _elementRegistry = {}; }

function _registerElement(id, el) { _elementRegistry[id] = el; }

function _resetBridge() {
  _bridge = {
    parameterCache: {
      'osc1_saw_enable': 1.0,
      'vcf_cutoff': 0.5,
      'vcf_resonance': 0.3,
      'vca_level': 0.8,
      'env1_attack': 0.1,
      'env1_decay': 0.4,
    },
    onParameterChangedCallbacks: [],
    onParameterChanged(cb) {
      this.onParameterChangedCallbacks.push(cb);
    },
    _connected: true,
    getHardwareInfo() {
      return { deviceId: '0', midiChannel: 1, connectionType: 'USB' };
    },
  };
}

function _setupGlobals() {
  const mockDocument = {
    getElementById: (id) => _elementRegistry[id] || null,
    querySelector: (sel) => null,
    querySelectorAll: () => [],
    documentElement: { style: { setProperty: () => {} } },
    body: { dataset: {} },
    createElement: (tag) => {
      const el = _createFakeElement(tag, {});
      return el;
    },
  };
  const mockLocalStorage = {
    getItem: (k) => (_storage[k] !== undefined ? _storage[k] : null),
    setItem: (k, v) => { _storage[k] = String(v); },
    removeItem: (k) => { delete _storage[k]; },
    clear: () => { _storage = {}; },
  };
  vi.stubGlobal('document', mockDocument);
  vi.stubGlobal('localStorage', mockLocalStorage);
  vi.stubGlobal('window', {
    dualMidiBridge: _bridge,
    localStorage: mockLocalStorage,
    document: mockDocument,
    lcdSafeUpdate: vi.fn(),
    updateLfoSlidersFromCurrentPreset: vi.fn(),
    updateEnvSlidersFromCurrentPreset: vi.fn(),
    updateOscSlidersFromCurrentPreset: vi.fn(),
    loadedBanks: {
      '0': [{ name: 'TEST PATCH' }],
    },
    currentActiveBank: '0',
    currentActivePatchIndex: 0,
    triggerMidiDump: vi.fn(),
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
    disabled: false,
    title: '',
    className: '',
    style: {
      _props: {},
      get display() { return this._props.display; },
      set display(val) { this._props.display = val; },
    },
    dataset: {},
    classList: {
      _classes: [],
      add(c) { if (!this._classes.includes(c)) {this._classes.push(c);} },
      remove(c) { this._classes = this._classes.filter((x) => x !== c); },
      contains(c) { return this._classes.includes(c); },
    },
    getAttribute(name) { return this._attrs[name]; },
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
    closest() { return null; },
    querySelectorAll: () => [],
    querySelector: () => null,
    click() {
      if (this._listeners.click) {
        this._listeners.click.forEach(h => h({ preventDefault: () => {}, target: this }));
      }
    },
  };
  return el;
}

// ══════════════════════════════════════════════════════════════════
// Functions under test (from settings_compare.js)
// ══════════════════════════════════════════════════════════════════

let compareActive = false;
let preCompareSnapshot = null;
let preComparePatchName = '';

function _resetCompareState() {
  compareActive = false;
  preCompareSnapshot = null;
  preComparePatchName = '';
}

function _computeCompareDiff(snapshotStr) {
  if (!snapshotStr || !window.dualMidiBridge) {return 0;}
  try {
    const snap = JSON.parse(snapshotStr);
    const cache = window.dualMidiBridge.parameterCache;
    let count = 0;
    for (const paramId in snap) {
      if (snap.hasOwnProperty(paramId)) {
        const cached = cache[paramId];
        const snapped = snap[paramId];
        if (typeof snapped === 'object' || typeof cached === 'object') {continue;}
        if (cached === undefined || Math.abs(cached - snapped) > 0.001) {
          count++;
        }
      }
    }
    return count;
  } catch (e) {
    return 0;
  }
}

function isCompareActive() {
  return compareActive;
}

function _exitCompareMode() {
  if (!compareActive) {return;}
  const lcdText = document.getElementById('lcd-text');
  const compareBtn = document.getElementById('programmer-compare-btn');

  if (preCompareSnapshot && window.dualMidiBridge) {
    try {
      const cache = JSON.parse(preCompareSnapshot);
      const paramIds = Object.keys(cache);
      paramIds.forEach(function(paramId) {
        const val = cache[paramId];
        window.dualMidiBridge.parameterCache[paramId] = val;
        window.dualMidiBridge.onParameterChangedCallbacks.forEach(function(cb) {
          try { cb(paramId, val); } catch(e) {}
        });
      });

      if (typeof window.updateLfoSlidersFromCurrentPreset === 'function') {window.updateLfoSlidersFromCurrentPreset();}
      if (typeof window.updateEnvSlidersFromCurrentPreset === 'function') {window.updateEnvSlidersFromCurrentPreset();}
      if (typeof window.updateOscSlidersFromCurrentPreset === 'function') {window.updateOscSlidersFromCurrentPreset();}

      if (lcdText && preComparePatchName) {
        const html = '<span class="lcd-label">COMPARE — RESTORED</span><br>'
          + '<strong class="text-accent-green">' + preComparePatchName.toUpperCase() + '</strong><br>'
          + '<span class="lcd-compare-original">EDITED BUFFER RESTORED</span>';
        window.lcdSafeUpdate(lcdText, html);
      }
    } catch (e) {
      // Logger.warn('[Compare] Error restoring snapshot:', e);
    }
  }

  compareActive = false;
  preCompareSnapshot = null;
  if (compareBtn) {
    compareBtn.classList.remove('active');
    compareBtn.textContent = 'Compare';
  }
}

function toggleCompareMode() {
  const lcdText = document.getElementById('lcd-text');
  const compareBtn = document.getElementById('programmer-compare-btn');
  if (!lcdText) {return;}

  if (!compareActive) {
    const bridge = window.dualMidiBridge;
    if (!bridge) {return;}

    const activeBank = window.loadedBanks[window.currentActiveBank];
    const activePatch = activeBank && activeBank[window.currentActivePatchIndex];
    preComparePatchName = activePatch ? activePatch.name : 'UNKNOWN PATCH';
    preCompareSnapshot = JSON.stringify(bridge.parameterCache);

    const initialDiff = _computeCompareDiff(preCompareSnapshot);
    if (activePatch && activePatch.unpackedBytes && window.triggerMidiDump) {
      window.triggerMidiDump(activePatch);
    }

    compareActive = true;
    if (compareBtn) {
      compareBtn.classList.add('active');
      compareBtn.textContent = 'Compare (' + initialDiff + ')';
    }

    lcdText.innerHTML = '<span class="lcd-label">COMPARE MODE</span><br>'
      + '<strong>' + preComparePatchName.toUpperCase() + '</strong><br>'
      + '<span class="lcd-compare-original">ORIGINAL PRESET</span>';
  } else {
    _exitCompareMode();
  }
}

// ══════════════════════════════════════════════════════════════════
// Tests
// ══════════════════════════════════════════════════════════════════

describe('_computeCompareDiff', () => {
  beforeEach(() => {
    _resetStorage(); _resetElements(); _resetBridge(); _setupGlobals();
    _resetCompareState();
  });

  it('returns 0 when no snapshot provided', () => {
    expect(_computeCompareDiff(null)).toBe(0);
    expect(_computeCompareDiff('')).toBe(0);
  });

  it('returns 0 when bridge is not available', () => {
    vi.stubGlobal('window', { dualMidiBridge: null });
    expect(_computeCompareDiff('{}')).toBe(0);
  });

  it('returns 0 when snapshot matches cache exactly', () => {
    const snapshot = JSON.stringify(_bridge.parameterCache);
    expect(_computeCompareDiff(snapshot)).toBe(0);
  });

  it('detects changed parameters', () => {
    const snapshot = JSON.stringify(_bridge.parameterCache);
    // Change one parameter in cache
    _bridge.parameterCache['vcf_cutoff'] = 0.8;
    expect(_computeCompareDiff(snapshot)).toBe(1);
  });

  it('detects multiple changed parameters', () => {
    const snapshot = JSON.stringify(_bridge.parameterCache);
    _bridge.parameterCache['vcf_cutoff'] = 0.8;
    _bridge.parameterCache['vca_level'] = 0.2;
    expect(_computeCompareDiff(snapshot)).toBe(2);
  });

  it('handles missing parameters in cache (undefined)', () => {
    const snapshot = JSON.stringify({
      'vcf_cutoff': 0.5,
      'new_param': 0.9,
    });
    expect(_computeCompareDiff(snapshot)).toBe(1); // new_param is undefined in cache
  });

  it('ignores object type values', () => {
    const cacheWithObject = JSON.parse(JSON.stringify(_bridge.parameterCache));
    cacheWithObject['mod_matrix'] = { some: 'object' };
    const snapshot = JSON.stringify(cacheWithObject);
    // Should not count the object param
    expect(_computeCompareDiff(snapshot)).toBe(0);
  });

  it('returns 0 for malformed JSON snapshot', () => {
    expect(_computeCompareDiff('not-json')).toBe(0);
  });
});

describe('toggleCompareMode', () => {
  beforeEach(() => {
    _resetStorage(); _resetElements(); _resetBridge(); _setupGlobals();
    _resetCompareState();
    _bridge.parameterCache = {
      'osc1_saw_enable': 1.0,
      'vcf_cutoff': 0.5,
      'vca_level': 0.8,
    };
  });

  it('does nothing when lcd-text element is missing', () => {
    toggleCompareMode();
    expect(compareActive).toBe(false);
  });

  it('activates compare mode and captures snapshot', () => {
    const lcdText = _createFakeElement('div', { id: 'lcd-text' });
    const compareBtn = _createFakeElement('button', { id: 'programmer-compare-btn' });
    _registerElement('lcd-text', lcdText);
    _registerElement('programmer-compare-btn', compareBtn);

    toggleCompareMode();

    expect(compareActive).toBe(true);
    expect(preCompareSnapshot).toBe(JSON.stringify(_bridge.parameterCache));
    expect(compareBtn.classList.contains('active')).toBe(true);
    expect(compareBtn.textContent).toContain('Compare (');
    expect(lcdText.innerHTML).toContain('COMPARE MODE');
    expect(lcdText.innerHTML).toContain('TEST PATCH');
  });

  it('calls triggerMidiDump when active patch has unpackedBytes', () => {
    const lcdText = _createFakeElement('div', { id: 'lcd-text' });
    const compareBtn = _createFakeElement('button', { id: 'programmer-compare-btn' });
    _registerElement('lcd-text', lcdText);
    _registerElement('programmer-compare-btn', compareBtn);

    // Add unpackedBytes to the patch
    window.loadedBanks['0'][0].unpackedBytes = [0x00, 0x01, 0x02];

    toggleCompareMode();

    expect(window.triggerMidiDump).toHaveBeenCalledTimes(1);
    expect(window.triggerMidiDump).toHaveBeenCalledWith(window.loadedBanks['0'][0]);
  });

  it('deactivates compare mode and restores snapshot on second call', () => {
    const lcdText = _createFakeElement('div', { id: 'lcd-text' });
    const compareBtn = _createFakeElement('button', { id: 'programmer-compare-btn' });
    _registerElement('lcd-text', lcdText);
    _registerElement('programmer-compare-btn', compareBtn);

    // Activate
    toggleCompareMode();
    expect(compareActive).toBe(true);

    // Modify the cache
    _bridge.parameterCache['vcf_cutoff'] = 0.9;

    // Deactivate
    toggleCompareMode();

    expect(compareActive).toBe(false);
    expect(_bridge.parameterCache['vcf_cutoff']).toBe(0.5); // restored from snapshot
    expect(compareBtn.textContent).toBe('Compare');
    expect(compareBtn.classList.contains('active')).toBe(false);
  });

  it('calls update sliders when exiting compare mode', () => {
    const lcdText = _createFakeElement('div', { id: 'lcd-text' });
    const compareBtn = _createFakeElement('button', { id: 'programmer-compare-btn' });
    _registerElement('lcd-text', lcdText);
    _registerElement('programmer-compare-btn', compareBtn);

    toggleCompareMode(); // activate
    toggleCompareMode(); // deactivate

    expect(window.updateLfoSlidersFromCurrentPreset).toHaveBeenCalled();
    expect(window.updateEnvSlidersFromCurrentPreset).toHaveBeenCalled();
    expect(window.updateOscSlidersFromCurrentPreset).toHaveBeenCalled();
  });

  it('updates LCD text with RESTORED message on exit', () => {
    const lcdText = _createFakeElement('div', { id: 'lcd-text' });
    const compareBtn = _createFakeElement('button', { id: 'programmer-compare-btn' });
    _registerElement('lcd-text', lcdText);
    _registerElement('programmer-compare-btn', compareBtn);

    toggleCompareMode(); // activate
    toggleCompareMode(); // deactivate

    expect(window.lcdSafeUpdate).toHaveBeenCalled();
    const updateCall = window.lcdSafeUpdate.mock.calls[0];
    expect(updateCall[1]).toContain('EDITED BUFFER RESTORED');
  });
});

describe('isCompareActive', () => {
  beforeEach(() => {
    _resetCompareState();
  });

  it('returns false when compare mode is not active', () => {
    expect(isCompareActive()).toBe(false);
  });

  it('returns true when compare mode is active', () => {
    compareActive = true;
    expect(isCompareActive()).toBe(true);
  });
});

describe('_exitCompareMode', () => {
  beforeEach(() => {
    _resetStorage(); _resetElements(); _resetBridge(); _setupGlobals();
    _resetCompareState();
  });

  it('does nothing when compare mode is not active', () => {
    _exitCompareMode();
    expect(preCompareSnapshot).toBeNull();
  });

  it('restores all parameters from snapshot and resets UI', () => {
    compareActive = true;
    preCompareSnapshot = JSON.stringify(_bridge.parameterCache);
    preComparePatchName = 'TEST PATCH';
    const lcdText = _createFakeElement('div', { id: 'lcd-text' });
    const compareBtn = _createFakeElement('button', { id: 'programmer-compare-btn' });
    _registerElement('lcd-text', lcdText);
    _registerElement('programmer-compare-btn', compareBtn);

    // Modify cache before exit
    _bridge.parameterCache['vcf_cutoff'] = 0.99;
    _bridge.parameterCache['vca_level'] = 0.01;

    _exitCompareMode();

    // Cache should be restored
    expect(_bridge.parameterCache['vcf_cutoff']).toBe(0.5);
    expect(_bridge.parameterCache['vca_level']).toBe(0.8);
    expect(compareActive).toBe(false);
    expect(preCompareSnapshot).toBeNull();
    expect(compareBtn.textContent).toBe('Compare');
    expect(compareBtn.classList.contains('active')).toBe(false);
  });

  it('calls onParameterChanged callbacks when restoring', () => {
    const callback = vi.fn();
    _bridge.onParameterChangedCallbacks.push(callback);

    compareActive = true;
    preCompareSnapshot = JSON.stringify(_bridge.parameterCache);
    preComparePatchName = 'TEST PATCH';
    const lcdText = _createFakeElement('div', { id: 'lcd-text' });
    const compareBtn = _createFakeElement('button', { id: 'programmer-compare-btn' });
    _registerElement('lcd-text', lcdText);
    _registerElement('programmer-compare-btn', compareBtn);

    _exitCompareMode();

    // Should have called the callback for each parameter
    expect(callback.mock.calls.length).toBe(Object.keys(_bridge.parameterCache).length);
  });

  it('handles missing LCD text element gracefully', () => {
    compareActive = true;
    preCompareSnapshot = JSON.stringify(_bridge.parameterCache);
    preComparePatchName = 'TEST PATCH';

    _exitCompareMode();
    expect(compareActive).toBe(false);
  });

  it('handles missing compare button element gracefully', () => {
    compareActive = true;
    preCompareSnapshot = JSON.stringify(_bridge.parameterCache);
    preComparePatchName = 'TEST PATCH';
    const lcdText = _createFakeElement('div', { id: 'lcd-text' });
    _registerElement('lcd-text', lcdText);

    _exitCompareMode();
    expect(compareActive).toBe(false);
  });
});
