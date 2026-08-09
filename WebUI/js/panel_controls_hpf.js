/**
 * @purpose HPF (High-Pass Filter) panel control bindings:
 * Bass Boost toggle and LCD hovers.
 * Extraído de panel_controls_osc_vcf.js.
 */

window.bindPanelHpfControls = function(container, state, titleEl) {
    titleEl.innerText = 'HPF Editor';
    container.innerHTML = window.PANEL_TEMPLATES.HPF();

    const btnBoostOff = document.getElementById('panel-hpf-boost-off');
    const btnBoostOn = document.getElementById('panel-hpf-boost-on');
    
    if (btnBoostOff && btnBoostOn) {
        btnBoostOff.addEventListener('click', () => {
            if (getBridge()) {
                getBridge().setParameter('hpf_boost_enable', 0.0);
                getBridge().handleParameterChangeFromBackend('hpf_boost_enable', 0.0);
            }
        });
        btnBoostOn.addEventListener('click', () => {
            if (getBridge()) {
                getBridge().setParameter('hpf_boost_enable', 1.0);
                getBridge().handleParameterChangeFromBackend('hpf_boost_enable', 1.0);
            }
        });
    }

    // LCD hovers for .ctrl-unit
    container.querySelectorAll('.ctrl-unit[data-param]').forEach(function(el) {
        el.addEventListener('mouseenter', function() {
            const lcd = document.getElementById('lcd-text');
            if (!lcd) {return;}
            const pid = this.getAttribute('data-param');
            const bridge = getBridge();
            const v = bridge ? bridge.parameterCache[pid] : 0;
            const lbl = this.querySelector('.label');
            const name = lbl ? lbl.textContent.trim() : pid;
            const pct = typeof v === 'number' ? Math.round(v * 100) : 0;
            lcd.innerHTML = '<span class=\"lcd-label\">HPF PANEL</span><br>'
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
            const bridge = getBridge();
            const v = bridge ? bridge.parameterCache[pid] : 0;
            const lbl = this.querySelector('.toggle-label');
            const name = lbl ? lbl.textContent.trim() : pid;
            lcd.innerHTML = '<span class=\"lcd-label\">HPF PANEL</span><br>'
                + '<strong>' + name.toUpperCase() + '</strong><br>'
                + '<span style=\"font-size:15px;color:var(--accent-pink);\">' + window.formatParamValue(pid, v) + '</span>';
            if (typeof window.setLcdParamDisplayTimer === 'function') {window.setLcdParamDisplayTimer(lcd);}
        });
    });
};
