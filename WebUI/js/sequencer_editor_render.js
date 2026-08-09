/**
 * @purpose Sequencer Editor DOM Rendering — updates step visuals (values, bars, colors).
 * Extracted from sequencer_editor.js for SRP separation.
 */

/**
 * Actualiza la apariencia visual de un paso individual del secuenciador.
 * @param {number} index - Índice del paso (0-31)
 */
window.updateStepVisual = function(index) {
    const stepsGrid = document.querySelector('.seq-steps-grid');
    if (!stepsGrid) { return; }
    const stepUnit = stepsGrid.children[index];
    if (!stepUnit) { return; }
    const numIndicator = stepUnit.querySelector('.seq-step-val');
    const rawIndicator = stepUnit.querySelector('.seq-step-raw');
    const fillBar = stepUnit.querySelector('.seq-step-fill-bar');
    const barContainer = stepUnit.querySelector('.seq-step-bar-container');
    const val = window.seqStepsValues[index];
    const rawVal = window.seqStepsRaw[index];

    const selectLength = document.getElementById('modal-seq-length-select');
    const activeLength = selectLength ? (parseInt(selectLength.value) + 2) : 16;
    const isActive = index < activeLength;

    const rawForSkip = window.seqStepsRaw[index];
    const isSkip = (rawForSkip === 0);

    const signStr = val >= 0 ? '+' : '';
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
        if (numIndicator) { numIndicator.style.boxShadow = ''; }
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
            fillBar.style.borderTop = 'none';
            fillBar.style.outline = '1px dashed var(--color-danger)';
        } else if (val >= 0) {
            const pctUp = (val / 127) * 50;
            fillBar.style.bottom = '50%';
            fillBar.style.height = Math.max(3, pctUp) + '%';
            fillBar.style.background = isActive ? 'var(--accent-pink)' : 'color-mix(in srgb, var(--accent-pink) 20%, transparent)';
            fillBar.style.borderTop = isActive ? '2px solid #ffffff' : '2px solid var(--accent-pink)';
            fillBar.style.boxShadow = isActive ? '0 -1px 3px var(--accent-pink)' : 'none';
            fillBar.style.outline = 'none';
        } else {
            const pctDown = (Math.abs(val) / 128) * 50;
            fillBar.style.bottom = (50 - pctDown) + '%';
            fillBar.style.height = Math.max(3, pctDown) + '%';
            fillBar.style.background = isActive ? 'color-mix(in srgb, var(--accent-pink) 60%, #000)' : 'color-mix(in srgb, var(--accent-pink) 20%, #000)';
            fillBar.style.borderTop = isActive ? '2px solid var(--accent-pink)' : '1px solid var(--border)';
            fillBar.style.boxShadow = isActive ? '0 0 3px var(--accent-pink)' : 'none';
            fillBar.style.outline = 'none';
        }
    }
};
