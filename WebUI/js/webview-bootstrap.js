// WebView2 Bootstrap — JUCE 8 Native Integration Compatibility Shim
// JUCE 8 does NOT expose native functions directly on window.juce.
// Instead it injects window.__JUCE__.backend with emitEvent/addEventListener.
// Native calls use: emitEvent("__juce__invoke", { name, params, resultId })
// Results come via: addEventListener("__juce__complete", ({ promiseId, result }))
// This bootstrap bridges the gap so window.juce.fn() works as a direct call.
(function() {
    // ── Promise handler for native function calls ──
    let lastPromiseId = 0;
    const promises = {};

    // ── Console originals (before any override) ──
    const _origLog  = console.log;
    const _origErr  = console.error;
    const _origWarn = console.warn;

    // ── Log to C++ file when possible ──
    function logToNative(msg) {
        try {
            if (window.__JUCE__ && window.__JUCE__.backend && _nativeFunctions.logFromJS) {
                _nativeFunctions.logFromJS(msg);
            }
        } catch (e) { /* swallow */ }
    }

    // ── Core: emit a native function call via JUCE 8 event protocol ──
    function callJuceNative(name, args) {
        const promiseId = lastPromiseId++;
        const payload = { name: name, params: args, resultId: promiseId };

        // The promise is resolved when __juce__complete fires with matching promiseId
        return new Promise(function(resolve, reject) {
            promises[promiseId] = { resolve: resolve, reject: reject };

            // Send the invocation event to C++
            if (window.__JUCE__ && window.__JUCE__.backend) {
                window.__JUCE__.backend.emitEvent('__juce__invoke', payload);
            } else {
                // JUCE not ready yet — reject
                delete promises[promiseId];
                reject(new Error('JUCE backend not available'));
            }

            // Safety timeout: resolve with undefined after 5s if no response
            setTimeout(function() {
                if (promises[promiseId]) {
                    promises[promiseId].resolve(undefined);
                    delete promises[promiseId];
                }
            }, 5000);
        });
    }

    // ── Registered native function names (must match C++ withNativeFunction calls) ──
    const nativeFunctionNames = [
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

    // ── Create wrapper functions ──
    var _nativeFunctions = {};
    nativeFunctionNames.forEach(function(name) {
        _nativeFunctions[name] = function() {
            return callJuceNative(name, Array.prototype.slice.call(arguments));
        };
    });

    // ── Set up __juce__complete listener for promise resolution ──
    function installCompleteListener() {
        if (window.__JUCE__ && window.__JUCE__.backend) {
            window.__JUCE__.backend.addEventListener('__juce__complete', function(data) {
                const p = promises[data.promiseId];
                if (p) {
                    delete promises[data.promiseId];
                    p.resolve(data.result);
                }
            });
            return true;
        }
        return false;
    }

    // ── Set up C++ → JS event listeners ──
    function installEventListeners() {
        if (!window.__JUCE__ || !window.__JUCE__.backend) {return;}

        // Parameter changes from C++ backend
        window.__JUCE__.backend.addEventListener('onParameterChanged', function(data) {
            if (window._bridgeInstance && typeof window._bridgeInstance.handleParameterChangeFromBackend === 'function') {
                window._bridgeInstance.handleParameterChangeFromBackend(data.id, data.value);
            }
        });
    }

    // ── Create window.juce compatibility object ──
    function createJuceCompat() {
        const juce = {};

        // Copy all native function wrappers
        Object.keys(_nativeFunctions).forEach(function(name) {
            juce[name] = _nativeFunctions[name];
        });

        // onParameterChanged compatibility: old API used window.onJuceEvent
        // New API uses addEventListener. Bridge can also register directly.
        juce._onParameterChangedCallbacks = [];

        return juce;
    }

    // ── Polling: wait for window.__JUCE__ to become available ──
    let _juceReady = false;
    let _juceObject = null;

    function pollForJuce(attempt) {
        if (window.__JUCE__ && window.__JUCE__.backend) {
            if (!_juceReady) {
                _juceReady = true;
                _juceObject = createJuceCompat();
                window.juce = _juceObject;

                installCompleteListener();
                installEventListeners();

                _origLog.call(console, '[Bootstrap] JUCE 8 native integration ready. window.juce created with functions:',
                    Object.keys(_nativeFunctions).join(', '));
            }
            return;
        }

        if (attempt < 200) { // poll for up to 4 seconds (200 * 20ms)
            setTimeout(function() { pollForJuce(attempt + 1); }, 20);
        } else {
            _origWarn.call(console, '[Bootstrap] JUCE native integration not found after 4s. Running in standalone mode.');
        }
    }

    // ── Lazy getter for window.juce ──
    // If JUCE hasn't been detected yet, the getter returns the partially
    // constructed object (or null). Once JUCE is ready, it returns the
    // full compatibility object.
    Object.defineProperty(window, 'juce', {
        get: function() {
            return _juceObject || this.__juceFallback || null;
        },
        set: function(val) {
            if (val && typeof val === 'object') {
                _juceObject = val;
                this.__juceFallback = val;
            }
        },
        configurable: true,
        enumerable: true
    });

    // ── Global error handler ──
    window.onerror = function(message, source, lineno, colno, error) {
        const errText = '[JS Crash] ' + message + ' at ' + source + ':' + lineno + ':' + colno;
        logToNative(errText);
    };

    // ── Console redirect (fires only when JUCE is ready) ──
    console.log = function() {
        const args = Array.prototype.slice.call(arguments);
        _origLog.apply(console, args);
        logToNative(args.join(' '));
    };

    console.error = function() {
        const args = Array.prototype.slice.call(arguments);
        _origErr.apply(console, args);
        logToNative('[ERROR] ' + args.join(' '));
    };

    console.warn = function() {
        const args = Array.prototype.slice.call(arguments);
        _origWarn.apply(console, args);
        logToNative('[WARN] ' + args.join(' '));
    };

    // ── Start polling immediately ──
    _origLog.call(console, '[Bootstrap] Starting JUCE 8 detection poll...');
    pollForJuce(0);
})();
