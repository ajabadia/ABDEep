/**
 * @purpose LFO waveform graph drawer with CRT phosphor ghost trail.
 * Extracted from panel_graphics_shapes.js.
 */

/** Draw LFO waveform with animated phase and ghost (CRT phosphor trail) */
window._drawLfoGraph = function(ctx, w, h, colors, cache, state) {
    const panelActiveLfo = state.panelActiveLfo || 1;
    const prefix = 'lfo' + panelActiveLfo + '_';
    const _animTime = state._animTime || 0;
    const shapeVal = typeof cache[prefix + 'shape'] !== 'undefined' ? Math.round(cache[prefix + 'shape'] * 6) : 1;
    const lfoRate = typeof cache[prefix + 'rate'] !== 'undefined' ? cache[prefix + 'rate'] : 0.5;

    ctx.strokeStyle = colors.waveform;
    ctx.shadowColor = window.pgHexToRgba(colors.waveform, 0.4);
    ctx.shadowBlur = 4;
    ctx.lineWidth = 2;
    ctx.beginPath();

    const padding = 10;
    const graphW = w - padding * 2;
    const graphH = h - padding * 2;
    const centerY = h / 2;

    const freq = 0.5 + lfoRate * 4.0;
    const phaseOffset = (_animTime / 1000) * freq * Math.PI * 2;

    // Main waveform
    for (let x = 0; x < graphW; x++) {
        const pct = x / graphW;
        const yVal = window._evalLfoWaveform(shapeVal, pct, phaseOffset);
        const canvasX = padding + x;
        const canvasY = centerY - yVal * (graphH / 2);
        if (x === 0) {ctx.moveTo(canvasX, canvasY);}
        else {ctx.lineTo(canvasX, canvasY);}
    }
    ctx.stroke();

    // Ghost wave (CRT phosphor trail)
    ctx.shadowBlur = 0;
    ctx.strokeStyle = window.pgHexToRgba(colors.waveform, 0.08);
    ctx.lineWidth = 1;
    ctx.beginPath();
    const ghostPhase = phaseOffset - freq * Math.PI * 0.2;
    for (let x = 0; x < graphW; x++) {
        const pct = x / graphW;
        const yVal = window._evalLfoWaveform(shapeVal, pct, ghostPhase);
        const canvasX = padding + x;
        const canvasY = centerY - yVal * (graphH / 2);
        if (x === 0) {ctx.moveTo(canvasX, canvasY);}
        else {ctx.lineTo(canvasX, canvasY);}
    }
    ctx.stroke();
};
