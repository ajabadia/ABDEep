/**
 * @component fx-modal
 * @purpose Effects Engine Rack modal custom element facade
 * @classification UI Component
 */
(function() {
    let _onFxSlotClickCallback = null;

    class FxModal extends HTMLElement {
        connectedCallback() {
            if (this.children.length === 0) {
                this.innerHTML = window.FX_MODAL_TEMPLATE || '';
                this.show();
            }
        }

        show(options = {}) {
            _onFxSlotClickCallback = options.onFxSlotClick || null;

            const state = (typeof window.deepmindState !== 'undefined') ? window.deepmindState : null;
            const sendParamToSynth = window.sendParamToSynth || function() {};
            const syncFxSlotFromState = window.syncFxSlotFromState || function() {};
            const selectFxSlot = window.selectFxSlot || function() {};
            const labels = window.FX_TYPE_LABELS || {};

            const typeSelects = document.querySelectorAll('.fx-type-select');
            typeSelects.forEach(sel => {
                const slot = parseInt(sel.dataset.slot);
                const paramName = `fx${slot}.effect`;
                const val = state ? state[paramName] : 0;
                sel.value = val !== undefined ? val : 0;
            });

            if (typeof window._loadPresetDropdowns === 'function') {
                window._loadPresetDropdowns();
            }

            typeSelects.forEach(sel => {
                sel.onchange = () => {
                    const slot = parseInt(sel.dataset.slot);
                    const effectIndex = parseInt(sel.value);
                    const paramName = `fx${slot}.effect`;
                    if (state) { state[paramName] = effectIndex; }
                    sendParamToSynth(paramName, effectIndex);

                    const display = document.getElementById(`fx${slot}-type-mini-display`);
                    if (display) {
                        display.textContent = labels[effectIndex] || '---';
                    }

                    if (typeof window._syncFxParamVisibility === 'function') {
                        window._syncFxParamVisibility(slot, effectIndex);
                    }
                    if (typeof window._populateFxParamControls === 'function') {
                        window._populateFxParamControls(slot, effectIndex);
                    }
                    syncFxSlotFromState(slot);
                    if (typeof window._loadPresetDropdowns === 'function') {
                        window._loadPresetDropdowns();
                    }

                    // Notify vocoder mic module of FX type change
                    if (typeof window._onFxTypeChanged === 'function') {
                        window._onFxTypeChanged();
                    }
                };
            });

            document.querySelectorAll('.fx-preset-select').forEach(sel => {
                sel.onclick = (e) => e.stopPropagation();
                sel.onchange = (e) => {
                    e.stopPropagation();
                    const slot = parseInt(sel.dataset.slot);
                    const presetIndex = parseInt(sel.value);
                    if (isNaN(presetIndex)) {return;}
                    if (typeof window._applyFxPresetToSlot === 'function') {
                        window._applyFxPresetToSlot(slot, presetIndex);
                    }
                };
            });

            document.querySelectorAll('.fx-preset-load-btn').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const slot = parseInt(btn.dataset.slot);
                    const sel = document.querySelector(`.fx-preset-select[data-slot="${slot}"]`);
                    if (sel && sel.value !== '') {
                        if (typeof window._applyFxPresetToSlot === 'function') {
                            window._applyFxPresetToSlot(slot, parseInt(sel.value));
                        }
                    } else {
                        if (typeof window._importFxPresetFromFile === 'function') {
                            window._importFxPresetFromFile(slot);
                        }
                    }
                };
            });

            document.querySelectorAll('.fx-preset-save-btn').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const slot = parseInt(btn.dataset.slot);
                    if (typeof window._saveFxPresetFromSlot === 'function') {
                        window._saveFxPresetFromSlot(slot);
                    }
                };
            });

            document.querySelectorAll('.fx-preset-delete-btn').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const slot = parseInt(btn.dataset.slot);
                    const sel = document.querySelector(`.fx-preset-select[data-slot="${slot}"]`);
                    if (sel && sel.value !== '') {
                        if (typeof window._deleteFxPresetByIndex === 'function') {
                            window._deleteFxPresetByIndex(parseInt(sel.value));
                        }
                    } else {
                        alert('Selecciona primero un preset en el desplegable para eliminar.');
                    }
                };
            });

            document.querySelectorAll('.fx-slot-column').forEach(slot => {
                slot.onclick = (_e) => {
                    const slotId = parseInt(slot.id.replace('fx-slot-', ''));
                    selectFxSlot(slotId);
                    if (_onFxSlotClickCallback) { _onFxSlotClickCallback(slotId); }
                };
            });
        }
    }

    if (!customElements.get('fx-modal')) {
        customElements.define('fx-modal', FxModal);
    }
})();
