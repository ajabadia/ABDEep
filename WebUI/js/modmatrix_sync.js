/* --- ABDEEP MODULATION MATRIX SYNC ---
   UI sync from parameter cache + real-time bridge updates for the Mod Matrix.
   Extracted from modmatrix.js — depends on modmatrix_data.js globals.
   The canvas reference is set by modmatrix.js as window._modMatrixCanvasForSync.
*/

(function() {
    // ── Full UI Sync from Parameter Cache or Bank Fallback ─────
    window.syncModMatrixUIFromState = function() {
        if (!window.dualMidiBridge) {return;}
        const cache = window.dualMidiBridge.parameterCache;

        const maxSlots = 32;
        for (let slot = 1; slot <= maxSlots; slot++) {
            let srcCache = cache['mod_matrix_slot' + slot + '_src'];
            let destCache = cache['mod_matrix_slot' + slot + '_dest'];
            let depthCache = cache['mod_matrix_slot' + slot + '_depth'];

            // Fallback: leer bytes directos del preset activo
            if (srcCache === undefined || destCache === undefined || depthCache === undefined) {
                if (typeof currentActivePatchIndex !== 'undefined' && currentActivePatchIndex !== -1) {
                    const activeBank = loadedBanks[currentActiveBank];
                    if (activeBank) {
                        const patch = activeBank[currentActivePatchIndex];
                        if (patch && patch.unpackedBytes) {
                            const b = patch.unpackedBytes;
                            if (slot <= 8) {
                                const srcByte = 93 + (slot - 1) * 3;
                                const destByte = 94 + (slot - 1) * 3;
                                const depthByte = 95 + (slot - 1) * 3;
                                if (srcCache === undefined) {srcCache = b[srcByte] ? Math.min(1, b[srcByte] / 22.0) : 0;}
                                if (destCache === undefined) {destCache = b[destByte] ? Math.min(1, b[destByte] / 129.0) : 0;}
                                if (depthCache === undefined) {depthCache = b[depthByte] / 255.0;}
                            } else {
                                // Para slots 9-32 (no existen en la trama SysEx canónica de 242 bytes),
                                // si el preset tiene params estructurados (patch.params), leer de allí;
                                // de lo contrario, deben estar limpios por defecto (src=0, dest=0, depth=0.5).
                                const params = patch.params || patch.parameterState || {};
                                if (srcCache === undefined) { srcCache = params['mod_matrix_slot' + slot + '_src'] || 0; }
                                if (destCache === undefined) { destCache = params['mod_matrix_slot' + slot + '_dest'] || 0; }
                                if (depthCache === undefined) { depthCache = params['mod_matrix_slot' + slot + '_depth'] !== undefined ? params['mod_matrix_slot' + slot + '_depth'] : 0.5; }
                            }
                        }
                    }
                }
            }

            srcCache = srcCache || 0;
            destCache = destCache || 0;
            depthCache = (depthCache !== undefined && depthCache !== null) ? depthCache : 0.5;

            const srcIdx = Math.round(srcCache * 22.0);
            const destIdx = Math.round(destCache * 129.0);
            const isActive = srcIdx > 0;
            const bipolar = (depthCache * 2.0) - 1.0;

            // Sync Source with category color
            const srcBtn = document.getElementById('mod-src-btn-' + slot);
            if (srcBtn) {
                const srcName = window.MOD_SOURCES[srcIdx] || 'None';
                srcBtn.innerText = 'Source: ' + srcName;
                window.applyButtonColor(srcBtn, isActive ? window.getSrcCategoryColor(srcIdx) : null);
            }

            // Sync Dest with category color
            const destBtn = document.getElementById('mod-dest-btn-' + slot);
            if (destBtn) {
                const destName = window.FULL_MOD_DESTINATIONS[destIdx] || 'None';
                destBtn.innerText = 'Dest: ' + destName;
                window.applyButtonColor(destBtn, isActive ? window.getDestCategoryColor(destIdx) : null);
            }

            // Sync Depth Slider & fill
            const slider = document.getElementById('mod-depth-slider-' + slot);
            if (slider) {
                const handle = slider.querySelector('.handle');
                const txtVal = document.getElementById('mod-depth-txt-' + slot);
                if (handle && txtVal) {
                    handle.style.left = (depthCache * 100) + '%';
                    txtVal.innerText = Math.round(bipolar * 128);
                }
                window.updateSliderFill(slider, depthCache);
            }

            // Flow arrow visibility
            const flowArrow = document.getElementById('mod-flow-arrow-' + slot);
            if (flowArrow) {
                flowArrow.classList.toggle('active', isActive);
                const depthIndicator = flowArrow.querySelector('.arrow-depth-indicator');
                if (depthIndicator && isActive) {
                    depthIndicator.style.color = bipolar > 0 ? 'var(--accent-green)' : (bipolar < 0 ? 'var(--accent-pink)' : 'var(--text-faint)');
                }
            }

            // Slot active state
            const slotEl = document.querySelector('.modmatrix-slot[data-slot="' + slot + '"]');
            if (slotEl) {
                slotEl.classList.toggle('active', isActive);
            }

            // Mostrar badge de activo
            const badge = document.getElementById('mod-active-badge-' + slot);
            if (badge) {
                badge.innerText = isActive ? 'ON' : 'OFF';
                badge.style.color = isActive ? 'var(--accent-green)' : 'var(--text-faint)';
            }
        }

        // Sync canvas if visible (canvas stored by modmatrix.js at init time)
        const modMatrixCanvas = window._modMatrixCanvasForSync;
        if (modMatrixCanvas) {modMatrixCanvas.syncFromCache(cache);}
    };

    // ── Bridge onParameterChanged — Real-time updates ─────────
    if (window.dualMidiBridge) {
        window.dualMidiBridge.onParameterChanged(function(paramId, val) {
            if (!paramId.startsWith('mod_matrix_slot')) {return;}
            const parts = paramId.split('_');
            const slot = parseInt(parts[2].replace('slot', ''));
            const type = parts[3];

            if (type === 'src') {
                const srcBtn = document.getElementById('mod-src-btn-' + slot);
                if (srcBtn) {
                    const idx = Math.round(val * 22.0);
                    srcBtn.innerText = 'Source: ' + (window.MOD_SOURCES[idx] || 'None');
                    window.applyButtonColor(srcBtn, idx > 0 ? window.getSrcCategoryColor(idx) : null);
                }
            } else if (type === 'dest') {
                const destBtn = document.getElementById('mod-dest-btn-' + slot);
                if (destBtn) {
                    const idx = Math.round(val * 129.0);
                    destBtn.innerText = 'Dest: ' + (window.FULL_MOD_DESTINATIONS[idx] || 'None');
                    window.applyButtonColor(destBtn, idx > 0 ? window.getDestCategoryColor(idx) : null);
                }
            } else if (type === 'depth') {
                const slider = document.getElementById('mod-depth-slider-' + slot);
                const handle = slider ? slider.querySelector('.handle') : null;
                const txtVal = document.getElementById('mod-depth-txt-' + slot);
                if (handle && txtVal && slider) {
                    handle.style.left = (val * 100) + '%';
                    const bipolar = (val * 2.0) - 1.0;
                    txtVal.innerText = Math.round(bipolar * 128);
                    window.updateSliderFill(slider, val);
                }
            }
        });
    }
})();
