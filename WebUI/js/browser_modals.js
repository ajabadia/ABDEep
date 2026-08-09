/**
 * @purpose Menús contextuales de patches, modal de renombrar y selector de categoría.
 * Templates HTML extraídas a browser_modals_templates.js.
 * Extraído de browser.js como parte de la modularización.
 */

// ── Context Menu ──
function showPatchContextMenu(e, bankName, idx, source) {
    const oldMenu = document.querySelector('.patch-context-menu');
    if (oldMenu) {oldMenu.remove();}

    const patch = (source === 'hw')
        ? (window.hardwareBanks[bankName] ? window.hardwareBanks[bankName][idx] : null)
        : (window.loadedBanks[bankName] ? window.loadedBanks[bankName][idx] : null);
    if (!patch) {return;}

    // Usar template para contenedor + título (event wiring se hace por separado)
    const wrapper = document.createElement('div');
    wrapper.innerHTML = window._buildCtxMenuHtml(patch.name, e.clientX, e.clientY);
    const menu = wrapper.firstElementChild;

    const analysis = (typeof window.inspectPatchAdvancedFeatures === 'function') ? window.inspectPatchAdvancedFeatures(patch) : { isAdvanced: false };

    if (analysis.isAdvanced) {
        const proWrapper = document.createElement('div');
        proWrapper.innerHTML = window._buildProNoticeHtml();
        menu.appendChild(proWrapper.firstElementChild);

        menu.appendChild(_createContextMenuItem('💾 Export .json (AbyssMind Pro)', function() {
            if (typeof window.exportSinglePatchJson === 'function') {
                window.exportSinglePatchJson(patch, (idx + 1).toString().padStart(3, '0') + '_' + patch.name.replace(/[^a-zA-Z0-9_\-]/g, '_') + '.abyss.json');
            }
            menu.remove();
        }));

        menu.appendChild(_createContextMenuItem('🔄 Convert & Export .syx (Classic DM12)', function() {
            if (typeof window.convertPatchToClassicDM12 === 'function' && typeof window.exportSinglePatch === 'function') {
                const classic = window.convertPatchToClassicDM12(patch);
                window.exportSinglePatch(classic, (idx + 1).toString().padStart(3, '0') + '_' + patch.name.replace(/[^a-zA-Z0-9_\-]/g, '_') + '_classic.syx', false);
            }
            menu.remove();
        }));
    } else {
        menu.appendChild(_createContextMenuItem('Export .syx (Classic DM12)', function() {
            if (typeof window.exportSinglePatch === 'function') {
                window.exportSinglePatch(patch, (idx + 1).toString().padStart(3, '0') + '_' + patch.name.replace(/[^a-zA-Z0-9_\-]/g, '_') + '.syx', false);
            }
            menu.remove();
        }));
    }

    if (source === 'hw') {
        menu.appendChild(_createContextMenuItem('Load to Editor', function() {
            if (typeof window.triggerMidiDump === 'function') {window.triggerMidiDump(patch);}
            menu.remove();
        }));
    }

    if (source === 'local' && !window.FACTORY_BANKS_LIST.includes(bankName)) {
        menu.appendChild(_createContextMenuItem('📋 Paste SysEx from Clipboard', function() {
            menu.remove();
            if (typeof window.pasteSysexFromClipboard === 'function') {
                window.pasteSysexFromClipboard(bankName, idx);
            }
        }));

        menu.appendChild(_createContextMenuItem('Rename...', function() {
            menu.remove();
            showRenameModal(patch, (newName) => {
                patch.name = newName;
                if (!patch.unpackedBytes) {patch.unpackedBytes = new Uint8Array(242);}
                for (let k = 0; k < 16; k++) {
                    patch.unpackedBytes[223 + k] = k < patch.name.length ? patch.name.charCodeAt(k) : 0x20;
                }
                window.renderPatchesForBank(window.currentActiveBank);
                if (typeof window._saveUserBanksToStorage === 'function') {window._saveUserBanksToStorage();}
            });
        }));

        menu.appendChild(_createContextMenuItem('Set Category ▸', function() {
            menu.remove();
            showCategoryPicker(patch, bankName, idx);
        }));
    }

    if (source === 'local' && !window.FACTORY_BANKS_LIST.includes(bankName)) {
        const isFav = patch.meta && patch.meta.favorite;
        menu.appendChild(_createContextMenuItem(isFav ? '★ Unfavorite' : '☆ Favorite', function() {
            if (!patch.meta) {patch.meta = window.createDefaultMeta();}
            patch.meta.favorite = !patch.meta.favorite;
            window.renderPatchesForBank(window.currentActiveBank);
            if (typeof window._saveUserBanksToStorage === 'function') {window._saveUserBanksToStorage();}
            menu.remove();
        }));
    }

    document.body.appendChild(menu);

    const closeMenu = function(ev) {
        if (!menu.contains(ev.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };
    setTimeout(function() { document.addEventListener('click', closeMenu); }, 0);
}
window.showPatchContextMenu = showPatchContextMenu;

function _createContextMenuItem(text, callback) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = window._buildCtxMenuItemHtml(text);
    const item = wrapper.firstElementChild;
    item.addEventListener('click', callback);
    return item;
}

// ── Rename Modal ──
function showRenameModal(patch, onSave) {
    const backdrop = document.getElementById('rename-patch-modal-backdrop');
    const input = document.getElementById('rename-patch-input');
    const closeBtn = document.getElementById('rename-patch-close-btn');
    const cancelBtn = document.getElementById('rename-patch-btn-cancel');
    const saveBtn = document.getElementById('rename-patch-btn-save');

    if (!backdrop || !input) {
        const legacyName = prompt('New patch name:', patch.name);
        if (legacyName && legacyName.trim()) { onSave(legacyName.trim()); }
        return;
    }

    input.value = patch.name || '';
    backdrop.style.display = 'flex';
    setTimeout(() => { input.focus(); input.select(); }, 50);

    const closeModal = () => { backdrop.style.display = 'none'; };
    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;
    saveBtn.onclick = () => {
        const val = input.value.trim();
        if (val) { onSave(val); }
        closeModal();
    };

    input.onkeydown = (e) => {
        if (e.key === 'Enter') {
            const val = input.value.trim();
            if (val) { onSave(val); }
            closeModal();
        } else if (e.key === 'Escape') {
            closeModal();
        }
    };
}
window.showRenameModal = showRenameModal;

// ── Category Picker ──
function showCategoryPicker(patch) {
    const CATEGORIES = ['None', 'Bass', 'Lead', 'Pad', 'FX', 'Keys', 'Perc', 'Synth', 'Other'];
    const current = patch.meta && patch.meta.category ? patch.meta.category : 'None';

    const backdrop = document.getElementById('category-picker-modal-backdrop');
    const optionsContainer = document.getElementById('cat-picker-options');
    const closeBtn = document.getElementById('cat-picker-close-btn');
    const cancelBtn = document.getElementById('cat-picker-btn-cancel');

    if (!backdrop || !optionsContainer) {
        let promptMsg = 'Set category for "' + patch.name + '":\n\n';
        CATEGORIES.forEach(function(c, i) {
            const marker = c === current ? ' ●' : '';
            promptMsg += (i + 1) + '. ' + c + marker + '\n';
        });
        promptMsg += '\nEnter number (1-' + CATEGORIES.length + ') or leave empty:';
        const choice = prompt(promptMsg);
        if (choice === null) {return;}
        const num = parseInt(choice, 10);
        if (isNaN(num) || num < 1 || num > CATEGORIES.length) {return;}
        if (!patch.meta) {patch.meta = window.createDefaultMeta();}
        patch.meta.category = CATEGORIES[num - 1] === 'None' ? '' : CATEGORIES[num - 1];
        window.renderPatchesForBank(window.currentActiveBank);
        if (typeof window._saveUserBanksToStorage === 'function') {window._saveUserBanksToStorage();}
        return;
    }

    // Usar template HTML para botones de categoría (event wiring por separado)
    optionsContainer.innerHTML = CATEGORIES.map(function(cat) {
        const isActive = cat === current || (cat === 'None' && !current);
        return window._buildCatPickerBtnHtml(cat, isActive);
    }).join('');

    // Wire events on all category buttons
    const catButtons = optionsContainer.querySelectorAll('.cat-picker-btn');
    catButtons.forEach(function(btn, i) {
        btn.onclick = function() {
            const cat = CATEGORIES[i];
            if (!patch.meta) {patch.meta = window.createDefaultMeta();}
            patch.meta.category = cat === 'None' ? '' : cat;
            window.renderPatchesForBank(window.currentActiveBank);
            if (typeof window._saveUserBanksToStorage === 'function') {window._saveUserBanksToStorage();}
            backdrop.style.display = 'none';
        };
    });

    backdrop.style.display = 'flex';
    const closeModal = () => { backdrop.style.display = 'none'; };
    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;
}
window.showCategoryPicker = showCategoryPicker;
