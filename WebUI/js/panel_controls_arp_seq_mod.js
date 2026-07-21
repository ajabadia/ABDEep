/**
 * @purpose Handles parameter bindings, selectors, clicks, and LCD hover actions for Arpeggiator, Chord Memory, Poly Chord, and Control Sequencer panel views.
 * @purpose_en ARP and SEQ control panel bindings.
 */

window.bindPanelArpControls = function(container, state, titleEl) {
    titleEl.innerText = 'Arpeggiator Settings';
    container.innerHTML = window.PANEL_TEMPLATES.ARP();

    const arpBox = document.getElementById('panel-arp-enable-box');
    if (arpBox) {
        arpBox.addEventListener('click', () => {
            const active = arpBox.classList.contains('active');
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('arp_enable', active ? 0.0 : 1.0);}
        });
    }

    const holdBox = document.getElementById('panel-arp-hold-box');
    if (holdBox) {
        holdBox.addEventListener('click', () => {
            const active = holdBox.classList.contains('active');
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('arp_hold', active ? 0.0 : 1.0);}
        });
    }

    const keySyncBox = document.getElementById('panel-arp-keysync-box');
    if (keySyncBox) {
        keySyncBox.addEventListener('click', () => {
            const active = keySyncBox.classList.contains('active');
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('arp_key_sync', active ? 0.0 : 1.0);}
        });
    }

    const selectClock = document.getElementById('panel-arp-clock-select');
    if (selectClock) {
        selectClock.addEventListener('change', () => {
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('arp_clock_divider', parseInt(selectClock.value) / 12.0);}
        });
    }

    const selectVelGate = document.getElementById('panel-arp-velgate-select');
    if (selectVelGate) {
        selectVelGate.addEventListener('change', () => {
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('arp_velocity_gate', parseInt(selectVelGate.value) / 2.0);}
        });
    }

    const selectMode = document.getElementById('panel-arp-mode-select');
    if (selectMode) {
        selectMode.addEventListener('change', () => {
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('arp_mode', parseInt(selectMode.value) / 10.0);}
        });
    }

    const selectOctave = document.getElementById('panel-arp-octave-select');
    if (selectOctave) {
        selectOctave.addEventListener('change', () => {
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('arp_octave', parseInt(selectOctave.value) / 3.0);}
        });
    }
};

window.bindPanelChordControls = function(container, state, titleEl) {
    titleEl.innerText = 'Chord Memory';
    container.innerHTML = window.PANEL_TEMPLATES.CHORD();

    if (window.dualMidiBridge) {
        window.dualMidiBridge.requestMidiDump('chord');
    }

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

    if (typeof window._initPolyChordNotes === 'function') {
        window._initPolyChordNotes();
    }

    if (window.dualMidiBridge) {
        window.dualMidiBridge.requestMidiDump('polychord');
    }

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
                html += '<div style="font-size:7px;color:var(--text-dim);padding:2px">' + noteNames[i] + ': ' + typeName + '</div>';
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

window.bindPanelSeqControls = function(container, state, titleEl) {
    let _panelSeqBadge = '';
    const _bridge_ = window.dualMidiBridge;
    if (_bridge_) {
        const _klNorm_ = _bridge_.parameterCache['seq_key_loop'] || 0;
        const _klVal_ = Math.round(_klNorm_ * 2);
        const _forced_ = _bridge_._seqEngine && _bridge_._seqEngine._forcedFreeRunning;
        let _badgeLabel_ = '', _badgeColor_ = '';
        if (_forced_) { _badgeLabel_ = 'FREE*'; _badgeColor_ = 'var(--accent-yellow)'; }
        else if (_klVal_ === 0) { _badgeLabel_ = 'FREE'; _badgeColor_ = 'var(--accent-green)'; }
        else if (_klVal_ === 1) { _badgeLabel_ = 'KEY'; _badgeColor_ = 'var(--accent-blue)'; }
        else { _badgeLabel_ = 'LOOP'; _badgeColor_ = 'var(--accent-teal)'; }
        let _badgeTooltip_ = '';
        if (_forced_) {
            _badgeTooltip_ = ' title="Key Sync desactivado automáticamente — no había teclas presionadas al activar SEQ"';
        }
        const _badgeCursor_ = _forced_ ? ';cursor:help' : '';
        _panelSeqBadge = ' <span style="color:' + _badgeColor_ + ';font-weight:bold;border:1px solid ' + _badgeColor_ + ';padding:0 5px;border-radius:3px;font-size:9px;vertical-align:middle' + _badgeCursor_ + '"' + _badgeTooltip_ + '>' + _badgeLabel_ + '</span>';
    }
    titleEl.innerHTML = 'Control Sequencer' + (window._seqSimMode ? ' ⚡SIM' : '') + _panelSeqBadge;
    container.innerHTML = window.PANEL_TEMPLATES.SEQ();

    const stepsContainer = document.getElementById('panel-seq-steps-container');
    window._panelSeqValues = new Array(32).fill(0);
    window._panelSeqRaw = new Array(32).fill(128);

    if (stepsContainer) {
        stepsContainer.innerHTML = '';
        for (let psi = 0; psi < 32; psi++) {
            (function(stepIdx) {
                const stepWrap = document.createElement('div');
                stepWrap.style.cssText = 'position:relative;cursor:ns-resize;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;background:var(--bg-header);border-radius:1px;transition:box-shadow 0.12s ease,outline 0.12s ease;';
                if (stepIdx >= 16) {stepWrap.style.gridRow = '2';}
                
                const zLine = document.createElement('div');
                zLine.style.cssText = 'position:absolute;left:0;right:0;bottom:50%;height:1px;background:rgba(255,255,255,0.08);z-index:1;pointer-events:none;';
                stepWrap.appendChild(zLine);
                
                const fillBar = document.createElement('div');
                fillBar.className = 'panel-seq-fill';
                fillBar.style.cssText = 'width:100%;position:absolute;bottom:50%;height:0%;background:var(--accent-pink);border-radius:1px;pointer-events:none;';
                stepWrap.appendChild(fillBar);
                
                const skipBadge = document.createElement('div');
                skipBadge.className = 'panel-seq-skip';
                skipBadge.style.cssText = 'position:absolute;top:1px;left:50%;transform:translateX(-50%);font-size:6px;font-weight:bold;color:var(--color-danger);background:rgba(255,0,0,0.12);padding:0 2px;border-radius:1px;display:none;pointer-events:none;white-space:nowrap;letter-spacing:0.5px;';
                skipBadge.textContent = 'SKIP';
                stepWrap.appendChild(skipBadge);
                
                const numLabel = document.createElement('div');
                numLabel.className = 'panel-seq-num';
                numLabel.style.cssText = 'position:absolute;bottom:1px;left:50%;transform:translateX(-50%);font-size:5px;color:var(--text-faint);pointer-events:none;line-height:1;';
                numLabel.textContent = String(stepIdx + 1);
                stepWrap.appendChild(numLabel);
                
                let _isEditing = false;
                stepWrap.addEventListener('dblclick', function(e) {
                    const idx = stepIdx;
                    window._panelLastSeqStep = idx;
                    window._panelSeqValues[idx] = 0;
                    window._panelSeqRaw[idx] = 128;
                    if (window.dualMidiBridge) {
                        window.dualMidiBridge.setParameter('seq_step_' + (idx + 1), 0.5);
                    }
                    if (typeof window._updatePanelStepVisual === 'function') {
                        window._updatePanelStepVisual(idx);
                    }
                    e.preventDefault();
                    e.stopPropagation();
                });
                stepWrap.addEventListener('mousedown', function(e) {
                    _isEditing = true;
                    window._panelLastSeqStep = stepIdx;
                    const idx = stepIdx;
                    const wraps = stepsContainer ? stepsContainer.children : [];
                    if (idx < 0 || idx >= wraps.length) {return;}
                    const wrap = wraps[idx];
                    const rect = wrap.getBoundingClientRect();
                    const h = rect.height;
                    if (h <= 0) {return;}
                    let relY = 1.0 - (e.clientY - rect.top) / h;
                    relY = Math.max(0, Math.min(1, relY));
                    let bipolar = Math.round((relY * 255) - 128);
                    if (Math.abs(bipolar) <= 2) {bipolar = 0;}
                    window._panelSeqValues[idx] = bipolar;
                    const rawByte = Math.max(0, Math.min(255, bipolar + 128));
                    window._panelSeqRaw[idx] = rawByte;
                    const normalized = Math.max(0, Math.min(1, rawByte / 255.0));
                    if (window.dualMidiBridge) {
                        window.dualMidiBridge.setParameter('seq_step_' + (idx + 1), normalized);
                    }
                    window._updatePanelStepVisual(idx);
                    e.preventDefault();
                    
                    function _onMove(ev) {
                        if (!_isEditing) {return;}
                        const idx2 = stepIdx;
                        const wraps2 = stepsContainer ? stepsContainer.children : [];
                        if (idx2 < 0 || idx2 >= wraps2.length) {return;}
                        const wrap2 = wraps2[idx2];
                        const rect2 = wrap2.getBoundingClientRect();
                        const h2 = rect2.height;
                        if (h2 <= 0) {return;}
                        let relY2 = 1.0 - (ev.clientY - rect2.top) / h2;
                        relY2 = Math.max(0, Math.min(1, relY2));
                        let bipolar2 = Math.round((relY2 * 255) - 128);
                        if (Math.abs(bipolar2) <= 2) {bipolar2 = 0;}
                        window._panelSeqValues[idx2] = bipolar2;
                        const rawByte2 = Math.max(0, Math.min(255, bipolar2 + 128));
                        window._panelSeqRaw[idx2] = rawByte2;
                        const normalized2 = Math.max(0, Math.min(1, rawByte2 / 255.0));
                        if (window.dualMidiBridge) {
                            window.dualMidiBridge.setParameter('seq_step_' + (idx2 + 1), normalized2);
                        }
                        window._updatePanelStepVisual(idx2);
                    }
                    function _onUp() {
                        _isEditing = false;
                        document.removeEventListener('mousemove', _onMove);
                        document.removeEventListener('mouseup', _onUp);
                    }
                    document.addEventListener('mousemove', _onMove);
                    document.addEventListener('mouseup', _onUp);
                });
                
                let _touchId = null;
                stepWrap.addEventListener('touchstart', function(e) {
                    if (e.touches.length !== 1) {return;}
                    _touchId = e.changedTouches[0].identifier;
                    _isEditing = true;
                    window._panelLastSeqStep = stepIdx;
                    const idx = stepIdx;
                    const wraps = stepsContainer ? stepsContainer.children : [];
                    if (idx < 0 || idx >= wraps.length) {return;}
                    const wrap = wraps[idx];
                    const rect = wrap.getBoundingClientRect();
                    const h = rect.height;
                    if (h <= 0) {return;}
                    let relY = 1.0 - (e.touches[0].clientY - rect.top) / h;
                    relY = Math.max(0, Math.min(1, relY));
                    let bipolar = Math.round((relY * 255) - 128);
                    if (Math.abs(bipolar) <= 2) {bipolar = 0;}
                    window._panelSeqValues[idx] = bipolar;
                    const rawByte = Math.max(0, Math.min(255, bipolar + 128));
                    window._panelSeqRaw[idx] = rawByte;
                    const normalized = Math.max(0, Math.min(1, rawByte / 255.0));
                    if (window.dualMidiBridge) {
                        window.dualMidiBridge.setParameter('seq_step_' + (idx + 1), normalized);
                    }
                    window._updatePanelStepVisual(idx);
                    
                    function _onTouchMove(ev) {
                        if (!_isEditing) {return;}
                        let touch = null;
                        for (let ti = 0; ti < ev.touches.length; ti++) {
                                  if (ev.touches[ti].identifier === _touchId) {
                                      touch = ev.touches[ti];
                                      break;
                                  }
                        }
                        if (!touch) {return;}
                        const idx2 = stepIdx;
                        const wraps2 = stepsContainer ? stepsContainer.children : [];
                        if (idx2 < 0 || idx2 >= wraps2.length) {return;}
                        const wrap2 = wraps2[idx2];
                        const rect2 = wrap2.getBoundingClientRect();
                        const h2 = rect2.height;
                        if (h2 <= 0) {return;}
                        let relY2 = 1.0 - (touch.clientY - rect2.top) / h2;
                        relY2 = Math.max(0, Math.min(1, relY2));
                        let bipolar2 = Math.round((relY2 * 255) - 128);
                        if (Math.abs(bipolar2) <= 2) {bipolar2 = 0;}
                        window._panelSeqValues[idx2] = bipolar2;
                        const rawByte2 = Math.max(0, Math.min(255, bipolar2 + 128));
                        window._panelSeqRaw[idx2] = rawByte2;
                        const normalized2 = Math.max(0, Math.min(1, rawByte2 / 255.0));
                        if (window.dualMidiBridge) {
                            window.dualMidiBridge.setParameter('seq_step_' + (idx2 + 1), normalized2);
                        }
                        window._updatePanelStepVisual(idx2);
                        ev.preventDefault();
                    }
                    function _onTouchEnd() {
                        _isEditing = false;
                        _touchId = null;
                        document.removeEventListener('touchmove', _onTouchMove);
                        document.removeEventListener('touchend', _onTouchEnd);
                    }
                    document.addEventListener('touchmove', _onTouchMove, { passive: false });
                    document.addEventListener('touchend', _onTouchEnd, { passive: false });
                }, { passive: false });
                
                stepWrap.addEventListener('mouseenter', (function(idx) {
                    return function() {
                        const lcdText = document.getElementById('lcd-text');
                        if (!lcdText) {return;}
                        const v = window._panelSeqValues ? window._panelSeqValues[idx] : 0;
                        const r = window._panelSeqRaw ? window._panelSeqRaw[idx] : 128;
                        const isSkip = r === 0;
                        const sign = v >= 0 ? '+' : '';
                        const valStr = isSkip ? 'SKIP' : sign + v;
                        lcdText.innerHTML = '<span style="font-size:10px; opacity:0.6;">CONTROL SEQ PANEL</span><br>'
                            + '<strong>STEP ' + (idx + 1) + ' VALUE</strong><br>'
                            + '<span style="font-size:15px; color:var(--accent-pink);">' + valStr + ' (raw:' + r + ')</span>';
                        if (typeof window.setLcdParamDisplayTimer === 'function') {window.setLcdParamDisplayTimer(lcdText);}
                    };
                })(stepIdx));
                
                stepsContainer.appendChild(stepWrap);
            })(psi);
        }
    }

    window._updatePanelStepVisual = function(idx) {
        const wraps = stepsContainer ? stepsContainer.children : [];
        if (idx < 0 || idx >= wraps.length) {return;}
        const wrap = wraps[idx];
        const val = window._panelSeqValues[idx];
        const raw = window._panelSeqRaw[idx];
        if (val === undefined || raw === undefined) {return;}
        const fillBar = wrap.querySelector('.panel-seq-fill');
        const skipBadge = wrap.querySelector('.panel-seq-skip');
        const numLabel = wrap.querySelector('.panel-seq-num');
        const lenSel = document.getElementById('panel-seq-length-select');
        const activeLen = lenSel ? (parseInt(lenSel.value) + 2) : 16;
        const isActive = idx < activeLen;
        const isSkip = raw === 0;
        
        const signStr = val >= 0 ? '+' : '';
        wrap.title = isSkip 
            ? 'Step ' + (idx + 1) + ': SKIP (raw: ' + raw + ')' 
            : 'Step ' + (idx + 1) + ': ' + signStr + val + ' (raw: ' + raw + ')';

        if (skipBadge) {skipBadge.style.display = isSkip ? 'block' : 'none';}
        if (numLabel) {
            numLabel.style.color = isActive ? 'var(--text-faint)' : 'var(--text-dim)';
            numLabel.style.opacity = isActive ? '1' : '0.3';
        }
        wrap.style.opacity = isActive ? '1' : '0.3';
        
        if (fillBar) {
            if (isSkip) {
                fillBar.style.height = '0%';
                fillBar.style.background = 'transparent';
                fillBar.style.borderTop = '1px dashed var(--color-danger)';
            } else if (val >= 0) {
                var pct = Math.min(50, (val / 127) * 50);
                fillBar.style.bottom = '50%';
                fillBar.style.height = pct + '%';
                fillBar.style.background = 'var(--accent-pink)';
                fillBar.style.borderTop = 'none';
            } else {
                var pct = Math.min(50, (Math.abs(val) / 128) * 50);
                fillBar.style.bottom = (50 - pct) + '%';
                fillBar.style.height = pct + '%';
                fillBar.style.background = 'color-mix(in srgb, var(--accent-pink) 40%, #000)';
                fillBar.style.borderTop = 'none';
            }
        }
    };

    function _syncPanelSeqFromCache() {
        const bridge = window.dualMidiBridge;
        if (!bridge) {return;}
        for (let si = 0; si < 32; si++) {
            const paramId = 'seq_step_' + (si + 1);
            const norm = bridge.parameterCache[paramId];
            if (norm !== undefined) {
                const rawByte = Math.round(norm * 255);
                window._panelSeqRaw[si] = rawByte;
                window._panelSeqValues[si] = rawByte === 0 ? 0 : rawByte - 128;
                window._updatePanelStepVisual(si);
            }
        }
    }
    _syncPanelSeqFromCache();

    const seqBox = document.getElementById('panel-seq-enable-box');
    if (seqBox) {
        const enVal = window.dualMidiBridge ? window.dualMidiBridge.parameterCache['seq_enable'] : 0;
        seqBox.classList.toggle('active', enVal > 0.5);
        seqBox.addEventListener('click', function() {
            const active = this.classList.contains('active');
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('seq_enable', active ? 0.0 : 1.0);}
        });
    }

    const openModalBtn = document.getElementById('panel-seq-open-modal-btn');
    if (openModalBtn) {
        openModalBtn.addEventListener('click', function() {
            const backdrop = document.getElementById('seq-modal-backdrop');
            if (backdrop) {
                backdrop.style.display = 'flex';
                if (typeof window.syncSeqModalUIFromState === 'function') {
                    window.syncSeqModalUIFromState();
                }
            }
        });
    }

    const clockSel = document.getElementById('panel-seq-clock-select');
    if (clockSel) {
        const cv = window.dualMidiBridge ? window.dualMidiBridge.parameterCache['seq_clock'] || 0 : 0;
        clockSel.value = Math.round(cv * 15);
        clockSel.addEventListener('change', function() {
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('seq_clock', parseInt(this.value) / 15.0);}
        });
    }

    const lenSel = document.getElementById('panel-seq-length-select');
    if (lenSel) {
        const lv = window.dualMidiBridge ? window.dualMidiBridge.parameterCache['seq_length'] || 0 : 0;
        lenSel.value = Math.round(lv * 31);
        lenSel.addEventListener('change', function() {
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('seq_length', parseInt(this.value) / 31.0);}
            for (let si2 = 0; si2 < 32; si2++) {window._updatePanelStepVisual(si2);}
        });
    }

    const klSel = document.getElementById('panel-seq-keyloop-select');
    if (klSel) {
        const kv = window.dualMidiBridge ? window.dualMidiBridge.parameterCache['seq_key_loop'] || 0 : 0;
        klSel.value = Math.round(kv * 2);
        klSel.addEventListener('change', function() {
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('seq_key_loop', parseInt(this.value) / 2.0);}
            const _bridge_ = window.dualMidiBridge;
            if (_bridge_ && titleEl) {
                const _klv_ = Math.round((_bridge_.parameterCache['seq_key_loop'] || 0) * 2);
                const _frc_ = _bridge_._seqEngine && _bridge_._seqEngine._forcedFreeRunning;
                let _lb_ = '', _lc_ = '';
                if (_frc_) { _lb_ = 'FREE*'; _lc_ = 'var(--accent-yellow)'; }
                else if (_klv_ === 0) { _lb_ = 'FREE'; _lc_ = 'var(--accent-green)'; }
                else if (_klv_ === 1) { _lb_ = 'KEY'; _lc_ = 'var(--accent-blue)'; }
                else { _lb_ = 'LOOP'; _lc_ = 'var(--accent-teal)'; }
                let _klTooltip_ = '';
                if (_frc_) {
                    _klTooltip_ = ' title="Key Sync desactivado automáticamente — no había teclas presionadas al activar SEQ"';
                }
                const _klCursor_ = _frc_ ? ';cursor:help' : '';
                const _nwBadge_ = ' <span style="color:' + _lc_ + ';font-weight:bold;border:1px solid ' + _lc_ + ';padding:0 5px;border-radius:3px;font-size:9px;vertical-align:middle' + _klCursor_ + '"' + _klTooltip_ + '>' + _lb_ + '</span>';
                titleEl.innerHTML = 'Control Sequencer' + (window._seqSimMode ? ' ⚡SIM' : '') + _nwBadge_;
            }
        });
    }

    const skipBtn = document.getElementById('panel-seq-skip-btn');
    if (skipBtn) {
        skipBtn.addEventListener('click', function() {
            const idx = typeof window._panelLastSeqStep === 'number' ? window._panelLastSeqStep : 0;
            const currentRaw = window._panelSeqRaw && window._panelSeqRaw[idx];
            if (currentRaw === 0) {
                window._panelSeqValues[idx] = 0;
                window._panelSeqRaw[idx] = 128;
                if (window.dualMidiBridge) {
                    window.dualMidiBridge.setParameter('seq_step_' + (idx + 1), 0.5);
                }
            } else {
                window._panelSeqValues[idx] = -128;
                window._panelSeqRaw[idx] = 0;
                if (window.dualMidiBridge) {
                    window.dualMidiBridge.setParameter('seq_step_' + (idx + 1), 0.0);
                }
            }
            window._updatePanelStepVisual(idx);
        });
    }
};
