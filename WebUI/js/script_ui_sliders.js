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
        let lastClientY = 0;

        const _getParamId = function (el) {
            const parent = el.closest('[data-param]');
            return parent ? parent.getAttribute('data-param') : null;
        };

        const applyPct = function (pct) {
            pct = Math.max(0, Math.min(1, pct));
            const rect = slider.getBoundingClientRect();
            const handleHeight = 16;
            const totalH = (rect.height > 0 ? rect.height : 100) - handleHeight;
            const pos = (1.0 - pct) * totalH;
            if (handle) {
                handle.style.top = pos + 'px';
            }

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

        const updateVal = function (clientY) {
            const rect = slider.getBoundingClientRect();
            const pct = 1.0 - (clientY - rect.top) / rect.height;
            applyPct(pct);
        };

        function onSliderMove(e) {
            if (!isDragging) {return;}
            if (e.shiftKey) {
                const rect = slider.getBoundingClientRect();
                const totalH = Math.max(40, rect.height || 100);
                const deltaY = lastClientY - e.clientY;
                lastClientY = e.clientY;
                const paramId = _getParamId(slider);
                const currentVal = (paramId && getBridge() && getBridge().parameterCache[paramId] !== undefined)
                    ? getBridge().parameterCache[paramId]
                    : 0.5;
                applyPct(currentVal + (deltaY / totalH) * 0.2);
            } else {
                lastClientY = e.clientY;
                updateVal(e.clientY);
            }
        }

        function onSliderEnd() {
            if (isDragging) {
                isDragging = false;
                const paramId = _getParamId(slider);
                if (paramId && getBridge() && typeof getBridge().endGesture === 'function') {
                    getBridge().endGesture(paramId);
                }
            }
            window.removeEventListener('mousemove', onSliderMove);
            window.removeEventListener('mouseup', onSliderEnd);
        }

        slider.addEventListener('mousedown', function (e) {
            isDragging = true;
            lastClientY = e.clientY;
            const paramId = _getParamId(slider);
            if (paramId && getBridge() && typeof getBridge().beginGesture === 'function') {
                getBridge().beginGesture(paramId);
            }
            if (!e.shiftKey) {
                updateVal(e.clientY);
            }
            window.addEventListener('mousemove', onSliderMove);
            window.addEventListener('mouseup', onSliderEnd);
        });

        slider.addEventListener('wheel', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const paramId = _getParamId(slider);
            if (!paramId || !getBridge()) {return;}
            const currentVal = getBridge().parameterCache[paramId] !== undefined
                ? getBridge().parameterCache[paramId]
                : 0.5;
            const step = e.shiftKey ? (1.0 / 255.0) : (4.0 / 255.0);
            const dir = e.deltaY < 0 ? 1 : -1;
            if (typeof getBridge().beginGesture === 'function') {getBridge().beginGesture(paramId);}
            applyPct(currentVal + dir * step);
            if (typeof getBridge().endGesture === 'function') {getBridge().endGesture(paramId);}
        }, { passive: false });

        slider.addEventListener('dblclick', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const paramId = _getParamId(slider);
            if (!paramId) {return;}
            const defVal = typeof window.getDefaultParamValue === 'function'
                ? window.getDefaultParamValue(paramId)
                : 0.0;
            if (getBridge() && typeof getBridge().beginGesture === 'function') {getBridge().beginGesture(paramId);}
            applyPct(defVal);
            if (getBridge() && typeof getBridge().endGesture === 'function') {getBridge().endGesture(paramId);}
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
