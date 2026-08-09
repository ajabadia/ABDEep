/**
 * @purpose VCF (Filter) panel control bindings: model selector, pole mode,
 * envelope polarity, LFO source, Moog/Korg submodes, and LCD hovers.
 * Extraído de panel_controls_osc_vcf.js.
 */

window.bindPanelVcfControls = function(container, state, titleEl) {
    titleEl.innerText = 'VCF Filter Editor';
    container.innerHTML = window.PANEL_TEMPLATES.VCF();

    // VCF Model selector (shape-led-row style)
    container.querySelectorAll('.vcf-model-led-row').forEach(row => {
        row.addEventListener('click', () => {
            const val = parseInt(row.getAttribute('data-val'));
            container.querySelectorAll('.vcf-model-led-row').forEach(r => r.classList.remove('active'));
            row.classList.add('active');
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter('vcf_model', val / 2.0);
                window.dualMidiBridge.handleParameterChangeFromBackend('vcf_model', val / 2.0);
            }
        });
    });

    // Initialize VCF subpanel visibility from cached model value
    const currentModel = window.dualMidiBridge ? (window.dualMidiBridge.parameterCache['vcf_model'] || 0) : 0;
    if (typeof window._updateVcfSubpanelVisibility === 'function') {
        window._updateVcfSubpanelVisibility(Math.round(currentModel * 2.0));
    }

    const btnPole2 = document.getElementById('panel-vcf-pole-2');
    const btnPole4 = document.getElementById('panel-vcf-pole-4');
    if (btnPole2 && btnPole4) {
        btnPole2.addEventListener('click', () => {
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter('vcf_pole_mode', 0.0);
                window.dualMidiBridge.handleParameterChangeFromBackend('vcf_pole_mode', 0.0);
            }
        });
        btnPole4.addEventListener('click', () => {
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter('vcf_pole_mode', 1.0);
                window.dualMidiBridge.handleParameterChangeFromBackend('vcf_pole_mode', 1.0);
            }
        });
    }

    const btnPolNorm = document.getElementById('panel-vcf-pol-normal');
    const btnPolInv = document.getElementById('panel-vcf-pol-inverted');
    if (btnPolNorm && btnPolInv) {
        btnPolNorm.addEventListener('click', () => {
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter('vcf_env_polarity', 1.0);
                window.dualMidiBridge.handleParameterChangeFromBackend('vcf_env_polarity', 1.0);
            }
        });
        btnPolInv.addEventListener('click', () => {
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter('vcf_env_polarity', 0.0);
                window.dualMidiBridge.handleParameterChangeFromBackend('vcf_env_polarity', 0.0);
            }
        });
    }

    const btnLfoSrc1 = document.getElementById('panel-vcf-lfosrc-1');
    const btnLfoSrc2 = document.getElementById('panel-vcf-lfosrc-2');
    if (btnLfoSrc1 && btnLfoSrc2) {
        btnLfoSrc1.addEventListener('click', () => {
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter('vcf_lfo_select', 0.0);
                window.dualMidiBridge.handleParameterChangeFromBackend('vcf_lfo_select', 0.0);
            }
        });
        btnLfoSrc2.addEventListener('click', () => {
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter('vcf_lfo_select', 1.0);
                window.dualMidiBridge.handleParameterChangeFromBackend('vcf_lfo_select', 1.0);
            }
        });
    }

    // Moog sub-mode selector — Lowpass / Bandpass / Highpass
    container.querySelectorAll('.vcf-moog-submode-led-row').forEach(function(row) {
        row.addEventListener('click', function() {
            const val = parseFloat(this.getAttribute('data-val'));
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter('vcf_moog_submode', val / 2);
                window.dualMidiBridge.handleParameterChangeFromBackend('vcf_moog_submode', val / 2);
            }
        });
    });

    // Korg sub-mode selector — K35 Lowpass / K35 Highpass
    container.querySelectorAll('.vcf-korg-submode-led-row').forEach(function(row) {
        row.addEventListener('click', function() {
            const val = parseFloat(this.getAttribute('data-val'));
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter('vcf_korg_submode', val);
                window.dualMidiBridge.handleParameterChangeFromBackend('vcf_korg_submode', val);
            }
        });
    });

    // LCD hovers for .ctrl-unit
    container.querySelectorAll('.ctrl-unit[data-param]').forEach(function(el) {
        el.addEventListener('mouseenter', function() {
            const lcd = document.getElementById('lcd-text');
            if (!lcd) {return;}
            const pid = this.getAttribute('data-param');
            const bridge = window.dualMidiBridge;
            const v = bridge ? bridge.parameterCache[pid] : 0;
            const lbl = this.querySelector('.label');
            const name = lbl ? lbl.textContent.trim() : pid;
            const pct = typeof v === 'number' ? Math.round(v * 100) : 0;
            lcd.innerHTML = '<span class=\"lcd-label\">VCF FILTER PANEL</span><br>'
                + '<strong>' + name.toUpperCase() + '</strong><br>'
                + '<span style=\"font-size:15px;color:var(--accent-pink);\">' + pct + '%</span>';
            if (typeof window.setLcdParamDisplayTimer === 'function') {window.setLcdParamDisplayTimer(lcd);}
        });
    });

    // LCD hovers for .toggle-box
    container.querySelectorAll('.toggle-box[data-param]').forEach(function(el) {
        el.addEventListener('mouseenter', function() {
            const lcd = document.getElementById('lcd-text');
            if (!lcd) {return;}
            const pid = this.getAttribute('data-param');
            const bridge = window.dualMidiBridge;
            const v = bridge ? bridge.parameterCache[pid] : 0;
            const lbl = this.querySelector('.toggle-label');
            const name = lbl ? lbl.textContent.trim() : pid;
            lcd.innerHTML = '<span class=\"lcd-label\">VCF FILTER PANEL</span><br>'
                + '<strong>' + name.toUpperCase() + '</strong><br>'
                + '<span style=\"font-size:15px;color:var(--accent-pink);\">' + window.formatParamValue(pid, v) + '</span>';
            if (typeof window.setLcdParamDisplayTimer === 'function') {window.setLcdParamDisplayTimer(lcd);}
        });
    });
};
