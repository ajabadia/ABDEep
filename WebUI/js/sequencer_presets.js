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
            if (Array.isArray(parsed)) {return parsed;}
        } else {
            localStorage.setItem('abd-eep-seq-presets', JSON.stringify(DEFAULT_SEQ_PRESETS));
            return DEFAULT_SEQ_PRESETS;
        }
    } catch (e) {}
    return [];
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
        userPresets.forEach((p, idx) => {
            const item = document.createElement('div');
            item.className = 'preset-item text-sm text-primary';
            item.style.padding = '3px';
            item.style.cursor = 'pointer';
            item.style.borderRadius = 'var(--radius-xs)';
            item.style.display = 'flex';
            item.style.justifyContent = 'space-between';
            item.style.alignItems = 'center';
            item.innerHTML = `<span style="font-weight:bold;color:var(--accent-pink)">${p.name}</span>` +
                             '<span class="delete-seq-preset-btn" style="color:var(--text-faint);font-size:10px;cursor:pointer;padding:0 4px;">✕</span>';
            
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-seq-preset-btn')) {return;}
                selectItem(item, p);
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
                item.className = 'preset-item text-sm text-primary';
                item.style.padding = '3px';
                item.style.cursor = 'pointer';
                item.style.borderRadius = 'var(--radius-xs)';
                item.innerHTML = `<span style="color:var(--text-dim)">${p.name}</span> <span style="font-size:8px;color:var(--text-faint)">Factory</span>`;
                
                item.addEventListener('click', () => {
                    selectItem(item, p);
                });

                presetsList.appendChild(item);
            });
        }
    }

    let selectedPreset = null;

    function selectItem(itemEl, presetObj) {
        presetsList.querySelectorAll('.preset-item').forEach(i => {
            i.style.background = 'transparent';
            i.classList.remove('selected');
        });
        itemEl.style.background = 'color-mix(in srgb, var(--accent-pink) 20%, transparent)';
        itemEl.classList.add('selected');
        selectedPreset = presetObj;
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
                const steps = selectedPreset.steps;
                for (let i = 0; i < 32; i++) {
                    const rawByte = Math.max(0, Math.min(255, steps[i]));
                    window.seqStepsRaw[i] = rawByte;
                    window.seqStepsValues[i] = rawByte - 128;
                    
                    const activeBank = window.loadedBanks[window.currentActiveBank];
                    if (activeBank && window.currentActivePatchIndex !== -1) {
                        const patch = activeBank[window.currentActivePatchIndex];
                        if (patch && patch.unpackedBytes) {
                            patch.unpackedBytes[123 + i] = rawByte;
                        }
                    }

                    const normalized = rawByte / 255.0;
                    if (window.dualMidiBridge) {
                        window.dualMidiBridge.setParameter(`seq_step_${i + 1}`, normalized);
                    }
                    if (typeof window.updateStepVisual === 'function') {
                        window.updateStepVisual(i);
                    }
                }
                
                const _presetName_ = selectedPreset.name;
                const _lcd_ = document.getElementById('lcd-text');
                if (_lcd_) {
                    let _sum_ = 0, _count_ = 0;
                    for (let _pi_ = 0; _pi_ < 32; _pi_++) {
                        const _abs_ = Math.abs(window.seqStepsValues[_pi_]);
                        if (_abs_ > 5) { _sum_ += _pi_; _count_++; }
                    }
                    const _avgPos_ = _count_ > 0 ? Math.round(_sum_ / _count_) : 16;
                    const _bar_ = window._genPosBar(_avgPos_, 18);
                    const _presetHtml_ = window._genLcdBarHtml('seq_preset', {
                        header: 'SEQ PRESET LOADED',
                        presetName: _presetName_,
                        bar: _bar_,
                        meta: '32 steps \u00B7 avg pos: ' + _avgPos_
                    });
                    window.lcdSafeUpdate(_lcd_, _presetHtml_, 'seq_preset');
                }
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
