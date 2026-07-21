/**
 * @purpose Manages loading/saving user presets library banks to/from browser LocalStorage.
 * @purpose_en User banks LocalStorage persistence.
 */

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

function _saveUserBanksToStorage() {
    try {
        const userBanks = {};
        Object.keys(window.loadedBanks).forEach(function(bankName) {
            if (!bankName.startsWith('Factory Bank')) {
                userBanks[bankName] = _serializeBankForStorage(window.loadedBanks[bankName]);
            }
        });
        localStorage.setItem('abd-eep-user-banks', JSON.stringify(userBanks));
        console.log('[BankStorage] Saved ' + Object.keys(userBanks).length + ' user banks to localStorage');
        return true;
    } catch (e) {
        console.warn('[BankStorage] Error saving user banks:', e);
        if (e.name === 'QuotaExceededError' || e.code === 22) {
            alert('Storage quota exceeded. Try reducing the number of user banks or patches.');
        }
        return false;
    }
}

function _loadUserBanksFromStorage() {
    try {
        const raw = localStorage.getItem('abd-eep-user-banks');
        if (!raw) {return false;}
        const parsed = JSON.parse(raw);
        let count = 0;
        Object.keys(parsed).forEach(function(bankName) {
            if (!window.loadedBanks[bankName]) {
                window.loadedBanks[bankName] = _deserializeBankFromStorage(parsed[bankName]);
                count++;
            }
        });
        console.log('[BankStorage] Loaded ' + count + ' user banks from localStorage (' + Object.keys(parsed).length + ' total in storage)');
        return count > 0;
    } catch (e) {
        console.warn('[BankStorage] Error loading user banks:', e);
        return false;
    }
}

function createEmptyBank() {
    const list = [];
    for (let i = 0; i < 128; i++) {
        const defaultUnpacked = new Uint8Array(242);
        const nameStr = `INIT PATCH ${i+1}`;
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

function createDefaultMeta() {
    return {
        category: '',
        tags: '',
        favorite: false,
        dateCreated: Date.now()
    };
}

window._saveUserBanksToStorage = _saveUserBanksToStorage;
window._loadUserBanksFromStorage = _loadUserBanksFromStorage;
window.createEmptyBank = createEmptyBank;
window.createDefaultMeta = createDefaultMeta;
