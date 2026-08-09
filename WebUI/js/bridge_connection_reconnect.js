// eslint-disable-next-line no-var
var Logger = globalThis.Logger || console;

/**
 * @purpose Auto-reconnect handler for DualMidiBridge: exponential backoff reconnection.
 * Extraído de bridge_connection_midi.js.
 * @classification Module/Connection/Reconnect
 * @complexity Low
 */

(function() {
    if (typeof DualMidiBridge === 'undefined') {
        Logger.warn('[Bridge-Reconnect] DualMidiBridge not found — deferring...');
        return;
    }

    DualMidiBridge.prototype.startAutoReconnect = function() {
        if (this.isJuce) {return;}

        if (this._autoReconnectTimer) {return;}

        this._autoReconnectAttempts = 0;
        this._autoReconnectTimer = setInterval(async () => {
            if (this.midiAccess && !this._connected) {
                const attempted = this._lastReconnectAttempt || 0;
                const elapsed = Date.now() - attempted;
                const nextDelay = Math.min(5000 * Math.pow(2, this._autoReconnectAttempts || 0), 120000);
                if (elapsed < nextDelay) {return;}

                this._autoReconnectAttempts = (this._autoReconnectAttempts || 0) + 1;

                this._lastReconnectAttempt = Date.now();
                Logger.log('[Bridge] Auto-reconnect: intento #' + this._autoReconnectAttempts + ' (backoff ' + Math.round(nextDelay / 1000) + 's)...');
                try {
                    await this.resetMidiConnection();
                    if (this._connected) {
                        this._autoReconnectAttempts = 0;
                    }
                } catch (e) {
                    Logger.warn('[Bridge] Auto-reconnect falló:', e.message);
                }
            }
        }, 5000);

        window.addEventListener('beforeunload', () => {
            if (this._autoReconnectTimer) {
                clearInterval(this._autoReconnectTimer);
                this._autoReconnectTimer = null;
            }
        });
    };

    Logger.log('[Bridge] Reconnect module loaded');
})();
