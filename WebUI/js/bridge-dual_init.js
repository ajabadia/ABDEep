/**
 * @purpose DualMidiBridge init-related methods: waitForReady(), setupJuceListeners().
 * init() permanece como método de clase en bridge-dual.js porque se llama desde el constructor.
 * Extraído de bridge-dual.js para modularización.
 * @classification Module/Bridge/Init
 * @complexity Low
 */

(function() {
    if (typeof DualMidiBridge === 'undefined') {
        if (typeof console !== 'undefined') {console.warn('[Bridge-Init] DualMidiBridge not found — deferring...');}
        return;
    }

    const Logger = globalThis.Logger || console;

    DualMidiBridge.prototype.waitForReady = async function(timeoutMs) {
        if (timeoutMs === undefined) { timeoutMs = 10000; }
        if (this._ready) {return true;}
        try {
            await Promise.race([
                this._readyPromise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))
            ]);
            return true;
        } catch (e) {
            Logger.warn('[Bridge] waitForReady timeout after ' + timeoutMs + 'ms — proceeding anyway');
            return false;
        }
    };

    DualMidiBridge.prototype.setupJuceListeners = function() {
        // JUCE 8 uses window.__JUCE__.backend.addEventListener for C++ → JS events.
        if (window.__JUCE__ && window.__JUCE__.backend) {
            window.__JUCE__.backend.addEventListener('onParameterChanged', (data) => {
                this.handleParameterChangeFromBackend(data.id, data.value);
            });
        }
        // Legacy fallback
        window.onJuceEvent = (name, data) => {
            if (name === 'onParameterChanged') {
                this.handleParameterChangeFromBackend(data.id, data.value);
            }
        };
    };

    Logger.log('[Bridge] Init module loaded');
})();
