/* --- ABDEEP MODULATION MATRIX MANAGEMENT ---
   Gestor interactivo de 8 slots de la matriz de modulación (Mod Matrix)
*/

document.addEventListener('DOMContentLoaded', () => {
    initModMatrix();
});

// Listado oficial de Modulation Sources (Manual DeepMind 12)
const MOD_SOURCES = [
    "None", "Pitch Bend", "Mod Wheel", "Foot Ctrl",
    "BreathCtrl", "Pressure", "Expression", "LFO 1",
    "LFO 2", "Env 1", "Env 2", "Env 3",
    "Note Num", "Note Vel", "Note Off Vel", "Ctrl Seq",
    "LFO 1 (Uni)", "LFO 2 (Uni)", "LFO 1 (Fade)", "LFO 2 (Fade)",
    "Voice Num", "Uni Voice", "CC X (115)", "CC Y (116)",
    "CC Z (117)"
];

// Listado oficial de Modulation Destinations (Manual DeepMind 12)
const MOD_DESTINATIONS = [
    "None", "LFO1 Rate", "LFO1 Delay", "LFO1 Slew",
    "LFO1 Shape", "LFO2 Rate", "LFO2 Delay", "LFO2 Slew",
    "LFO2 Shape", "OSC 1+2 Pitch", "OSC 1+2 Fine", "OSC 1 Pitch",
    "OSC 1 Fine", "OSC 2 Pitch", "OSC 2 Fine", "OSC 1 PM Dep",
    "PWM Depth", "TMod Depth", "OSC 2 PM Dep", "Porta Time",
    "VCF Freq", "VCF Res", "VCF Env", "VCF LFO",
    "Env Rates", "All Attack", "All Decay", "All Sus",
    "All Rel", "Env1 Rates", "Env2 Rates", "Env3 Rates",
    "Env1 Curves", "Env2 Curves", "Env3 Curves", "Env1 Attack",
    "Env1 Decay", "Env1 Sus", "Env1 Rel", "Env1 AttCur",
    "Env1 DcyCur", "Env1 SusCur", "Env1 RelCur", "Env2 Attack",
    "Env2 Decay", "Env2 Sus", "Env2 Rel", "Env2 AttCur",
    "Env2 DcyCur", "Env2 SusCur", "Env2 RelCur", "Env3 Attack",
    "Env3 Decay", "Env3 Sus", "Env3 Rel", "Env3 AttCur",
    "Env3 DcyCur", "Env3 SusCur", "Env3 RelCur", "VCA All",
    "VCA Active", "VCA EnvDep", "Pan Spread", "VCA Pan",
    "OSC2 Lvl", "Noise Lvl", "HP Freq", "Uni Detune",
    "OSC Drift", "Param Drift", "Drift Rate", "Arp Gate",
    "Seq Slew",
    // 73-80 son profundidades (mod 1-8 depth) que no se listan como destinos
    "Fx 1 Level" // ID 129
];

// Rellenar destinos hasta 129 para mantener mapeo de IDs exactos
const FULL_MOD_DESTINATIONS = [];
for (let i = 0; i <= 132; i++) {
    if (i < MOD_DESTINATIONS.length) {
        FULL_MOD_DESTINATIONS.push(MOD_DESTINATIONS[i]);
    } else if (i === 129) {
        FULL_MOD_DESTINATIONS.push("Fx 1 Level");
    } else if (i === 130) {
        FULL_MOD_DESTINATIONS.push("Fx 2 Level");
    } else if (i === 131) {
        FULL_MOD_DESTINATIONS.push("Fx 3 Level");
    } else if (i === 132) {
        FULL_MOD_DESTINATIONS.push("Fx 4 Level");
    } else {
        FULL_MOD_DESTINATIONS.push(`Dest ${i}`);
    }
}

function initModMatrix() {
    const modmatrixBtn = document.getElementById('programmer-mod-matrix-btn');
    const backdrop = document.getElementById('modmatrix-modal-backdrop');
    const closeBtn = document.getElementById('modmatrix-close-btn');
    const gridContainer = document.querySelector('.modmatrix-grid');

    if (!modmatrixBtn || !backdrop || !closeBtn || !gridContainer) return;

    // Crear Dropdown flotante global reutilizable
    const dropdownList = document.createElement('div');
    dropdownList.className = 'modmatrix-dropdown-list';
    document.body.appendChild(dropdownList);

    // Ocultar dropdown al hacer click fuera
    document.addEventListener('pointerdown', (e) => {
        if (!e.target.closest('.modmatrix-selector-btn') && !e.target.closest('.modmatrix-dropdown-list')) {
            dropdownList.style.display = 'none';
        }
    });

    // Generar el HTML de los 8 Slots
    let html = '';
    for (let slot = 1; slot <= 8; slot++) {
        html += `
            <div class="modmatrix-slot" data-slot="${slot}">
                <div class="modmatrix-slot-title">Modulation Slot ${slot}</div>
                <div class="modmatrix-selector-row">
                    <button class="modmatrix-selector-btn" id="mod-src-btn-${slot}" data-type="src">Source: None</button>
                    <button class="modmatrix-selector-btn" id="mod-dest-btn-${slot}" data-type="dest">Dest: None</button>
                </div>
                <div class="modmatrix-depth-row">
                    <span class="label" style="font-size: 7px; color:var(--text-dim);">DEPTH</span>
                    <div class="modmatrix-h-slider" id="mod-depth-slider-${slot}">
                        <div class="track"></div>
                        <div class="handle" style="left: 50%;"></div>
                    </div>
                    <div class="modmatrix-depth-value" id="mod-depth-txt-${slot}">0</div>
                </div>
                <div class="modmatrix-slot-info" style="display:flex;justify-content:space-between;margin-top:2px;gap:4px">
                    <span style="font-size:var(--text-2xs);color:var(--text-faint)">NRPN: ${93+(slot-1)*3}/${94+(slot-1)*3}/${95+(slot-1)*3}</span>
                    <span class="mod-slot-active-badge" id="mod-active-badge-${slot}" style="font-size:var(--text-2xs);color:var(--text-faint)">OFF</span>
                </div>
            </div>
        `;
    }
    gridContainer.innerHTML = html;

    // Abrir Modal
    modmatrixBtn.addEventListener('click', () => {
        backdrop.style.display = 'flex';
        syncModMatrixUIFromState();
    });

    // Cerrar Modal
    closeBtn.addEventListener('click', () => {
        backdrop.style.display = 'none';
    });

    // Manejar Click en Botones Source/Dest (Desplegar Dropdown)
    gridContainer.querySelectorAll('.modmatrix-selector-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const rect = btn.getBoundingClientRect();
            const isSource = btn.getAttribute('data-type') === 'src';
            const slot = btn.closest('.modmatrix-slot').getAttribute('data-slot');

            dropdownList.style.top = (rect.bottom + window.scrollY) + 'px';
            dropdownList.style.left = (rect.left + window.scrollX) + 'px';
            dropdownList.style.width = rect.width + 'px';
            dropdownList.style.display = 'block';

            const items = isSource ? MOD_SOURCES : FULL_MOD_DESTINATIONS;
            let listHtml = '';
            items.forEach((itemText, index) => {
                listHtml += `<div class="modmatrix-dropdown-item" data-index="${index}">${itemText}</div>`;
            });
            dropdownList.innerHTML = listHtml;

            // Manejar selección del item
            dropdownList.querySelectorAll('.modmatrix-dropdown-item').forEach(item => {
                item.addEventListener('click', () => {
                    const selectedIdx = parseInt(item.getAttribute('data-index'));
                    const selectedText = item.innerText;
                    btn.innerText = (isSource ? 'Source: ' : 'Dest: ') + selectedText;
                    dropdownList.style.display = 'none';

                    const paramId = isSource ? `mod_matrix_slot${slot}_src` : `mod_matrix_slot${slot}_dest`;
                    const maxVal = isSource ? 22.0 : 129.0; // manual: src 0-22, dest 0-129

                    if (window.dualMidiBridge) {
                        window.dualMidiBridge.setParameter(paramId, selectedIdx / maxVal);
                    }
                });
            });
        });
    });

    // Configurar los 8 Sliders Horizontales de Profundidad (Bipolar: -1.0 a 1.0)
    for (let slot = 1; slot <= 8; slot++) {
        const slider = document.getElementById(`mod-depth-slider-${slot}`);
        const handle = slider.querySelector('.handle');
        const txtVal = document.getElementById(`mod-depth-txt-${slot}`);

        let isDragging = false;

        const updateDepth = (clientX) => {
            const rect = slider.getBoundingClientRect();
            let pct = (clientX - rect.left) / rect.width;
            pct = Math.max(0, Math.min(1, pct)); // 0.0 a 1.0

            handle.style.left = (pct * 100) + '%';

            // Convertir a valor bipolar (-1.0 a 1.0)
            const bipolarVal = (pct * 2.0) - 1.0;
            // Escalar a rango entero del sintetizador (-128 a 127)
            const scaledInt = Math.round(bipolarVal * 128);
            txtVal.innerText = scaledInt;

            const paramId = `mod_matrix_slot${slot}_depth`;
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter(paramId, pct); // 0-1 normalizado
            }
        };

        slider.addEventListener('pointerdown', (e) => {
            isDragging = true;
            slider.setPointerCapture(e.pointerId);
            updateDepth(e.clientX);
        });

        slider.addEventListener('pointermove', (e) => {
            if (isDragging) updateDepth(e.clientX);
        });

        slider.addEventListener('pointerup', () => {
            isDragging = false;
        });
    }

    // Función de Sincronización al Abrir Modal o Cargar Preset
    window.syncModMatrixUIFromState = () => {
        if (!window.dualMidiBridge) return;
        const cache = window.dualMidiBridge.parameterCache;

        for (let slot = 1; slot <= 8; slot++) {
            // Leer desde cache (o desde bytes de preset activo como fallback)
            // Offsets correctos del manual: src=93+(slot-1)*3, dest=94+(slot-1)*3, depth=95+(slot-1)*3
            let srcCache = cache[`mod_matrix_slot${slot}_src`];
            let destCache = cache[`mod_matrix_slot${slot}_dest`];
            let depthCache = cache[`mod_matrix_slot${slot}_depth`];

            // Fallback: leer bytes directos del preset activo
            if (srcCache === undefined || destCache === undefined || depthCache === undefined) {
                if (typeof currentActivePatchIndex !== 'undefined' && currentActivePatchIndex !== -1) {
                    const activeBank = loadedBanks[currentActiveBank];
                    if (activeBank) {
                        const patch = activeBank[currentActivePatchIndex];
                        if (patch && patch.unpackedBytes) {
                            const b = patch.unpackedBytes;
                            const srcByte = 93 + (slot - 1) * 3;
                            const destByte = 94 + (slot - 1) * 3;
                            const depthByte = 95 + (slot - 1) * 3;
                            if (srcCache === undefined) srcCache = b[srcByte] ? Math.min(1, b[srcByte] / 22.0) : 0;
                            if (destCache === undefined) destCache = b[destByte] ? Math.min(1, b[destByte] / 129.0) : 0;
                            if (depthCache === undefined) depthCache = b[depthByte] / 255.0;
                        }
                    }
                }
            }

            // Defaults
            srcCache = srcCache || 0;
            destCache = destCache || 0;
            depthCache = (depthCache !== undefined && depthCache !== null) ? depthCache : 0.5;

            // Sync Source
            const srcBtn = document.getElementById(`mod-src-btn-${slot}`);
            if (srcBtn) {
                const srcIdx = Math.round(srcCache * 22.0);
                const srcName = MOD_SOURCES[srcIdx] || "None";
                srcBtn.innerText = `Source: ${srcName}`;
            }

            // Sync Dest
            const destBtn = document.getElementById(`mod-dest-btn-${slot}`);
            if (destBtn) {
                const destIdx = Math.round(destCache * 129.0);
                const destName = FULL_MOD_DESTINATIONS[destIdx] || "None";
                destBtn.innerText = `Dest: ${destName}`;
            }

            // Sync Depth Slider
            const slider = document.getElementById(`mod-depth-slider-${slot}`);
            const handle = slider.querySelector('.handle');
            const txtVal = document.getElementById(`mod-depth-txt-${slot}`);
            if (slider && handle && txtVal) {
                handle.style.left = (depthCache * 100) + '%';
                const bipolar = (depthCache * 2.0) - 1.0;
                txtVal.innerText = Math.round(bipolar * 128);
            }

            // Mostrar badge de activo si hay ruta activa
            const badge = document.getElementById(`mod-active-badge-${slot}`);
            if (badge) {
                const srcIdx = Math.round(srcCache * 22.0);
                const isActive = srcIdx > 0;
                badge.innerText = isActive ? 'ON' : 'OFF';
                badge.style.color = isActive ? 'var(--accent-green)' : 'var(--text-faint)';
            }
        }
    };

    // Registrar en onParameterChanged del bridge real-time updates
    if (window.dualMidiBridge) {
        window.dualMidiBridge.onParameterChanged((paramId, val) => {
            if (paramId.startsWith("mod_matrix_slot")) {
                const parts = paramId.split("_");
                const slot = parseInt(parts[2].replace("slot", ""));
                const type = parts[3];

                if (type === "src") {
                    const srcBtn = document.getElementById(`mod-src-btn-${slot}`);
                    if (srcBtn) {
                        const idx = Math.round(val * 22.0); // manual: src 0-22
                        srcBtn.innerText = `Source: ${MOD_SOURCES[idx] || "None"}`;
                    }
                } else if (type === "dest") {
                    const destBtn = document.getElementById(`mod-dest-btn-${slot}`);
                    if (destBtn) {
                        const idx = Math.round(val * 129.0); // manual: dest 0-129
                        destBtn.innerText = `Dest: ${FULL_MOD_DESTINATIONS[idx] || "None"}`;
                    }
                } else if (type === "depth") {
                    const slider = document.getElementById(`mod-depth-slider-${slot}`);
                    const handle = slider ? slider.querySelector('.handle') : null;
                    const txtVal = document.getElementById(`mod-depth-txt-${slot}`);
                    if (handle && txtVal) {
                        handle.style.left = (val * 100) + '%';
                        const bipolar = (val * 2.0) - 1.0;
                        txtVal.innerText = Math.round(bipolar * 128);
                    }
                }
            }
        });
    }
}
