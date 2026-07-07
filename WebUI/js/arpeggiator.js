/* --- ABDEEP ARPEGGIATOR MODAL & PATTERN EDITOR ---
   Gestor interactivo del arpegiador central y editor de patrones de 32 pasos
*/

document.addEventListener('DOMContentLoaded', () => {
    initArpeggiatorModal();
});

function initArpeggiatorModal() {
    const arpBtn = document.getElementById('programmer-arp-btn');
    const backdrop = document.getElementById('arp-modal-backdrop');
    const closeBtn = document.getElementById('arp-modal-close-btn');
    const stepsGrid = document.querySelector('.arp-steps-grid');
    const stepsLabels = document.querySelector('.arp-steps-labels');

    if (!arpBtn || !backdrop || !closeBtn || !stepsGrid || !stepsLabels) return;

    // Estado local para los 32 pasos del patrón
    let arpPatternSteps = Array(32).fill(false); // false = off, true = on

    // Mostrar modal
    arpBtn.addEventListener('click', (e) => {
        e.preventDefault();
        backdrop.style.display = 'flex';
        syncArpModalUI();
    });

    // Ocultar modal
    closeBtn.addEventListener('click', () => {
        backdrop.style.display = 'none';
    });

    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
            backdrop.style.display = 'none';
        }
    });

    // Generar dinámicamente los 32 pasos interactivos
    stepsGrid.innerHTML = '';
    stepsLabels.innerHTML = '';
    
    for (let i = 0; i < 32; i++) {
        const stepUnit = document.createElement('div');
        stepUnit.style.display = 'flex';
        stepUnit.style.flexDirection = 'column';
        stepUnit.style.justifyContent = 'flex-end';
        stepUnit.style.height = '100%';
        stepUnit.style.cursor = 'pointer';
        
        const stepBar = document.createElement('div');
        stepBar.style.width = '100%';
        stepBar.style.height = '15%'; // Gate por defecto bajo
        stepBar.style.background = '#222';
        stepBar.style.borderRadius = '2px';
        stepBar.style.transition = 'background 0.1s, height 0.1s';
        
        stepUnit.appendChild(stepBar);
        
        // Click en el paso conmuta el Gate (on/off)
        stepUnit.addEventListener('click', () => {
            arpPatternSteps[i] = !arpPatternSteps[i];
            stepBar.style.height = arpPatternSteps[i] ? '90%' : '15%';
            stepBar.style.background = arpPatternSteps[i] ? 'var(--brand-accent)' : '#222';
            
            // Opcional: Enviar cambio del patrón por SysEx o parámetro si se soporta individualmente
            const lcdText = document.getElementById('lcd-text');
            if (lcdText) {
                lcdText.innerHTML = `<span style="font-size:10px; opacity:0.6;">ARPEGGIATOR</span><br><strong>STEP ${i+1} GATE</strong><br><span style="font-size:15px; color:#ffb700;">${arpPatternSteps[i] ? 'ON' : 'OFF'}</span>`;
            }
        });
        
        stepsGrid.appendChild(stepUnit);
        
        // Etiquetas de números 1-32
        const label = document.createElement('span');
        label.innerText = i + 1;
        stepsLabels.appendChild(label);
    }

    // Configurar listeners de controles dentro del modal
    const arpBox = document.getElementById('modal-arp-enable-box');
    if (arpBox) {
        arpBox.addEventListener('click', () => {
            const active = arpBox.classList.contains('active');
            if (window.dualMidiBridge) window.dualMidiBridge.setParameter("arp_enable", active ? 0.0 : 1.0);
        });
    }

    const holdBox = document.getElementById('modal-arp-hold-box');
    if (holdBox) {
        holdBox.addEventListener('click', () => {
            const active = holdBox.classList.contains('active');
            if (window.dualMidiBridge) window.dualMidiBridge.setParameter("arp_hold", active ? 0.0 : 1.0);
        });
    }

    const keySyncBox = document.getElementById('modal-arp-keysync-box');
    if (keySyncBox) {
        keySyncBox.addEventListener('click', () => {
            const active = keySyncBox.classList.contains('active');
            if (window.dualMidiBridge) window.dualMidiBridge.setParameter("arp_key_sync", active ? 0.0 : 1.0);
        });
    }

    const selectClock = document.getElementById('modal-arp-clock-select');
    if (selectClock) {
        selectClock.addEventListener('change', () => {
            if (window.dualMidiBridge) window.dualMidiBridge.setParameter("arp_clock_divider", parseInt(selectClock.value) / 2.0);
        });
    }

    const selectVelGate = document.getElementById('modal-arp-velgate-select');
    if (selectVelGate) {
        selectVelGate.addEventListener('change', () => {
            if (window.dualMidiBridge) window.dualMidiBridge.setParameter("arp_velocity_gate", parseInt(selectVelGate.value) / 2.0);
        });
    }

    const selectMode = document.getElementById('modal-arp-mode-select');
    if (selectMode) {
        selectMode.addEventListener('change', () => {
            if (window.dualMidiBridge) window.dualMidiBridge.setParameter("arp_mode", parseInt(selectMode.value) / 9.0);
        });
    }

    const selectOctave = document.getElementById('modal-arp-octave-select');
    if (selectOctave) {
        selectOctave.addEventListener('change', () => {
            if (window.dualMidiBridge) window.dualMidiBridge.setParameter("arp_octave", parseInt(selectOctave.value) / 3.0);
        });
    }

    // Configurar listeners de faders en el modal
    backdrop.querySelectorAll('.v-slider').forEach(slider => {
        const ctrlUnit = slider.closest('[data-param]');
        if (!ctrlUnit) return;
        const paramId = ctrlUnit.getAttribute('data-param');
        const handle = slider.querySelector('.handle');

        let isDragging = false;

        const updateSliderPos = (clientY) => {
            const rect = slider.getBoundingClientRect();
            const handleHeight = 16;
            const limit = rect.height - handleHeight;
            let y = clientY - rect.top - (handleHeight / 2);
            y = Math.max(0, Math.min(limit, y));
            handle.style.top = y + 'px';

            const val = 1.0 - (y / limit);
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter(paramId, val);
            }
        };

        slider.addEventListener('mousedown', (e) => {
            isDragging = true;
            updateSliderPos(e.clientY);
            e.preventDefault();
        });

        window.addEventListener('mousemove', (e) => {
            if (isDragging) updateSliderPos(e.clientY);
        });

        window.addEventListener('mouseup', () => {
            isDragging = false;
        });
    });

    // Gestión básica de presets locales del arpegiador
    const loadPresetBtn = document.getElementById('modal-arp-load-preset');
    const savePresetBtn = document.getElementById('modal-arp-save-preset');
    const presetsList = document.getElementById('modal-arp-presets-list');

    if (presetsList) {
        presetsList.querySelectorAll('.preset-item').forEach(item => {
            item.addEventListener('click', () => {
                presetsList.querySelectorAll('.preset-item').forEach(i => i.style.background = 'transparent');
                item.style.background = 'rgba(255,153,0,0.2)';
                item.classList.add('selected');
            });
        });
    }

    if (loadPresetBtn) {
        loadPresetBtn.addEventListener('click', () => {
            const selected = presetsList.querySelector('.selected');
            if (selected) {
                const text = selected.innerText;
                if (text.includes("Default")) {
                    arpPatternSteps = Array(32).fill(false).map((_, i) => i % 2 === 0);
                } else if (text.includes("Disco")) {
                    arpPatternSteps = Array(32).fill(false).map((_, i) => i % 4 === 0 || i % 8 === 2);
                } else {
                    arpPatternSteps = Array(32).fill(false).map(() => Math.random() > 0.5);
                }
                
                // Reflejar cambios visuales en el editor de pasos
                const units = stepsGrid.children;
                for (let i = 0; i < 32; i++) {
                    const bar = units[i].querySelector('div');
                    bar.style.height = arpPatternSteps[i] ? '90%' : '15%';
                    bar.style.background = arpPatternSteps[i] ? 'var(--brand-accent)' : '#222';
                }
            }
        });
    }

    // Registrar actualizador global
    window.syncArpModalUIFromState = () => {
        if (backdrop.style.display !== 'none') {
            syncArpModalUI();
        }
    };
    
    function syncArpModalUI() {
        if (typeof currentActivePatchIndex === 'undefined' || currentActivePatchIndex === -1) return;
        const activeBank = loadedBanks[currentActiveBank];
        if (!activeBank) return;
        const patch = activeBank[currentActivePatchIndex];
        if (!patch || !patch.unpackedBytes) return;

        const arpEn = patch.unpackedBytes[109] > 0.5;
        const holdEn = patch.unpackedBytes[110] > 0.5;
        const keySyncEn = patch.unpackedBytes[111] > 0.5;
        const velGateVal = patch.unpackedBytes[112] || 0;
        const modeVal = patch.unpackedBytes[113] || 0;
        const clockVal = patch.unpackedBytes[117] || 0;
        const octaveVal = patch.unpackedBytes[118] || 0;

        if (arpBox) arpBox.classList.toggle('active', arpEn);
        if (holdBox) holdBox.classList.toggle('active', holdEn);
        if (keySyncBox) keySyncBox.classList.toggle('active', keySyncEn);

        if (selectClock) selectClock.value = Math.round(clockVal);
        if (selectVelGate) selectVelGate.value = Math.round(velGateVal);
        if (selectMode) selectMode.value = Math.round(modeVal);
        if (selectOctave) selectOctave.value = Math.round(octaveVal);

        const sliders = [
            { id: "arp_swing", val: patch.unpackedBytes[116] / 100.0 },
            { id: "arp_rate", val: (patch.unpackedBytes[114] - 20) / 220.0 },
            { id: "arp_gate_time", val: patch.unpackedBytes[115] / 255.0 }
        ];

        sliders.forEach(sliderInfo => {
            const sliderEl = backdrop.querySelector(`[data-param="${sliderInfo.id}"] .v-slider`);
            if (sliderEl) {
                const handle = sliderEl.querySelector('.handle');
                const updatePos = () => {
                    const rect = sliderEl.getBoundingClientRect();
                    if (rect.height > 0) {
                        const handleHeight = 16;
                        const pos = (1.0 - sliderInfo.val) * (rect.height - handleHeight);
                        handle.style.top = pos + 'px';
                    } else {
                        setTimeout(updatePos, 100);
                    }
                };
                updatePos();
            }
        });
    }

    // Escuchar cambios de parámetros del arpegiador
    if (window.dualMidiBridge) {
        window.dualMidiBridge.onParameterChanged((paramId, val) => {
            if (backdrop.style.display === 'none') return;
            if (paramId === "arp_enable" && arpBox) arpBox.classList.toggle('active', val > 0.5);
            if (paramId === "arp_hold" && holdBox) holdBox.classList.toggle('active', val > 0.5);
            if (paramId === "arp_key_sync" && keySyncBox) keySyncBox.classList.toggle('active', val > 0.5);
            if (paramId === "arp_clock_divider" && selectClock) selectClock.value = Math.round(val * 2.0);
            if (paramId === "arp_velocity_gate" && selectVelGate) selectVelGate.value = Math.round(val * 2.0);
            if (paramId === "arp_mode" && selectMode) selectMode.value = Math.round(val * 9.0);
            if (paramId === "arp_octave" && selectOctave) selectOctave.value = Math.round(val * 3.0);
            if (paramId === "arp_swing" || paramId === "arp_rate" || paramId === "arp_gate_time") {
                const sliderEl = backdrop.querySelector(`[data-param="${paramId}"] .v-slider`);
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
}
