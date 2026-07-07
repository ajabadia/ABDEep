/**
 * @purpose Controlador del módulo de efectos (Effects Engine Rack) central, manejando ruteos y editores dinámicos para los 4 slots de efectos.
 * @purpose_en Central Effects Engine Rack controller, managing routings and dynamic parameter editor layouts for all 4 FX slots.
 * @refactorable false
 * @classification UI Controller Service
 * @complexity High
 * @fingerprint exports:1,imports:1,sig:1w3x02c
 * @lastUpdated 2026-07-04T22:34:00.000Z
 */

document.addEventListener('DOMContentLoaded', () => {
    initEffectsModal();
});

function initEffectsModal() {
    const fxBtn = document.getElementById('programmer-fx-btn');
    const backdrop = document.getElementById('fx-modal-backdrop');
    const closeBtn = document.getElementById('fx-modal-close-btn');
    const dynamicArea = document.getElementById('fx-dynamic-editor-area');
    const activeSlotLabel = document.getElementById('fx-screen-active-slot');

    if (!fxBtn || !backdrop || !closeBtn || !dynamicArea) return;

    let selectedSlot = 1; // 1 = FX1, 2 = FX2, 3 = FX3, 4 = FX4
    let activeFxPage = 1; // 1 = Page 1, 2 = Page 2

    // Tipos de efecto del manual
    const FX_TYPE_NAMES = ["Bypass", "Ambience", "tcDeepVerb", "RoomRev", "VintageRoom", "HallReverb", "ChamberRev", "Plate Reverb", "Rich Plate", "Gated Reverb", "Reverse Reverb", "ChorusRev", "DelayRev", "FlangerRev", "MidasEQ", "Enhancer", "FairComp", "MBDistortion", "RackAmp", "Edison", "AutoPan/Trem", "NoiseGate", "Delay", "3Tap Delay", "4Tap Delay", "T-RayDelay", "DecimatorDelay", "ModDlyRev", "Stereo Chorus", "Chorus-D", "Stereo Flanger", "Stereo Phaser", "Mood Filter", "Dual Pitch", "Vintage Pitch", "Rotary Speaker"];

    // Mostrar modal
    fxBtn.addEventListener('click', (e) => {
        e.preventDefault();
        backdrop.style.display = 'flex';
        syncFxModalUI();
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

    // Cambiar de slot activo al hacer click en una columna
    for (let i = 1; i <= 4; i++) {
        const slotCol = document.getElementById(`fx-slot-${i}`);
        if (slotCol) {
            slotCol.addEventListener('click', (e) => {
                // Evitar si se hace click en el selector
                if (e.target.tagName === 'SELECT') return;
                
                document.querySelectorAll('.fx-slot-column').forEach(c => c.style.borderColor = '#222');
                slotCol.style.borderColor = 'var(--brand-accent)';
                selectedSlot = i;
                
                renderActiveEffectParams();
            });
        }
    }

    // Configurar selectores de tipo de efecto de cada slot
    document.querySelectorAll('.fx-type-select').forEach(sel => {
        sel.addEventListener('change', () => {
            const slot = sel.getAttribute('data-slot');
            const val = parseInt(sel.value);
            const displayEl = document.getElementById(`fx${slot}-type-mini-display`);
            if (displayEl) displayEl.innerText = FX_TYPE_NAMES[val];
            
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter(`fx${slot}_type`, val / 35.0);
            }
            if (parseInt(slot) === selectedSlot) {
                renderActiveEffectParams();
            }
        });
    });

    // Configurar ruteo, páginas y modos
    const routingSelect = document.getElementById('fx-routing-select');
    if (routingSelect) {
        routingSelect.addEventListener('change', () => {
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter("fx_routing", parseInt(routingSelect.value) / 9.0);
            }
        });
    }

    const page1Btn = document.getElementById('fx-page-1-btn');
    const page2Btn = document.getElementById('fx-page-2-btn');
    if (page1Btn && page2Btn) {
        page1Btn.addEventListener('click', () => {
            page1Btn.classList.add('active');
            page2Btn.classList.remove('active');
            activeFxPage = 1;
            renderActiveEffectParams();
        });
        page2Btn.addEventListener('click', () => {
            page2Btn.classList.add('active');
            page1Btn.classList.remove('active');
            activeFxPage = 2;
            renderActiveEffectParams();
        });
    }

    // Botones de Modo (INS, SEND, BYPASS)
    const modeIns = document.getElementById('fx-mode-ins-btn');
    const modeSend = document.getElementById('fx-mode-send-btn');
    const modeByp = document.getElementById('fx-mode-bypass-btn');
    
    if (modeIns && modeSend && modeByp) {
        modeIns.addEventListener('click', () => {
            modeIns.classList.add('active');
            [modeSend, modeByp].forEach(b => b.classList.remove('active'));
            if (window.dualMidiBridge) window.dualMidiBridge.setParameter("fx_mode", 0.0);
        });
        modeSend.addEventListener('click', () => {
            modeSend.classList.add('active');
            [modeIns, modeByp].forEach(b => b.classList.remove('active'));
            if (window.dualMidiBridge) window.dualMidiBridge.setParameter("fx_mode", 0.5);
        });
        modeByp.addEventListener('click', () => {
            modeByp.classList.add('active');
            [modeIns, modeSend].forEach(b => b.classList.remove('active'));
            if (window.dualMidiBridge) window.dualMidiBridge.setParameter("fx_mode", 1.0);
        });
    }

    // Configurar listeners de faders gain/mix principales
    backdrop.querySelectorAll('.fx-slot-column .v-slider').forEach(slider => {
        const ctrlUnit = slider.closest('[data-param]');
        if (!ctrlUnit) return;
        const paramId = ctrlUnit.getAttribute('data-param');
        const handle = slider.querySelector('.handle');

        let isDragging = false;

        const updateSliderPos = (clientY) => {
            const rect = slider.getBoundingClientRect();
            const handleHeight = 12;
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
            e.stopPropagation();
        });

        window.addEventListener('mousemove', (e) => {
            if (isDragging) updateSliderPos(e.clientY);
        });

        window.addEventListener('mouseup', () => {
            isDragging = false;
        });
    });

    // Renderizar la sección de parámetros dinámicos según el tipo de efecto activo en el slot seleccionado
    function renderActiveEffectParams() {
        const typeSelect = document.querySelector(`.fx-type-select[data-slot="${selectedSlot}"]`);
        if (!typeSelect) return;
        const effectType = parseInt(typeSelect.value);

        activeSlotLabel.innerText = `Slot: FX${selectedSlot} (${FX_TYPE_NAMES[effectType]})`;

        // Obtener valores actuales de los parámetros del patch
        let pVals = Array(8).fill(0.5);
        if (typeof currentActivePatchIndex !== 'undefined' && currentActivePatchIndex !== -1) {
            const activeBank = loadedBanks[currentActiveBank];
            if (activeBank) {
                const patch = activeBank[currentActivePatchIndex];
                if (patch && patch.unpackedBytes) {
                    const offsetStart = selectedSlot === 1 ? 131 : (selectedSlot === 2 ? 142 : 131); // simplificado
                    for (let i = 0; i < 8; i++) {
                        pVals[i] = (patch.unpackedBytes[offsetStart + i] || 128) / 255.0;
                    }
                }
            }
        }

        dynamicArea.innerHTML = '';
        
        if (effectType === 0) { // BYPASS
            dynamicArea.innerHTML = `<span style="color:#555; font-size:12px; font-family:'Share Tech Mono', monospace; text-transform:uppercase;">Effect Bypassed</span>`;
            return;
        }

        // Definir plantillas visuales
        let templateHtml = '';

        if (effectType === 4) { // VintageRoomReverb
            // Vista de Displays digitales rojos según la captura Vintage Room Reverb
            templateHtml = `
                <div style="display: grid; grid-template-columns: repeat(4, 1fr) 1.2fr; gap: 8px; width: 95%; padding: 5px;">
                    <div style="display: flex; flex-direction: column; gap: 5px;">
                        <div style="background:#050000; border: 1px solid #ff2200; border-radius: 2px; padding: 4px; text-align:center; font-family:'Share Tech Mono', monospace; color:#ff2200;">
                            <div style="font-size:6px; color:#661100;">PRE DELAY</div>
                            <div style="font-size:12px; font-weight:bold;">${Math.round(pVals[0] * 200)} ms</div>
                        </div>
                        <div style="background:#050000; border: 1px solid #ff2200; border-radius: 2px; padding: 4px; text-align:center; font-family:'Share Tech Mono', monospace; color:#ff2200;">
                            <div style="font-size:6px; color:#661100;">DECAY</div>
                            <div style="font-size:12px; font-weight:bold;">${Math.round(pVals[1] * 100)} %</div>
                        </div>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 5px;">
                        <div style="background:#050000; border: 1px solid #ff2200; border-radius: 2px; padding: 4px; text-align:center; font-family:'Share Tech Mono', monospace; color:#ff2200;">
                            <div style="font-size:6px; color:#661100;">SIZE</div>
                            <div style="font-size:12px; font-weight:bold;">${Math.round(pVals[2] * 100)} %</div>
                        </div>
                        <div style="background:#050000; border: 1px solid #ff2200; border-radius: 2px; padding: 4px; text-align:center; font-family:'Share Tech Mono', monospace; color:#ff2200;">
                            <div style="font-size:6px; color:#661100;">DENSITY</div>
                            <div style="font-size:12px; font-weight:bold;">${Math.round(pVals[3] * 100)} %</div>
                        </div>
                    </div>

                    <!-- Botón Freeze Central -->
                    <div style="display: flex; flex-direction: column; align-items:center; justify-content: center; background: #1c1d22; border-radius: 3px; border: 1px solid #444; padding: 4px;">
                        <div style="width:28px; height:28px; border-radius:50%; background:#888; border:2px solid #ccc; box-shadow: inset 0 2px 4px rgba(0,0,0,0.6);"></div>
                        <span style="font-size:8px; font-weight:bold; color:#fff; margin-top:4px;">FREEZE</span>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 5px;">
                        <div style="background:#050000; border: 1px solid #ff2200; border-radius: 2px; padding: 4px; text-align:center; font-family:'Share Tech Mono', monospace; color:#ff2200;">
                            <div style="font-size:6px; color:#661100;">LOW MULT</div>
                            <div style="font-size:12px; font-weight:bold;">x${(pVals[4] * 2.0).toFixed(1)}</div>
                        </div>
                        <div style="background:#050000; border: 1px solid #ff2200; border-radius: 2px; padding: 4px; text-align:center; font-family:'Share Tech Mono', monospace; color:#ff2200;">
                            <div style="font-size:6px; color:#661100;">HIGH MULT</div>
                            <div style="font-size:12px; font-weight:bold;">x${(pVals[5] * 2.0).toFixed(1)}</div>
                        </div>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 5px;">
                        <div style="background:#050000; border: 1px solid #ff2200; border-radius: 2px; padding: 4px; text-align:center; font-family:'Share Tech Mono', monospace; color:#ff2200;">
                            <div style="font-size:6px; color:#661100;">LOW CUT</div>
                            <div style="font-size:12px; font-weight:bold;">${Math.round(pVals[6] * 500)} Hz</div>
                        </div>
                        <div style="background:#050000; border: 1px solid #ff2200; border-radius: 2px; padding: 4px; text-align:center; font-family:'Share Tech Mono', monospace; color:#ff2200;">
                            <div style="font-size:6px; color:#661100;">HIGH CUT</div>
                            <div style="font-size:12px; font-weight:bold;">${Math.round(pVals[7] * 20)} kHz</div>
                        </div>
                    </div>
                </div>
            `;
        } else if (effectType === 2) { // tcDeepVerb
            // Estilo Potenciómetros / Knobs azules
            templateHtml = `
                <div style="display: flex; align-items: center; justify-content: space-around; width: 95%; background:#2c3545; border-radius: 4px; padding: 12px; border: 1px solid #3d4a60;">
                    <div style="color:#fff; font-size:12px; font-weight:bold; font-family:sans-serif; letter-spacing: -0.5px;">tcDeepVerb</div>
                    
                    <div style="text-align:center; color:#fff; font-family:sans-serif;">
                        <div class="knob-ring" style="width:36px; height:36px; margin: 0 auto 4px;">
                            <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[0] * 270) - 135}deg)"></div>
                        </div>
                        <span style="font-size:7px; text-transform:uppercase;">PRE DELAY</span>
                    </div>

                    <div style="text-align:center; color:#fff; font-family:sans-serif;">
                        <div class="knob-ring" style="width:36px; height:36px; margin: 0 auto 4px;">
                            <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[1] * 270) - 135}deg)"></div>
                        </div>
                        <span style="font-size:7px; text-transform:uppercase;">DECAY TIME</span>
                    </div>

                    <div style="text-align:center; color:#fff; font-family:sans-serif;">
                        <div class="knob-ring" style="width:36px; height:36px; margin: 0 auto 4px;">
                            <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[2] * 270) - 135}deg)"></div>
                        </div>
                        <span style="font-size:7px; text-transform:uppercase;">TONE</span>
                    </div>

                    <div style="text-align:center; color:#fff; font-family:sans-serif;">
                        <div class="knob-ring" style="width:36px; height:36px; margin: 0 auto 4px;">
                            <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[3] * 270) - 135}deg)"></div>
                        </div>
                        <span style="font-size:7px; text-transform:uppercase;">MIX</span>
                    </div>
                </div>
            `;
        } else if (effectType === 7) { // Plate Reverb
            // Plate Reverb (Rack negro con pantalla digital azul y 11 potenciómetros rotatorios)
            templateHtml = `
                <div style="display: flex; flex-direction: column; width: 95%; background:#161719; border-radius: 4px; padding: 10px; border: 1px solid #2d3035; color: #fff; font-family: sans-serif;">
                    <!-- Cabecera de marca con Display azul -->
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span style="font-size: 10px; font-weight: bold; color: #aaa; letter-spacing: 1px;">REVERB</span>
                        <div style="background: #0088ff; color: #000; border-radius: 2px; font-family: 'Share Tech Mono', monospace; font-size: 11px; font-weight: bold; padding: 3px 15px; box-shadow: 0 0 8px rgba(0, 136, 255, 0.6); text-transform: uppercase;">PLATE</div>
                    </div>
                    <!-- Fila de Knobs -->
                    <div style="display: grid; grid-template-columns: repeat(10, 1fr); gap: 4px; text-align: center;">
                        ${["PRE DEL", "DECAY", "SIZE", "DAMP", "DIFF", "LO CUT", "HI CUT", "BASS M", "XOVER", "MOD DEP"].map((name, idx) => `
                            <div style="display: flex; flex-direction: column; align-items: center;">
                                <div class="knob-ring" style="width: 24px; height: 24px; margin-bottom: 3px;">
                                    <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[idx] * 270) - 135}deg)"></div>
                                </div>
                                <span style="font-size: 6px; color: #888; font-weight: bold; white-space: nowrap;">${name}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else if (effectType === 11 || effectType === 12 || effectType === 13) { // ChorusRev, DelayRev, FlangerRev
            // Dual FX Rack (Pantalla azul "CHORUS AND CHAMBER", "DELAY AND CHAMBER", etc.)
            let title = "CHORUS AND CHAMBER";
            if (effectType === 12) title = "DELAY AND CHAMBER";
            if (effectType === 13) title = "FLANGER AND CHAMBER";

            const leftKnobs = effectType === 11 ? ["SPEED", "DEPTH", "DELAY", "PHASE", "WAVE"] :
                              (effectType === 12 ? ["TIME", "PATTERN", "FEED HC", "FEEDBACK", "XFEED"] :
                                                   ["SPEED", "DEPTH", "DELAY", "PHASE", "FEED"]);

            templateHtml = `
                <div style="display: flex; flex-direction: column; width: 95%; background:#161719; border-radius: 4px; padding: 8px; border: 1px solid #2d3035; color: #fff; font-family: sans-serif;">
                    <!-- Cabecera de marca con Display azul Dual FX -->
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <span style="font-size: 8px; font-weight: bold; color: #888;">DUAL FX</span>
                        <div style="background: #0088ff; color: #000; border-radius: 2px; font-family: 'Share Tech Mono', monospace; font-size: 9px; font-weight: bold; padding: 2px 10px; box-shadow: 0 0 6px rgba(0, 136, 255, 0.5); text-transform: uppercase;">${title}</div>
                    </div>
                    <!-- Fila de Knobs -->
                    <div style="display: grid; grid-template-columns: repeat(9, 1fr); gap: 2px; text-align: center;">
                        <!-- Controles del Efecto Modulación (Izq) -->
                        ${leftKnobs.map((name, idx) => `
                            <div style="display: flex; flex-direction: column; align-items: center;">
                                <div class="knob-ring" style="width: 22px; height: 22px; margin-bottom: 2px;">
                                    <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[idx] * 270) - 135}deg)"></div>
                                </div>
                                <span style="font-size: 5px; color: #00ccff; white-space: nowrap;">${name}</span>
                            </div>
                        `).join('')}
                        <!-- Controles de la Reverb (Der) -->
                        ${["PREDELAY", "DECAY", "SIZE", "DAMPING"].map((name, idx) => `
                            <div style="display: flex; flex-direction: column; align-items: center;">
                                <div class="knob-ring" style="width: 22px; height: 22px; margin-bottom: 2px;">
                                    <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[5+idx] * 270) - 135}deg)"></div>
                                </div>
                                <span style="font-size: 5px; color: #ff5500; white-space: nowrap;">${name}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else if (effectType === 14) { // MidasEQ
            // 4 Band EQ (Rack azul turquesa con potenciómetros negros)
            templateHtml = `
                <div style="display: flex; align-items: center; justify-content: space-around; width: 95%; background:#1b364a; border-radius: 4px; padding: 8px; border: 1px solid #285474; color: #fff; font-family: sans-serif;">
                    <div style="font-size: 11px; font-weight: bold; width: 60px; line-height: 1; letter-spacing: -0.5px;">4 Band<br>EQ</div>
                    ${["Low Freq", "Low Gain", "Low Mid Freq", "Low Mid Gain", "High Mid Freq", "High Mid Gain", "High Freq", "High Gain"].map((name, idx) => `
                        <div style="text-align:center;">
                            <div class="knob-ring" style="width:24px; height:24px; margin: 0 auto 3px;">
                                <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[idx] * 270) - 135}deg)"></div>
                            </div>
                            <span style="font-size:5px; text-transform:uppercase; white-space: nowrap;">${name}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        } else if (effectType === 15) { // Enhancer
            // Stereo Enhancer (Rack dorado con knobs dorados/negros y botón Solo)
            templateHtml = `
                <div style="display: flex; align-items: center; justify-content: space-around; width: 95%; background:#c2a15f; border-radius: 4px; padding: 8px; border: 1px solid #d4b87e; color: #000; font-family: sans-serif;">
                    <div style="font-size: 10px; font-weight: bold; width: 80px; font-style: italic; line-height: 1;">Stereo<br>Enhancer</div>
                    <!-- Botón Solo Mode -->
                    <div style="text-align:center;">
                        <div style="width:16px; height:16px; background:#eee; border:1px solid #555; border-radius:2px; margin: 0 auto 3px; cursor:pointer;"></div>
                        <span style="font-size:5px; font-weight:bold;">SOLO</span>
                    </div>
                    ${["Out Gain", "Spread", "Bass Gain", "Bass Freq", "Mid Gain", "Mid Q", "Hi Gain", "Hi Freq"].map((name, idx) => `
                        <div style="text-align:center;">
                            <div class="knob-ring" style="width:24px; height:24px; margin: 0 auto 3px; border-color:#000;">
                                <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[idx] * 270) - 135}deg); background:#000;"></div>
                            </div>
                            <span style="font-size:5px; font-weight:bold; text-transform:uppercase; white-space: nowrap;">${name}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        } else if (effectType === 16) { // FairComp
            // Fair Compressor (Rack azul grisáceo oscuro con selector de Modo ST/DUA/MS y 11 knobs grandes)
            templateHtml = `
                <div style="display: flex; flex-direction: column; width: 95%; background:#202830; border-radius: 4px; padding: 10px; border: 1px solid #303b47; color: #fff; font-family: sans-serif;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <span style="font-size: 10px; font-weight: bold; color: #fff; letter-spacing: 1px;">FAIR COMPRESSOR</span>
                        <div style="display: flex; gap: 3px; align-items:center;">
                            <span style="font-size: 6px; color:#888;">Mode Selection:</span>
                            <div style="background:#111; display:flex; padding: 1px; border:1px solid #444; border-radius:2px;">
                                <div style="font-size:6px; padding:1px 3px; background:#444;">ST</div>
                                <div style="font-size:6px; padding:1px 3px; color:#666;">DUA</div>
                                <div style="font-size:6px; padding:1px 3px; color:#666;">M/S</div>
                            </div>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; text-align: center;">
                        ${["Input Gain", "Threshold L/M", "Time L/M", "DC Bias L/M", "Output Gain", "Bias Bal", "Input Gain R/S", "Threshold R/S", "Time R/S", "DC Bias R/S", "Output Gain R/S"].map((name, idx) => `
                            <div style="display: flex; flex-direction: column; align-items: center;">
                                <div class="knob-ring" style="width: 24px; height: 24px; margin-bottom: 2px;">
                                    <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[idx] * 270) - 135}deg)"></div>
                                </div>
                                <span style="font-size: 5px; color: #aaa; white-space: nowrap;">${name}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else if (effectType === 17) { // MBDistortion
            // Multiband Distortion (Rack verde claro pastel con pantalla y 12 knobs plateados)
            templateHtml = `
                <div style="display: flex; flex-direction: column; width: 95%; background:#4d6d63; border-radius: 4px; padding: 8px; border: 1px solid #5a7f73; color: #fff; font-family: sans-serif;">
                    <div style="text-align: center; font-size: 11px; font-weight: bold; margin-bottom: 6px; letter-spacing: 2px;">MULTIBAND DISTORTION</div>
                    <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; text-align: center;">
                        ${["INPUT GAIN", "DIST TYPE", "LOW BAND", "LOW DRIVE", "XOVER 1", "MID BAND", "MID DRIVE", "XOVER 2", "HIGH BAND", "HIGH DRIVE", "CABINET", "OUTPUT GAIN"].map((name, idx) => `
                            <div style="display: flex; flex-direction: column; align-items: center;">
                                <div class="knob-ring" style="width: 22px; height: 22px; margin-bottom: 2px; border-color:#fff;">
                                    <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[idx] * 270) - 135}deg); background:#fff;"></div>
                                </div>
                                <span style="font-size: 5px; color: #e0e0e0; white-space: nowrap;">${name}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else if (effectType === 18) { // RackAmp
            // RackAmp (Rack gris con 8 potenciómetros y botón Cabinet)
            templateHtml = `
                <div style="display: flex; align-items: center; justify-content: space-around; width: 95%; background:#333; border-radius: 4px; padding: 10px; border: 1px solid #444; color: #fff; font-family: sans-serif;">
                    <div style="font-size: 12px; font-weight: bold; font-style: italic; width: 80px; letter-spacing: 1px;">Rackamp</div>
                    ${["Preamp", "Buzz", "Punch", "Crunch", "Drive", "Level", "Low", "High"].map((name, idx) => `
                        <div style="text-align:center;">
                            <div class="knob-ring" style="width:26px; height:26px; margin: 0 auto 3px;">
                                <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[idx] * 270) - 135}deg)"></div>
                            </div>
                            <span style="font-size:6px; color:#aaa; text-transform:uppercase;">${name}</span>
                        </div>
                    `).join('')}
                    <div style="text-align:center;">
                        <div style="width:14px; height:14px; border-radius:50%; background:#00ff66; border:1px solid #fff; margin: 0 auto 3px; box-shadow: 0 0 6px #00ff66;"></div>
                        <span style="font-size:5px; font-weight:bold;">CABINET</span>
                    </div>
                </div>
            `;
        } else if (effectType === 19) { // Edison
            // Edison EX1+ (Rack plateado, 5 knobs negros y botones M/S)
            templateHtml = `
                <div style="display: flex; align-items: center; justify-content: space-around; width: 95%; background:#e0e0e0; border-radius: 4px; padding: 10px; border: 1px solid #ccc; color: #000; font-family: sans-serif;">
                    <div style="font-size: 10px; font-weight: bold; width: 80px; letter-spacing: -0.5px; line-height: 1;">EDISON<br>EX1+</div>
                    <div style="text-align:center;">
                        <div style="width:12px; height:12px; background:#ffcc00; border:1px solid #000; margin: 0 auto 3px;"></div>
                        <span style="font-size:5px; font-weight:bold;">M/S IN</span>
                    </div>
                    ${["St Spread", "LMF Spread", "Balance", "Center Dist", "Output Gain"].map((name, idx) => `
                        <div style="text-align:center;">
                            <div class="knob-ring" style="width:26px; height:26px; margin: 0 auto 3px; border-color:#000;">
                                <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[idx] * 270) - 135}deg); background:#000;"></div>
                            </div>
                            <span style="font-size:6px; font-weight:bold; text-transform:uppercase; white-space: nowrap;">${name}</span>
                        </div>
                    `).join('')}
                    <div style="text-align:center;">
                        <div style="width:12px; height:12px; background:#444; border:1px solid #000; margin: 0 auto 3px;"></div>
                        <span style="font-size:5px; font-weight:bold;">M/S OUT</span>
                    </div>
                </div>
            `;
        } else if (effectType === 20) { // AutoPan/Trem
            // Stereo Tremolo (Rack verde brillante con 9 knobs y displays de velocidad)
            templateHtml = `
                <div style="display: flex; flex-direction: column; width: 95%; background:#10a174; border-radius: 4px; padding: 8px; border: 1px solid #14be8a; color: #fff; font-family: sans-serif;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <span style="font-size: 10px; font-weight: bold; letter-spacing: 1px;">Stereo Tremolo</span>
                        <span style="font-size: 8px; font-family: 'Share Tech Mono', monospace; color: #00ffcc;">SPEED: ${(pVals[0] * 5.0).toFixed(1)} Hz</span>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(9, 1fr); gap: 2px; text-align: center;">
                        ${["SPEED", "PHASE", "WAVE", "DEPTH", "ENV SPD", "ENV DPTH", "ATTACK", "HOLD", "RELEASE"].map((name, idx) => `
                            <div style="display: flex; flex-direction: column; align-items: center;">
                                <div class="knob-ring" style="width: 22px; height: 22px; margin-bottom: 2px; border-color:#fff;">
                                    <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[idx] * 270) - 135}deg); background:#fff;"></div>
                                </div>
                                <span style="font-size: 5px; color: #e0e0e0; white-space: nowrap;">${name}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else if (effectType === 21) { // NoiseGate
            // DN265 Noise Gate (Rack rojo con chasis plateado, botón de POWER y 7 knobs)
            templateHtml = `
                <div style="display: flex; align-items: center; justify-content: space-between; width: 95%; background:#a82020; border-radius: 4px; padding: 8px; border: 1px solid #c03030; color: #000; font-family: sans-serif;">
                    <div style="background:#fff; border:1px solid #444; border-radius:3px; padding: 2px 6px; text-align:center; font-weight:bold; font-size:9px; line-height:1;">DN265<br><span style="font-size:7px; color:#555;">NOISE GATE</span></div>
                    <div style="display: flex; gap: 10px; align-items: center; background: #e6e6e6; border-radius: 4px; padding: 6px; flex: 1; margin: 0 10px; justify-content: space-around;">
                        ${["MODE", "THRESHOLD", "RANGE", "ATTACK", "RELEASE", "HOLD", "PUNCH"].map((name, idx) => `
                            <div style="text-align:center;">
                                <div class="knob-ring" style="width:24px; height:24px; margin: 0 auto 3px; border-color:#000;">
                                    <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[idx] * 270) - 135}deg); background:#000;"></div>
                                </div>
                                <span style="font-size:5px; font-weight:bold; text-transform:uppercase;">${name}</span>
                            </div>
                        `).join('')}
                    </div>
                    <!-- Botón Rojo Power -->
                    <div style="text-align:center; color:#fff;">
                        <div style="width:16px; height:16px; background:#ff3300; border:1px solid #ffaa88; border-radius:2px; margin:0 auto 3px; box-shadow: 0 0 6px #ff3300;"></div>
                        <span style="font-size:5px; font-weight:bold;">POWER</span>
                    </div>
                </div>
            `;
        } else if (effectType === 22) { // Delay
            // Delay (Rack negro con pantalla verde "Stereo Feed Mode" y knobs a los lados)
            templateHtml = `
                <div style="display: flex; flex-direction: column; width: 95%; background:#1c1d22; border-radius: 4px; padding: 8px; border: 1px solid #333; color: #fff; font-family: sans-serif;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <span style="font-size: 11px; font-weight: bold; font-style: italic; letter-spacing: 1px;">Delay</span>
                        <div style="background: #00ff66; color: #000; border-radius: 2px; font-family: 'Share Tech Mono', monospace; font-size: 8px; font-weight: bold; padding: 2px 10px;">STEREO FEED MODE</div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(10, 1fr); gap: 2px; text-align: center;">
                        ${["MIX", "FEED MODE", "LO CUT", "HI CUT", "TIME", "FACTOR L", "FACTOR R", "FEED L", "FEED R", "OFFSET LR"].map((name, idx) => `
                            <div style="display: flex; flex-direction: column; align-items: center;">
                                <div class="knob-ring" style="width: 20px; height: 20px; margin-bottom: 2px;">
                                    <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[idx] * 270) - 135}deg)"></div>
                                </div>
                                <span style="font-size: 5px; color: #aaa; white-space: nowrap;">${name}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else if (effectType === 23 || effectType === 24) { // 3Tap Delay, 4Tap Delay
            // 3-Tap / 4-Tap Delay (Chasis negro con bloques independientes para Factor A, B, C y Feedback)
            const title = effectType === 23 ? "3-TAP DELAY" : "4-TAP DELAY";
            const taps = effectType === 23 ? ["PAN T", "MIX", "FACTOR A", "GAIN A", "FACTOR B", "GAIN B"] :
                                             ["FEEDBACK", "SPREAD", "FACTOR A", "GAIN A", "FACTOR B", "GAIN B", "FACTOR C", "GAIN C"];
            templateHtml = `
                <div style="display: flex; flex-direction: column; width: 95%; background:#1a1c1e; border-radius: 4px; padding: 8px; border: 1px solid #2d3033; color: #fff; font-family: sans-serif;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <span style="font-size: 10px; font-weight: bold; color: #00ccff; letter-spacing: 1px;">${title}</span>
                        <div style="display:flex; align-items:center; gap:2px; font-size:6px; color:#888;">
                            <div style="width:8px; height:8px; background:#00ccff; border-radius:1px;"></div> X-FEED
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(9, 1fr); gap: 2px; text-align: center;">
                        <div style="display: flex; flex-direction: column; align-items: center;">
                            <div class="knob-ring" style="width: 22px; height: 22px; margin-bottom: 2px; border-color:#00ccff;">
                                <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[0] * 270) - 135}deg); background:#00ccff;"></div>
                            </div>
                            <span style="font-size: 5px; color: #00ccff; white-space: nowrap;">TIME</span>
                        </div>
                        ${taps.map((name, idx) => `
                            <div style="display: flex; flex-direction: column; align-items: center;">
                                <div class="knob-ring" style="width: 20px; height: 20px; margin-bottom: 2px;">
                                    <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[1+idx] * 270) - 135}deg)"></div>
                                </div>
                                <span style="font-size: 5px; color: #aaa; white-space: nowrap;">${name}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else if (effectType === 25) { // T-RayDelay
            // Tel-Ray Variable Delay (Chasis cromado, pantalla azul celeste, 5 knobs plateados grandes)
            templateHtml = `
                <div style="display: flex; align-items: center; justify-content: space-between; width: 95%; background:#d2e5e9; border-radius: 4px; padding: 10px; border: 1px solid #b8d4dc; color: #000; font-family: sans-serif;">
                    <div style="font-size: 11px; font-weight: bold; width: 80px; letter-spacing: -0.5px; line-height: 1; text-transform: uppercase;">Tel-Ray<br><span style="font-size:7px; color:#555;">Delay</span></div>
                    <div style="display: flex; gap: 15px; align-items: center; flex: 1; justify-content: space-around;">
                        ${["Mix", "Delay", "Sustain", "Wobble", "Tone"].map((name, idx) => `
                            <div style="text-align:center;">
                                <div class="knob-ring" style="width:26px; height:26px; margin: 0 auto 3px; border-color:#000;">
                                    <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[idx] * 270) - 135}deg); background:#000;"></div>
                                </div>
                                <span style="font-size:6px; font-weight:bold; text-transform:uppercase;">${name}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else if (effectType === 31) { // Stereo Phaser
            // Stereo Phaser (Panel verde oscuro, 12 knobs)
            templateHtml = `
                <div style="display: flex; flex-direction: column; width: 95%; background:#135634; border-radius: 4px; padding: 8px; border: 1px solid #1a7245; color: #fff; font-family: sans-serif;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span style="font-size: 9px; font-weight: bold; letter-spacing: 1px;">Stereo Phaser</span>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(12, 1fr); gap: 2px; text-align: center;">
                        ${["SPEED", "DEPTH", "RESO", "BASE", "STAGES", "MIX", "WAVE", "PHASE", "ENV MOD", "ATTACK", "HOLD", "RELEASE"].map((name, idx) => `
                            <div style="display: flex; flex-direction: column; align-items: center;">
                                <div class="knob-ring" style="width: 18px; height: 18px; margin-bottom: 2px;">
                                    <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[idx] * 270) - 135}deg)"></div>
                                </div>
                                <span style="font-size: 4px; color: #e0e0e0; white-space: nowrap;">${name}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else if (effectType === 32) { // Mood Filter
            // Mood Filter (Panel negro con moldura azul celeste, 11 knobs)
            templateHtml = `
                <div style="display: flex; flex-direction: column; width: 95%; background:#1c1d20; border-radius: 4px; padding: 8px; border: 1px solid #00ccff; color: #fff; font-family: sans-serif;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span style="font-size: 9px; font-weight: bold; color: #00ccff;">mood filter</span>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(11, 1fr); gap: 2px; text-align: center;">
                        ${["SPEED", "DEPTH", "RESO", "BASE", "MODE", "MIX", "WAVE", "ENV MOD", "ATTACK", "RELEASE", "DRIVE"].map((name, idx) => `
                            <div style="display: flex; flex-direction: column; align-items: center;">
                                <div class="knob-ring" style="width: 18px; height: 18px; margin-bottom: 2px;">
                                    <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[idx] * 270) - 135}deg)"></div>
                                </div>
                                <span style="font-size: 4px; color: #aaa; white-space: nowrap;">${name}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else if (effectType === 33 || effectType === 34) { // Dual Pitch / Vintage Pitch
            // Pitch Shifters (Chasis metálico oscuro, 11 knobs con control por fila/canal)
            const title = effectType === 33 ? "DUAL PITCH" : "VINTAGE PITCH";
            templateHtml = `
                <div style="display: flex; flex-direction: column; width: 95%; background:#25272b; border-radius: 4px; padding: 8px; border: 1px solid #3d4147; color: #fff; font-family: sans-serif;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span style="font-size: 9px; font-weight: bold; letter-spacing: 1px;">${title}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(11, 1fr); gap: 2px; text-align: center;">
                        ${["HI CUT", "SEMI 1", "CENT 1", "DELAY 1", "GAIN 1", "PAN 1", "SEMI 2", "CENT 2", "DELAY 2", "GAIN 2", "PAN 2"].map((name, idx) => `
                            <div style="display: flex; flex-direction: column; align-items: center;">
                                <div class="knob-ring" style="width: 18px; height: 18px; margin-bottom: 2px;">
                                    <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[idx] * 270) - 135}deg)"></div>
                                </div>
                                <span style="font-size: 4px; color: #bbb; white-space: nowrap;">${name}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else if (effectType === 35) { // Rotary Speaker
            // Leslie Rotary Speaker (Panel de madera oscura, 6 knobs plateados, botones de SLOW/FAST)
            templateHtml = `
                <div style="display: flex; align-items: center; justify-content: space-between; width: 95%; background:#502419; border-radius: 4px; padding: 8px; border: 1px solid #6b3528; color: #fff; font-family: sans-serif;">
                    <div style="font-size: 10px; font-weight: bold; width: 70px; font-family: serif; letter-spacing: 0.5px; line-height: 1;">Rotary<br>Speaker</div>
                    <div style="display: flex; gap: 8px; align-items: center; flex: 1; justify-content: space-around; margin: 0 10px;">
                        ${["LO SPEED", "HI SPEED", "ACCEL", "DISTANCE", "BALANCE", "MIX"].map((name, idx) => `
                            <div style="text-align:center;">
                                <div class="knob-ring" style="width:20px; height:20px; margin: 0 auto 2px;">
                                    <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[idx] * 270) - 135}deg)"></div>
                                </div>
                                <span style="font-size:5px; color:#ddd; text-transform:uppercase; white-space:nowrap;">${name}</span>
                            </div>
                        `).join('')}
                    </div>
                    <!-- Botón de velocidad -->
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                        <button style="font-size: 6px; padding: 2px 4px; background: #ff5500; border: none; border-radius: 2px; color: #fff; font-weight: bold;">SLOW</button>
                        <button style="font-size: 6px; padding: 2px 4px; background: #333; border: none; border-radius: 2px; color: #aaa;">FAST</button>
                    </div>
                </div>
            `;
        } else if (effectType === 9 || effectType === 10) { // Gated Reverb / Reverse Reverb
            // Gated/Reverse Reverb (Rack negro, pantalla verde y 9 potenciómetros)
            const title = effectType === 9 ? "GATED" : "REVERSE";
            templateHtml = `
                <div style="display: flex; flex-direction: column; width: 95%; background:#161719; border-radius: 4px; padding: 10px; border: 1px solid #2d3035; color: #fff; font-family: sans-serif;">
                    <!-- Cabecera de marca con Display verde -->
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span style="font-size: 10px; font-weight: bold; color: #aaa; letter-spacing: 1px;">REVERB</span>
                        <div style="background: #00ff66; color: #000; border-radius: 2px; font-family: 'Share Tech Mono', monospace; font-size: 11px; font-weight: bold; padding: 3px 15px; box-shadow: 0 0 8px rgba(0, 255, 102, 0.6); text-transform: uppercase;">${title}</div>
                    </div>
                    <!-- Fila de Knobs -->
                    <div style="display: grid; grid-template-columns: repeat(9, 1fr); gap: 4px; text-align: center;">
                        ${["PRE DEL", "DECAY", "ATTACK", "DENSITY", "SPREAD", "LO CUT", "HI CUT", "HI S G", "DIFF"].map((name, idx) => `
                            <div style="display: flex; flex-direction: column; align-items: center;">
                                <div class="knob-ring" style="width: 26px; height: 26px; margin-bottom: 3px;">
                                    <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[idx] * 270) - 135}deg)"></div>
                                </div>
                                <span style="font-size: 6px; color: #888; font-weight: bold; white-space: nowrap;">${name}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else { // Ambience, RoomRev, HallReverb, ChamberRev, Rich Plate (Sliders con display de cian encima)
            let typeName = "AMBIENCE";
            if (effectType === 3) typeName = "ROOM REV";
            if (effectType === 5) typeName = "HALL REV";
            if (effectType === 6) typeName = "CHAMBER";
            if (effectType === 8) typeName = "RICH PLATE";

            templateHtml = `
                <div style="display: flex; flex-direction: column; width: 95%; gap: 6px;">
                    <!-- Displays superiores -->
                    <div style="display: grid; grid-template-columns: repeat(6, 1fr); text-align: center; font-family:'Share Tech Mono', monospace; color:#00ccff; font-size:10px;">
                        <div>PRE DEL<br><span style="color:#ff2200; font-size:7px;">${Math.round(pVals[0] * 100)}ms</span></div>
                        <div>DECAY<br><span style="color:#ff2200; font-size:7px;">${(pVals[1] * 4.0).toFixed(2)}s</span></div>
                        <div>SIZE<br><span style="color:#ff2200; font-size:7px;">${Math.round(pVals[2] * 10)}</span></div>
                        <div>DAMPING<br><span style="color:#ff2200; font-size:7px;">${Math.round(pVals[3] * 10)}kHz</span></div>
                        <div>DIFFUSE<br><span style="color:#ff2200; font-size:7px;">${Math.round(pVals[4] * 100)}%</span></div>
                        <div>MIX<br><span style="color:#ff2200; font-size:7px;">${Math.round(pVals[5] * 100)}%</span></div>
                    </div>
                    <!-- Faders -->
                    <div style="display: grid; grid-template-columns: repeat(6, 1fr); justify-items: center; align-items: center;">
                        ${Array(6).fill(0).map((_, idx) => `
                            <div class="ctrl-unit" data-param="fx${selectedSlot}_param${idx+1}" style="align-items: center; display: flex; flex-direction: column;">
                                <div class="v-slider" style="height: 80px;">
                                    <div class="track"></div>
                                    <div class="handle" style="top: ${(1.0 - pVals[idx]) * 64}px;"></div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        dynamicArea.innerHTML = templateHtml;

        // Configurar drag/touch en faders deslizantes
        dynamicArea.querySelectorAll('.v-slider').forEach((slider, idx) => {
            const handle = slider.querySelector('.handle');
            let isDragging = false;
            
            const updateVal = (clientY) => {
                const rect = slider.getBoundingClientRect();
                const handleHeight = 16;
                const limit = rect.height - handleHeight;
                let y = clientY - rect.top - (handleHeight / 2);
                y = Math.max(0, Math.min(limit, y));
                handle.style.top = y + 'px';

                const val = 1.0 - (y / limit);
                if (window.dualMidiBridge) {
                    window.dualMidiBridge.setParameter(`fx${selectedSlot}_param${idx+1}`, val);
                }
            };

            slider.addEventListener('mousedown', (e) => {
                isDragging = true;
                updateVal(e.clientY);
                e.preventDefault();
                e.stopPropagation();
            });

            window.addEventListener('mousemove', (e) => {
                if (isDragging) updateVal(e.clientY);
            });

            window.addEventListener('mouseup', () => {
                isDragging = false;
            });
        });

        // Configurar drag vertical en potenciómetros rotatorios (.knob-ring)
        dynamicArea.querySelectorAll('.knob-ring').forEach((knob, idx) => {
            const pointer = knob.querySelector('.knob-pointer');
            let isDragging = false;
            let startY = 0;
            let startVal = 0.5;

            // Obtener valor inicial a partir de pVals
            if (pVals && pVals[idx] !== undefined) {
                startVal = pVals[idx];
            }

            knob.addEventListener('mousedown', (e) => {
                isDragging = true;
                startY = e.clientY;
                e.preventDefault();
                e.stopPropagation();
            });

            window.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                const dy = startY - e.clientY; // drag hacia arriba incrementa
                let val = startVal + (dy / 150.0); // sensibilidad
                val = Math.max(0.0, Math.min(1.0, val));
                
                // Rotar puntero visual
                if (pointer) {
                    pointer.style.transform = `translateX(-50%) rotate(${(val * 270) - 135}deg)`;
                }

                if (window.dualMidiBridge) {
                    window.dualMidiBridge.setParameter(`fx${selectedSlot}_param${idx+1}`, val);
                }
            });

            window.addEventListener('mouseup', (e) => {
                if (isDragging) {
                    isDragging = false;
                    // Guardar nuevo valor de referencia
                    const dy = startY - e.clientY;
                    let val = startVal + (dy / 150.0);
                    startVal = Math.max(0.0, Math.min(1.0, val));
                }
            });
        });
    }

    // Registrar actualizador global
    window.syncFxModalUIFromState = () => {
        if (backdrop.style.display !== 'none') {
            syncFxModalUI();
        }
    };

    function syncFxModalUI() {
        if (typeof currentActivePatchIndex === 'undefined' || currentActivePatchIndex === -1) return;
        const activeBank = loadedBanks[currentActiveBank];
        if (!activeBank) return;
        const patch = activeBank[currentActivePatchIndex];
        if (!patch || !patch.unpackedBytes) return;

        // Mapear selectores de cada slot
        for (let i = 1; i <= 4; i++) {
            const offsetType = i === 1 ? 128 : (i === 2 ? 139 : (i === 3 ? 146 : 149));
            const typeVal = Math.round((patch.unpackedBytes[offsetType] || 0) * 35.0);
            
            const selectEl = document.querySelector(`.fx-type-select[data-slot="${i}"]`);
            if (selectEl) selectEl.value = typeVal;

            const displayEl = document.getElementById(`fx${i}-type-mini-display`);
            if (displayEl) displayEl.innerText = FX_TYPE_NAMES[typeVal];

            const offsetGain = i === 1 ? 129 : (i === 2 ? 140 : (i === 3 ? 147 : 150));
            const offsetMix = i === 1 ? 130 : (i === 2 ? 141 : (i === 3 ? 148 : 151));

            // Actualizar faders de ganancia y mezcla principales del slot
            const gainSlider = document.querySelector(`[data-param="fx${i}_gain"] .v-slider`);
            if (gainSlider) {
                const handle = gainSlider.querySelector('.handle');
                const val = (patch.unpackedBytes[offsetGain] || 255) / 255.0;
                handle.style.top = (1.0 - val) * (gainSlider.getBoundingClientRect().height - 12) + 'px';
            }

            const mixSlider = document.querySelector(`[data-param="fx${i}_mix"] .v-slider`);
            if (mixSlider) {
                const handle = mixSlider.querySelector('.handle');
                const val = (patch.unpackedBytes[offsetMix] || 128) / 255.0;
                handle.style.top = (1.0 - val) * (mixSlider.getBoundingClientRect().height - 12) + 'px';
            }
        }

        // Ruteo y modos
        const routeVal = Math.round((patch.unpackedBytes[125] || 0) * 9.0);
        if (routingSelect) routingSelect.value = routeVal;

        const modeVal = Math.round((patch.unpackedBytes[126] || 0) * 2.0);
        if (modeVal === 0 && modeIns) modeIns.click();
        if (modeVal === 1 && modeSend) modeSend.click();
        if (modeVal === 2 && modeByp) modeByp.click();

        renderActiveEffectParams();
    }
}
