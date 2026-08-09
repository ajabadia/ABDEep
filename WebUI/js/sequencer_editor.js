/**
 * @purpose Generates 32-step grid sliders and manages updates to control values.
 * @purpose_en Control Sequencer interactive step editor.
 *
 * updateStepVisual() extraído a sequencer_editor_render.js
 */

const seqStepsValues = Array(32).fill(0);
window.seqStepsValues = seqStepsValues;
const seqStepsRaw = Array(32).fill(0);
window.seqStepsRaw = seqStepsRaw;

window.initSequencerEditor = function() {
    const stepsGrid = document.querySelector('.seq-steps-grid');
    const stepsLabels = document.querySelector('.seq-steps-labels');
    if (!stepsGrid || !stepsLabels) {return;}

    stepsGrid.innerHTML = '';
    stepsLabels.innerHTML = '';

    for (let i = 0; i < 32; i++) {
        const stepUnit = document.createElement('div');
        stepUnit.className = 'seq-editor-step';

        const numIndicator = document.createElement('div');
        numIndicator.className = 'seq-step-val';
        numIndicator.innerText = '0';
        stepUnit.appendChild(numIndicator);

        const rawIndicator = document.createElement('div');
        rawIndicator.className = 'seq-step-raw';
        rawIndicator.innerText = '128';
        stepUnit.appendChild(rawIndicator);

        const barContainer = document.createElement('div');
        barContainer.className = 'seq-step-bar-container';

        const zeroLine = document.createElement('div');
        zeroLine.className = 'seq-step-zero-line';
        barContainer.appendChild(zeroLine);

        const fillBar = document.createElement('div');
        fillBar.className = 'seq-step-fill-bar';
        barContainer.appendChild(fillBar);
        stepUnit.appendChild(barContainer);

        stepUnit.addEventListener('dblclick', (function(idx) {
            return function(e) {
                seqStepsValues[idx] = 0;
                seqStepsRaw[idx] = 128;
                const activeBank = window.loadedBanks[window.currentActiveBank];
                if (activeBank && window.currentActivePatchIndex !== -1) {
                    const patch = activeBank[window.currentActivePatchIndex];
                    if (patch && patch.unpackedBytes) {
                        patch.unpackedBytes[123 + idx] = 128;
                    }
                }
                if (window.dualMidiBridge) {
                    window.dualMidiBridge.setParameter('seq_step_' + (idx + 1), 0.5);
                }
                window.updateStepVisual(idx);
                e.preventDefault();
                e.stopPropagation();
            };
        })(i));

        let isEditing = false;
        
        const updateValFromY = (clientY) => {
            const rect = barContainer.getBoundingClientRect();
            const height = rect.height;
            let relY = (clientY - rect.top) / height;
            relY = Math.max(0, Math.min(1, relY));
            const normVal = 1.0 - relY;
            let bipolarVal = Math.round((normVal * 255) - 128);
            
            if (Math.abs(bipolarVal) <= 2) {bipolarVal = 0;}
            
            seqStepsValues[i] = bipolarVal;
            const rawByte = bipolarVal + 128;
            seqStepsRaw[i] = Math.max(0, Math.min(255, rawByte));
            
            const activeBank = window.loadedBanks[window.currentActiveBank];
            if (activeBank && window.currentActivePatchIndex !== -1) {
                const patch = activeBank[window.currentActivePatchIndex];
                if (patch && patch.unpackedBytes) {
                    patch.unpackedBytes[123 + i] = seqStepsRaw[i];
                }
            }
            
            const normalized = Math.max(0, Math.min(1, seqStepsRaw[i] / 255.0));
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter(`seq_step_${i + 1}`, normalized);
            }
            
            window.updateStepVisual(i);

            const lcdText = document.getElementById('lcd-text');
            if (lcdText) {
                lcdText.innerHTML = `<span class="lcd-label">CONTROL SEQ</span><br><strong>STEP ${i+1} VALUE</strong><br><span class="seq-lcd-value">${bipolarVal}</span>`;
                if (typeof window.setLcdParamDisplayTimer === 'function') {window.setLcdParamDisplayTimer(lcdText);}
            }
        };

        function onStepMove(e) {
            if (isEditing) {updateValFromY(e.clientY);}
        }
        function onStepEnd() {
            isEditing = false;
            window.removeEventListener('mousemove', onStepMove);
            window.removeEventListener('mouseup', onStepEnd);
        }
        stepUnit.addEventListener('mouseenter', (function(idx) {
            return function() {
                const lcdText = document.getElementById('lcd-text');
                if (!lcdText) {return;}
                const v = seqStepsValues[idx];
                const r = seqStepsRaw[idx];
                const isSkip = r === 0;
                const sign = v >= 0 ? '+' : '';
                const valStr = isSkip ? 'SKIP' : sign + v;
                lcdText.innerHTML = '<span class="lcd-label">CONTROL SEQ MODAL</span><br>'
                    + '<strong>STEP ' + (idx + 1) + ' VALUE</strong><br>'
                    + '<span class="seq-lcd-value">' + valStr + ' (raw:' + r + ')</span>';
                if (typeof window.setLcdParamDisplayTimer === 'function') {window.setLcdParamDisplayTimer(lcdText);}
            };
        })(i));

        stepUnit.addEventListener('mousedown', (e) => {
            isEditing = true;
            updateValFromY(e.clientY);
            e.preventDefault();
            window.addEventListener('mousemove', onStepMove);
            window.addEventListener('mouseup', onStepEnd);
        });

        stepsGrid.appendChild(stepUnit);
        
        const label = document.createElement('span');
        label.innerText = i + 1;
        stepsLabels.appendChild(label);
    }
};

window.initSequencerCanvas = function() {
    const canvas = document.querySelector('.seq-steps-canvas');
    if (!canvas || !window.SequencerStepsCanvas) {return;}
    if (canvas._seqStepsCanvas) { canvas._seqStepsCanvas.resize(); return; }
    canvas._seqStepsCanvas = new window.SequencerStepsCanvas(canvas);
    if (typeof canvas._seqStepsCanvas.setOnChange === 'function') {
        canvas._seqStepsCanvas.setOnChange(function(stepIdx, rawVal) {
            window.seqStepsRaw[stepIdx] = rawVal;
            window.seqStepsValues[stepIdx] = rawVal === 0 ? 0 : rawVal - 128;
            if (typeof window.updateStepVisual === 'function') {window.updateStepVisual(stepIdx);}
            const bridge = window.dualMidiBridge;
            if (bridge) {
                const paramId = 'seq_step_' + (stepIdx + 1);
                bridge.setParameter(paramId, rawVal / 255.0);
            }
        });
    }
    window.syncSeqCanvasFromValues = function() {
        if (canvas._seqStepsCanvas) {canvas._seqStepsCanvas.syncFromValues();}
    };
    canvas._seqStepsCanvas.syncFromValues();
};

window.syncSeqCanvasFromValues = function() {
    const canvas = document.querySelector('.seq-steps-canvas');
    if (canvas && canvas._seqStepsCanvas) {canvas._seqStepsCanvas.syncFromValues();}
};

// Wrap updateStepVisual to also sync the canvas widget
const _origUpdateStepVisual = window.updateStepVisual;
window.updateStepVisual = function(idx) {
    if (typeof _origUpdateStepVisual === 'function') {_origUpdateStepVisual(idx);}
    const canvas = document.querySelector('.seq-steps-canvas');
    if (canvas && canvas._seqStepsCanvas) {
        canvas._seqStepsCanvas.syncFromValues();
    }
};
