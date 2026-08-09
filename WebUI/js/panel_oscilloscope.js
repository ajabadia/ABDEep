/**
 * @purpose Renders the real-time audio oscilloscope (DSP engine waveform + FFT spectrum)
 * on the details panel. Supports 3 view modes: WAVE (waveform only), SPC (spectrum only),
 * DUAL (split view). Core helpers in panel_oscilloscope_core.js.
 * FFT spectrum, filter overlay, and filter math extracted to
 * panel_oscilloscope_spectrum.js.
 * Waveform rendering extracted to panel_oscilloscope_waveform.js.
 * @purpose_en Real-time DSP oscilloscope + spectrum analyzer.
 */

/* global _getScopeColors, _findTriggerPoint, SCOPE_COLORS, hexToRgba, _drawWaveform, _drawPlaceholder */

window.drawRealScope = function(targetCanvasId) {
    const canvas = document.getElementById(targetCanvasId || 'programmer-scope-canvas') || document.getElementById('panel-real-scope-canvas');
    if (!canvas) {return;}

    if (canvas.clientWidth && canvas.clientHeight && (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight)) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
    }

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const bridge = window.dualMidiBridge;
    const isJuce = bridge && bridge.isJuce;
    const colors = typeof window._getScopeColors === 'function' ? window._getScopeColors()
        : { grid: 'rgba(51,51,51,0.2)', center: 'rgba(102,102,102,0.3)', trigger: 'rgba(255,200,0,0.5)', waveform: '#00ffcc', text: 'rgba(200,200,200,0.7)' };
    const state = window.panelEditState || {};
    const viewMode = state._scopeViewMode || 0; // 0=DUAL, 1=WAVE, 2=SPC

    // ── Grid ──
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    for (let gx = 0; gx < w; gx += 15) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
    for (let gy = 0; gy < h; gy += 15) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }

    // ── Divider line for DUAL mode ──
    if (viewMode === 0) {
        const splitY = Math.round(h * 0.5);
        ctx.strokeStyle = colors.center;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath(); ctx.moveTo(0, splitY); ctx.lineTo(w, splitY); ctx.stroke();
        ctx.setLineDash([]);
    }

    const hasWaveData = bridge && bridge._lastAudioWaveform && Array.isArray(bridge._lastAudioWaveform);
    const hasFreqData = bridge && bridge._lastAudioFrequencyData && Array.isArray(bridge._lastAudioFrequencyData);
    const hasAudioEngine = isJuce || (window.wasmBridge && window.wasmBridge.isAudioStarted);

    // ── Determine drawing regions ──
    let waveTop, waveBot, specTop, specBot;
    const padding = 3;

    if (viewMode === 0) {
        // DUAL: top 50% waveform, bottom 50% spectrum, 1px gap for divider at center
        const sY = Math.round(h * 0.5);
        waveTop = padding;
        waveBot = sY - 1;
        specTop = sY + 2;
        specBot = h - padding;
    } else if (viewMode === 1) {
        // WAVE only: full canvas
        waveTop = padding;
        waveBot = h - padding;
        specTop = h;
        specBot = h;
    } else {
        // SPC only: full canvas
        waveTop = h;
        waveBot = h;
        specTop = padding;
        specBot = h - padding;
    }

    // ── Draw waveform (top half or full) ──
    if (viewMode !== 2 && hasWaveData) {
        window._drawWaveform(ctx, bridge._lastAudioWaveform, waveTop, waveBot, w, colors, state, padding);
    } else if (viewMode !== 2 && hasAudioEngine) {
        window._drawPlaceholder(ctx, w, h, colors, 'WAITING FOR AUDIO...', 'Play notes to see waveform');
    }

    // ── Draw spectrum (bottom half or full) ──
    if (viewMode !== 1 && hasFreqData && typeof window._drawSpectrum === 'function') {
        window._drawSpectrum(ctx, bridge._lastAudioFrequencyData, specTop, specBot, w, colors);
    } else if (viewMode !== 1 && hasAudioEngine && !hasFreqData) {
        if (viewMode !== 0) {
            window._drawPlaceholder(ctx, w, h, colors, 'WAITING FOR AUDIO...', 'Play notes to see spectrum');
        }
    }

    // ── No engine at all ──
    if (!hasWaveData && !hasFreqData && !hasAudioEngine) {
        window._drawPlaceholder(ctx, w, h, { text: 'rgba(102,102,102,0.5)' }, 'NO DSP ENGINE', '(MIDI controller mode)');
    }
};

/**
 * _drawWaveform and _drawPlaceholder extracted to panel_oscilloscope_waveform.js
 */
