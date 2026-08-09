/**
 * @purpose SysEx paste from clipboard logic extracted from browser_io.js.
 * Contains pasteSysexFromClipboard() — manages the paste modal, validates, and applies SysEx data.
 *
 * @depends browser_io_parse.js (parseSysexText, parseSysexBytes)
 * @depends browser_persistence.js (createDefaultMeta, _saveUserBanksToStorage)
 */

/* global parseSysexText, parseSysexBytes */

/**
 * Open the paste SysEx modal, let the user paste hex text, parse it, and apply to a bank slot.
 * @param {string} [targetBankName] - Target bank name (defaults to currentActiveBank)
 * @param {number} [targetPatchIndex] - Target patch index (defaults to currentActivePatchIndex)
 * @returns {boolean} false if bank is factory-locked or modal elements missing
 */
function pasteSysexFromClipboard(targetBankName, targetPatchIndex) {
    const bankName = targetBankName || window.currentActiveBank;
    const patchIdx = (targetPatchIndex !== undefined && targetPatchIndex !== null && targetPatchIndex >= 0)
        ? targetPatchIndex
        : (window.currentActivePatchIndex >= 0 ? window.currentActivePatchIndex : 0);

    const FACTORY_BANKS_LIST = [
        'Factory Bank A', 'Factory Bank B', 'Factory Bank C', 'Factory Bank D',
        'Factory Bank E', 'Factory Bank F', 'Factory Bank G', 'Factory Bank H'
    ];

    if (FACTORY_BANKS_LIST.indexOf(bankName) !== -1) {
        alert('No está permitido pegar ni sobreescribir presets en bancos de fábrica.');
        return false;
    }

    const backdrop = document.getElementById('paste-sysex-modal-backdrop');
    const textarea = document.getElementById('paste-sysex-textarea');
    const statusEl = document.getElementById('paste-sysex-status');
    if (statusEl) { statusEl.classList.add('paste-status'); }

    function setPasteStatus(type) {
        if (!statusEl) { return; }
        statusEl.classList.remove('target', 'success', 'warning', 'error');
        statusEl.classList.add(type);
    }

    const applyBtn = document.getElementById('paste-sysex-btn-apply');
    const cancelBtn = document.getElementById('paste-sysex-btn-cancel');
    const closeBtn = document.getElementById('paste-sysex-close-btn');

    if (!backdrop || !textarea) {
        return false;
    }

    textarea.value = '';
    if (statusEl) {
        const slotNum = (patchIdx + 1).toString().padStart(3, '0');
        setPasteStatus('target');
        statusEl.textContent = 'Target: ' + bankName + ' [Slot ' + slotNum + ']';
    }

    backdrop.classList.add('visible-flex');

    // Si Clipboard API está disponible, autocompletar
    if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
        navigator.clipboard.readText().then(function(text) {
            if (text && text.trim()) {
                textarea.value = text.trim();
            }
            setTimeout(function() { textarea.focus(); textarea.select(); }, 50);
        }).catch(function() {
            setTimeout(function() { textarea.focus(); }, 50);
        });
    } else {
        setTimeout(function() { textarea.focus(); }, 50);
    }

    const closeModal = function() {
        backdrop.classList.remove('visible-flex');
    };

    if (closeBtn) { closeBtn.onclick = closeModal; }
    if (cancelBtn) { cancelBtn.onclick = closeModal; }

    const readClipBtn = document.getElementById('paste-sysex-btn-read-clip');
    if (readClipBtn) {
        readClipBtn.onclick = function() {
            if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
                navigator.clipboard.readText().then(function(text) {
                    if (text && text.trim()) {
                        textarea.value = text.trim();
                        if (statusEl) {
                            setPasteStatus('success');
                            statusEl.textContent = '\u{1F4CB} Contenido pegado del portapapeles (' + text.trim().length + ' caracteres)';
                        }
                    } else {
                        if (statusEl) {
                            setPasteStatus('warning');
                            statusEl.textContent = '\u26A0\uFE0F Portapapeles sin texto simple directo. Si usaste Win+V, haz clic dentro del cuadro y pulsa Ctrl+V.';
                        }
                        textarea.focus();
                    }
                }).catch(function() {
                    if (statusEl) {
                        setPasteStatus('warning');
                        statusEl.textContent = '\u26A0\uFE0F Permisos de portapapeles bloqueados. Haz clic en el cuadro de texto y pulsa Ctrl+V para pegar (o Win+V).';
                    }
                    textarea.focus();
                });
            } else {
                if (statusEl) {
                    setPasteStatus('warning');
                    statusEl.textContent = '\u26A0\uFE0F Navegador en contexto no seguro. Haz clic en el cuadro de texto y pulsa Ctrl+V para pegar.';
                }
                textarea.focus();
            }
        };
    }

    if (applyBtn) {
        applyBtn.onclick = function() {
            try {
                const content = textarea.value;
                if (!content || !content.trim()) {
                    if (statusEl) {
                        setPasteStatus('error');
                        statusEl.textContent = '\u26A0\uFE0F Ingresa o pega un texto SysEx Hexadecimal.';
                    }
                    return;
                }

                const rawBytes = parseSysexText(content);
                if (!rawBytes) {
                    if (statusEl) {
                        setPasteStatus('error');
                        statusEl.textContent = '\u26A0\uFE0F Texto no válido. Revisa formato hex.';
                    }
                    return;
                }

                const parsedPatch = parseSysexBytes(rawBytes);
                if (!parsedPatch || !parsedPatch.unpackedBytes) {
                    if (statusEl) {
                        setPasteStatus('error');
                        statusEl.textContent = '\u26A0\uFE0F Formato SysEx incompatible o no se pudo extraer preset.';
                    }
                    return;
                }

                const bank = window.loadedBanks ? window.loadedBanks[bankName] : null;
                if (!bank) {
                    if (statusEl) {
                        setPasteStatus('error');
                        statusEl.textContent = '\u26A0\uFE0F Banco "' + bankName + '" no encontrado.';
                    }
                    return;
                }
                if (!bank[patchIdx]) {
                    if (statusEl) {
                        setPasteStatus('error');
                        statusEl.textContent = '\u26A0\uFE0F Slot ' + patchIdx + ' no válido en "' + bankName + '".';
                    }
                    return;
                }

                const existingPatch = bank[patchIdx];
                const isExistingFilled = existingPatch.unpackedBytes && existingPatch.name && existingPatch.name.indexOf('[Empty Slot') !== 0;

                const doApply = function() {
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
                };

                if (isExistingFilled) {
                    const slotNum = (patchIdx + 1).toString().padStart(3, '0');
                    if (statusEl) {
                        statusEl.innerHTML = '';
                        setPasteStatus('warning');

                        const warnText = document.createElement('span');
                        warnText.textContent = '\u26A0\uFE0F Sobreescribir "' + existingPatch.name + '" (Slot ' + slotNum + ') con "' + parsedPatch.name + '"?  ';
                        statusEl.appendChild(warnText);

                        const confirmBtn = document.createElement('button');
                        confirmBtn.textContent = '\u2705 S\u00ED, sobreescribir';
                        confirmBtn.className = 'btn-confirm';
                        confirmBtn.onclick = function(ev) {
                            ev.stopPropagation();
                            doApply();
                        };
                        statusEl.appendChild(confirmBtn);

                        const denyBtn = document.createElement('button');
                        denyBtn.textContent = '\u274C Cancelar';
                        denyBtn.className = 'btn-deny';
                        denyBtn.onclick = function(ev) {
                            ev.stopPropagation();
                            setPasteStatus('target');
                            statusEl.textContent = 'Target: ' + bankName + ' [Slot ' + slotNum + ']';
                        };
                        statusEl.appendChild(denyBtn);
                    }
                } else {
                    doApply();
                }
            } catch (err) {
                Logger.error('[PasteSysEx] Error in Process & Paste:', err);
                if (statusEl) {
                    setPasteStatus('error');
                    statusEl.textContent = '\u274C Error: ' + err.message;
                }
            }
        };
    }
}

window.pasteSysexFromClipboard = pasteSysexFromClipboard;
