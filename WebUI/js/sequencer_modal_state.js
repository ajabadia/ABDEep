/**
 * @purpose Estado, sync UI y observer del modal del secuenciador.
 * Polling extraído a sequencer_modal_polling.js.
 * Extraído de sequencer.js como parte de la modularización.
 * @purpose_en Sequencer modal state management and UI sync.
 */

// ── Shared State ──
let _modalActiveStep = -1;
window._modalActiveStep = _modalActiveStep;
const _modalActiveSkip = false;
window._modalActiveSkip = _modalActiveSkip;
let _modalLastPolledStep = -1;
window._modalLastPolledStep = _modalLastPolledStep;

// ── Hide Modal ──
window._hideSeqModal = function() {
    const backdrop = document.getElementById('seq-modal-backdrop');
    if (!backdrop) {return;}
    backdrop.style.display = 'none';
    backdrop.classList.remove('visible-flex');
    window._stopModalPolling();
    window._clearModalActiveHighlight();
};

// ── Clear Active Highlight ──
window._clearModalActiveHighlight = function() {
    const stepsGrid = document.querySelector('.seq-steps-grid');
    if (!stepsGrid) {return;}
    for (let ci = 0; ci < 32; ci++) {
        const child = stepsGrid.children[ci];
        if (child) {
            child.style.outline = '';
            child.style.boxShadow = '';
            const numEl = child.querySelector('.seq-step-val');
            if (numEl) {numEl.style.boxShadow = '';}
            const rawEl = child.querySelector('.seq-step-raw');
            if (rawEl) {rawEl.style.color = '';}
        }
    }
    _modalActiveStep = -1;
    window._modalActiveStep = -1;
    _modalLastPolledStep = -1;
    window._modalLastPolledStep = -1;
};

// ── Sync Modal UI ──
window.syncSeqModalUI = function() {
    if (typeof window.currentActivePatchIndex === 'undefined' || window.currentActivePatchIndex === -1) {return;}
    const activeBank = window.loadedBanks && window.loadedBanks[window.currentActiveBank];
    if (!activeBank) {return;}
    const patch = activeBank[window.currentActivePatchIndex];
    if (!patch || !patch.unpackedBytes) {return;}

    const seqBox = document.getElementById('modal-seq-enable-box');
    const selectClock = document.getElementById('modal-seq-clock-select');
    const selectLength = document.getElementById('modal-seq-length-select');
    const selectKeyLoop = document.getElementById('modal-seq-keyloop-select');

    const seqEn = patch.unpackedBytes[117] > 0.5;
    const clockVal = patch.unpackedBytes[118] || 0;
    const lengthVal = patch.unpackedBytes[119] || 0;
    const keyloopVal = patch.unpackedBytes[121] || 0;

    if (seqBox) {seqBox.classList.toggle('active', seqEn);}
    if (selectClock) {selectClock.value = Math.round(clockVal);}
    if (selectLength) {selectLength.value = Math.round(lengthVal);}
    if (selectKeyLoop) {selectKeyLoop.value = Math.round(keyloopVal);}

    const sliders = [
        { id: 'seq_swing', val: patch.unpackedBytes[120] / 25.0 },
        { id: 'seq_slew_rate', val: patch.unpackedBytes[122] / 255.0 }
    ];

    sliders.forEach(function(sliderInfo) {
        if (sliderInfo.id === 'seq_swing') {
            const txt = document.getElementById('modal-seq-swing-val');
            if (txt) {txt.innerText = Math.round(50 + sliderInfo.val * 9);}
        } else if (sliderInfo.id === 'seq_slew_rate') {
            const txt = document.getElementById('modal-seq-slew-val');
            if (txt) {txt.innerText = Math.round(sliderInfo.val * 255);}
        }

        const backdrop = document.getElementById('seq-modal-backdrop');
        if (!backdrop) {return;}
        const sliderEl = backdrop.querySelector('[data-param="' + sliderInfo.id + '"] .v-slider');
        if (sliderEl) {
            const handle = sliderEl.querySelector('.handle');
            const pos = function() {
                const rect = sliderEl.getBoundingClientRect();
                if (rect.height > 0) {
                    const handleHeight = 16;
                    const posY = (1.0 - sliderInfo.val) * (rect.height - handleHeight);
                    handle.style.top = posY + 'px';
                } else {
                    setTimeout(pos, 100);
                }
            };
            pos();
        }
    });

    for (let i = 0; i < 32; i++) {
        const rawByte = patch.unpackedBytes[123 + i];
        window.seqStepsRaw[i] = rawByte;
        window.seqStepsValues[i] = rawByte === 0 ? 0 : rawByte - 128;
        if (typeof window.updateStepVisual === 'function') {window.updateStepVisual(i);}
    }
};

// ── Update Seq Modal Mode Badge ──
window._updateSeqModalModeBadge = function() {
    const badgeEl = document.getElementById('modal-seq-mode-badge');
    if (!badgeEl) {return;}
    const bridge = window.dualMidiBridge;
    if (!bridge) {return;}
    const keyLoopNorm = bridge.parameterCache['seq_key_loop'] || 0;
    const keyLoopVal = Math.round(keyLoopNorm * 2);
    const forcedMode = bridge._seqEngine && bridge._seqEngine._forcedFreeRunning;
    let label = '', color = '';
    if (forcedMode) {
        label = 'FREE*';
        color = 'var(--accent-yellow)';
    } else if (keyLoopVal === 0) {
        label = 'FREE';
        color = 'var(--accent-green)';
    } else if (keyLoopVal === 1) {
        label = 'KEY';
        color = 'var(--accent-blue)';
    } else {
        label = 'LOOP';
        color = 'var(--accent-teal)';
    }
    let tooltip = '';
    if (label === 'FREE*') {
        tooltip = ' title="Key Sync desactivado automáticamente — no había teclas presionadas al activar SEQ"';
    }
    const cursorStyle = label === 'FREE*' ? ';cursor:help' : '';
    badgeEl.innerHTML = '<span style="color:' + color + ';font-weight:bold;border:1px solid ' + color + ';padding:0 6px;border-radius:3px;font-size:10px' + cursorStyle + '"' + tooltip + '>' + label + '</span>';
};

// ── Sync State From External ──
window.syncSeqModalUIFromState = function() {
    const backdrop = document.getElementById('seq-modal-backdrop');
    if (backdrop && backdrop.style.display !== 'none') {
        window.syncSeqModalUI();
    }
};
