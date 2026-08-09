/**
 * Vitest tests for the operating-mode gate (controller vs simulator).
 *
 * Fuente:  WebUI/js/bridge-engines.js, bridge-engines-arp.js, bridge-engines-seq.js,
 *          keyboard_chord_memory.js, keyboard_poly_chord.js
 * Run:     npx vitest run WebUI/tests/operatingMode.test.js
 *
 * Regla de negocio:
 *   - deepmind_hw_controller  → SOLO se reenvían parámetros al hardware. El arp/seq/chord
 *                               los ejecuta la propia máquina: los motores locales NO deben
 *                               computar (si no, las secuencias se repetirían).
 *   - deepmind_web_standalone / abyssmind_pro → el software sonariza: los motores locales
 *                               SÍ deben ejecutarse.
 *
 * Los tests cargan los módulos REALES (no copias extraídas) para verificar los gates.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const JS_DIR = path.resolve(__dirname, '../js');

function readSource(name) {
  return fs.readFileSync(path.join(JS_DIR, name), 'utf8');
}

// ===== Stubs globales =====
globalThis.window = globalThis;

// Stub para setInterval/clearInterval durante el eval de bridge-engines.js,
// que arranca un polling (checkBridge) que de otro modo mantendría vivo el proceso.
const realSetInterval = globalThis.setInterval;
const realClearInterval = globalThis.clearInterval;
let _mode = 'abyssmind_pro';
globalThis.wasmBridge = {
  getMode: function() { return _mode; },
};

function DualMidiBridge() {}
globalThis.DualMidiBridge = DualMidiBridge;

function evalModule(name) {
  // eslint-disable-next-line no-eval
  (0, eval)(readSource(name));
}

beforeAll(function() {
  globalThis.setInterval = function() { return 0; };
  globalThis.clearInterval = function() {};
  try {
    evalModule('bridge-engines.js');
    evalModule('bridge-engines-arp.js');
    evalModule('bridge-engines-seq.js');
    evalModule('keyboard_chord_memory.js');
    evalModule('keyboard_poly_chord.js');
  } finally {
    globalThis.setInterval = realSetInterval;
    globalThis.clearInterval = realClearInterval;
  }
});

afterAll(function() {
  delete globalThis.wasmBridge;
});

beforeEach(function() {
  _mode = 'abyssmind_pro';
  vi.useFakeTimers();
});

afterEach(function() {
  vi.useRealTimers();
});

function makeBridge(custom) {
  const bridge = new DualMidiBridge();
  bridge.parameterCache = Object.assign({
    arp_enable: 1.0,
    arp_mode: 0.0,
    arp_octave: 0.0,
    arp_rate: 0.5,
    arp_clock_divider: 0.0,
    arp_gate_time: 0.99,
    arp_hold: 0.0,
    arp_key_sync: 0.0,
    seq_enable: 1.0,
    seq_clock: 3 / 15,
    seq_length: 0.0,
    seq_swing: 0.0,
    seq_slew_rate: 0.0,
    seq_key_loop: 0.0,
    seq_step_1: 0.5,
    seq_step_2: 0.5,
    chord_enable: 1.0,
    chord_key: 0.0,
    chord_type: 0.0,
    chord_notes: [60, 64, 67],
    poly_chord_enable: 1.0,
  }, custom || {});
  bridge.pianoNoteOn = vi.fn();
  bridge.pianoNoteOff = vi.fn();
  bridge.handleParameterChangeFromBackend = vi.fn();
  bridge._signalMidiActivity = vi.fn();
  bridge.midiChannel = 1;
  bridge.midiOutput = { send: vi.fn() };
  // seq_current_value debe mapear a un CC para el test de envío
  globalThis.BRIDGE_PARAM_MAPS = { PARAM_TO_CC: { seq_current_value: 0x4A } };
  globalThis._arpCalcStep = function(mode, stepIndex, heldLength, arpOctave) {
    return { noteIdx: stepIndex % heldLength, octaveOffset: 0 };
  };
  return bridge;
}

function setModeController() { _mode = 'deepmind_hw_controller'; }

describe('_isSimulatorMode (bridge-engines.js)', function() {
  it('devuelve false en deepmind_hw_controller', function() {
    const bridge = makeBridge();
    setModeController();
    expect(bridge._isSimulatorMode()).toBe(false);
  });

  it('devuelve true en deepmind_web_standalone y abyssmind_pro', function() {
    const bridge = makeBridge();
    _mode = 'deepmind_web_standalone';
    expect(bridge._isSimulatorMode()).toBe(true);
    _mode = 'abyssmind_pro';
    expect(bridge._isSimulatorMode()).toBe(true);
  });

  it('fallback: devuelve true si wasmBridge no está disponible', function() {
    const bridge = makeBridge();
    const saved = globalThis.wasmBridge;
    delete globalThis.wasmBridge;
    expect(bridge._isSimulatorMode()).toBe(true);
    globalThis.wasmBridge = saved;
  });
});

describe('ARP — modo controlador no arpegia', function() {
  it('addHeldNote no registra notas', function() {
    const bridge = makeBridge();
    setModeController();
    bridge.initArpEngine();
    bridge._arpEngine.addHeldNote(60, 100);
    expect(bridge._arpEngine.heldNotes).toHaveLength(0);
  });

  it('start() no arranca ni crea timer', function() {
    const bridge = makeBridge();
    setModeController();
    bridge.initArpEngine();
    bridge._arpEngine.heldNotes = [{ note: 60, velocity: 100 }];
    bridge._arpEngine.start();
    expect(bridge._arpEngine.running).toBe(false);
    expect(bridge._arpEngine.timerId).toBeNull();
  });

  it('_arpStep no envía notas y detiene el motor', function() {
    const bridge = makeBridge();
    setModeController();
    bridge.initArpEngine();
    const eng = bridge._arpEngine;
    eng.heldNotes = [{ note: 60, velocity: 100 }];
    eng.running = true;
    bridge._arpStep(bridge);
    expect(bridge.pianoNoteOn).not.toHaveBeenCalled();
    expect(eng.running).toBe(false);
  });

  it('setHeldNotes no computa secuencia', function() {
    const bridge = makeBridge();
    setModeController();
    bridge.initArpEngine();
    bridge._arpEngine.setHeldNotes([{ note: 60, velocity: 100 }]);
    expect(bridge._arpEngine.heldNotes).toHaveLength(0);
    expect(bridge._arpEngine.running).toBe(false);
  });
});

describe('ARP — modo simulador sí arpegia', function() {
  it('addHeldNote registra y arranca cuando arp_enable > 0.5', function() {
    const bridge = makeBridge();
    bridge.initArpEngine();
    bridge._arpEngine.addHeldNote(60, 100);
    expect(bridge._arpEngine.heldNotes).toHaveLength(1);
    expect(bridge._arpEngine.running).toBe(true);
    expect(bridge._arpEngine.timerId).not.toBeNull();
  });

  it('_arpStep envía la nota del paso actual', function() {
    const bridge = makeBridge();
    bridge.initArpEngine();
    const eng = bridge._arpEngine;
    eng.heldNotes = [{ note: 60, velocity: 100 }];
    eng.running = true;
    eng.intervalMs = 500;
    bridge._arpStep(bridge);
    expect(bridge.pianoNoteOn).toHaveBeenCalledWith(60, 100);
    expect(eng.stepIndex).toBe(1);
  });
});

describe('SEQ — modo controlador no secuencia', function() {
  it('_updateSeqEngine no arranca el motor', function() {
    const bridge = makeBridge();
    setModeController();
    bridge.initSeqEngine();
    bridge._updateSeqEngine();
    expect(bridge._seqEngine.running).toBe(false);
  });

  it('_seqStep no envía CC y detiene el motor', function() {
    const bridge = makeBridge();
    setModeController();
    bridge.initSeqEngine();
    const eng = bridge._seqEngine;
    eng.running = true;
    eng._seqStep(bridge);
    expect(bridge.midiOutput.send).not.toHaveBeenCalled();
    expect(eng.running).toBe(false);
  });
});

describe('SEQ — modo simulador sí secuencia', function() {
  it('_updateSeqEngine arranca con seq_enable activo', function() {
    const bridge = makeBridge();
    bridge.initSeqEngine();
    bridge._updateSeqEngine();
    expect(bridge._seqEngine.running).toBe(true);
  });

  it('_seqStep envía el CC del paso actual', function() {
    const bridge = makeBridge();
    bridge.initSeqEngine();
    const eng = bridge._seqEngine;
    eng.running = true;
    eng.intervalMs = 500;
    eng._seqStep(bridge);
    expect(bridge.handleParameterChangeFromBackend).toHaveBeenCalledWith('seq_current_value', 0.5);
    expect(bridge.midiOutput.send).toHaveBeenCalledWith([0xB0, 0x4A, 64]);
  });
});

describe('CHORD MEMORY — modo controlador no toca el chord', function() {
  it('_playChordMemory devuelve false y no envía notas', function() {
    const bridge = makeBridge();
    setModeController();
    window.dualMidiBridge = bridge;
    expect(window._playChordMemory(62, 100)).toBe(false);
    expect(bridge.pianoNoteOn).not.toHaveBeenCalled();
  });

  it('_stopChordMemory no envía notas', function() {
    const bridge = makeBridge();
    setModeController();
    bridge._chordActiveNotes = [62, 66, 69];
    window.dualMidiBridge = bridge;
    window._stopChordMemory(62);
    expect(bridge.pianoNoteOff).not.toHaveBeenCalled();
  });
});

describe('CHORD MEMORY — modo simulador sí toca el chord', function() {
  it('_playChordMemory genera las notas del intervalo', function() {
    const bridge = makeBridge();
    window.dualMidiBridge = bridge;
    const ok = window._playChordMemory(62, 100);
    expect(ok).toBe(true);
    expect(bridge.pianoNoteOn).toHaveBeenCalledTimes(3);
    expect(bridge.pianoNoteOn).toHaveBeenCalledWith(62, 100);
    expect(bridge.pianoNoteOn).toHaveBeenCalledWith(66, 100);
    expect(bridge.pianoNoteOn).toHaveBeenCalledWith(69, 100);
  });
});

describe('POLY CHORD — modo controlador no toca el chord', function() {
  it('_playPolyChordMemory devuelve false y no envía notas', function() {
    const bridge = makeBridge();
    setModeController();
    window.dualMidiBridge = bridge;
    expect(window._playPolyChordMemory(60, 100)).toBe(false);
    expect(bridge.pianoNoteOn).not.toHaveBeenCalled();
  });
});

describe('POLY CHORD — modo simulador sí toca el chord', function() {
  it('_playPolyChordMemory genera el acorde según el mapa', function() {
    const bridge = makeBridge();
    bridge.parameterCache['poly_chord_map'] = window.POLY_CHORD_DEFAULTS.map(function(a) {
      return { rootKey: a.rootKey, chordType: (a.rootKey === 0 ? 1 : (a.rootKey === 1 ? 2 : a.chordType)) };
    });
    window.dualMidiBridge = bridge;
    const ok = window._playPolyChordMemory(60, 100);
    expect(ok).toBe(true);
    expect(bridge.pianoNoteOn).toHaveBeenCalledTimes(3);
    expect(bridge.pianoNoteOn).toHaveBeenCalledWith(60, 100);
    expect(bridge.pianoNoteOn).toHaveBeenCalledWith(64, 100);
    expect(bridge.pianoNoteOn).toHaveBeenCalledWith(67, 100);
  });
});
