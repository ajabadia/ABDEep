/**
 * @purpose Gestión del historial de edición Undo/Redo, acciones de Copiar/Pegar presets, almacenamiento (Save / Save As) y atajos de teclado globales.
 * @purpose_en Manages Undo/Redo history stack, Copy/Paste presets buffer, patch persistence (Save / Save As), and global key shortcuts.
 */

function initEditActions() {
    let globalClipboardBytes = null;
    let globalClipboardName = '';

    if (typeof window.initEditHistory === 'function') {
        window.initEditHistory();
    }
    if (typeof window.initEditPersistence === 'function') {
        window.initEditPersistence();
    }

    // Delegación de eventos para la barra de navegación superior (mitiga race conditions de carga)
    document.addEventListener('click', (e) => {
        // Undo
        if (e.target.closest('#menu-undo')) {
            e.preventDefault();
            if (typeof window.triggerUndo === 'function') {window.triggerUndo();}
        }

        // Redo
        if (e.target.closest('#menu-redo')) {
            e.preventDefault();
            if (typeof window.triggerRedo === 'function') {window.triggerRedo();}
        }

        // Copy
        if (e.target.closest('#menu-copy-preset')) {
            e.preventDefault();
            const activeBank = window.loadedBanks[window.currentActiveBank];
            if (!activeBank || window.currentActivePatchIndex === -1) {
                alert('Selecciona primero un preset del Bank Manager para copiar.');
                return;
            }
            const patch = activeBank[window.currentActivePatchIndex];
            if (patch && patch.unpackedBytes) {
                globalClipboardBytes = new Uint8Array(patch.unpackedBytes);
                globalClipboardName = patch.name;
                const lcdText = document.getElementById('lcd-text');
                if (lcdText) {lcdText.innerHTML = `<strong>COPIED</strong><br><span style="font-size:11px;">${patch.name.toUpperCase()}</span>`;}
            }
        }

        // Paste
        if (e.target.closest('#menu-paste-preset')) {
            e.preventDefault();
            if (!globalClipboardBytes) {
                alert('El portapapeles está vacío. Copia un preset primero.');
                return;
            }
            const activeBank = window.loadedBanks[window.currentActiveBank];
            if (!activeBank || window.currentActivePatchIndex === -1) {
                alert('Selecciona un slot de destino en el Bank Manager.');
                return;
            }
            
            const FACTORY_BANKS = [
                'Factory Bank A', 'Factory Bank B', 'Factory Bank C', 'Factory Bank D',
                'Factory Bank E', 'Factory Bank F', 'Factory Bank G', 'Factory Bank H'
            ];
            if (FACTORY_BANKS.includes(window.currentActiveBank)) {
                alert('No está permitido modificar o pegar presets en los bancos de fábrica.');
                return;
            }

            const patch = activeBank[window.currentActivePatchIndex];
            if (patch) {
                patch.unpackedBytes = new Uint8Array(globalClipboardBytes);
                patch.name = globalClipboardName;
                
                for (let k = 0; k < 15; k++) {
                    patch.unpackedBytes[224 + k] = k < patch.name.length ? patch.name.charCodeAt(k) : 0x20;
                }

                if (window.triggerMidiDump) {window.triggerMidiDump(patch);}
                if (typeof window.renderPatchesForBank === 'function') {window.renderPatchesForBank(window.currentActiveBank);}
                
                if (typeof window._saveUserBanksToStorage === 'function') {
                    window._saveUserBanksToStorage();
                }
            }
        }
    });

    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'z':
                    e.preventDefault();
                    if (typeof window.triggerUndo === 'function') {window.triggerUndo();}
                    break;
                case 'y':
                    e.preventDefault();
                    if (typeof window.triggerRedo === 'function') {window.triggerRedo();}
                    break;
                case 'c':
                    if (window.getSelection().toString() === '') {
                        e.preventDefault();
                        const copyBtn = document.getElementById('menu-copy-preset');
                        if (copyBtn) {copyBtn.click();}
                    }
                    break;
                case 'v':
                    if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'SELECT') {
                        e.preventDefault();
                        const pasteBtn = document.getElementById('menu-paste-preset');
                        if (pasteBtn) {pasteBtn.click();}
                    }
                    break;
            }
        }
    });
}

window.initEditActions = initEditActions;
