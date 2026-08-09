// WebUI/js/settings_velocity.js — Velocity curve setting + canvas preview
// Extracted from settings.js (initVelocityCurveSetting, drawVelocityCurvePreview)

function initVelocityCurveSetting() {
    const sel = document.getElementById('settings-velocity-curve');
    if (!sel) {return;}
    const saved = localStorage.getItem('abd-eep-velocity-curve') || 'normal';
    sel.value = saved;
    sel.addEventListener('change', function() {
        localStorage.setItem('abd-eep-velocity-curve', this.value);
        drawVelocityCurvePreview();
        if (getBridge()) {
            const curveMap = { 'normal': 0, 'soft': 1, 'hard': 2, 'linear': 3, 'fixed': 4 };
            const idx = curveMap[this.value];
            if (idx !== undefined) {
                getBridge().setGlobalParameter('velocity_curve', idx / 4.0);
            }
        }
    });
}

function drawVelocityCurvePreview() {
    const canvas = document.getElementById('velocity-curve-preview');
    if (!canvas) {return;}
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const padL = 4, padR = 4, padT = 3, padB = 5;
    const graphW = w - padL - padR;
    const graphH = h - padT - padB;

    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    const midX = padL + graphW / 2;
    const midY = padT + graphH / 2;
    ctx.beginPath(); ctx.moveTo(padL, midY); ctx.lineTo(padL + graphW, midY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(midX, padT); ctx.lineTo(midX, padT + graphH); ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.setLineDash([1, 3]);
    ctx.beginPath();
    ctx.moveTo(padL, padT + graphH);
    ctx.lineTo(padL + graphW, padT);
    ctx.stroke();
    ctx.setLineDash([]);

    const sel = document.getElementById('settings-velocity-curve');
    const curveType = sel ? sel.value : 'normal';

    const brandColor = getComputedStyle(document.documentElement).getPropertyValue('--brand-accent').trim() || '#ff9900';
    ctx.strokeStyle = brandColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    for (let px = 0; px <= graphW; px++) {
        const t = px / graphW;
        let y;
        switch (curveType) {
            case 'soft':   y = t * t; break;
            case 'hard':   y = Math.sqrt(t); break;
            case 'fixed':  y = 100 / 127; break;
            case 'linear':
            default:       y = t; break;
        }
        const canvasX = padL + px;
        const canvasY = padT + graphH - y * graphH;
        if (px === 0) {ctx.moveTo(canvasX, canvasY);}
        else {ctx.lineTo(canvasX, canvasY);}
    }
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '5px Share Tech Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('0', padL, h);
    ctx.fillText('127', padL + graphW, h);

    const labels = { 'normal': 'Lin', 'soft': '\u00B2', 'hard': '\u221Ax', 'linear': 'Lin', 'fixed': 'Fix' };
    ctx.fillStyle = brandColor;
    ctx.font = 'bold 6px Share Tech Mono, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(labels[curveType] || curveType, padL + graphW, padT + 6);
    ctx.textAlign = 'start';
}

// Expose for facade and tests
window.initVelocityCurveSetting = initVelocityCurveSetting;
window.drawVelocityCurvePreview = drawVelocityCurvePreview;
