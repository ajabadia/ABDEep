/**
 * @purpose Módulo de control interactivo para potenciómetros giratorios (knobs), incluyendo Data Entry y Performance Knobs (Volume, Portamento).
 * @purpose_en Control module for rotary knobs, including Data Entry and Performance Knobs (Volume, Portamento).
 */

function initKnobs() {
    // CONFIGURAR TODOS LOS KNOBS GENERALES DE PERFORMANCE (Volume y Portamento)
    document.querySelectorAll('.performance-matrix-panel .ctrl-unit').forEach(knobUnit => {
        const paramId = knobUnit.getAttribute('data-param');
        const ring = knobUnit.querySelector('.knob-ring');
        const pointer = knobUnit.querySelector('.knob-pointer');
        if (!ring || !pointer) return;

        let isDragging = false;
        let startY = 0;
        let baseValue = 0.0;
        if (paramId === "global_volume") baseValue = 0.8;

        ring.addEventListener('pointerdown', (e) => {
            isDragging = true;
            startY = e.clientY;
            ring.setPointerCapture(e.pointerId);
            e.preventDefault();
        });

        ring.addEventListener('pointermove', (e) => {
            if (!isDragging) return;
            const deltaY = startY - e.clientY;
            startY = e.clientY;

            const sensitivity = 0.005;
            baseValue = Math.max(0.0, Math.min(1.0, baseValue + deltaY * sensitivity));
            const rotation = (baseValue * 270) - 135;
            pointer.style.transform = `translateX(-50%) rotate(${rotation}deg)`;

            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter(paramId, baseValue);

                const lcdText = document.getElementById('lcd-text');
                if (lcdText) {
                    lcdText.innerHTML = `<span style="font-size:10px; opacity:0.6;">PERFORMANCE</span><br><strong>${paramId.toUpperCase()}</strong><br><span style="font-size:15px; color:#ffb700;">${baseValue.toFixed(2)}</span>`;
                }
            }
        });

        ring.addEventListener('pointerup', () => {
            isDragging = false;
        });

        if (window.dualMidiBridge) {
            window.dualMidiBridge.onParameterChanged((id, val) => {
                if (id === paramId) {
                    baseValue = val;
                    const rotation = (val * 270) - 135;
                    pointer.style.transform = `translateX(-50%) rotate(${rotation}deg)`;
                }
            });
        }
    });
}

// Exportar al ámbito de window
window.initKnobs = initKnobs;
