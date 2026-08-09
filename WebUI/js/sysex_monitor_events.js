/**
 * @purpose Event wiring for SysEx monitor: zoom, export, copy, reset NRPN,
 * hex byte selection with click/shift+click/ctrl+click.
 * Extraído de sysex_monitor.js. Parsing helpers en sysex_monitor_parse.js.
 */

/** @type {typeof console} */
var Logger = globalThis.Logger || console;

// Registrar eventos de Zoom, Copy, Export, Reset y selección del monitor en el DOM
document.addEventListener('DOMContentLoaded', () => {
    // Zoom / Maximizar el monitor hex
    const zoomBtn = document.getElementById('sysex-zoom-btn');
    const container = document.getElementById('programmer-sysex-monitor');
    if (zoomBtn && container) {
        zoomBtn.classList.add('sysex-btn');
        zoomBtn.classList.add('is-zoom-inactive');
        zoomBtn.addEventListener('click', () => {
            container.classList.toggle('zoomed');
            zoomBtn.classList.toggle('is-zoom-active', container.classList.contains('zoomed'));
            zoomBtn.classList.toggle('is-zoom-inactive', !container.classList.contains('zoomed'));
            zoomBtn.innerText = container.classList.contains('zoomed') ? '\uD83D\uDD0D CLOSE' : '\uD83D\uDD0D ZOOM';
        });
    }

    // Exportar SysEx como archivo .syx
    const exportBtn = document.getElementById('sysex-export-btn');
    if (exportBtn) {
        exportBtn.classList.add('sysex-btn');
        exportBtn.addEventListener('click', () => {
            let bytes = window._lastUnpackedBytes;
            if (!bytes || bytes.length < 242) {
                // Fallback: intentar obtener bytes del patch activo
                const bank = window.loadedBanks && window.loadedBanks[window.currentActiveBank];
                const patch = bank && bank[window.currentActivePatchIndex];
                if (patch && patch.unpackedBytes) {
                    bytes = patch.unpackedBytes;
                }
            }
            if (!bytes || bytes.length < 242) {
                alert('No SysEx data available. Load a patch first.');
                return;
            }
            
            // Construir mensaje SysEx completo: header 8B + packed payload 278B + footer 1B = 291B
            const packed = window.pack8to7(bytes);
            const syxMsg = new Uint8Array(291);
            syxMsg[0] = 0xF0;
            syxMsg[1] = 0x00;
            syxMsg[2] = 0x20;
            syxMsg[3] = 0x32;
            syxMsg[4] = 0x20;
            syxMsg[5] = 0x7F;
            syxMsg[6] = 0x02;
            syxMsg[7] = 0x07;
            syxMsg.set(packed, 8);
            syxMsg[290] = 0xF7;
            
            // Nombre del archivo desde el patch activo o fallback
            const patchName = window._lastPresetName || 'UNKNOWN_PATCH';
            const fileName = patchName.replace(/[^a-zA-Z0-9_\-]/g, '_') + '.syx';
            
            const blob = new Blob([syxMsg], { type: 'application/octet-stream' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            
            // Feedback visual en el botón
            const origText = exportBtn.innerText;
            exportBtn.innerText = '\u2705 EXPORTED';
            exportBtn.classList.add('is-export-done');
            setTimeout(() => {
                exportBtn.innerText = origText;
                exportBtn.classList.remove('is-export-done');
            }, 2000);
        });
    }

    // Resetear contadores NRPN
    const resetBtn = document.getElementById('nrpn-reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (window.dualMidiBridge && window.dualMidiBridge._resetNrpnCounters) {
                window.dualMidiBridge._resetNrpnCounters();
            } else {
                // Fallback: resetear manual
                if (typeof window.updateNrpnTrafficCounters === 'function') {
                    window.updateNrpnTrafficCounters({ tx: 0, rx: 0, pkts: 0 });
                }
            }
        });
    }

    // Registrar callback de tráfico NRPN
    if (window.dualMidiBridge && window.dualMidiBridge._onNrpnTraffic) {
        if (typeof window.updateNrpnTrafficCounters === 'function') {
            window.dualMidiBridge._onNrpnTraffic(window.updateNrpnTrafficCounters);
        }
    }

    // Copiar stream hex al portapapeles (bytes seleccionados o todos)
    const copyBtn = document.getElementById('sysex-copy-btn');
    if (copyBtn) {
        copyBtn.classList.add('sysex-btn');
        copyBtn.addEventListener('click', () => {
            const monitor = document.getElementById('sysex-hex-log');
            if (!monitor) {return;}
            
            let textToCopy;
            const selected = monitor._selectedIndices;
            const bytes = monitor._bytes;
            
            if (selected && selected.length > 0 && bytes) {
                // Copiar solo bytes seleccionados: "IDX:VAL IDX:VAL ..."
                textToCopy = selected.map(function(idx) {
                    const hex = bytes[idx].toString(16).toUpperCase().padStart(2, '0');
                    return idx + ':' + hex;
                }).join(' ');
            } else {
                // Copiar todo el stream
                textToCopy = monitor.innerText || monitor.textContent;
            }
            
            navigator.clipboard.writeText(textToCopy).then(function() {
                const label = selected && selected.length > 0 ? selected.length + ' BYTES' : 'ALL';
                copyBtn.innerText = '\u2705 ' + label;
                copyBtn.classList.add('is-copy-done');
                setTimeout(function() {
                    copyBtn.innerText = 'COPY';
                    copyBtn.classList.remove('is-copy-done');
                }, 1500);
            }).catch(function(err) {
                Logger.error('Error al copiar stream hex: ', err);
            });
        });
    }

    // ── SELECCIÓN DE BYTES EN EL MONITOR HEX ──
    const hexLog = document.getElementById('sysex-hex-log');
    if (hexLog) {
        hexLog.addEventListener('click', function(e) {
            const byteEl = e.target.closest('.hex-byte');
            if (!byteEl) {
                // Click fuera de cualquier byte → deseleccionar todo
                if (hexLog._selectedIndices) {hexLog._selectedIndices = [];}
                hexLog.querySelectorAll('.hex-byte.selected').forEach(function(el) {
                    el.classList.remove('selected');
                });
                const infoEl = document.getElementById('sysex-selection-info');
                if (infoEl) {infoEl.textContent = 'Click a hex byte to select it. Shift+click to select range. Ctrl+click to toggle.';}
                return;
            }
            
            const idx = parseInt(byteEl.getAttribute('data-idx'), 10);
            if (isNaN(idx)) {return;}
            
            if (!hexLog._selectedIndices) {hexLog._selectedIndices = [];}
            
            if (e.shiftKey && hexLog._selectedIndices.length > 0) {
                // Shift+click: seleccionar rango desde el último seleccionado
                const lastIdx = hexLog._selectedIndices[hexLog._selectedIndices.length - 1];
                const start = Math.min(lastIdx, idx);
                const end = Math.max(lastIdx, idx);
                // Agregar todos los bytes en el rango
                for (let si = start; si <= end; si++) {
                    if (hexLog._selectedIndices.indexOf(si) === -1) {
                        hexLog._selectedIndices.push(si);
                        const el = hexLog.querySelector('.hex-byte[data-idx=\"' + si + '\"]');
                        if (el) {el.classList.add('selected');}
                    }
                }
            } else if (e.ctrlKey || e.metaKey) {
                // Ctrl+click: toggle individual
                const existingIdx = hexLog._selectedIndices.indexOf(idx);
                if (existingIdx >= 0) {
                    hexLog._selectedIndices.splice(existingIdx, 1);
                    byteEl.classList.remove('selected');
                } else {
                    hexLog._selectedIndices.push(idx);
                    byteEl.classList.add('selected');
                }
            } else {
                // Click normal: seleccionar solo este byte
                hexLog.querySelectorAll('.hex-byte.selected').forEach(function(el) {
                    el.classList.remove('selected');
                });
                hexLog._selectedIndices = [idx];
                byteEl.classList.add('selected');
            }
            
            // Actualizar información de selección usando el parse helper
            _updateHexSelectionInfo(hexLog);
        });
    }
});

Logger.log('[SysexMonitor] Events module loaded');
