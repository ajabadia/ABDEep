/**
 * @purpose Formatea valores normalizados de parámetros para el LCD.
 * BYTE_MAP data extraída a byte_map_data.js.
 */

/**
 * Formatea el valor normalizado (0–1) de un parámetro para mostrar en el LCD.
 * Usa BYTE_MAP y BRIDGE_PARAM_MAPS para resolver el tipo y devolver un string legible.
 *   toggle → ON / OFF
 *   enum   → label del array enumLabels (respeta rango de ENUM_BYTES)
 *   bipolar → −100 … +100 (centro = 0)
 *   value / time → porcentaje 0–100%
 *   default → porcentaje
 */
window.formatParamValue = function(paramId, normalizedVal) {
    if (typeof normalizedVal !== 'number' || isNaN(normalizedVal)) {return '\u2014';}

    if (paramId === 'lfo1_rate' || paramId === 'lfo2_rate') {
        const rateHz = 0.041 * Math.exp(7.3747 * normalizedVal);
        return rateHz.toFixed(3) + ' Hz';
    }
    if (paramId === 'lfo1_delay' || paramId === 'lfo2_delay') {
        const delaySec = normalizedVal * 6.59;
        return delaySec.toFixed(2) + ' s';
    }
    if (paramId && (paramId.endsWith('_attack') || paramId.endsWith('_decay') || paramId.endsWith('_release'))) {
        const timeSec = 0.002 * Math.pow(10000.0, normalizedVal);
        if (timeSec < 1.0) {
            return Math.round(timeSec * 1000) + ' ms';
        } else {
            return timeSec.toFixed(2) + ' s';
        }
    }

    const p2b = window.BRIDGE_PARAM_MAPS && window.BRIDGE_PARAM_MAPS.PARAM_TO_BYTE_OFFSET;
    const eBytes = window.BRIDGE_PARAM_MAPS && window.BRIDGE_PARAM_MAPS.ENUM_BYTES;
    if (!p2b) {return Math.round(normalizedVal * 100) + '%';}

    const byteOffset = p2b[paramId];
    if (byteOffset === undefined) {return Math.round(normalizedVal * 100) + '%';}

    const entry = window.BYTE_MAP[byteOffset];
    if (!entry) {return Math.round(normalizedVal * 100) + '%';}

    const type = entry.type;

    if (type === 'toggle') {
        return normalizedVal > 0.5 ? 'ON' : 'OFF';
    }

    if (type === 'enum') {
        const maxIdx = eBytes && eBytes[byteOffset] !== undefined ? eBytes[byteOffset] : (entry.enumLabels ? entry.enumLabels.length - 1 : 0);
        const idx = Math.round(normalizedVal * maxIdx);
        if (entry.enumLabels && idx >= 0 && idx < entry.enumLabels.length) {
            return entry.enumLabels[idx];
        }
        return idx.toString();
    }

    if (type === 'bipolar') {
        const signed = Math.round((normalizedVal - 0.5) * 200);
        return (signed >= 0 ? '+' : '') + signed;
    }

    return Math.round(normalizedVal * 100) + '%';
};
