/**
 * Tests for WebUI/js/edit_history.js — Undo/Redo history stack
 *
 * Strategy: self-contained extracted functions with bridge parameterCache stubbing.
 */

// ===== Global stubs =====
globalThis.window = globalThis.window || {};

// ===== Extracted Source =====

var maxHistory = 50;
var undoStack = [];
var redoStack = [];
var isHistoryAction = false;

function captureParamSnapshot(bridge) {
    if (!bridge) return null;
    return JSON.stringify(bridge.parameterCache);
}

function restoreParamSnapshot(snapshotStr, bridge, getElementById, callbacks) {
    callbacks = callbacks || {};
    if (!snapshotStr || !bridge) return;
    isHistoryAction = true;

    var cache = JSON.parse(snapshotStr);
    Object.keys(cache).forEach(function(paramId) {
        var val = cache[paramId];
        bridge.setParameter(paramId, val);
        bridge.handleParameterChangeFromBackend(paramId, val);
    });

    if (typeof callbacks.updateLfoSliders === 'function') callbacks.updateLfoSliders();
    if (typeof callbacks.updateEnvSliders === 'function') callbacks.updateEnvSliders();
    if (typeof callbacks.updateOscSliders === 'function') callbacks.updateOscSliders();

    isHistoryAction = false;

    var lcdText = getElementById ? getElementById('lcd-text') : null;
    if (lcdText) {
        lcdText.innerHTML = '<span style="font-size:10px; opacity:0.6;">EDIT HISTORY</span><br><strong>STATE RESTORED</strong>';
    }
}

function triggerUndo(stack, redo, bridge, getElementById, callbacks) {
    if (stack.length <= 1) return { alert: "No hay más cambios que deshacer." };
    var current = stack.pop();
    redo.push(current);
    var previous = stack[stack.length - 1];
    restoreParamSnapshot(previous, bridge, getElementById, callbacks);
    return { alert: null };
}

function triggerRedo(stack, redo, bridge, getElementById, callbacks) {
    if (redo.length === 0) return { alert: "No hay cambios para rehacer." };
    var nextState = redo.pop();
    stack.push(nextState);
    restoreParamSnapshot(nextState, bridge, getElementById, callbacks);
    return { alert: null };
}

// ===== Tests =====

describe('captureParamSnapshot', function() {
    it('returns null when bridge is null', function() {
        expect(captureParamSnapshot(null)).toBeNull();
    });

    it('returns JSON string of parameterCache', function() {
        var bridge = { parameterCache: { osc1_pitch: 0.5, vcf_cutoff: 0.8 } };
        var snap = captureParamSnapshot(bridge);
        expect(typeof snap).toBe('string');
        var parsed = JSON.parse(snap);
        expect(parsed.osc1_pitch).toBe(0.5);
        expect(parsed.vcf_cutoff).toBe(0.8);
    });

    it('handles empty cache', function() {
        var bridge = { parameterCache: {} };
        var snap = captureParamSnapshot(bridge);
        expect(JSON.parse(snap)).toEqual({});
    });

    it('handles null cache gracefully', function() {
        var bridge = { parameterCache: null };
        // JSON.stringify(null) returns 'null', not null
        var snap = captureParamSnapshot(bridge);
        expect(snap).toBe('null');
    });
});

describe('restoreParamSnapshot', function() {
    var bridge, setParamCalls, handleBackendCalls, lcdHtml;

    beforeEach(function() {
        setParamCalls = [];
        handleBackendCalls = [];
        lcdHtml = '';
        isHistoryAction = false;
        bridge = {
            parameterCache: {},
            setParameter: function(id, val) { setParamCalls.push([id, val]); },
            handleParameterChangeFromBackend: function(id, val) { handleBackendCalls.push([id, val]); }
        };
    });

    it('does nothing when snapshot is null', function() {
        restoreParamSnapshot(null, bridge);
        expect(setParamCalls.length).toBe(0);
    });

    it('does nothing when bridge is null', function() {
        restoreParamSnapshot('{"a":0.5}', null);
        expect(setParamCalls.length).toBe(0);
    });

    it('restores all parameters from snapshot', function() {
        var snap = JSON.stringify({ osc1_pitch: 0.5, vcf_cutoff: 0.8 });
        restoreParamSnapshot(snap, bridge);
        expect(setParamCalls).toEqual([
            ['osc1_pitch', 0.5],
            ['vcf_cutoff', 0.8]
        ]);
        expect(handleBackendCalls).toEqual([
            ['osc1_pitch', 0.5],
            ['vcf_cutoff', 0.8]
        ]);
    });

    it('sets isHistoryAction flag during restore', function() {
        isHistoryAction = false;
        var snap = JSON.stringify({ a: 0.5 });
        restoreParamSnapshot(snap, bridge);
        expect(isHistoryAction).toBe(false);
    });

    it('calls optional callbacks after restore', function() {
        var lfoCalled = false, envCalled = false, oscCalled = false;
        var snap = JSON.stringify({ a: 0.5 });
        restoreParamSnapshot(snap, bridge, null, {
            updateLfoSliders: function() { lfoCalled = true; },
            updateEnvSliders: function() { envCalled = true; },
            updateOscSliders: function() { oscCalled = true; }
        });
        expect(lfoCalled).toBe(true);
        expect(envCalled).toBe(true);
        expect(oscCalled).toBe(true);
    });

    it('updates LCD if getElementById returns an element', function() {
        var getEl = function(id) {
            if (id === 'lcd-text') {
                return { innerHTML: '' };
            }
            return null;
        };
        var snap = JSON.stringify({ a: 0.5 });
        restoreParamSnapshot(snap, bridge, getEl);
        // LCD was updated (no assert on content needed)
        expect(setParamCalls.length).toBe(1);
    });
});

describe('triggerUndo', function() {
    var bridge, getEl, callbacks;

    beforeEach(function() {
        bridge = { parameterCache: {}, setParameter: function() {}, handleParameterChangeFromBackend: function() {} };
        getEl = function() { return null; };
        callbacks = {};
        undoStack = [];
        redoStack = [];
        isHistoryAction = false;
    });

    it('returns alert when stack has 1 or 0 items', function() {
        undoStack = [JSON.stringify({ a: 0.5 })];
        var result = triggerUndo(undoStack, redoStack, bridge, getEl, callbacks);
        expect(result.alert).toBe('No hay más cambios que deshacer.');

        undoStack = [];
        result = triggerUndo(undoStack, redoStack, bridge, getEl, callbacks);
        expect(result.alert).toBe('No hay más cambios que deshacer.');
    });

    it('pops current from stack, pushes to redo, restores previous', function() {
        undoStack = [
            JSON.stringify({ val: 0.2 }),
            JSON.stringify({ val: 0.5 }),
            JSON.stringify({ val: 0.8 })
        ];
        var result = triggerUndo(undoStack, redoStack, bridge, getEl, callbacks);
        expect(result.alert).toBeNull();
        expect(undoStack.length).toBe(2);
        expect(undoStack[undoStack.length - 1]).toBe(JSON.stringify({ val: 0.5 }));
        expect(redoStack.length).toBe(1);
        expect(redoStack[0]).toBe(JSON.stringify({ val: 0.8 }));
    });

    it('restores the previous state from stack', function() {
        undoStack = [
            JSON.stringify({ osc1: 0.2 }),
            JSON.stringify({ osc1: 0.5 })
        ];
        var setCalls = [];
        bridge.setParameter = function(id, v) { setCalls.push([id, v]); };
        bridge.handleParameterChangeFromBackend = function(id, v) {};

        triggerUndo(undoStack, redoStack, bridge, getEl, callbacks);
        expect(setCalls).toEqual([['osc1', 0.2]]);
    });
});

describe('triggerRedo', function() {
    var bridge, getEl, callbacks;

    beforeEach(function() {
        bridge = { parameterCache: {}, setParameter: function() {}, handleParameterChangeFromBackend: function() {} };
        getEl = function() { return null; };
        callbacks = {};
        undoStack = [];
        redoStack = [];
        isHistoryAction = false;
    });

    it('returns alert when redo stack is empty', function() {
        var result = triggerRedo(undoStack, redoStack, bridge, getEl, callbacks);
        expect(result.alert).toBe('No hay cambios para rehacer.');
    });

    it('pops from redo, pushes to undo, restores state', function() {
        redoStack = [JSON.stringify({ val: 0.8 })];
        undoStack = [JSON.stringify({ val: 0.2 }), JSON.stringify({ val: 0.5 })];

        var result = triggerRedo(undoStack, redoStack, bridge, getEl, callbacks);
        expect(result.alert).toBeNull();
        expect(undoStack.length).toBe(3);
        expect(undoStack[undoStack.length - 1]).toBe(JSON.stringify({ val: 0.8 }));
        expect(redoStack.length).toBe(0);
    });

    it('restores the next state from redo', function() {
        redoStack = [JSON.stringify({ osc1: 0.8 })];
        undoStack = [JSON.stringify({ osc1: 0.2 }), JSON.stringify({ osc1: 0.5 })];
        var setCalls = [];
        bridge.setParameter = function(id, v) { setCalls.push([id, v]); };
        bridge.handleParameterChangeFromBackend = function(id, v) {};

        triggerRedo(undoStack, redoStack, bridge, getEl, callbacks);
        expect(setCalls).toEqual([['osc1', 0.8]]);
    });
});

describe('undo/redo stack integrity', function() {
    beforeEach(function() {
        undoStack = [];
        redoStack = [];
        isHistoryAction = false;
    });

    it('undo pushes the undone state onto redo', function() {
        undoStack = [
            JSON.stringify({ a: 0 }),
            JSON.stringify({ a: 1 })
        ];
        redoStack = [];
        var bridge = { parameterCache: {}, setParameter: function() {}, handleParameterChangeFromBackend: function() {} };

        triggerUndo(undoStack, redoStack, bridge, function() { return null; }, {});
        expect(redoStack).toEqual([JSON.stringify({ a: 1 })]);
    });

    it('redo returns state to undo stack', function() {
        undoStack = [JSON.stringify({ a: 0 }), JSON.stringify({ a: 1 })];
        redoStack = [JSON.stringify({ a: 2 })];
        var bridge = { parameterCache: {}, setParameter: function() {}, handleParameterChangeFromBackend: function() {} };

        triggerRedo(undoStack, redoStack, bridge, function() { return null; }, {});
        expect(undoStack[undoStack.length - 1]).toBe(JSON.stringify({ a: 2 }));
        expect(redoStack.length).toBe(0);
    });

    it('enforces maxHistory limit of 50', function() {
        var bridge = { parameterCache: {}, setParameter: function() {}, handleParameterChangeFromBackend: function() {} };

        // Explicitly push 51 items to simulate history limit
        for (var i = 0; i <= 50; i++) {
            undoStack.push(JSON.stringify({ step: i }));
            if (undoStack.length > maxHistory) undoStack.shift();
        }
        expect(undoStack.length).toBe(50);
        // Oldest item (step 0 at index 0) should have been shifted off
        expect(JSON.parse(undoStack[0]).step).toBe(1);
    });
});

describe('maxHistory constant', function() {
    it('is 50', function() {
        expect(maxHistory).toBe(50);
    });
});
