// --- ABDEEP PRESET & BANK MANAGER DUAL-CONTAINER LOGIC ---
// Este archivo gestiona la persistencia, creación, renombrado y borrado de bancos dinámicos de presets de 128 slots.
// Ofrece dos paneles: Izquierdo (Hardware Device, Bank A-H) y Derecho (Librería Local).
// Permite copiar y arrastrar/intercambiar presets entre ambos entornos.

const loadedBanks = {};
window.loadedBanks = loadedBanks;
let currentActiveBank = 'Factory Bank A';
window.currentActiveBank = currentActiveBank;
let currentActivePatchIndex = 0;
window.currentActivePatchIndex = currentActivePatchIndex;

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

let currentHwBankLetter = 'A';
window.currentHwBankLetter = currentHwBankLetter;
let currentHwPatchIndex = -1;
window.currentHwPatchIndex = currentHwPatchIndex;

const FACTORY_BANKS_LIST = [
    'Factory Bank A', 'Factory Bank B', 'Factory Bank C', 'Factory Bank D',
    'Factory Bank E', 'Factory Bank F', 'Factory Bank G', 'Factory Bank H'
];

document.addEventListener('DOMContentLoaded', () => {
    initBankManager();
});

function updateLocalBanksDropdown() {
    const select = document.getElementById('local-bank-select');
    if (!select) {return;}
    select.innerHTML = '';
    Object.keys(loadedBanks).forEach(bankName => {
        const opt = document.createElement('option');
        opt.value = bankName;
        opt.innerText = bankName;
        if (bankName === currentActiveBank) {opt.selected = true;}
        select.appendChild(opt);
    });
}
window.updateLocalBanksDropdown = updateLocalBanksDropdown;

function renderHardwarePatches() {
    const grid = document.getElementById('hw-patches-grid');
    if (!grid) {return;}
    grid.innerHTML = '';

    const patches = hardwareBanks[currentHwBankLetter] || [];
    for (let i = 0; i < 128; i++) {
        const patch = patches[i] || { name: `[Empty Slot ${i+1}]`, unpackedBytes: null };
        const el = document.createElement('div');
        el.className = 'patch-item';
        el.draggable = true;
        if (i === currentHwPatchIndex) {el.classList.add('active');}
        el.innerText = `${currentHwBankLetter}-${(i+1).toString().padStart(3, '0')}: ${patch.name}`;

        el.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', JSON.stringify({ source: 'hw', bank: currentHwBankLetter, index: i }));
        });

        el.addEventListener('dragover', (e) => e.preventDefault());
        el.addEventListener('drop', (e) => {
            e.preventDefault();
            const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
            swapPresets(dragData, { source: 'hw', bank: currentHwBankLetter, index: i });
        });

        el.addEventListener('click', () => {
            currentHwPatchIndex = i;
            window.currentHwPatchIndex = i;
            document.querySelectorAll('#hw-patches-grid .patch-item').forEach(p => p.classList.remove('active'));
            el.classList.add('active');
        });

        el.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            showPatchContextMenu(e, currentHwBankLetter, i, 'hw');
        });

        grid.appendChild(el);
    }
}
window.renderHardwarePatches = renderHardwarePatches;

function showPatchContextMenu(e, bankName, idx, source) {
    const oldMenu = document.querySelector('.patch-context-menu');
    if (oldMenu) {oldMenu.remove();}
    
    const patch = (source === 'hw')
        ? hardwareBanks[bankName][idx]
        : loadedBanks[bankName][idx];
    if (!patch || !patch.unpackedBytes) {return;}
    
    const menu = document.createElement('div');
    menu.className = 'patch-context-menu';
    menu.style.cssText = 'position:fixed;z-index:10000;background:var(--bg-elevated,#1a1a1a);border:1px solid var(--border-dim,#333);border-radius:4px;padding:4px 0;min-width:160px;box-shadow:0 4px 20px rgba(0,0,0,0.6);font-size:11px;font-family:sans-serif;';
    menu.style.left = Math.min(e.clientX, window.innerWidth - 180) + 'px';
    menu.style.top = Math.min(e.clientY, window.innerHeight - 120) + 'px';
    
    const title = document.createElement('div');
    title.style.cssText = 'padding:4px 10px;color:var(--text-dim,#888);font-size:9px;border-bottom:1px solid var(--border-dim,#333);margin-bottom:2px;text-transform:uppercase;letter-spacing:0.5px;';
    title.textContent = patch.name;
    menu.appendChild(title);
    
    const exportItem = _createContextMenuItem('Export .syx', function() {
        if (typeof window.exportSinglePatch === 'function') {
            window.exportSinglePatch(patch, (idx + 1).toString().padStart(3, '0') + '_' + patch.name.replace(/[^a-zA-Z0-9_\-]/g, '_') + '.syx');
        }
        menu.remove();
    });
    menu.appendChild(exportItem);
    
    if (source === 'hw') {
        const loadItem = _createContextMenuItem('Load to Editor', function() {
            if (typeof window.triggerMidiDump === 'function') {window.triggerMidiDump(patch);}
            menu.remove();
        });
        menu.appendChild(loadItem);
    }
    
    if (source === 'local' && !FACTORY_BANKS_LIST.includes(bankName)) {
        const renameItem = _createContextMenuItem('Rename...', function() {
            const newName = prompt('New name:', patch.name);
            if (newName && newName.trim()) {
                patch.name = newName.trim();
                for (let k = 0; k < 15; k++) {
                    patch.unpackedBytes[224 + k] = k < patch.name.length ? patch.name.charCodeAt(k) : 0x20;
                }
                renderPatchesForBank(currentActiveBank);
                if (typeof window._saveUserBanksToStorage === 'function') {window._saveUserBanksToStorage();}
            }
            menu.remove();
        });
        menu.appendChild(renameItem);
        
        const catItem = _createContextMenuItem('Set Category ▸', function() {
            menu.remove();
            showCategoryPicker(patch, bankName, idx);
        });
        menu.appendChild(catItem);
    }

    if (source === 'local' && !FACTORY_BANKS_LIST.includes(bankName)) {
        const isFav = patch.meta && patch.meta.favorite;
        const favItem = _createContextMenuItem(isFav ? '★ Unfavorite' : '☆ Favorite', function() {
            if (!patch.meta) {patch.meta = window.createDefaultMeta();}
            patch.meta.favorite = !patch.meta.favorite;
            renderPatchesForBank(currentActiveBank);
            if (typeof window._saveUserBanksToStorage === 'function') {window._saveUserBanksToStorage();}
            menu.remove();
        });
        menu.appendChild(favItem);
    }
    
    document.body.appendChild(menu);
    
    const closeMenu = function(ev) {
        if (!menu.contains(ev.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };
    setTimeout(function() {
        document.addEventListener('click', closeMenu);
    }, 0);
}

function _createContextMenuItem(text, callback) {
    const item = document.createElement('div');
    item.style.cssText = 'padding:6px 10px;cursor:pointer;color:var(--text-primary,#ddd);transition:background 0.1s;';
    item.textContent = text;
    item.addEventListener('mouseenter', function() {
        item.style.background = 'color-mix(in srgb,var(--accent-primary,#ff9900) 20%,transparent)';
    });
    item.addEventListener('mouseleave', function() {
        item.style.background = 'transparent';
    });
    item.addEventListener('click', callback);
    return item;
}

function showCategoryPicker(patch) {
    const CATEGORIES = ['', 'Bass', 'Lead', 'Pad', 'FX', 'Keys', 'Perc', 'Synth', 'Other'];
    const current = patch.meta && patch.meta.category ? patch.meta.category : '';
    
    let promptMsg = 'Set category for "' + patch.name + '":\n\n';
    CATEGORIES.forEach(function(c, i) {
        const marker = c === current ? ' ●' : '';
        promptMsg += (i + 1) + '. ' + c + marker + '\n';
    });
    promptMsg += '\nEnter number (1-' + CATEGORIES.length + ') or leave empty to cancel:';
    
    const choice = prompt(promptMsg);
    if (choice === null) {return;}
    const num = parseInt(choice, 10);
    if (isNaN(num) || num < 1 || num > CATEGORIES.length) {return;}
    
    if (!patch.meta) {patch.meta = window.createDefaultMeta();}
    patch.meta.category = CATEGORIES[num - 1];
    renderPatchesForBank(currentActiveBank);
    if (typeof window._saveUserBanksToStorage === 'function') {window._saveUserBanksToStorage();}
}

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

    for (var i = 0; i < 128; i++) {
        var patch = patches[i] || { name: '[Empty Slot ' + (i + 1) + ']', unpackedBytes: null, meta: null };
        
        if (searchFilter && !patch.name.toLowerCase().includes(searchFilter)) {
            continue;
        }
        if (categoryFilter && (!patch.meta || patch.meta.category !== categoryFilter)) {
            continue;
        }
        visibleCount++;
        
        var el = document.createElement('div');
        el.className = 'patch-item';
        el.draggable = true;
        if (i === currentActivePatchIndex && bankName === currentActiveBank) {el.classList.add('active');}
        
        const label = (i + 1).toString().padStart(3, '0') + ': ' + patch.name;
        if (patch.meta && patch.meta.category) {
            el.innerHTML = label + ' <span class="cat-badge">' + patch.meta.category + '</span>';
        } else {
            el.innerText = label;
        }

        el.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', JSON.stringify({ source: 'local', bank: bankName, index: i }));
        });

        el.addEventListener('dragover', (e) => e.preventDefault());
        el.addEventListener('drop', (e) => {
            e.preventDefault();
            if (FACTORY_BANKS_LIST.includes(bankName)) {
                alert('No está permitido modificar bancos de fábrica.');
                return;
            }
            const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
            swapPresets(dragData, { source: 'local', bank: bankName, index: i });
        });

        el.addEventListener('click', () => {
            currentActivePatchIndex = i;
            window.currentActivePatchIndex = i;
            document.querySelectorAll('#browser-patches-grid .patch-item').forEach(p => p.classList.remove('active'));
            el.classList.add('active');
        });

        el.addEventListener('dblclick', () => {
            if (FACTORY_BANKS_LIST.includes(bankName)) {
                alert('No está permitido modificar presets de fábrica.');
                return;
            }
            const newName = prompt('Escribe el nuevo nombre del preset:', patch.name);
            if (newName && newName.trim() !== '') {
                patch.name = newName.trim();
                for (let k = 0; k < 15; k++) {
                    patch.unpackedBytes[224 + k] = k < patch.name.length ? patch.name.charCodeAt(k) : 0x20;
                }
                el.innerText = `${(i+1).toString().padStart(3, '0')}: ${patch.name}`;
                if (typeof window._saveUserBanksToStorage === 'function') {
                    window._saveUserBanksToStorage();
                }
            }
        });

        el.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            showPatchContextMenu(e, bankName, i, 'local');
        });

        grid.appendChild(el);
    }

    if (visibleCount === 0 && (searchFilter || categoryFilter)) {
        const emptyMsg = searchFilter ? 'No patches match "' + searchTerm + '"' : 'No patches in this category';
        grid.innerHTML = '<div class="text-dim text-center" style="padding:30px;font-size:var(--text-md)">\uD83D\uDD0D ' + emptyMsg + '</div>';
    }
}
window.renderPatchesForBank = renderPatchesForBank;

function swapPresets(src, dest) {
    let srcPatch, destPatch;
    
    if (src.source === 'hw') {
        srcPatch = hardwareBanks[src.bank][src.index];
    } else {
        srcPatch = loadedBanks[src.bank][src.index];
    }

    if (dest.source === 'hw') {
        destPatch = hardwareBanks[dest.bank][dest.index];
    } else {
        destPatch = loadedBanks[dest.bank][dest.index];
    }

    const tempBytes = new Uint8Array(destPatch.unpackedBytes);
    const tempName = destPatch.name;

    destPatch.unpackedBytes = new Uint8Array(srcPatch.unpackedBytes);
    destPatch.name = srcPatch.name;

    srcPatch.unpackedBytes = tempBytes;
    srcPatch.name = tempName;

    renderHardwarePatches();
    renderPatchesForBank(currentActiveBank);
    if (src.source !== 'hw' || dest.source !== 'hw') {
        if (typeof window._saveUserBanksToStorage === 'function') {window._saveUserBanksToStorage();}
    }
}

function navigatePatch(direction) {
    const bank = loadedBanks[currentActiveBank];
    if (!bank) {return;}
    let newIdx = currentActivePatchIndex + direction;
    if (newIdx < 0) {newIdx = 127;}
    if (newIdx > 127) {newIdx = 0;}
    currentActivePatchIndex = newIdx;
    window.currentActivePatchIndex = newIdx;
    const patch = bank[newIdx];
    if (patch && patch.unpackedBytes) {
        if (typeof window.triggerMidiDump === 'function') {window.triggerMidiDump(patch);}
        const items = document.querySelectorAll('#browser-patches-grid .patch-item');
        items.forEach((el, i) => el.classList.toggle('active', i === newIdx));
    }
}
window.navigatePatch = navigatePatch;

function initBankManager() {
    if (typeof window.loadAllFactoryBanksNatively === 'function') {
        window.loadAllFactoryBanksNatively();
    }

    const browserModal = document.getElementById('browser-modal-backdrop');
    
    const showBrowser = () => {
        if (browserModal) {
            browserModal.style.display = 'flex';
            updateLocalBanksDropdown();
            renderPatchesForBank(currentActiveBank);
            renderHardwarePatches();
        }
    };
    
    document.addEventListener('click', (e) => {
        if (e.target.closest('#menu-bank-manager')) {
            e.preventDefault();
            showBrowser();
        }
    });

    const progMngrBtn = document.getElementById('programmer-bank-mngr-btn');
    if (progMngrBtn) {progMngrBtn.addEventListener('click', showBrowser);}

    const closeBtn = document.getElementById('browser-close-btn');
    if (closeBtn) {closeBtn.addEventListener('click', () => browserModal.style.display = 'none');}

    const patchUpBtn = document.getElementById('programmer-patch-up-btn');
    if (patchUpBtn) {patchUpBtn.addEventListener('click', () => {
        if (typeof window.playKeyLedAnimation === 'function') {window.playKeyLedAnimation('patch-up');}
        navigatePatch(-1);
    });}
    const patchDownBtn = document.getElementById('programmer-patch-down-btn');
    if (patchDownBtn) {patchDownBtn.addEventListener('click', () => {
        if (typeof window.playKeyLedAnimation === 'function') {window.playKeyLedAnimation('patch-down');}
        navigatePatch(+1);
    });}

    window._currentCategoryFilter = '';
    window._browserViewMode = 'list';

    const localSelect = document.getElementById('local-bank-select');
    if (localSelect) {
        localSelect.addEventListener('change', function(e) {
            currentActiveBank = e.target.value;
            window.currentActiveBank = currentActiveBank;
            const searchInput = document.getElementById('browser-search-input');
            if (searchInput) {searchInput.value = '';}
            renderPatchesForBank(currentActiveBank);
        });
    }
    
    const searchInput = document.getElementById('browser-search-input');
    const searchClear = document.getElementById('browser-search-clear');
    
    function applySearch() {
        const term = searchInput ? searchInput.value : '';
        renderPatchesForBank(currentActiveBank, term);
    }
    
    if (searchInput) {
        searchInput.addEventListener('input', applySearch);
    }
    if (searchClear) {
        searchClear.addEventListener('click', function() {
            if (searchInput) {searchInput.value = '';}
            applySearch();
            if (searchInput) {searchInput.focus();}
        });
    }

    const catFilters = document.querySelectorAll('.cat-filter');
    catFilters.forEach(function(el) {
        el.addEventListener('click', function() {
            const cat = this.getAttribute('data-cat');
            window._currentCategoryFilter = cat;
            catFilters.forEach(function(c) { c.classList.remove('active'); });
            this.classList.add('active');
            renderPatchesForBank(currentActiveBank, searchInput ? searchInput.value : '');
        });
    });

    const viewToggle = document.getElementById('browser-view-toggle');
    if (viewToggle) {
        viewToggle.addEventListener('click', function() {
            if (window._browserViewMode === 'list') {
                window._browserViewMode = 'grid';
                this.textContent = '☰';
                this.title = 'Switch to list view';
            } else {
                window._browserViewMode = 'list';
                this.textContent = '⊞';
                this.title = 'Switch to grid view';
            }
            renderPatchesForBank(currentActiveBank, searchInput ? searchInput.value : '');
        });
    }

    const hwLetters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    hwLetters.forEach(l => {
        const btn = document.getElementById(`hw-bank-${l}-btn`);
        if (btn) {
            btn.addEventListener('click', () => {
                currentHwBankLetter = l.toUpperCase();
                window.currentHwBankLetter = currentHwBankLetter;
                document.querySelectorAll('.manager-btn').forEach(b => {
                    if (b.id.startsWith('hw-bank-')) {b.style.background = 'var(--bg-hover)';}
                });
                btn.style.background = 'var(--brand-accent)';
                renderHardwarePatches();
            });
        }
    });

    const createBankBtn = document.getElementById('mngr-create-bank');
    if (createBankBtn) {
        createBankBtn.addEventListener('click', () => {
            const name = prompt('Escribe el nombre del nuevo banco local:', `User Bank ${Object.keys(loadedBanks).length - 7}`);
            if (!name || name.trim() === '' || loadedBanks[name]) {return;}
            loadedBanks[name] = window.createEmptyBank();
            currentActiveBank = name;
            window.currentActiveBank = name;
            updateLocalBanksDropdown();
            renderPatchesForBank(currentActiveBank);
            if (typeof window._saveUserBanksToStorage === 'function') {window._saveUserBanksToStorage();}
        });
    }

    const renameBankBtn = document.getElementById('mngr-rename-bank');
    if (renameBankBtn) {
        renameBankBtn.addEventListener('click', () => {
            if (FACTORY_BANKS_LIST.includes(currentActiveBank)) {return alert('No se pueden renombrar bancos de fábrica.');}
            const newName = prompt(`Escribe el nuevo nombre para "${currentActiveBank}":`, currentActiveBank);
            if (!newName || newName.trim() === '' || loadedBanks[newName]) {return;}
            loadedBanks[newName] = loadedBanks[currentActiveBank];
            delete loadedBanks[currentActiveBank];
            currentActiveBank = newName;
            window.currentActiveBank = currentActiveBank;
            updateLocalBanksDropdown();
            renderPatchesForBank(currentActiveBank);
            if (typeof window._saveUserBanksToStorage === 'function') {window._saveUserBanksToStorage();}
        });
    }

    const deleteBankBtn = document.getElementById('mngr-delete-bank');
    if (deleteBankBtn) {
        deleteBankBtn.addEventListener('click', () => {
            if (FACTORY_BANKS_LIST.includes(currentActiveBank)) {return alert('No se pueden borrar bancos de fábrica.');}
            if (confirm(`¿Borrar banco local "${currentActiveBank}"?`)) {
                delete loadedBanks[currentActiveBank];
                currentActiveBank = Object.keys(loadedBanks)[0];
                window.currentActiveBank = currentActiveBank;
                updateLocalBanksDropdown();
                renderPatchesForBank(currentActiveBank);
                if (typeof window._saveUserBanksToStorage === 'function') {window._saveUserBanksToStorage();}
            }
        });
    }

    // Botones de exportación de patch individual en la barra de herramientas local
    const localToolbar = document.querySelector('.dual-bank-panel:last-child .flex-row.border-bottom');
    if (localToolbar && !document.getElementById('local-export-patch-btn')) {
        const exportPatchBtn = document.createElement('button');
        exportPatchBtn.id = 'local-export-patch-btn';
        exportPatchBtn.className = 'manager-btn';
        exportPatchBtn.style.cssText = 'background:color-mix(in srgb,var(--accent-green) 15%,transparent);border-color:var(--accent-green);color:var(--accent-green);font-size:9px';
        exportPatchBtn.setAttribute('data-ctrl-tooltip', 'Export current patch as standalone SysEx file (.syx)');
        exportPatchBtn.textContent = 'Export Patch';
        exportPatchBtn.addEventListener('click', function() {
            const bank = loadedBanks[currentActiveBank];
            if (!bank || currentActivePatchIndex < 0) {
                alert('Select a patch first.');
                return;
            }
            const patch = bank[currentActivePatchIndex];
            if (typeof window.exportSinglePatch === 'function') {
                window.exportSinglePatch(patch, (currentActivePatchIndex+1).toString().padStart(3,'0') + '_' + patch.name.replace(/[^a-zA-Z0-9_\-]/g, '_') + '.syx');
            }
        });
        localToolbar.appendChild(exportPatchBtn);
    }

    function _initSysexDropZone() {
        const modal = document.getElementById('browser-modal-backdrop');
        if (!modal) {return;}
        
        modal.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.stopPropagation();
            modal.style.outline = '2px dashed var(--accent-primary, #ff9900)';
            modal.style.outlineOffset = '-10px';
        });
        
        modal.addEventListener('dragleave', function(e) {
            e.preventDefault();
            e.stopPropagation();
            modal.style.outline = '';
            modal.style.outlineOffset = '';
        });
        
        modal.addEventListener('drop', function(e) {
            e.preventDefault();
            e.stopPropagation();
            modal.style.outline = '';
            modal.style.outlineOffset = '';
            
            const files = e.dataTransfer.files;
            if (!files || files.length === 0) {return;}
            
            const file = files[0];
            if (!file.name.toLowerCase().endsWith('.syx')) {
                alert('Solo se admiten archivos .syx (SysEx).');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = function(ev) {
                const bytes = new Uint8Array(ev.target.result);
                if (typeof window.parseSyxFile !== 'function') {return;}
                const parsed = window.parseSyxFile(bytes);
                if (parsed.patches.length === 0) {
                    alert('SysEx inválido o archivo vacío.');
                    return;
                }
                
                if (parsed.isSinglePatch) {
                    const patch = parsed.patches[0];
                    const bank = loadedBanks[currentActiveBank];
                    if (bank && bank[currentActivePatchIndex]) {
                        const confirmed = confirm(
                            'Drop SysEx: "' + patch.name + '"\n'
                            + '¿Cargar en el slot actual ' + (currentActivePatchIndex + 1) + '?'
                        );
                        if (confirmed) {
                            bank[currentActivePatchIndex].name = patch.name;
                            bank[currentActivePatchIndex].unpackedBytes = new Uint8Array(patch.unpackedBytes);
                            bank[currentActivePatchIndex].meta = patch.meta ? JSON.parse(JSON.stringify(patch.meta)) : window.createDefaultMeta();
                            if (typeof window.triggerMidiDump === 'function') {
                                window.triggerMidiDump(bank[currentActivePatchIndex]);
                            }
                            renderPatchesForBank(currentActiveBank);
                            if (typeof window._saveUserBanksToStorage === 'function') {window._saveUserBanksToStorage();}
                        }
                    }
                } else {
                    const bankName = file.name.replace(/\.[^/.]+$/, '');
                    if (confirm('Drop bank "' + bankName + '" con ' + parsed.patches.length + ' patches. ¿Importar?')) {
                        loadedBanks[bankName] = parsed.patches;
                        currentActiveBank = bankName;
                        window.currentActiveBank = bankName;
                        updateLocalBanksDropdown();
                        renderPatchesForBank(currentActiveBank);
                        if (typeof window._saveUserBanksToStorage === 'function') {window._saveUserBanksToStorage();}
                    }
                }
            };
            reader.readAsArrayBuffer(file);
        });
    }
    _initSysexDropZone();

    const hwLoadBtn = document.getElementById('hw-load-btn');
    if (hwLoadBtn) {
        hwLoadBtn.addEventListener('click', () => {
            if (currentHwPatchIndex === -1) {
                alert('Selecciona primero un slot de la rejilla de Hardware.');
                return;
            }
            const patch = hardwareBanks[currentHwBankLetter][currentHwPatchIndex];
            if (patch && patch.unpackedBytes) {
                if (typeof window.triggerMidiDump === 'function') {window.triggerMidiDump(patch);}
                const lcdText = document.getElementById('lcd-text');
                if (lcdText) {lcdText.innerHTML = `<span style="font-size:10px; opacity:0.6;">LOADED FROM SYNTH</span><br><strong>${patch.name.toUpperCase()}</strong>`;}
                if (browserModal) {browserModal.style.display = 'none';}
            }
        });
    }

    const localLoadBtn = document.getElementById('local-load-btn');
    if (localLoadBtn) {
        localLoadBtn.addEventListener('click', () => {
            if (currentActivePatchIndex === -1) {
                alert('Selecciona primero un slot de la rejilla Local.');
                return;
            }
            const patch = loadedBanks[currentActiveBank][currentActivePatchIndex];
            if (patch && patch.unpackedBytes) {
                if (typeof window.triggerMidiDump === 'function') {window.triggerMidiDump(patch);}
                const lcdText = document.getElementById('lcd-text');
                if (lcdText) {lcdText.innerHTML = `<span style="font-size:10px; opacity:0.6;">LOADED FROM LIBRARY</span><br><strong>${patch.name.toUpperCase()}</strong>`;}
                if (browserModal) {browserModal.style.display = 'none';}
            }
        });
    }
}
window.initBankManager = initBankManager;
