/**
 * @purpose Listens to real-time active notes JSON feeds from the JUCE synth engine to display active keys visual overlays on LCD screen.
 * @purpose_en Active Engine Notes LCD feedback handler.
 */

const ENGINE_NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

function _engineMidiNoteToName(midiNote) {
    if (midiNote < 0 || midiNote > 127) {return '—';}
    return ENGINE_NOTE_NAMES[midiNote % 12] + (Math.floor(midiNote / 12) - 1);
}

window._handleEngineActiveNotes = function(notesJSON) {
    const lcdText = document.getElementById('lcd-text');
    if (!lcdText) {return;}

    let activeNotes = [];
    // C++ evaluateJavascript pasa el array ya parseado como expresión JS:
    //   window._handleEngineActiveNotes([[60,0.8000]]);
    // Si es string, viene de tests o de otro caller y hay que parsearlo.
    if (Array.isArray(notesJSON)) {
        activeNotes = notesJSON;
    } else if (typeof notesJSON === 'string') {
        try {
            const raw = JSON.parse(notesJSON);
            if (Array.isArray(raw)) {
                activeNotes = raw;
            }
        } catch (e) {}
    }

    const allKeys = document.querySelectorAll('#ivory-keys-bed .key');
    allKeys.forEach(k => {
        const keyMidi = parseInt(k.getAttribute('data-note'));
        let matchedVelocity = null;
        const found = activeNotes.find(nv => nv[0] === keyMidi);
        if (found) {
            matchedVelocity = found[1];
        }
        if (matchedVelocity !== null) {
            k.style.setProperty('--velocity', matchedVelocity.toFixed(3));
            
            // Determinar color del LED para notas del motor
            let ledColor = 'var(--brand-accent)';
            if (window.dualMidiBridge) {
                const cache = window.dualMidiBridge.parameterCache;
                const arpActive = cache && cache['arp_enable'] > 0.5;
                const seqActive = cache && cache['seq_enable'] > 0.5;
                const chordActive = cache && cache['chord_enable'] > 0.5;
                const polyChordActive = cache && cache['poly_chord_enable'] > 0.5;
                
                if (arpActive) {
                    ledColor = '#ff3366';
                } else if (seqActive) {
                    ledColor = '#9933ff';
                } else if (polyChordActive) {
                    ledColor = '#00ffcc';
                } else if (chordActive) {
                    ledColor = '#ffcc00';
                } else {
                    if (typeof window._getScopeColors === 'function') {
                        ledColor = window._getScopeColors().waveform;
                    }
                }
            }
            k.style.setProperty('--key-led-color', ledColor);
            k.classList.add('pushed');
        } else {
            k.style.removeProperty('--velocity');
            k.style.removeProperty('--key-led-color');
            k.classList.remove('pushed');
        }
    });

    if (activeNotes.length === 0) {
        if (lcdText._ctrlLcdRestore) {
            const restoreHtml = lcdText._ctrlLcdRestore;
            lcdText._ctrlLcdRestore = null;
            if (lcdText._ctrlLcdFadeTimer) {
                clearTimeout(lcdText._ctrlLcdFadeTimer);
                lcdText._ctrlLcdFadeTimer = null;
            }
            const rt = window.getLcdFadeTiming();
            if (rt.outR === 0) {
                lcdText.innerHTML = restoreHtml;
                lcdText.style.removeProperty('transition');
                lcdText.style.opacity = '1';
            } else {
                lcdText.style.transition = 'opacity ' + rt.outR + 'ms ease-out';
                lcdText.style.opacity = '0';
                lcdText._ctrlLcdFadeTimer = setTimeout(() => {
                    lcdText._ctrlLcdFadeTimer = null;
                    if (lcdText._ctrlLcdRestore !== null) {return;}
                    lcdText.innerHTML = restoreHtml;
                    lcdText.style.transition = 'opacity ' + rt.inR + 'ms ease-in';
                    lcdText.style.opacity = '1';
                    setTimeout(() => {
                        lcdText.style.removeProperty('transition');
                        lcdText.style.removeProperty('opacity');
                    }, rt.cleanupR);
                }, rt.swapR);
            }
        } else if (!lcdText._ctrlLcdFadeTimer) {
            lcdText._ctrlLcdFadeTimer = setTimeout(() => {
                lcdText._ctrlLcdFadeTimer = null;
                if (lcdText._ctrlLcdRestore !== null) {return;}
                const rt = window.getLcdFadeTiming();
                if (rt.outR === 0) {
                    lcdText.innerHTML = '';
                    lcdText.style.removeProperty('transition');
                    lcdText.style.removeProperty('opacity');
                } else {
                    lcdText.style.transition = 'opacity ' + rt.outR + 'ms ease-out';
                    lcdText.style.opacity = '0';
                    setTimeout(() => {
                        if (lcdText.style.opacity === '0') {
                            lcdText.innerHTML = '';
                            lcdText.style.removeProperty('transition');
                            lcdText.style.removeProperty('opacity');
                        }
                    }, rt.outR);
                }
            }, 1500);
        }
        return;
    }

    if (lcdText._ctrlLcdFadeTimer) {
        clearTimeout(lcdText._ctrlLcdFadeTimer);
        lcdText._ctrlLcdFadeTimer = null;
    }

    if (lcdText._ctrlLcdRestore === null || lcdText._ctrlLcdRestore === undefined) {
        const baseHtml = lcdText.innerHTML;
        if (!baseHtml.includes('KEY PLAY') && !baseHtml.includes('CHORD')) {
            lcdText._ctrlLcdRestore = baseHtml;
        }
    }

    const maxNotesToShow = 4;
    const sorted = activeNotes.slice().sort((a,b) => a[0] - b[0]);
    const notesToShow = sorted.slice(0, maxNotesToShow);
    const displayedNames = notesToShow.map(nv => _engineMidiNoteToName(nv[0]));
    const rawNotes = sorted.map(function(nv) { return nv[0]; });
    
    let suffix = '';
    if (sorted.length > maxNotesToShow) {
        suffix = ` +${sorted.length - maxNotesToShow}`;
    }

    let title = 'KEY PLAY';
    if (window.dualMidiBridge) {
        if ((window.dualMidiBridge.parameterCache['poly_chord_enable'] || 0) > 0.5) {
            title = 'POLY CHORD';
        } else if ((window.dualMidiBridge.parameterCache['chord_enable'] || 0) > 0.5) {
            title = 'CHORD PLAY';
        }
    }

    let chordResult = null;
    if (rawNotes.length >= 2 && typeof window._detectChordFromNotes === 'function') {
        chordResult = window._detectChordFromNotes(rawNotes);
    }

    if (chordResult) {
        lcdText.innerHTML = `<span style="font-size:10px; opacity:0.6;">${title}</span><br>`
            + `<strong style="font-size:18px; color:var(--brand-accent); letter-spacing:1px;">${chordResult.rootName}${chordResult.typeName}</strong><br>`
            + `<span style="font-size:9px; color:var(--text-dim);">${displayedNames.join(' ')}${suffix}</span>`;
    } else {
        lcdText.innerHTML = `<span style="font-size:10px; opacity:0.6;">${title}</span><br>`
            + `<strong style="font-size:13px; color:var(--brand-accent);">${displayedNames.join(' ')}${suffix}</strong><br>`
            + '<span style="font-size:8px; color:var(--text-dim);">ACTIVE ENGINE VOICES</span>';
    }

    // Update Chord Display Canvas
    let chordCanvas = document.querySelector('.chord-display-canvas');
    if (!chordCanvas && window._chordDisplayCanvasEl) {
        chordCanvas = window._chordDisplayCanvasEl;
    }
    if (chordCanvas && chordCanvas._chordDisplay) {
        const notes = rawNotes.filter(function(n) { return n >= 48 && n <= 72; });
        chordCanvas._chordDisplay.setActiveNotes(notes);
        if (chordResult) {
            chordCanvas._chordDisplay.setChordLabel(chordResult.rootName + chordResult.typeName);
        } else {
            chordCanvas._chordDisplay.setChordLabel('');
        }
    }
};

window.initChordDisplayCanvas = function() {
    let canvas = document.querySelector('.chord-display-canvas');
    if (!canvas) {
        const kbdSection = document.querySelector('.keyboard-section') || document.getElementById('keyboard-section');
        if (kbdSection) {
            canvas = document.createElement('canvas');
            canvas.className = 'chord-display-canvas';
            canvas.style.width = '100%';
            canvas.style.height = '48px';
            canvas.style.border = '1px solid var(--border-dim)';
            canvas.style.borderRadius = 'var(--radius-xs)';
            canvas.style.background = 'var(--bg-deepest)';
            canvas.style.margin = '2px 0';
            kbdSection.insertBefore(canvas, kbdSection.querySelector('#ivory-keys-bed') || kbdSection.firstChild);
        }
    }
    if (!canvas || !window.ChordDisplayCanvas) {return;}
    if (canvas._chordDisplay) { canvas._chordDisplay.resize(); return; }
    window._chordDisplayCanvasEl = canvas;
    canvas._chordDisplay = new window.ChordDisplayCanvas(canvas);
    canvas._chordDisplay.onNoteClick(function(midiNote) {
        const bridge = window.dualMidiBridge;
        if (!bridge) {return;}
        bridge.sendNoteOn(midiNote, 100);
        setTimeout(function() { bridge.sendNoteOff(midiNote); }, 50);
    });
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { window.initChordDisplayCanvas(); });
} else {
    window.initChordDisplayCanvas();
}
