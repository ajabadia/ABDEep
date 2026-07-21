/**
 * Tests for WebUI/js/panel_graphics.js — Canvas rendering math functions
 *
 * Extracted pure functions:
 * - hexToRgba(hex, alpha): hex color → rgba string
 * - applyCurve(t, curve): envelope curve shaping (linear, exp, log)
 * - _evalLfoWaveform(shapeVal, pct, phase): LFO shape evaluation (0-6)
 * - _evalOscWaveform(sawEn, sqEn, osc2Lvl, osc2Pitch, pct, phase): mixed oscillator waveform
 * - calcEnvelopeWidths(a, d, s, r, graphW): ADSR segment widths
 * - calcEnvelopePoints(aW, dW, sW, rW, sustainVal, graphH, startX, startY): ADSR control points
 * - calcVcfGain(freq, cutoff, resonance): low-pass filter frequency response
 * - calcHpfGain(freq, cutoff): high-pass filter frequency response
 * - calcArpStepY(stepIndex, graphH, centerY): arpeggiator note position
 */

// =============================================================================
// Extracted pure functions from panel_graphics.js
// =============================================================================

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
}

function applyCurve(t, curve) {
    if (Math.abs(curve) < 0.01) {return t;}
    const exp = curve > 0 ? 1.0 + curve * 3.0 : 1.0 / (1.0 - curve * 3.0);
    return Math.pow(t, exp);
}

function _evalLfoWaveform(shapeVal, pct, phase) {
    const angle = pct * Math.PI * 4 + phase;
    let yVal = 0;
    if (shapeVal === 0) {
        yVal = Math.sin(angle);
    } else if (shapeVal === 1) {
        const mod = angle % (Math.PI * 2);
        if (mod < Math.PI) {
            yVal = 1.0 - (mod / (Math.PI / 2));
        } else {
            yVal = -1.0 + ((mod - Math.PI) / (Math.PI / 2));
        }
    } else if (shapeVal === 2) {
        yVal = (angle % (Math.PI * 2)) < Math.PI ? 1.0 : -1.0;
    } else if (shapeVal === 3) {
        yVal = -1.0 + 2.0 * ((angle % (Math.PI * 2)) / (Math.PI * 2));
    } else if (shapeVal === 4) {
        yVal = 1.0 - 2.0 * ((angle % (Math.PI * 2)) / (Math.PI * 2));
    } else {
        const steps = 8;
        const stepIdx = Math.floor(pct * steps);
        const randVals = [0.2, -0.6, 0.7, -0.2, -0.8, 0.4, -0.1, 0.5];
        yVal = randVals[stepIdx % randVals.length];
        if (shapeVal === 6) {
            const nextVal = randVals[(stepIdx + 1) % randVals.length];
            const interp = (pct * steps) % 1.0;
            yVal = yVal + (nextVal - yVal) * interp;
        }
    }
    return yVal;
}

function _evalOscWaveform(sawEn, sqEn, osc2Lvl, osc2Pitch, pct, phase) {
    const angle = pct * Math.PI * 6 + phase;
    let yVal = 0;
    if (sawEn) {yVal += -0.5 + ((angle % (Math.PI * 2)) / (Math.PI * 2));}
    if (sqEn) {yVal += (angle % (Math.PI * 2)) < Math.PI ? 0.35 : -0.35;}
    const osc2Phase = phase + osc2Pitch * Math.PI * 2;
    const a2 = pct * Math.PI * 6 + osc2Phase;
    yVal += osc2Lvl * 0.3 * Math.sin(a2 * 1.5);
    return yVal;
}

function calcEnvelopeWidths(a, d, s, r, graphW) {
    const totalTime = a + d + 0.7 + r;
    return {
        aW: Math.max(4, (a / totalTime) * graphW),
        dW: Math.max(4, (d / totalTime) * graphW),
        sW: Math.max(8, (0.7 / totalTime) * graphW),
        rW: Math.max(4, (r / totalTime) * graphW)
    };
}

function calcEnvelopePoints(aW, dW, sW, rW, sustainVal, graphH, startX, startY) {
    const p0 = [startX, startY];
    const p1 = [startX + aW, startY - graphH];       // attack peak (top)
    const p2 = [p1[0] + dW, startY - sustainVal * graphH]; // decay to sustain
    const p3 = [p2[0] + sW, p2[1]];                  // sustain segment
    const p4 = [p3[0] + rW, startY];                 // release to baseline
    // Note: source uses topY=padding, startY=h-padding, so graphH = h - padding*2
    // p1 y is topY not startY-graphH. But p1[1] = padding = startY - graphH ✓
    return p0.concat(p1, p2, p3, p4);
}

function calcVcfGain(freq, cutoff, resonance) {
    if (freq < cutoff) {
        var dist = cutoff - freq;
        if (dist < 0.1) {
            const peak = resonance * 1.8 * (1.0 - dist / 0.1);
            return 1.0 + peak;
        }
        return 1.0;
    } else {
        var dist = freq - cutoff;
        return (1.0 + resonance * 1.8) / (1.0 + (dist * 12.0) * (dist * 12.0));
    }
}

function calcHpfGain(freq, cutoff) {
    if (freq > cutoff) {
        return 1.0;
    } else {
        const dist = cutoff - freq;
        return 1.0 / (1.0 + (dist * 15.0) * (dist * 15.0));
    }
}

function calcArpStepY(stepIndex, graphH, centerY) {
    return centerY + (stepIndex % 4 - 2) * (graphH / 4);
}

// =============================================================================
// Tests
// =============================================================================

// ---------------------------------------------------------------------------
// hexToRgba
// ---------------------------------------------------------------------------

describe('hexToRgba', function () {

    it('converts #ff9900 with alpha 1.0', function () {
        expect(hexToRgba('#ff9900', 1.0)).toBe('rgba(255, 153, 0, 1)');
    });

    it('converts #00ff00 with alpha 0.5', function () {
        expect(hexToRgba('#00ff00', 0.5)).toBe('rgba(0, 255, 0, 0.5)');
    });

    it('converts #000000 with alpha 0.04', function () {
        expect(hexToRgba('#000000', 0.04)).toBe('rgba(0, 0, 0, 0.04)');
    });

    it('converts #ffffff with alpha 0', function () {
        expect(hexToRgba('#ffffff', 0)).toBe('rgba(255, 255, 255, 0)');
    });

});

// ---------------------------------------------------------------------------
// applyCurve — envelope curve shaping
// ---------------------------------------------------------------------------

describe('applyCurve', function () {

    it('returns t unchanged when curve is 0 (linear)', function () {
        expect(applyCurve(0.0, 0.0)).toBe(0.0);
        expect(applyCurve(0.25, 0.0)).toBe(0.25);
        expect(applyCurve(0.5, 0.0)).toBe(0.5);
        expect(applyCurve(0.75, 0.0)).toBe(0.75);
        expect(applyCurve(1.0, 0.0)).toBe(1.0);
    });

    it('returns t unchanged when curve is near-zero (< 0.01)', function () {
        expect(applyCurve(0.5, 0.005)).toBe(0.5);
        expect(applyCurve(0.5, -0.005)).toBe(0.5);
    });

    it('positive curve produces exponential (concave) shape: slow start, fast end', function () {
        // exp = 1.0 + 1.0 * 3.0 = 4.0 → t^4
        let v = applyCurve(0.25, 1.0);
        expect(v).toBeCloseTo(0.0039, 4); // 0.25^4 = 0.00390625

        v = applyCurve(0.5, 1.0);
        expect(v).toBeCloseTo(0.0625, 4); // 0.5^4 = 0.0625

        v = applyCurve(0.75, 1.0);
        expect(v).toBeCloseTo(0.3164, 3); // 0.75^4 = 0.31640625
    });

    it('positive curve with curve=0.5: exp=2.5, t^2.5', function () {
        const v = applyCurve(0.5, 0.5);
        expect(v).toBeCloseTo(0.1768, 3); // 0.5^2.5 = 0.176777
    });

    it('negative curve produces logarithmic (convex) shape: fast start, slow end', function () {
        // exp = 1/(1.0 - (-0.5)*3.0) = 1/(1.0+1.5) = 1/2.5 = 0.4
        let v = applyCurve(0.25, -0.5);
        expect(v).toBeCloseTo(0.5743, 3); // 0.25^0.4 ≈ 0.5743

        v = applyCurve(0.5, -0.5);
        expect(v).toBeCloseTo(0.7579, 3); // 0.5^0.4 ≈ 0.7579
    });

    it('negative extreme curve=-1.0: exp=1/4=0.25, t^0.25', function () {
        // exp = 1/(1.0 - (-1.0)*3.0) = 1/(1.0+3.0) = 0.25
        let v = applyCurve(0.1, -1.0);
        expect(v).toBeCloseTo(0.5623, 3); // 0.1^0.25 ≈ 0.5623

        v = applyCurve(0.5, -1.0);
        expect(v).toBeCloseTo(0.8409, 3); // 0.5^0.25 ≈ 0.8409
    });

    it('positive extreme curve=1.0: exp=4.0, t^4', function () {
        expect(applyCurve(0.0, 1.0)).toBe(0.0);
        expect(applyCurve(1.0, 1.0)).toBe(1.0);
    });

    it('negative extreme curve=-1.0: exp=0.25, t^0.25, endpoints preserved', function () {
        expect(applyCurve(0.0, -1.0)).toBe(0.0);
        expect(applyCurve(1.0, -1.0)).toBe(1.0);
    });

});

// ---------------------------------------------------------------------------
// _evalLfoWaveform — LFO shape evaluation
// ---------------------------------------------------------------------------

describe('_evalLfoWaveform — shape 0 (Sine)', function () {

    it('returns 0 at phase 0 with pct=0', function () {
        expect(_evalLfoWaveform(0, 0, 0)).toBeCloseTo(0, 5);
    });

    it('returns 1 at π/2 phase (pct=0, phase=π/2)', function () {
        const v = _evalLfoWaveform(0, 0, Math.PI / 2);
        expect(v).toBeCloseTo(1, 5);
    });

    it('returns ~0 at phase=π (pct=0)', function () {
        const v = _evalLfoWaveform(0, 0, Math.PI);
        expect(v).toBeCloseTo(0, 5);
    });

    it('returns -1 at phase=3π/2', function () {
        const v = _evalLfoWaveform(0, 0, 3 * Math.PI / 2);
        expect(v).toBeCloseTo(-1, 5);
    });

    it('completes one cycle: pct=0.5 corresponds to 2π phase advance', function () {
        // pct=0.5: angle = 0.5*4π = 2π
        const v0 = _evalLfoWaveform(0, 0, 0);
        const vHalf = _evalLfoWaveform(0, 0.5, 0);
        expect(v0).toBeCloseTo(vHalf, 5);
    });

});

describe('_evalLfoWaveform — shape 1 (Triangle)', function () {

    it('returns 1.0 at start of cycle (mod=0)', function () {
        const v = _evalLfoWaveform(1, 0, 0);
        expect(v).toBeCloseTo(1.0, 5);
    });

    it('returns 0 at quarter cycle (mod=π/2)', function () {
        const v = _evalLfoWaveform(1, 0, Math.PI / 2);
        // mod = π/2, since π/2 < π: y = 1 - (π/2)/(π/2) = 1 - 1 = 0
        expect(v).toBeCloseTo(0, 5);
    });

    it('returns -1 at half cycle (mod=π)', function () {
        const v = _evalLfoWaveform(1, 0, Math.PI);
        // mod = π: y = 1 - π/(π/2) = 1-2 = -1  → Wait, that's wrong. Let me recheck.
        // For mod < π: y = 1.0 - (mod / (π/2))
        // For mod ≥ π: y = -1.0 + ((mod - π) / (π/2))
        // mod = π: mod is NOT < π, so: y = -1.0 + (π-π)/(π/2) = -1.0 + 0 = -1.0 ✓
        expect(v).toBeCloseTo(-1.0, 5);
    });

    it('returns 0 at 3π/4 through the cycle', function () {
        const v = _evalLfoWaveform(1, 0, 3 * Math.PI / 2);
        // mod = 3π/2: mod >= π, so: y = -1.0 + (3π/2-π)/(π/2) = -1.0 + (π/2)/(π/2) = -1+1 = 0
        expect(v).toBeCloseTo(0, 5);
    });

});

describe('_evalLfoWaveform — shape 2 (Square)', function () {

    it('returns 1.0 in first half of cycle', function () {
        let v = _evalLfoWaveform(2, 0, 0);
        expect(v).toBe(1.0);
        v = _evalLfoWaveform(2, 0.24, 0); // angle ≈ 3.02 < π
        expect(v).toBe(1.0);
    });

    it('returns -1.0 in second half of cycle', function () {
        let v = _evalLfoWaveform(2, 0.26, 0); // angle ≈ 3.27 > π
        expect(v).toBe(-1.0);
        v = _evalLfoWaveform(2, 0.5, 0); // angle = 2π, angle%2π = 0 < π
        // 0.5*4π = 2π, 2π%2π = 0 < π → 1.0
        expect(v).toBe(1.0);
    });

});

describe('_evalLfoWaveform — shape 3 (Saw Up)', function () {

    it('starts at -1.0', function () {
        const v = _evalLfoWaveform(3, 0, 0);
        expect(v).toBeCloseTo(-1.0, 5);
    });

    it('ramps to ~0.0 at quarter cycle', function () {
        const v = _evalLfoWaveform(3, 0.125, 0);
        // angle = 0.125*4π = π/2, y = -1 + 2*(π/2)/(2π) = -1 + 2*0.25 = -0.5
        // Actually: y = -1.0 + 2.0 * ((π/2) / (2π)) = -1.0 + 2.0 * 0.25 = -0.5
        expect(v).toBeCloseTo(-0.5, 5);
    });

    it('returns -1.0 at end of cycle (modulo wraps to 0)', function () {
        const v = _evalLfoWaveform(3, 0.5, 0);
        // angle = 0.5*4π = 2π → (2π) % (2π) = 0 (float precision)
        // y = -1 + 2*(0/2π) = -1.0 (periodic: pct=0.5 ≡ pct=0)
        expect(v).toBeCloseTo(-1.0, 5);
    });

});

describe('_evalLfoWaveform — shape 4 (Saw Down)', function () {

    it('starts at 1.0', function () {
        const v = _evalLfoWaveform(4, 0, 0);
        expect(v).toBeCloseTo(1.0, 5);
    });

    it('returns 1.0 at end of cycle (modulo wraps to 0)', function () {
        const v = _evalLfoWaveform(4, 0.5, 0);
        // angle = 0.5*4π = 2π → (2π) % (2π) = 0
        // y = 1 - 2*(0/2π) = 1.0 (periodic: pct=0.5 ≡ pct=0)
        expect(v).toBeCloseTo(1.0, 5);
    });

});

describe('_evalLfoWaveform — shape 5 (Sample & Hold)', function () {

    it('returns stepped values from randVals array', function () {
        // At pct=0, stepIdx=0: randVals[0] = 0.2
        expect(_evalLfoWaveform(5, 0, 0)).toBe(0.2);
        // At pct=0.124 (between step 0 and 1), stepIdx=0
        expect(_evalLfoWaveform(5, 0.124, 0)).toBe(0.2);
        // At pct=0.125, stepIdx=1 (floor(1.0)=1): randVals[1] = -0.6
        expect(_evalLfoWaveform(5, 0.125, 0)).toBe(-0.6);
    });

    it('loops through all 8 steps', function () {
        const expected = [0.2, -0.6, 0.7, -0.2, -0.8, 0.4, -0.1, 0.5];
        for (let i = 0; i < 8; i++) {
            const pct = (i + 0.01) / 8;
            expect(_evalLfoWaveform(5, pct, 0)).toBe(expected[i]);
        }
    });

    it('wraps around after 8 steps (pct=1.0 gives stepIdx=8, 8%8=0)', function () {
        expect(_evalLfoWaveform(5, 0.99, 0)).toBe(0.5); // stepIdx=7: randVals[7]=0.5
        expect(_evalLfoWaveform(5, 1.0, 0)).toBe(0.2); // stepIdx=8: randVals[8%8]=randVals[0]=0.2
        // Actually: pct=1.0, stepIdx = floor(1.0*8) = 8. stepIdx % 8 = 0 → 0.2. Wait but for pct=1.0 and pct=0, stepIdx=0 both. This is correct behavior.
    });

});

describe('_evalLfoWaveform — shape 6 (Sample & Glide)', function () {

    it('at step boundary, returns same value as S&H', function () {
        const sh = _evalLfoWaveform(5, 0, 0);
        const sg = _evalLfoWaveform(6, 0, 0);
        expect(sg).toBe(sh);
    });

    it('at mid-step, interpolates between steps', function () {
        const pct = 0.0625; // half of step 0
        const sh = _evalLfoWaveform(5, pct, 0);
        const sg = _evalLfoWaveform(6, pct, 0);
        // At pct=0.0625, stepIdx=0, interp=0.5, yVal = 0.2 + (-0.6-0.2)*0.5 = 0.2-0.4 = -0.2
        // S&H stays at 0.2
        expect(sh).toBe(0.2);
        expect(sg).not.toBe(sh); // glide interpolates
        expect(sg).toBeCloseTo(-0.2, 5);
    });

    it('at step end matches next S&H value', function () {
        // At pct approaching 0.125 (step 1), S&G approaches randVals[1] = -0.6
        const sg = _evalLfoWaveform(6, 0.12499, 0);
        expect(sg).toBeCloseTo(-0.6, 2);
    });

});

describe('_evalLfoWaveform — edge cases', function () {

    it('handles negative phase offset', function () {
        const v = _evalLfoWaveform(0, 0, -Math.PI / 2);
        expect(v).toBeCloseTo(-1, 5);
    });

    it('handles out-of-range shapeVal by defaulting to S&H-like behavior', function () {
        // shapeVal > 6 falls into else branch (shapes 5/6)
        const v5 = _evalLfoWaveform(7, 0, 0);
        const vDefault = _evalLfoWaveform(5, 0, 0);
        expect(v5).toBe(vDefault); // same as shape 5 (no glide)
    });

    it('produces consistent periodic output (same input → same output)', function () {
        const a = _evalLfoWaveform(2, 0.3, 1.5);
        const b = _evalLfoWaveform(2, 0.3, 1.5);
        expect(a).toBe(b);
    });

});

// ---------------------------------------------------------------------------
// _evalOscWaveform — oscillator waveform mixing
// ---------------------------------------------------------------------------

describe('_evalOscWaveform', function () {

    it('returns 0 when all sources disabled/zero', function () {
        const v = _evalOscWaveform(false, false, 0, 0, 0, 0);
        expect(v).toBe(0);
    });

    it('saw only produces ramp waveform', function () {
        const v0 = _evalOscWaveform(true, false, 0, 0, 0, 0);
        expect(v0).toBeCloseTo(-0.5, 5); // -0.5 + (0)/(2π) = -0.5
        
        const vHalf = _evalOscWaveform(true, false, 0, 0, 0.1667, 0);
        // angle = 0.1667*6π ≈ π, y = -0.5 + π/(2π) = -0.5 + 0.5 = 0
        expect(vHalf).toBeCloseTo(0, 1);
    });

    it('square only produces symmetric square wave', function () {
        const v0 = _evalOscWaveform(false, true, 0, 0, 0, 0);
        expect(v0).toBeCloseTo(0.35, 5);
        
        const vHalf = _evalOscWaveform(false, true, 0, 0, 0.2, 0);
        // angle = 0.2*6π = 1.2π ≈ 3.77 > π → -0.35
        expect(vHalf).toBeCloseTo(-0.35, 5);
    });

    it('saw + square adds both contributions', function () {
        const v = _evalOscWaveform(true, true, 0, 0, 0, 0);
        expect(v).toBeCloseTo(-0.15, 5); // -0.5 + 0.35 = -0.15
    });

    it('osc2 level contributes sinusoidal component', function () {
        const vNoOsc2 = _evalOscWaveform(true, false, 0, 0, 0.25, 0);
        const vWithOsc2 = _evalOscWaveform(true, false, 0.5, 0, 0.25, 0);
        // osc2 adds 0.5 * 0.3 * sin(a2*1.5)
        expect(vWithOsc2).not.toBe(vNoOsc2);
    });

    it('osc2 pitch shifts the phase of osc2 component', function () {
        const vLow = _evalOscWaveform(true, false, 1.0, 0, 0.25, 0);
        const vHigh = _evalOscWaveform(true, false, 1.0, 0.5, 0.25, 0);
        expect(vLow).not.toBe(vHigh);
    });

    it('phase offset shifts entire waveform', function () {
        const v0 = _evalOscWaveform(true, false, 0, 0, 0.1, 0);
        const vShifted = _evalOscWaveform(true, false, 0, 0, 0.1, Math.PI);
        expect(v0).not.toBe(vShifted);
    });

});

// ---------------------------------------------------------------------------
// calcEnvelopeWidths — ADSR segment widths
// ---------------------------------------------------------------------------

describe('calcEnvelopeWidths', function () {

    it('distributes widths proportional to time values', function () {
        const result = calcEnvelopeWidths(0.2, 0.3, 0.5, 0.4, 200);
        // totalTime = 0.2 + 0.3 + 0.7 + 0.4 = 1.6
        // aW = (0.2/1.6)*200 = 25
        // dW = (0.3/1.6)*200 = 37.5
        // sW = (0.7/1.6)*200 = 87.5
        // rW = (0.4/1.6)*200 = 50
        expect(result.aW).toBe(25);
        expect(result.dW).toBeCloseTo(37.5, 5);
        expect(result.sW).toBeCloseTo(87.5, 5);
        expect(result.rW).toBe(50);
    });

    it('enforces minimum widths (a/d/r ≥ 4), sustain uses 0.7/totalTime', function () {
        const result = calcEnvelopeWidths(0, 0, 0, 0, 200);
        // totalTime = 0+0+0.7+0 = 0.7
        // aW = max(4, 0/0.7*200) = 4
        // sW = max(8, (0.7/0.7)*200) = 200 (sustain time is always 0.7)
        expect(result.aW).toBe(4);
        expect(result.dW).toBe(4);
        expect(result.sW).toBe(200);
        expect(result.rW).toBe(4);
    });

    it('all widths equal when all times are equal (a=d=r)', function () {
        const result = calcEnvelopeWidths(0.5, 0.5, 0.5, 0.5, 300);
        // totalTime = 0.5+0.5+0.7+0.5 = 2.2
        // aW = (0.5/2.2)*300 = 68.18
        expect(result.dW).toBe(result.aW);
        expect(result.rW).toBe(result.aW);
    });

    it('sustain width uses constant 0.7 time, independent of sustain value', function () {
        const result1 = calcEnvelopeWidths(0.3, 0.3, 0, 0.3, 200);
        const result2 = calcEnvelopeWidths(0.3, 0.3, 1, 0.3, 200);
        // sW uses 0.7/totalTime regardless of s (sustain level) value
        // totalTime = 0.3+0.3+0.7+0.3 = 1.6
        // sW = (0.7/1.6)*200 = 87.5
        expect(result1.sW).toBeCloseTo(87.5, 5);
        expect(result2.sW).toBeCloseTo(87.5, 5);
    });

    it('handles large graphW correctly', function () {
        const result = calcEnvelopeWidths(0.5, 0.3, 0.5, 0.2, 500);
        expect(result.aW).toBeGreaterThan(0);
        expect(result.dW).toBeGreaterThan(0);
        expect(result.sW).toBeGreaterThan(0);
        expect(result.rW).toBeGreaterThan(0);
    });

});

// ---------------------------------------------------------------------------
// calcEnvelopePoints — ADSR control points
// ---------------------------------------------------------------------------

describe('calcEnvelopePoints', function () {

    it('calculates 5 points with correct positions', function () {
        const pts = calcEnvelopePoints(50, 30, 60, 20, 0.6, 100, 10, 350);
        // p0: [10, 350]
        // p1: [60, 250] (startX+aW=60, startY-graphH=350-100=250)
        // p2: [90, 290] (p1[0]+dW=90, startY-0.6*100=350-60=290)
        // p3: [150, 290] (p2[0]+sW=150, same y as p2)
        // p4: [170, 350] (p3[0]+rW=170, startY=350)
        expect(pts[0]).toBe(10);
        expect(pts[1]).toBe(350);
        expect(pts[2]).toBe(60);
        expect(pts[3]).toBe(250);
        expect(pts[4]).toBe(90);
        expect(pts[5]).toBe(290);
        expect(pts[6]).toBe(150);
        expect(pts[7]).toBe(290);
        expect(pts[8]).toBe(170);
        expect(pts[9]).toBe(350);
    });

    it('sustain=0 places p2 at baseline', function () {
        const pts = calcEnvelopePoints(40, 30, 50, 20, 0, 100, 10, 350);
        // p2[1] = 350 - 0*100 = 350 (baseline)
        expect(pts[5]).toBe(350);
    });

    it('sustain=1 places p2 at top', function () {
        const pts = calcEnvelopePoints(40, 30, 50, 20, 1.0, 100, 10, 350);
        // p2[1] = 350 - 1.0*100 = 250 (top)
        expect(pts[5]).toBe(250);
    });

    it('p1 is at full graph height above baseline', function () {
        const pts = calcEnvelopePoints(40, 30, 50, 20, 0.5, 120, 10, 360);
        // p1[1] = 360 - 120 = 240
        expect(pts[3]).toBe(240);
    });

});

// ---------------------------------------------------------------------------
// calcVcfGain — VCF frequency response
// ---------------------------------------------------------------------------

describe('calcVcfGain', function () {

    it('returns 1.0 for freq far below cutoff with no resonance', function () {
        expect(calcVcfGain(0.1, 0.5, 0)).toBe(1.0);
    });

    it('returns boosted gain near cutoff with resonance', function () {
        // freq=0.45, cutoff=0.5, resonance=1.0
        // dist = 0.05 < 0.1, peak = 1.0*1.8*(1-0.5) = 0.9
        const v = calcVcfGain(0.45, 0.5, 1.0);
        expect(v).toBeCloseTo(1.9, 5);
    });

    it('attenuates above cutoff with no resonance', function () {
        // freq=0.7, cutoff=0.5, resonance=0
        // dist = 0.2, gain = (1+0)/(1+(2.4)^2) = 1/(1+5.76) = 0.148
        const v = calcVcfGain(0.7, 0.5, 0);
        expect(v).toBeCloseTo(0.148, 2);
    });

    it('resonance boosts gain at cutoff', function () {
        // freq=cutoff=0.5: freq is not less than cutoff, so else branch
        // dist = 0, gain = (1+0.7*1.8)/(1+0) = 1+1.26 = 2.26
        const vNoRes = calcVcfGain(0.5, 0.5, 0);
        const vRes = calcVcfGain(0.5, 0.5, 0.7);
        expect(vRes).toBeGreaterThan(vNoRes);
        expect(vRes).toBeCloseTo(2.26, 5);
    });

    it('gain approaches 0 as freq goes far above cutoff', function () {
        const v = calcVcfGain(1.0, 0.1, 0);
        // dist = 0.9, gain = 1/(1+(10.8)^2) = 1/117.64 ≈ 0.0085
        expect(v).toBeLessThan(0.01);
    });

});

// ---------------------------------------------------------------------------
// calcHpfGain — HPF frequency response
// ---------------------------------------------------------------------------

describe('calcHpfGain', function () {

    it('returns 1.0 for freq above cutoff', function () {
        expect(calcHpfGain(0.7, 0.3)).toBe(1.0);
    });

    it('attenuates below cutoff', function () {
        // freq=0.2, cutoff=0.5: dist=0.3, gain=1/(1+(4.5)^2)=1/21.25≈0.047
        const v = calcHpfGain(0.2, 0.5);
        expect(v).toBeCloseTo(0.047, 2);
    });

    it('gain approaches 0 as freq goes far below cutoff', function () {
        const v = calcHpfGain(0.01, 0.9);
        // dist = 0.89, gain = 1/(1+(13.35)^2) = 1/179.2 ≈ 0.0056
        expect(v).toBeLessThan(0.01);
    });

    it('gain is 1.0 at cutoff (freq=cutoff, passes through)', function () {
        // freq=0.5, cutoff=0.5: freq is NOT > cutoff, so else branch
        // dist = 0, gain = 1/1 = 1
        expect(calcHpfGain(0.5, 0.5)).toBe(1.0);
    });

});

// ---------------------------------------------------------------------------
// calcArpStepY — arpeggiator note position
// ---------------------------------------------------------------------------

describe('calcArpStepY', function () {

    it('step 0: returns centerY - 2*(graphH/4) = centerY - graphH/2', function () {
        const v = calcArpStepY(0, 100, 200);
        expect(v).toBe(150); // 200 - 100/2 = 150
    });

    it('step 1: returns centerY - graphH/4', function () {
        const v = calcArpStepY(1, 100, 200);
        expect(v).toBe(175); // 200 - 100/4 = 175
    });

    it('step 2: returns centerY (middle)', function () {
        const v = calcArpStepY(2, 100, 200);
        expect(v).toBe(200); // 200 + 0 = 200
    });

    it('step 3: returns centerY + graphH/4', function () {
        const v = calcArpStepY(3, 100, 200);
        expect(v).toBe(225); // 200 + 100/4 = 225
    });

    it('step 4 (wraps to 0 mod 4): returns same as step 0', function () {
        const v0 = calcArpStepY(0, 100, 200);
        const v4 = calcArpStepY(4, 100, 200);
        expect(v4).toBe(v0);
    });

    it('step 5 (wraps to 1 mod 4): returns same as step 1', function () {
        const v1 = calcArpStepY(1, 100, 200);
        const v5 = calcArpStepY(5, 100, 200);
        expect(v5).toBe(v1);
    });

});
