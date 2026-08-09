/**
 * @purpose Arpeggiator Step Pattern Editor — builds and manages the 32-step interactive grid.
 * Extracted from arpeggiator.js for SRP separation.
 */

/**
 * Crea la cuadrícula interactiva de 32 pasos para el editor de patrones del arpegiador.
 * @param {HTMLElement} stepsGrid - Contenedor de las barras de paso
 * @param {HTMLElement} stepsLabels - Contenedor de las etiquetas numéricas
 * @param {Function} onStepToggle - Callback(index, newState) cuando se conmuta un paso
 * @returns {{ getSteps: () => boolean[], setSteps: (boolean[]) => void, syncVisuals: () => void }}
 */
window.createArpStepGrid = function(stepsGrid, stepsLabels, onStepToggle) {
    /** @type {boolean[]} */
    const steps = Array(32).fill(false);

    stepsGrid.innerHTML = '';
    stepsLabels.innerHTML = '';

    for (let i = 0; i < 32; i++) {
        (function(index) {
            const stepUnit = document.createElement('div');
            stepUnit.style.display = 'flex';
            stepUnit.style.flexDirection = 'column';
            stepUnit.style.justifyContent = 'flex-end';
            stepUnit.style.height = '100%';
            stepUnit.style.cursor = 'pointer';

            const stepBar = document.createElement('div');
            stepBar.style.width = '100%';
            stepBar.style.height = '15%';
            stepBar.style.background = 'var(--bg-hover)';
            stepBar.style.borderRadius = 'var(--radius-xs)';
            stepBar.style.transition = 'background 0.1s, height 0.1s';

            stepUnit.appendChild(stepBar);
            stepUnit.title = 'Step ' + (index + 1) + ': GATE OFF';

            stepUnit.addEventListener('click', function() {
                steps[index] = !steps[index];
                _updateStepVisual(index);
                if (typeof onStepToggle === 'function') {
                    onStepToggle(index, steps[index]);
                }
            });

            stepsGrid.appendChild(stepUnit);

            const label = document.createElement('span');
            label.innerText = index + 1;
            stepsLabels.appendChild(label);
        })(i);
    }

    /**
     * Actualiza la apariencia visual de un paso individual
     */
    function _updateStepVisual(index) {
        const unit = stepsGrid.children[index];
        if (!unit) { return; }
        const bar = unit.querySelector('div');
        if (!bar) { return; }
        bar.style.height = steps[index] ? '90%' : '15%';
        bar.style.background = steps[index] ? 'var(--brand-accent)' : 'var(--bg-hover)';
        unit.title = 'Step ' + (index + 1) + ': GATE ' + (steps[index] ? 'ON' : 'OFF');
    }

    /**
     * Sincroniza las 32 barras visuales con el estado actual de steps[]
     */
    function _syncAllVisuals() {
        for (let j = 0; j < 32; j++) {
            _updateStepVisual(j);
        }
    }

    return {
        /** Retorna una copia del array de pasos actual */
        getSteps: function() { return steps.slice(); },

        /** Establece un nuevo patrón de pasos y sincroniza la UI */
        setSteps: function(newSteps) {
            if (!Array.isArray(newSteps)) { return; }
            for (let k = 0; k < 32; k++) {
                steps[k] = !!(newSteps[k]);
            }
            _syncAllVisuals();
        },

        /** Refresca todas las barras visuales desde el estado actual */
        syncVisuals: function() {
            _syncAllVisuals();
        }
    };
};
