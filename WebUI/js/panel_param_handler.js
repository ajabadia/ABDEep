/**
 * @purpose Manejador de cambios de parámetros en tiempo real para el panel de edición.
 * Los handlers específicos de LFO, VCA, ENV, HPF, VCF y OSC se han extraído a
 * panel_param_handler_voice.js y panel_param_handler_filters.js.
 * Extraído de panel_edit.js como parte de la modularización.
 */

/**
 * Update a vertical slider handle position from a normalized value.
 * @param {HTMLElement} sliderEl - The slider container element
 * @param {number} val - Normalized value (0..1)
 */
function _updateSliderHandle(sliderEl, val) {
    if (!sliderEl) {return;}
    const handle = sliderEl.querySelector('.handle');
    const rect = sliderEl.getBoundingClientRect();
    if (rect.height > 0) {
        const handleHeight = 16;
        handle.style.top = (1.0 - val) * (rect.height - handleHeight) + 'px';
    }
}

// Expose helper for extracted handler modules
window._updateSliderHandle = _updateSliderHandle;

/**
 * Handle a real-time parameter change from the bridge and update the panel UI.
 * @param {string} paramId - The parameter identifier (e.g., 'lfo1_rate')
 * @param {number} val - Normalized value (0..1)
 */
window._handlePanelParamChange = function(paramId, val) {
    const state = window.panelEditState;
    const container = document.getElementById('panel-dynamic-controls');

    // --- Delegate to extracted handler modules ---
    if (state.currentPanelMode === 'LFO') {
        if (typeof window._handleLfoParamChange === 'function') {
            window._handleLfoParamChange(paramId, val, state);
        }
    } else if (state.currentPanelMode === 'VCA') {
        if (typeof window._handleVcaParamChange === 'function') {
            window._handleVcaParamChange(paramId, val, state);
        }
    } else if (state.currentPanelMode === 'ENV') {
        if (typeof window._handleEnvParamChange === 'function') {
            window._handleEnvParamChange(paramId, val, state);
        }
    } else if (state.currentPanelMode === 'HPF') {
        if (typeof window._handleHpfParamChange === 'function') {
            window._handleHpfParamChange(paramId, val, state);
        }
    } else if (state.currentPanelMode === 'VCF') {
        if (typeof window._handleVcfParamChange === 'function') {
            window._handleVcfParamChange(paramId, val, state);
        }
    } else if (state.currentPanelMode === 'OSC') {
        if (typeof window._handleOscParamChange === 'function') {
            window._handleOscParamChange(paramId, val, state);
        }
    } else if (state.currentPanelMode === 'POLY') {
        if (paramId === 'voice_mode') {
            const sel = document.getElementById('panel-poly-mode-select');
            if (sel) {sel.value = Math.round(val * 12.0);}
        } else if (paramId === 'note_priority') {
            const activeIndex = Math.round(val * 2.0);
            container.querySelectorAll('.priority-led-row').forEach(function(row) {
                row.classList.toggle('active', parseInt(row.getAttribute('data-val')) === activeIndex);
            });
        } else if (paramId === 'trigger_mode') {
            const activeIndex = Math.round(val * 3.0);
            container.querySelectorAll('.trigger-led-row').forEach(function(row) {
                row.classList.toggle('active', parseInt(row.getAttribute('data-val')) === activeIndex);
            });
        } else if (['unison_detune', 'voice_drift', 'param_drift', 'drift_rate'].indexOf(paramId) !== -1) {
            const sliderEl = container.querySelector('[data-param="' + paramId + '"] .v-slider');
            _updateSliderHandle(sliderEl, val);
        }
    } else if (state.currentPanelMode === 'PORTA') {
        if (paramId === 'porta_mode') {
            const idx = Math.round(val * 9.0);
            container.querySelectorAll('.porta-mode-led-row').forEach(function(r) {r.classList.remove('active');});
            const match = container.querySelector('.porta-mode-led-row[data-val="' + idx + '"]');
            if (match) {match.classList.add('active');}
        } else if (paramId === 'note_priority') {
            const idx = Math.round(val * 2.0);
            container.querySelectorAll('.note-priority-led-row').forEach(function(r) {r.classList.remove('active');});
            const match = container.querySelector('.note-priority-led-row[data-val="' + idx + '"]');
            if (match) {match.classList.add('active');}
        } else if (paramId === 'trigger_mode') {
            const idx = Math.round(val * 3.0);
            container.querySelectorAll('.trigger-mode-led-row').forEach(function(r) {r.classList.remove('active');});
            const match = container.querySelector('.trigger-mode-led-row[data-val="' + idx + '"]');
            if (match) {match.classList.add('active');}
        } else {
            const sliderEl = container.querySelector('[data-param="' + paramId + '"] .v-slider');
            _updateSliderHandle(sliderEl, val);
        }
    } else if (state.currentPanelMode === 'CHORD') {
        if (paramId === 'chord_enable') {
            const box = document.getElementById('panel-chord-enable-box');
            if (box) {box.classList.toggle('active', val > 0.5);}
        }
        if (paramId === 'chord_key') {
            const idx = Math.round(val * 11.0);
            container.querySelectorAll('.chord-key-led-row').forEach(function(r) {r.classList.remove('active');});
            const match = container.querySelector('.chord-key-led-row[data-val="' + idx + '"]');
            if (match) {match.classList.add('active');}
        }
        if (paramId === 'chord_type') {
            const idx = Math.round(val * 11.0);
            container.querySelectorAll('.chord-type-led-row').forEach(function(r) {r.classList.remove('active');});
            const match = container.querySelector('.chord-type-led-row[data-val="' + idx + '"]');
            if (match) {match.classList.add('active');}
        }
    } else if (state.currentPanelMode === 'POLY_CHORD') {
        if (paramId === 'poly_chord_enable') {
            const box = document.getElementById('panel-poly-chord-enable-box');
            if (box) {box.classList.toggle('active', val > 0.5);}
        }
        if (paramId === 'chord_key') {
            const idx = Math.round(val * 11.0);
            container.querySelectorAll('.chord-key-led-row').forEach(function(r) {r.classList.remove('active');});
            const match = container.querySelector('.chord-key-led-row[data-val="' + idx + '"]');
            if (match) {match.classList.add('active');}
        }
        if (paramId === 'chord_type') {
            const idx = Math.round(val * 11.0);
            container.querySelectorAll('.chord-type-led-row').forEach(function(r) {r.classList.remove('active');});
            const match = container.querySelector('.chord-type-led-row[data-val="' + idx + '"]');
            if (match) {match.classList.add('active');}
        }
    } else if (state.currentPanelMode === 'SEQ') {
        if (paramId === 'seq_enable') {
            const box = document.getElementById('panel-seq-enable-box');
            if (box) {box.classList.toggle('active', val > 0.5);}
        } else if (paramId === 'seq_clock') {
            const sel = document.getElementById('panel-seq-clock-select');
            if (sel) {sel.value = Math.round(val * 15.0);}
        } else if (paramId === 'seq_length') {
            const sel = document.getElementById('panel-seq-length-select');
            if (sel) {
                sel.value = Math.round(val * 31.0);
                const sc = document.getElementById('panel-seq-steps-container');
                if (sc) {for (let si3 = 0; si3 < 32; si3++) {
                    const w = sc.children[si3];
                    if (w && typeof w._updateStepVisual === 'function') {w._updateStepVisual(si3);}
                }}
            }
        } else if (paramId === 'seq_key_loop') {
            const sel = document.getElementById('panel-seq-keyloop-select');
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
            _updateSliderHandle(sliderEl, val);
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
        if (paramId === 'arp_pattern') {
            const sel = document.getElementById('panel-arp-pattern-select');
            if (sel) {sel.value = Math.round(val * 64.0);}
        }
        if (paramId === 'arp_swing' || paramId === 'arp_rate' || paramId === 'arp_gate_time') {
            const sliderEl = container.querySelector('[data-param="' + paramId + '"] .v-slider');
            _updateSliderHandle(sliderEl, val);
        }
    }
    if (typeof window.drawPanelGraphic === 'function') {
        window.drawPanelGraphic();
    }
};
