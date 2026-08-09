/**
 * @purpose Real-time param change handlers for HPF and VCF panel modes.
 * Extraído de panel_param_handler.js.
 * @see _updateSliderHandle in panel_param_handler.js
 */

/**
 * Handle HPF panel-specific parameter changes.
 * Called from _handlePanelParamChange when state.currentPanelMode === 'HPF'.
 * @param {string} paramId
 * @param {number} val
 * @param {object} state
 */
window._handleHpfParamChange = function(paramId, val, state) {
    if (paramId === 'hpf_boost_enable') {
        const btnOff = document.getElementById('panel-hpf-boost-off');
        const btnOn = document.getElementById('panel-hpf-boost-on');
        if (btnOff && btnOn) {
            btnOff.classList.toggle('active', val < 0.5);
            btnOn.classList.toggle('active', val > 0.5);
        }
    } else if (paramId === 'hpf_cutoff') {
        const container = document.getElementById('panel-dynamic-controls');
        const sliderEl = container ? container.querySelector('[data-param="' + paramId + '"] .v-slider') : null;
        if (typeof window._updateSliderHandle === 'function') {
            window._updateSliderHandle(sliderEl, val);
        }
    }
};

/**
 * Handle VCF panel-specific parameter changes.
 * Called from _handlePanelParamChange when state.currentPanelMode === 'VCF'.
 * @param {string} paramId
 * @param {number} val
 * @param {object} state
 */
window._handleVcfParamChange = function(paramId, val, state) {
    const container = document.getElementById('panel-dynamic-controls');
    if (!container) {return;}

    if (paramId === 'vcf_model') {
        const activeIndex = Math.round(val * 2.0);
        container.querySelectorAll('.vcf-model-led-row').forEach(function(row) {
            row.classList.toggle('active', parseInt(row.getAttribute('data-val')) === activeIndex);
        });
        if (typeof window._updateVcfSubpanelVisibility === 'function') {
            window._updateVcfSubpanelVisibility(activeIndex);
        }
    } else if (paramId === 'vcf_moog_submode') {
        const activeIndex = Math.round(val * 2.0);
        container.querySelectorAll('.vcf-moog-submode-led-row').forEach(function(row) {
            row.classList.toggle('active', parseInt(row.getAttribute('data-val')) === activeIndex);
        });
    } else if (paramId === 'vcf_korg_submode') {
        const activeIndex = Math.round(val * 1.0);
        container.querySelectorAll('.vcf-korg-submode-led-row').forEach(function(row) {
            row.classList.toggle('active', parseInt(row.getAttribute('data-val')) === activeIndex);
        });
    } else if (paramId === 'vcf_pole_mode') {
        const btn2 = document.getElementById('panel-vcf-pole-2');
        const btn4 = document.getElementById('panel-vcf-pole-4');
        if (btn2 && btn4) {
            btn2.classList.toggle('active', val < 0.5);
            btn4.classList.toggle('active', val > 0.5);
        }
    } else if (paramId === 'vcf_env_polarity') {
        const btnNorm = document.getElementById('panel-vcf-pol-normal');
        const btnInv = document.getElementById('panel-vcf-pol-inverted');
        if (btnNorm && btnInv) {
            btnNorm.classList.toggle('active', val > 0.5);
            btnInv.classList.toggle('active', val < 0.5);
        }
    } else if (paramId === 'vcf_lfo_select') {
        const btn1 = document.getElementById('panel-vcf-lfosrc-1');
        const btn2 = document.getElementById('panel-vcf-lfosrc-2');
        if (btn1 && btn2) {
            btn1.classList.toggle('active', val < 0.5);
            btn2.classList.toggle('active', val > 0.5);
        }
    } else if (paramId.startsWith('vcf_')) {
        const sliderEl = container.querySelector('[data-param="' + paramId + '"] .v-slider');
        if (typeof window._updateSliderHandle === 'function') {
            window._updateSliderHandle(sliderEl, val);
        }
    }
};

/**
 * Show/hide VCF sub-mode panels based on the selected VCF model.
 * @param {number} modelIndex - 0=DM12, 1=Moog, 2=Korg
 */
window._updateVcfSubpanelVisibility = function(modelIndex) {
    const moogPanel = document.getElementById('vcf-subpanel-moog');
    const korgPanel = document.getElementById('vcf-subpanel-korg');
    if (moogPanel) {moogPanel.style.display = modelIndex === 1 ? '' : 'none';}
    if (korgPanel) {korgPanel.style.display = modelIndex === 2 ? '' : 'none';}
};
