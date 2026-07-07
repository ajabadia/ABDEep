/**
 * @purpose Gestión del historial de edición Undo/Redo, acciones de Copiar/Pegar presets, almacenamiento (Save / Save As) y atajos de teclado globales.
 * @purpose_en Manages Undo/Redo history stack, Copy/Paste presets buffer, patch persistence (Save / Save As), and global key shortcuts.
 */

function initEditActions() {
    // Historiales para Undo y Redo
    let undoStack = [];
    let redoStack = [];
    const maxHistory = 50;
    let isHistoryAction = false;

    // Buffer del portapapeles global de presets (16-chars name + 242-bytes unpackedBytes)
    let globalClipboardBytes = null;
    let globalClipboardName = "";

    // Obtener una captura del estado actual de todos los parámetros mapeados de la UI
    function captureParamSnapshot() {
        if (!window.dualMidiBridge) return null;
        return JSON.stringify(window.dualMidiBridge.parameterCache);
    }

    function restoreParamSnapshot(snapshotStr) {
        if (!snapshotStr || !window.dualMidiBridge) return;
        const cache = JSON.parse(snapshotStr);
        isHistoryAction = true;
        
        Object.keys(cache).forEach(paramId => {
            const val = cache[paramId];
            window.dualMidiBridge.setParameter(paramId, val);
            window.dualMidiBridge.handleParameterChangeFromBackend(paramId, val);
        });

        // Refrescar paneles visuales
        if (typeof window.updateLfoSlidersFromCurrentPreset === 'function') window.updateLfoSlidersFromCurrentPreset();
        if (typeof window.updateEnvSlidersFromCurrentPreset === 'function') window.updateEnvSlidersFromCurrentPreset();
        if (typeof window.updateOscSlidersFromCurrentPreset === 'function') window.updateOscSlidersFromCurrentPreset();

        isHistoryAction = false;
        
        const lcdText = document.getElementById('lcd-text');
        if (lcdText) {
            lcdText.innerHTML = `<span style="font-size:10px; opacity:0.6;">EDIT HISTORY</span><br><strong>STATE RESTORED</strong>`;
        }
    }

    // Registrar cambios para el historial
    if (window.dualMidiBridge) {
        let changeTimeout = null;
        window.dualMidiBridge.onParameterChanged((paramId, val) => {
            if (isHistoryAction) return;

            // Evitar saturar la pila de historial agrupando movimientos rápidos de faders (debounce 400ms)
            clearTimeout(changeTimeout);
            changeTimeout = setTimeout(() => {
                const snap = captureParamSnapshot();
                if (snap) {
                    if (undoStack.length === 0 || undoStack[undoStack.length - 1] !== snap) {
                        undoStack.push(snap);
                        if (undoStack.length > maxHistory) undoStack.shift();
                        redoStack = []; // Limpiar rehacer al realizar una nueva acción
                    }
                }
            }, 400);
        });
    }

    // Métodos globales de Undo / Redo
    window.triggerUndo = () => {
        if (undoStack.length <= 1) {
            alert("No hay más cambios que deshacer.");
            return;
        }
        const current = undoStack.pop();
        redoStack.push(current);
        
        const previous = undoStack[undoStack.length - 1];
        restoreParamSnapshot(previous);
    };

    window.triggerRedo = () => {
        if (redoStack.length === 0) {
            alert("No hay cambios para rehacer.");
            return;
        }
        const nextState = redoStack.pop();
        undoStack.push(nextState);
        restoreParamSnapshot(nextState);
    };

    // Vincular botones del menú superior
    const menuUndo = document.getElementById('menu-undo');
    if (menuUndo) menuUndo.addEventListener('click', () => window.triggerUndo());

    const menuRedo = document.getElementById('menu-redo');
    if (menuRedo) menuRedo.addEventListener('click', () => window.triggerRedo());

    // Copiar Preset
    const menuCopy = document.getElementById('menu-copy-preset');
    if (menuCopy) {
        menuCopy.addEventListener('click', () => {
            const activeBank = window.loadedBanks[window.currentActiveBank];
            if (!activeBank || window.currentActivePatchIndex === -1) {
                alert("Selecciona primero un preset del Bank Manager para copiar.");
                return;
            }
            const patch = activeBank[window.currentActivePatchIndex];
            if (patch && patch.unpackedBytes) {
                globalClipboardBytes = new Uint8Array(patch.unpackedBytes);
                globalClipboardName = patch.name;
                const lcdText = document.getElementById('lcd-text');
                if (lcdText) lcdText.innerHTML = `<strong>COPIED</strong><br><span style="font-size:11px;">${patch.name.toUpperCase()}</span>`;
            }
        });
    }

    // Pegar Preset
    const menuPaste = document.getElementById('menu-paste-preset');
    if (menuPaste) {
        menuPaste.addEventListener('click', () => {
            if (!globalClipboardBytes) {
                alert("El portapapeles está vacío. Copia un preset primero.");
                return;
            }
            const activeBank = window.loadedBanks[window.currentActiveBank];
            if (!activeBank || window.currentActivePatchIndex === -1) {
                alert("Selecciona un slot de destino en el Bank Manager.");
                return;
            }
            
            const FACTORY_BANKS = [
                'Factory Bank A', 'Factory Bank B', 'Factory Bank C', 'Factory Bank D',
                'Factory Bank E', 'Factory Bank F', 'Factory Bank G', 'Factory Bank H'
            ];
            if (FACTORY_BANKS.includes(window.currentActiveBank)) {
                alert("No está permitido modificar o pegar presets en los bancos de fábrica.");
                return;
            }

            const patch = activeBank[window.currentActivePatchIndex];
            if (patch) {
                patch.unpackedBytes = new Uint8Array(globalClipboardBytes);
                patch.name = globalClipboardName;
                
                for (let k = 0; k < 16; k++) {
                    patch.unpackedBytes[226 + k] = k < patch.name.length ? patch.name.charCodeAt(k) : 0x20;
                }

                if (window.triggerMidiDump) window.triggerMidiDump(patch);
                if (typeof window.renderPatchesForBank === 'function') window.renderPatchesForBank(window.currentActiveBank);
            }
        });
    }

    // Save Patch
    const menuSave = document.getElementById('menu-save');
    if (menuSave) {
        menuSave.addEventListener('click', () => {
            const activeBank = window.loadedBanks[window.currentActiveBank];
            if (!activeBank || window.currentActivePatchIndex === -1) {
                alert("Por favor, selecciona un preset de la librería local del Bank Manager para guardar.");
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
                syncCacheToPatchBytes(patch.unpackedBytes);
                alert(`Guardado correctamente en ${window.currentActiveBank} - Slot ${window.currentActivePatchIndex + 1}`);
                if (typeof window.renderPatchesForBank === 'function') window.renderPatchesForBank(window.currentActiveBank);
            }
        });
    }

    // Save Patch As (Modo Gráfico Interactivo)
    const menuSaveAs = document.getElementById('menu-save-as');
    const saveAsModal = document.getElementById('saveas-modal-backdrop');
    const saveAsCloseBtn = document.getElementById('saveas-close-btn');
    const saveAsCancelBtn = document.getElementById('saveas-btn-cancel');
    const saveAsConfirmBtn = document.getElementById('saveas-btn-confirm');
    
    let saveAsSelectedBank = "";
    let saveAsSelectedSlotIdx = -1;

    if (menuSaveAs && saveAsModal) {
        menuSaveAs.addEventListener('click', () => {
            saveAsModal.style.display = 'flex';
            
            const userBanks = Object.keys(window.loadedBanks).filter(b => !b.startsWith("Factory Bank"));
            saveAsSelectedBank = userBanks.includes(window.currentActiveBank) ? window.currentActiveBank : (userBanks[0] || "");
            saveAsSelectedSlotIdx = window.currentActivePatchIndex >= 0 ? window.currentActivePatchIndex : 0;

            const activeBank = window.loadedBanks[window.currentActiveBank];
            const activeName = (activeBank && activeBank[window.currentActivePatchIndex]) ? activeBank[window.currentActivePatchIndex].name : "My Custom Patch";
            document.getElementById('saveas-preset-name').value = activeName;

            renderSaveAsBanks();
            renderSaveAsSlots();
        });

        const closeSaveAs = () => { saveAsModal.style.display = 'none'; };
        if (saveAsCloseBtn) saveAsCloseBtn.addEventListener('click', closeSaveAs);
        if (saveAsCancelBtn) saveAsCancelBtn.addEventListener('click', closeSaveAs);
        saveAsModal.addEventListener('click', (e) => {
            if (e.target === saveAsModal) closeSaveAs();
        });

        function renderSaveAsBanks() {
            const listContainer = document.getElementById('saveas-banks-list');
            if (!listContainer) return;
            listContainer.innerHTML = '';

            Object.keys(window.loadedBanks).forEach(bankName => {
                const isFactory = bankName.startsWith("Factory Bank");
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
                    item.style.background = '#1a1b1f';
                    item.style.color = '#555';
                    item.innerHTML = `<span>${bankName}</span><span style="font-size:8px; color:#c00; text-transform:uppercase;">Lock</span>`;
                } else {
                    const isSelected = bankName === saveAsSelectedBank;
                    item.style.background = isSelected ? 'linear-gradient(180deg, #504020, #302008)' : '#1b1c20';
                    item.style.color = isSelected ? '#fff' : '#ccc';
                    item.style.border = isSelected ? '1px solid var(--brand-accent)' : '1px solid #333';
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
            if (!gridContainer) return;
            gridContainer.innerHTML = '';

            const patches = window.loadedBanks[saveAsSelectedBank] || [];
            for (let i = 0; i < 128; i++) {
                const patch = patches[i] || { name: `[Empty Slot ${i+1}]` };
                const isSelected = i === saveAsSelectedSlotIdx;
                const isEmpty = patch.name.startsWith("INIT PATCH") || patch.name.startsWith("[Empty");

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
                
                item.style.background = isSelected ? 'var(--brand-accent)' : '#16171a';
                item.style.color = isSelected ? '#000' : (isEmpty ? '#555' : '#ccc');
                item.style.border = isSelected ? '1px solid #fff' : '1px solid #222';
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
                    alert("Por favor, selecciona un banco de usuario válido.");
                    return;
                }
                if (saveAsSelectedSlotIdx < 0 || saveAsSelectedSlotIdx >= 128) {
                    alert("Por favor, selecciona un slot de destino.");
                    return;
                }

                const newName = document.getElementById('saveas-preset-name').value.trim();
                if (!newName) {
                    alert("Por favor, escribe un nombre para el preset.");
                    return;
                }

                const bank = window.loadedBanks[saveAsSelectedBank];
                const targetPatch = bank[saveAsSelectedSlotIdx];
                const isOccupied = targetPatch && !targetPatch.name.startsWith("INIT PATCH") && !targetPatch.name.startsWith("[Empty");

                if (isOccupied) {
                    const confirmOverwrite = confirm(`¿Estás seguro de que deseas sobrescribir el preset existente "${targetPatch.name}" en el Slot ${saveAsSelectedSlotIdx + 1}?`);
                    if (!confirmOverwrite) return;
                }

                targetPatch.name = newName;
                for (let k = 0; k < 16; k++) {
                    targetPatch.unpackedBytes[226 + k] = k < targetPatch.name.length ? targetPatch.name.charCodeAt(k) : 0x20;
                }
                syncCacheToPatchBytes(targetPatch.unpackedBytes);

                window.currentActiveBank = saveAsSelectedBank;
                window.currentActivePatchIndex = saveAsSelectedSlotIdx;

                const localSelect = document.getElementById('local-bank-select');
                if (localSelect) localSelect.value = saveAsSelectedBank;
                if (typeof window.renderPatchesForBank === 'function') window.renderPatchesForBank(saveAsSelectedBank);
                
                if (window.triggerMidiDump) window.triggerMidiDump(targetPatch);

                alert(`Guardado con éxito como "${newName}" en el Banco "${saveAsSelectedBank}" (Slot ${saveAsSelectedSlotIdx + 1}).`);
                closeSaveAs();
            });
        }
    }

    function syncCacheToPatchBytes(unpackedBytes) {
        if (!window.dualMidiBridge) return;
        const cache = window.dualMidiBridge.parameterCache;
        
        if (cache["osc1_pwm_amount"] !== undefined) unpackedBytes[25] = Math.round(cache["osc1_pwm_amount"] * 255);
        if (cache["osc2_pitch"] !== undefined) unpackedBytes[27] = Math.round((cache["osc2_pitch"] * 128) + 128);
        if (cache["osc2_tone_mod"] !== undefined) unpackedBytes[28] = Math.round(cache["osc2_tone_mod"] * 255);
        if (cache["osc2_level"] !== undefined) unpackedBytes[26] = Math.round(cache["osc2_level"] * 255);
        if (cache["noise_level"] !== undefined) unpackedBytes[33] = Math.round(cache["noise_level"] * 255);
        if (cache["vcf_cutoff"] !== undefined) unpackedBytes[39] = Math.round(cache["vcf_cutoff"] * 255);
        if (cache["vcf_resonance"] !== undefined) unpackedBytes[41] = Math.round(cache["vcf_resonance"] * 255);
        if (cache["vcf_env_depth"] !== undefined) unpackedBytes[42] = Math.round((cache["vcf_env_depth"] * 128) + 128);
        if (cache["hpf_cutoff"] !== undefined) unpackedBytes[40] = Math.round(cache["hpf_cutoff"] * 255);
        if (cache["env1_attack"] !== undefined) unpackedBytes[53] = Math.round(cache["env1_attack"] * 255);
        if (cache["env1_decay"] !== undefined) unpackedBytes[54] = Math.round(cache["env1_decay"] * 255);
        if (cache["env1_sustain"] !== undefined) unpackedBytes[55] = Math.round(cache["env1_sustain"] * 255);
        if (cache["env1_release"] !== undefined) unpackedBytes[56] = Math.round(cache["env1_release"] * 255);
    }

    // Atajos de teclado (Keyboard Shortcuts)
    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'z':
                    e.preventDefault();
                    window.triggerUndo();
                    break;
                case 'y':
                    e.preventDefault();
                    window.triggerRedo();
                    break;
                case 'c':
                    if (window.getSelection().toString() === "") {
                        e.preventDefault();
                        const copyBtn = document.getElementById('menu-copy-preset');
                        if (copyBtn) copyBtn.click();
                    }
                    break;
                case 'v':
                    if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'SELECT') {
                        e.preventDefault();
                        const pasteBtn = document.getElementById('menu-paste-preset');
                        if (pasteBtn) pasteBtn.click();
                    }
                    break;
            }
        }
    });
}

// Exportar al ámbito de window
window.initEditActions = initEditActions;
