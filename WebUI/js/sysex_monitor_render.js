/**
 * @purpose Funciones de renderizado del monitor SysEx: hex byte rendering y
 * contadores de tráfico NRPN. Extraído de sysex_monitor.js.
 */

/** @type {typeof console} */
let Logger = globalThis.Logger || console;

/**
 * Renderiza los bytes en el monitor hexadecimal y resalta el byte modificado.
 * @param {Uint8Array} bytes - Los 242 bytes del preset
 * @param {number} [highlightIndex=-1] - Índice del byte a resaltar transitoriamente
 * @param {string} [patchNameOverride] - Nombre opcional para la etiqueta (usado por RANDOM PATCH)
 */
function updateSysExMonitor(bytes, highlightIndex, patchNameOverride) {
    if (highlightIndex === undefined) {highlightIndex = -1;}
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
        html += '<span class="hex-byte ' + isChanged + '" data-idx="' + i + '" title="Byte ' + i + ': 0x' + hexVal + '">' + hexVal + '</span> ';
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
            patchLabel.innerText = 'LOADED PATCH: ' + patchNameOverride.toUpperCase();
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
            patchLabel.innerText = 'LOADED PATCH: ' + patchName.toUpperCase() + ' [' + activeBankName + ' - SLOT ' + slotStr + ']';
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

Logger.log('[SysexMonitor] Render module loaded');
