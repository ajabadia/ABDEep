/**
 * @purpose Sincronización de la UI del modal de efectos: lectura de parámetros y actualización de controles.
 * Extraído de effects.js como parte de la modularización.
 * @purpose_en FX modal UI sync: reads parameters and updates controls.
 */

/**
 * Set a gain slider position from a param value read from cache or patch bytes.
 * @param {string} paramId - Parameter identifier (e.g., 'fx1_gain')
 * @param {number} fallbackByte - Byte offset in unpacked bytes array
 */
function _setGainSliderPos(paramId, fallbackByte) {
    if (typeof window._readFxParamValue !== 'function') {return;}
    const val = window._readFxParamValue(paramId, fallbackByte, 1.0);
    const slider = document.querySelector('[data-param="' + paramId + '"] .v-slider');
    if (!slider) {return;}
    const handle = slider.querySelector('.handle');
    if (!handle) {return;}
    const handleHeight = 12;
    const limit = slider.getBoundingClientRect().height - handleHeight;
    if (limit > 0) {
        handle.style.top = ((1.0 - val) * limit) + 'px';
    }
}
window._setGainSliderPos = _setGainSliderPos;

/**
 * Sync all modal UI controls from the current patch/bridge state.
 */
// eslint-disable-next-line no-unused-vars -- called from effects.js
function syncFxModalUI() {
    const routingSelect = document.getElementById('fx-routing-select');
    const modeIns = document.getElementById('fx-mode-ins-btn');
    const modeSend = document.getElementById('fx-mode-send-btn');
    const modeByp = document.getElementById('fx-mode-bypass-btn');
    const sendLevelArea = document.getElementById('fx-send-level-area');
    const FX_TYPE_NAMES = window.FX_TYPE_NAMES || [];

    function setSendLevelVisibility(modeVal) {
        if (!sendLevelArea) {return;}
        sendLevelArea.style.display = (modeVal === 1) ? 'flex' : 'none';
    }

    for (let i = 1; i <= 4; i++) {
        if (typeof window._readFxParamValue !== 'function') {continue;}
        const offsetType = i === 1 ? 166 : (i === 2 ? 179 : (i === 3 ? 192 : 205));
        const typeValNormalized = window._readFxParamValue('fx' + i + '_type', offsetType, 0.0);
        const typeVal = Math.round(typeValNormalized * 56.0);

        const selectEl = document.querySelector('.fx-type-select[data-slot="' + i + '"]');
        if (selectEl) {selectEl.value = typeVal;}

        const offsetGain = i === 1 ? 218 : (i === 2 ? 219 : (i === 3 ? 220 : 221));
        _setGainSliderPos('fx' + i + '_gain', offsetGain);

        const offsetParam = i === 1 ? 167 : (i === 2 ? 180 : (i === 3 ? 193 : 206));
        const params = [];
        for (let p = 1; p <= 12; p++) {
            params.push(window._readFxParamValue('fx' + i + '_param' + p, offsetParam + p - 1, 0.5));
        }
        const gainVal = window._readFxParamValue('fx' + i + '_gain', offsetGain, 1.0);

        let displayName = FX_TYPE_NAMES[typeVal] || 'Bypass';
        if (typeVal > 0 && typeof window.findMatchingFxPresetName === 'function') {
            const matchedName = window.findMatchingFxPresetName(typeValNormalized, gainVal, params);
            if (matchedName) {
                displayName = matchedName;
            }
        }

        const displayEl = document.getElementById('fx' + i + '-type-mini-display');
        if (displayEl) {
            displayEl.innerText = displayName;
            displayEl.title = displayName;
        }
    }

    if (typeof window.syncFxPresetDropdowns === 'function') {
        window.syncFxPresetDropdowns();
    }

    if (typeof window._readFxParamValue === 'function') {
        const routeVal = Math.round(window._readFxParamValue('fx_routing', 165, 0.0) * 9.0);
        if (routingSelect) {routingSelect.value = routeVal;}

        const modeVal = Math.round(window._readFxParamValue('fx_mode', 222, 0.0) * 2.0);
        if (modeIns && modeSend && modeByp) {
            [modeIns, modeSend, modeByp].forEach(function(b) { b.classList.remove('active'); });
            if (modeVal === 0) {modeIns.classList.add('active');}
            else if (modeVal === 1) {modeSend.classList.add('active');}
            else {modeByp.classList.add('active');}
        }
        setSendLevelVisibility(modeVal);

        const sendLevel = window._readFxParamValue('fx_send_level', 305, 0.5);
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

/**
 * Sync FX modal UI from external state (called from panel_controls_binder.js).
 */
window.syncFxModalUIFromState = function() {
    const backdrop = document.getElementById('fx-modal-backdrop');
    if (backdrop && backdrop.style.display !== 'none') {
        syncFxModalUI();
    }
};
