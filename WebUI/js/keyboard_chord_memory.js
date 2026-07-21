/**
 * @purpose Chord Memory Engine which captures custom held notes or plays predefined intervals from a root note.
 * @purpose_en Chord Memory Engine.
 */

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

window._initChordMemory = function() {
    const bridge = window.dualMidiBridge;
    if (!bridge) {return;}
    if (bridge.parameterCache['chord_notes'] === undefined) {
        bridge.parameterCache['chord_notes'] = [];
    }
    if (bridge.parameterCache['chord_enable'] === undefined) {
        bridge.parameterCache['chord_enable'] = 0.0;
    }
    if (bridge.parameterCache['chord_key'] === undefined) {
        bridge.parameterCache['chord_key'] = 0.0;
    }
    if (bridge.parameterCache['chord_type'] === undefined) {
        bridge.parameterCache['chord_type'] = 0.0;
    }
};

window._captureChordMemory = function() {
    const bridge = window.dualMidiBridge;
    if (!bridge) {return;}
    const keybed = document.getElementById('ivory-keys-bed');
    if (!keybed) {return;}
    const pushedKeys = keybed.querySelectorAll('.key.pushed');
    const octaveShift = window._currentOctaveShift || 0;
    
    const notes = [];
    pushedKeys.forEach(function(k) {
        const midiNote = parseInt(k.getAttribute('data-note'));
        if (!isNaN(midiNote)) {
            notes.push(midiNote + octaveShift);
        }
    });
    
    if (notes.length === 0) {
        return;
    }
    
    bridge.parameterCache['chord_notes'] = notes;
    console.log('[ChordMemory] Captured chord:', notes.join(', '));
    
    const lcdText = document.getElementById('lcd-text');
    if (lcdText) {
        const noteNames = notes.map(function(n) {
            const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
            return names[n % 12] + Math.floor((n / 12) - 1);
        });
        lcdText.innerHTML = '<span style="font-size:10px; opacity:0.6;">CHORD MEMORY</span><br>'
            + '<strong>CAPTURED</strong><br>'
            + '<span style="font-size:14px; color:var(--accent-green);">' + noteNames.join(' ') + '</span>';
        if (typeof window.setLcdParamDisplayTimer === 'function') {window.setLcdParamDisplayTimer(lcdText);}
    }
};

window._playChordMemory = function(rootNote, velocity) {
    const bridge = window.dualMidiBridge;
    if (!bridge) {return false;}
    
    const chordEn = bridge.parameterCache['chord_enable'] || 0.0;
    if (chordEn < 0.5) {return false;}
    
    const chordType = Math.min(11, Math.max(0, Math.round((bridge.parameterCache['chord_type'] || 0.0) * 11)));
    
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
        
        console.log('[ChordMemory] Memory mode: transposed by', interval, 'semitones from', baseNote, 'to', rootNote);
    } else {
        const intervals = CHORD_INTERVALS[chordType];
        if (!intervals) {return false;}
        
        intervals.forEach(function(interval) {
            const note = rootNote + interval;
            if (note >= 0 && note <= 127) {
                notesToPlay.push(note);
            }
        });
        
        const typeNames = ['', 'Major', 'Minor', 'Major 7th', 'Minor 7th', 'Dom 7th', 'Susp 4th', 'Power', 'Augmented', 'Diminished', 'Sus2', '7th'];
        console.log('[ChordMemory] Generated', typeNames[chordType] || 'Chord', 'at root', rootNote, ':', notesToPlay.join(','));
    }
    
    if (notesToPlay.length === 0) {return false;}
    
    notesToPlay.forEach(function(note) {
        bridge._chordActiveNotes.push(note);
        bridge.pianoNoteOn(note, velocity);
    });
    
    return true;
};

window._stopChordMemory = function(rootNote) {
    const bridge = window.dualMidiBridge;
    if (!bridge || !bridge._chordActiveNotes) {return;}
    
    const chordEn = bridge.parameterCache['chord_enable'] || 0.0;
    if (chordEn < 0.5) {return;}
    
    const chordType = Math.min(11, Math.max(0, Math.round((bridge.parameterCache['chord_type'] || 0.0) * 11)));
    
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
            bridge.pianoNoteOff(note);
        }
    });
};

/**
 * Detect chord quality from an array of active MIDI note numbers.
 * Assumes root position (lowest note = root). Returns null if <2 notes or no match.
 * Falls back to displaying the lowest note as pseudo-root when no chord match.
 */
const NOTE_NAMES_SHORT = window.NOTE_NAMES_SHORT || ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const CHORD_TYPE_NAMES = window.CHORD_TYPE_NAMES || [];
window._detectChordFromNotes = function(notes) {
    if (!Array.isArray(notes) || notes.length < 2) {return null;}
    const sorted = notes.slice().sort(function(a,b) { return a - b; });
    const root = sorted[0];
    const rootClass = root % 12;
    const seen = {};
    const intervals = [];
    sorted.forEach(function(n) {
        const iv = (n % 12 - rootClass + 12) % 12;
        if (!seen[iv]) { seen[iv] = true; intervals.push(iv); }
    });
    intervals.sort(function(a,b) { return a - b; });

    let bestMatch = null;
    let bestDiff = 99;
    for (const t in CHORD_INTERVALS) {
        const chordIvs = CHORD_INTERVALS[t];
        if (!chordIvs) {continue;}
        let contained = true;
        for (let i = 0; i < intervals.length; i++) {
            if (chordIvs.indexOf(intervals[i]) === -1) { contained = false; break; }
        }
        if (!contained) {continue;}
        const diff = chordIvs.length - intervals.length;
        if (diff < 0) {continue;}
        if (diff === 0) {
            bestMatch = { type: parseInt(t), root: root, rootName: NOTE_NAMES_SHORT[rootClass], typeName: CHORD_TYPE_NAMES[t] };
            break;
        }
        if (diff < bestDiff) { bestDiff = diff; bestMatch = { type: parseInt(t), root: root, rootName: NOTE_NAMES_SHORT[rootClass], typeName: CHORD_TYPE_NAMES[t] }; }
    }
    return bestMatch;
};
