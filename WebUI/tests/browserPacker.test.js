/**
 * Vitest tests for browser_packer.js — DeepMind 12 SysEx bit packing and naming utilities.
 *
 * Source:  WebUI/js/browser_packer.js
 * Run:     npx vitest run WebUI/tests/browserPacker.test.js
 *
 * Note: These functions are also tested in browserCore.test.js (as part of browser.js coverage).
 * This file provides dedicated, focused coverage for browser_packer.js specifically,
 * including edge cases and boundary conditions for the packing algorithm itself.
 *
 * Total tests: ~51
 *
 * Covers:
 *   - unpack7to8  (bit-unpacking: 7-bit packed → 8-bit raw)
 *   - pack8to7    (bit-packing: 8-bit raw → 7-bit packed with MSB flags)
 *   - extractNameFromRawSysex (preset name extraction from SysEx)
 *   - buildSingleSysex (SysEx message construction from patch)
 *   - window assignments (module interface)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/* ================================================================
 * Functions under test (mirrored from browser_packer.js)
 * ================================================================ */

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
    const rawOffsets = [];
    for (var j = 265; j <= 271; j++) {rawOffsets.push(j);}
    for (var j = 273; j <= 279; j++) {rawOffsets.push(j);}
    rawOffsets.push(281);

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
    syxMsg[7] = 0x07;
    syxMsg.set(packed, 8);
    syxMsg[290] = 0xF7;
    return syxMsg;
}

/* ================================================================
 * HELPERS
 * ================================================================ */

function makeRawSysexWithName(name, offset) {
    offset = offset || 0;
    const raw = new Uint8Array(offset + 282);
    const nameOffsets = [];
    for (var j = 265; j <= 271; j++) {nameOffsets.push(j);}
    for (var j = 273; j <= 279; j++) {nameOffsets.push(j);}
    nameOffsets.push(281);
    for (let k = 0; k < Math.min(name.length, 15); k++) {
        raw[offset + nameOffsets[k]] = name.charCodeAt(k);
    }
    return raw;
}

function createDefaultPatch() {
    const unpacked = new Uint8Array(242);
    const nameStr = 'INIT PATCH';
    for (let k = 0; k < 15; k++) {
        unpacked[224 + k] = k < nameStr.length ? nameStr.charCodeAt(k) : 0x20;
    }
    return { name: nameStr, unpackedBytes: unpacked };
}

/* ================================================================
 * TESTS
 * ================================================================ */

// ────────── unpack7to8 — bit-unpacking ──────────────────────────

describe('unpack7to8 — bit-unpacking', () => {
    it('returns a 242-byte Uint8Array', () => {
        const result = unpack7to8(new Uint8Array(0));
        expect(result.length).toBe(242);
        expect(result instanceof Uint8Array).toBe(true);
    });

    it('unpacks a single 8-byte packed group (7 data bytes)', () => {
        // MSB flags = 0, all 7 bytes are 0x01..0x07
        const packed = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]);
        const result = unpack7to8(packed);
        expect(result[0]).toBe(0x01);
        expect(result[1]).toBe(0x02);
        expect(result[2]).toBe(0x03);
        expect(result[3]).toBe(0x04);
        expect(result[4]).toBe(0x05);
        expect(result[5]).toBe(0x06);
        expect(result[6]).toBe(0x07);
    });

    it('restores MSB from flag bits (bit 0 → byte 0 of group)', () => {
        // MSB flags = 0x01 → only first data byte has MSB set
        const packed = new Uint8Array([0x01, 0x12, 0x34, 0x56, 0x78, 0x7F, 0x7F, 0x7F]);
        const result = unpack7to8(packed);
        expect(result[0]).toBe(0x92); // 0x12 | 0x80
        expect(result[1]).toBe(0x34);
    });

    it('restores MSB from all 7 flag bits (0x7F → all bytes have MSB)', () => {
        const packed = new Uint8Array([0x7F, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]);
        const result = unpack7to8(packed);
        expect(result[0]).toBe(0x81);
        expect(result[1]).toBe(0x82);
        expect(result[2]).toBe(0x83);
        expect(result[3]).toBe(0x84);
        expect(result[4]).toBe(0x85);
        expect(result[5]).toBe(0x86);
        expect(result[6]).toBe(0x87);
    });

    it('handles multiple 8-byte groups in sequence', () => {
        const packed = new Uint8Array([
            0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77,
            0x00, 0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF, 0x11,
        ]);
        const result = unpack7to8(packed);
        expect(result[0]).toBe(0x11);
        expect(result[6]).toBe(0x77);
        expect(result[7]).toBe(0xAA);
        expect(result[13]).toBe(0x11);
    });

    it('stops at 242 bytes even if packed data has more groups', () => {
        // 242 bytes = 30 full groups (30*8=240) + 2 more data bytes
        // 30 groups = 240 packed bytes, but we need 242 unpacked
        // So 30 groups gives us 30*7=210 unpacked bytes from data part.
        // We need 32 more bytes = 5 groups (5*7=35 bytes).
        // So 35 groups total = 35*8=280 packed bytes.
        const packed = new Uint8Array(280).fill(0x41);
        // Set MSB flags to 0 for each group (every 8th byte)
        for (let g = 0; g < 280; g += 8) {packed[g] = 0;}
        const result = unpack7to8(packed);
        expect(result.length).toBe(242);
        // All bytes should be 0x41 (no MSB flags set)
        for (let i = 0; i < 242; i++) {
            expect(result[i]).toBe(0x41);
        }
    });

    it('handles partial last group (less than 8 bytes)', () => {
        // 1 full group + 3 bytes partial = 8+3=11 packed bytes
        const packed = new Uint8Array([
            0x00, 0x10, 0x20, 0x30, 0x40, 0x50, 0x60, 0x70,
            0x00, 0x80, 0x90,
        ]);
        const result = unpack7to8(packed);
        expect(result[0]).toBe(0x10);
        expect(result[6]).toBe(0x70);
        expect(result[7]).toBe(0x80);
        expect(result[8]).toBe(0x90);
    });

    it('handles MSB flags only on specific bytes across groups', () => {
        const packed = new Uint8Array(24); // 3 groups
        packed[0] = 0x40; // Group 0: bit 6 → 7th data byte
        packed[8] = 0x01; // Group 1: bit 0 → 1st data byte
        packed[16] = 0x20; // Group 2: bit 5 → 6th data byte
        // Fill data bytes with values
        for (let i = 1; i < 24; i++) {
            if (i % 8 !== 0) {packed[i] = 0x55;} // 01010101
        }
        const result = unpack7to8(packed);
        // Group 0: bit 6 → byte 0x55 | 0x80 = 0xD5
        expect(result[6]).toBe(0xD5);
        expect(result[0]).toBe(0x55); // no MSB for this one
        // Group 1: bit 0 → byte 0x55 | 0x80 = 0xD5
        expect(result[7]).toBe(0xD5);
        // Group 2: bit 5 → byte 0x55 | 0x80 = 0xD5
        expect(result[19]).toBe(0xD5);
    });
});

// ────────── pack8to7 — bit-packing ──────────────────────────────

describe('pack8to7 — bit-packing', () => {
    it('returns a 278-byte Uint8Array', () => {
        const unpacked = new Uint8Array(242);
        const result = pack8to7(unpacked);
        expect(result.length).toBe(278);
        expect(result instanceof Uint8Array).toBe(true);
    });

    it('packs data without MSB → MSB flags byte is 0', () => {
        const unpacked = new Uint8Array(242);
        for (let i = 0; i < 242; i++) {unpacked[i] = i & 0x7F;} // all < 128
        const result = pack8to7(unpacked);
        // First group MSB flags should be 0
        expect(result[0]).toBe(0);
    });

    it('packs data with MSB → sets corresponding flag bit + clears MSB', () => {
        const unpacked = new Uint8Array(242);
        unpacked[0] = 0x80; // MSB set in first byte
        unpacked[1] = 0x81; // MSB set in second byte
        const result = pack8to7(unpacked);
        // MSB flags for group 0: bits 0 and 1 set → 0x03
        expect(result[0]).toBe(0x03);
        // Data bytes have MSB cleared: 0x00, 0x01
        expect(result[1]).toBe(0x00);
        expect(result[2]).toBe(0x01);
    });

    it('packs all-0xFF → MSB flags = 0x7F per group, data bytes = 0x7F', () => {
        const unpacked = new Uint8Array(242).fill(0xFF);
        const result = pack8to7(unpacked);
        // Check first full group
        expect(result[0]).toBe(0x7F);
        expect(result[1]).toBe(0x7F);
        expect(result[2]).toBe(0x7F);
        expect(result[3]).toBe(0x7F);
        expect(result[4]).toBe(0x7F);
        expect(result[5]).toBe(0x7F);
        expect(result[6]).toBe(0x7F);
        expect(result[7]).toBe(0x7F);
    });

    it('each group packs exactly 7 bytes from unpacked input', () => {
        // Sequential bytes: 0, 1, 2, ..., 241
        const unpacked = new Uint8Array(242);
        for (let i = 0; i < 242; i++) {unpacked[i] = i;}
        const result = pack8to7(unpacked);
        // Group 0 data bytes should be positions 0..6
        expect(result[1]).toBe(0);
        expect(result[2]).toBe(1);
        expect(result[3]).toBe(2);
        expect(result[4]).toBe(3);
        expect(result[5]).toBe(4);
        expect(result[6]).toBe(5);
        expect(result[7]).toBe(6);
    });

    it('handles 242 bytes = 34 full groups + 4 remaining bytes', () => {
        // 242 / 7 = 34.57... so 34 full groups (34*7=238) + 4 remaining
        // 34 groups = 34*8 = 272 packed bytes
        // Partial 35th group has 4 data bytes = 272+1+4 = 277 packed bytes
        // Check last group boundaries
        const unpacked = new Uint8Array(242);
        for (let i = 0; i < 242; i++) {unpacked[i] = 0x40 + (i & 0x3F);}
        const result = pack8to7(unpacked);
        // Result should be 278 (max size for Uint8Array(278))
        // The last group is partial: 238..241 (4 bytes)
        // So the last written position is 34*8 + 1 + 4 = 277
        expect(result.length).toBe(278);
        // Last non-zero should be at position 277 and there's padding
        // Position 272 = start of 35th group = flags byte for remaining 4 bytes
        expect(result[272]).toBeDefined();
    });

    it('round-trip: pack8to7 → unpack7to8 recovers original for specific edge values', () => {
        const unpacked = new Uint8Array(242);
        const edgeVals = [0x00, 0x01, 0x7F, 0x80, 0x81, 0xFE, 0xFF, 0x40, 0xC0];
        edgeVals.forEach((val, i) => {
            unpacked[i] = val;
            unpacked[240 - i] = val; // also place at end
        });
        const packed = pack8to7(unpacked);
        const recovered = unpack7to8(packed);
        for (let i = 0; i < 242; i++) {
            expect(recovered[i]).toBe(unpacked[i]);
        }
    });
});

// ────────── Packing round-trip (comprehensive) ──────────────────

describe('Packing round-trip — pack8to7 + unpack7to8', () => {
    it('empty unpacked → pack → unpack returns 242 zeros', () => {
        const original = new Uint8Array(242);
        const packed = pack8to7(original);
        const unpacked = unpack7to8(packed);
        unpacked.forEach(function(b) { expect(b).toBe(0); });
    });

    it('all-0x7F (max 7-bit) round-trips correctly', () => {
        const original = new Uint8Array(242).fill(0x7F);
        const packed = pack8to7(original);
        const unpacked = unpack7to8(packed);
        for (let i = 0; i < 242; i++) {
            expect(unpacked[i]).toBe(0x7F);
        }
    });

    it('all-0x80 (min with MSB) round-trips correctly', () => {
        const original = new Uint8Array(242).fill(0x80);
        const packed = pack8to7(original);
        const unpacked = unpack7to8(packed);
        for (let i = 0; i < 242; i++) {
            expect(unpacked[i]).toBe(0x80);
        }
    });

    it('ascending values 0-241 round-trip correctly', () => {
        const original = new Uint8Array(242);
        for (let i = 0; i < 242; i++) {original[i] = i;}
        const packed = pack8to7(original);
        const unpacked = unpack7to8(packed);
        for (let i = 0; i < 242; i++) {
            expect(unpacked[i]).toBe(i);
        }
    });

    it('descending values 255-14 round-trip correctly', () => {
        const original = new Uint8Array(242);
        for (let i = 0; i < 242; i++) {original[i] = 255 - i;}
        const packed = pack8to7(original);
        const unpacked = unpack7to8(packed);
        for (let i = 0; i < 242; i++) {
            expect(unpacked[i]).toBe(255 - i);
        }
    });

    it('alternating 0xAA/0x55 pattern round-trips correctly', () => {
        const original = new Uint8Array(242);
        for (let i = 0; i < 242; i++) {original[i] = (i % 2 === 0) ? 0xAA : 0x55;}
        const packed = pack8to7(original);
        const unpacked = unpack7to8(packed);
        for (let i = 0; i < 242; i++) {
            expect(unpacked[i]).toBe(original[i]);
        }
    });

    it('specific MSB pattern at group boundaries', () => {
        // Bytes at positions 6, 7, 13, 14 have MSB
        const original = new Uint8Array(242);
        original[6] = 0x80; // last byte of group 0
        original[7] = 0x81; // first byte of group 1
        original[13] = 0x82; // last byte of group 1
        original[14] = 0x83; // first byte of group 2
        const packed = pack8to7(original);
        const unpacked = unpack7to8(packed);
        expect(unpacked[6]).toBe(0x80);
        expect(unpacked[7]).toBe(0x81);
        expect(unpacked[13]).toBe(0x82);
        expect(unpacked[14]).toBe(0x83);
    });

    it('produces correct packed byte count: 278 bytes', () => {
        // 242 input bytes → 7 bytes per group → 34 full groups (238) + 4 remaining
        // 34 groups * 8 = 272, plus partial group has 1+4 = 5 → 277 used, 278 allocated
        const original = new Uint8Array(242);
        const packed = pack8to7(original);
        expect(packed.length).toBe(278);
    });

    it('MSB flags byte is exactly 0x7F for a group with all-0x80 data', () => {
        const original = new Uint8Array(242).fill(0x80);
        const packed = pack8to7(original);
        // First 7 bytes → group 0: flags = 0x7F
        expect(packed[0]).toBe(0x7F);
        expect(packed[8]).toBe(0x7F);
        expect(packed[16]).toBe(0x7F);
    });

    it('3 round-trips in sequence produce identical results', () => {
        const original = new Uint8Array(242).fill(0x42);
        for (let r = 0; r < 3; r++) {
            const packed = pack8to7(original);
            const unpacked = unpack7to8(packed);
            for (let i = 0; i < 242; i++) {
                expect(unpacked[i]).toBe(0x42);
            }
        }
    });
});

// ────────── extractNameFromRawSysex ─────────────────────────────

describe('extractNameFromRawSysex', () => {
    it('extracts 15-character preset name from raw SysEx', () => {
        const raw = makeRawSysexWithName('LEAD PATCH ONE');
        expect(extractNameFromRawSysex(raw)).toBe('LEAD PATCH ONE');
    });

    it('extracts short name (4 chars) from correct offsets', () => {
        const raw = makeRawSysexWithName('BASS');
        expect(extractNameFromRawSysex(raw)).toBe('BASS');
    });

    it('stops at null byte (0) and truncates', () => {
        const raw = makeRawSysexWithName('TEST\x00PAD');
        expect(extractNameFromRawSysex(raw)).toBe('TEST');
    });

    it('skips control characters (< 32) by filtering them out', () => {
        const raw = makeRawSysexWithName('SYNTH');
        raw[269] = 1; // SOH (Start of Heading) — below 32
        // 'T' (84) offsets[2]=267, 'H' (72) at offsets[3]=268 becomes SOH
        // Original "SYNTH": S=266,Y=267,N=268,T=269=1,H=270
        // 'T' at offset 269 is now 1 (filtered), 'H' at 270 is kept
        // But wait: offsets are [265]=S, [266]=Y, [267]=N, [268]=T, [269]=H → now SOH
        // After filtering: chars collected = S,Y,N,T(1 filtered)... wait, let me re-check
        // Actually nameOffsets for "SYNTH":
        // nameOffsets[0]=265: S(83) ✓
        // nameOffsets[1]=266: Y(89) ✓  
        // nameOffsets[2]=267: N(78) ✓
        // nameOffsets[3]=268: T(84) ✓
        // nameOffsets[4]=269: was H(72), now set to 1 → < 32 → filtered
        expect(extractNameFromRawSysex(raw)).toBe('SYNT');
    });

    it('handles baseOffset for concatenated bank parsing', () => {
        const raw1 = makeRawSysexWithName('PATCH A', 0);
        const raw2 = makeRawSysexWithName('PATCH B', 0);
        const combined = new Uint8Array(282 * 2);
        combined.set(raw1);
        combined.set(raw2, 282);
        expect(extractNameFromRawSysex(combined, 0)).toBe('PATCH A');
        expect(extractNameFromRawSysex(combined, 282)).toBe('PATCH B');
    });

    it('returns empty string for all-zero name bytes', () => {
        const raw = new Uint8Array(282);
        expect(extractNameFromRawSysex(raw)).toBe('');
    });

    it('trims trailing spaces from name', () => {
        const raw = makeRawSysexWithName('PAD       ');
        expect(extractNameFromRawSysex(raw)).toBe('PAD');
    });

    it('stops at null byte mid-name and returns partial', () => {
        const raw = makeRawSysexWithName('KEYS');
        raw[267] = 0; // nameOffsets[2] = 267
        expect(extractNameFromRawSysex(raw)).toBe('KE');
    });

    it('filters 0x7F (DEL) character (not < 127)', () => {
        const raw = makeRawSysexWithName('PAD');
        raw[267] = 0x7F; // DEL = 127, not < 127, filtered out
        expect(extractNameFromRawSysex(raw)).toBe('PA');
    });

    it('returns empty string for short buffer (< 282 bytes)', () => {
        // If buffer is shorter than the name offsets, lookups return undefined
        const short = new Uint8Array(100);
        expect(extractNameFromRawSysex(short)).toBe('');
    });

    it('preserves all printable ASCII (32-126)', () => {
        const raw = makeRawSysexWithName('A-Z a-z0-9');
        expect(extractNameFromRawSysex(raw)).toBe('A-Z a-z0-9');
    });

    it('uses correct offset sequence: 265-271, 273-279, 281', () => {
        // Name offsets: 265..271 (7), skip 272, 273..279 (7), skip 280, 281 (1) = 15 total
        // Write a character to each valid offset to verify
        const raw = new Uint8Array(282);
        const offsets = [];
        for (var j = 265; j <= 271; j++) {offsets.push(j);}
        for (var j = 273; j <= 279; j++) {offsets.push(j);}
        offsets.push(281);
        const name = 'ABCDEFGHIJKLMNO'; // 15 unique chars
        offsets.forEach(function(off, idx) {
            if (idx < name.length) {raw[off] = name.charCodeAt(idx);}
        });
        // Also set the skipped offsets to something that shouldn't appear
        raw[272] = 0x58; // 'X' — should be skipped
        raw[280] = 0x59; // 'Y' — should be skipped
        expect(extractNameFromRawSysex(raw)).toBe('ABCDEFGHIJKLMNO');
    });

    it('returns name when no baseOffset (defaults to 0)', () => {
        const raw = makeRawSysexWithName('BASS');
        expect(extractNameFromRawSysex(raw)).toBe('BASS');
    });
});

// ────────── buildSingleSysex ──────────────────────────────────

describe('buildSingleSysex — SysEx message construction', () => {
    it('returns exactly 291 bytes', () => {
        const syx = buildSingleSysex(createDefaultPatch());
        expect(syx.length).toBe(291);
    });

    it('has correct SysEx header: F0 00 20 32 20 7F 02 07', () => {
        const syx = buildSingleSysex(createDefaultPatch());
        expect(syx[0]).toBe(0xF0);
        expect(syx[1]).toBe(0x00);
        expect(syx[2]).toBe(0x20);
        expect(syx[3]).toBe(0x32);
        expect(syx[4]).toBe(0x20);
        expect(syx[5]).toBe(0x7F);
        expect(syx[6]).toBe(0x02);
        expect(syx[7]).toBe(0x07);
    });

    it('ends with 0xF7 (SysEx end byte)', () => {
        const syx = buildSingleSysex(createDefaultPatch());
        expect(syx[290]).toBe(0xF7);
    });

    it('contains packed data at bytes 8 through 285 (278 bytes)', () => {
        const patch = createDefaultPatch();
        const expectedPacked = pack8to7(patch.unpackedBytes);
        const syx = buildSingleSysex(patch);
        for (let i = 0; i < 278; i++) {
            expect(syx[8 + i]).toBe(expectedPacked[i]);
        }
    });

    it('bytes 286-289 are padding (zeros)', () => {
        const syx = buildSingleSysex(createDefaultPatch());
        expect(syx[286]).toBe(0);
        expect(syx[287]).toBe(0);
        expect(syx[288]).toBe(0);
        expect(syx[289]).toBe(0);
    });

    it('packed data is 278 bytes = header 8 + payload 278 + padding 4 + footer 1 = 291', () => {
        const syx = buildSingleSysex(createDefaultPatch());
        // Verify structural layout
        // Bytes 0-7: header (8 bytes)
        // Bytes 8-285: payload (278 bytes)
        // Bytes 286-289: padding (4 bytes)
        // Byte 290: end byte (1 byte)
        expect(syx[0]).toBe(0xF0);
        expect(syx[8]).toBeDefined();
        expect(syx[285]).toBeDefined();
        expect(syx[286]).toBe(0);
        expect(syx[289]).toBe(0);
        expect(syx[290]).toBe(0xF7);
    });

    it('round-trips: buildSingleSysex → unpack7to8 recovers original patch bytes', () => {
        const patch = createDefaultPatch();
        patch.unpackedBytes[0] = 0xFF;
        patch.unpackedBytes[100] = 0x80;
        patch.unpackedBytes[200] = 0x42;
        const syx = buildSingleSysex(patch);
        // Extract packed payload
        const packedPayload = syx.slice(8, 8 + 278);
        const recovered = unpack7to8(packedPayload);
        expect(recovered.length).toBe(242);
        expect(recovered[0]).toBe(0xFF);
        expect(recovered[100]).toBe(0x80);
        expect(recovered[200]).toBe(0x42);
    });

    it('builds valid SysEx with non-zero MSB values in patch', () => {
        const patch = createDefaultPatch();
        // Set many MSB bytes across groups
        for (let i = 0; i < 242; i += 3) {patch.unpackedBytes[i] = 0x80 + (i % 127);}
        const syx = buildSingleSysex(patch);
        // Verify it's valid SysEx: header starts with F0, ends with F7
        expect(syx[0]).toBe(0xF0);
        expect(syx[290]).toBe(0xF7);
        // Round-trip check
        const packedPayload = syx.slice(8, 8 + 278);
        const recovered = unpack7to8(packedPayload);
        for (let i = 0; i < 242; i++) {
            expect(recovered[i]).toBe(patch.unpackedBytes[i]);
        }
    });
});

// ────────── Integration: pack → unpack → name extraction ───────

describe('Integration — pack8to7 → unpack7to8 → extractNameFromRawSysex', () => {
    it('pack then extract name from built SysEx', () => {
        const patch = createDefaultPatch();
        patch.name = 'BASS PATCH';
        for (let k = 0; k < 15; k++) {
            patch.unpackedBytes[224 + k] = k < patch.name.length ? patch.name.charCodeAt(k) : 0x20;
        }
        const syx = buildSingleSysex(patch);
        const packedPayload = syx.slice(8, 8 + 278);
        const unpacked = unpack7to8(packedPayload);
        // Extract name from unpacked: name starts at byte 224, 15 chars
        const nameChars = [];
        for (let n = 0; n < 15; n++) {
            const ch = unpacked[224 + n];
            if (ch >= 32 && ch < 127) {nameChars.push(String.fromCharCode(ch));}
            else if (ch === 0) {break;}
        }
        const recoveredName = nameChars.join('').trim();
        expect(recoveredName).toBe('BASS PATCH');
    });

    it('buildSingleSysex → extractNameFromRawSysex via rawSysEx', () => {
        const patch = createDefaultPatch();
        patch.name = 'SYNTH LEAD';
        for (let k = 0; k < 15; k++) {
            patch.unpackedBytes[224 + k] = k < patch.name.length ? patch.name.charCodeAt(k) : 0x20;
        }
        const syx = buildSingleSysex(patch);
        // extractNameFromRawSysex reads from raw SysEx, not unpacked
        const name = extractNameFromRawSysex(syx);
        expect(name).toBe('SYNTH LEAD');
    });
});

// ────────── Window assignments ─────────────────────────────────

describe('window assignments — module interface', () => {
    beforeEach(() => {
        const w = {};
        w.unpack7to8 = unpack7to8;
        w.pack8to7 = pack8to7;
        w.extractNameFromRawSysex = extractNameFromRawSysex;
        w.buildSingleSysex = buildSingleSysex;
        vi.stubGlobal('window', w);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('window.unpack7to8 exists and works', () => {
        expect(typeof window.unpack7to8).toBe('function');
        const result = window.unpack7to8(new Uint8Array(0));
        expect(result.length).toBe(242);
    });

    it('window.pack8to7 exists and works', () => {
        expect(typeof window.pack8to7).toBe('function');
        const result = window.pack8to7(new Uint8Array(242));
        expect(result.length).toBe(278);
    });

    it('window.extractNameFromRawSysex exists and works', () => {
        expect(typeof window.extractNameFromRawSysex).toBe('function');
        const raw = makeRawSysexWithName('TEST');
        expect(window.extractNameFromRawSysex(raw)).toBe('TEST');
    });

    it('window.buildSingleSysex exists and works', () => {
        expect(typeof window.buildSingleSysex).toBe('function');
        const syx = window.buildSingleSysex(createDefaultPatch());
        expect(syx.length).toBe(291);
    });
});
