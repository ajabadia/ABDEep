/**
 * Tests for WebUI/js/settings_shortcuts.js — Keyboard shortcut settings tab logic
 *
 * Strategy: extracted keyboard capture validation, combo building, shortcut grouping,
 * and feedback message generation. DOM-heavy initKeyboardShortcutsSettings() is not covered.
 */

// ===== Global stubs =====
globalThis.window = globalThis.window || {};

// ===== Extracted Source Functions =====

var SHORTCUT_GROUP_ORDER = ['global', 'sequencer', 'other'];
var SHORTCUT_GROUP_LABELS = { 'global': 'Global', 'sequencer': 'Sequencer', 'other': 'Other' };
var SHORTCUT_GROUP_COLORS = { 'global': '--accent-cyan', 'sequencer': '--accent-pink', 'other': '--text-dim' };

var MODIFIER_KEYS = ['Control', 'Shift', 'Alt', 'Meta'];

function isModifierKey(key) {
    return MODIFIER_KEYS.indexOf(key) !== -1;
}

function buildComboFromEvent(key, ctrlKey, shiftKey, altKey, metaKey) {
    return {
        key: key,
        ctrl: !!ctrlKey,
        shift: !!shiftKey,
        alt: !!altKey,
        meta: !!metaKey
    };
}

function hasModifier(combo) {
    return !!(combo.ctrl || combo.shift || combo.alt || combo.meta);
}

function validateCombo(combo) {
    if (!hasModifier(combo)) {
        return 'Use at least one modifier key (Ctrl, Shift, Alt)';
    }
    return null; // valid
}

function handleCaptureKey(key, ctrlKey, shiftKey, altKey, metaKey) {
    if (key === 'Escape') return { action: 'cancel', message: '✕ Cancelled' };
    if (isModifierKey(key)) return { action: 'ignore' };

    var combo = buildComboFromEvent(key, ctrlKey, shiftKey, altKey, metaKey);
    var validationError = validateCombo(combo);
    if (validationError) {
        return { action: 'warning', message: '⚠ ' + validationError };
    }

    return { action: 'save', combo: combo };
}

function groupShortcuts(ids, meta) {
    var groups = {};
    ids.forEach(function(id) {
        var m = meta[id] || { group: 'other', label: id, description: '', color: '--text-dim' };
        if (!groups[m.group]) groups[m.group] = [];
        groups[m.group].push({ id: id, meta: m });
    });
    return groups;
}

function getGroupLabel(group) {
    return SHORTCUT_GROUP_LABELS[group] || group;
}

function getGroupColor(group) {
    return SHORTCUT_GROUP_COLORS[group] || '--text-dim';
}

function getDefaultGroupedIds() {
    // Returns the grouped structure with ids sorted by groupOrder
    var result = [];
    SHORTCUT_GROUP_ORDER.forEach(function(group) {
        result.push({ group: group, label: getGroupLabel(group), color: getGroupColor(group) });
    });
    return result;
}

function formatCaptureFeedbackMessage(type, context) {
    if (type === 'cancel') return '✕ Cancelled';
    if (type === 'save') return '✓ Saved: ' + (context || '');
    if (type === 'warning') return '⚠ ' + (context || '');
    if (type === 'reset') return '✓ All shortcuts reset to defaults';
    if (type === 'capture-prompt') return '⌨ Press key combination for "' + (context || '') + '"...';
    return '';
}

function shouldShowRowAsCapturing(captureState, id) {
    return !!(captureState && captureState.id === id);
}

// ===== Tests =====

describe('SHORTCUT_GROUP_ORDER', function() {
    it('has 3 groups in order: global, sequencer, other', function() {
        expect(SHORTCUT_GROUP_ORDER.length).toBe(3);
        expect(SHORTCUT_GROUP_ORDER[0]).toBe('global');
        expect(SHORTCUT_GROUP_ORDER[1]).toBe('sequencer');
        expect(SHORTCUT_GROUP_ORDER[2]).toBe('other');
    });
});

describe('SHORTCUT_GROUP_LABELS', function() {
    it('maps all 3 groups to display names', function() {
        expect(SHORTCUT_GROUP_LABELS.global).toBe('Global');
        expect(SHORTCUT_GROUP_LABELS.sequencer).toBe('Sequencer');
        expect(SHORTCUT_GROUP_LABELS.other).toBe('Other');
    });
});

describe('SHORTCUT_GROUP_COLORS', function() {
    it('maps all 3 groups to CSS color variables', function() {
        expect(SHORTCUT_GROUP_COLORS.global).toBe('--accent-cyan');
        expect(SHORTCUT_GROUP_COLORS.sequencer).toBe('--accent-pink');
        expect(SHORTCUT_GROUP_COLORS.other).toBe('--text-dim');
    });
});

describe('MODIFIER_KEYS', function() {
    it('contains all 4 modifier keys', function() {
        expect(MODIFIER_KEYS).toContain('Control');
        expect(MODIFIER_KEYS).toContain('Shift');
        expect(MODIFIER_KEYS).toContain('Alt');
        expect(MODIFIER_KEYS).toContain('Meta');
    });
});

describe('isModifierKey', function() {
    it('returns true for Control', function() {
        expect(isModifierKey('Control')).toBe(true);
    });

    it('returns true for Shift', function() {
        expect(isModifierKey('Shift')).toBe(true);
    });

    it('returns true for Alt', function() {
        expect(isModifierKey('Alt')).toBe(true);
    });

    it('returns true for Meta', function() {
        expect(isModifierKey('Meta')).toBe(true);
    });

    it('returns false for regular keys', function() {
        expect(isModifierKey('a')).toBe(false);
        expect(isModifierKey('1')).toBe(false);
        expect(isModifierKey('Enter')).toBe(false);
        expect(isModifierKey('Escape')).toBe(false);
    });

    it('returns false for empty string', function() {
        expect(isModifierKey('')).toBe(false);
    });
});

describe('buildComboFromEvent', function() {
    it('builds combo object with all modifiers', function() {
        var combo = buildComboFromEvent('z', true, true, false, false);
        expect(combo).toEqual({ key: 'z', ctrl: true, shift: true, alt: false, meta: false });
    });

    it('coerces undefined to false', function() {
        var combo = buildComboFromEvent('s', true, undefined, undefined, undefined);
        expect(combo.ctrl).toBe(true);
        expect(combo.shift).toBe(false);
        expect(combo.alt).toBe(false);
        expect(combo.meta).toBe(false);
    });

    it('records key as-is', function() {
        var combo = buildComboFromEvent('F5', false, false, false, false);
        expect(combo.key).toBe('F5');
    });
});

describe('hasModifier', function() {
    it('returns true when ctrl is set', function() {
        expect(hasModifier({ ctrl: true })).toBe(true);
    });

    it('returns true when shift is set', function() {
        expect(hasModifier({ shift: true })).toBe(true);
    });

    it('returns true when alt is set', function() {
        expect(hasModifier({ alt: true })).toBe(true);
    });

    it('returns true when meta is set', function() {
        expect(hasModifier({ meta: true })).toBe(true);
    });

    it('returns false when no modifiers', function() {
        expect(hasModifier({ ctrl: false, shift: false, alt: false, meta: false })).toBe(false);
    });

    it('returns false for empty object', function() {
        expect(hasModifier({})).toBe(false);
    });
});

describe('validateCombo', function() {
    it('returns null for combo with modifier', function() {
        expect(validateCombo({ ctrl: true, shift: false, key: 'z' })).toBeNull();
    });

    it('returns error string for combo without modifier', function() {
        var err = validateCombo({ ctrl: false, shift: false, alt: false, meta: false, key: 'a' });
        expect(err).toContain('modifier');
    });

    it('returns error for empty combo', function() {
        expect(validateCombo({})).toContain('modifier');
    });
});

describe('handleCaptureKey — full capture decision logic', function() {
    it('cancels on Escape', function() {
        var result = handleCaptureKey('Escape', false, false, false, false);
        expect(result.action).toBe('cancel');
        expect(result.message).toContain('Cancelled');
    });

    it('ignores modifier-only keys', function() {
        var result = handleCaptureKey('Control', false, false, false, false);
        expect(result.action).toBe('ignore');
    });

    it('returns warning when no modifier is held', function() {
        var result = handleCaptureKey('a', false, false, false, false);
        expect(result.action).toBe('warning');
        expect(result.message).toContain('modifier');
    });

    it('returns save for key with modifier', function() {
        var result = handleCaptureKey('z', true, false, false, false);
        expect(result.action).toBe('save');
        expect(result.combo.ctrl).toBe(true);
        expect(result.combo.key).toBe('z');
    });

    it('returns save for key with shift+alt', function() {
        var result = handleCaptureKey('Tab', false, true, true, false);
        expect(result.action).toBe('save');
        expect(result.combo.key).toBe('Tab');
        expect(result.combo.shift).toBe(true);
        expect(result.combo.alt).toBe(true);
    });

    it('returns save for F-key with meta', function() {
        var result = handleCaptureKey('F1', false, false, false, true);
        expect(result.action).toBe('save');
        expect(result.combo.meta).toBe(true);
    });
});

describe('groupShortcuts — organize by group field', function() {
    var testMeta, testIds;

    beforeEach(function() {
        testMeta = {
            'ctrl_save': { group: 'global', label: 'Save' },
            'ctrl_copy': { group: 'global', label: 'Copy' },
            'seq_start': { group: 'sequencer', label: 'Start' },
            'unknown': { group: 'other', label: 'Unknown' }
        };
        testIds = ['ctrl_save', 'ctrl_copy', 'seq_start', 'unknown'];
    });

    it('groups items by meta.group', function() {
        var groups = groupShortcuts(testIds, testMeta);
        expect(Object.keys(groups).sort()).toEqual(['global', 'other', 'sequencer']);
        expect(groups.global.length).toBe(2);
        expect(groups.sequencer.length).toBe(1);
        expect(groups.other.length).toBe(1);
    });

    it('falls back to group "other" for ids without meta', function() {
        var groups = groupShortcuts(['unknown_id'], {});
        expect(groups.other.length).toBe(1);
        expect(groups.other[0].id).toBe('unknown_id');
    });

    it('includes meta data in grouped items', function() {
        var groups = groupShortcuts(testIds, testMeta);
        expect(groups.global[0].meta.label).toBe('Save');
        expect(groups.global[1].meta.label).toBe('Copy');
    });

    it('handles null meta gracefully', function() {
        var groups = groupShortcuts(['test'], { 'test': null });
        expect(groups.other.length).toBe(1);
        expect(groups.other[0].id).toBe('test');
    });
});

describe('getGroupLabel', function() {
    it('returns display name for known groups', function() {
        expect(getGroupLabel('global')).toBe('Global');
        expect(getGroupLabel('sequencer')).toBe('Sequencer');
        expect(getGroupLabel('other')).toBe('Other');
    });

    it('falls back to group name for unknown groups', function() {
        expect(getGroupLabel('unknown')).toBe('unknown');
    });
});

describe('getGroupColor', function() {
    it('returns CSS variable for known groups', function() {
        expect(getGroupColor('global')).toBe('--accent-cyan');
        expect(getGroupColor('sequencer')).toBe('--accent-pink');
        expect(getGroupColor('other')).toBe('--text-dim');
    });

    it('falls back to --text-dim for unknown groups', function() {
        expect(getGroupColor('unknown')).toBe('--text-dim');
    });
});

describe('getDefaultGroupedIds', function() {
    it('returns 3 entries in group order', function() {
        var result = getDefaultGroupedIds();
        expect(result.length).toBe(3);
        expect(result[0].group).toBe('global');
        expect(result[1].group).toBe('sequencer');
        expect(result[2].group).toBe('other');
    });

    it('includes label and color for each group', function() {
        var result = getDefaultGroupedIds();
        expect(result[0].label).toBe('Global');
        expect(result[0].color).toBe('--accent-cyan');
        expect(result[1].label).toBe('Sequencer');
        expect(result[1].color).toBe('--accent-pink');
        expect(result[2].label).toBe('Other');
        expect(result[2].color).toBe('--text-dim');
    });
});

describe('formatCaptureFeedbackMessage', function() {
    it('formats cancel message', function() {
        expect(formatCaptureFeedbackMessage('cancel')).toBe('✕ Cancelled');
    });

    it('formats save message', function() {
        expect(formatCaptureFeedbackMessage('save', 'Ctrl+S')).toBe('✓ Saved: Ctrl+S');
    });

    it('formats warning message', function() {
        expect(formatCaptureFeedbackMessage('warning', 'Use at least one modifier')).toBe('⚠ Use at least one modifier');
    });

    it('formats reset message', function() {
        expect(formatCaptureFeedbackMessage('reset')).toBe('✓ All shortcuts reset to defaults');
    });

    it('formats capture prompt message', function() {
        expect(formatCaptureFeedbackMessage('capture-prompt', 'Save')).toBe('⌨ Press key combination for "Save"...');
    });

    it('returns empty string for unknown type', function() {
        expect(formatCaptureFeedbackMessage('unknown')).toBe('');
    });
});

describe('shouldShowRowAsCapturing', function() {
    it('returns true when captureState matches id', function() {
        expect(shouldShowRowAsCapturing({ id: 'ctrl_save' }, 'ctrl_save')).toBe(true);
    });

    it('returns false when captureState id differs', function() {
        expect(shouldShowRowAsCapturing({ id: 'ctrl_save' }, 'ctrl_copy')).toBe(false);
    });

    it('returns false when captureState is null', function() {
        expect(shouldShowRowAsCapturing(null, 'ctrl_save')).toBe(false);
    });

    it('returns false when captureState is undefined', function() {
        expect(shouldShowRowAsCapturing(undefined, 'ctrl_save')).toBe(false);
    });
});
