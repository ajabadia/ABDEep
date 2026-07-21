/**
 * @purpose Módulo de control del panel de edición detallada deslizable izquierdo.
 * @purpose_en Controls the left-side detail editor slide panel, binds events, and draws visual graphs.
 */

// Shared panel state
window.panelEditState = {
    currentPanelMode: 'LFO',
    panelActiveLfo: 1,
    panelActiveEnv: 1, // 1 = VCA, 2 = VCF, 3 = MOD
    panelActiveOsc: 1, // 1 or 2
    isScreenCollapsed: false,
    isRealScopeCollapsed: true,
    _scopeTriggerMode: 0,    // 0=Free, 1=Auto, 2=Normal
    _scopeZoom: 1,           // 1x, 2x, 4x
    _scopeColorScheme: 0,    // 0=Brand, 1=CRT Green, 2=Blue, 3=Amber
    _scopeLastSamples: null,
    _scopeAutoTriggerTime: 0,
    _animTime: 0
};

document.addEventListener('DOMContentLoaded', () => {
    initDetailPanel();
});

function initDetailPanel() {
    const lfoEditBtn = document.getElementById('lfo-edit-btn');
    const vcaEditBtn = document.getElementById('vca-edit-btn');
    const envEditBtn = document.getElementById('env-edit-btn');
    const hpfEditBtn = document.getElementById('hpf-edit-btn');
    const vcfEditBtn = document.getElementById('vcf-edit-btn');
    const oscEditBtn = document.getElementById('osc-edit-btn');
    const polyEditBtn = document.getElementById('poly-edit-btn');
    const portaEditBtn = document.getElementById('porta-edit-btn');
    const chordEditBtn = document.getElementById('programmer-chord-btn');
    const polychordEditBtn = document.getElementById('programmer-polychord-btn');
    const panel = document.getElementById('detail-edit-panel');
    const closeBtn = document.getElementById('panel-close-btn');
    const container = document.getElementById('panel-dynamic-controls');
    const titleEl = document.getElementById('panel-title');
    const screenEl = document.getElementById('panel-graphic-screen');
    const screenToggleBtn = document.getElementById('panel-graphic-toggle');
    const realScopeScreenEl = document.getElementById('panel-real-scope-screen');
    const realScopeToggleBtn = document.getElementById('panel-real-scope-toggle');

    if (!panel || !closeBtn || !container) {return;}

    const noScreenModes = ['POLY', 'PORTA', 'CHORD', 'POLY_CHORD'];
    const noScopeModes = ['POLY', 'PORTA', 'CHORD', 'POLY_CHORD', 'ARP'];
    const state = window.panelEditState;

    window.updateScreenHeight = function() {
        if (!screenEl || !screenToggleBtn) {return;}
        if (noScreenModes.includes(state.currentPanelMode)) {
            screenEl.style.height = '0px';
            screenEl.style.borderBottomWidth = '0px';
            screenEl.style.display = 'none';
            screenToggleBtn.style.display = 'none';
        } else {
            screenEl.style.display = 'flex';
            screenToggleBtn.style.display = 'block';
            if (state.isScreenCollapsed) {
                screenEl.style.height = '0px';
                screenEl.style.borderBottomWidth = '0px';
                screenToggleBtn.innerHTML = '&#9660; EXPAND &#9660;';
            } else {
                screenEl.style.height = '100px';
                screenEl.style.borderBottomWidth = '1.5px';
                screenToggleBtn.innerHTML = '&#9650; COLLAPSE &#9650;';
            }
        }
    };

    window.updateRealScopeHeight = function() {
        if (!realScopeScreenEl || !realScopeToggleBtn) {return;}
        const isJuce = window.dualMidiBridge && window.dualMidiBridge.isJuce;
        const toolbar = document.getElementById('scope-toolbar');
        if (noScopeModes.includes(state.currentPanelMode)) {
            realScopeScreenEl.style.display = 'none';
            realScopeToggleBtn.style.display = 'none';
            _stopAudioWaveformPolling();
            return;
        }
        realScopeScreenEl.style.display = 'flex';
        realScopeToggleBtn.style.display = 'block';
        if (state.isRealScopeCollapsed) {
            realScopeScreenEl.style.height = '0px';
            realScopeScreenEl.style.borderBottomWidth = '0px';
            realScopeToggleBtn.innerHTML = isJuce ? '🔴 DSP SCOPE (off)' : '⚫ DSP SCOPE (no engine)';
            if (toolbar) {toolbar.style.display = 'none';}
        } else {
            realScopeScreenEl.style.height = '113px';
            realScopeScreenEl.style.borderBottomWidth = '1.5px';
            realScopeToggleBtn.innerHTML = '🟢 DSP SCOPE (live)';
            if (toolbar) {toolbar.style.display = 'flex';}
        }
    };

    if (screenToggleBtn && screenEl) {
        screenToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            state.isScreenCollapsed = !state.isScreenCollapsed;
            window.updateScreenHeight();
        });
    }

    if (realScopeToggleBtn && realScopeScreenEl) {
        realScopeToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            state.isRealScopeCollapsed = !state.isRealScopeCollapsed;
            window.updateRealScopeHeight();
            _updateAudioWaveformPolling();
            if (!state.isRealScopeCollapsed && typeof window._updateScopeToolbar === 'function') {
                window._updateScopeToolbar();
            }
        });
    }

    // Scope toolbar triggers
    document.addEventListener('click', function _onScopeTrigger(e) {
        const btn = e.target.closest('#scope-trigger-btn');
        if (!btn) {return;}
        state._scopeTriggerMode = (state._scopeTriggerMode + 1) % 3;
        state._scopeLastSamples = null;
        if (typeof window._updateScopeToolbar === 'function') {window._updateScopeToolbar();}
    });

    document.addEventListener('click', function _onScopeZoom(e) {
        const btn = e.target.closest('.scope-zoom-btn');
        if (!btn) {return;}
        const zoom = parseInt(btn.getAttribute('data-zoom'));
        if (zoom >= 1 && zoom <= 4) {
            state._scopeZoom = zoom;
            if (typeof window._updateScopeToolbar === 'function') {window._updateScopeToolbar();}
        }
    });

    document.addEventListener('click', function _onScopeColor(e) {
        const btn = e.target.closest('#scope-color-btn');
        if (!btn) {return;}
        state._scopeColorScheme = (state._scopeColorScheme + 1) % (window.SCOPE_COLORS ? window.SCOPE_COLORS.length : 4);
        if (typeof window._updateScopeToolbar === 'function') {window._updateScopeToolbar();}
    });

    // Opening modes listeners
    const setupOpenPanel = (btn, mode) => {
        if (!btn) {return;}
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            state.currentPanelMode = mode;
            if (typeof window.syncDetailPanelControls === 'function') {window.syncDetailPanelControls();}
            panel.classList.add('active');
        });
    };

    setupOpenPanel(lfoEditBtn, 'LFO');
    setupOpenPanel(vcaEditBtn, 'VCA');
    setupOpenPanel(envEditBtn, 'ENV');
    setupOpenPanel(hpfEditBtn, 'HPF');
    setupOpenPanel(vcfEditBtn, 'VCF');
    setupOpenPanel(oscEditBtn, 'OSC');
    setupOpenPanel(polyEditBtn, 'POLY');
    setupOpenPanel(portaEditBtn, 'PORTA');

    if (chordEditBtn) {
        chordEditBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (window.dualMidiBridge) {
                const active = window.dualMidiBridge.parameterCache['chord_enable'] > 0.5;
                const nextVal = active ? 0.0 : 1.0;
                window.dualMidiBridge.setParameter('chord_enable', nextVal);
                if (nextVal > 0.5) {
                    window.dualMidiBridge.setParameter('poly_chord_enable', 0.0);
                }
            }
            state.currentPanelMode = 'CHORD';
            if (typeof window.syncDetailPanelControls === 'function') {window.syncDetailPanelControls();}
            panel.classList.add('active');
        });
    }

    if (polychordEditBtn) {
        polychordEditBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (window.dualMidiBridge) {
                const active = window.dualMidiBridge.parameterCache['poly_chord_enable'] > 0.5;
                const nextVal = active ? 0.0 : 1.0;
                window.dualMidiBridge.setParameter('poly_chord_enable', nextVal);
                if (nextVal > 0.5) {
                    window.dualMidiBridge.setParameter('chord_enable', 0.0);
                }
            }
            state.currentPanelMode = 'POLY_CHORD';
            if (typeof window.syncDetailPanelControls === 'function') {window.syncDetailPanelControls();}
            panel.classList.add('active');
        });
    }

    window.openSeqPanel = function() {
        state.currentPanelMode = 'SEQ';
        if (typeof window.syncDetailPanelControls === 'function') {window.syncDetailPanelControls();}
        panel.classList.add('active');
    };

    closeBtn.addEventListener('click', () => {
        panel.classList.remove('active');
    });

    // Escuchar cambios de parámetros en tiempo real para refrescar faders del panel si se mueven
    if (window.dualMidiBridge) {
        window.dualMidiBridge.onParameterChanged((paramId, val) => {
            if (state.currentPanelMode === 'LFO') {
                const activePrefix = `lfo${state.panelActiveLfo}_`;
                if (paramId.startsWith(activePrefix)) {
                    if (paramId === `${activePrefix}key_sync` || paramId === `${activePrefix}arp_sync`) {
                        const box = document.getElementById(paramId === `${activePrefix}key_sync` ? 'lfo-key-sync-box' : 'lfo-arp-sync-box');
                        if (box) {box.classList.toggle('active', val > 0.5);}
                        if (paramId === `${activePrefix}arp_sync`) {
                            const rateLabel = container.querySelector(`[data-param="${activePrefix}rate"] .label`);
                            if (rateLabel) {rateLabel.innerText = val > 0.5 ? 'Clock Div' : 'Rate';}
                        }
                    } else if (paramId === `${activePrefix}shape`) {
                        const activeIndex = Math.round(val * 6.0);
                        container.querySelectorAll('.shape-led-row').forEach(row => {
                            const rowShape = parseInt(row.getAttribute('data-shape'));
                            row.classList.toggle('active', rowShape === activeIndex);
                        });
                    } else {
                        const sliderEl = container.querySelector(`[data-param="${paramId}"] .v-slider`);
                        if (sliderEl) {
                            const handle = sliderEl.querySelector('.handle');
                            const rect = sliderEl.getBoundingClientRect();
                            if (rect.height > 0) {
                                const handleHeight = 16;
                                handle.style.top = (1.0 - val) * (rect.height - handleHeight) + 'px';
                            }
                        }
                    }
                }
            } else if (state.currentPanelMode === 'VCA') {
                if (paramId === 'vca_mode') {
                    const btnTransparent = document.getElementById('panel-vca-mode-transparent');
                    const btnBallsy = document.getElementById('panel-vca-mode-ballsy');
                    if (btnTransparent && btnBallsy) {
                        btnTransparent.classList.toggle('active', val < 0.5);
                        btnBallsy.classList.toggle('active', val > 0.5);
                    }
                } else if (paramId.startsWith('vca_')) {
                    const sliderEl = container.querySelector(`[data-param="${paramId}"] .v-slider`);
                    if (sliderEl) {
                        const handle = sliderEl.querySelector('.handle');
                        const rect = sliderEl.getBoundingClientRect();
                        if (rect.height > 0) {
                            const handleHeight = 16;
                            handle.style.top = (1.0 - val) * (rect.height - handleHeight) + 'px';
                        }
                    }
                }
            } else if (state.currentPanelMode === 'ENV') {
                const activePrefix = `env${state.panelActiveEnv}_`;
                if (paramId.startsWith(activePrefix)) {
                    if (paramId === `${activePrefix}trigger_mode`) {
                        const activeIndex = Math.round(val * 4.0);
                        container.querySelectorAll('.shape-led-row').forEach(row => {
                            const rowTrig = parseInt(row.getAttribute('data-trig'));
                            row.classList.toggle('active', rowTrig === activeIndex);
                        });
                    } else {
                        const sliderEl = container.querySelector(`[data-param="${paramId}"] .v-slider`);
                        if (sliderEl) {
                            const handle = sliderEl.querySelector('.handle');
                            const rect = sliderEl.getBoundingClientRect();
                            if (rect.height > 0) {
                                const handleHeight = 16;
                                handle.style.top = (1.0 - val) * (rect.height - handleHeight) + 'px';
                            }
                        }
                    }
                }
            } else if (state.currentPanelMode === 'HPF') {
                if (paramId === 'hpf_boost_enable') {
                    const btnBoostOff = document.getElementById('panel-hpf-boost-off');
                    const btnBoostOn = document.getElementById('panel-hpf-boost-on');
                    if (btnBoostOff && btnBoostOn) {
                        btnBoostOff.classList.toggle('active', val < 0.5);
                        btnBoostOn.classList.toggle('active', val > 0.5);
                    }
                } else if (paramId === 'hpf_cutoff') {
                    const sliderEl = container.querySelector(`[data-param="${paramId}"] .v-slider`);
                    if (sliderEl) {
                        const handle = sliderEl.querySelector('.handle');
                        const rect = sliderEl.getBoundingClientRect();
                        if (rect.height > 0) {
                            const handleHeight = 16;
                            handle.style.top = (1.0 - val) * (rect.height - handleHeight) + 'px';
                        }
                    }
                }
            } else if (state.currentPanelMode === 'VCF') {
                if (paramId === 'vcf_pole_mode') {
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
                    const sliderEl = container.querySelector(`[data-param="${paramId}"] .v-slider`);
                    if (sliderEl) {
                        const handle = sliderEl.querySelector('.handle');
                        const rect = sliderEl.getBoundingClientRect();
                        if (rect.height > 0) {
                            const handleHeight = 16;
                            handle.style.top = (1.0 - val) * (rect.height - handleHeight) + 'px';
                        }
                    }
                }
            } else if (state.currentPanelMode === 'OSC') {
                if (state.panelActiveOsc === 1) {
                    if (paramId === 'osc1_saw_enable' || paramId === 'osc1_square_enable') {
                        const box = document.getElementById(paramId === 'osc1_saw_enable' ? 'panel-osc1-saw-box' : 'panel-osc1-square-box');
                        if (box) {box.classList.toggle('active', val > 0.5);}
                    } else if (paramId === 'osc_key_reset') {
                        const box = document.getElementById('panel-osc-key-reset-box');
                        if (box) {box.classList.toggle('active', val > 0.5);}
                    } else if (paramId === 'osc1_pm_source') {
                        const sel = document.getElementById('panel-osc1-pmod-src-select');
                        if (sel) {sel.value = Math.round(val * 6.0);}
                    } else if (paramId === 'osc1_pwm_source') {
                        const sel = document.getElementById('panel-osc1-pwm-src-select');
                        if (sel) {sel.value = Math.round(val * 5.0);}
                    } else if (paramId === 'osc1_range') {
                        const activeIndex = Math.round(val * 2.0);
                        container.querySelectorAll('.osc1-range-led-row').forEach(row => {
                            const rowVal = parseInt(row.getAttribute('data-val'));
                            row.classList.toggle('active', rowVal === activeIndex);
                        });
                    } else if (paramId === 'osc1_pm_mode') {
                        const activeIndex = Math.round(val * 1.0);
                        container.querySelectorAll('.osc1-pmode-led-row').forEach(row => {
                            const rowVal = parseInt(row.getAttribute('data-val'));
                            row.classList.toggle('active', rowVal === activeIndex);
                        });
                    } else {
                        const sliderEl = container.querySelector(`[data-param="${paramId}"] .v-slider`);
                        if (sliderEl) {
                            const handle = sliderEl.querySelector('.handle');
                            const rect = sliderEl.getBoundingClientRect();
                            if (rect.height > 0) {
                                const handleHeight = 16;
                                handle.style.top = (1.0 - val) * (rect.height - handleHeight) + 'px';
                            }
                        }
                    }
                } else {
                    if (paramId === 'osc_sync_enable') {
                        const box = document.getElementById('panel-osc-sync-box');
                        if (box) {box.classList.toggle('active', val > 0.5);}
                    } else if (paramId === 'osc2_pm_source') {
                        const sel = document.getElementById('panel-osc2-pmod-src-select');
                        if (sel) {sel.value = Math.round(val * 6.0);}
                    } else if (paramId === 'osc2_tpm_source') {
                        const sel = document.getElementById('panel-osc2-tpm-src-select');
                        if (sel) {sel.value = Math.round(val * 5.0);}
                    } else if (paramId === 'osc2_range') {
                        const activeIndex = Math.round(val * 2.0);
                        container.querySelectorAll('.osc2-range-led-row').forEach(row => {
                            const rowVal = parseInt(row.getAttribute('data-val'));
                            row.classList.toggle('active', rowVal === activeIndex);
                        });
                    } else {
                        const sliderEl = container.querySelector(`[data-param="${paramId}"] .v-slider`);
                        if (sliderEl) {
                            const handle = sliderEl.querySelector('.handle');
                            const rect = sliderEl.getBoundingClientRect();
                            if (rect.height > 0) {
                                const handleHeight = 16;
                                handle.style.top = (1.0 - val) * (rect.height - handleHeight) + 'px';
                            }
                        }
                    }
                }
            } else if (state.currentPanelMode === 'POLY') {
                if (paramId === 'voice_mode') {
                    const sel = document.getElementById('panel-poly-mode-select');
                    if (sel) {sel.value = Math.round(val * 12.0);}
                } else if (paramId === 'note_priority') {
                    const activeIndex = Math.round(val * 2.0);
                    container.querySelectorAll('.priority-led-row').forEach(row => {
                        const rowVal = parseInt(row.getAttribute('data-val'));
                        row.classList.toggle('active', rowVal === activeIndex);
                    });
                } else if (paramId === 'trigger_mode') {
                    const activeIndex = Math.round(val * 3.0);
                    container.querySelectorAll('.trigger-led-row').forEach(row => {
                        const rowVal = parseInt(row.getAttribute('data-val'));
                        row.classList.toggle('active', rowVal === activeIndex);
                    });
                } else if (['unison_detune', 'voice_drift', 'param_drift', 'drift_rate'].includes(paramId)) {
                    const sliderEl = container.querySelector(`[data-param="${paramId}"] .v-slider`);
                    if (sliderEl) {
                        const handle = sliderEl.querySelector('.handle');
                        const rect = sliderEl.getBoundingClientRect();
                        if (rect.height > 0) {
                            const handleHeight = 16;
                            handle.style.top = (1.0 - val) * (rect.height - handleHeight) + 'px';
                        }
                    }
                }
            } else if (state.currentPanelMode === 'PORTA') {
                if (paramId === 'porta_mode') {
                    const idx = Math.round(val * 9.0);
                    container.querySelectorAll('.porta-mode-led-row').forEach(r => r.classList.remove('active'));
                    const match = container.querySelector(`.porta-mode-led-row[data-val="${idx}"]`);
                    if (match) {match.classList.add('active');}
                } else if (paramId === 'note_priority') {
                    const idx = Math.round(val * 2.0);
                    container.querySelectorAll('.note-priority-led-row').forEach(r => r.classList.remove('active'));
                    const match = container.querySelector(`.note-priority-led-row[data-val="${idx}"]`);
                    if (match) {match.classList.add('active');}
                } else if (paramId === 'trigger_mode') {
                    const idx = Math.round(val * 3.0);
                    container.querySelectorAll('.trigger-mode-led-row').forEach(r => r.classList.remove('active'));
                    const match = container.querySelector(`.trigger-mode-led-row[data-val="${idx}"]`);
                    if (match) {match.classList.add('active');}
                } else {
                    const sliderEl = container.querySelector(`[data-param="${paramId}"] .v-slider`);
                    if (sliderEl) {
                        const handle = sliderEl.querySelector('.handle');
                        const rect = sliderEl.getBoundingClientRect();
                        if (rect.height > 0) {
                            const handleHeight = 16;
                            handle.style.top = (1.0 - val) * (rect.height - handleHeight) + 'px';
                        }
                    }
                }
            } else if (state.currentPanelMode === 'CHORD') {
                if (paramId === 'chord_enable') {
                    const box = document.getElementById('panel-chord-enable-box');
                    if (box) {box.classList.toggle('active', val > 0.5);}
                }
                if (paramId === 'chord_key') {
                    const idx = Math.round(val * 11.0);
                    container.querySelectorAll('.chord-key-led-row').forEach(r => r.classList.remove('active'));
                    const match = container.querySelector(`.chord-key-led-row[data-val="${idx}"]`);
                    if (match) {match.classList.add('active');}
                }
                if (paramId === 'chord_type') {
                    const idx = Math.round(val * 11.0);
                    container.querySelectorAll('.chord-type-led-row').forEach(r => r.classList.remove('active'));
                    const match = container.querySelector(`.chord-type-led-row[data-val="${idx}"]`);
                    if (match) {match.classList.add('active');}
                }
            } else if (state.currentPanelMode === 'POLY_CHORD') {
                if (paramId === 'poly_chord_enable') {
                    const box = document.getElementById('panel-poly-chord-enable-box');
                    if (box) {box.classList.toggle('active', val > 0.5);}
                }
                if (paramId === 'chord_key') {
                    const idx = Math.round(val * 11.0);
                    container.querySelectorAll('.chord-key-led-row').forEach(r => r.classList.remove('active'));
                    const match = container.querySelector(`.chord-key-led-row[data-val="${idx}"]`);
                    if (match) {match.classList.add('active');}
                }
                if (paramId === 'chord_type') {
                    const idx = Math.round(val * 11.0);
                    container.querySelectorAll('.chord-type-led-row').forEach(r => r.classList.remove('active'));
                    const match = container.querySelector(`.chord-type-led-row[data-val="${idx}"]`);
                    if (match) {match.classList.add('active');}
                }
            } else if (state.currentPanelMode === 'SEQ') {
                if (paramId === 'seq_enable') {
                    const box = document.getElementById('panel-seq-enable-box');
                    if (box) {box.classList.toggle('active', val > 0.5);}
                } else if (paramId === 'seq_clock') {
                    var sel = document.getElementById('panel-seq-clock-select');
                    if (sel) {sel.value = Math.round(val * 15.0);}
                } else if (paramId === 'seq_length') {
                    var sel = document.getElementById('panel-seq-length-select');
                    if (sel) {
                        sel.value = Math.round(val * 31.0);
                        const sc = document.getElementById('panel-seq-steps-container');
                        if (sc) {for (let si3 = 0; si3 < 32; si3++) {
                            const w = sc.children[si3];
                            if (w && typeof w._updateStepVisual === 'function') {w._updateStepVisual(si3);}
                        }}
                    }
                } else if (paramId === 'seq_key_loop') {
                    var sel = document.getElementById('panel-seq-keyloop-select');
                    if (sel) {sel.value = Math.round(val * 2.0);}
                } else if (paramId && paramId.startsWith('seq_step_')) {
                    const idx = parseInt(paramId.split('_')[2]) - 1;
                    if (idx >= 0 && idx < 32) {
                        const rawByte = Math.round(val * 255);
                        const wraps = document.getElementById('panel-seq-steps-container');
                        if (wraps && window._panelSeqValues && window._panelSeqRaw) {
                            window._panelSeqRaw[idx] = rawByte;
                            window._panelSeqValues[idx] = rawByte === 0 ? 0 : rawByte - 128;
                            if (typeof window._updatePanelStepVisual === 'function') {
                                window._updatePanelStepVisual(idx);
                            }
                        }
                    }
                } else if (paramId === 'seq_swing' || paramId === 'seq_slew_rate') {
                    const sliderEl = container.querySelector('[data-param="' + paramId + '"] .v-slider');
                    if (sliderEl) {
                        const handle = sliderEl.querySelector('.handle');
                        const rect = sliderEl.getBoundingClientRect();
                        if (rect.height > 0) {
                            const handleHeight = 16;
                            handle.style.top = (1.0 - val) * (rect.height - handleHeight) + 'px';
                        }
                    }
                }
            } else if (state.currentPanelMode === 'ARP') {
                if (paramId === 'arp_enable') {
                    const box = document.getElementById('panel-arp-enable-box');
                    if (box) {box.classList.toggle('active', val > 0.5);}
                }
                if (paramId === 'arp_hold') {
                    const box = document.getElementById('panel-arp-hold-box');
                    if (box) {box.classList.toggle('active', val > 0.5);}
                }
                if (paramId === 'arp_key_sync') {
                    const box = document.getElementById('panel-arp-keysync-box');
                    if (box) {box.classList.toggle('active', val > 0.5);}
                }
                if (paramId === 'arp_clock_divider') {
                    const sel = document.getElementById('panel-arp-clock-select');
                    if (sel) {sel.value = Math.round(val * 12.0);}
                }
                if (paramId === 'arp_velocity_gate') {
                    const sel = document.getElementById('panel-arp-velgate-select');
                    if (sel) {sel.value = Math.round(val * 2.0);}
                }
                if (paramId === 'arp_mode') {
                    const sel = document.getElementById('panel-arp-mode-select');
                    if (sel) {sel.value = Math.round(val * 10.0);}
                }
                if (paramId === 'arp_octave') {
                    const sel = document.getElementById('panel-arp-octave-select');
                    if (sel) {sel.value = Math.round(val * 3.0);}
                }
                if (paramId === 'arp_swing' || paramId === 'arp_rate' || paramId === 'arp_gate_time') {
                    const sliderEl = container.querySelector(`[data-param="${paramId}"] .v-slider`);
                    if (sliderEl) {
                        const handle = sliderEl.querySelector('.handle');
                        const rect = sliderEl.getBoundingClientRect();
                        if (rect.height > 0) {
                            const handleHeight = 16;
                            handle.style.top = (1.0 - val) * (rect.height - handleHeight) + 'px';
                        }
                    }
                }
            }
            if (typeof window.drawPanelGraphic === 'function') {
                window.drawPanelGraphic();
            }
        });
    }

    // --- Animación continua del canvas con requestAnimationFrame ---
    let _animFrameId = null;
    
    function _startCanvasAnimation() {
        if (_animFrameId) {return;}
        state._animTime = 0;
        const lastFrameTime = { value: 0 };
        
        function _loop(timestamp) {
            if (!panel.classList.contains('active')) {
                _animFrameId = null;
                return;
            }
            const dt = Math.min(50, timestamp - lastFrameTime.value);
            lastFrameTime.value = timestamp;
            state._animTime += dt;
            if (state._animTime > 60000) {state._animTime = state._animTime % 60000;}
            
            if (typeof window.drawPanelGraphic === 'function') {
                window.drawPanelGraphic();
            }
            if (!state.isRealScopeCollapsed && realScopeScreenEl && realScopeScreenEl.style.height !== '0px') {
                if (typeof window.drawRealScope === 'function') {
                    window.drawRealScope();
                }
            }
            // Highlight active sequencer step
            if (state.currentPanelMode === 'SEQ' && window.dualMidiBridge && window.dualMidiBridge._seqEngine) {
                if (window.dualMidiBridge._seqEngine.running) {
                    const curStep = window.dualMidiBridge.parameterCache['seq_current_step'];
                    if (typeof curStep === 'number' && curStep !== window._lastHighlightedSeqStep) {
                        window._lastHighlightedSeqStep = curStep;
                        window._lastSeqStepChangeTime = performance.now();
                    }
                    if (typeof curStep === 'number') {
                        var sc2 = document.getElementById('panel-seq-steps-container');
                        if (sc2) {
                            const elapsed = performance.now() - (window._lastSeqStepChangeTime || 0);
                            const decay = Math.max(0, 1 - elapsed / 400);
                            const blurPx = Math.round(3 + decay * 9);
                            for (var hi = 0; hi < sc2.children.length; hi++) {
                                var child = sc2.children[hi];
                                if (child) {child.style.boxShadow = hi === curStep ? 'inset 0 0 ' + blurPx + 'px var(--accent-pink)' : 'none';}
                            }
                        }
                    }
                    if (typeof curStep === 'number') {
                        var modalBackdrop = document.getElementById('seq-modal-backdrop');
                        if (modalBackdrop && modalBackdrop.style.display !== 'none') {
                            var modalGrid = document.querySelector('.seq-steps-grid');
                            if (modalGrid) {
                                const mElapsed = performance.now() - (window._lastSeqStepChangeTime || 0);
                                const mDecay = Math.max(0, 1 - mElapsed / 400);
                                const mBlurPx = Math.round(5 + mDecay * 11);
                                for (var mhi = 0; mhi < modalGrid.children.length; mhi++) {
                                    var mChild = modalGrid.children[mhi];
                                    if (mChild) {mChild.style.boxShadow = mhi === curStep ? 'inset 0 0 ' + mBlurPx + 'px var(--accent-pink)' : 'none';}
                                }
                            }
                        }
                    }
                    var ssStatus = document.getElementById('scope-seq-status');
                    if (ssStatus) {
                        const ssVal = window.dualMidiBridge.parameterCache['seq_current_value'];
                        const ssStep = window.dualMidiBridge.parameterCache['seq_current_step'];
                        const ssSkip = (window.dualMidiBridge.parameterCache['seq_current_step_skip'] || 0) > 0.5;
                        const ssLen = Math.round((window.dualMidiBridge.parameterCache['seq_length'] || 0) * 31) + 2;
                        if (typeof ssStep === 'number' && typeof ssVal === 'number') {
                            const ssBipVal = Math.round((ssVal * 2.0 - 1.0) * 127);
                            const ssRaw = Math.round(ssVal * 255);
                            const ssSign = ssBipVal >= 0 ? '+' : '';
                            if (ssSkip) {
                                ssStatus.textContent = 'STEP ' + (ssStep + 1) + '/' + ssLen + ' SKIP';
                                ssStatus.style.color = 'var(--color-danger)';
                            } else {
                                ssStatus.textContent = 'STEP ' + (ssStep + 1) + '/' + ssLen + ' ' + ssSign + ssBipVal + ' (r:' + ssRaw + ')';
                                ssStatus.style.color = 'var(--accent-pink)';
                            }
                        }
                    }
                } else if (window._lastHighlightedSeqStep !== -1 && window._lastHighlightedSeqStep !== undefined) {
                    window._lastHighlightedSeqStep = -1;
                    var sc2 = document.getElementById('panel-seq-steps-container');
                    if (sc2) {
                        for (var hi = 0; hi < sc2.children.length; hi++) {
                            var child = sc2.children[hi];
                            if (child) {child.style.boxShadow = 'none';}
                        }
                    }
                    var modalBackdrop = document.getElementById('seq-modal-backdrop');
                    if (modalBackdrop && modalBackdrop.style.display !== 'none') {
                        var modalGrid = document.querySelector('.seq-steps-grid');
                        if (modalGrid) {
                            for (var mhi = 0; mhi < modalGrid.children.length; mhi++) {
                                var mChild = modalGrid.children[mhi];
                                if (mChild) {mChild.style.boxShadow = 'none';}
                            }
                        }
                    }
                    var ssStatus = document.getElementById('scope-seq-status');
                    if (ssStatus) {ssStatus.textContent = '';}
                }
            }
            _animFrameId = requestAnimationFrame(_loop);
        }
        _animFrameId = requestAnimationFrame(_loop);
    }
    
    // Polling timer for audio waveform data (every 100ms when real scope is visible)
    let _audioWaveformTimer = null;
    function _startAudioWaveformPolling() {
        if (_audioWaveformTimer) {return;}
        _audioWaveformTimer = setInterval(function() {
            const bridge = window.dualMidiBridge;
            if (!bridge || !bridge.isJuce) {return;}
            bridge.getAudioWaveform().catch(function() {});
        }, 100);
    }
    function _stopAudioWaveformPolling() {
        if (_audioWaveformTimer) {
            clearInterval(_audioWaveformTimer);
            _audioWaveformTimer = null;
        }
    }
    
    function _updateAudioWaveformPolling() {
        const shouldPoll = panel.classList.contains('active')
            && !state.isRealScopeCollapsed
            && window.dualMidiBridge
            && window.dualMidiBridge.isJuce;
        if (shouldPoll) {
            _startAudioWaveformPolling();
        } else {
            _stopAudioWaveformPolling();
        }
    }

    const _panelObserver = new MutationObserver(function() {
        if (panel.classList.contains('active') && !noScreenModes.includes(state.currentPanelMode)) {
            _startCanvasAnimation();
            _updateAudioWaveformPolling();
        } else if (!panel.classList.contains('active')) {
            _updateAudioWaveformPolling();
        }
    });
    _panelObserver.observe(panel, { attributes: true, attributeFilter: ['class'] });
}
