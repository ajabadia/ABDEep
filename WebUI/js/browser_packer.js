/**
 * @purpose Handles DeepMind 12 SysEx bit packing (7-to-8 and 8-to-7 bits) and preset name extraction.
 * @purpose_en DeepMind 12 SysEx bit packing and naming utilities.
 */

function unpack7to8(packedBytes) {
    const unpacked = new Uint8Array(242);
    let writeIdx = 0;
    for (let i = 0; i < packedBytes.length; i += 8) {
        const msbFlags = packedBytes[i];
        for (let k = 1; k < 8; k++) {
            if (i + k >= packedBytes.length) {break;}
            if (writeIdx >= 242) {break;}
            let val = packedBytes[i + k];
            if (msbFlags & (1 << (k - 1))) {
                val |= 0x80;
            }
            unpacked[writeIdx++] = val;
        }
    }
    return unpacked;
}

function pack8to7(unpackedBytes) {
    const packed = new Uint8Array(278);
    let readIdx = 0;
    let writeIdx = 0;
    while (readIdx < 242 && writeIdx < 278) {
        let msbFlags = 0;
        const startWriteIdx = writeIdx;
        writeIdx++;
        for (let k = 1; k < 8; k++) {
            if (readIdx >= 242) {break;}
            let val = unpackedBytes[readIdx++];
            if (val & 0x80) {
                msbFlags |= (1 << (k - 1));
                val &= 0x7F;
            }
            packed[startWriteIdx + k] = val;
            writeIdx++;
        }
        packed[startWriteIdx] = msbFlags;
    }
    return packed;
}

function extractNameFromRawSysex(rawSysex, baseOffset) {
    baseOffset = baseOffset || 0;
    // Con cabecera de 10 bytes, el payload empaquetado está desplazado en 2 bytes respecto a la especificación de 8 bytes.
    // Los offsets de los caracteres del nombre de 15 bytes son: 265 (último byte del bloque 31),
    // saltando 266 (prefijo del bloque 32), 267 a 273 (bloque 32), saltando 274 (prefijo del bloque 33), 275 a 281 (bloque 33).
    const rawOffsets = [265];
    for (var j = 267; j <= 273; j++) {rawOffsets.push(j);}
    for (var j = 275; j <= 281; j++) {rawOffsets.push(j);}
    
    const nameChars = [];
    for (let idx = 0; idx < rawOffsets.length; idx++) {
        const c = rawSysex[baseOffset + rawOffsets[idx]];
        if (c >= 32 && c < 127) {
            nameChars.push(String.fromCharCode(c));
        } else if (c === 0) {
            break;
        }
    }
    return nameChars.join('').trim();
}

function buildSingleSysex(patch) {
    const packed = pack8to7(patch.unpackedBytes);
    const syxMsg = new Uint8Array(291);
    syxMsg[0] = 0xF0;
    syxMsg[1] = 0x00;
    syxMsg[2] = 0x20;
    syxMsg[3] = 0x32;
    syxMsg[4] = 0x20;
    syxMsg[5] = 0x7F;
    syxMsg[6] = 0x02;
    syxMsg[7] = 0x07; // Banco por defecto
    syxMsg[8] = 0x00; // Programa por defecto
    syxMsg[9] = 0x00; // Reservado
    syxMsg.set(packed, 10); // Insertar payload a partir del byte 10
    syxMsg[290] = 0xF7;
    return syxMsg;
}

window.unpack7to8 = unpack7to8;
window.pack8to7 = pack8to7;
window.extractNameFromRawSysex = extractNameFromRawSysex;
window.buildSingleSysex = buildSingleSysex;
