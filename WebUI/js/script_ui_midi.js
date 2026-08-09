/**
 * @purpose MIDI parameter change router, HPF Boost / VCA Mode buttons, SysEx hex byte updater.
 * @purpose_en Routes parameter changes from bridge to sliders, LEDs, LCD, and hex display; handles toggle buttons.
 */

// ── LCD timeout helper ──
function _getLcdTimeoutMs() {
    const saved = localStorage.getItem('abd-eep-lcd-timeout');
    if (saved === null) {return 2000;}
    if (saved === 'off') {return null;}
    const ms = parseInt(saved, 10);
    return isNaN(ms) ? 2000 : ms;
}

// eslint-disable-next-line no-unused-vars -- called from initUIControls
function initMidiRouter() {
    // Lcd param display timer closure
    function _setLcdParamDisplayTimer(lcdEl) {
        lcdEl._ctrlLcdRestore = null;
    }
    window.setLcdParamDisplayTimer = _setLcdParamDisplayTimer;

    // MIDI PARAMETER CHANGES ROUTER
    if (window.dualMidiBridge) {
        window.dualMidiBridge.onParameterChanged(function (paramId, val) {
            const sliderUnits = Array.from(document.querySelectorAll('[data-param="' + paramId + '"] .v-slider'));

            const activeAtkParam = document.getElementById('env-ctrl-attack') ? document.getElementById('env-ctrl-attack').getAttribute('data-param') : null;
            const activeDcyParam = document.getElementById('env-ctrl-decay') ? document.getElementById('env-ctrl-decay').getAttribute('data-param') : null;
            const activeSusParam = document.getElementById('env-ctrl-sustain') ? document.getElementById('env-ctrl-sustain').getAttribute('data-param') : null;
            const activeRelParam = document.getElementById('env-ctrl-release') ? document.getElementById('env-ctrl-release').getAttribute('data-param') : null;

            if (paramId === activeAtkParam) {
                const el = document.querySelector('#env-ctrl-attack .v-slider');
                if (el && sliderUnits.indexOf(el) === -1) {sliderUnits.push(el);}
            }
            if (paramId === activeDcyParam) {
                const el = document.querySelector('#env-ctrl-decay .v-slider');
                if (el && sliderUnits.indexOf(el) === -1) {sliderUnits.push(el);}
            }
            if (paramId === activeSusParam) {
                const el = document.querySelector('#env-ctrl-sustain .v-slider');
                if (el && sliderUnits.indexOf(el) === -1) {sliderUnits.push(el);}
            }
            if (paramId === activeRelParam) {
                const el = document.querySelector('#env-ctrl-release .v-slider');
                if (el && sliderUnits.indexOf(el) === -1) {sliderUnits.push(el);}
            }

            const activePitchModParam = document.getElementById('osc-ctrl-pitchmod') ? document.getElementById('osc-ctrl-pitchmod').getAttribute('data-param') : null;
            const activePwmToneParam = document.getElementById('osc-ctrl-pwm-tone') ? document.getElementById('osc-ctrl-pwm-tone').getAttribute('data-param') : null;
            const activeOscPitchParam = document.getElementById('osc-ctrl-pitch') ? document.getElementById('osc-ctrl-pitch').getAttribute('data-param') : null;
            const activeOscLevelParam = document.getElementById('osc-ctrl-level') ? document.getElementById('osc-ctrl-level').getAttribute('data-param') : null;

            if (paramId === activePitchModParam) {
                const el = document.querySelector('#osc-ctrl-pitchmod .v-slider');
                if (el && sliderUnits.indexOf(el) === -1) {sliderUnits.push(el);}
            }
            if (paramId === activePwmToneParam) {
                const el = document.querySelector('#osc-ctrl-pwm-tone .v-slider');
                if (el && sliderUnits.indexOf(el) === -1) {sliderUnits.push(el);}
            }
            if (paramId === activeOscPitchParam) {
                const el = document.querySelector('#osc-ctrl-pitch .v-slider');
                if (el && sliderUnits.indexOf(el) === -1) {sliderUnits.push(el);}
            }
            if (paramId === activeOscLevelParam) {
                const el = document.querySelector('#osc-ctrl-level .v-slider');
                if (el && sliderUnits.indexOf(el) === -1) {sliderUnits.push(el);}
            }

            const activeLfoRateParam = document.getElementById('lfo-ctrl-rate') ? document.getElementById('lfo-ctrl-rate').getAttribute('data-param') : null;
            const activeLfoDelayParam = document.getElementById('lfo-ctrl-delay') ? document.getElementById('lfo-ctrl-delay').getAttribute('data-param') : null;

            if (paramId === activeLfoRateParam) {
                const el = document.querySelector('#lfo-ctrl-rate .v-slider');
                if (el && sliderUnits.indexOf(el) === -1) {sliderUnits.push(el);}
            }
            if (paramId === activeLfoDelayParam) {
                const el = document.querySelector('#lfo-ctrl-delay .v-slider');
                if (el && sliderUnits.indexOf(el) === -1) {sliderUnits.push(el);}
            }

            sliderUnits.forEach(function (sliderUnit) {
                const handle = sliderUnit.querySelector('.handle');
                if (handle) {
                    const rect = sliderUnit.getBoundingClientRect();
                    const height = rect.height > 0 ? rect.height : (sliderUnit.clientHeight > 0 ? sliderUnit.clientHeight : 100);
                    const handleHeight = 16;
                    handle.style.top = (1.0 - val) * (height - handleHeight) + 'px';
                }
            });

            const ledUnits = document.querySelectorAll('[data-param="' + paramId + '"] .led');
            ledUnits.forEach(function (ledUnit) {
                ledUnit.classList.toggle('active', val > 0.5);
            });

            if (paramId === 'hpf_boost_enable') {
                const boostBtn = document.getElementById('hpf-boost-btn');
                if (boostBtn) {
                    const active = val > 0.5;
                    boostBtn.classList.add('hpf-boost-btn');
                    boostBtn.classList.toggle('is-active', active);
                    boostBtn.innerText = active ? 'BOOST ON' : 'BOOST OFF';
                }
            }

            if (paramId === 'vca_mode') {
                try {
                    localStorage.setItem('abd-eep-vca-mode', val > 0.5 ? 'ballsy' : 'transparent');
                } catch(e) {}
                const modeBtn = document.getElementById('vca-mode-btn');
                if (modeBtn) {
                    const active = val > 0.5;
                    modeBtn.classList.add('vca-mode-btn');
                    modeBtn.classList.toggle('is-active', active);
                    modeBtn.innerText = active ? 'BALLSY' : 'TRANSPARENT';
                }
            }

            if (paramId === 'patch_name' && typeof val === 'string') {
                window._twText = val.toUpperCase();
                window._twBank = (window.currentActiveBank || '').toUpperCase();
            } else if (paramId !== 'seq_current_value' && paramId !== 'seq_current_step' && paramId !== 'seq_current_step_skip') {
                const midiInfo = window.MIDI_NRPN_MAP && window.MIDI_NRPN_MAP[paramId]
                    ? window.MIDI_NRPN_MAP[paramId]
                    : 'MIDI CONTROLLER';

                const lcdText = document.getElementById('lcd-text');
                if (lcdText) {
                    const displayVal = typeof window.formatParamValue === 'function'
                        ? window.formatParamValue(paramId, val)
                        : val.toFixed(2);
                    const html = '<span class="lcd-label">' + midiInfo + '</span><br><strong>' + paramId.toUpperCase() + '</strong><br><span class="lcd-value">' + displayVal + '</span>';
                    if (typeof window.lcdFadeUpdate === 'function') {
                        window.lcdFadeUpdate(lcdText, html, paramId);
                    }
                }
            }

            _updateHexByteForParam(paramId, val);
        });
    }

    function _updateHexByteForParam(paramId, normalizedVal) {
        if (!window.dualMidiBridge) {return;}
        const byteOffset = window.dualMidiBridge.paramToByteOffset[paramId];
        if (byteOffset === undefined) {return;}

        if (!window._liveUnpackedBytes) {
            if (window._lastUnpackedBytes) {
                window._liveUnpackedBytes = new Uint8Array(window._lastUnpackedBytes);
            } else {
                window._liveUnpackedBytes = new Uint8Array(242);
            }
        }

        const rawVal = window.dualMidiBridge._normalizedToRaw(byteOffset, normalizedVal);
        window._liveUnpackedBytes[byteOffset] = rawVal;

        if (window._lastUnpackedBytes && window._lastUnpackedBytes[byteOffset] !== undefined) {
            window._lastUnpackedBytes[byteOffset] = rawVal;
        }

        const byteEl = document.querySelector('.hex-byte[data-idx="' + byteOffset + '"]');
        if (byteEl) {
            const hex = rawVal.toString(16).toUpperCase().padStart(2, '0');
            byteEl.textContent = hex;
            byteEl.classList.add('changed');
            if (byteEl._changeTimer) {
                clearTimeout(byteEl._changeTimer);
            }
            byteEl._changeTimer = setTimeout(function () {
                byteEl.classList.remove('changed');
                byteEl._changeTimer = null;
            }, 1200);
        }
    }

    // HPF Boost button
    const hpfBoostBtn = document.getElementById('hpf-boost-btn');
    if (hpfBoostBtn) {
        hpfBoostBtn.addEventListener('click', function () {
            const cacheVal = window.dualMidiBridge ? window.dualMidiBridge.parameterCache['hpf_boost_enable'] : 0.0;
            const active = cacheVal > 0.5;
            const nextVal = active ? 0.0 : 1.0;
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter('hpf_boost_enable', nextVal);
                window.dualMidiBridge.handleParameterChangeFromBackend('hpf_boost_enable', nextVal);
            }
        });
    }

    // VCA Mode button
    const vcaModeBtn = document.getElementById('vca-mode-btn');
    if (vcaModeBtn) {
        vcaModeBtn.addEventListener('click', function () {
            const cacheVal = window.dualMidiBridge ? window.dualMidiBridge.parameterCache['vca_mode'] : 0.0;
            const active = cacheVal > 0.5;
            const nextVal = active ? 0.0 : 1.0;
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter('vca_mode', nextVal);
                window.dualMidiBridge.handleParameterChangeFromBackend('vca_mode', nextVal);
            }
        });
    }
}
