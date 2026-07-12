/**
 * @purpose Módulo de inicialización y control del teclado de piano virtual (Keybed), ruedas de Pitch y Mod, y Octave Shift.
 * @purpose_en Initializes and manages the virtual piano keybed, Pitch/Mod wheels, and octave shifting.
 */

function initKeyboardAndWheels() {
    const keybed = document.getElementById('ivory-keys-bed');
    if (!keybed) return;

    let octaveShift = 0;
    const octUpBtn = document.getElementById('oct-up-btn');
    const octDownBtn = document.getElementById('oct-down-btn');

    const updateOctaveButtonsVisuals = () => {
        const currentOctVal = octaveShift / 12;
        
        let activeColor = "var(--color-env-vca)";
        if (Math.abs(currentOctVal) === 1) {
            activeColor = "var(--color-env-vcf)";
        } else if (Math.abs(currentOctVal) === 2) {
            activeColor = "var(--color-env-mod)";
        } else if (Math.abs(currentOctVal) >= 3) {
            activeColor = "var(--color-oct-3)";
        }

        const isUpActive = currentOctVal > 0;
        const isDownActive = currentOctVal < 0;

        if (octUpBtn) {
            if (isUpActive) {
                octUpBtn.style.setProperty('color', activeColor, 'important');
                octUpBtn.style.setProperty('border-color', activeColor, 'important');
                octUpBtn.style.setProperty('box-shadow', `0 0 8px ${activeColor}`, 'important');
            } else {
                octUpBtn.style.setProperty('color', 'var(--brand-accent)', 'important');
                octUpBtn.style.setProperty('border-color', 'var(--border-dim)', 'important');
                octUpBtn.style.setProperty('box-shadow', 'none', 'important');
            }
        }

        if (octDownBtn) {
            if (isDownActive) {
                octDownBtn.style.setProperty('color', activeColor, 'important');
                octDownBtn.style.setProperty('border-color', activeColor, 'important');
                octDownBtn.style.setProperty('box-shadow', `0 0 8px ${activeColor}`, 'important');
            } else {
                octDownBtn.style.setProperty('color', 'var(--brand-accent)', 'important');
                octDownBtn.style.setProperty('border-color', 'var(--border-dim)', 'important');
                octDownBtn.style.setProperty('box-shadow', 'none', 'important');
            }
        }
    };
    
    if (octUpBtn) {
        octUpBtn.addEventListener('click', () => {
            octaveShift = Math.min(36, octaveShift + 12);
            const lcdText = document.getElementById('lcd-text');
            if (lcdText) {
                lcdText.innerHTML = `<span style="font-size:10px; opacity:0.6;">KEYBED</span><br><strong>OCTAVE SHIFT</strong><br><span style="font-size:15px; color:var(--brand-accent);">${octaveShift > 0 ? '+' : ''}${octaveShift/12}</span>`;
                if (typeof window.setLcdParamDisplayTimer === 'function') window.setLcdParamDisplayTimer(lcdText);
            }
            updateOctaveButtonsVisuals();
        });
    }
    if (octDownBtn) {
        octDownBtn.addEventListener('click', () => {
            octaveShift = Math.max(-36, octaveShift - 12);
            const lcdText = document.getElementById('lcd-text');
            if (lcdText) {
                lcdText.innerHTML = `<span style="font-size:10px; opacity:0.6;">KEYBED</span><br><strong>OCTAVE SHIFT</strong><br><span style="font-size:15px; color:var(--brand-accent);">${octaveShift/12}</span>`;
                if (typeof window.setLcdParamDisplayTimer === 'function') window.setLcdParamDisplayTimer(lcdText);
            }
            updateOctaveButtonsVisuals();
        });
    }

    updateOctaveButtonsVisuals();
    
    window._currentOctaveShift = octaveShift;
    var _octPatcher = setInterval(function() {
        if (window._currentOctaveShift !== octaveShift) {
            window._currentOctaveShift = octaveShift;
        }
    }, 200);

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
            const key = document.createElement('div');
            key.classList.add('key', note.type);
            key.setAttribute('data-note', originalMidiNote);

            if (note.type === 'white') {
                whiteKeyIndex++;
            } else {
                const leftPosition = ((whiteKeyIndex - 0.6) / 28) * 100;
                key.style.left = leftPosition + '%';
            }

            const noteOn = (e) => {
                e.preventDefault();
                key.classList.add('pushed');
                key.classList.remove('pressure-release', 'pitch-bent');
                key.style.removeProperty('--pb-offset');
                const shiftedMidiNote = originalMidiNote + octaveShift;
                const rect = key.getBoundingClientRect();
                const relY = (e.clientY - rect.top) / rect.height;
                var rawVelocity = Math.max(0.15, Math.min(1.0, 0.15 + (1.0 - relY) * 0.85));
                var vCurve = localStorage.getItem('abd-eep-velocity-curve') || 'normal';
                var velocity = rawVelocity;
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
                if (window.dualMidiBridge) {
                    if (window.dualMidiBridge._seqEngine && (window.dualMidiBridge.parameterCache['seq_enable'] || 0) > 0.5) {
                        window.dualMidiBridge._seqEngine.addHeldNote(shiftedMidiNote, velocity);
                    }
                    
                    if (typeof window._playPolyChordMemory === 'function') {
                        var polyHandled = window._playPolyChordMemory(shiftedMidiNote, velocity);
                        if (polyHandled) return;
                    }
                    
                    if (typeof window._playChordMemory === 'function') {
                        var handled = window._playChordMemory(shiftedMidiNote, velocity);
                        if (handled) return;
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
                    
                    if (window.dualMidiBridge._chordActiveNotes) {
                        var chordIdx = window.dualMidiBridge._chordActiveNotes.indexOf(shiftedMidiNote);
                        if (chordIdx >= 0) {
                            window.dualMidiBridge._chordActiveNotes.splice(chordIdx, 1);
                            window.dualMidiBridge.pianoNoteOff(shiftedMidiNote);
                            return;
                        }
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

    const setupWheel = (wheelId, isPitch) => {
        const slot = document.getElementById(wheelId);
        if (!slot) return;
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
            if (isMoving) updateWheel(e.clientY);
        });

        slot.addEventListener('pointerup', (e) => {
            isMoving = false;
            if (isPitch) {
                updateWheel(rectCenterY(slot));
            }
        });
    };

    setupWheel('wheel-pitch', true);
    setupWheel('wheel-mod', false);

    let _atPrevious = 0.0;
    let _mwPrevious = 0.0;
    let _pbPrevious = 0.0;
    let _atFramePending = false;

    function _updateKeyPressure() {
        _atFramePending = false;

        const bridge = window.dualMidiBridge;
        if (!bridge) return;

        let aftertouch = 0.0;
        let modWheel = 0.0;
        let pitchBend = 0.0;
        if (bridge.isJuce) {
            if (bridge._lastVoiceStateRaw) {
                aftertouch = bridge._lastVoiceStateRaw.aftertouch !== undefined
                    ? bridge._lastVoiceStateRaw.aftertouch : 0.0;
                modWheel = bridge._lastVoiceStateRaw.modWheel !== undefined
                    ? bridge._lastVoiceStateRaw.modWheel : 0.0;
                pitchBend = bridge._lastVoiceStateRaw.pitchBend !== undefined
                    ? bridge._lastVoiceStateRaw.pitchBend : 0.0;
            }
        } else {
            aftertouch = (bridge.parameterCache['aftertouch'] !== undefined)
                ? bridge.parameterCache['aftertouch'] : 0.0;
            modWheel = (bridge.parameterCache['mod_wheel'] !== undefined)
                ? bridge.parameterCache['mod_wheel'] : 0.0;
        }

        aftertouch = Math.max(0, Math.min(1, aftertouch));
        modWheel = Math.max(0, Math.min(1, modWheel));
        pitchBend = Math.max(-1, Math.min(1, pitchBend));

        if (typeof window.applyControllerCurve === 'function') {
            aftertouch = window.applyControllerCurve(aftertouch, window.getControllerCurve('aftertouch'));
            modWheel = window.applyControllerCurve(modWheel, window.getControllerCurve('modwheel'));
        }
        if (typeof window.applyBipolarCurve === 'function') {
            pitchBend = window.applyBipolarCurve(pitchBend, window.getControllerCurve('pitchbend'));
        }

        if (Math.abs(aftertouch - _atPrevious) < 0.01
            && Math.abs(modWheel - _mwPrevious) < 0.01
            && Math.abs(pitchBend - _pbPrevious) < 0.01) {
            _scheduleNextPressureFrame();
            return;
        }
        _atPrevious = aftertouch;
        _mwPrevious = modWheel;
        _pbPrevious = pitchBend;

        const combinedPressure = Math.max(aftertouch, modWheel);
        const hasAnyPressure = combinedPressure > 0.01;
        const pressureCombinedAttr = hasAnyPressure ? combinedPressure.toFixed(3) : null;
        const mwAttr = (modWheel > 0.01) ? modWheel.toFixed(3) : null;
        const pbSensitivity = parseInt(localStorage.getItem('abd-eep-pb-sensitivity') || '6', 10);
        const pbPx = Math.round(pitchBend * pbSensitivity);
        const pbAttr = Math.abs(pitchBend) > 0.01 ? String(pbPx) : null;

        const pushedKeys = keybed.querySelectorAll('.key.pushed');

        for (const k of pushedKeys) {
            if (pressureCombinedAttr) {
                k.style.setProperty('--pressure', pressureCombinedAttr);
                k.style.setProperty('--mw-pressure', mwAttr || '0');
                k.classList.add('pressured');
            } else {
                k.style.removeProperty('--pressure');
                k.style.removeProperty('--mw-pressure');
                k.classList.remove('pressured');
            }
            if (pbAttr) {
                k.style.setProperty('--pb-offset', pbAttr + 'px');
                k.classList.add('pitch-bent');
            } else {
                k.style.removeProperty('--pb-offset');
                k.classList.remove('pitch-bent');
            }
        }

        _scheduleNextPressureFrame();
    }

    function _scheduleNextPressureFrame() {
        if (_atFramePending) return;
        _atFramePending = true;
        requestAnimationFrame(_updateKeyPressure);
    }

    _scheduleNextPressureFrame();

    var _bridgeRef = window.dualMidiBridge;
    if (_bridgeRef) {
        _bridgeRef._lastVoiceStateRaw = null;
        if (typeof _bridgeRef.getVoiceState === 'function') {
            var origGetVoiceState = _bridgeRef.getVoiceState.bind(_bridgeRef);
            _bridgeRef.getVoiceState = async function() {
                var result = await origGetVoiceState();
                _bridgeRef._lastVoiceStateRaw = result;
                return result;
            };
        }
        
        _bridgeRef._lastAudioWaveform = null;
        if (typeof _bridgeRef.getAudioWaveform === 'function') {
            var origGetAudioWaveform = _bridgeRef.getAudioWaveform.bind(_bridgeRef);
            _bridgeRef.getAudioWaveform = async function() {
                var result = await origGetAudioWaveform();
                _bridgeRef._lastAudioWaveform = result;
                return result;
            };
        }
    }
}

window.initKeyboardAndWheels = initKeyboardAndWheels;
