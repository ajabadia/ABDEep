/**
 * @purpose Inicializa y gestiona los componentes interactivos fundamentales de la interfaz (sliders, pulsadores de botones/LEDs y enrutamiento LCD).
 * @purpose_en Initializes and manages fundamental interactive UI elements including faders, button/LED states, and programmer LCD hooks.
 */

document.addEventListener('DOMContentLoaded', () => {
    initUIControls();

    if (typeof window.initKeyboardAndWheels === 'function') window.initKeyboardAndWheels();
    if (typeof window.initKnobs === 'function') window.initKnobs();
    if (typeof window.initSettingsAndModals === 'function') window.initSettingsAndModals();
    if (typeof window.initEditActions === 'function') window.initEditActions();

    // Configurar botón de Debug: Unison
    const debugMenuBtn = document.getElementById('menu-debug-unison');
    if (debugMenuBtn) {
        debugMenuBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const debugModal = document.querySelector('debug-modal');
            if (debugModal && typeof debugModal.show === 'function') {
                debugModal.show();
            }
        });
    }

    // ── MIDI LEARN ──
    function initMidiLearn () {
        var bridge = window.dualMidiBridge;
        if (!bridge) return;

        if (typeof bridge._loadMidiLearnMappings === 'function') {
            bridge._loadMidiLearnMappings();
        }

        var learnBtn = document.getElementById('programmer-midi-learn-btn');
        var menuItem = document.getElementById('menu-midi-learn');

        function toggleLearn () {
            if (!bridge) return;
            bridge.toggleMidiLearn();
        }

        function updateButtonStyle (active, targetParam) {
            if (!learnBtn) return;
            if (active) {
                learnBtn.style.background = 'color-mix(in srgb, var(--accent-blue) 35%, transparent)';
                learnBtn.style.borderColor = 'var(--accent-blue)';
                learnBtn.style.boxShadow = '0 0 12px var(--accent-blue)';
                learnBtn.style.color = 'var(--accent-blue)';
                learnBtn.textContent = 'LEARN ON';
            } else {
                learnBtn.style.background = 'transparent';
                learnBtn.style.borderColor = 'var(--accent-blue)';
                learnBtn.style.boxShadow = 'none';
                learnBtn.style.color = 'var(--accent-blue)';
                learnBtn.textContent = 'MIDI LEARN';
            }
        }

        if (learnBtn) learnBtn.addEventListener('click', toggleLearn);
        if (menuItem) {
            menuItem.addEventListener('click', function (e) {
                e.preventDefault();
                toggleLearn();
            });
        }

        if (typeof bridge.onMidiLearnChange === 'function') {
            bridge.onMidiLearnChange(function (active, targetParam) {
                updateButtonStyle(active, targetParam);
            });
        }

        updateButtonStyle(false, null);
    }

    // ── MIDI LEARN: param-click-to-learn ──
    function initMidiLearnParamClick () {
        document.addEventListener('click', function (e) {
            var bridge = window.dualMidiBridge;
            if (!bridge || !bridge.midiLearnActive) return;

            var ctrlUnit = e.target.closest('[data-param]');
            if (!ctrlUnit) return;

            var paramId = ctrlUnit.getAttribute('data-param');
            if (!paramId) return;

            e.preventDefault();
            bridge.setMidiLearnTarget(paramId);
        }, true);
    }

    // ── PANIC (All Notes Off / All Sound Off) ──
    var panicBtn = document.getElementById('programmer-panic-btn');
    if (panicBtn) {
        panicBtn.addEventListener('click', function() {
            var _pBtn_ = this;
            _pBtn_.style.transition = 'background 60ms ease-out, box-shadow 60ms ease-out';
            _pBtn_.style.background = 'color-mix(in srgb, var(--color-danger) 80%, transparent)';
            _pBtn_.style.boxShadow = '0 0 24px var(--color-danger), inset 0 0 12px var(--color-danger)';
            _pBtn_.style.borderColor = 'var(--color-danger)';
            _pBtn_.style.color = 'var(--color-danger)';
            setTimeout(function() {
                _pBtn_.style.transition = 'background 300ms ease-out, box-shadow 300ms ease-out, border-color 300ms ease-out, color 300ms ease-out';
                _pBtn_.style.background = '';
                _pBtn_.style.boxShadow = '';
                _pBtn_.style.borderColor = '';
                _pBtn_.style.color = '';
                setTimeout(function() {
                    _pBtn_.style.transition = '';
                }, 320);
            }, 60);
            var bridge = window.dualMidiBridge;
            if (!bridge) {
                alert('Bridge not initialized.');
                return;
            }
            
            var msgCount = 0;
            
            if (bridge.isJuce) {
                for (var n = 0; n < 128; n++) {
                    bridge.pianoNoteOff(n);
                    msgCount++;
                }
            } else if (bridge.midiOutput) {
                bridge._signalMidiActivity();
                for (var ch = 0; ch < 16; ch++) {
                    var status = 0xB0 | ch;
                    bridge.midiOutput.send([status, 123, 0]); // All Notes Off
                    bridge.midiOutput.send([status, 120, 0]); // All Sound Off
                    msgCount += 2;
                }
            }
            
            console.log('[Panic] Sent ' + msgCount + ' MIDI messages to stop all sounding notes');
            
            var seqResetMsg = '';
            if (bridge._seqEngine) {
                var seqWasRunning = bridge._seqEngine.running;
                bridge._seqEngine.stop();
                bridge._seqEngine.stepIndex = 0;
                for (var si = 0; si < bridge._seqEngine.previousValues.length; si++) {
                    bridge._seqEngine.previousValues[si] = 0;
                }
                bridge._seqEngine.heldNotes = [];
                if (seqWasRunning || (bridge.parameterCache['seq_enable'] || 0) > 0.5) {
                    bridge._updateSeqEngine();
                    var _seqNotesHeld_ = bridge._seqEngine.heldNotes.length;
                    var _seqStepIdx_ = bridge._seqEngine.stepIndex;
                    var _seqLen_ = Math.round((bridge.parameterCache['seq_length'] || 0) * 31) + 2;
                    window._seqLastResetTime = Date.now();
                    window._seqResetCount++;
                    var _seqBar_ = window._genPosBar(Math.round((_seqStepIdx_ / Math.max(_seqLen_ - 1, 1)) * 18), 18);
                    seqResetMsg = '<br>' + window._genLcdBarHtml('seq', {
                        decorated: true,
                        header: '\u2500\u2500\u2500 SEQ RESET #' + window._seqResetCount + ' \u2500\u2500\u2500',
                        stepInfo: 'Step ' + _seqStepIdx_ + ' \u00B7 ' + _seqNotesHeld_ + ' notes \u00B7 ' + _seqLen_ + ' steps',
                        bar: _seqBar_
                    });
                }
            }
            
            var arpResetMsg = '';
            if (bridge._arpEngine) {
                var arpWasRunning = bridge._arpEngine.running;
                bridge._arpEngine.stop();
                bridge._arpEngine.stepIndex = 0;
                bridge._arpEngine.heldNotes = [];
                bridge._arpEngine.currentDirection = 1;
                bridge._arpActiveNotes = [];
                if (arpWasRunning || (bridge.parameterCache['arp_enable'] || 0) > 0.5) {
                    var _arpNotesHeld_ = bridge._arpEngine.heldNotes.length;
                    var _arpStepIdx_ = bridge._arpEngine.stepIndex;
                    window._arpLastResetTime = Date.now();
                    window._arpResetCount++;
                    var _arpBar_ = window._genFillBar(Math.round((_arpNotesHeld_ / 12) * 18), 18);
                    arpResetMsg = '<br>' + window._genLcdBarHtml('arp', {
                        decorated: true,
                        header: '\u2500\u2500\u2500 ARP RESET #' + window._arpResetCount + ' \u2500\u2500\u2500',
                        stepInfo: 'Step ' + _arpStepIdx_ + ' \u00B7 ' + _arpNotesHeld_ + ' notes held',
                        bar: _arpBar_
                    });
                }
            }
            
            var lcdText = document.getElementById('lcd-text');
            if (lcdText) {
                var panicHtml = '<span style="font-size:10px; opacity:0.6;">\u26A0\uFE0F PANIC</span><br><strong style="color:var(--color-danger);">ALL NOTES OFF</strong><br><span style="font-size:11px; color:var(--text-dim);">' + msgCount + ' MIDI messages sent</span>' + seqResetMsg + arpResetMsg;
                window.lcdSafeUpdate(lcdText, panicHtml)
            }
        });
    }

    // ── REQUEST FROM HW ──
    var requestHwBtn = document.getElementById('programmer-request-hw-btn');
    if (requestHwBtn) {
        requestHwBtn.addEventListener('click', function() {
            var bridge = window.dualMidiBridge;
            if (!bridge) {
                alert('Bridge not initialized.');
                return;
            }
            var lcdText = document.getElementById('lcd-text');
            if (lcdText) {
                var html = '<span style="font-size:10px; opacity:0.6;">REQUESTING...</span><br><strong>EDIT BUFFER</strong>';
                window.lcdSafeUpdate(lcdText, html)
            }
            bridge.requestMidiDump("edit", 4000).then(function(response) {
                if (response) {
                    console.log('[RequestHW] Edit buffer received:', response.length, 'bytes');
                    if (lcdText) {
                        var okHtml = '<span style="color:var(--accent-green);font-weight:bold">✅ DUMP RECEIVED</span>';
                        window.lcdSafeUpdate(lcdText, okHtml)
                    }
                } else {
                    console.warn('[RequestHW] No response from hardware');
                    if (lcdText) {
                        var failHtml = '<span style="color:var(--color-danger);font-weight:bold">❌ NO RESPONSE</span>';
                        window.lcdSafeUpdate(lcdText, failHtml)
                    }
                }
            });
        });
    }

    initMidiLearn();
    initMidiLearnParamClick();

    if (typeof window.initDumpView === 'function') {
        window.initDumpView();
    }
    if (typeof window.initMidiLearnEditor === 'function') {
        window.initMidiLearnEditor();
    }

    // ── KEYBOARD SHORTCUTS HELP ──
    function showKeyboardShortcuts() {
        const modal = document.querySelector('keyboard-shortcuts-modal');
        if (modal && typeof modal.show === 'function') {
            modal.show();
        }
    }

    var kbShortcutsMenuItem = document.getElementById('menu-keyboard-shortcuts');
    if (kbShortcutsMenuItem) {
        kbShortcutsMenuItem.addEventListener('click', function(e) {
            e.preventDefault();
            showKeyboardShortcuts();
        });
    }

    var kbShortcutsIcon = document.getElementById('keyboard-shortcuts-icon');
    if (kbShortcutsIcon) {
        kbShortcutsIcon.addEventListener('click', function(e) {
            e.preventDefault();
            showKeyboardShortcuts();
        });
        kbShortcutsIcon.addEventListener('mouseenter', function() {
            this.style.background = 'var(--bg-surface)';
            this.style.borderColor = 'var(--brand-accent)';
            this.style.color = 'var(--brand-accent)';
        });
        kbShortcutsIcon.addEventListener('mouseleave', function() {
            this.style.background = 'var(--bg-hover)';
            this.style.borderColor = 'var(--border-dim)';
            this.style.color = 'var(--text-faint)';
        });
    }

    const dumpMidiBtn = document.getElementById('menu-dump-midi');
    if (dumpMidiBtn) {
        dumpMidiBtn.addEventListener('click', () => {
            if (window.dualMidiBridge) {
                window.dualMidiBridge.requestMidiDump("edit");
                const lcdText = document.getElementById('lcd-text');
                if (lcdText) {
                    const html = `<span style="font-size:10px; opacity:0.6;">REQUESTING...</span><br><strong>MIDI DUMP</strong><br><span style="font-size:11px; color:var(--color-gold);">EDIT BUFFER REQ</span>`;
                    window.lcdSafeUpdate(lcdText, html)
                }
            }
        });
    }

    // Blink tempo loop for panels
    const arpBtnEl = document.getElementById('programmer-arp-btn');
    const seqBtnEl = document.getElementById('programmer-seq-btn');
    const chordBtnEl = document.getElementById('programmer-chord-btn');
    const polychordBtnEl = document.getElementById('programmer-polychord-btn');

    function setButtonInactive(el, mixColor, accentColor) {
        if (!el) return;
        el.style.background = `color-mix(in srgb, var(${mixColor}) 20%, transparent)`;
        el.style.borderColor = `var(${accentColor})`;
        el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.4)';
        el.style.color = `var(${accentColor})`;
    }

    function runBlinkLoop(timestamp) {
        let isArpOn = false;
        let isSeqOn = false;
        let isChordMemOn = false;
        let isPolyChordOn = false;

        if (window.dualMidiBridge && window.dualMidiBridge.parameterCache) {
            isArpOn = window.dualMidiBridge.parameterCache["arp_enable"] > 0.5;
            isSeqOn = window.dualMidiBridge.parameterCache["seq_enable"] > 0.5;
            isChordMemOn = window.dualMidiBridge.parameterCache["chord_enable"] > 0.5;
            isPolyChordOn = window.dualMidiBridge.parameterCache["poly_chord_enable"] > 0.5;
        }

        if (!isArpOn && !isSeqOn && !isChordMemOn && !isPolyChordOn) {
            setButtonInactive(arpBtnEl, '--accent-primary', '--brand-accent');
            setButtonInactive(seqBtnEl, '--accent-pink', '--accent-pink');
            setButtonInactive(chordBtnEl, '--accent-green', '--accent-green');
            setButtonInactive(polychordBtnEl, '--accent-green', '--accent-green');
            requestAnimationFrame(runBlinkLoop);
            return;
        }

        let bpm = 120;
        if (window.dualMidiBridge && window.dualMidiBridge.parameterCache) {
            const arpRateVal = window.dualMidiBridge.parameterCache["arp_rate"];
            if (typeof arpRateVal !== 'undefined') {
                bpm = 20 + arpRateVal * 220;
            }
        }
        
        const periodMs = 60000 / bpm;
        const blinkStateSlow = Math.floor(timestamp / (periodMs / 2)) % 2 === 0;

        if (arpBtnEl) {
            if (isArpOn) {
                if (blinkStateSlow) {
                    arpBtnEl.style.background = 'color-mix(in srgb, var(--accent-primary) 40%, transparent)';
                    arpBtnEl.style.borderColor = 'var(--accent-primary)';
                    arpBtnEl.style.boxShadow = '0 0 12px var(--accent-primary)';
                    arpBtnEl.style.color = 'var(--accent-primary)';
                } else {
                    arpBtnEl.style.background = 'color-mix(in srgb, var(--accent-primary) 10%, transparent)';
                    arpBtnEl.style.borderColor = 'color-mix(in srgb, var(--accent-primary) 40%, transparent)';
                    arpBtnEl.style.boxShadow = 'none';
                    arpBtnEl.style.color = 'color-mix(in srgb, var(--accent-primary) 70%, transparent)';
                }
            } else {
                setButtonInactive(arpBtnEl, '--accent-primary', '--brand-accent');
            }
        }

        if (seqBtnEl) {
            if (isSeqOn) {
                if (window._lastSeqStep === undefined) window._lastSeqStep = -1;
                var currentSeqStep = window.dualMidiBridge && window.dualMidiBridge.parameterCache
                    ? window.dualMidiBridge.parameterCache['seq_current_step']
                    : undefined;
                var seqStepChanged = currentSeqStep !== undefined && currentSeqStep !== window._lastSeqStep;
                if (seqStepChanged) {
                    window._lastSeqStep = currentSeqStep;
                    window._seqPulseTime = timestamp;
                }
                
                var seqPulseAge = timestamp - (window._seqPulseTime || 0);
                var seqStepPulseMs = 200;
                var isEngRunning = window.dualMidiBridge && window.dualMidiBridge._seqEngine
                    ? window.dualMidiBridge._seqEngine.running
                    : false;
                
                if (seqPulseAge < seqStepPulseMs && isEngRunning) {
                    var pulseFade = seqPulseAge / seqStepPulseMs;
                    var brightness = 60 - pulseFade * 35;
                    var glowSize = 14 - pulseFade * 10;
                    seqBtnEl.style.background = 'color-mix(in srgb, var(--accent-pink) ' + brightness.toFixed(0) + '%, transparent)';
                    seqBtnEl.style.borderColor = 'var(--accent-pink)';
                    seqBtnEl.style.boxShadow = '0 0 ' + glowSize.toFixed(1) + 'px var(--accent-pink)';
                    seqBtnEl.style.color = 'var(--accent-pink)';
                } else if (isEngRunning) {
                    seqBtnEl.style.background = 'color-mix(in srgb, var(--accent-pink) 15%, transparent)';
                    seqBtnEl.style.borderColor = 'color-mix(in srgb, var(--accent-pink) 50%, transparent)';
                    seqBtnEl.style.boxShadow = 'none';
                    seqBtnEl.style.color = 'color-mix(in srgb, var(--accent-pink) 60%, transparent)';
                } else {
                    seqBtnEl.style.background = 'color-mix(in srgb, var(--accent-pink) 12%, transparent)';
                    seqBtnEl.style.borderColor = 'color-mix(in srgb, var(--accent-pink) 30%, transparent)';
                    seqBtnEl.style.boxShadow = 'none';
                    seqBtnEl.style.color = 'color-mix(in srgb, var(--accent-pink) 40%, transparent)';
                }
            } else {
                setButtonInactive(seqBtnEl, '--accent-pink', '--accent-pink');
            }
        }

        if (chordBtnEl) {
            if (isChordMemOn) {
                if (blinkStateSlow) {
                    chordBtnEl.style.background = 'color-mix(in srgb, var(--accent-green) 40%, transparent)';
                    chordBtnEl.style.borderColor = 'var(--accent-green)';
                    chordBtnEl.style.boxShadow = '0 0 12px var(--accent-green)';
                    chordBtnEl.style.color = 'var(--accent-green)';
                } else {
                    chordBtnEl.style.background = 'color-mix(in srgb, var(--accent-green) 10%, transparent)';
                    chordBtnEl.style.borderColor = 'color-mix(in srgb, var(--accent-green) 40%, transparent)';
                    chordBtnEl.style.boxShadow = 'none';
                    chordBtnEl.style.color = 'color-mix(in srgb, var(--accent-green) 70%, transparent)';
                }
            } else {
                setButtonInactive(chordBtnEl, '--accent-green', '--accent-green');
            }
        }

        if (polychordBtnEl) {
            if (isPolyChordOn) {
                if (blinkStateSlow) {
                    polychordBtnEl.style.background = 'color-mix(in srgb, var(--accent-blue) 40%, transparent)';
                    polychordBtnEl.style.borderColor = 'var(--accent-blue)';
                    polychordBtnEl.style.boxShadow = '0 0 12px var(--accent-blue)';
                    polychordBtnEl.style.color = 'var(--accent-blue)';
                } else {
                    polychordBtnEl.style.background = 'color-mix(in srgb, var(--accent-blue) 10%, transparent)';
                    polychordBtnEl.style.borderColor = 'color-mix(in srgb, var(--accent-blue) 40%, transparent)';
                    polychordBtnEl.style.boxShadow = 'none';
                    polychordBtnEl.style.color = 'color-mix(in srgb, var(--accent-blue) 70%, transparent)';
                }
            } else {
                setButtonInactive(polychordBtnEl, '--accent-blue', '--accent-blue');
            }
        }

        requestAnimationFrame(runBlinkLoop);
    }
    requestAnimationFrame(runBlinkLoop);
});

// 1. INICIALIZACIÓN DE SLIDERS, KNOBS Y LEDS
function initUIControls() {
    let _lcdLastParam = null;

    function _getLcdTimeoutMs() {
        var saved = localStorage.getItem('abd-eep-lcd-timeout');
        if (saved === null) return 2000;
        if (saved === 'off') return null;
        var ms = parseInt(saved, 10);
        return isNaN(ms) ? 2000 : ms;
    }

    function _setLcdParamDisplayTimer(lcdEl) {
        lcdEl._ctrlLcdRestore = null;
    }

    window.setLcdParamDisplayTimer = _setLcdParamDisplayTimer;

    // Sliders interactivos de faders verticales
    document.querySelectorAll('.v-slider').forEach(slider => {
        const handle = slider.querySelector('.handle');
        let isDragging = false;
        
        const updateVal = (clientY) => {
            const rect = slider.getBoundingClientRect();
            let pct = 1.0 - (clientY - rect.top) / rect.height;
            pct = Math.max(0, Math.min(1, pct));
            
            const handleHeight = 16;
            const pos = (1.0 - pct) * (rect.height - handleHeight);
            handle.style.top = pos + 'px';
            
            const paramId = slider.closest('[data-param]').getAttribute('data-param');

            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter(paramId, pct);
                
                const midiMappings = {
                    "lfo1_rate": "NRPN 0:00 (CC 16)",
                    "lfo1_delay": "NRPN 0:01 (CC 17)",
                    "lfo1_shape": "NRPN 0:02",
                    "lfo1_key_sync": "NRPN 0:03",
                    "lfo1_arp_sync": "NRPN 0:04",
                    "lfo1_mono_mode": "NRPN 0:05",
                    "lfo1_slew": "NRPN 0:06",
                    "lfo2_rate": "NRPN 0:07 (CC 18)",
                    "lfo2_delay": "NRPN 0:08 (CC 19)",
                    "lfo2_shape": "NRPN 0:09",
                    "lfo2_key_sync": "NRPN 0:10",
                    "lfo2_arp_sync": "NRPN 0:11",
                    "lfo2_mono_mode": "NRPN 0:12",
                    "lfo2_slew": "NRPN 0:13",
                    "osc1_range": "NRPN 0:14",
                    "osc1_square_enable": "NRPN 0:18",
                    "osc1_saw_enable": "NRPN 0:19",
                    "osc_sync_enable": "NRPN 0:20",
                    "osc1_pitch_mod": "NRPN 0:21 (CC 20)",
                    "osc1_pwm_amount": "NRPN 0:25 (CC 21)",
                    "osc2_range": "NRPN 0:15",
                    "osc2_level": "NRPN 0:26 (CC 26)",
                    "osc2_pitch": "NRPN 0:27 (CC 25)",
                    "osc2_tone_mod": "NRPN 0:28 (CC 24)",
                    "osc2_pitch_mod": "NRPN 0:29 (CC 23)",
                    "noise_level": "NRPN 0:33 (CC 27)",
                    "global_portamento": "NRPN 0:34 (CC 5)",
                    "porta_mode": "NRPN 0:35",
                    "pitch_bend_up": "NRPN 0:36",
                    "pitch_bend_down": "NRPN 0:37",
                    "vcf_cutoff": "NRPN 0:39 (CC 29)",
                    "hpf_cutoff": "NRPN 0:40 (CC 35)",
                    "vcf_resonance": "NRPN 0:41 (CC 30)",
                    "vcf_env_depth": "NRPN 0:42 (CC 31)",
                    "vcf_env_vel": "NRPN 0:43",
                    "vcf_pitch_bend": "NRPN 0:44",
                    "vcf_lfo_depth": "NRPN 0:45 (CC 33)",
                    "vcf_lfo_select": "NRPN 0:46",
                    "vcf_aftertouch_lfo": "NRPN 0:47",
                    "vcf_modwheel_lfo": "NRPN 0:48",
                    "vcf_key_tracking": "NRPN 0:49 (CC 34)",
                    "vcf_env_polarity": "NRPN 0:50",
                    "vcf_pole_mode": "NRPN 0:51",
                    "hpf_boost_enable": "NRPN 0:52",
                    "env1_attack": "NRPN 0:53 (CC 37)",
                    "env1_decay": "NRPN 0:54 (CC 39)",
                    "env1_sustain": "NRPN 0:55 (CC 40)",
                    "env1_release": "NRPN 0:56 (CC 41)",
                    "env1_trigger_mode": "NRPN 0:57",
                    "env1_attack_curve": "NRPN 0:58",
                    "env1_decay_curve": "NRPN 0:59",
                    "env1_sustain_curve": "NRPN 0:60",
                    "env1_release_curve": "NRPN 0:61",
                    "env2_attack": "NRPN 0:62 (CC 42)",
                    "env2_decay": "NRPN 0:63 (CC 43)",
                    "env2_sustain": "NRPN 0:64 (CC 44)",
                    "env2_release": "NRPN 0:65 (CC 45)",
                    "env2_trigger_mode": "NRPN 0:66",
                    "env2_attack_curve": "NRPN 0:67",
                    "env2_decay_curve": "NRPN 0:68",
                    "env2_sustain_curve": "NRPN 0:69",
                    "env2_release_curve": "NRPN 0:70",
                    "env3_attack": "NRPN 0:71 (CC 46)",
                    "env3_decay": "NRPN 0:72 (CC 47)",
                    "env3_sustain": "NRPN 0:73 (CC 48)",
                    "env3_release": "NRPN 0:74 (CC 49)",
                    "env3_trigger_mode": "NRPN 0:75",
                    "env3_attack_curve": "NRPN 0:76",
                    "env3_decay_curve": "NRPN 0:77",
                    "env3_sustain_curve": "NRPN 0:78",
                    "env3_release_curve": "NRPN 0:79",
                    "vca_level": "NRPN 0:80 (CC 36)",
                    "vca_env_depth": "NRPN 0:81",
                    "vca_vel_sens": "NRPN 0:82",
                    "vca_pan_spread": "NRPN 0:83",
                    "note_priority": "NRPN 0:84",
                    "voice_mode": "NRPN 0:85",
                    "trigger_mode": "NRPN 0:86",
                    "unison_detune": "NRPN 0:87 (CC 28)",
                    "voice_drift": "NRPN 0:88",
                    "param_drift": "NRPN 0:89",
                    "drift_rate": "NRPN 0:90",
                    "porta_osc_bal": "NRPN 0:91",
                    "osc_key_reset": "NRPN 0:92",
                    "arp_enable": "NRPN 1:27",
                    "arp_mode": "NRPN 1:28",
                    "arp_rate": "NRPN 1:29 (CC 12)",
                    "arp_clock_divider": "NRPN 1:30",
                    "arp_key_sync": "NRPN 1:31",
                    "arp_gate_time": "NRPN 1:32 (CC 13)",
                    "arp_gate": "NRPN 1:32 (CC 13)",
                    "arp_hold": "NRPN 1:33",
                    "arp_pattern": "NRPN 1:34",
                    "arp_swing": "NRPN 1:35",
                    "arp_octave": "NRPN 1:36",
                    "seq_enable": "NRPN 0:117",
                    "seq_clock": "NRPN 0:118",
                    "seq_length": "NRPN 0:119",
                    "seq_swing": "NRPN 0:120",
                    "seq_key_loop": "NRPN 0:121",
                    "seq_slew_rate": "NRPN 0:122",
                    "fx_routing": "NRPN 1:37",
                    "fx1_type": "NRPN 1:38",
                    "fx1_gain": "NRPN 1:90",
                    "fx2_type": "NRPN 1:51",
                    "fx2_gain": "NRPN 1:91",
                    "fx3_type": "NRPN 1:64",
                    "fx3_gain": "NRPN 1:92",
                    "fx4_type": "NRPN 1:77",
                    "fx4_gain": "NRPN 1:93",
                    "fx_mode": "NRPN 1:94"
                };
                
                const midiInfo = midiMappings[paramId] || "MIDI CONTROLLER";
                
                const lcdText = document.getElementById('lcd-text');
                if (lcdText) {
                    const displayVal = typeof window.formatParamValue === 'function' ? window.formatParamValue(paramId, pct) : pct.toFixed(2);
                    const html = `<span style="font-size:10px; opacity:0.6;">${midiInfo}</span><br><strong>${paramId.toUpperCase()}</strong><br><span style="font-size:15px; color:var(--color-gold);">${displayVal}</span>`;
                    if (typeof window.lcdFadeUpdate === 'function') {
                        window.lcdFadeUpdate(lcdText, html, paramId);
                    }
                }
            }
        };
        
        function onSliderMove(e) {
            if (isDragging) {
                updateVal(e.clientY);
            }
        }
        
        function onSliderEnd() {
            isDragging = false;
            window.removeEventListener('mousemove', onSliderMove);
            window.removeEventListener('mouseup', onSliderEnd);
        }
        
        slider.addEventListener('mousedown', (e) => {
            isDragging = true;
            updateVal(e.clientY);
            window.addEventListener('mousemove', onSliderMove);
            window.addEventListener('mouseup', onSliderEnd);
        });
    });

    // ACTIVE LFO SWITCHER
    let activeLfoNumber = 1;
    const lfoSelectBtn = document.getElementById('lfo-select-btn');
    if (lfoSelectBtn) {
        lfoSelectBtn.addEventListener('click', () => {
            activeLfoNumber = activeLfoNumber === 1 ? 2 : 1;
            lfoSelectBtn.innerText = `LFO ${activeLfoNumber} ACTIVE`;
            
            const rateUnit = document.getElementById('lfo-ctrl-rate');
            const delayUnit = document.getElementById('lfo-ctrl-delay');
            const rateLabel = document.getElementById('lfo-label-rate');
            
            if (activeLfoNumber === 1) {
                rateUnit.setAttribute('data-param', 'lfo1_rate');
                delayUnit.setAttribute('data-param', 'lfo1_delay');
                rateLabel.innerText = 'LFO1 Rate';
                lfoSelectBtn.style.color = 'var(--brand-accent)';
            } else {
                rateUnit.setAttribute('data-param', 'lfo2_rate');
                delayUnit.setAttribute('data-param', 'lfo2_delay');
                rateLabel.innerText = 'LFO2 Rate';
                lfoSelectBtn.style.color = 'var(--accent-teal)';
            }
            window.updateLfoSlidersFromCurrentPreset();
        });
    }

    // ACTIVE OSC SWITCHER
    let activeOscNumber = 1;
    const oscSelectBtn = document.getElementById('osc-select-btn');
    if (oscSelectBtn) {
        oscSelectBtn.addEventListener('click', () => {
            activeOscNumber = activeOscNumber === 1 ? 2 : 1;
            oscSelectBtn.innerText = `OSC ${activeOscNumber} ACTIVE`;

            const pitchModUnit = document.getElementById('osc-ctrl-pitchmod');
            const pwmToneUnit = document.getElementById('osc-ctrl-pwm-tone');
            const pitchUnit = document.getElementById('osc-ctrl-pitch');
            const levelUnit = document.getElementById('osc-ctrl-level');
            const pitchModLabel = document.getElementById('osc-label-pitchmod');
            const pwmToneLabel = document.getElementById('osc-label-pwm-tone');

            if (activeOscNumber === 1) {
                oscSelectBtn.style.color = 'var(--brand-accent)';
                pitchModUnit.setAttribute('data-param', 'osc1_pitch_mod');
                pwmToneUnit.setAttribute('data-param', 'osc1_pwm_amount');
                pitchModLabel.innerText = 'Pitch Mod';
                pwmToneLabel.innerText = 'PWM';
                pitchUnit.style.display = 'none';
                levelUnit.style.display = 'none';
            } else {
                oscSelectBtn.style.color = 'var(--accent-teal)';
                pitchModUnit.setAttribute('data-param', 'osc2_pitch_mod');
                pwmToneUnit.setAttribute('data-param', 'osc2_tone_mod');
                pitchModLabel.innerText = 'Pitch Mod';
                pwmToneLabel.innerText = 'Tone Mod';
                pitchUnit.style.display = 'flex';
                levelUnit.style.display = 'flex';
            }

            window.updateOscSlidersFromCurrentPreset();
            if (typeof window.syncDetailPanelControls === 'function') {
                window.syncDetailPanelControls();
            }
        });
    }

    // ACTIVE ENVELOPE SWITCHER
    let activeEnvNumber = 1;
    const envBtns = document.querySelectorAll('.env-type-btn');
    envBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            envBtns.forEach(b => {
                b.classList.remove('active');
                b.style.background = "var(--bg-hover)";
                b.style.borderColor = "var(--border-dim)";
                b.style.color = "var(--text-labels)";
            });

            btn.classList.add('active');
            activeEnvNumber = parseInt(btn.getAttribute('data-env'));

            const atkUnit = document.getElementById('env-ctrl-attack');
            const dcyUnit = document.getElementById('env-ctrl-decay');
            const susUnit = document.getElementById('env-ctrl-sustain');
            const relUnit = document.getElementById('env-ctrl-release');

            if (activeEnvNumber === 1) {
                btn.style.background = "color-mix(in srgb, var(--accent-primary) 15%, transparent)";
                btn.style.borderColor = "var(--brand-accent)";
                btn.style.color = "var(--brand-accent)";
                atkUnit.setAttribute('data-param', 'env1_attack');
                dcyUnit.setAttribute('data-param', 'env1_decay');
                susUnit.setAttribute('data-param', 'env1_sustain');
                relUnit.setAttribute('data-param', 'env1_release');
            } else if (activeEnvNumber === 2) {
                btn.style.background = "color-mix(in srgb, var(--accent-teal) 15%, transparent)";
                btn.style.borderColor = "var(--accent-teal)";
                btn.style.color = "var(--accent-teal)";
                atkUnit.setAttribute('data-param', 'env2_attack');
                dcyUnit.setAttribute('data-param', 'env2_decay');
                susUnit.setAttribute('data-param', 'env2_sustain');
                relUnit.setAttribute('data-param', 'env2_release');
            } else {
                btn.style.background = "color-mix(in srgb, var(--accent-pink) 15%, transparent)";
                btn.style.borderColor = "var(--accent-pink)";
                btn.style.color = "var(--accent-pink)";
                atkUnit.setAttribute('data-param', 'env3_attack');
                dcyUnit.setAttribute('data-param', 'env3_decay');
                susUnit.setAttribute('data-param', 'env3_sustain');
                relUnit.setAttribute('data-param', 'env3_release');
            }

            window.updateEnvSlidersFromCurrentPreset();
            if (typeof window.syncDetailPanelControls === 'function') {
                window.syncDetailPanelControls();
            }
        });
    });

    document.querySelectorAll('.led').forEach(led => {
        const paramId = led.closest('[data-param]').getAttribute('data-param');
        led.addEventListener('click', () => {
            const active = led.classList.toggle('active');
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter(paramId, active ? 1.0 : 0.0);
            }
        });
    });

    // MIDI PARAMETER CHANGES ROUTER
    if (window.dualMidiBridge) {
        window.dualMidiBridge.onParameterChanged((paramId, val) => {
            let sliderUnits = Array.from(document.querySelectorAll(`[data-param="${paramId}"] .v-slider`));
            
            const activeAtkParam = document.getElementById('env-ctrl-attack')?.getAttribute('data-param');
            const activeDcyParam = document.getElementById('env-ctrl-decay')?.getAttribute('data-param');
            const activeSusParam = document.getElementById('env-ctrl-sustain')?.getAttribute('data-param');
            const activeRelParam = document.getElementById('env-ctrl-release')?.getAttribute('data-param');
            
            if (paramId === activeAtkParam) {
                const el = document.querySelector('#env-ctrl-attack .v-slider');
                if (el && !sliderUnits.includes(el)) sliderUnits.push(el);
            }
            if (paramId === activeDcyParam) {
                const el = document.querySelector('#env-ctrl-decay .v-slider');
                if (el && !sliderUnits.includes(el)) sliderUnits.push(el);
            }
            if (paramId === activeSusParam) {
                const el = document.querySelector('#env-ctrl-sustain .v-slider');
                if (el && !sliderUnits.includes(el)) sliderUnits.push(el);
            }
            if (paramId === activeRelParam) {
                const el = document.querySelector('#env-ctrl-release .v-slider');
                if (el && !sliderUnits.includes(el)) sliderUnits.push(el);
            }

            const activePitchModParam = document.getElementById('osc-ctrl-pitchmod')?.getAttribute('data-param');
            const activePwmToneParam = document.getElementById('osc-ctrl-pwm-tone')?.getAttribute('data-param');
            
            if (paramId === activePitchModParam) {
                const el = document.querySelector('#osc-ctrl-pitchmod .v-slider');
                if (el && !sliderUnits.includes(el)) sliderUnits.push(el);
            }
            if (paramId === activePwmToneParam) {
                const el = document.querySelector('#osc-ctrl-pwm-tone .v-slider');
                if (el && !sliderUnits.includes(el)) sliderUnits.push(el);
            }

            sliderUnits.forEach(sliderUnit => {
                const handle = sliderUnit.querySelector('.handle');
                if (handle) {
                    const rect = sliderUnit.getBoundingClientRect();
                    const height = rect.height > 0 ? rect.height : (sliderUnit.clientHeight > 0 ? sliderUnit.clientHeight : 100);
                    const handleHeight = 16;
                    handle.style.top = (1.0 - val) * (height - handleHeight) + 'px';
                }
            });

            const ledUnits = document.querySelectorAll(`[data-param="${paramId}"] .led`);
            ledUnits.forEach(ledUnit => {
                ledUnit.classList.toggle('active', val > 0.5);
            });

            if (paramId === "hpf_boost_enable") {
                const boostBtn = document.getElementById('hpf-boost-btn');
                if (boostBtn) {
                    const active = val > 0.5;
                    boostBtn.innerText = active ? "BOOST ON" : "BOOST OFF";
                    boostBtn.style.color = active ? "var(--brand-accent)" : "var(--text-labels)";
                    boostBtn.style.borderColor = active ? "var(--brand-accent)" : "var(--border-dim)";
                    boostBtn.style.background = active ? "color-mix(in srgb, var(--accent-primary) 15%, transparent)" : "var(--bg-hover)";
                }
            }

            if (paramId === "vca_mode") {
                try {
                    localStorage.setItem('abd-eep-vca-mode', val > 0.5 ? 'ballsy' : 'transparent');
                } catch(e) {}
                const modeBtn = document.getElementById('vca-mode-btn');
                if (modeBtn) {
                    const active = val > 0.5;
                    modeBtn.innerText = active ? "BALLSY" : "TRANSPARENT";
                    modeBtn.style.color = active ? "var(--accent-teal)" : "var(--text-labels)";
                    modeBtn.style.borderColor = active ? "var(--accent-teal)" : "var(--border-dim)";
                    modeBtn.style.background = active ? "color-mix(in srgb, var(--accent-teal) 15%, transparent)" : "var(--bg-hover)";
                }
            }
            
            if (paramId === 'patch_name' && typeof val === 'string') {
                window._twText = val.toUpperCase();
                window._twBank = (window.currentActiveBank || '').toUpperCase();
            } else if (paramId !== 'seq_current_value' && paramId !== 'seq_current_step' && paramId !== 'seq_current_step_skip') {
                const midiMappings = {
                    "lfo1_rate": "NRPN 0:00 (CC 16)",
                    "lfo1_delay": "NRPN 0:01 (CC 17)",
                    "lfo1_shape": "NRPN 0:02",
                    "lfo1_key_sync": "NRPN 0:03",
                    "lfo1_arp_sync": "NRPN 0:04",
                    "lfo1_mono_mode": "NRPN 0:05",
                    "lfo1_slew": "NRPN 0:06",
                    "lfo2_rate": "NRPN 0:07 (CC 18)",
                    "lfo2_delay": "NRPN 0:08 (CC 19)",
                    "lfo2_shape": "NRPN 0:09",
                    "lfo2_key_sync": "NRPN 0:10",
                    "lfo2_arp_sync": "NRPN 0:11",
                    "lfo2_mono_mode": "NRPN 0:12",
                    "lfo2_slew": "NRPN 0:13",
                    "osc1_range": "NRPN 0:14",
                    "osc1_square_enable": "NRPN 0:18",
                    "osc1_saw_enable": "NRPN 0:19",
                    "osc_sync_enable": "NRPN 0:20",
                    "osc1_pitch_mod": "NRPN 0:21 (CC 20)",
                    "osc1_pwm_amount": "NRPN 0:25 (CC 21)",
                    "osc2_range": "NRPN 0:15",
                    "osc2_level": "NRPN 0:26 (CC 26)",
                    "osc2_pitch": "NRPN 0:27 (CC 25)",
                    "osc2_tone_mod": "NRPN 0:28 (CC 24)",
                    "osc2_pitch_mod": "NRPN 0:29 (CC 23)",
                    "noise_level": "NRPN 0:33 (CC 27)",
                    "global_portamento": "NRPN 0:34 (CC 5)",
                    "porta_mode": "NRPN 0:35",
                    "pitch_bend_up": "NRPN 0:36",
                    "pitch_bend_down": "NRPN 0:37",
                    "vcf_cutoff": "NRPN 0:39 (CC 29)",
                    "hpf_cutoff": "NRPN 0:40 (CC 35)",
                    "vcf_resonance": "NRPN 0:41 (CC 30)",
                    "vcf_env_depth": "NRPN 0:42 (CC 31)",
                    "vcf_env_vel": "NRPN 0:43",
                    "vcf_pitch_bend": "NRPN 0:44",
                    "vcf_lfo_depth": "NRPN 0:45 (CC 33)",
                    "vcf_lfo_select": "NRPN 0:46",
                    "vcf_aftertouch_lfo": "NRPN 0:47",
                    "vcf_modwheel_lfo": "NRPN 0:48",
                    "vcf_key_tracking": "NRPN 0:49 (CC 34)",
                    "vcf_env_polarity": "NRPN 0:50",
                    "vcf_pole_mode": "NRPN 0:51",
                    "hpf_boost_enable": "NRPN 0:52",
                    "env1_attack": "NRPN 0:53 (CC 37)",
                    "env1_decay": "NRPN 0:54 (CC 39)",
                    "env1_sustain": "NRPN 0:55 (CC 40)",
                    "env1_release": "NRPN 0:56 (CC 41)",
                    "env1_trigger_mode": "NRPN 0:57",
                    "env1_attack_curve": "NRPN 0:58",
                    "env1_decay_curve": "NRPN 0:59",
                    "env1_sustain_curve": "NRPN 0:60",
                    "env1_release_curve": "NRPN 0:61",
                    "env2_attack": "NRPN 0:62 (CC 42)",
                    "env2_decay": "NRPN 0:63 (CC 43)",
                    "env2_sustain": "NRPN 0:64 (CC 44)",
                    "env2_release": "NRPN 0:65 (CC 45)",
                    "env2_trigger_mode": "NRPN 0:66",
                    "env2_attack_curve": "NRPN 0:67",
                    "env2_decay_curve": "NRPN 0:68",
                    "env2_sustain_curve": "NRPN 0:69",
                    "env2_release_curve": "NRPN 0:70",
                    "env3_attack": "NRPN 0:71 (CC 46)",
                    "env3_decay": "NRPN 0:72 (CC 47)",
                    "env3_sustain": "NRPN 0:73 (CC 48)",
                    "env3_release": "NRPN 0:74 (CC 49)",
                    "env3_trigger_mode": "NRPN 0:75",
                    "env3_attack_curve": "NRPN 0:76",
                    "env3_decay_curve": "NRPN 0:77",
                    "env3_sustain_curve": "NRPN 0:78",
                    "env3_release_curve": "NRPN 0:79",
                    "vca_level": "NRPN 0:80 (CC 36)",
                    "vca_env_depth": "NRPN 0:81",
                    "vca_vel_sens": "NRPN 0:82",
                    "vca_pan_spread": "NRPN 0:83",
                    "note_priority": "NRPN 0:84",
                    "voice_mode": "NRPN 0:85",
                    "trigger_mode": "NRPN 0:86",
                    "unison_detune": "NRPN 0:87 (CC 28)",
                    "voice_drift": "NRPN 0:88",
                    "param_drift": "NRPN 0:89",
                    "drift_rate": "NRPN 0:90",
                    "porta_osc_bal": "NRPN 0:91",
                    "osc_key_reset": "NRPN 0:92",
                    "arp_enable": "NRPN 1:27",
                    "arp_mode": "NRPN 1:28",
                    "arp_rate": "NRPN 1:29 (CC 12)",
                    "arp_clock_divider": "NRPN 1:30",
                    "arp_key_sync": "NRPN 1:31",
                    "arp_gate_time": "NRPN 1:32 (CC 13)",
                    "arp_gate": "NRPN 1:32 (CC 13)",
                    "arp_hold": "NRPN 1:33",
                    "arp_pattern": "NRPN 1:34",
                    "arp_swing": "NRPN 1:35",
                    "arp_octave": "NRPN 1:36",
                    "seq_enable": "NRPN 0:117",
                    "seq_clock": "NRPN 0:118",
                    "seq_length": "NRPN 0:119",
                    "seq_swing": "NRPN 0:120",
                    "seq_key_loop": "NRPN 0:121",
                    "seq_slew_rate": "NRPN 0:122",
                    "fx_routing": "NRPN 1:37",
                    "fx1_type": "NRPN 1:38",
                    "fx1_gain": "NRPN 1:90",
                    "fx2_type": "NRPN 1:51",
                    "fx2_gain": "NRPN 1:91",
                    "fx3_type": "NRPN 1:64",
                    "fx3_gain": "NRPN 1:92",
                    "fx4_type": "NRPN 1:77",
                    "fx4_gain": "NRPN 1:93",
                    "fx_mode": "NRPN 1:94"
                };
                const midiInfo = midiMappings[paramId] || "MIDI CONTROLLER";

                const lcdText = document.getElementById('lcd-text');
                if (lcdText) {
                    let displayVal = typeof window.formatParamValue === 'function' ? window.formatParamValue(paramId, val) : val.toFixed(2);
                    const html = `<span style="font-size:10px; opacity:0.6;">${midiInfo}</span><br><strong>${paramId.toUpperCase()}</strong><br><span style="font-size:15px; color:var(--color-gold);">${displayVal}</span>`;
                    if (typeof window.lcdFadeUpdate === 'function') {
                        window.lcdFadeUpdate(lcdText, html, paramId);
                    }
                }
            }
            
            _updateHexByteForParam(paramId, val);
        });
    }

    function _updateHexByteForParam(paramId, normalizedVal) {
        if (!window.dualMidiBridge) return;
        var byteOffset = window.dualMidiBridge.paramToByteOffset[paramId];
        if (byteOffset === undefined) return;
        
        if (!window._liveUnpackedBytes) {
            if (window._lastUnpackedBytes) {
                window._liveUnpackedBytes = new Uint8Array(window._lastUnpackedBytes);
            } else {
                window._liveUnpackedBytes = new Uint8Array(242);
            }
        }
        
        var rawVal = window.dualMidiBridge._normalizedToRaw(byteOffset, normalizedVal);
        window._liveUnpackedBytes[byteOffset] = rawVal;
        
        if (window._lastUnpackedBytes && window._lastUnpackedBytes[byteOffset] !== undefined) {
            window._lastUnpackedBytes[byteOffset] = rawVal;
        }
        
        var byteEl = document.querySelector('.hex-byte[data-idx="' + byteOffset + '"]');
        if (byteEl) {
            var hex = rawVal.toString(16).toUpperCase().padStart(2, '0');
            byteEl.textContent = hex;
            byteEl.classList.add('changed');
            if (byteEl._changeTimer) {
                clearTimeout(byteEl._changeTimer);
            }
            byteEl._changeTimer = setTimeout(function() {
                byteEl.classList.remove('changed');
                byteEl._changeTimer = null;
            }, 1200);
        }
    }

    const hpfBoostBtn = document.getElementById('hpf-boost-btn');
    if (hpfBoostBtn) {
        hpfBoostBtn.addEventListener('click', () => {
            const cacheVal = window.dualMidiBridge ? window.dualMidiBridge.parameterCache["hpf_boost_enable"] : 0.0;
            const active = cacheVal > 0.5;
            const nextVal = active ? 0.0 : 1.0;
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter("hpf_boost_enable", nextVal);
                window.dualMidiBridge.handleParameterChangeFromBackend("hpf_boost_enable", nextVal);
            }
        });
    }

    const vcaModeBtn = document.getElementById('vca-mode-btn');
    if (vcaModeBtn) {
        vcaModeBtn.addEventListener('click', () => {
            const cacheVal = window.dualMidiBridge ? window.dualMidiBridge.parameterCache["vca_mode"] : 0.0;
            const active = cacheVal > 0.5;
            const nextVal = active ? 0.0 : 1.0;
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter("vca_mode", nextVal);
                window.dualMidiBridge.handleParameterChangeFromBackend("vca_mode", nextVal);
            }
        });
    }
}

function updateSliderPosition(sliderUnit, val) {
    if (!sliderUnit) return;
    const handle = sliderUnit.querySelector('.handle');
    if (!handle) return;
    const rect = sliderUnit.getBoundingClientRect();
    const height = rect.height > 0 ? rect.height : (sliderUnit.clientHeight > 0 ? sliderUnit.clientHeight : 100);
    const handleHeight = 16;
    const pos = (1.0 - val) * (height - handleHeight);
    handle.style.top = pos + 'px';
}

window.updateEnvSlidersFromCurrentPreset = function() {
    if (!window.dualMidiBridge) return;
    const cache = window.dualMidiBridge.parameterCache;
    const ids = ['env-ctrl-attack', 'env-ctrl-decay', 'env-ctrl-sustain', 'env-ctrl-release'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const paramId = el.getAttribute('data-param');
        if (!paramId) return;
        const val = cache[paramId] !== undefined ? cache[paramId] : 0.0;
        updateSliderPosition(el.querySelector('.v-slider'), val);
    });
};

window.updateLfoSlidersFromCurrentPreset = function() {
    if (!window.dualMidiBridge) return;
    const cache = window.dualMidiBridge.parameterCache;
    const ids = ['lfo-ctrl-rate', 'lfo-ctrl-delay'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const paramId = el.getAttribute('data-param');
        if (!paramId) return;
        const val = cache[paramId] !== undefined ? cache[paramId] : 0.0;
        updateSliderPosition(el.querySelector('.v-slider'), val);
    });
};

window.updateOscSlidersFromCurrentPreset = function() {
    if (!window.dualMidiBridge) return;
    const cache = window.dualMidiBridge.parameterCache;
    const ids = ['osc-ctrl-pitchmod', 'osc-ctrl-pwm-tone', 'osc-ctrl-pitch', 'osc-ctrl-level'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const paramId = el.getAttribute('data-param');
        if (!paramId) return;
        const val = cache[paramId] !== undefined ? cache[paramId] : 0.0;
        updateSliderPosition(el.querySelector('.v-slider'), val);
    });
};

window._seqResetCount = 0;
window._arpResetCount = 0;
window._arpLastResetTime = null;
window._seqLastResetTime = null;

window._formatElapsedTime = function(timestamp) {
    if (timestamp === null) return null;
    var elapsed = Math.floor((Date.now() - timestamp) / 1000);
    if (elapsed < 2) return 'Just now';
    if (elapsed < 60) return elapsed + 's ago';
    var mins = Math.floor(elapsed / 60);
    var secs = elapsed % 60;
    if (mins < 60) return mins + 'm ' + secs + 's ago';
    var hours = Math.floor(mins / 60);
    mins = mins % 60;
    return hours + 'h ' + mins + 'm ago';
};

window._updateResetTooltips = function() {
    var arpBtn = document.getElementById('modal-arp-reset-btn');
    var seqBtn = document.getElementById('modal-seq-reset-btn');
    var arpRel = window._formatElapsedTime(window._arpLastResetTime);
    var seqRel = window._formatElapsedTime(window._seqLastResetTime);
    if (arpBtn) {
        arpBtn.title = arpRel !== null
            ? 'Reset ARP engine — ' + arpRel + ' (#' + window._arpResetCount + ')'
            : 'Reset arpeggiator engine — stop, rewind to step 0, clear held notes';
    }
    if (seqBtn) {
        seqBtn.title = seqRel !== null
            ? 'Reset SEQ engine — ' + seqRel + ' (#' + window._seqResetCount + ')'
            : 'Reset sequencer engine — stop, rewind to step 0, clear held notes';
    }
};

setInterval(window._updateResetTooltips, 2000);
