/**
 * @purpose Handles local storage persistence of FX parameters presets.
 * @purpose_en FX presets library service.
 */

window.saveFxPreset = function(presetName, slotNumber) {
    if (!presetName || presetName.trim() === '') return;
    presetName = presetName.trim().replace(/[<>"'&]/g, '');
    if (!presetName) return;
    slotNumber = slotNumber || window._selectedFxSlot || 1;
    var bridge = window.dualMidiBridge;
    if (!bridge || !bridge.parameterCache) return;
    
    var preset = {
        name: presetName.trim(),
        slot: slotNumber,
        type: window._readFxParamValue('fx' + slotNumber + '_type', slotNumber === 1 ? 166 : (slotNumber === 2 ? 179 : (slotNumber === 3 ? 192 : 205)), 0.0),
        params: [],
        created: Date.now()
    };
    for (var i = 1; i <= 12; i++) {
        var offsetStart = slotNumber === 1 ? 167 : (slotNumber === 2 ? 180 : (slotNumber === 3 ? 193 : 206));
        preset.params.push(window._readFxParamValue('fx' + slotNumber + '_param' + i, offsetStart + i - 1, 0.5));
    }
    preset.gain = window._readFxParamValue('fx' + slotNumber + '_gain', slotNumber === 1 ? 218 : (slotNumber === 2 ? 219 : (slotNumber === 3 ? 220 : 221)), 1.0);
    
    var allPresets = _loadAllFxPresets();
    var existingIdx = -1;
    for (var j = 0; j < allPresets.length; j++) {
        if (allPresets[j].name === preset.name) {
            existingIdx = j;
            break;
        }
    }
    if (existingIdx >= 0) {
        allPresets[existingIdx] = preset;
    } else {
        allPresets.push(preset);
    }
    
    try {
        localStorage.setItem('abd-eep-fx-presets', JSON.stringify(allPresets));
    } catch (e) {
        console.warn('[FX Presets] Error saving to localStorage:', e);
    }
    
    _renderFxPresetList();
    
    if (typeof window.lcdSafeUpdate === 'function') {
        var lcd = document.getElementById('lcd-screen-main');
        if (lcd) window.lcdSafeUpdate(lcd, 'FX Preset Saved: ' + preset.name, null, { useQueue: false });
    }
};

const DEFAULT_FX_PRESETS = [
    {
        name: "Lush Chorus-D",
        slot: 1,
        type: 29 / 35.0,
        gain: 1.0,
        params: [0.35, 0.40, 0.50, 0.20, 0.80, 0.10, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50],
        created: 1720000000000
    },
    {
        name: "Stereo Delay PingPong",
        slot: 1,
        type: 22 / 35.0,
        gain: 0.8,
        params: [0.50, 0.75, 0.45, 0.30, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50],
        created: 1720000000001
    },
    {
        name: "TC Deep Reverb Hall",
        slot: 1,
        type: 2 / 35.0,
        gain: 0.9,
        params: [0.15, 0.70, 0.80, 0.50, 0.35, 0.60, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50],
        created: 1720000000002
    },
    {
        name: "Vintage Room Ambience",
        slot: 1,
        type: 4 / 35.0,
        gain: 1.0,
        params: [0.05, 0.35, 0.40, 0.60, 0.50, 0.50, 0.10, 0.90, 0.50, 0.50, 0.50, 0.50],
        created: 1720000000003
    },
    {
        name: "Lush Stereo Phaser",
        slot: 1,
        type: 31 / 35.0,
        gain: 1.0,
        params: [0.20, 0.65, 0.40, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50],
        created: 1720000000004
    }
];

function _loadAllFxPresets() {
    try {
        var raw = localStorage.getItem('abd-eep-fx-presets');
        if (raw) {
            var parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
        } else {
            // Guardar por defecto para arrancar con presets de ejemplo
            localStorage.setItem('abd-eep-fx-presets', JSON.stringify(DEFAULT_FX_PRESETS));
            return JSON.parse(JSON.stringify(DEFAULT_FX_PRESETS));
        }
    } catch (e) {}
    return [];
}
window._loadAllFxPresets = _loadAllFxPresets;

window.applyFxPreset = function(presetData, slotNumber) {
    slotNumber = slotNumber || window._selectedFxSlot || 1;
    var bridge = window.dualMidiBridge;
    if (!bridge) return;
    
    bridge.setParameter('fx' + slotNumber + '_type', presetData.type);
    
    for (var i = 0; i < 12 && i < presetData.params.length; i++) {
        bridge.setParameter('fx' + slotNumber + '_param' + (i + 1), presetData.params[i]);
    }
    
    if (presetData.gain !== undefined) {
        bridge.setParameter('fx' + slotNumber + '_gain', presetData.gain);
    }
    
    var selectEl = document.querySelector('.fx-type-select[data-slot="' + slotNumber + '"]');
    if (selectEl) {
        var typeVal = Math.round(presetData.type * 35.0);
        selectEl.value = typeVal;
        var displayEl = document.getElementById('fx' + slotNumber + '-type-mini-display');
        if (displayEl) displayEl.innerText = window.FX_TYPE_NAMES[typeVal] || 'Bypass';
    }
    if (typeof window._setGainSliderPos === 'function') {
        window._setGainSliderPos('fx' + slotNumber + '_gain', slotNumber === 1 ? 218 : (slotNumber === 2 ? 219 : (slotNumber === 3 ? 220 : 221)));
    }
    
    if (slotNumber === window._selectedFxSlot) {
        if (typeof window.renderActiveEffectParams === 'function') {
            window.renderActiveEffectParams();
        }
    }
    
    if (typeof window.lcdSafeUpdate === 'function') {
        var lcd = document.getElementById('lcd-screen-main');
        if (lcd) window.lcdSafeUpdate(lcd, 'FX Preset Loaded: ' + presetData.name + ' → FX' + slotNumber, null, { useQueue: false });
    }
};

window.deleteFxPreset = function(presetName) {
    var allPresets = _loadAllFxPresets();
    var filtered = [];
    for (var i = 0; i < allPresets.length; i++) {
        if (allPresets[i].name !== presetName) {
            filtered.push(allPresets[i]);
        }
    }
    if (filtered.length !== allPresets.length) {
        try {
            localStorage.setItem('abd-eep-fx-presets', JSON.stringify(filtered));
        } catch (e) {}
        _renderFxPresetList();
    }
};

function _renderFxPresetList() {
    var listEl = document.getElementById('fx-preset-list');
    if (!listEl) return;
    var presets = _loadAllFxPresets();
    if (presets.length === 0) {
        listEl.innerHTML = '<div style="color:var(--text-faint);font-size:var(--text-xs);padding:4px;text-align:center">No FX presets saved yet</div>';
        return;
    }
    var html = '';
    for (var i = presets.length - 1; i >= 0; i--) {
        var p = presets[i];
        var typeName = window.FX_TYPE_NAMES[Math.round(p.type * 35)] || 'Bypass';
        html += '<div class="fx-preset-item" data-preset-index="' + i + '" style="display:flex;justify-content:space-between;align-items:center;padding:3px 4px;border-bottom:1px solid var(--bg-hover);gap:4px">' +
            '<div style="flex:1;min-width:0;font-size:var(--text-xs);cursor:pointer" title="Apply ' + escapeHtml(p.name) + ' to FX' + (window._selectedFxSlot || 1) + '">' +
                '<span style="font-weight:bold;color:var(--accent-blue)">' + escapeHtml(p.name) + '</span> ' +
                '<span style="color:var(--text-faint);font-size:8px">' + escapeHtml(typeName) + '</span>' +
            '</div>' +
            '<button class="btn btn-xs fx-preset-delete-btn" style="font-size:8px;padding:1px 4px" data-ctrl-tooltip="Delete preset">✕</button>' +
        '</div>';
    }
    listEl.innerHTML = html;

    listEl.querySelectorAll('.fx-preset-item').forEach(function(item) {
        var idx = parseInt(item.getAttribute('data-preset-index'));
        if (isNaN(idx) || idx < 0 || idx >= presets.length) return;
        item.querySelector('div[title]').addEventListener('click', function() {
            window.applyFxPreset(presets[idx], window._selectedFxSlot || 1);
        });
        var delBtn = item.querySelector('.fx-preset-delete-btn');
        if (delBtn) {
            delBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                window.deleteFxPreset(presets[idx].name);
            });
        }
    });
}
window._renderFxPresetList = _renderFxPresetList;

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

window.findMatchingFxPresetName = function(type, gain, params) {
    if (type === 0.0) return "Bypass";
    
    // Buscar en presets de usuario primero
    var userPresets = _loadAllFxPresets();
    for (var i = 0; i < userPresets.length; i++) {
        var p = userPresets[i];
        if (Math.round(p.type * 35) === Math.round(type * 35)) {
            var match = true;
            if (Math.abs(p.gain - gain) > 0.03) match = false;
            for (var j = 0; j < 12 && j < p.params.length; j++) {
                if (Math.abs(p.params[j] - params[j]) > 0.03) {
                    match = false;
                    break;
                }
            }
            if (match) return p.name;
        }
    }
    
    // Buscar en presets de fábrica (FACTORY_FX_PRESETS)
    if (window.FACTORY_FX_PRESETS) {
        for (var i = 0; i < window.FACTORY_FX_PRESETS.length; i++) {
            var p = window.FACTORY_FX_PRESETS[i];
            if (Math.round(p.type * 35) === Math.round(type * 35)) {
                var match = true;
                if (Math.abs(p.gain - gain) > 0.03) match = false;
                for (var j = 0; j < 12 && j < p.params.length; j++) {
                    if (Math.abs(p.params[j] - params[j]) > 0.03) {
                        match = false;
                        break;
                    }
                }
                if (match) return p.name;
            }
        }
    }
    return null;
};

window.extractAndSaveNewPresetsFromBank = function(bankName, patches) {
    if (!Array.isArray(patches)) return;
    
    var userFxPresets = _loadAllFxPresets();
    var userSeqPresets = typeof window._loadUserSeqPresets === 'function' ? window._loadUserSeqPresets() : [];
    var newFxCount = 0;
    var newSeqCount = 0;

    patches.forEach(function(patch) {
        if (!patch || !patch.unpackedBytes) return;
        var b = patch.unpackedBytes;
        
        // 1. Escanear ranuras FX
        const fxSlots = [
            { id: 1, typeByte: 166, paramStart: 167, gainByte: 218 },
            { id: 2, typeByte: 179, paramStart: 180, gainByte: 219 },
            { id: 3, typeByte: 192, paramStart: 193, gainByte: 220 },
            { id: 4, typeByte: 205, paramStart: 206, gainByte: 221 }
        ];

        fxSlots.forEach(function(slot) {
            var typeVal = b[slot.typeByte];
            if (typeVal > 0 && typeVal < window.FX_TYPE_NAMES.length) {
                var typeName = window.FX_TYPE_NAMES[typeVal];
                var typeValNorm = typeVal / 35.0;
                var gain = b[slot.gainByte] / 255.0;
                var params = [];
                for (var p = 0; p < 12; p++) {
                    params.push(b[slot.paramStart + p] / 255.0);
                }

                // Check si ya existe en presets de fábrica o de usuario
                var alreadyExists = false;
                if (window.FACTORY_FX_PRESETS) {
                    for (var i = 0; i < window.FACTORY_FX_PRESETS.length; i++) {
                        var fp = window.FACTORY_FX_PRESETS[i];
                        if (Math.round(fp.type * 35) === typeVal) {
                            var match = true;
                            if (Math.abs(fp.gain - gain) > 0.03) match = false;
                            for (var j = 0; j < 12; j++) {
                                if (Math.abs(fp.params[j] - params[j]) > 0.03) {
                                    match = false;
                                    break;
                                }
                            }
                            if (match) { alreadyExists = true; break; }
                        }
                    }
                }
                if (!alreadyExists) {
                    for (var i = 0; i < userFxPresets.length; i++) {
                        var up = userFxPresets[i];
                        if (Math.round(up.type * 35) === typeVal) {
                            var match = true;
                            if (Math.abs(up.gain - gain) > 0.03) match = false;
                            for (var j = 0; j < 12; j++) {
                                if (Math.abs(up.params[j] - params[j]) > 0.03) {
                                    match = false;
                                    break;
                                }
                            }
                            if (match) { alreadyExists = true; break; }
                        }
                    }
                }

                if (!alreadyExists) {
                    var presetName = typeName + " (" + patch.name + ")";
                    userFxPresets.push({
                        name: presetName,
                        slot: slot.id,
                        type: typeValNorm,
                        gain: gain,
                        params: params,
                        created: Date.now()
                    });
                    newFxCount++;
                }
            }
        });

        // 2. Escanear pasos del secuenciador
        var steps = [];
        var max = 0;
        var min = 255;
        var isZero = true;
        for (var s = 0; s < 32; s++) {
            var val = b[123 + s];
            steps.push(val);
            if (val !== 128) isZero = false;
            if (val > max) max = val;
            if (val < min) min = val;
        }

        if (!isZero && (max - min) >= 15) {
            var alreadyExists = false;
            if (window.FACTORY_SEQ_PRESETS) {
                for (var i = 0; i < window.FACTORY_SEQ_PRESETS.length; i++) {
                    var fp = window.FACTORY_SEQ_PRESETS[i];
                    var match = true;
                    for (var j = 0; j < 32; j++) {
                        if (Math.abs(fp.steps[j] - steps[j]) > 5) {
                            match = false;
                            break;
                        }
                    }
                    if (match) { alreadyExists = true; break; }
                }
            }
            if (!alreadyExists) {
                for (var i = 0; i < userSeqPresets.length; i++) {
                    var up = userSeqPresets[i];
                    var match = true;
                    for (var j = 0; j < 32; j++) {
                        if (Math.abs(up.steps[j] - steps[j]) > 5) {
                            match = false;
                            break;
                        }
                    }
                    if (match) { alreadyExists = true; break; }
                }
            }

            if (!alreadyExists) {
                var presetName = patch.name + " Seq";
                userSeqPresets.push({
                    name: presetName,
                    steps: steps
                });
                newSeqCount++;
            }
        }
    });

    if (newFxCount > 0) {
        localStorage.setItem('abd-eep-fx-presets', JSON.stringify(userFxPresets));
        if (typeof window._renderFxPresetList === 'function') window._renderFxPresetList();
    }
    if (newSeqCount > 0) {
        localStorage.setItem('abd-eep-seq-presets', JSON.stringify(userSeqPresets));
        if (typeof window.initSequencerPresets === 'function') window.initSequencerPresets();
    }

    if (newFxCount > 0 || newSeqCount > 0) {
        console.log("[AutoExtractor] Extracted from bank '" + bankName + "': " + newFxCount + " new FX presets and " + newSeqCount + " new Sequence presets.");
    }
};
