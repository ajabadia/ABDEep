/**
 * @purpose Handles parameter bindings, selectors, clicks, and LCD hover actions for Envelope (ENV 1/2/3), Polyphony/Unison, and Glide/Portamento panel views.
 * @purpose_en ENV and VOICE control panel bindings.
 */

window.bindPanelEnvControls = function(container, state, titleEl) {
    const activeEnvBtn = document.querySelector('.env-type-btn.active');
    if (activeEnvBtn) {
        state.panelActiveEnv = parseInt(activeEnvBtn.getAttribute('data-env')) || 1;
    }
    const prefix = `env${state.panelActiveEnv}_`;
    const envName = state.panelActiveEnv === 1 ? 'VCA' : (state.panelActiveEnv === 2 ? 'VCF' : 'MOD');
    titleEl.innerText = `${envName} Env Editor`;

    container.innerHTML = window.PANEL_TEMPLATES.ENV(prefix);

    container.querySelectorAll('.shape-led-row').forEach(row => {
        row.addEventListener('click', () => {
            const trigVal = parseInt(row.getAttribute('data-trig'));
            const paramId = row.getAttribute('data-param');
            container.querySelectorAll('.shape-led-row').forEach(r => r.classList.remove('active'));
            row.classList.add('active');
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter(paramId, trigVal / 4.0);}
        });
    });

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
            const envName = state.panelActiveEnv === 1 ? 'VCA' : (state.panelActiveEnv === 2 ? 'VCF' : 'MOD');
            lcd.innerHTML = '<span style="font-size:10px;opacity:0.6;">' + envName + ' ENV PANEL</span><br>'
                + '<strong>' + name.toUpperCase() + '</strong><br>'
                + '<span style="font-size:15px;color:var(--accent-pink);">' + pct + '%</span>';
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
            const envName = state.panelActiveEnv === 1 ? 'VCA' : (state.panelActiveEnv === 2 ? 'VCF' : 'MOD');
            lcd.innerHTML = '<span style="font-size:10px;opacity:0.6;">' + envName + ' ENV PANEL</span><br>'
                + '<strong>' + name.toUpperCase() + '</strong><br>'
                + '<span style="font-size:15px;color:var(--accent-pink);">' + window.formatParamValue(pid, v) + '</span>';
            if (typeof window.setLcdParamDisplayTimer === 'function') {window.setLcdParamDisplayTimer(lcd);}
        });
    });
};

window.bindPanelPolyControls = function(container, state, titleEl) {
    titleEl.innerText = 'Polyphony & Unison';
    container.innerHTML = window.PANEL_TEMPLATES.POLY();

    const selectPolyMode = document.getElementById('panel-poly-mode-select');
    if (selectPolyMode) {
        selectPolyMode.addEventListener('change', () => {
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('voice_mode', parseInt(selectPolyMode.value) / 12.0);}
        });
    }

    container.querySelectorAll('.priority-led-row').forEach(row => {
        row.addEventListener('click', () => {
            const val = parseInt(row.getAttribute('data-val'));
            const paramId = row.getAttribute('data-param');
            container.querySelectorAll('.priority-led-row').forEach(r => r.classList.remove('active'));
            row.classList.add('active');
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter(paramId, val / 2.0);}
        });
    });

    container.querySelectorAll('.trigger-led-row').forEach(row => {
        row.addEventListener('click', () => {
            const val = parseInt(row.getAttribute('data-val'));
            const paramId = row.getAttribute('data-param');
            container.querySelectorAll('.trigger-led-row').forEach(r => r.classList.remove('active'));
            row.classList.add('active');
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter(paramId, val / 3.0);}
        });
    });

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
            lcd.innerHTML = '<span style="font-size:10px;opacity:0.6;">POLY PANEL</span><br>'
                + '<strong>' + name.toUpperCase() + '</strong><br>'
                + '<span style="font-size:15px;color:var(--accent-pink);">' + pct + '%</span>';
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
            lcd.innerHTML = '<span style="font-size:10px;opacity:0.6;">POLY PANEL</span><br>'
                + '<strong>' + name.toUpperCase() + '</strong><br>'
                + '<span style="font-size:15px;color:var(--accent-pink);">' + window.formatParamValue(pid, v) + '</span>';
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
            lcd.innerHTML = '<span style="font-size:10px;opacity:0.6;">POLY PANEL</span><br>'
                + '<strong>' + pid.toUpperCase() + '</strong><br>'
                + '<span style="font-size:15px;color:var(--accent-pink);">' + selectedText + '</span>';
            if (typeof window.setLcdParamDisplayTimer === 'function') {window.setLcdParamDisplayTimer(lcd);}
        });
    });
};

window.bindPanelPortaControls = function(container, state, titleEl) {
    titleEl.innerText = 'Glide & Voice Settings';
    container.innerHTML = window.PANEL_TEMPLATES.PORTA();

    container.querySelectorAll('.porta-mode-led-row').forEach(row => {
        row.addEventListener('click', () => {
            const val = parseInt(row.getAttribute('data-val'));
            container.querySelectorAll('.porta-mode-led-row').forEach(r => r.classList.remove('active'));
            row.classList.add('active');
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('porta_mode', val / 9.0);}
        });
    });

    container.querySelectorAll('.note-priority-led-row').forEach(row => {
        row.addEventListener('click', () => {
            const val = parseInt(row.getAttribute('data-val'));
            container.querySelectorAll('.note-priority-led-row').forEach(r => r.classList.remove('active'));
            row.classList.add('active');
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('note_priority', val / 2.0);}
        });
    });

    container.querySelectorAll('.trigger-mode-led-row').forEach(row => {
        row.addEventListener('click', () => {
            const val = parseInt(row.getAttribute('data-val'));
            container.querySelectorAll('.trigger-mode-led-row').forEach(r => r.classList.remove('active'));
            row.classList.add('active');
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('trigger_mode', val / 3.0);}
        });
    });
};
