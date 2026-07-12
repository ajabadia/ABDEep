/**
 * Tests for WebUI/js/browser_io.js — SysEx bank importing/parsing and patch export
 *
 * Extracted functions from browser_io.js:
 * - parseSyxFile(bytes): parse raw SysEx bytes into patch array
 * - buildExportData(patch): extract core export logic (sysEx bytes + filename)
 *
 * Extracted helpers from browser_packer.js:
 * - unpack7to8(packedBytes): SysEx 7-to-8 bit unpacking
 * - pack8to7(unpackedBytes): 8-to-7 bit packing
 * - extractNameFromRawSysex(rawSysex, baseOffset): patch name extraction
 *
 * Extracted helpers from browser_persistence.js:
 * - createDefaultMeta(): default patch metadata
 */

// =============================================================================
// Constants (extracted)
// =============================================================================
var SYSEX_HEADER = [0xF0, 0x00, 0x20, 0x32, 0x20, 0x7F, 0x02, 0x07];
var PATCH_SIZE = 291;
var UNPACKED_SIZE = 242;
var HEADER_SIZE = 8;

// =============================================================================
// Extracted helpers from browser_packer.js
// =============================================================================

function unpack7to8(packedBytes) {
    var unpacked = new Uint8Array(UNPACKED_SIZE);
    var writeIdx = 0;
    for (var i = 0; i < packedBytes.length; i += 8) {
        var msbFlags = packedBytes[i];
        for (var k = 1; k < 8; k++) {
            if (i + k >= packedBytes.length) break;
            if (writeIdx >= UNPACKED_SIZE) break;
            var val = packedBytes[i + k];
            if (msbFlags & (1 << (k - 1))) {
                val |= 0x80;
            }
            unpacked[writeIdx++] = val;
        }
    }
    return unpacked;
}

function pack8to7(unpackedBytes) {
    var packed = new Uint8Array(278);
    var readIdx = 0;
    var writeIdx = 0;
    while (readIdx < UNPACKED_SIZE && writeIdx < 278) {
        var msbFlags = 0;
        var startWriteIdx = writeIdx;
        writeIdx++;
        for (var k = 1; k < 8; k++) {
            if (readIdx >= UNPACKED_SIZE) break;
            if (readIdx >= unpackedBytes.length) break;
            var val = unpackedBytes[readIdx++];
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
    var syxMsg = new Uint8Array(PATCH_SIZE);
    for (var i = 0; i < HEADER_SIZE; i++) syxMsg[i] = SYSEX_HEADER[i];
    syxMsg.set(packed, 8);
    syxMsg[290] = 0xF7;
    return syxMsg;
}

// =============================================================================
// Extracted helper from browser_persistence.js
// =============================================================================

function createDefaultMeta() {
    return { category: '', tags: '', favorite: false, dateCreated: Date.now() };
}

// =============================================================================
// Test helpers
// =============================================================================

function makeSequentialUnpacked() {
    var d = new Uint8Array(UNPACKED_SIZE);
    for (var i = 0; i < UNPACKED_SIZE; i++) d[i] = i;
    return d;
}

function makeConstantUnpacked(val) {
    var d = new Uint8Array(UNPACKED_SIZE);
    for (var i = 0; i < UNPACKED_SIZE; i++) d[i] = val;
    return d;
}

function makeHighBitUnpacked() {
    // Every byte has MSB set to test 8-to-7 packing edge cases
    var d = new Uint8Array(UNPACKED_SIZE);
    for (var i = 0; i < UNPACKED_SIZE; i++) d[i] = 0x80 | (i & 0x7F);
    return d;
}

function buildTestPatch(name, unpackedData) {
    if (!unpackedData) {
        unpackedData = makeSequentialUnpacked();
    }
    var packed = pack8to7(unpackedData);
    var sysex = new Uint8Array(PATCH_SIZE);

    for (var i = 0; i < HEADER_SIZE; i++) sysex[i] = SYSEX_HEADER[i];
    sysex.set(packed, 8);

    // Write name at SysEx raw offsets (265-271, 273-279, 281)
    var nameOffsets = [];
    for (var j = 265; j <= 271; j++) nameOffsets.push(j);
    for (var j = 273; j <= 279; j++) nameOffsets.push(j);
    nameOffsets.push(281);

    var nameLen = Math.min(name.length, nameOffsets.length);
    for (var k = 0; k < nameLen; k++) {
        sysex[nameOffsets[k]] = name.charCodeAt(k);
    }
    // Null-terminate after name so extractNameFromRawSysex stops here
    if (nameLen < nameOffsets.length) {
        sysex[nameOffsets[nameLen]] = 0;
    }

    sysex[290] = 0xF7; // End of SysEx
    return sysex;
}

function buildTestBank(numPatches) {
    var totalBytes = numPatches * PATCH_SIZE;
    var bank = new Uint8Array(totalBytes);
    for (var i = 0; i < numPatches; i++) {
        var patch = buildTestPatch('PATCH ' + (i + 1));
        bank.set(patch, i * PATCH_SIZE);
    }
    return bank;
}

// =============================================================================
// Extracted functions from browser_io.js
// =============================================================================

function parseSyxFile(bytes) {
    var patchSize = PATCH_SIZE;
    var num = Math.floor(bytes.length / patchSize);
    if (num === 0) return { patches: [], isSinglePatch: false };

    var patches = [];
    for (var i = 0; i < Math.min(128, num); i++) {
        var offset = i * patchSize;
        var packedPayload = bytes.slice(offset + 8, offset + 286);
        var unpackedBytes = unpack7to8(packedPayload);
        var patchName = extractNameFromRawSysex(bytes, offset) || 'Patch ' + (i + 1);
        patches.push({
            index: i,
            name: patchName,
            unpackedBytes: unpackedBytes,
            meta: createDefaultMeta()
        });
    }
    return { patches: patches, isSinglePatch: (num === 1) };
}

function buildExportData(patch) {
    if (!patch || !patch.unpackedBytes) { return null; }
    var syxMsg = buildSingleSysex(patch);
    return {
        syxBytes: syxMsg,
        fileName: (patch.name || 'untitled').replace(/[^a-zA-Z0-9_\-]/g, '_') + '.syx'
    };
}

// =============================================================================
// Tests
// =============================================================================

// ---------------------------------------------------------------------------
// pack8to7 / unpack7to8 — SysEx bit packing round-trip
// ---------------------------------------------------------------------------

describe('pack8to7 / unpack7to8 round-trip', function () {

    it('pack8to7 returns 278 bytes for 242-byte input', function () {
        var data = makeSequentialUnpacked();
        var packed = pack8to7(data);
        expect(packed.length).toBe(278);
    });

    it('unpack7to8 returns 242 bytes for 278-byte packed input', function () {
        var data = makeSequentialUnpacked();
        var packed = pack8to7(data);
        var unpacked = unpack7to8(packed);
        expect(unpacked.length).toBe(242);
    });

    it('round-trip preserves sequential data [0..241]', function () {
        var original = makeSequentialUnpacked();
        var packed = pack8to7(original);
        var unpacked = unpack7to8(packed);
        for (var i = 0; i < 242; i++) {
            expect(unpacked[i]).toBe(original[i]);
        }
    });

    it('round-trip preserves all-zeros', function () {
        var original = makeConstantUnpacked(0);
        var packed = pack8to7(original);
        var unpacked = unpack7to8(packed);
        for (var i = 0; i < 242; i++) {
            expect(unpacked[i]).toBe(0);
        }
    });

    it('round-trip preserves all-255', function () {
        var original = makeConstantUnpacked(255);
        var packed = pack8to7(original);
        var unpacked = unpack7to8(packed);
        for (var i = 0; i < 242; i++) {
            expect(unpacked[i]).toBe(255);
        }
    });

    it('round-trip preserves bytes with MSB set (0x80-0xFF)', function () {
        var original = makeHighBitUnpacked();
        var packed = pack8to7(original);
        var unpacked = unpack7to8(packed);
        for (var i = 0; i < 242; i++) {
            expect(unpacked[i]).toBe(original[i]);
        }
    });

    it('packed first byte is MSB flags for first group', function () {
        var data = new Uint8Array(242);
        data[0] = 0x80; // Only byte 0 has MSB set
        var packed = pack8to7(data);
        // First group: byte 0 has MSB → bit 0 of msbFlags should be set
        expect(packed[0]).toBe(0x01);
        expect(packed[1]).toBe(0x00); // data[0] with MSB stripped
    });

    it('empty packed input returns zeroed 242-byte array', function () {
        var empty = new Uint8Array(0);
        var result = unpack7to8(empty);
        expect(result.length).toBe(242);
        for (var i = 0; i < 242; i++) {
            expect(result[i]).toBe(0);
        }
    });

});

// ---------------------------------------------------------------------------
// extractNameFromRawSysex — patch name extraction
// ---------------------------------------------------------------------------

describe('extractNameFromRawSysex', function () {

    it('extracts a 15-char name from correct SysEx offsets', function () {
        var sysex = buildTestPatch('TESTPATCH');
        var name = extractNameFromRawSysex(sysex, 0);
        expect(name).toBe('TESTPATCH');
    });

    it('extracts name with spaces and symbols', function () {
        var sysex = buildTestPatch('LEAD_1++');
        var name = extractNameFromRawSysex(sysex, 0);
        expect(name).toBe('LEAD_1++');
    });

    it('returns empty string when all name bytes are null (0)', function () {
        var sysex = buildTestPatch('');
        var name = extractNameFromRawSysex(sysex, 0);
        expect(name).toBe('');
    });

    it('stops at null byte (0)', function () {
        var sysex = buildTestPatch('SHORT');
        // Only write first 5 chars
        var nameOffsets = [];
        for (var j = 265; j <= 271; j++) nameOffsets.push(j);
        for (var j = 273; j <= 279; j++) nameOffsets.push(j);
        nameOffsets.push(281);
        // Set first 5 chars
        for (var k = 0; k < 5; k++) sysex[nameOffsets[k]] = 'S'.charCodeAt(0);
        for (var k = 5; k < nameOffsets.length; k++) sysex[nameOffsets[k]] = 0x20; // space
        sysex[nameOffsets[5]] = 0; // null terminator
        var name = extractNameFromRawSysex(sysex, 0);
        expect(name).toBe('SSSSS');
    });

    it('uses baseOffset for multi-patch banks', function () {
        var bank = buildTestBank(3);
        var name0 = extractNameFromRawSysex(bank, 0);
        var name1 = extractNameFromRawSysex(bank, 291);
        var name2 = extractNameFromRawSysex(bank, 582);
        expect(name0).toBe('PATCH 1');
        expect(name1).toBe('PATCH 2');
        expect(name2).toBe('PATCH 3');
    });

    it('filters non-printable characters (below 32, above 126)', function () {
        var sysex = buildTestPatch('');
        var nameOffsets = [];
        for (var j = 265; j <= 271; j++) nameOffsets.push(j);
        for (var j = 273; j <= 279; j++) nameOffsets.push(j);
        nameOffsets.push(281);
        sysex[nameOffsets[0]] = 65; // 'A'
        sysex[nameOffsets[1]] = 31; // not printable → filtered
        sysex[nameOffsets[2]] = 66; // 'B'
        sysex[nameOffsets[3]] = 127; // not printable (DEL) → filtered
        sysex[nameOffsets[4]] = 67; // 'C'
        sysex[nameOffsets[5]] = 0; // null terminator
        var name = extractNameFromRawSysex(sysex, 0);
        expect(name).toBe('ABC');
    });

});

// ---------------------------------------------------------------------------
// createDefaultMeta
// ---------------------------------------------------------------------------

describe('createDefaultMeta', function () {

    it('returns object with category, tags, favorite, dateCreated', function () {
        var meta = createDefaultMeta();
        expect(meta).toHaveProperty('category');
        expect(meta).toHaveProperty('tags');
        expect(meta).toHaveProperty('favorite');
        expect(meta).toHaveProperty('dateCreated');
    });

    it('favorite defaults to false', function () {
        expect(createDefaultMeta().favorite).toBe(false);
    });

    it('dateCreated is a number (timestamp)', function () {
        expect(typeof createDefaultMeta().dateCreated).toBe('number');
    });

});

// ---------------------------------------------------------------------------
// buildTestPatch — test data generator
// ---------------------------------------------------------------------------

describe('buildTestPatch (test helper)', function () {

    it('generates a 291-byte SysEx message', function () {
        var patch = buildTestPatch('TEST');
        expect(patch.length).toBe(291);
    });

    it('has correct SysEx header (F0 00 20 32 20 7F 02 07)', function () {
        var patch = buildTestPatch('TEST');
        for (var i = 0; i < HEADER_SIZE; i++) {
            expect(patch[i]).toBe(SYSEX_HEADER[i]);
        }
    });

    it('ends with F7 (End of SysEx)', function () {
        var patch = buildTestPatch('TEST');
        expect(patch[290]).toBe(0xF7);
    });

    it('has 278-byte packed payload between header and footer', function () {
        var patch = buildTestPatch('TEST');
        // Payload is bytes 8..285 (278 bytes)
        expect(patch[7]).toBe(0x07); // last header byte
        expect(patch[8]).toBeDefined();
        expect(patch[285]).toBeDefined();
        expect(patch[286]).toBe(0); // padding, should be 0
    });

    it('extractNameFromRawSysex returns the original name', function () {
        var patch = buildTestPatch('MY PAD');
        var name = extractNameFromRawSysex(patch, 0);
        expect(name).toBe('MY PAD');
    });

});

// ---------------------------------------------------------------------------
// buildTestBank — multi-patch test data generator
// ---------------------------------------------------------------------------

describe('buildTestBank (test helper)', function () {

    it('generates correct byte length for N patches', function () {
        expect(buildTestBank(1).length).toBe(291);
        expect(buildTestBank(2).length).toBe(582);
        expect(buildTestBank(4).length).toBe(1164);
        expect(buildTestBank(128).length).toBe(37248);
    });

    it('each patch has correct header', function () {
        var bank = buildTestBank(3);
        for (var i = 0; i < 3; i++) {
            var offset = i * 291;
            expect(bank[offset]).toBe(0xF0);
            expect(bank[offset + 1]).toBe(0x00);
            expect(bank[offset + 7]).toBe(0x07);
            expect(bank[offset + 290]).toBe(0xF7);
        }
    });

});

// ---------------------------------------------------------------------------
// parseSyxFile
// ---------------------------------------------------------------------------

describe('parseSyxFile', function () {

    it('returns empty result for empty input', function () {
        var result = parseSyxFile(new Uint8Array(0));
        expect(result.patches).toEqual([]);
        expect(result.isSinglePatch).toBe(false);
    });

    it('returns empty result for input smaller than one patch', function () {
        var result = parseSyxFile(new Uint8Array(100));
        expect(result.patches).toEqual([]);
        expect(result.isSinglePatch).toBe(false);
    });

    it('parses a single patch correctly', function () {
        var patchData = buildTestPatch('BASS');
        var result = parseSyxFile(patchData);
        expect(result.isSinglePatch).toBe(true);
        expect(result.patches.length).toBe(1);
        expect(result.patches[0].index).toBe(0);
        expect(result.patches[0].name).toBe('BASS');
    });

    it('parses two patches correctly with isSinglePatch=false', function () {
        var bank = buildTestBank(2);
        var result = parseSyxFile(bank);
        expect(result.isSinglePatch).toBe(false);
        expect(result.patches.length).toBe(2);
        expect(result.patches[0].index).toBe(0);
        expect(result.patches[0].name).toBe('PATCH 1');
        expect(result.patches[1].index).toBe(1);
        expect(result.patches[1].name).toBe('PATCH 2');
    });

    it('parses a full 128-patch bank', function () {
        var bank = buildTestBank(128);
        var result = parseSyxFile(bank);
        expect(result.patches.length).toBe(128);
        expect(result.patches[0].name).toBe('PATCH 1');
        expect(result.patches[127].name).toBe('PATCH 128');
    });

    it('limits to 128 patches even if more data exists', function () {
        var bank = buildTestBank(200);
        var result = parseSyxFile(bank);
        expect(result.patches.length).toBe(128);
    });

    it('each patch has unpackedBytes of length 242', function () {
        var bank = buildTestBank(3);
        var result = parseSyxFile(bank);
        for (var i = 0; i < 3; i++) {
            expect(result.patches[i].unpackedBytes.length).toBe(242);
        }
    });

    it('each patch has meta object', function () {
        var patchData = buildTestPatch('TEST');
        var result = parseSyxFile(patchData);
        expect(result.patches[0].meta).toBeDefined();
        expect(result.patches[0].meta.category).toBe('');
        expect(result.patches[0].meta.favorite).toBe(false);
    });

    it('truncated patch data is ignored (floor division)', function () {
        var bank = buildTestBank(2); // 582 bytes
        // Add 200 partial bytes (not enough for 3rd patch)
        var truncated = new Uint8Array(782);
        truncated.set(bank, 0);
        var result = parseSyxFile(truncated);
        expect(result.patches.length).toBe(2);
    });

    it('unpackedBytes round-trips correctly (contains original data)', function () {
        var data = makeSequentialUnpacked();
        var patchData = buildTestPatch('SEQ', data);
        var result = parseSyxFile(patchData);
        var unpacked = result.patches[0].unpackedBytes;
        for (var i = 0; i < Math.min(20, unpacked.length); i++) {
            expect(unpacked[i]).toBe(data[i]);
        }
    });

    it('handles names with special characters', function () {
        var sysex = buildTestPatch('PAD-verb_1');
        var result = parseSyxFile(sysex);
        expect(result.patches[0].name).toBe('PAD-verb_1');
    });

});

// ---------------------------------------------------------------------------
// buildExportData (extracted from exportSinglePatch)
// ---------------------------------------------------------------------------

describe('buildExportData', function () {

    it('returns null for null/undefined patch', function () {
        expect(buildExportData(null)).toBeNull();
        expect(buildExportData(undefined)).toBeNull();
    });

    it('returns null for patch without unpackedBytes', function () {
        expect(buildExportData({ name: 'Test' })).toBeNull();
    });

    it('returns syxBytes with correct SysEx structure', function () {
        var data = makeSequentialUnpacked();
        var patch = { name: 'EXPORT', unpackedBytes: data };
        var result = buildExportData(patch);
        expect(result).not.toBeNull();
        expect(result.syxBytes.length).toBe(291);
        // Header
        for (var i = 0; i < HEADER_SIZE; i++) {
            expect(result.syxBytes[i]).toBe(SYSEX_HEADER[i]);
        }
        // End of SysEx
        expect(result.syxBytes[290]).toBe(0xF7);
    });

    it('generates .syx filename from patch name', function () {
        var patch = { name: 'LEAD_SYNTH', unpackedBytes: makeSequentialUnpacked() };
        var result = buildExportData(patch);
        expect(result.fileName).toBe('LEAD_SYNTH.syx');
    });

    it('sanitizes filename (replaces special chars)', function () {
        var patch = { name: 'My/Patch:Test?', unpackedBytes: makeSequentialUnpacked() };
        var result = buildExportData(patch);
        expect(result.fileName).toBe('My_Patch_Test_.syx');
    });

    it('uses untitled.syx for patches without name', function () {
        var patch = { unpackedBytes: makeSequentialUnpacked() };
        var result = buildExportData(patch);
        expect(result.fileName).toBe('untitled.syx');
    });

    it('packed payload in syxBytes round-trips through unpack', function () {
        var original = makeHighBitUnpacked();
        var patch = { name: 'HIBITS', unpackedBytes: original };
        var result = buildExportData(patch);
        // Extract packed payload from syxBytes and unpack
        var packedPayload = result.syxBytes.slice(8, 286);
        var unpackedBack = unpack7to8(packedPayload);
        for (var i = 0; i < 242; i++) {
            expect(unpackedBack[i]).toBe(original[i]);
        }
    });

});
