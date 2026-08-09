/**
 * @purpose Motor initialization orchestrator for DualMidiBridge.
 * Arp engine → bridge-engines-arp.js (initArpEngine, _arpStep, _arpKillAllNotes)
 * Seq engine → bridge-engines-seq.js (initSeqEngine, _updateSeqEngine, _seqStep)
 * Param handlers → bridge-param-handlers.js
 */

/**
 * Modo de operación: el WebUI puede actuar como controlador del hardware
 * (deepmind_hw_controller) o como simulador local (deepmind_web_standalone /
 * abyssmind_pro). En modo controlador SOLO se reenvían parámetros al hardware:
 * el arp/seq/chord lo ejecuta la propia máquina, por lo que los motores locales
 * NO deben computar (si no, las secuencias se repetirían). En modo simulador,
 * el software es el que sonariza y los motores locales SÍ deben ejecutarse.
 */
DualMidiBridge.prototype._isSimulatorMode = function() {
    const w = globalThis.wasmBridge;
    if (!w || typeof w.getMode !== 'function') { return true; } // fallback: preserva comportamiento actual
    return w.getMode() !== 'deepmind_hw_controller';
};

// --- Inicialización de motores después de la creación del bridge ---
(function() {
    let _initAttempts = 0;
    const _maxInitAttempts = 200;
    const checkBridge = setInterval(function() {
        _initAttempts++;
        if (_initAttempts > _maxInitAttempts) {
            clearInterval(checkBridge);
            const Logger = globalThis.Logger || console;
            Logger.warn('[Bridge] Engine init timeout — bridge not available after 10s');
            return;
        }
        const bridge = getBridge();
        if (bridge && typeof bridge.startAutoReconnect === 'function') {
            clearInterval(checkBridge);

            bridge.startAutoReconnect();
            bridge.initArpEngine();
            bridge.initSeqEngine();

            if (typeof window._initChordMemory === 'function') {
                window._initChordMemory();
            }
            if (typeof window._initPolyChordNotes === 'function') {
                window._initPolyChordNotes();
            }

            if (typeof bridge.onParameterChanged === 'function') {
                bridge.onParameterChanged(function(paramId, val) {
                    if (typeof window._handleEngineParamChange === 'function') {
                        window._handleEngineParamChange(paramId, val, bridge);
                    }
                });
            }

            const Logger = globalThis.Logger || console;
            Logger.log('[Bridge] Engine initialization complete');
        }
    }, 50);
})();
