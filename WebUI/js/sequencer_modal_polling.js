/**
 * @purpose Polling timer y MutationObserver para el modal del secuenciador.
 * Extraído de sequencer_modal_state.js como parte de la modularización.
 * @purpose_en Sequencer modal polling and observer logic.
 */

// ── Modal Polling ──
let _modalPollTimer = null;

window._startModalPolling = function() {
    window._stopModalPolling();
    const backdrop = document.getElementById('seq-modal-backdrop');
    const stepsGrid = document.querySelector('.seq-steps-grid');
    if (!backdrop || !stepsGrid) {return;}

    _modalPollTimer = setInterval(function() {
        if (backdrop.style.display === 'none') {
            window._stopModalPolling();
            return;
        }
        const bridge = window.dualMidiBridge;
        if (!bridge) {return;}

        const currentStep = bridge.parameterCache['seq_current_step'];
        const seqEn = bridge.parameterCache['seq_enable'] || 0;

        if (seqEn < 0.5) {
            if (window._modalActiveStep !== -1) {
                window._clearModalActiveHighlight();
            }
            window._modalLastPolledStep = -1;
            return;
        }

        if (currentStep === undefined || currentStep === null) {
            if (window._modalActiveStep !== -1) {
                window._clearModalActiveHighlight();
            }
            window._modalLastPolledStep = -1;
            return;
        }

        window._updateSeqModalModeBadge();

        const stepIdx = Math.round(currentStep);
        const isSkip = (bridge.parameterCache['seq_current_step_skip'] || 0) > 0.5;

        if (stepIdx !== window._modalLastPolledStep || isSkip !== window._modalActiveSkip) {
            if (window._modalActiveStep >= 0 && window._modalActiveStep < 32) {
                const prevEl = stepsGrid.children[window._modalActiveStep];
                if (prevEl) {
                    prevEl.style.outline = '';
                    prevEl.style.boxShadow = '';
                    const prevNum = prevEl.querySelector('.seq-step-val');
                    if (prevNum) {prevNum.style.boxShadow = '';}
                }
            }
            window._modalActiveStep = stepIdx;
            window._modalActiveSkip = isSkip;
            window._modalLastPolledStep = stepIdx;
            if (typeof window.updateStepVisual === 'function') {window.updateStepVisual(stepIdx);}
        }
    }, 100);
};

window._stopModalPolling = function() {
    if (_modalPollTimer) {
        clearInterval(_modalPollTimer);
        _modalPollTimer = null;
    }
};

window.addEventListener('beforeunload', window._stopModalPolling);

// ── Modal Observer ──
window._initSeqModalObserver = function() {
    const backdrop = document.getElementById('seq-modal-backdrop');
    if (!backdrop) {return;}
    const observer = new MutationObserver(function() {
        if (backdrop.style.display === 'flex') {
            window._clearModalActiveHighlight();
            window._startModalPolling();
        } else if (backdrop.style.display === 'none') {
            window._stopModalPolling();
            window._clearModalActiveHighlight();
        }
    });
    observer.observe(backdrop, { attributes: true, attributeFilter: ['style'] });
};
