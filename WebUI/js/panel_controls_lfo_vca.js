/**
 * @purpose Handles parameter bindings, click events, and LCD hover actions for LFO 1/2 and VCA panel views.
 * @purpose_en LFO and VCA control panel bindings.
 */

window.bindPanelLfoControls = function(container, state, titleEl) {
    const lfoSelectBtn = document.getElementById('lfo-select-btn');
    if (lfoSelectBtn) {
        state.panelActiveLfo = lfoSelectBtn.innerText.includes('LFO 2') ? 2 : 1;
    }

    titleEl.innerText = `LFO ${state.panelActiveLfo} Editor`;
    const prefix = `lfo${state.panelActiveLfo}_`;
    container.innerHTML = window.PANEL_TEMPLATES.LFO(prefix);

    if (window.dualMidiBridge) {
        const arpSyncVal = window.dualMidiBridge.parameterCache[`${prefix}arp_sync`] || 0;
        const rateLabel = container.querySelector(`[data-param="${prefix}rate"] .label`);
        if (rateLabel) {
            rateLabel.innerText = arpSyncVal > 0.5 ? 'Clock Div' : 'Rate';
        }
    }

    container.querySelectorAll('.shape-led-row').forEach(row => {
        row.addEventListener('click', () => {
            const shapeVal = parseInt(row.getAttribute('data-shape'));
            const paramId = row.getAttribute('data-param');
            container.querySelectorAll('.shape-led-row').forEach(r => r.classList.remove('active'));
            row.classList.add('active');
            if (window.dualMidiBridge) window.dualMidiBridge.setParameter(paramId, shapeVal / 6.0);
        });
    });

    container.querySelectorAll('.toggle-box').forEach(box => {
        box.addEventListener('click', () => {
            const paramId = box.getAttribute('data-param');
            const isCurrentlyActive = box.classList.toggle('active');
            if (window.dualMidiBridge) window.dualMidiBridge.setParameter(paramId, isCurrentlyActive ? 1.0 : 0.0);
        });
    });

    // LCD hovers
    container.querySelectorAll('.ctrl-unit[data-param]').forEach(function(el) {
        el.addEventListener('mouseenter', function() {
            var lcd = document.getElementById('lcd-text');
            if (!lcd) return;
            var pid = this.getAttribute('data-param');
            var bridge = window.dualMidiBridge;
            var v = bridge ? bridge.parameterCache[pid] : 0;
            var lbl = this.querySelector('.label');
            var name = lbl ? lbl.textContent.trim() : pid;
            var pct = typeof v === 'number' ? Math.round(v * 100) : 0;
            lcd.innerHTML = '<span style="font-size:10px;opacity:0.6;">LFO ' + (state.panelActiveLfo || 1) + ' PANEL</span><br>'
                + '<strong>' + name.toUpperCase() + '</strong><br>'
                + '<span style="font-size:15px;color:var(--accent-pink);">' + pct + '%</span>';
            if (typeof window.setLcdParamDisplayTimer === 'function') window.setLcdParamDisplayTimer(lcd);
        });
    });
    container.querySelectorAll('.toggle-box[data-param]').forEach(function(el) {
        el.addEventListener('mouseenter', function() {
            var lcd = document.getElementById('lcd-text');
            if (!lcd) return;
            var pid = this.getAttribute('data-param');
            var bridge = window.dualMidiBridge;
            var v = bridge ? bridge.parameterCache[pid] : 0;
            var lbl = this.querySelector('.toggle-label');
            var name = lbl ? lbl.textContent.trim() : pid;
            lcd.innerHTML = '<span style="font-size:10px;opacity:0.6;">LFO ' + (state.panelActiveLfo || 1) + ' PANEL</span><br>'
                + '<strong>' + name.toUpperCase() + '</strong><br>'
                + '<span style="font-size:15px;color:var(--accent-pink);">' + window.formatParamValue(pid, v) + '</span>';
            if (typeof window.setLcdParamDisplayTimer === 'function') window.setLcdParamDisplayTimer(lcd);
        });
    });
    container.querySelectorAll('.shape-led-row[data-param]').forEach(function(el) {
        el.addEventListener('mouseenter', function() {
            var lcd = document.getElementById('lcd-text');
            if (!lcd) return;
            var pid = this.getAttribute('data-param');
            var bridge = window.dualMidiBridge;
            var v = bridge ? bridge.parameterCache[pid] : 0;
            var nameEl = this.querySelector('.shape-name');
            var name = nameEl ? nameEl.textContent.trim() : pid;
            lcd.innerHTML = '<span style="font-size:10px;opacity:0.6;">LFO ' + (state.panelActiveLfo || 1) + ' PANEL</span><br>'
                + '<strong>' + name.toUpperCase() + '</strong><br>'
                + '<span style="font-size:15px;color:var(--accent-pink);">' + window.formatParamValue(pid, v) + '</span>';
            if (typeof window.setLcdParamDisplayTimer === 'function') window.setLcdParamDisplayTimer(lcd);
        });
    });
};

window.bindPanelVcaControls = function(container, state, titleEl) {
    titleEl.innerText = "VCA Editor";
    container.innerHTML = window.PANEL_TEMPLATES.VCA();

    const btnTransparent = document.getElementById('panel-vca-mode-transparent');
    const btnBallsy = document.getElementById('panel-vca-mode-ballsy');
    
    if (btnTransparent && btnBallsy) {
        btnTransparent.addEventListener('click', () => {
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter("vca_mode", 0.0);
                window.dualMidiBridge.handleParameterChangeFromBackend("vca_mode", 0.0);
            }
        });
        btnBallsy.addEventListener('click', () => {
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter("vca_mode", 1.0);
                window.dualMidiBridge.handleParameterChangeFromBackend("vca_mode", 1.0);
            }
        });
    }

    // LCD hovers
    container.querySelectorAll('.ctrl-unit[data-param]').forEach(function(el) {
        el.addEventListener('mouseenter', function() {
            var lcd = document.getElementById('lcd-text');
            if (!lcd) return;
            var pid = this.getAttribute('data-param');
            var bridge = window.dualMidiBridge;
            var v = bridge ? bridge.parameterCache[pid] : 0;
            var lbl = this.querySelector('.label');
            var name = lbl ? lbl.textContent.trim() : pid;
            var pct = typeof v === 'number' ? Math.round(v * 100) : 0;
            lcd.innerHTML = '<span style="font-size:10px;opacity:0.6;">VCA PANEL</span><br>'
                + '<strong>' + name.toUpperCase() + '</strong><br>'
                + '<span style="font-size:15px;color:var(--accent-pink);">' + pct + '%</span>';
            if (typeof window.setLcdParamDisplayTimer === 'function') window.setLcdParamDisplayTimer(lcd);
        });
    });
    container.querySelectorAll('.toggle-box[data-param]').forEach(function(el) {
        el.addEventListener('mouseenter', function() {
            var lcd = document.getElementById('lcd-text');
            if (!lcd) return;
            var pid = this.getAttribute('data-param');
            var bridge = window.dualMidiBridge;
            var v = bridge ? bridge.parameterCache[pid] : 0;
            var lbl = this.querySelector('.toggle-label');
            var name = lbl ? lbl.textContent.trim() : pid;
            lcd.innerHTML = '<span style="font-size:10px;opacity:0.6;">VCA PANEL</span><br>'
                + '<strong>' + name.toUpperCase() + '</strong><br>'
                + '<span style="font-size:15px;color:var(--accent-pink);">' + window.formatParamValue(pid, v) + '</span>';
            if (typeof window.setLcdParamDisplayTimer === 'function') window.setLcdParamDisplayTimer(lcd);
        });
    });
};
