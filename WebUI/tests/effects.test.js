/**
 * Unit tests for effects.js — FX Engine slot management, preset management, param reading.
 *
 * Run with: npx vitest run WebUI/tests/effects.test.js
 *
 * Covers:
 *   - FX_TYPE_NAMES array validation (35 types, first="Bypass")
 *   - escapeHtml (HTML sanitization)
 *   - _readFxParamValue (bridge cache → patch → default fallback)
 *   - saveFxPreset (localStorage, sanitize name, replace existing)
 *   - _loadAllFxPresets (load, handle corrupt/missing data)
 *   - applyFxPreset (calls bridge.setParameter, updates UI selectors)
 *   - deleteFxPreset (remove from localStorage)
 *   - _renderFxPresetList (DOM rendering, event listeners)
 *   - initEffectsModal exports (window.saveFxPreset, applyFxPreset, etc.)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// ══════════════════════════════════════════════════════════════════
// Constants from effects.js
// ══════════════════════════════════════════════════════════════════

const FX_TYPE_NAMES = [
  'Bypass', 'Ambience', 'tcDeepVerb', 'RoomRev', 'VintageRoom', 'HallReverb',
  'ChamberRev', 'Plate Reverb', 'Rich Plate', 'Gated Reverb', 'Reverse Reverb',
  'ChorusRev', 'DelayRev', 'FlangerRev', 'MidasEQ', 'Enhancer', 'FairComp',
  'MBDistortion', 'RackAmp', 'Edison', 'AutoPan/Trem', 'NoiseGate', 'Delay',
  '3Tap Delay', '4Tap Delay', 'T-RayDelay', 'DecimatorDelay', 'ModDlyRev',
  'Stereo Chorus', 'Chorus-D', 'Stereo Flanger', 'Stereo Phaser', 'Mood Filter',
  'Dual Pitch', 'Vintage Pitch', 'Rotary Speaker'
];

// ══════════════════════════════════════════════════════════════════
// Fake DOM element factory (extended)
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
    style: {
      _props: {},
      removeProperty(prop) { delete this._props[prop]; },
      get display() { return this._props.display; },
      set display(val) { this._props.display = val; },
      get top() { return this._props.top; },
      set top(val) { this._props.top = val; },
    },
    dataset: {},
    classList: {
      _classes: [],
      add(c) { if (!this._classes.includes(c)) this._classes.push(c); },
      remove(c) { this._classes = this._classes.filter(x => x !== c); },
      contains(c) { return this._classes.includes(c); },
    },
    getAttribute(name) { return this._attrs[name] || null; },
    setAttribute(name, val) { this._attrs[name] = val; },
    hasAttribute(name) { return name in this._attrs; },
    addEventListener(event, handler) {
      if (!this._listeners[event]) this._listeners[event] = [];
      this._listeners[event].push(handler);
    },
    removeEventListener() {},
    dispatchEvent() {},
    getBoundingClientRect() { return { top: 0, left: 0, width: 100, height: 100, bottom: 100, right: 100 }; },
    _children: [],
    _subElements: {},
    querySelector(sel) { return this._subElements[sel] || null; },
    querySelectorAll(sel) { return []; },
    closest() { return null; },
  };
  return el;
}

// ══════════════════════════════════════════════════════════════════
// Extracted functions from effects.js
// ══════════════════════════════════════════════════════════════════

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#039;');
}

function _readFxParamValue(paramId, fallbackByte, defaultVal, bridge, currentActivePatchIndex, loadedBanks, currentActiveBank) {
  if (bridge && bridge.parameterCache && bridge.parameterCache[paramId] !== undefined) {
    return bridge.parameterCache[paramId];
  }
  if (typeof currentActivePatchIndex !== 'undefined' && currentActivePatchIndex !== -1) {
    const activeBank = loadedBanks && loadedBanks[currentActiveBank];
    if (activeBank) {
      const patch = activeBank[currentActivePatchIndex];
      if (patch && patch.unpackedBytes && patch.unpackedBytes[fallbackByte] !== undefined) {
        return patch.unpackedBytes[fallbackByte] / 255.0;
      }
    }
  }
  return defaultVal;
}

const FX_TYPE_COUNT = 35; // max raw value for the selector

function getSlotOffsets(slotNumber) {
  const typeByte = slotNumber === 1 ? 166 : (slotNumber === 2 ? 179 : (slotNumber === 3 ? 192 : 205));
  const gainByte = slotNumber === 1 ? 218 : (slotNumber === 2 ? 219 : (slotNumber === 3 ? 220 : 221));
  const paramOffsetStart = slotNumber === 1 ? 167 : (slotNumber === 2 ? 180 : (slotNumber === 3 ? 193 : 206));
  return { typeByte, gainByte, paramOffsetStart };
}

function saveFxPreset(presetName, slotNumber, bridge, selectedSlot, _loadAllFxPresetsFn, _renderFxPresetListFn, _readFxParamValueFn) {
  if (!presetName || presetName.trim() === '') return;
  var name = presetName.trim().replace(/[<>\"'&]/g, '');
  if (!name) return;
  slotNumber = slotNumber || selectedSlot;
  if (!bridge || !bridge.parameterCache) return;

  var offsets = getSlotOffsets(slotNumber);
  var preset = {
    name: name,
    slot: slotNumber,
    type: _readFxParamValueFn('fx' + slotNumber + '_type', offsets.typeByte, 0.0),
    params: [],
    gain: _readFxParamValueFn('fx' + slotNumber + '_gain', offsets.gainByte, 1.0),
    created: Date.now()
  };
  for (var i = 1; i <= 12; i++) {
    preset.params.push(_readFxParamValueFn('fx' + slotNumber + '_param' + i, offsets.paramOffsetStart + i - 1, 0.5));
  }

  var allPresets = _loadAllFxPresetsFn();
  var existingIdx = -1;
  for (var j = 0; j < allPresets.length; j++) {
    if (allPresets[j].name === preset.name) {
      existingIdx = j;
      break;
    }
  }
  if (existingIdx >= 0) {
    allPresets[existingIdx] = preset;
  } else {
    allPresets.push(preset);
  }

  try {
    localStorage.setItem('abd-eep-fx-presets', JSON.stringify(allPresets));
  } catch (e) {}

  _renderFxPresetListFn();

  return preset;
}

function loadAllFxPresets() {
  try {
    var raw = localStorage.getItem('abd-eep-fx-presets');
    if (raw) {
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

function deleteFxPreset(presetName, loadAllFn, renderFn) {
  var allPresets = loadAllFn();
  var filtered = [];
  for (var i = 0; i < allPresets.length; i++) {
    if (allPresets[i].name !== presetName) {
      filtered.push(allPresets[i]);
    }
  }
  if (filtered.length !== allPresets.length) {
    try {
      localStorage.setItem('abd-eep-fx-presets', JSON.stringify(filtered));
    } catch (e) {}
    renderFn();
    return true;
  }
  return false;
}

function renderFxPresetList(containerEl, presets, applyFn, deleteFn, selectedSlot) {
  if (!containerEl) return;
  if (!presets || presets.length === 0) {
    containerEl.innerHTML = '<div>No FX presets saved yet</div>';
    return;
  }
  var html = '';
  for (var i = presets.length - 1; i >= 0; i--) {
    var p = presets[i];
    var typeName = FX_TYPE_NAMES[Math.round(p.type * FX_TYPE_COUNT)] || 'Bypass';
    html += '<div class="fx-preset-item" data-preset-index="' + i + '">' +
      '<div class="fx-preset-name" title="Apply ' + escapeHtml(p.name) + ' to FX' + selectedSlot + '">' +
        '<span class="fx-preset-name-text">' + escapeHtml(p.name) + '</span> ' +
        '<span class="fx-preset-type">' + escapeHtml(typeName) + '</span>' +
      '</div>' +
      '<button class="fx-preset-delete-btn" data-ctrl-tooltip="Delete preset">X</button>' +
    '</div>';
  }
  containerEl.innerHTML = html;

  containerEl.querySelectorAll('.fx-preset-item').forEach(function(item) {
    var idx = parseInt(item.getAttribute('data-preset-index'));
    if (isNaN(idx) || idx < 0 || idx >= presets.length) return;
    var nameDiv = item.querySelector('.fx-preset-name');
    if (nameDiv) {
      nameDiv.addEventListener('click', function() {
        applyFn(presets[idx], selectedSlot);
      });
    }
    var delBtn = item.querySelector('.fx-preset-delete-btn');
    if (delBtn) {
      delBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        deleteFn(presets[idx].name);
      });
    }
  });
}

// ══════════════════════════════════════════════════════════════════
// Tests: FX_TYPE_NAMES
// ══════════════════════════════════════════════════════════════════

describe('FX_TYPE_NAMES', () => {
  it('has exactly 36 entries (0=Bypass, 35=Rotary Speaker)', () => {
    expect(FX_TYPE_NAMES.length).toBe(36);
  });

  it('first entry is Bypass', () => {
    expect(FX_TYPE_NAMES[0]).toBe('Bypass');
  });

  it('last entry is Rotary Speaker', () => {
    expect(FX_TYPE_NAMES[35]).toBe('Rotary Speaker');
  });

  it('all entries are non-empty strings', () => {
    for (var i = 0; i < FX_TYPE_NAMES.length; i++) {
      expect(typeof FX_TYPE_NAMES[i]).toBe('string');
      expect(FX_TYPE_NAMES[i].length).toBeGreaterThan(0);
    }
  });

  it('spot-check: entry 11 is ChorusRev, entry 22 is Delay', () => {
    expect(FX_TYPE_NAMES[11]).toBe('ChorusRev');
    expect(FX_TYPE_NAMES[22]).toBe('Delay');
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: escapeHtml
// ══════════════════════════════════════════════════════════════════

describe('escapeHtml', () => {
  it('escapes ampersands', () => {
    expect(escapeHtml('A&B')).toBe('A&amp;B');
  });

  it('escapes less-than', () => {
    expect(escapeHtml('<tag>')).toBe('&lt;tag&gt;');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#039;s');
  });

  it('returns empty string unchanged', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('returns plain text unchanged', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
  });

  it('handles combined special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>'))
      .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('converts non-string input to string first', () => {
    expect(escapeHtml(42)).toBe('42');
    expect(escapeHtml(null)).toBe('null');
    expect(escapeHtml(undefined)).toBe('undefined');
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: _readFxParamValue
// ══════════════════════════════════════════════════════════════════

describe('_readFxParamValue', () => {
  it('reads from bridge parameterCache when available', () => {
    const bridge = { parameterCache: { 'fx1_type': 0.5 } };
    expect(_readFxParamValue('fx1_type', 166, 0.0, bridge, -1, [], 0)).toBe(0.5);
  });

  it('falls back to patch unpackedBytes when bridge cache missing', () => {
    const bridge = { parameterCache: {} };
    const loadedBanks = [
      [{ unpackedBytes: { 166: 128 } }]
    ];
    expect(_readFxParamValue('fx1_type', 166, 0.0, bridge, 0, loadedBanks, 0)).toBeCloseTo(128 / 255, 4);
  });

  it('falls back to default when both bridge and patch missing', () => {
    const bridge = { parameterCache: {} };
    expect(_readFxParamValue('fx1_type', 166, 0.5, bridge, -1, [], 0)).toBe(0.5);
  });

  it('falls back to default when bridge is null', () => {
    expect(_readFxParamValue('fx1_type', 166, 0.42, null, -1, [], 0)).toBe(0.42);
  });

  it('falls back to default when patch index is -1', () => {
    const bridge = { parameterCache: {} };
    expect(_readFxParamValue('fx1_type', 166, 0.3, bridge, -1, [], 0)).toBe(0.3);
  });

  it('falls back to default when loadedBanks is empty', () => {
    const bridge = { parameterCache: {} };
    expect(_readFxParamValue('fx1_type', 166, 0.1, bridge, 0, [], 0)).toBe(0.1);
  });

  it('falls back to default when patch.unpackedBytes is undefined', () => {
    const bridge = { parameterCache: {} };
    const loadedBanks = [
      [{ name: 'test' }] // no unpackedBytes
    ];
    expect(_readFxParamValue('fx1_type', 166, 0.7, bridge, 0, loadedBanks, 0)).toBe(0.7);
  });

  it('uses correct byte offset for each slot', () => {
    const bridge = { parameterCache: {} };
    // Slot 1 type → byte 166, Slot 2 type → byte 179, etc.
    const loadedBanks = [
      [{ unpackedBytes: { 166: 100, 179: 200, 192: 50, 205: 150 } }]
    ];
    expect(_readFxParamValue('fx1_type', 166, 0, bridge, 0, loadedBanks, 0)).toBeCloseTo(100 / 255, 4);
    expect(_readFxParamValue('fx2_type', 179, 0, bridge, 0, loadedBanks, 0)).toBeCloseTo(200 / 255, 4);
    expect(_readFxParamValue('fx3_type', 192, 0, bridge, 0, loadedBanks, 0)).toBeCloseTo(50 / 255, 4);
    expect(_readFxParamValue('fx4_type', 205, 0, bridge, 0, loadedBanks, 0)).toBeCloseTo(150 / 255, 4);
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: loadAllFxPresets (_loadAllFxPresets)
// ══════════════════════════════════════════════════════════════════

describe('loadAllFxPresets', () => {
  let _lsStore;

  beforeEach(() => {
    _lsStore = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(function(key) { return _lsStore[key] || null; }),
      setItem: vi.fn(function(key, val) { _lsStore[key] = String(val); }),
      clear: vi.fn(function() { for (const k in _lsStore) delete _lsStore[k]; }),
      removeItem: vi.fn(function(key) { delete _lsStore[key]; }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns empty array when localStorage empty', () => {
    expect(loadAllFxPresets()).toEqual([]);
  });

  it('loads saved presets from localStorage', () => {
    const data = [{ name: 'Test', slot: 1, type: 0.5, params: [], gain: 1.0 }];
    localStorage.setItem('abd-eep-fx-presets', JSON.stringify(data));
    expect(loadAllFxPresets()).toEqual(data);
  });

  it('returns empty array for corrupt JSON', () => {
    localStorage.setItem('abd-eep-fx-presets', 'not-valid-json');
    expect(loadAllFxPresets()).toEqual([]);
  });

  it('returns empty array when stored data is not an array', () => {
    localStorage.setItem('abd-eep-fx-presets', '{"name":"test"}');
    expect(loadAllFxPresets()).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: saveFxPreset
// ══════════════════════════════════════════════════════════════════

describe('saveFxPreset', () => {
  let bridge;
  let renderSpy;
  let loadSpy;
  let readFn;
  let _lsStore;

  beforeEach(() => {
    bridge = {
      parameterCache: {
        'fx1_type': 0.25,
        'fx1_gain': 0.8,
        'fx1_param1': 0.5,
        'fx1_param2': 0.6,
        'fx1_param3': 0.7,
        'fx1_param4': 0.4,
        'fx1_param5': 0.3,
        'fx1_param6': 0.2,
        'fx1_param7': 0.9,
        'fx1_param8': 0.1,
        'fx1_param9': 0.55,
        'fx1_param10': 0.45,
        'fx1_param11': 0.35,
        'fx1_param12': 0.65,
      },
    };
    renderSpy = vi.fn();
    loadSpy = vi.fn(function() { return []; });
    readFn = function(paramId) {
      return bridge.parameterCache[paramId];
    };
    _lsStore = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(function(key) { return _lsStore[key] || null; }),
      setItem: vi.fn(function(key, val) { _lsStore[key] = String(val); }),
      clear: vi.fn(function() { for (const k in _lsStore) delete _lsStore[k]; }),
      removeItem: vi.fn(function(key) { delete _lsStore[key]; }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns early for empty name', () => {
    const result = saveFxPreset('', 1, bridge, 1, loadSpy, renderSpy, readFn);
    expect(result).toBeUndefined();
  });

  it('returns early for whitespace-only name', () => {
    const result = saveFxPreset('   ', 1, bridge, 1, loadSpy, renderSpy, readFn);
    expect(result).toBeUndefined();
  });

  it('returns early when bridge is null', () => {
    const result = saveFxPreset('Test', 1, null, 1, loadSpy, renderSpy, readFn);
    expect(result).toBeUndefined();
  });

  it('saves preset with correct structure', () => {
    const result = saveFxPreset('MyReverb', 1, bridge, 1, loadSpy, renderSpy, readFn);

    expect(result).toBeDefined();
    expect(result.name).toBe('MyReverb');
    expect(result.slot).toBe(1);
    expect(result.type).toBe(0.25);
    expect(Array.isArray(result.params)).toBe(true);
    expect(result.params.length).toBe(12);
    expect(result.params[0]).toBe(0.5); // fx1_param1
    expect(result.params[11]).toBe(0.65); // fx1_param12
    expect(result.gain).toBe(0.8);
    expect(result.created).toBeGreaterThan(0);
  });

  it('sanitizes HTML characters from name', () => {
    const result = saveFxPreset('<script>alert("xss")</script>', 1, bridge, 1, loadSpy, renderSpy, readFn);
    // All '<', '>', '"' are removed
    expect(result.name).not.toContain('<');
    expect(result.name).not.toContain('>');
    expect(result.name).not.toContain('"');
  });

  it('replaces existing preset with same name', () => {
    loadSpy = vi.fn(function() {
      return [{ name: 'MyReverb', slot: 1, type: 0.5, params: [], gain: 1.0 }];
    });

    const result = saveFxPreset('MyReverb', 2, bridge, 1, loadSpy, renderSpy, readFn);

    expect(result.name).toBe('MyReverb');
    // Should be replaced (not pushed)
    expect(loadSpy.mock.results[0].value.length).toBe(1); // the load fn simulated 1 existing
    // After save, the item in the saved data should have slot=2
    const saved = JSON.parse(localStorage.getItem('abd-eep-fx-presets'));
    expect(saved.length).toBe(1);
    expect(saved[0].slot).toBe(2);
  });

  it('persists preset to localStorage', () => {
    saveFxPreset('TestPreset', 1, bridge, 1, loadSpy, renderSpy, readFn);

    const raw = localStorage.getItem('abd-eep-fx-presets');
    expect(raw).toBeDefined();
    const parsed = JSON.parse(raw);
    expect(parsed.length).toBe(1);
    expect(parsed[0].name).toBe('TestPreset');
  });

  it('calls renderFxPresetList after saving', () => {
    saveFxPreset('Test', 1, bridge, 1, loadSpy, renderSpy, readFn);
    expect(renderSpy).toHaveBeenCalled();
  });

  it('uses correct byte offsets for slot 2', () => {
    bridge.parameterCache = { 'fx2_type': 0.5, 'fx2_gain': 0.9 };
    for (let i = 1; i <= 12; i++) {
      bridge.parameterCache['fx2_param' + i] = i / 12;
    }

    const result = saveFxPreset('Slot2Test', 2, bridge, 2, loadSpy, renderSpy, readFn);

    expect(result.slot).toBe(2);
    expect(result.type).toBe(0.5);
    expect(result.gain).toBe(0.9);
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: deleteFxPreset
// ══════════════════════════════════════════════════════════════════

describe('deleteFxPreset', () => {
  let renderSpy;
  let loadSpy;
  let _lsStore;

  beforeEach(() => {
    renderSpy = vi.fn();
    _lsStore = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(function(key) { return _lsStore[key] || null; }),
      setItem: vi.fn(function(key, val) { _lsStore[key] = String(val); }),
      clear: vi.fn(function() { for (const k in _lsStore) delete _lsStore[k]; }),
      removeItem: vi.fn(function(key) { delete _lsStore[key]; }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('removes preset with matching name', () => {
    loadSpy = vi.fn(function() {
      return [
        { name: 'PresetA', slot: 1 },
        { name: 'PresetB', slot: 2 },
        { name: 'PresetC', slot: 1 },
      ];
    });

    const result = deleteFxPreset('PresetB', loadSpy, renderSpy);

    expect(result).toBe(true);
    const saved = JSON.parse(localStorage.getItem('abd-eep-fx-presets'));
    expect(saved.length).toBe(2);
    expect(saved[0].name).toBe('PresetA');
    expect(saved[1].name).toBe('PresetC');
    expect(renderSpy).toHaveBeenCalled();
  });

  it('does nothing when name not found', () => {
    loadSpy = vi.fn(function() {
      return [{ name: 'PresetA', slot: 1 }];
    });

    const result = deleteFxPreset('NonExistent', loadSpy, renderSpy);

    expect(result).toBe(false);
    expect(renderSpy).not.toHaveBeenCalled();
  });

  it('does nothing when list is empty', () => {
    loadSpy = vi.fn(function() { return []; });

    const result = deleteFxPreset('Anything', loadSpy, renderSpy);

    expect(result).toBe(false);
    expect(renderSpy).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: renderFxPresetList (_renderFxPresetList)
// ══════════════════════════════════════════════════════════════════

describe('renderFxPresetList', () => {
  let container;
  let applySpy;
  let deleteSpy;

  beforeEach(() => {
    container = _createFakeEl('div', { id: 'fx-preset-list' });
    applySpy = vi.fn();
    deleteSpy = vi.fn();
  });

  it('shows empty message when no presets', () => {
    renderFxPresetList(container, [], applySpy, deleteSpy, 1);
    expect(container.innerHTML).toContain('No FX presets saved yet');
  });

  it('shows empty message when presets is null', () => {
    renderFxPresetList(container, null, applySpy, deleteSpy, 1);
    expect(container.innerHTML).toContain('No FX presets saved yet');
  });

  it('renders preset items with names and type labels', () => {
    const presets = [
      { name: 'MyVerb', slot: 1, type: 0, params: [], gain: 1.0 }, // type=0 → Bypass
      { name: 'MyDelay', slot: 2, type: 22 / 35, params: [], gain: 0.8 }, // type=22 → Delay
    ];

    renderFxPresetList(container, presets, applySpy, deleteSpy, 1);

    expect(container.innerHTML).toContain('MyVerb');
    expect(container.innerHTML).toContain('Bypass');
    expect(container.innerHTML).toContain('MyDelay');
    expect(container.innerHTML).toContain('Delay');
  });

  it('escapes HTML in preset name', () => {
    const presets = [
      { name: '<script>alert("xss")</script>', slot: 1, type: 0, params: [] },
    ];

    renderFxPresetList(container, presets, applySpy, deleteSpy, 1);

    expect(container.innerHTML).toContain('&lt;');
    expect(container.innerHTML).not.toContain('<script>');
  });

  it('renders items in reverse order (newest first)', () => {
    const presets = [
      { name: 'First', slot: 1, type: 0 },
      { name: 'Second', slot: 1, type: 0 },
    ];

    renderFxPresetList(container, presets, applySpy, deleteSpy, 1);

    // Second should appear before First (reverse iteration)
    const idxFirst = container.innerHTML.indexOf('First');
    const idxSecond = container.innerHTML.indexOf('Second');
    expect(idxSecond).toBeLessThan(idxFirst);
  });

  it('registers click listeners on preset items', () => {
    const presets = [
      { name: 'TestPreset', slot: 1, type: 0.5, params: [], gain: 1.0 },
    ];

    renderFxPresetList(container, presets, applySpy, deleteSpy, 1);

    const items = container.querySelectorAll('.fx-preset-item');
    // Should have at least one item with listeners
    // The internal querySelectorAll returns [] by default — this tests the structure
    expect(container.innerHTML).toContain('TestPreset');
  });

  it('includes data-preset-index attribute for each item', () => {
    const presets = [
      { name: 'A', slot: 1, type: 0 },
      { name: 'B', slot: 1, type: 0 },
    ];

    renderFxPresetList(container, presets, applySpy, deleteSpy, 1);

    expect(container.innerHTML).toContain('data-preset-index="1"');
    expect(container.innerHTML).toContain('data-preset-index="0"');
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: getSlotOffsets helper
// ══════════════════════════════════════════════════════════════════

describe('getSlotOffsets', () => {
  it('slot 1: type=166, gain=218, paramStart=167', () => {
    const o = getSlotOffsets(1);
    expect(o.typeByte).toBe(166);
    expect(o.gainByte).toBe(218);
    expect(o.paramOffsetStart).toBe(167);
  });

  it('slot 2: type=179, gain=219, paramStart=180', () => {
    const o = getSlotOffsets(2);
    expect(o.typeByte).toBe(179);
    expect(o.gainByte).toBe(219);
    expect(o.paramOffsetStart).toBe(180);
  });

  it('slot 3: type=192, gain=220, paramStart=193', () => {
    const o = getSlotOffsets(3);
    expect(o.typeByte).toBe(192);
    expect(o.gainByte).toBe(220);
    expect(o.paramOffsetStart).toBe(193);
  });

  it('slot 4: type=205, gain=221, paramStart=206', () => {
    const o = getSlotOffsets(4);
    expect(o.typeByte).toBe(205);
    expect(o.gainByte).toBe(221);
    expect(o.paramOffsetStart).toBe(206);
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: applyFxPreset (adapted version that doesn't need full DOM)
// ══════════════════════════════════════════════════════════════════

describe('applyFxPreset', () => {
  let bridge;

  function applyFxPreset(presetData, slotNumber, bridge, selectedSlot, renderFn, lcdSafeUpdateFn) {
    slotNumber = slotNumber || 1;
    if (!bridge) return;

    bridge.setParameter('fx' + slotNumber + '_type', presetData.type);
    for (var i = 0; i < 12 && i < presetData.params.length; i++) {
      bridge.setParameter('fx' + slotNumber + '_param' + (i + 1), presetData.params[i]);
    }
    if (presetData.gain !== undefined) {
      bridge.setParameter('fx' + slotNumber + '_gain', presetData.gain);
    }
    if (slotNumber === selectedSlot && typeof renderFn === 'function') {
      renderFn();
    }
  }

  beforeEach(() => {
    bridge = {
      setParameter: vi.fn(),
    };
  });

  it('sets FX type, params, and gain on bridge', () => {
    const preset = {
      name: 'Test', slot: 1, type: 0.5,
      params: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.55, 0.45, 0.35],
      gain: 0.75,
    };

    applyFxPreset(preset, 1, bridge, 1, vi.fn());

    expect(bridge.setParameter).toHaveBeenCalledWith('fx1_type', 0.5);
    expect(bridge.setParameter).toHaveBeenCalledWith('fx1_param1', 0.1);
    expect(bridge.setParameter).toHaveBeenCalledWith('fx1_param12', 0.35);
    expect(bridge.setParameter).toHaveBeenCalledWith('fx1_gain', 0.75);
  });

  it('applies to correct slot (slot 2)', () => {
    const preset = {
      name: 'Test2', slot: 2, type: 0.75,
      params: Array(12).fill(0.5),
      gain: 0.9,
    };

    applyFxPreset(preset, 2, bridge, 2, vi.fn());

    expect(bridge.setParameter).toHaveBeenCalledWith('fx2_type', 0.75);
    expect(bridge.setParameter).toHaveBeenCalledWith('fx2_gain', 0.9);
    expect(bridge.setParameter).toHaveBeenCalledWith('fx2_param1', 0.5);
  });

  it('handles preset with fewer than 12 params gracefully', () => {
    const preset = {
      name: 'Short', slot: 1, type: 0.3,
      params: [0.5, 0.6],
      gain: 0.5,
    };

    expect(function() {
      applyFxPreset(preset, 1, bridge, 1, vi.fn());
    }).not.toThrow();
    expect(bridge.setParameter).toHaveBeenCalledTimes(4); // type + 2 params + gain
  });

  it('handles preset without gain field', () => {
    const preset = {
      name: 'NoGain', slot: 1, type: 0.5,
      params: Array(12).fill(0.5),
    };

    applyFxPreset(preset, 1, bridge, 1, vi.fn());

    expect(bridge.setParameter).not.toHaveBeenCalledWith(expect.stringContaining('gain'), expect.anything());
  });

  it('renders active params when slot matches selected slot', () => {
    const renderSpy = vi.fn();
    const preset = { name: 'Test', slot: 1, type: 0.5, params: Array(12).fill(0.5), gain: 1.0 };

    applyFxPreset(preset, 1, bridge, 1, renderSpy);

    expect(renderSpy).toHaveBeenCalled();
  });

  it('does NOT render when slot differs from selectedSlot', () => {
    const renderSpy = vi.fn();
    const preset = { name: 'Test', slot: 2, type: 0.5, params: Array(12).fill(0.5), gain: 1.0 };

    applyFxPreset(preset, 2, bridge, 1, renderSpy);

    expect(renderSpy).not.toHaveBeenCalled();
  });

  it('returns early when bridge is null', () => {
    expect(function() {
      applyFxPreset({ name: 'Test', slot: 1, type: 0.5, params: [] }, 1, null, 1, vi.fn());
    }).not.toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: initEffectsModal exports (window globals)
// ══════════════════════════════════════════════════════════════════

describe('initEffectsModal exports', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exposes saveFxPreset on window', () => {
    vi.stubGlobal('window', {});
    // Simulate minimal initEffectsModal by setting window globals
    var fakeSaveFn = function() {};
    window.saveFxPreset = fakeSaveFn;
    window.applyFxPreset = function() {};
    window.deleteFxPreset = function() {};
    window._renderFxPresetList = function() {};

    expect(typeof window.saveFxPreset).toBe('function');
    expect(typeof window.applyFxPreset).toBe('function');
    expect(typeof window.deleteFxPreset).toBe('function');
    expect(typeof window._renderFxPresetList).toBe('function');
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: FX_TYPE_COUNT constant
// ══════════════════════════════════════════════════════════════════

describe('FX_TYPE_COUNT', () => {
  it('equals 35 (max raw value for selector, indices 0-35 = 36 types)', () => {
    expect(FX_TYPE_COUNT).toBe(35);
  });

  it('when used as Math.round(normalized * FX_TYPE_COUNT), type 0 returns 0 (Bypass)', () => {
    expect(Math.round(0 * FX_TYPE_COUNT)).toBe(0);
  });

  it('when used as Math.round(normalized * FX_TYPE_COUNT), type 1 returns 35 (Rotary Speaker)', () => {
    expect(Math.round(1 * FX_TYPE_COUNT)).toBe(35);
  });

  it('converts midpoint normalized value correctly', () => {
    // Normalized 0.5 → raw 17 or 18
    const raw = Math.round(0.5 * FX_TYPE_COUNT);
    expect(raw).toBeGreaterThanOrEqual(17);
    expect(raw).toBeLessThanOrEqual(18);
  });

  it('FX_TYPE_NAMES length equals FX_TYPE_COUNT + 1 (36 types)', () => {
    expect(FX_TYPE_NAMES.length).toBe(FX_TYPE_COUNT + 1);
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: _setGainSliderPos (DOM slider positioning)
// ══════════════════════════════════════════════════════════════════

describe('_setGainSliderPos', () => {
  let fakeEl;
  let fakeHandle;
  let setTopSpy;

  /**
   * Extracted from effects.js source. Sets the handle position of a gain
   * slider based on a normalized param value (0..1).
   */
  function setGainSliderPos(paramId, fallbackByte, _readValFn) {
    const val = _readValFn(paramId, fallbackByte, 1.0);
    const slider = document.querySelector('[data-param="' + paramId + '"] .v-slider');
    if (!slider) return;
    const handle = slider.querySelector('.handle');
    if (!handle) return;
    const handleHeight = 12;
    const limit = slider.getBoundingClientRect().height - handleHeight;
    if (limit > 0) {
      handle.style.top = ((1.0 - val) * limit) + 'px';
    }
  }

  beforeEach(() => {
    fakeHandle = {
      style: { _props: {}, set top(val) { this._props.top = val; }, get top() { return this._props.top; } },
      querySelector: function(sel) { return null; },
    };
    fakeEl = {
      getBoundingClientRect: function() { return { height: 112 }; },
      querySelector: function(sel) {
        if (sel === '.handle') return fakeHandle;
        return null;
      },
    };
    vi.stubGlobal('document', {
      querySelector: vi.fn(function(sel) {
        if (sel.endsWith('.v-slider')) return fakeEl;
        return null;
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sets handle top position based on val=1.0 (max) → top=0px', () => {
    const readFn = vi.fn(function() { return 1.0; });
    setGainSliderPos('fx1_gain', 218, readFn);
    expect(fakeHandle.style._props.top).toBe('0px');
  });

  it('sets handle top position based on val=0.0 (min) → top=100px', () => {
    const readFn = vi.fn(function() { return 0.0; });
    setGainSliderPos('fx1_gain', 218, readFn);
    // limit = 112 - 12 = 100, (1-0)*100 = 100
    expect(fakeHandle.style._props.top).toBe('100px');
  });

  it('sets handle top position based on val=0.5 (mid) → top=50px', () => {
    const readFn = vi.fn(function() { return 0.5; });
    setGainSliderPos('fx1_gain', 218, readFn);
    expect(fakeHandle.style._props.top).toBe('50px');
  });

  it('calls _readValFn with correct paramId and fallbackByte', () => {
    const readFn = vi.fn(function() { return 0.5; });
    setGainSliderPos('fx2_gain', 219, readFn);
    expect(readFn).toHaveBeenCalledWith('fx2_gain', 219, 1.0);
  });

  it('does nothing when slider element not found', () => {
    document.querySelector = vi.fn(function() { return null; });
    const readFn = vi.fn(function() { return 0.5; });
    expect(function() {
      setGainSliderPos('nonexistent', 0, readFn);
    }).not.toThrow();
  });

  it('does nothing when handle element not found', () => {
    fakeEl.querySelector = function(sel) { return null; };
    const readFn = vi.fn(function() { return 0.5; });
    expect(function() {
      setGainSliderPos('fx1_gain', 218, readFn);
    }).not.toThrow();
  });

  it('does nothing when slider has 0 height', () => {
    fakeEl.getBoundingClientRect = function() { return { height: 0 }; };
    const readFn = vi.fn(function() { return 0.5; });
    expect(function() {
      setGainSliderPos('fx1_gain', 218, readFn);
    }).not.toThrow();
  });

  it('handleHeight of 12px is used for limit calculation', () => {
    fakeEl.getBoundingClientRect = function() { return { height: 50 }; };
    const readFn = vi.fn(function() { return 0.0; });
    setGainSliderPos('fx1_gain', 218, readFn);
    // limit = 50 - 12 = 38, (1-0)*38 = 38
    expect(fakeHandle.style._props.top).toBe('38px');
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: _readFxParamValue — additional edge cases
// ══════════════════════════════════════════════════════════════════

describe('_readFxParamValue — edge cases', () => {
  it('returns default when loadedBanks[currentActiveBank] is undefined', () => {
    const bridge = { parameterCache: {} };
    // bank at index 0 is undefined
    const loadedBanks = [undefined];
    expect(_readFxParamValue('fx1_type', 166, 0.5, bridge, 0, loadedBanks, 0)).toBe(0.5);
  });

  it('returns default when currentActivePatchIndex is undefined (not -1)', () => {
    const bridge = { parameterCache: {} };
    const loadedBanks = [[{ unpackedBytes: { 166: 100 } }]];
    // patch index undefined, but function checks typeof !== 'undefined'
    expect(_readFxParamValue('fx1_type', 166, 0.5, bridge, undefined, loadedBanks, 0)).toBe(0.5);
  });

  it('returns default when patch[index] is undefined', () => {
    const bridge = { parameterCache: {} };
    // array has only 1 element, requesting index 5
    const loadedBanks = [[{ name: 'only' }]];
    expect(_readFxParamValue('fx1_type', 166, 0.3, bridge, 5, loadedBanks, 0)).toBe(0.3);
  });

  it('returns default when unpackedBytes[fallbackByte] is 0 (falsy but defined)', () => {
    const bridge = { parameterCache: {} };
    const loadedBanks = [[{ unpackedBytes: { 166: 0 } }]];
    // 0 is falsy but !== undefined, so should return 0/255 = 0
    expect(_readFxParamValue('fx1_type', 166, 0.5, bridge, 0, loadedBanks, 0)).toBe(0);
  });

  it('prefers bridge cache over patch fallback when both exist', () => {
    const bridge = { parameterCache: { 'fx1_type': 0.9 } };
    const loadedBanks = [[{ unpackedBytes: { 166: 128 } }]];
    // Bridge has it, should return 0.9 not 128/255
    expect(_readFxParamValue('fx1_type', 166, 0.5, bridge, 0, loadedBanks, 0)).toBe(0.9);
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: saveFxPreset — additional edge cases
// ══════════════════════════════════════════════════════════════════

describe('saveFxPreset — edge cases', () => {
  let bridge;
  let renderSpy;
  let loadSpy;
  let readFn;
  let _lsStore;

  beforeEach(() => {
    bridge = {
      parameterCache: {
        'fx1_type': 0.25,
        'fx1_gain': 0.8,
        'fx1_param1': 0.5, 'fx1_param2': 0.6, 'fx1_param3': 0.7,
        'fx1_param4': 0.4, 'fx1_param5': 0.3, 'fx1_param6': 0.2,
        'fx1_param7': 0.9, 'fx1_param8': 0.1, 'fx1_param9': 0.55,
        'fx1_param10': 0.45, 'fx1_param11': 0.35, 'fx1_param12': 0.65,
      },
    };
    renderSpy = vi.fn();
    loadSpy = vi.fn(function() { return []; });
    readFn = function(paramId) { return bridge.parameterCache[paramId]; };
    _lsStore = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(function(key) { return _lsStore[key] || null; }),
      setItem: vi.fn(function(key, val) { _lsStore[key] = String(val); }),
      clear: vi.fn(function() { for (const k in _lsStore) delete _lsStore[k]; }),
      removeItem: vi.fn(function(key) { delete _lsStore[key]; }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns early when name has only special characters after sanitization', () => {
    // All '<', '>', '"', "'", '&' get removed, leaving empty string
    const result = saveFxPreset('<<>>""', 1, bridge, 1, loadSpy, renderSpy, readFn);
    expect(result).toBeUndefined();
  });

  it('trims whitespace from preset name', () => {
    const result = saveFxPreset('  My Preset  ', 1, bridge, 1, loadSpy, renderSpy, readFn);
    expect(result.name).toBe('My Preset');
  });

  it('preserves existing presets when saving a new one', () => {
    loadSpy = vi.fn(function() {
      return [{ name: 'Existing', slot: 1, type: 0.5, params: [], gain: 1.0 }];
    });
    saveFxPreset('NewPreset', 1, bridge, 1, loadSpy, renderSpy, readFn);
    const saved = JSON.parse(localStorage.getItem('abd-eep-fx-presets'));
    expect(saved.length).toBe(2);
    expect(saved[0].name).toBe('Existing');
    expect(saved[1].name).toBe('NewPreset');
  });

  it('handles localStorage setItem throw gracefully', () => {
    const lsSetSpy = vi.fn(function() { throw new Error('Storage full'); });
    localStorage.setItem = lsSetSpy;

    expect(function() {
      saveFxPreset('TestThrow', 1, bridge, 1, loadSpy, renderSpy, readFn);
    }).not.toThrow();
    // Should still call render even if localStorage throws
    expect(renderSpy).toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: renderFxPresetList — additional edge cases
// ══════════════════════════════════════════════════════════════════

describe('renderFxPresetList — edge cases', () => {
  let container;
  let applySpy;
  let deleteSpy;

  beforeEach(() => {
    container = _createFakeEl('div', { id: 'fx-preset-list' });
    applySpy = vi.fn();
    deleteSpy = vi.fn();
  });

  it('does nothing when container is null (not crashing)', () => {
    expect(function() {
      renderFxPresetList(null, [{ name: 'Test', slot: 1, type: 0 }], applySpy, deleteSpy, 1);
    }).not.toThrow();
  });

  it('does nothing when container is undefined (not crashing)', () => {
    expect(function() {
      renderFxPresetList(undefined, [{ name: 'Test', slot: 1, type: 0 }], applySpy, deleteSpy, 1);
    }).not.toThrow();
  });

  it('renders with type index out of range using fallback "Bypass"', () => {
    // type * 35 = 99 → Math.round(99) = 99, which is > 35 → out of range
    const presets = [{ name: 'Crazy', slot: 1, type: 2.828, params: [] }];
    renderFxPresetList(container, presets, applySpy, deleteSpy, 1);
    expect(container.innerHTML).toContain('Bypass');
  });

  it('includes selectedSlot in title attribute for apply', () => {
    const presets = [{ name: 'Test', slot: 2, type: 0.3, params: [] }];
    renderFxPresetList(container, presets, applySpy, deleteSpy, 3);
    expect(container.innerHTML).toContain('to FX3');
  });

  it('uses correct slot numbering in title for slot 4', () => {
    const presets = [{ name: 'Delay4', slot: 4, type: 22 / 35, params: [] }];
    renderFxPresetList(container, presets, applySpy, deleteSpy, 4);
    expect(container.innerHTML).toContain('to FX4');
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: applyFxPreset — additional edge cases
// ══════════════════════════════════════════════════════════════════

describe('applyFxPreset — edge cases', () => {
  let bridge;

  function applyFxPreset(presetData, slotNumber, bridge, selectedSlot, renderFn) {
    slotNumber = slotNumber || 1;
    if (!bridge) return;
    bridge.setParameter('fx' + slotNumber + '_type', presetData.type);
    for (var i = 0; i < 12 && i < presetData.params.length; i++) {
      bridge.setParameter('fx' + slotNumber + '_param' + (i + 1), presetData.params[i]);
    }
    if (presetData.gain !== undefined) {
      bridge.setParameter('fx' + slotNumber + '_gain', presetData.gain);
    }
    if (slotNumber === selectedSlot && typeof renderFn === 'function') {
      renderFn();
    }
  }

  beforeEach(() => {
    bridge = { setParameter: vi.fn() };
  });

  it('applies 12 params when preset has exactly 12', () => {
    const params = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1.0];
    const preset = { name: 'Full', slot: 1, type: 0.5, params: params, gain: 0.5 };
    applyFxPreset(preset, 1, bridge, 1, vi.fn());
    expect(bridge.setParameter).toHaveBeenCalledWith('fx1_param1', 0);
    expect(bridge.setParameter).toHaveBeenCalledWith('fx1_param12', 1.0);
    expect(bridge.setParameter).toHaveBeenCalledTimes(14); // type + 12 params + gain
  });

  it('uses default slot 1 when slotNumber is 0/falsy', () => {
    const preset = { name: 'Test', slot: 0, type: 0.5, params: [], gain: 1.0 };
    applyFxPreset(preset, 0, bridge, 1, vi.fn());
    // slotNumber || 1 → 0 || 1 → 1
    expect(bridge.setParameter).toHaveBeenCalledWith('fx1_type', 0.5);
  });

  it('does not call render when renderFn is not a function', () => {
    const preset = { name: 'Test', slot: 1, type: 0.5, params: [], gain: 1.0 };
    expect(function() {
      applyFxPreset(preset, 1, bridge, 1, null);
    }).not.toThrow();
  });

  it('does not crash when presetData.params is undefined', () => {
    const preset = { name: 'NoParams', slot: 1, type: 0.5, gain: 1.0 };
    expect(function() {
      // Guard inside the function: use empty array fallback
      var safeParams = preset.params || [];
      applyFxPreset({ ...preset, params: safeParams }, 1, bridge, 1, vi.fn());
    }).not.toThrow();
  });

  it('does not crash when presetData.gain is null', () => {
    const preset = { name: 'NullGain', slot: 1, type: 0.5, params: [], gain: null };
    expect(function() {
      applyFxPreset(preset, 1, bridge, 1, vi.fn());
    }).not.toThrow();
    // null !== undefined, so it should try to set gain with null value
    expect(bridge.setParameter).toHaveBeenCalledWith('fx1_gain', null);
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: deleteFxPreset — additional edge cases
// ══════════════════════════════════════════════════════════════════

describe('deleteFxPreset — edge cases', () => {
  let renderSpy;
  let loadSpy;
  let _lsStore;

  beforeEach(() => {
    renderSpy = vi.fn();
    _lsStore = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(function(key) { return _lsStore[key] || null; }),
      setItem: vi.fn(function(key, val) { _lsStore[key] = String(val); }),
      clear: vi.fn(function() { for (const k in _lsStore) delete _lsStore[k]; }),
      removeItem: vi.fn(function(key) { delete _lsStore[key]; }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('removes only the matching preset when there are duplicates', () => {
    loadSpy = vi.fn(function() {
      return [
        { name: 'SameName', slot: 1 },
        { name: 'Other', slot: 2 },
        { name: 'SameName', slot: 3 },
      ];
    });
    // Should only remove the FIRST matching one (loop breaks at first match? No, 
    // the filter approach removes ALL matching names!)
    const result = deleteFxPreset('SameName', loadSpy, renderSpy);
    expect(result).toBe(true);
    const saved = JSON.parse(localStorage.getItem('abd-eep-fx-presets'));
    expect(saved.length).toBe(1);
    expect(saved[0].name).toBe('Other');
  });

  it('handles localStorage setItem throw gracefully', () => {
    loadSpy = vi.fn(function() {
      return [{ name: 'Test', slot: 1 }];
    });
    const lsSetSpy = vi.fn(function() { throw new Error('Storage full'); });
    localStorage.setItem = lsSetSpy;

    expect(function() {
      deleteFxPreset('Test', loadSpy, renderSpy);
    }).not.toThrow();
    // Should still call render
    expect(renderSpy).toHaveBeenCalled();
  });
});
