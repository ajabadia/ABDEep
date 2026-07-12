/**
 * @purpose Generates 32-step grid sliders and manages updates to control values.
 * @purpose_en Control Sequencer interactive step editor.
 */

let seqStepsValues = Array(32).fill(0);
window.seqStepsValues = seqStepsValues;
let seqStepsRaw = Array(32).fill(0);
window.seqStepsRaw = seqStepsRaw;

window.initSequencerEditor = function() {
    const stepsGrid = document.querySelector('.seq-steps-grid');
    const stepsLabels = document.querySelector('.seq-steps-labels');
    if (!stepsGrid || !stepsLabels) return;

    stepsGrid.innerHTML = '';
    stepsLabels.innerHTML = '';

    for (let i = 0; i < 32; i++) {
        const stepUnit = document.createElement('div');
        stepUnit.style.display = 'flex';
        stepUnit.style.flexDirection = 'column';
        stepUnit.style.justifyContent = 'center';
        stepUnit.style.alignItems = 'center';
        stepUnit.style.height = '100%';
        stepUnit.style.cursor = 'ns-resize';
        stepUnit.style.position = 'relative';
        stepUnit.style.background = 'var(--bg-deepest)';
        stepUnit.style.borderLeft = '1px solid var(--border-dim)';
        stepUnit.style.transition = 'box-shadow 0.12s ease, outline 0.12s ease';
        
        const numIndicator = document.createElement('div');
        numIndicator.className = 'seq-step-val';
        numIndicator.style.fontSize = 'var(--text-xs)';
        numIndicator.style.fontWeight = 'bold';
        numIndicator.style.color = 'var(--text-secondary)';
        numIndicator.style.background = 'var(--bg-header)';
        numIndicator.style.border = '1px solid var(--border)';
        numIndicator.style.borderRadius = 'var(--radius-xs)';
        numIndicator.style.padding = '2px 4px 0 4px';
        numIndicator.style.minWidth = '20px';
        numIndicator.style.textAlign = 'center';
        numIndicator.style.lineHeight = '1.2';
        numIndicator.innerText = '0';
        stepUnit.appendChild(numIndicator);
        
        const rawIndicator = document.createElement('div');
        rawIndicator.className = 'seq-step-raw';
        rawIndicator.style.fontSize = '7px';
        rawIndicator.style.fontWeight = 'normal';
        rawIndicator.style.color = 'var(--text-faint)';
        rawIndicator.style.textAlign = 'center';
        rawIndicator.style.lineHeight = '1';
        rawIndicator.style.marginBottom = '3px';
        rawIndicator.innerText = '128';
        stepUnit.appendChild(rawIndicator);

        const barContainer = document.createElement('div');
        barContainer.className = 'seq-step-bar-container';
        barContainer.style.width = '15px';
        barContainer.style.height = '85px';
        barContainer.style.background = 'var(--bg-header)';
        barContainer.style.position = 'relative';
        barContainer.style.borderRadius = '1px';
        
        const zeroLine = document.createElement('div');
        zeroLine.style.position = 'absolute';
        zeroLine.style.left = '0';
        zeroLine.style.right = '0';
        zeroLine.style.bottom = '50%';
        zeroLine.style.height = '1px';
        zeroLine.style.background = 'rgba(255, 255, 255, 0.15)';
        zeroLine.style.zIndex = '1';
        barContainer.appendChild(zeroLine);
        
        const fillBar = document.createElement('div');
        fillBar.className = 'seq-step-fill-bar';
        fillBar.style.width = '100%';
        fillBar.style.position = 'absolute';
        fillBar.style.background = 'var(--brand-accent)';
        fillBar.style.bottom = '50%';
        fillBar.style.height = '0%';
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
                updateStepVisual(idx);
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
            
            if (Math.abs(bipolarVal) <= 2) bipolarVal = 0;
            
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
            
            updateStepVisual(i);

            const lcdText = document.getElementById('lcd-text');
            if (lcdText) {
                lcdText.innerHTML = `<span style="font-size:10px; opacity:0.6;">CONTROL SEQ</span><br><strong>STEP ${i+1} VALUE</strong><br><span style="font-size:15px; color:var(--accent-pink);">${bipolarVal}</span>`;
                if (typeof window.setLcdParamDisplayTimer === 'function') window.setLcdParamDisplayTimer(lcdText);
            }
        };

        function onStepMove(e) {
            if (isEditing) updateValFromY(e.clientY);
        }
        function onStepEnd() {
            isEditing = false;
            window.removeEventListener('mousemove', onStepMove);
            window.removeEventListener('mouseup', onStepEnd);
        }
        stepUnit.addEventListener('mouseenter', (function(idx) {
            return function() {
                var lcdText = document.getElementById('lcd-text');
                if (!lcdText) return;
                var v = seqStepsValues[idx];
                var r = seqStepsRaw[idx];
                var isSkip = r === 0;
                var sign = v >= 0 ? '+' : '';
                var valStr = isSkip ? 'SKIP' : sign + v;
                lcdText.innerHTML = '<span style="font-size:10px; opacity:0.6;">CONTROL SEQ MODAL</span><br>'
                    + '<strong>STEP ' + (idx + 1) + ' VALUE</strong><br>'
                    + '<span style="font-size:15px; color:var(--accent-pink);">' + valStr + ' (raw:' + r + ')</span>';
                if (typeof window.setLcdParamDisplayTimer === 'function') window.setLcdParamDisplayTimer(lcdText);
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

function updateStepVisual(index) {
    const stepsGrid = document.querySelector('.seq-steps-grid');
    if (!stepsGrid) return;
    const stepUnit = stepsGrid.children[index];
    if (!stepUnit) return;
    const numIndicator = stepUnit.querySelector('.seq-step-val');
    const rawIndicator = stepUnit.querySelector('.seq-step-raw');
    const fillBar = stepUnit.querySelector('.seq-step-fill-bar');
    const barContainer = stepUnit.querySelector('.seq-step-bar-container');
    const val = seqStepsValues[index];
    const rawVal = seqStepsRaw[index];

    const selectLength = document.getElementById('modal-seq-length-select');
    const activeLength = selectLength ? (parseInt(selectLength.value) + 2) : 16;
    const isActive = index < activeLength;

    const rawForSkip = seqStepsRaw[index];
    const isSkip = (rawForSkip === 0);
    
    var signStr = val >= 0 ? '+' : '';
    stepUnit.title = isSkip 
        ? 'Step ' + (index + 1) + ': SKIP (raw: ' + rawForSkip + ')' 
        : 'Step ' + (index + 1) + ': ' + signStr + val + ' (raw: ' + rawForSkip + ')';
    
    if (numIndicator) {
        if (isSkip) {
            numIndicator.innerText = 'SKIP';
            numIndicator.style.color = 'var(--text-faint)';
            numIndicator.style.fontSize = '6px';
        } else if (val === 0) {
            numIndicator.innerText = '0';
            numIndicator.style.color = 'var(--text-dim)';
            numIndicator.style.fontSize = 'var(--text-xs)';
        } else {
            numIndicator.innerText = val > 0 ? '+' + val : String(val);
            numIndicator.style.color = isActive ? 'var(--brand-accent)' : 'var(--text-faint)';
            numIndicator.style.fontSize = 'var(--text-xs)';
        }
        numIndicator.style.background = isActive ? 'var(--bg-header)' : 'var(--bg-surface)';
        numIndicator.style.borderColor = isActive ? (isSkip ? 'var(--color-danger)' : 'var(--brand-accent)') : 'var(--border-dim)';
        numIndicator.style.opacity = isActive ? '1.0' : '0.4';
    }

    if (rawIndicator) {
        rawIndicator.innerText = isSkip ? '--' : String(rawVal);
        rawIndicator.style.color = isSkip ? 'var(--color-danger)' : (isActive ? 'var(--text-dim)' : 'var(--text-faint)');
        rawIndicator.style.opacity = isActive ? '0.8' : '0.3';
    }

    if (stepUnit) {
        stepUnit.style.background = isSkip ? 'rgba(255,0,0,0.05)' : (isActive ? 'var(--bg-surface)' : 'var(--bg-deepest)');
    }

    if (index === window._modalActiveStep) {
        stepUnit.style.outline = window._modalActiveSkip
            ? '1px dashed var(--color-danger)'
            : '1.5px solid var(--accent-pink)';
        stepUnit.style.boxShadow = window._modalActiveSkip
            ? '0 0 4px rgba(255,0,0,0.3)'
            : '0 0 8px color-mix(in srgb, var(--accent-pink) 40%, transparent)';
        if (numIndicator) {
            numIndicator.style.borderColor = window._modalActiveSkip ? 'var(--color-danger)' : 'var(--accent-pink)';
            numIndicator.style.boxShadow = '0 0 4px var(--accent-pink)';
        }
    } else {
        stepUnit.style.outline = '';
        stepUnit.style.boxShadow = '';
        if (numIndicator) numIndicator.style.boxShadow = '';
    }

    if (barContainer) {
        barContainer.style.background = isActive ? 'var(--bg-header)' : 'var(--bg-surface)';
    }

    if (fillBar) {
        if (isSkip) {
            fillBar.style.bottom = '50%';
            fillBar.style.height = '0%';
            fillBar.style.background = 'transparent';
            fillBar.style.borderLeft = 'none';
            fillBar.style.outline = '1px dashed var(--color-danger)';
        } else if (val >= 0) {
            const pct = (val / 127) * 50;
            fillBar.style.bottom = '50%';
            fillBar.style.height = pct + '%';
            fillBar.style.background = isActive ? 'var(--accent-pink)' : 'color-mix(in srgb, var(--accent-pink) 20%, transparent)';
            fillBar.style.outline = 'none';
        } else {
            const pct = (Math.abs(val) / 128) * 50;
            fillBar.style.bottom = (50 - pct) + '%';
            fillBar.style.height = pct + '%';
            fillBar.style.background = isActive ? 'color-mix(in srgb, var(--accent-pink) 50%, #000)' : 'color-mix(in srgb, var(--accent-pink) 15%, #000)';
            fillBar.style.outline = 'none';
        }
    }
}
window.updateStepVisual = updateStepVisual;
