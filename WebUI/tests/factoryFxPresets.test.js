/**
 * @purpose Tests for WebUI/js/factory_fx_presets.js — Factory FX presets database.
 * @purpose_en Tests for the static FACTORY_FX_PRESETS array: data integrity, type mapping, structure.
 *
 * Source: window.FACTORY_FX_PRESETS — a read-only array of preset objects extracted from
 *         the DeepMind 12 Factory Banks. Each preset has:
 *         - name: display label (e.g. "Ambience (2)")
 *         - type: normalized value 0..1 (maps to FX_TYPE_NAMES index via round(type * 35))
 *         - gain: normalized gain 0..1
 *         - params: 12-element array of normalized param values 0..1
 *         - patches: array of originating patch references (e.g. "A-089 (2)")
 *
 * FX_TYPE_NAMES from effects.js (index 0 = Bypass, 1 = Ambience, etc.):
 * ["Bypass", "Ambience", "tcDeepVerb", "RoomRev", "VintageRoom", "HallReverb",
 *  "ChamberRev", "Plate Reverb", "Rich Plate", "Gated Reverb", "Reverse Reverb",
 *  "ChorusRev", "DelayRev", "FlangerRev", "MidasEQ", "Enhancer", "FairComp",
 *  "MBDistortion", "RackAmp", "Edison", "AutoPan/Trem", "NoiseGate", "Delay",
 *  "3Tap Delay", "4Tap Delay", "T-RayDelay", "DecimatorDelay", "ModDlyRev",
 *  "Stereo Chorus", "Chorus-D", "Stereo Flanger", "Stereo Phaser", "Mood Filter",
 *  "Dual Pitch", "Vintage Pitch", "Rotary Speaker"]
 */

// =============================================================================
// Source Constants (extracted from effects.js)
// =============================================================================

var FX_TYPE_NAMES = ["Bypass", "Ambience", "tcDeepVerb", "RoomRev", "VintageRoom", "HallReverb", "ChamberRev", "Plate Reverb", "Rich Plate", "Gated Reverb", "Reverse Reverb", "ChorusRev", "DelayRev", "FlangerRev", "MidasEQ", "Enhancer", "FairComp", "MBDistortion", "RackAmp", "Edison", "AutoPan/Trem", "NoiseGate", "Delay", "3Tap Delay", "4Tap Delay", "T-RayDelay", "DecimatorDelay", "ModDlyRev", "Stereo Chorus", "Chorus-D", "Stereo Flanger", "Stereo Phaser", "Mood Filter", "Dual Pitch", "Vintage Pitch", "Rotary Speaker"];

// =============================================================================
// Extracted pure functions
// =============================================================================

/**
 * Returns the FX type name index for a normalized type value.
 * In the source: var typeVal = Math.round(typeValNormalized * 35.0);
 * @param {number} normalizedType - Value in [0, 1]
 * @returns {number} Index into FX_TYPE_NAMES (0-35)
 */
function fxTypeIndexFromNormalized(normalizedType) {
    return Math.round(normalizedType * 35.0);
}

/**
 * Returns the FX type name for a normalized type value.
 * @param {number} normalizedType - Value in [0, 1]
 * @returns {string} FX type name or "Bypass" if out of range
 */
function fxTypeNameFromNormalized(normalizedType) {
    var idx = fxTypeIndexFromNormalized(normalizedType);
    return FX_TYPE_NAMES[idx] || "Bypass";
}

/**
 * Validates a single factory preset entry.
 * @param {object} preset - A preset entry
 * @returns {object} { valid: bool, errors: string[] }
 */
function validatePresetEntry(preset) {
    var errors = [];

    if (!preset || typeof preset !== 'object') {
        return { valid: false, errors: ['preset is not an object'] };
    }

    // Name
    if (typeof preset.name !== 'string' || preset.name.length === 0) {
        errors.push('name is missing or empty');
    }

    // Type
    if (typeof preset.type !== 'number' || isNaN(preset.type)) {
        errors.push('type is not a number');
    } else if (preset.type < 0 || preset.type > 1) {
        errors.push('type out of range [0,1]: ' + preset.type);
    }

    // Gain
    if (typeof preset.gain !== 'number' || isNaN(preset.gain)) {
        errors.push('gain is not a number');
    } else if (preset.gain < 0 || preset.gain > 1) {
        errors.push('gain out of range [0,1]: ' + preset.gain);
    }

    // Params
    if (!Array.isArray(preset.params)) {
        errors.push('params is not an array');
    } else if (preset.params.length !== 12) {
        errors.push('params length is ' + preset.params.length + ', expected 12');
    } else {
        for (var i = 0; i < preset.params.length; i++) {
            var p = preset.params[i];
            if (typeof p !== 'number' || isNaN(p)) {
                errors.push('params[' + i + '] is not a number');
            } else if (p < 0 || p > 1) {
                errors.push('params[' + i + '] out of range [0,1]: ' + p);
            }
        }
    }

    // Patches
    if (!Array.isArray(preset.patches)) {
        errors.push('patches is not an array');
    } else if (preset.patches.length === 0) {
        errors.push('patches is empty');
    } else {
        for (var j = 0; j < preset.patches.length; j++) {
            if (typeof preset.patches[j] !== 'string') {
                errors.push('patches[' + j + '] is not a string');
            }
        }
    }

    return { valid: errors.length === 0, errors: errors };
}

/**
 * Groups presets by their FX type name.
 * @param {Array} presets - Array of preset objects
 * @returns {object} Map of type name → array of presets
 */
function groupPresetsByType(presets) {
    var groups = {};
    for (var i = 0; i < presets.length; i++) {
        var typeName = fxTypeNameFromNormalized(presets[i].type);
        if (!groups[typeName]) groups[typeName] = [];
        groups[typeName].push(presets[i]);
    }
    return groups;
}

/**
 * Finds duplicate names in the presets array.
 * @param {Array} presets
 * @returns {object} { hasDuplicates: bool, duplicates: string[] }
 */
function findDuplicateNames(presets) {
    var seen = {};
    var duplicates = [];
    for (var i = 0; i < presets.length; i++) {
        var name = presets[i].name;
        if (seen[name]) {
            if (seen[name] === 1) duplicates.push(name);
            seen[name]++;
        } else {
            seen[name] = 1;
        }
    }
    return { hasDuplicates: duplicates.length > 0, duplicates: duplicates };
}

// =============================================================================
// Sample presets for structural testing
// (Since full array is too large to inline, we use a representative extract)
// =============================================================================

var SAMPLE_PRESETS = [
    { name: "Ambience (2)", type: 0.02857, gain: 0.00000, params: [0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000], patches: ["A-089 (2)", "A-090 (D)", "A-093 (S)"] },
    { name: "HallReverb (B)", type: 0.14286, gain: 0.00000, params: [0.00784, 0.08627, 0.00000, 0.69804, 0.73725, 0.81176, 0.22353, 0.19608, 0.16471, 0.00000, 0.06275, 0.15686], patches: ["C-007 (B)", "C-035 (N)", "C-044 (W)"] },
    { name: "Enhancer (F)", type: 0.42857, gain: 0.39216, params: [0.69804, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000], patches: ["A-071 (F)", "A-095 (S)", "B-025 (P)"] },
    { name: "T-RayDelay (S)", type: 0.71429, gain: 0.39216, params: [0.54118, 0.50196, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000], patches: ["A-027 (S)", "A-128 (R)", "B-020 (B)"] },
    { name: "Stereo Flanger (M)", type: 0.85714, gain: 0.39216, params: [0.15686, 0.05490, 0.14902, 0.50196, 0.07843, 0.58824, 0.02745, 0.13725, 0.15294, 0.12549, 0.00000, 0.00784], patches: ["A-123 (M)", "D-004 (A)", "D-089 (M)"] },
    { name: "AutoPan/Trem (C)", type: 0.57143, gain: 0.06667, params: [0.05882, 0.03529, 0.10196, 0.50196, 0.08627, 0.05490, 0.50980, 0.70196, 0.01961, 0.07843, 0.00000, 0.03922], patches: ["A-055 (C)", "A-059 (P)", "C-019 (W)"] },
    { name: "Plate Reverb (T)", type: 0.20000, gain: 0.05882, params: [0.60392, 0.11373, 0.24706, 0.00000, 0.31765, 0.69804, 0.50196, 0.39216, 0.09412, 0.34118, 0.50196, 0.39216], patches: ["A-038 (T)", "C-105 (T)", "E-045 (T)"] },
    { name: "FlangerRev (R)", type: 0.37143, gain: 0.00000, params: [0.03922, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000], patches: ["B-074 (R)", "C-046 (C)", "E-081 (P)"] },
    { name: "Stereo Chorus (D)", type: 0.80000, gain: 0.89412, params: [0.11765, 0.55686, 0.03922, 0.58039, 0.00000, 0.54510, 0.53333, 0.13725, 0.65490, 0.03137, 0.00784, 0.00000], patches: ["A-087 (D)", "C-070 (E)", "D-008 (D)"] },
    { name: "Edison (S)", type: 0.54286, gain: 0.00000, params: [0.01961, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000], patches: ["B-037 (S)", "B-039 (M)", "B-068 (B)"] },
    { name: "NoiseGate (S)", type: 0.60000, gain: 0.00000, params: [0.69804, 0.01569, 0.69804, 0.50196, 0.16863, 0.06667, 0.61569, 0.17255, 0.19608, 0.03922, 0.50196, 0.09804], patches: ["A-110 (S)", "H-062 (S)"] },
    { name: "tcDeepVerb (D)", type: 0.05714, gain: 0.50196, params: [0.00000, 0.19608, 0.50196, 0.04706, 0.54902, 0.11765, 0.10980, 0.26667, 0.61961, 0.50196, 0.58039, 0.58039], patches: ["A-063 (D)", "A-075 (G)", "C-128 (D)"] },
    { name: "Stereo Phaser (L)", type: 0.88571, gain: 0.89412, params: [0.02353, 0.57647, 0.00392, 0.00000, 0.00000, 0.19608, 0.04314, 0.09804, 0.11765, 0.09412, 0.09804, 0.00000], patches: ["A-072 (L)", "H-063 (L)"] },
    { name: "ChorusRev (A)", type: 0.31429, gain: 0.03922, params: [0.68627, 0.03529, 0.67451, 0.50196, 0.59216, 0.01961, 0.02353, 0.70980, 0.01961, 0.07843, 0.00000, 0.03922], patches: ["A-042 (A)", "E-060 (A)"] },
    { name: "Reverse Reverb (B)", type: 0.28571, gain: 0.89412, params: [0.59608, 0.50196, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000], patches: ["A-036 (B)", "B-022 (B)"] },
    { name: "3Tap Delay (M)", type: 0.65714, gain: 0.00000, params: [0.39216, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000], patches: ["A-043 (M)", "E-024 (M)"] },
    { name: "DecimatorDelay (M)", type: 0.74286, gain: 0.03922, params: [0.19608, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000, 0.00000], patches: ["A-061 (M)", "B-097 (M)"] },
    { name: "RackAmp (S)", type: 0.51429, gain: 0.00000, params: [0.07843, 0.03922, 0.02745, 0.00000, 0.52549, 0.11765, 0.61176, 0.11765, 0.56078, 0.07843, 0.50196, 0.58039], patches: ["A-095 (S)", "B-095 (S)"] },
    { name: "MBDistortion (S)", type: 0.48571, gain: 0.00000, params: [0.54510, 0.06667, 0.50588, 0.00000, 0.16078, 0.00392, 0.00392, 0.00000, 0.00392, 0.03137, 0.00000, 0.09804], patches: ["E-054 (S)", "H-128 (T)"] },
];

// =============================================================================
// Tests
// =============================================================================

// ---- fxType mapping ----

describe('fxTypeIndexFromNormalized — type index calculation', function() {
    it('0.02857 → index 1 (Ambience)', function() {
        expect(fxTypeIndexFromNormalized(0.02857)).toBe(1);
    });

    it('0.0 → index 0 (Bypass)', function() {
        expect(fxTypeIndexFromNormalized(0.0)).toBe(0);
    });

    it('1.0 → index 35 (Rotary Speaker)', function() {
        expect(fxTypeIndexFromNormalized(1.0)).toBe(35);
    });

    it('0.14286 → index 5 (HallReverb)', function() {
        expect(fxTypeIndexFromNormalized(0.14286)).toBe(5);
    });

    it('0.42857 → index 15 (Enhancer)', function() {
        expect(fxTypeIndexFromNormalized(0.42857)).toBe(15);
    });

    it('0.71429 → index 25 (T-RayDelay)', function() {
        expect(fxTypeIndexFromNormalized(0.71429)).toBe(25);
    });

    it('0.85714 → index 30 (Stereo Flanger)', function() {
        expect(fxTypeIndexFromNormalized(0.85714)).toBe(30);
    });

    it('0.57143 → index 20 (AutoPan/Trem)', function() {
        expect(fxTypeIndexFromNormalized(0.57143)).toBe(20);
    });

    it('0.20000 → index 7 (Plate Reverb)', function() {
        expect(fxTypeIndexFromNormalized(0.20000)).toBe(7);
    });

    it('0.05714 → index 2 (tcDeepVerb)', function() {
        expect(fxTypeIndexFromNormalized(0.05714)).toBe(2);
    });
});

describe('fxTypeNameFromNormalized — type name resolution', function() {
    it('returns "Ambience" for type 0.02857', function() {
        expect(fxTypeNameFromNormalized(0.02857)).toBe('Ambience');
    });

    it('returns "HallReverb" for type 0.14286', function() {
        expect(fxTypeNameFromNormalized(0.14286)).toBe('HallReverb');
    });

    it('returns "Enhancer" for type 0.42857', function() {
        expect(fxTypeNameFromNormalized(0.42857)).toBe('Enhancer');
    });

    it('returns "T-RayDelay" for type 0.71429', function() {
        expect(fxTypeNameFromNormalized(0.71429)).toBe('T-RayDelay');
    });

    it('returns "Stereo Flanger" for type 0.85714', function() {
        expect(fxTypeNameFromNormalized(0.85714)).toBe('Stereo Flanger');
    });

    it('returns "AutoPan/Trem" for type 0.57143', function() {
        expect(fxTypeNameFromNormalized(0.57143)).toBe('AutoPan/Trem');
    });

    it('returns "Plate Reverb" for type 0.20000', function() {
        expect(fxTypeNameFromNormalized(0.20000)).toBe('Plate Reverb');
    });

    it('returns "FlangerRev" for type 0.37143', function() {
        expect(fxTypeNameFromNormalized(0.37143)).toBe('FlangerRev');
    });

    it('returns "Stereo Chorus" for type 0.80000', function() {
        expect(fxTypeNameFromNormalized(0.80000)).toBe('Stereo Chorus');
    });

    it('returns "Bypass" for type outside known range (fallback)', function() {
        // FX_TYPE_NAMES has 36 entries (0-35). round(2.0 * 35) = 70, which is out of range.
        // The function has fallback: FX_TYPE_NAMES[idx] || "Bypass"
        expect(fxTypeNameFromNormalized(2.0)).toBe("Bypass");
    });
});

// ---- validatePresetEntry ----

describe('validatePresetEntry — structural validation', function() {
    it('validates a correct preset entry', function() {
        var preset = {
            name: "Test Preset",
            type: 0.5,
            gain: 0.5,
            params: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.0, 0.0, 0.0],
            patches: ["A-001 (T)"]
        };
        var result = validatePresetEntry(preset);
        expect(result.valid).toBe(true);
        expect(result.errors.length).toBe(0);
    });

    it('rejects null preset', function() {
        expect(validatePresetEntry(null).valid).toBe(false);
    });

    it('rejects missing name', function() {
        var result = validatePresetEntry({ type: 0.5, gain: 0.5, params: new Array(12).fill(0), patches: ["A-001"] });
        expect(result.valid).toBe(false);
        expect(result.errors.some(function(e) { return e.indexOf('name') !== -1; })).toBe(true);
    });

    it('rejects empty name', function() {
        var result = validatePresetEntry({ name: "", type: 0.5, gain: 0.5, params: new Array(12).fill(0), patches: ["A-001"] });
        expect(result.valid).toBe(false);
    });

    it('rejects type out of [0,1]', function() {
        var result = validatePresetEntry({ name: "T", type: 1.5, gain: 0.5, params: new Array(12).fill(0.5), patches: ["A-001"] });
        expect(result.valid).toBe(false);
    });

    it('rejects gain out of [0,1]', function() {
        var result = validatePresetEntry({ name: "T", type: 0.5, gain: -0.1, params: new Array(12).fill(0.5), patches: ["A-001"] });
        expect(result.valid).toBe(false);
    });

    it('rejects NaN type', function() {
        var result = validatePresetEntry({ name: "T", type: NaN, gain: 0.5, params: new Array(12).fill(0.5), patches: ["A-001"] });
        expect(result.valid).toBe(false);
    });

    it('rejects params that are not an array', function() {
        var result = validatePresetEntry({ name: "T", type: 0.5, gain: 0.5, params: "not array", patches: ["A-001"] });
        expect(result.valid).toBe(false);
    });

    it('rejects params with wrong length', function() {
        var result = validatePresetEntry({ name: "T", type: 0.5, gain: 0.5, params: [0.1], patches: ["A-001"] });
        expect(result.valid).toBe(false);
    });

    it('rejects params with out-of-range value', function() {
        var params = new Array(12).fill(0.5);
        params[5] = 1.5;
        var result = validatePresetEntry({ name: "T", type: 0.5, gain: 0.5, params: params, patches: ["A-001"] });
        expect(result.valid).toBe(false);
    });

    it('rejects empty patches', function() {
        var result = validatePresetEntry({ name: "T", type: 0.5, gain: 0.5, params: new Array(12).fill(0.5), patches: [] });
        expect(result.valid).toBe(false);
    });

    it('rejects patches with non-string entries', function() {
        var result = validatePresetEntry({ name: "T", type: 0.5, gain: 0.5, params: new Array(12).fill(0.5), patches: [42] });
        expect(result.valid).toBe(false);
    });
});

// ---- SAMPLE_PRESETS structural integrity ----

describe('SAMPLE_PRESETS — each entry is valid', function() {
    for (var i = 0; i < SAMPLE_PRESETS.length; i++) {
        (function(idx, preset) {
            it('preset #' + idx + ' "' + preset.name + '" is structurally valid', function() {
                var result = validatePresetEntry(preset);
                if (!result.valid) {
                    // Fail with specific errors
                    expect(result.errors).toEqual([]);
                }
                expect(result.valid).toBe(true);
            });
        })(i, SAMPLE_PRESETS[i]);
    }
});

describe('SAMPLE_PRESETS — value ranges', function() {
    it('all type values are in [0, 1]', function() {
        for (var i = 0; i < SAMPLE_PRESETS.length; i++) {
            var t = SAMPLE_PRESETS[i].type;
            expect(t).toBeGreaterThanOrEqual(0);
            expect(t).toBeLessThanOrEqual(1);
        }
    });

    it('all gain values are in [0, 1]', function() {
        for (var i = 0; i < SAMPLE_PRESETS.length; i++) {
            var g = SAMPLE_PRESETS[i].gain;
            expect(g).toBeGreaterThanOrEqual(0);
            expect(g).toBeLessThanOrEqual(1);
        }
    });

    it('all param values are in [0, 1]', function() {
        for (var i = 0; i < SAMPLE_PRESETS.length; i++) {
            for (var j = 0; j < SAMPLE_PRESETS[i].params.length; j++) {
                var p = SAMPLE_PRESETS[i].params[j];
                expect(p).toBeGreaterThanOrEqual(0);
                expect(p).toBeLessThanOrEqual(1);
            }
        }
    });

    it('all params arrays have length 12', function() {
        for (var i = 0; i < SAMPLE_PRESETS.length; i++) {
            expect(SAMPLE_PRESETS[i].params.length).toBe(12);
        }
    });

    it('all patches arrays are non-empty', function() {
        for (var i = 0; i < SAMPLE_PRESETS.length; i++) {
            expect(SAMPLE_PRESETS[i].patches.length).toBeGreaterThan(0);
        }
    });

    it('all patches entries are strings', function() {
        for (var i = 0; i < SAMPLE_PRESETS.length; i++) {
            for (var j = 0; j < SAMPLE_PRESETS[i].patches.length; j++) {
                expect(typeof SAMPLE_PRESETS[i].patches[j]).toBe('string');
            }
        }
    });
});

// ---- Type resolution ----

describe('SAMPLE_PRESETS — type mapping resolves correctly', function() {
    // Check that each preset's type maps to the expected FX type based on its name prefix
    var TYPE_PREFIX_MAP = {
        'Ambience': 'Ambience',
        'HallReverb': 'HallReverb',
        'Enhancer': 'Enhancer',
        'T-RayDelay': 'T-RayDelay',
        'Stereo Flanger': 'Stereo Flanger',
        'AutoPan/Trem': 'AutoPan/Trem',
        'Plate Reverb': 'Plate Reverb',
        'FlangerRev': 'FlangerRev',
        'Stereo Chorus': 'Stereo Chorus',
        'Edison': 'Edison',
        'NoiseGate': 'NoiseGate',
        'tcDeepVerb': 'tcDeepVerb',
        'Stereo Phaser': 'Stereo Phaser',
        'ChorusRev': 'ChorusRev',
        'Reverse Reverb': 'Reverse Reverb',
        '3Tap Delay': '3Tap Delay',
        'DecimatorDelay': 'DecimatorDelay',
        'RackAmp': 'RackAmp',
        'MBDistortion': 'MBDistortion',
    };

    it('each preset maps to correct type name', function() {
        for (var i = 0; i < SAMPLE_PRESETS.length; i++) {
            var preset = SAMPLE_PRESETS[i];
            var expectedType = null;
            for (var prefix in TYPE_PREFIX_MAP) {
                if (preset.name.indexOf(prefix) === 0) {
                    expectedType = TYPE_PREFIX_MAP[prefix];
                    break;
                }
            }
            if (expectedType) {
                var actualType = fxTypeNameFromNormalized(preset.type);
                expect(actualType).toBe(expectedType, 
                    preset.name + ': type ' + preset.type + ' should map to ' + expectedType + ' but got ' + actualType);
            }
        }
    });

    it('no two presets share the exact same name', function() {
        var dupResult = findDuplicateNames(SAMPLE_PRESETS);
        expect(dupResult.hasDuplicates).toBe(false);
        if (dupResult.hasDuplicates) {
            expect(dupResult.duplicates).toEqual([]);
        }
    });
});

// ---- Type resolution quantization accuracy ----

describe('SAMPLE_PRESETS — type quantization', function() {
    it('all type values round to known indices (0-35)', function() {
        for (var i = 0; i < SAMPLE_PRESETS.length; i++) {
            var idx = fxTypeIndexFromNormalized(SAMPLE_PRESETS[i].type);
            expect(idx).toBeGreaterThanOrEqual(0);
            expect(idx).toBeLessThanOrEqual(35);
            expect(FX_TYPE_NAMES[idx]).toBeDefined();
        }
    });

    it('no preset maps to type 0 (Bypass) — factory presets always have an active FX type', function() {
        for (var i = 0; i < SAMPLE_PRESETS.length; i++) {
            expect(fxTypeIndexFromNormalized(SAMPLE_PRESETS[i].type)).not.toBe(0);
        }
    });

    it('type values are exact multiples of 1/35 (within 5 decimal precision)', function() {
        for (var i = 0; i < SAMPLE_PRESETS.length; i++) {
            var t = SAMPLE_PRESETS[i].type;
            var idx = fxTypeIndexFromNormalized(t);
            var expectedPrecise = idx / 35.0;
            // Allow small tolerance for floating-point representation
            expect(Math.abs(t - expectedPrecise)).toBeLessThan(0.00002);
        }
    });
});

// ---- groupPresetsByType ----

describe('groupPresetsByType — grouping', function() {
    var groups = groupPresetsByType(SAMPLE_PRESETS);

    it('groups presets by FX type name', function() {
        // Ambience should have at least 1 entry
        expect(groups['Ambience'].length).toBeGreaterThanOrEqual(1);
        expect(groups['Enhancer'].length).toBeGreaterThanOrEqual(1);
        expect(groups['T-RayDelay'].length).toBeGreaterThanOrEqual(1);
    });

    it('sum of all groups equals total presets', function() {
        var total = 0;
        for (var typeName in groups) {
            if (groups.hasOwnProperty(typeName)) {
                total += groups[typeName].length;
            }
        }
        expect(total).toBe(SAMPLE_PRESETS.length);
    });

    it('each type name corresponds to a valid FX_TYPE_NAME', function() {
        for (var typeName in groups) {
            if (groups.hasOwnProperty(typeName)) {
                expect(FX_TYPE_NAMES.indexOf(typeName)).toBeGreaterThanOrEqual(0);
            }
        }
    });
});

// ---- FX_TYPE_NAMES integrity ----

describe('FX_TYPE_NAMES — static array integrity', function() {
    it('has 36 entries (indices 0-35)', function() {
        expect(FX_TYPE_NAMES.length).toBe(36);
    });

    it('first entry is "Bypass"', function() {
        expect(FX_TYPE_NAMES[0]).toBe('Bypass');
    });

    it('last entry is "Rotary Speaker"', function() {
        expect(FX_TYPE_NAMES[35]).toBe('Rotary Speaker');
    });

    it('all entries are non-empty strings', function() {
        for (var i = 0; i < FX_TYPE_NAMES.length; i++) {
            expect(typeof FX_TYPE_NAMES[i]).toBe('string');
            expect(FX_TYPE_NAMES[i].length).toBeGreaterThan(0);
        }
    });

    it('no duplicate entries', function() {
        var seen = {};
        for (var i = 0; i < FX_TYPE_NAMES.length; i++) {
            expect(seen[FX_TYPE_NAMES[i]]).toBeUndefined('Duplicate: ' + FX_TYPE_NAMES[i]);
            seen[FX_TYPE_NAMES[i]] = true;
        }
    });
});
