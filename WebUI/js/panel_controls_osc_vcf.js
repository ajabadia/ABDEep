/**
 * @purpose OSC panel control bindings: waveform toggles, pitch range, modulation sources, selectors, and LCD hovers.
 * HPF y VCF bindings extraídos a panel_controls_hpf.js y panel_controls_vcf.js.
 */

window.bindPanelOscControls = function(container, state, titleEl) {
    const oscSelectBtn = document.getElementById('osc-select-btn');
    if (oscSelectBtn) {
        state.panelActiveOsc = oscSelectBtn.innerText.includes('OSC 2') ? 2 : 1;
    }

    titleEl.innerText = 'OSC ' + state.panelActiveOsc + ' Editor';

    if (state.panelActiveOsc === 1) {
        container.innerHTML = window.PANEL_TEMPLATES.OSC1();

        container.querySelectorAll('.toggle-box').forEach(box => {
            box.addEventListener('click', () => {
                const paramId = box.getAttribute('data-param');
                const isCurrentlyActive = box.classList.toggle('active');
                if (window.dualMidiBridge) {window.dualMidiBridge.setParameter(paramId, isCurrentlyActive ? 1.0 : 0.0);}
            });
        });

        const selectPmod = document.getElementById('panel-osc1-pmod-src-select');
        if (selectPmod) {
            selectPmod.addEventListener('change', () => {
                if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('osc1_pm_source', parseInt(selectPmod.value) / 6.0);}
            });
        }

        const selectPwm = document.getElementById('panel-osc1-pwm-src-select');
        if (selectPwm) {
            selectPwm.addEventListener('change', () => {
                if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('osc1_pwm_source', parseInt(selectPwm.value) / 5.0);}
            });
        }

        container.querySelectorAll('.osc1-range-led-row').forEach(row => {
            row.addEventListener('click', () => {
                const val = parseInt(row.getAttribute('data-val'));
                container.querySelectorAll('.osc1-range-led-row').forEach(r => r.classList.remove('active'));
                row.classList.add('active');
                if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('osc1_range', val / 2.0);}
            });
        });

        container.querySelectorAll('.osc1-pmode-led-row').forEach(row => {
            row.addEventListener('click', () => {
                const val = parseInt(row.getAttribute('data-val'));
                container.querySelectorAll('.osc1-pmode-led-row').forEach(r => r.classList.remove('active'));
                row.classList.add('active');
                if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('osc1_pm_mode', val / 1.0);}
            });
        });

    } else {
        container.innerHTML = window.PANEL_TEMPLATES.OSC2();

        const btnSync = document.getElementById('panel-osc-sync-box');
        if (btnSync) {
            btnSync.addEventListener('click', () => {
                const active = btnSync.classList.toggle('active');
                if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('osc_sync_enable', active ? 1.0 : 0.0);}
            });
        }

        const selectOsc2Pmod = document.getElementById('panel-osc2-pmod-src-select');
        if (selectOsc2Pmod) {
            selectOsc2Pmod.addEventListener('change', () => {
                if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('osc2_pm_source', parseInt(selectOsc2Pmod.value) / 6.0);}
            });
        }

        const selectOsc2Tmod = document.getElementById('panel-osc2-tpm-src-select');
        if (selectOsc2Tmod) {
            selectOsc2Tmod.addEventListener('change', () => {
                if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('osc2_tpm_source', parseInt(selectOsc2Tmod.value) / 5.0);}
            });
        }

        container.querySelectorAll('.osc2-range-led-row').forEach(row => {
            row.addEventListener('click', () => {
                const val = parseInt(row.getAttribute('data-val'));
                container.querySelectorAll('.osc2-range-led-row').forEach(r => r.classList.remove('active'));
                row.classList.add('active');
                if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('osc2_range', val / 2.0);}
            });
        });
    }

    // LCD hovers
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
            lcd.innerHTML = '<span class=\"lcd-label\">OSC ' + (state.panelActiveOsc || 1) + ' PANEL</span><br>'
                + '<strong>' + name.toUpperCase() + '</strong><br>'
                + '<span style=\"font-size:15px;color:var(--accent-pink);\">' + pct + '%</span>';
            if (typeof window.setLcdParamDisplayTimer === 'function') {window.setLcdParamDisplayTimer(lcd);}
        });
    });
    container.querySelectorAll('.toggle-box[data-param]').forEach(function(el) {
        el.addEventListener('mouseenter', function() {
            const lcd = document.getElementById('lcd-text');
            if (!lcd) {return;}
            const pid = this.getAttribute('data-param');
            const bridge = window.dualMidiBridge;
            const v = bridge ? bridge.parameterCache[pid] : 0;
            const lbl = this.querySelector('.toggle-label');
            const name = lbl ? lbl.textContent.trim() : pid;
            lcd.innerHTML = '<span class=\"lcd-label\">OSC ' + (state.panelActiveOsc || 1) + ' PANEL</span><br>'
                + '<strong>' + name.toUpperCase() + '</strong><br>'
                + '<span style=\"font-size:15px;color:var(--accent-pink);\">' + window.formatParamValue(pid, v) + '</span>';
            if (typeof window.setLcdParamDisplayTimer === 'function') {window.setLcdParamDisplayTimer(lcd);}
        });
    });
    container.querySelectorAll('.shape-led-row[data-param]').forEach(function(el) {
        el.addEventListener('mouseenter', function() {
            const lcd = document.getElementById('lcd-text');
            if (!lcd) {return;}
            const pid = this.getAttribute('data-param');
            const bridge = window.dualMidiBridge;
            const v = bridge ? bridge.parameterCache[pid] : 0;
            const nameEl = this.querySelector('.shape-name');
            const name = nameEl ? nameEl.textContent.trim() : pid;
            lcd.innerHTML = '<span class=\"lcd-label\">OSC ' + (state.panelActiveOsc || 1) + ' PANEL</span><br>'
                + '<strong>' + name.toUpperCase() + '</strong><br>'
                + '<span style=\"font-size:15px;color:var(--accent-pink);\">' + window.formatParamValue(pid, v) + '</span>';
            if (typeof window.setLcdParamDisplayTimer === 'function') {window.setLcdParamDisplayTimer(lcd);}
        });
    });
    container.querySelectorAll('select[data-param]').forEach(function(el) {
        el.addEventListener('mouseenter', function() {
            const lcd = document.getElementById('lcd-text');
            if (!lcd) {return;}
            const pid = this.getAttribute('data-param');
            const bridge = window.dualMidiBridge;
            const v = bridge ? bridge.parameterCache[pid] : 0;
            const opts = this.options;
            const idx = Math.round(v * (opts.length - 1));
            const selectedText = opts[idx] ? opts[idx].textContent.trim() : pid;
            lcd.innerHTML = '<span class=\"lcd-label\">OSC ' + (state.panelActiveOsc || 1) + ' PANEL</span><br>'
                + '<strong>' + pid.toUpperCase() + '</strong><br>'
                + '<span style=\"font-size:15px;color:var(--accent-pink);\">' + selectedText + '</span>';
            if (typeof window.setLcdParamDisplayTimer === 'function') {window.setLcdParamDisplayTimer(lcd);}
        });
    });
};
