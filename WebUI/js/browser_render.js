/**
 * @purpose Renderizado de patches y bancos (hardware + local), navegación y swap.
 * Extraído de browser.js como parte de la modularización.
 */

// ── Global State ──
const loadedBanks = {};
window.loadedBanks = loadedBanks;
const _initActiveBank = 'Factory Bank A';
window.currentActiveBank = _initActiveBank;
const _initActivePatchIdx = 0;
window.currentActivePatchIndex = _initActivePatchIdx;

// Note: currentActiveBank and currentActivePatchIndex are modified via window.*
// by initBankManager() in browser.js. Always read from window.currentActiveBank
// and window.currentActivePatchIndex instead of local aliases.

const hardwareBanks = {
    'A': window.createEmptyBank(),
    'B': window.createEmptyBank(),
    'C': window.createEmptyBank(),
    'D': window.createEmptyBank(),
    'E': window.createEmptyBank(),
    'F': window.createEmptyBank(),
    'G': window.createEmptyBank(),
    'H': window.createEmptyBank()
};
window.hardwareBanks = hardwareBanks;

window.currentHwBankLetter = 'A';
window.currentHwPatchIndex = -1;

// Note: currentHwBankLetter and currentHwPatchIndex are modified via window.*
// by initBankManager() in browser.js. Always read from window.currentHwBankLetter
// and window.currentHwPatchIndex instead of local aliases.

const FACTORY_BANKS_LIST = [
    'Factory Bank A', 'Factory Bank B', 'Factory Bank C', 'Factory Bank D',
    'Factory Bank E', 'Factory Bank F', 'Factory Bank G', 'Factory Bank H'
];
window.FACTORY_BANKS_LIST = FACTORY_BANKS_LIST;

// ── Dropdown Update ──
function updateLocalBanksDropdown() {
    const select = document.getElementById('local-bank-select');
    if (!select) {return;}
    select.innerHTML = '';
    Object.keys(loadedBanks).forEach(bankName => {
        const opt = document.createElement('option');
        opt.value = bankName;
        opt.innerText = bankName;
        if (bankName === window.currentActiveBank) {opt.selected = true;}
        select.appendChild(opt);
    });
}
window.updateLocalBanksDropdown = updateLocalBanksDropdown;

// ── Local Patch Grid ──
function renderPatchesForBank(bankName, searchTerm) {
    const grid = document.getElementById('browser-patches-grid');
    if (!grid) {return;}
    grid.innerHTML = '';

    const patches = loadedBanks[bankName] || [];
    const searchFilter = searchTerm ? searchTerm.toLowerCase().trim() : '';
    const categoryFilter = (typeof window._currentCategoryFilter !== 'undefined' && window._currentCategoryFilter !== '')
        ? window._currentCategoryFilter : null;
    const isGridView = window._browserViewMode === 'grid';

    grid.style.gridTemplateColumns = isGridView ? 'repeat(3, 1fr)' : '1fr';

    let visibleCount = 0;

    const _currentPatchIdx = window.currentActivePatchIndex;
    const _currentBank = window.currentActiveBank;

    for (let patchIdx = 0; patchIdx < 128; patchIdx++) {
        const patch = patches[patchIdx] || { name: '[Empty Slot ' + (patchIdx + 1) + ']', unpackedBytes: null, meta: null };

        if (searchFilter && !patch.name.toLowerCase().includes(searchFilter)) {continue;}
        if (categoryFilter && (!patch.meta || patch.meta.category !== categoryFilter)) {continue;}
        visibleCount++;

        const el = document.createElement('div');
        el.className = 'patch-item';
        el.draggable = true;
        if (patchIdx === _currentPatchIdx && bankName === _currentBank) {el.classList.add('active');}

        const isFactory = FACTORY_BANKS_LIST.includes(bankName);
        const labelText = (patchIdx + 1).toString().padStart(3, '0') + ': ' + patch.name;

        const isFav = patch.meta && patch.meta.favorite;
        const starPrefix = isFav ? '<span class="color-star mr-4">★</span>' : '';
        const patchAnalysis = (typeof window.inspectPatchAdvancedFeatures === 'function') ? window.inspectPatchAdvancedFeatures(patch) : { isAdvanced: false };
        const proBadge = patchAnalysis.isAdvanced ? '<span class="cat-badge shrink-0 mr-4" style="background:color-mix(in srgb,var(--accent-red,#ff4d4d) 20%,transparent);border-color:var(--accent-red,#ff4d4d);color:var(--accent-red,#ff4d4d);font-weight:bold" title="Pro Exclusive Patch (AbyssMind Pro)">PRO</span>' : '';

        let htmlContent = `<span class=\"patch-name-text text-ellipsis\" style=\"font-weight:${isGridView ? 'bold' : 'normal'}\">${starPrefix}${proBadge}${labelText}</span>`;
        if (!isGridView && patch.meta && patch.meta.category) {
            htmlContent += ` <span class=\"cat-badge shrink-0 mr-6\">${patch.meta.category}</span>`;
        }

        htmlContent += '<div class=\"patch-actions-group flex-row gap-3 items-center ml-auto shrink-0\">';
        htmlContent += '<button class=\"patch-action-btn primary load-btn\" title=\"Load patch to editor\">▶</button>';
        if (!isFactory) {
            if (!isGridView) {
                htmlContent += '<button class=\"patch-action-btn secondary rename-btn\" title=\"Rename patch\">✏️</button>';
            }
            htmlContent += '<button class=\"patch-action-btn teal paste-btn\" title=\"Paste SysEx to this patch\">📋</button>';
        }
        htmlContent += '<button class=\"patch-action-btn dim menu-btn\" title=\"More options\">⋮</button>';
        htmlContent += '</div>';

        el.innerHTML = htmlContent;
        el.classList.add('browser-list-item');

        el.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', JSON.stringify({ source: 'local', bank: bankName, index: patchIdx }));
        });

        el.addEventListener('dragover', (e) => e.preventDefault());
        el.addEventListener('drop', (e) => {
            e.preventDefault();
            if (isFactory) {alert('No está permitido modificar bancos de fábrica.'); return;}
            const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
            swapPresets(dragData, { source: 'local', bank: bankName, index: patchIdx });
        });

        el.addEventListener('click', (e) => {
            const loadBtn = e.target.closest('.load-btn') || e.target.closest('.primary');
            const renameBtn = e.target.closest('.rename-btn') || e.target.closest('.secondary');
            const pasteBtn = e.target.closest('.paste-btn') || e.target.closest('.teal');
            const menuBtn = e.target.closest('.menu-btn') || e.target.closest('.dim');

            if (loadBtn) {
                window.currentActiveBank = bankName;
                window.currentActivePatchIndex = patchIdx;
                document.querySelectorAll('#browser-patches-grid .patch-item').forEach(p => p.classList.remove('active'));
                el.classList.add('active');

                if (patch && patch.unpackedBytes && typeof window.triggerMidiDump === 'function') {
                    window.triggerMidiDump(patch);
                    const lcdText = document.getElementById('lcd-text');
                    if (lcdText) {
                        lcdText.innerHTML = `<span class=\"lcd-label\">LOADED FROM LIBRARY</span><br><strong>${patch.name.toUpperCase()}</strong>`;
                    }
                    const modal = document.getElementById('browser-modal-backdrop');
                    if (modal) {modal.style.display = 'none';}
                }
            } else if (renameBtn) {
                if (isFactory) {return alert('No está permitido renombrar presets de fábrica.');}
                window.showRenameModal(patch, (newName) => {
                    patch.name = newName;
                    if (!patch.unpackedBytes) {patch.unpackedBytes = new Uint8Array(242);}
                    for (let k = 0; k < 15; k++) {
                        patch.unpackedBytes[224 + k] = k < patch.name.length ? patch.name.charCodeAt(k) : 0x20;
                    }
                    renderPatchesForBank(window.currentActiveBank);
                    if (typeof window._saveUserBanksToStorage === 'function') {window._saveUserBanksToStorage();}
                });
            } else if (pasteBtn) {
                if (isFactory) {return alert('No está permitido pegar en bancos de fábrica.');}
                if (typeof window.pasteSysexFromClipboard === 'function') {
                    window.pasteSysexFromClipboard(bankName, patchIdx);
                }
            } else if (menuBtn) {
                window.showPatchContextMenu(e, bankName, patchIdx, 'local');
            }
        });

        el.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            window.currentActiveBank = bankName;
            window.currentActivePatchIndex = patchIdx;
            window.showPatchContextMenu(e, bankName, patchIdx, 'local');
        });

        grid.appendChild(el);
    }

    if (visibleCount === 0 && (searchFilter || categoryFilter)) {
        const emptyMsg = searchFilter ? 'No patches match \"' + searchTerm + '\"' : 'No patches in this category';
        grid.innerHTML = '<div class=\"empty-state-msg\">🔍 ' + emptyMsg + '</div>';
    }
}
window.renderPatchesForBank = renderPatchesForBank;

// ── Preset Swap (drag & drop) ──
function swapPresets(src, dest) {
    let srcPatch, destPatch;

    if (src.source === 'hw') { srcPatch = hardwareBanks[src.bank][src.index]; }
    else { srcPatch = loadedBanks[src.bank][src.index]; }

    if (dest.source === 'hw') { destPatch = hardwareBanks[dest.bank][dest.index]; }
    else { destPatch = loadedBanks[dest.bank][dest.index]; }

    const tempBytes = new Uint8Array(destPatch.unpackedBytes);
    const tempName = destPatch.name;

    destPatch.unpackedBytes = new Uint8Array(srcPatch.unpackedBytes);
    destPatch.name = srcPatch.name;

    srcPatch.unpackedBytes = tempBytes;
    srcPatch.name = tempName;

    renderHardwarePatches();
    renderPatchesForBank(window.currentActiveBank);
    if (src.source !== 'hw' || dest.source !== 'hw') {
        if (typeof window._saveUserBanksToStorage === 'function') {window._saveUserBanksToStorage();}
    }
}
window.swapPresets = swapPresets;

// ── Patch Navigation ──
function navigatePatch(direction) {
    const bank = loadedBanks[window.currentActiveBank];
    if (!bank) {return;}
    let newIdx = window.currentActivePatchIndex + direction;
    if (newIdx < 0) {newIdx = 127;}
    if (newIdx > 127) {newIdx = 0;}
    window.currentActivePatchIndex = newIdx;
    const patch = bank[newIdx];
    if (patch && patch.unpackedBytes) {
        if (typeof window.triggerMidiDump === 'function') {window.triggerMidiDump(patch);}
        const items = document.querySelectorAll('#browser-patches-grid .patch-item');
        items.forEach((el, i) => el.classList.toggle('active', i === newIdx));
    }
}
window.navigatePatch = navigatePatch;
