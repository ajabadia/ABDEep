/**
 * @purpose Manages keyboard shortcuts configuration, metadata, and mapping checks.
 * @purpose_en Keyboard Shortcut Configuration System.
 */

window.ShortcutConfig = {
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
    }
};

window.initKeyboardShortcuts = function() {
    document.addEventListener('keydown', function (e) {
        if (window._shortcutCaptureActive) {return;}
        
        const shortcuts = window.ShortcutConfig.load();
        
        // MIDI Learn
        if (window.ShortcutConfig.matches(e, shortcuts['midi-learn'])) {
            e.preventDefault();
            var bridge = window.dualMidiBridge;
            if (bridge && typeof bridge.toggleMidiLearn === 'function') {
                bridge.toggleMidiLearn();
            }
            return;
        }
        
        // SEQ Quick-Start
        if (window.ShortcutConfig.matches(e, shortcuts['seq-quickstart'])) {
            e.preventDefault();
            var bridge = window.dualMidiBridge;
            if (!bridge) {return;}
            const seqBtn = document.getElementById('programmer-seq-btn');
            if (seqBtn) {seqBtn.click();}
            const currentSeqEn = bridge.parameterCache['seq_enable'] || 0;
            if (currentSeqEn < 0.5) {
                bridge.setParameter('seq_enable', 1.0);
                console.log('[SeqSim] Started sequencer via shortcut');
            }
            return;
        }
        
        // SEQ Debug
        if (window.ShortcutConfig.matches(e, shortcuts['seq-debug'])) {
            e.preventDefault();
            window._seqDebugMode = !window._seqDebugMode;
            console.log('[SeqDebug] Debug mode:', window._seqDebugMode ? 'ON' : 'OFF');
            const lcdText = document.getElementById('lcd-text');
            if (lcdText && window._seqDebugMode) {
                lcdText.innerHTML = '<span style="font-size:10px; opacity:0.6;">SEQ DEBUG</span><br><strong style="color:var(--accent-pink);">MODE ACTIVE</strong><br><span style="font-size:7px; color:var(--text-dim);">Start sequencer to view steps</span>';
            }
            return;
        }
        
        // PANIC
        if (window.ShortcutConfig.matches(e, shortcuts['panic'])) {
            e.preventDefault();
            const panicBtn = document.getElementById('programmer-panic-btn');
            if (panicBtn) {
                panicBtn.click();
            }
            return;
        }
    });
};

document.addEventListener('DOMContentLoaded', () => {
    window.initKeyboardShortcuts();
});
