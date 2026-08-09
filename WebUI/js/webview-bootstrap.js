// WebView2 Bootstrap — JUCE 8 Native Integration Compatibility Shim
// Core protocol (callJuceNative, promise handling, native function wrappers,
// listeners, createJuceCompat) is now in webview_juce_core.js.
// This file handles JUCE detection (pollForJuce), console redirect, and error handling.

(function() {
    // ── Polling: wait for window.__JUCE__ to become available ──
    let _juceReady = false;
    let _juceObject = null;

    function pollForJuce(attempt) {
        if (window.__JUCE__ && window.__JUCE__.backend) {
            if (!_juceReady) {
                _juceReady = true;
                _juceObject = window._juceCreateCompat();

                window.juce = _juceObject;
                window._juceInstallCompleteListener();
                window._juceInstallEventListeners();

                const fnNames = [];
                if (window._juceNativeFunctions) {
                    const keys = Object.keys(window._juceNativeFunctions);
                    for (let i = 0; i < keys.length; i++) { fnNames.push(keys[i]); }
                }
                _juceOrigLog.call(console, '[Bootstrap] JUCE 8 native integration ready. window.juce created with functions:',
                    fnNames.join(', '));
            }
            return;
        }

        if (attempt < 200) { // poll for up to 4 seconds (200 * 20ms)
            setTimeout(function() { pollForJuce(attempt + 1); }, 20);
        } else {
            _juceOrigWarn.call(console, '[Bootstrap] JUCE native integration not found after 4s. Running in standalone mode.');
        }
    }

    // ── Lazy getter for window.juce ──
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
    window.onerror = function(message, source, lineno, colno, _error) {
        const errText = '[JS Crash] ' + message + ' at ' + source + ':' + lineno + ':' + colno;
        _juceLogToNative(errText);
    };

    // ── Console redirect (fires only when JUCE is ready) ──
    console.log = function() {
        const args = Array.prototype.slice.call(arguments);
        _juceOrigLog.apply(console, args);
        _juceLogToNative(args.join(' '));
    };

    console.error = function() {
        const args = Array.prototype.slice.call(arguments);
        _juceOrigErr.apply(console, args);
        _juceLogToNative('[ERROR] ' + args.join(' '));
    };

    console.warn = function() {
        const args = Array.prototype.slice.call(arguments);
        _juceOrigWarn.apply(console, args);
        _juceLogToNative('[WARN] ' + args.join(' '));
    };

    // ── Start polling immediately ──
    _juceOrigLog.call(console, '[Bootstrap] Starting JUCE 8 detection poll...');
    pollForJuce(0);
})();
