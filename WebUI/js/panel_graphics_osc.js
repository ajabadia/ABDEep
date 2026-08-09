/**
 * @purpose Oscillator waveform graph drawer (OSC1/OSC2) with CRT ghost trail.
 * Extracted from panel_graphics_shapes.js.
 */

/** Draw oscillator waveform (OSC1 or OSC2) with CRT ghost trail */
window._drawOscGraph = function(ctx, w, h, colors, cache, state) {
    const panelActiveOsc = state.panelActiveOsc || 1;
    const _animTime = state._animTime || 0;

    ctx.strokeStyle = colors.waveform;
    ctx.shadowColor = window.pgHexToRgba(colors.waveform, 0.4);
    ctx.shadowBlur = 4;
    ctx.lineWidth = 2;
    ctx.beginPath();

    const padding = 10;
    const graphW = w - padding * 2;
    const graphH = h - padding * 2;
    const centerY = h / 2;

    const oscPhase = (_animTime / 1000) * Math.PI * 2 * 2.2;

    function drawOscWave(isOsc2) {
        ctx.beginPath();
        for (let x = 0; x < graphW; x++) {
            const pct = x / graphW;
            let yVal = 0;
            if (!isOsc2) {
                const sawEn = typeof cache['osc1_saw_enable'] !== 'undefined' ? cache['osc1_saw_enable'] > 0.5 : true;
                const sqEn = typeof cache['osc1_square_enable'] !== 'undefined' ? cache['osc1_square_enable'] > 0.5 : false;
                const angle = pct * Math.PI * 6 + oscPhase;
                if (sawEn) {yVal += -0.5 + ((angle % (Math.PI * 2)) / (Math.PI * 2));}
                if (sqEn) {yVal += (angle % (Math.PI * 2)) < Math.PI ? 0.35 : -0.35;}
            } else {
                const toneMod = typeof cache['osc2_tone_mod'] !== 'undefined' ? cache['osc2_tone_mod'] : 0.5;
                const angle = pct * Math.PI * 6 + oscPhase;
                const modAngle = angle % (Math.PI * 2);
                const duty = 0.2 + toneMod * 0.6;
                yVal = modAngle < Math.PI * duty ? 0.7 : -0.7;
            }
            const canvasX = padding + x;
            const canvasY = centerY - yVal * (graphH / 2);
            if (x === 0) {ctx.moveTo(canvasX, canvasY);}
            else {ctx.lineTo(canvasX, canvasY);}
        }
        ctx.stroke();
    }

    drawOscWave(panelActiveOsc === 2);

    // Ghost wave
    ctx.shadowBlur = 0;
    const ghostOscPhase = oscPhase - Math.PI * 0.5;
    ctx.strokeStyle = window.pgHexToRgba(colors.waveform, 0.06);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < graphW; x++) {
        const pct = x / graphW;
        let yVal = 0;
        if (panelActiveOsc !== 2) {
            const sawEn = typeof cache['osc1_saw_enable'] !== 'undefined' ? cache['osc1_saw_enable'] > 0.5 : true;
            const sqEn = typeof cache['osc1_square_enable'] !== 'undefined' ? cache['osc1_square_enable'] > 0.5 : false;
            const angle = pct * Math.PI * 6 + ghostOscPhase;
            if (sawEn) {yVal += -0.5 + ((angle % (Math.PI * 2)) / (Math.PI * 2));}
            if (sqEn) {yVal += (angle % (Math.PI * 2)) < Math.PI ? 0.35 : -0.35;}
        } else {
            const toneMod = typeof cache['osc2_tone_mod'] !== 'undefined' ? cache['osc2_tone_mod'] : 0.5;
            const angle = pct * Math.PI * 6 + ghostOscPhase;
            const modAngle = angle % (Math.PI * 2);
            const duty = 0.2 + toneMod * 0.6;
            yVal = modAngle < Math.PI * duty ? 0.7 : -0.7;
        }
        const canvasX = padding + x;
        const canvasY = centerY - yVal * (graphH / 2);
        if (x === 0) {ctx.moveTo(canvasX, canvasY);}
        else {ctx.lineTo(canvasX, canvasY);}
    }
    ctx.stroke();
};
