// eslint-disable-next-line no-var
var Logger = globalThis.Logger || console;

/**
 * @purpose Maps raw SysEx payload bytes to normalized UI parameters, updating parameterCache,
 *          C++ DSP APVTS, and Web Audio WASM bridge synchronously upon patch selection.
 * @purpose_en SysEx byte-to-parameter mapper and engine synchronizer.
 */

function triggerMidiDump(patch) {
    if (!patch || !patch.unpackedBytes) {
        Logger.warn('[triggerMidiDump] Invalid patch or missing unpackedBytes');
        return;
    }

    if (window._exitCompareMode && typeof window._exitCompareMode === 'function') {
        window._exitCompareMode();
    }
    Logger.log('[triggerMidiDump] Loading preset:', patch.name);
    
    if (getBridge()) {
        if (typeof getBridge()._resetNrpnCache === 'function') {
            getBridge()._resetNrpnCache();
        } else {
            getBridge()._lastNrpnMsb = null;
            getBridge()._lastNrpnLsb = null;
            getBridge()._lastNrpnValue = null;
            getBridge()._lastNrpnByte = null;
            getBridge()._nrpnInMsb = null;
            getBridge()._nrpnInLsb = null;
            getBridge()._nrpnInDataMsb = 0;
            getBridge()._nrpnInTimestamp = 0;
        }
    }
    
    const lcdText = document.getElementById('lcd-text');
    if (lcdText) { lcdText.innerText = patch.name.toUpperCase(); }

    if (getBridge() && getBridge().midiOutput) {
        try {
            const packedPayload = window.pack8to7(patch.unpackedBytes);
            const sysexMessage = new Uint8Array(291);
            sysexMessage[0] = 0xF0;
            sysexMessage[1] = 0x00;
            sysexMessage[2] = 0x20;
            sysexMessage[3] = 0x32;
            sysexMessage[4] = 0x20;
            sysexMessage[5] = 0x7F;
            sysexMessage[6] = 0x02;
            sysexMessage[7] = 0x07;
            sysexMessage.set(packedPayload, 8);
            sysexMessage[290] = 0xF7;
            getBridge().midiOutput.send(sysexMessage);
        } catch (e) {
            Logger.warn('[triggerMidiDump] Error sending MIDI SysEx to HW:', e);
        }
    }

    const b = patch.unpackedBytes;
    const mappings = {};
    if (window.BRIDGE_PARAM_MAPS) {
        for (const [paramId, byteOffset] of Object.entries(window.BRIDGE_PARAM_MAPS.PARAM_TO_BYTE_OFFSET)) {
            if (byteOffset < 300) {
                const rawVal = b[byteOffset] !== undefined ? b[byteOffset] : 0;
                mappings[paramId] = window.BRIDGE_PARAM_MAPS.rawToNormalized(byteOffset, rawVal);
            }
        }
    }

    // Custom defaults
    mappings['chord_enable'] = 0.0;
    mappings['poly_chord_enable'] = 0.0;
    mappings['chord_key'] = 0.0;
    mappings['chord_type'] = 0.0;

    // ModMatrix Extended Slots (9..32)
    const patchParams = patch.params || patch.parameterState || {};
    for (let slot = 9; slot <= 32; slot++) {
        const srcVal = patchParams[`mod_matrix_slot${slot}_src`] !== undefined ? patchParams[`mod_matrix_slot${slot}_src`] : 0.0;
        const destVal = patchParams[`mod_matrix_slot${slot}_dest`] !== undefined ? patchParams[`mod_matrix_slot${slot}_dest`] : 0.0;
        const depthVal = patchParams[`mod_matrix_slot${slot}_depth`] !== undefined ? patchParams[`mod_matrix_slot${slot}_depth`] : 0.5;

        mappings[`mod_matrix_slot${slot}_src`] = srcVal;
        mappings[`mod_matrix_slot${slot}_dest`] = destVal;
        mappings[`mod_matrix_slot${slot}_depth`] = depthVal;
    }

    // Synchronously populate parameterCache and invoke callbacks
    const paramEntries = Object.entries(mappings);
    paramEntries.forEach(([paramId, rawVal]) => {
        try {
            const val = Math.max(0, Math.min(1, rawVal));
            if (getBridge()) {
                getBridge().parameterCache[paramId] = val;
            }
            if (window.wasmBridge && typeof window.wasmBridge.setParameter === 'function') {
                window.wasmBridge.setParameter(paramId, val);
            }
        } catch (e) {
            Logger.warn('[triggerMidiDump] Error updating cache for', paramId, e);
        }
    });

    // Notify C++ backend or bridge callbacks
    if (getBridge()) {
        paramEntries.forEach(([paramId, rawVal]) => {
            const val = Math.max(0, Math.min(1, rawVal));
            if (getBridge().isJuce) {
                try {
                    getBridge().setParameter(paramId, val, true);
                } catch (e) {}
            }
            getBridge().onParameterChangedCallbacks.forEach(cb => {
                try { cb(paramId, val); } catch (e) {}
            });
        });
    }

    try {
        const savedVcaMode = localStorage.getItem('abd-eep-vca-mode');
        if (savedVcaMode && getBridge()) {
            const vcaVal = savedVcaMode === 'ballsy' ? 1.0 : 0.0;
            getBridge().parameterCache['vca_mode'] = vcaVal;
            if (getBridge().isJuce) {
                getBridge().setParameter('vca_mode', vcaVal, true);
            }
        }
    } catch(e) {}

    // Clear dirty flag on patch load (from browser, program change, or SysEx dump)
    if (getBridge()) {
        getBridge().parameterCache['patch_dirty'] = 0;
        if (getBridge().isJuce && window.juce && typeof window.juce.setParameter === 'function') {
            window.juce.setParameter('patch_dirty', 0);
        }
    }

    window._lastUnpackedBytes = patch.unpackedBytes;
    window._lastPresetName = patch.name;

    // Refresh UI sliders and controls for the loaded preset
    try {
        if (typeof window.updateLfoSlidersFromCurrentPreset === 'function') { window.updateLfoSlidersFromCurrentPreset(); }
        if (typeof window.updateEnvSlidersFromCurrentPreset === 'function') { window.updateEnvSlidersFromCurrentPreset(); }
        if (typeof window.updateOscSlidersFromCurrentPreset === 'function') { window.updateOscSlidersFromCurrentPreset(); }
        if (typeof updateSysExMonitor === 'function') { updateSysExMonitor(patch.unpackedBytes); }
        if (typeof window.bindAllPanelControls === 'function') { window.bindAllPanelControls(); }
    } catch (e) {
        Logger.warn('[triggerMidiDump] Error updating sliders', e);
    }
}

window.triggerMidiDump = triggerMidiDump;
