/**
 * Tests for WebUI/js/edit_persistence.js — Patch persistence & Save As modal logic
 *
 * Strategy: extracted inline validation, name encoding, bank filtering, slot display helpers.
 * Full initEditPersistence() is DOM-heavy (event listeners, renders); not covered here.
 */

// ===== Global stubs =====
globalThis.window = globalThis.window || {};

// ===== Extracted Source Functions =====

const FACTORY_BANKS = [
    'Factory Bank A', 'Factory Bank B', 'Factory Bank C', 'Factory Bank D',
    'Factory Bank E', 'Factory Bank F', 'Factory Bank G', 'Factory Bank H'
];

function isFactoryBank(bankName) {
    if (!bankName) {return false;}
    return bankName.indexOf('Factory Bank') === 0;
}

function getUserBanks(loadedBanks) {
    if (!loadedBanks) {return [];}
    return Object.keys(loadedBanks).filter(function(b) { return b.indexOf('Factory Bank') !== 0; });
}

function isSlotEmpty(patch) {
    if (!patch) {return false;}
    return patch.name.indexOf('INIT PATCH') === 0 || patch.name.indexOf('[Empty') === 0;
}

function isSlotOccupied(patch) {
    if (!patch) {return false;}
    return !isSlotEmpty(patch);
}

function encodePatchName(unpackedBytes, name) {
    for (let k = 0; k < 15; k++) {
        unpackedBytes[224 + k] = k < name.length ? name.charCodeAt(k) : 0x20;
    }
    return unpackedBytes;
}

function padSlotIndex(i) {
    return (i + 1).toString().padStart(3, '0');
}

function getSlotDisplayName(patch, slotIndex) {
    return padSlotIndex(slotIndex) + ': ' + patch.name;
}

function validateSaveAs(selectedBank, selectedSlotIdx, newName, bank) {
    if (!selectedBank) {return 'Please select a valid user bank.';}
    if (selectedSlotIdx < 0 || selectedSlotIdx >= 128) {return 'Please select a destination slot.';}
    if (!newName || newName.trim() === '') {return 'Please enter a preset name.';}
    if (!bank || !bank[selectedSlotIdx]) {return 'Error: selected slot does not exist.';}
    return null; // valid
}

function formatSaveAsLcdHtml(action, name, bank, slotIdx) {
    const html = '<span style="font-size:10px; opacity:0.6;">' + action + '</span><br>'
        + '<strong style="color:var(--accent-green);">' + name.toUpperCase() + '</strong><br>'
        + '<span style="font-size:9px; color:var(--text-dim);">' + bank + ' \u203a Slot ' + (slotIdx + 1) + '</span>';
    return html;
}

// ===== Tests =====

describe('FACTORY_BANKS constant', function() {
    it('has 8 factory banks', function() {
        expect(FACTORY_BANKS.length).toBe(8);
    });

    it('covers A through H', function() {
        expect(FACTORY_BANKS[0]).toBe('Factory Bank A');
        expect(FACTORY_BANKS[3]).toBe('Factory Bank D');
        expect(FACTORY_BANKS[7]).toBe('Factory Bank H');
    });
});

describe('isFactoryBank', function() {
    it('returns true for Factory Bank A', function() {
        expect(isFactoryBank('Factory Bank A')).toBe(true);
    });

    it('returns true for Factory Bank H', function() {
        expect(isFactoryBank('Factory Bank H')).toBe(true);
    });

    it('returns false for a user bank', function() {
        expect(isFactoryBank('My User Bank')).toBe(false);
    });

    it('returns false for null/undefined', function() {
        expect(isFactoryBank(null)).toBe(false);
        expect(isFactoryBank(undefined)).toBe(false);
    });
});

describe('getUserBanks', function() {
    it('returns empty array for null loadedBanks', function() {
        expect(getUserBanks(null)).toEqual([]);
    });

    it('returns empty array for empty loadedBanks', function() {
        expect(getUserBanks({})).toEqual([]);
    });

    it('excludes Factory Banks', function() {
        const banks = {
            'Factory Bank A': [],
            'Factory Bank B': [],
            'My Bank': [],
            'Another Bank': []
        };
        expect(getUserBanks(banks)).toEqual(['My Bank', 'Another Bank']);
    });

    it('returns all banks when none are factory', function() {
        const banks = { 'User Bank 1': [], 'User Bank 2': [] };
        expect(getUserBanks(banks)).toEqual(['User Bank 1', 'User Bank 2']);
    });
});

describe('isSlotEmpty', function() {
    it('returns true for INIT PATCH', function() {
        expect(isSlotEmpty({ name: 'INIT PATCH 1' })).toBe(true);
    });

    it('returns true for [Empty Slot', function() {
        expect(isSlotEmpty({ name: '[Empty Slot 5]' })).toBe(true);
    });

    it('returns false for a custom patch name', function() {
        expect(isSlotEmpty({ name: 'My Synth Lead' })).toBe(false);
    });

    it('returns false for null patch', function() {
        expect(isSlotEmpty(null)).toBe(false);
    });
});

describe('isSlotOccupied', function() {
    it('returns true for a custom patch name', function() {
        expect(isSlotOccupied({ name: 'Lead Pad' })).toBe(true);
    });

    it('returns false for INIT PATCH', function() {
        expect(isSlotOccupied({ name: 'INIT PATCH 64' })).toBe(false);
    });

    it('returns false for null patch', function() {
        expect(isSlotOccupied(null)).toBe(false);
    });
});

describe('encodePatchName — writes name into unpackedBytes at offset 224', function() {
    it('writes short name, pads remaining with 0x20 (space)', function() {
        const bytes = new Uint8Array(256);
        encodePatchName(bytes, 'Test');
        // T=84, e=101, s=115, t=116, then spaces
        expect(bytes[224]).toBe(84);
        expect(bytes[225]).toBe(101);
        expect(bytes[226]).toBe(115);
        expect(bytes[227]).toBe(116);
        expect(bytes[228]).toBe(0x20); // space
        expect(bytes[238]).toBe(0x20); // last byte also space
    });

    it('writes exactly 15 characters', function() {
        const bytes = new Uint8Array(256);
        encodePatchName(bytes, 'ABCDEFGHIJKLMNO'); // 15 chars
        expect(bytes[224]).toBe(65);  // A
        expect(bytes[238]).toBe(79); // O
    });

    it('truncates names longer than 15 chars', function() {
        const bytes = new Uint8Array(256);
        encodePatchName(bytes, 'ABCDEFGHIJKLMNOPQRST'); // 20 chars
        expect(bytes[224]).toBe(65);   // A
        expect(bytes[238]).toBe(79);   // O (15th char)
        // Byte 239 should remain 0 (not written by this function)
        expect(bytes[239]).toBe(0);
    });

    it('handles empty string (all spaces)', function() {
        const bytes = new Uint8Array(256);
        encodePatchName(bytes, '');
        for (let k = 0; k < 15; k++) {
            expect(bytes[224 + k]).toBe(0x20);
        }
    });

    it('preserves other bytes outside name range', function() {
        const bytes = new Uint8Array(256);
        bytes[0] = 42;
        bytes[223] = 99;
        bytes[239] = 77;
        encodePatchName(bytes, 'Test');
        expect(bytes[0]).toBe(42);
        expect(bytes[223]).toBe(99);
        expect(bytes[239]).toBe(77);
    });
});

describe('padSlotIndex', function() {
    it('pads slot 0 to "001"', function() {
        expect(padSlotIndex(0)).toBe('001');
    });

    it('pads slot 9 to "010"', function() {
        expect(padSlotIndex(9)).toBe('010');
    });

    it('pads slot 99 to "100"', function() {
        expect(padSlotIndex(99)).toBe('100');
    });

    it('pads slot 127 to "128"', function() {
        expect(padSlotIndex(127)).toBe('128');
    });
});

describe('getSlotDisplayName', function() {
    it('formats as "001: INIT PATCH 1"', function() {
        expect(getSlotDisplayName({ name: 'INIT PATCH 1' }, 0))
            .toBe('001: INIT PATCH 1');
    });

    it('formats as "064: My Patch"', function() {
        expect(getSlotDisplayName({ name: 'My Patch' }, 63))
            .toBe('064: My Patch');
    });
});

describe('validateSaveAs', function() {
    it('returns error when no bank selected', function() {
        const err = validateSaveAs('', 0, 'Test', { 0: {} });
        expect(err).toContain('bank');
    });

    it('returns error when slot index is negative', function() {
        const err = validateSaveAs('My Bank', -1, 'Test', {});
        expect(err).toContain('slot');
    });

    it('returns error when slot index is >= 128', function() {
        const err = validateSaveAs('My Bank', 128, 'Test', {});
        expect(err).toContain('slot');
    });

    it('returns error when name is empty', function() {
        const err = validateSaveAs('My Bank', 0, '', { 0: {} });
        expect(err).toContain('name');
    });

    it('returns error when name is whitespace only', function() {
        const err = validateSaveAs('My Bank', 0, '   ', { 0: {} });
        expect(err).toContain('name');
    });

    it('returns error when bank slot does not exist', function() {
        const err = validateSaveAs('My Bank', 0, 'Test', {});
        expect(err).toContain('slot does not exist');
    });

    it('returns null when all inputs are valid', function() {
        const err = validateSaveAs('My Bank', 5, 'My Synth', { 5: { name: 'Old' } });
        expect(err).toBeNull();
    });
});

describe('formatSaveAsLcdHtml', function() {
    it('formats SAVED action correctly', function() {
        const html = formatSaveAsLcdHtml('SAVED', 'My Lead', 'My Bank', 3);
        expect(html).toContain('SAVED');
        expect(html).toContain('MY LEAD');
        expect(html).toContain('My Bank');
        expect(html).toContain('Slot 4');
    });

    it('formats SAVED AS action with slot offset', function() {
        const html = formatSaveAsLcdHtml('SAVED AS', 'Custom', 'User Bank', 127);
        expect(html).toContain('SAVED AS');
        expect(html).toContain('CUSTOM');
        expect(html).toContain('Slot 128');
    });
});
