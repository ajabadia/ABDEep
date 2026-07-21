/**
 * @purpose Renders the real-time audio oscilloscope (DSP engine waveform) on the details panel.
 * @purpose_en Real-time DSP oscilloscope renderer.
 */

window.SCOPE_COLORS = [
    { waveform: '#ff9900',  grid: 'rgba(255,153,0,0.03)',  center: 'rgba(255,153,0,0.08)',  text: 'rgba(255,153,0,0.4)',  glow: '#ff9900',  trigger: 'rgba(255,153,0,0.15)', name: 'Brand' },
    { waveform: '#00ff66',  grid: 'rgba(0,255,102,0.03)',  center: 'rgba(0,255,102,0.08)',  text: 'rgba(0,255,102,0.4)',  glow: '#00ff66',  trigger: 'rgba(0,255,102,0.15)', name: 'CRT Green' },
    { waveform: '#00ccff',  grid: 'rgba(0,204,255,0.03)',  center: 'rgba(0,204,255,0.08)',  text: 'rgba(0,204,255,0.4)',  glow: '#00ccff',  trigger: 'rgba(0,204,255,0.15)', name: 'Blue' },
    { waveform: '#ffb000',  grid: 'rgba(255,176,0,0.03)',  center: 'rgba(255,176,0,0.08)',  text: 'rgba(255,176,0,0.4)',  glow: '#ffb000',  trigger: 'rgba(255,176,0,0.15)', name: 'Amber' },
];

window._findTriggerPoint = function(samples, mode, edge) {
    if (mode === 0 || !samples || samples.length < 4) {return 0;}
    const threshold = 0.0;
    const searchStart = Math.floor(samples.length * 0.1);
    const searchEnd = Math.floor(samples.length * 0.8);
    for (let i = searchStart; i < searchEnd; i++) {
        const prev = samples[i - 1];
        const curr = samples[i];
        if (typeof prev !== 'number' || typeof curr !== 'number') {continue;}
        if (edge === 0) {
            if (prev <= threshold && curr > threshold) {return i;}
        } else {
            if (prev >= threshold && curr < threshold) {return i;}
        }
    }
    return -1;
};

window._getScopeColors = function() {
    const state = window.panelEditState || {};
    const idx = Math.max(0, Math.min(window.SCOPE_COLORS.length - 1, state._scopeColorScheme || 0));
    return window.SCOPE_COLORS[idx];
};

window._updateScopeToolbar = function() {
    const state = window.panelEditState || {};
    const triggerBtn = document.getElementById('scope-trigger-btn');
    if (triggerBtn) {
        const labels = ['FR', 'AT', 'NM'];
        const names = ['Free', 'Auto', 'Normal'];
        triggerBtn.textContent = labels[state._scopeTriggerMode || 0];
        triggerBtn.title = 'Trigger: ' + names[state._scopeTriggerMode || 0];
    }
    document.querySelectorAll('.scope-zoom-btn').forEach(function(btn) {
        const z = parseInt(btn.getAttribute('data-zoom'));
        btn.classList.toggle('active', z === (state._scopeZoom || 1));
    });
    const colorBtn = document.getElementById('scope-color-btn');
    if (colorBtn) {
        const colors = window._getScopeColors();
        const indicator = document.getElementById('scope-color-indicator');
        if (indicator) {
            indicator.style.color = colors.waveform;
            indicator.style.textShadow = '0 0 4px ' + colors.glow;
        }
        colorBtn.title = 'Color: ' + colors.name;
    }
};

window.drawRealScope = function() {
    const canvas = document.getElementById('panel-real-scope-canvas');
    if (!canvas) {return;}
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const bridge = window.dualMidiBridge;
    const isJuce = bridge && bridge.isJuce;
    const colors = window._getScopeColors();
    const state = window.panelEditState || {};

    function hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    }

    // Draw CRT grid background
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

    // Center line (dashed)
    ctx.strokeStyle = colors.center;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Trigger level line (only visible in Auto/Normal modes)
    if ((state._scopeTriggerMode || 0) > 0) {
        ctx.strokeStyle = colors.trigger;
        ctx.lineWidth = 1;
        ctx.setLineDash([1, 4]);
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();
        ctx.setLineDash([]);
        // Small trigger marker at left edge
        ctx.fillStyle = colors.trigger;
        ctx.font = '6px Share Tech Mono, monospace';
        ctx.fillText('\u25B6', 1, h / 2 - 1);
    }

    const hasData = bridge && bridge._lastAudioWaveform && Array.isArray(bridge._lastAudioWaveform);

    if (hasData) {
        const rawSamples = bridge._lastAudioWaveform;
        let displaySamples = rawSamples;
        let triggerIdx = 0;

        if ((state._scopeTriggerMode || 0) > 0) {
            triggerIdx = window._findTriggerPoint(rawSamples, state._scopeTriggerMode || 0, 0);
            if (triggerIdx < 0 && (state._scopeTriggerMode || 0) === 1) {
                const now = Date.now();
                if (now - (state._scopeAutoTriggerTime || 0) > 500) {
                    state._scopeAutoTriggerTime = now;
                    triggerIdx = 0;
                } else {
                    triggerIdx = 0;
                }
            } else if (triggerIdx < 0 && (state._scopeTriggerMode || 0) === 2) {
                if (state._scopeLastSamples) {
                    displaySamples = state._scopeLastSamples;
                }
                triggerIdx = 0;
            } else if (triggerIdx >= 0) {
                state._scopeAutoTriggerTime = Date.now();
            }
        }

        const zoom = Math.max(1, Math.min(4, state._scopeZoom || 1));
        const zoomLen = Math.max(32, Math.floor(displaySamples.length / zoom));
        const startIdx = Math.max(0, triggerIdx - Math.floor(zoomLen * 0.1));
        let subSamples = displaySamples.slice(startIdx, startIdx + zoomLen);
        if (subSamples.length < 4) {
            subSamples = rawSamples.slice(0, zoomLen);
        }

        state._scopeLastSamples = subSamples.slice();

        ctx.shadowColor = hexToRgba(colors.waveform, 0.4);
        ctx.shadowBlur = 4;

        ctx.strokeStyle = hexToRgba(colors.waveform, 0.85);
        ctx.lineWidth = 1.5;
        ctx.beginPath();

        const padding = 4;
        const graphW = w - padding * 2;
        const graphH = h - padding * 2;
        const centerY = h / 2;
        const len = subSamples.length;

        let firstDrawn = false;
        for (let x = 0; x < graphW; x++) {
            const sampleIdx = Math.floor((x / graphW) * len);
            const val = typeof subSamples[sampleIdx] === 'number' ? subSamples[sampleIdx] : 0;
            const clamped = Math.max(-1, Math.min(1, val));
            const canvasX = padding + x;
            const canvasY = centerY - clamped * (graphH / 2);
            if (!firstDrawn) {
                ctx.moveTo(canvasX, canvasY);
                firstDrawn = true;
            } else {
                ctx.lineTo(canvasX, canvasY);
            }
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        if ((state._scopeTriggerMode || 0) > 0 && triggerIdx > 0) {
            const trigPct = (triggerIdx - startIdx) / len;
            if (trigPct >= 0 && trigPct <= 1) {
                const trigX = padding + trigPct * graphW;
                ctx.fillStyle = hexToRgba(colors.waveform, 0.5);
                ctx.beginPath();
                ctx.arc(trigX, centerY, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        let peak = 0;
        for (let i = 0; i < subSamples.length; i++) {
            const s = Math.abs(subSamples[i]);
            if (s > peak) {peak = s;}
        }
        const db = peak < 0.0001 ? '-\u221E' : (20.0 * Math.log10(peak)).toFixed(1) + ' dB';
        ctx.fillStyle = colors.text;
        ctx.font = '7px Share Tech Mono, monospace';
        ctx.textAlign = 'right';
        ctx.fillText('PK ' + db, w - padding, padding + 8);

        // Vertical dB bar meter
        const barW = 5;
        const barX = w - padding - barW - 2;
        const barTop = padding + 14;
        const barBot = h - padding - 1;
        const barH = barBot - barTop;

        if (state._scopeSmoothPeak === undefined) {state._scopeSmoothPeak = 0;}
        state._scopeSmoothPeak += (peak - state._scopeSmoothPeak) * 0.3;
        const smoothPeak = Math.min(1, Math.max(0, state._scopeSmoothPeak));

        // Track
        ctx.fillStyle = 'rgba(102,102,102,0.15)';
        ctx.fillRect(barX, barTop, barW, barH);

        // Fill
        const fillH = smoothPeak * barH;
        const fillY = barBot - fillH;
        const barColor = smoothPeak < 0.3 ? hexToRgba(colors.waveform, 0.7)
            : smoothPeak < 0.6 ? 'rgba(255,200,0,0.8)'
            : smoothPeak < 0.85 ? 'rgba(255,120,0,0.8)'
            : 'rgba(255,30,30,0.85)';
        ctx.fillStyle = barColor;
        ctx.fillRect(barX, fillY, barW, fillH);

        // Tick marks at -12dB and -6dB
        const drawDbLine = function(dbVal) {
            const ratio = Math.pow(10, dbVal / 20);
            const lineY = barBot - ratio * barH;
            if (lineY > barTop && lineY < barBot) {
                ctx.strokeStyle = 'rgba(102,102,102,0.25)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(barX - 1, lineY);
                ctx.lineTo(barX + barW + 1, lineY);
                ctx.stroke();
            }
        };
        drawDbLine(-12);
        drawDbLine(-6);

        // Clip indicator
        const isClipping = smoothPeak >= 0.98;
        if (!state._scopeClipTimer) {state._scopeClipTimer = 0;}
        if (isClipping) {
            state._scopeClipTimer = 30;
        } else if (state._scopeClipTimer > 0) {
            state._scopeClipTimer--;
        }
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
        ctx.fillText(triggerLabel + ' ' + zoom + 'x ' + subSamples.length + 's ' + timeMs.toFixed(1) + 'ms', padding + 2, h - padding - 2);

    } else if (isJuce) {
        const padding = 10;
        ctx.fillStyle = colors.text;
        ctx.font = '8px Share Tech Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('WAITING FOR AUDIO...', w / 2, h / 2 - 4);
        ctx.font = '6px Share Tech Mono, monospace';
        ctx.fillText('Play notes to see waveform', w / 2, h / 2 + 10);
        ctx.textAlign = 'left';
    } else {
        const padding = 10;
        ctx.fillStyle = 'rgba(102,102,102,0.5)';
        ctx.font = '8px Share Tech Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('NO DSP ENGINE', w / 2, h / 2 - 4);
        ctx.font = '6px Share Tech Mono, monospace';
        ctx.fillText('(MIDI controller mode)', w / 2, h / 2 + 10);
        ctx.textAlign = 'left';
    }
};
