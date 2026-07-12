/**
 * @purpose Chord Memory Engine which captures custom held notes or plays predefined intervals from a root note.
 * @purpose_en Chord Memory Engine.
 */

var CHORD_INTERVALS = {
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
    var bridge = window.dualMidiBridge;
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
};

window._captureChordMemory = function() {
    var bridge = window.dualMidiBridge;
    if (!bridge) return;
    var keybed = document.getElementById('ivory-keys-bed');
    if (!keybed) return;
    var pushedKeys = keybed.querySelectorAll('.key.pushed');
    var octaveShift = window._currentOctaveShift || 0;
    
    var notes = [];
    pushedKeys.forEach(function(k) {
        var midiNote = parseInt(k.getAttribute('data-note'));
        if (!isNaN(midiNote)) {
            notes.push(midiNote + octaveShift);
        }
    });
    
    if (notes.length === 0) {
        return;
    }
    
    bridge.parameterCache['chord_notes'] = notes;
    console.log('[ChordMemory] Captured chord:', notes.join(', '));
    
    var lcdText = document.getElementById('lcd-text');
    if (lcdText) {
        var noteNames = notes.map(function(n) {
            var names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
            return names[n % 12] + Math.floor((n / 12) - 1);
        });
        lcdText.innerHTML = '<span style="font-size:10px; opacity:0.6;">CHORD MEMORY</span><br>'
            + '<strong>CAPTURED</strong><br>'
            + '<span style="font-size:14px; color:var(--accent-green);">' + noteNames.join(' ') + '</span>';
        if (typeof window.setLcdParamDisplayTimer === 'function') window.setLcdParamDisplayTimer(lcdText);
    }
};

window._playChordMemory = function(rootNote, velocity) {
    var bridge = window.dualMidiBridge;
    if (!bridge) return false;
    
    var chordEn = bridge.parameterCache['chord_enable'] || 0.0;
    if (chordEn < 0.5) return false;
    
    var chordType = Math.min(11, Math.max(0, Math.round((bridge.parameterCache['chord_type'] || 0.0) * 11)));
    
    if (!bridge._chordActiveNotes) bridge._chordActiveNotes = [];
    
    var notesToPlay = [];
    
    if (chordType === 0) {
        var captured = bridge.parameterCache['chord_notes'];
        if (!captured || captured.length === 0) return false;
        
        var baseNote = captured[0];
        var interval = rootNote - baseNote;
        
        captured.forEach(function(note) {
            var shiftedNote = note + interval;
            if (shiftedNote >= 0 && shiftedNote <= 127) {
                notesToPlay.push(shiftedNote);
            }
        });
        
        console.log('[ChordMemory] Memory mode: transposed by', interval, 'semitones from', baseNote, 'to', rootNote);
    } else {
        var intervals = CHORD_INTERVALS[chordType];
        if (!intervals) return false;
        
        intervals.forEach(function(interval) {
            var note = rootNote + interval;
            if (note >= 0 && note <= 127) {
                notesToPlay.push(note);
            }
        });
        
        var typeNames = ['', 'Major', 'Minor', 'Major 7th', 'Minor 7th', 'Dom 7th', 'Susp 4th', 'Power', 'Augmented', 'Diminished', 'Sus2', '7th'];
        console.log('[ChordMemory] Generated', typeNames[chordType] || 'Chord', 'at root', rootNote, ':', notesToPlay.join(','));
    }
    
    if (notesToPlay.length === 0) return false;
    
    notesToPlay.forEach(function(note) {
        bridge._chordActiveNotes.push(note);
        bridge.pianoNoteOn(note, velocity);
    });
    
    return true;
};
