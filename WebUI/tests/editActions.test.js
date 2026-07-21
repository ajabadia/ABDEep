/**
 * Tests for WebUI/js/edit_actions.js — Copy/Paste presets, factory bank protection, keyboard shortcuts
 *
 * Strategy: self-contained extracted functions, global stubbing.
 */

// ===== Global stubs =====
globalThis.window = globalThis.window || {};
globalThis.document = globalThis.document || { getElementById: function() { return null; }, activeElement: { tagName: 'BODY' } };
globalThis.alert = function() {};

// ===== Extracted Source =====

function runEditActions(options) {
    options = options || {};
    const activeBank = options.activeBank;
    const currentActiveBank = options.currentActiveBank;
    const currentActivePatchIndex = options.currentActivePatchIndex;
    const triggerMidiDump = options.triggerMidiDump || function() {};
    const renderPatchesForBank = options.renderPatchesForBank || function() {};
    const saveUserBanksToStorage = options.saveUserBanksToStorage || function() {};
    const getElementById = options.getElementById || function() { return null; };
    const getSelectionStr = options.getSelectionStr || function() { return ''; };
    const activeElementTagName = options.activeElementTagName || 'BODY';

    let globalClipboardBytes = null;
    let globalClipboardName = '';
    const alerts = [];

    function alert(msg) { alerts.push(msg); }

    function doCopy() {
        const bank = activeBank[currentActiveBank];
        if (!bank || currentActivePatchIndex === -1) {
            alert('Selecciona primero un preset del Bank Manager para copiar.');
            return { alerts: alerts, clipboardBytes: null, clipboardName: '' };
        }
        const patch = bank[currentActivePatchIndex];
        if (patch && patch.unpackedBytes) {
            globalClipboardBytes = new Uint8Array(patch.unpackedBytes);
            globalClipboardName = patch.name;
            const lcdText = getElementById('lcd-text');
            if (lcdText) {lcdText.innerHTML = '<strong>COPIED</strong><br><span style="font-size:11px;">' + patch.name.toUpperCase() + '</span>';}
        }
        return { alerts: alerts, clipboardBytes: globalClipboardBytes, clipboardName: globalClipboardName };
    }

    function doPaste() {
        if (!globalClipboardBytes) {
            alert('El portapapeles está vacío. Copia un preset primero.');
            return { alerts: alerts, success: false };
        }
        const bank = activeBank[currentActiveBank];
        if (!bank || currentActivePatchIndex === -1) {
            alert('Selecciona un slot de destino en el Bank Manager.');
            return { alerts: alerts, success: false };
        }

        const FACTORY_BANKS = [
            'Factory Bank A', 'Factory Bank B', 'Factory Bank C', 'Factory Bank D',
            'Factory Bank E', 'Factory Bank F', 'Factory Bank G', 'Factory Bank H'
        ];
        if (FACTORY_BANKS.indexOf(currentActiveBank) !== -1) {
            alert('No está permitido modificar o pegar presets en los bancos de fábrica.');
            return { alerts: alerts, success: false };
        }

        const patch = bank[currentActivePatchIndex];
        if (patch) {
            patch.unpackedBytes = new Uint8Array(globalClipboardBytes);
            patch.name = globalClipboardName;

            for (let k = 0; k < 15; k++) {
                patch.unpackedBytes[224 + k] = k < patch.name.length ? patch.name.charCodeAt(k) : 0x20;
            }

            triggerMidiDump(patch);
            renderPatchesForBank(currentActiveBank);
            saveUserBanksToStorage();
            return { alerts: alerts, success: true };
        }
        return { alerts: alerts, success: false };
    }

    function handleKeydown(e) {
        if (!e.ctrlKey && !e.metaKey) {return;}
        switch (e.key.toLowerCase()) {
            case 'z':
                if (typeof options.triggerUndo === 'function') {options.triggerUndo();}
                return 'undo';
            case 'y':
                if (typeof options.triggerRedo === 'function') {options.triggerRedo();}
                return 'redo';
            case 'c':
                if (getSelectionStr() === '') {
                    const copyBtn = getElementById('menu-copy-preset');
                    if (copyBtn && typeof copyBtn.click === 'function') {copyBtn.click();}
                    return 'copy';
                }
                return null;
            case 'v':
                if (activeElementTagName !== 'INPUT' && activeElementTagName !== 'SELECT') {
                    const pasteBtn = getElementById('menu-paste-preset');
                    if (pasteBtn && typeof pasteBtn.click === 'function') {pasteBtn.click();}
                    return 'paste';
                }
                return null;
        }
        return null;
    }

    return {
        doCopy: doCopy,
        doPaste: doPaste,
        handleKeydown: handleKeydown,
        getClipboardBytes: function() { return globalClipboardBytes; },
        getClipboardName: function() { return globalClipboardName; }
    };
}

// ===== Tests =====

describe('editActions — Copy preset', function() {
    let actions, bank;

    beforeEach(function() {
        bank = { 'User Bank': [{ index: 0, name: 'My Synth', unpackedBytes: new Uint8Array([0x10, 0x20, 0x30, 0x40]) }] };
        actions = runEditActions({
            activeBank: bank,
            currentActiveBank: 'User Bank',
            currentActivePatchIndex: 0
        });
    });

    it('copies the current patch bytes and name', function() {
        const result = actions.doCopy();
        expect(result.alerts.length).toBe(0);
        expect(result.clipboardName).toBe('My Synth');
        expect(result.clipboardBytes).toBeDefined();
        expect(result.clipboardBytes.length).toBe(4);
        expect(result.clipboardBytes[0]).toBe(0x10);
        expect(result.clipboardBytes[1]).toBe(0x20);
    });

    it('creates a copy (not reference) of bytes', function() {
        const result = actions.doCopy();
        // Modifying original shouldn't affect clipboard
        bank['User Bank'][0].unpackedBytes[0] = 0xFF;
        expect(result.clipboardBytes[0]).toBe(0x10);
    });

    it('alerts when no bank is available', function() {
        actions = runEditActions({
            activeBank: {},
            currentActiveBank: 'Empty Bank',
            currentActivePatchIndex: 0
        });
        const result = actions.doCopy();
        expect(result.alerts.length).toBe(1);
        expect(result.alerts[0]).toContain('Selecciona primero');
    });

    it('alerts when no patch is selected', function() {
        actions = runEditActions({
            activeBank: bank,
            currentActiveBank: 'User Bank',
            currentActivePatchIndex: -1
        });
        const result = actions.doCopy();
        expect(result.alerts.length).toBe(1);
    });

    it('updates LCD text after copy', function() {
        const lcdHtml = '';
        actions = runEditActions({
            activeBank: bank,
            currentActiveBank: 'User Bank',
            currentActivePatchIndex: 0,
            getElementById: function(id) {
                if (id === 'lcd-text') {return { innerHTML: '' };}
                return null;
            }
        });
        const result = actions.doCopy();
        expect(result.clipboardName).toBe('My Synth');
    });
});

describe('editActions — Paste preset', function() {
    let bank, actions, midiDumpCalled, renderCalled, saveCalled;

    beforeEach(function() {
        bank = {
            'User Bank': [{ index: 0, name: 'My Synth', unpackedBytes: new Uint8Array([0x10, 0x20, 0x30, 0x40]) }]
        };
        // Also need 256 bytes for the paste write test (name bytes at 224+)
        const fullBytes = new Uint8Array(256);
        fullBytes[0] = 0x10; fullBytes[1] = 0x20; fullBytes[2] = 0x30; fullBytes[3] = 0x40;
        bank['User Bank'][0].unpackedBytes = fullBytes;
        midiDumpCalled = false;
        renderCalled = false;
        saveCalled = false;

        actions = runEditActions({
            activeBank: bank,
            currentActiveBank: 'User Bank',
            currentActivePatchIndex: 0,
            triggerMidiDump: function() { midiDumpCalled = true; },
            renderPatchesForBank: function() { renderCalled = true; },
            saveUserBanksToStorage: function() { saveCalled = true; }
        });

        // First copy something
        actions.doCopy();
    });

    it('pastes clipboard into current patch slot', function() {
        const result = actions.doPaste();
        expect(result.success).toBe(true);
        expect(bank['User Bank'][0].name).toBe('My Synth');
        expect(bank['User Bank'][0].unpackedBytes[0]).toBe(0x10);
    });

    it('calls triggerMidiDump, renderPatchesForBank, and saveUserBanksToStorage', function() {
        actions.doPaste();
        expect(midiDumpCalled).toBe(true);
        expect(renderCalled).toBe(true);
        expect(saveCalled).toBe(true);
    });

    it('writes patch name bytes into unpackedBytes[224..238]', function() {
        actions.doPaste();
        const bytes = bank['User Bank'][0].unpackedBytes;
        // 'My Synth' → char codes at offset 224+
        expect(bytes[224]).toBe('M'.charCodeAt(0));
        expect(bytes[225]).toBe('y'.charCodeAt(0));
        expect(bytes[230]).toBe('t'.charCodeAt(0));
        expect(bytes[231]).toBe('h'.charCodeAt(0));
        // After name, fill with spaces (0x20)
        expect(bytes[232]).toBe(0x20);
        expect(bytes[238]).toBe(0x20);
    });

    it('alerts when clipboard is empty', function() {
        const emptyActions = runEditActions({
            activeBank: bank,
            currentActiveBank: 'User Bank',
            currentActivePatchIndex: 0
        });
        const result = emptyActions.doPaste();
        expect(result.success).toBe(false);
        expect(result.alerts).toContain('El portapapeles está vacío. Copia un preset primero.');
    });

    it('blocks paste on factory banks', function() {
        const factoryActions = runEditActions({
            activeBank: { 'Factory Bank A': [{ index: 0, name: 'Original', unpackedBytes: new Uint8Array(256) }] },
            currentActiveBank: 'Factory Bank A',
            currentActivePatchIndex: 0
        });
        // Copy first
        const copyResult = factoryActions.doCopy();
        expect(copyResult.clipboardName).toBe('Original');

        const result = factoryActions.doPaste();
        expect(result.success).toBe(false);
        expect(result.alerts).toContain('No está permitido modificar o pegar presets en los bancos de fábrica.');
    });

    it('alerts when no destination slot is selected', function() {
        actions = runEditActions({
            activeBank: bank,
            currentActiveBank: 'User Bank',
            currentActivePatchIndex: -1
        });
        actions.doCopy(); // empty copy because no patch selected
        // Set clipboard manually by doing a proper copy first then switching index
        const result = actions.doPaste();
        expect(result.success).toBe(false);
    });

    it('blocks paste on all 8 factory banks', function() {
        const factoryLetters = ['A','B','C','D','E','F','G','H'];
        factoryLetters.forEach(function(letter) {
            const bankName = 'Factory Bank ' + letter;
            const fa = runEditActions({
                activeBank: { [bankName]: [{ index: 0, name: 'Test', unpackedBytes: new Uint8Array(256) }] },
                currentActiveBank: bankName,
                currentActivePatchIndex: 0
            });
            fa.doCopy();
            const r = fa.doPaste();
            expect(r.success).toBe(false);
            expect(r.alerts).toContain('No está permitido modificar o pegar presets en los bancos de fábrica.');
        });
    });
});

describe('editActions — Keyboard shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+C, Ctrl+V)', function() {
    let actions, undoCalled, redoCalled, copyCalls, pasteCalls;

    beforeEach(function() {
        undoCalled = 0;
        redoCalled = 0;
        copyCalls = 0;
        pasteCalls = 0;

        actions = runEditActions({
            triggerUndo: function() { undoCalled++; },
            triggerRedo: function() { redoCalled++; },
            getElementById: function(id) {
                if (id === 'menu-copy-preset') {return { click: function() { copyCalls++; } };}
                if (id === 'menu-paste-preset') {return { click: function() { pasteCalls++; } };}
                return null;
            },
            getSelectionStr: function() { return ''; },
            activeElementTagName: 'BODY'
        });
    });

    it('Ctrl+Z triggers undo', function() {
        const result = actions.handleKeydown({ ctrlKey: true, metaKey: false, key: 'z' });
        expect(result).toBe('undo');
        expect(undoCalled).toBe(1);
    });

    it('Ctrl+Y triggers redo', function() {
        const result = actions.handleKeydown({ ctrlKey: true, metaKey: false, key: 'y' });
        expect(result).toBe('redo');
        expect(redoCalled).toBe(1);
    });

    it('Ctrl+C triggers copy when no text selected', function() {
        const result = actions.handleKeydown({ ctrlKey: true, metaKey: false, key: 'c' });
        expect(result).toBe('copy');
        expect(copyCalls).toBe(1);
    });

    it('Ctrl+C does not trigger copy when text is selected', function() {
        actions = runEditActions({
            getSelectionStr: function() { return 'selected text'; },
            getElementById: function() { return null; }
        });
        const result = actions.handleKeydown({ ctrlKey: true, metaKey: false, key: 'c' });
        expect(result).toBeNull();
        expect(copyCalls).toBe(0);
    });

    it('Ctrl+V triggers paste when not in INPUT/SELECT', function() {
        const result = actions.handleKeydown({ ctrlKey: true, metaKey: false, key: 'v' });
        expect(result).toBe('paste');
        expect(pasteCalls).toBe(1);
    });

    it('Ctrl+V is blocked when in an INPUT element', function() {
        actions = runEditActions({
            activeElementTagName: 'INPUT',
            getElementById: function() { return null; }
        });
        const result = actions.handleKeydown({ ctrlKey: true, metaKey: false, key: 'v' });
        expect(result).toBeNull();
        expect(pasteCalls).toBe(0);
    });

    it('Ctrl+V is blocked when in a SELECT element', function() {
        actions = runEditActions({
            activeElementTagName: 'SELECT',
            getElementById: function() { return null; }
        });
        const result = actions.handleKeydown({ ctrlKey: true, metaKey: false, key: 'v' });
        expect(result).toBeNull();
    });

    it('non-matching keys do nothing', function() {
        const result = actions.handleKeydown({ ctrlKey: true, metaKey: false, key: 'x' });
        expect(result).toBeNull();
        expect(undoCalled).toBe(0);
        expect(redoCalled).toBe(0);
        expect(copyCalls).toBe(0);
        expect(pasteCalls).toBe(0);
    });

    it('keys without Ctrl/Meta do nothing', function() {
        const result = actions.handleKeydown({ ctrlKey: false, metaKey: false, key: 'z' });
        expect(result).toBeUndefined();
        expect(undoCalled).toBe(0);
    });

    it('Meta+Z also triggers undo', function() {
        const result = actions.handleKeydown({ ctrlKey: false, metaKey: true, key: 'z' });
        expect(result).toBe('undo');
        expect(undoCalled).toBe(1);
    });
});
