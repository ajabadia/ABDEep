/**
 * @purpose Manages saving current patch modifications and rendering the interactive "Save As" selection slots.
 * @purpose_en Patch persistence and Save As modal manager.
 */

window.initEditPersistence = function() {
    const menuSave = document.getElementById('menu-save');
    if (menuSave) {
        menuSave.addEventListener('click', () => {
            const activeBank = window.loadedBanks[window.currentActiveBank];
            if (!activeBank || window.currentActivePatchIndex === -1) {
                alert('Por favor, selecciona un preset de la librería local del Bank Manager para guardar.');
                return;
            }
            const FACTORY_BANKS = [
                'Factory Bank A', 'Factory Bank B', 'Factory Bank C', 'Factory Bank D',
                'Factory Bank E', 'Factory Bank F', 'Factory Bank G', 'Factory Bank H'
            ];
            if (FACTORY_BANKS.includes(window.currentActiveBank)) {
                alert("No puedes modificar los bancos de fábrica. Usa 'Save Patch As' para guardarlo en un banco de usuario.");
                return;
            }

            const patch = activeBank[window.currentActivePatchIndex];
            if (patch && window.dualMidiBridge) {
                if (typeof window.updateUnpackedBytesFromCache === 'function') {
                    window.updateUnpackedBytesFromCache(patch.unpackedBytes);
                }
                for (let k = 0; k < 15; k++) {
                    patch.unpackedBytes[224 + k] = k < patch.name.length ? patch.name.charCodeAt(k) : 0x20;
                }
                if (typeof updateSysExMonitor === 'function') {updateSysExMonitor(patch.unpackedBytes);}
                
                if (typeof window._saveUserBanksToStorage === 'function') {
                    window._saveUserBanksToStorage();
                }
                
                const lcdText = document.getElementById('lcd-text');
                if (lcdText) {
                    const html = `<span style="font-size:10px; opacity:0.6;">SAVED</span><br><strong style="color:var(--accent-green);">${patch.name.toUpperCase()}</strong><br><span style="font-size:9px; color:var(--text-dim);">${window.currentActiveBank} › Slot ${window.currentActivePatchIndex + 1}</span>`;
                    window.lcdSafeUpdate(lcdText, html);
                }
                if (typeof window.renderPatchesForBank === 'function') {window.renderPatchesForBank(window.currentActiveBank);}
            }
        });
    }

    const menuSaveAs = document.getElementById('menu-save-as');
    const saveAsModal = document.getElementById('saveas-modal-backdrop');
    const saveAsCloseBtn = document.getElementById('saveas-close-btn');
    const saveAsCancelBtn = document.getElementById('saveas-btn-cancel');
    const saveAsConfirmBtn = document.getElementById('saveas-btn-confirm');
    
    let saveAsSelectedBank = '';
    let saveAsSelectedSlotIdx = -1;

    if (menuSaveAs && saveAsModal) {
        menuSaveAs.addEventListener('click', () => {
            saveAsModal.style.display = 'flex';
            
            const userBanks = Object.keys(window.loadedBanks).filter(b => !b.startsWith('Factory Bank'));
            saveAsSelectedBank = userBanks.includes(window.currentActiveBank) ? window.currentActiveBank : (userBanks[0] || '');
            saveAsSelectedSlotIdx = window.currentActivePatchIndex >= 0 ? window.currentActivePatchIndex : 0;

            const activeBank = window.loadedBanks[window.currentActiveBank];
            const activeName = (activeBank && activeBank[window.currentActivePatchIndex]) ? activeBank[window.currentActivePatchIndex].name : 'My Custom Patch';
            document.getElementById('saveas-preset-name').value = activeName;

            renderSaveAsBanks();
            renderSaveAsSlots();
        });

        const closeSaveAs = () => { saveAsModal.style.display = 'none'; };
        if (saveAsCloseBtn) {saveAsCloseBtn.addEventListener('click', closeSaveAs);}
        if (saveAsCancelBtn) {saveAsCancelBtn.addEventListener('click', closeSaveAs);}
        saveAsModal.addEventListener('click', (e) => {
            if (e.target === saveAsModal) {closeSaveAs();}
        });

        function renderSaveAsBanks() {
            const listContainer = document.getElementById('saveas-banks-list');
            if (!listContainer) {return;}
            listContainer.innerHTML = '';

            Object.keys(window.loadedBanks).forEach(bankName => {
                const isFactory = bankName.startsWith('Factory Bank');
                const item = document.createElement('div');
                item.style.cssText = `
                    padding: 8px; 
                    font-size: 11px; 
                    border-radius: 3px; 
                    cursor: ${isFactory ? 'not-allowed' : 'pointer'}; 
                    opacity: ${isFactory ? 0.4 : 1};
                    font-weight: bold;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                `;

                if (isFactory) {
                    item.style.background = 'var(--bg-header)';
                    item.style.color = 'var(--text-faint)';
                    item.innerHTML = `<span>${bankName}</span><span style="font-size:var(--text-xs); color:var(--color-danger); text-transform:uppercase;">Lock</span>`;
                } else {
                    const isSelected = bankName === saveAsSelectedBank;
                    item.style.background = isSelected ? 'linear-gradient(180deg, color-mix(in srgb, var(--accent-primary) 28%, #111), color-mix(in srgb, var(--accent-primary) 10%, #000))' : 'var(--bg-header)';
                    item.style.color = isSelected ? 'var(--text-primary)' : 'var(--text-secondary)';
                    item.style.border = isSelected ? '1px solid var(--brand-accent)' : '1px solid var(--border)';
                    item.innerText = bankName;

                    item.addEventListener('click', () => {
                        saveAsSelectedBank = bankName;
                        renderSaveAsBanks();
                        renderSaveAsSlots();
                    });
                }
                listContainer.appendChild(item);
            });
        }

        function renderSaveAsSlots() {
            const gridContainer = document.getElementById('saveas-slots-grid');
            if (!gridContainer) {return;}
            gridContainer.innerHTML = '';

            const patches = window.loadedBanks[saveAsSelectedBank] || [];
            for (let i = 0; i < 128; i++) {
                const patch = patches[i] || { name: `[Empty Slot ${i+1}]` };
                const isSelected = i === saveAsSelectedSlotIdx;
                const isEmpty = patch.name.startsWith('INIT PATCH') || patch.name.startsWith('[Empty');

                const item = document.createElement('div');
                item.style.cssText = `
                    padding: 4px 6px;
                    font-size: 9px;
                    border-radius: 2px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    overflow: hidden;
                    white-space: nowrap;
                    text-overflow: ellipsis;
                `;
                
                item.style.background = isSelected ? 'var(--brand-accent)' : 'var(--bg-elevated)';
                item.style.color = isSelected ? '#000' : (isEmpty ? 'var(--text-dim)' : 'var(--text-secondary)');
                item.style.border = isSelected ? '1px solid #fff' : '1px solid var(--border-dim)';
                item.innerText = `${(i+1).toString().padStart(3, '0')}: ${patch.name}`;

                item.addEventListener('click', () => {
                    saveAsSelectedSlotIdx = i;
                    renderSaveAsSlots();
                });
                gridContainer.appendChild(item);
            }
        }

        if (saveAsConfirmBtn) {
            saveAsConfirmBtn.addEventListener('click', () => {
                if (!saveAsSelectedBank) {
                    alert('Por favor, selecciona un banco de usuario válido.');
                    return;
                }
                if (saveAsSelectedSlotIdx < 0 || saveAsSelectedSlotIdx >= 128) {
                    alert('Por favor, selecciona un slot de destino.');
                    return;
                }

                const newName = document.getElementById('saveas-preset-name').value.trim();
                if (!newName) {
                    alert('Por favor, escribe un nombre para el preset.');
                    return;
                }

                const bank = window.loadedBanks[saveAsSelectedBank];
                if (!bank || !bank[saveAsSelectedSlotIdx]) {
                    alert('Error: el slot seleccionado no existe.');
                    return;
                }
                const targetPatch = bank[saveAsSelectedSlotIdx];
                
                if (!targetPatch) {
                    alert('Error interno: slot vacío. Intenta crear un nuevo banco.');
                    return;
                }

                const isOccupied = targetPatch && !targetPatch.name.startsWith('INIT PATCH') && !targetPatch.name.startsWith('[Empty');

                if (isOccupied) {
                    const confirmOverwrite = confirm(`¿Estás seguro de que deseas sobrescribir el preset existente "${targetPatch.name}" en el Slot ${saveAsSelectedSlotIdx + 1}?`);
                    if (!confirmOverwrite) {return;}
                }

                targetPatch.name = newName;
                for (let k = 0; k < 15; k++) {
                    targetPatch.unpackedBytes[224 + k] = k < targetPatch.name.length ? targetPatch.name.charCodeAt(k) : 0x20;
                }
                if (typeof window.updateUnpackedBytesFromCache === 'function') {
                    window.updateUnpackedBytesFromCache(targetPatch.unpackedBytes);
                }
                if (typeof updateSysExMonitor === 'function') {updateSysExMonitor(targetPatch.unpackedBytes);}

                window.currentActiveBank = saveAsSelectedBank;
                window.currentActivePatchIndex = saveAsSelectedSlotIdx;

                const localSelect = document.getElementById('local-bank-select');
                if (localSelect) {localSelect.value = saveAsSelectedBank;}
                if (typeof window.renderPatchesForBank === 'function') {window.renderPatchesForBank(saveAsSelectedBank);}
                
                if (window.triggerMidiDump) {window.triggerMidiDump(targetPatch);}

                if (typeof window._saveUserBanksToStorage === 'function') {
                    window._saveUserBanksToStorage();
                }

                const lcdText = document.getElementById('lcd-text');
                if (lcdText) {
                    const html = `<span style="font-size:10px; opacity:0.6;">SAVED AS</span><br><strong style="color:var(--accent-green);">${newName.toUpperCase()}</strong><br><span style="font-size:9px; color:var(--text-dim);">${saveAsSelectedBank} › Slot ${saveAsSelectedSlotIdx + 1}</span>`;
                    window.lcdSafeUpdate(lcdText, html);
                }
                closeSaveAs();
            });
        }
    }
};
