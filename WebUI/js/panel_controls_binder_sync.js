/**
 * @purpose Updates panel DOM controls from bridge parameter cache: sliders, selects, toggles, LED rows.
 * Extraído de panel_controls_binder.js para modularización.
 * @classification Module/Panel/Sync
 * @complexity Medium
 */

window.updatePanelFromState = function(container) {
    if (!container) {container = document.getElementById('panel-dynamic-controls');}
    if (!container || !getBridge()) {return;}

    container.querySelectorAll('.v-slider').forEach(slider => {
        const ctrlUnit = slider.closest('[data-param]');
        if (!ctrlUnit) {return;}
        const paramId = ctrlUnit.getAttribute('data-param');
        if (!paramId) {return;}
        const val = getBridge().parameterCache[paramId];
        if (val !== undefined) {
            const handle = slider.querySelector('.handle');
            if (handle) {
                const updatePos = () => {
                    const rect = slider.getBoundingClientRect();
                    if (rect.height > 0) {
                        const handleHeight = 16;
                        const pos = (1.0 - val) * (rect.height - handleHeight);
                        handle.style.top = pos + 'px';
                    } else {
                        setTimeout(updatePos, 50);
                    }
                };
                updatePos();
            }
        }
    });

    container.querySelectorAll('select[data-param]').forEach(sel => {
        const paramId = sel.getAttribute('data-param');
        const val = getBridge().parameterCache[paramId];
        if (val !== undefined) {
            const optionsCount = sel.options.length;
            sel.value = Math.round(val * (optionsCount - 1));
        }
    });

    container.querySelectorAll('.toggle-box[data-param]').forEach(box => {
        const paramId = box.getAttribute('data-param');
        const val = getBridge().parameterCache[paramId];
        if (val !== undefined) {
            if (paramId === 'vca_mode') {
                if (box.id === 'panel-vca-mode-transparent') {box.classList.toggle('active', val < 0.5);}
                if (box.id === 'panel-vca-mode-ballsy') {box.classList.toggle('active', val > 0.5);}
            } else if (paramId === 'vcf_pole_mode') {
                if (box.id === 'panel-vcf-pole-2') {box.classList.toggle('active', val < 0.5);}
                if (box.id === 'panel-vcf-pole-4') {box.classList.toggle('active', val > 0.5);}
            } else {
                box.classList.toggle('active', val > 0.5);
            }
        }
    });

    container.querySelectorAll('.shape-led-row').forEach(row => {
        let paramId = row.getAttribute('data-param');
        if (!paramId) {
            if (row.classList.contains('chord-key-led-row')) {paramId = 'chord_key';}
            if (row.classList.contains('chord-type-led-row')) {paramId = 'chord_type';}
        }
        if (!paramId) {return;}

        const val = getBridge().parameterCache[paramId];
        if (val !== undefined) {
            let maxVal = 6.0;
            if (row.hasAttribute('data-trig')) {maxVal = 4.0;}
            else if (paramId === 'note_priority') {maxVal = 2.0;}
            else if (paramId === 'trigger_mode') {maxVal = 3.0;}
            else if (paramId === 'osc1_range' || paramId === 'osc2_range') {maxVal = 2.0;}
            else if (paramId === 'osc1_pm_mode') {maxVal = 1.0;}
            else if (paramId === 'chord_key') {maxVal = 11.0;}
            else if (paramId === 'chord_type') {maxVal = 11.0;}

            const activeIndex = Math.round(val * maxVal);
            const currentIdx = parseInt(row.getAttribute('data-shape') || row.getAttribute('data-trig') || row.getAttribute('data-val') || '0');
            row.classList.toggle('active', currentIdx === activeIndex);
        }
    });

    if (typeof window.drawPanelGraphic === 'function') {
        window.drawPanelGraphic();
    }
};
