/**
 * @purpose Listens to real-time active notes JSON feeds from the JUCE synth engine to display active keys visual overlays on LCD screen.
 * @purpose_en Active Engine Notes LCD feedback handler.
 */

const ENGINE_NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

function _engineMidiNoteToName(midiNote) {
    if (midiNote < 0 || midiNote > 127) return "—";
    return ENGINE_NOTE_NAMES[midiNote % 12] + (Math.floor(midiNote / 12) - 1);
}

window._handleEngineActiveNotes = function(notesJSON) {
    const lcdText = document.getElementById('lcd-text');
    if (!lcdText) return;

    let activeNotes = [];
    try {
        const raw = JSON.parse(notesJSON);
        if (Array.isArray(raw)) {
            activeNotes = raw;
        }
    } catch (e) {}

    const allKeys = document.querySelectorAll('#ivory-keys-bed .key');
    const activeMidiSet = new Set(activeNotes.map(nv => nv[0]));
    allKeys.forEach(k => {
        const keyMidi = parseInt(k.getAttribute('data-note'));
        let isMatch = false;
        for (let shift = -36; shift <= 36; shift += 12) {
            if (activeMidiSet.has(keyMidi + shift)) { isMatch = true; break; }
        }
        if (!isMatch) k.style.removeProperty('--velocity');
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
                    if (lcdText._ctrlLcdRestore !== null) return;
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
                if (lcdText._ctrlLcdRestore !== null) return;
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
    
    let suffix = "";
    if (sorted.length > maxNotesToShow) {
        suffix = ` +${sorted.length - maxNotesToShow}`;
    }

    let title = "KEY PLAY";
    if (window.dualMidiBridge) {
        if ((window.dualMidiBridge.parameterCache['poly_chord_enable'] || 0) > 0.5) {
            title = "POLY CHORD";
        } else if ((window.dualMidiBridge.parameterCache['chord_enable'] || 0) > 0.5) {
            title = "CHORD PLAY";
        }
    }

    lcdText.innerHTML = `<span style="font-size:10px; opacity:0.6;">${title}</span><br>`
        + `<strong style="font-size:13px; color:var(--brand-accent);">${displayedNames.join(" ")}${suffix}</strong><br>`
        + `<span style="font-size:8px; color:var(--text-dim);">ACTIVE ENGINE VOICES</span>`;
};
