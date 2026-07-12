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
            if (i + k >= packedBytes.length) break;
            if (writeIdx >= 242) break;
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
            if (readIdx >= 242) break;
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
    var rawOffsets = [];
    for (var j = 265; j <= 271; j++) rawOffsets.push(j);
    for (var j = 273; j <= 279; j++) rawOffsets.push(j);
    rawOffsets.push(281);
    
    var nameChars = [];
    for (var idx = 0; idx < rawOffsets.length; idx++) {
        var c = rawSysex[baseOffset + rawOffsets[idx]];
        if (c >= 32 && c < 127) {
            nameChars.push(String.fromCharCode(c));
        } else if (c === 0) {
            break;
        }
    }
    return nameChars.join('').trim();
}

function buildSingleSysex(patch) {
    var packed = pack8to7(patch.unpackedBytes);
    var syxMsg = new Uint8Array(291);
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
    return syxMsg;
}

window.unpack7to8 = unpack7to8;
window.pack8to7 = pack8to7;
window.extractNameFromRawSysex = extractNameFromRawSysex;
window.buildSingleSysex = buildSingleSysex;
