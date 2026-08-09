/**
 * @purpose Editor interactivo de pasos del secuenciador — visual sync.
 * DOM builder (initPanelSeqEditor) está en panel_seq_editor_builder.js.
 * Extraído de panel_controls_arp_seq_mod.js como parte de la modularización.
 */

// ── Global State (shared with panel_controls_arp_seq_mod.js) ──
window._panelSeqValues = new Array(32).fill(0);
window._panelSeqRaw = new Array(32).fill(128);
window._panelLastSeqStep = 0;

/**
 * Update the visual state of a single step element (fill bar, skip badge, label).
 * @param {number} idx - Step index (0-31)
 */
function _updatePanelStepVisual(idx) {
    const stepsContainer = document.getElementById('panel-seq-steps-container');
    const wraps = stepsContainer ? stepsContainer.children : [];
    if (idx < 0 || idx >= wraps.length) {return;}
    const wrap = wraps[idx];
    const val = window._panelSeqValues[idx];
    const raw = window._panelSeqRaw[idx];
    if (val === undefined || raw === undefined) {return;}
    const fillBar = wrap.querySelector('.panel-seq-fill');
    const skipBadge = wrap.querySelector('.panel-seq-skip');
    const numLabel = wrap.querySelector('.panel-seq-num');
    const lenSel = document.getElementById('panel-seq-length-select');
    const activeLen = lenSel ? (parseInt(lenSel.value) + 2) : 16;
    const isActive = idx < activeLen;
    const isSkip = raw === 0;

    const signStr = val >= 0 ? '+' : '';
    wrap.title = isSkip
        ? 'Step ' + (idx + 1) + ': SKIP (raw: ' + raw + ')'
        : 'Step ' + (idx + 1) + ': ' + signStr + val + ' (raw: ' + raw + ')';

    if (skipBadge) {skipBadge.classList.toggle('visible', isSkip);}
    if (numLabel) {
        numLabel.classList.toggle('is-active', isActive);
        numLabel.classList.toggle('is-inactive', !isActive);
    }
    wrap.classList.toggle('is-active', isActive);
    wrap.classList.toggle('is-inactive', !isActive);

    if (fillBar) {
        fillBar.classList.remove('is-skip', 'is-positive', 'is-negative');
        if (isSkip) {
            fillBar.style.height = '0%';
            fillBar.style.bottom = '50%';
            fillBar.classList.add('is-skip');
        } else if (val >= 0) {
            const pct = Math.min(50, (val / 127) * 50);
            fillBar.style.bottom = '50%';
            fillBar.style.height = pct + '%';
            fillBar.classList.add('is-positive');
        } else {
            const pct = Math.min(50, (Math.abs(val) / 128) * 50);
            fillBar.style.bottom = (50 - pct) + '%';
            fillBar.style.height = pct + '%';
            fillBar.classList.add('is-negative');
        }
    }
}
window._updatePanelStepVisual = _updatePanelStepVisual;

/**
 * Sync the panel step state from the bridge's parameter cache.
 * Called after initialization and on external parameter changes.
 */
function _syncPanelSeqFromCache() {
    const bridge = window.dualMidiBridge;
    if (!bridge) {return;}
    for (let si = 0; si < 32; si++) {
        const paramId = 'seq_step_' + (si + 1);
        const norm = bridge.parameterCache[paramId];
        if (norm !== undefined) {
            const rawByte = Math.round(norm * 255);
            window._panelSeqRaw[si] = rawByte;
            window._panelSeqValues[si] = rawByte === 0 ? 0 : rawByte - 128;
            window._updatePanelStepVisual(si);
        }
    }
}
window._syncPanelSeqFromCache = _syncPanelSeqFromCache;
// initPanelSeqEditor is called from panel_controls_arp_seq_mod.js via window.initPanelSeqEditor
