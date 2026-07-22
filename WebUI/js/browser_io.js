/**
 * @purpose Handles loading/fetching factory bank files, exporting banks as SysEx, and handling MIDI dumps to/from hardware.
 * @purpose_en Synthesizer Bank Import/Export and Hardware Fetch/Dump.
 */

async function loadAllFactoryBanksNatively() {
    if (window.dualMidiBridge && typeof window.dualMidiBridge.waitForReady === 'function') {
        await window.dualMidiBridge.waitForReady(10000);
    }
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    for (const letter of letters) {
        const bankName = `Factory Bank ${letter}`;
        window.loadedBanks[bankName] = window.createEmptyBank();
        
        let bytes = null;
        
        if (window.dualMidiBridge && window.dualMidiBridge.isJuce) {
            try {
                const hexStr = await window.dualMidiBridge.readFactoryBankFile(letter);
                console.log(`[BankManager] readFactoryBankFile(${letter}) retornó:`, hexStr ? (hexStr.length + ' caracteres') : 'null/undefined');
                if (hexStr && typeof hexStr === 'string' && hexStr.length > 0) {
                    const cleanHex = hexStr.replace(/\s/g, '');
                    bytes = new Uint8Array(cleanHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
                    console.log(`[BankManager] Banco ${letter} cargado via JUCE nativo: ${bytes.length} bytes`);
                }
            } catch (err) {
                console.warn('[BankManager] Error cargando banco nativo ' + letter + ', intentando fetch...', err);
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
                console.error('[BankManager] Error en fetch de banco de fabrica ' + letter, err);
            }
        }

        if (bytes && bytes.length >= 291) {
            const patchSize = 291;
            const numPatches = Math.floor(bytes.length / patchSize);
            for (let i = 0; i < Math.min(128, numPatches); i++) {
                const offset = i * patchSize;
                const packedPayload = bytes.slice(offset + 10, offset + 288); // Cabecera de 10 bytes, payload de 278 bytes
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
    
    const userBanksLoaded = window._loadUserBanksFromStorage();
    if (!userBanksLoaded) {
        window.loadedBanks['User Bank 1'] = window.createEmptyBank();
    }
    
    window.currentActiveBank = 'Factory Bank A';
    window.currentActivePatchIndex = 0;

    if (typeof window.updateLocalBanksDropdown === 'function') {window.updateLocalBanksDropdown();}
    if (typeof window.renderPatchesForBank === 'function') {window.renderPatchesForBank(window.currentActiveBank);}
    if (typeof window.renderHardwarePatches === 'function') {window.renderHardwarePatches();}

    const initialPatch = window.loadedBanks['Factory Bank A'] && window.loadedBanks['Factory Bank A'][0];
    if (initialPatch) {
        const lcdText = document.getElementById('lcd-text');
        if (lcdText) {lcdText.innerText = initialPatch.name.toUpperCase();}
        if (window.dualMidiBridge && typeof window.dualMidiBridge.waitForReady === 'function') {
            await window.dualMidiBridge.waitForReady(10000);
        }
        if (initialPatch.unpackedBytes) {
            console.log('[initBankManager] Cargando preset inicial:', initialPatch.name);
            // Pequeño delay para que el motor DSP esté completamente inicializado antes del primer dump
            setTimeout(() => {
                window.triggerMidiDump(initialPatch);
            }, 500);
        }
    }
}

function parseSyxFile(bytes) {
    const patchSize = 291;
    const num = Math.floor(bytes.length / patchSize);
    if (num === 0) {return { patches: [], isSinglePatch: false };}
    
    const patches = [];
    for (let i = 0; i < Math.min(128, num); i++) {
        const offset = i * patchSize;
        const packedPayload = bytes.slice(offset + 10, offset + 288); // Cabecera de 10 bytes, payload de 278 bytes
        const unpackedBytes = window.unpack7to8(packedPayload);
        const patchName = window.extractNameFromRawSysex(bytes, offset) || 'Patch ' + (i + 1);
        patches.push({
            index: i,
            name: patchName,
            unpackedBytes: unpackedBytes,
            meta: window.createDefaultMeta()
        });
    }
    return { patches: patches, isSinglePatch: (num === 1) };
}

function parseSysexText(text) {
    if (!text || typeof text !== 'string') {return null;}
    let cleaned = text.trim();
    
    // Si contiene formato "IDX:VAL" producido por el botón COPY del monitor (ej: "0:F0 1:00 2:20 ...")
    if (/\b\d+:[0-9a-fA-F]{1,2}\b/.test(cleaned)) {
        const matches = cleaned.match(/\b(\d+):([0-9a-fA-F]{1,2})\b/g);
        if (matches) {
            const tempMap = {};
            let maxIdx = -1;
            matches.forEach(m => {
                const parts = m.split(':');
                const idx = parseInt(parts[0], 10);
                const val = parseInt(parts[1], 16);
                tempMap[idx] = val;
                if (idx > maxIdx) {maxIdx = idx;}
            });
            if (maxIdx >= 0) {
                const bytes = new Uint8Array(maxIdx + 1);
                for (let i = 0; i <= maxIdx; i++) {
                    bytes[i] = tempMap[i] !== undefined ? tempMap[i] : 0;
                }
                return bytes;
            }
        }
    }

    // Formato normal Hex (con o sin 0x, espacios, saltos de linea)
    cleaned = cleaned.replace(/0x/gi, '').replace(/[\s,;\-\r\n:]+/g, '');
    if (!cleaned) {return null;}
    
    // Si la longitud es impar, descartar el último nibble incompleto para mantener alineación correcta de bytes
    if (cleaned.length % 2 !== 0) {
        cleaned = cleaned.substring(0, cleaned.length - 1);
    }
    if (!cleaned || !/^[0-9a-fA-F]+$/.test(cleaned)) {
        return null;
    }
    const bytes = new Uint8Array(cleaned.length / 2);
    for (let i = 0; i < cleaned.length; i += 2) {
        bytes[i / 2] = parseInt(cleaned.substring(i, i + 2), 16);
    }
    return bytes;
}

function parseSysexBytes(bytes) {
    if (!bytes || !(bytes instanceof Uint8Array) || bytes.length === 0) {return null;}

    // Caso 1: Buffer desempaquetado exacto de 242 bytes (desde el monitor SysEx sin F0/F7)
    if (bytes.length === 242) {
        let patchName = '';
        // En los 242 bytes desempaquetados de DeepMind, los 15 caracteres del nombre están exactamente en las posiciones 223 a 237
        for (let i = 223; i <= 237; i++) {
            const c = bytes[i];
            if (c >= 32 && c < 127) {
                patchName += String.fromCharCode(c);
            } else if (c === 0) {
                break;
            }
        }
        patchName = patchName.trim() || 'Pasted Patch';
        return {
            name: patchName,
            unpackedBytes: new Uint8Array(bytes),
            meta: window.createDefaultMeta ? window.createDefaultMeta() : {}
        };
    }
    
    // Caso 2: Mensajes SysEx estándar (empiezan con F0 y acaban con F7) o volcado empaquetado
    let activeBytes = bytes;
    if (bytes[0] === 0xF0) {
        if (bytes.length >= 291) {
            const parsed = parseSyxFile(bytes);
            if (parsed.patches && parsed.patches.length > 0) {
                return parsed.patches[0];
            }
        } else if (bytes.length >= 40) {
            // SysEx empaquetado genérico DeepMind
            const packedPayload = bytes.slice(10, Math.min(bytes.length - 1, 288));
            const unpackedBytes = window.unpack7to8 ? window.unpack7to8(packedPayload) : new Uint8Array(242);
            let patchName = window.extractNameFromRawSysex ? window.extractNameFromRawSysex(bytes, 0) : 'Pasted Patch';
            return {
                name: patchName || 'Pasted Patch',
                unpackedBytes: unpackedBytes,
                meta: window.createDefaultMeta ? window.createDefaultMeta() : {}
            };
        }
    }

    // Caso 3: Fallback tolerante para cualquier array Hex de datos (ej. edición manual o copia parcial)
    const padded242 = new Uint8Array(242);
    padded242.set(activeBytes.slice(0, Math.min(activeBytes.length, 242)));
    let patchName = '';
    for (let i = 223; i <= 237; i++) {
        const c = padded242[i];
        if (c >= 32 && c < 127) {
            patchName += String.fromCharCode(c);
        } else if (c === 0) {
            break;
        }
    }
    patchName = patchName.trim() || 'Pasted Patch';
    return {
        name: patchName,
        unpackedBytes: padded242,
        meta: window.createDefaultMeta ? window.createDefaultMeta() : {}
    };
}

function pasteSysexFromClipboard(targetBankName, targetPatchIndex) {
    const bankName = targetBankName || window.currentActiveBank;
    let patchIdx = (targetPatchIndex !== undefined && targetPatchIndex !== null && targetPatchIndex >= 0) 
        ? targetPatchIndex 
        : (window.currentActivePatchIndex >= 0 ? window.currentActivePatchIndex : 0);

    const FACTORY_BANKS_LIST = [
        'Factory Bank A', 'Factory Bank B', 'Factory Bank C', 'Factory Bank D',
        'Factory Bank E', 'Factory Bank F', 'Factory Bank G', 'Factory Bank H'
    ];

    if (FACTORY_BANKS_LIST.includes(bankName)) {
        alert('No está permitido pegar ni sobreescribir presets en bancos de fábrica.');
        return false;
    }

    const backdrop = document.getElementById('paste-sysex-modal-backdrop');
    const textarea = document.getElementById('paste-sysex-textarea');
    const statusEl = document.getElementById('paste-sysex-status');
    const applyBtn = document.getElementById('paste-sysex-btn-apply');
    const clearBtn = document.getElementById('paste-sysex-btn-clear');
    const cancelBtn = document.getElementById('paste-sysex-btn-cancel');
    const closeBtn = document.getElementById('paste-sysex-close-btn');

    if (!backdrop || !textarea) {
        return false;
    }

    // Intentar rellenar el textarea automáticamente con Clipboard API si hay datos
    textarea.value = '';
    if (statusEl) {
        const slotNum = (patchIdx + 1).toString().padStart(3, '0');
        statusEl.style.color = 'var(--accent-teal,#00e5ff)';
        statusEl.textContent = `Target: ${bankName} [Slot ${slotNum}]`;
    }

    backdrop.style.display = 'flex';
    
    // Si Clipboard API está disponible, autocompletar
    if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
        navigator.clipboard.readText().then(text => {
            if (text && text.trim()) {
                textarea.value = text.trim();
            }
            setTimeout(() => { textarea.focus(); textarea.select(); }, 50);
        }).catch(() => {
            setTimeout(() => { textarea.focus(); }, 50);
        });
    } else {
        setTimeout(() => { textarea.focus(); }, 50);
    }

    const closeModal = () => {
        backdrop.style.display = 'none';
    };

    if (closeBtn) {closeBtn.onclick = closeModal;}
    if (cancelBtn) {cancelBtn.onclick = closeModal;}
    const readClipBtn = document.getElementById('paste-sysex-btn-read-clip');
    if (readClipBtn) {
        readClipBtn.onclick = () => {
            if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
                navigator.clipboard.readText().then(text => {
                    if (text && text.trim()) {
                        textarea.value = text.trim();
                        if (statusEl) {
                            statusEl.style.color = 'var(--accent-green,#00ff66)';
                            statusEl.textContent = `📋 Contenido pegado del portapapeles (${text.trim().length} caracteres)`;
                        }
                    } else {
                        if (statusEl) {
                            statusEl.style.color = 'var(--accent-primary,#ff8c00)';
                            statusEl.textContent = '⚠️ Portapapeles sin texto simple directo. Si usaste Win+V, haz clic dentro del cuadro y pulsa Ctrl+V.';
                        }
                        textarea.focus();
                    }
                }).catch(err => {
                    if (statusEl) {
                        statusEl.style.color = 'var(--accent-primary,#ff8c00)';
                        statusEl.textContent = '⚠️ Permisos de portapapeles bloqueados. Haz clic en el cuadro de texto y pulsa Ctrl+V para pegar (o Win+V).';
                    }
                    textarea.focus();
                });
            } else {
                if (statusEl) {
                    statusEl.style.color = 'var(--accent-primary,#ff8c00)';
                    statusEl.textContent = '⚠️ Navegador en contexto no seguro. Haz clic en el cuadro de texto y pulsa Ctrl+V para pegar.';
                }
                textarea.focus();
            }
        };
    }

    if (applyBtn) {
        applyBtn.onclick = () => {
            try {
                console.log('[PasteSysEx] Process & Paste clicked');
                const content = textarea.value;
                if (!content || !content.trim()) {
                    if (statusEl) {
                        statusEl.style.color = 'var(--accent-red,#ff4444)';
                        statusEl.textContent = '⚠️ Ingresa o pega un texto SysEx Hexadecimal.';
                    }
                    return;
                }

                console.log('[PasteSysEx] Parsing text, length:', content.trim().length);
                const rawBytes = parseSysexText(content);
                if (!rawBytes) {
                    if (statusEl) {
                        statusEl.style.color = 'var(--accent-red,#ff4444)';
                        statusEl.textContent = '⚠️ Texto no válido. Revisa formato hex.';
                    }
                    return;
                }
                console.log('[PasteSysEx] Raw bytes parsed, length:', rawBytes.length);

                const parsedPatch = parseSysexBytes(rawBytes);
                if (!parsedPatch || !parsedPatch.unpackedBytes) {
                    if (statusEl) {
                        statusEl.style.color = 'var(--accent-red,#ff4444)';
                        statusEl.textContent = '⚠️ Formato SysEx incompatible o no se pudo extraer preset.';
                    }
                    return;
                }
                console.log('[PasteSysEx] Parsed patch:', parsedPatch.name, 'bytes:', parsedPatch.unpackedBytes.length);

                const bank = window.loadedBanks ? window.loadedBanks[bankName] : null;
                if (!bank) {
                    console.error('[PasteSysEx] Bank not found:', bankName, 'Available:', Object.keys(window.loadedBanks || {}));
                    if (statusEl) {
                        statusEl.style.color = 'var(--accent-red,#ff4444)';
                        statusEl.textContent = `⚠️ Banco "${bankName}" no encontrado.`;
                    }
                    return;
                }
                if (!bank[patchIdx]) {
                    console.error('[PasteSysEx] Patch slot not found:', patchIdx, 'bank length:', bank.length);
                    if (statusEl) {
                        statusEl.style.color = 'var(--accent-red,#ff4444)';
                        statusEl.textContent = `⚠️ Slot ${patchIdx} no válido en "${bankName}".`;
                    }
                    return;
                }

                const existingPatch = bank[patchIdx];
                const isExistingFilled = existingPatch.unpackedBytes && existingPatch.name && !existingPatch.name.startsWith('[Empty Slot');

                // Función que realiza el pegado efectivo
                const doApply = () => {
                    bank[patchIdx].name = parsedPatch.name;
                    bank[patchIdx].unpackedBytes = new Uint8Array(parsedPatch.unpackedBytes);
                    bank[patchIdx].meta = parsedPatch.meta ? JSON.parse(JSON.stringify(parsedPatch.meta)) : (window.createDefaultMeta ? window.createDefaultMeta() : {});

                    if (typeof window.renderPatchesForBank === 'function') {
                        window.renderPatchesForBank(bankName);
                    }
                    if (typeof window._saveUserBanksToStorage === 'function') {
                        window._saveUserBanksToStorage();
                    }

                    closeModal();
                    console.log('[PasteSysEx] ✅ Patch pasted successfully:', parsedPatch.name);
                };

                if (isExistingFilled) {
                    // Mostrar confirmación inline en el statusEl en lugar de confirm() nativo
                    const slotNum = (patchIdx + 1).toString().padStart(3, '0');
                    if (statusEl) {
                        statusEl.innerHTML = '';
                        statusEl.style.color = 'var(--accent-primary,#ff8c00)';

                        const warnText = document.createElement('span');
                        warnText.textContent = `⚠️ Sobreescribir "${existingPatch.name}" (Slot ${slotNum}) con "${parsedPatch.name}"?  `;
                        statusEl.appendChild(warnText);

                        const confirmBtn = document.createElement('button');
                        confirmBtn.textContent = '✅ Sí, sobreescribir';
                        confirmBtn.style.cssText = 'background:var(--accent-green,#00ff66);color:#000;border:none;padding:4px 12px;border-radius:4px;cursor:pointer;font-weight:bold;margin-right:8px;';
                        confirmBtn.onclick = (ev) => {
                            ev.stopPropagation();
                            doApply();
                        };
                        statusEl.appendChild(confirmBtn);

                        const denyBtn = document.createElement('button');
                        denyBtn.textContent = '❌ Cancelar';
                        denyBtn.style.cssText = 'background:var(--accent-red,#ff4444);color:#fff;border:none;padding:4px 12px;border-radius:4px;cursor:pointer;font-weight:bold;';
                        denyBtn.onclick = (ev) => {
                            ev.stopPropagation();
                            statusEl.style.color = 'var(--accent-teal,#00e5ff)';
                            statusEl.textContent = `Target: ${bankName} [Slot ${slotNum}]`;
                        };
                        statusEl.appendChild(denyBtn);
                    }
                } else {
                    // Slot vacío — pegar directamente
                    doApply();
                }
            } catch (err) {
                console.error('[PasteSysEx] Error in Process & Paste:', err);
                if (statusEl) {
                    statusEl.style.color = 'var(--accent-red,#ff4444)';
                    statusEl.textContent = `❌ Error: ${err.message}`;
                }
            }
        };
    }

    return true;
}

function exportSinglePatch(patch, fileName) {
    if (!patch || !patch.unpackedBytes) {
        alert('No patch data to export.');
        return;
    }
    const syxMsg = window.buildSingleSysex(patch);
    const blob = new Blob([syxMsg], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName || (patch.name.replace(/[^a-zA-Z0-9_\-]/g, '_') + '.syx');
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 5000);
    return true;
}

window.parseSysexText = parseSysexText;
window.parseSysexBytes = parseSysexBytes;
window.pasteSysexFromClipboard = pasteSysexFromClipboard;
window.exportSinglePatch = exportSinglePatch;



document.addEventListener('DOMContentLoaded', () => {
    let _fetchBankCancel = false;
    let _fetchBankProgress = 0;
    let _fetchBankTotal = 128;

    function _updateFetchProgress() {
        const lcdText = document.getElementById('lcd-text');
        const fetchBtn = document.getElementById('hw-fetch-from-synth');
        if (!lcdText) {return;}
        const pct = Math.round(_fetchBankProgress / _fetchBankTotal * 100);
        const barLen = Math.round(_fetchBankProgress / _fetchBankTotal * 20);
        const bar = '\u2588'.repeat(barLen) + '\u2591'.repeat(20 - barLen);
        const html = '<span style="font-size:9px; opacity:0.6;">FETCHING BANK ' + window.currentHwBankLetter + '</span><br>'
            + '<strong style="font-size:11px;">' + _fetchBankProgress + '/' + _fetchBankTotal + '</strong><br>'
            + '<span style="font-size:8px; letter-spacing:1px; color:var(--accent-blue);">' + bar + ' ' + pct + '%</span>';
        window.lcdSafeUpdate(lcdText, html);
        if (fetchBtn) {
            fetchBtn.textContent = 'Fetching ' + _fetchBankProgress + '/' + _fetchBankTotal + '...';
            fetchBtn.style.opacity = '0.7';
        }
    }

    function _onFetchComplete() {
        const lcdText = document.getElementById('lcd-text');
        const fetchBtn = document.getElementById('hw-fetch-from-synth');
        if (lcdText) {
            const html = '<span style="font-size:10px; opacity:0.6;">FETCH COMPLETE</span><br>'
                + '<strong style="color:var(--accent-green);">BANK ' + window.currentHwBankLetter + ' READY</strong>';
            window.lcdSafeUpdate(lcdText, html);
        }
        if (fetchBtn) {
            fetchBtn.textContent = 'Fetch Bank';
            fetchBtn.style.opacity = '1';
        }
        if (typeof window.renderHardwarePatches === 'function') {window.renderHardwarePatches();}
        _fetchBankCancel = false;
    }

    const fetchHwBtn = document.getElementById('hw-fetch-from-synth');
    if (fetchHwBtn) {
        fetchHwBtn.addEventListener('click', async () => {
            if (!window.dualMidiBridge || !window.dualMidiBridge.midiOutput) {
                alert('Conexión MIDI no disponible. Asegúrate de configurar los puertos en Settings.');
                return;
            }
            
            if (window.dualMidiBridge._bankDumpInProgress) {
                window.dualMidiBridge.cancelBankDump();
                fetchHwBtn.textContent = 'Fetch Bank';
                fetchHwBtn.style.opacity = '1';
                const lcd = document.getElementById('lcd-text');
                if (lcd) {lcd.innerText = 'FETCH CANCELLED';}
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
                        const html = '<span style="font-size:9px; opacity:0.6;">FETCH TIMEOUT</span><br>'
                            + '<strong style="color:var(--accent-orange);">RECEIVED ' + count + '/128</strong>';
                        window.lcdSafeUpdate(lcdText, html);
                    }
                    fetchHwBtn.textContent = 'Fetch Bank (' + count + '/' + 128 + ')';
                    fetchHwBtn.style.opacity = '0.7';
                }
            } catch (err) {
                console.error('[BankDump] Error fetching bank:', err);
                var lcdText = document.getElementById('lcd-text');
                if (lcdText) {lcdText.innerText = 'FETCH ERROR: ' + err.message;}
                fetchHwBtn.textContent = 'Fetch Bank';
                fetchHwBtn.style.opacity = '1';
            }
        });
    }

    const dumpHwBtn = document.getElementById('hw-dump-to-synth');
    if (dumpHwBtn) {
        dumpHwBtn.addEventListener('click', () => {
            if (!window.dualMidiBridge || !window.dualMidiBridge.midiOutput) {
                alert('Conexión MIDI no disponible. Asegúrate de configurar los puertos en Settings.');
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
                        if (lcdText) {lcdText.innerText = 'DUMP COMPLETED';}
                    }
                }, i * 40);
            }
        });
    }

    const loadInput = document.createElement('input');
    loadInput.type = 'file';
    loadInput.accept = '.syx';
    loadInput.style.display = 'none';
    document.body.appendChild(loadInput);

    const importBtn = document.getElementById('mngr-import-sysex');
    if (importBtn) {importBtn.addEventListener('click', function() { loadInput.click(); });}

    loadInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) {return;}
        const reader = new FileReader();
        reader.onload = function(ev) {
            const bytes = new Uint8Array(ev.target.result);
            const parsed = parseSyxFile(bytes);
            if (parsed.patches.length === 0) {
                alert('SysEx inválido: el archivo no contiene mensajes de programa DeepMind 12.');
                return;
            }

            if (parsed.isSinglePatch) {
                const patch = parsed.patches[0];
                const choice = confirm(
                    'Archivo SysEx individual detectado: "' + patch.name + '"\n\n'
                    + 'Haz clic en OK para cargarlo en el slot actual ('
                    + (window.currentActivePatchIndex + 1) + ' de "' + window.currentActiveBank + '").\n'
                    + 'Cancela para crear un nuevo banco con este único patch.'
                );
                if (choice) {
                    const bank = window.loadedBanks[window.currentActiveBank];
                    if (bank && bank[window.currentActivePatchIndex]) {
                        bank[window.currentActivePatchIndex].name = patch.name;
                        bank[window.currentActivePatchIndex].unpackedBytes = new Uint8Array(patch.unpackedBytes);
                        bank[window.currentActivePatchIndex].meta = patch.meta ? JSON.parse(JSON.stringify(patch.meta)) : window.createDefaultMeta();
                        window.triggerMidiDump(bank[window.currentActivePatchIndex]);
                        
                        if (typeof window.extractAndSaveNewPresetsFromBank === 'function') {
                            window.extractAndSaveNewPresetsFromBank(window.currentActiveBank, [bank[window.currentActivePatchIndex]]);
                        }

                        if (typeof window.renderPatchesForBank === 'function') {window.renderPatchesForBank(window.currentActiveBank);}
                        if (typeof window._saveUserBanksToStorage === 'function') {window._saveUserBanksToStorage();}
                        
                        var lcdText = document.getElementById('lcd-text');
                        if (lcdText) {
                            lcdText.innerHTML = '<span style="font-size:10px;opacity:0.6;">IMPORTED SINGLE PATCH</span><br>'
                                + '<strong style="color:var(--accent-green);">' + patch.name.toUpperCase() + '</strong><br>'
                                + '<span style="font-size:9px;color:var(--text-dim);">' + (window.currentActivePatchIndex + 1) + ' of ' + window.currentActiveBank + '</span>';
                        }
                    }
                } else {
                    const bankName = prompt('Nombre para el nuevo banco:', file.name.replace(/\.[^/.]+$/, ''));
                    if (bankName && bankName.trim()) {
                        window.loadedBanks[bankName] = window.createEmptyBank();
                        window.loadedBanks[bankName][0] = patch;
                        window.currentActiveBank = bankName;
                        window.currentActivePatchIndex = 0;

                        if (typeof window.extractAndSaveNewPresetsFromBank === 'function') {
                            window.extractAndSaveNewPresetsFromBank(bankName, [patch]);
                        }

                        if (typeof window.updateLocalBanksDropdown === 'function') {window.updateLocalBanksDropdown();}
                        if (typeof window.renderPatchesForBank === 'function') {window.renderPatchesForBank(window.currentActiveBank);}
                        if (typeof window._saveUserBanksToStorage === 'function') {window._saveUserBanksToStorage();}
                    }
                }
            } else {
                const name = file.name.replace(/\.[^/.]+$/, '');
                window.loadedBanks[name] = parsed.patches;
                window.currentActiveBank = name;

                if (typeof window.extractAndSaveNewPresetsFromBank === 'function') {
                    window.extractAndSaveNewPresetsFromBank(name, parsed.patches);
                }

                if (typeof window.updateLocalBanksDropdown === 'function') {window.updateLocalBanksDropdown();}
                if (typeof window.renderPatchesForBank === 'function') {window.renderPatchesForBank(window.currentActiveBank);}
                if (typeof window._saveUserBanksToStorage === 'function') {window._saveUserBanksToStorage();}
                
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
            setTimeout(() => URL.revokeObjectURL(link.href), 5000);
        });
    }
});

window.loadAllFactoryBanksNatively = loadAllFactoryBanksNatively;
window.parseSyxFile = parseSyxFile;
window.exportSinglePatch = exportSinglePatch;
