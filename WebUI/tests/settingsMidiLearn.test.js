/**
 * Tests for WebUI/js/settings_midi_learn.js — MIDI Learn mappings management
 *
 * Strategy: extracted rendering, export/import, and CRUD functions with DI.
 * Tests cover mapping list generation, empty states, JSON round-trip, delete/clear.
 */

// ===== Global stubs =====
globalThis.window = globalThis.window || {};
globalThis.document = globalThis.document || { createElement: function() { return {}; } };

// ===== Extracted Source Functions =====

function generateMappingsHtml(mappings, getParamName) {
    getParamName = getParamName || function(id) { return id; };
    if (!mappings) {return { html: '<div class="text-dim text-center" style="padding:20px">No mappings yet.</div>', count: 0, entries: [] };}
    const keys = Object.keys(mappings);
    if (keys.length === 0) {
        return { html: '<div class="text-dim text-center" style="padding:20px">No mappings yet.</div>', count: 0, entries: [] };
    }

    let html = '';
    const entries = [];
    keys.forEach(function(key) {
        const paramId = mappings[key];
        const displayKey = key.replace('nrpn:', 'NRPN ').replace('cc:', 'CC ');
        const paramName = getParamName(paramId);
        entries.push({ key: key, paramId: paramId, displayKey: displayKey, paramName: paramName });
        html += '<div style="display:flex;align-items:center;gap:8px;padding:4px 6px;border-bottom:1px solid var(--border-dim)">'
            + '<span style="color:var(--accent-blue);font-weight:bold;min-width:80px">' + displayKey + '</span>'
            + '<span>→</span>'
            + '<span style="color:var(--brand-accent);flex:1">' + paramName.toUpperCase() + '</span>'
            + '<button class="midi-learn-del-btn" data-key="' + key + '" style="background:none;border:1px solid var(--color-danger);color:var(--color-danger)">Delete</button>'
            + '</div>';
    });

    return { html: html, count: keys.length, entries: entries };
}

function generateExportJson(mappings) {
    if (!mappings || Object.keys(mappings).length === 0) {return '{}';}
    return JSON.stringify(mappings, null, 2);
}

function importMappingsFromJson(jsonStr, existingMappings) {
    existingMappings = existingMappings || {};
    try {
        const parsed = JSON.parse(jsonStr);
        if (typeof parsed !== 'object' || parsed === null) {return { success: false, count: 0, error: 'Invalid format' };}
        let importedCount = 0;
        Object.keys(parsed).forEach(function(key) {
            existingMappings[key] = parsed[key];
            importedCount++;
        });
        return { success: true, count: importedCount, mappings: existingMappings };
    } catch (e) {
        return { success: false, count: 0, error: 'Invalid JSON' };
    }
}

function deleteMapping(mappings, key) {
    if (!mappings || !mappings[key]) {return false;}
    delete mappings[key];
    return true;
}

function clearAllMappings() {
    return {};
}

function getMappingCount(mappings) {
    if (!mappings) {return 0;}
    return Object.keys(mappings).length;
}

function flashButton(btn) {
    if (!btn) {return;}
    btn.classList.add('btn-flash');
    // setTimeout would be called in real code
    return true;
}

// ===== Tests =====

describe('generateMappingsHtml — list rendering', function() {
    it('returns empty state when no mappings', function() {
        const result = generateMappingsHtml({});
        expect(result.count).toBe(0);
        expect(result.html).toContain('No mappings yet.');
        expect(result.entries.length).toBe(0);
    });

    it('returns empty state when mappings is null', function() {
        const result = generateMappingsHtml(null);
        expect(result.count).toBe(0);
        expect(result.html).toContain('No mappings yet.');
    });

    it('renders a single NRPN mapping', function() {
        const result = generateMappingsHtml({ 'nrpn:42': 'vcf_cutoff' });
        expect(result.count).toBe(1);
        expect(result.entries.length).toBe(1);
        expect(result.entries[0].displayKey).toBe('NRPN 42');
        expect(result.entries[0].paramName).toBe('vcf_cutoff');
        expect(result.html).toContain('NRPN 42');
        expect(result.html).toContain('VCF_CUTOFF');
    });

    it('renders a CC mapping with display key', function() {
        const result = generateMappingsHtml({ 'cc:7': 'vca_level' });
        expect(result.entries[0].displayKey).toBe('CC 7');
        expect(result.html).toContain('CC 7');
    });

    it('renders multiple mappings', function() {
        const mappings = {
            'nrpn:42': 'vcf_cutoff',
            'cc:7': 'vca_level',
            'nrpn:20': 'osc1_pitch_mod'
        };
        const result = generateMappingsHtml(mappings);
        expect(result.count).toBe(3);
        expect(result.entries.length).toBe(3);
    });

    it('uses getParamName callback for parameter names', function() {
        const nameMap = { 'vcf_cutoff': 'Filter Cutoff', 'vca_level': 'VCA Level' };
        const result = generateMappingsHtml(
            { 'nrpn:42': 'vcf_cutoff', 'cc:7': 'vca_level' },
            function(id) { return nameMap[id] || id; }
        );
        expect(result.entries[0].paramName).toBe('Filter Cutoff');
        expect(result.html).toContain('FILTER CUTOFF');
        expect(result.entries[1].paramName).toBe('VCA Level');
        expect(result.html).toContain('VCA LEVEL');
    });

    it('falls back to paramId if getParamName is not provided', function() {
        const result = generateMappingsHtml({ 'nrpin:42': 'vcf_cutoff' });
        expect(result.entries[0].paramName).toBe('vcf_cutoff');
    });

    it('generates HTML with delete buttons containing data-key attributes', function() {
        const result = generateMappingsHtml({ 'nrpn:99': 'fx1_type' });
        expect(result.html).toContain('data-key="nrpn:99"');
        expect(result.html).toContain('Delete');
    });
});

describe('generateExportJson — JSON export', function() {
    it('returns "{}" for empty mappings', function() {
        expect(generateExportJson({})).toBe('{}');
    });

    it('returns "{}" for null mappings', function() {
        expect(generateExportJson(null)).toBe('{}');
    });

    it('formats mappings as pretty-printed JSON', function() {
        const json = generateExportJson({ 'nrpn:42': 'vcf_cutoff' });
        const parsed = JSON.parse(json);
        expect(parsed['nrpn:42']).toBe('vcf_cutoff');
        expect(json).toContain('\n'); // pretty-printed
    });

    it('preserves all mapping entries', function() {
        const mappings = { 'nrpn:1': 'lfo1_rate', 'cc:7': 'vca_level', 'nrpn:42': 'vcf_cutoff' };
        const json = generateExportJson(mappings);
        const parsed = JSON.parse(json);
        expect(Object.keys(parsed).length).toBe(3);
        expect(parsed['nrpn:42']).toBe('vcf_cutoff');
    });
});

describe('importMappingsFromJson — JSON import', function() {
    it('returns success with count for valid JSON', function() {
        const result = importMappingsFromJson('{"nrpn:42":"vcf_cutoff","cc:7":"vca_level"}', {});
        expect(result.success).toBe(true);
        expect(result.count).toBe(2);
        expect(result.mappings['nrpn:42']).toBe('vcf_cutoff');
    });

    it('merges with existing mappings without overwriting unrelated', function() {
        const existing = { 'nrpn:1': 'lfo1_rate' };
        const result = importMappingsFromJson('{"nrpn:42":"vcf_cutoff"}', existing);
        expect(result.mappings['nrpn:1']).toBe('lfo1_rate');
        expect(result.mappings['nrpn:42']).toBe('vcf_cutoff');
        expect(result.count).toBe(1);
    });

    it('overwrites existing mapping with same key', function() {
        const existing = { 'nrpn:42': 'old_param' };
        const result = importMappingsFromJson('{"nrpn:42":"new_param"}', existing);
        expect(result.mappings['nrpn:42']).toBe('new_param');
    });

    it('returns error for malformed JSON', function() {
        const result = importMappingsFromJson('not-json{{{', {});
        expect(result.success).toBe(false);
        expect(result.count).toBe(0);
        expect(result.error).toBe('Invalid JSON');
    });

    it('returns error for non-object JSON', function() {
        const result = importMappingsFromJson('"just a string"', {});
        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid format');
    });

    it('returns error for null JSON value', function() {
        const result = importMappingsFromJson('null', {});
        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid format');
    });

    it('creates mappings object if not provided', function() {
        const result = importMappingsFromJson('{"nrpn:5":"lfo2_rate"}');
        expect(result.success).toBe(true);
        expect(result.mappings['nrpn:5']).toBe('lfo2_rate');
    });
});

describe('deleteMapping — remove single mapping', function() {
    let mappings;

    beforeEach(function() {
        mappings = { 'nrpn:1': 'lfo1_rate', 'nrpn:42': 'vcf_cutoff' };
    });

    it('removes a mapping by key', function() {
        const result = deleteMapping(mappings, 'nrpn:42');
        expect(result).toBe(true);
        expect(mappings['nrpn:42']).toBeUndefined();
        expect(mappings['nrpn:1']).toBe('lfo1_rate');
    });

    it('returns false when key does not exist', function() {
        const result = deleteMapping(mappings, 'nonexistent');
        expect(result).toBe(false);
        expect(Object.keys(mappings).length).toBe(2);
    });

    it('returns false when mappings is null', function() {
        expect(deleteMapping(null, 'nrpn:1')).toBe(false);
    });

    it('returns false when mappings is undefined', function() {
        expect(deleteMapping(undefined, 'nrpn:1')).toBe(false);
    });
});

describe('clearAllMappings — remove all mappings', function() {
    it('returns empty object', function() {
        const empty = clearAllMappings();
        expect(typeof empty).toBe('object');
        expect(Object.keys(empty).length).toBe(0);
    });
});

describe('getMappingCount', function() {
    it('returns 0 for null', function() {
        expect(getMappingCount(null)).toBe(0);
    });

    it('returns 0 for undefined', function() {
        expect(getMappingCount(undefined)).toBe(0);
    });

    it('returns 0 for empty object', function() {
        expect(getMappingCount({})).toBe(0);
    });

    it('returns count of keys', function() {
        expect(getMappingCount({ a: '1', b: '2', c: '3' })).toBe(3);
    });
});

describe('flashButton — visual feedback', function() {
    it('adds btn-flash class', function() {
        const btn = { classList: { add: function() {}, remove: function() {} } };
        let addCalled = false;
        btn.classList.add = function(cls) {
            if (cls === 'btn-flash') {addCalled = true;}
        };
        flashButton(btn);
        expect(addCalled).toBe(true);
    });

    it('does nothing when btn is null', function() {
        const result = flashButton(null);
        expect(result).toBeUndefined();
    });

    it('does nothing when btn is undefined', function() {
        const result = flashButton(undefined);
        expect(result).toBeUndefined();
    });
});

describe('full export/import round-trip', function() {
    let originalMappings;

    beforeEach(function() {
        originalMappings = {
            'nrpn:42': 'vcf_cutoff',
            'cc:7': 'vca_level',
            'nrpn:20': 'osc1_pitch_mod',
            'nrpn:1': 'lfo1_rate'
        };
    });

    it('export → import preserves all mappings', function() {
        const json = generateExportJson(originalMappings);
        const result = importMappingsFromJson(json, {});
        expect(result.success).toBe(true);
        expect(result.count).toBe(4);
        expect(result.mappings).toEqual(originalMappings);
    });

    it('export → file → import round-trip with new object', function() {
        const json = generateExportJson(originalMappings);
        const freshMappings = {};
        const result = importMappingsFromJson(json, freshMappings);
        expect(result.mappings['nrpn:42']).toBe('vcf_cutoff');
        expect(result.mappings['cc:7']).toBe('vca_level');
    });
});
