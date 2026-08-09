/**
 * @purpose Event handlers for Bank Manager: bank CRUD, SysEx import/export, HW/Local load, drop zone.
 * Extraído de browser.js para modularización.
 * @classification Module/Browser/Events
 * @complexity Medium
 */

window._handleBankCreate = function() {
    const name = prompt('Escribe el nombre del nuevo banco local:', 'User Bank ' + (Object.keys(window.loadedBanks).length - 7));
    if (!name || name.trim() === '' || window.loadedBanks[name]) {return;}
    window.loadedBanks[name] = window.createEmptyBank();
    window.currentActiveBank = name;
    window.updateLocalBanksDropdown();
    window.renderPatchesForBank(window.currentActiveBank);
    if (typeof window._saveUserBanksToStorage === 'function') {window._saveUserBanksToStorage();}
};

window._handleBankRename = function() {
    if (window.FACTORY_BANKS_LIST.includes(window.currentActiveBank)) {return alert('No se pueden renombrar bancos de fábrica.');}
    const newName = prompt('Escribe el nuevo nombre para "' + window.currentActiveBank + '":', window.currentActiveBank);
    if (!newName || newName.trim() === '' || window.loadedBanks[newName]) {return;}
    window.loadedBanks[newName] = window.loadedBanks[window.currentActiveBank];
    delete window.loadedBanks[window.currentActiveBank];
    window.currentActiveBank = newName;
    window.updateLocalBanksDropdown();
    window.renderPatchesForBank(window.currentActiveBank);
    if (typeof window._saveUserBanksToStorage === 'function') {window._saveUserBanksToStorage();}
};

window._handleBankDelete = function() {
    if (window.FACTORY_BANKS_LIST.includes(window.currentActiveBank)) {return alert('No se pueden borrar bancos de fábrica.');}
    if (confirm('¿Borrar banco local "' + window.currentActiveBank + '"?')) {
        delete window.loadedBanks[window.currentActiveBank];
        window.currentActiveBank = Object.keys(window.loadedBanks)[0];
        window.updateLocalBanksDropdown();
        window.renderPatchesForBank(window.currentActiveBank);
        if (typeof window._saveUserBanksToStorage === 'function') {window._saveUserBanksToStorage();}
    }
};

window._handlePasteSysex = function() {
    if (window.FACTORY_BANKS_LIST.includes(window.currentActiveBank)) {
        return alert('No está permitido pegar SysEx en bancos de fábrica.');
    }
    if (typeof window.pasteSysexFromClipboard === 'function') {
        window.pasteSysexFromClipboard(window.currentActiveBank, window.currentActivePatchIndex);
    }
};

window._initExportPatchButton = function() {
    const localToolbar = document.querySelector('.dual-bank-panel:last-child .flex-row.border-bottom');
    if (!localToolbar || document.getElementById('local-export-patch-btn')) {return;}
    const exportPatchBtn = document.createElement('button');
    exportPatchBtn.id = 'local-export-patch-btn';
    exportPatchBtn.className = 'manager-btn patch-export-btn';
    exportPatchBtn.setAttribute('data-ctrl-tooltip', 'Export current patch as standalone SysEx file (.syx)');
    exportPatchBtn.textContent = 'Export Patch';
    exportPatchBtn.addEventListener('click', function() {
        const bank = window.loadedBanks[window.currentActiveBank];
        if (!bank || window.currentActivePatchIndex < 0) {alert('Select a patch first.'); return;}
        const patch = bank[window.currentActivePatchIndex];
        if (typeof window.exportSinglePatch === 'function') {
            window.exportSinglePatch(patch, (window.currentActivePatchIndex + 1).toString().padStart(3, '0') + '_' + patch.name.replace(/[^a-zA-Z0-9_\\-]/g, '_') + '.syx');
        }
    });
    localToolbar.appendChild(exportPatchBtn);
};

window._handleHWLoad = function(browserModal) {
    if (window.currentHwPatchIndex === -1) {alert('Selecciona primero un slot de la rejilla de Hardware.'); return;}
    const patch = window.hardwareBanks[window.currentHwBankLetter][window.currentHwPatchIndex];
    if (patch && patch.unpackedBytes) {
        if (typeof window.triggerMidiDump === 'function') {window.triggerMidiDump(patch);}
        const lcdText = document.getElementById('lcd-text');
        if (lcdText) {lcdText.innerHTML = '<span class="lcd-label">LOADED FROM SYNTH</span><br><strong>' + patch.name.toUpperCase() + '</strong>';}
        if (browserModal) {browserModal.style.display = 'none';}
    }
};

window._handleLocalLoad = function(browserModal) {
    if (window.currentActivePatchIndex === -1) {alert('Selecciona primero un slot de la rejilla Local.'); return;}
    const patch = window.loadedBanks[window.currentActiveBank][window.currentActivePatchIndex];
    if (patch && patch.unpackedBytes) {
        if (typeof window.triggerMidiDump === 'function') {window.triggerMidiDump(patch);}
        const lcdText = document.getElementById('lcd-text');
        if (lcdText) {lcdText.innerHTML = '<span class="lcd-label">LOADED FROM LIBRARY</span><br><strong>' + patch.name.toUpperCase() + '</strong>';}
        if (browserModal) {browserModal.style.display = 'none';}
    }
};

window._initSysexDropZone = function(browserModal) {
    if (!browserModal) {return;}
    browserModal.addEventListener('dragover', function(e) {
        e.preventDefault(); e.stopPropagation();
        browserModal.style.outline = '2px dashed var(--accent-primary, #ff9900)';
        browserModal.style.outlineOffset = '-10px';
    });
    browserModal.addEventListener('dragleave', function(e) {
        e.preventDefault(); e.stopPropagation();
        browserModal.style.outline = ''; browserModal.style.outlineOffset = '';
    });
    browserModal.addEventListener('drop', function(e) {
        e.preventDefault(); e.stopPropagation();
        browserModal.style.outline = ''; browserModal.style.outlineOffset = '';
        const files = e.dataTransfer.files;
        if (!files || files.length === 0) {return;}
        const file = files[0];
        if (!file.name.toLowerCase().endsWith('.syx')) {alert('Solo se admiten archivos .syx (SysEx).'); return;}
        const reader = new FileReader();
        reader.onload = function(ev) {
            const bytes = new Uint8Array(ev.target.result);
            if (typeof window.parseSyxFile !== 'function') {return;}
            const parsed = window.parseSyxFile(bytes);
            if (parsed.patches.length === 0) {alert('SysEx inválido o archivo vacío.'); return;}
            if (parsed.isSinglePatch) {
                const patch = parsed.patches[0];
                const bank = window.loadedBanks[window.currentActiveBank];
                if (bank && bank[window.currentActivePatchIndex]) {
                    const confirmed = confirm('Drop SysEx: "' + patch.name + '"\n¿Cargar en el slot actual ' + (window.currentActivePatchIndex + 1) + '?');
                    if (confirmed) {
                        bank[window.currentActivePatchIndex].name = patch.name;
                        bank[window.currentActivePatchIndex].unpackedBytes = new Uint8Array(patch.unpackedBytes);
                        bank[window.currentActivePatchIndex].meta = patch.meta ? JSON.parse(JSON.stringify(patch.meta)) : window.createDefaultMeta();
                        if (typeof window.triggerMidiDump === 'function') {window.triggerMidiDump(bank[window.currentActivePatchIndex]);}
                        window.renderPatchesForBank(window.currentActiveBank);
                        if (typeof window._saveUserBanksToStorage === 'function') {window._saveUserBanksToStorage();}
                    }
                }
            } else {
                const bankName = file.name.replace(/\.[^/.]+$/, '');
                if (confirm('Drop bank "' + bankName + '" con ' + parsed.patches.length + ' patches. ¿Importar?')) {
                    window.loadedBanks[bankName] = parsed.patches;
                    window.currentActiveBank = bankName;
                    window.updateLocalBanksDropdown();
                    window.renderPatchesForBank(window.currentActiveBank);
                    if (typeof window._saveUserBanksToStorage === 'function') {window._saveUserBanksToStorage();}
                }
            }
        };
        reader.readAsArrayBuffer(file);
    });
};
