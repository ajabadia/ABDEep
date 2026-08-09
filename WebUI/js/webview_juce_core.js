/**
 * @purpose JUCE 8 Native Integration Core — bridges JUCE 8's event-based API
 * (window.__JUCE__.backend.emitEvent/addEventListener) to window.juce.fn() call style.
 * Core protocol: callJuceNative, promise management, native function wrappers, event listeners.
 * @purpose_en JUCE 8 Native Integration Core — protocol layer for the bridge.
 */

// ── Console originals (before any override) ──
const _juceOrigLog = console.log;
const _juceOrigErr = console.error;
const _juceOrigWarn = console.warn;

// ── Promise handler for native function calls ──
let _juceLastPromiseId = 0;
const _jucePromises = {};

// ── Registered native function names (must match C++ withNativeFunction calls) ──
const _juceNativeFunctionNames = [
    'logFromJS',
    'setParameter',
    'beginGesture',
    'endGesture',
    'getSynthState',
    'requestMidiDump',
    'readFactoryBankFile',
    'pianoNoteOn',
    'pianoNoteOff',
    'panic',
    'getVoiceState',
    'getAudioWaveform',
    'getCalibration',
    'setCalibration',
    'getDiagnosticSnapshot',
    'startAudioABRun',
    'renderAudioABSoftwareReference',
    'finishAudioABRun',
    'abortAudioABRun',
    'compareAudioABRun'
];

// ── Core: emit a native function call via JUCE 8 event protocol ──
function _juceCallNative(name, args) {
    const promiseId = _juceLastPromiseId++;
    const payload = { name: name, params: args, resultId: promiseId };

    return new Promise(function(resolve, reject) {
        _jucePromises[promiseId] = { resolve: resolve, reject: reject };

        if (window.__JUCE__ && window.__JUCE__.backend) {
            window.__JUCE__.backend.emitEvent('__juce__invoke', payload);
        } else {
            delete _jucePromises[promiseId];
            reject(new Error('JUCE backend not available'));
        }

        // Safety timeout: resolve with undefined after 5s if no response
        setTimeout(function() {
            if (_jucePromises[promiseId]) {
                _jucePromises[promiseId].resolve(undefined);
                delete _jucePromises[promiseId];
            }
        }, 5000);
    });
}

// ── Log to C++ file when possible ──
function _juceLogToNative(msg) {
    try {
        if (window.__JUCE__ && window.__JUCE__.backend && window._juceNativeFunctions && window._juceNativeFunctions.logFromJS) {
            window._juceNativeFunctions.logFromJS(msg);
        }
    } catch (e) { /* swallow */ }
}

// ── Create wrapper functions ──
(function() {
    const funcs = {};
    for (let i = 0; i < _juceNativeFunctionNames.length; i++) {
        const fnName = _juceNativeFunctionNames[i];
        funcs[fnName] = (function(fName) {
            return function() {
                return _juceCallNative(fName, Array.prototype.slice.call(arguments));
            };
        })(fnName);
    }
    window._juceNativeFunctions = funcs;
})();

// ── Set up __juce__complete listener for promise resolution ──
window._juceInstallCompleteListener = function() {
    if (window.__JUCE__ && window.__JUCE__.backend) {
        window.__JUCE__.backend.addEventListener('__juce__complete', function(data) {
            const p = _jucePromises[data.promiseId];
            if (p) {
                delete _jucePromises[data.promiseId];
                p.resolve(data.result);
            }
        });
        return true;
    }
    return false;
};

// ── Set up C++ → JS event listeners ──
window._juceInstallEventListeners = function() {
    if (!window.__JUCE__ || !window.__JUCE__.backend) { return false; }

    window.__JUCE__.backend.addEventListener('onParameterChanged', function(data) {
        if (window._bridgeInstance && typeof window._bridgeInstance.handleParameterChangeFromBackend === 'function') {
            window._bridgeInstance.handleParameterChangeFromBackend(data.id, data.value);
        }
    });
    return true;
};

// ── Create window.juce compatibility object ──
window._juceCreateCompat = function() {
    const juce = {};

    const keys = Object.keys(window._juceNativeFunctions);
    for (let i = 0; i < keys.length; i++) {
        const name = keys[i];
        juce[name] = window._juceNativeFunctions[name];
    }

    juce._onParameterChangedCallbacks = [];
    return juce;
};
