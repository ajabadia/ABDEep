/**
 * @purpose Gestor interactivo del secuenciador de control (fachada).
 * Lógica de estado y sync extraída a sequencer_modal_state.js.
 * @purpose_en Interactive manager for the Control Sequencer (facade). State/sync extracted.
 */

document.addEventListener('DOMContentLoaded', () => {
    initSequencerModal();
});

window.openSeqModal = function() {
    const backdrop = document.getElementById('seq-modal-backdrop');
    if (!backdrop) {return;}
    backdrop.style.display = 'flex';
    backdrop.classList.add('visible-flex');
    if (typeof window._updateSeqModalModeBadge === 'function') {
        window._updateSeqModalModeBadge();
    }
    if (typeof window.syncSeqModalUI === 'function') {
        window.syncSeqModalUI();
    }
    if (typeof window.syncSeqModalUIFromState === 'function') {
        window.syncSeqModalUIFromState();
    }
    if (getBridge()) {
        const curStep = getBridge().parameterCache['seq_current_step'];
        if (curStep !== undefined) {
            window._modalActiveStep = Math.round(curStep);
            window._modalActiveSkip = (getBridge().parameterCache['seq_current_step_skip'] || 0) > 0.5;
            if (typeof window.updateStepVisual === 'function') {window.updateStepVisual(window._modalActiveStep);}
        }
    }
};

document.addEventListener('click', function(e) {
    const btn = e.target.closest('#programmer-seq-btn, #panel-seq-open-modal-btn');
    if (btn) {
        e.preventDefault();
        window.openSeqModal();
    } else if (e.target.closest('#seq-modal-close-btn') || e.target.id === 'seq-modal-backdrop') {
        if (typeof window._hideSeqModal === 'function') {
            window._hideSeqModal();
        }
    }
});

function initSequencerModal() {
    const backdrop = document.getElementById('seq-modal-backdrop');
    if (!backdrop) {return;}

    // Init sub-modules
    if (typeof window.initSequencerEditor === 'function') {window.initSequencerEditor();}
    if (typeof window.initSequencerPresets === 'function') {window.initSequencerPresets();}
    if (typeof window.initSequencerCanvas === 'function') {window.initSequencerCanvas();}

    // ── Canvas Toggle ──
    document.querySelectorAll('.seq-toggle-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            const view = btn.getAttribute('data-view');
            if (typeof window._toggleSeqCanvasView === 'function') {
                window._toggleSeqCanvasView(view);
            }
        });
    });

    const seqBtn = document.getElementById('programmer-seq-btn');
    if (seqBtn) {
        seqBtn.addEventListener('click', function(e) {
            e.preventDefault();
            window.openSeqModal();
        });
    }

    const closeBtn = document.getElementById('seq-modal-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', window._hideSeqModal);
    }
    backdrop.addEventListener('click', function(e) { if (e.target === backdrop) { window._hideSeqModal(); } });

    // ── Select Handlers ──
    const seqBox = document.getElementById('modal-seq-enable-box');
    if (seqBox) {
        seqBox.addEventListener('click', function() {
            const active = seqBox.classList.contains('active');
            if (getBridge()) {getBridge().setParameter('seq_enable', active ? 0.0 : 1.0);}
        });
    }

    const selectClock = document.getElementById('modal-seq-clock-select');
    if (selectClock) {
        selectClock.addEventListener('change', function() {
            if (getBridge()) {getBridge().setParameter('seq_clock', parseInt(selectClock.value) / 15.0);}
        });
    }

    const selectLength = document.getElementById('modal-seq-length-select');
    if (selectLength) {
        selectLength.addEventListener('change', function() {
            if (getBridge()) {getBridge().setParameter('seq_length', parseInt(selectLength.value) / 31.0);}
            for (let i = 0; i < 32; i++) {
                if (typeof window.updateStepVisual === 'function') {window.updateStepVisual(i);}
            }
        });
    }

    const selectKeyLoop = document.getElementById('modal-seq-keyloop-select');
    if (selectKeyLoop) {
        selectKeyLoop.addEventListener('change', function() {
            if (getBridge()) {getBridge().setParameter('seq_key_loop', parseInt(selectKeyLoop.value) / 2.0);}
        });
    }

    // ── V-Slider Handlers ──
    backdrop.querySelectorAll('.v-slider').forEach(function(slider) {
        const ctrlUnit = slider.closest('[data-param]');
        if (!ctrlUnit) {return;}
        const paramId = ctrlUnit.getAttribute('data-param');
        const handle = slider.querySelector('.handle');
        let isDragging = false;

        function updateSliderPos(clientY) {
            const rect = slider.getBoundingClientRect();
            const handleHeight = 16;
            const limit = rect.height - handleHeight;
            let y = clientY - rect.top - (handleHeight / 2);
            y = Math.max(0, Math.min(limit, y));
            handle.style.top = y + 'px';
            const val = 1.0 - (y / limit);
            if (getBridge()) {getBridge().setParameter(paramId, val);}
        }

        function onSliderMove(e) {
            if (isDragging) {updateSliderPos(e.clientY);}
        }

        function onSliderEnd() {
            isDragging = false;
            window.removeEventListener('mousemove', onSliderMove);
            window.removeEventListener('mouseup', onSliderEnd);
        }

        slider.addEventListener('mousedown', function(e) {
            isDragging = true;
            updateSliderPos(e.clientY);
            e.preventDefault();
            window.addEventListener('mousemove', onSliderMove);
            window.addEventListener('mouseup', onSliderEnd);
        });
    });

    // ── Open Panel ──
    const openPanelBtn = document.getElementById('modal-seq-open-panel-btn');
    if (openPanelBtn) {
        openPanelBtn.addEventListener('click', function(e) {
            e.preventDefault(); e.stopPropagation();
            if (typeof window.openSeqPanel === 'function') { window.openSeqPanel(); }
        });
    }

    // ── Reset Button ──
    const resetBtn = document.getElementById('modal-seq-reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', function() {
            const bridge = getBridge();
            if (!bridge || !bridge._seqEngine) {return;}
            if (typeof window._renderSeqResetFeedback === 'function') {
                window._renderSeqResetFeedback(resetBtn, bridge);
            }
        });
    }

    // ── Observer (delegated) ──
    if (typeof window._initSeqModalObserver === 'function') {
        window._initSeqModalObserver();
    }

    // ── Real-time parameter changes ──
    if (getBridge()) {
        getBridge().onParameterChanged(function(paramId, val) {
            if (typeof window._handleSeqParamChange === 'function') {
                window._handleSeqParamChange(paramId, val, backdrop);
            }
        });
    }
}
