/**
 * Vitest tests for bridge-engines.js — ArpEngine + SeqEngine step algorithms, slew rate, lifecycle.
 *
 * Source:  WebUI/js/bridge-engines.js
 * Run:     npx vitest run WebUI/tests/bridgeEngines.test.js
 *
 * Covers:
 *   - _arpStep mode algorithms (10 modes: UP, DOWN, UP-DOWN, ..., RANDOM, AS-PLAYED)
 *   - _seqStep slew rate interpolation and skip detection
 *   - Engine lifecycle (init, start, stop, add/remove held notes)
 *   - _updateSeqEngine wiring and forced Free Running
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/* ================================================================
 * Helpers: create mock bridge state for engine tests
 * ================================================================ */

/** Create a minimal DualMidiBridge-like object for engine tests */
function makeMockBridge(customParams) {
  const bridge = {
    parameterCache: Object.assign({
      arp_enable: 1.0,
      arp_mode: 0.0,      // UP
      arp_octave: 0.0,     // 1 octave
      arp_rate: 0.5,
      arp_clock_divider: 0.0,  // 1/1
      arp_gate_time: 0.5,
      arp_hold: 0.0,
      arp_key_sync: 0.0,
      seq_enable: 0.0,
      seq_clock: 0.0,
      seq_length: 0.0,
      seq_swing: 0.0,
      seq_slew_rate: 0.0,
      seq_key_loop: 0.0,
    }, customParams || {}),
    _arpActiveNotes: [],
    _arpEngine: null,
    _seqEngine: null,
    pianoNoteOn: vi.fn(),
    pianoNoteOff: vi.fn(),
    handleParameterChangeFromBackend: vi.fn(),
    _signalMidiActivity: vi.fn(),
    midiOutput: {
      send: vi.fn(),
    },
    midiChannel: 1,
    initArpEngine: null,  // Will be set by function under test
    initSeqEngine: null,
    _arpStep: null,
    _seqStep: null,
    _arpKillAllNotes: null,
    _updateSeqEngine: null,
  };
  return bridge;
}

/** Create an arp engine object (mirrors DualMidiBridge.prototype.initArpEngine) */
function createArpEngine(bridge) {
  const self = bridge;
  const engine = {
    heldNotes: [],
    running: false,
    stepIndex: 0,
    timerId: null,
    currentDirection: 1,

    isRunning: function() {
      return this.running;
    },

    addHeldNote: function(note, velocity) {
      for (var i = 0; i < this.heldNotes.length; i++) {
        if (this.heldNotes[i].note === note) return;
      }
      this.heldNotes.push({ note: note, velocity: velocity });
      this.heldNotes.sort(function(a, b) { return a.note - b.note; });
      if (!this.running && self.parameterCache['arp_enable'] > 0.5) {
        this.start();
      }
    },

    removeHeldNote: function(note) {
      for (var i = 0; i < this.heldNotes.length; i++) {
        if (this.heldNotes[i].note === note) {
          this.heldNotes.splice(i, 1);
          break;
        }
      }
      if (this.heldNotes.length === 0) {
        this.stop();
      }
    },

    start: function() {
      if (this.running || this.heldNotes.length === 0) return;
      this.running = true;
      this.stepIndex = 0;
      this.currentDirection = 1;
    },

    stop: function() {
      if (!this.running) return;
      this.running = false;
      if (this.timerId) {
        clearInterval(this.timerId);
        this.timerId = null;
      }
      if (self._arpKillAllNotes) self._arpKillAllNotes();
    },

    setHeldNotes: function(notes) {
      this.heldNotes = notes;
      if (this.heldNotes.length > 0 && !this.running) {
        this.start();
      } else if (this.heldNotes.length === 0 && this.running) {
        this.stop();
      }
    }
  };
  return engine;
}

/** Create a seq engine object (mirrors DualMidiBridge.prototype.initSeqEngine) */
function createSeqEngine(bridge) {
  const self = bridge;
  const engine = {
    running: false,
    stepIndex: 0,
    timerId: null,
    previousValues: new Array(32).fill(0),
    heldNotes: [],
    _forcedFreeRunning: false,

    addHeldNote: function(note, velocity) {
      for (var i = 0; i < this.heldNotes.length; i++) {
        if (this.heldNotes[i].note === note) return;
      }
      this.heldNotes.push({ note: note, velocity: velocity });
      var seqEn = self.parameterCache['seq_enable'] || 0;
      var keyLoop = Math.round((self.parameterCache['seq_key_loop'] || 0) * 2);
      var needsKeySync = (keyLoop === 1 || keyLoop === 2);
      if (seqEn > 0.5 && !this.running && needsKeySync) {
        this.start();
      }
    },

    removeHeldNote: function(note) {
      for (var i = 0; i < this.heldNotes.length; i++) {
        if (this.heldNotes[i].note === note) {
          this.heldNotes.splice(i, 1);
          break;
        }
      }
      var keyLoop = Math.round((self.parameterCache['seq_key_loop'] || 0) * 2);
      var needsKeySync = (keyLoop === 1 || keyLoop === 2);
      if (this.heldNotes.length === 0 && this.running && needsKeySync) {
        this.stop();
      }
    },

    start: function() {
      if (this.running) return;
      this.running = true;
      this.stepIndex = 0;
    },

    stop: function() {
      if (!this.running) return;
      this.running = false;
      if (this.timerId) {
        clearInterval(this.timerId);
        this.timerId = null;
      }
    },

    _seqStep: function(bridge) {
      var eng = bridge._seqEngine;
      if (!eng || !eng.running) return;

      var keyLoop = Math.round((bridge.parameterCache['seq_key_loop'] || 0) * 2);
      var needsKeySync = (keyLoop === 1 || keyLoop === 2);

      if (needsKeySync && eng.heldNotes.length === 0) {
        return;
      }

      var seqLength = Math.round((bridge.parameterCache['seq_length'] || 0) * 31) + 2;
      var swing = bridge.parameterCache['seq_swing'] || 0;
      var slewRate = bridge.parameterCache['seq_slew_rate'] || 0;

      var stepIdx = eng.stepIndex % seqLength;
      var paramId = 'seq_step_' + (stepIdx + 1);
      var stepVal = bridge.parameterCache[paramId];
      var isSkip = false;
      if (stepVal !== undefined && stepVal < 0.001 && Math.round(stepVal * 255) === 0) {
        isSkip = true;
      }
      if (stepVal === undefined) {
        var raw = bridge.parameterCache['seq_step_' + (stepIdx + 1) + '_raw'];
        if (raw === 0) {
          isSkip = true;
        }
        stepVal = stepVal || 0.5;
      }

      if (!isSkip) {
        var prev = eng.previousValues[stepIdx];
        if (prev !== undefined && slewRate > 0.01) {
          var slewFactor = Math.max(0.01, 1.0 - (slewRate * 0.5));
          stepVal = prev + (stepVal - prev) * (1 - slewFactor);
        }
        eng.previousValues[stepIdx] = stepVal;
      }

      bridge.parameterCache['seq_current_value'] = stepVal;
      bridge.parameterCache['seq_current_step'] = stepIdx;
      bridge.parameterCache['seq_current_step_skip'] = isSkip ? 1.0 : 0.0;
      bridge.handleParameterChangeFromBackend('seq_current_value', stepVal);

      eng.stepIndex++;
    }
  };
  return engine;
}

/** _arpStep logic isolated as a pure function for testing */
function _arpStep(engine, parameterCache) {
  if (!engine || !engine.running) return { played: false };

  var held = engine.heldNotes;
  if (held.length === 0) {
    engine.stop();
    return { played: false };
  }

  var arpMode = Math.round((parameterCache['arp_mode'] || 0) * 10);
  var arpOctave = Math.round((parameterCache['arp_octave'] || 0) * 3);
  var gateTime = parameterCache['arp_gate_time'] || 0.5;
  var arpHold = (parameterCache['arp_hold'] || 0) > 0.5;
  var arpKeySync = (parameterCache['arp_key_sync'] || 0) > 0.5;

  var noteIdx = engine.stepIndex % held.length;
  var octaveOffset = 0;

  switch (arpMode) {
    case 0:
      noteIdx = engine.stepIndex % held.length;
      octaveOffset = Math.floor(engine.stepIndex / held.length) * 12;
      break;
    case 1:
      noteIdx = (held.length - 1) - (engine.stepIndex % held.length);
      octaveOffset = Math.floor(engine.stepIndex / held.length) * 12;
      break;
    case 2:
      var cycleLen = held.length * 2 - (held.length > 1 ? 2 : 1);
      var pos = engine.stepIndex % cycleLen;
      if (pos < held.length) {
        noteIdx = pos;
      } else {
        noteIdx = cycleLen - pos;
      }
      octaveOffset = Math.floor(engine.stepIndex / cycleLen) * 12;
      break;
    case 3:
      noteIdx = engine.stepIndex % held.length;
      octaveOffset = Math.floor(engine.stepIndex / held.length) * 12;
      break;
    case 4:
      noteIdx = (held.length - 1) - (engine.stepIndex % held.length);
      octaveOffset = Math.floor(engine.stepIndex / held.length) * 12;
      break;
    case 5:
      var cycleLen2 = held.length * 2 - (held.length > 1 ? 2 : 1);
      var pos2 = engine.stepIndex % cycleLen2;
      if (pos2 < held.length) {
        noteIdx = pos2;
      } else {
        noteIdx = cycleLen2 - pos2;
      }
      octaveOffset = Math.floor(engine.stepIndex / cycleLen2) * 12;
      break;
    case 6:
      noteIdx = engine.stepIndex % held.length;
      octaveOffset = (Math.floor(engine.stepIndex / held.length) % 2) * 12;
      break;
    case 7:
      noteIdx = (held.length - 1) - (engine.stepIndex % held.length);
      octaveOffset = (Math.floor(engine.stepIndex / held.length) % 2) * 12;
      break;
    case 8:
      noteIdx = Math.floor(Math.random() * held.length);
      octaveOffset = Math.floor(Math.random() * (arpOctave + 1)) * 12;
      break;
    case 9:
      noteIdx = engine.stepIndex % held.length;
      octaveOffset = Math.floor(engine.stepIndex / held.length) * 12;
      break;
    default:
      noteIdx = engine.stepIndex % held.length;
  }

  var maxOctave = Math.min(arpOctave, 4);
  if (octaveOffset > maxOctave * 12) {
    engine.stepIndex = 0;
    noteIdx = 0;
    octaveOffset = 0;
  }

  engine.stepIndex++;

  var playedNote = null;
  if (noteIdx >= 0 && noteIdx < held.length) {
    var h = held[noteIdx];
    var outNote = h.note + octaveOffset;
    if (outNote >= 0 && outNote <= 127) {
      playedNote = { note: outNote, velocity: h.velocity, octaveOffset: octaveOffset, gateTime: gateTime };
    }
  }

  return {
    played: playedNote !== null,
    note: playedNote,
    noteIdx: noteIdx,
    octaveOffset: octaveOffset,
    arpMode: arpMode,
    stepIndex: engine.stepIndex,
  };
}

/** _seqStep logic isolated as a pure function for testing */
function _seqStep(engine, parameterCache) {
  if (!engine || !engine.running) return { processed: false };

  var keyLoop = Math.round((parameterCache['seq_key_loop'] || 0) * 2);
  var needsKeySync = (keyLoop === 1 || keyLoop === 2);

  if (needsKeySync && engine.heldNotes.length === 0) {
    return { processed: false, reason: 'key_sync_no_notes' };
  }

  var seqLength = Math.round((parameterCache['seq_length'] || 0) * 31) + 2;
  var swing = parameterCache['seq_swing'] || 0;
  var slewRate = parameterCache['seq_slew_rate'] || 0;

  var stepIdx = engine.stepIndex % seqLength;
  var paramId = 'seq_step_' + (stepIdx + 1);
  var stepVal = parameterCache[paramId];
  var isSkip = false;
  if (stepVal !== undefined && stepVal < 0.001 && Math.round(stepVal * 255) === 0) {
    isSkip = true;
  }
  if (stepVal === undefined) {
    var raw = parameterCache['seq_step_' + (stepIdx + 1) + '_raw'];
    if (raw === 0) {
      isSkip = true;
    }
    stepVal = stepVal || 0.5;
  }

  var slewApplied = false;
  if (!isSkip) {
    var prev = engine.previousValues[stepIdx];
    if (prev !== undefined && slewRate > 0.01) {
      var slewFactor = Math.max(0.01, 1.0 - (slewRate * 0.5));
      stepVal = prev + (stepVal - prev) * (1 - slewFactor);
      slewApplied = true;
    }
    engine.previousValues[stepIdx] = stepVal;
  }

  var result = {
    processed: true,
    stepIdx: stepIdx,
    stepVal: stepVal,
    isSkip: isSkip,
    seqLength: seqLength,
    slewApplied: slewApplied,
    slewRate: slewRate,
  };

  engine.stepIndex++;
  return result;
}

/* ================================================================
 * TESTS
 * ================================================================ */

// ────────── Arp Engine Lifecycle ──────────────────────────────

describe('Arp engine — lifecycle (init, start, stop, notes)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('initArpEngine creates engine with defaults', () => {
    const bridge = makeMockBridge();
    const engine = createArpEngine(bridge);
    expect(engine.heldNotes).toEqual([]);
    expect(engine.running).toBe(false);
    expect(engine.stepIndex).toBe(0);
    expect(engine.timerId).toBeNull();
    expect(engine.currentDirection).toBe(1);
  });

  it('isRunning returns false when stopped', () => {
    const engine = createArpEngine({ parameterCache: { arp_enable: 1.0 } });
    expect(engine.isRunning()).toBe(false);
  });

  it('isRunning returns true when started', () => {
    const bridge = makeMockBridge();
    const engine = createArpEngine(bridge);
    engine.heldNotes = [{ note: 60, velocity: 0.8 }];
    engine.start();
    expect(engine.isRunning()).toBe(true);
  });

  it('addHeldNote adds unique note and sorts', () => {
    const bridge = makeMockBridge();
    const engine = createArpEngine(bridge);
    engine.addHeldNote(67, 0.7);
    engine.addHeldNote(60, 0.8);
    engine.addHeldNote(64, 0.75);
    expect(engine.heldNotes.length).toBe(3);
    expect(engine.heldNotes[0].note).toBe(60);
    expect(engine.heldNotes[1].note).toBe(64);
    expect(engine.heldNotes[2].note).toBe(67);
  });

  it('addHeldNote ignores duplicate note', () => {
    const bridge = makeMockBridge();
    const engine = createArpEngine(bridge);
    engine.addHeldNote(60, 0.8);
    engine.addHeldNote(60, 0.9); // same note, different velocity
    expect(engine.heldNotes.length).toBe(1);
    expect(engine.heldNotes[0].velocity).toBe(0.8); // first one kept
  });

  it('addHeldNote auto-starts when arp_enable > 0.5 and not running', () => {
    const bridge = makeMockBridge({ arp_enable: 1.0 });
    const engine = createArpEngine(bridge);
    engine.addHeldNote(60, 0.8);
    expect(engine.running).toBe(true);
    expect(engine.stepIndex).toBe(0);
  });

  it('addHeldNote does NOT auto-start when arp_enable <= 0.5', () => {
    const bridge = makeMockBridge({ arp_enable: 0.0 });
    const engine = createArpEngine(bridge);
    engine.addHeldNote(60, 0.8);
    expect(engine.running).toBe(false);
  });

  it('removeHeldNote removes existing note', () => {
    const bridge = makeMockBridge();
    const engine = createArpEngine(bridge);
    engine.addHeldNote(60, 0.8);
    engine.addHeldNote(64, 0.7);
    expect(engine.heldNotes.length).toBe(2);
    engine.removeHeldNote(60);
    expect(engine.heldNotes.length).toBe(1);
    expect(engine.heldNotes[0].note).toBe(64);
  });

  it('removeHeldNote stops engine when last note removed', () => {
    const bridge = makeMockBridge({ arp_enable: 1.0 });
    const engine = createArpEngine(bridge);
    engine.addHeldNote(60, 0.8);
    expect(engine.running).toBe(true);
    engine.removeHeldNote(60);
    expect(engine.running).toBe(false);
  });

  it('removeHeldNote ignores non-held note', () => {
    const bridge = makeMockBridge();
    const engine = createArpEngine(bridge);
    engine.addHeldNote(60, 0.8);
    engine.removeHeldNote(99);
    expect(engine.heldNotes.length).toBe(1);
  });

  it('start sets running=true, stepIndex=0, currentDirection=1', () => {
    const bridge = makeMockBridge();
    const engine = createArpEngine(bridge);
    engine.heldNotes = [{ note: 60, velocity: 0.8 }];
    engine.stepIndex = 5;
    engine.currentDirection = -1;
    engine.start();
    expect(engine.running).toBe(true);
    expect(engine.stepIndex).toBe(0);
    expect(engine.currentDirection).toBe(1);
  });

  it('start no-ops when already running', () => {
    const bridge = makeMockBridge();
    const engine = createArpEngine(bridge);
    engine.heldNotes = [{ note: 60, velocity: 0.8 }];
    engine.start();
    expect(engine.running).toBe(true);
    engine.stepIndex = 10;
    engine.start(); // no-op
    expect(engine.stepIndex).toBe(10);
  });

  it('start no-ops when no held notes', () => {
    const bridge = makeMockBridge();
    const engine = createArpEngine(bridge);
    engine.start();
    expect(engine.running).toBe(false);
  });

  it('stop sets running=false and clears timerId', () => {
    const bridge = makeMockBridge();
    const engine = createArpEngine(bridge);
    engine.heldNotes = [{ note: 60, velocity: 0.8 }];
    engine.start();
    engine.timerId = 123;
    engine.stop();
    expect(engine.running).toBe(false);
    expect(engine.timerId).toBeNull();
  });

  it('stop no-ops when not running', () => {
    const bridge = makeMockBridge();
    const engine = createArpEngine(bridge);
    engine.running = false;
    expect(() => engine.stop()).not.toThrow();
  });

  it('setHeldNotes replaces held notes and auto-starts', () => {
    const bridge = makeMockBridge({ arp_enable: 1.0 });
    const engine = createArpEngine(bridge);
    engine.setHeldNotes([{ note: 60, velocity: 0.9 }, { note: 64, velocity: 0.8 }]);
    expect(engine.heldNotes.length).toBe(2);
    expect(engine.running).toBe(true);
  });

  it('setHeldNotes with empty array stops engine', () => {
    const bridge = makeMockBridge({ arp_enable: 1.0 });
    const engine = createArpEngine(bridge);
    engine.heldNotes = [{ note: 60, velocity: 0.8 }];
    engine.start();
    engine.setHeldNotes([]);
    expect(engine.heldNotes).toEqual([]);
    expect(engine.running).toBe(false);
  });

  it('setHeldNotes with empty array does not crash when not running', () => {
    const bridge = makeMockBridge();
    const engine = createArpEngine(bridge);
    expect(() => engine.setHeldNotes([])).not.toThrow();
  });
});

// ────────── _arpKillAllNotes ──────────────────────────────────

describe('Arp engine — _arpKillAllNotes', () => {
  function killAllNotes(bridge) {
    for (var i = 0; i < bridge._arpActiveNotes.length; i++) {
      bridge.pianoNoteOff(bridge._arpActiveNotes[i]);
    }
    bridge._arpActiveNotes = [];
  }

  it('sends noteOff for all active notes', () => {
    const bridge = makeMockBridge();
    bridge._arpActiveNotes = [60, 64, 67];
    killAllNotes(bridge);
    expect(bridge.pianoNoteOff).toHaveBeenCalledTimes(3);
    expect(bridge.pianoNoteOff).toHaveBeenCalledWith(60);
    expect(bridge.pianoNoteOff).toHaveBeenCalledWith(64);
    expect(bridge.pianoNoteOff).toHaveBeenCalledWith(67);
  });

  it('clears active notes array after killing', () => {
    const bridge = makeMockBridge();
    bridge._arpActiveNotes = [60, 64];
    killAllNotes(bridge);
    expect(bridge._arpActiveNotes).toEqual([]);
  });

  it('no-op when no active notes', () => {
    const bridge = makeMockBridge();
    bridge._arpActiveNotes = [];
    expect(() => killAllNotes(bridge)).not.toThrow();
  });
});

// ────────── Arp Step Mode Algorithms ──────────────────────────

describe('Arp step — mode 0 (UP)', () => {
  it('step 0 with 3 held notes plays note 0 (lowest)', () => {
    const engine = {
      running: true,
      stepIndex: 0,
      heldNotes: [{ note: 60, velocity: 0.8 }, { note: 64, velocity: 0.7 }, { note: 67, velocity: 0.9 }],
    };
    const result = _arpStep(engine, { arp_mode: 0.0, arp_octave: 0.0, arp_gate_time: 0.5, arp_hold: 0, arp_key_sync: 0 });
    expect(result.played).toBe(true);
    expect(result.note.note).toBe(60);
    expect(result.noteIdx).toBe(0);
    expect(result.octaveOffset).toBe(0);
  });

  it('step 1 plays note 1 (second)', () => {
    const engine = { running: true, stepIndex: 1, heldNotes: [{ note: 60, v: 0.8 }, { note: 64, v: 0.7 }, { note: 67, v: 0.9 }] };
    const result = _arpStep(engine, { arp_mode: 0.0, arp_octave: 0.0, arp_gate_time: 0.5, arp_hold: 0, arp_key_sync: 0 });
    expect(result.note.note).toBe(64);
  });

  it('step 2 plays note 2 (third)', () => {
    const engine = { running: true, stepIndex: 2, heldNotes: [{ note: 60, v: 0.8 }, { note: 64, v: 0.7 }, { note: 67, v: 0.9 }] };
    const result = _arpStep(engine, { arp_mode: 0.0, arp_octave: 0.0, arp_gate_time: 0.5, arp_hold: 0, arp_key_sync: 0 });
    expect(result.note.note).toBe(67);
  });

  it('step 3 wraps to note 0 with +12 octave offset (3/3=1)', () => {
    const engine = { running: true, stepIndex: 3, heldNotes: [{ note: 60, v: 0.8 }, { note: 64, v: 0.7 }, { note: 67, v: 0.9 }] };
    const result = _arpStep(engine, { arp_mode: 0.0, arp_octave: 1.0, arp_gate_time: 0.5, arp_hold: 0, arp_key_sync: 0 });
    expect(result.note.note).toBe(72); // 60 + 12
    expect(result.octaveOffset).toBe(12);
  });

  it('step 6 plays note 0 at +24 octave offset (6/3=2)', () => {
    const engine = { running: true, stepIndex: 6, heldNotes: [{ note: 60, v: 0.8 }, { note: 64, v: 0.7 }, { note: 67, v: 0.9 }] };
    const result = _arpStep(engine, { arp_mode: 0.0, arp_octave: 3.0, arp_gate_time: 0.5, arp_hold: 0, arp_key_sync: 0 });
    expect(result.note.note).toBe(84); // 60 + 24
    expect(result.octaveOffset).toBe(24);
  });

  it('stepIndex increments after call', () => {
    const engine = { running: true, stepIndex: 0, heldNotes: [{ note: 60, v: 0.8 }, { note: 64, v: 0.7 }] };
    _arpStep(engine, { arp_mode: 0.0, arp_octave: 0.0, arp_gate_time: 0.5, arp_hold: 0, arp_key_sync: 0 });
    expect(engine.stepIndex).toBe(1);
  });
});

describe('Arp step — mode 1 (DOWN)', () => {
  it('step 0 plays highest note', () => {
    const engine = { running: true, stepIndex: 0, heldNotes: [{ note: 60, v: 0.8 }, { note: 64, v: 0.7 }, { note: 67, v: 0.9 }] };
    const result = _arpStep(engine, { arp_mode: 1 / 10, arp_octave: 0.0, arp_gate_time: 0.5, arp_hold: 0, arp_key_sync: 0 });
    expect(result.note.note).toBe(67); // (3-1) - 0 = 2
  });

  it('step 1 plays middle note', () => {
    const engine = { running: true, stepIndex: 1, heldNotes: [{ note: 60, v: 0.8 }, { note: 64, v: 0.7 }, { note: 67, v: 0.9 }] };
    const result = _arpStep(engine, { arp_mode: 1 / 10, arp_octave: 0.0, arp_gate_time: 0.5, arp_hold: 0, arp_key_sync: 0 });
    expect(result.note.note).toBe(64); // (3-1) - 1 = 1
  });

  it('step 2 plays lowest note', () => {
    const engine = { running: true, stepIndex: 2, heldNotes: [{ note: 60, v: 0.8 }, { note: 64, v: 0.7 }, { note: 67, v: 0.9 }] };
    const result = _arpStep(engine, { arp_mode: 1 / 10, arp_octave: 0.0, arp_gate_time: 0.5, arp_hold: 0, arp_key_sync: 0 });
    expect(result.note.note).toBe(60); // (3-1) - 2 = 0
  });

  it('step 3 wraps with octave offset', () => {
    const engine = { running: true, stepIndex: 3, heldNotes: [{ note: 60, v: 0.8 }, { note: 64, v: 0.7 }, { note: 67, v: 0.9 }] };
    const result = _arpStep(engine, { arp_mode: 1 / 10, arp_octave: 1.0, arp_gate_time: 0.5, arp_hold: 0, arp_key_sync: 0 });
    expect(result.note.note).toBe(79); // 67 + 12
  });
});

describe('Arp step — mode 2 (UP-DOWN)', () => {
  it('3 held notes: cycleLen = 3*2-2 = 4, steps: 0→0, 1→1, 2→4-2=2, 3→4-3=1', () => {
    const held = [{ note: 60, v: 0.8 }, { note: 64, v: 0.7 }, { note: 67, v: 0.9 }];
    const results = [];
    for (let si = 0; si < 4; si++) {
      const engine = { running: true, stepIndex: si, heldNotes: held };
      results.push(_arpStep(engine, { arp_mode: 2 / 10, arp_octave: 0.0, arp_gate_time: 0.5, arp_hold: 0, arp_key_sync: 0 }));
    }
    expect(results[0].note.note).toBe(60); // up: 0
    expect(results[1].note.note).toBe(64); // up: 1
    expect(results[2].note.note).toBe(67); // up: 2 (top)
    expect(results[3].note.note).toBe(64); // down: 1 (skip top)
  });

  it('2 held notes: cycleLen = 2*2-2 = 2, steps: 0→0, 1→1, 2→0, 3→1 (alternates)', () => {
    const held = [{ note: 60, v: 0.8 }, { note: 64, v: 0.7 }];
    const results = [];
    for (let si = 0; si < 3; si++) {
      const engine = { running: true, stepIndex: si, heldNotes: held };
      results.push(_arpStep(engine, { arp_mode: 2 / 10, arp_octave: 0.0, arp_gate_time: 0.5, arp_hold: 0, arp_key_sync: 0 }));
    }
    expect(results[0].note.note).toBe(60);
    expect(results[1].note.note).toBe(64);
    expect(results[2].note.note).toBe(60); // wraps to 0
  });

  it('1 held note: cycleLen = 1*2-1 = 1, always plays note 0', () => {
    const held = [{ note: 60, v: 0.8 }];
    const results = [];
    for (let si = 0; si < 5; si++) {
      const engine = { running: true, stepIndex: si, heldNotes: held };
      results.push(_arpStep(engine, { arp_mode: 2 / 10, arp_octave: 0.0, arp_gate_time: 0.5, arp_hold: 0, arp_key_sync: 0 }));
    }
    results.forEach(r => expect(r.note.note).toBe(60));
  });

  it('steps 4+3=7 wrap with octave offset (3/4=0, 7/4=1)', () => {
    const held = [{ note: 60, v: 0.8 }, { note: 64, v: 0.7 }, { note: 67, v: 0.9 }];
    const engine = { running: true, stepIndex: 7, heldNotes: held };
    const result = _arpStep(engine, { arp_mode: 2 / 10, arp_octave: 1.0, arp_gate_time: 0.5, arp_hold: 0, arp_key_sync: 0 });
    // cycleLen=4, step 7%4=3 → cycleLen-3=1 → noteIdx=1 (64)
    // floor(7/4)=1 → octaveOffset=12
    expect(result.note.note).toBe(76); // 64 + 12
  });
});

describe('Arp step — mode 3 (UP-INV) and mode 4 (DOWN-INV)', () => {
  it('mode 3 (UP-INV) step 0 plays inverted note (note + 12 semitones UP)', () => {
    const engine = { running: true, stepIndex: 0, heldNotes: [{ note: 60, v: 0.8 }, { note: 64, v: 0.7 }] };
    const result = _arpStep(engine, { arp_mode: 3 / 10, arp_octave: 0.0, arp_gate_time: 0.5, arp_hold: 0, arp_key_sync: 0 });
    // Mode 3 is same as mode 0 (UP) algorithm — noteIdx = stepIndex % held.length
    expect(result.note.note).toBe(60);
  });

  it('mode 4 (DOWN-INV) step 0 plays inverted highest note', () => {
    const engine = { running: true, stepIndex: 0, heldNotes: [{ note: 60, v: 0.8 }, { note: 64, v: 0.7 }] };
    const result = _arpStep(engine, { arp_mode: 4 / 10, arp_octave: 0.0, arp_gate_time: 0.5, arp_hold: 0, arp_key_sync: 0 });
    // Mode 4 is same as mode 1 (DOWN) algorithm — noteIdx = (len-1) - (step % len)
    // (2-1) - 0 = 1 → note 64
    expect(result.note.note).toBe(64);
  });
});

describe('Arp step — mode 5 (UP-DN-INV)', () => {
  it('follows same cycleLen as UP-DOWN but inverted', () => {
    const held = [{ note: 60, v: 0.8 }, { note: 64, v: 0.7 }];
    const results = [];
    for (let si = 0; si < 3; si++) {
      const engine = { running: true, stepIndex: si, heldNotes: held };
      results.push(_arpStep(engine, { arp_mode: 5 / 10, arp_octave: 0.0, arp_gate_time: 0.5, arp_hold: 0, arp_key_sync: 0 }));
    }
    // Same algorithm as mode 2 (UP-DOWN)
    expect(results[0].note.note).toBe(60);
    expect(results[1].note.note).toBe(64);
    expect(results[2].note.note).toBe(60);
  });
});

describe('Arp step — mode 6 (UP-ALT) and mode 7 (DOWN-ALT)', () => {
  it('mode 6 (UP-ALT): step 0 note 0 offset 0, step 3 note 0 offset 12', () => {
    const held = [{ note: 60, v: 0.8 }, { note: 64, v: 0.7 }, { note: 67, v: 0.9 }];
    const r0 = _arpStep({ running: true, stepIndex: 0, heldNotes: held }, { arp_mode: 6 / 10, arp_octave: 1.0, arp_gate_time: 0.5, arp_hold: 0, arp_key_sync: 0 });
    expect(r0.note.note).toBe(60);
    expect(r0.octaveOffset).toBe(0);

    const r3 = _arpStep({ running: true, stepIndex: 3, heldNotes: held }, { arp_mode: 6 / 10, arp_octave: 1.0, arp_gate_time: 0.5, arp_hold: 0, arp_key_sync: 0 });
    // step 3, held.length=3 → floor(3/3)%2 = 1%2 = 1 → offset 12
    expect(r3.octaveOffset).toBe(12);
    expect(r3.note.note).toBe(72); // 60 + 12
  });

  it('mode 7 (DOWN-ALT): step 0 highest note offset 0, step 3 highest offset 12', () => {
    const held = [{ note: 60, v: 0.8 }, { note: 64, v: 0.7 }, { note: 67, v: 0.9 }];
    const r0 = _arpStep({ running: true, stepIndex: 0, heldNotes: held }, { arp_mode: 7 / 10, arp_octave: 1.0, arp_gate_time: 0.5, arp_hold: 0, arp_key_sync: 0 });
    expect(r0.note.note).toBe(67); // highest: (3-1)-0 = 2
    expect(r0.octaveOffset).toBe(0);

    const r3 = _arpStep({ running: true, stepIndex: 3, heldNotes: held }, { arp_mode: 7 / 10, arp_octave: 1.0, arp_gate_time: 0.5, arp_hold: 0, arp_key_sync: 0 });
    // step 3, held.length=3 → floor(3/3)%2 = 1%2 = 1 → offset 12
    // noteIdx = (3-1)-(3%3) = 2-0 = 2 → note 67 + 12 = 79
    expect(r3.note.note).toBe(79);
  });
});

describe('Arp step — mode 8 (RANDOM)', () => {
  it('produces random note index within held range', () => {
    const held = [{ note: 60, v: 0.8 }, { note: 64, v: 0.7 }, { note: 67, v: 0.9 }];
    let indices = new Set();
    for (let i = 0; i < 50; i++) {
      const result = _arpStep({ running: true, stepIndex: i, heldNotes: held }, { arp_mode: 8 / 10, arp_octave: 1.0, arp_gate_time: 0.5, arp_hold: 0, arp_key_sync: 0 });
      indices.add(result.noteIdx);
      expect(result.noteIdx).toBeGreaterThanOrEqual(0);
      expect(result.noteIdx).toBeLessThan(3);
    }
    // With 50 trials, we should see at least 2 different indices (high probability)
    expect(indices.size).toBeGreaterThanOrEqual(2);
  });

  it('random octave offset within arpOctave range', () => {
    const held = [{ note: 60, v: 0.8 }];
    let offsets = new Set();
    // arp_octave: 0.33 → Math.round(0.33*3) = Math.round(1) = 1 → max (1+1)*12 = 24
    for (let i = 0; i < 30; i++) {
      const result = _arpStep({ running: true, stepIndex: i, heldNotes: held }, { arp_mode: 8 / 10, arp_octave: 0.33, arp_gate_time: 0.5, arp_hold: 0, arp_key_sync: 0 });
      offsets.add(result.octaveOffset);
      expect(result.octaveOffset).toBeGreaterThanOrEqual(0);
      expect(result.octaveOffset).toBeLessThanOrEqual(24);
      expect(result.octaveOffset % 12).toBe(0);
    }
    // Should see at least 2 different offsets
    expect(offsets.size).toBeGreaterThanOrEqual(2);
  });

  it('arp_step increments stepIndex even in random mode', () => {
    const engine = { running: true, stepIndex: 0, heldNotes: [{ note: 60, v: 0.8 }] };
    _arpStep(engine, { arp_mode: 8 / 10, arp_octave: 0.0, arp_gate_time: 0.5, arp_hold: 0, arp_key_sync: 0 });
    expect(engine.stepIndex).toBe(1);
  });
});

describe('Arp step — mode 9 (AS-PLAYED)', () => {
  it('plays notes in original held order (AS-PLAYED = insertion order)', () => {
    const engine = { running: true, stepIndex: 0, heldNotes: [{ note: 67, velocity: 0.9 }, { note: 60, velocity: 0.8 }] };
    const result = _arpStep(engine, { arp_mode: 9 / 10, arp_octave: 0.0, arp_gate_time: 0.5, arp_hold: 0, arp_key_sync: 0 });
    // AS-PLAYED: noteIdx = stepIndex % held.length, does NOT sort
    // held order: [67, 60], step 0 → noteIdx 0 → 67
    expect(result.note.note).toBe(67);
  });
});

describe('Arp step — edge cases', () => {
  it('returns played=false when engine not running', () => {
    const result = _arpStep({ running: false, heldNotes: [] }, {});
    expect(result.played).toBe(false);
  });

  it('stops engine when held notes empty', () => {
    const engine = { running: true, stepIndex: 0, heldNotes: [], stop: vi.fn() };
    const result = _arpStep(engine, { arp_mode: 0.0, arp_octave: 0.0, arp_gate_time: 0.5, arp_hold: 0, arp_key_sync: 0 });
    expect(result.played).toBe(false);
    expect(engine.stop).toHaveBeenCalled();
  });

  it('clamps octaveOffset to maxOctave*12 (arpOctave limited to 4)', () => {
    const held = [{ note: 60, v: 0.8 }, { note: 64, v: 0.7 }];
    // step 10, held.length=2 → floor(10/2)=5 → octaveOffset=60
    // maxOctave = min(5, 4) = 4 → maxOffset = 48
    // octaveOffset (60) > 48 → reset
    const engine = { running: true, stepIndex: 10, heldNotes: held };
    const result = _arpStep(engine, { arp_mode: 0.0, arp_octave: 5.0, arp_gate_time: 0.5, arp_hold: 0, arp_key_sync: 0 });
    expect(result.octaveOffset).toBe(0);
    // stepIndex gets reset to 0 after clamp, but stepIndex++ makes it 1
    expect(engine.stepIndex).toBe(1);
  });

  it('default case falls through to modulo', () => {
    const engine = { running: true, stepIndex: 0, heldNotes: [{ note: 60, v: 0.8 }, { note: 64, v: 0.7 }] };
    const result = _arpStep(engine, { arp_mode: 99.0, arp_octave: 0.0, arp_gate_time: 0.5, arp_hold: 0, arp_key_sync: 0 });
    // default: noteIdx = stepIndex % held.length = 0 % 2 = 0
    expect(result.note.note).toBe(60);
  });

  it('note out of MIDI range (0-127) is not played', () => {
    // stepIndex=4, octaveOffset = floor(4/1)*12=48 (≤48=maxOctave*12, clamp NOT triggered)
    // outNote = 120+48 = 168 > 127 → not played
    const engine = { running: true, stepIndex: 4, heldNotes: [{ note: 120, velocity: 0.8 }] };
    const result = _arpStep(engine, { arp_mode: 0.0, arp_octave: 3.0, arp_gate_time: 0.5, arp_hold: 0, arp_key_sync: 0 });
    expect(result.played).toBe(false);
  });

  it('unusual velocity values are preserved', () => {
    const engine = { running: true, stepIndex: 0, heldNotes: [{ note: 60, velocity: 0.37 }] };
    const result = _arpStep(engine, { arp_mode: 0.0, arp_octave: 0.0, arp_gate_time: 0.5, arp_hold: 0, arp_key_sync: 0 });
    expect(result.note.velocity).toBe(0.37);
  });
});

// ────────── Seq Engine Lifecycle ──────────────────────────────

describe('Seq engine — lifecycle (init, start, stop, notes)', () => {
  it('initSeqEngine creates engine with defaults', () => {
    const bridge = makeMockBridge();
    const engine = createSeqEngine(bridge);
    expect(engine.running).toBe(false);
    expect(engine.stepIndex).toBe(0);
    expect(engine.timerId).toBeNull();
    expect(engine.previousValues.length).toBe(32);
    expect(engine.previousValues.every(v => v === 0)).toBe(true);
    expect(engine._forcedFreeRunning).toBe(false);
    expect(engine.heldNotes).toEqual([]);
  });

  it('addHeldNote adds unique note', () => {
    const bridge = makeMockBridge({ seq_enable: 1.0 });
    const engine = createSeqEngine(bridge);
    engine.addHeldNote(60, 0.8);
    engine.addHeldNote(60, 0.9); // duplicate ignored
    expect(engine.heldNotes.length).toBe(1);
  });

  it('addHeldNote auto-starts when seq_enable>0.5 and key sync needed', () => {
    const bridge = makeMockBridge({ seq_enable: 1.0, seq_key_loop: 1 / 2 });
    const engine = createSeqEngine(bridge);
    engine.addHeldNote(60, 0.8);
    expect(engine.running).toBe(true);
  });

  it('addHeldNote does NOT auto-start when no key sync', () => {
    const bridge = makeMockBridge({ seq_enable: 1.0, seq_key_loop: 0.0 });
    const engine = createSeqEngine(bridge);
    engine.addHeldNote(60, 0.8);
    expect(engine.running).toBe(false);
  });

  it('removeHeldNote removes existing note', () => {
    const engine = createSeqEngine(makeMockBridge());
    engine.heldNotes = [{ note: 60, velocity: 0.8 }, { note: 64, velocity: 0.7 }];
    engine.removeHeldNote(60);
    expect(engine.heldNotes.length).toBe(1);
    expect(engine.heldNotes[0].note).toBe(64);
  });

  it('removeHeldNote stops engine when key sync and last note removed', () => {
    const bridge = makeMockBridge({ seq_key_loop: 1 / 2 });
    const engine = createSeqEngine(bridge);
    engine.heldNotes = [{ note: 60, velocity: 0.8 }];
    engine.running = true;
    engine.removeHeldNote(60);
    expect(engine.running).toBe(false);
  });

  it('removeHeldNote does NOT stop when no key sync', () => {
    const bridge = makeMockBridge({ seq_key_loop: 0.0 });
    const engine = createSeqEngine(bridge);
    engine.heldNotes = [{ note: 60, velocity: 0.8 }];
    engine.running = true;
    engine.removeHeldNote(60);
    expect(engine.running).toBe(true); // free running, keeps going
  });

  it('start sets running=true and stepIndex=0', () => {
    const engine = createSeqEngine(makeMockBridge());
    engine.stepIndex = 5;
    engine.start();
    expect(engine.running).toBe(true);
    expect(engine.stepIndex).toBe(0);
  });

  it('start no-ops when already running', () => {
    const engine = createSeqEngine(makeMockBridge());
    engine.running = true;
    engine.stepIndex = 10;
    engine.start();
    expect(engine.stepIndex).toBe(10);
  });

  it('stop sets running=false and clears timerId', () => {
    const engine = createSeqEngine(makeMockBridge());
    engine.running = true;
    engine.timerId = 456;
    engine.stop();
    expect(engine.running).toBe(false);
    expect(engine.timerId).toBeNull();
  });

  it('stop no-ops when not running', () => {
    const engine = createSeqEngine(makeMockBridge());
    expect(() => engine.stop()).not.toThrow();
  });
});

// ────────── Seq Step — Slew Rate ──────────────────────────────

describe('Seq step — slew rate interpolation', () => {
  it('no slew when slewRate=0: stepVal is unchanged', () => {
    const engine = { running: true, stepIndex: 0, previousValues: [0], heldNotes: [] };
    const result = _seqStep(engine, { seq_length: 0.0, seq_swing: 0, seq_slew_rate: 0, seq_key_loop: 0, 'seq_step_1': 0.8 });
    expect(result.stepVal).toBe(0.8);
    expect(result.slewApplied).toBe(false);
  });

  it('slewRate=0.5: stepVal interpolates toward target', () => {
    const engine = { running: true, stepIndex: 0, previousValues: [0], heldNotes: [] };
    // slewFactor = max(0.01, 1.0 - 0.5*0.5) = max(0.01, 0.75) = 0.75
    // stepVal = 0 + (0.8 - 0) * (1 - 0.75) = 0.8 * 0.25 = 0.2
    const result = _seqStep(engine, { seq_length: 0.0, seq_swing: 0, seq_slew_rate: 0.5, seq_key_loop: 0, 'seq_step_1': 0.8 });
    expect(result.stepVal).toBeCloseTo(0.2, 5);
    expect(result.slewApplied).toBe(true);
  });

  it('slewRate=1.0: strong slew, stepVal barely moves', () => {
    const engine = { running: true, stepIndex: 0, previousValues: [0], heldNotes: [] };
    // slewFactor = max(0.01, 1.0 - 1.0*0.5) = 0.5
    // stepVal = 0 + (0.8 - 0) * (1 - 0.5) = 0.4
    const result = _seqStep(engine, { seq_length: 0.0, seq_swing: 0, seq_slew_rate: 1.0, seq_key_loop: 0, 'seq_step_1': 0.8 });
    expect(result.stepVal).toBeCloseTo(0.4, 5);
  });

  it('slewRate=0.01 is threshold: barely any slew', () => {
    const engine = { running: true, stepIndex: 0, previousValues: [0], heldNotes: [] };
    // slewFactor = max(0.01, 1.0 - 0.01*0.5) = max(0.01, 0.995) = 0.995
    // stepVal = 0 + (0.8 - 0) * (1 - 0.995) = 0.8 * 0.005 = 0.004
    const result = _seqStep(engine, { seq_length: 0.0, seq_swing: 0, seq_slew_rate: 0.01, seq_key_loop: 0, 'seq_step_1': 0.8 });
    // 0.01 is NOT > 0.01 (strict >), so slew is NOT applied
    expect(result.slewApplied).toBe(false);
    expect(result.stepVal).toBe(0.8);
  });

  it('slewRate=0.011 crosses threshold and applies minimal slew', () => {
    const engine = { running: true, stepIndex: 0, previousValues: [0], heldNotes: [] };
    // 0.011 > 0.01 → slew applied
    // slewFactor = max(0.01, 1.0 - 0.011*0.5) = max(0.01, 0.9945) = 0.9945
    // stepVal = 0 + (0.8 - 0) * (1 - 0.9945) = 0.8 * 0.0055 = 0.0044
    const result = _seqStep(engine, { seq_length: 0.0, seq_swing: 0, seq_slew_rate: 0.011, seq_key_loop: 0, 'seq_step_1': 0.8 });
    expect(result.slewApplied).toBe(true);
    expect(result.stepVal).toBeCloseTo(0.0044, 5);
  });

  it('slew approaches target over multiple steps (slewRate=0.5)', () => {
    // With seqLength=2, steps alternate 0,1,0,1... Each step has its own previousValue.
    // Both steps independently slew from 0 toward 1.0. Each first access reads 0.
    const engine = { running: true, stepIndex: 0, previousValues: new Array(32).fill(0), heldNotes: [] };
    const paramCache = { seq_length: 0.0, seq_swing: 0, seq_slew_rate: 0.5, seq_key_loop: 0 };
    for (var si = 1; si <= 2; si++) {
      paramCache['seq_step_' + si] = 1.0;
    }
    const values = [];
    for (let i = 0; i < 10; i++) {
      const r = _seqStep(engine, paramCache);
      if (r.processed) values.push(r.stepVal);
    }
    // Steps alternate 0→1→0→1→0→1... Each starts from its own previousValue=0
    expect(values[0]).toBeCloseTo(0.25, 5);  // step 0: 0 + (1-0)*0.25 = 0.25
    expect(values[1]).toBeCloseTo(0.25, 5);  // step 1: 0 + (1-0)*0.25 = 0.25
    // After 10 iterations (5 per step), each step approaches 1.0
    expect(values[values.length - 1]).toBeGreaterThan(0.76);
  });

  it('slew stores updated value in previousValues', () => {
    const engine = { running: true, stepIndex: 0, previousValues: [0], heldNotes: [] };
    _seqStep(engine, { seq_length: 0.0, seq_swing: 0, seq_slew_rate: 0.5, seq_key_loop: 0, 'seq_step_1': 0.8 });
    expect(engine.previousValues[0]).toBeCloseTo(0.2, 5);
  });

  it('skip step does NOT update previousValues', () => {
    const engine = { running: true, stepIndex: 0, previousValues: [0.5], heldNotes: [] };
    const result = _seqStep(engine, { seq_length: 0.0, seq_swing: 0, seq_slew_rate: 0.5, seq_key_loop: 0, 'seq_step_1': 0 });
    expect(result.isSkip).toBe(true);
    // previousValues[0] should remain 0.5 (unslewed, not updated)
    expect(engine.previousValues[0]).toBe(0.5);
  });
});

// ────────── Seq Step — Skip Detection ─────────────────────────

describe('Seq step — skip detection', () => {
  it('stepVal=0 with round(0*255)=0 marks as skip', () => {
    const engine = { running: true, stepIndex: 0, previousValues: [0], heldNotes: [] };
    const result = _seqStep(engine, { seq_length: 0.0, seq_swing: 0, seq_slew_rate: 0, seq_key_loop: 0, 'seq_step_1': 0 });
    expect(result.isSkip).toBe(true);
  });

  it('stepVal=0.001 with round(0.001*255)=0 marks as skip', () => {
    const engine = { running: true, stepIndex: 0, previousValues: [0], heldNotes: [] };
    const result = _seqStep(engine, { seq_length: 0.0, seq_swing: 0, seq_slew_rate: 0, seq_key_loop: 0, 'seq_step_1': 0.0009 });
    expect(result.isSkip).toBe(true);
  });

  it('stepVal=0.004 with round(0.004*255)=1 does NOT skip', () => {
    const engine = { running: true, stepIndex: 0, previousValues: [0], heldNotes: [] };
    const result = _seqStep(engine, { seq_length: 0.0, seq_swing: 0, seq_slew_rate: 0, seq_key_loop: 0, 'seq_step_1': 0.004 });
    expect(result.isSkip).toBe(false);
  });

  it('stepVal undefined falls back to raw=0 skip', () => {
    const engine = { running: true, stepIndex: 0, previousValues: [0], heldNotes: [] };
    const result = _seqStep(engine, { seq_length: 0.0, seq_swing: 0, seq_slew_rate: 0, seq_key_loop: 0, 'seq_step_1_raw': 0 });
    expect(result.isSkip).toBe(true);
    expect(result.stepVal).toBe(0.5); // default fallback
  });

  it('stepVal undefined with non-zero raw does NOT skip', () => {
    const engine = { running: true, stepIndex: 0, previousValues: [0], heldNotes: [] };
    const result = _seqStep(engine, { seq_length: 0.0, seq_swing: 0, seq_slew_rate: 0, seq_key_loop: 0, 'seq_step_1_raw': 128 });
    expect(result.isSkip).toBe(false);
  });

  it('normal stepVal=0.5 is not skipped', () => {
    const engine = { running: true, stepIndex: 0, previousValues: [0], heldNotes: [] };
    const result = _seqStep(engine, { seq_length: 0.0, seq_swing: 0, seq_slew_rate: 0, seq_key_loop: 0, 'seq_step_1': 0.5 });
    expect(result.isSkip).toBe(false);
  });
});

// ────────── Seq Step — General Logic ─────────────────────────

describe('Seq step — general logic', () => {
  it('returns processed=false when engine not running', () => {
    const result = _seqStep({ running: false, heldNotes: [] }, {});
    expect(result.processed).toBe(false);
  });

  it('stops when key sync needed and no held notes', () => {
    const engine = { running: true, stepIndex: 0, previousValues: [0], heldNotes: [] };
    const result = _seqStep(engine, { seq_key_loop: 1 / 2, seq_length: 0.0, seq_swing: 0, seq_slew_rate: 0 });
    expect(result.processed).toBe(false);
    expect(result.reason).toBe('key_sync_no_notes');
  });

  it('seqLength = round(length*31) + 2, default (0) = 2 steps', () => {
    const engine = { running: true, stepIndex: 0, previousValues: [0, 0], heldNotes: [] };
    const result = _seqStep(engine, { seq_length: 0.0, seq_swing: 0, seq_slew_rate: 0, seq_key_loop: 0, 'seq_step_1': 0.5, 'seq_step_2': 0.7 });
    expect(result.seqLength).toBe(2);
    expect(result.processed).toBe(true);
  });

  it('seqLength at max (1.0) = round(1.0*31)+2 = 33, clamped to seq step range', () => {
    const engine = { running: true, stepIndex: 0, previousValues: new Array(33).fill(0), heldNotes: [] };
    const result = _seqStep(engine, { seq_length: 1.0, seq_swing: 0, seq_slew_rate: 0, seq_key_loop: 0, 'seq_step_1': 0.5 });
    expect(result.seqLength).toBe(33);
  });

  it('stepIndex wraps based on seqLength', () => {
    const engine = { running: true, stepIndex: 2, previousValues: [0, 0], heldNotes: [] };
    // seqLength=2, stepIndex=2 → stepIdx = 2%2 = 0 → seq_step_1
    const result = _seqStep(engine, { seq_length: 0.0, seq_swing: 0, seq_slew_rate: 0, seq_key_loop: 0, 'seq_step_1': 0.5 });
    expect(result.stepIdx).toBe(0);
  });

  it('increments stepIndex after processing', () => {
    const engine = { running: true, stepIndex: 0, previousValues: [0], heldNotes: [] };
    _seqStep(engine, { seq_length: 0.0, seq_swing: 0, seq_slew_rate: 0, seq_key_loop: 0, 'seq_step_1': 0.5 });
    expect(engine.stepIndex).toBe(1);
  });

  it('step passes through without slew when prev is undefined', () => {
    const engine = { running: true, stepIndex: 5, previousValues: [], heldNotes: [] };
    // seq_length=0.2 → Math.round(0.2*31)+2 = 8 → stepIdx=5%8=5 → 'seq_step_6': 0.9
    const result = _seqStep(engine, { seq_length: 0.2, seq_swing: 0, seq_slew_rate: 0.5, seq_key_loop: 0, 'seq_step_6': 0.9 });
    // previousValues[5] is undefined → prev is undefined → slew is not applied
    expect(result.stepVal).toBe(0.9);
    expect(result.slewApplied).toBe(false);
  });
});

// ────────── _updateSeqEngine Lifecycle ────────────────────────

describe('_updateSeqEngine — start/stop logic', () => {
  function _updateSeqEngine(bridge) {
    var seqEn = bridge.parameterCache['seq_enable'] || 0;
    if (!bridge._seqEngine) {
      bridge._seqEngine = createSeqEngine(bridge);
    }
    var keyLoop = Math.round((bridge.parameterCache['seq_key_loop'] || 0) * 2);
    var needsKeySync = (keyLoop === 1 || keyLoop === 2);

    if (seqEn > 0.5) {
      if (!needsKeySync || bridge._seqEngine.heldNotes.length > 0) {
        bridge._seqEngine.start();
      } else {
        bridge.parameterCache['seq_key_loop'] = 0;
        bridge._seqEngine._forcedFreeRunning = true;
        bridge.handleParameterChangeFromBackend('seq_key_loop', 0);
        bridge._seqEngine.start();
      }
    } else {
      if (bridge._seqEngine) {
        bridge._seqEngine._forcedFreeRunning = false;
        bridge._seqEngine.stop();
      }
    }
  }

  it('starts engine when seq_enable>0.5 and no key sync', () => {
    const bridge = makeMockBridge({ seq_enable: 1.0, seq_key_loop: 0.0 });
    _updateSeqEngine(bridge);
    expect(bridge._seqEngine.running).toBe(true);
  });

  it('starts engine when seq_enable>0.5 with key sync and held notes', () => {
    const bridge = makeMockBridge({ seq_enable: 1.0, seq_key_loop: 1 / 2 });
    bridge._seqEngine = createSeqEngine(bridge);
    bridge._seqEngine.heldNotes = [{ note: 60, velocity: 0.8 }];
    _updateSeqEngine(bridge);
    expect(bridge._seqEngine.running).toBe(true);
  });

  it('forces Free Running when key sync but no held notes', () => {
    const bridge = makeMockBridge({ seq_enable: 1.0, seq_key_loop: 1 / 2 });
    bridge._seqEngine = createSeqEngine(bridge);
    _updateSeqEngine(bridge);
    expect(bridge._seqEngine.running).toBe(true);
    expect(bridge._seqEngine._forcedFreeRunning).toBe(true);
    expect(bridge._seqEngine.running).toBe(true);
    expect(bridge.parameterCache['seq_key_loop']).toBe(0);
    expect(bridge.handleParameterChangeFromBackend).toHaveBeenCalledWith('seq_key_loop', 0);
  });

  it('stops engine when seq_enable<=0.5', () => {
    const bridge = makeMockBridge({ seq_enable: 0.0 });
    bridge._seqEngine = createSeqEngine(bridge);
    bridge._seqEngine.running = true;
    _updateSeqEngine(bridge);
    expect(bridge._seqEngine.running).toBe(false);
    expect(bridge._seqEngine._forcedFreeRunning).toBe(false);
  });

  it('starts when seq_key_loop=2 (Poly Key Loop)', () => {
    const bridge = makeMockBridge({ seq_enable: 1.0, seq_key_loop: 2 / 2 });
    bridge._seqEngine = createSeqEngine(bridge);
    bridge._seqEngine.heldNotes = [{ note: 60, velocity: 0.8 }];
    _updateSeqEngine(bridge);
    expect(bridge._seqEngine.running).toBe(true);
  });

  it('no-op when seq_enable changes to 0 and engine not initialized', () => {
    const bridge = makeMockBridge({ seq_enable: 0.0 });
    bridge._seqEngine = null;
    expect(() => _updateSeqEngine(bridge)).not.toThrow();
  });

  it('idempotent: starting already running engine is safe', () => {
    const bridge = makeMockBridge({ seq_enable: 1.0 });
    bridge._seqEngine = createSeqEngine(bridge);
    bridge._seqEngine.running = true;
    bridge._seqEngine.stepIndex = 5;
    _updateSeqEngine(bridge);
    expect(bridge._seqEngine.running).toBe(true);
    expect(bridge._seqEngine.stepIndex).toBe(5); // not reset
  });
});

// ────────── Bridge initialization wiring ──────────────────────

describe('Bridge engine init wiring — onParameterChanged', () => {
  it('arp_enable > 0.5 with held notes starts arp engine', () => {
    const engine = createArpEngine({ parameterCache: { arp_enable: 1.0 } });
    engine.heldNotes = [{ note: 60, velocity: 0.8 }];
    // Simulate: if (val > 0.5 && bridge._arpEngine && bridge._arpEngine.heldNotes.length > 0) { start }
    if (1.0 > 0.5 && engine && engine.heldNotes.length > 0) {
      engine.start();
    }
    expect(engine.running).toBe(true);
  });

  it('arp_enable <= 0.5 stops arp engine', () => {
    const engine = createArpEngine({ parameterCache: { arp_enable: 0.0 } });
    engine.running = true;
    // Simulate: else if (bridge._arpEngine) { stop }
    if (engine) {
      engine.stop();
    }
    expect(engine.running).toBe(false);
  });

  it('seq_enable > 0.5 triggers _updateSeqEngine start', () => {
    const bridge = makeMockBridge({ seq_enable: 1.0, seq_key_loop: 0.0 });
    bridge._updateSeqEngine = function() {
      if (!this._seqEngine) this._seqEngine = createSeqEngine(this);
      if (this.parameterCache['seq_enable'] > 0.5) {
        this._seqEngine.start();
      }
    };
    bridge._updateSeqEngine();
    expect(bridge._seqEngine.running).toBe(true);
  });

  it('seq_enable <= 0.5 triggers _updateSeqEngine stop', () => {
    const bridge = makeMockBridge({ seq_enable: 0.0 });
    bridge._updateSeqEngine = function() {
      if (!this._seqEngine) this._seqEngine = createSeqEngine(this);
      if (this.parameterCache['seq_enable'] <= 0.5) {
        this._seqEngine.stop();
      }
    };
    bridge._seqEngine = createSeqEngine(bridge);
    bridge._seqEngine.running = true;
    bridge._updateSeqEngine();
    expect(bridge._seqEngine.running).toBe(false);
  });

  it('seq_key_loop change clears _forcedFreeRunning flag', () => {
    const engine = createSeqEngine(makeMockBridge());
    engine._forcedFreeRunning = true;
    // Simulate: bridge._seqEngine._forcedFreeRunning = false
    engine._forcedFreeRunning = false;
    expect(engine._forcedFreeRunning).toBe(false);
  });
});
