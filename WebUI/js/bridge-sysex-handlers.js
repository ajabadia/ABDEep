/**
 * @purpose SysEx dump + settings handlers fachada para DualMidiBridge.
 * Los handlers están divididos en:
 *   - bridge-sysex-handlers-dump.js: requestBankDump, cancelBankDump, _scheduleAutoDump
 *   - bridge-sysex-handlers-settings.js: _parseGlobalDump, sendGlobalDump, getGlobalParameter, setGlobalParameter
 * @classification Module/SysEx
 * @complexity Low (Fachada)
 */

(function() {
    if (typeof DualMidiBridge === 'undefined') {
        console.warn('[Bridge-SysEx-Handlers] DualMidiBridge not found — deferring...');
        return;
    }

    const Logger = globalThis.Logger || console;
    Logger.log('[Bridge] SysEx handlers module loaded');
})();
