/**
 * @purpose Arpeggiator Control Listeners — toggle boxes, selects, faders, reset button, and bridge param sync.
 * Extracted from arpeggiator.js for SRP separation.
 */

/**
 * Inicializa los listeners de controles del modal del arpegiador.
 * @param {HTMLElement} backdrop - El backdrop del modal de arp
 * @param {object} stepEditor - Objeto retornado por createArpStepGrid(): { getSteps, setSteps, syncVisuals }
 * @param {object} callbacks - { onPresetRender(), getSelectedPreset(), setSelectedPreset(p) }
 */
window.initArpControls = function(backdrop, stepEditor, callbacks) {
    const arpBox = document.getElementById('modal-arp-enable-box');
    const holdBox = document.getElementById('modal-arp-hold-box');
    const keySyncBox = document.getElementById('modal-arp-keysync-box');
    const selectClock = document.getElementById('modal-arp-clock-select');
    const selectVelGate = document.getElementById('modal-arp-velgate-select');
    const selectMode = document.getElementById('modal-arp-mode-select');
    const selectOctave = document.getElementById('modal-arp-octave-select');
    const selectPattern = document.getElementById('modal-arp-pattern-select');
    const loadPresetBtn = document.getElementById('modal-arp-load-preset');

    if (selectPattern) {
        selectPattern.addEventListener('change', function() {
            if (getBridge()) { getBridge().setParameter('arp_pattern', parseInt(selectPattern.value) / 64.0); }
            const patVal = parseInt(selectPattern.value);
            const patName = patVal === 0 ? 'None' : (patVal <= 32 ? 'Preset ' + patVal : 'User ' + (patVal - 32));
            window._showArpLcdMessage('ARPEGGIATOR', 'PATTERN', patName, 'green');
        });
    }
    const savePresetBtn = document.getElementById('modal-arp-save-preset');
    const resetBtn = document.getElementById('modal-arp-reset-btn');

    // ── Toggle Boxes ────────────────────────────────────────────
    if (arpBox) {
        arpBox.addEventListener('click', function() {
            const active = arpBox.classList.contains('active');
            if (getBridge()) { getBridge().setParameter('arp_enable', active ? 0.0 : 1.0); }
        });
    }

    if (holdBox) {
        holdBox.addEventListener('click', function() {
            const active = holdBox.classList.contains('active');
            if (getBridge()) { getBridge().setParameter('arp_hold', active ? 0.0 : 1.0); }
        });
    }

    if (keySyncBox) {
        keySyncBox.addEventListener('click', function() {
            const active = keySyncBox.classList.contains('active');
            if (getBridge()) { getBridge().setParameter('arp_key_sync', active ? 0.0 : 1.0); }
        });
    }

    // ── Select / Dropdown Listeners ──────────────────────────────
    if (selectClock) {
        selectClock.addEventListener('change', function() {
            if (getBridge()) { getBridge().setParameter('arp_clock_divider', parseInt(selectClock.value) / 12.0); }
            window._showArpSelectLcd('arp_clock', selectClock, ['1/2','3/8','1/3','1/4','3/16','1/6','1/8','3/32','1/12','1/16','1/24','1/32','1/48'], 'yellow');
        });
    }

    if (selectVelGate) {
        selectVelGate.addEventListener('change', function() {
            if (getBridge()) { getBridge().setParameter('arp_velocity_gate', parseInt(selectVelGate.value) / 2.0); }
            window._showArpSelectLcd('arp_velgate', selectVelGate, ['Gate','Velocity','Seq'], 'teal');
        });
    }

    if (selectMode) {
        selectMode.addEventListener('change', function() {
            if (getBridge()) { getBridge().setParameter('arp_mode', parseInt(selectMode.value) / 10.0); }
            const modeNames = ['UP','DOWN','UP-DOWN','UP-INV','DOWN-INV','UP-DN-INV','UP-ALT','DOWN-ALT','RANDOM','AS-PLAYED'];
            const modeIdx = parseInt(selectMode.value);
            const lcd = document.getElementById('lcd-text');
            if (lcd) {
                lcd.innerHTML = '<span class="lcd-label">ARPEGGIATOR</span><br><strong class="text-accent">MODE: <span class="arp-preset-name">' + modeNames[modeIdx] + '</span></strong>';
                if (typeof window.setLcdParamDisplayTimer === 'function') { window.setLcdParamDisplayTimer(lcd); }
            }
        });
    }

    if (selectOctave) {
        selectOctave.addEventListener('change', function() {
            if (getBridge()) { getBridge().setParameter('arp_octave', parseInt(selectOctave.value) / 3.0); }
            const octVal = parseInt(selectOctave.value) + 1;
            window._showArpLcdMessage('ARPEGGIATOR', 'OCTAVE RANGE', octVal.toString(), 'cyan');
        });
    }

    // ── Fader / Slider Listeners ─────────────────────────────────
    backdrop.querySelectorAll('.v-slider').forEach(function(slider) {
        const ctrlUnit = slider.closest('[data-param]');
        if (!ctrlUnit) { return; }
        const paramId = ctrlUnit.getAttribute('data-param');
        const handle = slider.querySelector('.handle');

        let isDragging = false;

        function updateSliderPos(clientY) {
            const rect = slider.getBoundingClientRect();
            const handleHeight = 16;
            const limit = rect.height - handleHeight;
            let y = clientY - rect.top - (handleHeight / 2);
            y = Math.max(0, Math.min(limit, y));
            handle.style.top = y + 'px';

            const val = 1.0 - (y / limit);
            if (getBridge()) {
                getBridge().setParameter(paramId, val);
            }
        }

        function onSliderMove(e) {
            if (isDragging) { updateSliderPos(e.clientY); }
        }
        function onSliderEnd() {
            isDragging = false;
            window.removeEventListener('mousemove', onSliderMove);
            window.removeEventListener('mouseup', onSliderEnd);
        }

        slider.addEventListener('mousedown', function(e) {
            isDragging = true;
            updateSliderPos(e.clientY);
            e.preventDefault();
            window.addEventListener('mousemove', onSliderMove);
            window.addEventListener('mouseup', onSliderEnd);
        });
    });

    // ── Preset Load / Save ──────────────────────────────────────
    if (loadPresetBtn) {
        loadPresetBtn.addEventListener('click', function() {
            const selected = (typeof callbacks.getSelectedPreset === 'function') ? callbacks.getSelectedPreset() : null;
            if (selected) {
                stepEditor.setSteps(selected.steps);
            }
        });
    }

    if (savePresetBtn) {
        savePresetBtn.addEventListener('click', function() {
            if (window.currentActiveBank && window.currentActiveBank.startsWith('Factory Bank')) {
                alert('Cannot save arpeggiator patterns on factory patches. Please copy this patch to a User Bank first.');
                return;
            }
            const name = prompt('Enter a name for the new arpeggiator pattern preset:');
            if (name && name.trim()) {
                const result = window.saveArpPreset(name, stepEditor.getSteps());
                if (result && result.success && typeof callbacks.onPresetRender === 'function') {
                    callbacks.onPresetRender();
                }
            }
        });
    }

    // ── Reset Button ────────────────────────────────────────────
    if (resetBtn) {
        resetBtn.addEventListener('click', function() {
            const bridge = getBridge();
            if (!bridge || !bridge._arpEngine) { return; }

            window._arpResetCount = (window._arpResetCount || 0) + 1;
            bridge._arpEngine.stop();
            bridge._arpEngine.stepIndex = 0;
            bridge._arpEngine.heldNotes = [];
            bridge._arpEngine.currentDirection = 1;
            bridge._arpActiveNotes = [];

            window._showArpEnableFeedback();
            window._flashArpResetBtn(this);
        });
    }

    // ── Parameter Change Listener (bridge → UI sync) ───────────
    if (getBridge()) {
        getBridge().onParameterChanged(function(paramId, val) {
            if (backdrop.style.display === 'none') { return; }

            // Toggle boxes
            if (paramId === 'arp_enable' && arpBox) {
                arpBox.classList.toggle('active', val > 0.5);
                if (val > 0.5 && getBridge()._arpEngine) {
                    window._showArpEnableFeedback();
                }
            }
            if (paramId === 'arp_hold' && holdBox) { holdBox.classList.toggle('active', val > 0.5); }
            if (paramId === 'arp_key_sync' && keySyncBox) { keySyncBox.classList.toggle('active', val > 0.5); }

            // Selects
            if (paramId === 'arp_clock_divider' && selectClock) { selectClock.value = Math.round(val * 12.0); }
            if (paramId === 'arp_velocity_gate' && selectVelGate) { selectVelGate.value = Math.round(val * 2.0); }
            if (paramId === 'arp_mode' && selectMode) { selectMode.value = Math.round(val * 10.0); }
            if (paramId === 'arp_octave' && selectOctave) { selectOctave.value = Math.round(val * 3.0); }

            // Faders
            if (paramId === 'arp_swing' || paramId === 'arp_rate' || paramId === 'arp_gate_time') {
                const sliderEl = backdrop.querySelector('[data-param="' + paramId + '"] .v-slider');
                if (sliderEl) {
                    const handle = sliderEl.querySelector('.handle');
                    const rect = sliderEl.getBoundingClientRect();
                    if (rect.height > 0) {
                        const handleHeight = 16;
                        const pos = (1.0 - val) * (rect.height - handleHeight);
                        handle.style.top = pos + 'px';
                    }
                }
            }
        });
    }

    // ── Helpers internos extraídos a arpeggiator_controls_ui.js ──
};
