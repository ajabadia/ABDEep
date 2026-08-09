/* --- ABDEEP MODULATION MATRIX MANAGEMENT ---
   Gestor interactivo de 8/32 slots de la matriz de modulación (Mod Matrix)
   Depends on: modmatrix_data.js (loaded first)
   UI sync: modmatrix_sync.js (loaded after)
*/

document.addEventListener('DOMContentLoaded', () => {
    initModMatrix();
});

function initModMatrix() {
    // Inicializar modo por defecto en 'advanced' (AbyssMind Pro) si no está configurado
    if (typeof window !== 'undefined') {
        window.appMode = window.appMode || localStorage.getItem('abd-eep-app-mode') || 'advanced';
    }

    const modmatrixBtn = document.getElementById('programmer-mod-matrix-btn');
    const backdrop = document.getElementById('modmatrix-modal-backdrop');
    const closeBtn = document.getElementById('modmatrix-close-btn');
    const gridContainer = document.querySelector('.modmatrix-grid');
    const blockTabsContainer = document.getElementById('mod-block-tabs');
    const compactBtn = document.getElementById('mod-compact-btn');

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
    const modMatrixCanvas = modCanvas && window.ModMatrixCanvas ? new window.ModMatrixCanvas(modCanvas) : null;

    window._modMatrixCanvasForSync = modMatrixCanvas;

    if (modMatrixCanvas) {
        modMatrixCanvas.setCallbacks(function(slot, mx, _my) {
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
                if (blockTabsContainer) { blockTabsContainer.style.display = 'none'; }
                modCanvas.style.display = 'block';
                if (modMatrixCanvas) { modMatrixCanvas.resize(); modMatrixCanvas.syncFromCache(window.dualMidiBridge ? window.dualMidiBridge.parameterCache : {}); }
            } else {
                document.querySelector('.modmatrix-grid').style.display = 'grid';
                if (blockTabsContainer && window.appMode !== 'standard') { blockTabsContainer.style.display = 'flex'; }
                modCanvas.style.display = 'none';
            }
        });
    });

    // Generar el HTML de los 32 Slots (8 en Standard, 32 en Pro)
    let html = '';
    const totalSlots = 32;
    for (let slot = 1; slot <= totalSlots; slot++) {
        const nrpnInfo = slot <= 8 ? `${93+(slot-1)*3}/${94+(slot-1)*3}/${95+(slot-1)*3}` : `EXT-${slot}`;
        html += `
            <div class="modmatrix-slot" data-slot="${slot}" style="${slot > 8 ? 'display:none;' : ''}">
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
                    <span style="font-size:var(--text-2xs);color:var(--text-faint)">NRPN: ${nrpnInfo}</span>
                    <span class="mod-slot-active-badge" id="mod-active-badge-${slot}" style="font-size:var(--text-2xs);color:var(--text-faint)">OFF</span>
                </div>
            </div>
        `;
    }
    gridContainer.innerHTML = html;

    // Manejo de Bloques de Pestañas (AbyssMind Pro)
    function _updateBlockVisibility(activeBlock) {
        const isAdvanced = (window.appMode !== 'standard');
        if (blockTabsContainer) {
            blockTabsContainer.style.display = isAdvanced ? 'flex' : 'none';
        }
        const banner = document.getElementById('mod-block-banner');
        if (banner) {
            banner.style.display = isAdvanced ? 'flex' : 'none';
            const minSlot = (activeBlock - 1) * 8 + 1;
            const maxSlot = activeBlock * 8;
            const titleSpan = banner.querySelector('span');
            if (titleSpan) {
                titleSpan.innerHTML = `🔷 <strong>BLOCK ${activeBlock}</strong> (SLOTS ${minSlot} TO ${maxSlot})`;
            }
        }
        gridContainer.querySelectorAll('.modmatrix-slot').forEach(slotEl => {
            const slotNum = parseInt(slotEl.dataset.slot);
            if (!isAdvanced) {
                slotEl.style.display = slotNum <= 8 ? 'block' : 'none';
            } else {
                const minSlot = (activeBlock - 1) * 8 + 1;
                const maxSlot = activeBlock * 8;
                slotEl.style.display = (slotNum >= minSlot && slotNum <= maxSlot) ? 'block' : 'none';
            }
        });
    }

    let _currentBlock = 1;
    document.querySelectorAll('.mod-block-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.mod-block-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            _currentBlock = parseInt(tab.dataset.block);
            _updateBlockVisibility(_currentBlock);
        });
    });

    // Botón Compactar
    if (compactBtn) {
        compactBtn.addEventListener('click', () => {
            if (typeof window.compactModMatrix === 'function') {
                const activeCount = window.compactModMatrix(window.deepmindState || (window.dualMidiBridge ? window.dualMidiBridge.parameterCache : {}));
                if (typeof window.syncModMatrixUIFromState === 'function') {
                    window.syncModMatrixUIFromState();
                }
                const lcdUpdate = window.lcdSafeUpdate || function() {};
                lcdUpdate(`MODMATRIX COMPACTED (${activeCount} ACTIVE)`);
            }
        });
    }

    // Abrir Modal
    modmatrixBtn.addEventListener('click', () => {
        backdrop.style.display = 'flex';
        _updateBlockVisibility(_currentBlock);
        if (typeof window.syncModMatrixUIFromState === 'function') {
            window.syncModMatrixUIFromState();
        }
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

            const items = isSource ? window.MOD_SOURCES : window.FULL_MOD_DESTINATIONS;
            let listHtml = '';
            items.forEach((itemText, index) => {
                listHtml += `<div class="modmatrix-dropdown-item" data-index="${index}">${itemText}</div>`;
            });
            dropdownList.innerHTML = listHtml;

            dropdownList.querySelectorAll('.modmatrix-dropdown-item').forEach(item => {
                item.addEventListener('click', () => {
                    const selectedIdx = parseInt(item.getAttribute('data-index'));
                    const selectedText = item.innerText;
                    btn.innerText = (isSource ? 'Source: ' : 'Dest: ') + selectedText;
                    dropdownList.style.display = 'none';

                    if (isSource) {
                        window.applyButtonColor(btn, selectedIdx > 0 ? window.getSrcCategoryColor(selectedIdx) : null);
                    } else {
                        window.applyButtonColor(btn, selectedIdx > 0 ? window.getDestCategoryColor(selectedIdx) : null);
                    }

                    const paramId = isSource ? `mod_matrix_slot${slot}_src` : `mod_matrix_slot${slot}_dest`;
                    const maxVal = isSource ? 22.0 : 129.0;

                    if (window.dualMidiBridge) {
                        window.dualMidiBridge.setParameter(paramId, selectedIdx / maxVal);
                    }
                });
            });
        });
    });

    // Configurar los 32 Sliders Horizontales de Profundidad (Bipolar: -1.0 a 1.0)
    for (let slot = 1; slot <= totalSlots; slot++) {
        const slider = document.getElementById(`mod-depth-slider-${slot}`);
        if (!slider) {continue;}
        const handle = slider.querySelector('.handle');
        const txtVal = document.getElementById(`mod-depth-txt-${slot}`);

        let isDragging = false;

        const updateDepth = (clientX) => {
            const rect = slider.getBoundingClientRect();
            let pct = (clientX - rect.left) / rect.width;
            pct = Math.max(0, Math.min(1, pct));

            handle.style.left = (pct * 100) + '%';
            window.updateSliderFill(slider, pct);

            const bipolarVal = (pct * 2.0) - 1.0;
            const scaledInt = Math.round(bipolarVal * 128);
            txtVal.innerText = scaledInt;

            const paramId = `mod_matrix_slot${slot}_depth`;
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter(paramId, pct);
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
}
