/**
 * @purpose Update hardware info fields in Settings modal from dualMidiBridge.
 * Extraído de settings_modal_core.js.
 */

/**
 * Update all hardware info fields in the Settings modal from dualMidiBridge.
 * Reads device ID, MIDI channel, master tune, transpose, velocity curve,
 * pedal polarity, LCD contrast, and firmware versions.
 */
/**
 * Render the read-only DSP calibration constants panel in the Advanced tab.
 * @param {object} dspCalibration - map of {name: {value, unit}} from getBuildInfo()
 */
function renderDspCalibration(dspCalibration) {
    const container = document.getElementById('settings-dsp-calibration');
    if (!container) {return;}

    const names = Object.keys(dspCalibration || {}).sort();
    if (names.length === 0) {
        container.textContent = 'No calibration data available.';
        return;
    }

    container.textContent = '';
    names.forEach(function (name) {
        const entry = dspCalibration[name] || {};
        const val = typeof entry.value === 'number' ? Number(entry.value.toFixed(4)) : entry.value;
        const unit = entry.unit ? ' ' + entry.unit : '';
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.gap = '10px';
        const nameEl = document.createElement('span');
        nameEl.textContent = name;
        nameEl.style.color = 'var(--text-dim)';
        const valEl = document.createElement('span');
        valEl.textContent = String(val) + unit;
        valEl.style.color = 'var(--text-secondary)';
        row.appendChild(nameEl);
        row.appendChild(valEl);
        container.appendChild(row);
    });
}

function updateSettingsHardwareInfo() {
    const bridge = window.dualMidiBridge;
    if (!bridge) {return;}
    const info = bridge.getHardwareInfo();
    if (!info) {return;}

    // Fetch build model from JUCE native bridge
    if (window.juce && typeof window.juce.getBuildInfo === 'function') {
        window.juce.getBuildInfo().then(function(res) {
            if (res) {
                if (res.model) {
                    window.buildModel = res.model;
                    const modelEl = document.getElementById('settings-build-model');
                    if (modelEl) {modelEl.textContent = res.model;}
                    if (typeof window._applyVoicingConstraint === 'function') {
                        window._applyVoicingConstraint();
                    }
                }
                if (res.buildNumber) {
                    const aboutLabel = document.getElementById('about-build-label');
                    const appLabel = document.getElementById('app-build-label');
                    if (aboutLabel) {
                        aboutLabel.textContent = 'Version v0.1 | Build ' + res.buildNumber;
                    }
                    if (appLabel) {
                        appLabel.textContent = 'v0.1 b' + res.buildNumber;
                    }
                }
                if (res.dspCalibration) {
                    renderDspCalibration(res.dspCalibration);
                }
            }
        });
    } else {
        window.buildModel = 'Classic';
        const modelEl = document.getElementById('settings-build-model');
        if (modelEl) {modelEl.textContent = window.buildModel;}
        if (typeof window._applyVoicingConstraint === 'function') {
            window._applyVoicingConstraint();
        }
    }
    
    const hostEl = document.getElementById('settings-synth-host-version');
    const voiceEl = document.getElementById('settings-synth-voice-version');
    const dspEl = document.getElementById('settings-synth-dsp-version');
    const bootEl = document.getElementById('settings-synth-boot-version');
    const wifiEl = document.getElementById('settings-synth-wifi-version');
    const connectionTypeEl = document.getElementById('settings-connection-type');
    
    if (hostEl) {hostEl.textContent = info.hostVersion || '-';}
    if (voiceEl) {voiceEl.textContent = info.voiceVersion || '-';}
    if (dspEl) {dspEl.textContent = info.dspVersion || '-';}
    if (bootEl) {bootEl.textContent = info.bootVersion || '-';}
    if (wifiEl) {wifiEl.textContent = info.wifiVersion || '-';}
    
    const synthDevIdEl = document.getElementById('settings-synth-device-id');
    const synthMidiChEl = document.getElementById('settings-synth-midi-channel');
    if (synthDevIdEl) {
        synthDevIdEl.textContent = info.deviceId !== '-' ? String(parseInt(info.deviceId) + 1) : '-';
    }
    if (synthMidiChEl) {
        synthMidiChEl.textContent = info.midiChannel ? String(info.midiChannel) : '-';
    }
    
    const deviceIdSelect = document.getElementById('settings-device-id');
    if (deviceIdSelect && info.deviceId !== '-') {
        deviceIdSelect.value = String(parseInt(info.deviceId) + 1);
    }
    
    if (connectionTypeEl) {
        connectionTypeEl.textContent = info.connectionType !== '-' && bridge._connected
            ? 'DeepMind 12 (' + info.connectionType + ')'
            : 'No Hardware';
    }
    
    const midiChSel = document.getElementById('settings-midi-channel');
    if (midiChSel && info.midiChannel) {
        midiChSel.value = String(info.midiChannel);
        if (bridge.midiChannel !== info.midiChannel) {
            bridge.midiChannel = info.midiChannel;
            localStorage.setItem('abd-eep-midi-channel', String(info.midiChannel));
        }
    }
    
    const masterTuneSel = document.getElementById('settings-master-tune');
    const globalTune = bridge.getGlobalParameter ? bridge.getGlobalParameter('global_tune') : bridge.parameterCache && bridge.parameterCache['global_tune'];
    if (masterTuneSel && globalTune !== undefined) {
        const tuneCents = Math.round(globalTune * 255 - 128);
        masterTuneSel.value = (tuneCents > 0 ? '+' : '') + tuneCents + '\u00A2';
    }
    
    const transposeSel = document.getElementById('settings-transpose');
    const transposeVal = bridge.getGlobalParameter ? bridge.getGlobalParameter('transpose') : bridge.parameterCache && bridge.parameterCache['transpose'];
    if (transposeSel && transposeVal !== undefined) {
        const transpSemi = Math.round(transposeVal * 96 - 48);
        transposeSel.value = String(transpSemi);
    }
    
    const devIdEl = document.getElementById('settings-global-device-id');
    const midiChGlEl = document.getElementById('settings-global-midi-channel');
    const tuneEl = document.getElementById('settings-global-master-tune');
    const transpEl = document.getElementById('settings-global-transpose');
    
    if (devIdEl) {
        devIdEl.textContent = info.deviceId !== '-' ? String(parseInt(info.deviceId) + 1) : '-';
    }
    if (midiChGlEl) {
        midiChGlEl.textContent = info.midiChannel ? String(info.midiChannel) : '-';
    }
    
    if (tuneEl) {
        const tuneNorm = bridge.getGlobalParameter ? bridge.getGlobalParameter('global_tune') : bridge.parameterCache && bridge.parameterCache['global_tune'];
        tuneEl.textContent = tuneNorm !== undefined
            ? (Math.round(tuneNorm * 255 - 128) > 0 ? '+' : '') + Math.round(tuneNorm * 255 - 128) + '\u00A2'
            : '-';
    }
    
    if (transpEl) {
        const transpNorm = bridge.getGlobalParameter ? bridge.getGlobalParameter('transpose') : bridge.parameterCache && bridge.parameterCache['transpose'];
        transpEl.textContent = transpNorm !== undefined
            ? String(Math.round(transpNorm * 96 - 48)) + ' st'
            : '-';
    }
    
    const velCurveSel = document.getElementById('settings-velocity-curve');
    const velCurveVal = bridge.getGlobalParameter ? bridge.getGlobalParameter('velocity_curve') : bridge.parameterCache && bridge.parameterCache['velocity_curve'];
    if (velCurveSel && velCurveVal !== undefined) {
        const VEL_CURVE_MAP = ['normal', 'soft', 'hard', 'linear', 'fixed'];
        const curveIdx = Math.round(velCurveVal * 4);
        velCurveSel.value = VEL_CURVE_MAP[curveIdx] || 'normal';
    }
    
    const pedalPolSel = document.getElementById('settings-pedal-polarity');
    const pedalPolVal = bridge.getGlobalParameter ? bridge.getGlobalParameter('pedal_polarity') : bridge.parameterCache && bridge.parameterCache['pedal_polarity'];
    if (pedalPolSel && pedalPolVal !== undefined) {
        pedalPolSel.value = pedalPolVal > 0.5 ? 'norm-closed' : 'norm-open';
    }

    const lcdContrastSlider = document.getElementById('settings-lcd-contrast');
    const lcdContrastVal = document.getElementById('settings-lcd-contrast-val');
    const lcdContrastNorm = bridge.getGlobalParameter ? bridge.getGlobalParameter('lcd_contrast') : bridge.parameterCache && bridge.parameterCache['lcd_contrast'];
    if (lcdContrastSlider && lcdContrastNorm !== undefined) {
        const pctVal = Math.round(lcdContrastNorm * 100);
        lcdContrastSlider.value = String(pctVal);
        if (lcdContrastVal) {lcdContrastVal.textContent = pctVal + '%';}
        if (typeof window.updateLcdContrast === 'function') {
            window.updateLcdContrast(pctVal);
        }
    }
    
    const statusEl = document.getElementById('settings-global-status');
    if (statusEl) {
        const hasGlobalDump = bridge._hardwareInfo && bridge._hardwareInfo.globalDumpBytes;
        if (bridge._connected && hasGlobalDump) {
            statusEl.textContent = '\u2705 Global Dump loaded';
            statusEl.classList.remove('status-warning', 'status-error');
            statusEl.classList.add('status-success');
        } else if (bridge._connected) {
            statusEl.textContent = '\u23F3 Awaiting Global Dump...';
            statusEl.classList.remove('status-success', 'status-error');
            statusEl.classList.add('status-warning');
        } else {
            statusEl.textContent = '\u26D4 Hardware disconnected';
            statusEl.classList.remove('status-success', 'status-warning');
            statusEl.classList.add('status-error');
        }
    }
}

// Expose to window
window.updateSettingsHardwareInfo = updateSettingsHardwareInfo;
window._updateSettingsHardwareInfo = updateSettingsHardwareInfo; // legacy alias
window.renderDspCalibration = renderDspCalibration;
