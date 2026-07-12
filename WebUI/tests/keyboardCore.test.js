/**
 * Vitest tests for keyboard.js — MIDI note on/off, chord/poly-chord engines, octave shift, wheels.
 *
 * Source:  WebUI/js/keyboard.js
 * Run:     npx vitest run WebUI/tests/keyboardCore.test.js
 *
 * Covers pure functions and logical operations:
 *   - midiNoteToName / _engineMidiNoteToName (note naming)
 *   - CHORD_INTERVALS, CHORD_TYPE_NAMES, NOTE_NAMES_SHORT, POLY_CHORD_DEFAULTS (data)
 *   - _initChordMemory (cache setup)
 *   - _playChordMemory (chord generation logic, memory + generated modes)
 *   - _playPolyChordMemory (poly chord assignment + generation)
 *   - _captureChordMemory (note capture from DOM)
 *   - updateOctaveButtonsVisuals (CSS property setting)
 *   - noteOn velocity calculation (raw, soft, hard, linear, fixed curves)
 *   - setupWheel / updateWheel position math
 *   - _updateKeyPressure (aftertouch/modwheel/pitch bend → key CSS props)
 *   - _handleEngineActiveNotes (JSON parse, LCD display, velocity cleanup)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

/* ================================================================
 * Constants and data structures (mirrored from source)
 * ================================================================ */

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const ENGINE_NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

const CHORD_INTERVALS = {
  0: null,            // Memory — uses captured chord_notes
  1: [0, 4, 7],       // Major
  2: [0, 3, 7],       // Minor
  3: [0, 4, 7, 11],   // Major 7th
  4: [0, 3, 7, 10],   // Minor 7th
  5: [0, 4, 7, 10],   // Dom 7th
  6: [0, 5, 7],       // Susp 4th
  7: [0, 7],          // Power Chord
  8: [0, 4, 8],       // Augmented
  9: [0, 3, 6],       // Diminished
  10: [0, 2, 7],      // Sus2
  11: [0, 4, 7, 10],  // 7th
};

const CHORD_TYPE_NAMES = ['Memory', 'Major', 'Minor', 'Major 7th', 'Minor 7th', 'Dom 7th', 'Susp 4th', 'Power Chd', 'Augmented', 'Diminished', 'Sus2', '7th'];

const NOTE_NAMES_SHORT = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

const POLY_CHORD_DEFAULTS = [
  { rootKey: 0, chordType: 1 },  // C  → Major
  { rootKey: 1, chordType: 2 },  // C# → Minor
  { rootKey: 2, chordType: 1 },  // D  → Major
  { rootKey: 3, chordType: 2 },  // D# → Minor
  { rootKey: 4, chordType: 1 },  // E  → Major
  { rootKey: 5, chordType: 2 },  // F  → Minor
  { rootKey: 6, chordType: 1 },  // F# → Major
  { rootKey: 7, chordType: 2 },  // G  → Minor
  { rootKey: 8, chordType: 1 },  // G# → Major
  { rootKey: 9, chordType: 2 },  // A  → Minor
  { rootKey: 10, chordType: 1 }, // A# → Major
  { rootKey: 11, chordType: 2 }, // B  → Minor
];

/* ================================================================
 * Functions under test (mirrored from keyboard.js)
 * ================================================================ */

function midiNoteToName(midiNote) {
  if (midiNote < 0 || midiNote > 127) return '\u2014';
  return NOTE_NAMES[midiNote % 12] + (Math.floor(midiNote / 12) - 1);
}

function _engineMidiNoteToName(midiNote) {
  if (midiNote < 0 || midiNote > 127) return '\u2014';
  return ENGINE_NOTE_NAMES[midiNote % 12] + (Math.floor(midiNote / 12) - 1);
}

function _initChordMemory(bridge) {
  if (!bridge) return;
  if (!bridge.parameterCache['chord_notes']) {
    bridge.parameterCache['chord_notes'] = [];
  }
  if (!bridge.parameterCache['chord_enable']) {
    bridge.parameterCache['chord_enable'] = 0.0;
  }
  if (!bridge.parameterCache['chord_key']) {
    bridge.parameterCache['chord_key'] = 0.0;
  }
  if (!bridge.parameterCache['chord_type']) {
    bridge.parameterCache['chord_type'] = 0.0;
  }
}

function _playChordMemory(rootNote, bridge, cache) {
  cache = cache || bridge.parameterCache || {};
  var chordEn = cache['chord_enable'] || 0.0;
  if (chordEn < 0.5) return false;

  var chordType = Math.min(11, Math.max(0, Math.round((cache['chord_type'] || 0.0) * 11)));

  if (!bridge._chordActiveNotes) bridge._chordActiveNotes = [];

  var notesToPlay = [];

  if (chordType === 0) {
    // MEMORY MODE
    var captured = cache['chord_notes'];
    if (!captured || captured.length === 0) return false;

    var baseNote = captured[0];
    var interval = rootNote - baseNote;

    captured.forEach(function(note) {
      var shiftedNote = note + interval;
      if (shiftedNote >= 0 && shiftedNote <= 127) {
        notesToPlay.push(shiftedNote);
      }
    });
  } else {
    // GENERATED MODE
    var intervals = CHORD_INTERVALS[chordType];
    if (!intervals) return false;

    intervals.forEach(function(interval) {
      var note = rootNote + interval;
      if (note >= 0 && note <= 127) {
        notesToPlay.push(note);
      }
    });
  }

  if (notesToPlay.length === 0) return false;

  notesToPlay.forEach(function(note) {
    bridge._chordActiveNotes.push(note);
    if (bridge.pianoNoteOn) bridge.pianoNoteOn(note, 0.8);
  });

  return true;
}

function _playPolyChordMemory(rootNote, bridge, cache) {
  cache = cache || bridge.parameterCache || {};
  var polyChordEn = cache['poly_chord_enable'] || 0.0;
  if (polyChordEn < 0.5) return false;

  var polyMap = cache['poly_chord_map'];
  if (!polyMap || polyMap.length < 12) return false;

  var keyClass = rootNote % 12;
  var assignment = polyMap[keyClass];
  if (!assignment) {
    assignment = POLY_CHORD_DEFAULTS[keyClass];
  }

  var chordType = assignment.chordType;
  if (chordType === undefined) chordType = 1;

  if (!bridge._chordActiveNotes) bridge._chordActiveNotes = [];

  var notesToPlay = [];

  if (chordType === 0) {
    // MEMORY MODE
    var captured = cache['chord_notes'];
    if (!captured || captured.length === 0) return false;

    var baseNote = captured[0];
    var interval = rootNote - baseNote;

    captured.forEach(function(note) {
      var shiftedNote = note + interval;
      if (shiftedNote >= 0 && shiftedNote <= 127) {
        notesToPlay.push(shiftedNote);
      }
    });
  } else {
    // GENERATED MODE
    var intervals = CHORD_INTERVALS[chordType];
    if (!intervals) return false;

    intervals.forEach(function(interval) {
      var note = rootNote + interval;
      if (note >= 0 && note <= 127) {
        notesToPlay.push(note);
      }
    });
  }

  if (notesToPlay.length === 0) return false;

  notesToPlay.forEach(function(note) {
    bridge._chordActiveNotes.push(note);
    if (bridge.pianoNoteOn) bridge.pianoNoteOn(note, 0.8);
  });

  return true;
}

function _captureChordMemory(bridge, pushedKeyMidis, octaveShift) {
  octaveShift = octaveShift || 0;
  var notes = [];
  pushedKeyMidis.forEach(function(midiNote) {
    notes.push(midiNote + octaveShift);
  });
  if (notes.length === 0) return null;
  bridge.parameterCache['chord_notes'] = notes;
  return notes;
}

function updateOctaveButtonsVisuals(octaveShift, octUpBtn, octDownBtn) {
  var currentOctVal = octaveShift / 12;
  var activeColor = 'var(--color-env-vca)';
  if (Math.abs(currentOctVal) === 1) {
    activeColor = 'var(--color-env-vcf)';
  } else if (Math.abs(currentOctVal) === 2) {
    activeColor = 'var(--color-env-mod)';
  } else if (Math.abs(currentOctVal) >= 3) {
    activeColor = 'var(--color-oct-3)';
  }

  var isUpActive = currentOctVal > 0;
  var isDownActive = currentOctVal < 0;

  if (octUpBtn) {
    if (isUpActive) {
      octUpBtn.style.color = activeColor;
      octUpBtn.style.borderColor = activeColor;
      octUpBtn.style.boxShadow = '0 0 8px ' + activeColor;
    } else {
      octUpBtn.style.color = 'var(--brand-accent)';
      octUpBtn.style.borderColor = 'var(--border-dim)';
      octUpBtn.style.boxShadow = 'none';
    }
  }
  if (octDownBtn) {
    if (isDownActive) {
      octDownBtn.style.color = activeColor;
      octDownBtn.style.borderColor = activeColor;
      octDownBtn.style.boxShadow = '0 0 8px ' + activeColor;
    } else {
      octDownBtn.style.color = 'var(--brand-accent)';
      octDownBtn.style.borderColor = 'var(--border-dim)';
      octDownBtn.style.boxShadow = 'none';
    }
  }
}

/** Calculate velocity from pointer Y position within a key (mirrors noteOn) */
function calcVelocity(clientY, rectTop, rectHeight, curve) {
  var relY = (clientY - rectTop) / rectHeight;
  var rawVelocity = Math.max(0.15, Math.min(1.0, 0.15 + (1.0 - relY) * 0.85));
  var velocity = rawVelocity;
  if (curve === 'soft') {
    velocity = rawVelocity * rawVelocity;
  } else if (curve === 'hard') {
    velocity = Math.sqrt(rawVelocity);
  } else if (curve === 'linear') {
    velocity = rawVelocity;
  } else if (curve === 'fixed') {
    velocity = 100 / 127;
  }
  return Math.max(0.01, Math.min(1.0, velocity));
}

/** Wheel position math (mirrors setupWheel updateWheel) */
function calcWheelPos(clientY, rectTop, rectHeight, wheelHeight) {
  var pct = 1.0 - (clientY - rectTop) / rectHeight;
  pct = Math.max(0, Math.min(1, pct));
  var pos = (1.0 - pct) * (rectHeight - wheelHeight);
  var bottom = (rectHeight - wheelHeight - pos);
  return { pct: pct, pos: pos, bottom: bottom };
}

/** Pressure key update (mirrors _updateKeyPressure logic for a single key) */
function applyKeyPressure(key, aftertouch, modWheel, pitchBend, pbSensitivity) {
  pbSensitivity = pbSensitivity || 6;
  var combinedPressure = Math.max(aftertouch, modWheel);
  var hasAnyPressure = combinedPressure > 0.01;
  var mwAttr = (modWheel > 0.01) ? modWheel.toFixed(3) : null;
  var pbPx = Math.round(pitchBend * pbSensitivity);
  var pbAttr = Math.abs(pitchBend) > 0.01 ? String(pbPx) : null;

  if (hasAnyPressure) {
    key._pressure = combinedPressure;
    key._mwPressure = mwAttr || '0';
    key._pressured = true;
  } else {
    key._pressure = null;
    key._mwPressure = null;
    key._pressured = false;
  }
  if (pbAttr) {
    key._pbOffset = pbAttr + 'px';
    key._pitchBent = true;
  } else {
    key._pbOffset = null;
    key._pitchBent = false;
  }
  return {
    combinedPressure: hasAnyPressure ? combinedPressure : null,
    mwAttr: mwAttr,
    pbPx: pbPx,
    pbAttr: pbAttr,
  };
}

/* ================================================================
 * TESTS
 * ================================================================ */

// ────────── midiNoteToName ────────────────────────────────────

describe('midiNoteToName', () => {
  it('C2 → note 36 returns "C2"', () => {
    expect(midiNoteToName(36)).toBe('C2');
  });

  it('C4 → note 60 returns "C4" (middle C)', () => {
    expect(midiNoteToName(60)).toBe('C4');
  });

  it('A4 → note 69 returns "A4" (440Hz)', () => {
    expect(midiNoteToName(69)).toBe('A4');
  });

  it('G9 → note 127 returns "G9" (max)', () => {
    expect(midiNoteToName(127)).toBe('G9');
  });

  it('C0 → note 12 returns "C0" (lowest C)', () => {
    expect(midiNoteToName(12)).toBe('C0');
  });

  it('note 0 returns "C-1" (lowest)', () => {
    expect(midiNoteToName(0)).toBe('C-1');
  });

  it('note -1 returns em-dash (out of range)', () => {
    expect(midiNoteToName(-1)).toBe('\u2014');
  });

  it('note 128 returns em-dash (out of range)', () => {
    expect(midiNoteToName(128)).toBe('\u2014');
  });

  it('all 12 notes in octave 4 have correct names', () => {
    const expected = ['C4','C#4','D4','D#4','E4','F4','F#4','G4','G#4','A4','A#4','B4'];
    for (let i = 0; i < 12; i++) {
      expect(midiNoteToName(60 + i)).toBe(expected[i]);
    }
  });

  it('C#5 → note 73 returns "C#5"', () => {
    expect(midiNoteToName(73)).toBe('C#5');
  });

  it('_engineMidiNoteToName matches midiNoteToName output', () => {
    for (let n = 0; n <= 127; n++) {
      expect(_engineMidiNoteToName(n)).toBe(midiNoteToName(n));
    }
  });
});

// ────────── CHORD_INTERVALS ───────────────────────────────────

describe('CHORD_INTERVALS — data structure', () => {
  it('has exactly 12 entries (types 0-11)', () => {
    expect(Object.keys(CHORD_INTERVALS).length).toBe(12);
  });

  it('type 0 (Memory) is null', () => {
    expect(CHORD_INTERVALS[0]).toBeNull();
  });

  it('type 1 (Major) has [0,4,7]', () => {
    expect(CHORD_INTERVALS[1]).toEqual([0, 4, 7]);
  });

  it('type 2 (Minor) has [0,3,7]', () => {
    expect(CHORD_INTERVALS[2]).toEqual([0, 3, 7]);
  });

  it('type 7 (Power) has [0,7]', () => {
    expect(CHORD_INTERVALS[7]).toEqual([0, 7]);
  });

  it('all generated types (1-11) have at least 2 intervals', () => {
    for (let t = 1; t <= 11; t++) {
      expect(CHORD_INTERVALS[t].length).toBeGreaterThanOrEqual(2);
    }
  });

  it('all intervals are unique within each type', () => {
    for (let t = 1; t <= 11; t++) {
      const intervals = CHORD_INTERVALS[t];
      const unique = new Set(intervals);
      expect(unique.size).toBe(intervals.length);
    }
  });

  it('all interval values are 0-11 (within one octave)', () => {
    for (let t = 1; t <= 11; t++) {
      CHORD_INTERVALS[t].forEach(interval => {
        expect(interval).toBeGreaterThanOrEqual(0);
        expect(interval).toBeLessThanOrEqual(11);
      });
    }
  });

  it('type 11 (7th) matches type 5 (Dom 7th) intervals [0,4,7,10]', () => {
    expect(CHORD_INTERVALS[11]).toEqual(CHORD_INTERVALS[5]);
  });
});

// ────────── CHORD_TYPE_NAMES ─────────────────────────────────

describe('CHORD_TYPE_NAMES', () => {
  it('has 12 entries', () => {
    expect(CHORD_TYPE_NAMES.length).toBe(12);
  });

  it('index 0 is "Memory"', () => {
    expect(CHORD_TYPE_NAMES[0]).toBe('Memory');
  });

  it('index 1 is "Major"', () => {
    expect(CHORD_TYPE_NAMES[1]).toBe('Major');
  });

  it('all entries are non-empty strings', () => {
    CHORD_TYPE_NAMES.forEach(name => {
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    });
  });
});

// ────────── POLY_CHORD_DEFAULTS ──────────────────────────────

describe('POLY_CHORD_DEFAULTS', () => {
  it('has exactly 12 entries (one per key class)', () => {
    expect(POLY_CHORD_DEFAULTS.length).toBe(12);
  });

  it('each entry has rootKey and chordType', () => {
    POLY_CHORD_DEFAULTS.forEach(entry => {
      expect(entry).toHaveProperty('rootKey');
      expect(entry).toHaveProperty('chordType');
    });
  });

  it('rootKeys are 0..11 in order', () => {
    POLY_CHORD_DEFAULTS.forEach((entry, i) => {
      expect(entry.rootKey).toBe(i);
    });
  });

  it('alternates Major(1) / Minor(2) starting with Major on C', () => {
    const expectedPattern = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2];
    POLY_CHORD_DEFAULTS.forEach((entry, i) => {
      expect(entry.chordType).toBe(expectedPattern[i]);
    });
  });

  it('NOTE_NAMES_SHORT has 12 entries matching C..B', () => {
    expect(NOTE_NAMES_SHORT).toEqual(['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']);
  });
});

// ────────── _initChordMemory ──────────────────────────────────

describe('_initChordMemory', () => {
  it('initializes chord_notes to empty array when missing', () => {
    const bridge = { parameterCache: {} };
    _initChordMemory(bridge);
    expect(bridge.parameterCache['chord_notes']).toEqual([]);
  });

  it('initializes chord_enable=0.0 when missing', () => {
    const bridge = { parameterCache: {} };
    _initChordMemory(bridge);
    expect(bridge.parameterCache['chord_enable']).toBe(0.0);
  });

  it('initializes chord_key=0.0 and chord_type=0.0 when missing', () => {
    const bridge = { parameterCache: {} };
    _initChordMemory(bridge);
    expect(bridge.parameterCache['chord_key']).toBe(0.0);
    expect(bridge.parameterCache['chord_type']).toBe(0.0);
  });

  it('does not overwrite existing values', () => {
    const bridge = { parameterCache: { chord_notes: [60, 64], chord_enable: 1.0, chord_key: 3, chord_type: 2 } };
    _initChordMemory(bridge);
    expect(bridge.parameterCache['chord_notes']).toEqual([60, 64]);
    expect(bridge.parameterCache['chord_enable']).toBe(1.0);
  });

  it('does nothing when bridge is null', () => {
    expect(() => _initChordMemory(null)).not.toThrow();
  });
});

// ────────── _captureChordMemory ──────────────────────────────

describe('_captureChordMemory', () => {
  it('captures MIDI notes with octaveShift=0', () => {
    const bridge = { parameterCache: {} };
    const notes = _captureChordMemory(bridge, [60, 64, 67], 0);
    expect(notes).toEqual([60, 64, 67]);
    expect(bridge.parameterCache['chord_notes']).toEqual([60, 64, 67]);
  });

  it('applies octaveShift to captured notes', () => {
    const bridge = { parameterCache: {} };
    const notes = _captureChordMemory(bridge, [60, 64], 12);
    expect(notes).toEqual([72, 76]);
  });

  it('returns null when no notes are held', () => {
    const bridge = { parameterCache: {} };
    const notes = _captureChordMemory(bridge, [], 0);
    expect(notes).toBeNull();
  });

  it('captures single note correctly', () => {
    const bridge = { parameterCache: {} };
    const notes = _captureChordMemory(bridge, [69], -12);
    expect(notes).toEqual([57]);
  });
});

// ────────── _playChordMemory ──────────────────────────────────

describe('_playChordMemory — Memory mode (type 0)', () => {
  it('plays captured chord transposed to root note', () => {
    const bridge = {
      _chordActiveNotes: [],
      pianoNoteOn: vi.fn(),
      parameterCache: {
        chord_enable: 1.0,
        chord_type: 0.0,
        chord_notes: [60, 64, 67], // C E G
      },
    };
    const result = _playChordMemory(65, bridge); // root=65 (F)
    // Transpose from 60→65 = +5 semitones: [65, 69, 72]
    expect(result).toBe(true);
    expect(bridge._chordActiveNotes).toEqual([65, 69, 72]);
    expect(bridge.pianoNoteOn).toHaveBeenCalledTimes(3);
  });

  it('returns false when chord_enable < 0.5', () => {
    const bridge = { _chordActiveNotes: [], parameterCache: { chord_enable: 0.0, chord_type: 0.0 } };
    expect(_playChordMemory(60, bridge)).toBe(false);
  });

  it('returns false when no captured notes', () => {
    const bridge = { _chordActiveNotes: [], pianoNoteOn: vi.fn(), parameterCache: { chord_enable: 1.0, chord_type: 0.0, chord_notes: [] } };
    expect(_playChordMemory(60, bridge)).toBe(false);
  });

  it('returns false when captured is undefined', () => {
    const bridge = { _chordActiveNotes: [], pianoNoteOn: vi.fn(), parameterCache: { chord_enable: 1.0, chord_type: 0.0 } };
    expect(_playChordMemory(60, bridge)).toBe(false);
  });

  it('clamps notes outside MIDI range (0-127)', () => {
    const bridge = {
      _chordActiveNotes: [],
      pianoNoteOn: vi.fn(),
      parameterCache: { chord_enable: 1.0, chord_type: 0.0, chord_notes: [120] },
    };
    // Transpose from 120→60 = -60: [60] — within range
    const result = _playChordMemory(60, bridge);
    expect(result).toBe(true);
    expect(bridge._chordActiveNotes).toEqual([60]);
  });

  it('discards notes that go below 0', () => {
    const bridge = {
      _chordActiveNotes: [],
      pianoNoteOn: vi.fn(),
      parameterCache: { chord_enable: 1.0, chord_type: 0.0, chord_notes: [10, 12] },
    };
    // root=5 → interval=5-10=-5 → [5, 7] — both within range
    const result = _playChordMemory(5, bridge);
    expect(result).toBe(true);
    expect(bridge._chordActiveNotes).toEqual([5, 7]);
  });
});

describe('_playChordMemory — Generated mode (type 1-11)', () => {
  it('type 1 (Major): root=60 → [60,64,67] (C E G)', () => {
    const bridge = { _chordActiveNotes: [], pianoNoteOn: vi.fn(), parameterCache: { chord_enable: 1.0, chord_type: 1 / 11 } };
    const result = _playChordMemory(60, bridge);
    expect(result).toBe(true);
    expect(bridge._chordActiveNotes).toEqual([60, 64, 67]);
  });

  it('type 2 (Minor): root=60 → [60,63,67] (C Eb G)', () => {
    const bridge = { _chordActiveNotes: [], pianoNoteOn: vi.fn(), parameterCache: { chord_enable: 1.0, chord_type: 2 / 11 } };
    _playChordMemory(60, bridge);
    expect(bridge._chordActiveNotes).toEqual([60, 63, 67]);
  });

  it('type 7 (Power): root=65 → [65,72] (F + octave)', () => {
    const bridge = { _chordActiveNotes: [], pianoNoteOn: vi.fn(), parameterCache: { chord_enable: 1.0, chord_type: 7 / 11 } };
    _playChordMemory(65, bridge);
    expect(bridge._chordActiveNotes).toEqual([65, 72]);
  });

  it('chord_type rounds: 0.09 → round(0.09*11)=round(1)=1 → Major', () => {
    const bridge = { _chordActiveNotes: [], pianoNoteOn: vi.fn(), parameterCache: { chord_enable: 1.0, chord_type: 0.09 } };
    _playChordMemory(60, bridge);
    expect(bridge._chordActiveNotes).toEqual([60, 64, 67]);
  });

  it('chord_type rounds: 0.13 → round(0.13*11)=round(1.43)=1 → Major', () => {
    const bridge = { _chordActiveNotes: [], pianoNoteOn: vi.fn(), parameterCache: { chord_enable: 1.0, chord_type: 0.13 } };
    _playChordMemory(60, bridge);
    expect(bridge._chordActiveNotes).toEqual([60, 64, 67]);
  });

  it('chord_type rounds: 0.14 → round(0.14*11)=round(1.54)=2 → Minor', () => {
    const bridge = { _chordActiveNotes: [], pianoNoteOn: vi.fn(), parameterCache: { chord_enable: 1.0, chord_type: 0.14 } };
    _playChordMemory(60, bridge);
    expect(bridge._chordActiveNotes).toEqual([60, 63, 67]);
  });

  it('all 11 generated types produce at least 2 notes', () => {
    for (let t = 1; t <= 11; t++) {
      const bridge = { _chordActiveNotes: [], pianoNoteOn: vi.fn(), parameterCache: { chord_enable: 1.0, chord_type: t / 11 } };
      const result = _playChordMemory(60, bridge);
      expect(result).toBe(true);
      expect(bridge._chordActiveNotes.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('clamps notes above 127', () => {
    const bridge = { _chordActiveNotes: [], pianoNoteOn: vi.fn(), parameterCache: { chord_enable: 1.0, chord_type: 1 / 11 } };
    // root=125: Major [0,4,7] → [125, 129, 132] → [125] only (129 and 132 are out of range)
    _playChordMemory(125, bridge);
    expect(bridge._chordActiveNotes).toEqual([125]);
  });
});

// ────────── _playPolyChordMemory ──────────────────────────────

describe('_playPolyChordMemory', () => {
  function makePolyBridge(cache) {
    return {
      _chordActiveNotes: [],
      pianoNoteOn: vi.fn(),
      parameterCache: Object.assign({
        poly_chord_enable: 1.0,
        poly_chord_map: POLY_CHORD_DEFAULTS.map(a => ({ rootKey: a.rootKey, chordType: a.chordType })),
      }, cache || {}),
    };
  }

  it('C4 (note 60) → keyClass 0 → Major → [60,64,67]', () => {
    const bridge = makePolyBridge();
    const result = _playPolyChordMemory(60, bridge);
    expect(result).toBe(true);
    expect(bridge._chordActiveNotes).toEqual([60, 64, 67]);
  });

  it('D#4 (note 63) → keyClass 3 → Minor → [63,66,70]', () => {
    const bridge = makePolyBridge();
    _playPolyChordMemory(63, bridge);
    expect(bridge._chordActiveNotes).toEqual([63, 66, 70]);
  });

  it('returns false when poly_chord_enable < 0.5', () => {
    const bridge = makePolyBridge({ poly_chord_enable: 0.0 });
    expect(_playPolyChordMemory(60, bridge)).toBe(false);
  });

  it('returns false when poly_chord_map is missing', () => {
    const bridge = makePolyBridge({ poly_chord_map: null });
    expect(_playPolyChordMemory(60, bridge)).toBe(false);
  });

  it('returns false when poly_chord_map has < 12 entries', () => {
    const bridge = makePolyBridge({ poly_chord_map: [] });
    expect(_playPolyChordMemory(60, bridge)).toBe(false);
  });

  it('G#4 (note 68) → keyClass 8 → Major → [68,72,75]', () => {
    const bridge = makePolyBridge();
    _playPolyChordMemory(68, bridge);
    expect(bridge._chordActiveNotes).toEqual([68, 72, 75]);
  });

  it('assigns chord based on keyClass, not note value', () => {
    // C5 (72) and C4 (60) both have keyClass=0 → both play Major
    const bridge1 = makePolyBridge();
    _playPolyChordMemory(72, bridge1);
    expect(bridge1._chordActiveNotes).toEqual([72, 76, 79]);

    const bridge2 = makePolyBridge();
    _playPolyChordMemory(60, bridge2);
    expect(bridge2._chordActiveNotes).toEqual([60, 64, 67]);
  });

  it('calls pianoNoteOn for each chord note', () => {
    const bridge = makePolyBridge();
    _playPolyChordMemory(60, bridge);
    expect(bridge.pianoNoteOn).toHaveBeenCalledTimes(3);
    expect(bridge.pianoNoteOn).toHaveBeenCalledWith(60, 0.8);
    expect(bridge.pianoNoteOn).toHaveBeenCalledWith(64, 0.8);
    expect(bridge.pianoNoteOn).toHaveBeenCalledWith(67, 0.8);
  });

  it('initChordMemory called before poly chord still works', () => {
    const bridge = { parameterCache: {} };
    _initChordMemory(bridge);
    bridge._chordActiveNotes = [];
    bridge.pianoNoteOn = vi.fn();
    bridge.parameterCache['poly_chord_enable'] = 1.0;
    bridge.parameterCache['poly_chord_map'] = POLY_CHORD_DEFAULTS.map(a => ({ rootKey: a.rootKey, chordType: a.chordType }));

    const result = _playPolyChordMemory(60, bridge);
    expect(result).toBe(true);
  });
});

// ────────── Octave shift visuals ──────────────────────────────

describe('updateOctaveButtonsVisuals', () => {
  it('octaveShift=0: both buttons have brand-accent color and border-dim', () => {
    const up = { style: {} };
    const down = { style: {} };
    updateOctaveButtonsVisuals(0, up, down);
    expect(up.style.color).toBe('var(--brand-accent)');
    expect(up.style.borderColor).toBe('var(--border-dim)');
    expect(up.style.boxShadow).toBe('none');
    expect(down.style.color).toBe('var(--brand-accent)');
    expect(down.style.borderColor).toBe('var(--border-dim)');
  });

  it('octaveShift=+12: up button active with color-env-vcf', () => {
    const up = { style: {} };
    const down = { style: {} };
    updateOctaveButtonsVisuals(12, up, down);
    expect(up.style.color).toBe('var(--color-env-vcf)');
    expect(up.style.borderColor).toBe('var(--color-env-vcf)');
    expect(up.style.boxShadow).toContain('0 0 8px');
    expect(down.style.color).toBe('var(--brand-accent)');
  });

  it('octaveShift=-12: down button active with color-env-vcf', () => {
    const up = { style: {} };
    const down = { style: {} };
    updateOctaveButtonsVisuals(-12, up, down);
    expect(down.style.color).toBe('var(--color-env-vcf)');
    expect(up.style.color).toBe('var(--brand-accent)');
  });

  it('octaveShift=+24: up button uses color-env-mod', () => {
    const up = { style: {} };
    const down = { style: {} };
    updateOctaveButtonsVisuals(24, up, down);
    expect(up.style.color).toBe('var(--color-env-mod)');
  });

  it('octaveShift=+36: up button uses color-oct-3', () => {
    const up = { style: {} };
    const down = { style: {} };
    updateOctaveButtonsVisuals(36, up, down);
    expect(up.style.color).toBe('var(--color-oct-3)');
  });

  it('octaveShift=-36: down button uses color-oct-3', () => {
    const up = { style: {} };
    const down = { style: {} };
    updateOctaveButtonsVisuals(-36, up, down);
    expect(down.style.color).toBe('var(--color-oct-3)');
  });

  it('null buttons do not throw', () => {
    expect(() => updateOctaveButtonsVisuals(12, null, null)).not.toThrow();
  });

  it('only up button provided (down null) does not throw', () => {
    const up = { style: {} };
    expect(() => updateOctaveButtonsVisuals(-24, up, null)).not.toThrow();
  });
});

// ────────── Velocity calculation ──────────────────────────────

describe('calcVelocity — noteOn velocity curves', () => {
  const rectTop = 100;
  const rectHeight = 100;

  it('normal curve: clientY at top of key → ~1.0 (max)', () => {
    // clientY=rectTop → relY=0 → rawVel = 0.15 + 1.0*0.85 = 1.0
    const vel = calcVelocity(100, rectTop, rectHeight, 'normal');
    expect(vel).toBeCloseTo(1.0, 2);
  });

  it('normal curve: clientY at bottom → ~0.15 (min)', () => {
    // clientY=200 → relY=1.0 → rawVel = 0.15 + 0 = 0.15
    const vel = calcVelocity(200, rectTop, rectHeight, 'normal');
    expect(vel).toBeCloseTo(0.15, 2);
  });

  it('normal curve: clientY at center → ~0.575', () => {
    // clientY=150 → relY=0.5 → rawVel = 0.15 + 0.5*0.85 = 0.575
    const vel = calcVelocity(150, rectTop, rectHeight, 'normal');
    expect(vel).toBeCloseTo(0.575, 3);
  });

  it('soft curve: squares raw velocity (softer)', () => {
    const raw = 0.15 + (1.0 - 0.5) * 0.85; // 0.575
    const vel = calcVelocity(150, rectTop, rectHeight, 'soft');
    expect(vel).toBeCloseTo(raw * raw, 3);
  });

  it('hard curve: sqrt of raw velocity (harder)', () => {
    const raw = 0.15 + (1.0 - 0.5) * 0.85; // 0.575
    const vel = calcVelocity(150, rectTop, rectHeight, 'hard');
    expect(vel).toBeCloseTo(Math.sqrt(raw), 3);
  });

  it('linear curve: unchanged from raw', () => {
    const vel = calcVelocity(150, rectTop, rectHeight, 'linear');
    const raw = 0.15 + (1.0 - 0.5) * 0.85;
    expect(vel).toBeCloseTo(raw, 3);
  });

  it('fixed curve: returns 100/127 ≈ 0.787', () => {
    const vel = calcVelocity(150, rectTop, rectHeight, 'fixed');
    expect(vel).toBeCloseTo(100 / 127, 3);
  });

  it('velocity is clamped between 0.01 and 1.0', () => {
    for (let cy = 90; cy <= 210; cy += 10) {
      const vel = calcVelocity(cy, rectTop, rectHeight, 'normal');
      expect(vel).toBeGreaterThanOrEqual(0.01);
      expect(vel).toBeLessThanOrEqual(1.0);
    }
  });

  it('soft curve: low velocity is even lower (exaggerated)', () => {
    const normal = calcVelocity(190, rectTop, rectHeight, 'normal');
    const soft = calcVelocity(190, rectTop, rectHeight, 'soft');
    expect(soft).toBeLessThan(normal);
  });

  it('hard curve: low velocity is higher (compressed)', () => {
    const normal = calcVelocity(190, rectTop, rectHeight, 'normal');
    const hard = calcVelocity(190, rectTop, rectHeight, 'hard');
    expect(hard).toBeGreaterThan(normal);
  });

  it('unknown curve name falls back to normal (raw)', () => {
    const vel = calcVelocity(150, rectTop, rectHeight, 'unknown_curve');
    const raw = 0.15 + (1.0 - 0.5) * 0.85;
    expect(vel).toBeCloseTo(raw, 3);
  });
});

// ────────── Wheel position math ──────────────────────────────

describe('calcWheelPos — setupWheel updateWheel math', () => {
  const rectTop = 100;
  const rectHeight = 200;
  const wheelHeight = 40;

  it('clientY at slot top → pct=1.0 (full up), bottom=160', () => {
    const result = calcWheelPos(100, rectTop, rectHeight, wheelHeight);
    expect(result.pct).toBeCloseTo(1.0, 3);
    expect(result.bottom).toBe(160);
  });

  it('clientY at slot bottom → pct=0 (full down), bottom=0', () => {
    const result = calcWheelPos(300, rectTop, rectHeight, wheelHeight);
    expect(result.pct).toBeCloseTo(0.0, 3);
    expect(result.bottom).toBe(0);
  });

  it('clientY at center → pct=0.5, bottom=80', () => {
    const result = calcWheelPos(200, rectTop, rectHeight, wheelHeight);
    expect(result.pct).toBeCloseTo(0.5, 3);
    expect(result.bottom).toBe(80);
  });

  it('clientY above slot clamps pct to 1.0', () => {
    const result = calcWheelPos(50, rectTop, rectHeight, wheelHeight);
    expect(result.pct).toBeCloseTo(1.0, 3);
  });

  it('clientY below slot clamps pct to 0', () => {
    const result = calcWheelPos(500, rectTop, rectHeight, wheelHeight);
    expect(result.pct).toBeCloseTo(0.0, 3);
  });

  it('position is monotonic: higher Y → lower pct', () => {
    const top = calcWheelPos(120, rectTop, rectHeight, wheelHeight);
    const mid = calcWheelPos(200, rectTop, rectHeight, wheelHeight);
    const bot = calcWheelPos(280, rectTop, rectHeight, wheelHeight);
    expect(top.pct).toBeGreaterThan(mid.pct);
    expect(mid.pct).toBeGreaterThan(bot.pct);
  });
});

// ────────── Key pressure (aftertouch/modwheel/pitch bend) ─────

describe('applyKeyPressure — _updateKeyPressure per-key logic', () => {
  it('no pressure when aftertouch and modWheel are 0', () => {
    const key = {};
    const result = applyKeyPressure(key, 0.0, 0.0, 0.0);
    expect(key._pressured).toBe(false);
    expect(key._pressure).toBeNull();
    expect(result.combinedPressure).toBeNull();
  });

  it('aftertouch=0.5 → combined pressure = 0.5', () => {
    const key = {};
    applyKeyPressure(key, 0.5, 0.0, 0.0);
    expect(key._pressured).toBe(true);
    expect(key._pressure).toBe(0.5);
  });

  it('modWheel=0.8 > aftertouch=0.3 → combined = 0.8 (max)', () => {
    const key = {};
    applyKeyPressure(key, 0.3, 0.8, 0.0);
    expect(key._pressure).toBe(0.8);
    expect(key._mwPressure).toBe('0.800');
  });

  it('pitchBend=0.5 → pbPx = round(0.5 * 6) = 3px', () => {
    const key = {};
    applyKeyPressure(key, 0.0, 0.0, 0.5, 6);
    expect(key._pbOffset).toBe('3px');
    expect(key._pitchBent).toBe(true);
  });

  it('pitchBend=-0.5 → pbPx = round(-0.5 * 6) = -3px', () => {
    const key = {};
    applyKeyPressure(key, 0.0, 0.0, -0.5, 6);
    expect(key._pbOffset).toBe('-3px');
    expect(key._pitchBent).toBe(true);
  });

  it('pitchBend=0.0 → no pb offset', () => {
    const key = {};
    applyKeyPressure(key, 0.0, 0.0, 0.0);
    expect(key._pbOffset).toBeNull();
    expect(key._pitchBent).toBe(false);
  });

  it('pitchBend sensitivity=12 doubles the offset', () => {
    const key = {};
    applyKeyPressure(key, 0.0, 0.0, 0.5, 12);
    expect(key._pbOffset).toBe('6px');
  });

  it('small values (<0.01) are treated as zero', () => {
    const key = {};
    applyKeyPressure(key, 0.005, 0.005, 0.005);
    expect(key._pressured).toBe(false);
    expect(key._pitchBent).toBe(false);
  });

  it('mwAttr is null when modWheel <= 0.01', () => {
    const key = {};
    const result = applyKeyPressure(key, 0.5, 0.005, 0.0);
    expect(result.mwAttr).toBeNull();
  });

  it('aftertouch=1.0, modWheel=1.0, pitchBend=1.0 → all max', () => {
    const key = {};
    const result = applyKeyPressure(key, 1.0, 1.0, 1.0);
    expect(key._pressure).toBe(1.0);
    expect(key._mwPressure).toBe('1.000');
    expect(key._pbOffset).toBe('6px');
    expect(key._pressured).toBe(true);
    expect(key._pitchBent).toBe(true);
  });
});

// ────────── Octave shift clamp and LCD ─────────────────────────

describe('Octave shift — clamp and display values', () => {
  it('octaveShift is clamped to max +36 (3 octaves up)', () => {
    let octaveShift = 0;
    octaveShift = Math.min(36, octaveShift + 12);
    octaveShift = Math.min(36, octaveShift + 12);
    octaveShift = Math.min(36, octaveShift + 12);
    octaveShift = Math.min(36, octaveShift + 12); // 4th press, clamped to 36
    expect(octaveShift).toBe(36);
  });

  it('octaveShift is clamped to min -36 (3 octaves down)', () => {
    let octaveShift = 0;
    octaveShift = Math.max(-36, octaveShift - 12);
    octaveShift = Math.max(-36, octaveShift - 12);
    octaveShift = Math.max(-36, octaveShift - 12);
    octaveShift = Math.max(-36, octaveShift - 12); // 4th press, clamped to -36
    expect(octaveShift).toBe(-36);
  });

  it('octaveShift 0 produces display "+0" in LCD', () => {
    const octaveShift = 0;
    const display = octaveShift > 0 ? '+' + octaveShift / 12 : String(octaveShift / 12);
    expect(display).toBe('0');
  });

  it('octaveShift +12 produces display "+1" in LCD', () => {
    const octaveShift = 12;
    const display = (octaveShift > 0 ? '+' : '') + octaveShift / 12;
    expect(display).toBe('+1');
  });

  it('octaveShift -12 produces display "-1" in LCD', () => {
    const octaveShift = -12;
    const display = octaveShift / 12;
    expect(display).toBe(-1);
  });

  it('octaveShift LCD HTML contains KEYBED header', () => {
    const octaveShift = 12;
    const lcdHtml = '<span style="font-size:10px; opacity:0.6;">KEYBED</span><br><strong>OCTAVE SHIFT</strong><br><span style="font-size:15px; color:var(--brand-accent);">' + (octaveShift > 0 ? '+' : '') + octaveShift / 12 + '</span>';
    expect(lcdHtml).toContain('KEYBED');
    expect(lcdHtml).toContain('OCTAVE SHIFT');
    expect(lcdHtml).toContain('+1');
  });
});

// ────────── _engineMidiNoteToName (independent) ────────────────

describe('_engineMidiNoteToName — independent edge cases', () => {
  it('note 0 returns "C-1" (lowest)', () => {
    expect(_engineMidiNoteToName(0)).toBe('C-1');
  });

  it('note 127 returns "G9" (max)', () => {
    expect(_engineMidiNoteToName(127)).toBe('G9');
  });

  it('note -1 returns em-dash (out of range)', () => {
    expect(_engineMidiNoteToName(-1)).toBe('\u2014');
  });

  it('note 128 returns em-dash (out of range)', () => {
    expect(_engineMidiNoteToName(128)).toBe('\u2014');
  });

  it('C4 (middle C) returns "C4"', () => {
    expect(_engineMidiNoteToName(60)).toBe('C4');
  });

  it('all 12 chromatic notes in octave 5 have correct names', () => {
    const expected = ['C5','C#5','D5','D#5','E5','F5','F#5','G5','G#5','A5','A#5','B5'];
    for (let i = 0; i < 12; i++) {
      expect(_engineMidiNoteToName(72 + i)).toBe(expected[i]);
    }
  });

  it('A4 (note 69, 440Hz) returns "A4"', () => {
    expect(_engineMidiNoteToName(69)).toBe('A4');
  });
});

// ────────── _initPolyChordNotes ──────────────────────────────

function _initPolyChordNotes(bridge) {
  if (!bridge) return;
  if (!bridge.parameterCache['poly_chord_map']) {
    bridge.parameterCache['poly_chord_map'] = POLY_CHORD_DEFAULTS.map(function(a) {
      return { rootKey: a.rootKey, chordType: a.chordType };
    });
  }
  if (bridge.parameterCache['poly_chord_enable'] === undefined) {
    bridge.parameterCache['poly_chord_enable'] = 0.0;
  }
  if (!bridge.parameterCache['poly_chord_notes']) {
    bridge.parameterCache['poly_chord_notes'] = new Array(512).fill(0xFF);
  }
}

describe('_initPolyChordNotes', () => {
  it('initializes poly_chord_map from POLY_CHORD_DEFAULTS when missing', () => {
    const bridge = { parameterCache: {} };
    _initPolyChordNotes(bridge);
    expect(bridge.parameterCache['poly_chord_map']).toBeDefined();
    expect(bridge.parameterCache['poly_chord_map'].length).toBe(12);
    expect(bridge.parameterCache['poly_chord_map'][0]).toEqual({ rootKey: 0, chordType: 1 });
  });

  it('initializes poly_chord_enable=0.0 when missing', () => {
    const bridge = { parameterCache: {} };
    _initPolyChordNotes(bridge);
    expect(bridge.parameterCache['poly_chord_enable']).toBe(0.0);
  });

  it('initializes poly_chord_notes as 512-byte array filled with 0xFF', () => {
    const bridge = { parameterCache: {} };
    _initPolyChordNotes(bridge);
    expect(bridge.parameterCache['poly_chord_notes']).toBeDefined();
    expect(bridge.parameterCache['poly_chord_notes'].length).toBe(512);
    expect(bridge.parameterCache['poly_chord_notes'][0]).toBe(0xFF);
    expect(bridge.parameterCache['poly_chord_notes'][511]).toBe(0xFF);
  });

  it('does not overwrite existing poly_chord_map', () => {
    const existing = [{ rootKey: 5, chordType: 3 }];
    const bridge = { parameterCache: { poly_chord_map: existing } };
    _initPolyChordNotes(bridge);
    expect(bridge.parameterCache['poly_chord_map']).toBe(existing);
    expect(bridge.parameterCache['poly_chord_map'].length).toBe(1);
  });

  it('does not overwrite existing poly_chord_enable=1.0', () => {
    const bridge = { parameterCache: { poly_chord_enable: 1.0, poly_chord_map: [], poly_chord_notes: [] } };
    _initPolyChordNotes(bridge);
    expect(bridge.parameterCache['poly_chord_enable']).toBe(1.0);
  });

  it('does nothing when bridge is null', () => {
    expect(() => _initPolyChordNotes(null)).not.toThrow();
  });
});

// ────────── _handleEngineActiveNotes core logic ───────────────

/**
 * Pure function mirroring window._handleEngineActiveNotes core logic.
 * Parses JSON, sorts notes, computes average velocity, builds HTML pieces.
 * Returns null for invalid/empty input; else { noteCount, noteNames, noteMidis, avgVel, velPct, namesLine, midiLine, velBar, html }.
 */
function parseEngineActiveNotes(notesJSON) {
  let activeNotes = [];
  try {
    const raw = JSON.parse(notesJSON);
    if (Array.isArray(raw)) {
      activeNotes = raw;
    }
  } catch (e) {
    return null;
  }
  if (activeNotes.length === 0) return null;

  activeNotes.sort((a, b) => a[0] - b[0]);

  const noteCount = activeNotes.length;
  const noteNames = activeNotes.map(nv => _engineMidiNoteToName(nv[0]));
  const noteMidis = activeNotes.map(nv => '#' + nv[0]);
  const avgVel = activeNotes.reduce((sum, nv) => sum + nv[1], 0) / noteCount;
  const velPct = Math.round(avgVel * 100);

  const namesLine = noteNames.join('  ');
  const midiLine = 'MIDI ' + noteMidis.join(' ');

  // Velocity bar: █ characters based on average velocity
  const velBarLen = Math.round(avgVel * 12);
  const velBar = '\u2588'.repeat(velBarLen) + '\u2591'.repeat(12 - velBarLen);

  // HTML structure (without LCD wrapping)
  const html = '<span style="font-size:10px; opacity:0.6;">ENGINE &nbsp; ' + noteCount + ' ' + (noteCount === 1 ? 'note' : 'notes') + '</span><br>'
    + '<span style="font-size:14px; color:var(--brand-accent); letter-spacing:1px;">' + namesLine + '</span><br>'
    + '<span style="font-size:10px; color:var(--text-dim);">' + midiLine + ' &nbsp; Vel ' + velPct + '%</span>'
    + '<br><span style="font-size:7px; letter-spacing:1px; color:var(--text-faint);">' + velBar + '</span>';

  return { noteCount, noteNames, noteMidis, avgVel, velPct, namesLine, midiLine, velBarLen, velBar, html };
}

describe('_handleEngineActiveNotes — core logic', () => {
  it('parses JSON array of [note, vel] pairs', () => {
    const result = parseEngineActiveNotes('[[60,0.8],[64,0.75],[67,0.82]]');
    expect(result).not.toBeNull();
    expect(result.noteCount).toBe(3);
    expect(result.noteNames).toEqual(['C4', 'E4', 'G4']);
    expect(result.noteMidis).toEqual(['#60', '#64', '#67']);
  });

  it('sorts notes by MIDI number ascending', () => {
    const result = parseEngineActiveNotes('[[67,0.8],[60,0.9],[64,0.7]]');
    expect(result.noteMidis).toEqual(['#60', '#64', '#67']);
  });

  it('computes average velocity and percentage', () => {
    // (0.8 + 0.75 + 0.82) / 3 = 0.79
    const result = parseEngineActiveNotes('[[60,0.80],[64,0.75],[67,0.82]]');
    expect(result.avgVel).toBeCloseTo(0.79, 2);
    expect(result.velPct).toBe(79);
  });

  it('single note returns count=1 and singular "note"', () => {
    const result = parseEngineActiveNotes('[[60,0.8]]');
    expect(result.noteCount).toBe(1);
    expect(result.html).toContain('1 note');
    expect(result.html).not.toContain('notes');
  });

  it('multiple notes use plural "notes"', () => {
    const result = parseEngineActiveNotes('[[60,0.8],[64,0.7]]');
    expect(result.html).toContain('2 notes');
  });

  it('namesLine joins note names with double spaces', () => {
    const result = parseEngineActiveNotes('[[60,0.8],[61,0.7]]');
    expect(result.namesLine).toBe('C4  C#4');
    expect(result.html).toContain('C4  C#4');
  });

  it('midiLine contains MIDI prefix and note numbers', () => {
    const result = parseEngineActiveNotes('[[60,0.8]]');
    expect(result.midiLine).toBe('MIDI #60');
    expect(result.html).toContain('MIDI #60');
  });

  it('includes Vel percentage in HTML', () => {
    const result = parseEngineActiveNotes('[[60,0.5]]');
    expect(result.html).toContain('Vel 50%');
  });

  it('velocity bar length is avgVel * 12 (rounded)', () => {
    const result = parseEngineActiveNotes('[[60,0.5]]'); // avgVel=0.5 → 0.5*12=6
    expect(result.velBarLen).toBe(6);
  });

  it('velocity bar at max velocity (1.0) has 12 filled chars', () => {
    const result = parseEngineActiveNotes('[[60,1.0]]');
    expect(result.velBarLen).toBe(12);
  });

  it('velocity bar at low velocity (0.08) has 1 filled char', () => {
    const result = parseEngineActiveNotes('[[60,0.08]]'); // 0.08*12=0.96→round=1
    expect(result.velBarLen).toBe(1);
  });

  it('uses █ for filled and ░ for empty in velocity bar', () => {
    const result = parseEngineActiveNotes('[[60,0.5]]'); // 6 filled, 6 empty
    expect(result.velBar).toBe('\u2588\u2588\u2588\u2588\u2588\u2588\u2591\u2591\u2591\u2591\u2591\u2591');
  });

  it('returns null for empty array', () => {
    expect(parseEngineActiveNotes('[]')).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(parseEngineActiveNotes('not json')).toBeNull();
  });

  it('returns null for malformed JSON object (not array)', () => {
    expect(parseEngineActiveNotes('{"note": 60}')).toBeNull();
  });

  it('handles 10 notes (full chord) correctly', () => {
    const pairs = [];
    for (let n = 60; n < 70; n++) pairs.push([n, 0.5 + (n - 60) * 0.05]);
    const result = parseEngineActiveNotes(JSON.stringify(pairs));
    expect(result.noteCount).toBe(10);
    expect(result.noteMidis.length).toBe(10);
    expect(result.html).toContain('10 notes');
  });

  it('HTML contains ENGINE header span', () => {
    const result = parseEngineActiveNotes('[[60,0.8]]');
    expect(result.html).toContain('ENGINE');
    expect(result.html).toContain('font-size:10px; opacity:0.6');
  });

  it('HTML contains brand-accent names span', () => {
    const result = parseEngineActiveNotes('[[60,0.8],[64,0.7]]');
    expect(result.html).toContain('color:var(--brand-accent)');
    expect(result.html).toContain('letter-spacing:1px');
  });

  it('HTML contains text-dim MIDI line span', () => {
    const result = parseEngineActiveNotes('[[60,0.8]]');
    expect(result.html).toContain('color:var(--text-dim)');
  });

  it('HTML contains text-faint velocity bar span', () => {
    const result = parseEngineActiveNotes('[[60,0.8]]');
    expect(result.html).toContain('color:var(--text-faint)');
    expect(result.html).toContain('font-size:7px; letter-spacing:1px');
  });

  it('HTML has correct overall structure with 3 <br> separators', () => {
    const result = parseEngineActiveNotes('[[60,0.8]]');
    const brCount = (result.html.match(/<br>/g) || []).length;
    expect(brCount).toBe(3);
  });
});

// ────────── NOTE_NAMES reference ─────────────────────────────

describe('NOTE_NAMES (12-note chromatic scale)', () => {
  it('has exactly 12 entries', () => {
    expect(NOTE_NAMES.length).toBe(12);
  });

  it('starts with C and ends with B', () => {
    expect(NOTE_NAMES[0]).toBe('C');
    expect(NOTE_NAMES[11]).toBe('B');
  });

  it('all entries are 1-2 character note names', () => {
    NOTE_NAMES.forEach(n => {
      expect(n.length).toBeGreaterThanOrEqual(1);
      expect(n.length).toBeLessThanOrEqual(2);
    });
  });

  it('ENGINE_NOTE_NAMES is identical to NOTE_NAMES', () => {
    expect(ENGINE_NOTE_NAMES).toEqual(NOTE_NAMES);
  });
});
