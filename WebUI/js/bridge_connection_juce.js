// eslint-disable-next-line no-var
var Logger = globalThis.Logger || console;

/**
 * @purpose JUCE bridge wrapper methods for DualMidiBridge (extracted from bridge-connection.js)
 * @classification Module/Connection/JUCE
 * @complexity Low
 */

(function() {
    if (typeof DualMidiBridge === 'undefined') {
        Logger.warn('[Bridge-Connection-JUCE] DualMidiBridge not found — deferring...');
        return;
    }

    DualMidiBridge.prototype.getVoiceState = async function() {
        if (this.isJuce && window.juce && typeof window.juce.getVoiceState === 'function') {
            return await window.juce.getVoiceState();
        }
        return null;
    };

    DualMidiBridge.prototype.getAudioWaveform = async function() {
        if (this.isJuce && window.juce && typeof window.juce.getAudioWaveform === 'function') {
            const res = await window.juce.getAudioWaveform();
            if (res && Array.isArray(res)) {
                this._lastAudioWaveform = res;
                if (typeof window._computeFrequencyDataFromWaveform === 'function') {
                    this._lastAudioFrequencyData = window._computeFrequencyDataFromWaveform(res);
                }
            }
            return res;
        }
        return null;
    };

    DualMidiBridge.prototype.getDiagnosticSnapshot = async function() {
        if (this.isJuce && window.juce && typeof window.juce.getDiagnosticSnapshot === 'function') {
            return await window.juce.getDiagnosticSnapshot();
        }
        return null;
    };

    DualMidiBridge.prototype.getCalibration = function(callback) {
        if (this.isJuce && window.juce && typeof window.juce.getCalibration === 'function') {
            window.juce.getCalibration().then(function(json) { callback(json); }).catch(function() { callback(null); });
        } else {
            callback(null);
        }
    };

    DualMidiBridge.prototype.setCalibration = function(jsonString, callback) {
        if (this.isJuce && window.juce && typeof window.juce.setCalibration === 'function') {
            window.juce.setCalibration(jsonString).then(function(ok) { callback(ok); }).catch(function() { callback(false); });
        } else {
            callback(false);
        }
    };

    DualMidiBridge.prototype.startAudioABRun = async function(configJson, snapshotJson) {
        if (this.isJuce && window.juce && typeof window.juce.startAudioABRun === 'function') {
            return await window.juce.startAudioABRun(configJson, snapshotJson);
        }
        return { ok: false, error: 'Bridge not running under JUCE/WebView2' };
    };

    DualMidiBridge.prototype.renderAudioABSoftwareReference = async function() {
        if (this.isJuce && window.juce && typeof window.juce.renderAudioABSoftwareReference === 'function') {
            return await window.juce.renderAudioABSoftwareReference();
        }
        return { ok: false, error: 'Bridge not running under JUCE/WebView2' };
    };

    DualMidiBridge.prototype.finishAudioABRun = async function() {
        if (this.isJuce && window.juce && typeof window.juce.finishAudioABRun === 'function') {
            return await window.juce.finishAudioABRun();
        }
        return { ok: false, error: 'Bridge not running under JUCE/WebView2' };
    };

    DualMidiBridge.prototype.abortAudioABRun = async function() {
        if (this.isJuce && window.juce && typeof window.juce.abortAudioABRun === 'function') {
            return await window.juce.abortAudioABRun();
        }
        return { ok: false, error: 'Bridge not running under JUCE/WebView2' };
    };

    DualMidiBridge.prototype.compareAudioABRun = async function(refWavPath, capWavPath, configJson, contextJson) {
        if (this.isJuce && window.juce && typeof window.juce.compareAudioABRun === 'function') {
            return await window.juce.compareAudioABRun(refWavPath, capWavPath, configJson, contextJson);
        }
        return { status: 'error', reason_code: 'WAV_MISSING', errors: ['Bridge not running under JUCE/WebView2'] };
    };

    DualMidiBridge.prototype.runRoundTripValidator = async function(unpackedBytesJson) {
        if (this.isJuce && window.juce && typeof window.juce.runRoundTripValidator === 'function') {
            return await window.juce.runRoundTripValidator(unpackedBytesJson);
        }
        return null;
    };

    Logger.log('[Bridge] JUCE bridge module loaded');
})();
