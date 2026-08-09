/**
 * @purpose Sequencer render/UI sync functions — extracted from sequencer.js.
 * Handles: canvas view toggle, reset button feedback animation, real-time parameter change UI sync.
 */

/** Toggle between canvas and grid view for sequencer steps */
window._toggleSeqCanvasView = function(view) {
    const toggleBtns = document.querySelectorAll('.seq-toggle-btn');
    const seqCanvas = document.querySelector('.seq-steps-canvas');
    toggleBtns.forEach(function(b) { b.classList.remove('active'); b.style.borderColor = 'var(--border)'; });
    const activeBtn = document.querySelector('.seq-toggle-btn[data-view="' + view + '"]');
    if (activeBtn) { activeBtn.classList.add('active'); activeBtn.style.borderColor = 'var(--accent-teal)'; }
    if (view === 'canvas') {
        const grid = document.querySelector('.seq-steps-grid');
        const labels = document.querySelector('.seq-steps-labels');
        if (grid) { grid.style.display = 'none'; }
        if (labels) { labels.style.display = 'none'; }
        if (seqCanvas) {
            seqCanvas.style.display = 'block';
            if (seqCanvas._seqStepsCanvas) {
                seqCanvas._seqStepsCanvas.resize();
                seqCanvas._seqStepsCanvas.syncFromValues();
            }
        }
    } else {
        const grid = document.querySelector('.seq-steps-grid');
        const labels = document.querySelector('.seq-steps-labels');
        if (grid) { grid.style.display = 'flex'; }
        if (labels) { labels.style.display = 'flex'; }
        if (seqCanvas) { seqCanvas.style.display = 'none'; }
    }
};

/** Render reset button flash feedback animation and LCD update */
window._renderSeqResetFeedback = function(resetBtn, bridge) {
    if (!resetBtn || !bridge) {return;}
    const wasRunning = bridge._seqEngine.running;
    bridge._seqEngine.stop();
    bridge._seqEngine.stepIndex = 0;
    bridge._seqEngine.heldNotes = [];
    bridge._seqEngine._forcedFreeRunning = false;
    for (let si = 0; si < bridge._seqEngine.previousValues.length; si++) {
        bridge._seqEngine.previousValues[si] = 0;
    }
    window._clearModalActiveHighlight();

    if (wasRunning || (bridge.parameterCache['seq_enable'] || 0) > 0.5) {
        bridge._updateSeqEngine();
    }

    window._seqLastResetTime = Date.now();
    window._seqResetCount++;
    const _sNotes_ = bridge._seqEngine.heldNotes.length;
    const _sStep_ = bridge._seqEngine.stepIndex;
    const _sLen_ = Math.round((bridge.parameterCache['seq_length'] || 0) * 31) + 2;
    const _sBar_ = window._genPosBar(Math.round((_sStep_ / Math.max(_sLen_ - 1, 1)) * 18), 18);
    const _lcdText_ = document.getElementById('lcd-text');
    if (_lcdText_) {
        const _seqHtml_ = window._genLcdBarHtml('seq', {
            header: 'SEQUENCER RESET (manual) #' + window._seqResetCount,
            stepInfo: 'Step ' + _sStep_ + ' \u00B7 ' + _sNotes_ + ' notes \u00B7 ' + _sLen_ + ' steps',
            bar: _sBar_
        });
        window.lcdSafeUpdate(_lcdText_, _seqHtml_, 'seq_reset');
    }

    // Button flash animation
    resetBtn.style.transition = 'background 60ms ease-out, box-shadow 60ms ease-out';
    resetBtn.style.background = 'color-mix(in srgb, var(--color-danger) 70%, transparent)';
    resetBtn.style.boxShadow = '0 0 16px var(--color-danger)';
    resetBtn.style.borderColor = 'var(--color-danger)';
    resetBtn.style.color = 'var(--color-danger)';
    setTimeout(function() {
        resetBtn.style.transition = 'background 300ms ease-out, box-shadow 300ms ease-out, border-color 300ms ease-out, color 300ms ease-out';
        resetBtn.style.background = '';
        resetBtn.style.boxShadow = '';
        resetBtn.style.borderColor = '';
        resetBtn.style.color = '';
        setTimeout(function() { resetBtn.style.transition = ''; }, 320);
    }, 60);
};

/** Handle real-time sequencer parameter changes — UI sync only */
window._handleSeqParamChange = function(paramId, val, backdrop) {
    if (!backdrop || backdrop.style.display === 'none') {return;}

    const seqBox = document.getElementById('modal-seq-enable-box');
    const selectClock = document.getElementById('modal-seq-clock-select');
    const selectLength = document.getElementById('modal-seq-length-select');
    const selectKeyLoop = document.getElementById('modal-seq-keyloop-select');

    if (paramId === 'seq_enable' && seqBox) {
        seqBox.classList.toggle('active', val > 0.5);
        if (val < 0.5) { window._clearModalActiveHighlight(); }
        if (val > 0.5 && window.dualMidiBridge && window.dualMidiBridge._seqEngine) {
            const _sNotes_ = window.dualMidiBridge._seqEngine.heldNotes.length;
            const _sStep_ = window.dualMidiBridge._seqEngine.stepIndex;
            const _sLen_ = Math.round((window.dualMidiBridge.parameterCache['seq_length'] || 0) * 31) + 2;
            window._seqLastResetTime = Date.now();
            window._seqResetCount++;
            const _sBar_ = window._genPosBar(Math.round((_sStep_ / Math.max(_sLen_ - 1, 1)) * 18), 18);
            const _lcdText_ = document.getElementById('lcd-text');
            if (_lcdText_) {
                const _seqHtml_ = window._genLcdBarHtml('seq', {
                    header: 'SEQUENCER RESET #' + window._seqResetCount,
                    stepInfo: 'Step ' + _sStep_ + ' \u00B7 ' + _sNotes_ + ' notes \u00B7 ' + _sLen_ + ' steps',
                    bar: _sBar_
                });
                window.lcdSafeUpdate(_lcdText_, _seqHtml_, 'seq_enable');
            }
        }
    }
    if (paramId === 'seq_clock' && selectClock) {selectClock.value = Math.round(val * 15.0);}
    if (paramId === 'seq_length' && selectLength) {
        selectLength.value = Math.round(val * 31.0);
        for (let i = 0; i < 32; i++) {
            if (typeof window.updateStepVisual === 'function') {window.updateStepVisual(i);}
        }
    }
    if (paramId === 'seq_key_loop' && selectKeyLoop) {selectKeyLoop.value = Math.round(val * 2.0);}
    if (paramId && paramId.startsWith('seq_step_')) {
        const stepIdx = parseInt(paramId.split('_')[2]) - 1;
        if (stepIdx >= 0 && stepIdx < 32) {
            const rawByte = Math.round(val * 255);
            window.seqStepsRaw[stepIdx] = rawByte;
            window.seqStepsValues[stepIdx] = rawByte === 0 ? 0 : rawByte - 128;
            if (typeof window.updateStepVisual === 'function') {window.updateStepVisual(stepIdx);}
        }
        return;
    }

    if (paramId === 'seq_swing' || paramId === 'seq_slew_rate') {
        if (paramId === 'seq_swing') {
            const txt = document.getElementById('modal-seq-swing-val');
            if (txt) {txt.innerText = Math.round(50 + val * 9);}
        } else if (paramId === 'seq_slew_rate') {
            const txt = document.getElementById('modal-seq-slew-val');
            if (txt) {txt.innerText = Math.round(val * 255);}
        }
        const sliderEl = backdrop.querySelector('[data-param="' + paramId + '"] .v-slider');
        if (sliderEl) {
            const handle = sliderEl.querySelector('.handle');
            const rect = sliderEl.getBoundingClientRect();
            if (rect.height > 0) {
                const handleHeight = 16;
                const pos = (1.0 - val) * (rect.height - handleHeight);
                handle.style.top = pos + 'px';
            }
        }
    }
};
