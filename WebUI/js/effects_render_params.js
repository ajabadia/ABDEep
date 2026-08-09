/**
 * @purpose Effects parameter renderer: reads FX params, generates template HTML, wires interactive controls.
 * Extracted from effects_templates.js.
 */

function renderActiveEffectParams() {
    const dynamicArea = document.getElementById('fx-dynamic-editor-area');
    const activeSlotLabel = document.getElementById('fx-screen-active-slot');
    if (!dynamicArea) {return;}

    const selectedSlot = window._selectedFxSlot || 1;
    const typeSelect = document.querySelector(`.fx-type-select[data-slot="${selectedSlot}"]`);
    if (!typeSelect) {return;}
    const effectType = parseInt(typeSelect.value);

    const offsetStart = selectedSlot === 1 ? 167 : (selectedSlot === 2 ? 180 : (selectedSlot === 3 ? 193 : 206));

    if (activeSlotLabel) {
        const offsetGain = selectedSlot === 1 ? 218 : (selectedSlot === 2 ? 219 : (selectedSlot === 3 ? 220 : 221));
        const gainVal = window._readFxParamValue(`fx${selectedSlot}_gain`, offsetGain, 1.0);
        const paramsAll = [];
        for (let p = 1; p <= 12; p++) {
            paramsAll.push(window._readFxParamValue(`fx${selectedSlot}_param${p}`, offsetStart + p - 1, 0.5));
        }
        let displayName = window.FX_TYPE_NAMES[effectType] || 'Bypass';
        if (effectType > 0 && typeof window.findMatchingFxPresetName === 'function') {
            const matchedName = window.findMatchingFxPresetName(effectType / 56.0, gainVal, paramsAll);
            if (matchedName) {
                displayName = matchedName;
            }
        }
        activeSlotLabel.innerText = `Slot: FX${selectedSlot} (${displayName})`;
    }

    const pVals = Array(8).fill(0.5);
    for (let i = 0; i < 8; i++) {
        pVals[i] = window._readFxParamValue(`fx${selectedSlot}_param${i+1}`, offsetStart + i, 0.5);
    }

    dynamicArea.innerHTML = '';
    
    if (effectType === 0) { // BYPASS
        dynamicArea.innerHTML = '<span style="color:var(--text-faint); font-size:12px; font-family:\'Share Tech Mono\', monospace; text-transform:uppercase;">Effect Bypassed</span>';
        return;
    }

    const renderer = window._getFXTemplateRenderer(effectType);
    const templateHtml = renderer(pVals, effectType, selectedSlot);
    dynamicArea.innerHTML = templateHtml;

    dynamicArea.querySelectorAll('.v-slider').forEach((slider, idx) => {
        const handle = slider.querySelector('.handle');
        let isDragging = false;
        
        const updateVal = (clientY) => {
            const rect = slider.getBoundingClientRect();
            const handleHeight = 16;
            const limit = rect.height - handleHeight;
            let y = clientY - rect.top - (handleHeight / 2);
            y = Math.max(0, Math.min(limit, y));
            handle.style.top = y + 'px';

            const val = 1.0 - (y / limit);
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter(`fx${selectedSlot}_param${idx+1}`, val);
            }
        };

        function onSliderMove(e) {
            if (isDragging) {updateVal(e.clientY);}
        }
        function onSliderEnd() {
            isDragging = false;
            window.removeEventListener('mousemove', onSliderMove);
            window.removeEventListener('mouseup', onSliderEnd);
        }
        slider.addEventListener('mousedown', (e) => {
            isDragging = true;
            updateVal(e.clientY);
            e.preventDefault();
            e.stopPropagation();
            window.addEventListener('mousemove', onSliderMove);
            window.addEventListener('mouseup', onSliderEnd);
        });
    });

    dynamicArea.querySelectorAll('.knob-ring').forEach((knob, idx) => {
        const pointer = knob.querySelector('.knob-pointer');
        let isDragging = false;
        let startY = 0;
        let startVal = 0.5;

        if (pVals && pVals[idx] !== undefined) {
            startVal = pVals[idx];
        }

        function onKnobMove(e) {
            if (!isDragging) {return;}
            const dy = startY - e.clientY;
            let val = startVal + (dy / 150.0);
            val = Math.max(0.0, Math.min(1.0, val));
            
            if (pointer) {
                pointer.style.transform = `translateX(-50%) rotate(${(val * 270) - 135}deg)`;
            }

            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter(`fx${selectedSlot}_param${idx+1}`, val);
            }
        }
        function onKnobEnd(e) {
            if (isDragging) {
                isDragging = false;
                const dy = startY - e.clientY;
                const val = startVal + (dy / 150.0);
                startVal = Math.max(0.0, Math.min(1.0, val));
            }
            window.removeEventListener('mousemove', onKnobMove);
            window.removeEventListener('mouseup', onKnobEnd);
        }
        knob.addEventListener('mousedown', (e) => {
            isDragging = true;
            startY = e.clientY;
            e.preventDefault();
            e.stopPropagation();
            window.addEventListener('mousemove', onKnobMove);
            window.addEventListener('mouseup', onKnobEnd);
        });
    });
}
window.renderActiveEffectParams = renderActiveEffectParams;
