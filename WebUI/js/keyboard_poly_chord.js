/**
 * @purpose Poly Chord Engine which maps key classes to specific chord type assignments.
 * @purpose_en Poly Chord Engine.
 */

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
window.POLY_CHORD_DEFAULTS = POLY_CHORD_DEFAULTS;

const CHORD_TYPE_NAMES = ['Memory', 'Major', 'Minor', 'Major 7th', 'Minor 7th', 'Dom 7th', 'Susp 4th', 'Power Chd', 'Augmented', 'Diminished', 'Sus2', '7th'];
window.CHORD_TYPE_NAMES = CHORD_TYPE_NAMES;

const NOTE_NAMES_SHORT = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
window.NOTE_NAMES_SHORT = NOTE_NAMES_SHORT;

window._initPolyChordNotes = function() {
    const bridge = window.dualMidiBridge;
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
    
    console.log('[PolyChord] Initialized poly chord map with defaults');
};

window._playPolyChordMemory = function(rootNote, velocity) {
    const bridge = window.dualMidiBridge;
    if (!bridge) {return false;}
    
    const polyChordEn = bridge.parameterCache['poly_chord_enable'] || 0.0;
    if (polyChordEn < 0.5) {return false;}
    
    const polyMap = bridge.parameterCache['poly_chord_map'];
    if (!polyMap || polyMap.length < 12) {return false;}
    
    const keyClass = rootNote % 12;
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
        const intervals = window.CHORD_INTERVALS ? window.CHORD_INTERVALS[chordType] : null;
        if (!intervals) {return false;}
        
        intervals.forEach(function(interval) {
            const note = rootNote + interval;
            if (note >= 0 && note <= 127) {
                notesToPlay.push(note);
            }
        });
    }
    
    if (notesToPlay.length === 0) {return false;}
    
    notesToPlay.forEach(function(note) {
        bridge._chordActiveNotes.push(note);
        bridge.pianoNoteOn(note, velocity);
    });
    
    const keyName = NOTE_NAMES_SHORT[keyClass];
    const typeName = CHORD_TYPE_NAMES[chordType] || 'Chord';
    console.log('[PolyChord] Key', keyName, '→', typeName, 'at root', rootNote, ':', notesToPlay.join(','));
    
    return true;
};

window._stopPolyChordMemory = function(rootNote) {
    const bridge = window.dualMidiBridge;
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
        const intervals = window.CHORD_INTERVALS ? window.CHORD_INTERVALS[chordType] : null;
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
            bridge.pianoNoteOff(note);
        }
    });
};
