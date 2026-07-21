/* --- ABDEEP MODULATION MATRIX MANAGEMENT ---
   Gestor interactivo de 8 slots de la matriz de modulación (Mod Matrix)
*/

document.addEventListener('DOMContentLoaded', () => {
    initModMatrix();
});

// Listado oficial de Modulation Sources (Manual DeepMind 12)
const MOD_SOURCES = [
    'None', 'Pitch Bend', 'Mod Wheel', 'Foot Ctrl',
    'BreathCtrl', 'Pressure', 'Expression', 'LFO 1',
    'LFO 2', 'Env 1', 'Env 2', 'Env 3',
    'Note Num', 'Note Vel', 'Note Off Vel', 'Ctrl Seq',
    'LFO 1 (Uni)', 'LFO 2 (Uni)', 'LFO 1 (Fade)', 'LFO 2 (Fade)',
    'Voice Num', 'Uni Voice', 'CC X (115)', 'CC Y (116)',
    'CC Z (117)'
];

// Listado oficial de Modulation Destinations (Manual DeepMind 12)
const MOD_DESTINATIONS = [
    'None', 'LFO1 Rate', 'LFO1 Delay', 'LFO1 Slew',
    'LFO1 Shape', 'LFO2 Rate', 'LFO2 Delay', 'LFO2 Slew',
    'LFO2 Shape', 'OSC 1+2 Pitch', 'OSC 1+2 Fine', 'OSC 1 Pitch',
    'OSC 1 Fine', 'OSC 2 Pitch', 'OSC 2 Fine', 'OSC 1 PM Dep',
    'PWM Depth', 'TMod Depth', 'OSC 2 PM Dep', 'Porta Time',
    'VCF Freq', 'VCF Res', 'VCF Env', 'VCF LFO',
    'Env Rates', 'All Attack', 'All Decay', 'All Sus',
    'All Rel', 'Env1 Rates', 'Env2 Rates', 'Env3 Rates',
    'Env1 Curves', 'Env2 Curves', 'Env3 Curves', 'Env1 Attack',
    'Env1 Decay', 'Env1 Sus', 'Env1 Rel', 'Env1 AttCur',
    'Env1 DcyCur', 'Env1 SusCur', 'Env1 RelCur', 'Env2 Attack',
    'Env2 Decay', 'Env2 Sus', 'Env2 Rel', 'Env2 AttCur',
    'Env2 DcyCur', 'Env2 SusCur', 'Env2 RelCur', 'Env3 Attack',
    'Env3 Decay', 'Env3 Sus', 'Env3 Rel', 'Env3 AttCur',
    'Env3 DcyCur', 'Env3 SusCur', 'Env3 RelCur', 'VCA All',
    'VCA Active', 'VCA EnvDep', 'Pan Spread', 'VCA Pan',
    'OSC2 Lvl', 'Noise Lvl', 'HP Freq', 'Uni Detune',
    'OSC Drift', 'Param Drift', 'Drift Rate', 'Arp Gate',
    'Seq Slew',
    // 73-80 son profundidades (mod 1-8 depth) que no se listan como destinos
    'Fx 1 Level' // ID 129
];

// Rellenar destinos hasta 129 para mantener mapeo de IDs exactos
const FULL_MOD_DESTINATIONS = [];
for (let i = 0; i <= 132; i++) {
    if (i < MOD_DESTINATIONS.length) {
        FULL_MOD_DESTINATIONS.push(MOD_DESTINATIONS[i]);
    } else if (i === 129) {
        FULL_MOD_DESTINATIONS.push('Fx 1 Level');
    } else if (i === 130) {
        FULL_MOD_DESTINATIONS.push('Fx 2 Level');
    } else if (i === 131) {
        FULL_MOD_DESTINATIONS.push('Fx 3 Level');
    } else if (i === 132) {
        FULL_MOD_DESTINATIONS.push('Fx 4 Level');
    } else {
        FULL_MOD_DESTINATIONS.push(`Dest ${i}`);
    }
}

// Source category colors
function _getSrcCategoryColor(idx) {
    if (idx === 0) {return null;}
    if (idx >= 1 && idx <= 6) {return 'var(--accent-blue)';}
    if (idx === 7 || idx === 8 || (idx >= 16 && idx <= 19)) {return 'var(--accent-teal)';}
    if (idx >= 9 && idx <= 11) {return 'var(--accent-green)';}
    if (idx >= 12 && idx <= 14) {return 'var(--color-gold)';}
    return 'var(--accent-pink)';
}
// Destination category colors
function _getDestCategoryColor(idx) {
    if (idx === 0) {return null;}
    if (idx >= 1 && idx <= 8) {return 'var(--accent-teal)';}
    if (idx >= 9 && idx <= 18) {return 'var(--accent-blue)';}
    if (idx >= 20 && idx <= 23) {return 'var(--accent-pink)';}
    if (idx >= 24 && idx <= 62) {return 'var(--accent-green)';}
    if (idx === 63 || idx === 64) {return 'var(--color-gold)';}
    return 'var(--text-dim)';
}
// Update slider fill divs from normalized depth (0-1)
function _updateSliderFill(slider, pct) {
    const posFill = slider.querySelector('.fill.pos');
    const negFill = slider.querySelector('.fill.neg');
    if (!posFill || !negFill) {return;}
    if (pct > 0.5) {
        const posWidth = ((pct - 0.5) * 2) * 100;
        posFill.style.width = posWidth.toFixed(1) + '%';
        negFill.style.width = '0';
    } else if (pct < 0.5) {
        const negWidth = ((0.5 - pct) * 2) * 100;
        negFill.style.width = negWidth.toFixed(1) + '%';
        posFill.style.width = '0';
    } else {
        posFill.style.width = '0';
        negFill.style.width = '0';
    }
}
// Apply category color to a source/dest button
function _applyButtonColor(btn, color) {
    if (color) {
        btn.style.borderColor = color;
        btn.style.color = color;
    } else {
        btn.style.borderColor = '';
        btn.style.color = '';
    }
}

function initModMatrix() {
    const modmatrixBtn = document.getElementById('programmer-mod-matrix-btn');
    const backdrop = document.getElementById('modmatrix-modal-backdrop');
    const closeBtn = document.getElementById('modmatrix-close-btn');
    const gridContainer = document.querySelector('.modmatrix-grid');

    if (!modmatrixBtn || !backdrop || !closeBtn || !gridContainer) {return;}

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

    // Canvas View Toggle
    const toggleBtns = document.querySelectorAll('.modmatrix-toggle-btn');
    const modCanvas = document.querySelector('.modmatrix-canvas');
    let modMatrixCanvas = null;
    if (modCanvas && window.ModMatrixCanvas) {
      modMatrixCanvas = new window.ModMatrixCanvas(modCanvas);
      modMatrixCanvas.setCallbacks(function(slot, mx, my) {
        const srcBtn = document.getElementById('mod-src-btn-' + (slot + 1));
        const destBtn = document.getElementById('mod-dest-btn-' + (slot + 1));
        const cx = modCanvas.width / 2;
        if (mx < cx) { if (srcBtn) {srcBtn.click();} }
        else { if (destBtn) {destBtn.click();} }
      });
      setTimeout(function() { modMatrixCanvas.resize(); }, 50);
    }
    toggleBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        const view = btn.getAttribute('data-view');
        toggleBtns.forEach(function(b) { b.classList.remove('active'); b.style.borderColor = 'var(--border)'; });
        btn.classList.add('active'); btn.style.borderColor = 'var(--accent-blue)';
        if (view === 'graph') {
          document.querySelector('.modmatrix-grid').style.display = 'none';
          modCanvas.style.display = 'block';
          if (modMatrixCanvas) { modMatrixCanvas.resize(); modMatrixCanvas.syncFromCache(window.dualMidiBridge ? window.dualMidiBridge.parameterCache : {}); }
        } else {
          document.querySelector('.modmatrix-grid').style.display = 'grid';
          modCanvas.style.display = 'none';
        }
      });
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
                <div class="modmatrix-flow-arrow" id="mod-flow-arrow-${slot}">
                    <span class="arrow-path">&#x2500;</span><span class="arrow-depth-indicator">&#x2500;</span><span class="arrow-path">&#x2500;</span><span class="arrow-path">&#x25B6;</span>
                </div>
                <div class="modmatrix-depth-row">
                    <span class="label" style="font-size: 7px; color:var(--text-dim);">DEPTH</span>
                    <div class="modmatrix-h-slider" id="mod-depth-slider-${slot}">
                        <div class="track"></div>
                        <div class="fill pos"></div>
                        <div class="fill neg"></div>
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

                    const slotNum = parseInt(slot);
                    if (isSource) {
                        _applyButtonColor(btn, selectedIdx > 0 ? _getSrcCategoryColor(selectedIdx) : null);
                    } else {
                        _applyButtonColor(btn, selectedIdx > 0 ? _getDestCategoryColor(selectedIdx) : null);
                    }

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
            _updateSliderFill(slider, pct);

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
            if (isDragging) {updateDepth(e.clientX);}
        });

        slider.addEventListener('pointerup', () => {
            isDragging = false;
        });
    }

    // Función de Sincronización al Abrir Modal o Cargar Preset
    window.syncModMatrixUIFromState = () => {
        if (!window.dualMidiBridge) {return;}
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
                            if (srcCache === undefined) {srcCache = b[srcByte] ? Math.min(1, b[srcByte] / 22.0) : 0;}
                            if (destCache === undefined) {destCache = b[destByte] ? Math.min(1, b[destByte] / 129.0) : 0;}
                            if (depthCache === undefined) {depthCache = b[depthByte] / 255.0;}
                        }
                    }
                }
            }

            // Defaults
            srcCache = srcCache || 0;
            destCache = destCache || 0;
            depthCache = (depthCache !== undefined && depthCache !== null) ? depthCache : 0.5;

            const srcIdx = Math.round(srcCache * 22.0);
            const destIdx = Math.round(destCache * 129.0);
            const isActive = srcIdx > 0;
            const bipolar = (depthCache * 2.0) - 1.0;

            // Sync Source with category color
            const srcBtn = document.getElementById(`mod-src-btn-${slot}`);
            if (srcBtn) {
                const srcName = MOD_SOURCES[srcIdx] || 'None';
                srcBtn.innerText = `Source: ${srcName}`;
                _applyButtonColor(srcBtn, isActive ? _getSrcCategoryColor(srcIdx) : null);
            }

            // Sync Dest with category color
            const destBtn = document.getElementById(`mod-dest-btn-${slot}`);
            if (destBtn) {
                const destName = FULL_MOD_DESTINATIONS[destIdx] || 'None';
                destBtn.innerText = `Dest: ${destName}`;
                _applyButtonColor(destBtn, isActive ? _getDestCategoryColor(destIdx) : null);
            }

            // Sync Depth Slider & fill
            const slider = document.getElementById(`mod-depth-slider-${slot}`);
            if (slider) {
                const handle = slider.querySelector('.handle');
                const txtVal = document.getElementById(`mod-depth-txt-${slot}`);
                if (handle && txtVal) {
                    handle.style.left = (depthCache * 100) + '%';
                    txtVal.innerText = Math.round(bipolar * 128);
                }
                _updateSliderFill(slider, depthCache);
            }

            // Flow arrow visibility
            const flowArrow = document.getElementById(`mod-flow-arrow-${slot}`);
            if (flowArrow) {
                flowArrow.classList.toggle('active', isActive);
                const depthIndicator = flowArrow.querySelector('.arrow-depth-indicator');
                if (depthIndicator) {
                    if (isActive) {
                        depthIndicator.style.color = bipolar > 0 ? 'var(--accent-green)' : (bipolar < 0 ? 'var(--accent-pink)' : 'var(--text-faint)');
                    }
                }
            }

            // Slot active state
            const slotEl = document.querySelector(`.modmatrix-slot[data-slot="${slot}"]`);
            if (slotEl) {
                slotEl.classList.toggle('active', isActive);
            }

            // Mostrar badge de activo si hay ruta activa
            const badge = document.getElementById(`mod-active-badge-${slot}`);
            if (badge) {
                badge.innerText = isActive ? 'ON' : 'OFF';
                badge.style.color = isActive ? 'var(--accent-green)' : 'var(--text-faint)';
            }
        }

        // Sync canvas if visible
        if (modMatrixCanvas) {modMatrixCanvas.syncFromCache(cache);}
    };

    // Registrar en onParameterChanged del bridge real-time updates
    if (window.dualMidiBridge) {
        window.dualMidiBridge.onParameterChanged((paramId, val) => {
            if (paramId.startsWith('mod_matrix_slot')) {
                const parts = paramId.split('_');
                const slot = parseInt(parts[2].replace('slot', ''));
                const type = parts[3];

                let idx, srcBtn, destBtn, slider, handle, txtVal;
                if (type === 'src') {
                    srcBtn = document.getElementById(`mod-src-btn-${slot}`);
                    if (srcBtn) {
                        idx = Math.round(val * 22.0);
                        srcBtn.innerText = `Source: ${MOD_SOURCES[idx] || 'None'}`;
                        _applyButtonColor(srcBtn, idx > 0 ? _getSrcCategoryColor(idx) : null);
                    }
                } else if (type === 'dest') {
                    destBtn = document.getElementById(`mod-dest-btn-${slot}`);
                    if (destBtn) {
                        idx = Math.round(val * 129.0);
                        destBtn.innerText = `Dest: ${FULL_MOD_DESTINATIONS[idx] || 'None'}`;
                        _applyButtonColor(destBtn, idx > 0 ? _getDestCategoryColor(idx) : null);
                    }
                } else if (type === 'depth') {
                    slider = document.getElementById(`mod-depth-slider-${slot}`);
                    handle = slider ? slider.querySelector('.handle') : null;
                    txtVal = document.getElementById(`mod-depth-txt-${slot}`);
                    if (handle && txtVal && slider) {
                        handle.style.left = (val * 100) + '%';
                        const bipolar = (val * 2.0) - 1.0;
                        txtVal.innerText = Math.round(bipolar * 128);
                        _updateSliderFill(slider, val);
                    }
                }
            }
        });
    }
}
