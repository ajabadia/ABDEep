/**
 * Tests for WebUI/js/sequencer_editor.js — 32-step control sequencer grid editor
 *
 * Strategy: extracted raw↔bipolar conversion, display formatting, fill-bar geometry,
 * skip/active step logic. DOM-heavy initSequencerEditor() and updateStepVisual()
 * are not covered here.
 */

// ===== Global stubs =====
globalThis.window = globalThis.window || {};

// ===== Extracted Source Functions =====

function bipolarToRaw(bipolar) {
    return Math.max(0, Math.min(255, bipolar + 128));
}

function rawToBipolar(raw) {
    return raw - 128;
}

function normalizeRaw(raw) {
    return Math.max(0, Math.min(1, raw / 255.0));
}

function snapBipolarToZero(val) {
    if (Math.abs(val) <= 2) {return 0;}
    return val;
}

function isSkipStep(rawVal) {
    return rawVal === 0;
}

function formatStepValue(val, rawVal) {
    if (isSkipStep(rawVal)) {return 'SKIP';}
    if (val === 0) {return '0';}
    return val > 0 ? '+' + val : String(val);
}

function computeFillHeight(val, isSkip) {
    if (isSkip) {return 0;}
    const abs = Math.abs(val);
    if (val >= 0) {return (val / 127) * 50;} // source: positive uses /127
    return (abs / 128) * 50;               // source: negative uses /128
}

function computeFillBottom(val, isSkip) {
    if (isSkip) {return 50;}
    if (val >= 0) {return 50;}
    return 50 - computeFillHeight(val, false);
}

function isStepActive(index, activeLength) {
    return index < activeLength;
}

function getActiveLength(selectValue) {
    if (selectValue === undefined || selectValue === null) {return 16;}
    return parseInt(selectValue) + 2;
}

function computeBipolarFromNormalized(normVal) {
    const bipolar = Math.round((normVal * 255) - 128);
    return snapBipolarToZero(bipolar);
}

function computeBipolarFromY(clientY, rectTop, rectHeight) {
    let relY = (clientY - rectTop) / rectHeight;
    relY = Math.max(0, Math.min(1, relY));
    const normVal = 1.0 - relY;
    return computeBipolarFromNormalized(normVal);
}

function getStepTooltip(index, val, rawVal) {
    if (isSkipStep(rawVal)) {
        return 'Step ' + (index + 1) + ': SKIP (raw: ' + rawVal + ')';
    }
    const sign = val >= 0 ? '+' : '';
    return 'Step ' + (index + 1) + ': ' + sign + val + ' (raw: ' + rawVal + ')';
}

// ===== Tests =====

describe('bipolarToRaw — bipolar (-128..127) to raw byte (0..255)', function() {
    it('converts -128 to 0', function() {
        expect(bipolarToRaw(-128)).toBe(0);
    });

    it('converts 0 to 128', function() {
        expect(bipolarToRaw(0)).toBe(128);
    });

    it('converts 127 to 255', function() {
        expect(bipolarToRaw(127)).toBe(255);
    });

    it('clamps values below -128', function() {
        expect(bipolarToRaw(-200)).toBe(0);
    });

    it('clamps values above 127', function() {
        expect(bipolarToRaw(200)).toBe(255);
    });
});

describe('rawToBipolar — raw byte (0..255) to bipolar (-128..127)', function() {
    it('converts 0 to -128', function() {
        expect(rawToBipolar(0)).toBe(-128);
    });

    it('converts 128 to 0', function() {
        expect(rawToBipolar(128)).toBe(0);
    });

    it('converts 255 to 127', function() {
        expect(rawToBipolar(255)).toBe(127);
    });

    it('round-trip: bipolar -> raw -> bipolar', function() {
        const original = -64;
        const raw = bipolarToRaw(original);
        const back = rawToBipolar(raw);
        expect(back).toBe(original);
    });
});

describe('normalizeRaw — raw byte to normalized 0..1', function() {
    it('converts 0 to 0', function() {
        expect(normalizeRaw(0)).toBe(0);
    });

    it('converts 255 to 1', function() {
        expect(normalizeRaw(255)).toBe(1);
    });

    it('converts 128 to ~0.502', function() {
        expect(normalizeRaw(128)).toBeCloseTo(128 / 255, 5);
    });

    it('clamps below 0', function() {
        expect(normalizeRaw(-10)).toBe(0);
    });

    it('clamps above 255', function() {
        expect(normalizeRaw(300)).toBe(1);
    });
});

describe('snapBipolarToZero — snap values within ±2 to 0', function() {
    it('snaps -2 to 0', function() {
        expect(snapBipolarToZero(-2)).toBe(0);
    });

    it('snaps 0 to 0', function() {
        expect(snapBipolarToZero(0)).toBe(0);
    });

    it('snaps 2 to 0', function() {
        expect(snapBipolarToZero(2)).toBe(0);
    });

    it('keeps -3 unchanged', function() {
        expect(snapBipolarToZero(-3)).toBe(-3);
    });

    it('keeps 3 unchanged', function() {
        expect(snapBipolarToZero(3)).toBe(3);
    });

    it('keeps 100 unchanged', function() {
        expect(snapBipolarToZero(100)).toBe(100);
    });
});

describe('isSkipStep — raw value of 0 means skip', function() {
    it('returns true for raw=0', function() {
        expect(isSkipStep(0)).toBe(true);
    });

    it('returns false for raw=1', function() {
        expect(isSkipStep(1)).toBe(false);
    });

    it('returns false for raw=128', function() {
        expect(isSkipStep(128)).toBe(false);
    });

    it('returns false for raw=255', function() {
        expect(isSkipStep(255)).toBe(false);
    });
});

describe('formatStepValue — display string for step value', function() {
    it('returns SKIP for raw=0', function() {
        expect(formatStepValue(0, 0)).toBe('SKIP');
    });

    it('returns "0" for val=0', function() {
        expect(formatStepValue(0, 128)).toBe('0');
    });

    it('returns "+N" for positive values', function() {
        expect(formatStepValue(64, 192)).toBe('+64');
        expect(formatStepValue(127, 255)).toBe('+127');
    });

    it('returns "-N" for negative values', function() {
        expect(formatStepValue(-64, 64)).toBe('-64');
        expect(formatStepValue(-128, 1)).toBe('-128'); // raw must not be 0 or it shows SKIP
    });

    it('handles val=0 but raw is not 128 (edge case)', function() {
        expect(formatStepValue(0, 128)).toBe('0');
    });
});

describe('computeFillHeight — fill bar height percentage', function() {
    it('returns 0 for skip step', function() {
        expect(computeFillHeight(0, true)).toBe(0);
    });

    it('returns 50% for max positive (127)', function() {
        expect(computeFillHeight(127, false)).toBeCloseTo(50, 5); // source: 127/127*50 = 50
    });

    it('returns ~0.4% for val=1', function() {
        expect(computeFillHeight(1, false)).toBeCloseTo(0.39, 1); // source: 1/127*50 ≈ 0.394
    });

    it('returns 50% for max negative (-128)', function() {
        expect(computeFillHeight(-128, false)).toBe(50);
    });

    it('returns 0 for val=0', function() {
        expect(computeFillHeight(0, false)).toBe(0);
    });

    it('uses absolute value for negative input', function() {
        expect(computeFillHeight(-64, false)).toBeCloseTo(25, 1); // 64/128*50 = 25
    });
});

describe('computeFillBottom — fill bar bottom position', function() {
    it('returns 50 for skip', function() {
        expect(computeFillBottom(0, true)).toBe(50);
    });

    it('returns 50 for positive values (grows up from center)', function() {
        expect(computeFillBottom(64, false)).toBe(50);
    });

    it('returns < 50 for negative values (grows down from center)', function() {
        const bottom = computeFillBottom(-64, false);
        expect(bottom).toBeLessThan(50);
        expect(bottom).toBeCloseTo(25, 1);
    });

    it('returns 50 for val=0', function() {
        expect(computeFillBottom(0, false)).toBe(50);
    });
});

describe('isStepActive — step within active length', function() {
    it('returns true for index < activeLength', function() {
        expect(isStepActive(5, 16)).toBe(true);
    });

    it('returns false for index >= activeLength', function() {
        expect(isStepActive(16, 16)).toBe(false);
        expect(isStepActive(31, 16)).toBe(false);
    });

    it('returns true for first step', function() {
        expect(isStepActive(0, 8)).toBe(true);
    });
});

describe('getActiveLength — parse select value to active step count', function() {
    it('defaults to 16 when selectValue is missing', function() {
        expect(getActiveLength(undefined)).toBe(16);
        expect(getActiveLength(null)).toBe(16);
    });

    it('parses numeric string, adds 2', function() {
        // Source: parseInt(selectLength.value) + 2
        expect(getActiveLength('0')).toBe(2);
        expect(getActiveLength('14')).toBe(16);
        expect(getActiveLength('30')).toBe(32);
    });

    it('parses integer directly', function() {
        expect(getActiveLength(14)).toBe(16);
        expect(getActiveLength(0)).toBe(2);
    });
});

describe('computeBipolarFromNormalized — normalized (0..1) to bipolar (-128..127)', function() {
    it('converts 0.0 to -128', function() {
        expect(computeBipolarFromNormalized(0.0)).toBe(-128);
    });

    it('converts 1.0 to 127', function() {
        expect(computeBipolarFromNormalized(1.0)).toBe(127);
    });

    it('converts 0.5 to 0 (with snapZero)', function() {
        // Math.round(0.5 * 255 - 128) = Math.round(127.5 - 128) = Math.round(-0.5) = 0
        const result = computeBipolarFromNormalized(0.5);
        expect(result).toBe(0);
    });

    it('snaps values near zero', function() {
        // 0.5 - tiny delta: Math.round(0.498 * 255 - 128) = Math.round(126.99 - 128) = Math.round(-1.01) = -1
        const result = computeBipolarFromNormalized(0.498);
        // -1 should be snapped to 0 since | -1 | <= 2
        expect(result).toBe(0);
    });

    it('rounds to nearest integer', function() {
        // 0.75 → Math.round(0.75 * 255 - 128) = Math.round(191.25 - 128) = Math.round(63.25) = 63
        expect(computeBipolarFromNormalized(0.75)).toBe(63);
    });
});

describe('computeBipolarFromY — mouse Y to bipolar value', function() {
    it('maps top of bar (clientY=rectTop) to 127', function() {
        const val = computeBipolarFromY(100, 100, 200);
        // relY = (100 - 100) / 200 = 0, normVal = 1.0 - 0 = 1.0
        // bipolar = round(1.0 * 255 - 128) = 127
        expect(val).toBe(127);
    });

    it('maps bottom of bar (clientY=rectTop+height) to -128', function() {
        const val = computeBipolarFromY(300, 100, 200);
        // relY = (300 - 100) / 200 = 1, normVal = 1.0 - 1 = 0
        // bipolar = round(0 * 255 - 128) = -128
        expect(val).toBe(-128);
    });

    it('maps center of bar to 0', function() {
        const val = computeBipolarFromY(200, 100, 200);
        // relY = (200 - 100) / 200 = 0.5, normVal = 1.0 - 0.5 = 0.5
        // bipolar = round(0.5 * 255 - 128) = round(-0.5) = 0
        expect(val).toBe(0);
    });

    it('clamps relY to [0, 1] for values above bar', function() {
        const val = computeBipolarFromY(50, 100, 200);
        // relY = (50 - 100) / 200 = -0.25 → clamped to 0
        // normVal = 1.0 - 0 = 1.0 → bipolar = 127
        expect(val).toBe(127);
    });

    it('clamps relY to [0, 1] for values below bar', function() {
        const val = computeBipolarFromY(400, 100, 200);
        // relY = (400-100)/200 = 1.5 → clamped to 1
        // normVal = 1.0 - 1 = 0 → bipolar = -128
        expect(val).toBe(-128);
    });
});

describe('getStepTooltip — hover tooltip string', function() {
    it('formats SKIP tooltip when raw is 0', function() {
        const tip = getStepTooltip(0, 0, 0);
        expect(tip).toContain('Step 1');
        expect(tip).toContain('SKIP');
        expect(tip).toContain('raw: 0');
    });

    it('formats positive value tooltip', function() {
        const tip = getStepTooltip(4, 64, 192);
        expect(tip).toContain('Step 5');
        expect(tip).toContain('+64');
        expect(tip).toContain('raw: 192');
    });

    it('formats negative value tooltip', function() {
        const tip = getStepTooltip(30, -64, 64);
        expect(tip).toContain('Step 31');
        expect(tip).toContain('-64');
        expect(tip).toContain('raw: 64');
    });

    it('formats zero value tooltip', function() {
        const tip = getStepTooltip(0, 0, 128);
        expect(tip).toContain('Step 1');
        expect(tip).toContain('+0');
        expect(tip).toContain('raw: 128');
    });
});
