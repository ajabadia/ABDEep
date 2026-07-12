/**
 * @purpose Gestión de diálogos modulares de Ajustes (Settings Modal) y Acerca de (About Modal), poblando puertos MIDI dinámicamente y manejando el Resync del sistema.
 * @purpose_en Manages Settings and About modals, dynamically listing MIDI ports and executing system resynchronization.
 */

function initSettingsAndModals() {
    const settingsMenuBtn = document.getElementById('menu-properties');
    const settingsModal = document.getElementById('settings-modal-backdrop');
    const settingsCloseBtn = document.getElementById('settings-modal-close-btn');

    const aboutMenuBtn = document.getElementById('menu-about');
    const aboutModal = document.getElementById('about-modal-backdrop');
    const aboutCloseBtn = document.getElementById('about-modal-close-btn');

    // ABOUT MODAL
    if (aboutMenuBtn && aboutModal && aboutCloseBtn) {
        aboutMenuBtn.addEventListener('click', (e) => {
            e.preventDefault();
            aboutModal.style.display = 'flex';
        });
        aboutCloseBtn.addEventListener('click', () => {
            aboutModal.style.display = 'none';
        });
        aboutModal.addEventListener('click', (e) => {
            if (e.target === aboutModal) {
                aboutModal.style.display = 'none';
            }
        });
    }

    // SETTINGS MODAL
    if (settingsMenuBtn && settingsModal && settingsCloseBtn) {
        function _requestGlobalDumpAndUpdate(statusElId) {
            if (!window.dualMidiBridge || !window.dualMidiBridge._connected) return;
            
            statusElId = statusElId || 'settings-global-dump-status';
            var statusEl = document.getElementById(statusElId);
            if (statusEl) {
                if (statusEl._hideTimer) {
                    clearTimeout(statusEl._hideTimer);
                    statusEl._hideTimer = null;
                }
                statusEl.style.display = '';
                void statusEl.offsetWidth;
                statusEl.classList.add('visible', 'spinner');
            }
            
            window.dualMidiBridge.requestMidiDump('global', 3000, 1)
                .then(function(globalResp) {
                    if (globalResp && globalResp.length >= 30) {
                        window.dualMidiBridge._parseGlobalDump(globalResp);
                        _updateSettingsHardwareInfo();
                    }
                    if (statusEl) {
                        statusEl.classList.remove('visible', 'spinner');
                        statusEl._hideTimer = setTimeout(function() {
                            statusEl.style.display = 'none';
                            statusEl._hideTimer = null;
                        }, 350);
                    }
                }).catch(function() {
                    if (statusEl) {
                        statusEl.classList.remove('visible', 'spinner');
                        statusEl._hideTimer = setTimeout(function() {
                            statusEl.style.display = 'none';
                            statusEl._hideTimer = null;
                        }, 350);
                    }
                });
        }

        settingsMenuBtn.addEventListener('click', (e) => {
            e.preventDefault();
            settingsModal.style.display = 'flex';
            populateMidiPortsLists();
            _updateSettingsHardwareInfo();
            _ensureGlobalDumpButton();
            _wireGlobalDumpButton();
            _requestGlobalDumpAndUpdate();
        });

        function populateMidiPortsLists() {
            const inputsContainer = document.getElementById('settings-midi-inputs-list');
            const outputsContainer = document.getElementById('settings-midi-outputs-list');
            if (!inputsContainer || !outputsContainer) return;

            inputsContainer.innerHTML = '';
            outputsContainer.innerHTML = '';

            if (window.dualMidiBridge && window.dualMidiBridge.midiAccess) {
                const inputs = Array.from(window.dualMidiBridge.midiAccess.inputs.values());
                const outputs = Array.from(window.dualMidiBridge.midiAccess.outputs.values());

                if (inputs.length === 0) {
                    inputsContainer.innerHTML = '<div style="padding: 6px; font-size: var(--text-md); color: var(--text-dim); text-align: center;">None</div>';
                } else {
                    inputs.forEach(input => {
                        const isActive = window.dualMidiBridge.midiInput && window.dualMidiBridge.midiInput.id === input.id;
                        const el = document.createElement('div');
                        el.className = `midi-dev-item ${isActive ? 'active' : ''}`;
                        el.style.cssText = isActive ? 
                            'padding: 6px; font-size: var(--text-base); background: linear-gradient(180deg, color-mix(in srgb, var(--accent-primary) 28%, #111), color-mix(in srgb, var(--accent-primary) 10%, #000)); border: 1px solid var(--accent-primary); border-radius: var(--radius-sm); cursor: pointer; font-weight: bold; color: var(--text-primary);' :
                            'padding: 6px; font-size: var(--text-md); color: var(--text-secondary); cursor: pointer; border-radius: var(--radius-xs);';
                        el.innerText = input.name;
                        el.addEventListener('click', () => {
                            window.dualMidiBridge.midiInput = input;
                            input.onmidimessage = (msg) => window.dualMidiBridge.handleIncomingMidi(msg);
                            populateMidiPortsLists();
                        });
                        inputsContainer.appendChild(el);
                    });
                }

                if (outputs.length === 0) {
                    outputsContainer.innerHTML = '<div style="padding: 6px; font-size: var(--text-md); color: var(--text-dim); text-align: center;">None</div>';
                } else {
                    outputs.forEach(output => {
                        const isActive = window.dualMidiBridge.midiOutput && window.dualMidiBridge.midiOutput.id === output.id;
                        const el = document.createElement('div');
                        el.className = `midi-dev-item ${isActive ? 'active' : ''}`;
                        el.style.cssText = isActive ? 
                            'padding: 6px; font-size: var(--text-base); background: linear-gradient(180deg, color-mix(in srgb, var(--accent-primary) 28%, #111), color-mix(in srgb, var(--accent-primary) 10%, #000)); border: 1px solid var(--accent-primary); border-radius: var(--radius-sm); cursor: pointer; font-weight: bold; color: var(--text-primary);' :
                            'padding: 6px; font-size: var(--text-md); color: var(--text-secondary); cursor: pointer; border-radius: var(--radius-xs);';
                        el.innerText = output.name;
                        el.addEventListener('click', () => {
                            window.dualMidiBridge.midiOutput = output;
                            populateMidiPortsLists();
                        });
                        outputsContainer.appendChild(el);
                    });
                }
            } else {
                inputsContainer.innerHTML = '<div style="padding: 6px; font-size: var(--text-md); color: var(--text-dim); text-align: center;">Web MIDI Access not available</div>';
                outputsContainer.innerHTML = '<div style="padding: 6px; font-size: var(--text-md); color: var(--text-dim); text-align: center;">Web MIDI Access not available</div>';
            }
        }

        function _ensureGlobalDumpButton() {
            if (document.getElementById('settings-request-global-dump')) return;
            var infoSection = document.querySelector('#settings-view-connections > .flex-col:last-child');
            if (!infoSection) return;
            var btn = document.createElement('button');
            btn.id = 'settings-request-global-dump';
            btn.className = 'btn btn-sm';
            btn.textContent = 'Refresh';
            btn.title = 'Request Global Dump from hardware to refresh MIDI Channel, Device ID, Master Tune and Transpose';
            btn.style.cssText = 'font-size:9px;padding:2px 8px;margin-top:6px;margin-left:auto;display:block';
            var container = infoSection.querySelector('.text-center.text-uppercase.text-dim');
            if (container) {
                container.appendChild(btn);
            }
        }

        function _wireGlobalDumpButton() {
            var btn = document.getElementById('settings-request-global-dump');
            if (!btn) return;
            if (btn._wired) return;
            btn._wired = true;
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                _requestGlobalDumpAndUpdate();
            });
        }

        function _updateSettingsHardwareInfo() {
            var bridge = window.dualMidiBridge;
            if (!bridge) return;
            var info = bridge.getHardwareInfo();
            if (!info) return;
            
            var hostEl = document.getElementById('settings-synth-host-version');
            var voiceEl = document.getElementById('settings-synth-voice-version');
            var dspEl = document.getElementById('settings-synth-dsp-version');
            var bootEl = document.getElementById('settings-synth-boot-version');
            var wifiEl = document.getElementById('settings-synth-wifi-version');
            var connectionTypeEl = document.getElementById('settings-connection-type');
            
            if (hostEl) hostEl.textContent = info.hostVersion || '-';
            if (voiceEl) voiceEl.textContent = info.voiceVersion || '-';
            if (dspEl) dspEl.textContent = info.dspVersion || '-';
            if (bootEl) bootEl.textContent = info.bootVersion || '-';
            if (wifiEl) wifiEl.textContent = info.wifiVersion || '-';
            
            var synthDevIdEl = document.getElementById('settings-synth-device-id');
            var synthMidiChEl = document.getElementById('settings-synth-midi-channel');
            if (synthDevIdEl) {
                synthDevIdEl.textContent = info.deviceId !== '-' ? String(parseInt(info.deviceId) + 1) : '-';
            }
            if (synthMidiChEl) {
                synthMidiChEl.textContent = info.midiChannel ? String(info.midiChannel) : '-';
            }
            
            var deviceIdSelect = document.getElementById('settings-device-id');
            if (deviceIdSelect && info.deviceId !== '-') {
                deviceIdSelect.value = String(parseInt(info.deviceId) + 1);
            }
            
            if (connectionTypeEl) {
                connectionTypeEl.textContent = info.connectionType !== '-' && bridge._connected
                    ? 'DeepMind 12 (' + info.connectionType + ')'
                    : 'No Hardware';
            }
            
            var midiChSel = document.getElementById('settings-midi-channel');
            if (midiChSel && info.midiChannel) {
                midiChSel.value = String(info.midiChannel);
                if (bridge.midiChannel !== info.midiChannel) {
                    bridge.midiChannel = info.midiChannel;
                    localStorage.setItem('abd-eep-midi-channel', String(info.midiChannel));
                }
            }
            
            var masterTuneSel = document.getElementById('settings-master-tune');
            var globalTune = bridge.parameterCache && bridge.parameterCache['global_tune'];
            if (masterTuneSel && globalTune !== undefined) {
                var tuneCents = Math.round(globalTune * 255 - 128);
                masterTuneSel.value = (tuneCents > 0 ? '+' : '') + tuneCents + '¢';
            }
            
            var transposeSel = document.getElementById('settings-transpose');
            var transposeVal = bridge.parameterCache && bridge.parameterCache['transpose'];
            if (transposeSel && transposeVal !== undefined) {
                var transpSemi = Math.round(transposeVal * 96 - 48);
                transposeSel.value = String(transpSemi);
            }
            
            var devIdEl = document.getElementById('settings-global-device-id');
            var midiChGlEl = document.getElementById('settings-global-midi-channel');
            var tuneEl = document.getElementById('settings-global-master-tune');
            var transpEl = document.getElementById('settings-global-transpose');
            
            if (devIdEl) {
                devIdEl.textContent = info.deviceId !== '-' ? String(parseInt(info.deviceId) + 1) : '-';
            }
            if (midiChGlEl) {
                midiChGlEl.textContent = info.midiChannel ? String(info.midiChannel) : '-';
            }
            
            if (tuneEl) {
                var tuneNorm = bridge.parameterCache && bridge.parameterCache['global_tune'];
                tuneEl.textContent = tuneNorm !== undefined
                    ? (Math.round(tuneNorm * 255 - 128) > 0 ? '+' : '') + Math.round(tuneNorm * 255 - 128) + '¢'
                    : '-';
            }
            
            if (transpEl) {
                var transpNorm = bridge.parameterCache && bridge.parameterCache['transpose'];
                transpEl.textContent = transpNorm !== undefined
                    ? String(Math.round(transpNorm * 96 - 48)) + ' st'
                    : '-';
            }
            
            var velCurveSel = document.getElementById('settings-velocity-curve');
            var velCurveVal = bridge.parameterCache && bridge.parameterCache['velocity_curve'];
            if (velCurveSel && velCurveVal !== undefined) {
                var VEL_CURVE_MAP = ['normal', 'soft', 'hard', 'linear', 'fixed'];
                var curveIdx = Math.round(velCurveVal * 4);
                velCurveSel.value = VEL_CURVE_MAP[curveIdx] || 'normal';
            }
            
            var pedalPolSel = document.getElementById('settings-pedal-polarity');
            var pedalPolVal = bridge.parameterCache && bridge.parameterCache['pedal_polarity'];
            if (pedalPolSel && pedalPolVal !== undefined) {
                pedalPolSel.value = pedalPolVal > 0.5 ? 'norm-closed' : 'norm-open';
            }

            var lcdContrastSlider = document.getElementById('settings-lcd-contrast');
            var lcdContrastVal = document.getElementById('settings-lcd-contrast-val');
            var lcdContrastNorm = bridge.parameterCache && bridge.parameterCache['lcd_contrast'];
            if (lcdContrastSlider && lcdContrastNorm !== undefined) {
                var pctVal = Math.round(lcdContrastNorm * 100);
                lcdContrastSlider.value = String(pctVal);
                if (lcdContrastVal) lcdContrastVal.textContent = pctVal + '%';
                if (typeof window.updateLcdContrast === 'function') {
                    window.updateLcdContrast(pctVal);
                }
            }
            
            var statusEl = document.getElementById('settings-global-status');
            if (statusEl) {
                var hasGlobalDump = bridge._hardwareInfo && bridge._hardwareInfo.globalDumpBytes;
                if (bridge._connected && hasGlobalDump) {
                    statusEl.textContent = '✅ Global Dump loaded';
                    statusEl.style.color = 'var(--accent-green)';
                } else if (bridge._connected) {
                    statusEl.textContent = '⏳ Awaiting Global Dump...';
                    statusEl.style.color = 'var(--accent-orange)';
                } else {
                    statusEl.textContent = '⛔ Hardware disconnected';
                    statusEl.style.color = 'var(--color-danger)';
                }
            }
        }
        
        window._updateSettingsHardwareInfo = _updateSettingsHardwareInfo;

        var globalRefreshBtn = document.getElementById('settings-global-refresh');
        if (globalRefreshBtn) {
            globalRefreshBtn.addEventListener('click', function(e) {
                e.preventDefault();
                _requestGlobalDumpAndUpdate('settings-global-dump-status-panel');
            });
        }

        const resyncBtn = document.getElementById('settings-midi-resync');
        if (resyncBtn) {
            resyncBtn.addEventListener('click', async () => {
                if (!window.dualMidiBridge) return;
                resyncBtn.disabled = true;
                resyncBtn.textContent = 'Scanning...';
                resyncBtn.classList.add('btn-loading');
                await window.dualMidiBridge.resetMidiConnection();
                populateMidiPortsLists();
                _updateSettingsHardwareInfo();
                resyncBtn.disabled = false;
                resyncBtn.textContent = 'Rescan MIDI';
                resyncBtn.classList.remove('btn-loading');
            });
        }

        const synthInfoRefreshBtn = document.getElementById('settings-synth-info-refresh');
        if (synthInfoRefreshBtn) {
            synthInfoRefreshBtn.addEventListener('click', async () => {
                if (!window.dualMidiBridge) return;
                synthInfoRefreshBtn.disabled = true;
                synthInfoRefreshBtn.textContent = '...';
                try {
                    await window.dualMidiBridge.isConnected();
                    _updateSettingsHardwareInfo();
                } catch (e) {
                    console.warn('[Settings] Synth info refresh failed:', e);
                }
                synthInfoRefreshBtn.disabled = false;
                synthInfoRefreshBtn.textContent = '↻';
            });
        }

        settingsCloseBtn.addEventListener('click', () => {
            settingsModal.style.display = 'none';
        });

        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                settingsModal.style.display = 'none';
            }
        });

        const tabBtns = document.querySelectorAll('.btn[data-tab]');
        const panels = document.querySelectorAll('.settings-panel-view');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                tabBtns.forEach(b => {
                    b.classList.remove('active', 'btn-solid');
                    b.style.background = 'var(--bg-hover)';
                    b.style.color = 'var(--text-secondary)';
                });

                btn.classList.add('active', 'btn-solid');
                btn.style.background = '';
                btn.style.color = '';

                panels.forEach(p => p.style.display = 'none');

                const targetTab = btn.getAttribute('data-tab');
                const targetPanel = document.getElementById(`settings-view-${targetTab}`);
                if (targetPanel) {
                    targetPanel.style.display = (targetTab === 'connections') ? 'flex' : 'block';
                }
                if (targetTab === 'misc' && typeof window.drawCurvePreview === 'function') {
                    window.drawCurvePreview(window._lastCurveType, window._lastCurveIsBipolar);
                }
            });
        });
    }

    function setActiveTheme(theme) {
        if (theme === 'default') {
            delete document.body.dataset.theme;
        } else {
            document.body.dataset.theme = theme;
        }
        localStorage.setItem('abd-eep-theme', theme);
        const themeSelect = document.getElementById('settings-theme-select');
        if (themeSelect) themeSelect.value = theme;
    }

    function initThemeSelector() {
        const themeSelect = document.getElementById('settings-theme-select');
        if (!themeSelect) return;
        const savedTheme = localStorage.getItem('abd-eep-theme') || 'default';
        setActiveTheme(savedTheme);
        themeSelect.value = savedTheme;
        themeSelect.addEventListener('change', () => {
            setActiveTheme(themeSelect.value);
        });
    }
    initThemeSelector();

    function initFadeSpeed() {
        const fadeSel = document.getElementById('settings-fade-speed');
        if (!fadeSel) return;
        const saved = localStorage.getItem('abd-eep-fade-speed') || 'normal';
        fadeSel.value = saved;
        fadeSel.addEventListener('change', () => {
            localStorage.setItem('abd-eep-fade-speed', fadeSel.value);
        });
    }
    initFadeSpeed();

    function initLcdTimeoutSetting() {
        const sel = document.getElementById('settings-lcd-timeout');
        if (!sel) return;
        const saved = localStorage.getItem('abd-eep-lcd-timeout') || '2000';
        sel.value = saved;
        sel.addEventListener('change', () => {
            localStorage.setItem('abd-eep-lcd-timeout', sel.value);
        });
    }
    initLcdTimeoutSetting();

    function initLcdVelocitySetting() {
        const velSel = document.getElementById('settings-lcd-velocity');
        if (!velSel) return;
        const saved = localStorage.getItem('abd-eep-lcd-velocity') || 'show';
        velSel.value = saved;
        velSel.addEventListener('change', () => {
            localStorage.setItem('abd-eep-lcd-velocity', velSel.value);
        });
    }
    initLcdVelocitySetting();

    function initPbSensitivitySetting() {
        const pbSlider = document.getElementById('settings-pb-sensitivity');
        const pbVal = document.getElementById('settings-pb-sensitivity-val');
        if (!pbSlider) return;
        const saved = localStorage.getItem('abd-eep-pb-sensitivity') || '6';
        pbSlider.value = saved;
        if (pbVal) pbVal.textContent = saved + 'px';
        pbSlider.addEventListener('input', () => {
            const val = pbSlider.value;
            localStorage.setItem('abd-eep-pb-sensitivity', val);
            if (pbVal) pbVal.textContent = val + 'px';
        });
    }
    initPbSensitivitySetting();

    function initMidiChannelSetting() {
        const sel = document.getElementById('settings-midi-channel');
        if (!sel || !window.dualMidiBridge) return;
        sel.value = String(window.dualMidiBridge.midiChannel);
        sel.addEventListener('change', function() {
            var ch = parseInt(this.value);
            if (window.dualMidiBridge) {
                window.dualMidiBridge.midiChannel = ch;
                localStorage.setItem('abd-eep-midi-channel', String(ch));
                if (window.dualMidiBridge._hardwareInfo && window.dualMidiBridge._hardwareInfo.globalDumpBytes) {
                    var cached = window.dualMidiBridge._hardwareInfo.globalDumpBytes;
                    var devId = parseInt(window.dualMidiBridge._hardwareInfo.deviceId) || 0;
                    var payload = new Uint8Array(cached);
                    payload[0] = ((devId & 0x0F) << 4) | ((ch - 1) & 0x0F);
                    window.dualMidiBridge.sendGlobalDump(Array.from(payload));
                }
            }
        });
        var saved = localStorage.getItem('abd-eep-midi-channel');
        if (saved) {
            sel.value = saved;
            if (window.dualMidiBridge) window.dualMidiBridge.midiChannel = parseInt(saved);
        }
    }
    if (window.dualMidiBridge) {
        initMidiChannelSetting();
    } else {
        var _chTimer = setInterval(function() {
            if (window.dualMidiBridge) {
                clearInterval(_chTimer);
                initMidiChannelSetting();
            }
        }, 100);
    }

    function initVelocityCurveSetting() {
        const sel = document.getElementById('settings-velocity-curve');
        if (!sel) return;
        const saved = localStorage.getItem('abd-eep-velocity-curve') || 'normal';
        sel.value = saved;
        sel.addEventListener('change', function() {
            localStorage.setItem('abd-eep-velocity-curve', this.value);
            drawVelocityCurvePreview();
            if (window.dualMidiBridge) {
                var curveMap = { 'normal': 0, 'soft': 1, 'hard': 2, 'linear': 3, 'fixed': 4 };
                var idx = curveMap[this.value];
                if (idx !== undefined) {
                    window.dualMidiBridge.setGlobalParameter('velocity_curve', idx / 4.0);
                }
            }
        });
    }
    initVelocityCurveSetting();

    function drawVelocityCurvePreview() {
        const canvas = document.getElementById('velocity-curve-preview');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        const padL = 4, padR = 4, padT = 3, padB = 5;
        const graphW = w - padL - padR;
        const graphH = h - padT - padB;

        ctx.clearRect(0, 0, w, h);

        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        const midX = padL + graphW / 2;
        const midY = padT + graphH / 2;
        ctx.beginPath(); ctx.moveTo(padL, midY); ctx.lineTo(padL + graphW, midY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(midX, padT); ctx.lineTo(midX, padT + graphH); ctx.stroke();

        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        ctx.setLineDash([1, 3]);
        ctx.beginPath();
        ctx.moveTo(padL, padT + graphH);
        ctx.lineTo(padL + graphW, padT);
        ctx.stroke();
        ctx.setLineDash([]);

        const sel = document.getElementById('settings-velocity-curve');
        const curveType = sel ? sel.value : 'normal';

        const brandColor = getComputedStyle(document.documentElement).getPropertyValue('--brand-accent').trim() || '#ff9900';
        ctx.strokeStyle = brandColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();

        for (let px = 0; px <= graphW; px++) {
            const t = px / graphW;
            let y;
            switch (curveType) {
                case 'soft':   y = t * t; break;
                case 'hard':   y = Math.sqrt(t); break;
                case 'fixed':  y = 100 / 127; break;
                case 'linear':
                default:       y = t; break;
            }
            const canvasX = padL + px;
            const canvasY = padT + graphH - y * graphH;
            if (px === 0) ctx.moveTo(canvasX, canvasY);
            else ctx.lineTo(canvasX, canvasY);
        }
        ctx.stroke();

        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.font = '5px Share Tech Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('0', padL, h);
        ctx.fillText('127', padL + graphW, h);

        const labels = { 'normal': 'Lin', 'soft': 'x²', 'hard': '√x', 'linear': 'Lin', 'fixed': 'Fix' };
        ctx.fillStyle = brandColor;
        ctx.font = 'bold 6px Share Tech Mono, monospace';
        ctx.textAlign = 'right';
        ctx.fillText(labels[curveType] || curveType, padL + graphW, padT + 6);
        ctx.textAlign = 'start';
    }
    drawVelocityCurvePreview();

    function initPedalPolaritySetting() {
        const sel = document.getElementById('settings-pedal-polarity');
        if (!sel) return;
        const saved = localStorage.getItem('abd-eep-pedal-polarity') || 'norm-open';
        sel.value = saved;
        sel.addEventListener('change', function() {
            localStorage.setItem('abd-eep-pedal-polarity', this.value);
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setGlobalParameter('pedal_polarity', this.value === 'norm-closed' ? 1.0 : 0.0);
            }
        });
    }
    initPedalPolaritySetting();

    function initMasterTuneSetting() {
        const sel = document.getElementById('settings-master-tune');
        if (!sel) return;
        var saved = localStorage.getItem('abd-eep-master-tune');
        if (saved) sel.value = saved;
        sel.addEventListener('change', function() {
            localStorage.setItem('abd-eep-master-tune', this.value);
            if (window.dualMidiBridge) {
                var idx = parseInt(this.value.match(/[+-]?\d+/));
                window.dualMidiBridge.setGlobalParameter('global_tune', (idx + 128) / 255.0);
            }
        });
    }
    initMasterTuneSetting();

    function initMidiClockSetting() {
        const sel = document.getElementById('settings-midi-clock');
        if (!sel) return;
        const saved = localStorage.getItem('abd-eep-midi-clock') || 'internal';
        sel.value = saved;
        sel.addEventListener('change', function() {
            localStorage.setItem('abd-eep-midi-clock', this.value);
            if (window.dualMidiBridge && window.dualMidiBridge._updateArpTempo) {
                window.dualMidiBridge._updateArpTempo();
            }
        });
    }
    initMidiClockSetting();

    function initLcdContrastSetting() {
        const slider = document.getElementById('settings-lcd-contrast');
        const valEl = document.getElementById('settings-lcd-contrast-val');
        if (!slider) return;
        const saved = localStorage.getItem('abd-eep-lcd-contrast') || '70';
        slider.value = saved;
        if (valEl) valEl.textContent = saved + '%';
        function updateContrast(v) {
            const lcdEl = document.querySelector('.lcd-screen, #lcd-screen, .lcd');
            if (lcdEl) lcdEl.style.opacity = (v / 100).toFixed(2);
            document.documentElement.style.setProperty('--lcd-opacity', (v / 100).toFixed(2));
        }
        window.updateLcdContrast = updateContrast;
        updateContrast(parseInt(saved));
        slider.addEventListener('input', function() {
            const val = this.value;
            localStorage.setItem('abd-eep-lcd-contrast', val);
            if (valEl) valEl.textContent = val + '%';
            updateContrast(parseInt(val));
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setGlobalParameter('lcd_contrast', parseInt(val) / 100.0);
            }
        });
    }
    initLcdContrastSetting();

    function initBarStyleSetting() {
        const sel = document.getElementById('settings-bar-style');
        if (!sel) return;
        const saved = localStorage.getItem('abd-eep-bar-style') || 'solid';
        sel.value = saved;
        sel.addEventListener('change', () => {
            localStorage.setItem('abd-eep-bar-style', sel.value);
        });
    }
    initBarStyleSetting();

    function initPitchBendModeSetting() {
        const sel = document.getElementById('settings-pitch-bend-mode');
        if (!sel) return;
        const saved = localStorage.getItem('abd-eep-pitch-bend-mode') || 'all';
        sel.value = saved;
        sel.addEventListener('change', function() {
            localStorage.setItem('abd-eep-pitch-bend-mode', this.value);
        });
    }
    initPitchBendModeSetting();

    function initPedalSettings() {
        const pedalType = document.getElementById('settings-pedal-type');
        const sustain = document.getElementById('settings-pedal-sustain');
        const sustainMode = document.getElementById('settings-pedal-sustain-mode');
        if (pedalType) {
            const saved = localStorage.getItem('abd-eep-pedal-type') || 'foot-ctrl';
            pedalType.value = saved;
            pedalType.addEventListener('change', function() { localStorage.setItem('abd-eep-pedal-type', this.value); });
        }
        if (sustain) {
            const saved = localStorage.getItem('abd-eep-pedal-sustain') || 'norm-open';
            sustain.value = saved;
            sustain.addEventListener('change', function() { localStorage.setItem('abd-eep-pedal-sustain', this.value); });
        }
        if (sustainMode) {
            const saved = localStorage.getItem('abd-eep-pedal-sustain-mode') || 'sustain';
            sustainMode.value = saved;
            sustainMode.addEventListener('change', function() { localStorage.setItem('abd-eep-pedal-sustain-mode', this.value); });
        }
    }
    initPedalSettings();

    function initPolyChainSettings() {
        const chain = document.getElementById('settings-poly-chain');
        const keyRange = document.getElementById('settings-poly-key-range');
        const lowerNote = document.getElementById('settings-poly-range-lower-note');
        const lowerOct = document.getElementById('settings-poly-range-lower-oct');
        const upperNote = document.getElementById('settings-poly-range-upper-note');
        const upperOct = document.getElementById('settings-poly-range-upper-oct');
        if (chain) {
            chain.checked = localStorage.getItem('abd-eep-poly-chain') === 'on';
            chain.addEventListener('change', function() { localStorage.setItem('abd-eep-poly-chain', this.checked ? 'on' : 'off'); });
        }
        if (keyRange) {
            keyRange.checked = localStorage.getItem('abd-eep-poly-key-range') === 'on';
            keyRange.addEventListener('change', function() { localStorage.setItem('abd-eep-poly-key-range', this.checked ? 'on' : 'off'); });
        }
        if (lowerNote) {
            lowerNote.value = localStorage.getItem('abd-eep-poly-range-lower-note') || 'C';
            lowerNote.addEventListener('change', function() { localStorage.setItem('abd-eep-poly-range-lower-note', this.value); });
        }
        if (lowerOct) {
            lowerOct.value = localStorage.getItem('abd-eep-poly-range-lower-oct') || '-2';
            lowerOct.addEventListener('change', function() { localStorage.setItem('abd-eep-poly-range-lower-oct', this.value); });
        }
        if (upperNote) {
            upperNote.value = localStorage.getItem('abd-eep-poly-range-upper-note') || 'G';
            upperNote.addEventListener('change', function() { localStorage.setItem('abd-eep-poly-range-upper-note', this.value); });
        }
        if (upperOct) {
            upperOct.value = localStorage.getItem('abd-eep-poly-range-upper-oct') || '8';
            upperOct.addEventListener('change', function() { localStorage.setItem('abd-eep-poly-range-upper-oct', this.value); });
        }
    }
    initPolyChainSettings();

    function initRoutingSettings() {
        function wireSelect(id, storageKey, defaultValue) {
            const el = document.getElementById(id);
            if (!el) return;
            const saved = localStorage.getItem(storageKey) || defaultValue;
            el.value = saved;
            el.addEventListener('change', function() { localStorage.setItem(storageKey, this.value); });
        }
        function wireCheckbox(id, storageKey, defaultChecked) {
            const el = document.getElementById(id);
            if (!el) return;
            el.checked = localStorage.getItem(storageKey) === 'on' || (!localStorage.getItem(storageKey) && defaultChecked);
            el.addEventListener('change', function() { localStorage.setItem(storageKey, this.checked ? 'on' : 'off'); });
        }

        wireSelect('settings-midi-ctrl', 'abd-eep-midi-ctrl', 'Off');
        wireSelect('settings-midi-prog-change', 'abd-eep-midi-prog-change', 'RX');
        wireSelect('settings-midi-tx-ch', 'abd-eep-midi-tx-ch', 'RxCh');
        wireSelect('settings-midi-rx-ch', 'abd-eep-midi-rx-ch', 'All');
        wireCheckbox('settings-midi-soft-thru', 'abd-eep-midi-soft-thru', true);
        wireCheckbox('settings-midi-usb-thru', 'abd-eep-midi-usb-thru', false);
        wireCheckbox('settings-midi-wifi-thru', 'abd-eep-wifi-thru', false);

        wireSelect('settings-usb-ctrl', 'abd-eep-usb-ctrl', 'Off');
        wireSelect('settings-usb-prog-change', 'abd-eep-usb-prog-change', 'RX');
        wireSelect('settings-usb-tx-ch', 'abd-eep-usb-tx-ch', 'RxCh');
        wireSelect('settings-usb-rx-ch', 'abd-eep-usb-rx-ch', 'All');
        wireCheckbox('settings-usb-midi-thru', 'abd-eep-usb-midi-thru', true);
        wireCheckbox('settings-usb-wifi-thru', 'abd-eep-usb-wifi-thru', false);

        wireSelect('settings-wifi-ctrl', 'abd-eep-wifi-ctrl', 'Off');
        wireSelect('settings-wifi-prog-change', 'abd-eep-wifi-prog-change', 'RX');
        wireSelect('settings-wifi-tx-ch', 'abd-eep-wifi-tx-ch', 'All');
        wireSelect('settings-wifi-rx-ch', 'abd-eep-wifi-rx-ch', 'RxCh');
        wireCheckbox('settings-wifi-midi-thru', 'abd-eep-wifi-midi-thru', false);
        wireCheckbox('settings-wifi-usb-thru', 'abd-eep-wifi-usb-thru', false);

        wireSelect('settings-device-id', 'abd-eep-device-id', '1');
    }
    initRoutingSettings();

    function initTransposeSetting() {
        const sel = document.getElementById('settings-transpose');
        if (!sel) return;
        var saved = localStorage.getItem('abd-eep-transpose');
        if (saved) sel.value = saved;
        sel.addEventListener('change', function() {
            localStorage.setItem('abd-eep-transpose', this.value);
            if (window.dualMidiBridge) {
                var semitones = parseInt(this.value);
                window.dualMidiBridge.setGlobalParameter('transpose', (semitones + 48) / 96.0);
            }
        });
    }
    initTransposeSetting();

    function initControllerCurves() {
        const atCurveSel = document.getElementById('settings-curve-aftertouch');
        const mwCurveSel = document.getElementById('settings-curve-modwheel');
        const pbCurveSel = document.getElementById('settings-curve-pitchbend');
        if (atCurveSel) {
            const savedAt = window.getControllerCurve('aftertouch');
            atCurveSel.value = savedAt;
            atCurveSel.addEventListener('change', () => {
                window.setControllerCurve('aftertouch', atCurveSel.value);
                window.drawCurvePreview(atCurveSel.value);
            });
        }
        if (mwCurveSel) {
            const savedMw = window.getControllerCurve('modwheel');
            mwCurveSel.value = savedMw;
            mwCurveSel.addEventListener('change', () => {
                window.setControllerCurve('modwheel', mwCurveSel.value);
                window.drawCurvePreview(mwCurveSel.value);
            });
        }
        if (pbCurveSel) {
            const savedPb = window.getControllerCurve('pitchbend');
            pbCurveSel.value = savedPb;
            pbCurveSel.addEventListener('change', () => {
                window.setControllerCurve('pitchbend', pbCurveSel.value);
                window.drawCurvePreview(pbCurveSel.value, true);
            });
        }

        if (atCurveSel && typeof window.drawCurvePreview === 'function') {
            window.drawCurvePreview(atCurveSel.value);
        }
        if (typeof window._setupCustomCurveCanvas === 'function') {
            window._setupCustomCurveCanvas();
        }
    }
    initControllerCurves();

    function initNavbarThemeSelector() {
        const themeMap = {
            'menu-theme-default': 'default',
            'menu-theme-red': 'red',
            'menu-theme-blue': 'blue',
            'menu-theme-green': 'green',
            'menu-theme-midnight': 'midnight',
            'menu-theme-dark-v2': 'dark-v2'
        };

        Object.keys(themeMap).forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('click', (e) => {
                e.preventDefault();
                setActiveTheme(themeMap[id]);
            });
        });
    }
    initNavbarThemeSelector();

    if (typeof window.initKeyboardShortcutsSettings === 'function') {
        window.initKeyboardShortcutsSettings();
    }

    const globalBtn = document.getElementById('programmer-global-btn');
    if (globalBtn && settingsModal) {
        globalBtn.addEventListener('click', () => {
            settingsModal.style.display = 'flex';
            populateMidiPortsLists();
            _updateSettingsHardwareInfo();
            _ensureGlobalDumpButton();
            _wireGlobalDumpButton();
            _requestGlobalDumpAndUpdate();
        });
    }

    // COMPARE MODE
    const compareBtn = document.getElementById('programmer-compare-btn');
    let compareActive = false;
    let preCompareSnapshot = null;
    let preComparePatchName = '';
    
    function _computeCompareDiff(snapshotStr) {
        if (!snapshotStr || !window.dualMidiBridge) return 0;
        try {
            var snap = JSON.parse(snapshotStr);
            var cache = window.dualMidiBridge.parameterCache;
            var count = 0;
            for (var paramId in snap) {
                if (snap.hasOwnProperty(paramId)) {
                    var cached = cache[paramId];
                    var snapped = snap[paramId];
                    if (typeof snapped === 'object' || typeof cached === 'object') continue;
                    if (cached === undefined || Math.abs(cached - snapped) > 0.001) {
                        count++;
                    }
                }
            }
            return count;
        } catch (e) {
            return 0;
        }
    }
    
    function _exitCompareMode() {
        if (!compareActive) return;
        var lcdText = document.getElementById('lcd-text');
        
        if (preCompareSnapshot && window.dualMidiBridge) {
            try {
                var cache = JSON.parse(preCompareSnapshot);
                var paramIds = Object.keys(cache);
                paramIds.forEach(function(paramId) {
                    var val = cache[paramId];
                    window.dualMidiBridge.parameterCache[paramId] = val;
                    window.dualMidiBridge.onParameterChangedCallbacks.forEach(function(cb) {
                        try { cb(paramId, val); } catch(e) {}
                    });
                });
                
                if (typeof window.updateLfoSlidersFromCurrentPreset === 'function') window.updateLfoSlidersFromCurrentPreset();
                if (typeof window.updateEnvSlidersFromCurrentPreset === 'function') window.updateEnvSlidersFromCurrentPreset();
                if (typeof window.updateOscSlidersFromCurrentPreset === 'function') window.updateOscSlidersFromCurrentPreset();
                
                if (lcdText && preComparePatchName) {
                    var html = '<span style="font-size:10px; opacity:0.6;">COMPARE — RESTORED</span><br>'
                        + '<strong style="color:var(--accent-green);">' + preComparePatchName.toUpperCase() + '</strong><br>'
                        + '<span style="font-size:9px; color:var(--text-dim);">EDITED BUFFER RESTORED</span>';
                    window.lcdSafeUpdate(lcdText, html);
                }
            } catch (e) {
                console.warn('[Compare] Error restoring snapshot:', e);
            }
        }
        
        compareActive = false;
        preCompareSnapshot = null;
        if (compareBtn) {
            compareBtn.style.background = 'color-mix(in srgb, var(--accent-primary) 20%, transparent)';
            compareBtn.style.borderColor = 'var(--brand-accent)';
            compareBtn.style.color = 'var(--brand-accent)';
            compareBtn.textContent = 'Compare';
        }
    }
    
    if (compareBtn) {
        compareBtn.addEventListener('click', function() {
            var lcdText = document.getElementById('lcd-text');
            if (!lcdText) return;

            if (!compareActive) {
                var bridge = window.dualMidiBridge;
                if (!bridge) return;
                
                var activeBank = window.loadedBanks[window.currentActiveBank];
                var activePatch = activeBank && activeBank[window.currentActivePatchIndex];
                preComparePatchName = activePatch ? activePatch.name : 'UNKNOWN PATCH';
                preCompareSnapshot = JSON.stringify(bridge.parameterCache);
                
                var initialDiff = _computeCompareDiff(preCompareSnapshot);
                if (activePatch && activePatch.unpackedBytes && window.triggerMidiDump) {
                    window.triggerMidiDump(activePatch);
                }
                
                compareActive = true;
                compareBtn.style.background = 'var(--brand-accent)';
                compareBtn.style.borderColor = 'var(--brand-accent)';
                compareBtn.style.color = '#000';
                compareBtn.textContent = 'Compare (' + initialDiff + ')';
                
                lcdText.innerHTML = '<span style="font-size:10px; opacity:0.6;">COMPARE MODE</span><br>'
                    + '<strong>' + preComparePatchName.toUpperCase() + '</strong><br>'
                    + '<span style="font-size:9px; color:var(--text-dim);">ORIGINAL PRESET</span>';
            } else {
                _exitCompareMode();
            }
        });
    }
    
    window._exitCompareMode = _exitCompareMode;
    window._updateCompareDiff = function() {
        if (compareActive) {
            var diff = _computeCompareDiff(preCompareSnapshot);
            if (compareBtn) {
                compareBtn.textContent = 'Compare (' + diff + ')';
                compareBtn.title = diff + ' parameters differ from original';
            }
        }
    };
    
    if (window.dualMidiBridge && typeof window.dualMidiBridge.onParameterChanged === 'function') {
        window.dualMidiBridge.onParameterChanged(function(paramId, val) {
            if (window._updateCompareDiff && typeof window._updateCompareDiff === 'function') {
                window._updateCompareDiff();
            }
        });
    }

    const writeBtn = document.getElementById('programmer-write-btn');
    if (writeBtn) {
        writeBtn.addEventListener('click', () => {
            const saveBtn = document.getElementById('menu-save');
            if (saveBtn) {
                saveBtn.click();
            } else {
                alert("Selecciona primero un preset de usuario en el Bank Manager para sobrescribir.");
            }
        });
    }

    const bankUpBtn = document.getElementById('programmer-bank-up-btn');
    if (bankUpBtn) {
        bankUpBtn.addEventListener('click', () => {
            if (window.currentActivePatchIndex === -1) return;
            const nextIdx = (window.currentActivePatchIndex + 1) % 128;
            window.currentActivePatchIndex = nextIdx;
            
            const activeBank = window.loadedBanks[window.currentActiveBank];
            if (activeBank && activeBank[nextIdx]) {
                const patch = activeBank[nextIdx];
                if (window.triggerMidiDump) window.triggerMidiDump(patch);
                if (typeof window.renderPatchesForBank === 'function') window.renderPatchesForBank(window.currentActiveBank);
            }
        });
    }

    const bankDownBtn = document.getElementById('programmer-bank-down-btn');
    if (bankDownBtn) {
        bankDownBtn.addEventListener('click', () => {
            if (window.currentActivePatchIndex === -1) return;
            const prevIdx = (window.currentActivePatchIndex - 1 + 128) % 128;
            window.currentActivePatchIndex = prevIdx;

            const activeBank = window.loadedBanks[window.currentActiveBank];
            if (activeBank && activeBank[prevIdx]) {
                const patch = activeBank[prevIdx];
                if (window.triggerMidiDump) window.triggerMidiDump(patch);
                if (typeof window.renderPatchesForBank === 'function') window.renderPatchesForBank(window.currentActiveBank);
            }
        });
    }
}

window.initSettingsAndModals = initSettingsAndModals;
