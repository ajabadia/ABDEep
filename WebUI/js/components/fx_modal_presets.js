/**
 * @component fx-modal-presets
 * @purpose Preset CRUD and I/O operations for Effects Engine Rack modal
 * @classification UI Component Submodule
 */
(function() {
    const FX_STORAGE_KEY = 'abd-eep-fx-presets';

    function _loadAllFxPresets() {
        try {
            const raw = localStorage.getItem(FX_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) { return parsed; }
            }
        } catch (e) { /* ignore */ }
        return [];
    }

    function _saveAllFxPresets(arr) {
        try { localStorage.setItem(FX_STORAGE_KEY, JSON.stringify(arr)); }
        catch (e) { /* quota */ }
    }

    function _readCurrentFxSlotState(slot) {
        const state = window.deepmindState || {};
        const effectIndex = state[`fx${slot}.effect`] || 0;
        const gain = state[`fx${slot}.gain`] !== undefined ? state[`fx${slot}.gain`] : 1.0;
        const params = [];
        for (let i = 1; i <= 12; i++) {
            params.push(state[`fx${slot}.param${i}`] !== undefined ? state[`fx${slot}.param${i}`] : 0.5);
        }
        return { effectIndex, gain, params };
    }

    function _applyFxPresetToSlot(slot, presetIndex) {
        const allPresets = typeof window._loadAllFxPresets === 'function' ? window._loadAllFxPresets() : _loadAllFxPresets();
        const preset = allPresets[presetIndex];
        if (!preset) { return; }

        if (typeof window.applyFxPreset === 'function') {
            window.applyFxPreset(preset, slot);
            return;
        }

        const sendParamToSynth = window.sendParamToSynth || function() {};
        const state = window.deepmindState || {};
        const effectIndex = Math.round(preset.type * 56);

        state[`fx${slot}.effect`] = effectIndex;
        sendParamToSynth(`fx${slot}.effect`, effectIndex);

        state[`fx${slot}.gain`] = preset.gain;
        sendParamToSynth(`fx${slot}.gain`, preset.gain);

        for (let i = 0; i < 12; i++) {
            const paramName = `fx${slot}.param${i + 1}`;
            state[paramName] = preset.params[i];
            sendParamToSynth(paramName, preset.params[i]);
        }

        const sel = document.querySelector(`.fx-type-select[data-slot="${slot}"]`);
        if (sel) { sel.value = effectIndex; }

        const display = document.getElementById(`fx${slot}-type-mini-display`);
        const labels = window.FX_TYPE_LABELS || {};
        if (display) { display.textContent = labels[effectIndex] || '---'; }

        if (typeof window.syncFxSlotFromState === 'function') {
            window.syncFxSlotFromState(slot);
        }
    }

    function _saveFxPresetFromSlot(slot) {
        const name = prompt('Preset name:');
        if (!name || !name.trim()) { return; }

        if (typeof window.saveFxPreset === 'function') {
            window.saveFxPreset(name, slot);
            _loadPresetDropdowns();
            return;
        }

        const slotState = _readCurrentFxSlotState(slot);
        const preset = {
            name: name.trim().replace(/[<>"'&]/g, ''),
            slot: slot,
            type: slotState.effectIndex / 56.0,
            params: slotState.params,
            gain: slotState.gain,
            created: Date.now()
        };

        const allPresets = _loadAllFxPresets();
        let existingIdx = -1;
        for (let j = 0; j < allPresets.length; j++) {
            if (allPresets[j].name === preset.name && allPresets[j].slot === slot) {
                existingIdx = j;
                break;
            }
        }
        if (existingIdx >= 0) { allPresets[existingIdx] = preset; }
        else { allPresets.push(preset); }

        _saveAllFxPresets(allPresets);
        _loadPresetDropdowns();
    }

    function _deleteFxPresetByIndex(presetIndex) {
        const allPresets = typeof window._loadAllFxPresets === 'function' ? window._loadAllFxPresets() : _loadAllFxPresets();
        const preset = allPresets[presetIndex];
        if (!preset) { return; }

        if (typeof window.deleteFxPreset === 'function') {
            window.deleteFxPreset(preset.name);
            _loadPresetDropdowns();
            return;
        }

        if (!confirm('Delete this preset?')) { return; }
        allPresets.splice(presetIndex, 1);
        _saveAllFxPresets(allPresets);
        _loadPresetDropdowns();
    }

    function _loadPresetDropdowns() {
        const allPresets = typeof window._loadAllFxPresets === 'function' ? window._loadAllFxPresets() : _loadAllFxPresets();
        document.querySelectorAll('.fx-preset-select').forEach(sel => {
            const slot = parseInt(sel.dataset.slot);
            const typeSelect = document.querySelector(`.fx-type-select[data-slot="${slot}"]`);
            let currentEffect = 0;
            if (typeSelect && typeSelect.value !== '') {
                currentEffect = parseInt(typeSelect.value);
            } else if (typeof window._readFxParamValue === 'function') {
                const offsetType = slot === 1 ? 166 : (slot === 2 ? 179 : (slot === 3 ? 192 : 205));
                const normVal = window._readFxParamValue(`fx${slot}_type`, offsetType, 0.0);
                currentEffect = Math.round(normVal * 56.0);
            }

            const prev = sel.value;
            sel.innerHTML = '<option value="" disabled selected>-- Select Preset --</option>';

            let count = 0;
            allPresets.forEach((preset, idx) => {
                let presetEffect = 0;
                if (preset.type <= 1.0) {
                    presetEffect = Math.round(preset.type * 56.0);
                } else {
                    presetEffect = Math.round(preset.type);
                }

                if (presetEffect !== currentEffect) { return; }
                const opt = document.createElement('option');
                opt.value = idx;
                opt.textContent = preset.name || ('Preset ' + (idx + 1));
                sel.appendChild(opt);
                count++;
            });

            if (count === 0) {
                const opt = document.createElement('option');
                opt.value = '';
                opt.disabled = true;
                opt.textContent = '(No presets for this FX)';
                sel.appendChild(opt);
            }

            if (prev !== '' && sel.querySelector(`option[value="${prev}"]`)) {
                sel.value = prev;
            }
        });
    }

    function _importFxPresetFromFile(slot) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) {return;}
            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const data = JSON.parse(evt.target.result);
                    const preset = Array.isArray(data) ? data[0] : data;
                    if (preset && preset.name && preset.params) {
                        if (typeof window.applyFxPreset === 'function') {
                            window.applyFxPreset(preset, slot);
                        }
                        if (typeof window.saveFxPreset === 'function') {
                            window.saveFxPreset(preset.name, slot);
                        }
                        _loadPresetDropdowns();
                        alert(`Preset "${preset.name}" cargado e importado correctamente.`);
                    } else {
                        alert('El archivo JSON no tiene una estructura válida de preset de FX.');
                    }
                } catch (err) {
                    alert('Error al leer el archivo de preset: ' + err.message);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    window._loadAllFxPresets = _loadAllFxPresets;
    window._saveAllFxPresets = _saveAllFxPresets;
    window._readCurrentFxSlotState = _readCurrentFxSlotState;
    window._applyFxPresetToSlot = _applyFxPresetToSlot;
    window._saveFxPresetFromSlot = _saveFxPresetFromSlot;
    window._deleteFxPresetByIndex = _deleteFxPresetByIndex;
    window._loadPresetDropdowns = _loadPresetDropdowns;
    window._importFxPresetFromFile = _importFxPresetFromFile;
    window.syncFxPresetDropdowns = function() { _loadPresetDropdowns(); };
})();
