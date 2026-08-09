/**
 * @purpose Pure math functions for canvas rendering in panel graphics.
 * Extracted from panel_graphics.js — pure functions, no canvas/DOM dependencies.
 * All functions are deterministic: same inputs → same outputs.
 */

// ──────────────────────────────────────────────
// Color helpers
// ──────────────────────────────────────────────

window.pgHexToRgba = function(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
};

// ──────────────────────────────────────────────
// Envelope curve shaping
// ──────────────────────────────────────────────

window.pgApplyCurve = function(t, curve) {
    if (Math.abs(curve) < 0.01) {return t;}
    const exp = curve < 0 ? 1.0 - curve * 3.0 : 1.0 / (1.0 + curve * 3.0);
    return Math.pow(t, exp);
};

// ──────────────────────────────────────────────
// LFO waveform evaluation
// ──────────────────────────────────────────────

window.pgEvalLfoWaveform = function(shapeVal, pct, phase) {
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
};

// ──────────────────────────────────────────────
// Oscillator waveform mixing
// ──────────────────────────────────────────────

window.pgEvalOscWaveform = function(sawEn, sqEn, osc2Lvl, osc2Pitch, pct, phase) {
    const angle = pct * Math.PI * 6 + phase;
    let yVal = 0;
    if (sawEn) {yVal += -0.5 + ((angle % (Math.PI * 2)) / (Math.PI * 2));}
    if (sqEn) {yVal += (angle % (Math.PI * 2)) < Math.PI ? 0.35 : -0.35;}
    const osc2Phase = phase + osc2Pitch * Math.PI * 2;
    const a2 = pct * Math.PI * 6 + osc2Phase;
    yVal += osc2Lvl * 0.3 * Math.sin(a2 * 1.5);
    return yVal;
};

// ──────────────────────────────────────────────
// Envelope ADSR helpers
// ──────────────────────────────────────────────

window.pgCalcEnvelopeWidths = function(a, d, s, r, graphW) {
    const totalTime = a + d + 0.7 + r;
    return {
        aW: Math.max(4, (a / totalTime) * graphW),
        dW: Math.max(4, (d / totalTime) * graphW),
        sW: Math.max(8, (0.7 / totalTime) * graphW),
        rW: Math.max(4, (r / totalTime) * graphW)
    };
};

window.pgCalcEnvelopePoints = function(aW, dW, sW, rW, sustainVal, graphH, startX, startY) {
    const p0 = [startX, startY];
    const p1 = [startX + aW, startY - graphH];
    const p2 = [p1[0] + dW, startY - sustainVal * graphH];
    const p3 = [p2[0] + sW, p2[1]];
    const p4 = [p3[0] + rW, startY];
    return { p0: p0, p1: p1, p2: p2, p3: p3, p4: p4 };
};

// ──────────────────────────────────────────────
// Filter frequency response
// ──────────────────────────────────────────────

window.pgCalcVcfGain = function(freq, cutoff, resonance) {
    if (freq < cutoff) {
        const dist = cutoff - freq;
        if (dist < 0.1) {
            const peak = resonance * 1.8 * (1.0 - dist / 0.1);
            return 1.0 + peak;
        }
        return 1.0;
    } else {
        const dist = freq - cutoff;
        return (1.0 + resonance * 1.8) / (1.0 + (dist * 12.0) * (dist * 12.0));
    }
};

window.pgCalcHpfGain = function(freq, cutoff) {
    if (freq > cutoff) {
        return 1.0;
    } else {
        const dist = cutoff - freq;
        return 1.0 / (1.0 + (dist * 15.0) * (dist * 15.0));
    }
};

// ──────────────────────────────────────────────
// Arpeggiator note position
// ──────────────────────────────────────────────

window.pgCalcArpStepY = function(stepIndex, graphH, centerY) {
    return centerY + (stepIndex % 4 - 2) * (graphH / 4);
};
