/**
 * @purpose Canvas animation loop for the detail panel: LFO/ENV/VCF graph rendering,
 *           real scope drawing, and active sequencer step highlighting.
 * Extraído de panel_animations.js para SRP.
 * @classification Module/Panel/Animation
 */

let _panelAnimFrameId = null;

window._startCanvasAnimation = function() {
    const panel = document.getElementById('detail-edit-panel');
    const realScopeScreenEl = document.getElementById('panel-real-scope-screen');
    const state = window.panelEditState;
    if (_panelAnimFrameId) {return;}
    state._animTime = 0;
    const lastFrameTime = { value: 0 };

    function _loop(timestamp) {
        if (!panel.classList.contains('active')) {
            _panelAnimFrameId = null;
            return;
        }
        const dt = Math.min(50, timestamp - lastFrameTime.value);
        lastFrameTime.value = timestamp;
        state._animTime += dt;
        if (state._animTime > 60000) {state._animTime = state._animTime % 60000;}

        if (typeof window.drawPanelGraphic === 'function') {
            window.drawPanelGraphic();
        }
        // Highlight active sequencer step
        if (state.currentPanelMode === 'SEQ' && window.dualMidiBridge && window.dualMidiBridge._seqEngine) {
            _highlightSeqStep();
        }
        _panelAnimFrameId = requestAnimationFrame(_loop);
    }
    _panelAnimFrameId = requestAnimationFrame(_loop);
};

// Bucle global continuo a 60 FPS para la pantalla central del Programmer
(function() {
    let progFrameId = null;
    function _progLoop() {
        const bridge = window.dualMidiBridge;
        if (bridge && bridge.isJuce && typeof bridge.getAudioWaveform === 'function') {
            bridge.getAudioWaveform().catch(function() {});
        }
        const progToggle = window.programmerDisplayToggle;
        if (progToggle && progToggle.mode !== 'sysex') {
            if (typeof window.drawRealScope === 'function') {
                window.drawRealScope('programmer-scope-canvas');
            }
        }
        progFrameId = requestAnimationFrame(_progLoop);
    }
    document.addEventListener('DOMContentLoaded', () => {
        progFrameId = requestAnimationFrame(_progLoop);
    });
})();

function _highlightSeqStep() {
    const seqEngine = window.dualMidiBridge._seqEngine;
    if (!seqEngine.running) {
        _clearSeqHighlights();
        return;
    }
    const curStep = window.dualMidiBridge.parameterCache['seq_current_step'];
    if (typeof curStep !== 'number') {return;}

    if (curStep !== window._lastHighlightedSeqStep) {
        window._lastHighlightedSeqStep = curStep;
        window._lastSeqStepChangeTime = performance.now();
    }

    const elapsed = performance.now() - (window._lastSeqStepChangeTime || 0);
    const decay = Math.max(0, 1 - elapsed / 400);
    const blurPx = Math.round(3 + decay * 9);
    const mBlurPx = Math.round(5 + decay * 11);

    _applyStepGlow('panel-seq-steps-container', curStep, blurPx);
    _applyStepGlowModal(curStep, mBlurPx);

    const ssStatus = document.getElementById('scope-seq-status');
    if (ssStatus) {
        const ssVal = window.dualMidiBridge.parameterCache['seq_current_value'];
        const ssStep = window.dualMidiBridge.parameterCache['seq_current_step'];
        const ssSkip = (window.dualMidiBridge.parameterCache['seq_current_step_skip'] || 0) > 0.5;
        const ssLen = Math.round((window.dualMidiBridge.parameterCache['seq_length'] || 0) * 31) + 2;
        if (typeof ssStep === 'number' && typeof ssVal === 'number') {
            const ssBipVal = Math.round((ssVal * 2.0 - 1.0) * 127);
            const ssRaw = Math.round(ssVal * 255);
            const ssSign = ssBipVal >= 0 ? '+' : '';
            if (ssSkip) {
                ssStatus.textContent = 'STEP ' + (ssStep + 1) + '/' + ssLen + ' SKIP';
                ssStatus.classList.remove('text-accent-pink');
                ssStatus.classList.add('status-error');
            } else {
                ssStatus.textContent = 'STEP ' + (ssStep + 1) + '/' + ssLen + ' ' + ssSign + ssBipVal + ' (r:' + ssRaw + ')';
                ssStatus.classList.remove('status-error');
                ssStatus.classList.add('text-accent-pink');
            }
        }
    }
}

function _clearSeqHighlights() {
    if (window._lastHighlightedSeqStep === -1 || window._lastHighlightedSeqStep === undefined) {return;}
    window._lastHighlightedSeqStep = -1;
    _applyStepGlow('panel-seq-steps-container', -1, 0);
    _applyStepGlowModal(-1, 0);
    const ssStatus = document.getElementById('scope-seq-status');
    if (ssStatus) {ssStatus.textContent = '';}
}

function _applyStepGlow(containerId, activeIdx, blurPx) {
    const sc2 = document.getElementById(containerId);
    if (!sc2) {return;}
    for (let hi = 0; hi < sc2.children.length; hi++) {
        const child = sc2.children[hi];
        if (child) {
            child.style.boxShadow = hi === activeIdx ? 'inset 0 0 ' + blurPx + 'px var(--accent-pink)' : 'none';
        }
    }
}

function _applyStepGlowModal(activeIdx, blurPx) {
    const modalBackdrop = document.getElementById('seq-modal-backdrop');
    if (!modalBackdrop || modalBackdrop.style.display === 'none') {return;}
    const modalGrid = document.querySelector('.seq-steps-grid');
    if (!modalGrid) {return;}
    for (let mhi = 0; mhi < modalGrid.children.length; mhi++) {
        const mChild = modalGrid.children[mhi];
        if (mChild) {
            mChild.style.boxShadow = mhi === activeIdx ? 'inset 0 0 ' + blurPx + 'px var(--accent-pink)' : 'none';
        }
    }
}

// Expose for tests (internal helpers are module-scoped)
window._panelAnimFrameId = _panelAnimFrameId;
