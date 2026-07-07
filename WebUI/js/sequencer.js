/**
 * @purpose Gestor interactivo del secuenciador de control (Control Sequencer) central y editor de valores bipolares de 32 pasos.
 * @purpose_en Interactive manager for the central Control Sequencer and 32-step bipolar value editor.
 * @refactorable false
 * @classification UI Controller Service
 * @complexity Medium
 * @fingerprint exports:1,imports:1,sig:1q9t02p
 * @lastUpdated 2026-07-04T17:55:00.000Z
 */

document.addEventListener('DOMContentLoaded', () => {
    initSequencerModal();
});

function initSequencerModal() {
    const seqBtn = document.getElementById('programmer-seq-btn');
    const backdrop = document.getElementById('seq-modal-backdrop');
    const closeBtn = document.getElementById('seq-modal-close-btn');
    const stepsGrid = document.querySelector('.seq-steps-grid');
    const stepsLabels = document.querySelector('.seq-steps-labels');

    if (!seqBtn || !backdrop || !closeBtn || !stepsGrid || !stepsLabels) return;

    // Estado local para los 32 pasos del secuenciador (valores bipolares -128 a 127)
    let seqStepsValues = Array(32).fill(0); 

    // Mostrar modal
    seqBtn.addEventListener('click', (e) => {
        e.preventDefault();
        backdrop.style.display = 'flex';
        syncSeqModalUI();
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

    // Generar dinámicamente los 32 pasos interactivos (Faders verticales bipolares)
    stepsGrid.innerHTML = '';
    stepsLabels.innerHTML = '';
    
    for (let i = 0; i < 32; i++) {
        const stepUnit = document.createElement('div');
        stepUnit.style.display = 'flex';
        stepUnit.style.flexDirection = 'column';
        stepUnit.style.justifyContent = 'center';
        stepUnit.style.alignItems = 'center';
        stepUnit.style.height = '100%';
        stepUnit.style.cursor = 'ns-resize';
        stepUnit.style.position = 'relative';
        stepUnit.style.background = '#0a0a0d';
        stepUnit.style.borderLeft = '1px solid #141419';
        
        // Indicador numérico encima (estilo caja de la app original)
        const numIndicator = document.createElement('div');
        numIndicator.className = 'seq-step-val';
        numIndicator.style.fontSize = '8px';
        numIndicator.style.fontWeight = 'bold';
        numIndicator.style.color = '#ccc';
        numIndicator.style.background = '#1a1a22';
        numIndicator.style.border = '1px solid #2d2d38';
        numIndicator.style.borderRadius = '2px';
        numIndicator.style.padding = '2px 4px';
        numIndicator.style.minWidth = '20px';
        numIndicator.style.textAlign = 'center';
        numIndicator.style.marginBottom = '4px';
        numIndicator.innerText = '0';
        stepUnit.appendChild(numIndicator);

        // Contenedor de la barra
        const barContainer = document.createElement('div');
        barContainer.className = 'seq-step-bar-container';
        barContainer.style.width = '8px';
        barContainer.style.height = '70px';
        barContainer.style.background = '#1a1a22';
        barContainer.style.position = 'relative';
        barContainer.style.borderRadius = '1px';
        
        // Línea central de cero bipolar
        const zeroLine = document.createElement('div');
        zeroLine.style.position = 'absolute';
        zeroLine.style.left = '0';
        zeroLine.style.right = '0';
        zeroLine.style.bottom = '50%';
        zeroLine.style.height = '1px';
        zeroLine.style.background = 'rgba(255, 255, 255, 0.15)';
        zeroLine.style.zIndex = '1';
        barContainer.appendChild(zeroLine);
        
        // La barra de relleno bipolar (origen en el centro)
        const fillBar = document.createElement('div');
        fillBar.className = 'seq-step-fill-bar';
        fillBar.style.width = '100%';
        fillBar.style.position = 'absolute';
        fillBar.style.background = 'var(--brand-accent)';
        fillBar.style.bottom = '50%'; // empieza en el centro
        fillBar.style.height = '0%';
        barContainer.appendChild(fillBar);
        stepUnit.appendChild(barContainer);

        // Lógica de arrastre táctil/ratón para modificar el valor bipolar
        let isEditing = false;
        
        const updateValFromY = (clientY) => {
            const rect = barContainer.getBoundingClientRect();
            const height = rect.height;
            // Calcular posición relativa al centro (0.5 es el centro)
            let relY = (clientY - rect.top) / height;
            relY = Math.max(0, Math.min(1, relY));
            // Invertir ya que clientY crece hacia abajo
            const normVal = 1.0 - relY; // 0.0 a 1.0
            // Convertir a rango bipolar -128 a 127
            const bipolarVal = Math.round((normVal * 255) - 128);
            seqStepsValues[i] = bipolarVal;
            
            // Actualizar visualmente
            updateStepVisual(i);

            // Informar en el LCD
            const lcdText = document.getElementById('lcd-text');
            if (lcdText) {
                lcdText.innerHTML = `<span style="font-size:10px; opacity:0.6;">CONTROL SEQ</span><br><strong>STEP ${i+1} VALUE</strong><br><span style="font-size:15px; color:#ff00cc;">${bipolarVal}</span>`;
            }
        };

        stepUnit.addEventListener('mousedown', (e) => {
            isEditing = true;
            updateValFromY(e.clientY);
            e.preventDefault();
        });

        window.addEventListener('mousemove', (e) => {
            if (isEditing) updateValFromY(e.clientY);
        });

        window.addEventListener('mouseup', () => {
            isEditing = false;
        });

        stepsGrid.appendChild(stepUnit);
        
        // Etiquetas de números 1-32
        const label = document.createElement('span');
        label.innerText = i + 1;
        stepsLabels.appendChild(label);
    }

    // Función interna para actualizar el render de un paso
    function updateStepVisual(index) {
        const stepUnit = stepsGrid.children[index];
        if (!stepUnit) return;
        const numIndicator = stepUnit.querySelector('.seq-step-val');
        const fillBar = stepUnit.querySelector('.seq-step-fill-bar');
        const barContainer = stepUnit.querySelector('.seq-step-bar-container');
        const val = seqStepsValues[index];

        // Determinar si este paso está activo según el selector de longitud
        const selectLength = document.getElementById('modal-seq-length-select');
        // El valor de selectLength es el índice (0-30), que corresponde a la longitud (2-32)
        const activeLength = selectLength ? (parseInt(selectLength.value) + 2) : 16;
        const isActive = index < activeLength;

        if (numIndicator) {
            numIndicator.innerText = val;
            numIndicator.style.color = isActive ? 'var(--brand-accent)' : '#555';
            numIndicator.style.background = isActive ? '#1c1d24' : '#0e0e12';
            numIndicator.style.borderColor = isActive ? 'var(--brand-accent)' : '#222';
            numIndicator.style.opacity = isActive ? '1.0' : '0.4';
        }

        if (stepUnit) {
            stepUnit.style.background = isActive ? '#0e0e12' : '#050507';
        }

        if (barContainer) {
            barContainer.style.background = isActive ? '#1c1c24' : '#111116';
        }

        if (fillBar) {
            // Rango -128 a 127
            if (val >= 0) {
                const pct = (val / 127) * 50;
                fillBar.style.bottom = '50%';
                fillBar.style.height = pct + '%';
                fillBar.style.background = isActive ? '#ff00cc' : 'rgba(255, 0, 204, 0.2)'; // Seq active/inactive theme
            } else {
                const pct = (Math.abs(val) / 128) * 50;
                fillBar.style.bottom = (50 - pct) + '%';
                fillBar.style.height = pct + '%';
                fillBar.style.background = isActive ? '#8800aa' : 'rgba(136, 0, 170, 0.2)'; // Bipolar negativo active/inactive
            }
        }
    }

    // Configurar listeners de controles dentro del modal
    const seqBox = document.getElementById('modal-seq-enable-box');
    if (seqBox) {
        seqBox.addEventListener('click', () => {
            const active = seqBox.classList.contains('active');
            if (window.dualMidiBridge) window.dualMidiBridge.setParameter("seq_enable", active ? 0.0 : 1.0);
        });
    }

    const selectClock = document.getElementById('modal-seq-clock-select');
    if (selectClock) {
        selectClock.addEventListener('change', () => {
            if (window.dualMidiBridge) window.dualMidiBridge.setParameter("seq_clock", parseInt(selectClock.value) / 10.0);
        });
    }

    const selectLength = document.getElementById('modal-seq-length-select');
    if (selectLength) {
        selectLength.addEventListener('change', () => {
            if (window.dualMidiBridge) window.dualMidiBridge.setParameter("seq_length", parseInt(selectLength.value) / 30.0);
            for (let i = 0; i < 32; i++) {
                updateStepVisual(i);
            }
        });
    }

    const selectKeyLoop = document.getElementById('modal-seq-keyloop-select');
    if (selectKeyLoop) {
        selectKeyLoop.addEventListener('change', () => {
            if (window.dualMidiBridge) window.dualMidiBridge.setParameter("seq_key_loop", parseInt(selectKeyLoop.value) / 2.0);
        });
    }

    // Configurar listeners de faders en el modal (Swing y Slew)
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

    // Gestión de presets locales del secuenciador
    const loadPresetBtn = document.getElementById('modal-seq-load-preset');
    const presetsList = document.getElementById('modal-seq-presets-list');

    if (presetsList) {
        presetsList.querySelectorAll('.preset-item').forEach(item => {
            item.addEventListener('click', () => {
                presetsList.querySelectorAll('.preset-item').forEach(i => {
                    i.style.background = 'transparent';
                    i.classList.remove('selected');
                });
                item.style.background = 'rgba(255, 0, 204, 0.2)';
                item.classList.add('selected');
            });
        });
    }

    if (loadPresetBtn) {
        loadPresetBtn.addEventListener('click', () => {
            const selected = presetsList.querySelector('.selected');
            if (selected) {
                const text = selected.innerText;
                if (text.includes("Staircase")) {
                    seqStepsValues = Array(32).fill(0).map((_, i) => Math.round((i / 31) * 255 - 128));
                } else if (text.includes("Triangle")) {
                    seqStepsValues = Array(32).fill(0).map((_, i) => {
                        const phase = (i / 16) % 2.0;
                        const val = phase < 1.0 ? phase : 2.0 - phase;
                        return Math.round((val * 255) - 128);
                    });
                } else {
                    seqStepsValues = Array(32).fill(0).map(() => Math.round(Math.random() * 255 - 128));
                }
                
                // Reflejar cambios visuales
                for (let i = 0; i < 32; i++) {
                    updateStepVisual(i);
                }
            }
        });
    }

    // Registrar actualizador global
    window.syncSeqModalUIFromState = () => {
        if (backdrop.style.display !== 'none') {
            syncSeqModalUI();
        }
    };
    
    function syncSeqModalUI() {
        if (typeof currentActivePatchIndex === 'undefined' || currentActivePatchIndex === -1) return;
        const activeBank = loadedBanks[currentActiveBank];
        if (!activeBank) return;
        const patch = activeBank[currentActivePatchIndex];
        if (!patch || !patch.unpackedBytes) return;

        const seqEn = patch.unpackedBytes[119] > 0.5;
        const clockVal = patch.unpackedBytes[120] || 0;
        const lengthVal = patch.unpackedBytes[121] || 0;
        const keyloopVal = patch.unpackedBytes[122] || 0;

        if (seqBox) seqBox.classList.toggle('active', seqEn);

        if (selectClock) selectClock.value = Math.round(clockVal);
        if (selectLength) selectLength.value = Math.round(lengthVal);
        if (selectKeyLoop) selectKeyLoop.value = Math.round(keyloopVal);

        const sliders = [
            { id: "seq_swing", val: patch.unpackedBytes[123] / 100.0 },
            { id: "seq_slew_rate", val: patch.unpackedBytes[124] / 255.0 }
        ];

        sliders.forEach(sliderInfo => {
            // Actualizar valor en el indicador numérico
            if (sliderInfo.id === "seq_swing") {
                const txt = document.getElementById('modal-seq-swing-val');
                if (txt) txt.innerText = Math.round(50 + sliderInfo.val * 9);
            } else if (sliderInfo.id === "seq_slew_rate") {
                const txt = document.getElementById('modal-seq-slew-val');
                if (txt) txt.innerText = Math.round(sliderInfo.val * 255);
            }

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

        // Inicializar los faders bipolares
        for (let i = 0; i < 32; i++) {
            updateStepVisual(i);
        }
    }

    // Escuchar cambios de parámetros del secuenciador
    if (window.dualMidiBridge) {
        window.dualMidiBridge.onParameterChanged((paramId, val) => {
            if (backdrop.style.display === 'none') return;
            if (paramId === "seq_enable" && seqBox) seqBox.classList.toggle('active', val > 0.5);
            if (paramId === "seq_clock" && selectClock) selectClock.value = Math.round(val * 10.0);
            if (paramId === "seq_length" && selectLength) {
                selectLength.value = Math.round(val * 30.0);
                for (let i = 0; i < 32; i++) {
                    updateStepVisual(i);
                }
            }
            if (paramId === "seq_key_loop" && selectKeyLoop) selectKeyLoop.value = Math.round(val * 2.0);
            if (paramId === "seq_swing" || paramId === "seq_slew_rate") {
                // Actualizar valor en el indicador numérico
                if (paramId === "seq_swing") {
                    const txt = document.getElementById('modal-seq-swing-val');
                    if (txt) txt.innerText = Math.round(50 + val * 9);
                } else if (paramId === "seq_slew_rate") {
                    const txt = document.getElementById('modal-seq-slew-val');
                    if (txt) txt.innerText = Math.round(val * 255);
                }

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
