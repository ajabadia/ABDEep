/**
 * @purpose Módulo de control interactivo para la pantalla monitora de flujo MIDI SysEx.
 * @purpose_en Control module for the real-time MIDI SysEx stream hexadecimal log display.
 */

// Función principal para renderizar los bytes en el monitor hexadecimal y resaltar el byte modificado
// @param {Uint8Array} bytes - Los 242 bytes del preset
// @param {number} [highlightIndex=-1] - Índice del byte a resaltar transitoriamente
// @param {string} [patchNameOverride] - Nombre opcional para la etiqueta (usado por RANDOM PATCH)
function updateSysExMonitor(bytes, highlightIndex = -1, patchNameOverride) {
    const monitor = document.getElementById('sysex-hex-log');
    if (!monitor) {return;}

    // Guardar referencia a los bytes para selección posterior
    monitor._bytes = bytes;
    // Invalidar buffer de edición en vivo para que se reinicialice desde _lastUnpackedBytes
    window._liveUnpackedBytes = null;

    let html = '';
    
    for (let i = 0; i < bytes.length; i++) {
        const hexVal = bytes[i].toString(16).toUpperCase().padStart(2, '0');
        const isChanged = (i === highlightIndex) ? 'changed' : 'normal';
        html += `<span class="hex-byte ${isChanged}" data-idx="${i}" title="Byte ${i}: 0x${hexVal}">${hexVal}</span> `;
    }

    // Insertar el stream formateado
    monitor.innerHTML = html;

    // Limpiar selección al cargar nuevos bytes
    monitor._selectedIndices = [];
    const infoEl = document.getElementById('sysex-selection-info');
    if (infoEl) {infoEl.textContent = 'Click a hex byte to select it. Shift+click to select range. Ctrl+click to toggle.';}

    // Actualizar la etiqueta dedicada con el nombre del patch y banco activos
    const patchLabel = document.getElementById('sysex-active-patch-label');
    if (patchLabel) {
        // Si se proporciona un nombre directamente (ej: RANDOM PATCH), usarlo
        if (patchNameOverride) {
            patchLabel.innerText = `LOADED PATCH: ${patchNameOverride.toUpperCase()}`;
        } else {
            // Encontrar el patch correspondiente en base al banco activo actual
            const activeBankName = window.currentActiveBank || 'Factory Bank A';
            const activeIdx = window.currentActivePatchIndex !== undefined ? window.currentActivePatchIndex : 0;
            
            let patchName = 'INIT PATCH';
            if (window.loadedBanks && window.loadedBanks[activeBankName] && window.loadedBanks[activeBankName][activeIdx]) {
                patchName = window.loadedBanks[activeBankName][activeIdx].name;
            } else if (window.hardwareBanks && window.currentHwBankLetter && window.hardwareBanks[window.currentHwBankLetter] && window.currentHwPatchIndex !== -1) {
                const hwPatch = window.hardwareBanks[window.currentHwBankLetter][window.currentHwPatchIndex];
                if (hwPatch) {
                    patchName = hwPatch.name;
                }
            }

            const slotStr = (activeIdx !== -1) ? (activeIdx + 1).toString().padStart(3, '0') : '001';
            patchLabel.innerText = `LOADED PATCH: ${patchName.toUpperCase()} [${activeBankName} - SLOT ${slotStr}]`;
        }
        patchLabel.style.display = 'block';
    }

    // Quitar el color naranja temporal tras 1 segundo
    if (highlightIndex !== -1) {
        setTimeout(() => {
            const el = monitor.querySelector('.changed');
            if (el) {el.classList.remove('changed');}
        }, 1000);
    }
}

// Vincular a window para que sea accesible desde otros módulos
window.updateSysExMonitor = updateSysExMonitor;

/**
 * Actualiza los contadores de tráfico NRPN en el monitor SysEx.
 * Llamado por el callback de bridge-dual.js cada vez que se envía/recibe un NRPN.
 */
function updateNrpnTrafficCounters(stats) {
    const txEl = document.getElementById('nrpn-tx-count');
    const rxEl = document.getElementById('nrpn-rx-count');
    const pktEl = document.getElementById('nrpn-pkt-count');
    if (txEl) {txEl.textContent = stats.tx;}
    if (rxEl) {rxEl.textContent = stats.rx;}
    if (pktEl) {pktEl.textContent = stats.pkts;}
}
window.updateNrpnTrafficCounters = updateNrpnTrafficCounters;

// Registrar eventos de Zoom y Copy del monitor en el DOM
document.addEventListener('DOMContentLoaded', () => {
    // Zoom / Maximizar el monitor hex
    const zoomBtn = document.getElementById('sysex-zoom-btn');
    const container = document.getElementById('programmer-sysex-monitor');
    if (zoomBtn && container) {
        zoomBtn.addEventListener('click', () => {
            container.classList.toggle('zoomed');
            if (container.classList.contains('zoomed')) {
                zoomBtn.innerText = '🔍 CLOSE';
                zoomBtn.style.color = 'var(--color-danger)';
                zoomBtn.style.borderColor = 'var(--color-danger)';
                zoomBtn.style.background = 'color-mix(in srgb, var(--color-danger) 15%, transparent)';
            } else {
                zoomBtn.innerText = '🔍 ZOOM';
                zoomBtn.style.color = 'var(--accent-green)';
                zoomBtn.style.borderColor = 'var(--accent-green)';
                zoomBtn.style.background = 'color-mix(in srgb, var(--accent-green) 15%, transparent)';
            }
        });
    }

    // Exportar SysEx como archivo .syx
    const exportBtn = document.getElementById('sysex-export-btn');
    if (exportBtn) {
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
            const packed = pack8to7(bytes);
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
            exportBtn.innerText = '✅ EXPORTED';
            exportBtn.style.color = 'var(--accent-green)';
            exportBtn.style.borderColor = 'var(--accent-green)';
            setTimeout(() => {
                exportBtn.innerText = origText;
                exportBtn.style.color = 'var(--accent-pink)';
                exportBtn.style.borderColor = 'var(--accent-pink)';
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
                updateNrpnTrafficCounters({ tx: 0, rx: 0, pkts: 0 });
            }
        });
    }

    // Registrar callback de tráfico NRPN
    if (window.dualMidiBridge && window.dualMidiBridge._onNrpnTraffic) {
        window.dualMidiBridge._onNrpnTraffic(updateNrpnTrafficCounters);
    }

    // Copiar stream hex al portapapeles (bytes seleccionados o todos)
    const copyBtn = document.getElementById('sysex-copy-btn');
    if (copyBtn) {
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
                copyBtn.innerText = '✅ ' + label;
                copyBtn.style.color = 'var(--accent-green)';
                copyBtn.style.borderColor = 'var(--accent-green)';
                setTimeout(function() {
                    copyBtn.innerText = 'COPY';
                    copyBtn.style.color = '';
                    copyBtn.style.borderColor = '';
                }, 1500);
            }).catch(function(err) {
                console.error('Error al copiar stream hex: ', err);
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
                        const el = hexLog.querySelector('.hex-byte[data-idx="' + si + '"]');
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
            
            // Actualizar información de selección
            _updateHexSelectionInfo(hexLog);
        });
    }
});

/**
 * Actualiza la barra de información de selección mostrando offset, valor,
 * y nombre del parámetro según BYTE_MAP.
 */
function _updateHexSelectionInfo(monitor) {
    const infoEl = document.getElementById('sysex-selection-info');
    if (!infoEl || !monitor || !monitor._selectedIndices) {return;}
    
    const selected = monitor._selectedIndices;
    const bytes = monitor._bytes;
    
    if (selected.length === 0) {
        infoEl.textContent = 'Click a hex byte to select it. Shift+click to select range. Ctrl+click to toggle.';
        return;
    }
    
    const parts = [];
    const nm = selected.length;
    
    // Mostrar max 3 bytes en la info, con contador si hay más
    const showIndices = selected.slice(0, 3);
    showIndices.forEach(function(idx) {
        const val = bytes ? bytes[idx] : 0;
        const hex = val.toString(16).toUpperCase().padStart(2, '0');
        // Buscar nombre del parámetro en BYTE_MAP
        let paramName = '';
        const bm = window.BYTE_MAP && window.BYTE_MAP[idx];
        if (bm && bm.param) {
            paramName = ' ' + bm.param;
        }
        parts.push('b[' + idx + ']=0x' + hex + paramName);
    });
    
    let text = parts.join(' | ');
    if (nm > 3) {
        text += ' | … +' + (nm - 3) + ' more';
    }
    infoEl.textContent = text;
}
