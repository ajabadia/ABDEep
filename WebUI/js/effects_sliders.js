/**
 * @purpose Slider drag handlers for the FX modal: send level and slot parameter sliders.
 * @purpose_en Send level and FX slot parameter vertical slider mouse drag interaction.
 */

// eslint-disable-next-line no-unused-vars -- called from initEffectsModal
function initEffectsSliders() {
    // Send level slider
    const sendLevelSlider = document.getElementById('fx-send-level-slider');
    if (sendLevelSlider) {
        const handle = sendLevelSlider.querySelector('.handle');
        if (handle) {
            let isDragging = false;

            const updateSendLevel = (clientY) => {
                const rect = sendLevelSlider.getBoundingClientRect();
                const handleHeight = 12;
                const limit = rect.height - handleHeight;
                let y = clientY - rect.top - (handleHeight / 2);
                y = Math.max(0, Math.min(limit, y));
                handle.style.top = y + 'px';

                const val = 1.0 - (y / limit);
                if (getBridge()) {
                    getBridge().setParameter('fx_send_level', val);
                }
            };

            function onSliderMove(e) {
                if (isDragging) {updateSendLevel(e.clientY);}
            }
            function onSliderEnd() {
                isDragging = false;
                window.removeEventListener('mousemove', onSliderMove);
                window.removeEventListener('mouseup', onSliderEnd);
            }
            sendLevelSlider.addEventListener('mousedown', (e) => {
                isDragging = true;
                updateSendLevel(e.clientY);
                e.preventDefault();
                e.stopPropagation();
                window.addEventListener('mousemove', onSliderMove);
                window.addEventListener('mouseup', onSliderEnd);
            });
        }
    }

    // Slot column v-sliders (individual FX parameter sliders in slot columns)
    const backdrop = document.getElementById('fx-modal-backdrop');
    if (backdrop) {
        backdrop.querySelectorAll('.fx-slot-column .v-slider').forEach(slider => {
            const ctrlUnit = slider.closest('[data-param]');
            if (!ctrlUnit) {return;}
            const paramId = ctrlUnit.getAttribute('data-param');
            const handle = slider.querySelector('.handle');

            let isDragging = false;

            const updateSliderPos = (clientY) => {
                const rect = slider.getBoundingClientRect();
                const handleHeight = 12;
                const limit = rect.height - handleHeight;
                let y = clientY - rect.top - (handleHeight / 2);
                y = Math.max(0, Math.min(limit, y));
                handle.style.top = y + 'px';

                const val = 1.0 - (y / limit);
                if (getBridge()) {
                    getBridge().setParameter(paramId, val);
                }
            };

            function onSliderMove(e) {
                if (isDragging) {updateSliderPos(e.clientY);}
            }
            function onSliderEnd() {
                isDragging = false;
                window.removeEventListener('mousemove', onSliderMove);
                window.removeEventListener('mouseup', onSliderEnd);
            }
            slider.addEventListener('mousedown', (e) => {
                isDragging = true;
                updateSliderPos(e.clientY);
                e.preventDefault();
                e.stopPropagation();
                window.addEventListener('mousemove', onSliderMove);
                window.addEventListener('mouseup', onSliderEnd);
            });
        });
    }
}
