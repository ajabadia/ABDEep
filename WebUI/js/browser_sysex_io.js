
/**
 * @purpose SysEx building and IO operations for DeepMind 12 patch/bank management.
 * Extracted from browser_io.js: SysEx message construction, bank dump, file import handling.
 * @depends browser_io_parse.js — parseSyxFile, parseSysexText, parseSysexBytes
 * @classification Module/Browser/SysExIO
 * @lastUpdated 2026-07-25
 */

/**
 * Build a single 291-byte SysEx message for a DeepMind 12 patch.
 * @param {Uint8Array} unpackedBytes - 278 unpacked bytes
 * @returns {Uint8Array} 291-byte SysEx message (F0...F7)
 */
window._buildPatchSysex = function(unpackedBytes) {
    const sysex = new Uint8Array(291);
    sysex[0] = 0xF0;
    sysex[1] = 0x00;
    sysex[2] = 0x20;
    sysex[3] = 0x32;
    sysex[4] = 0x20;
    sysex[5] = 0x7F;
    sysex[6] = 0x02;
    sysex[7] = 0x07;

    const packed = window.pack8to7(unpackedBytes);
    sysex.set(packed, 8);
    sysex[290] = 0xF7;
    return sysex;
};

/**
 * Build a full bank SysEx blob (128 patches, 291 bytes each).
 * @param {Array} patches - Array of 128 patch objects with .unpackedBytes
 * @returns {Uint8Array} 128*291 byte array
 */
window._buildBankSysex = function(patches) {
    const outputBytes = new Uint8Array(128 * 291);
    for (let i = 0; i < 128; i++) {
        const patch = patches[i];
        if (!patch || !patch.unpackedBytes) {continue;}
        const offset = i * 291;
        const patchSysex = window._buildPatchSysex(patch.unpackedBytes);
        outputBytes.set(patchSysex, offset);
    }
    return outputBytes;
};

/**
 * Dump a full bank to hardware MIDI with per-patch spacing.
 * @param {string} bankLetter - Letter of the hardware bank (e.g. 'A')
 * @param {Array} patches - Array of 128 patch objects
 * @param {object} callbacks - { onComplete(), onError(err) }
 */
window._dumpBankToHw = function(bankLetter, patches, callbacks) {
    if (!window.dualMidiBridge || !window.dualMidiBridge.midiOutput) {
        alert('Conexión MIDI no disponible. Asegúrate de configurar los puertos en Settings.');
        if (callbacks && callbacks.onError) {callbacks.onError('MIDI not available');}
        return;
    }

    const check = typeof window.inspectBankCompatibility === 'function'
        ? window.inspectBankCompatibility(null, patches)
        : { hasProPatches: false };

    let patchesToSend = patches;

    if (check.hasProPatches) {
        const confirmConvert = confirm(
            `⚠️ El banco contiene ${check.proCount} parches Pro (con FX/Filtros/32 Slots extended).\n\n` +
            'Para volcarlo al hardware físico DeepMind 12, los parches Pro se CONVERTIRÁN automáticamente a formato canónico clásico antes del envío.\n\n' +
            'Pulse [Aceptar] para continuar con el volcado convertido o [Cancelar] para abortar.'
        );
        if (!confirmConvert) {
            if (callbacks && callbacks.onError) {callbacks.onError('Cancelled by user due to Pro patches');}
            return;
        }
        patchesToSend = typeof window.convertBankToClassicDM12 === 'function'
            ? window.convertBankToClassicDM12(null, patches)
            : patches;
    } else {
        if (!confirm('¿Estás seguro de que deseas sobrescribir el banco ' + bankLetter + ' completo en el sintetizador físico?')) {
            return;
        }
    }

    for (let i = 0; i < 128; i++) {
        setTimeout(() => {
            const patch = patchesToSend[i];
            if (patch && patch.unpackedBytes) {
                const sysex = window._buildPatchSysex(patch.unpackedBytes);
                window.dualMidiBridge.midiOutput.send(sysex);
            }
            if (i === 127 && callbacks && callbacks.onComplete) {
                callbacks.onComplete();
            }
        }, i * 40);
    }
};

/**
 * Handle the result of importing a .syx file — either copy to current slot
 * or create a new bank with the imported patches.
 * @param {object} parsed - Result from parseSyxFile()
 * @param {string} fileName - Original file name (for new bank name)
 * @param {object} callbacks - { onPatchImported, onBankCreated, onError }
 */
window._handleImportSyxResult = function(parsed, fileName, callbacks) {
    if (!parsed || parsed.patches.length === 0) {
        alert('SysEx inv\u00E1lido: el archivo no contiene mensajes de programa DeepMind 12.');
        if (callbacks && callbacks.onError) {callbacks.onError('No patches found');}
        return;
    }

    if (parsed.isSinglePatch) {
        const patch = parsed.patches[0];
        const choice = confirm(
            'Archivo SysEx individual detectado: "' + patch.name + '"\n\n'
            + 'Haz clic en OK para cargarlo en el slot actual ('
            + (window.currentActivePatchIndex + 1) + ' de "' + window.currentActiveBank + '").\n'
            + 'Cancela para crear un nuevo banco con este \u00FAnico patch.'
        );
        if (choice) {
            // Overwrite current slot
            const bank = window.loadedBanks[window.currentActiveBank];
            if (bank && bank[window.currentActivePatchIndex]) {
                bank[window.currentActivePatchIndex].name = patch.name;
                bank[window.currentActivePatchIndex].unpackedBytes = new Uint8Array(patch.unpackedBytes);
                bank[window.currentActivePatchIndex].meta = patch.meta
                    ? JSON.parse(JSON.stringify(patch.meta))
                    : window.createDefaultMeta();

                window.triggerMidiDump(bank[window.currentActivePatchIndex]);

                if (typeof window.extractAndSaveNewPresetsFromBank === 'function') {
                    window.extractAndSaveNewPresetsFromBank(window.currentActiveBank, [bank[window.currentActivePatchIndex]]);
                }
                if (typeof window.renderPatchesForBank === 'function') {window.renderPatchesForBank(window.currentActiveBank);}
                if (typeof window._saveUserBanksToStorage === 'function') {window._saveUserBanksToStorage();}
            }
            if (callbacks && callbacks.onPatchImported) {callbacks.onPatchImported(patch);}
        } else {
            // Create new bank
            const bankName = prompt('Nombre para el nuevo banco:', fileName.replace(/\.[^/.]+$/, ''));
            if (bankName && bankName.trim()) {
                window.loadedBanks[bankName] = window.createEmptyBank();
                window.loadedBanks[bankName][0] = {
                    name: patch.name,
                    unpackedBytes: new Uint8Array(patch.unpackedBytes),
                    meta: patch.meta ? JSON.parse(JSON.stringify(patch.meta)) : window.createDefaultMeta()
                };
                window.currentActiveBank = bankName;
                window.currentActivePatchIndex = 0;

                if (typeof window.extractAndSaveNewPresetsFromBank === 'function') {
                    window.extractAndSaveNewPresetsFromBank(bankName, [window.loadedBanks[bankName][0]]);
                }
                if (typeof window.updateLocalBanksDropdown === 'function') {window.updateLocalBanksDropdown();}
                if (typeof window.renderPatchesForBank === 'function') {window.renderPatchesForBank(window.currentActiveBank);}
                if (typeof window._saveUserBanksToStorage === 'function') {window._saveUserBanksToStorage();}
            }
            if (callbacks && callbacks.onBankCreated) {callbacks.onBankCreated(bankName);}
        }
    } else {
        // Multi-patch bank
        const name = fileName.replace(/\.[^/.]+$/, '');
        window.loadedBanks[name] = parsed.patches;
        window.currentActiveBank = name;

        if (typeof window.extractAndSaveNewPresetsFromBank === 'function') {
            window.extractAndSaveNewPresetsFromBank(name, parsed.patches);
        }
        if (typeof window.updateLocalBanksDropdown === 'function') {window.updateLocalBanksDropdown();}
        if (typeof window.renderPatchesForBank === 'function') {window.renderPatchesForBank(window.currentActiveBank);}
        if (typeof window._saveUserBanksToStorage === 'function') {window._saveUserBanksToStorage();}

        if (callbacks && callbacks.onBankCreated) {callbacks.onBankCreated(name);}
    }
};
