/**
 * @purpose Pure parsing functions for SysEx & JSON data — extracted from browser_io.js.
 * Contains: parseSysexText, parseSysexBytes, parseSyxFile.
 * Pro patch inspection, conversion, compatibility, and import handling extracted to
 * browser_io_parse_import.js.
 * @classification Module/Parsing
 */

/* exported parseSysexText, parseSysexBytes, parseSyxFile */

// ─────────────────────────────────────────────────────────────────────
// parseSysexText: Convierte texto hexadecimal a Uint8Array
// ─────────────────────────────────────────────────────────────────────
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
    
    // Si la longitud es impar, descartar el último nibble incompleto
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

// ─────────────────────────────────────────────────────────────────────
// parseSysexBytes: Parsea varios formatos de bytes SysEx a un patch
// ─────────────────────────────────────────────────────────────────────
function parseSysexBytes(bytes) {
    if (!bytes || !(bytes instanceof Uint8Array) || bytes.length === 0) {return null;}

    // Caso 1: Buffer desempaquetado exacto de 242 bytes
    if (bytes.length === 242) {
        let patchName = '';
        for (let i = 223; i <= 238; i++) {
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
    
    // Caso 2: Mensajes SysEx estándar (F0...F7) o volcado empaquetado
    if (bytes[0] === 0xF0) {
        if (bytes.length >= 291) {
            const parsed = parseSyxFile(bytes);
            if (parsed.patches && parsed.patches.length > 0) {
                return parsed.patches[0];
            }
        } else if (bytes.length >= 40) {
            // SysEx empaquetado genérico DeepMind. Cabecera: 10 bytes para cmd 0x02
            // (Program Dump Response), 8 para cmd 0x04 (Edit Buffer Dump Response).
            const headerLen = (bytes[6] === 0x02) ? 10 : 8;
            const packedPayload = bytes.slice(headerLen, Math.min(bytes.length - 1, headerLen + 278));
            const unpackedBytes = window.unpack7to8 ? window.unpack7to8(packedPayload) : new Uint8Array(242);
            const patchName = window.extractNameFromRawSysex ? window.extractNameFromRawSysex(bytes, 0) : 'Pasted Patch';
            return {
                name: patchName || 'Pasted Patch',
                unpackedBytes: unpackedBytes,
                meta: window.createDefaultMeta ? window.createDefaultMeta() : {}
            };
        }
    }

    // Caso 3: Fallback para cualquier array Hex de datos
    const padded242 = new Uint8Array(242);
    padded242.set(bytes.slice(0, Math.min(bytes.length, 242)));
    let patchName = '';
    for (let i = 223; i <= 238; i++) {
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

// ─────────────────────────────────────────────────────────────────────
// parseSyxFile: Parsea un archivo SysEx (.syx) en un array de patches
// ─────────────────────────────────────────────────────────────────────
function parseSyxFile(bytes) {
    const patchSize = 291;
    const num = Math.floor(bytes.length / patchSize);
    if (num === 0) {return { patches: [], isSinglePatch: false };}
    
    const patches = [];
    for (let i = 0; i < Math.min(128, num); i++) {
        const offset = i * patchSize;
        const packedPayload = bytes.slice(offset + 10, offset + 288);
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

// ── Exportar a globalThis para compatibilidad cross-file ──
globalThis.parseSysexText = parseSysexText;
globalThis.parseSysexBytes = parseSysexBytes;
globalThis.parseSyxFile = parseSyxFile;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        parseSysexText: parseSysexText,
        parseSysexBytes: parseSysexBytes,
        parseSyxFile: parseSyxFile,
    };
}
