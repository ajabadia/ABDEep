/**
 * @purpose Real-time param change handlers for LFO, VCA, ENV and OSC panel modes.
 * Extraído de panel_param_handler.js.
 * @see _updateSliderHandle in panel_param_handler.js
 */

/**
 * Handle LFO panel-specific parameter changes.
 * @param {string} paramId
 * @param {number} val
 * @param {object} state
 */
window._handleLfoParamChange = function(paramId, val, state) {
    const activePrefix = 'lfo' + state.panelActiveLfo + '_';
    if (!paramId.startsWith(activePrefix)) {return;}
    const container = document.getElementById('panel-dynamic-controls');
    if (!container) {return;}

    if (paramId === activePrefix + 'key_sync' || paramId === activePrefix + 'arp_sync') {
        const boxId = paramId === (activePrefix + 'key_sync') ? 'lfo-key-sync-box' : 'lfo-arp-sync-box';
        const box = document.getElementById(boxId);
        if (box) {box.classList.toggle('active', val > 0.5);}
        if (paramId === (activePrefix + 'arp_sync')) {
            const rateLabel = container.querySelector('[data-param="' + activePrefix + 'rate"] .label');
            if (rateLabel) {rateLabel.innerText = val > 0.5 ? 'Clock Div' : 'Rate';}
        }
    } else if (paramId === activePrefix + 'shape') {
        const activeIndex = Math.round(val * 6.0);
        container.querySelectorAll('.shape-led-row').forEach(function(row) {
            row.classList.toggle('active', parseInt(row.getAttribute('data-shape')) === activeIndex);
        });
    } else {
        const sliderEl = container.querySelector('[data-param="' + paramId + '"] .v-slider');
        if (typeof window._updateSliderHandle === 'function') {
            window._updateSliderHandle(sliderEl, val);
        }
    }
};

/**
 * Handle VCA panel-specific parameter changes.
 * @param {string} paramId
 * @param {number} val
 * @param {object} state
 */
window._handleVcaParamChange = function(paramId, val, state) {
    const container = document.getElementById('panel-dynamic-controls');
    if (!container) {return;}

    if (paramId === 'vca_mode') {
        const btnTransparent = document.getElementById('panel-vca-mode-transparent');
        const btnBallsy = document.getElementById('panel-vca-mode-ballsy');
        if (btnTransparent && btnBallsy) {
            btnTransparent.classList.toggle('active', val < 0.5);
            btnBallsy.classList.toggle('active', val > 0.5);
        }
    } else if (paramId.startsWith('vca_')) {
        const sliderEl = container.querySelector('[data-param="' + paramId + '"] .v-slider');
        if (typeof window._updateSliderHandle === 'function') {
            window._updateSliderHandle(sliderEl, val);
        }
    }
};

/**
 * Handle ENV panel-specific parameter changes.
 * @param {string} paramId
 * @param {number} val
 * @param {object} state
 */
window._handleEnvParamChange = function(paramId, val, state) {
    const activePrefix = 'env' + state.panelActiveEnv + '_';
    if (!paramId.startsWith(activePrefix)) {return;}
    const container = document.getElementById('panel-dynamic-controls');
    if (!container) {return;}

    if (paramId === activePrefix + 'trigger_mode') {
        const activeIndex = Math.round(val * 4.0);
        container.querySelectorAll('.shape-led-row').forEach(function(row) {
            row.classList.toggle('active', parseInt(row.getAttribute('data-trig')) === activeIndex);
        });
    } else {
        const sliderEl = container.querySelector('[data-param="' + paramId + '"] .v-slider');
        if (typeof window._updateSliderHandle === 'function') {
            window._updateSliderHandle(sliderEl, val);
        }
    }
};

/**
 * Handle OSC panel-specific parameter changes.
 * @param {string} paramId
 * @param {number} val
 * @param {object} state
 */
window._handleOscParamChange = function(paramId, val, state) {
    const container = document.getElementById('panel-dynamic-controls');
    if (!container) {return;}

    if (state.panelActiveOsc === 1) {
        if (paramId === 'osc1_saw_enable' || paramId === 'osc1_square_enable') {
            const boxId = paramId === 'osc1_saw_enable' ? 'panel-osc1-saw-box' : 'panel-osc1-square-box';
            const box = document.getElementById(boxId);
            if (box) {box.classList.toggle('active', val > 0.5);}
        } else if (paramId === 'osc_key_reset') {
            const box = document.getElementById('panel-osc-key-reset-box');
            if (box) {box.classList.toggle('active', val > 0.5);}
        } else if (paramId === 'osc1_pm_source') {
            const sel = document.getElementById('panel-osc1-pmod-src-select');
            if (sel) {sel.value = Math.round(val * 6.0);}
        } else if (paramId === 'osc1_pwm_source') {
            const sel = document.getElementById('panel-osc1-pwm-src-select');
            if (sel) {sel.value = Math.round(val * 5.0);}
        } else if (paramId === 'osc1_range') {
            const activeIndex = Math.round(val * 2.0);
            container.querySelectorAll('.osc1-range-led-row').forEach(function(row) {
                row.classList.toggle('active', parseInt(row.getAttribute('data-val')) === activeIndex);
            });
        } else if (paramId === 'osc1_pm_mode') {
            const activeIndex = Math.round(val * 1.0);
            container.querySelectorAll('.osc1-pmode-led-row').forEach(function(row) {
                row.classList.toggle('active', parseInt(row.getAttribute('data-val')) === activeIndex);
            });
        } else {
            const sliderEl = container.querySelector('[data-param="' + paramId + '"] .v-slider');
            if (typeof window._updateSliderHandle === 'function') {
                window._updateSliderHandle(sliderEl, val);
            }
        }
    } else {
        if (paramId === 'osc_sync_enable') {
            const box = document.getElementById('panel-osc-sync-box');
            if (box) {box.classList.toggle('active', val > 0.5);}
        } else if (paramId === 'osc2_pm_source') {
            const sel = document.getElementById('panel-osc2-pmod-src-select');
            if (sel) {sel.value = Math.round(val * 6.0);}
        } else if (paramId === 'osc2_tpm_source') {
            const sel = document.getElementById('panel-osc2-tpm-src-select');
            if (sel) {sel.value = Math.round(val * 5.0);}
        } else if (paramId === 'osc2_range') {
            const activeIndex = Math.round(val * 2.0);
            container.querySelectorAll('.osc2-range-led-row').forEach(function(row) {
                row.classList.toggle('active', parseInt(row.getAttribute('data-val')) === activeIndex);
            });
        } else {
            const sliderEl = container.querySelector('[data-param="' + paramId + '"] .v-slider');
            if (typeof window._updateSliderHandle === 'function') {
                window._updateSliderHandle(sliderEl, val);
            }
        }
    }
};
