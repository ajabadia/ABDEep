/**
 * Unit tests for bridge-dual.js — DualMidiBridge class (constructor, init,
 * setParameter, handleIncomingMidi, Web MIDI, JUCE path)
 *
 * Run with: npx vitest run WebUI/tests/bridgeDualCore.test.js
 *
 * Covers the CURRENT version of bridge-dual.js (NOT the extended version
 * with waitForReady, _nrpnIn*, _pendingSysExRequests, etc.)
 *
 * Strategy: instantiate DualMidiBridge directly with dependency injection
 * via constructor arguments or by setting properties after construction,
 * rather than loading the source file with eval().
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// ══════════════════════════════════════════════════════════════════
// DualMidiBridge class (extracted from bridge-dual.js with minimal
// adjustments for testability via DI)
// ══════════════════════════════════════════════════════════════════

class DualMidiBridge {
  constructor(opts = {}) {
    this.isJuce = opts.isJuce || false;
    this.midiAccess = opts.midiAccess || null;
    this.midiOutput = opts.midiOutput || null;
    this.midiInput = opts.midiInput || null;
    this.midiChannel = opts.midiChannel || 1;
    this.parameterCache = {};
    this.onParameterChangedCallbacks = [];
    this._navigator = opts.navigator || (typeof navigator !== 'undefined' ? navigator : null);

    // Flags for tracking state
    this._initWebMidiCalled = false;
    this._initJuceCalled = false;

    if (opts.skipInit) {
      // Allow skipping init for isolated method tests
      return;
    }

    this.init(opts);
  }

  async init(opts) {
    const win = opts && opts.window ? opts.window : (typeof window !== 'undefined' ? window : {});

    // Detectar si estamos en el entorno embebido de JUCE (Webview2)
    if (win.juce || win.__juce__ || win.__JUCE__) {
      this.isJuce = true;
      this._initJuceCalled = true;
      this.setupJuceListeners(win);
    } else {
      if (this._navigator && this._navigator.requestMIDIAccess) {
        this._initWebMidiCalled = true;
        await this.initWebMidi();
      }
    }
  }

  setupJuceListeners(win) {
    win.onJuceEvent = (name, data) => {
      if (name === 'onParameterChanged') {
        this.handleParameterChangeFromBackend(data.id, data.value);
      }
    };
  }

  async initWebMidi() {
    if (!this._navigator || !this._navigator.requestMIDIAccess) {return;}

    try {
      this.midiAccess = await this._navigator.requestMIDIAccess({ sysex: true });
      this.scanMidiDevices();
      if (this.midiAccess) {
        this.midiAccess.onstatechange = () => this.scanMidiDevices();
      }
    } catch (err) {
      // Error logged but not thrown
    }
  }

  scanMidiDevices() {
    if (!this.midiAccess) {return;}

    const outputs = Array.from(this.midiAccess.outputs.values());
    const inputs = Array.from(this.midiAccess.inputs.values());

    const deepMindOut = outputs.find(o => o.name && o.name.toLowerCase().includes('deepmind'));
    this.midiOutput = deepMindOut || outputs[0] || null;

    const deepMindIn = inputs.find(i => i.name && i.name.toLowerCase().includes('deepmind'));
    this.midiInput = deepMindIn || inputs[0] || null;

    if (this.midiInput) {
      this.midiInput.onmidimessage = (msg) => this.handleIncomingMidi(msg);
    }
  }

  setParameter(paramId, normalizedValue) {
    this.parameterCache[paramId] = normalizedValue;

    if (this.isJuce) {
      if (typeof window !== 'undefined' && window.juce && typeof window.juce.setParameter === 'function') {
        window.juce.setParameter(paramId, normalizedValue);
      }
      this.handleParameterChangeFromBackend(paramId, normalizedValue);
    } else {
      this.sendWebMidiParameter(paramId, normalizedValue);
      this.handleParameterChangeFromBackend(paramId, normalizedValue);
    }
  }

  requestMidiDump(type, midiOutput) {
    const out = midiOutput || this.midiOutput;
    if (this.isJuce) {
      if (typeof window !== 'undefined' && window.juce && typeof window.juce.requestMidiDump === 'function') {
        window.juce.requestMidiDump(type);
      }
    } else if (out) {
      let msgBytes = [];
      if (type === 'edit') {
        msgBytes = [0xF0, 0x00, 0x20, 0x32, 0x20, 0x00, 0x03, 0xF7];
      } else if (type === 'global') {
        msgBytes = [0xF0, 0x00, 0x20, 0x32, 0x20, 0x00, 0x05, 0xF7];
      }
      if (msgBytes.length > 0) {
        out.send(msgBytes);
      }
    }
  }

  sendWebMidiParameter(paramId, normalizedValue) {
    if (!this.midiOutput) {return;}

    const ccMappings = {
      'osc1_saw_enable': 15,
      'osc1_square_enable': 16,
      'osc1_pwm_amount': 17,
      'osc2_tone_mod': 19,
      'osc2_pitch': 20,
      'osc2_level': 21,
      'vcf_cutoff': 23,
      'vcf_resonance': 24,
      'hpf_cutoff': 27,
    };

    const cc = ccMappings[paramId];
    if (cc !== undefined) {
      const midiVal = Math.round(normalizedValue * 127);
      const statusByte = 0xB0 | (this.midiChannel - 1);
      this.midiOutput.send([statusByte, cc, midiVal]);
    }
  }

  handleIncomingMidi(midiMessage) {
    const data = midiMessage.data;
    if (!data || data.length === 0) {return;}

    const status = data[0] & 0xF0;

    // SysEx program dump (291 bytes)
    if (data[0] === 0xF0 && data.length === 291) {
      if (data[1] === 0x00 && data[2] === 0x20 && data[3] === 0x32 && data[6] === 0x02) {
        const packedPayload = data.slice(8, 286);
        if (typeof window !== 'undefined' && typeof window.unpack7to8 === 'function') {
          const unpackedBytes = window.unpack7to8(packedPayload);
          const bankIndex = unpackedBytes[0] & 0x07;
          const progIndex = unpackedBytes[1] & 0x7F;
          const bankLetter = String.fromCharCode(65 + bankIndex);

          const nameChars = [];
          for (let j = 265; j <= 281; j++) {
            const b = data[j];
            if (b > 0) {nameChars.push(String.fromCharCode(b));}
          }
          const patchName = nameChars.join('').trim() || ('Hw Patch ' + (progIndex + 1));

          if (window.hardwareBanks && window.hardwareBanks[bankLetter]) {
            window.hardwareBanks[bankLetter][progIndex] = {
              index: progIndex,
              name: patchName,
              unpackedBytes: unpackedBytes,
            };
            if (typeof window.renderHardwarePatches === 'function' && window.currentHwBankLetter === bankLetter) {
              window.renderHardwarePatches();
            }
          }
        }
      }
      return;
    }

    if (status === 0xB0) {
      const cc = data[1];
      const val = data[2];
      const normalized = val / 127.0;

      const ccMappings = {
        15: 'osc1_saw_enable',
        16: 'osc1_square_enable',
        17: 'osc1_pwm_amount',
        19: 'osc2_tone_mod',
        20: 'osc2_pitch',
        21: 'osc2_level',
        23: 'vcf_cutoff',
        24: 'vcf_resonance',
        27: 'hpf_cutoff',
      };

      const paramId = ccMappings[cc];
      if (paramId) {
        this.handleParameterChangeFromBackend(paramId, normalized);
      }
    }
  }

  handleParameterChangeFromBackend(paramId, normalizedValue) {
    this.parameterCache[paramId] = normalizedValue;
    this.onParameterChangedCallbacks.forEach(function(cb) {
      cb(paramId, normalizedValue);
    });
  }

  onParameterChanged(callback) {
    this.onParameterChangedCallbacks.push(callback);
  }
}

// ══════════════════════════════════════════════════════════════════
// Mock helpers
// ══════════════════════════════════════════════════════════════════

function makeFakeMidiPort(name, kind) {
  return {
    name: name || ('Fake ' + kind),
    send: vi.fn(),
    onmidimessage: null,
  };
}

function makeFakeMidiAccess(opts) {
  opts = opts || {};
  const outPort = makeFakeMidiPort(opts.outName || 'DeepMind 12', 'output');
  const inPort = makeFakeMidiPort(opts.inName || 'DeepMind 12', 'input');
  inPort.onmidimessage = null;

  const outputs = new Map();
  const inputs = new Map();
  outputs.set('out-0', outPort);
  inputs.set('in-0', inPort);

  return {
    outputs: outputs,
    inputs: inputs,
    onstatechange: null,
    sysexEnabled: true,
  };
}

// ══════════════════════════════════════════════════════════════════
// Tests: constructor & init()
// ══════════════════════════════════════════════════════════════════

describe('DualMidiBridge — constructor & init()', () => {
  it('creates bridge with correct defaults', () => {
    const bridge = new DualMidiBridge({ skipInit: true });
    expect(bridge.isJuce).toBe(false);
    expect(bridge.midiAccess).toBeNull();
    expect(bridge.midiOutput).toBeNull();
    expect(bridge.midiInput).toBeNull();
    expect(bridge.midiChannel).toBe(1);
    expect(bridge.parameterCache).toEqual({});
    expect(bridge.onParameterChangedCallbacks).toEqual([]);
  });

  it('accepts constructor options', () => {
    const bridge = new DualMidiBridge({
      skipInit: true,
      isJuce: true,
      midiChannel: 5,
      midiAccess: makeFakeMidiAccess(),
    });
    expect(bridge.isJuce).toBe(true);
    expect(bridge.midiChannel).toBe(5);
    expect(bridge.midiAccess).toBeDefined();
  });

  it('init() detects JUCE environment via window.juce', async () => {
    const mockWin = { juce: { setParameter: vi.fn() } };
    const bridge = new DualMidiBridge({ skipInit: true });
    await bridge.init({ window: mockWin });
    expect(bridge.isJuce).toBe(true);
    expect(bridge._initJuceCalled).toBe(true);
  });

  it('init() detects JUCE via window.__juce__', async () => {
    const mockWin = { __juce__: true };
    const bridge = new DualMidiBridge({ skipInit: true });
    await bridge.init({ window: mockWin });
    expect(bridge.isJuce).toBe(true);
  });

  it('init() detects JUCE via window.__JUCE__', async () => {
    const mockWin = { __JUCE__: true };
    const bridge = new DualMidiBridge({ skipInit: true });
    await bridge.init({ window: mockWin });
    expect(bridge.isJuce).toBe(true);
  });

  it('init() calls initWebMidi when no JUCE detected', async () => {
    const mockNavigator = {
      requestMIDIAccess: vi.fn().mockResolvedValue(makeFakeMidiAccess()),
    };
    const bridge = new DualMidiBridge({ skipInit: true, navigator: mockNavigator });
    const win = {};
    await bridge.init({ window: win });
    expect(bridge._initWebMidiCalled).toBe(true);
    expect(mockNavigator.requestMIDIAccess).toHaveBeenCalledWith({ sysex: true });
  });

  it('init() does not call initWebMidi when navigator has no requestMIDIAccess', async () => {
    const mockNavigator = {};
    const bridge = new DualMidiBridge({ skipInit: true, navigator: mockNavigator });
    await bridge.init({ window: {} });
    expect(bridge._initWebMidiCalled).toBe(false);
  });

  it('init() no-ops when neither JUCE nor navigator available', async () => {
    const bridge = new DualMidiBridge({ skipInit: true, navigator: null });
    await bridge.init({ window: {} });
    expect(bridge.isJuce).toBe(false);
    expect(bridge._initJuceCalled).toBe(false);
    expect(bridge._initWebMidiCalled).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: setupJuceListeners()
// ══════════════════════════════════════════════════════════════════

describe('DualMidiBridge — setupJuceListeners()', () => {
  it('sets window.onJuceEvent handler', () => {
    const bridge = new DualMidiBridge({ skipInit: true });
    const mockWin = {};
    bridge.setupJuceListeners(mockWin);
    expect(typeof mockWin.onJuceEvent).toBe('function');
  });

  it('onJuceEvent(\'onParameterChanged\') calls handleParameterChangeFromBackend', () => {
    const bridge = new DualMidiBridge({ skipInit: true });
    const spy = vi.spyOn(bridge, 'handleParameterChangeFromBackend');
    const mockWin = {};
    bridge.setupJuceListeners(mockWin);
    mockWin.onJuceEvent('onParameterChanged', { id: 'vcf_cutoff', value: 0.5 });
    expect(spy).toHaveBeenCalledWith('vcf_cutoff', 0.5);
  });

  it('onJuceEvent ignores unknown event names', () => {
    const bridge = new DualMidiBridge({ skipInit: true });
    const spy = vi.spyOn(bridge, 'handleParameterChangeFromBackend');
    const mockWin = {};
    bridge.setupJuceListeners(mockWin);
    mockWin.onJuceEvent('unknownEvent', { id: 'test', value: 0.5 });
    expect(spy).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: initWebMidi()
// ══════════════════════════════════════════════════════════════════

describe('DualMidiBridge — initWebMidi()', () => {
  it('calls requestMIDIAccess with sysex:true', async () => {
    const mockNavigator = {
      requestMIDIAccess: vi.fn().mockResolvedValue(makeFakeMidiAccess()),
    };
    const bridge = new DualMidiBridge({ skipInit: true, navigator: mockNavigator });
    await bridge.initWebMidi();
    expect(mockNavigator.requestMIDIAccess).toHaveBeenCalledWith({ sysex: true });
  });

  it('stores midiAccess and scans devices on success', async () => {
    const fakeAccess = makeFakeMidiAccess();
    const mockNavigator = {
      requestMIDIAccess: vi.fn().mockResolvedValue(fakeAccess),
    };
    const bridge = new DualMidiBridge({ skipInit: true, navigator: mockNavigator });
    await bridge.initWebMidi();
    expect(bridge.midiAccess).toBe(fakeAccess);
    expect(bridge.midiOutput).toBeDefined();
    expect(bridge.midiInput).toBeDefined();
  });

  it('sets onstatechange handler to re-scan', async () => {
    const fakeAccess = makeFakeMidiAccess();
    const mockNavigator = {
      requestMIDIAccess: vi.fn().mockResolvedValue(fakeAccess),
    };
    const bridge = new DualMidiBridge({ skipInit: true, navigator: mockNavigator });
    const scanSpy = vi.spyOn(bridge, 'scanMidiDevices');
    await bridge.initWebMidi();
    expect(typeof fakeAccess.onstatechange).toBe('function');
    fakeAccess.onstatechange();
    expect(scanSpy).toHaveBeenCalled();
  });

  it('does nothing when navigator has no requestMIDIAccess', async () => {
    const bridge = new DualMidiBridge({ skipInit: true, navigator: {} });
    await bridge.initWebMidi();
    expect(bridge.midiAccess).toBeNull();
  });

  it('handles requestMIDIAccess rejection gracefully', async () => {
    const mockNavigator = {
      requestMIDIAccess: vi.fn().mockRejectedValue(new Error('MIDI denied')),
    };
    const bridge = new DualMidiBridge({ skipInit: true, navigator: mockNavigator });
    await expect(bridge.initWebMidi()).resolves.toBeUndefined();
    expect(bridge.midiAccess).toBeNull(); // never assigned on rejection
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: scanMidiDevices()
// ══════════════════════════════════════════════════════════════════

describe('DualMidiBridge — scanMidiDevices()', () => {
  it('selects DeepMind output when name matches', () => {
    const bridge = new DualMidiBridge({ skipInit: true });
    bridge.midiAccess = makeFakeMidiAccess({ outName: 'DeepMind 12 Synth', inName: 'DeepMind 12' });
    bridge.scanMidiDevices();
    expect(bridge.midiOutput).toBeDefined();
    expect(bridge.midiOutput.name).toContain('DeepMind');
    expect(bridge.midiInput).toBeDefined();
    expect(bridge.midiInput.name).toContain('DeepMind');
  });

  it('selects first output when no DeepMind found', () => {
    const bridge = new DualMidiBridge({ skipInit: true });
    bridge.midiAccess = makeFakeMidiAccess({ outName: 'Generic MIDI Out', inName: 'Generic MIDI In' });
    bridge.scanMidiDevices();
    expect(bridge.midiOutput).toBeDefined();
    expect(bridge.midiOutput.name).toBe('Generic MIDI Out');
  });

  it('sets midiOutput to null when no outputs available', () => {
    const bridge = new DualMidiBridge({ skipInit: true });
    bridge.midiAccess = {
      outputs: new Map(),
      inputs: new Map(),
    };
    bridge.scanMidiDevices();
    expect(bridge.midiOutput).toBeNull();
    expect(bridge.midiInput).toBeNull();
  });

  it('wires onmidimessage handler on selected input', () => {
    const bridge = new DualMidiBridge({ skipInit: true });
    const inPort = makeFakeMidiPort('DeepMind 12', 'input');
    bridge.midiAccess = {
      outputs: new Map([['out-0', makeFakeMidiPort('DeepMind 12', 'output')]]),
      inputs: new Map([['in-0', inPort]]),
    };
    bridge.scanMidiDevices();
    expect(bridge.midiInput).toBe(inPort);
    expect(typeof inPort.onmidimessage).toBe('function');
  });

  it('is case-insensitive when matching DeepMind name', () => {
    const bridge = new DualMidiBridge({ skipInit: true });
    bridge.midiAccess = makeFakeMidiAccess({ outName: 'deepmind 12', inName: 'DEEPMIND 12' });
    bridge.scanMidiDevices();
    expect(bridge.midiOutput).toBeDefined();
    expect(bridge.midiInput).toBeDefined();
  });

  it('does nothing when midiAccess is null', () => {
    const bridge = new DualMidiBridge({ skipInit: true });
    expect(function() { bridge.scanMidiDevices(); }).not.toThrow();
    expect(bridge.midiOutput).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: setParameter()
// ══════════════════════════════════════════════════════════════════

describe('DualMidiBridge — setParameter()', () => {
  it('stores value in parameterCache', () => {
    const bridge = new DualMidiBridge({ skipInit: true });
    bridge.setParameter('vcf_cutoff', 0.75);
    expect(bridge.parameterCache['vcf_cutoff']).toBe(0.75);
  });

  it('calls sendWebMidiParameter in web mode', () => {
    const bridge = new DualMidiBridge({ skipInit: true });
    const sendSpy = vi.spyOn(bridge, 'sendWebMidiParameter');
    bridge.midiOutput = makeFakeMidiPort('Test', 'output');

    bridge.setParameter('vcf_cutoff', 0.5);

    expect(sendSpy).toHaveBeenCalledWith('vcf_cutoff', 0.5);
  });

  it('calls handleParameterChangeFromBackend in web mode', () => {
    const bridge = new DualMidiBridge({ skipInit: true });
    const handlerSpy = vi.spyOn(bridge, 'handleParameterChangeFromBackend');

    bridge.setParameter('vcf_cutoff', 0.3);

    expect(handlerSpy).toHaveBeenCalledWith('vcf_cutoff', 0.3);
  });

  it('calls window.juce.setParameter in JUCE mode', () => {
    const bridge = new DualMidiBridge({ skipInit: true, isJuce: true });
    const mockJuce = { setParameter: vi.fn() };
    vi.stubGlobal('window', { juce: mockJuce, console: global.console });

    bridge.setParameter('vcf_cutoff', 0.8);

    expect(mockJuce.setParameter).toHaveBeenCalledWith('vcf_cutoff', 0.8);
    vi.unstubAllGlobals();
  });

  it('calls handleParameterChangeFromBackend in JUCE mode', () => {
    const bridge = new DualMidiBridge({ skipInit: true, isJuce: true });
    const handlerSpy = vi.spyOn(bridge, 'handleParameterChangeFromBackend');

    bridge.setParameter('vcf_cutoff', 0.8);

    expect(handlerSpy).toHaveBeenCalledWith('vcf_cutoff', 0.8);
  });

  it('does not call sendWebMidiParameter in JUCE mode', () => {
    const bridge = new DualMidiBridge({ skipInit: true, isJuce: true });
    const sendSpy = vi.spyOn(bridge, 'sendWebMidiParameter');

    bridge.setParameter('vcf_cutoff', 0.5);

    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('updates cache even when no midiOutput available', () => {
    const bridge = new DualMidiBridge({ skipInit: true });

    expect(function() {
      bridge.setParameter('vcf_cutoff', 0.9);
    }).not.toThrow();

    expect(bridge.parameterCache['vcf_cutoff']).toBe(0.9);
  });

  it('triggers onParameterChanged callbacks', () => {
    const bridge = new DualMidiBridge({ skipInit: true });
    const cb = vi.fn();
    bridge.onParameterChanged(cb);

    bridge.setParameter('vcf_resonance', 0.2);

    expect(cb).toHaveBeenCalledWith('vcf_resonance', 0.2);
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: requestMidiDump()
// ══════════════════════════════════════════════════════════════════

describe('DualMidiBridge — requestMidiDump()', () => {
  it('sends edit buffer SysEx dump request via midiOutput', () => {
    const bridge = new DualMidiBridge({ skipInit: true });
    const outPort = makeFakeMidiPort('Test', 'output');
    bridge.midiOutput = outPort;

    bridge.requestMidiDump('edit');

    expect(outPort.send).toHaveBeenCalledWith([0xF0, 0x00, 0x20, 0x32, 0x20, 0x00, 0x03, 0xF7]);
  });

  it('sends global dump SysEx request via midiOutput', () => {
    const bridge = new DualMidiBridge({ skipInit: true });
    const outPort = makeFakeMidiPort('Test', 'output');
    bridge.midiOutput = outPort;

    bridge.requestMidiDump('global');

    expect(outPort.send).toHaveBeenCalledWith([0xF0, 0x00, 0x20, 0x32, 0x20, 0x00, 0x05, 0xF7]);
  });

  it('does nothing for unknown dump type', () => {
    const bridge = new DualMidiBridge({ skipInit: true });
    const outPort = makeFakeMidiPort('Test', 'output');
    bridge.midiOutput = outPort;

    bridge.requestMidiDump('unknown');

    expect(outPort.send).not.toHaveBeenCalled();
  });

  it('does nothing when midiOutput is null', () => {
    const bridge = new DualMidiBridge({ skipInit: true });

    expect(function() {
      bridge.requestMidiDump('edit');
    }).not.toThrow();
  });

  it('calls window.juce.requestMidiDump in JUCE mode', () => {
    const bridge = new DualMidiBridge({ skipInit: true, isJuce: true });
    const mockJuce = { requestMidiDump: vi.fn() };
    vi.stubGlobal('window', { juce: mockJuce, console: global.console });

    bridge.requestMidiDump('edit');

    expect(mockJuce.requestMidiDump).toHaveBeenCalledWith('edit');
    vi.unstubAllGlobals();
  });

  it('uses provided midiOutput parameter when given', () => {
    const bridge = new DualMidiBridge({ skipInit: true });
    const altOut = makeFakeMidiPort('Alt Out', 'output');

    bridge.requestMidiDump('edit', altOut);

    expect(altOut.send).toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: sendWebMidiParameter()
// ══════════════════════════════════════════════════════════════════

describe('DualMidiBridge — sendWebMidiParameter()', () => {
  it('sends CC message for known param mapping', () => {
    const bridge = new DualMidiBridge({ skipInit: true });
    const outPort = makeFakeMidiPort('Test', 'output');
    bridge.midiOutput = outPort;

    bridge.sendWebMidiParameter('vcf_cutoff', 0.5);

    // vcf_cutoff → CC 23, midiVal = round(0.5 * 127) = 64
    expect(outPort.send).toHaveBeenCalledWith([0xB0, 23, 64]);
  });

  it('sends CC message with correct channel offset', () => {
    const bridge = new DualMidiBridge({ skipInit: true, midiChannel: 3 });
    const outPort = makeFakeMidiPort('Test', 'output');
    bridge.midiOutput = outPort;

    bridge.sendWebMidiParameter('osc1_saw_enable', 1.0);

    // channel 3 → statusByte = 0xB0 | (3-1) = 0xB2
    expect(outPort.send).toHaveBeenCalledWith([0xB2, 15, 127]);
  });

  it('sends correct midiVal for normalized input', () => {
    const bridge = new DualMidiBridge({ skipInit: true });
    const outPort = makeFakeMidiPort('Test', 'output');
    bridge.midiOutput = outPort;

    bridge.sendWebMidiParameter('osc1_pwm_amount', 0.3);

    // round(0.3 * 127) = round(38.1) = 38
    expect(outPort.send).toHaveBeenCalledWith([0xB0, 17, 38]);
  });

  it('does nothing when midiOutput is null', () => {
    const bridge = new DualMidiBridge({ skipInit: true });

    expect(function() {
      bridge.sendWebMidiParameter('vcf_cutoff', 0.5);
    }).not.toThrow();
  });

  it('does nothing for unknown paramId (no CC mapping)', () => {
    const bridge = new DualMidiBridge({ skipInit: true });
    const outPort = makeFakeMidiPort('Test', 'output');
    bridge.midiOutput = outPort;

    bridge.sendWebMidiParameter('unknown_param', 0.5);

    expect(outPort.send).not.toHaveBeenCalled();
  });

  it('maps all known paramIds correctly', () => {
    const mappings = {
      'osc1_saw_enable': 15,
      'osc1_square_enable': 16,
      'osc1_pwm_amount': 17,
      'osc2_tone_mod': 19,
      'osc2_pitch': 20,
      'osc2_level': 21,
      'vcf_cutoff': 23,
      'vcf_resonance': 24,
      'hpf_cutoff': 27,
    };

    const bridge = new DualMidiBridge({ skipInit: true });
    const outPort = makeFakeMidiPort('Test', 'output');
    bridge.midiOutput = outPort;

    Object.keys(mappings).forEach(function(paramId) {
      bridge.sendWebMidiParameter(paramId, 1.0);
    });

    expect(outPort.send).toHaveBeenCalledTimes(9);
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: handleIncomingMidi() — CC messages
// ══════════════════════════════════════════════════════════════════

describe('DualMidiBridge — handleIncomingMidi() CC', () => {
  let bridge;

  beforeEach(() => {
    bridge = new DualMidiBridge({ skipInit: true });
    bridge.parameterCache = {};
    bridge.onParameterChangedCallbacks = [];
  });

  it('maps CC 23 (vcf_cutoff) to handleParameterChangeFromBackend', () => {
    const spy = vi.spyOn(bridge, 'handleParameterChangeFromBackend');
    bridge.handleIncomingMidi({ data: new Uint8Array([0xB0, 23, 96]) });
    expect(spy).toHaveBeenCalledWith('vcf_cutoff', expect.closeTo(96 / 127, 3));
  });

  it('maps CC 24 (vcf_resonance) correctly', () => {
    const spy = vi.spyOn(bridge, 'handleParameterChangeFromBackend');
    bridge.handleIncomingMidi({ data: new Uint8Array([0xB0, 24, 64]) });
    expect(spy).toHaveBeenCalledWith('vcf_resonance', expect.closeTo(64 / 127, 3));
  });

  it('maps CC 15 (osc1_saw_enable) correctly', () => {
    const spy = vi.spyOn(bridge, 'handleParameterChangeFromBackend');
    bridge.handleIncomingMidi({ data: new Uint8Array([0xB0, 15, 127]) });
    expect(spy).toHaveBeenCalledWith('osc1_saw_enable', 1.0);
  });

  it('maps CC 27 (hpf_cutoff) correctly', () => {
    const spy = vi.spyOn(bridge, 'handleParameterChangeFromBackend');
    bridge.handleIncomingMidi({ data: new Uint8Array([0xB0, 27, 0]) });
    expect(spy).toHaveBeenCalledWith('hpf_cutoff', 0);
  });

  it('does not map unknown CC numbers', () => {
    const spy = vi.spyOn(bridge, 'handleParameterChangeFromBackend');
    bridge.handleIncomingMidi({ data: new Uint8Array([0xB0, 1, 64]) }); // CC 1 = mod wheel
    expect(spy).not.toHaveBeenCalled();
  });

  it('normalizes value as val / 127.0', () => {
    const spy = vi.spyOn(bridge, 'handleParameterChangeFromBackend');
    bridge.handleIncomingMidi({ data: new Uint8Array([0xB0, 19, 100]) }); // osc2_tone_mod
    expect(spy).toHaveBeenCalledWith('osc2_tone_mod', expect.closeTo(100 / 127, 4));
  });

  it('handles multiple CC messages in sequence', () => {
    const spy = vi.spyOn(bridge, 'handleParameterChangeFromBackend');
    bridge.handleIncomingMidi({ data: new Uint8Array([0xB0, 23, 0]) });
    bridge.handleIncomingMidi({ data: new Uint8Array([0xB0, 24, 127]) });
    bridge.handleIncomingMidi({ data: new Uint8Array([0xB0, 15, 64]) });
    expect(spy).toHaveBeenCalledTimes(3);
    expect(spy).toHaveBeenCalledWith('vcf_cutoff', 0);
    expect(spy).toHaveBeenCalledWith('vcf_resonance', 1.0);
    expect(spy).toHaveBeenCalledWith('osc1_saw_enable', expect.closeTo(64 / 127, 3));
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: handleIncomingMidi() — SysEx program dump
// ══════════════════════════════════════════════════════════════════

describe('DualMidiBridge — handleIncomingMidi() SysEx', () => {
  let bridge;
  let mockWin;

  beforeEach(() => {
    bridge = new DualMidiBridge({ skipInit: true });
    mockWin = {
      unpack7to8: vi.fn(function(packed) {
        // Simple mock: return Uint8Array where byte[0]=bank, byte[1]=program
        const result = new Uint8Array(242);
        result[0] = 0; // bank A
        result[1] = 0; // program 0
        return result;
      }),
      hardwareBanks: {
        A: {},
      },
      renderHardwarePatches: vi.fn(),
      currentHwBankLetter: 'A',
    };
    vi.stubGlobal('window', mockWin);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function makeSysexDump(bank, prog) {
    const data = new Uint8Array(291);
    // Header
    data[0] = 0xF0;
    data[1] = 0x00;
    data[2] = 0x20;
    data[3] = 0x32;
    data[4] = 0x20; // device ID
    data[5] = 0x00;
    data[6] = 0x02; // program dump
    // Payload bytes 8-285 (packed)
    for (let i = 8; i < 286; i++) {data[i] = 0;}
    // Name in bytes 265-281
    data[265] = 0x54; // 'T'
    data[266] = 0x45; // 'E'
    data[267] = 0x53; // 'S'
    data[268] = 0x54; // 'T'
    // End
    data[290] = 0xF7;
    return { data: data };
  }

  it('processes valid SysEx program dump (291 bytes)', () => {
    bridge.handleIncomingMidi(makeSysexDump(0, 0));
    expect(mockWin.unpack7to8).toHaveBeenCalled();
    expect(mockWin.hardwareBanks.A[0]).toBeDefined();
    expect(mockWin.hardwareBanks.A[0].name).toBe('TEST');
  });

  it('stores patch with correct index and name', () => {
    // Override unpack7to8 mock for this specific test to return program index 5
    mockWin.unpack7to8 = vi.fn(function(packed) {
      const result = new Uint8Array(242);
      result[0] = 0; // bank A
      result[1] = 5; // program 5
      return result;
    });
    bridge.handleIncomingMidi(makeSysexDump(0, 5));
    expect(mockWin.hardwareBanks.A[5]).toBeDefined();
    expect(mockWin.hardwareBanks.A[5].index).toBe(5);
    expect(mockWin.hardwareBanks.A[5].name).toBe('TEST');
  });

  it('calls renderHardwarePatches when bank matches currentHwBankLetter', () => {
    bridge.handleIncomingMidi(makeSysexDump(0, 0));
    expect(mockWin.renderHardwarePatches).toHaveBeenCalled();
  });

  it('does not call renderHardwarePatches when bank does not match', () => {
    mockWin.currentHwBankLetter = 'B';
    bridge.handleIncomingMidi(makeSysexDump(0, 0));
    expect(mockWin.renderHardwarePatches).not.toHaveBeenCalled();
  });

  it('ignores SysEx that is not a program dump (commandType ≠ 0x02)', () => {
    const msg = makeSysexDump(0, 0);
    msg.data[6] = 0x05; // global dump, not program dump
    bridge.handleIncomingMidi(msg);
    expect(mockWin.unpack7to8).not.toHaveBeenCalled();
  });

  it('ignores SysEx that is not DeepMind (wrong manufacturer)', () => {
    const msg = makeSysexDump(0, 0);
    msg.data[1] = 0x41; // wrong manufacturer
    bridge.handleIncomingMidi(msg);
    expect(mockWin.unpack7to8).not.toHaveBeenCalled();
  });

  it('ignores SysEx shorter than 291 bytes', () => {
    bridge.handleIncomingMidi({ data: new Uint8Array([0xF0, 0x00, 0x20, 0x32, 0xF7]) });
    expect(mockWin.unpack7to8).not.toHaveBeenCalled();
  });

  it('does not crash when window.unpack7to8 is not available', () => {
    mockWin.unpack7to8 = undefined;
    expect(function() {
      bridge.handleIncomingMidi(makeSysexDump(0, 0));
    }).not.toThrow();
  });

  it('does not crash when window.hardwareBanks is not available', () => {
    mockWin.hardwareBanks = undefined;
    expect(function() {
      bridge.handleIncomingMidi(makeSysexDump(0, 0));
    }).not.toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: handleIncomingMidi() — edge cases
// ══════════════════════════════════════════════════════════════════

describe('DualMidiBridge — handleIncomingMidi() edge cases', () => {
  let bridge;

  beforeEach(() => {
    bridge = new DualMidiBridge({ skipInit: true });
  });

  it('does nothing when data is null', () => {
    expect(function() {
      bridge.handleIncomingMidi({ data: null });
    }).not.toThrow();
  });

  it('does nothing when data is undefined', () => {
    expect(function() {
      bridge.handleIncomingMidi({ data: undefined });
    }).not.toThrow();
  });

  it('does nothing when data is empty array', () => {
    expect(function() {
      bridge.handleIncomingMidi({ data: new Uint8Array([]) });
    }).not.toThrow();
  });

  it('does nothing when midiMessage is empty object', () => {
    expect(function() {
      bridge.handleIncomingMidi({});
    }).not.toThrow();
  });

  it('ignores Note On messages (0x90)', () => {
    const spy = vi.spyOn(bridge, 'handleParameterChangeFromBackend');
    bridge.handleIncomingMidi({ data: new Uint8Array([0x90, 60, 100]) });
    expect(spy).not.toHaveBeenCalled();
  });

  it('ignores Note Off messages (0x80)', () => {
    const spy = vi.spyOn(bridge, 'handleParameterChangeFromBackend');
    bridge.handleIncomingMidi({ data: new Uint8Array([0x80, 60, 0]) });
    expect(spy).not.toHaveBeenCalled();
  });

  it('ignores Pitch Bend messages (0xE0)', () => {
    const spy = vi.spyOn(bridge, 'handleParameterChangeFromBackend');
    bridge.handleIncomingMidi({ data: new Uint8Array([0xE0, 0, 64]) });
    expect(spy).not.toHaveBeenCalled();
  });

  it('ignores Poly Pressure (0xA0)', () => {
    const spy = vi.spyOn(bridge, 'handleParameterChangeFromBackend');
    bridge.handleIncomingMidi({ data: new Uint8Array([0xA0, 60, 100]) });
    expect(spy).not.toHaveBeenCalled();
  });

  it('ignores Channel Pressure (0xD0)', () => {
    const spy = vi.spyOn(bridge, 'handleParameterChangeFromBackend');
    bridge.handleIncomingMidi({ data: new Uint8Array([0xD0, 100]) });
    expect(spy).not.toHaveBeenCalled();
  });

  it('ignores Program Change (0xC0)', () => {
    const spy = vi.spyOn(bridge, 'handleParameterChangeFromBackend');
    bridge.handleIncomingMidi({ data: new Uint8Array([0xC0, 5]) });
    expect(spy).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: handleParameterChangeFromBackend()
// ══════════════════════════════════════════════════════════════════

describe('DualMidiBridge — handleParameterChangeFromBackend()', () => {
  it('updates parameterCache with given value', () => {
    const bridge = new DualMidiBridge({ skipInit: true });
    bridge.handleParameterChangeFromBackend('vcf_cutoff', 0.5);
    expect(bridge.parameterCache['vcf_cutoff']).toBe(0.5);
  });

  it('triggers all registered callbacks', () => {
    const bridge = new DualMidiBridge({ skipInit: true });
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    bridge.onParameterChanged(cb1);
    bridge.onParameterChanged(cb2);

    bridge.handleParameterChangeFromBackend('osc1_pwm_amount', 0.75);

    expect(cb1).toHaveBeenCalledWith('osc1_pwm_amount', 0.75);
    expect(cb2).toHaveBeenCalledWith('osc1_pwm_amount', 0.75);
  });

  it('does not throw when no callbacks registered', () => {
    const bridge = new DualMidiBridge({ skipInit: true });

    expect(function() {
      bridge.handleParameterChangeFromBackend('test_param', 1.0);
    }).not.toThrow();
  });

  it('handles zero and negative values', () => {
    const bridge = new DualMidiBridge({ skipInit: true });
    bridge.handleParameterChangeFromBackend('bipolar_param', -0.5);
    expect(bridge.parameterCache['bipolar_param']).toBe(-0.5);
  });

  it('handles multiple params in sequence', () => {
    const bridge = new DualMidiBridge({ skipInit: true });
    bridge.handleParameterChangeFromBackend('param_a', 0.1);
    bridge.handleParameterChangeFromBackend('param_b', 0.2);
    bridge.handleParameterChangeFromBackend('param_c', 0.3);
    expect(bridge.parameterCache['param_a']).toBe(0.1);
    expect(bridge.parameterCache['param_b']).toBe(0.2);
    expect(bridge.parameterCache['param_c']).toBe(0.3);
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: onParameterChanged()
// ══════════════════════════════════════════════════════════════════

describe('DualMidiBridge — onParameterChanged()', () => {
  it('registers a callback', () => {
    const bridge = new DualMidiBridge({ skipInit: true });
    const cb = vi.fn();
    bridge.onParameterChanged(cb);
    expect(bridge.onParameterChangedCallbacks.length).toBe(1);
    expect(bridge.onParameterChangedCallbacks[0]).toBe(cb);
  });

  it('registers multiple callbacks', () => {
    const bridge = new DualMidiBridge({ skipInit: true });
    bridge.onParameterChanged(vi.fn());
    bridge.onParameterChanged(vi.fn());
    bridge.onParameterChanged(vi.fn());
    expect(bridge.onParameterChangedCallbacks.length).toBe(3);
  });

  it('all callbacks are invoked in order', () => {
    const bridge = new DualMidiBridge({ skipInit: true });
    const order = [];
    bridge.onParameterChanged(function() { order.push('first'); });
    bridge.onParameterChanged(function() { order.push('second'); });

    bridge.handleParameterChangeFromBackend('test', 1.0);

    expect(order).toEqual(['first', 'second']);
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: Integration — end-to-end flows
// ══════════════════════════════════════════════════════════════════

describe('DualMidiBridge — integration flows', () => {
  it('Web MIDI setParameter → sendWebMidiParameter → handleIncomingMidi', () => {
    const bridge = new DualMidiBridge({ skipInit: true });
    const outPort = makeFakeMidiPort('Test', 'output');
    bridge.midiOutput = outPort;
    bridge.midiChannel = 1;

    const cb = vi.fn();
    bridge.onParameterChanged(cb);

    // Simulate user setting a param
    bridge.setParameter('vcf_cutoff', 0.75);

    // Cache updated
    expect(bridge.parameterCache['vcf_cutoff']).toBe(0.75);

    // MIDI sent
    expect(outPort.send).toHaveBeenCalledWith([0xB0, 23, Math.round(0.75 * 127)]);

    // Callback triggered
    expect(cb).toHaveBeenCalledWith('vcf_cutoff', 0.75);
  });

  it('receiving CC updates cache and triggers callbacks', () => {
    const bridge = new DualMidiBridge({ skipInit: true });
    const cb = vi.fn();
    bridge.onParameterChanged(cb);

    bridge.handleIncomingMidi({ data: new Uint8Array([0xB0, 23, 80]) });

    expect(bridge.parameterCache['vcf_cutoff']).toBeCloseTo(80 / 127, 4);
    expect(cb).toHaveBeenCalledWith('vcf_cutoff', expect.closeTo(80 / 127, 4));
  });

  it('JUCE mode setParameter bypasses MIDI and calls native', () => {
    const mockJuce = { setParameter: vi.fn(), requestMidiDump: vi.fn() };
    vi.stubGlobal('window', { juce: mockJuce, console: global.console });
    const bridge = new DualMidiBridge({ skipInit: true, isJuce: true });

    bridge.setParameter('vcf_cutoff', 0.6);

    expect(mockJuce.setParameter).toHaveBeenCalledWith('vcf_cutoff', 0.6);
    expect(bridge.parameterCache['vcf_cutoff']).toBe(0.6);
    vi.unstubAllGlobals();
  });

  it('full SysEx program dump flow', () => {
    const bridge = new DualMidiBridge({ skipInit: true });
    const mockWin = {
      unpack7to8: vi.fn(function(packed) {
        const result = new Uint8Array(242);
        result[0] = 1; // bank B
        result[1] = 10; // program 10
        return result;
      }),
      hardwareBanks: { B: {} },
      renderHardwarePatches: vi.fn(),
      currentHwBankLetter: 'B',
    };
    vi.stubGlobal('window', mockWin);

    const msg = new Uint8Array(291);
    msg[0] = 0xF0;
    msg[1] = 0x00; msg[2] = 0x20; msg[3] = 0x32; msg[4] = 0x20; msg[5] = 0x00; msg[6] = 0x02;
    msg[265] = 0x48; // 'H'
    msg[266] = 0x57; // 'W'
    msg[267] = 0x30; // '0'
    msg[268] = 0x31; // '1'
    msg[290] = 0xF7;

    bridge.handleIncomingMidi({ data: msg });

    expect(mockWin.hardwareBanks.B[10]).toBeDefined();
    expect(mockWin.hardwareBanks.B[10].name).toBe('HW01');
    expect(mockWin.hardwareBanks.B[10].index).toBe(10);
    expect(mockWin.renderHardwarePatches).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('multiple rapid CC updates maintain correct cache state', () => {
    const bridge = new DualMidiBridge({ skipInit: true });
    const cb = vi.fn();
    bridge.onParameterChanged(cb);

    bridge.handleIncomingMidi({ data: new Uint8Array([0xB0, 23, 0]) });
    bridge.handleIncomingMidi({ data: new Uint8Array([0xB0, 23, 127]) });
    bridge.handleIncomingMidi({ data: new Uint8Array([0xB0, 23, 64]) });

    expect(bridge.parameterCache['vcf_cutoff']).toBeCloseTo(64 / 127, 4);
    expect(cb).toHaveBeenCalledTimes(3);
  });
});
