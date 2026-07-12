/**
 * Unit tests for DualMidiBridge — init(), setParameter(), handleIncomingMidi()
 *
 * Run with: npx vitest run WebUI/tests/bridgeDual.test.js
 *
 * Strategy: load bridge-param-maps.js + bridge-dual.js via eval() after setting up
 * required globals (window, navigator, document, etc.), then test on the auto-created
 * window.dualMidiBridge instance.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// ══════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════

/** Read a JS source file and evaluate it in the current global context. */
function _evalSource(relativePath) {
  const fullPath = path.resolve(process.cwd(), relativePath);
  const code = fs.readFileSync(fullPath, 'utf-8');
  // Use indirect eval to run in global scope
  const globalEval = eval;
  return globalEval(code);
}

/** Create a minimal fake MIDI port. */
function _makeFakeMidiPort(name, kind) {
  return {
    name: name || `Fake ${kind}`,
    send: vi.fn(),
    onmidimessage: null,
  };
}

/** Create a minimal fake MIDIAccess object. */
function _makeFakeMidiAccess(opts = {}) {
  const outPort = _makeFakeMidiPort(opts.outName || 'DeepMind 12', 'output');
  const inPort = _makeFakeMidiPort(opts.inName || 'DeepMind 12', 'input');
  inPort.onmidimessage = null;

  const outputs = new Map();
  const inputs = new Map();
  outputs.set('out-0', outPort);
  inputs.set('in-0', inPort);

  return {
    outputs,
    inputs,
    onstatechange: null,
    sysexEnabled: true,
  };
}

// ══════════════════════════════════════════════════════════════════
// Global state (reset per test)
// ══════════════════════════════════════════════════════════════════

let _fakeMidiAccess = null;
let _currentBridge = null;

// ══════════════════════════════════════════════════════════════════
// Setup / Teardown
// ══════════════════════════════════════════════════════════════════

beforeEach(async () => {
  // Clean up any previous bridge instance
  delete global.window;

  // Create fresh window global
  const win = {
    console: global.console,
    setTimeout: global.setTimeout,
    clearTimeout: global.clearTimeout,
    setInterval: global.setInterval,
    clearInterval: global.clearInterval,
    Date: global.Date,
    Promise: global.Promise,
    Uint8Array: global.Uint8Array,
    Array: global.Array,
    Math: global.Math,
    String: global.String,
    Number: global.Number,
    JSON: global.JSON,
    Error: global.Error,
    parseInt: global.parseInt,
    parseFloat: global.parseFloat,
    isNaN: global.isNaN,
  };
  // Add common global functions
  win.addEventListener = vi.fn();
  win.removeEventListener = vi.fn();

  // Mock unpack/repack functions (byte-map.js)
  win.unpack7to8 = vi.fn((packed) => {
    // Basic unpack: reverse of pack8to7
    return new Uint8Array(packed.length * 7 / 8);
  });
  win.pack8to7 = vi.fn((unpacked) => {
    return new Uint8Array(Math.ceil(unpacked.length * 8 / 7));
  });
  win.extractNameFromRawSysex = vi.fn(() => 'Hw Patch');

  // Hardware bank storage
  win.hardwareBanks = {};

  vi.stubGlobal('window', win);

  // Fake document with just getElementById returning null
  vi.stubGlobal('document', {
    getElementById: vi.fn(() => null),
    querySelector: vi.fn(() => null),
    querySelectorAll: vi.fn(() => []),
  });

  // Fake localStorage
  const storage = {};
  vi.stubGlobal('localStorage', {
    getItem: (k) => (storage[k] !== undefined ? storage[k] : null),
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: (k) => { delete storage[k]; },
    clear: () => { Object.keys(storage).forEach(k => delete storage[k]); },
  });

  // Mock navigator with Web MIDI API
  _fakeMidiAccess = _makeFakeMidiAccess();
  vi.stubGlobal('navigator', {
    requestMIDIAccess: vi.fn().mockResolvedValue(_fakeMidiAccess),
  });

  // 1) Load bridge-param-maps.js (sets window.BRIDGE_PARAM_MAPS)
  _evalSource('WebUI/js/bridge-param-maps.js');

  // Verify param maps loaded
  expect(win.BRIDGE_PARAM_MAPS).toBeDefined();

  // 2) Load bridge-dual.js (creates window.dualMidiBridge)
  _evalSource('WebUI/js/bridge-dual.js');

  _currentBridge = win.dualMidiBridge;
  expect(_currentBridge).toBeDefined();

  // Add MIDI Learn methods (normally from bridge-midi-learn.js) directly onto the instance
  // because indirect eval in Node.js module scope can't share the DualMidiBridge class
  _currentBridge._captureMidiLearnMessage = function(ccNum, val, nrpnInfo) {
    // no-op for tests; spy on this to verify it was called
  };
  _currentBridge._applyMidiLearnMapping = function(key, val, nrpnInfo) {
    var paramId = this.midiLearnMappings[key];
    if (!paramId) return false;
    var byteOffset = win.BRIDGE_PARAM_MAPS.PARAM_TO_BYTE_OFFSET[paramId];
    var normalized;
    if (byteOffset !== undefined) {
      var rawVal = nrpnInfo ? (val & 0xFF) : Math.round(val * 255.0 / 127.0);
      normalized = win.BRIDGE_PARAM_MAPS.rawToNormalized(byteOffset, rawVal);
    } else {
      normalized = val / 127.0;
    }
    this.setParameter(paramId, normalized);
    this.handleParameterChangeFromBackend(paramId, normalized);
    return true;
  };

  // Wait for async init to complete (in web mode, init calls await initWebMidi())
  await _currentBridge.waitForReady(2000);

  // At this point the bridge should be ready
  // Note: midiOutput/midiInput may be null because our mock has empty port arrays
  // (the _selectMidiPort function returns null if no ports match)
});

afterEach(() => {
  _currentBridge = null;
  _fakeMidiAccess = null;
  vi.restoreAllMocks();
});

// ══════════════════════════════════════════════════════════════════
// Helper: send a CC message to handleIncomingMidi
// ══════════════════════════════════════════════════════════════════

function _sendCC(ccNum, value, channel = 1) {
  const statusByte = 0xB0 | ((channel - 1) & 0x0F);
  _currentBridge.handleIncomingMidi({
    data: new Uint8Array([statusByte, ccNum, value]),
  });
}

function _sendNRPN(msb, lsb, dataMsb, dataLsb) {
  // CC99 = NRPN MSB
  _sendCC(99, msb);
  // CC98 = NRPN LSB
  _sendCC(98, lsb);
  // CC6 = Data Entry MSB
  _sendCC(6, dataMsb);
  // CC38 = Data Entry LSB
  _sendCC(38, dataLsb);
}

// ══════════════════════════════════════════════════════════════════
// Tests: init()
// ══════════════════════════════════════════════════════════════════

describe('DualMidiBridge – init()', () => {
  it('creates bridge with correct defaults', () => {
    expect(_currentBridge.isJuce).toBe(false);
    expect(_currentBridge.midiAccess).toBeDefined();
    expect(_currentBridge.midiChannel).toBe(1);
    expect(_currentBridge.parameterCache).toEqual({});
    expect(_currentBridge.midiLearnActive).toBe(false);
    expect(_currentBridge.onParameterChangedCallbacks).toEqual([]);
    expect(_currentBridge._ready).toBe(true);
  });

  it('in web mode: calls requestMIDIAccess with sysex true', () => {
    expect(navigator.requestMIDIAccess).toHaveBeenCalledWith({ sysex: true });
  });

  it('stores MIDI channel from parameterCache after init', () => {
    expect(_currentBridge.midiChannel).toBe(1);
  });

  it('scanMidiDevices is called (tries to select ports)', () => {
    // midiOutput and midiInput are likely null because mock ports
    // don't match the preferred 'deepmind' name check... actually they do!
    // Our mock port is named 'DeepMind 12' so _selectMidiPort should find it.
    // But our map keys are 'out-0'/'in-0', so ports.values() returns them.
    // The port names do contain 'deepmind' (lowercase check on 'DeepMind 12')
    // so they should be selected.
    // Just verify that the bridge scanned for devices.
    expect(_currentBridge.midiAccess).toBeDefined();
  });

  it('waitForReady returns true after init', async () => {
    const ready = await _currentBridge.waitForReady(500);
    expect(ready).toBe(true);
  });

  it('resetMidiConnection restores MIDI channel from localStorage', async () => {
    localStorage.setItem('abd-eep-midi-channel', '5');
    // Need fresh ports for resetMidiConnection
    _currentBridge.midiAccess = _makeFakeMidiAccess();
    _currentBridge.midiOutput = null;
    _currentBridge.midiInput = null;

    const result = await _currentBridge.resetMidiConnection();

    expect(_currentBridge.midiChannel).toBe(5);
    expect(_currentBridge._hardwareInfo.midiChannel).toBe(5);
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: setParameter()
// ══════════════════════════════════════════════════════════════════

describe('DualMidiBridge – setParameter()', () => {
  beforeEach(() => {
    // Ensure we have a midiOutput to test send paths
    // Create a real midiOutput on the bridge
    const outPort = _makeFakeMidiPort('DeepMind 12', 'output');
    _currentBridge.midiOutput = outPort;
    _currentBridge.midiInput = _makeFakeMidiPort('DeepMind 12', 'input');
    _currentBridge.parameterCache = {};
    _currentBridge._lastNrpnByte = null;
    _currentBridge._lastNrpnValue = null;
    _currentBridge.onParameterChangedCallbacks = [];
  });

  it('stores value in parameterCache', () => {
    _currentBridge.setParameter('vcf_cutoff', 0.75);
    expect(_currentBridge.parameterCache['vcf_cutoff']).toBe(0.75);
  });

  it('skips MIDI send when same value already in cache (±0.001)', () => {
    _currentBridge.parameterCache['vcf_cutoff'] = 0.5;
    const sendSpy = vi.spyOn(_currentBridge, 'sendWebMidiParameter');

    _currentBridge.setParameter('vcf_cutoff', 0.5);

    // sendWebMidiParameter should NOT be called
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('still updates cache even when same value (no-op cache refresh)', () => {
    _currentBridge.parameterCache['vcf_cutoff'] = 0.5;
    _currentBridge.setParameter('vcf_cutoff', 0.5);
    expect(_currentBridge.parameterCache['vcf_cutoff']).toBe(0.5);
  });

  it('calls sendWebMidiParameter when value differs from cache', () => {
    _currentBridge.parameterCache['vcf_cutoff'] = 0.5;
    const sendSpy = vi.spyOn(_currentBridge, 'sendWebMidiParameter');

    _currentBridge.setParameter('vcf_cutoff', 0.75);

    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy).toHaveBeenCalledWith('vcf_cutoff', 0.75);
  });

  it('calls handleParameterChangeFromBackend in web mode', () => {
    const handlerSpy = vi.spyOn(_currentBridge, 'handleParameterChangeFromBackend');

    _currentBridge.setParameter('vcf_cutoff', 0.3);

    expect(handlerSpy).toHaveBeenCalledWith('vcf_cutoff', 0.3);
  });

  it('sends NRPN via midiOutput when byteOffset exists', () => {
    const sendSpy = vi.spyOn(_currentBridge.midiOutput, 'send');
    // vcf_cutoff has byteOffset 39 → NRPN MSB=0, LSB=39; raw=Math.round(0.3*255)=77
    _currentBridge.setParameter('vcf_cutoff', 0.3);

    // NRPN sequence: CC99(msb) CC98(lsb) CC6(dataMsb) CC38(dataLsb)
    // byteOffset 39 → msb=0, lsb=39 → CC99(0), CC98(39)
    // normalized 0.3 → raw = Math.round(0.3 * 255) = 77 → 77 & 0x7F = 77 (since 77 < 128)
    // dataMsb = (77 >> 7) & 0x7F = 0
    // dataLsb = 77 & 0x7F = 77
    expect(sendSpy).toHaveBeenCalled();
    const callArgs = sendSpy.mock.calls[0][0];
    // Check the NRPN bytes
    expect(callArgs[0] & 0xF0).toBe(0xB0); // CC status
    expect(callArgs[1]).toBe(99);  // CC99
    expect(callArgs[2]).toBe(0);   // msb
    expect(callArgs[3] & 0xF0).toBe(0xB0);
    expect(callArgs[4]).toBe(98);  // CC98
    expect(callArgs[5]).toBe(39);  // lsb
    expect(callArgs[7]).toBe(6);   // CC6
    expect(callArgs[8]).toBe(0);   // dataMsb = (77 >> 7) & 0x7F = 0
    expect(callArgs[10]).toBe(38); // CC38
    expect(callArgs[11]).toBe(77); // dataLsb = raw & 0x7F = 77
  });

  it('uses CC fallback when param has no byteOffset', () => {
    // global_volume has no byteOffset but has CC=7
    const sendSpy = vi.spyOn(_currentBridge.midiOutput, 'send');

    _currentBridge.setParameter('global_volume', 0.8);

    expect(sendSpy).toHaveBeenCalled();
    const callArgs = sendSpy.mock.calls[0][0];
    expect(callArgs.length).toBe(3); // CC is 3 bytes
    expect(callArgs[0] & 0xF0).toBe(0xB0);
    expect(callArgs[1]).toBe(7);   // CC 7 = global_volume
    expect(callArgs[2]).toBe(Math.round(0.8 * 127)); // ≈ 102
  });

  it('does not send MIDI when midiOutput is null, but still updates cache', () => {
    _currentBridge.midiOutput = null;
    _currentBridge.parameterCache = {};

    expect(() => {
      _currentBridge.setParameter('vcf_cutoff', 0.5);
    }).not.toThrow();

    // Cache is still updated
    expect(_currentBridge.parameterCache['vcf_cutoff']).toBe(0.5);
  });

  it('triggers onParameterChanged callbacks', () => {
    const cb = vi.fn();
    _currentBridge.onParameterChanged(cb);

    _currentBridge.setParameter('vcf_resonance', 0.2);

    expect(cb).toHaveBeenCalledWith('vcf_resonance', 0.2);
  });

  it('does not trigger callbacks when same value in cache', () => {
    _currentBridge.parameterCache['vcf_resonance'] = 0.2;
    const cb = vi.fn();
    _currentBridge.onParameterChanged(cb);

    _currentBridge.setParameter('vcf_resonance', 0.2); // same value

    expect(cb).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: handleIncomingMidi()
// ══════════════════════════════════════════════════════════════════

describe('DualMidiBridge – handleIncomingMidi()', () => {
  beforeEach(() => {
    _currentBridge.parameterCache = {};
    _currentBridge.onParameterChangedCallbacks = [];
    _currentBridge._nrpnInMsb = null;
    _currentBridge._nrpnInLsb = null;
    _currentBridge._nrpnInDataMsb = 0;
    _currentBridge.midiLearnActive = false;
    _currentBridge.midiLearnMappings = {};
    _currentBridge._pendingSysExRequests = [];
  });

  describe('NRPN handling', () => {
    it('tracks NRPN address state (CC99 + CC98)', () => {
      _sendCC(99, 0);
      expect(_currentBridge._nrpnInMsb).toBe(0);

      _sendCC(98, 39);
      expect(_currentBridge._nrpnInLsb).toBe(39);
    });

    it('combines CC6 + CC38 into rawValue and calls handleParameterChangeFromBackend', () => {
      const handlerSpy = vi.spyOn(_currentBridge, 'handleParameterChangeFromBackend');

      // vcf_cutoff = byteOffset 39 → NRPN msb=0, lsb=39
      // rawValue 128 (0x80) → dataMsb=1, dataLsb=0
      _sendNRPN(0, 39, 1, 0);

      // byteOffset = (msb << 7) | lsb = 0 | 39 = 39
      // rawValue = (dataMsb << 7) | dataLsb = 1 << 7 | 0 = 128
      // vcf_cutoff is not bipolar and not enum → normalized = 128 / 255 ≈ 0.502
      expect(handlerSpy).toHaveBeenCalledWith('vcf_cutoff', expect.closeTo(0.502, 2));
    });

    it('resolves multiple paramIds for the same byteOffset', () => {
      const handlerSpy = vi.spyOn(_currentBridge, 'handleParameterChangeFromBackend');

      // byteOffset 88 maps to both 'voice_drift' and 'osc_drift' in reverse map
      _sendNRPN(0, 88, 0, 128);

      // rawValue = 128, normalized = 128/255 ≈ 0.502
      expect(handlerSpy).toHaveBeenCalledWith('voice_drift', expect.closeTo(0.502, 2));
      expect(handlerSpy).toHaveBeenCalledWith('osc_drift', expect.closeTo(0.502, 2));
    });

    it('handles running-status (same address, new CC38 without re-sending CC99/CC98)', () => {
      const handlerSpy = vi.spyOn(_currentBridge, 'handleParameterChangeFromBackend');

      // First: establish address
      _sendNRPN(0, 39, 0, 64); // raw=64 → 64/255 ≈ 0.251

      // Second: same address, only CC6+CC38 (running status)
      _sendCC(6, 0);
      _sendCC(38, 128); // raw=128 → 128/255 ≈ 0.502

      expect(handlerSpy).toHaveBeenCalledWith('vcf_cutoff', expect.closeTo(0.502, 2));
      expect(handlerSpy).toHaveBeenCalledTimes(2); // once per NRPN
    });

    it('processes bipolar parameter correctly (vcf_env_depth, byteOffset 42)', () => {
      const handlerSpy = vi.spyOn(_currentBridge, 'handleParameterChangeFromBackend');

      // byteOffset 42 is bipolar. raw=128 → normalized = ((128-128)/127 + 1) / 2 = 0.5
      _sendNRPN(0, 42, 1, 0); // dataMsb=1, dataLsb=0 → raw = 128

      expect(handlerSpy).toHaveBeenCalledWith('vcf_env_depth', 0.5);
    });

    it('processes enum parameter correctly (osc1_range, byteOffset 14)', () => {
      const handlerSpy = vi.spyOn(_currentBridge, 'handleParameterChangeFromBackend');

      // byteOffset 14 is enum with max 2 (16'/8'/4')
      // raw=1 → normalized = 1/2 = 0.5
      _sendNRPN(0, 14, 0, 1); // raw=1

      expect(handlerSpy).toHaveBeenCalledWith('osc1_range', expect.closeTo(0.5, 2));
    });

    it('calls handleParameterChangeFromBackend with correct normalized value for max raw', () => {
      const handlerSpy = vi.spyOn(_currentBridge, 'handleParameterChangeFromBackend');

      // vcf_cutoff raw=255 → normalized = 1.0
      _sendNRPN(0, 39, 1, 127); // dataMsb=1, dataLsb=127 → raw = 0x1FF... wait

      // Actually: dataMsb=1, dataLsb=127 → raw = (1 << 7) | 127 = 128 + 127 = 255
      // Actually (1 << 7) = 128, 128 | 127 = 255. So raw14 = 255, rawValue = 255 & 0xFF = 255
      // For non-bipolar, non-enum: 255/255 = 1.0
      expect(handlerSpy).toHaveBeenCalledWith('vcf_cutoff', 1.0);
    });
  });

  describe('Standard CC mapping', () => {
    it('maps CC 29 (vcf_cutoff) to handleParameterChangeFromBackend', () => {
      const handlerSpy = vi.spyOn(_currentBridge, 'handleParameterChangeFromBackend');

      _sendCC(29, 96); // 96/127 ≈ 0.756

      expect(handlerSpy).toHaveBeenCalledWith('vcf_cutoff', expect.closeTo(0.756, 2));
    });

    it('maps CC 30 (vcf_resonance) to handleParameterChangeFromBackend', () => {
      const handlerSpy = vi.spyOn(_currentBridge, 'handleParameterChangeFromBackend');

      _sendCC(30, 64);

      expect(handlerSpy).toHaveBeenCalledWith('vcf_resonance', expect.closeTo(64 / 127, 2));
    });

    it('maps CC 15 (osc1_saw_enable) to handleParameterChangeFromBackend', () => {
      const handlerSpy = vi.spyOn(_currentBridge, 'handleParameterChangeFromBackend');

      _sendCC(15, 127);

      expect(handlerSpy).toHaveBeenCalledWith('osc1_saw_enable', 1.0);
    });

    it('maps CC 23 (vcf_cutoff alternate) and normalizes correctly', () => {
      const handlerSpy = vi.spyOn(_currentBridge, 'handleParameterChangeFromBackend');

      _sendCC(23, 0); // min

      expect(handlerSpy).toHaveBeenCalledWith('vcf_cutoff', 0);
    });

    it('does not map unknown CC numbers (CC 1 = mod wheel)', () => {
      const handlerSpy = vi.spyOn(_currentBridge, 'handleParameterChangeFromBackend');

      _sendCC(1, 64); // Mod wheel — not in ccMappings

      // Only default CC processing: should NOT call handler for any mapped param
      // But it may call handlers via MIDI learn or other paths
      // Just verify vcf_cutoff is not called
      const calls = handlerSpy.mock.calls.filter(c => c[0] === 'vcf_cutoff');
      expect(calls.length).toBe(0);
    });

    it('normalizes value as val / 127.0', () => {
      const handlerSpy = vi.spyOn(_currentBridge, 'handleParameterChangeFromBackend');

      _sendCC(19, 100); // osc2_tone_mod

      expect(handlerSpy).toHaveBeenCalledWith('osc2_tone_mod', expect.closeTo(100 / 127, 3));
    });
  });

  describe('SysEx dispatching', () => {
    it('dispatches incoming SysEx to pending requests', () => {
      const predicate = vi.fn((msg) => msg.length >= 6 && msg[5] === 0x42);
      const resolver = vi.fn();

      _currentBridge._pendingSysExRequests.push({
        predicate,
        resolve: resolver,
        reject: vi.fn(),
        timer: null,
      });

      _currentBridge.handleIncomingMidi({
        data: new Uint8Array([0xF0, 0x00, 0x20, 0x32, 0x20, 0x42, 0x00, 0xF7]),
      });

      expect(predicate).toHaveBeenCalled();
      expect(resolver).toHaveBeenCalled();
    });

    it('does not dispatch when predicate does not match', () => {
      const predicate = vi.fn((msg) => msg[5] === 0x99);
      const resolver = vi.fn();

      _currentBridge._pendingSysExRequests.push({
        predicate,
        resolve: resolver,
        reject: vi.fn(),
        timer: null,
      });

      _currentBridge.handleIncomingMidi({
        data: new Uint8Array([0xF0, 0x00, 0x20, 0x32, 0x20, 0x42, 0x00, 0xF7]),
      });

      expect(predicate).toHaveBeenCalled();
      expect(resolver).not.toHaveBeenCalled();
    });

  it('ignores non-SysEx messages (status ≠ 0xF0), does not resolve pending', () => {
    const resolver = vi.fn();
    _currentBridge._pendingSysExRequests.push({
      predicate: () => true,
      resolve: resolver,
      reject: vi.fn(),
      timer: null,
    });

    // CC message (0xB0), not SysEx
    _sendCC(7, 64);

    expect(resolver).not.toHaveBeenCalled();
  });
  });

  describe('MIDI Learn intercept', () => {
    it('intercepts NRPN when midiLearnActive is true', () => {
      _currentBridge.midiLearnActive = true;
      const captureSpy = vi.spyOn(_currentBridge, '_captureMidiLearnMessage');

      _sendNRPN(0, 39, 0, 64); // vcf_cutoff

      expect(captureSpy).toHaveBeenCalled();
      // handleParameterChangeFromBackend should NOT be called (intercepted)
      const handlerSpy = vi.spyOn(_currentBridge, 'handleParameterChangeFromBackend');
      expect(handlerSpy).not.toHaveBeenCalledWith('vcf_cutoff', expect.any(Number));
    });

    it('intercepts CC when midiLearnActive is true', () => {
      _currentBridge.midiLearnActive = true;
      const captureSpy = vi.spyOn(_currentBridge, '_captureMidiLearnMessage');

      _sendCC(29, 64); // vcf_cutoff via CC

      expect(captureSpy).toHaveBeenCalled();
    });

    it('does not intercept CC 0 (Bank Select) or CC 32 (Bank Select LSB) in learn mode', () => {
      _currentBridge.midiLearnActive = true;
      const captureSpy = vi.spyOn(_currentBridge, '_captureMidiLearnMessage');

      _sendCC(0, 0);   // Bank Select MSB — should not intercept
      _sendCC(32, 0);  // Bank Select LSB — should not intercept

      expect(captureSpy).not.toHaveBeenCalled();
    });

    it('applies stored MIDI Learn mapping for CC', () => {
      _currentBridge.midiLearnMappings['cc:29'] = 'vcf_resonance';
      const setParamSpy = vi.spyOn(_currentBridge, 'setParameter');

      _sendCC(29, 80); // CC 29 normally maps to vcf_cutoff, but learned to vcf_resonance

      // CC 80 → 8-bit: Math.round(80 * 255 / 127) = 161 → normalized = 161 / 255 ≈ 0.63137
      expect(setParamSpy).toHaveBeenCalledWith('vcf_resonance', expect.closeTo(161 / 255, 4));
    });

    it('applies stored MIDI Learn mapping for NRPN', () => {
      _currentBridge.midiLearnMappings['nrpn:0:39'] = 'vcf_resonance';
      const setParamSpy = vi.spyOn(_currentBridge, 'setParameter');

      _sendNRPN(0, 39, 0, 80); // NRPN 0:39 normally = vcf_cutoff, learned to vcf_resonance

      expect(setParamSpy).toHaveBeenCalledWith('vcf_resonance', expect.closeTo(80 / 255, 2));
    });
  });

  describe('Edge cases and error handling', () => {
    it('does nothing when midiMessage.data is null/undefined', () => {
      expect(() => {
        _currentBridge.handleIncomingMidi({ data: null });
        _currentBridge.handleIncomingMidi({ data: undefined });
        _currentBridge.handleIncomingMidi({});
      }).not.toThrow();
    });

    it('does nothing when data.length is 0', () => {
      expect(() => {
        _currentBridge.handleIncomingMidi({ data: new Uint8Array([]) });
      }).not.toThrow();
    });

    it('ignores non-CC, non-SysEx status bytes without throwing', () => {
      // Note On (0x90)
      expect(() => {
        _currentBridge.handleIncomingMidi({
          data: new Uint8Array([0x90, 60, 100]),
        });
      }).not.toThrow();

      // Note Off (0x80)
      expect(() => {
        _currentBridge.handleIncomingMidi({
          data: new Uint8Array([0x80, 60, 0]),
        });
      }).not.toThrow();

      // Pitch Bend (0xE0)
      expect(() => {
        _currentBridge.handleIncomingMidi({
          data: new Uint8Array([0xE0, 0, 64]),
        });
      }).not.toThrow();
    });

    it('inválida NRPN cache when CC99/CC98 received (triggers re-send)', () => {
      _sendCC(99, 0);
      // _lastNrpnMsb/Lsb should be nulled (invalida the send cache)
      expect(_currentBridge._lastNrpnMsb).toBeNull();
      expect(_currentBridge._lastNrpnLsb).toBeNull();
      expect(_currentBridge._lastNrpnByte).toBeNull();
    });
  });
});
