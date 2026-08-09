/**
 * @purpose Arpeggiator pattern graph drawer with animated step dots.
 * Extracted from panel_graphics_shapes.js.
 */

/** Draw arpeggiator pattern with step dots */
window._drawArpGraph = function(ctx, w, h, colors, cache, state) {
    const _animTime = state._animTime || 0;

    ctx.strokeStyle = colors.waveform;
    ctx.shadowColor = window.pgHexToRgba(colors.waveform, 0.4);
    ctx.shadowBlur = 4;
    ctx.lineWidth = 2;
    const padding = 10;
    const graphW = w - padding * 2;
    const graphH = h - padding * 2;
    const centerY = h / 2;

    const arpRate = typeof cache['arp_rate'] !== 'undefined' ? cache['arp_rate'] : 0.5;
    const bpm = 20 + arpRate * 220;
    const beatMs = 60000 / bpm;
    const stepDuration = beatMs / 4;
    const stepIndex = Math.floor((_animTime % (stepDuration * 8)) / stepDuration);

    ctx.beginPath();
    const steps = 8;
    const stepW = graphW / steps;
    for (let i = 0; i <= steps; i++) {
        const x = padding + i * stepW;
        const y = centerY + (i % 4 - 2) * (graphH / 4);
        if (i === 0) {ctx.moveTo(x, y);}
        else {ctx.lineTo(x, y);}
    }
    ctx.stroke();

    ctx.shadowBlur = 0;

    // Draw active step dot
    if (stepIndex >= 0 && stepIndex < steps) {
        const dotX = padding + (stepIndex + 0.5) * stepW;
        const dotY = centerY + (stepIndex % 4 - 2) * (graphH / 4);
        ctx.fillStyle = colors.waveform;
        ctx.shadowColor = colors.glow;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
};
