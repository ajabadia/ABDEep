/**
 * @purpose ADSR envelope graph drawer (ENV / VCA modes).
 * Extracted from panel_graphics_shapes.js.
 */

/** Draw ADSR envelope curve with VCA mode overlay if applicable */
window._drawEnvGraph = function(ctx, w, h, colors, cache, state) {
    const currentPanelMode = state.currentPanelMode || 'ENV';
    const panelActiveEnv = state.panelActiveEnv || 1;
    const envNum = currentPanelMode === 'VCA' ? 1 : panelActiveEnv;
    const prefix = 'env' + envNum + '_';

    const a = typeof cache[prefix + 'attack'] !== 'undefined' ? cache[prefix + 'attack'] : 0.2;
    const d = typeof cache[prefix + 'decay'] !== 'undefined' ? cache[prefix + 'decay'] : 0.35;
    const s = typeof cache[prefix + 'sustain'] !== 'undefined' ? cache[prefix + 'sustain'] : 0.55;
    const r = typeof cache[prefix + 'release'] !== 'undefined' ? cache[prefix + 'release'] : 0.4;

    const aCurve = typeof cache[prefix + 'attack_curve'] !== 'undefined' ? (cache[prefix + 'attack_curve'] * 2.0 - 1.0) : 0.0;
    const dCurve = typeof cache[prefix + 'decay_curve'] !== 'undefined' ? (cache[prefix + 'decay_curve'] * 2.0 - 1.0) : 0.0;
    const rCurve = typeof cache[prefix + 'release_curve'] !== 'undefined' ? (cache[prefix + 'release_curve'] * 2.0 - 1.0) : 0.0;

    const padding = 10;
    const graphW = w - padding * 2;
    const graphH = h - padding * 2;
    const startX = padding;
    const startY = h - padding;

    let envAmp = 1.0;
    let baseOffset = 0.0;
    let isBallsy = false;

    if (currentPanelMode === 'VCA') {
        const vcaLvl = typeof cache['vca_level'] !== 'undefined' ? cache['vca_level'] : 0.5;
        const vcaEnvDepth = typeof cache['vca_env_depth'] !== 'undefined' ? cache['vca_env_depth'] : 0.5;
        const vcaModeVal = typeof cache['vca_mode'] !== 'undefined' ? cache['vca_mode'] : 0.0;

        envAmp = vcaEnvDepth;
        baseOffset = vcaLvl;
        isBallsy = vcaModeVal > 0.5;
    }

    const getY = (val) => {
        const norm = baseOffset + val * envAmp;
        const clamped = Math.max(0.0, Math.min(1.0, norm));
        return startY - clamped * graphH * 0.9;
    };

    const totalTime = a + d + 0.7 + r;
    const aW = Math.max(4, (a / totalTime) * graphW);
    const dW = Math.max(4, (d / totalTime) * graphW);
    const sW = Math.max(8, (0.7 / totalTime) * graphW);
    const rW = Math.max(4, (r / totalTime) * graphW);

    const p0 = [startX, getY(0.0)];
    const p1 = [startX + aW, getY(1.0)];
    const p2 = [p1[0] + dW, getY(s)];
    const p3 = [p2[0] + sW, p2[1]];
    const p4 = [p3[0] + rW, getY(0.0)];

    // Fill under curve
    ctx.fillStyle = window.pgHexToRgba(colors.waveform, 0.05);
    ctx.beginPath();
    ctx.moveTo(p0[0], p0[1]);
    for (let i = 0; i <= 20; i++) {
        const t = window.pgApplyCurve(i / 20, aCurve);
        ctx.lineTo(p0[0] + (p1[0] - p0[0]) * (i / 20), p0[1] + (p1[1] - p0[1]) * t);
    }
    for (let i = 0; i <= 20; i++) {
        const t = window.pgApplyCurve(i / 20, dCurve);
        ctx.lineTo(p1[0] + (p2[0] - p1[0]) * (i / 20), p1[1] + (p2[1] - p1[1]) * t);
    }
    ctx.lineTo(p3[0], p3[1]);
    for (let i = 0; i <= 20; i++) {
        const t = window.pgApplyCurve(i / 20, rCurve);
        ctx.lineTo(p3[0] + (p4[0] - p3[0]) * (i / 20), p3[1] + (p4[1] - p3[1]) * t);
    }
    ctx.lineTo(startX + graphW, startY);
    ctx.lineTo(startX, startY);
    ctx.fill();

    // Stroke curve
    ctx.strokeStyle = colors.waveform;
    if (currentPanelMode === 'VCA' && isBallsy) {
        ctx.shadowColor = colors.glow;
        ctx.shadowBlur = 8;
        ctx.lineWidth = 3;
    } else {
        ctx.shadowColor = window.pgHexToRgba(colors.waveform, 0.4);
        ctx.shadowBlur = 4;
        ctx.lineWidth = 2;
    }

    ctx.beginPath();
    ctx.moveTo(p0[0], p0[1]);
    for (let i = 0; i <= 20; i++) {
        const t = window.pgApplyCurve(i / 20, aCurve);
        ctx.lineTo(p0[0] + (p1[0] - p0[0]) * (i / 20), p0[1] + (p1[1] - p0[1]) * t);
    }
    for (let i = 0; i <= 20; i++) {
        const t = window.pgApplyCurve(i / 20, dCurve);
        ctx.lineTo(p1[0] + (p2[0] - p1[0]) * (i / 20), p1[1] + (p2[1] - p1[1]) * t);
    }
    ctx.lineTo(p3[0], p3[1]);
    for (let i = 0; i <= 20; i++) {
        const t = window.pgApplyCurve(i / 20, rCurve);
        ctx.lineTo(p3[0] + (p4[0] - p3[0]) * (i / 20), p3[1] + (p4[1] - p3[1]) * t);
    }
    ctx.stroke();

    ctx.shadowBlur = 0;

    // Draw segment markers
    ctx.fillStyle = colors.waveform;
    [p1, p2, p3].forEach(pt => {
        ctx.beginPath();
        ctx.arc(pt[0], pt[1], 3, 0, Math.PI * 2);
        ctx.fill();
    });

    const envLabel = currentPanelMode === 'VCA'
        ? 'ENV 1 (VCA) - ' + (isBallsy ? 'Ballsy' : 'Transparent')
        : ['', 'ENV 1 VCA', 'ENV 2 VCF', 'ENV 3 MOD'][envNum] || 'ENV ' + envNum;
    ctx.fillStyle = colors.text;
    ctx.font = '7px Share Tech Mono, monospace';
    ctx.fillText(envLabel, padding + 2, padding + 8);
};
