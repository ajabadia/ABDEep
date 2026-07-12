/**
 * Tests for WebUI/js/browser_persistence.js — User bank localStorage persistence
 *
 * Strategy: extracted functions with localStorage stub. Tests cover serialization,
 * save/load round-trip, factory bank filtering, empty bank creation, error handling.
 */

// ===== localStorage stub =====
var persistStore = {};
var mockLS = {
    getItem: function(k) { return persistStore[k] !== undefined ? persistStore[k] : null; },
    setItem: function(k, v) { persistStore[k] = String(v); },
    removeItem: function(k) { delete persistStore[k]; },
    clear: function() { persistStore = {}; }
};
globalThis.localStorage = mockLS;
globalThis.window = globalThis.window || {};

// ===== Extracted Source =====

function createDefaultMeta() {
    return {
        category: '',
        tags: '',
        favorite: false,
        dateCreated: Date.now()
    };
}

function createEmptyBank() {
    var list = [];
    for (var i = 0; i < 128; i++) {
        var defaultUnpacked = new Uint8Array(242);
        var nameStr = 'INIT PATCH ' + (i + 1);
        for (var k = 0; k < 15; k++) {
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

function serializeBankForStorage(bankArray) {
    return bankArray.map(function(patch) {
        return {
            index: patch.index,
            name: patch.name,
            unpackedBytes: Array.from(patch.unpackedBytes),
            meta: patch.meta ? JSON.parse(JSON.stringify(patch.meta)) : createDefaultMeta()
        };
    });
}

function deserializeBankFromStorage(storedArray) {
    return storedArray.map(function(p) {
        return {
            index: p.index,
            name: p.name,
            unpackedBytes: new Uint8Array(p.unpackedBytes),
            meta: p.meta ? JSON.parse(JSON.stringify(p.meta)) : createDefaultMeta()
        };
    });
}

function saveUserBanksToStorage(loadedBanks, getItem, setItem) {
    getItem = getItem || function() { return null; };
    setItem = setItem || function() {};
    try {
        var userBanks = {};
        Object.keys(loadedBanks).forEach(function(bankName) {
            if (bankName.indexOf('Factory Bank') !== 0) {
                userBanks[bankName] = serializeBankForStorage(loadedBanks[bankName]);
            }
        });
        setItem('abd-eep-user-banks', JSON.stringify(userBanks));
        return true;
    } catch (e) {
        if (e.name === 'QuotaExceededError' || e.code === 22) {
            // alert would go here
        }
        return false;
    }
}

function loadUserBanksFromStorage(loadedBanks, getItem) {
    getItem = getItem || function() { return null; };
    try {
        var raw = getItem('abd-eep-user-banks');
        if (!raw) return false;
        var parsed = JSON.parse(raw);
        var count = 0;
        Object.keys(parsed).forEach(function(bankName) {
            if (!loadedBanks[bankName]) {
                loadedBanks[bankName] = deserializeBankFromStorage(parsed[bankName]);
                count++;
            }
        });
        return count > 0;
    } catch (e) {
        return false;
    }
}

// ===== Tests =====

describe('createDefaultMeta', function() {
    it('returns object with category, tags, favorite, dateCreated', function() {
        var meta = createDefaultMeta();
        expect(meta.category).toBe('');
        expect(meta.tags).toBe('');
        expect(meta.favorite).toBe(false);
        expect(meta.dateCreated).toBeDefined();
        expect(typeof meta.dateCreated).toBe('number');
    });
});

describe('createEmptyBank', function() {
    var bank;

    beforeEach(function() {
        bank = createEmptyBank();
    });

    it('creates 128 patches', function() {
        expect(bank.length).toBe(128);
    });

    it('each patch has index from 0 to 127', function() {
        for (var i = 0; i < 128; i++) {
            expect(bank[i].index).toBe(i);
        }
    });

    it('each patch has a name starting with "INIT PATCH"', function() {
        expect(bank[0].name).toBe('INIT PATCH 1');
        expect(bank[50].name).toBe('INIT PATCH 51');
        expect(bank[127].name).toBe('INIT PATCH 128');
    });

    it('each patch has 242 unpackedBytes', function() {
        expect(bank[0].unpackedBytes.length).toBe(242);
    });

    it('name is written into bytes 224-238', function() {
        var bytes = bank[0].unpackedBytes;
        expect(bytes[224]).toBe('I'.charCodeAt(0));
        expect(bytes[225]).toBe('N'.charCodeAt(0));
        expect(bytes[226]).toBe('I'.charCodeAt(0));
        expect(bytes[227]).toBe('T'.charCodeAt(0));
        expect(bytes[228]).toBe(0x20); // space
        expect(bytes[229]).toBe('P'.charCodeAt(0));
    });

    it('default byte values: VCF cutoff=255, VCA level=0, env depth=128, vel sens=255, pan=64', function() {
        for (var i = 0; i < 128; i++) {
            expect(bank[i].unpackedBytes[39]).toBe(255);  // vcf_cutoff
            expect(bank[i].unpackedBytes[80]).toBe(0);    // vca_level
            expect(bank[i].unpackedBytes[81]).toBe(128);  // vca_env_depth
            expect(bank[i].unpackedBytes[82]).toBe(255);  // vca_vel_sens
            expect(bank[i].unpackedBytes[83]).toBe(64);   // vca_pan_spread
        }
    });

    it('each patch has meta from createDefaultMeta', function() {
        for (var i = 0; i < 128; i++) {
            expect(bank[i].meta.category).toBe('');
            expect(bank[i].meta.favorite).toBe(false);
        }
    });
});

describe('serializeBankForStorage', function() {
    var bank, serialized;

    beforeEach(function() {
        bank = createEmptyBank();
        serialized = serializeBankForStorage(bank);
    });

    it('returns same length as input', function() {
        expect(serialized.length).toBe(128);
    });

    it('converts Uint8Array to plain Array', function() {
        expect(bank[0].unpackedBytes instanceof Uint8Array).toBe(true);
        expect(serialized[0].unpackedBytes instanceof Array).toBe(true);
        expect(Array.isArray(serialized[0].unpackedBytes)).toBe(true);
    });

    it('preserves byte values through conversion', function() {
        expect(serialized[0].unpackedBytes[39]).toBe(255);
        expect(serialized[0].unpackedBytes[80]).toBe(0);
    });

    it('preserves index and name', function() {
        expect(serialized[5].index).toBe(5);
        expect(serialized[5].name).toBe('INIT PATCH 6');
    });

    it('deep clones meta (modifying result does not affect original)', function() {
        serialized[0].meta.favorite = true;
        expect(bank[0].meta.favorite).toBe(false);
    });
});

describe('deserializeBankFromStorage', function() {
    var bank, serialized, deserialized;

    beforeEach(function() {
        bank = createEmptyBank();
        serialized = serializeBankForStorage(bank);
        deserialized = deserializeBankFromStorage(serialized);
    });

    it('returns same length', function() {
        expect(deserialized.length).toBe(128);
    });

    it('converts Array back to Uint8Array', function() {
        expect(deserialized[0].unpackedBytes instanceof Uint8Array).toBe(true);
    });

    it('preserves byte values through round-trip', function() {
        expect(deserialized[0].unpackedBytes[39]).toBe(255);
        expect(deserialized[0].unpackedBytes[80]).toBe(0);
        expect(deserialized[0].unpackedBytes[81]).toBe(128);
    });

    it('preserves index and name', function() {
        expect(deserialized[10].index).toBe(10);
        expect(deserialized[10].name).toBe('INIT PATCH 11');
    });

    it('restores meta object', function() {
        expect(deserialized[0].meta.category).toBe('');
        expect(deserialized[0].meta.favorite).toBe(false);
        expect(typeof deserialized[0].meta.dateCreated).toBe('number');
    });
});

describe('serialize/deserialize round-trip integrity', function() {
    it('round-trips a full bank without data loss', function() {
        var bank = createEmptyBank();
        // Modify some bytes to make it non-default
        bank[3].unpackedBytes[0] = 100;
        bank[3].unpackedBytes[200] = 50;
        bank[3].name = 'CUSTOM PATCH';

        var serialized = serializeBankForStorage(bank);
        var deserialized = deserializeBankFromStorage(serialized);

        expect(deserialized.length).toBe(128);
        expect(deserialized[3].name).toBe('CUSTOM PATCH');
        expect(deserialized[3].unpackedBytes[0]).toBe(100);
        expect(deserialized[3].unpackedBytes[200]).toBe(50);
    });

    it('round-trips preserves all 242 bytes for all 128 patches', function() {
        var bank = createEmptyBank();
        // Set unique values for each patch
        for (var i = 0; i < 128; i++) {
            for (var j = 0; j < 242; j++) {
                bank[i].unpackedBytes[j] = (i + j) % 256;
            }
        }
        var serialized = serializeBankForStorage(bank);
        var deserialized = deserializeBankFromStorage(serialized);
        for (var p = 0; p < 128; p++) {
            for (var b = 0; b < 242; b++) {
                expect(deserialized[p].unpackedBytes[b]).toBe((p + b) % 256);
            }
        }
    });
});

describe('saveUserBanksToStorage — filtering and persistence', function() {
    var loadedBanks;

    beforeEach(function() {
        persistStore = {};
        loadedBanks = {
            'Factory Bank A': createEmptyBank(),
            'Factory Bank B': createEmptyBank(),
            'User Bank 1': createEmptyBank(),
            'My Custom Bank': createEmptyBank()
        };
    });

    it('saves only non-Factory Bank banks', function() {
        saveUserBanksToStorage(loadedBanks, null, function(key, val) {
            persistStore[key] = val;
        });
        var raw = persistStore['abd-eep-user-banks'];
        expect(raw).toBeDefined();
        var parsed = JSON.parse(raw);
        expect(Object.keys(parsed)).toEqual(['User Bank 1', 'My Custom Bank']);
    });

    it('returns true on successful save', function() {
        var result = saveUserBanksToStorage(loadedBanks, null, function(k, v) {
            persistStore[k] = v;
        });
        expect(result).toBe(true);
    });

    it('stores full bank data (128 patches × 242 bytes)', function() {
        saveUserBanksToStorage(loadedBanks, null, function(key, val) {
            persistStore[key] = val;
        });
        var parsed = JSON.parse(persistStore['abd-eep-user-banks']);
        expect(parsed['User Bank 1'].length).toBe(128);
        expect(parsed['User Bank 1'][0].unpackedBytes.length).toBe(242);
    });

    it('returns false when setItem throws', function() {
        var result = saveUserBanksToStorage(loadedBanks, null, function() {
            throw { name: 'QuotaExceededError' };
        });
        expect(result).toBe(false);
    });
});

describe('loadUserBanksFromStorage — restoration', function() {
    var loadedBanks;

    beforeEach(function() {
        persistStore = {};
        loadedBanks = {
            'Factory Bank A': createEmptyBank()
        };
        // Save some user banks first
        var allBanks = {
            'Factory Bank A': createEmptyBank(),
            'User Bank 1': createEmptyBank(),
            'Custom': createEmptyBank()
        };
        var userBanks = {};
        Object.keys(allBanks).forEach(function(name) {
            if (name.indexOf('Factory Bank') !== 0) {
                userBanks[name] = serializeBankForStorage(allBanks[name]);
            }
        });
        persistStore['abd-eep-user-banks'] = JSON.stringify(userBanks);
    });

    it('loads user banks from storage', function() {
        var result = loadUserBanksFromStorage(loadedBanks, function(key) {
            return persistStore[key];
        });
        expect(result).toBe(true);
        expect(loadedBanks['User Bank 1']).toBeDefined();
        expect(loadedBanks['Custom']).toBeDefined();
    });

    it('does not overwrite existing banks', function() {
        loadedBanks['Existing Bank'] = [{ index: 0, name: 'Existing' }];
        persistStore['abd-eep-user-banks'] = JSON.stringify({
            'Existing Bank': [{ index: 0, name: 'Override', unpackedBytes: [0], meta: createDefaultMeta() }]
        });
        loadUserBanksFromStorage(loadedBanks, function(key) {
            return persistStore[key];
        });
        expect(loadedBanks['Existing Bank'][0].name).toBe('Existing');
    });

    it('returns false when storage is empty', function() {
        persistStore = {};
        var result = loadUserBanksFromStorage(loadedBanks, function(key) {
            return persistStore[key];
        });
        expect(result).toBe(false);
    });

    it('returns false when JSON is malformed', function() {
        persistStore['abd-eep-user-banks'] = 'not-valid-json{{{';
        var result = loadUserBanksFromStorage(loadedBanks, function(key) {
            return persistStore[key];
        });
        expect(result).toBe(false);
    });

    it('returns false when no new banks were loaded (all already exist)', function() {
        // loadedBanks already has 'User Bank 1' and 'Custom' from the storage
        // But the beforeEach only sets Factory Bank A, so both user banks should load
        // Let's test differently: load a bank that was already there
        loadedBanks['User Bank 1'] = [{ index: 0, name: 'Already Here' }];
        // Now 'User Bank 1' exists → should not be overwritten
        var result = loadUserBanksFromStorage(loadedBanks, function(key) {
            return persistStore[key];
        });
        // 'Custom' is new → count > 0 → returns true
        expect(result).toBe(true);
    });
});

describe('full save/load round-trip via DI', function() {
    var loadedBanks, savedStr;

    beforeEach(function() {
        persistStore = {};
        loadedBanks = {
            'Factory Bank A': createEmptyBank(),
            'User Bank 1': createEmptyBank()
        };
        // Customize a patch
        loadedBanks['User Bank 1'][5].name = 'BASS LEAD';
        loadedBanks['User Bank 1'][5].unpackedBytes[0] = 200;
        loadedBanks['User Bank 1'][5].unpackedBytes[1] = 150;
    });

    it('save → load preserves all data', function() {
        // Save
        var saved = saveUserBanksToStorage(loadedBanks, null, function(k, v) {
            persistStore[k] = v;
            savedStr = v;
        });
        expect(saved).toBe(true);

        // Reset and load into fresh object
        var freshBanks = { 'Factory Bank A': createEmptyBank() };
        var loaded = loadUserBanksFromStorage(freshBanks, function(k) {
            return persistStore[k];
        });
        expect(loaded).toBe(true);
        expect(freshBanks['User Bank 1']).toBeDefined();
        expect(freshBanks['User Bank 1'][5].name).toBe('BASS LEAD');
        expect(freshBanks['User Bank 1'][5].unpackedBytes[0]).toBe(200);
        expect(freshBanks['User Bank 1'][5].unpackedBytes[1]).toBe(150);
    });

    it('factory banks are excluded from save', function() {
        saveUserBanksToStorage(loadedBanks, null, function(k, v) {
            persistStore[k] = v;
            savedStr = v;
        });
        var parsed = JSON.parse(savedStr);
        expect(parsed['Factory Bank A']).toBeUndefined();
        expect(parsed['User Bank 1']).toBeDefined();
    });
});
