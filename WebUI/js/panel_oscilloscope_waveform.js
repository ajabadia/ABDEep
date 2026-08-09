/**
 * @purpose Waveform rendering for the real-time audio oscilloscope.
 * Extracted from panel_oscilloscope.js.
 * @purpose_en Real-time oscilloscope waveform drawing + helpers.
 */

/* global _getScopeColors, _findTriggerPoint, SCOPE_COLORS */
/* exported hexToRgba, _drawWaveform, _drawPlaceholder */

/**
 * Converts hex color string to rgba with given alpha.
 * @param {string} hex  Hex color (#ff9900)
 * @param {number} alpha  Alpha (0-1)
 * @returns {string} rgba string
 */
function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

/** Draws the time-domain waveform */
function _drawWaveform(ctx, rawSamples, top, bot, w, colors, state, padding) {
    const graphH = bot - top;
    if (graphH < 4) {return;}
    const centerY = top + graphH / 2;

    // Center line (dashed) at waveform region center
    ctx.strokeStyle = colors.center;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(0, centerY); ctx.lineTo(w, centerY); ctx.stroke();
    ctx.setLineDash([]);

    // Trigger level line (only in Auto/Normal modes)
    if ((state._scopeTriggerMode || 0) > 0) {
        ctx.strokeStyle = colors.trigger;
        ctx.lineWidth = 1;
        ctx.setLineDash([1, 4]);
        ctx.beginPath(); ctx.moveTo(0, centerY); ctx.lineTo(w, centerY); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = colors.trigger;
        ctx.font = '6px Share Tech Mono, monospace';
        ctx.fillText('\u25B6', 1, centerY - 1);
    }

    let displaySamples = rawSamples;
    let triggerIdx = 0;

    if ((state._scopeTriggerMode || 0) > 0) {
        triggerIdx = window._findTriggerPoint(rawSamples, state._scopeTriggerMode || 0, 0);
        if (triggerIdx < 0 && (state._scopeTriggerMode || 0) === 1) {
            const now = Date.now();
            if (now - (state._scopeAutoTriggerTime || 0) > 500) {
                state._scopeAutoTriggerTime = now;
                triggerIdx = 0;
            } else { triggerIdx = 0; }
        } else if (triggerIdx < 0 && (state._scopeTriggerMode || 0) === 2) {
            if (state._scopeLastSamples) {displaySamples = state._scopeLastSamples;}
            triggerIdx = 0;
        } else if (triggerIdx >= 0) {
            state._scopeAutoTriggerTime = Date.now();
        }
    }

    const zoom = Math.max(1, Math.min(4, state._scopeZoom || 1));
    const zoomLen = Math.max(32, Math.floor(displaySamples.length / zoom));
    const startIdx = Math.max(0, triggerIdx - Math.floor(zoomLen * 0.1));
    let subSamples = displaySamples.slice(startIdx, startIdx + zoomLen);
    if (subSamples.length < 4) {subSamples = rawSamples.slice(0, zoomLen);}
    state._scopeLastSamples = subSamples.slice();

    ctx.shadowColor = hexToRgba(colors.waveform, 0.4);
    ctx.shadowBlur = 4;
    ctx.strokeStyle = hexToRgba(colors.waveform, 0.85);
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    const graphW = w - padding * 2;
    const len = subSamples.length;
    let firstDrawn = false;

    for (let x = 0; x < graphW; x++) {
        const sampleIdx = Math.floor((x / graphW) * len);
        const val = typeof subSamples[sampleIdx] === 'number' ? subSamples[sampleIdx] : 0;
        const clamped = Math.max(-1, Math.min(1, val));
        const canvasX = padding + x;
        const canvasY = centerY - clamped * (graphH / 2);
        if (!firstDrawn) { ctx.moveTo(canvasX, canvasY); firstDrawn = true; }
        else { ctx.lineTo(canvasX, canvasY); }
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Trigger marker
    if ((state._scopeTriggerMode || 0) > 0 && triggerIdx > 0) {
        const trigPct = (triggerIdx - startIdx) / len;
        if (trigPct >= 0 && trigPct <= 1) {
            const trigX = padding + trigPct * graphW;
            ctx.fillStyle = hexToRgba(colors.waveform, 0.5);
            ctx.beginPath(); ctx.arc(trigX, centerY, 3, 0, Math.PI * 2); ctx.fill();
        }
    }

    // Peak + dB meter + labels
    let peak = 0;
    for (let i = 0; i < subSamples.length; i++) {
        const s = Math.abs(subSamples[i]);
        if (s > peak) {peak = s;}
    }
    const db = peak < 0.0001 ? '-\u221E' : (20.0 * Math.log10(peak)).toFixed(1) + ' dB';
    ctx.fillStyle = colors.text;
    ctx.font = '7px Share Tech Mono, monospace';
    ctx.textAlign = 'right';
    ctx.fillText('PK ' + db, w - padding, top + 8);

    // Mini dB bar
    const barW = 5;
    const barX = w - padding - barW - 2;
    const barTop = top + 14;
    const barBot = bot - 1;
    const barH = barBot - barTop;

    if (state._scopeSmoothPeak === undefined) {state._scopeSmoothPeak = 0;}
    state._scopeSmoothPeak += (peak - state._scopeSmoothPeak) * 0.3;
    const smoothPeak = Math.min(1, Math.max(0, state._scopeSmoothPeak));

    ctx.fillStyle = 'rgba(102,102,102,0.15)';
    ctx.fillRect(barX, barTop, barW, barH);

    const fillH = smoothPeak * barH;
    const fillY = barBot - fillH;
    const barColor = smoothPeak < 0.3 ? hexToRgba(colors.waveform, 0.7)
        : smoothPeak < 0.6 ? 'rgba(255,200,0,0.8)'
        : smoothPeak < 0.85 ? 'rgba(255,120,0,0.8)'
        : 'rgba(255,30,30,0.85)';
    ctx.fillStyle = barColor;
    ctx.fillRect(barX, fillY, barW, fillH);

    // Tick marks
    const drawDbLine = function(dbVal) {
        const ratio = Math.pow(10, dbVal / 20);
        const lineY = barBot - ratio * barH;
        if (lineY > barTop && lineY < barBot) {
            ctx.strokeStyle = 'rgba(102,102,102,0.25)';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(barX - 1, lineY); ctx.lineTo(barX + barW + 1, lineY); ctx.stroke();
        }
    };
    drawDbLine(-12);
    drawDbLine(-6);

    // Clip
    const isClipping = smoothPeak >= 0.98;
    if (!state._scopeClipTimer) {state._scopeClipTimer = 0;}
    if (isClipping) {state._scopeClipTimer = 30;}
    else if (state._scopeClipTimer > 0) {state._scopeClipTimer--;}
    if (state._scopeClipTimer > 0) {
        const blink = state._scopeClipTimer % 6 < 3;
        ctx.fillStyle = blink ? 'rgba(255,0,0,0.9)' : 'rgba(255,0,0,0.3)';
        ctx.font = 'bold 6px Share Tech Mono, monospace';
        ctx.textAlign = 'right';
        ctx.fillText('CLIP', w - padding, barTop - 1);
    }

    ctx.textAlign = 'left';
    const sampleRate = 44100;
    const timeMs = (subSamples.length / sampleRate) * 1000;
    const triggerLabel = ['FR', 'AT', 'NM'][state._scopeTriggerMode || 0];
    ctx.fillStyle = colors.text;
    ctx.font = '7px Share Tech Mono, monospace';
    ctx.fillText(triggerLabel + ' ' + zoom + 'x ' + subSamples.length + 's ' + timeMs.toFixed(1) + 'ms', padding + 2, bot - 2);
}

/** Draws centered placeholder text */
function _drawPlaceholder(ctx, w, h, colors, line1, line2) {
    ctx.fillStyle = colors.text;
    ctx.font = '8px Share Tech Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(line1, w / 2, h / 2 - 4);
    ctx.font = '6px Share Tech Mono, monospace';
    ctx.fillText(line2, w / 2, h / 2 + 10);
    ctx.textAlign = 'left';
}

// Expose globally
window.hexToRgba = hexToRgba;
window._drawWaveform = _drawWaveform;
window._drawPlaceholder = _drawPlaceholder;
