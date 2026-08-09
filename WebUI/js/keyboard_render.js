/**
 * @purpose Note visualization rendering for the virtual piano keybed.
 * Extracted from keyboard.js for modularity: octave buttons, ivory texture,
 * key LED color resolution, and aftertouch/modwheel/pitchbend pressure display.
 * @classification Module/Keyboard/Render
 * @lastUpdated 2026-07-25
 */

/** Update octave button visual state (color, border, glow) */
window._renderOctaveButtons = function(octUpBtn, octDownBtn, octaveShift) {
    const currentOctVal = octaveShift / 12;

    let activeColor = 'var(--color-env-vca)';
    if (Math.abs(currentOctVal) === 1) {
        activeColor = 'var(--color-env-vcf)';
    } else if (Math.abs(currentOctVal) === 2) {
        activeColor = 'var(--color-env-mod)';
    } else if (Math.abs(currentOctVal) >= 3) {
        activeColor = 'var(--color-oct-3)';
    }

    const isUpActive = currentOctVal > 0;
    const isDownActive = currentOctVal < 0;

    const applyActive = (btn) => {
        btn.style.setProperty('color', activeColor, 'important');
        btn.style.setProperty('border-color', activeColor, 'important');
        btn.style.setProperty('box-shadow', '0 0 8px ' + activeColor, 'important');
    };
    const applyInactive = (btn) => {
        btn.style.setProperty('color', 'var(--brand-accent)', 'important');
        btn.style.setProperty('border-color', 'var(--border-dim)', 'important');
        btn.style.setProperty('box-shadow', 'none', 'important');
    };

    if (octUpBtn) {
        if (isUpActive) { applyActive(octUpBtn); }
        else { applyInactive(octUpBtn); }
    }
    if (octDownBtn) {
        if (isDownActive) { applyActive(octDownBtn); }
        else { applyInactive(octDownBtn); }
    }
};

/** Apply deterministic ivory texture CSS properties to a white key */
window._applyKeyIvoryTexture = function(key, midiNote) {
    const seed = (midiNote * 12345) % 100;
    const hue = 40 + (seed % 6 - 3);
    const sat = 18 + (seed % 6);
    const light = 90 - (seed % 5);
    const dirtStart = 85 + (seed % 10);
    const dirtOpacity = 0.05 + (seed % 12) / 100.0;

    key.style.setProperty('--ivory-base', 'hsl(' + hue + ', ' + sat + '%, ' + light + '%)');
    key.style.setProperty('--ivory-top', 'hsl(' + hue + ', ' + sat + '%, ' + (light + 6) + '%)');
    key.style.setProperty('--ivory-bottom', 'hsl(' + hue + ', ' + sat + '%, ' + (light - 5) + '%)');
    key.style.setProperty('--dirt-color', 'rgba(105, 90, 75, ' + dirtOpacity + ')');
    key.style.setProperty('--dirt-start', dirtStart + '%');
};

/** Resolve key LED color based on arp/seq/chord/polyChord bridge state */
window._resolveKeyLedColor = function(bridge) {
    if (!bridge) { return 'var(--brand-accent)'; }
    const cache = bridge.parameterCache;
    if (!cache) { return 'var(--brand-accent)'; }
    const arpActive = cache['arp_enable'] > 0.5;
    const seqActive = cache['seq_enable'] > 0.5;
    const chordActive = cache['chord_enable'] > 0.5;
    const polyChordActive = cache['poly_chord_enable'] > 0.5;

    if (arpActive) { return '#ff3366'; }
    if (seqActive) { return '#9933ff'; }
    if (polyChordActive) { return '#00ffcc'; }
    if (chordActive) { return '#ffcc00'; }

    if (typeof window._getScopeColors === 'function') {
        return window._getScopeColors().waveform;
    }
    return 'var(--brand-accent)';
};

// ================================================================
// Key Pressure Display — Aftertouch / Mod Wheel / Pitch Bend
// ================================================================

(function() {
    let _atPrevious = 0.0;
    let _mwPrevious = 0.0;
    let _pbPrevious = 0.0;
    let _atFramePending = false;

    /**
     * Update CSS --pressure, --mw-pressure, --pb-offset on pushed keys.
     * Manages its own RAF scheduling. Start once after keybed exists.
     */
    function _updateKeyPressureDisplay() {
        _atFramePending = false;

        const bridge = getBridge();
        if (!bridge) { _scheduleNext(); return; }

        let aftertouch = 0.0;
        let modWheel = 0.0;
        let pitchBend = 0.0;

        if (bridge.isJuce) {
            if (bridge._lastVoiceStateRaw) {
                aftertouch = bridge._lastVoiceStateRaw.aftertouch !== undefined
                    ? bridge._lastVoiceStateRaw.aftertouch : 0.0;
                modWheel = bridge._lastVoiceStateRaw.modWheel !== undefined
                    ? bridge._lastVoiceStateRaw.modWheel : 0.0;
                pitchBend = bridge._lastVoiceStateRaw.pitchBend !== undefined
                    ? bridge._lastVoiceStateRaw.pitchBend : 0.0;
            }
        } else {
            aftertouch = (bridge.parameterCache['aftertouch'] !== undefined)
                ? bridge.parameterCache['aftertouch'] : 0.0;
            modWheel = (bridge.parameterCache['mod_wheel'] !== undefined)
                ? bridge.parameterCache['mod_wheel'] : 0.0;
        }

        aftertouch = Math.max(0, Math.min(1, aftertouch));
        modWheel = Math.max(0, Math.min(1, modWheel));
        pitchBend = Math.max(-1, Math.min(1, pitchBend));

        if (typeof window.applyControllerCurve === 'function') {
            aftertouch = window.applyControllerCurve(aftertouch, window.getControllerCurve('aftertouch'));
            modWheel = window.applyControllerCurve(modWheel, window.getControllerCurve('modwheel'));
        }
        if (typeof window.applyBipolarCurve === 'function') {
            pitchBend = window.applyBipolarCurve(pitchBend, window.getControllerCurve('pitchbend'));
        }

        if (Math.abs(aftertouch - _atPrevious) < 0.01
            && Math.abs(modWheel - _mwPrevious) < 0.01
            && Math.abs(pitchBend - _pbPrevious) < 0.01) {
            _scheduleNext();
            return;
        }
        _atPrevious = aftertouch;
        _mwPrevious = modWheel;
        _pbPrevious = pitchBend;

        const combinedPressure = Math.max(aftertouch, modWheel);
        const hasAnyPressure = combinedPressure > 0.01;
        const pressureCombinedAttr = hasAnyPressure ? combinedPressure.toFixed(3) : null;
        const mwAttr = (modWheel > 0.01) ? modWheel.toFixed(3) : null;
        const pbSensitivity = parseInt(localStorage.getItem('abd-eep-pb-sensitivity') || '6', 10);
        const pbPx = Math.round(pitchBend * pbSensitivity);
        const pbAttr = Math.abs(pitchBend) > 0.01 ? String(pbPx) : null;

        const keybed = document.getElementById('ivory-keys-bed');
        if (!keybed) { _scheduleNext(); return; }
        const pushedKeys = keybed.querySelectorAll('.key.pushed');

        for (const k of pushedKeys) {
            if (pressureCombinedAttr) {
                k.style.setProperty('--pressure', pressureCombinedAttr);
                k.style.setProperty('--mw-pressure', mwAttr || '0');
                k.classList.add('pressured');
            } else {
                k.style.removeProperty('--pressure');
                k.style.removeProperty('--mw-pressure');
                k.classList.remove('pressured');
            }
            if (pbAttr) {
                k.style.setProperty('--pb-offset', pbAttr + 'px');
                k.classList.add('pitch-bent');
            } else {
                k.style.removeProperty('--pb-offset');
                k.classList.remove('pitch-bent');
            }
        }

        _scheduleNext();
    }

    function _scheduleNext() {
        if (_atFramePending) { return; }
        _atFramePending = true;
        requestAnimationFrame(_updateKeyPressureDisplay);
    }

    /** Start the key pressure display loop. Call once after keybed exists. */
    window._startKeyPressureDisplay = function() {
        _scheduleNext();
    };
})();
