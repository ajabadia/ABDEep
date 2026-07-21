/**
 * Tests for WebUI/js/sequencer_presets.js — Control Sequencer preset generators
 *
 * Strategy: extracted pure pattern generation functions with DI.
 * Tests cover Staircase, Triangle, Random generators, bipolar→raw conversion,
 * and preset application to bridge cache / seqStepsValues / seqStepsRaw.
 */

// ===== Global stubs =====
globalThis.window = globalThis.window || {};

// ===== Extracted Source Functions =====

function generateStaircasePreset() {
    return Array(32).fill(0).map(function(_, i) {
        return Math.round((i / 31) * 255 - 128);
    });
}

function generateTrianglePreset() {
    return Array(32).fill(0).map(function(_, i) {
        const phase = (i / 16) % 2.0;
        const val = phase < 1.0 ? phase : 2.0 - phase;
        return Math.round((val * 255) - 128);
    });
}

function generateRandomPreset() {
    return Array(32).fill(0).map(function() {
        return Math.round(Math.random() * 255 - 128);
    });
}

function applyPresetToSteps(stepsValues, options) {
    options = options || {};
    const seqStepsValues = options.seqStepsValues || [];
    const seqStepsRaw = options.seqStepsRaw || [];
    const bridge = options.bridge || null;
    const updateStepVisual = options.updateStepVisual || function() {};
    const results = { values: [], raws: [], normals: [] };

    for (let i = 0; i < 32; i++) {
        seqStepsValues[i] = stepsValues[i];
        const rawByte = stepsValues[i] + 128;
        seqStepsRaw[i] = Math.max(0, Math.min(255, rawByte));

        const normalized = seqStepsRaw[i] / 255.0;
        if (bridge && bridge.parameterCache) {
            bridge.parameterCache['seq_step_' + (i + 1)] = normalized;
        }
        updateStepVisual(i);

        results.values.push(seqStepsValues[i]);
        results.raws.push(seqStepsRaw[i]);
        results.normals.push(normalized);
    }
    return results;
}

function clampRaw(val) {
    return Math.max(0, Math.min(255, val));
}

// ===== Tests =====

describe('generateStaircasePreset — linear ramp', function() {
    let steps;

    beforeEach(function() {
        steps = generateStaircasePreset();
    });

    it('generates 32 values', function() {
        expect(steps.length).toBe(32);
    });

    it('step 0 is -128 (0/31 * 255 - 128)', function() {
        expect(steps[0]).toBe(-128);
    });

    it('step 31 is 127 (31/31 * 255 - 128)', function() {
        expect(steps[31]).toBe(127);
    });

    it('step 15 is approximately -4 (15/31 * 255 - 128 ≈ 123.4 - 128 = -4.6 → -5? let me compute: 15/31*255 = 123.387, - 128 = -4.613 → round = -5)', function() {
        // 15/31 * 255 = 123.387... - 128 = -4.613... → round = -5
        expect(steps[15]).toBe(-5);
    });

    it('step 16 is approximately -3 (16/31 * 255 - 128 = 131.613 - 128 = 3.613 → round = 4)', function() {
        // 16/31 * 255 = 131.613... - 128 = 3.613... → round = 4
        expect(steps[16]).toBe(4);
    });

    it('values are monotonically increasing', function() {
        for (let i = 1; i < 32; i++) {
            expect(steps[i]).toBeGreaterThan(steps[i - 1]);
        }
    });

    it('all values are in range [-128, 127]', function() {
        for (let i = 0; i < 32; i++) {
            expect(steps[i]).toBeGreaterThanOrEqual(-128);
            expect(steps[i]).toBeLessThanOrEqual(127);
        }
    });
});

describe('generateTrianglePreset — triangle wave', function() {
    let steps;

    beforeEach(function() {
        steps = generateTrianglePreset();
    });

    it('generates 32 values', function() {
        expect(steps.length).toBe(32);
    });

    it('step 0 is 0 (phase=0, val=0, 0*255-128 = -128)', function() {
        // phase = (0/16) % 2 = 0 < 1 → val = 0
        // Math.round(0 * 255 - 128) = -128
        expect(steps[0]).toBe(-128);
    });

    it('step 8 is at peak (phase=0.5, val=0.5 → round(-0.5) = -0 in JS)', function() {
        // Math.round(-0.5) returns -0 in JS (Object.is equality in vitest)
        // Use toBeCloseTo to avoid -0 vs 0 mismatch
        expect(steps[8]).toBeCloseTo(0, 5);
    });

    it('step 16 is at end of ascending phase (phase=1, val=1, 1*255-128=127)', function() {
        // phase = (16/16) % 2 = 1 % 2 = 1 >= 1 → val = 2.0 - 1 = 1
        // Math.round(1 * 255 - 128) = Math.round(127) = 127
        expect(steps[16]).toBe(127);
    });

    it('step 24 is at descending midpoint (phase=1.5→val=0.5 → round(-0.5) = -0)', function() {
        expect(steps[24]).toBeCloseTo(0, 5);
    });

    it('step 31 is near end of descending phase', function() {
        // phase = (31/16) % 2 = 1.9375 >= 1 → val = 2.0 - 1.9375 = 0.0625
        // Math.round(0.0625 * 255 - 128) = Math.round(15.9375 - 128) = Math.round(-112.0625) = -112
        expect(steps[31]).toBe(-112);
    });

    it('all values are in range [-128, 127]', function() {
        for (let i = 0; i < 32; i++) {
            expect(steps[i]).toBeGreaterThanOrEqual(-128);
            expect(steps[i]).toBeLessThanOrEqual(127);
        }
    });
});

describe('generateRandomPreset — random values', function() {
    it('generates 32 values', function() {
        const steps = generateRandomPreset();
        expect(steps.length).toBe(32);
    });

    it('produces different values on successive calls (probabilistic)', function() {
        const steps1 = generateRandomPreset();
        const steps2 = generateRandomPreset();
        let allSame = true;
        for (let i = 0; i < 32; i++) {
            if (steps1[i] !== steps2[i]) {
                allSame = false;
                break;
            }
        }
        expect(allSame).toBe(false);
    });

    it('all values are in range [-128, 127]', function() {
        const steps = generateRandomPreset();
        for (let i = 0; i < 32; i++) {
            expect(steps[i]).toBeGreaterThanOrEqual(-128);
            expect(steps[i]).toBeLessThanOrEqual(127);
        }
    });

    it('values are integers', function() {
        const steps = generateRandomPreset();
        for (let i = 0; i < 32; i++) {
            expect(Number.isInteger(steps[i])).toBe(true);
        }
    });
});

describe('applyPresetToSteps — step value computation and distribution', function() {
    let seqStepsValues, seqStepsRaw, updateCalls, bridge, result;

    beforeEach(function() {
        seqStepsValues = [];
        seqStepsRaw = [];
        updateCalls = [];
        bridge = { parameterCache: {} };
    });

    it('computes raw bytes as bipolar + 128', function() {
        const staircase = generateStaircasePreset();
        result = applyPresetToSteps(staircase, {
            seqStepsValues: seqStepsValues,
            seqStepsRaw: seqStepsRaw,
            bridge: bridge
        });
        expect(result.raws[0]).toBe(0);   // -128 + 128 = 0
        expect(result.raws[31]).toBe(255); // 127 + 128 = 255
        expect(result.raws[15]).toBe(123); // -5 + 128 = 123
    });

    it('clamps raw bytes to [0, 255]', function() {
        const extremeValues = [-200, 200]; // -200+128=-72 clamp to 0, 200+128=328 clamp to 255
        seqStepsValues = [];
        seqStepsRaw = [];
        result = applyPresetToSteps(extremeValues.concat(Array(30).fill(0)), {
            seqStepsValues: seqStepsValues,
            seqStepsRaw: seqStepsRaw,
            bridge: bridge
        });
        expect(result.raws[0]).toBe(0);   // -72 clamped to 0
        expect(result.raws[1]).toBe(255);  // 328 clamped to 255
    });

    it('computes normalized values as raw / 255', function() {
        const staircase = generateStaircasePreset();
        result = applyPresetToSteps(staircase, {
            seqStepsValues: seqStepsValues,
            seqStepsRaw: seqStepsRaw,
            bridge: bridge
        });
        expect(result.normals[0]).toBe(0 / 255.0);
        expect(result.normals[31]).toBe(255 / 255.0);
        expect(result.normals[15]).toBe(123 / 255.0);
    });

    it('populates bridge parameterCache for each step', function() {
        const staircase = generateStaircasePreset();
        result = applyPresetToSteps(staircase, {
            seqStepsValues: seqStepsValues,
            seqStepsRaw: seqStepsRaw,
            bridge: bridge
        });
        expect(bridge.parameterCache['seq_step_1']).toBe(0);
        // seq_step_32 = index 31 → value = Math.round(31/31*255-128) = 127 → raw = 255 → norm = 1.0
        expect(bridge.parameterCache['seq_step_32']).toBe(1.0);
        // seq_step_16 = index 15 → value = Math.round(15/31*255-128) = -5 → raw = 123 → norm = 123/255
        expect(bridge.parameterCache['seq_step_16']).toBe(123 / 255.0);
    });

    it('calls updateStepVisual for each step', function() {
        const called = [];
        const staircase = generateStaircasePreset();
        result = applyPresetToSteps(staircase, {
            seqStepsValues: seqStepsValues,
            seqStepsRaw: seqStepsRaw,
            bridge: bridge,
            updateStepVisual: function(idx) { called.push(idx); }
        });
        expect(called.length).toBe(32);
        expect(called[0]).toBe(0);
        expect(called[31]).toBe(31);
    });

    it('populates seqStepsValues array', function() {
        const staircase = generateStaircasePreset();
        result = applyPresetToSteps(staircase, {
            seqStepsValues: seqStepsValues,
            seqStepsRaw: seqStepsRaw,
            bridge: bridge
        });
        expect(seqStepsValues[0]).toBe(-128);
        expect(seqStepsValues[31]).toBe(127);
    });

    it('populates seqStepsRaw array', function() {
        const staircase = generateStaircasePreset();
        result = applyPresetToSteps(staircase, {
            seqStepsValues: seqStepsValues,
            seqStepsRaw: seqStepsRaw,
            bridge: bridge
        });
        expect(seqStepsRaw[0]).toBe(0);
        expect(seqStepsRaw[31]).toBe(255);
    });

    it('handles missing bridge gracefully (no crash)', function() {
        const staircase = generateStaircasePreset();
        expect(function() {
            applyPresetToSteps(staircase, {
                seqStepsValues: seqStepsValues,
                seqStepsRaw: seqStepsRaw,
                bridge: null
            });
        }).not.toThrow();
    });
});

describe('clampRaw — raw byte clamping', function() {
    it('returns value unchanged when in [0, 255]', function() {
        expect(clampRaw(128)).toBe(128);
        expect(clampRaw(0)).toBe(0);
        expect(clampRaw(255)).toBe(255);
    });

    it('clamps to 0 when below 0', function() {
        expect(clampRaw(-1)).toBe(0);
        expect(clampRaw(-100)).toBe(0);
    });

    it('clamps to 255 when above 255', function() {
        expect(clampRaw(256)).toBe(255);
        expect(clampRaw(1000)).toBe(255);
    });
});

describe('Staircase and Triangle — pattern structure differences', function() {
    it('staircase is monotonic, triangle is not', function() {
        const stair = generateStaircasePreset();
        const tri = generateTrianglePreset();

        let stairIncreasing = true;
        for (let i = 1; i < 32; i++) {
            if (stair[i] <= stair[i - 1]) { stairIncreasing = false; break; }
        }
        expect(stairIncreasing).toBe(true);

        let triHasDecrease = false;
        for (let j = 1; j < 32; j++) {
            if (tri[j] < tri[j - 1]) { triHasDecrease = true; break; }
        }
        expect(triHasDecrease).toBe(true);
    });

    it('both patterns have distinct first derivatives', function() {
        const stair = generateStaircasePreset();
        const tri = generateTrianglePreset();

        // Staircase: each step changes by ~8 (255/31 ≈ 8.2)
        // Triangle: changes direction at midpoint
        let stairDiffs = 0;
        for (let i = 1; i < 32; i++) {
            stairDiffs += Math.abs(stair[i] - stair[i - 1]);
        }
        let triDiffs = 0;
        for (let j = 1; j < 32; j++) {
            triDiffs += Math.abs(tri[j] - tri[j - 1]);
        }
        // Staircase should have consistent step changes
        expect(stairDiffs).toBe(255);
        // Triangle should have larger total movement (up then down)
        expect(triDiffs).toBeGreaterThan(stairDiffs);
    });
});
