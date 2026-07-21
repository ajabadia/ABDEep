/**
 * Tests for WebUI/js/script_shortcuts.js — ShortcutConfig CRUD, matching, formatCombo
 *
 * Strategy: self-contained extracted ShortcutConfig object with localStorage stubbing.
 */

// Global stubs for Node.js test environment
let mockStore = {};
const mockLocalStorage = (function() {
    return {
        getItem: function(key) { return mockStore[key] !== undefined ? mockStore[key] : null; },
        setItem: function(key, val) { mockStore[key] = String(val); },
        removeItem: function(key) { delete mockStore[key]; },
        clear: function() { mockStore = {}; },
        get length() { return Object.keys(mockStore).length; },
        key: function(i) { return Object.keys(mockStore)[i] || null; }
    };
})();
globalThis.localStorage = mockLocalStorage;
globalThis.window = globalThis.window || {};
globalThis.document = globalThis.document || { getElementById: function() { return null; } };

// ===== Extracted Source =====

var ShortcutConfig = {
    STORAGE_KEY: 'abd-eep-keyboard-shortcuts',

    _defaults: {
        'midi-learn':     { ctrl: true,  shift: false, alt: false, meta: false, key: 'l' },
        'panic':          { ctrl: true,  shift: true,  alt: false, meta: false, key: 'P' },
        'seq-quickstart': { ctrl: true,  shift: true,  alt: false, meta: false, key: 'S' },
        'seq-debug':      { ctrl: true,  shift: true,  alt: false, meta: false, key: 'D' },
    },

    _meta: {
        'midi-learn':     { label: 'MIDI Learn',     description: 'Toggle Learn mode',                           group: 'global',     color: '--accent-cyan' },
        'panic':          { label: 'PANIC',           description: 'All Notes Off + reset engines',                group: 'global',     color: '--accent-cyan' },
        'seq-quickstart': { label: 'SEQ Quick-Start', description: 'Open panel + enable SEQ',                     group: 'sequencer',  color: '--accent-pink' },
        'seq-debug':      { label: 'SEQ Debug',       description: 'Toggle debug mode',                           group: 'sequencer',  color: '--accent-pink' },
    },

    load: function() {
        let saved = {};
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (raw) {saved = JSON.parse(raw);}
        } catch(e) {}
        const result = {};
        for (const id in this._defaults) {
            result[id] = saved[id] ? this._deepClone(saved[id]) : this._deepClone(this._defaults[id]);
        }
        return result;
    },

    save: function(config) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(config));
        } catch(e) {}
    },

    get: function(id) {
        const all = this.load();
        return all[id] || this._deepClone(this._defaults[id]) || {};
    },

    set: function(id, combo) {
        const all = this.load();
        all[id] = this._deepClone(combo);
        this.save(all);
    },

    reset: function(id) {
        const all = this.load();
        delete all[id];
        this.save(all);
    },

    resetAll: function() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
        } catch(e) {}
    },

    formatCombo: function(combo) {
        if (!combo) {return '';}
        const parts = [];
        if (combo.ctrl)  {parts.push('Ctrl');}
        if (combo.shift) {parts.push('Shift');}
        if (combo.alt)   {parts.push('Alt');}
        if (combo.meta)  {parts.push('Meta');}
        if (combo.key)   {parts.push(combo.key.length === 1 ? combo.key.toUpperCase() : combo.key);}
        return parts.join(' + ');
    },

    getMeta: function(id) {
        return this._meta[id] || { label: id, description: '', group: 'other', color: '--text-dim' };
    },

    getAllIds: function() {
        return Object.keys(this._defaults);
    },

    matches: function(e, combo) {
        if (!combo) {return false;}
        if (!!e.ctrlKey  !== !!combo.ctrl)  {return false;}
        if (!!e.shiftKey !== !!combo.shift) {return false;}
        if (!!e.altKey   !== !!combo.alt)   {return false;}
        if (!!e.metaKey  !== !!combo.meta)  {return false;}
        const eventKey = e.key;
        if (combo.key && combo.key.length === 1 && eventKey.length === 1) {
            return eventKey.toLowerCase() === combo.key.toLowerCase();
        }
        return eventKey === combo.key;
    },

    _deepClone: function(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    // Extraída desde initKeyboardShortcuts para testing
    _handleKeydown: function(e) {
        if (window._shortcutCaptureActive) {return;}
        const shortcuts = ShortcutConfig.load();

        if (ShortcutConfig.matches(e, shortcuts['midi-learn'])) {
            e.preventDefault();
            var bridge = window.dualMidiBridge;
            if (bridge && typeof bridge.toggleMidiLearn === 'function') {
                bridge.toggleMidiLearn();
            }
            return;
        }

        if (ShortcutConfig.matches(e, shortcuts['seq-quickstart'])) {
            e.preventDefault();
            var bridge = window.dualMidiBridge;
            if (!bridge) {return;}
            const seqBtn = document.getElementById('programmer-seq-btn');
            if (seqBtn) {seqBtn.click();}
            const currentSeqEn = bridge.parameterCache['seq_enable'] || 0;
            if (currentSeqEn < 0.5) {
                bridge.setParameter('seq_enable', 1.0);
            }
            return;
        }

        if (ShortcutConfig.matches(e, shortcuts['seq-debug'])) {
            e.preventDefault();
            window._seqDebugMode = !window._seqDebugMode;
            return;
        }

        if (ShortcutConfig.matches(e, shortcuts['panic'])) {
            e.preventDefault();
            const panicBtn = document.getElementById('programmer-panic-btn');
            if (panicBtn) {
                panicBtn.click();
            }
            return;
        }
    }
};

// ===== Tests =====

describe('ShortcutConfig — defaults and constants', function() {
    it('STORAGE_KEY is "abd-eep-keyboard-shortcuts"', function() {
        expect(ShortcutConfig.STORAGE_KEY).toBe('abd-eep-keyboard-shortcuts');
    });

    it('_defaults has 4 entries', function() {
        const keys = Object.keys(ShortcutConfig._defaults);
        expect(keys.length).toBe(4);
    });

    it('_defaults includes midi-learn with ctrl+key=l', function() {
        expect(ShortcutConfig._defaults['midi-learn'].ctrl).toBe(true);
        expect(ShortcutConfig._defaults['midi-learn'].key).toBe('l');
    });

    it('_defaults includes panic with ctrl+shift+key=P', function() {
        expect(ShortcutConfig._defaults['panic'].shift).toBe(true);
        expect(ShortcutConfig._defaults['panic'].key).toBe('P');
    });

    it('_defaults includes seq-quickstart with ctrl+shift+key=S', function() {
        expect(ShortcutConfig._defaults['seq-quickstart'].shift).toBe(true);
        expect(ShortcutConfig._defaults['seq-quickstart'].key).toBe('S');
    });

    it('_defaults includes seq-debug with ctrl+shift+key=D', function() {
        expect(ShortcutConfig._defaults['seq-debug'].key).toBe('D');
    });

    it('_meta keys match _defaults keys', function() {
        const metaKeys = Object.keys(ShortcutConfig._meta).sort();
        const defaultKeys = Object.keys(ShortcutConfig._defaults).sort();
        expect(metaKeys).toEqual(defaultKeys);
    });
});

describe('ShortcutConfig — load / save / get / set / reset', function() {
    beforeEach(function() {
        mockLocalStorage.clear();
    });

    it('load() returns defaults when nothing saved', function() {
        const config = ShortcutConfig.load();
        expect(config['midi-learn'].ctrl).toBe(true);
        expect(config['panic'].key).toBe('P');
    });

    it('save() persists to localStorage', function() {
        const custom = {};
        for (const id in ShortcutConfig._defaults) {
            custom[id] = { ctrl: false, shift: false, alt: false, meta: false, key: 'x' };
        }
        ShortcutConfig.save(custom);
        const raw = mockLocalStorage.getItem(ShortcutConfig.STORAGE_KEY);
        expect(raw).toBeDefined();
        const parsed = JSON.parse(raw);
        expect(parsed['midi-learn'].key).toBe('x');
    });

    it('load() returns saved values after save()', function() {
        ShortcutConfig.save({
            'midi-learn': { ctrl: false, shift: true, alt: false, meta: false, key: 'z' },
            'panic': { ctrl: false, shift: true, alt: false, meta: false, key: 'z' },
            'seq-quickstart': { ctrl: false, shift: true, alt: false, meta: false, key: 'z' },
            'seq-debug': { ctrl: false, shift: true, alt: false, meta: false, key: 'z' }
        });
        const loaded = ShortcutConfig.load();
        expect(loaded['midi-learn'].shift).toBe(true);
        expect(loaded['midi-learn'].key).toBe('z');
    });

    it('get() returns default when nothing saved', function() {
        mockLocalStorage.clear();
        const combo = ShortcutConfig.get('midi-learn');
        expect(combo.ctrl).toBe(true);
        expect(combo.key).toBe('l');
    });

    it('get() clones the object (no mutation)', function() {
        const combo = ShortcutConfig.get('midi-learn');
        combo.ctrl = false;
        const combo2 = ShortcutConfig.get('midi-learn');
        expect(combo2.ctrl).toBe(true);
    });

    it('set() stores single combo', function() {
        ShortcutConfig.set('panic', { ctrl: true, shift: false, alt: false, meta: false, key: 'X' });
        const loaded = ShortcutConfig.load();
        expect(loaded['panic'].ctrl).toBe(true);
        expect(loaded['panic'].key).toBe('X');
    });

    it('set() does not affect other ids', function() {
        ShortcutConfig.set('panic', { ctrl: true, shift: false, alt: false, meta: false, key: 'X' });
        const loaded = ShortcutConfig.load();
        expect(loaded['midi-learn'].key).toBe('l');
    });

    it('reset() reverts single id to default', function() {
        ShortcutConfig.set('panic', { ctrl: true, shift: false, alt: false, meta: false, key: 'X' });
        ShortcutConfig.reset('panic');
        const loaded = ShortcutConfig.load();
        expect(loaded['panic'].key).toBe('P');
        expect(loaded['panic'].shift).toBe(true);
    });

    it('resetAll() clears all saved shortcuts', function() {
        ShortcutConfig.set('midi-learn', { ctrl: false, shift: false, alt: false, meta: false, key: 'a' });
        ShortcutConfig.set('panic', { ctrl: false, shift: false, alt: false, meta: false, key: 'b' });
        ShortcutConfig.resetAll();
        const loaded = ShortcutConfig.load();
        expect(loaded['midi-learn'].ctrl).toBe(true);
        expect(loaded['panic'].key).toBe('P');
    });
});

describe('ShortcutConfig — formatCombo', function() {
    it('returns empty string for null/undefined', function() {
        expect(ShortcutConfig.formatCombo(null)).toBe('');
        expect(ShortcutConfig.formatCombo(undefined)).toBe('');
    });

    it('formats Ctrl+L', function() {
        expect(ShortcutConfig.formatCombo({ ctrl: true, shift: false, alt: false, meta: false, key: 'l' })).toBe('Ctrl + L');
    });

    it('formats Ctrl+Shift+P', function() {
        expect(ShortcutConfig.formatCombo({ ctrl: true, shift: true, alt: false, meta: false, key: 'P' })).toBe('Ctrl + Shift + P');
    });

    it('formats Shift+Alt+D', function() {
        expect(ShortcutConfig.formatCombo({ ctrl: false, shift: true, alt: true, meta: false, key: 'd' })).toBe('Shift + Alt + D');
    });

    it('formats single key with no modifiers', function() {
        expect(ShortcutConfig.formatCombo({ ctrl: false, shift: false, alt: false, meta: false, key: 'Space' })).toBe('Space');
    });
});

describe('ShortcutConfig — matches', function() {
    it('returns false for null combo', function() {
        expect(ShortcutConfig.matches({ ctrlKey: true }, null)).toBe(false);
    });

    it('matches Ctrl+L event', function() {
        const combo = { ctrl: true, shift: false, alt: false, meta: false, key: 'l' };
        const e = { ctrlKey: true, shiftKey: false, altKey: false, metaKey: false, key: 'l' };
        expect(ShortcutConfig.matches(e, combo)).toBe(true);
    });

    it('matches case-insensitive for single-char keys', function() {
        const combo = { ctrl: true, shift: false, alt: false, meta: false, key: 'L' };
        const e = { ctrlKey: true, shiftKey: false, altKey: false, metaKey: false, key: 'l' };
        expect(ShortcutConfig.matches(e, combo)).toBe(true);
    });

    it('does not match when modifier differs', function() {
        const combo = { ctrl: true, shift: false, alt: false, meta: false, key: 'l' };
        const e = { ctrlKey: true, shiftKey: true, altKey: false, metaKey: false, key: 'l' };
        expect(ShortcutConfig.matches(e, combo)).toBe(false);
    });

    it('does not match when key differs', function() {
        const combo = { ctrl: true, shift: false, alt: false, meta: false, key: 'l' };
        const e = { ctrlKey: true, shiftKey: false, altKey: false, metaKey: false, key: 'k' };
        expect(ShortcutConfig.matches(e, combo)).toBe(false);
    });

    it('matches with all modifiers', function() {
        const combo = { ctrl: true, shift: true, alt: true, meta: true, key: 'x' };
        const e = { ctrlKey: true, shiftKey: true, altKey: true, metaKey: true, key: 'x' };
        expect(ShortcutConfig.matches(e, combo)).toBe(true);
    });

    it('exact match for multi-char keys', function() {
        const combo = { ctrl: false, shift: false, alt: false, meta: false, key: 'Escape' };
        const e = { ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, key: 'Escape' };
        expect(ShortcutConfig.matches(e, combo)).toBe(true);
    });

    it('matches space key', function() {
        const combo = { ctrl: false, shift: false, alt: false, meta: false, key: ' ' };
        const e = { ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, key: ' ' };
        expect(ShortcutConfig.matches(e, combo)).toBe(true);
    });
});

describe('ShortcutConfig — getMeta and getAllIds', function() {
    it('getMeta returns label for known id', function() {
        expect(ShortcutConfig.getMeta('midi-learn').label).toBe('MIDI Learn');
    });

    it('getMeta returns fallback for unknown id', function() {
        const meta = ShortcutConfig.getMeta('unknown-id');
        expect(meta.label).toBe('unknown-id');
        expect(meta.group).toBe('other');
    });

    it('getAllIds returns all default keys', function() {
        const ids = ShortcutConfig.getAllIds();
        expect(ids).toContain('midi-learn');
        expect(ids).toContain('panic');
        expect(ids.length).toBe(4);
    });
});

describe('ShortcutConfig — _handleKeydown dispatch', function() {
    let dispatchedActions;

    beforeEach(function() {
        dispatchedActions = [];
        mockLocalStorage.clear();
        window._shortcutCaptureActive = false;
        window._seqDebugMode = false;
        window.dualMidiBridge = {
            toggleMidiLearn: function() { dispatchedActions.push('midi-learn'); },
            setParameter: function() {},
            parameterCache: { seq_enable: 0 }
        };
        document.getElementById = function(id) {
            if (id === 'programmer-panic-btn') {
                return { click: function() { dispatchedActions.push('panic'); } };
            }
            if (id === 'programmer-seq-btn') {
                return { click: function() { dispatchedActions.push('seq-open'); } };
            }
            if (id === 'lcd-text') {
                return { innerHTML: '', style: {}, _ctrlLcdFadeTimer: null, _lcdFading: false };
            }
            return null;
        };
    });

    it('Ctrl+L triggers MIDI Learn toggle', function() {
        const e = { ctrlKey: true, shiftKey: false, altKey: false, metaKey: false, key: 'l', preventDefault: function() {} };
        ShortcutConfig._handleKeydown(e);
        expect(dispatchedActions).toContain('midi-learn');
    });

    it('Ctrl+Shift+P triggers PANIC', function() {
        const e = { ctrlKey: true, shiftKey: true, altKey: false, metaKey: false, key: 'P', preventDefault: function() {} };
        ShortcutConfig._handleKeydown(e);
        expect(dispatchedActions).toContain('panic');
    });

    it('Ctrl+Shift+S triggers SEQ Quick-Start (opens seq panel)', function() {
        const e = { ctrlKey: true, shiftKey: true, altKey: false, metaKey: false, key: 'S', preventDefault: function() {} };
        ShortcutConfig._handleKeydown(e);
        expect(dispatchedActions).toContain('seq-open');
    });

    it('Ctrl+Shift+D toggles SEQ Debug mode', function() {
        const e = { ctrlKey: true, shiftKey: true, altKey: false, metaKey: false, key: 'D', preventDefault: function() {} };
        expect(window._seqDebugMode).toBe(false);
        ShortcutConfig._handleKeydown(e);
        expect(window._seqDebugMode).toBe(true);
    });

    it('does not dispatch when _shortcutCaptureActive is true', function() {
        window._shortcutCaptureActive = true;
        const e = { ctrlKey: true, shiftKey: false, altKey: false, metaKey: false, key: 'l', preventDefault: function() {} };
        ShortcutConfig._handleKeydown(e);
        expect(dispatchedActions).not.toContain('midi-learn');
    });

    it('does nothing for unrelated keys', function() {
        const e = { ctrlKey: true, shiftKey: false, altKey: false, metaKey: false, key: 'x', preventDefault: function() {} };
        ShortcutConfig._handleKeydown(e);
        expect(dispatchedActions.length).toBe(0);
    });
});
