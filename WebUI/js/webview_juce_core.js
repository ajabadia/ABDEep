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
    'setPresetName',
    'requestMidiDump',
    'readFactoryBankFile',
    'pianoNoteOn',
    'pianoNoteOff',
    'panic',
    'getVoiceState',
    'getAudioWaveform',
    'getBuildInfo',
    'getCalibration',
    'setCalibration',
    'getDiagnosticSnapshot',
    'startAudioABRun',
    'renderAudioABSoftwareReference',
    'finishAudioABRun',
    'abortAudioABRun',
    'compareAudioABRun',
    'sendModulatorAudioBuffer',
    'runRoundTripValidator',
    'setMidiLearnState',
    'getMidiLearnState',
    'checkForUpdates',
    'getUpdateStatus',
    'openBrowserUrl'
];

// ── Core: emit a native function call via JUCE 8 event protocol ──
function _juceCallNative(name, args) {
    const promiseId = _juceLastPromiseId++;
    const payload = { name: name, params: args, resultId: promiseId };

    return new Promise(function(resolve, reject) {
        // Safety timeout: resolve with undefined after 5s if no response
        const timeoutId = setTimeout(function() {
            if (_jucePromises[promiseId]) {
                _jucePromises[promiseId].resolve(undefined);
                delete _jucePromises[promiseId];
            }
        }, 5000);

        _jucePromises[promiseId] = { resolve: resolve, reject: reject, timeoutId: timeoutId };

        if (window.__JUCE__ && window.__JUCE__.backend) {
            window.__JUCE__.backend.emitEvent('__juce__invoke', payload);
        } else {
            clearTimeout(timeoutId);
            delete _jucePromises[promiseId];
            reject(new Error('JUCE backend not available'));
        }
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
                if (p.timeoutId) {
                    clearTimeout(p.timeoutId);
                }
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

    window.__JUCE__.backend.addEventListener('updateCheckResult', function(data) {
        if (typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
            window.dispatchEvent(new CustomEvent('updateCheckResult', { detail: data }));
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

// ── Canonical backend adapter for @abdsynths/shared components (AboutDialog / AutoUpdater) ──
window.getJuceBackend = function() {
    const hasNativeBackend = Boolean(window.__JUCE__ && window.__JUCE__.backend);
    if (hasNativeBackend && window.juce) {
        return {
            checkForUpdates: function() {
                return window.juce.checkForUpdates ? window.juce.checkForUpdates() : undefined;
            },
            getUpdateStatus: function() {
                return window.juce.getUpdateStatus ? window.juce.getUpdateStatus() : undefined;
            },
            openBrowserUrl: function(url) {
                return window.juce.openBrowserUrl ? window.juce.openBrowserUrl(url) : undefined;
            },
            addEventListener: function(evt, cb) {
                if (window.__JUCE__ && window.__JUCE__.backend && typeof window.__JUCE__.backend.addEventListener === 'function') {
                    window.__JUCE__.backend.addEventListener(evt, cb);
                }
            },
            emitEvent: function(evt, payload) {
                if (window.__JUCE__ && window.__JUCE__.backend && typeof window.__JUCE__.backend.emitEvent === 'function') {
                    window.__JUCE__.backend.emitEvent(evt, payload);
                }
            }
        };
    }
    return null;
};
