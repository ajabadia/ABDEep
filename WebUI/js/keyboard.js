/**
 * @purpose Módulo de inicialización y control del teclado de piano virtual (Keybed),
 * ruedas de Pitch y Mod, y Octave Shift. Renderizado visual delegado a keyboard_render.js.
 * @purpose_en Initializes and manages the virtual piano keybed, Pitch/Mod wheels, octave shifting.
 */

function initKeyboardAndWheels() {
    const keybed = document.getElementById('ivory-keys-bed');
    if (!keybed) {return;}

    let octaveShift = 0;
    const octUpBtn = document.getElementById('oct-up-btn');
    const octDownBtn = document.getElementById('oct-down-btn');

    // Render octave button visuals via extracted function
    if (typeof window._renderOctaveButtons === 'function') {
        window._renderOctaveButtons(octUpBtn, octDownBtn, octaveShift);
    }

    if (octUpBtn) {
        octUpBtn.addEventListener('click', () => {
            octaveShift = Math.min(36, octaveShift + 12);
            window._currentOctaveShift = octaveShift;
            if (typeof window._updateOctaveLcd === 'function') {
                window._updateOctaveLcd(octaveShift);
            }
            if (typeof window._renderOctaveButtons === 'function') {
                window._renderOctaveButtons(octUpBtn, octDownBtn, octaveShift);
            }
        });
    }
    if (octDownBtn) {
        octDownBtn.addEventListener('click', () => {
            octaveShift = Math.max(-36, octaveShift - 12);
            window._currentOctaveShift = octaveShift;
            if (typeof window._updateOctaveLcd === 'function') {
                window._updateOctaveLcd(octaveShift);
            }
            if (typeof window._renderOctaveButtons === 'function') {
                window._renderOctaveButtons(octUpBtn, octDownBtn, octaveShift);
            }
        });
    }

    window._currentOctaveShift = octaveShift;

    const notes = [
        { type: 'white', name: 'C' }, { type: 'black', name: 'C#' },
        { type: 'white', name: 'D' }, { type: 'black', name: 'D#' },
        { type: 'white', name: 'E' },
        { type: 'white', name: 'F' }, { type: 'black', name: 'F#' },
        { type: 'white', name: 'G' }, { type: 'black', name: 'G#' },
        { type: 'white', name: 'A' }, { type: 'black', name: 'A#' },
        { type: 'white', name: 'B' }
    ];

    let whiteKeyIndex = 0;
    const totalOctaves = 4;
    const baseMidiNote = 36;

    for (let octave = 0; octave < totalOctaves; octave++) {
        notes.forEach((note) => {
            const originalMidiNote = baseMidiNote + (octave * 12) + notes.indexOf(note);
            const whiteIdx = note.type === 'white' ? (++whiteKeyIndex) : whiteKeyIndex;
            const key = typeof window._createKeyElement === 'function'
                ? window._createKeyElement(note, originalMidiNote, whiteIdx)
                : document.createElement('div');
            if (!key.getAttribute('data-note')) {
                key.classList.add('key', note.type);
                key.setAttribute('data-note', originalMidiNote);
            }

            const noteOn = (e) => {
                e.preventDefault();
                key.classList.add('pushed');
                key.classList.remove('pressure-release', 'pitch-bent');
                key.style.removeProperty('--pb-offset');
                const shiftedMidiNote = originalMidiNote + octaveShift;
                const rect = key.getBoundingClientRect();
                const relY = (e.clientY - rect.top) / rect.height;
                const rawVelocity = Math.max(0.15, Math.min(1.0, 0.15 + relY * 0.85));
                const vCurve = localStorage.getItem('abd-eep-velocity-curve') || 'normal';
                let velocity = rawVelocity;
                if (vCurve === 'soft') {
                    velocity = rawVelocity * rawVelocity;
                } else if (vCurve === 'hard') {
                    velocity = Math.sqrt(rawVelocity);
                } else if (vCurve === 'linear') {
                    velocity = rawVelocity;
                } else if (vCurve === 'fixed') {
                    velocity = 100 / 127;
                }
                velocity = Math.max(0.01, Math.min(1.0, velocity));
                key.style.setProperty('--velocity', velocity.toFixed(3));

                // Determine LED color via extracted function
                const ledColor = typeof window._resolveKeyLedColor === 'function'
                    ? window._resolveKeyLedColor(window.dualMidiBridge)
                    : 'var(--brand-accent)';
                key.style.setProperty('--key-led-color', ledColor);

                if (window.dualMidiBridge) {
                    if (window.dualMidiBridge._seqEngine && (window.dualMidiBridge.parameterCache['seq_enable'] || 0) > 0.5) {
                        window.dualMidiBridge._seqEngine.addHeldNote(shiftedMidiNote, velocity);
                    }

                    if (typeof window._playPolyChordMemory === 'function') {
                        const polyHandled = window._playPolyChordMemory(shiftedMidiNote, velocity);
                        if (polyHandled) {return;}
                    }

                    if (typeof window._playChordMemory === 'function') {
                        const handled = window._playChordMemory(shiftedMidiNote, velocity);
                        if (handled) {return;}
                    }

                    if (window.dualMidiBridge._arpEngine && (window.dualMidiBridge.parameterCache['arp_enable'] || 0) > 0.5) {
                        window.dualMidiBridge._arpEngine.addHeldNote(shiftedMidiNote, velocity);
                        return;
                    }

                    window.dualMidiBridge.pianoNoteOn(shiftedMidiNote, velocity);
                }
            };

            const noteOff = (e) => {
                e.preventDefault();
                key.classList.remove('pushed');
                key.style.removeProperty('--velocity');
                const shiftedMidiNote = originalMidiNote + octaveShift;
                if (window.dualMidiBridge) {
                    if (window.dualMidiBridge._seqEngine && (window.dualMidiBridge.parameterCache['seq_enable'] || 0) > 0.5) {
                        window.dualMidiBridge._seqEngine.removeHeldNote(shiftedMidiNote);
                    }

                    if (typeof window._stopPolyChordMemory === 'function') {
                        window._stopPolyChordMemory(shiftedMidiNote);
                    }

                    if (typeof window._stopChordMemory === 'function') {
                        window._stopChordMemory(shiftedMidiNote);
                    }

                    if (window.dualMidiBridge._arpEngine && (window.dualMidiBridge.parameterCache['arp_enable'] || 0) > 0.5) {
                        window.dualMidiBridge._arpEngine.removeHeldNote(shiftedMidiNote);
                        return;
                    }

                    window.dualMidiBridge.pianoNoteOff(shiftedMidiNote);
                }

                if (key.classList.contains('pressured') || key.classList.contains('pitch-bent')) {
                    key.style.setProperty('--pressure', '0');
                    key.style.setProperty('--mw-pressure', '0');
                    key.style.setProperty('--pb-offset', '0px');
                    key.classList.add('pressure-release');
                    const releaseEnd = () => {
                        key.classList.remove('pressure-release', 'pressured', 'pitch-bent');
                        key.style.removeProperty('--pressure');
                        key.style.removeProperty('--mw-pressure');
                        key.style.removeProperty('--pb-offset');
                    };
                    key.addEventListener('transitionend', releaseEnd, { once: true });
                    setTimeout(() => {
                        if (key.classList.contains('pressure-release')) {
                            key.classList.remove('pressure-release', 'pressured', 'pitch-bent');
                            key.style.removeProperty('--pressure');
                            key.style.removeProperty('--mw-pressure');
                            key.style.removeProperty('--pb-offset');
                            key.removeEventListener('transitionend', releaseEnd);
                        }
                    }, 500);
                }
            };

            key.addEventListener('pointerdown', noteOn);
            key.addEventListener('pointerup', noteOff);
            key.addEventListener('pointerleave', noteOff);

            keybed.appendChild(key);
        });
    }

    // Start key pressure display loop (aftertouch/modwheel/pitchbend visual on keys)
    if (typeof window._startKeyPressureDisplay === 'function') {
        window._startKeyPressureDisplay();
    }

    // ── Wheel Setup ──
    const setupWheel = (wheelId, isPitch) => {
        const slot = document.getElementById(wheelId);
        if (!slot) {return;}
        const wheel = slot.querySelector('.wheel');
        let isMoving = false;

        const updateWheel = (clientY) => {
            const rect = slot.getBoundingClientRect();
            let pct = 1.0 - (clientY - rect.top) / rect.height;
            pct = Math.max(0, Math.min(1, pct));

            const wheelHeight = 40;
            const pos = (1.0 - pct) * (rect.height - wheelHeight);
            wheel.style.bottom = (rect.height - wheelHeight - pos) + 'px';

            if (window.dualMidiBridge && window.dualMidiBridge.midiOutput) {
                const statusByte = (isPitch ? 0xE0 : 0xB0) | (window.dualMidiBridge.midiChannel - 1);
                if (isPitch) {
                    const bendVal = Math.round(pct * 16383);
                    const lsb = bendVal & 0x7F;
                    const msb = (bendVal >> 7) & 0x7F;
                    window.dualMidiBridge.midiOutput.send([statusByte, lsb, msb]);
                } else {
                    const modVal = Math.round(pct * 127);
                    window.dualMidiBridge.midiOutput.send([statusByte, 1, modVal]);
                }
            }
        };

        const rectCenterY = (el) => {
            const r = el.getBoundingClientRect();
            return r.top + (r.height / 2);
        };

        slot.addEventListener('pointerdown', (e) => {
            isMoving = true;
            slot.setPointerCapture(e.pointerId);
            updateWheel(e.clientY);
        });

        slot.addEventListener('pointermove', (e) => {
            if (isMoving) {updateWheel(e.clientY);}
        });

        slot.addEventListener('pointerup', (_e) => {
            isMoving = false;
            if (isPitch) {
                updateWheel(rectCenterY(slot));
            }
        });
    };

    setupWheel('wheel-pitch', true);
    setupWheel('wheel-mod', false);

    // Delegate key pressure loop and bridge state patching to keyboard_pressure.js
    if (typeof window.initKeyPressureLoop === 'function') {
        window.initKeyPressureLoop();
    }
}

/**
 * Muestra la nota MIDI presionada en el LCD del Programmer.
 */
function _showKeyboardNoteOnLcd(midiNote, velocity) {
    if (window.dualMidiBridge && typeof window.dualMidiBridge._showNoteOnLcd === 'function') {
        window.dualMidiBridge._showNoteOnLcd(midiNote, velocity);
    }
}

window.initKeyboardAndWheels = initKeyboardAndWheels;
window._showKeyboardNoteOnLcd = _showKeyboardNoteOnLcd;
// playKeyLedAnimation now defined in keyboard_led_animations.js
// initKeyPressureLoop now defined in keyboard_pressure.js
// Render functions (_renderOctaveButtons, _applyKeyIvoryTexture, etc.) now in keyboard_render.js
