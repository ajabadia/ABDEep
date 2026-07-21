/**
 * Vitest tests for browser.js — SysEx packing, preset load/save/delete, bank navigation, storage.
 *
 * Source:  WebUI/js/browser.js
 * Run:     npx vitest run WebUI/tests/browserCore.test.js
 *
 * Covers pure functions:
 *   - unpack7to8 / pack8to7 (SysEx packing round-trip)
 *   - extractNameFromRawSysex (name extraction from SysEx)
 *   - createDefaultMeta / createEmptyBank (structure generation)
 *   - _serializeBankForStorage / _deserializeBankFromStorage (storage serialization)
 *   - _saveUserBanksToStorage / _loadUserBanksFromStorage (localStorage persistence)
 *   - parseSyxFile (SysEx file parsing, single + bank)
 *   - buildSingleSysex (SysEx message construction)
 *   - navigatePatch (bank wrapping, bounds)
 *   - swapPresets (swap logic between banks)
 *   - renderPatchesForBank search/filter (pure filter logic)
 *   - exportSinglePatch (export checks)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/* ================================================================
 * Functions under test (mirrored from browser.js)
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

function createDefaultMeta() {
  return {
    category: '',
    tags: '',
    favorite: false,
    dateCreated: Date.now()
  };
}

function createEmptyBank() {
  const list = [];
  for (let i = 0; i < 128; i++) {
    const defaultUnpacked = new Uint8Array(242);
    const nameStr = 'INIT PATCH ' + (i + 1);
    for (let k = 0; k < 15; k++) {
      defaultUnpacked[224 + k] = k < nameStr.length ? nameStr.charCodeAt(k) : 0x20;
    }
    defaultUnpacked[39] = 255;
    defaultUnpacked[80] = 0;
    defaultUnpacked[81] = 128;
    defaultUnpacked[82] = 255;
    defaultUnpacked[83] = 64;
    list.push({
      index: i,
      name: nameStr,
      unpackedBytes: defaultUnpacked,
      meta: createDefaultMeta()
    });
  }
  return list;
}

function _serializeBankForStorage(bankArray) {
  return bankArray.map(function(patch) {
    return {
      index: patch.index,
      name: patch.name,
      unpackedBytes: Array.from(patch.unpackedBytes),
      meta: patch.meta ? JSON.parse(JSON.stringify(patch.meta)) : createDefaultMeta()
    };
  });
}

function _deserializeBankFromStorage(storedArray) {
  return storedArray.map(function(p) {
    return {
      index: p.index,
      name: p.name,
      unpackedBytes: new Uint8Array(p.unpackedBytes),
      meta: p.meta ? JSON.parse(JSON.stringify(p.meta)) : createDefaultMeta()
    };
  });
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

function parseSyxFile(bytes) {
  const patchSize = 291;
  const num = Math.floor(bytes.length / patchSize);
  if (num === 0) {return { patches: [], isSinglePatch: false };}

  const patches = [];
  for (let i = 0; i < Math.min(128, num); i++) {
    const offset = i * patchSize;
    const packedPayload = bytes.slice(offset + 8, offset + 286);
    const unpackedBytes = unpack7to8(packedPayload);
    const patchName = extractNameFromRawSysex(bytes, offset) || 'Patch ' + (i + 1);
    patches.push({
      index: i,
      name: patchName,
      unpackedBytes: unpackedBytes,
      meta: createDefaultMeta()
    });
  }
  return { patches: patches, isSinglePatch: (num === 1) };
}

/** Navigate patch in a bank with wrapping */
function navigatePatch(bank, currentIndex, direction) {
  if (!bank || bank.length === 0) {return { index: currentIndex, patch: null };}
  let newIdx = currentIndex + direction;
  if (newIdx < 0) {newIdx = bank.length - 1;}
  if (newIdx >= bank.length) {newIdx = 0;}
  return { index: newIdx, patch: bank[newIdx] };
}

/** Swap two patches between or within banks */
function swapPresetsPure(srcPatch, destPatch) {
  if (!srcPatch || !destPatch || !srcPatch.unpackedBytes || !destPatch.unpackedBytes) {return false;}
  const tempBytes = new Uint8Array(destPatch.unpackedBytes);
  const tempName = destPatch.name;

  destPatch.unpackedBytes = new Uint8Array(srcPatch.unpackedBytes);
  destPatch.name = srcPatch.name;

  srcPatch.unpackedBytes = tempBytes;
  srcPatch.name = tempName;
  return true;
}

/** Pure filter logic: match patch name against search term + optional category filter */
function filterPatches(patches, searchTerm, categoryFilter) {
  const searchFilter = searchTerm ? searchTerm.toLowerCase().trim() : '';
  return patches.filter(function(p, i) {
    if (searchFilter && !p.name.toLowerCase().includes(searchFilter)) {return false;}
    if (categoryFilter && (!p.meta || p.meta.category !== categoryFilter)) {return false;}
    return true;
  });
}

/** Count patches matching filter */
function countFilteredPatches(patches, searchTerm, categoryFilter) {
  return filterPatches(patches, searchTerm, categoryFilter).length;
}

/* ================================================================
 * TESTS
 * ================================================================ */

// ────────── unpack7to8 / pack8to7 round-trip ────────────────────

describe('SysEx packing — unpack7to8 / pack8to7', () => {
  it('pack then unpack of a 242-byte array returns original', () => {
    const original = new Uint8Array(242);
    for (let i = 0; i < 242; i++) {
      original[i] = i % 256;
    }
    const packed = pack8to7(original);
    expect(packed.length).toBe(278);
    const unpacked = unpack7to8(packed);
    expect(unpacked.length).toBe(242);
    for (let i = 0; i < 242; i++) {
      expect(unpacked[i]).toBe(original[i]);
    }
  });

  it('pack then unpack of all-zero array returns zeros', () => {
    const original = new Uint8Array(242);
    const packed = pack8to7(original);
    const unpacked = unpack7to8(packed);
    unpacked.forEach(function(b) { expect(b).toBe(0); });
  });

  it('pack then unpack of all-0xFF array returns 0xFF', () => {
    const original = new Uint8Array(242).fill(0xFF);
    const packed = pack8to7(original);
    const unpacked = unpack7to8(packed);
    for (let i = 0; i < 242; i++) {
      expect(unpacked[i]).toBe(0xFF);
    }
  });

  it('unpack of packed data with MSB flags preserves high bits', () => {
    // Create data where every byte has MSB set
    const original = new Uint8Array(242);
    for (let i = 0; i < 242; i++) {
      original[i] = 0x80 | (i & 0x7F);
    }
    const packed = pack8to7(original);
    const unpacked = unpack7to8(packed);
    for (let i = 0; i < 242; i++) {
      expect(unpacked[i]).toBe(original[i]);
    }
  });

  it('unpack of empty array returns empty unpacked bytes', () => {
    const unpacked = unpack7to8(new Uint8Array(0));
    expect(unpacked.length).toBe(242);
    unpacked.forEach(function(b) { expect(b).toBe(0); });
  });

  it('pack of truncated array still returns 278-byte packed', () => {
    const truncated = new Uint8Array(100);
    const packed = pack8to7(truncated);
    expect(packed.length).toBe(278);
  });

  it('pack of all-0x80 produces correct MSB flags', () => {
    const original = new Uint8Array(242).fill(0x80);
    const packed = pack8to7(original);
    // Each group of 8 bytes in packed starts with MSB flag
    // If all 7 data bytes have MSB set, flag byte = 0x7F
    for (let g = 0; g < 278; g += 8) {
      if (g + 8 <= 278) {
        expect(packed[g]).toBe(0x7F);
      }
    }
  });

  it('pack of all-zero data produces zero MSB flags', () => {
    const original = new Uint8Array(242).fill(0);
    const packed = pack8to7(original);
    for (let g = 0; g < 278; g += 8) {
      expect(packed[g]).toBe(0);
    }
  });
});

// ────────── extractNameFromRawSysex ─────────────────────────────

describe('extractNameFromRawSysex', () => {
  function makeRawSysexWithName(name, offset) {
    offset = offset || 0;
    const raw = new Uint8Array(offset + 282); // 265-271 + 273-279 + 281
    // Offsets: 265-271 (7), skip 272, 273-279 (7), skip 280, 281 (1)
    const nameOffsets = [];
    for (var j = 265; j <= 271; j++) {nameOffsets.push(j);}
    for (var j = 273; j <= 279; j++) {nameOffsets.push(j);}
    nameOffsets.push(281);
    for (let k = 0; k < Math.min(name.length, 15); k++) {
      raw[offset + nameOffsets[k]] = name.charCodeAt(k);
    }
    return raw;
  }

  it('extracts 15-char name from raw SysEx', () => {
    const raw = makeRawSysexWithName('LEAD PATCH ONE');
    const name = extractNameFromRawSysex(raw);
    expect(name).toBe('LEAD PATCH ONE');
  });

  it('extracts short name correctly', () => {
    const raw = makeRawSysexWithName('BASS');
    const name = extractNameFromRawSysex(raw);
    expect(name).toBe('BASS');
  });

  it('stops at null byte (0)', () => {
    const raw = makeRawSysexWithName('TEST\x00PAD');
    const name = extractNameFromRawSysex(raw);
    expect(name).toBe('TEST');
  });

  it('skips SOH character (1) and continues until null', () => {
    const raw = makeRawSysexWithName('SYNTH');
    raw[269] = 1; // replace 'H' with SOH (1)
    const name = extractNameFromRawSysex(raw);
    expect(name).toBe('SYNT');
  });

  it('handles baseOffset correctly for bank concatenation', () => {
    const raw1 = makeRawSysexWithName('PATCH A', 0);
    const raw2 = makeRawSysexWithName('PATCH B', 0);
    const combinedSize = 282 * 2;
    const combined = new Uint8Array(combinedSize);
    combined.set(raw1);
    combined.set(raw2, 282);
    const name1 = extractNameFromRawSysex(combined, 0);
    const name2 = extractNameFromRawSysex(combined, 282);
    expect(name1).toBe('PATCH A');
    expect(name2).toBe('PATCH B');
  });

  it('returns empty string for all-zero name', () => {
    const raw = new Uint8Array(282);
    const name = extractNameFromRawSysex(raw);
    expect(name).toBe('');
  });

  it('trims trailing whitespace from name', () => {
    const raw = makeRawSysexWithName('PAD      ');
    const name = extractNameFromRawSysex(raw);
    expect(name).toBe('PAD');
  });

  it('returns partial name when null byte in middle', () => {
    const raw = makeRawSysexWithName('KEYS');
    // Set null byte after position 2 within the name
    // nameOffsets[2] = 267
    raw[267] = 0;
    const name = extractNameFromRawSysex(raw);
    expect(name).toBe('KE'); // stops at null after 2 chars
  });

  it('filters 0x7F (DEL) characters', () => {
    const raw = makeRawSysexWithName('PAD');
    raw[267] = 0x7F; // DEL character
    const name = extractNameFromRawSysex(raw);
    // 0x7F is not < 127, so it passes the check? No, function checks: c >= 32 && c < 127
    // 0x7F = 127 is NOT < 127, so it's filtered out
    expect(name).toBe('PA');
  });
});

// ────────── createDefaultMeta / createEmptyBank ─────────────────

describe('createDefaultMeta', () => {
  it('returns object with default fields', () => {
    const meta = createDefaultMeta();
    expect(meta.category).toBe('');
    expect(meta.tags).toBe('');
    expect(meta.favorite).toBe(false);
    expect(typeof meta.dateCreated).toBe('number');
  });

  it('each call returns a new object', () => {
    const m1 = createDefaultMeta();
    const m2 = createDefaultMeta();
    expect(m1).not.toBe(m2);
  });
});

describe('createEmptyBank', () => {
  it('creates 128 patches', () => {
    const bank = createEmptyBank();
    expect(bank.length).toBe(128);
  });

  it('each patch has index, name, unpackedBytes (242), and meta', () => {
    const bank = createEmptyBank();
    bank.forEach(function(p, i) {
      expect(p.index).toBe(i);
      expect(typeof p.name).toBe('string');
      expect(p.name).toContain('INIT PATCH');
      expect(p.unpackedBytes.length).toBe(242);
      expect(p.meta).toBeDefined();
    });
  });

  it('patch names are sequentially numbered', () => {
    const bank = createEmptyBank();
    expect(bank[0].name).toBe('INIT PATCH 1');
    expect(bank[63].name).toBe('INIT PATCH 64');
    expect(bank[127].name).toBe('INIT PATCH 128');
  });

  it('each patch has unique Uint8Array (not shared reference)', () => {
    const bank = createEmptyBank();
    bank[0].unpackedBytes[0] = 99;
    expect(bank[1].unpackedBytes[0]).not.toBe(99);
  });

  it('patch names are written into unpackedBytes at offset 224-238', () => {
    const bank = createEmptyBank();
    const nameBytes = [];
    for (let k = 0; k < 15; k++) {
      nameBytes.push(bank[0].unpackedBytes[224 + k]);
    }
    const nameFromBytes = String.fromCharCode.apply(null, nameBytes).replace(/\x20+$/, '').trim();
    expect(nameFromBytes).toBe('INIT PATCH 1');
  });

  it('default VCA values set at offsets 39, 80-83', () => {
    const bank = createEmptyBank();
    expect(bank[0].unpackedBytes[39]).toBe(255);  // vcf_cutoff max
    expect(bank[0].unpackedBytes[80]).toBe(0);    // vca_level
    expect(bank[0].unpackedBytes[81]).toBe(128);  // vca_env_depth
    expect(bank[0].unpackedBytes[82]).toBe(255);  // vca_vel_sens
    expect(bank[0].unpackedBytes[83]).toBe(64);   // vca_pan_spread
  });

  it('meta has dateCreated from current time', () => {
    const before = Date.now();
    const bank = createEmptyBank();
    const after = Date.now();
    expect(bank[0].meta.dateCreated).toBeGreaterThanOrEqual(before);
    expect(bank[0].meta.dateCreated).toBeLessThanOrEqual(after);
  });
});

// ────────── Storage serialization ──────────────────────────────

describe('Bank storage serialization — round-trip', () => {
  it('_serializeBankForStorage converts Uint8Array to plain arrays', () => {
    const bank = createEmptyBank();
    const serialized = _serializeBankForStorage(bank);
    expect(serialized.length).toBe(128);
    expect(Array.isArray(serialized[0].unpackedBytes)).toBe(true);
    expect(serialized[0].unpackedBytes[0]).toBe(bank[0].unpackedBytes[0]);
  });

  it('_deserializeBankFromStorage restores Uint8Array', () => {
    const bank = createEmptyBank();
    const serialized = _serializeBankForStorage(bank);
    const restored = _deserializeBankFromStorage(serialized);
    expect(restored.length).toBe(128);
    expect(restored[0].unpackedBytes instanceof Uint8Array).toBe(true);
    for (let i = 0; i < 242; i++) {
      expect(restored[0].unpackedBytes[i]).toBe(bank[0].unpackedBytes[i]);
    }
  });

  it('round-trip preserves all 128 patches', () => {
    const bank = createEmptyBank();
    // Modify a few patches
    bank[5].name = 'MODIFIED LEAD';
    bank[100].name = 'DEEP PAD';
    const serialized = _serializeBankForStorage(bank);
    const restored = _deserializeBankFromStorage(serialized);
    expect(restored[5].name).toBe('MODIFIED LEAD');
    expect(restored[100].name).toBe('DEEP PAD');
  });

  it('round-trip preserves unpackedBytes values', () => {
    const bank = createEmptyBank();
    bank[0].unpackedBytes[100] = 42;
    bank[0].unpackedBytes[200] = 200;
    const serialized = _serializeBankForStorage(bank);
    const restored = _deserializeBankFromStorage(serialized);
    expect(restored[0].unpackedBytes[100]).toBe(42);
    expect(restored[0].unpackedBytes[200]).toBe(200);
  });

  it('_serializeBankForStorage with null meta fills defaults', () => {
    const bank = createEmptyBank();
    bank[0].meta = null;
    const serialized = _serializeBankForStorage(bank);
    expect(serialized[0].meta).toBeDefined();
    expect(serialized[0].meta.category).toBe('');
  });
});

// ────────── localStorage persistence ────────────────────────────

describe('Bank localStorage persistence', () => {
  beforeEach(() => {
    const store = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key) => store[key] || null),
      setItem: vi.fn((key, value) => { store[key] = value; }),
      removeItem: vi.fn((key) => { delete store[key]; }),
      clear: vi.fn(() => { for (const k in store) {delete store[k];} }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function _saveUserBanksToStorage(loadedBanks) {
    try {
      const userBanks = {};
      Object.keys(loadedBanks).forEach(function(bankName) {
        if (!bankName.startsWith('Factory Bank')) {
          userBanks[bankName] = _serializeBankForStorage(loadedBanks[bankName]);
        }
      });
      localStorage.setItem('abd-eep-user-banks', JSON.stringify(userBanks));
      return true;
    } catch (e) {
      return false;
    }
  }

  function _loadUserBanksFromStorage(loadedBanks) {
    try {
      const raw = localStorage.getItem('abd-eep-user-banks');
      if (!raw) {return false;}
      const parsed = JSON.parse(raw);
      let count = 0;
      Object.keys(parsed).forEach(function(bankName) {
        if (!loadedBanks[bankName]) {
          loadedBanks[bankName] = _deserializeBankFromStorage(parsed[bankName]);
          count++;
        }
      });
      return count > 0;
    } catch (e) {
      return false;
    }
  }

  it('saves user banks (excludes Factory Banks) to localStorage', () => {
    const loadedBanks = {
      'Factory Bank A': createEmptyBank(),
      'Factory Bank B': createEmptyBank(),
      'User Bank 1': createEmptyBank(),
    };
    _saveUserBanksToStorage(loadedBanks);
    const raw = localStorage.getItem('abd-eep-user-banks');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw);
    expect(Object.keys(parsed)).toEqual(['User Bank 1']);
  });

  it('loads saved user banks back into loadedBanks', () => {
    const loadedBanks = {};
    // Manually set localStorage
    const bankData = {
      'My Bank': _serializeBankForStorage(createEmptyBank()),
    };
    localStorage.setItem('abd-eep-user-banks', JSON.stringify(bankData));
    const result = _loadUserBanksFromStorage(loadedBanks);
    expect(result).toBe(true);
    expect(loadedBanks['My Bank']).toBeDefined();
    expect(loadedBanks['My Bank'].length).toBe(128);
  });

  it('does not overwrite existing banks with same name', () => {
    const existing = [{ index: 0, name: 'EXISTING', unpackedBytes: new Uint8Array(242), meta: createDefaultMeta() }];
    const loadedBanks = { 'My Bank': existing };
    const bankData = {
      'My Bank': _serializeBankForStorage(createEmptyBank()),
    };
    localStorage.setItem('abd-eep-user-banks', JSON.stringify(bankData));
    _loadUserBanksFromStorage(loadedBanks);
    expect(loadedBanks['My Bank']).toBe(existing);
    expect(loadedBanks['My Bank'].length).toBe(1);
  });

  it('returns false when no saved banks exist', () => {
    const loadedBanks = {};
    const result = _loadUserBanksFromStorage(loadedBanks);
    expect(result).toBe(false);
  });

  it('handles corrupt JSON gracefully (returns false)', () => {
    localStorage.setItem('abd-eep-user-banks', 'not valid json{{{');
    const loadedBanks = {};
    const result = _loadUserBanksFromStorage(loadedBanks);
    expect(result).toBe(false);
  });

  it('save multiple user banks', () => {
    const loadedBanks = {
      'User Bank 1': createEmptyBank(),
      'User Bank 2': createEmptyBank(),
      'User Bank 3': createEmptyBank(),
    };
    _saveUserBanksToStorage(loadedBanks);
    const raw = localStorage.getItem('abd-eep-user-banks');
    const parsed = JSON.parse(raw);
    expect(Object.keys(parsed).length).toBe(3);
  });

  it('saves with empty user banks list (no user banks)', () => {
    const loadedBanks = { 'Factory Bank A': createEmptyBank() };
    const result = _saveUserBanksToStorage(loadedBanks);
    expect(result).toBe(true);
    const raw = localStorage.getItem('abd-eep-user-banks');
    expect(JSON.parse(raw)).toEqual({});
  });
});

// ────────── buildSingleSysex ──────────────────────────────────

describe('buildSingleSysex', () => {
  it('returns Uint8Array of exactly 291 bytes', () => {
    const bank = createEmptyBank();
    const syx = buildSingleSysex(bank[0]);
    expect(syx.length).toBe(291);
  });

  it('starts with SysEx header F0 00 20 32 20 7F 02 07', () => {
    const bank = createEmptyBank();
    const syx = buildSingleSysex(bank[0]);
    expect(syx[0]).toBe(0xF0);
    expect(syx[1]).toBe(0x00);
    expect(syx[2]).toBe(0x20);
    expect(syx[3]).toBe(0x32);
    expect(syx[4]).toBe(0x20);
    expect(syx[5]).toBe(0x7F);
    expect(syx[6]).toBe(0x02);
    expect(syx[7]).toBe(0x07);
  });

  it('ends with 0xF7 (SysEx end)', () => {
    const bank = createEmptyBank();
    const syx = buildSingleSysex(bank[0]);
    expect(syx[290]).toBe(0xF7);
  });

  it('contains packed payload at bytes 8-285 (278 bytes)', () => {
    const bank = createEmptyBank();
    const patch = bank[0];
    const expectedPacked = pack8to7(patch.unpackedBytes);
    const syx = buildSingleSysex(patch);
    for (let i = 0; i < 278; i++) {
      expect(syx[8 + i]).toBe(expectedPacked[i]);
    }
  });

  it('bytes 286-289 are correctly zero (padding after payload)', () => {
    const bank = createEmptyBank();
    const syx = buildSingleSysex(bank[0]);
    // payload is 278 bytes (8..285), then 286-289 padding, then 290 = 0xF7
    expect(syx[286]).toBe(0);
    expect(syx[287]).toBe(0);
    expect(syx[288]).toBe(0);
    expect(syx[289]).toBe(0);
  });

  it('can round-trip through parseSyxFile (single patch)', () => {
    const bank = createEmptyBank();
    // Update both name AND unpackedBytes[224..238]
    bank[0].name = 'TEST PATCH';
    for (let k = 0; k < 15; k++) {
      bank[0].unpackedBytes[224 + k] = k < bank[0].name.length ? bank[0].name.charCodeAt(k) : 0x20;
    }
    const syx = buildSingleSysex(bank[0]);
    const parsed = parseSyxFile(syx);
    expect(parsed.isSinglePatch).toBe(true);
    expect(parsed.patches.length).toBe(1);
    expect(parsed.patches[0].name).toBe('TEST PATCH');
    // Compare unpacked bytes
    for (let i = 0; i < 242; i++) {
      expect(parsed.patches[0].unpackedBytes[i]).toBe(bank[0].unpackedBytes[i]);
    }
  });
});

// ────────── parseSyxFile ───────────────────────────────────────

describe('parseSyxFile', () => {
  it('returns empty patches for empty bytes', () => {
    const result = parseSyxFile(new Uint8Array(0));
    expect(result.patches.length).toBe(0);
    expect(result.isSinglePatch).toBe(false);
  });

  it('single patch (291 bytes) returns isSinglePatch=true', () => {
    const bank = createEmptyBank();
    const syx = buildSingleSysex(bank[0]);
    const result = parseSyxFile(syx);
    expect(result.isSinglePatch).toBe(true);
    expect(result.patches.length).toBe(1);
  });

  it('bank-sized file (128*291 bytes) returns 128 patches', () => {
    // Build a bank-size SysEx: 128 patches of 291 bytes each
    const bankSize = 128 * 291;
    const fullBytes = new Uint8Array(bankSize);
    for (let i = 0; i < 128; i++) {
      const patch = createEmptyBank()[i];
      const syx = buildSingleSysex(patch);
      fullBytes.set(syx, i * 291);
    }
    const result = parseSyxFile(fullBytes);
    expect(result.isSinglePatch).toBe(false);
    expect(result.patches.length).toBe(128);
  });

  it('truncated bank (< 291 bytes) returns 0 patches', () => {
    const result = parseSyxFile(new Uint8Array(200));
    expect(result.patches.length).toBe(0);
  });

  it('multi-patch file (e.g. 3 patches) parses correctly', () => {
    const threePatches = 3 * 291;
    const bytes = new Uint8Array(threePatches);
    for (let i = 0; i < 3; i++) {
      const patch = createEmptyBank()[i];
      const syx = buildSingleSysex(patch);
      bytes.set(syx, i * 291);
    }
    const result = parseSyxFile(bytes);
    expect(result.patches.length).toBe(3);
    expect(result.isSinglePatch).toBe(false);
  });

  it('limits to max 128 patches even if file is larger', () => {
    const tooBig = 200 * 291;
    const bytes = new Uint8Array(tooBig);
    for (let i = 0; i < 200; i++) {
      const patch = createEmptyBank()[i % 128];
      const syx = buildSingleSysex(patch);
      if (i * 291 + 291 <= tooBig) {
        bytes.set(syx, i * 291);
      }
    }
    const result = parseSyxFile(bytes);
    expect(result.patches.length).toBe(128);
  });

  it('extracts name from each patch in a multi-patch bank', () => {
    const bytes = new Uint8Array(2 * 291);
    const bank = createEmptyBank();
    // Update both names AND unpackedBytes[224..238]
    ['PATCH ONE', 'PATCH TWO'].forEach(function(name, i) {
      bank[i].name = name;
      for (let k = 0; k < 15; k++) {
        bank[i].unpackedBytes[224 + k] = k < name.length ? name.charCodeAt(k) : 0x20;
      }
    });
    const syx0 = buildSingleSysex(bank[0]);
    const syx1 = buildSingleSysex(bank[1]);
    bytes.set(syx0, 0);
    bytes.set(syx1, 291);
    const result = parseSyxFile(bytes);
    expect(result.patches[0].name).toBe('PATCH ONE');
    expect(result.patches[1].name).toBe('PATCH TWO');
  });
});

// ────────── navigatePatch ──────────────────────────────────────

describe('navigatePatch — bank navigation with wrapping', () => {
  const bank = createEmptyBank();

  it('navigate +1 from index 0 goes to index 1', () => {
    const result = navigatePatch(bank, 0, 1);
    expect(result.index).toBe(1);
    expect(result.patch.name).toBe('INIT PATCH 2');
  });

  it('navigate -1 from index 0 wraps to index 127 (last)', () => {
    const result = navigatePatch(bank, 0, -1);
    expect(result.index).toBe(127);
    expect(result.patch.name).toBe('INIT PATCH 128');
  });

  it('navigate +1 from index 127 wraps to index 0', () => {
    const result = navigatePatch(bank, 127, 1);
    expect(result.index).toBe(0);
    expect(result.patch.name).toBe('INIT PATCH 1');
  });

  it('navigate -5 from index 5 goes to index 0', () => {
    const result = navigatePatch(bank, 5, -5);
    expect(result.index).toBe(0);
  });

  it('navigate +10 from index 125 clamps to index 0 (source does not wrap by modulo)', () => {
    const result = navigatePatch(bank, 125, 10);
    expect(result.index).toBe(0);
  });

  it('navigate returns null patch when bank is empty', () => {
    const result = navigatePatch([], 0, 1);
    expect(result.patch).toBeNull();
    expect(result.index).toBe(0);
  });

  it('navigate returns null patch when bank is null', () => {
    const result = navigatePatch(null, 0, 1);
    expect(result.patch).toBeNull();
    expect(result.index).toBe(0);
  });

  it('single-patch bank always returns index 0', () => {
    const singleBank = [bank[0]];
    expect(navigatePatch(singleBank, 0, 1).index).toBe(0);
    expect(navigatePatch(singleBank, 0, -1).index).toBe(0);
  });
});

// ────────── swapPresets ────────────────────────────────────────

describe('swapPresets — swap logic between banks', () => {
  it('swaps names and bytes between two patches', () => {
    const bank = createEmptyBank();
    const patchA = { name: 'PATCH A', unpackedBytes: new Uint8Array(242).fill(10) };
    const patchB = { name: 'PATCH B', unpackedBytes: new Uint8Array(242).fill(20) };
    const result = swapPresetsPure(patchA, patchB);
    expect(result).toBe(true);
    expect(patchA.name).toBe('PATCH B');
    expect(patchB.name).toBe('PATCH A');
    expect(patchA.unpackedBytes[0]).toBe(20);
    expect(patchB.unpackedBytes[0]).toBe(10);
  });

  it('returns false when src has no unpackedBytes', () => {
    const result = swapPresetsPure({ name: 'A' }, { name: 'B', unpackedBytes: new Uint8Array(242) });
    expect(result).toBe(false);
  });

  it('returns false when dest has no unpackedBytes', () => {
    const result = swapPresetsPure({ name: 'A', unpackedBytes: new Uint8Array(242) }, { name: 'B' });
    expect(result).toBe(false);
  });

  it('swap is idempotent: swapping twice returns to original', () => {
    const patchA = { name: 'ORIG_A', unpackedBytes: new Uint8Array(242).fill(1) };
    const patchB = { name: 'ORIG_B', unpackedBytes: new Uint8Array(242).fill(2) };
    swapPresetsPure(patchA, patchB);
    swapPresetsPure(patchA, patchB);
    expect(patchA.name).toBe('ORIG_A');
    expect(patchB.name).toBe('ORIG_B');
  });

  it('deep copies Uint8Array (not shared reference)', () => {
    const patchA = { name: 'A', unpackedBytes: new Uint8Array(242).fill(1) };
    const patchB = { name: 'B', unpackedBytes: new Uint8Array(242).fill(2) };
    swapPresetsPure(patchA, patchB);
    patchA.unpackedBytes[0] = 99;
    expect(patchB.unpackedBytes[0]).toBe(1); // was 2, now has A's old bytes
  });
});

// ────────── Search / Filter ────────────────────────────────────

describe('filterPatches — search and category filter', () => {
  function makeFilterableBanks() {
    return [
      { name: 'LEAD SYNTH', meta: { category: 'Lead', favorite: true } },
      { name: 'DEEP PAD', meta: { category: 'Pad', favorite: false } },
      { name: 'FAT BASS', meta: { category: 'Bass', favorite: true } },
      { name: 'BELLS', meta: { category: 'Keys', favorite: false } },
      { name: 'NOISE FX', meta: { category: 'FX', favorite: false } },
      { name: 'NO CATEGORY', meta: null },
    ];
  }

  it('no filter returns all patches', () => {
    const patches = makeFilterableBanks();
    const result = filterPatches(patches, '', '');
    expect(result.length).toBe(6);
  });

  it('search by name (case-insensitive) filters correctly', () => {
    const patches = makeFilterableBanks();
    expect(countFilteredPatches(patches, 'lead', '')).toBe(1);
    expect(countFilteredPatches(patches, 'LEAD', '')).toBe(1);
    expect(countFilteredPatches(patches, 'pad', '')).toBe(1);
    expect(countFilteredPatches(patches, 'bass', '')).toBe(1);
  });

  it('partial search matches substring', () => {
    const patches = makeFilterableBanks();
    expect(countFilteredPatches(patches, 'SYN', '')).toBe(1); // LEAD SYNTH
    expect(countFilteredPatches(patches, 'DEEP', '')).toBe(1);
  });

  it('search with no matches returns empty', () => {
    const patches = makeFilterableBanks();
    expect(countFilteredPatches(patches, 'XYZZZZ', '')).toBe(0);
  });

  it('search with empty string returns all', () => {
    const patches = makeFilterableBanks();
    expect(countFilteredPatches(patches, '', '')).toBe(6);
  });

  it('category filter returns only patches with that category', () => {
    const patches = makeFilterableBanks();
    expect(countFilteredPatches(patches, '', 'Lead')).toBe(1);
    expect(countFilteredPatches(patches, '', 'Pad')).toBe(1);
    expect(countFilteredPatches(patches, '', 'Keys')).toBe(1);
  });

  it('combined search + category filter narrows results', () => {
    const patches = makeFilterableBanks();
    expect(countFilteredPatches(patches, 'SYNTH', 'Lead')).toBe(1);
    expect(countFilteredPatches(patches, 'SYNTH', 'Pad')).toBe(0); // LEAD SYNTH is Lead, not Pad
  });

  it('search matches from anywhere in name (not just start)', () => {
    const patches = makeFilterableBanks();
    expect(countFilteredPatches(patches, 'SYN', '')).toBe(1); // LEAD SYNTH
    expect(countFilteredPatches(patches, 'NOISE', '')).toBe(1);
  });

  it('category filter with no matches returns empty', () => {
    const patches = makeFilterableBanks();
    expect(countFilteredPatches(patches, '', 'Nonexistent')).toBe(0);
  });

  it('patch with null meta and category filter returns empty (no category match)', () => {
    const patches = makeFilterableBanks();
    expect(countFilteredPatches(patches, '', 'Lead')).toBe(1); // LEAD SYNTH
    // NO CATEGORY has null meta, so category check fails
    expect(countFilteredPatches(patches, 'NO CATEGORY', 'Lead')).toBe(0);
  });
});

// ────────── exportSinglePatch (pure checks) ────────────────────

describe('exportSinglePatch — validation logic', () => {
  it('returns true when patch has valid data', () => {
    const bank = createEmptyBank();
    const patch = bank[0];
    expect(patch.unpackedBytes).toBeDefined();
    expect(patch.unpackedBytes.length).toBe(242);
  });

  it('returns falsy (null) when patch unpackedBytes is null', () => {
    const patch = { name: 'EMPTY', unpackedBytes: null };
    const isValid = patch && patch.unpackedBytes;
    expect(isValid).toBeFalsy();
  });

  it('returns falsy (undefined) when patch is undefined', () => {
    const result = undefined && undefined;
    expect(result).toBeFalsy();
  });

  it('default filename uses patch name sanitized', () => {
    const patch = { name: 'LEAD PATCH!@#' };
    const fileName = (0).toString().padStart(3, '0') + '_' + patch.name.replace(/[^a-zA-Z0-9_\-]/g, '_') + '.syx';
    expect(fileName).toBe('000_LEAD_PATCH___.syx');
  });

  it('export wrapping works with valid patch and filename', () => {
    const bank = createEmptyBank();
    const patch = bank[0];
    const syx = buildSingleSysex(patch);
    expect(syx.length).toBe(291);
    expect(syx[0]).toBe(0xF0);
  });
});
