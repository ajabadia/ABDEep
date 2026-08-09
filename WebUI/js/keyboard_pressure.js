/**
 * @purpose Aftertouch, modwheel and pitchbend pressure display on virtual keys.
 * Extracted from keyboard.js — self-contained rAF loop with closure state.
 */

/**
 * Initializes the key pressure animation loop and patches bridge methods
 * to capture voice state / waveform data.
 * Must be called after bridge is ready and keybed DOM exists.
 */
function initKeyPressureLoop() {
    const keybed = document.getElementById('ivory-keys-bed');
    if (!keybed) {return;}

    let _atPrevious = 0.0;
    let _mwPrevious = 0.0;
    let _pbPrevious = 0.0;
    let _atFramePending = false;

    function _updateKeyPressure() {
        _atFramePending = false;

        const bridge = window.dualMidiBridge;
        if (!bridge) {return;}

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
            _scheduleNextPressureFrame();
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

        _scheduleNextPressureFrame();
    }

    function _scheduleNextPressureFrame() {
        if (_atFramePending) {return;}
        _atFramePending = true;
        requestAnimationFrame(_updateKeyPressure);
    }

    _scheduleNextPressureFrame();

    // Patch bridge methods to capture voice state / waveform
    const _bridgeRef = window.dualMidiBridge;
    if (_bridgeRef) {
        _bridgeRef._lastVoiceStateRaw = null;
        if (typeof _bridgeRef.getVoiceState === 'function') {
            const origGetVoiceState = _bridgeRef.getVoiceState.bind(_bridgeRef);
            _bridgeRef.getVoiceState = async function() {
                const result = await origGetVoiceState();
                _bridgeRef._lastVoiceStateRaw = result;
                return result;
            };
        }
        
        _bridgeRef._lastAudioWaveform = null;
        if (typeof _bridgeRef.getAudioWaveform === 'function') {
            const origGetAudioWaveform = _bridgeRef.getAudioWaveform.bind(_bridgeRef);
            _bridgeRef.getAudioWaveform = async function() {
                const result = await origGetAudioWaveform();
                _bridgeRef._lastAudioWaveform = result;
                if (result && Array.isArray(result)) {
                    _bridgeRef._lastAudioFrequencyData = _computeFrequencyDataFromWaveform(result);
                }
                return result;
            };
        }
    }
}

function _computeFrequencyDataFromWaveform(samples) {
    const numBins = 256;
    const freqData = new Uint8Array(numBins);
    if (!samples || !Array.isArray(samples) || samples.length === 0) {return Array.from(freqData);}
    const N = Math.min(samples.length, 512);
    for (let k = 0; k < numBins; k++) {
        let real = 0;
        let imag = 0;
        const step = 2;
        for (let n = 0; n < N; n += step) {
            const angle = (2 * Math.PI * k * n) / N;
            real += samples[n] * Math.cos(angle);
            imag -= samples[n] * Math.sin(angle);
        }
        const mag = Math.sqrt(real * real + imag * imag) / (N / step);
        freqData[k] = Math.min(255, Math.floor(mag * 512));
    }
    return Array.from(freqData);
}

window.initKeyPressureLoop = initKeyPressureLoop;
window._computeFrequencyDataFromWaveform = _computeFrequencyDataFromWaveform;
