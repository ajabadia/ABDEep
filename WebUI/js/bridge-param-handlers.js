// eslint-disable-next-line no-var
var Logger = globalThis.Logger || console;

/**
 * @purpose Parameter change handlers for Arp and Sequencer engines.
 * Extracted from bridge-engines.js IIFE 2 to reduce its size and improve modularity.
 * @classification Module/Engines/ParamHandlers
 * @complexity Low
 * @lastUpdated 2026-07-25
 */

(function() {
    if (typeof DualMidiBridge === 'undefined') {
        Logger.warn('[ParamHandlers] DualMidiBridge not found — deferring...');
        return;
    }

    /**
     * Unified parameter change handler for engine-related parameters.
     * Called when onParameterChanged fires for arp_enable, seq_enable,
     * seq_key_loop, seq_clock, arp_rate, or arp_clock_divider.
     * @param {string} paramId - Parameter identifier
     * @param {number} val - Normalized value (0..1)
     * @param {object} bridge - DualMidiBridge instance
     */
    window._handleEngineParamChange = function(paramId, val, bridge) {
        if (!bridge) {return;}

        if (paramId === 'arp_enable') {
            if (val > 0.5 && bridge._arpEngine && bridge._arpEngine.heldNotes.length > 0) {
                bridge._arpEngine.start();
            } else if (bridge._arpEngine) {
                bridge._arpEngine.stop();
            }
            return;
        }

        if (paramId === 'seq_enable') {
            bridge._updateSeqEngine();
            return;
        }

        if (paramId === 'seq_key_loop') {
            if (bridge._seqEngine) {
                bridge._seqEngine._forcedFreeRunning = false;
            }
            return;
        }

        if (paramId === 'seq_clock' && bridge._seqEngine) {
            bridge._seqEngine.updateTimer();
            return;
        }

        if (paramId === 'arp_rate') {
            if (bridge._arpEngine) {bridge._arpEngine.updateTimer();}
            if (bridge._seqEngine) {bridge._seqEngine.updateTimer();}
            return;
        }

        if (paramId === 'arp_clock_divider' && bridge._arpEngine) {
            bridge._arpEngine.updateTimer();
            return;
        }
    };

    Logger.log('[ParamHandlers] Module loaded');
})();
