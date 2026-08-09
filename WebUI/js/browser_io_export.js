/**
 * @purpose Import/export/IO event handlers for bank operations — extracted from browser_io.js.
 * Handles: SysEx file import, bank export, hardware dump, fetch bank progress UI.
 */

// ── Fetch Bank progress UI helpers ──

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
    const html = '<span class="lcd-sub-sm op-60">FETCHING BANK ' + window.currentHwBankLetter + '</span><br>'
        + '<strong class="lcd-sub">' + _fetchBankProgress + '/' + _fetchBankTotal + '</strong><br>'
        + '<span class="lcd-sub-sm lcd-color-blue fetch-progress-bar">' + bar + ' ' + pct + '%</span>';
    window.lcdSafeUpdate(lcdText, html);
    if (fetchBtn) {
        fetchBtn.textContent = 'Fetching ' + _fetchBankProgress + '/' + _fetchBankTotal + '...';
        fetchBtn.classList.add('is-loading');
    }
}

function _onFetchComplete() {
    const lcdText = document.getElementById('lcd-text');
    const fetchBtn = document.getElementById('hw-fetch-from-synth');
    if (lcdText) {
        const html = '<span class="lcd-label">FETCH COMPLETE</span><br>'
            + '<strong class="lcd-color-green">BANK ' + window.currentHwBankLetter + ' READY</strong>';
        window.lcdSafeUpdate(lcdText, html);
    }
    if (fetchBtn) {
        fetchBtn.textContent = 'Fetch Bank';
        fetchBtn.classList.remove('is-loading');
    }
    if (typeof window.renderHardwarePatches === 'function') {window.renderHardwarePatches();}
    _fetchBankCancel = false;
}

/** Wire all browser I/O event handlers (fetch, dump, import, export) */
window._wireBrowserIOEvents = function() {
    // ── Fetch Bank ──
    const fetchHwBtn = document.getElementById('hw-fetch-from-synth');
    if (fetchHwBtn) {
        fetchHwBtn.addEventListener('click', async () => {
            if (!getBridge() || !getBridge().midiOutput) {
                alert('Conexi\u00F3n MIDI no disponible. Aseg\u00FArate de configurar los puertos en Settings.');
                return;
            }

            if (getBridge()._bankDumpInProgress) {
                getBridge().cancelBankDump();
                fetchHwBtn.textContent = 'Fetch Bank';
                fetchHwBtn.classList.remove('is-loading');
                const lcd = document.getElementById('lcd-text');
                if (lcd) {lcd.innerText = 'FETCH CANCELLED';}
                _fetchBankProgress = 0;
                return;
            }

            _fetchBankCancel = false;
            _fetchBankProgress = 0;
            _fetchBankTotal = 128;

            try {
                const count = await getBridge().requestBankDump(window.currentHwBankLetter, {
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
                    const lcdText = document.getElementById('lcd-text');
                    if (lcdText) {
                        const html = '<span class="lcd-sub-sm op-60">FETCH TIMEOUT</span><br>'
                            + '<strong class="lcd-color-orange">RECEIVED ' + count + '/128</strong>';
                        window.lcdSafeUpdate(lcdText, html);
                    }
                    fetchHwBtn.textContent = 'Fetch Bank (' + count + '/' + 128 + ')';
                    fetchHwBtn.classList.add('is-loading');
                }
            } catch (err) {
                const Logger = globalThis.Logger || console;
                Logger.error('[BankDump] Error fetching bank:', err);
                const lcdText = document.getElementById('lcd-text');
                if (lcdText) {lcdText.innerText = 'FETCH ERROR: ' + err.message;}
                fetchHwBtn.textContent = 'Fetch Bank';
                fetchHwBtn.classList.remove('is-loading');
            }
        });
    }

    // ── Dump to Hardware ──
    const dumpHwBtn = document.getElementById('hw-dump-to-synth');
    if (dumpHwBtn) {
        dumpHwBtn.addEventListener('click', () => {
            if (!getBridge() || !getBridge().midiOutput) {
                alert('Conexi\u00F3n MIDI no disponible. Aseg\u00FArate de configurar los puertos en Settings.');
                return;
            }

            if (!confirm(`\u00BFEst\u00E1s seguro de que deseas sobrescribir el banco ${window.currentHwBankLetter} completo en el sintetizador f\u00EDsico?`)) {
                return;
            }

            if (typeof window._dumpBankToHw === 'function') {
                window._dumpBankToHw(window.currentHwBankLetter, window.hardwareBanks[window.currentHwBankLetter], {
                    onComplete: function() {
                        const lcdText = document.getElementById('lcd-text');
                        if (lcdText) {lcdText.innerText = 'DUMP COMPLETED';}
                    }
                });
            }
        });
    }

    // ── Import .syx File ──
    const loadInput = document.createElement('input');
    loadInput.type = 'file';
    loadInput.accept = '.syx';
    loadInput.classList.add('hidden');
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

            if (typeof window._handleImportSyxResult === 'function') {
                window._handleImportSyxResult(parsed, file.name, {
                    onPatchImported: function(patch) {
                        const lcdText = document.getElementById('lcd-text');
                        if (lcdText) {
                            // Fase 3 (§4.1): patch.name y currentActiveBank son datos externos → escapar
                            lcdText.innerHTML = '<span class="lcd-label">IMPORTED SINGLE PATCH</span><br>'
                                + '<strong class="lcd-color-green">' + escapeHtml(patch.name).toUpperCase() + '</strong><br>'
                                + '<span class="lcd-sub-sm">' + (window.currentActivePatchIndex + 1) + ' of ' + escapeHtml(window.currentActiveBank) + '</span>';
                        }
                    },
                    onBankCreated: function(name) {
                        const lcdText = document.getElementById('lcd-text');
                        if (lcdText) {
                            // Fase 3 (§4.1): name es el nombre de archivo del banco (externo) → escapar
                            lcdText.innerHTML = '<span class="lcd-label">IMPORTED BANK</span><br>'
                                + '<strong class="lcd-color-green">' + parsed.patches.length + ' PATCHES</strong><br>'
                                + '<span class="lcd-sub-sm">' + escapeHtml(name).toUpperCase() + '</span>';
                        }
                    }
                });
            }
        };
        reader.readAsArrayBuffer(file);
        loadInput.value = '';
    });

    // ── Export Bank as .syx ──
    const exportBtn = document.getElementById('mngr-export-sysex');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const patches = window.loadedBanks[window.currentActiveBank];
            const outputBytes = window._buildBankSysex(patches);
            const blob = new Blob([outputBytes], { type: 'application/octet-stream' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = window.currentActiveBank + '.syx';
            link.click();
            setTimeout(() => URL.revokeObjectURL(link.href), 5000);
        });
    }

    window._exportCurrentBankAsSyx = function() {
        const exportBtn = document.getElementById('mngr-export-sysex');
        if (exportBtn) {exportBtn.click();}
    };
};
