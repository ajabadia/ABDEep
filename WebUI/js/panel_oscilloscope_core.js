/**
 * @purpose Core helpers and data for the real-time audio oscilloscope.
 * Color schemes, trigger detection, color lookup, and toolbar sync.
 * @purpose_en Oscilloscope core: colors, trigger, toolbar update.
 */

/**
 * SCOPE_COLORS — 4 color schemes for the oscilloscope display.
 * Each scheme: { waveform, grid, center, text, glow, trigger, name }
 */
window.SCOPE_COLORS = [
    { waveform: '#ff9900',  grid: 'rgba(255,153,0,0.03)',  center: 'rgba(255,153,0,0.08)',  text: 'rgba(255,153,0,0.4)',  glow: '#ff9900',  trigger: 'rgba(255,153,0,0.15)', name: 'Brand' },
    { waveform: '#00ff66',  grid: 'rgba(0,255,102,0.03)',  center: 'rgba(0,255,102,0.08)',  text: 'rgba(0,255,102,0.4)',  glow: '#00ff66',  trigger: 'rgba(0,255,102,0.15)', name: 'CRT Green' },
    { waveform: '#00ccff',  grid: 'rgba(0,204,255,0.03)',  center: 'rgba(0,204,255,0.08)',  text: 'rgba(0,204,255,0.4)',  glow: '#00ccff',  trigger: 'rgba(0,204,255,0.15)', name: 'Blue' },
    { waveform: '#ffb000',  grid: 'rgba(255,176,0,0.03)',  center: 'rgba(255,176,0,0.08)',  text: 'rgba(255,176,0,0.4)',  glow: '#ffb000',  trigger: 'rgba(255,176,0,0.15)', name: 'Amber' },
];

/**
 * Finds the first zero-crossing trigger point in a waveform sample buffer.
 * @param {number[]} samples  Audio sample buffer
 * @param {number}   mode     0=free-run, 1=auto, 2=normal
 * @param {number}   edge     0=rising (neg→pos), 1=falling (pos→neg)
 * @returns {number}          Sample index of trigger point, 0 for free-run, -1 if not found
 */
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

/**
 * Returns the current oscilloscope color scheme from panelEditState.
 * @returns {object} Color scheme object with waveform, grid, center, text, glow, trigger, name
 */
window._getScopeColors = function() {
    const state = window.panelEditState || {};
    const idx = Math.max(0, Math.min(window.SCOPE_COLORS.length - 1, state._scopeColorScheme || 0));
    return window.SCOPE_COLORS[idx];
};

/**
 * View mode labels and names for the scope view toggle.
 * 0=DUAL, 1=WAVE, 2=SPC
 */
window.SCOPE_VIEW_LABELS = ['DUAL', 'WAVE', 'SPC'];
window.SCOPE_VIEW_NAMES = ['Dual Waveform + Spectrum', 'Waveform only', 'Spectrum only'];

/**
 * Updates the oscilloscope toolbar UI elements (trigger mode button, zoom buttons,
 * color button, and view mode button).
 * Reads state from window.panelEditState.
 */
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
    // View mode toggle
    const viewBtn = document.getElementById('scope-view-btn');
    if (viewBtn) {
        const vMode = state._scopeViewMode || 0;
        viewBtn.textContent = window.SCOPE_VIEW_LABELS[vMode];
        viewBtn.title = 'View: ' + window.SCOPE_VIEW_NAMES[vMode];
        viewBtn.style.color = vMode === 0 ? 'var(--accent-green,#00ffcc)' :
            vMode === 1 ? 'var(--accent-blue,#00ccff)' : 'var(--accent-pink,#ff66aa)';
    }
};
