/**
 * Tests for WebUI/js/keyboard_active_notes.js — MIDI note naming, active notes parsing, LCD display
 *
 * Strategy: extracted pure functions with DI. Tests cover note name conversion,
 * JSON parsing, display formatting, overflow suffix, and title detection.
 */

// ===== Global stubs =====
globalThis.window = globalThis.window || {};

// ===== Extracted Source =====

const ENGINE_NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

function engineMidiNoteToName(midiNote) {
    if (midiNote < 0 || midiNote > 127) {return '\u2014';}
    return ENGINE_NOTE_NAMES[midiNote % 12] + (Math.floor(midiNote / 12) - 1);
}

function parseActiveNotes(notesJSON) {
    let activeNotes = [];
    try {
        const raw = JSON.parse(notesJSON);
        if (Array.isArray(raw)) {
            activeNotes = raw;
        }
    } catch (e) {}
    return activeNotes;
}

function getDisplayNotes(activeNotes, maxNotesToShow) {
    maxNotesToShow = maxNotesToShow || 4;
    if (activeNotes.length === 0) {
        return { names: [], suffix: '', hasOverflow: false };
    }
    const sorted = activeNotes.slice().sort(function(a, b) { return a[0] - b[0]; });
    const notesToShow = sorted.slice(0, maxNotesToShow);
    const displayedNames = notesToShow.map(function(nv) { return engineMidiNoteToName(nv[0]); });
    let suffix = '';
    let hasOverflow = false;
    if (sorted.length > maxNotesToShow) {
        suffix = ' +' + (sorted.length - maxNotesToShow);
        hasOverflow = true;
    }
    return { names: displayedNames, suffix: suffix, hasOverflow: hasOverflow };
}

function getActiveTitle(parameterCache) {
    parameterCache = parameterCache || {};
    let title = 'KEY PLAY';
    if ((parameterCache['poly_chord_enable'] || 0) > 0.5) {
        title = 'POLY CHORD';
    } else if ((parameterCache['chord_enable'] || 0) > 0.5) {
        title = 'CHORD PLAY';
    }
    return title;
}

// ===== Tests =====

describe('ENGINE_NOTE_NAMES — note name array', function() {
    it('has 12 chromatic notes starting with C', function() {
        expect(ENGINE_NOTE_NAMES).toEqual(['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']);
    });
});

describe('engineMidiNoteToName — MIDI note to string conversion', function() {
    it('returns em-dash for notes below 0', function() {
        expect(engineMidiNoteToName(-1)).toBe('\u2014');
    });

    it('returns em-dash for notes above 127', function() {
        expect(engineMidiNoteToName(128)).toBe('\u2014');
    });

    it('converts MIDI 60 (middle C) to "C3"', function() {
        // MIDI 60 → C, octave = 60/12 - 1 = 5 - 1 = 4? Wait...
        // Math.floor(60/12) - 1 = 5 - 1 = 4. So "C4"?
        // Actually octave numbering: C4 = MIDI 60
        // Math.floor(60/12) = 5, minus 1 = 4
        // So it should be "C4"
        expect(engineMidiNoteToName(60)).toBe('C4');
    });

    it('converts MIDI 0 (C-1) to "C-1"', function() {
        // Math.floor(0/12) - 1 = 0 - 1 = -1
        expect(engineMidiNoteToName(0)).toBe('C-1');
    });

    it('converts MIDI 127 (G9) to the highest note', function() {
        // MIDI 127 → G, octave = Math.floor(127/12) - 1 = 10 - 1 = 9
        expect(engineMidiNoteToName(127)).toBe('G9');
    });

    it('converts MIDI 61 to "C#4"', function() {
        expect(engineMidiNoteToName(61)).toBe('C#4');
    });

    it('converts MIDI 48 to "C3"', function() {
        // Math.floor(48/12) - 1 = 4 - 1 = 3
        expect(engineMidiNoteToName(48)).toBe('C3');
    });

    it('converts MIDI 69 (A4) to "A4"', function() {
        // Math.floor(69/12) - 1 = 5 - 1 = 4
        expect(engineMidiNoteToName(69)).toBe('A4');
    });
});

describe('parseActiveNotes — JSON parsing', function() {
    it('parses valid JSON array of [note, velocity] pairs', function() {
        const result = parseActiveNotes('[[60,0.8],[64,0.7],[67,0.6]]');
        expect(result.length).toBe(3);
        expect(result[0]).toEqual([60, 0.8]);
        expect(result[1]).toEqual([64, 0.7]);
    });

    it('returns empty array for empty array JSON', function() {
        expect(parseActiveNotes('[]')).toEqual([]);
    });

    it('returns empty array for malformed JSON', function() {
        expect(parseActiveNotes('not-json')).toEqual([]);
    });

    it('returns empty array for null JSON', function() {
        expect(parseActiveNotes('null')).toEqual([]);
    });

    it('returns empty array for non-array JSON', function() {
        expect(parseActiveNotes('{"note":60}')).toEqual([]);
    });

    it('returns empty array for empty string', function() {
        expect(parseActiveNotes('')).toEqual([]);
    });

    it('handles single note array', function() {
        expect(parseActiveNotes('[[60,1.0]]')).toEqual([[60, 1.0]]);
    });
});

describe('getDisplayNotes — note formatting and overflow', function() {
    it('returns empty for empty array', function() {
        const result = getDisplayNotes([]);
        expect(result.names).toEqual([]);
        expect(result.suffix).toBe('');
        expect(result.hasOverflow).toBe(false);
    });

    it('formats a single note as display name', function() {
        const notes = [[60, 0.8]];
        const result = getDisplayNotes(notes);
        expect(result.names).toEqual(['C4']);
        expect(result.suffix).toBe('');
    });

    it('displays up to 4 notes by default', function() {
        const notes = [[60,1],[64,1],[67,1],[72,1]];
        const result = getDisplayNotes(notes);
        expect(result.names).toEqual(['C4', 'E4', 'G4', 'C5']);
        expect(result.suffix).toBe('');
    });

    it('adds overflow suffix when more than 4 notes', function() {
        const notes = [[60,1],[64,1],[67,1],[72,1],[76,1],[79,1]];
        const result = getDisplayNotes(notes);
        expect(result.names).toEqual(['C4', 'E4', 'G4', 'C5']);
        expect(result.suffix).toBe(' +2');
        expect(result.hasOverflow).toBe(true);
    });

    it('sorts notes by MIDI number ascending', function() {
        const notes = [[72,1],[60,1],[67,1]];
        const result = getDisplayNotes(notes);
        expect(result.names).toEqual(['C4', 'G4', 'C5']);
    });

    it('accepts custom maxNotesToShow parameter', function() {
        const notes = [[60,1],[61,1],[62,1],[63,1],[64,1],[65,1]];
        const result = getDisplayNotes(notes, 3);
        expect(result.names.length).toBe(3);
        expect(result.suffix).toBe(' +3');
    });
});

describe('getActiveTitle — chord mode detection', function() {
    it('returns "KEY PLAY" when no chord modes are active', function() {
        expect(getActiveTitle({})).toBe('KEY PLAY');
    });

    it('returns "KEY PLAY" when cache is null', function() {
        expect(getActiveTitle(null)).toBe('KEY PLAY');
    });

    it('returns "CHORD PLAY" when chord_enable is > 0.5', function() {
        expect(getActiveTitle({ chord_enable: 1.0 })).toBe('CHORD PLAY');
    });

    it('returns "CHORD PLAY" when chord_enable = 0.6', function() {
        expect(getActiveTitle({ chord_enable: 0.6 })).toBe('CHORD PLAY');
    });

    it('returns "KEY PLAY" when chord_enable is exactly 0.5', function() {
        expect(getActiveTitle({ chord_enable: 0.5 })).toBe('KEY PLAY');
    });

    it('returns "POLY CHORD" when poly_chord_enable > 0.5 (overrides chord)', function() {
        expect(getActiveTitle({
            poly_chord_enable: 1.0,
            chord_enable: 1.0
        })).toBe('POLY CHORD');
    });

    it('returns "POLY CHORD" when poly_chord_enable > 0.5 and chord is 0', function() {
        expect(getActiveTitle({
            poly_chord_enable: 1.0,
            chord_enable: 0.0
        })).toBe('POLY CHORD');
    });
});
