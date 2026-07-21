/**
 * Tests for WebUI/js/keyboard_poly_chord.js — Poly Chord Engine with per-key assignments
 *
 * Strategy: extracted functions with DI, CHORD_INTERVALS reused from chord_memory tests.
 */

// ===== Global stubs =====
globalThis.window = globalThis.window || {};

// ===== CHORD_INTERVALS (shared with chord_memory.js) =====
const CHORD_INTERVALS = {
    0: null,            // Memory
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
    11: [0, 4, 7, 10]   // 7th
};
window.CHORD_INTERVALS = CHORD_INTERVALS;

// ===== Extracted Source =====

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
    { rootKey: 11, chordType: 2 }  // B  → Minor
];

const CHORD_TYPE_NAMES = ['Memory', 'Major', 'Minor', 'Major 7th', 'Minor 7th', 'Dom 7th', 'Susp 4th', 'Power Chd', 'Augmented', 'Diminished', 'Sus2', '7th'];

const NOTE_NAMES_SHORT = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

function initPolyChordNotes(bridge) {
    if (!bridge) {return;}

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

function playPolyChordMemory(rootNote, velocity, bridge, intervals) {
    intervals = intervals || CHORD_INTERVALS;
    if (!bridge) {return false;}

    const polyChordEn = bridge.parameterCache['poly_chord_enable'] || 0.0;
    if (polyChordEn < 0.5) {return false;}

    const polyMap = bridge.parameterCache['poly_chord_map'];
    if (!polyMap || polyMap.length < 12) {return false;}

    const keyClass = ((rootNote % 12) + 12) % 12; // Handle negative rootNote
    let assignment = polyMap[keyClass];
    if (!assignment) {
        assignment = POLY_CHORD_DEFAULTS[keyClass];
    }

    let chordType = assignment.chordType;
    if (chordType === undefined) {chordType = 1;}

    if (!bridge._chordActiveNotes) {bridge._chordActiveNotes = [];}

    const notesToPlay = [];

    if (chordType === 0) {
        const captured = bridge.parameterCache['chord_notes'];
        if (!captured || captured.length === 0) {return false;}

        const baseNote = captured[0];
        const interval = rootNote - baseNote;

        captured.forEach(function(note) {
            const shiftedNote = note + interval;
            if (shiftedNote >= 0 && shiftedNote <= 127) {
                notesToPlay.push(shiftedNote);
            }
        });
    } else {
        const ivs = intervals[chordType];
        if (!ivs) {return false;}

        ivs.forEach(function(iv) {
            const note = rootNote + iv;
            if (note >= 0 && note <= 127) {
                notesToPlay.push(note);
            }
        });
    }

    if (notesToPlay.length === 0) {return false;}

    notesToPlay.forEach(function(note) {
        bridge._chordActiveNotes.push(note);
        if (typeof bridge.pianoNoteOn === 'function') {
            bridge.pianoNoteOn(note, velocity);
        }
    });

    return true;
}

function stopPolyChordMemory(rootNote, bridge) {
    if (!bridge || !bridge._chordActiveNotes) {return;}

    const polyChordEn = bridge.parameterCache['poly_chord_enable'] || 0.0;
    if (polyChordEn < 0.5) {return;}

    const polyMap = bridge.parameterCache['poly_chord_map'];
    if (!polyMap || polyMap.length < 12) {return;}

    const keyClass = rootNote % 12;
    let assignment = polyMap[keyClass];
    if (!assignment) {
        assignment = POLY_CHORD_DEFAULTS[keyClass];
    }

    let chordType = assignment.chordType;
    if (chordType === undefined) {chordType = 1;}

    const notesToStop = [];

    if (chordType === 0) {
        const captured = bridge.parameterCache['chord_notes'];
        if (!captured || captured.length === 0) {return;}

        const baseNote = captured[0];
        const interval = rootNote - baseNote;

        captured.forEach(function(note) {
            const shiftedNote = note + interval;
            if (shiftedNote >= 0 && shiftedNote <= 127) {
                notesToStop.push(shiftedNote);
            }
        });
    } else {
        const intervals = CHORD_INTERVALS[chordType];
        if (!intervals) {return;}

        intervals.forEach(function(interval) {
            const note = rootNote + interval;
            if (note >= 0 && note <= 127) {
                notesToStop.push(note);
            }
        });
    }

    notesToStop.forEach(function(note) {
        const idx = bridge._chordActiveNotes.indexOf(note);
        if (idx >= 0) {
            bridge._chordActiveNotes.splice(idx, 1);
            if (typeof bridge.pianoNoteOff === 'function') {
                bridge.pianoNoteOff(note);
            }
        }
    });
}

// ===== Tests =====

describe('POLY_CHORD_DEFAULTS — per-key assignments', function() {
    it('has 12 entries (one per key class)', function() {
        expect(POLY_CHORD_DEFAULTS.length).toBe(12);
    });

    it('alternates Major (1) and Minor (2) starting with C→Major', function() {
        for (let i = 0; i < 12; i++) {
            expect(POLY_CHORD_DEFAULTS[i].rootKey).toBe(i);
            if (i % 2 === 0) {
                expect(POLY_CHORD_DEFAULTS[i].chordType).toBe(1); // Even → Major
            } else {
                expect(POLY_CHORD_DEFAULTS[i].chordType).toBe(2); // Odd → Minor
            }
        }
    });

    it('C (key 0) → Major', function() {
        expect(POLY_CHORD_DEFAULTS[0]).toEqual({ rootKey: 0, chordType: 1 });
    });

    it('C# (key 1) → Minor', function() {
        expect(POLY_CHORD_DEFAULTS[1]).toEqual({ rootKey: 1, chordType: 2 });
    });

    it('E (key 4) → Major', function() {
        expect(POLY_CHORD_DEFAULTS[4]).toEqual({ rootKey: 4, chordType: 1 });
    });

    it('G (key 7) → Minor', function() {
        expect(POLY_CHORD_DEFAULTS[7]).toEqual({ rootKey: 7, chordType: 2 });
    });

    it('B (key 11) → Minor', function() {
        expect(POLY_CHORD_DEFAULTS[11]).toEqual({ rootKey: 11, chordType: 2 });
    });
});

describe('CHORD_TYPE_NAMES — display names', function() {
    it('has 12 entries matching CHORD_INTERVALS keys', function() {
        expect(CHORD_TYPE_NAMES.length).toBe(12);
    });

    it('index 0 is "Memory"', function() {
        expect(CHORD_TYPE_NAMES[0]).toBe('Memory');
    });

    it('index 11 is "7th"', function() {
        expect(CHORD_TYPE_NAMES[11]).toBe('7th');
    });
});

describe('NOTE_NAMES_SHORT — note labels', function() {
    it('has 12 entries', function() {
        expect(NOTE_NAMES_SHORT.length).toBe(12);
    });

    it('C is index 0', function() {
        expect(NOTE_NAMES_SHORT[0]).toBe('C');
    });

    it('B is index 11', function() {
        expect(NOTE_NAMES_SHORT[11]).toBe('B');
    });

    it('includes all 12 chromatic notes', function() {
        const expected = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
        expect(NOTE_NAMES_SHORT).toEqual(expected);
    });
});

describe('initPolyChordNotes — parameter initialization', function() {
    let bridge;

    beforeEach(function() {
        bridge = { parameterCache: {} };
    });

    it('does nothing when bridge is null', function() {
        initPolyChordNotes(null);
        // No crash
    });

    it('creates poly_chord_map from defaults', function() {
        initPolyChordNotes(bridge);
        expect(bridge.parameterCache['poly_chord_map']).toBeDefined();
        expect(bridge.parameterCache['poly_chord_map'].length).toBe(12);
        expect(bridge.parameterCache['poly_chord_map'][0]).toEqual({ rootKey: 0, chordType: 1 });
    });

    it('sets poly_chord_enable to 0.0', function() {
        initPolyChordNotes(bridge);
        expect(bridge.parameterCache['poly_chord_enable']).toBe(0.0);
    });

    it('creates poly_chord_notes as 512-byte array of 0xFF', function() {
        initPolyChordNotes(bridge);
        expect(bridge.parameterCache['poly_chord_notes'].length).toBe(512);
        expect(bridge.parameterCache['poly_chord_notes'][0]).toBe(0xFF);
        expect(bridge.parameterCache['poly_chord_notes'][511]).toBe(0xFF);
    });

    it('does not override existing poly_chord_map', function() {
        bridge.parameterCache['poly_chord_map'] = [{ rootKey: 5, chordType: 7 }];
        initPolyChordNotes(bridge);
        expect(bridge.parameterCache['poly_chord_map'].length).toBe(1);
        expect(bridge.parameterCache['poly_chord_map'][0].chordType).toBe(7);
    });

    it('does not override existing poly_chord_enable', function() {
        bridge.parameterCache['poly_chord_enable'] = 0.5;
        initPolyChordNotes(bridge);
        expect(bridge.parameterCache['poly_chord_enable']).toBe(0.5);
    });
});

describe('playPolyChordMemory — chord playback with per-key assignment', function() {
    let bridge, playedNotes;

    function makeBridge(config) {
        config = config || {};
        playedNotes = [];
        return {
            parameterCache: {
                poly_chord_enable: config.enable !== undefined ? config.enable : 1.0,
                poly_chord_map: config.polyMap || POLY_CHORD_DEFAULTS.map(function(a) {
                    return { rootKey: a.rootKey, chordType: a.chordType };
                }),
                chord_notes: config.chordNotes || [60, 64, 67]
            },
            _chordActiveNotes: [],
            pianoNoteOn: function(note, vel) {
                playedNotes.push({ note: note, vel: vel });
            }
        };
    }

    beforeEach(function() {
        playedNotes = [];
    });

    it('returns false when bridge is null', function() {
        expect(playPolyChordMemory(60, 0.8, null)).toBe(false);
    });

    it('returns false when poly_chord_enable is 0', function() {
        bridge = makeBridge({ enable: 0.0 });
        expect(playPolyChordMemory(60, 0.8, bridge)).toBe(false);
    });

    it('returns false when poly_chord_map is missing', function() {
        bridge = makeBridge({});
        delete bridge.parameterCache['poly_chord_map'];
        expect(playPolyChordMemory(60, 0.8, bridge)).toBe(false);
    });

    it('returns false when poly_chord_map has fewer than 12 entries', function() {
        bridge = makeBridge({ polyMap: [{ rootKey: 0, chordType: 1 }] });
        expect(playPolyChordMemory(60, 0.8, bridge)).toBe(false);
    });

    it('C (rootNote=60, keyClass=0) → Major chord: 60, 64, 67', function() {
        bridge = makeBridge({});
        expect(playPolyChordMemory(60, 0.8, bridge)).toBe(true);
        expect(playedNotes.length).toBe(3);
        expect(playedNotes[0].note).toBe(60);
        expect(playedNotes[1].note).toBe(64);
        expect(playedNotes[2].note).toBe(67);
    });

    it('D (rootNote=62, keyClass=2, even→Major) → Major chord', function() {
        bridge = makeBridge({});
        playPolyChordMemory(62, 0.8, bridge);
        expect(playedNotes.length).toBe(3);
        expect(playedNotes[0].note).toBe(62);
        expect(playedNotes[1].note).toBe(66); // 62 + 4
        expect(playedNotes[2].note).toBe(69); // 62 + 7
    });

    it('C# (rootNote=61, keyClass=1, odd→Minor) → Minor chord: 61, 64, 68', function() {
        bridge = makeBridge({});
        playPolyChordMemory(61, 0.8, bridge);
        expect(playedNotes.length).toBe(3);
        expect(playedNotes[0].note).toBe(61);
        expect(playedNotes[1].note).toBe(64); // 61 + 3 (Minor 3rd)
        expect(playedNotes[2].note).toBe(68); // 61 + 7
    });

    it('G (rootNote=67, keyClass=7, odd→Minor) → Minor chord', function() {
        bridge = makeBridge({});
        playPolyChordMemory(67, 0.8, bridge);
        expect(playedNotes.length).toBe(3);
        expect(playedNotes[0].note).toBe(67);
        expect(playedNotes[1].note).toBe(70); // 67 + 3
        expect(playedNotes[2].note).toBe(74); // 67 + 7
    });
});

describe('playPolyChordMemory — custom polyMap overrides', function() {
    let bridge, playedNotes;

    beforeEach(function() {
        playedNotes = [];
    });

    it('uses custom chord type from polyMap', function() {
        // Make C (key 0) use Power chord (type 7)
        const customMap = POLY_CHORD_DEFAULTS.map(function(a) {
            return a.rootKey === 0 ? { rootKey: 0, chordType: 7 } : { rootKey: a.rootKey, chordType: a.chordType };
        });
        bridge = {
            parameterCache: {
                poly_chord_enable: 1.0,
                poly_chord_map: customMap
            },
            _chordActiveNotes: [],
            pianoNoteOn: function(note, vel) { playedNotes.push({ note: note, vel: vel }); }
        };
        playPolyChordMemory(60, 1.0, bridge);
        // Power chord = [0, 7] → notes 60, 67
        expect(playedNotes.length).toBe(2);
        expect(playedNotes[0].note).toBe(60);
        expect(playedNotes[1].note).toBe(67);
    });

    it('assigns chord type per individual key class', function() {
        const map = [];
        for (let i = 0; i < 12; i++) {
            map.push({ rootKey: i, chordType: (i + 3) % 12 }); // Shifted by 3
        }
        bridge = {
            parameterCache: { poly_chord_enable: 1.0, poly_chord_map: map },
            _chordActiveNotes: [],
            pianoNoteOn: function(note, vel) { playedNotes.push({ note: note, vel: vel }); }
        };
        // C (key 0) now uses chordType 3 = Major 7th → 4 notes
        playPolyChordMemory(60, 1.0, bridge);
        expect(playedNotes.length).toBe(4);
    });
});

describe('playPolyChordMemory — keyClass from rootNote % 12', function() {
    let bridge, playedNotes;

    beforeEach(function() {
        playedNotes = [];
        bridge = {
            parameterCache: {
                poly_chord_enable: 1.0,
                poly_chord_map: POLY_CHORD_DEFAULTS.map(function(a) { return { rootKey: a.rootKey, chordType: a.chordType }; })
            },
            _chordActiveNotes: [],
            pianoNoteOn: function(note, vel) { playedNotes.push({ note: note, vel: vel }); }
        };
    });

    it('rootNote 72 (C5) → Major (key 0)', function() {
        playPolyChordMemory(72, 1.0, bridge);
        expect(playedNotes.length).toBe(3);
        expect(playedNotes[0].note).toBe(72);
        expect(playedNotes[1].note).toBe(76);
        expect(playedNotes[2].note).toBe(79);
    });

    it('rootNote 83 (B5, key 11) → Minor', function() {
        playPolyChordMemory(83, 1.0, bridge);
        expect(playedNotes.length).toBe(3);
        expect(playedNotes[0].note).toBe(83);
        expect(playedNotes[1].note).toBe(86); // 83 + 3
        expect(playedNotes[2].note).toBe(90); // 83 + 7
    });

    it('rootNote 48 (C3) → Major', function() {
        playPolyChordMemory(48, 1.0, bridge);
        expect(playedNotes[0].note).toBe(48);
        expect(playedNotes[1].note).toBe(52);
        expect(playedNotes[2].note).toBe(55);
    });
});

describe('playPolyChordMemory — Memory mode (chordType=0)', function() {
    let bridge, playedNotes;

    beforeEach(function() {
        playedNotes = [];
        const polyMap = POLY_CHORD_DEFAULTS.map(function(a) {
            return a.rootKey === 0 ? { rootKey: 0, chordType: 0 } : { rootKey: a.rootKey, chordType: a.chordType };
        });
        bridge = {
            parameterCache: {
                poly_chord_enable: 1.0,
                poly_chord_map: polyMap,
                chord_notes: [60, 64, 67]
            },
            _chordActiveNotes: [],
            pianoNoteOn: function(note, vel) { playedNotes.push({ note: note, vel: vel }); }
        };
    });

    it('C (key 0) uses Memory mode: transposes captured chord', function() {
        playPolyChordMemory(60, 1.0, bridge); // C4 → keyClass 0, interval = 60 - 60 = 0
        expect(playedNotes.length).toBe(3);
        expect(playedNotes[0].note).toBe(60);  // 60 + 0
        expect(playedNotes[1].note).toBe(64);  // 64 + 0
        expect(playedNotes[2].note).toBe(67);  // 67 + 0
    });

    it('returns false in Memory mode when no captured chord_notes', function() {
        bridge.parameterCache['chord_notes'] = [];
        const result = playPolyChordMemory(60, 1.0, bridge);
        expect(result).toBe(false);
    });
});

describe('playPolyChordMemory — edge cases', function() {
    let bridge, playedNotes;

    beforeEach(function() {
        playedNotes = [];
        bridge = {
            parameterCache: {
                poly_chord_enable: 1.0,
                poly_chord_map: POLY_CHORD_DEFAULTS.map(function(a) { return { rootKey: a.rootKey, chordType: a.chordType }; })
            },
            _chordActiveNotes: [],
            pianoNoteOn: function(note, vel) { playedNotes.push({ note: note, vel: vel }); }
        };
    });

    it('clamps notes above 127', function() {
        playPolyChordMemory(125, 1.0, bridge); // Major → 125, 129, 132
        expect(playedNotes.length).toBe(1); // Only 125 stays in range
        expect(playedNotes[0].note).toBe(125);
    });

    it('clamps notes below 0', function() {
        playPolyChordMemory(-3, 1.0, bridge); // keyClass 9 → Minor → intervals [0, 3, 7]
        // Notes: -3+0=-3(skip), -3+3=0, -3+7=4
        expect(playedNotes.length).toBe(2);
        expect(playedNotes[0].note).toBe(0);
        expect(playedNotes[1].note).toBe(4);
    });

    it('passes velocity correctly', function() {
        playPolyChordMemory(60, 0.42, bridge);
        expect(playedNotes[0].vel).toBe(0.42);
    });

    it('tracks active notes in _chordActiveNotes', function() {
        playPolyChordMemory(60, 1.0, bridge);
        expect(bridge._chordActiveNotes).toEqual([60, 64, 67]);
    });

    it('creates _chordActiveNotes if missing', function() {
        delete bridge._chordActiveNotes;
        playPolyChordMemory(60, 1.0, bridge);
        expect(bridge._chordActiveNotes).toEqual([60, 64, 67]);
    });

    it('returns false when all notes out of range', function() {
        const result = playPolyChordMemory(200, 1.0, bridge);
        expect(result).toBe(false);
    });
});

// ===== stopPolyChordMemory tests (Bug 6 fix) =====

describe('stopPolyChordMemory — stops all poly chord notes', function() {
    let bridge, stoppedNotes;

    beforeEach(function() {
        stoppedNotes = [];
        bridge = {
            parameterCache: {
                poly_chord_enable: 1.0,
                poly_chord_map: POLY_CHORD_DEFAULTS.map(function(a) { return { rootKey: a.rootKey, chordType: a.chordType }; })
            },
            _chordActiveNotes: [60, 64, 67],
            pianoNoteOff: function(note) { stoppedNotes.push(note); }
        };
    });

    it('stops C Major chord notes', function() {
        stopPolyChordMemory(60, bridge);
        expect(stoppedNotes.length).toBe(3);
        expect(stoppedNotes).toContain(60);
        expect(stoppedNotes).toContain(64);
        expect(stoppedNotes).toContain(67);
        expect(bridge._chordActiveNotes.length).toBe(0);
    });

    it('stops D Major chord notes (keyClass 2 → Major)', function() {
        bridge._chordActiveNotes = [62, 66, 69]; // D Major (even keyClass → Major default)
        stopPolyChordMemory(62, bridge);
        expect(stoppedNotes.length).toBe(3);
        expect(stoppedNotes).toContain(62);
        expect(stoppedNotes).toContain(66);
        expect(stoppedNotes).toContain(69);
    });

    it('stops notes in Memory mode (chordType 0)', function() {
        const polyMap = POLY_CHORD_DEFAULTS.map(function(a) {
            return a.rootKey === 0 ? { rootKey: 0, chordType: 0 } : { rootKey: a.rootKey, chordType: a.chordType };
        });
        bridge.parameterCache['poly_chord_map'] = polyMap;
        bridge.parameterCache['chord_notes'] = [60, 64, 67]; // C Major captured
        bridge._chordActiveNotes = [60, 64, 67];
        stopPolyChordMemory(60, bridge);
        expect(stoppedNotes.length).toBe(3);
        expect(stoppedNotes).toContain(60);
        expect(stoppedNotes).toContain(64);
        expect(stoppedNotes).toContain(67);
    });

    it('stops notes in Memory mode with transposition', function() {
        const polyMap = POLY_CHORD_DEFAULTS.map(function(a) {
            return a.rootKey === 0 ? { rootKey: 0, chordType: 0 } : { rootKey: a.rootKey, chordType: a.chordType };
        });
        bridge.parameterCache['poly_chord_map'] = polyMap;
        bridge.parameterCache['chord_notes'] = [60, 64, 67]; // C Major captured
        bridge._chordActiveNotes = [67, 71, 74]; // G Major transposed
        stopPolyChordMemory(67, bridge); // keyClass 7 → Minor by default, NOT Memory mode
        // keyClass 7 → Minor → intervals [0,3,7] → notes 67, 70, 74
        // Only 67 and 74 are in _chordActiveNotes → 2 stopped
        expect(stoppedNotes.length).toBe(2);
        expect(stoppedNotes).toContain(67);
        expect(stoppedNotes).toContain(74);
    });

    it('does nothing when poly chord disabled', function() {
        bridge.parameterCache['poly_chord_enable'] = 0.0;
        stopPolyChordMemory(60, bridge);
        expect(stoppedNotes.length).toBe(0);
        expect(bridge._chordActiveNotes.length).toBe(3);
    });

    it('does nothing when bridge is null', function() {
        expect(function() { stopPolyChordMemory(60, null); }).not.toThrow();
    });

    it('does nothing when _chordActiveNotes is empty', function() {
        bridge._chordActiveNotes = [];
        stopPolyChordMemory(60, bridge);
        expect(stoppedNotes.length).toBe(0);
    });

    it('only removes notes present in _chordActiveNotes', function() {
        bridge._chordActiveNotes = [60, 67]; // Only root and 5th
        stopPolyChordMemory(60, bridge);
        expect(stoppedNotes.length).toBe(2);
        expect(stoppedNotes).toContain(60);
        expect(stoppedNotes).toContain(67);
    });

    it('does nothing for rootNote with no matching active notes', function() {
        bridge._chordActiveNotes = [60, 64, 67];
        stopPolyChordMemory(85, bridge); // keyClass 1 → Minor → intervals [0,3,7] → notes 85, 88, 92
        // None of these are in _chordActiveNotes
        expect(stoppedNotes.length).toBe(0);
        expect(bridge._chordActiveNotes.length).toBe(3);
    });
});
