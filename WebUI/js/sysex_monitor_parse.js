/**
 * @purpose SysEx hex data parsing and formatting helpers.
 * Extraído de sysex_monitor_events.js.
 * @purpose_en Hex byte selection info, BYTE_MAP lookup.
 */

/**
 * Actualiza la barra de información de selección mostrando offset, valor,
 * y nombre del parámetro según BYTE_MAP.
 * @param {Object} monitor - Object with _selectedIndices (array) and _bytes (array)
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

// No Logger.log here — this is a pure data module, events.js logs its own loaded message
