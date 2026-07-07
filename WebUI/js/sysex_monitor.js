/**
 * @purpose Módulo de control interactivo para la pantalla monitora de flujo MIDI SysEx.
 * @purpose_en Control module for the real-time MIDI SysEx stream hexadecimal log display.
 */

// Función principal para renderizar los bytes en el monitor hexadecimal y resaltar el byte modificado
function updateSysExMonitor(bytes, highlightIndex = -1) {
    const monitor = document.getElementById('sysex-hex-log');
    if (!monitor) return;

    let html = '';
    const limit = Math.min(bytes.length, 120); // Mostrar hasta 120 bytes para aprovechar el espacio widescreen
    
    for (let i = 0; i < limit; i++) {
        const hexVal = bytes[i].toString(16).toUpperCase().padStart(2, '0');
        const isChanged = (i === highlightIndex) ? 'changed' : 'normal';
        html += `<span class="hex-byte ${isChanged}" title="Byte Offset ${i}">${hexVal}</span> `;
        if ((i + 1) % 30 === 0) html += '<br>'; // Envolver a nueva fila cada 30 bytes para widescreen
    }
    
    if (bytes.length > limit) {
        html += `\n... +${bytes.length - limit} bytes ...`;
    }

    // Insertar el stream formateado
    monitor.innerHTML = html;

    // Actualizar la etiqueta dedicada con el nombre del patch y banco activos
    const patchLabel = document.getElementById('sysex-active-patch-label');
    if (patchLabel) {
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

        const slotStr = (activeIdx !== -1) ? (activeIdx + 1).toString().padStart(3, '0') : "001";
        patchLabel.innerText = `LOADED PATCH: ${patchName.toUpperCase()} [${activeBankName} - SLOT ${slotStr}]`;
        patchLabel.style.display = 'block';
    }

    // Quitar el color naranja temporal tras 1 segundo
    if (highlightIndex !== -1) {
        setTimeout(() => {
            const el = monitor.querySelector('.changed');
            if (el) el.classList.remove('changed');
        }, 1000);
    }
}

// Vincular a window para que sea accesible desde otros módulos
window.updateSysExMonitor = updateSysExMonitor;

// Registrar eventos de Zoom y Copy del monitor en el DOM
document.addEventListener('DOMContentLoaded', () => {
    // Zoom / Maximizar el monitor hex
    const zoomBtn = document.getElementById('sysex-zoom-btn');
    const container = document.getElementById('programmer-sysex-monitor');
    if (zoomBtn && container) {
        zoomBtn.addEventListener('click', () => {
            container.classList.toggle('zoomed');
            if (container.classList.contains('zoomed')) {
                zoomBtn.innerText = "🔍 CLOSE";
                zoomBtn.style.color = "#ff3300";
                zoomBtn.style.borderColor = "#ff3300";
                zoomBtn.style.background = "rgba(255, 51, 0, 0.15)";
            } else {
                zoomBtn.innerText = "🔍 ZOOM";
                zoomBtn.style.color = "#00ff66";
                zoomBtn.style.borderColor = "#00ff66";
                zoomBtn.style.background = "rgba(0, 255, 102, 0.15)";
            }
        });
    }

    // Copiar el stream completo en texto plano al portapapeles
    const copyBtn = document.getElementById('sysex-copy-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const monitor = document.getElementById('sysex-hex-log');
            if (!monitor) return;
            
            // Obtener el texto limpio de bytes
            const textToCopy = monitor.innerText || monitor.textContent;
            navigator.clipboard.writeText(textToCopy).then(() => {
                const originalText = copyBtn.innerText;
                copyBtn.innerText = "COPIED!";
                copyBtn.style.color = "#00ffcc";
                copyBtn.style.borderColor = "#00ffcc";
                setTimeout(() => {
                    copyBtn.innerText = originalText;
                    copyBtn.style.color = "";
                    copyBtn.style.borderColor = "";
                }, 1500);
            }).catch(err => {
                console.error("Error al copiar stream hex: ", err);
            });
        });
    }
});
