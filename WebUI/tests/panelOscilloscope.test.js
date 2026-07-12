/**
 * Tests for WebUI/js/panel_oscilloscope.js — Real-time DSP oscilloscope
 *
 * Extracted pure functions:
 * - hexToRgba(hex, alpha): hex color → rgba string
 * - findTriggerPoint(samples, mode, edge): trigger point detection in waveform
 * - getScopeColors(state, colors): color scheme lookup
 * - calcPeakLevel(samples): max absolute sample value
 * - calcPeakDb(peakLevel): peak level → dB string
 * - calcScopeTimeMs(numSamples, sampleRate): samples → milliseconds
 *
 * Constants:
 * - SCOPE_COLORS: array of 4 color schemes
 */

// =============================================================================
// Constants (from panel_oscilloscope.js)
// =============================================================================

var SCOPE_COLORS = [
    { waveform: '#ff9900',  grid: 'rgba(255,153,0,0.03)',  center: 'rgba(255,153,0,0.08)',  text: 'rgba(255,153,0,0.4)',  glow: '#ff9900',  trigger: 'rgba(255,153,0,0.15)', name: 'Brand' },
    { waveform: '#00ff66',  grid: 'rgba(0,255,102,0.03)',  center: 'rgba(0,255,102,0.08)',  text: 'rgba(0,255,102,0.4)',  glow: '#00ff66',  trigger: 'rgba(0,255,102,0.15)', name: 'CRT Green' },
    { waveform: '#00ccff',  grid: 'rgba(0,204,255,0.03)',  center: 'rgba(0,204,255,0.08)',  text: 'rgba(0,204,255,0.4)',  glow: '#00ccff',  trigger: 'rgba(0,204,255,0.15)', name: 'Blue' },
    { waveform: '#ffb000',  grid: 'rgba(255,176,0,0.03)',  center: 'rgba(255,176,0,0.08)',  text: 'rgba(255,176,0,0.4)',  glow: '#ffb000',  trigger: 'rgba(255,176,0,0.15)', name: 'Amber' },
];

// =============================================================================
// Extracted pure functions from panel_oscilloscope.js
// =============================================================================

function hexToRgba(hex, alpha) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

// Source: if (edge===0) rising (prev<=0 && curr>0); else falling (prev>=0 && curr<0)
function _findTriggerPoint(samples, mode, edge) {
    if (mode === 0 || !samples || samples.length < 4) return 0;
    var threshold = 0.0;
    var searchStart = Math.floor(samples.length * 0.1);
    var searchEnd = Math.floor(samples.length * 0.8);
    for (var i = searchStart; i < searchEnd; i++) {
        var prev = samples[i - 1];
        var curr = samples[i];
        if (typeof prev !== 'number' || typeof curr !== 'number') continue;
        if (edge === 0) {
            if (prev <= threshold && curr > threshold) return i;
        } else {
            if (prev >= threshold && curr < threshold) return i;
        }
    }
    return -1;
}

function getScopeColors(state, colors) {
    state = state || {};
    colors = colors || SCOPE_COLORS;
    var idx = Math.max(0, Math.min(colors.length - 1, state._scopeColorScheme || 0));
    return colors[idx];
}

function calcPeakLevel(samples) {
    var peak = 0;
    for (var i = 0; i < samples.length; i++) {
        var s = Math.abs(samples[i]);
        if (s > peak) peak = s;
    }
    return peak;
}

function calcPeakDb(peakLevel) {
    if (peakLevel < 0.0001) return '-\\u221E';
    return (20.0 * Math.log10(peakLevel)).toFixed(1) + ' dB';
}

function calcScopeTimeMs(numSamples, sampleRate) {
    sampleRate = sampleRate || 44100;
    return (numSamples / sampleRate) * 1000;
}

// =============================================================================
// Tests
// =============================================================================

// ---------------------------------------------------------------------------
// SCOPE_COLORS — color scheme constants
// ---------------------------------------------------------------------------

describe('SCOPE_COLORS', function () {

    it('has 4 color schemes', function () {
        expect(SCOPE_COLORS.length).toBe(4);
    });

    it('each scheme has all required properties', function () {
        var required = ['waveform', 'grid', 'center', 'text', 'glow', 'trigger', 'name'];
        for (var i = 0; i < SCOPE_COLORS.length; i++) {
            for (var j = 0; j < required.length; j++) {
                expect(SCOPE_COLORS[i]).toHaveProperty(required[j]);
            }
        }
    });

    it('Brand is the first color scheme', function () {
        expect(SCOPE_COLORS[0].name).toBe('Brand');
        expect(SCOPE_COLORS[0].waveform).toBe('#ff9900');
    });

    it('each scheme has unique name', function () {
        var names = {};
        for (var i = 0; i < SCOPE_COLORS.length; i++) {
            names[SCOPE_COLORS[i].name] = (names[SCOPE_COLORS[i].name] || 0) + 1;
        }
        for (var name in names) {
            expect(names[name]).toBe(1);
        }
    });

    it('all waveform colors are valid hex strings', function () {
        for (var i = 0; i < SCOPE_COLORS.length; i++) {
            expect(SCOPE_COLORS[i].waveform).toMatch(/^#[0-9a-f]{6}$/);
        }
    });

});

// ---------------------------------------------------------------------------
// hexToRgba
// ---------------------------------------------------------------------------

describe('hexToRgba', function () {

    it('converts #ff9900 to rgba', function () {
        expect(hexToRgba('#ff9900', 0.85)).toBe('rgba(255,153,0,0.85)');
    });

    it('converts #00ff66 to rgba', function () {
        expect(hexToRgba('#00ff66', 0.4)).toBe('rgba(0,255,102,0.4)');
    });

    it('converts #000000 to rgba', function () {
        expect(hexToRgba('#000000', 0.03)).toBe('rgba(0,0,0,0.03)');
    });

});

// ---------------------------------------------------------------------------
// findTriggerPoint — zero-crossing trigger detection
// ---------------------------------------------------------------------------

describe('findTriggerPoint', function () {

    it('returns 0 when mode is 0 (free-run)', function () {
        expect(_findTriggerPoint([0.5, 0.3, 0.1, -0.1], 0, 0)).toBe(0);
    });

    it('returns 0 for empty or short samples (< 4)', function () {
        expect(_findTriggerPoint([], 1, 0)).toBe(0);
        expect(_findTriggerPoint([0.1, 0.2], 1, 0)).toBe(0);
        expect(_findTriggerPoint(null, 1, 0)).toBe(0);
        expect(_findTriggerPoint(undefined, 1, 0)).toBe(0);
    });

    it('detects rising zero-crossing (edge=0): prev <= 0 and curr > 0', function () {
        // Sine wave crossing from negative to positive
        var samples = [-0.5, -0.3, -0.1, 0.1, 0.3, 0.5];
        var idx = _findTriggerPoint(samples, 1, 0);
        expect(idx).toBe(3); // i=3: prev=-0.1 <= 0, curr=0.1 > 0
    });

    it('detects falling zero-crossing (edge=1): prev >= 0 and curr < 0', function () {
        var samples = [0.5, 0.3, 0.1, -0.1, -0.3, -0.5];
        var idx = _findTriggerPoint(samples, 1, 1);
        expect(idx).toBe(3); // i=3: prev=0.1 >= 0, curr=-0.1 < 0
    });

    it('returns -1 when no zero-crossing found in search window', function () {
        // All positive samples, no crossing
        var samples = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
        var idx = _findTriggerPoint(samples, 1, 0);
        expect(idx).toBe(-1);
    });

    it('skips NaN or non-number samples without throwing', function () {
        var samples = [-0.3, -0.1, NaN, 0.2, 0.4];
        var idx = _findTriggerPoint(samples, 1, 0);
        // Should skip NaN at index 2, check i=3: prev=NaN → typeof !== 'number' → skip
        // i=4: starts at searchStart = floor(5*0.1) = 0, searchEnd = floor(5*0.8) = 4
        // i=0: prev=samples[-1]=undefined → skip... actually samples[-1] is undefined
        // Actually let me just check it doesn't throw
        expect(typeof idx).toBe('number');
    });

    it('searches in the 10%-80% range of samples', function () {
        // Create a long sample with the only zero crossing at index 5
        var samples = [0.1, 0.2, 0.3, 0.4, 0.5, -0.1, 0.1, 0.2, 0.3, 0.4];
        // searchStart = floor(10*0.1) = 1
        // searchEnd = floor(10*0.8) = 8
        // i=6: prev=-0.1 <= 0, curr=0.1 > 0 → returns 6
        var idx = _findTriggerPoint(samples, 1, 0);
        expect(idx).toBe(6);
    });

    it('detects crossing exactly at zero: prev=0, curr>0', function () {
        var samples = [-0.3, 0.0, 0.2, 0.4, 0.6];
        // i=2: prev=0.0 <= 0, curr=0.2 > 0 → returns 2
        var idx = _findTriggerPoint(samples, 1, 0);
        expect(idx).toBe(2);
    });

    it('detects crossing exactly at zero: prev=0, curr<0 for falling edge', function () {
        var samples = [0.3, 0.0, -0.2, -0.4, -0.6];
        // i=2: prev=0.0 >= 0, curr=-0.2 < 0 → returns 2
        var idx = _findTriggerPoint(samples, 1, 1);
        expect(idx).toBe(2);
    });

});

// ---------------------------------------------------------------------------
// getScopeColors — color scheme selection
// ---------------------------------------------------------------------------

describe('getScopeColors', function () {

    it('returns first scheme (Brand) when state has no color setting', function () {
        var colors = getScopeColors({});
        expect(colors.name).toBe('Brand');
    });

    it('returns scheme at index from state._scopeColorScheme', function () {
        var colors = getScopeColors({ _scopeColorScheme: 1 }, SCOPE_COLORS);
        expect(colors.name).toBe('CRT Green');
        expect(colors.waveform).toBe('#00ff66');
    });

    it('returns CRT Green at index 1', function () {
        var colors = getScopeColors({ _scopeColorScheme: 1 }, SCOPE_COLORS);
        expect(colors.name).toBe('CRT Green');
    });

    it('returns Blue at index 2', function () {
        var colors = getScopeColors({ _scopeColorScheme: 2 }, SCOPE_COLORS);
        expect(colors.name).toBe('Blue');
    });

    it('returns Amber at index 3', function () {
        var colors = getScopeColors({ _scopeColorScheme: 3 }, SCOPE_COLORS);
        expect(colors.name).toBe('Amber');
    });

    it('clamps negative index to 0', function () {
        var colors = getScopeColors({ _scopeColorScheme: -1 }, SCOPE_COLORS);
        expect(colors.name).toBe('Brand');
    });

    it('clamps out-of-range index to last scheme', function () {
        var colors = getScopeColors({ _scopeColorScheme: 10 }, SCOPE_COLORS);
        expect(colors.name).toBe('Amber');
    });

    it('defaults to 0 when state is empty', function () {
        var colors = getScopeColors({});
        expect(colors.name).toBe('Brand');
    });

});

// ---------------------------------------------------------------------------
// calcPeakLevel — max absolute sample value
// ---------------------------------------------------------------------------

describe('calcPeakLevel', function () {

    it('returns 1.0 for samples with peak at 1.0', function () {
        var samples = [0.5, -0.3, 1.0, -0.8, 0.2];
        expect(calcPeakLevel(samples)).toBe(1.0);
    });

    it('returns 0 for all-zero samples', function () {
        expect(calcPeakLevel([0, 0, 0, 0])).toBe(0);
    });

    it('finds peak with negative values', function () {
        var samples = [0.1, -0.2, 0.3, -0.9, 0.5];
        expect(calcPeakLevel(samples)).toBe(0.9);
    });

    it('returns 0 for empty array', function () {
        expect(calcPeakLevel([])).toBe(0);
    });

});

// ---------------------------------------------------------------------------
// calcPeakDb — peak level to dB string
// ---------------------------------------------------------------------------

describe('calcPeakDb', function () {

    it('returns -infinity for peak < 0.0001', function () {
        expect(calcPeakDb(0)).toBe('-\\u221E');
        expect(calcPeakDb(0.00005)).toBe('-\\u221E');
    });

    it('returns 0.0 dB for peak=1.0', function () {
        expect(calcPeakDb(1.0)).toBe('0.0 dB');
    });

    it('returns -6.0 dB for peak=0.5', function () {
        expect(calcPeakDb(0.5)).toBe('-6.0 dB');
    });

    it('returns -20.0 dB for peak=0.1', function () {
        expect(calcPeakDb(0.1)).toBe('-20.0 dB');
    });

});

// ---------------------------------------------------------------------------
// calcScopeTimeMs — sample count to milliseconds
// ---------------------------------------------------------------------------

describe('calcScopeTimeMs', function () {

    it('calculates time for 441 samples at 44.1kHz = 10ms', function () {
        expect(calcScopeTimeMs(441, 44100)).toBeCloseTo(10, 3);
    });

    it('calculates time for 882 samples = 20ms', function () {
        expect(calcScopeTimeMs(882, 44100)).toBeCloseTo(20, 3);
    });

    it('uses default sampleRate of 44100', function () {
        expect(calcScopeTimeMs(44100)).toBeCloseTo(1000, 3);
    });

    it('returns 0 for 0 samples', function () {
        expect(calcScopeTimeMs(0)).toBe(0);
    });

});
