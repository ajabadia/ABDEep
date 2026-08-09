/**
 * @purpose V-Slider interactive controls: drag handling, position update, and preset sync.
 * @purpose_en Vertical slider mouse drag, handle positioning, and ENV/LFO/OSC slider preset sync.
 */

// ── INIT SLIDERS ──
// eslint-disable-next-line no-unused-vars -- called from initUIControls
function initSliders() {
    // Sliders interactivos de faders verticales
    document.querySelectorAll('.v-slider').forEach(function (slider) {
        const handle = slider.querySelector('.handle');
        let isDragging = false;

        const _getParamId = function (el) {
            const parent = el.closest('[data-param]');
            return parent ? parent.getAttribute('data-param') : null;
        };

        const updateVal = function (clientY) {
            const rect = slider.getBoundingClientRect();
            let pct = 1.0 - (clientY - rect.top) / rect.height;
            pct = Math.max(0, Math.min(1, pct));

            const handleHeight = 16;
            const pos = (1.0 - pct) * (rect.height - handleHeight);
            handle.style.top = pos + 'px';

            const paramId = _getParamId(slider);
            if (!paramId) {return;}

            if (getBridge()) {
                getBridge().setParameter(paramId, pct);

                const midiInfo = window.MIDI_NRPN_MAP && window.MIDI_NRPN_MAP[paramId]
                    ? window.MIDI_NRPN_MAP[paramId]
                    : 'MIDI CONTROLLER';

                const lcdText = document.getElementById('lcd-text');
                if (lcdText) {
                    const displayVal = typeof window.formatParamValue === 'function'
                        ? window.formatParamValue(paramId, pct)
                        : pct.toFixed(2);
                    const html = '<span class="lcd-label">' + midiInfo + '</span><br><strong>' + paramId.toUpperCase() + '</strong><br><span class="lcd-value">' + displayVal + '</span>';
                    if (typeof window.lcdFadeUpdate === 'function') {
                        window.lcdFadeUpdate(lcdText, html, paramId);
                    }
                }
            }
        };

        function onSliderMove(e) {
            if (isDragging) {
                updateVal(e.clientY);
            }
        }

        function onSliderEnd() {
            isDragging = false;
            window.removeEventListener('mousemove', onSliderMove);
            window.removeEventListener('mouseup', onSliderEnd);
        }

        slider.addEventListener('mousedown', function (e) {
            isDragging = true;
            updateVal(e.clientY);
            window.addEventListener('mousemove', onSliderMove);
            window.addEventListener('mouseup', onSliderEnd);
        });
    });
}

// ── SLIDER POSITION UPDATE ──
function updateSliderPosition(sliderUnit, val) {
    if (!sliderUnit) {return;}
    const handle = sliderUnit.querySelector('.handle');
    if (!handle) {return;}
    const rect = sliderUnit.getBoundingClientRect();
    const height = rect.height > 0 ? rect.height : (sliderUnit.clientHeight > 0 ? sliderUnit.clientHeight : 100);
    const handleHeight = 16;
    const pos = (1.0 - val) * (height - handleHeight);
    handle.style.top = pos + 'px';
}

window.updateEnvSlidersFromCurrentPreset = function () {
    if (!getBridge()) {return;}
    const cache = getBridge().parameterCache;
    const ids = ['env-ctrl-attack', 'env-ctrl-decay', 'env-ctrl-sustain', 'env-ctrl-release'];
    ids.forEach(function (id) {
        const el = document.getElementById(id);
        if (!el) {return;}
        const paramId = el.getAttribute('data-param');
        if (!paramId) {return;}
        const val = cache[paramId] !== undefined ? cache[paramId] : 0.0;
        updateSliderPosition(el.querySelector('.v-slider'), val);
    });
};

window.updateLfoSlidersFromCurrentPreset = function () {
    if (!getBridge()) {return;}
    const cache = getBridge().parameterCache;
    const ids = ['lfo-ctrl-rate', 'lfo-ctrl-delay'];
    ids.forEach(function (id) {
        const el = document.getElementById(id);
        if (!el) {return;}
        const paramId = el.getAttribute('data-param');
        if (!paramId) {return;}
        const val = cache[paramId] !== undefined ? cache[paramId] : 0.0;
        updateSliderPosition(el.querySelector('.v-slider'), val);
    });
};

window.updateOscSlidersFromCurrentPreset = function () {
    if (!getBridge()) {return;}
    const cache = getBridge().parameterCache;
    const ids = ['osc-ctrl-pitchmod', 'osc-ctrl-pwm-tone', 'osc-ctrl-pitch', 'osc-ctrl-level'];
    ids.forEach(function (id) {
        const el = document.getElementById(id);
        if (!el) {return;}
        const paramId = el.getAttribute('data-param');
        if (!paramId) {return;}
        const val = cache[paramId] !== undefined ? cache[paramId] : 0.0;
        updateSliderPosition(el.querySelector('.v-slider'), val);
    });
};
