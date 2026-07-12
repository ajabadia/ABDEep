/**
 * @purpose Controlador del módulo de efectos (Effects Engine Rack) central, manejando ruteos y editores dinámicos para los 4 slots de efectos.
 * @purpose_en Central Effects Engine Rack controller, managing routings and dynamic parameter editor layouts for all 4 FX slots.
 */

const FX_TYPE_NAMES = ["Bypass", "Ambience", "tcDeepVerb", "RoomRev", "VintageRoom", "HallReverb", "ChamberRev", "Plate Reverb", "Rich Plate", "Gated Reverb", "Reverse Reverb", "ChorusRev", "DelayRev", "FlangerRev", "MidasEQ", "Enhancer", "FairComp", "MBDistortion", "RackAmp", "Edison", "AutoPan/Trem", "NoiseGate", "Delay", "3Tap Delay", "4Tap Delay", "T-RayDelay", "DecimatorDelay", "ModDlyRev", "Stereo Chorus", "Chorus-D", "Stereo Flanger", "Stereo Phaser", "Mood Filter", "Dual Pitch", "Vintage Pitch", "Rotary Speaker"];
window.FX_TYPE_NAMES = FX_TYPE_NAMES;

document.addEventListener('DOMContentLoaded', () => {
    initEffectsModal();
});

function initEffectsModal() {
    const fxBtn = document.getElementById('programmer-fx-btn');
    const backdrop = document.getElementById('fx-modal-backdrop');
    const closeBtn = document.getElementById('fx-modal-close-btn');
    const dynamicArea = document.getElementById('fx-dynamic-editor-area');
    const activeSlotLabel = document.getElementById('fx-screen-active-slot');

    if (!fxBtn || !backdrop || !closeBtn || !dynamicArea) return;

    let selectedSlot = 1;
    window._selectedFxSlot = selectedSlot;
    let activeFxPage = 1;
    window._activeFxPage = activeFxPage;

    fxBtn.addEventListener('click', (e) => {
        e.preventDefault();
        backdrop.style.display = 'flex';
        syncFxModalUI();
        if (typeof window._renderFxPresetList === 'function') {
            window._renderFxPresetList();
        }
    });

    closeBtn.addEventListener('click', () => {
        backdrop.style.display = 'none';
    });

    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
            backdrop.style.display = 'none';
        }
    });

    for (let i = 1; i <= 4; i++) {
        const slotCol = document.getElementById(`fx-slot-${i}`);
        if (slotCol) {
            slotCol.addEventListener('click', (e) => {
                if (e.target.tagName === 'SELECT') return;
                
                document.querySelectorAll('.fx-slot-column').forEach(c => c.style.borderColor = 'var(--bg-hover)');
                slotCol.style.borderColor = 'var(--brand-accent)';
                selectedSlot = i;
                window._selectedFxSlot = selectedSlot;
                
                if (typeof window.renderActiveEffectParams === 'function') {
                    window.renderActiveEffectParams();
                }
            });
        }
    }

    document.querySelectorAll('.fx-type-select').forEach(sel => {
        sel.addEventListener('change', () => {
            const slot = sel.getAttribute('data-slot');
            const val = parseInt(sel.value);
            const displayEl = document.getElementById(`fx${slot}-type-mini-display`);
            if (displayEl) displayEl.innerText = FX_TYPE_NAMES[val];
            
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter(`fx${slot}_type`, val / 35.0);
            }
            if (parseInt(slot) === selectedSlot) {
                if (typeof window.renderActiveEffectParams === 'function') {
                    window.renderActiveEffectParams();
                }
            }
        });
    });

    const routingSelect = document.getElementById('fx-routing-select');
    if (routingSelect) {
        routingSelect.addEventListener('change', () => {
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter("fx_routing", parseInt(routingSelect.value) / 9.0);
            }
        });
    }

    const page1Btn = document.getElementById('fx-page-1-btn');
    const page2Btn = document.getElementById('fx-page-2-btn');
    if (page1Btn && page2Btn) {
        page1Btn.addEventListener('click', () => {
            page1Btn.classList.add('active');
            page2Btn.classList.remove('active');
            activeFxPage = 1;
            window._activeFxPage = activeFxPage;
            if (typeof window.renderActiveEffectParams === 'function') {
                window.renderActiveEffectParams();
            }
        });
        page2Btn.addEventListener('click', () => {
            page2Btn.classList.add('active');
            page1Btn.classList.remove('active');
            activeFxPage = 2;
            window._activeFxPage = activeFxPage;
            if (typeof window.renderActiveEffectParams === 'function') {
                window.renderActiveEffectParams();
            }
        });
    }

    const modeIns = document.getElementById('fx-mode-ins-btn');
    const modeSend = document.getElementById('fx-mode-send-btn');
    const modeByp = document.getElementById('fx-mode-bypass-btn');
    const sendLevelArea = document.getElementById('fx-send-level-area');

    const setSendLevelVisibility = (modeVal) => {
        if (!sendLevelArea) return;
        sendLevelArea.style.display = (modeVal === 1) ? 'flex' : 'none';
    };
    
    if (modeIns && modeSend && modeByp) {
        modeIns.addEventListener('click', () => {
            modeIns.classList.add('active');
            [modeSend, modeByp].forEach(b => b.classList.remove('active'));
            setSendLevelVisibility(0);
            if (window.dualMidiBridge) window.dualMidiBridge.setParameter("fx_mode", 0.0);
        });
        modeSend.addEventListener('click', () => {
            modeSend.classList.add('active');
            [modeIns, modeByp].forEach(b => b.classList.remove('active'));
            setSendLevelVisibility(1);
            if (window.dualMidiBridge) window.dualMidiBridge.setParameter("fx_mode", 0.5);
        });
        modeByp.addEventListener('click', () => {
            modeByp.classList.add('active');
            [modeIns, modeSend].forEach(b => b.classList.remove('active'));
            setSendLevelVisibility(2);
            if (window.dualMidiBridge) window.dualMidiBridge.setParameter("fx_mode", 1.0);
        });
    }

    const sendLevelSlider = document.getElementById('fx-send-level-slider');
    if (sendLevelSlider) {
        const handle = sendLevelSlider.querySelector('.handle');
        if (handle) {
            let isDragging = false;

            const updateSendLevel = (clientY) => {
                const rect = sendLevelSlider.getBoundingClientRect();
                const handleHeight = 12;
                const limit = rect.height - handleHeight;
                let y = clientY - rect.top - (handleHeight / 2);
                y = Math.max(0, Math.min(limit, y));
                handle.style.top = y + 'px';

                const val = 1.0 - (y / limit);
                if (window.dualMidiBridge) {
                    window.dualMidiBridge.setParameter("fx_send_level", val);
                }
            };

            function onSliderMove(e) {
                if (isDragging) updateSendLevel(e.clientY);
            }
            function onSliderEnd() {
                isDragging = false;
                window.removeEventListener('mousemove', onSliderMove);
                window.removeEventListener('mouseup', onSliderEnd);
            }
            sendLevelSlider.addEventListener('mousedown', (e) => {
                isDragging = true;
                updateSendLevel(e.clientY);
                e.preventDefault();
                e.stopPropagation();
                window.addEventListener('mousemove', onSliderMove);
                window.addEventListener('mouseup', onSliderEnd);
            });
        }
    }

    backdrop.querySelectorAll('.fx-slot-column .v-slider').forEach(slider => {
        const ctrlUnit = slider.closest('[data-param]');
        if (!ctrlUnit) return;
        const paramId = ctrlUnit.getAttribute('data-param');
        const handle = slider.querySelector('.handle');

        let isDragging = false;

        const updateSliderPos = (clientY) => {
            const rect = slider.getBoundingClientRect();
            const handleHeight = 12;
            const limit = rect.height - handleHeight;
            let y = clientY - rect.top - (handleHeight / 2);
            y = Math.max(0, Math.min(limit, y));
            handle.style.top = y + 'px';

            const val = 1.0 - (y / limit);
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter(paramId, val);
            }
        };

        function onSliderMove(e) {
            if (isDragging) updateSliderPos(e.clientY);
        }
        function onSliderEnd() {
            isDragging = false;
            window.removeEventListener('mousemove', onSliderMove);
            window.removeEventListener('mouseup', onSliderEnd);
        }
        slider.addEventListener('mousedown', (e) => {
            isDragging = true;
            updateSliderPos(e.clientY);
            e.preventDefault();
            e.stopPropagation();
            window.addEventListener('mousemove', onSliderMove);
            window.addEventListener('mouseup', onSliderEnd);
        });
    });

    window.syncFxModalUIFromState = () => {
        if (backdrop.style.display !== 'none') {
            syncFxModalUI();
        }
    };

    function _setGainSliderPos(paramId, fallbackByte) {
        if (typeof window._readFxParamValue !== 'function') return;
        const val = window._readFxParamValue(paramId, fallbackByte, 1.0);
        const slider = document.querySelector(`[data-param="${paramId}"] .v-slider`);
        if (!slider) return;
        const handle = slider.querySelector('.handle');
        if (!handle) return;
        const handleHeight = 12;
        const limit = slider.getBoundingClientRect().height - handleHeight;
        if (limit > 0) {
            handle.style.top = ((1.0 - val) * limit) + 'px';
        }
    }
    window._setGainSliderPos = _setGainSliderPos;

    function syncFxModalUI() {
        for (let i = 1; i <= 4; i++) {
            if (typeof window._readFxParamValue !== 'function') continue;
            const offsetType = i === 1 ? 166 : (i === 2 ? 179 : (i === 3 ? 192 : 205));
            const typeValNormalized = window._readFxParamValue(`fx${i}_type`, offsetType, 0.0);
            const typeVal = Math.round(typeValNormalized * 35.0);
            
            const selectEl = document.querySelector(`.fx-type-select[data-slot="${i}"]`);
            if (selectEl) selectEl.value = typeVal;

            const offsetGain = i === 1 ? 218 : (i === 2 ? 219 : (i === 3 ? 220 : 221));
            _setGainSliderPos(`fx${i}_gain`, offsetGain);

            const offsetParam = i === 1 ? 167 : (i === 2 ? 180 : (i === 3 ? 193 : 206));
            const params = [];
            for (let p = 1; p <= 12; p++) {
                params.push(window._readFxParamValue(`fx${i}_param${p}`, offsetParam + p - 1, 0.5));
            }
            const gainVal = window._readFxParamValue(`fx${i}_gain`, offsetGain, 1.0);
            
            let displayName = FX_TYPE_NAMES[typeVal] || "Bypass";
            if (typeVal > 0 && typeof window.findMatchingFxPresetName === 'function') {
                const matchedName = window.findMatchingFxPresetName(typeValNormalized, gainVal, params);
                if (matchedName) {
                    displayName = matchedName;
                }
            }

            const displayEl = document.getElementById(`fx${i}-type-mini-display`);
            if (displayEl) {
                displayEl.innerText = displayName;
                displayEl.title = displayName;
            }
        }

        if (typeof window._readFxParamValue === 'function') {
            const routeVal = Math.round(window._readFxParamValue('fx_routing', 165, 0.0) * 9.0);
            if (routingSelect) routingSelect.value = routeVal;

            const modeVal = Math.round(window._readFxParamValue('fx_mode', 222, 0.0) * 2.0);
            if (modeIns && modeSend && modeByp) {
                [modeIns, modeSend, modeByp].forEach(b => b.classList.remove('active'));
                if (modeVal === 0) modeIns.classList.add('active');
                else if (modeVal === 1) modeSend.classList.add('active');
                else modeByp.classList.add('active');
            }
            setSendLevelVisibility(modeVal);

            const sendLevel = window._readFxParamValue('fx_send_level', 225, 0.5);
            const sendLevelSliderEl = document.getElementById('fx-send-level-slider');
            if (sendLevelSliderEl) {
                const handle = sendLevelSliderEl.querySelector('.handle');
                if (handle) {
                    const handleHeight = 12;
                    const limit = sendLevelSliderEl.getBoundingClientRect().height - handleHeight;
                    if (limit > 0) {
                        handle.style.top = ((1.0 - sendLevel) * limit) + 'px';
                    }
                }
            }
        }

        if (typeof window.renderActiveEffectParams === 'function') {
            window.renderActiveEffectParams();
        }
    }

    if (window.dualMidiBridge && typeof window.dualMidiBridge.onParameterChanged === 'function') {
        window.dualMidiBridge.onParameterChanged(function(paramId) {
            if (backdrop.style.display === 'none') return;
            if (paramId.startsWith('fx')) {
                if (paramId.endsWith('_type')) {
                    syncFxModalUI();
                } else {
                    const slotPrefix = `fx${selectedSlot}`;
                    if (paramId.startsWith(slotPrefix)) {
                        if (typeof window.renderActiveEffectParams === 'function') {
                            window.renderActiveEffectParams();
                        }
                    }
                }
            }
        });
    }
}
