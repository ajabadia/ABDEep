/**
 * @purpose Handles loading/fetching factory bank files, exporting banks as SysEx, and handling MIDI dumps to/from hardware.
 * @purpose_en Synthesizer Bank Import/Export and Hardware Fetch/Dump.
 */

async function loadAllFactoryBanksNatively() {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    for (const letter of letters) {
        const bankName = `Factory Bank ${letter}`;
        window.loadedBanks[bankName] = window.createEmptyBank();
        
        let bytes = null;
        
        if (window.dualMidiBridge && window.dualMidiBridge.isJuce) {
            try {
                const hexStr = await window.dualMidiBridge.readFactoryBankFile(letter);
                console.log(`[BankManager] readFactoryBankFile(${letter}) retornó:`, hexStr ? (hexStr.length + " caracteres") : "null/undefined");
                if (hexStr && typeof hexStr === 'string' && hexStr.length > 0) {
                    const cleanHex = hexStr.replace(/\s/g, '');
                    bytes = new Uint8Array(cleanHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
                    console.log(`[BankManager] Banco ${letter} cargado via JUCE nativo: ${bytes.length} bytes`);
                }
            } catch (err) {
                console.warn("[BankManager] Error cargando banco nativo " + letter + ", intentando fetch...", err);
            }
        }
        
        if (!bytes) {
            try {
                const response = await fetch(`./resources/Banks/Factory%20Banks%20V1.1.2/Synth%20Bank%20${letter}.syx`);
                console.log(`[BankManager] Fetch fall-back para banco ${letter} status:`, response.status);
                if (response.ok) {
                    const arrayBuffer = await response.arrayBuffer();
                    bytes = new Uint8Array(arrayBuffer);
                    console.log(`[BankManager] Banco ${letter} cargado via HTTP fetch: ${bytes.length} bytes`);
                }
            } catch (err) {
                console.error("[BankManager] Error en fetch de banco de fabrica " + letter, err);
            }
        }

        if (bytes && bytes.length >= 291) {
            const patchSize = 291;
            const numPatches = Math.floor(bytes.length / patchSize);
            for (let i = 0; i < Math.min(128, numPatches); i++) {
                const offset = i * patchSize;
                const packedPayload = bytes.slice(offset + 8, offset + 286);
                const unpackedBytes = window.unpack7to8(packedPayload);
                
                const patchName = window.extractNameFromRawSysex(bytes, offset) || `Factory Patch ${i+1}`;
                window.loadedBanks[bankName][i] = {
                    index: i,
                    name: patchName,
                    unpackedBytes: unpackedBytes,
                    meta: window.createDefaultMeta()
                };
            }
            console.log(`[BankManager] Banco ${bankName}: ${numPatches} presets parseados correctamente`);
        } else {
            console.error(`[BankManager] Error: No hay bytes de datos válidos para el banco ${bankName}. Total bytes:`, bytes ? bytes.length : 0);
        }
    }
    
    var userBanksLoaded = window._loadUserBanksFromStorage();
    if (!userBanksLoaded) {
        window.loadedBanks['User Bank 1'] = window.createEmptyBank();
    }
    
    window.currentActiveBank = 'Factory Bank A';
    window.currentActivePatchIndex = 0;

    if (typeof window.updateLocalBanksDropdown === 'function') window.updateLocalBanksDropdown();
    if (typeof window.renderPatchesForBank === 'function') window.renderPatchesForBank(window.currentActiveBank);
    if (typeof window.renderHardwarePatches === 'function') window.renderHardwarePatches();

    const initialPatch = window.loadedBanks['Factory Bank A'] && window.loadedBanks['Factory Bank A'][0];
    if (initialPatch) {
        const lcdText = document.getElementById('lcd-text');
        if (lcdText) lcdText.innerText = initialPatch.name.toUpperCase();
        if (window.dualMidiBridge && typeof window.dualMidiBridge.waitForReady === 'function') {
            await window.dualMidiBridge.waitForReady(10000);
        }
        if (initialPatch.unpackedBytes) {
            console.log("[initBankManager] Cargando preset inicial:", initialPatch.name);
            window.triggerMidiDump(initialPatch);
        }
    }
}

function parseSyxFile(bytes) {
    var patchSize = 291;
    var num = Math.floor(bytes.length / patchSize);
    if (num === 0) return { patches: [], isSinglePatch: false };
    
    var patches = [];
    for (var i = 0; i < Math.min(128, num); i++) {
        var offset = i * patchSize;
        var packedPayload = bytes.slice(offset + 8, offset + 286);
        var unpackedBytes = window.unpack7to8(packedPayload);
        var patchName = window.extractNameFromRawSysex(bytes, offset) || 'Patch ' + (i + 1);
        patches.push({
            index: i,
            name: patchName,
            unpackedBytes: unpackedBytes,
            meta: window.createDefaultMeta()
        });
    }
    return { patches: patches, isSinglePatch: (num === 1) };
}

function exportSinglePatch(patch, fileName) {
    if (!patch || !patch.unpackedBytes) {
        alert('No patch data to export.');
        return;
    }
    var syxMsg = window.buildSingleSysex(patch);
    var blob = new Blob([syxMsg], { type: 'application/octet-stream' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName || (patch.name.replace(/[^a-zA-Z0-9_\-]/g, '_') + '.syx');
    link.click();
    return true;
}

document.addEventListener('DOMContentLoaded', () => {
    var _fetchBankCancel = false;
    var _fetchBankProgress = 0;
    var _fetchBankTotal = 128;

    function _updateFetchProgress() {
        var lcdText = document.getElementById('lcd-text');
        var fetchBtn = document.getElementById('hw-fetch-from-synth');
        if (!lcdText) return;
        var pct = Math.round(_fetchBankProgress / _fetchBankTotal * 100);
        var barLen = Math.round(_fetchBankProgress / _fetchBankTotal * 20);
        var bar = '\u2588'.repeat(barLen) + '\u2591'.repeat(20 - barLen);
        var html = '<span style="font-size:9px; opacity:0.6;">FETCHING BANK ' + window.currentHwBankLetter + '</span><br>'
            + '<strong style="font-size:11px;">' + _fetchBankProgress + '/' + _fetchBankTotal + '</strong><br>'
            + '<span style="font-size:8px; letter-spacing:1px; color:var(--accent-blue);">' + bar + ' ' + pct + '%</span>';
        window.lcdSafeUpdate(lcdText, html);
        if (fetchBtn) {
            fetchBtn.textContent = 'Fetching ' + _fetchBankProgress + '/' + _fetchBankTotal + '...';
            fetchBtn.style.opacity = '0.7';
        }
    }

    function _onFetchComplete() {
        var lcdText = document.getElementById('lcd-text');
        var fetchBtn = document.getElementById('hw-fetch-from-synth');
        if (lcdText) {
            var html = '<span style="font-size:10px; opacity:0.6;">FETCH COMPLETE</span><br>'
                + '<strong style="color:var(--accent-green);">BANK ' + window.currentHwBankLetter + ' READY</strong>';
            window.lcdSafeUpdate(lcdText, html);
        }
        if (fetchBtn) {
            fetchBtn.textContent = 'Fetch Bank';
            fetchBtn.style.opacity = '1';
        }
        if (typeof window.renderHardwarePatches === 'function') window.renderHardwarePatches();
        _fetchBankCancel = false;
    }

    const fetchHwBtn = document.getElementById('hw-fetch-from-synth');
    if (fetchHwBtn) {
        fetchHwBtn.addEventListener('click', async () => {
            if (!window.dualMidiBridge || !window.dualMidiBridge.midiOutput) {
                alert("Conexión MIDI no disponible. Asegúrate de configurar los puertos en Settings.");
                return;
            }
            
            if (window.dualMidiBridge._bankDumpInProgress) {
                window.dualMidiBridge.cancelBankDump();
                fetchHwBtn.textContent = 'Fetch Bank';
                fetchHwBtn.style.opacity = '1';
                var lcd = document.getElementById('lcd-text');
                if (lcd) lcd.innerText = 'FETCH CANCELLED';
                _fetchBankProgress = 0;
                return;
            }

            _fetchBankCancel = false;
            _fetchBankProgress = 0;
            _fetchBankTotal = 128;

            try {
                const count = await window.dualMidiBridge.requestBankDump(window.currentHwBankLetter, {
                    patchSpacingMs: 35,
                    timeoutMs: 45000,
                    onProgress: (received, total) => {
                        _fetchBankProgress = received;
                        _fetchBankTotal = total;
                        _updateFetchProgress();
                        if (received >= total) {
                            _onFetchComplete();
                        }
                    }
                });
                
                if (count > 0 && count < 128) {
                    var lcdText = document.getElementById('lcd-text');
                    if (lcdText) {
                        var html = '<span style="font-size:9px; opacity:0.6;">FETCH TIMEOUT</span><br>'
                            + '<strong style="color:var(--accent-orange);">RECEIVED ' + count + '/128</strong>';
                        window.lcdSafeUpdate(lcdText, html);
                    }
                    fetchHwBtn.textContent = 'Fetch Bank (' + count + '/' + 128 + ')';
                    fetchHwBtn.style.opacity = '0.7';
                }
            } catch (err) {
                console.error('[BankDump] Error fetching bank:', err);
                var lcdText = document.getElementById('lcd-text');
                if (lcdText) lcdText.innerText = 'FETCH ERROR: ' + err.message;
                fetchHwBtn.textContent = 'Fetch Bank';
                fetchHwBtn.style.opacity = '1';
            }
        });
    }

    const dumpHwBtn = document.getElementById('hw-dump-to-synth');
    if (dumpHwBtn) {
        dumpHwBtn.addEventListener('click', () => {
            if (!window.dualMidiBridge || !window.dualMidiBridge.midiOutput) {
                alert("Conexión MIDI no disponible. Asegúrate de configurar los puertos en Settings.");
                return;
            }

            if (!confirm(`¿Estás seguro de que deseas sobrescribir el banco ${window.currentHwBankLetter} completo en el sintetizador físico?`)) {
                return;
            }

            const patches = window.hardwareBanks[window.currentHwBankLetter];
            for (let i = 0; i < 128; i++) {
                setTimeout(() => {
                    const patch = patches[i];
                    if (patch && patch.unpackedBytes) {
                        const packedPayload = window.pack8to7(patch.unpackedBytes);
                        const sysexMessage = new Uint8Array(291);
                        sysexMessage[0] = 0xF0;
                        sysexMessage[1] = 0x00;
                        sysexMessage[2] = 0x20;
                        sysexMessage[3] = 0x32;
                        sysexMessage[4] = 0x20;
                        sysexMessage[5] = 0x7F;
                        sysexMessage[6] = 0x02;
                        sysexMessage[7] = 0x07;
                        sysexMessage.set(packedPayload, 8);
                        sysexMessage[290] = 0xF7;
                        
                        window.dualMidiBridge.midiOutput.send(sysexMessage);
                    }
                    if (i === 127) {
                        const lcdText = document.getElementById('lcd-text');
                        if (lcdText) lcdText.innerText = "DUMP COMPLETED";
                    }
                }, i * 40);
            }
        });
    }

    var loadInput = document.createElement('input');
    loadInput.type = 'file';
    loadInput.accept = '.syx';
    loadInput.style.display = 'none';
    document.body.appendChild(loadInput);

    var importBtn = document.getElementById('mngr-import-sysex');
    if (importBtn) importBtn.addEventListener('click', function() { loadInput.click(); });

    loadInput.addEventListener('change', function(e) {
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(ev) {
            var bytes = new Uint8Array(ev.target.result);
            var parsed = parseSyxFile(bytes);
            if (parsed.patches.length === 0) {
                alert('SysEx inválido: el archivo no contiene mensajes de programa DeepMind 12.');
                return;
            }

            if (parsed.isSinglePatch) {
                var patch = parsed.patches[0];
                var choice = confirm(
                    'Archivo SysEx individual detectado: "' + patch.name + '"\n\n'
                    + 'Haz clic en OK para cargarlo en el slot actual ('
                    + (window.currentActivePatchIndex + 1) + ' de "' + window.currentActiveBank + '").\n'
                    + 'Cancela para crear un nuevo banco con este único patch.'
                );
                if (choice) {
                    var bank = window.loadedBanks[window.currentActiveBank];
                    if (bank && bank[window.currentActivePatchIndex]) {
                        bank[window.currentActivePatchIndex].name = patch.name;
                        bank[window.currentActivePatchIndex].unpackedBytes = new Uint8Array(patch.unpackedBytes);
                        bank[window.currentActivePatchIndex].meta = patch.meta ? JSON.parse(JSON.stringify(patch.meta)) : window.createDefaultMeta();
                        window.triggerMidiDump(bank[window.currentActivePatchIndex]);
                        
                        if (typeof window.extractAndSaveNewPresetsFromBank === 'function') {
                            window.extractAndSaveNewPresetsFromBank(window.currentActiveBank, [bank[window.currentActivePatchIndex]]);
                        }

                        if (typeof window.renderPatchesForBank === 'function') window.renderPatchesForBank(window.currentActiveBank);
                        if (typeof window._saveUserBanksToStorage === 'function') window._saveUserBanksToStorage();
                        
                        var lcdText = document.getElementById('lcd-text');
                        if (lcdText) {
                            lcdText.innerHTML = '<span style="font-size:10px;opacity:0.6;">IMPORTED SINGLE PATCH</span><br>'
                                + '<strong style="color:var(--accent-green);">' + patch.name.toUpperCase() + '</strong><br>'
                                + '<span style="font-size:9px;color:var(--text-dim);">' + (window.currentActivePatchIndex + 1) + ' of ' + window.currentActiveBank + '</span>';
                        }
                    }
                } else {
                    var bankName = prompt('Nombre para el nuevo banco:', file.name.replace(/\.[^/.]+$/, ''));
                    if (bankName && bankName.trim()) {
                        window.loadedBanks[bankName] = window.createEmptyBank();
                        window.loadedBanks[bankName][0] = patch;
                        window.currentActiveBank = bankName;
                        window.currentActivePatchIndex = 0;

                        if (typeof window.extractAndSaveNewPresetsFromBank === 'function') {
                            window.extractAndSaveNewPresetsFromBank(bankName, [patch]);
                        }

                        if (typeof window.updateLocalBanksDropdown === 'function') window.updateLocalBanksDropdown();
                        if (typeof window.renderPatchesForBank === 'function') window.renderPatchesForBank(window.currentActiveBank);
                        if (typeof window._saveUserBanksToStorage === 'function') window._saveUserBanksToStorage();
                    }
                }
            } else {
                var name = file.name.replace(/\.[^/.]+$/, '');
                window.loadedBanks[name] = parsed.patches;
                window.currentActiveBank = name;

                if (typeof window.extractAndSaveNewPresetsFromBank === 'function') {
                    window.extractAndSaveNewPresetsFromBank(name, parsed.patches);
                }

                if (typeof window.updateLocalBanksDropdown === 'function') window.updateLocalBanksDropdown();
                if (typeof window.renderPatchesForBank === 'function') window.renderPatchesForBank(window.currentActiveBank);
                if (typeof window._saveUserBanksToStorage === 'function') window._saveUserBanksToStorage();
                
                var lcdText = document.getElementById('lcd-text');
                if (lcdText) {
                    lcdText.innerHTML = '<span style="font-size:10px;opacity:0.6;">IMPORTED BANK</span><br>'
                        + '<strong style="color:var(--accent-green);">' + parsed.patches.length + ' PATCHES</strong><br>'
                        + '<span style="font-size:9px;color:var(--text-dim);">' + name.toUpperCase() + '</span>';
                }
            }
        };
        reader.readAsArrayBuffer(file);
        loadInput.value = '';
    });

    const exportBtn = document.getElementById('mngr-export-sysex');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const patches = window.loadedBanks[window.currentActiveBank];
            const outputBytes = new Uint8Array(128 * 291);
            for (let i = 0; i < 128; i++) {
                const patch = patches[i];
                const offset = i * 291;
                outputBytes[offset] = 0xF0;
                outputBytes[offset+1] = 0x00;
                outputBytes[offset+2] = 0x20;
                outputBytes[offset+3] = 0x32;
                outputBytes[offset+4] = 0x20;
                outputBytes[offset+5] = 0x7F;
                outputBytes[offset+6] = 0x02;
                outputBytes[offset+7] = 0x07;
                
                const packed = window.pack8to7(patch.unpackedBytes);
                outputBytes.set(packed, offset + 8);
                outputBytes[offset+290] = 0xF7;
            }
            const blob = new Blob([outputBytes], { type: 'application/octet-stream' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${window.currentActiveBank}.syx`;
            link.click();
        });
    }
});

window.loadAllFactoryBanksNatively = loadAllFactoryBanksNatively;
window.parseSyxFile = parseSyxFile;
window.exportSinglePatch = exportSinglePatch;
