/**
 * @purpose Maps raw SysEx payload bytes to normalized UI parameters, sending staggered updates to the C++ DSP engine.
 * @purpose_en SysEx byte-to-parameter mapper.
 */

function triggerMidiDump(patch) {
    if (window._exitCompareMode && typeof window._exitCompareMode === 'function') {
        window._exitCompareMode();
    }
    console.log('[triggerMidiDump] Cargando preset:', patch.name);
    
    if (window.dualMidiBridge) {
        if (typeof window.dualMidiBridge._resetNrpnCache === 'function') {
            window.dualMidiBridge._resetNrpnCache();
        } else {
            window.dualMidiBridge._lastNrpnMsb = null;
            window.dualMidiBridge._lastNrpnLsb = null;
            window.dualMidiBridge._lastNrpnValue = null;
            window.dualMidiBridge._lastNrpnByte = null;
            window.dualMidiBridge._nrpnInMsb = null;
            window.dualMidiBridge._nrpnInLsb = null;
            window.dualMidiBridge._nrpnInDataMsb = 0;
            window.dualMidiBridge._nrpnInTimestamp = 0;
        }
    }
    
    const lcdText = document.getElementById('lcd-text');
    if (lcdText) {lcdText.innerText = patch.name.toUpperCase();}

    if (window.dualMidiBridge && window.dualMidiBridge.midiOutput) {
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
        window.dualMidiBridge.midiOutput.send(sysexMessage);
    }

    const b = patch.unpackedBytes;
    
    const norm = (val, min, max) => Math.max(0, Math.min(1, (val - min) / (max - min)));
    const byteToSec = (byteVal) => byteVal === 0 ? 0.0 : (byteVal / 255.0);
    
    const mappings = {};
    if (window.BRIDGE_PARAM_MAPS) {
        for (const [paramId, byteOffset] of Object.entries(window.BRIDGE_PARAM_MAPS.PARAM_TO_BYTE_OFFSET)) {
            if (byteOffset < 300) {
                const rawVal = b[byteOffset] !== undefined ? b[byteOffset] : 0;
                mappings[paramId] = window.BRIDGE_PARAM_MAPS.rawToNormalized(byteOffset, rawVal);
            }
        }
    }
    // Custom/chord parameters defaults
    mappings['chord_enable'] = 0.0;
    mappings['poly_chord_enable'] = 0.0;
    mappings['chord_key'] = 0.0;
    mappings['chord_type'] = 0.0;

    const paramEntries = Object.entries(mappings);
    paramEntries.forEach(([paramId, rawVal]) => {
        try {
            const val = Math.max(0, Math.min(1, rawVal));
            if (window.dualMidiBridge) {
                window.dualMidiBridge.parameterCache[paramId] = val;
                window.dualMidiBridge.onParameterChangedCallbacks.forEach(cb => {
                    try { cb(paramId, val); } catch (e) {}
                });
            }
        } catch (e) {
            console.warn('[triggerMidiDump] Error actualizando UI para', paramId, e);
        }
    });
    
    try {
        const savedVcaMode = localStorage.getItem('abd-eep-vca-mode');
        if (savedVcaMode && window.dualMidiBridge) {
            const vcaVal = savedVcaMode === 'ballsy' ? 1.0 : 0.0;
            window.dualMidiBridge.parameterCache['vca_mode'] = vcaVal;
            window.dualMidiBridge.onParameterChangedCallbacks.forEach(function(cb) {
                try { cb('vca_mode', vcaVal); } catch(e) {}
            });
        }
    } catch(e) {}

    if (window.dualMidiBridge && window.dualMidiBridge.isJuce && window.dualMidiBridge._ready) {
        // Limpiar cache antes de la carga forzada para garantizar que todos los params llegan al DSP
        paramEntries.forEach(([paramId]) => {
            delete window.dualMidiBridge.parameterCache[paramId];
        });
        paramEntries.forEach(([paramId, rawVal], index) => {
            const val = Math.max(0, Math.min(1, rawVal));
            setTimeout(() => {
                try {
                    window.dualMidiBridge.setParameter(paramId, val, true); // forceResend = true
                } catch (e) {
                    console.warn('[triggerMidiDump] Error setParameter', paramId, e);
                }
            }, index * 5);
        });
        setTimeout(() => {
            try {
                const _vca = window.dualMidiBridge.parameterCache['vca_mode'] || 0.0;
                window.dualMidiBridge.setParameter('vca_mode', _vca, true);
            } catch (e) {
                console.warn('[triggerMidiDump] Error setParameter vca_mode', e);
            }
        }, paramEntries.length * 5 + 10);
        console.log('[triggerMidiDump] Enviando ' + paramEntries.length + ' parámetros + vca_mode al backend C++ (forzado)');
    }

    window._lastUnpackedBytes = patch.unpackedBytes;
    window._lastPresetName = patch.name;

    try {
        if (typeof window.updateLfoSlidersFromCurrentPreset === 'function') {window.updateLfoSlidersFromCurrentPreset();}
        if (typeof window.updateEnvSlidersFromCurrentPreset === 'function') {window.updateEnvSlidersFromCurrentPreset();}
        if (typeof window.updateOscSlidersFromCurrentPreset === 'function') {window.updateOscSlidersFromCurrentPreset();}
        if (typeof updateSysExMonitor === 'function') {updateSysExMonitor(patch.unpackedBytes);}
    } catch (e) {
        console.warn('[triggerMidiDump] Error en slider updates', e);
    }
}

window.triggerMidiDump = triggerMidiDump;
