/**
 * @purpose Renderiza la cuadrícula de patches hardware (8 bancos × 128 slots) con drag & drop.
 * @purpose_en Hardware patch grid renderer with drag-and-drop swap.
 */

/**
 * Render the hardware patch grid (128 slots) with drag-and-drop, click-to-load, context menu.
 * Reads state from window.currentHwBankLetter and window.currentHwPatchIndex.
 */
function renderHardwarePatches() {
    const grid = document.getElementById('hw-patches-grid');
    if (!grid) {return;}
    grid.innerHTML = '';

    const hwBankLetter = window.currentHwBankLetter;
    const hwPatchIdx = window.currentHwPatchIndex;
    const patches = window.hardwareBanks[hwBankLetter] || [];
    for (let i = 0; i < 128; i++) {
        const patch = patches[i] || { name: '[Empty Slot ' + (i + 1) + ']', unpackedBytes: null };
const el = document.createElement('div');
        el.className = 'patch-item';
        el.draggable = true;
        if (i === hwPatchIdx) {el.classList.add('active');}
        // Fase 3 (§4.1): patch.name es dato externo (dump hardware) → escapar antes de innerHTML
        const labelText = hwBankLetter + '-' + (i + 1).toString().padStart(3, '0') + ': ' + escapeHtml(patch.name);

        let htmlContent = '<span class=\"patch-name-text text-ellipsis\">' + labelText + '</span>';
        htmlContent += '<div class=\"patch-actions-group flex-row gap-3 items-center ml-auto shrink-0\">';
        htmlContent += '<button class=\"patch-action-btn primary\" title=\"Load patch to editor\">\u25b6</button>';
        htmlContent += '<button class=\"patch-action-btn dim\" title=\"More options\">\u22ee</button>';
        htmlContent += '</div>';

        el.innerHTML = htmlContent;
        el.classList.add('browser-list-item');

        el.addEventListener('dragstart', function(e, idx) {
            return function() {
                e.dataTransfer.setData('text/plain', JSON.stringify({ source: 'hw', bank: window.currentHwBankLetter, index: idx }));
            };
        }(i));

        el.addEventListener('dragover', function(e) { e.preventDefault(); });
        el.addEventListener('drop', function(e, idx) {
            return function(ev) {
                ev.preventDefault();
                const dragData = JSON.parse(ev.dataTransfer.getData('text/plain'));
                if (typeof window.swapPresets === 'function') {
                    window.swapPresets(dragData, { source: 'hw', bank: window.currentHwBankLetter, index: idx });
                }
            };
        }(i));

        el.addEventListener('click', function(e, idx, patchRef) {
            return function(ev) {
                const target = ev.target;
                const loadBtn = target.classList.contains('primary') || target.closest('.primary') || target.closest('.load-btn');
                const menuBtn = target.classList.contains('dim') || target.closest('.dim') || target.closest('.menu-btn');

                if (loadBtn) {
                    window.currentHwPatchIndex = idx;
                    document.querySelectorAll('#hw-patches-grid .patch-item').forEach(function(p) { p.classList.remove('active'); });
                    el.classList.add('active');

                    if (patchRef && patchRef.unpackedBytes && typeof window.triggerMidiDump === 'function') {
                        window.triggerMidiDump(patchRef);
                        const lcdText = document.getElementById('lcd-text');
                        if (lcdText) {
                            lcdText.innerHTML = '<span class=\"lcd-label\">HW PATCH LOADED</span><br><strong>' + escapeHtml(patchRef.name).toUpperCase() + '</strong>';
                        }
                        const modal = document.getElementById('browser-modal-backdrop');
                        if (modal) {modal.style.display = 'none';}
                    }
                } else if (menuBtn) {
                    if (typeof window.showPatchContextMenu === 'function') {
                        window.showPatchContextMenu(ev, window.currentHwBankLetter, idx, 'hw');
                    }
                } else {
                    document.querySelectorAll('#hw-patches-grid .patch-item').forEach(function(p) { p.classList.remove('selected'); });
                    el.classList.add('selected');
                }
            };
        }(i, patch));

        el.addEventListener('dblclick', function(e, idx, patchRef) {
            return function() {
                window.currentHwPatchIndex = idx;
                document.querySelectorAll('#hw-patches-grid .patch-item').forEach(function(p) { p.classList.remove('active'); });
                el.classList.add('active');

                if (patchRef && patchRef.unpackedBytes && typeof window.triggerMidiDump === 'function') {
                    window.triggerMidiDump(patchRef);
                    const lcdText = document.getElementById('lcd-text');
                    if (lcdText) {
                        lcdText.innerHTML = '<span class=\"lcd-label\">HW PATCH LOADED</span><br><strong>' + escapeHtml(patchRef.name).toUpperCase() + '</strong>';
                    }
                    const modal = document.getElementById('browser-modal-backdrop');
                    if (modal) {modal.style.display = 'none';}
                }
            };
        }(i, patch));

        el.addEventListener('contextmenu', function(e, idx) {
            return function(ev) {
                ev.preventDefault();
                window.currentHwPatchIndex = idx;
                if (typeof window.showPatchContextMenu === 'function') {
                    window.showPatchContextMenu(ev, window.currentHwBankLetter, idx, 'hw');
                }
            };
        }(i));

        grid.appendChild(el);
    }
}
window.renderHardwarePatches = renderHardwarePatches;
