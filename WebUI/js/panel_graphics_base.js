/**
 * @purpose Base graphics functions for panel graph canvas: waveform evaluators and grid background.
 * Extracted from panel_graphics_shapes.js.
 */

/** Evaluate LFO waveform shape at a given phase position */
window._evalLfoWaveform = function(shapeVal, pct, phase) {
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

/** Evaluate oscillator waveform (saw + square mix) at a given phase position */
window._evalOscWaveform = function(sawEn, sqEn, osc2Lvl, osc2Pitch, pct, phase) {
    const angle = pct * Math.PI * 6 + phase;
    let yVal = 0;
    if (sawEn) {yVal += -0.5 + ((angle % (Math.PI * 2)) / (Math.PI * 2));}
    if (sqEn) {yVal += (angle % (Math.PI * 2)) < Math.PI ? 0.35 : -0.35;}
    const osc2Phase = phase + osc2Pitch * Math.PI * 2;
    const a2 = pct * Math.PI * 6 + osc2Phase;
    yVal += osc2Lvl * 0.3 * Math.sin(a2 * 1.5);
    return yVal;
};

/** Draw CRT-style retro grid background on the graph canvas */
window._drawGraphGrid = function(ctx, w, h, colors, currentPanelMode) {
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 15) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
    }
    for (let y = 0; y < h; y += 15) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
    }
    if (currentPanelMode === 'LFO' || currentPanelMode === 'OSC') {
        ctx.strokeStyle = colors.center;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }
};
