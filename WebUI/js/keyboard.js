/**
 * @purpose Módulo de inicialización y control del teclado de piano virtual (Keybed), ruedas de Pitch y Mod, y Octave Shift.
 * @purpose_en Initializes and manages the virtual piano keybed, Pitch/Mod wheels, and octave shifting.
 */

function initKeyboardAndWheels() {
    const keybed = document.getElementById('ivory-keys-bed');
    if (!keybed) {return;}

    let octaveShift = 0;
    const octUpBtn = document.getElementById('oct-up-btn');
    const octDownBtn = document.getElementById('oct-down-btn');

    const updateOctaveButtonsVisuals = () => {
        const currentOctVal = octaveShift / 12;
        
        let activeColor = 'var(--color-env-vca)';
        if (Math.abs(currentOctVal) === 1) {
            activeColor = 'var(--color-env-vcf)';
        } else if (Math.abs(currentOctVal) === 2) {
            activeColor = 'var(--color-env-mod)';
        } else if (Math.abs(currentOctVal) >= 3) {
            activeColor = 'var(--color-oct-3)';
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
            window._currentOctaveShift = octaveShift;
            const lcdText = document.getElementById('lcd-text');
            if (lcdText) {
                lcdText.innerHTML = `<span style="font-size:10px; opacity:0.6;">KEYBED</span><br><strong>OCTAVE SHIFT</strong><br><span style="font-size:15px; color:var(--brand-accent);">${octaveShift > 0 ? '+' : ''}${octaveShift/12}</span>`;
                if (typeof window.setLcdParamDisplayTimer === 'function') {window.setLcdParamDisplayTimer(lcdText);}
            }
            updateOctaveButtonsVisuals();
        });
    }
    if (octDownBtn) {
        octDownBtn.addEventListener('click', () => {
            octaveShift = Math.max(-36, octaveShift - 12);
            window._currentOctaveShift = octaveShift;
            const lcdText = document.getElementById('lcd-text');
            if (lcdText) {
                lcdText.innerHTML = `<span style="font-size:10px; opacity:0.6;">KEYBED</span><br><strong>OCTAVE SHIFT</strong><br><span style="font-size:15px; color:var(--brand-accent);">${octaveShift/12}</span>`;
                if (typeof window.setLcdParamDisplayTimer === 'function') {window.setLcdParamDisplayTimer(lcdText);}
            }
            updateOctaveButtonsVisuals();
        });
    }

    updateOctaveButtonsVisuals();
    
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
            const key = document.createElement('div');
            key.classList.add('key', note.type);
            key.setAttribute('data-note', originalMidiNote);

            if (note.type === 'white') {
                whiteKeyIndex++;
                // Generar variación de marfil y suciedad determinista por tecla
                const seed = (originalMidiNote * 12345) % 100;
                const hue = 40 + (seed % 6 - 3); // 37..43 (tonos marfil/beige)
                const sat = 18 + (seed % 6);     // 18..24% de saturación
                const light = 90 - (seed % 5);   // 85..90% de luminosidad
                const dirtStart = 85 + (seed % 10);
                const dirtOpacity = 0.05 + (seed % 12) / 100.0; // suciedad sutil al final

                key.style.setProperty('--ivory-base', `hsl(${hue}, ${sat}%, ${light}%)`);
                key.style.setProperty('--ivory-top', `hsl(${hue}, ${sat}%, ${light + 6}%)`);
                key.style.setProperty('--ivory-bottom', `hsl(${hue}, ${sat}%, ${light - 5}%)`);
                key.style.setProperty('--dirt-color', `rgba(105, 90, 75, ${dirtOpacity})`);
                key.style.setProperty('--dirt-start', `${dirtStart}%`);
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

                // Determinar el color del LED RGB en la base de la tecla
                let ledColor = 'var(--brand-accent)';
                if (window.dualMidiBridge) {
                    const cache = window.dualMidiBridge.parameterCache;
                    const arpActive = cache && cache['arp_enable'] > 0.5;
                    const seqActive = cache && cache['seq_enable'] > 0.5;
                    const chordActive = cache && cache['chord_enable'] > 0.5;
                    const polyChordActive = cache && cache['poly_chord_enable'] > 0.5;
                    
                    if (arpActive) {
                        ledColor = '#ff3366'; // Pink para el Arpegiador
                    } else if (seqActive) {
                        ledColor = '#9933ff'; // Purple para el Secuenciador
                    } else if (polyChordActive) {
                        ledColor = '#00ffcc'; // Teal para Poly Chord
                    } else if (chordActive) {
                        ledColor = '#ffcc00'; // Gold/Yellow para Chord Memory
                    } else {
                        if (typeof window._getScopeColors === 'function') {
                            ledColor = window._getScopeColors().waveform;
                        }
                    }
                }
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
        if (!bridge) {return;}

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
        if (_atFramePending) {return;}
        _atFramePending = true;
        requestAnimationFrame(_updateKeyPressure);
    }

    _scheduleNextPressureFrame();

    const _bridgeRef = window.dualMidiBridge;
    if (_bridgeRef) {
        _bridgeRef._lastVoiceStateRaw = null;
        if (typeof _bridgeRef.getVoiceState === 'function') {
            const origGetVoiceState = _bridgeRef.getVoiceState.bind(_bridgeRef);
            _bridgeRef.getVoiceState = async function() {
                const result = await origGetVoiceState();
                _bridgeRef._lastVoiceStateRaw = result;
                return result;
            };
        }
        
        _bridgeRef._lastAudioWaveform = null;
        if (typeof _bridgeRef.getAudioWaveform === 'function') {
            const origGetAudioWaveform = _bridgeRef.getAudioWaveform.bind(_bridgeRef);
            _bridgeRef.getAudioWaveform = async function() {
                const result = await origGetAudioWaveform();
                _bridgeRef._lastAudioWaveform = result;
                return result;
            };
        }
    }
}

/**
 * Muestra la nota MIDI presionada en el LCD del Programmer.
 * Ahora delega en DualMidiBridge._showNoteOnLcd() para tener un solo punto
 * de actualización del LCD desde todas las fuentes (teclado, arp, seq, chord).
 */
function _showKeyboardNoteOnLcd(midiNote, velocity) {
    if (window.dualMidiBridge && typeof window.dualMidiBridge._showNoteOnLcd === 'function') {
        window.dualMidiBridge._showNoteOnLcd(midiNote, velocity);
    }
}

function playKeyLedAnimation(type) {
    const keybed = document.getElementById('ivory-keys-bed');
    if (!keybed) {return;}
    const keys = Array.from(keybed.querySelectorAll('.key'));
    // Ordenar de izquierda a derecha por nota MIDI
    keys.sort((a, b) => parseInt(a.getAttribute('data-note')) - parseInt(b.getAttribute('data-note')));
    
    if (keys.length === 0) {return;}
    
    if (window._activeKeyLedAnimationInterval) {
        clearInterval(window._activeKeyLedAnimationInterval);
        window._activeKeyLedAnimationInterval = null;
        keys.forEach(k => {
            k.classList.remove('pushed-anim');
            k.style.removeProperty('--key-led-color');
        });
    }

    const totalSteps = keys.length;
    
    if (type === 'panic') {
        const duration = 12; // ms por tecla
        let i = 0;
        const interval = setInterval(() => {
            if (i < totalSteps) {
                const key = keys[i];
                key.classList.add('pushed-anim');
                key.style.setProperty('--key-led-color', '#ff0000');
                setTimeout(() => {
                    key.classList.remove('pushed-anim');
                    key.style.removeProperty('--key-led-color');
                }, 180);
                i++;
            } else if (i < totalSteps * 2) {
                const revIdx = totalSteps * 2 - 1 - i;
                const key = keys[revIdx];
                if (key) {
                    key.classList.add('pushed-anim');
                    key.style.setProperty('--key-led-color', '#ff0000');
                    setTimeout(() => {
                        key.classList.remove('pushed-anim');
                        key.style.removeProperty('--key-led-color');
                    }, 180);
                }
                i++;
            } else {
                clearInterval(interval);
            }
        }, duration);
        window._activeKeyLedAnimationInterval = interval;
    }
    else if (type === 'patch-up' || type === 'patch-down') {
        const isUp = type === 'patch-up';
        const duration = 15;
        let i = 0;
        
        const interval = setInterval(() => {
            if (i < totalSteps) {
                const idx = isUp ? i : (totalSteps - 1 - i);
                const key = keys[idx];
                if (key) {
                    const hue = Math.round((i / totalSteps) * 360);
                    key.classList.add('pushed-anim');
                    key.style.setProperty('--key-led-color', `hsl(${hue}, 100%, 50%)`);
                    setTimeout(() => {
                        key.classList.remove('pushed-anim');
                        key.style.removeProperty('--key-led-color');
                    }, 250);
                }
                i++;
            } else {
                clearInterval(interval);
            }
        }, duration);
        window._activeKeyLedAnimationInterval = interval;
    }
    else if (type === 'bank-up' || type === 'bank-down') {
        const isUp = type === 'bank-up';
        const duration = 40;
        let groupIdx = 0;
        const groupSize = 3;
        const totalGroups = Math.ceil(totalSteps / groupSize);
        
        const interval = setInterval(() => {
            if (groupIdx < totalGroups) {
                const g = isUp ? groupIdx : (totalGroups - 1 - groupIdx);
                const start = g * groupSize;
                const hue = Math.round((groupIdx / totalGroups) * 360);
                
                for (let kIdx = 0; kIdx < groupSize; kIdx++) {
                    const key = keys[start + kIdx];
                    if (key) {
                        key.classList.add('pushed-anim');
                        key.style.setProperty('--key-led-color', `hsl(${hue}, 100%, 50%)`);
                        setTimeout(() => {
                            key.classList.remove('pushed-anim');
                            key.style.removeProperty('--key-led-color');
                        }, 300);
                    }
                }
                groupIdx++;
            } else {
                clearInterval(interval);
            }
        }, duration);
        window._activeKeyLedAnimationInterval = interval;
    }
}

window.initKeyboardAndWheels = initKeyboardAndWheels;
window._showKeyboardNoteOnLcd = _showKeyboardNoteOnLcd;
window.playKeyLedAnimation = playKeyLedAnimation;
