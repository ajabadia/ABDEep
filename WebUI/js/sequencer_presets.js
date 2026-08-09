/**
 * @purpose Handles loading, applying, and saving Control Sequencer presets.
 * @purpose_en Control Sequencer presets service.
 */

const DEFAULT_SEQ_PRESETS = [
    {
        name: 'Staircase',
        steps: Array(32).fill(0).map((_, i) => Math.round((i / 31) * 255))
    },
    {
        name: 'Triangle Wave',
        steps: Array(32).fill(0).map((_, i) => {
            const phase = (i / 16) % 2.0;
            const val = phase < 1.0 ? phase : 2.0 - phase;
            return Math.round(val * 255);
        })
    },
    {
        name: 'Random Walk',
        steps: Array(32).fill(0).map(() => Math.round(Math.random() * 255))
    }
];

function _loadUserSeqPresets() {
    try {
        const raw = localStorage.getItem('abd-eep-seq-presets');
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                let allValid = true;
                const sanitized = parsed.map(p => {
                    if (!p || !Array.isArray(p.steps) || p.steps.length !== 32) {
                        allValid = false;
                        const match = DEFAULT_SEQ_PRESETS.find(d => d.name === (p && p.name));
                        return match ? { name: p.name, steps: match.steps } : { name: (p && p.name) || 'Preset', steps: Array(32).fill(0).map((_, i) => Math.round((i / 31) * 255)) };
                    }
                    return p;
                });
                if (!allValid) {
                    localStorage.setItem('abd-eep-seq-presets', JSON.stringify(sanitized));
                }
                return sanitized;
            }
        }
    } catch (e) {}
    localStorage.setItem('abd-eep-seq-presets', JSON.stringify(DEFAULT_SEQ_PRESETS));
    return DEFAULT_SEQ_PRESETS;
}
window._loadUserSeqPresets = _loadUserSeqPresets;

window.initSequencerPresets = function() {
    const presetsList = document.getElementById('modal-seq-presets-list');
    const loadPresetBtn = document.getElementById('modal-seq-load-preset');
    const savePresetBtn = document.getElementById('modal-seq-save-preset');

    function renderPresetsList() {
        if (!presetsList) {return;}
        presetsList.innerHTML = '';

        // Render User Presets
        const userPresets = _loadUserSeqPresets();
        userPresets.forEach((p, _idx) => {
            const item = document.createElement('div');
            item.className = 'preset-item seq-preset-list-item text-sm text-primary';
            // Fase 3 (§4.1): p.name proviene de localStorage (dato externo) → escapar
            item.innerHTML = `<span style="font-weight:bold;color:var(--accent-pink)">${escapeHtml(p.name)}</span>` +
                             '<span class="delete-seq-preset-btn" style="color:var(--text-faint);font-size:10px;cursor:pointer;padding:0 4px;">✕</span>';
            
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-seq-preset-btn')) {return;}
                selectItem(item, p);
            });
            item.addEventListener('dblclick', (e) => {
                if (e.target.classList.contains('delete-seq-preset-btn')) {return;}
                selectItem(item, p);
                if (loadPresetBtn) {loadPresetBtn.click();}
            });

            const delBtn = item.querySelector('.delete-seq-preset-btn');
            if (delBtn) {
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteSeqPreset(p.name);
                });
            }

            presetsList.appendChild(item);
        });

        // Render Factory Presets (from factory_seq_presets.js)
        if (window.FACTORY_SEQ_PRESETS) {
            window.FACTORY_SEQ_PRESETS.forEach(p => {
                const item = document.createElement('div');
                item.className = 'preset-item seq-preset-list-item text-sm text-primary';
                item.innerHTML = `<span style="color:var(--text-dim)">${escapeHtml(p.name)}</span> <span style="font-size:8px;color:var(--text-faint)">Factory</span>`;
                
                item.addEventListener('click', () => {
                    selectItem(item, p);
                });
                item.addEventListener('dblclick', () => {
                    selectItem(item, p);
                    if (loadPresetBtn) {loadPresetBtn.click();}
                });

                presetsList.appendChild(item);
            });
        }
    }

    let selectedPreset = null;

    function applyPreset(presetObj) {
        if (!presetObj) {return;}
        let steps = presetObj.steps;
        if (!Array.isArray(steps) || steps.length !== 32) {
            const match = DEFAULT_SEQ_PRESETS.find(d => d.name === presetObj.name);
            steps = match ? match.steps : Array(32).fill(0).map((_, i) => Math.round((i / 31) * 255));
        }

        for (let i = 0; i < 32; i++) {
            const rawByte = Math.max(0, Math.min(255, steps[i]));
            window.seqStepsRaw[i] = rawByte;
            window.seqStepsValues[i] = rawByte === 0 ? 0 : rawByte - 128;
            
            const activeBank = (window.loadedBanks && window.currentActiveBank) ? window.loadedBanks[window.currentActiveBank] : null;
            const patch = (activeBank && window.currentActivePatchIndex !== -1) ? activeBank[window.currentActivePatchIndex] : null;
            if (patch && patch.unpackedBytes) {
                patch.unpackedBytes[123 + i] = rawByte;
            }

            const normalized = rawByte / 255.0;
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter(`seq_step_${i + 1}`, normalized);
            }
            if (typeof window.updateStepVisual === 'function') {
                window.updateStepVisual(i);
            }
        }
        if (typeof window.syncSeqCanvasFromValues === 'function') {
            window.syncSeqCanvasFromValues();
        }
        
        const _presetName_ = presetObj.name;
        const _lcd_ = document.getElementById('lcd-text');
        if (_lcd_) {
            let _sum_ = 0, _count_ = 0;
            for (let _pi_ = 0; _pi_ < 32; _pi_++) {
                const _abs_ = Math.abs(window.seqStepsValues[_pi_]);
                if (_abs_ > 5) { _sum_ += _pi_; _count_++; }
            }
            const _avgPos_ = _count_ > 0 ? Math.round(_sum_ / _count_) : 16;
            const _bar_ = (typeof window._genPosBar === 'function') ? window._genPosBar(_avgPos_, 18) : '';
            const _presetHtml_ = (typeof window._genLcdBarHtml === 'function') ? window._genLcdBarHtml('seq_preset', {
                header: 'SEQ PRESET LOADED',
                presetName: _presetName_,
                bar: _bar_,
                meta: '32 steps \u00B7 avg pos: ' + _avgPos_
            }) : 'SEQ PRESET: ' + _presetName_;
            if (typeof window.lcdSafeUpdate === 'function') {
                window.lcdSafeUpdate(_lcd_, _presetHtml_, 'seq_preset');
            }
        }
    }

    function selectItem(itemEl, presetObj) {
        presetsList.querySelectorAll('.preset-item').forEach(i => {
            i.style.background = 'transparent';
            i.classList.remove('selected');
        });
        itemEl.style.background = 'color-mix(in srgb, var(--accent-pink) 20%, transparent)';
        itemEl.classList.add('selected');
        selectedPreset = presetObj;
        applyPreset(presetObj);
    }

    function deleteSeqPreset(name) {
        let userPresets = _loadUserSeqPresets();
        userPresets = userPresets.filter(p => p.name !== name);
        localStorage.setItem('abd-eep-seq-presets', JSON.stringify(userPresets));
        renderPresetsList();
    }

    renderPresetsList();

    if (loadPresetBtn) {
        loadPresetBtn.addEventListener('click', () => {
            if (selectedPreset) {
                applyPreset(selectedPreset);
            }
        });
    }

    if (savePresetBtn) {
        savePresetBtn.addEventListener('click', () => {
            if (window.currentActiveBank && window.currentActiveBank.startsWith('Factory Bank')) {
                alert('Cannot save sequences on factory patches. Please copy this patch to a User Bank first.');
                return;
            }
            const name = prompt('Enter a name for the new sequence preset:');
            if (name && name.trim()) {
                const cleanName = name.trim().replace(/[<>"'&]/g, '');
                if (!cleanName) {return;}

                const currentSteps = [];
                for (let i = 0; i < 32; i++) {
                    currentSteps.push(window.seqStepsRaw[i] !== undefined ? window.seqStepsRaw[i] : 128);
                }

                const userPresets = _loadUserSeqPresets();
                const existingIdx = userPresets.findIndex(p => p.name === cleanName);
                const newPreset = { name: cleanName, steps: currentSteps };

                if (existingIdx >= 0) {
                    userPresets[existingIdx] = newPreset;
                } else {
                    userPresets.push(newPreset);
                }

                localStorage.setItem('abd-eep-seq-presets', JSON.stringify(userPresets));
                renderPresetsList();
            }
        });
    }
};
