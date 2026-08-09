/**
 * @purpose Chord Memory and Poly Chord control bindings — extracted from panel_controls_arp_seq_mod.js.
 * Carga secuencial vía script tags.
 */

window.bindPanelChordControls = function(container, state, titleEl) {
    titleEl.innerText = 'Chord Memory';
    container.innerHTML = window.PANEL_TEMPLATES.CHORD();

    if (window.dualMidiBridge) {window.dualMidiBridge.requestMidiDump('chord');}

    const chordBox = document.getElementById('panel-chord-enable-box');
    if (chordBox) {
        const isEnabled = window.dualMidiBridge && window.dualMidiBridge.parameterCache['chord_enable'] > 0.5;
        chordBox.classList.toggle('active', isEnabled);
        chordBox.addEventListener('click', () => {
            const active = chordBox.classList.contains('active');
            const nextVal = active ? 0.0 : 1.0;
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter('chord_enable', nextVal);
                window.dualMidiBridge.handleParameterChangeFromBackend('chord_enable', nextVal);
                if (nextVal > 0.5) {
                    window.dualMidiBridge.setParameter('poly_chord_enable', 0.0);
                    window.dualMidiBridge.handleParameterChangeFromBackend('poly_chord_enable', 0.0);
                }
            }
        });
    }

    const btnLoad = document.getElementById('panel-chord-load-btn');
    if (btnLoad) {
        btnLoad.addEventListener('click', () => {
            if (window.dualMidiBridge) {window.dualMidiBridge.requestMidiDump('chord');}
        });
    }

    const btnSend = document.getElementById('panel-chord-send-btn');
    if (btnSend) {
        btnSend.addEventListener('click', () => {
            if (window.dualMidiBridge) {window.dualMidiBridge.sendWebMidiParameter('chord_enable', window.dualMidiBridge.parameterCache['chord_enable'] || 0.0);}
        });
    }

    window.bindPanelChordAndPolyCommon(container);
};

window.bindPanelPolyChordControls = function(container, state, titleEl) {
    titleEl.innerText = 'Poly Chord';
    container.innerHTML = window.PANEL_TEMPLATES.POLY_CHORD();

    if (typeof window._initPolyChordNotes === 'function') {window._initPolyChordNotes();}
    if (window.dualMidiBridge) {window.dualMidiBridge.requestMidiDump('polychord');}

    const polyChordBox = document.getElementById('panel-poly-chord-enable-box');
    if (polyChordBox) {
        const isEnabled = window.dualMidiBridge && window.dualMidiBridge.parameterCache['poly_chord_enable'] > 0.5;
        polyChordBox.classList.toggle('active', isEnabled);
        polyChordBox.addEventListener('click', () => {
            const active = polyChordBox.classList.contains('active');
            const nextVal = active ? 0.0 : 1.0;
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter('poly_chord_enable', nextVal);
                window.dualMidiBridge.handleParameterChangeFromBackend('poly_chord_enable', nextVal);
                if (nextVal > 0.5) {
                    window.dualMidiBridge.setParameter('chord_enable', 0.0);
                    window.dualMidiBridge.handleParameterChangeFromBackend('chord_enable', 0.0);
                }
            }
        });
    }

    let selectedKeyIdx = 0;
    const noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    const chordTypeNames = ['Memory','Major','Minor','Maj7','Min7','Dom7','Sus4','Pwr'];

    function _updatePolyAssignUI() {
        const bridge = window.dualMidiBridge;
        if (!bridge) {return;}
        const polyMap = bridge.parameterCache['poly_chord_map'];
        if (!polyMap) {return;}

        const keyLabel = document.getElementById('poly-selected-key-label');
        if (keyLabel) {keyLabel.textContent = noteNames[selectedKeyIdx];}

        container.querySelectorAll('.poly-key-select-row').forEach(function(row) {
            const idx = parseInt(row.getAttribute('data-keyidx'));
            row.classList.toggle('active', idx === selectedKeyIdx);
        });

        const currentChord = polyMap[selectedKeyIdx] || { rootKey: 0, chordType: 1 };
        container.querySelectorAll('.poly-root-row').forEach(function(row) {
            const r = parseInt(row.getAttribute('data-val'));
            row.classList.toggle('active', r === currentChord.rootKey);
        });
        container.querySelectorAll('.poly-type-row').forEach(function(row) {
            const t = parseInt(row.getAttribute('data-val'));
            row.classList.toggle('active', t === currentChord.chordType);
        });

        const summaryEl = document.getElementById('poly-mapping-summary');
        if (summaryEl) {
            let html = '';
            for (let i = 0; i < 12; i++) {
                const a = polyMap[i] || { rootKey: i, chordType: 1 };
                const typeName = chordTypeNames[a.chordType] || 'Major';
                html += '<div class=\"poly-chord-summary-item\">' + noteNames[i] + ': ' + typeName + '</div>';
            }
            summaryEl.innerHTML = html;
        }
    }

    container.querySelectorAll('.poly-key-select-row').forEach(function(row) {
        row.addEventListener('click', function() {
            selectedKeyIdx = parseInt(row.getAttribute('data-keyidx'));
            _updatePolyAssignUI();
        });
    });

    container.querySelectorAll('.poly-root-row').forEach(function(row) {
        row.addEventListener('click', function() {
            const val = parseInt(row.getAttribute('data-val'));
            const bridge = window.dualMidiBridge;
            if (!bridge) {return;}
            const polyMap = bridge.parameterCache['poly_chord_map'];
            if (!polyMap) {return;}
            if (!polyMap[selectedKeyIdx]) {polyMap[selectedKeyIdx] = { rootKey: 0, chordType: 1 };}
            polyMap[selectedKeyIdx].rootKey = val;
            _updatePolyAssignUI();
        });
    });

    container.querySelectorAll('.poly-type-row').forEach(function(row) {
        row.addEventListener('click', function() {
            const val = parseInt(row.getAttribute('data-val'));
            const bridge = window.dualMidiBridge;
            if (!bridge) {return;}
            const polyMap = bridge.parameterCache['poly_chord_map'];
            if (!polyMap) {return;}
            if (!polyMap[selectedKeyIdx]) {polyMap[selectedKeyIdx] = { rootKey: 0, chordType: 1 };}
            polyMap[selectedKeyIdx].chordType = val;
            _updatePolyAssignUI();
        });
    });

    const resetBtn = document.getElementById('panel-polychord-defaults-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', function() {
            const bridge = window.dualMidiBridge;
            if (!bridge) {return;}
            if (typeof window.POLY_CHORD_DEFAULTS !== 'undefined') {
                bridge.parameterCache['poly_chord_map'] = window.POLY_CHORD_DEFAULTS.map(function(a) {
                    return { rootKey: a.rootKey, chordType: a.chordType };
                });
            }
            _updatePolyAssignUI();
        });
    }

    const btnLoad = document.getElementById('panel-polychord-load-btn');
    if (btnLoad) {
        btnLoad.addEventListener('click', function() {
            if (window.dualMidiBridge) {window.dualMidiBridge.requestMidiDump('polychord');}
        });
    }

    const btnSend = document.getElementById('panel-polychord-send-btn');
    if (btnSend) {
        btnSend.addEventListener('click', function() {
            if (window.dualMidiBridge) {window.dualMidiBridge.sendWebMidiParameter('poly_chord_enable', window.dualMidiBridge.parameterCache['poly_chord_enable'] || 0.0);}
        });
    }

    window.bindPanelChordAndPolyCommon(container);
    setTimeout(_updatePolyAssignUI, 100);
};

window.bindPanelChordAndPolyCommon = function(container) {
    if (window.dualMidiBridge) {
        const keyVal = Math.round((window.dualMidiBridge.parameterCache['chord_key'] || 0.0) * 11.0);
        const activeKeyRow = container.querySelector(`.chord-key-led-row[data-val="${keyVal}"]`);
        if (activeKeyRow) {
            container.querySelectorAll('.chord-key-led-row').forEach(r => r.classList.remove('active'));
            activeKeyRow.classList.add('active');
        }

        const typeVal = Math.round((window.dualMidiBridge.parameterCache['chord_type'] || 0.0) * 11.0);
        const activeTypeRow = container.querySelector(`.chord-type-led-row[data-val="${typeVal}"]`);
        if (activeTypeRow) {
            container.querySelectorAll('.chord-type-led-row').forEach(r => r.classList.remove('active'));
            activeTypeRow.classList.add('active');
        }
    }

    container.querySelectorAll('.chord-key-led-row').forEach(row => {
        row.addEventListener('click', () => {
            const val = parseInt(row.getAttribute('data-val'));
            container.querySelectorAll('.chord-key-led-row').forEach(r => r.classList.remove('active'));
            row.classList.add('active');
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('chord_key', val / 11.0);}
        });
    });

    container.querySelectorAll('.chord-type-led-row').forEach(row => {
        row.addEventListener('click', () => {
            const val = parseInt(row.getAttribute('data-val'));
            container.querySelectorAll('.chord-type-led-row').forEach(r => r.classList.remove('active'));
            row.classList.add('active');
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('chord_type', val / 11.0);}
        });
    });
};
