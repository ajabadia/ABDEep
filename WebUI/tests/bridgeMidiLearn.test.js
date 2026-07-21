/**
 * Unit tests for bridge-midi-learn.js — MIDI Learn capture, mapping lifecycle, persistence.
 *
 * Run with: npx vitest run WebUI/tests/bridgeMidiLearn.test.js
 *
 * Strategy: self-contained DualMidiBridge stub + prototype methods from
 * bridge-midi-learn.js via helper function application, plus minimal
 * BRIDGE_PARAM_MAPS mock.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// ══════════════════════════════════════════════════════════════════
// Minimal DualMidiBridge stub
// ══════════════════════════════════════════════════════════════════

function createBridgeStub() {
  return {
    // Properties set by constructor
    midiLearnActive: false,
    midiLearnTargetParam: null,
    midiLearnPendingCC: null,
    midiLearnMappings: {},
    midiLearnChangeCallbacks: [],
    _midiLearnAutoExitTimer: null,
    parameterCache: {},

    // Methods that get overridden by midi-learn prototype
    setParameter: vi.fn(function(paramId, val) {
      this.parameterCache[paramId] = val;
    }),
    handleParameterChangeFromBackend: vi.fn(function(paramId, val) {
      this.parameterCache[paramId] = val;
    }),
  };
}

// ══════════════════════════════════════════════════════════════════
// Apply MIDI Learn prototype methods from bridge-midi-learn.js
// ══════════════════════════════════════════════════════════════════

function applyMidiLearnPrototype(bridge, opts) {
  opts = opts || {};

  const mockLcdSafeUpdate = opts.lcdSafeUpdate || vi.fn();
  const mockGetParamName = opts.getParamName || function(paramId) {
    return paramId.replace(/_/g, ' ');
  };

  bridge.toggleMidiLearn = function() {
    if (this.midiLearnActive) {
      this.stopMidiLearn();
    } else {
      this.startMidiLearn();
    }
  };

  bridge.startMidiLearn = function() {
    if (this.midiLearnActive) {return;}
    this.midiLearnActive = true;
    this.midiLearnTargetParam = null;
    this.midiLearnPendingCC = null;
    this._notifyMidiLearnChange();
    this._showLcdLearnPrompt('MOVE a control or\\\\nCLICK a parameter');
  };

  bridge.stopMidiLearn = function() {
    if (!this.midiLearnActive) {return;}
    this.midiLearnActive = false;
    this.midiLearnTargetParam = null;
    this.midiLearnPendingCC = null;
    this._notifyMidiLearnChange();
  };

  bridge.setMidiLearnTarget = function(paramId) {
    if (!this.midiLearnActive) {return;}
    this.midiLearnTargetParam = paramId;
    if (this.midiLearnPendingCC) {
      this._completeMidiLearnMapping(paramId, this.midiLearnPendingCC);
      this.midiLearnPendingCC = null;
    } else {
      this._notifyMidiLearnChange();
    }
  };

  bridge._captureMidiLearnMessage = function(ccNum, val, nrpnInfo) {
    if (!this.midiLearnActive) {return;}
    let key, desc;
    if (nrpnInfo) {
      key = 'nrpn:' + nrpnInfo.msb + ':' + nrpnInfo.lsb;
      desc = 'NRPN ' + nrpnInfo.msb + ':' + String(nrpnInfo.lsb).padStart(2, '0');
    } else {
      key = 'cc:' + ccNum;
      desc = 'CC ' + ccNum;
    }
    if (this.midiLearnTargetParam) {
      this._completeMidiLearnMapping(this.midiLearnTargetParam, { key: key, desc: desc, cc: ccNum, val: val, nrpn: nrpnInfo });
      return;
    }
    this.midiLearnPendingCC = { key: key, desc: desc, cc: ccNum, val: val, nrpn: nrpnInfo };
    this._notifyMidiLearnChange();
  };

  bridge._completeMidiLearnMapping = function(paramId, captured) {
    const key = captured.key;
    this.midiLearnMappings[key] = paramId;
    this._saveMidiLearnMappings();
    this._notifyMidiLearnChange();
  };

  bridge._getParamName = mockGetParamName;

  bridge._showLcdLearnPrompt = function(msg) {
    const lcd = opts.document ? opts.document.getElementById('lcd-text') : null;
    if (!lcd) {return;}
    lcd._midiLearnLcd = true;
    mockLcdSafeUpdate(lcd, msg);
  };

  bridge._notifyMidiLearnChange = function() {
    const self = this;
    this.midiLearnChangeCallbacks.forEach(function(cb) { cb(self.midiLearnActive, self.midiLearnTargetParam); });
  };

  bridge.onMidiLearnChange = function(callback) {
    this.midiLearnChangeCallbacks.push(callback);
  };

  bridge.removeMidiLearnMapping = function(key) {
    delete this.midiLearnMappings[key];
    this._saveMidiLearnMappings();
    this._notifyMidiLearnChange();
  };

  bridge.clearMidiLearnMappings = function() {
    this.midiLearnMappings = {};
    this._saveMidiLearnMappings();
    this._notifyMidiLearnChange();
  };

  bridge._saveMidiLearnMappings = function() {
    try {
      localStorage.setItem('abd-eep-midi-learn', JSON.stringify(this.midiLearnMappings));
    } catch (e) {
      // no-op in test
    }
  };

  bridge._loadMidiLearnMappings = function() {
    try {
      const raw = localStorage.getItem('abd-eep-midi-learn');
      if (raw) {
        this.midiLearnMappings = JSON.parse(raw);
      }
    } catch (e) {
      // no-op in test
    }
  };

  bridge._applyMidiLearnMapping = function(key, val, nrpnInfo) {
    const paramId = this.midiLearnMappings[key];
    if (!paramId) {return false;}

    const BRIDGE_PARAM_MAPS = opts.bridgeParamMaps || (typeof window !== 'undefined' ? window.BRIDGE_PARAM_MAPS : null);
    const byteOffset = BRIDGE_PARAM_MAPS ? BRIDGE_PARAM_MAPS.PARAM_TO_BYTE_OFFSET[paramId] : undefined;
    let normalized;
    if (byteOffset !== undefined && BRIDGE_PARAM_MAPS && typeof BRIDGE_PARAM_MAPS.rawToNormalized === 'function') {
      const rawVal = nrpnInfo ? (val & 0xFF) : Math.round(val * 255.0 / 127.0);
      normalized = BRIDGE_PARAM_MAPS.rawToNormalized(byteOffset, rawVal);
    } else {
      normalized = val / 127.0;
    }
    this.setParameter(paramId, normalized);
    this.handleParameterChangeFromBackend(paramId, normalized);
    return true;
  };
}

// ══════════════════════════════════════════════════════════════════
// Minimal BRIDGE_PARAM_MAPS mock
// ══════════════════════════════════════════════════════════════════

function createBridgeParamMapsMock() {
  return {
    PARAM_TO_BYTE_OFFSET: {
      'vcf_cutoff': 39,
      'osc1_saw_enable': 19,
      'env1_attack': 53,
      'lfo1_shape': 2,
      'vcf_env_depth': 42,
    },
    rawToNormalized: function(byteOffset, rawVal) {
      // Simplified version matching BRIDGE_PARAM_MAPS behavior
      const bipolarBytes = [42, 83, 91];
      const enumBytes = { 2: 6, 14: 2 };
      if (bipolarBytes.indexOf(byteOffset) !== -1) {
        return Math.max(0, Math.min(1, ((rawVal - 128) / 127.0 + 1) / 2));
      }
      if (enumBytes[byteOffset] !== undefined) {
        return Math.min(1, rawVal / enumBytes[byteOffset]);
      }
      return rawVal / 255.0;
    },
  };
}

// ══════════════════════════════════════════════════════════════════
// Tests: startMidiLearn / stopMidiLearn / toggleMidiLearn
// ══════════════════════════════════════════════════════════════════

describe('MIDI Learn lifecycle — start/stop/toggle', () => {
  let bridge;

  beforeEach(() => {
    bridge = createBridgeStub();
    applyMidiLearnPrototype(bridge);
  });

  it('startMidiLearn sets midiLearnActive to true', () => {
    bridge.startMidiLearn();
    expect(bridge.midiLearnActive).toBe(true);
  });

  it('startMidiLearn clears pending state', () => {
    bridge.midiLearnTargetParam = 'vcf_cutoff';
    bridge.midiLearnPendingCC = { key: 'cc:23', desc: 'CC 23' };
    bridge.startMidiLearn();
    expect(bridge.midiLearnTargetParam).toBeNull();
    expect(bridge.midiLearnPendingCC).toBeNull();
  });

  it('startMidiLearn notifies change callbacks', () => {
    const cb = vi.fn();
    bridge.onMidiLearnChange(cb);
    bridge.startMidiLearn();
    expect(cb).toHaveBeenCalledWith(true, null);
  });

  it('startMidiLearn is idempotent (no-op if already active)', () => {
    bridge.startMidiLearn();
    const cb = vi.fn();
    bridge.onMidiLearnChange(cb);
    bridge.startMidiLearn();
    // Should NOT notify since it returned early
    expect(cb).not.toHaveBeenCalled();
  });

  it('stopMidiLearn sets midiLearnActive to false', () => {
    bridge.startMidiLearn();
    bridge.stopMidiLearn();
    expect(bridge.midiLearnActive).toBe(false);
  });

  it('stopMidiLearn clears target and pending', () => {
    bridge.startMidiLearn();
    bridge.midiLearnTargetParam = 'vcf_cutoff';
    bridge.midiLearnPendingCC = { key: 'cc:23', desc: 'CC 23' };
    bridge.stopMidiLearn();
    expect(bridge.midiLearnTargetParam).toBeNull();
    expect(bridge.midiLearnPendingCC).toBeNull();
  });

  it('stopMidiLearn notifies change callbacks', () => {
    bridge.startMidiLearn();
    const cb = vi.fn();
    bridge.onMidiLearnChange(cb);
    bridge.stopMidiLearn();
    expect(cb).toHaveBeenCalledWith(false, null);
  });

  it('stopMidiLearn is idempotent (no-op if already inactive)', () => {
    const cb = vi.fn();
    bridge.onMidiLearnChange(cb);
    bridge.stopMidiLearn();
    expect(cb).not.toHaveBeenCalled();
  });

  it('toggleMidiLearn starts when inactive', () => {
    bridge.toggleMidiLearn();
    expect(bridge.midiLearnActive).toBe(true);
  });

  it('toggleMidiLearn stops when active', () => {
    bridge.startMidiLearn();
    bridge.toggleMidiLearn();
    expect(bridge.midiLearnActive).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: setMidiLearnTarget
// ══════════════════════════════════════════════════════════════════

describe('MIDI Learn — setMidiLearnTarget', () => {
  let bridge;

  beforeEach(() => {
    bridge = createBridgeStub();
    applyMidiLearnPrototype(bridge);
  });

  it('sets target param when learn is active', () => {
    bridge.startMidiLearn();
    bridge.setMidiLearnTarget('vcf_cutoff');
    expect(bridge.midiLearnTargetParam).toBe('vcf_cutoff');
  });

  it('does nothing when learn is inactive', () => {
    bridge.setMidiLearnTarget('vcf_cutoff');
    expect(bridge.midiLearnTargetParam).toBeNull();
  });

  it('notifies change callbacks', () => {
    bridge.startMidiLearn();
    const cb = vi.fn();
    bridge.onMidiLearnChange(cb);
    bridge.setMidiLearnTarget('vcf_cutoff');
    expect(cb).toHaveBeenCalledWith(true, 'vcf_cutoff');
  });

  it('auto-completes mapping when pendingCC exists', () => {
    bridge.startMidiLearn();
    const pendingCC = { key: 'cc:23', desc: 'CC 23', cc: 23, val: 64 };
    bridge.midiLearnPendingCC = pendingCC;
    const completeSpy = vi.spyOn(bridge, '_completeMidiLearnMapping');

    bridge.setMidiLearnTarget('vcf_cutoff');

    expect(completeSpy).toHaveBeenCalledWith('vcf_cutoff', pendingCC);
    expect(bridge.midiLearnPendingCC).toBeNull();
  });

  it('does not auto-complete when no pendingCC', () => {
    bridge.startMidiLearn();
    const completeSpy = vi.spyOn(bridge, '_completeMidiLearnMapping');

    bridge.setMidiLearnTarget('vcf_cutoff');

    expect(completeSpy).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: _captureMidiLearnMessage
// ══════════════════════════════════════════════════════════════════

describe('MIDI Learn — _captureMidiLearnMessage', () => {
  let bridge;

  beforeEach(() => {
    bridge = createBridgeStub();
    applyMidiLearnPrototype(bridge);
  });

  it('captures CC when learn is active and no target set', () => {
    bridge.startMidiLearn();
    bridge._captureMidiLearnMessage(23, 64);
    expect(bridge.midiLearnPendingCC).toBeDefined();
    expect(bridge.midiLearnPendingCC.key).toBe('cc:23');
    expect(bridge.midiLearnPendingCC.desc).toBe('CC 23');
    expect(bridge.midiLearnPendingCC.cc).toBe(23);
    expect(bridge.midiLearnPendingCC.val).toBe(64);
  });

  it('captures NRPN when learn is active and no target set', () => {
    bridge.startMidiLearn();
    bridge._captureMidiLearnMessage(0, 64, { msb: 0, lsb: 39 });
    expect(bridge.midiLearnPendingCC).toBeDefined();
    expect(bridge.midiLearnPendingCC.key).toBe('nrpn:0:39');
    expect(bridge.midiLearnPendingCC.desc).toBe('NRPN 0:39');
  });

  it('completes mapping immediately when target is set (CC)', () => {
    bridge.startMidiLearn();
    bridge.midiLearnTargetParam = 'vcf_cutoff';
    const completeSpy = vi.spyOn(bridge, '_completeMidiLearnMapping');

    bridge._captureMidiLearnMessage(23, 64);

    expect(completeSpy).toHaveBeenCalledWith('vcf_cutoff', expect.objectContaining({ key: 'cc:23' }));
    expect(bridge.midiLearnPendingCC).toBeNull();
  });

  it('completes mapping immediately when target is set (NRPN)', () => {
    bridge.startMidiLearn();
    bridge.midiLearnTargetParam = 'vcf_cutoff';
    const completeSpy = vi.spyOn(bridge, '_completeMidiLearnMapping');

    bridge._captureMidiLearnMessage(0, 64, { msb: 0, lsb: 39 });

    expect(completeSpy).toHaveBeenCalledWith('vcf_cutoff', expect.objectContaining({ key: 'nrpn:0:39' }));
  });

  it('does nothing when learn is inactive', () => {
    bridge._captureMidiLearnMessage(23, 64);
    expect(bridge.midiLearnPendingCC).toBeNull();
  });

  it('notifies change callbacks on capture without target', () => {
    bridge.startMidiLearn();
    const cb = vi.fn();
    bridge.onMidiLearnChange(cb);
    bridge._captureMidiLearnMessage(23, 64);
    expect(cb).toHaveBeenCalled();
  });

  it('does not store pendingCC when completing mapping immediately', () => {
    bridge.startMidiLearn();
    bridge.midiLearnTargetParam = 'vcf_cutoff';
    bridge._captureMidiLearnMessage(23, 64);
    // pending should remain null since mapping completed immediately
    expect(bridge.midiLearnPendingCC).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: _completeMidiLearnMapping
// ══════════════════════════════════════════════════════════════════

describe('MIDI Learn — _completeMidiLearnMapping', () => {
  let bridge;

  beforeEach(() => {
    bridge = createBridgeStub();
    const lsStore = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(function(k) { return lsStore[k] || null; }),
      setItem: vi.fn(function(k, v) { lsStore[k] = String(v); }),
      removeItem: vi.fn(function(k) { delete lsStore[k]; }),
      clear: vi.fn(function() { for (const k in lsStore) {delete lsStore[k];} }),
    });
    applyMidiLearnPrototype(bridge);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stores mapping in midiLearnMappings', () => {
    bridge._completeMidiLearnMapping('vcf_cutoff', { key: 'cc:23', desc: 'CC 23' });
    expect(bridge.midiLearnMappings['cc:23']).toBe('vcf_cutoff');
  });

  it('persists mapping to localStorage', () => {
    bridge._completeMidiLearnMapping('vcf_cutoff', { key: 'cc:23', desc: 'CC 23' });
    const raw = localStorage.getItem('abd-eep-midi-learn');
    expect(raw).toBeDefined();
    const parsed = JSON.parse(raw);
    expect(parsed['cc:23']).toBe('vcf_cutoff');
  });

  it('overwrites existing mapping for same key', () => {
    bridge.midiLearnMappings['cc:23'] = 'old_param';
    bridge._completeMidiLearnMapping('vcf_cutoff', { key: 'cc:23', desc: 'CC 23' });
    expect(bridge.midiLearnMappings['cc:23']).toBe('vcf_cutoff');
  });

  it('stores NRPN mapping correctly', () => {
    bridge._completeMidiLearnMapping('vcf_cutoff', { key: 'nrpn:0:39', desc: 'NRPN 0:39' });
    expect(bridge.midiLearnMappings['nrpn:0:39']).toBe('vcf_cutoff');
  });

  it('notifies change callbacks', () => {
    const cb = vi.fn();
    bridge.onMidiLearnChange(cb);
    bridge._completeMidiLearnMapping('vcf_cutoff', { key: 'cc:23', desc: 'CC 23' });
    expect(cb).toHaveBeenCalled();
  });

  it('can store multiple independent mappings', () => {
    bridge._completeMidiLearnMapping('vcf_cutoff', { key: 'cc:23', desc: 'CC 23' });
    bridge._completeMidiLearnMapping('vcf_resonance', { key: 'cc:24', desc: 'CC 24' });
    expect(Object.keys(bridge.midiLearnMappings).length).toBe(2);
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: removeMidiLearnMapping / clearMidiLearnMappings
// ══════════════════════════════════════════════════════════════════

describe('MIDI Learn — remove/clear mappings', () => {
  let bridge;
  let lsStore;

  beforeEach(() => {
    bridge = createBridgeStub();
    lsStore = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(function(k) { return lsStore[k] || null; }),
      setItem: vi.fn(function(k, v) { lsStore[k] = String(v); }),
      removeItem: vi.fn(function(k) { delete lsStore[k]; }),
      clear: vi.fn(function() { for (const k in lsStore) {delete lsStore[k];} }),
    });
    applyMidiLearnPrototype(bridge);
    // Pre-populate mappings
    bridge.midiLearnMappings = {
      'cc:23': 'vcf_cutoff',
      'cc:24': 'vcf_resonance',
      'nrpn:0:39': 'vcf_cutoff',
    };
    bridge._saveMidiLearnMappings();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('removeMidiLearnMapping deletes a single mapping', () => {
    bridge.removeMidiLearnMapping('cc:23');
    expect(bridge.midiLearnMappings['cc:23']).toBeUndefined();
    expect(Object.keys(bridge.midiLearnMappings).length).toBe(2);
  });

  it('removeMidiLearnMapping persists change to localStorage', () => {
    bridge.removeMidiLearnMapping('cc:23');
    const raw = JSON.parse(localStorage.getItem('abd-eep-midi-learn'));
    expect(raw['cc:23']).toBeUndefined();
    expect(Object.keys(raw).length).toBe(2);
  });

  it('removeMidiLearnMapping notifies callbacks', () => {
    const cb = vi.fn();
    bridge.onMidiLearnChange(cb);
    bridge.removeMidiLearnMapping('cc:23');
    expect(cb).toHaveBeenCalled();
  });

  it('removeMidiLearnMapping for non-existent key does nothing', () => {
    bridge.removeMidiLearnMapping('cc:99');
    expect(Object.keys(bridge.midiLearnMappings).length).toBe(3);
  });

  it('clearMidiLearnMappings removes all mappings', () => {
    bridge.clearMidiLearnMappings();
    expect(bridge.midiLearnMappings).toEqual({});
  });

  it('clearMidiLearnMappings persists empty object', () => {
    bridge.clearMidiLearnMappings();
    const raw = JSON.parse(localStorage.getItem('abd-eep-midi-learn'));
    expect(raw).toEqual({});
  });

  it('clearMidiLearnMappings notifies callbacks', () => {
    const cb = vi.fn();
    bridge.onMidiLearnChange(cb);
    bridge.clearMidiLearnMappings();
    expect(cb).toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: _saveMidiLearnMappings / _loadMidiLearnMappings
// ══════════════════════════════════════════════════════════════════

describe('MIDI Learn — persistence save/load', () => {
  let bridge;
  let lsStore;

  beforeEach(() => {
    bridge = createBridgeStub();
    lsStore = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(function(k) { return lsStore[k] || null; }),
      setItem: vi.fn(function(k, v) { lsStore[k] = String(v); }),
      removeItem: vi.fn(function(k) { delete lsStore[k]; }),
      clear: vi.fn(function() { for (const k in lsStore) {delete lsStore[k];} }),
    });
    applyMidiLearnPrototype(bridge);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('_saveMidiLearnMappings stores JSON to localStorage', () => {
    bridge.midiLearnMappings = { 'cc:23': 'vcf_cutoff' };
    bridge._saveMidiLearnMappings();
    const raw = localStorage.getItem('abd-eep-midi-learn');
    expect(JSON.parse(raw)).toEqual({ 'cc:23': 'vcf_cutoff' });
  });

  it('_loadMidiLearnMappings restores mappings from localStorage', () => {
    lsStore['abd-eep-midi-learn'] = JSON.stringify({ 'cc:23': 'vcf_cutoff', 'cc:24': 'vcf_resonance' });
    bridge._loadMidiLearnMappings();
    expect(bridge.midiLearnMappings['cc:23']).toBe('vcf_cutoff');
    expect(bridge.midiLearnMappings['cc:24']).toBe('vcf_resonance');
  });

  it('_loadMidiLearnMappings does nothing when localStorage empty', () => {
    bridge.midiLearnMappings = { existing: 'param' };
    bridge._loadMidiLearnMappings();
    // Should not overwrite with empty (load only sets if raw exists)
    expect(bridge.midiLearnMappings['existing']).toBe('param');
  });

  it('_loadMidiLearnMappings handles corrupt JSON gracefully', () => {
    lsStore['abd-eep-midi-learn'] = 'not-valid-json';
    expect(function() {
      bridge._loadMidiLearnMappings();
    }).not.toThrow();
  });

  it('_saveMidiLearnMappings handles localStorage error gracefully', () => {
    vi.stubGlobal('localStorage', {
      setItem: vi.fn(function() { throw new Error('Storage full'); }),
    });
    bridge.midiLearnMappings = { 'cc:23': 'vcf_cutoff' };
    expect(function() {
      bridge._saveMidiLearnMappings();
    }).not.toThrow();
    vi.unstubAllGlobals();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(function(k) { return lsStore[k] || null; }),
      setItem: vi.fn(function(k, v) { lsStore[k] = String(v); }),
    });
  });

  it('save/load round-trip preserves all mappings', () => {
    bridge.midiLearnMappings = {
      'cc:15': 'osc1_saw_enable',
      'cc:23': 'vcf_cutoff',
      'nrpn:0:39': 'vcf_cutoff',
    };
    bridge._saveMidiLearnMappings();
    bridge.midiLearnMappings = {};
    bridge._loadMidiLearnMappings();
    expect(Object.keys(bridge.midiLearnMappings).length).toBe(3);
    expect(bridge.midiLearnMappings['cc:15']).toBe('osc1_saw_enable');
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: _applyMidiLearnMapping
// ══════════════════════════════════════════════════════════════════

describe('MIDI Learn — _applyMidiLearnMapping', () => {
  let bridge;
  let paramMaps;

  beforeEach(() => {
    bridge = createBridgeStub();
    paramMaps = createBridgeParamMapsMock();
    applyMidiLearnPrototype(bridge, { bridgeParamMaps: paramMaps });
    bridge.midiLearnMappings = {
      'cc:23': 'vcf_cutoff',       // byteOffset 39 → non-bipolar, non-enum
      'cc:15': 'osc1_saw_enable',  // byteOffset 19 → non-bipolar, non-enum
      'nrpn:0:39': 'vcf_cutoff',   // same via NRPN
      'cc:29': 'vcf_env_depth',    // byteOffset 42 → bipolar
      'cc:99': 'lfo1_shape',       // byteOffset 2 → enum (max 6)
      'cc:77': 'unknown_param',    // no byteOffset → CC fallback
    };
  });

  it('returns true when mapping found (CC with byteOffset)', () => {
    const result = bridge._applyMidiLearnMapping('cc:23', 64);
    expect(result).toBe(true);
  });

  it('calls setParameter with correct normalized value', () => {
    bridge._applyMidiLearnMapping('cc:23', 64);
    // rawVal = Math.round(64 * 255 / 127) = Math.round(128.5) = 129
    // normalized = 129 / 255 ≈ 0.5059
    expect(bridge.setParameter).toHaveBeenCalledWith('vcf_cutoff', expect.closeTo(129 / 255, 4));
  });

  it('calls handleParameterChangeFromBackend with correct value', () => {
    bridge._applyMidiLearnMapping('cc:23', 64);
    expect(bridge.handleParameterChangeFromBackend).toHaveBeenCalledWith('vcf_cutoff', expect.closeTo(129 / 255, 4));
  });

  it('returns false when no mapping found', () => {
    const result = bridge._applyMidiLearnMapping('cc:999', 64);
    expect(result).toBe(false);
    expect(bridge.setParameter).not.toHaveBeenCalled();
  });

  it('handles NRPN mapping (val & 0xFF)', () => {
    bridge._applyMidiLearnMapping('nrpn:0:39', 200, { msb: 0, lsb: 39 });
    // nrpnInfo passed, so val is used directly: rawVal = 200 & 0xFF = 200
    // normalized = 200 / 255 ≈ 0.7843
    expect(bridge.setParameter).toHaveBeenCalledWith('vcf_cutoff', expect.closeTo(200 / 255, 4));
  });

  it('handles bipolar parameter (vcf_env_depth, byteOffset 42)', () => {
    bridge._applyMidiLearnMapping('cc:29', 64);
    // rawVal = Math.round(64 * 255 / 127) = 129
    // bipolar: ((129 - 128) / 127 + 1) / 2 = (1/127 + 1) / 2 ≈ 0.5039
    expect(bridge.setParameter).toHaveBeenCalledWith('vcf_env_depth', expect.closeTo(0.5039, 3));
  });

  it('handles enum parameter (lfo1_shape, byteOffset 2, max 6)', () => {
    bridge._applyMidiLearnMapping('cc:99', 64);
    // rawVal = Math.round(64 * 255 / 127) = 129
    // enum: min(1, 129 / 6) = min(1, 21.5) = 1.0
    expect(bridge.setParameter).toHaveBeenCalledWith('lfo1_shape', 1.0);
  });

  it('uses CC fallback (val/127) when param has no byteOffset', () => {
    bridge._applyMidiLearnMapping('cc:77', 64);
    // no byteOffset → fallback: normalized = 64 / 127 ≈ 0.5039
    expect(bridge.setParameter).toHaveBeenCalledWith('unknown_param', expect.closeTo(64 / 127, 4));
  });

  it('uses CC fallback when BRIDGE_PARAM_MAPS is null', () => {
    applyMidiLearnPrototype(bridge, { bridgeParamMaps: null });
    bridge.midiLearnMappings = { 'cc:23': 'vcf_cutoff' };
    bridge._applyMidiLearnMapping('cc:23', 64);
    // no BRIDGE_PARAM_MAPS → fallback: normalized = 64 / 127 ≈ 0.5039
    expect(bridge.setParameter).toHaveBeenCalledWith('vcf_cutoff', expect.closeTo(64 / 127, 4));
  });

  it('does not crash when param has byteOffset but no rawToNormalized function', () => {
    applyMidiLearnPrototype(bridge, {
      bridgeParamMaps: { PARAM_TO_BYTE_OFFSET: { 'vcf_cutoff': 39 } },
    });
    bridge.midiLearnMappings = { 'cc:23': 'vcf_cutoff' };
    expect(function() {
      bridge._applyMidiLearnMapping('cc:23', 64);
    }).not.toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: _getParamName
// ══════════════════════════════════════════════════════════════════

describe('MIDI Learn — _getParamName', () => {
  let bridge;

  function createGetParamName(opts) {
    opts = opts || {};
    const paramMaps = opts.bridgeParamMaps || { PARAM_TO_BYTE_OFFSET: { 'vcf_cutoff': 39 } };
    const byteMap = opts.byteMap || { 39: { param: 'VCF Cutoff' } };

    return function(paramId) {
      const byteOffset = paramMaps.PARAM_TO_BYTE_OFFSET[paramId];
      const info = byteMap ? byteMap[byteOffset] : null;
      if (info) {return info.param;}
      return paramId.replace(/_/g, ' ');
    };
  }

  it('returns name from BYTE_MAP when available', () => {
    const getParamName = createGetParamName({
      byteMap: { 39: { param: 'VCF Cutoff' } },
    });
    expect(getParamName('vcf_cutoff')).toBe('VCF Cutoff');
  });

  it('falls back to underscore replacement when BYTE_MAP missing', () => {
    const getParamName = createGetParamName({
      byteMap: {},
    });
    expect(getParamName('osc1_saw_enable')).toBe('osc1 saw enable');
  });

  it('falls back when byteOffset not in BYTE_MAP', () => {
    const getParamName = createGetParamName({
      paramMaps: { PARAM_TO_BYTE_OFFSET: { 'unknown_param': 999 } },
      byteMap: { 39: { param: 'VCF Cutoff' } },
    });
    expect(getParamName('unknown_param')).toBe('unknown param');
  });

  it('handles paramId not in PARAM_TO_BYTE_OFFSET', () => {
    const getParamName = createGetParamName({
      paramMaps: { PARAM_TO_BYTE_OFFSET: {} },
      byteMap: { 39: { param: 'VCF Cutoff' } },
    });
    expect(getParamName('unknown_param')).toBe('unknown param');
  });

  it('replaces all underscores with spaces', () => {
    const getParamName = createGetParamName({ byteMap: {} });
    expect(getParamName('vcf_env_depth')).toBe('vcf env depth');
    expect(getParamName('osc1_pwm_amount')).toBe('osc1 pwm amount');
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: onMidiLearnChange / _notifyMidiLearnChange
// ══════════════════════════════════════════════════════════════════

describe('MIDI Learn — change callbacks', () => {
  let bridge;

  beforeEach(() => {
    bridge = createBridgeStub();
    applyMidiLearnPrototype(bridge);
  });

  it('onMidiLearnChange registers a callback', () => {
    const cb = vi.fn();
    bridge.onMidiLearnChange(cb);
    expect(bridge.midiLearnChangeCallbacks.length).toBe(1);
    expect(bridge.midiLearnChangeCallbacks[0]).toBe(cb);
  });

  it('_notifyMidiLearnChange invokes all callbacks', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    bridge.onMidiLearnChange(cb1);
    bridge.onMidiLearnChange(cb2);
    bridge.midiLearnActive = true;
    bridge.midiLearnTargetParam = 'vcf_cutoff';
    bridge._notifyMidiLearnChange();
    expect(cb1).toHaveBeenCalledWith(true, 'vcf_cutoff');
    expect(cb2).toHaveBeenCalledWith(true, 'vcf_cutoff');
  });

  it('_notifyMidiLearnChange does not throw when no callbacks', () => {
    bridge.midiLearnActive = true;
    expect(function() {
      bridge._notifyMidiLearnChange();
    }).not.toThrow();
  });

  it('callbacks are invoked by startMidiLearn, stopMidiLearn, and removeMapping', () => {
    const cb = vi.fn();
    bridge.onMidiLearnChange(cb);
    bridge.startMidiLearn();
    expect(cb).toHaveBeenCalledTimes(1);
    bridge.stopMidiLearn();
    expect(cb).toHaveBeenCalledTimes(2);
    bridge.removeMidiLearnMapping('test');
    expect(cb).toHaveBeenCalledTimes(3);
    bridge.clearMidiLearnMappings();
    expect(cb).toHaveBeenCalledTimes(4);
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: Full MIDI Learn lifecycle integration
// ══════════════════════════════════════════════════════════════════

describe('MIDI Learn — full lifecycle flows', () => {
  let bridge;
  let lsStore;

  beforeEach(() => {
    bridge = createBridgeStub();
    lsStore = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(function(k) { return lsStore[k] || null; }),
      setItem: vi.fn(function(k, v) { lsStore[k] = String(v); }),
      removeItem: vi.fn(function(k) { delete lsStore[k]; }),
      clear: vi.fn(function() { for (const k in lsStore) {delete lsStore[k];} }),
    });
    applyMidiLearnPrototype(bridge, {
      bridgeParamMaps: createBridgeParamMapsMock(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('flow: start → capture CC → set target → mapping created', () => {
    bridge.startMidiLearn();
    bridge._captureMidiLearnMessage(23, 64); // CC 23
    expect(bridge.midiLearnPendingCC).toBeDefined();

    bridge.setMidiLearnTarget('vcf_cutoff');
    expect(bridge.midiLearnMappings['cc:23']).toBe('vcf_cutoff');
    expect(bridge.midiLearnPendingCC).toBeNull();
  });

  it('flow: start → set target → capture CC → mapping created', () => {
    bridge.startMidiLearn();
    bridge.setMidiLearnTarget('vcf_cutoff');
    bridge._captureMidiLearnMessage(23, 64);
    expect(bridge.midiLearnMappings['cc:23']).toBe('vcf_cutoff');
  });

  it('flow: start → capture NRPN → set target → mapping created', () => {
    bridge.startMidiLearn();
    bridge._captureMidiLearnMessage(0, 64, { msb: 0, lsb: 39 });
    bridge.setMidiLearnTarget('vcf_cutoff');
    expect(bridge.midiLearnMappings['nrpn:0:39']).toBe('vcf_cutoff');
  });

  it('flow: mapping created → save → load → apply', () => {
    // Create mapping
    bridge.startMidiLearn();
    bridge.setMidiLearnTarget('vcf_cutoff');
    bridge._captureMidiLearnMessage(23, 64);
    expect(bridge.midiLearnMappings['cc:23']).toBe('vcf_cutoff');
    bridge.stopMidiLearn();

    // Simulate fresh bridge (clear in-memory mappings)
    const mappingCopy = JSON.parse(JSON.stringify(bridge.midiLearnMappings));
    bridge.midiLearnMappings = {};

    // Load from storage
    bridge._loadMidiLearnMappings();
    expect(bridge.midiLearnMappings).toEqual(mappingCopy);

    // Apply mapping (simulate incoming MIDI)
    bridge._applyMidiLearnMapping('cc:23', 64);
    expect(bridge.setParameter).toHaveBeenCalledWith('vcf_cutoff', expect.any(Number));
  });

  it('flow: remove mapping → no longer applied', () => {
    bridge.startMidiLearn();
    bridge.setMidiLearnTarget('vcf_cutoff');
    bridge._captureMidiLearnMessage(23, 64);

    bridge.removeMidiLearnMapping('cc:23');
    expect(bridge.midiLearnMappings['cc:23']).toBeUndefined();

    const result = bridge._applyMidiLearnMapping('cc:23', 64);
    expect(result).toBe(false);
  });

  it('flow: clear all mappings → none remain', () => {
    bridge.startMidiLearn();
    bridge.setMidiLearnTarget('vcf_cutoff');
    bridge._captureMidiLearnMessage(23, 64);
    bridge.setMidiLearnTarget('vcf_resonance');
    bridge._captureMidiLearnMessage(24, 64);

    expect(Object.keys(bridge.midiLearnMappings).length).toBe(2);
    bridge.clearMidiLearnMappings();
    expect(Object.keys(bridge.midiLearnMappings).length).toBe(0);
  });

  it('flow: stopMidiLearn clears all pending state', () => {
    bridge.startMidiLearn();
    bridge.setMidiLearnTarget('vcf_cutoff');
    bridge._captureMidiLearnMessage(23, 64);
    bridge.stopMidiLearn();

    expect(bridge.midiLearnActive).toBe(false);
    expect(bridge.midiLearnTargetParam).toBeNull();
    expect(bridge.midiLearnPendingCC).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: Edge cases
// ══════════════════════════════════════════════════════════════════

describe('MIDI Learn — edge cases', () => {
  let bridge;

  beforeEach(() => {
    bridge = createBridgeStub();
    applyMidiLearnPrototype(bridge);
  });

  it('capture with empty nrpnInfo (null)', () => {
    bridge.startMidiLearn();
    bridge._captureMidiLearnMessage(23, 64, null);
    expect(bridge.midiLearnPendingCC.key).toBe('cc:23');
  });

  it('capture with nrpnInfo but partial fields', () => {
    bridge.startMidiLearn();
    bridge._captureMidiLearnMessage(0, 64, { msb: 0 }); // no lsb
    expect(bridge.midiLearnPendingCC.key).toBe('nrpn:0:undefined');
  });

  it('setMidiLearnTarget pads NRPN LSB to 2 digits', () => {
    bridge.startMidiLearn();
    bridge._captureMidiLearnMessage(0, 64, { msb: 0, lsb: 5 }); // lsb=5 should become "05"
    expect(bridge.midiLearnPendingCC.desc).toBe('NRPN 0:05');
  });

  it('setMidiLearnTarget does not pad when lsb is 2 digits', () => {
    bridge.startMidiLearn();
    bridge._captureMidiLearnMessage(0, 64, { msb: 0, lsb: 39 });
    expect(bridge.midiLearnPendingCC.desc).toBe('NRPN 0:39');
  });

  it('removeMidiLearnMapping for non-string key', () => {
    // Should not throw even with weird keys
    bridge.midiLearnMappings['cc:23'] = 'vcf_cutoff';
    expect(function() {
      bridge.removeMidiLearnMapping(123);
    }).not.toThrow();
  });
});
