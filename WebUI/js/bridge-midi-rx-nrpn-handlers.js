/**
 * @purpose NRPN incoming handler for DualMidiBridge: parses CC 99/98/6/38
 * into parameter changes. Extraído de bridge-midi-rx.js.
 */

(function() {
    if (typeof DualMidiBridge === 'undefined') {
        (globalThis.Logger || console).warn('[Bridge-NRPN-Handlers] DualMidiBridge not found — deferring...');
        return;
    }

    const Logger = globalThis.Logger || console;

    /**
     * Procesa mensajes NRPN entrantes (CC 99, 98, 6, 38).
     * @param {number} cc - Número de CC (99, 98, 6 o 38)
     * @param {number} val - Valor del CC (0-127)
     * @returns {boolean} true si el CC fue manejado (el caller debe hacer return)
     */
    DualMidiBridge.prototype._handleIncomingNrpn = function(cc, val) {
        if (cc === 99) {
            this._nrpnInMsb = val;
            this._nrpnInDataMsb = 0;
            this._nrpnInTimestamp = Date.now();
            this._lastNrpnMsb = null;
            this._lastNrpnLsb = null;
            this._lastNrpnByte = null;
            return true;
        }
        if (cc === 98) {
            this._nrpnInLsb = val;
            this._nrpnInDataMsb = 0;
            this._nrpnInTimestamp = Date.now();
            this._lastNrpnMsb = null;
            this._lastNrpnLsb = null;
            this._lastNrpnByte = null;
            return true;
        }
        if (cc === 6) {
            this._nrpnInDataMsb = val;
            return true;
        }
        if (cc === 38) {
            const addressValid = (this._nrpnInMsb !== null && this._nrpnInLsb !== null);
            if (addressValid) {
                const nrpnMsb = this._nrpnInMsb;
                const nrpnLsb = this._nrpnInLsb;
                const byteOffset = (nrpnMsb << 7) + nrpnLsb;
                const raw14 = (this._nrpnInDataMsb << 7) | val;
                const rawValue = raw14 & 0xFF;

                if (this.midiLearnActive) {
                    this._captureMidiLearnMessage(cc, rawValue, { msb: nrpnMsb, lsb: nrpnLsb });
                    this._nrpnInDataMsb = 0;
                    return true;
                }

                const nrpnKey = 'nrpn:' + nrpnMsb + ':' + nrpnLsb;
                if (this._applyMidiLearnMapping(nrpnKey, rawValue, { msb: nrpnMsb, lsb: nrpnLsb })) {
                    this._nrpnInDataMsb = 0;
                    return true;
                }

                const rev = this.byteOffsetToParamIds;
                const paramIds = rev[byteOffset];
                if (paramIds && paramIds.length > 0) {
                    const normalized = this._rawToNormalized(byteOffset, rawValue);
                    paramIds.forEach(pid => {
                        this.handleParameterChangeFromBackend(pid, normalized);
                    });
                }

                this._nrpnRxBytes += 12;
                this._nrpnPktCount++;
                this._notifyNrpnTraffic();

                this._nrpnInDataMsb = 0;
            }
            return true;
        }
        return false;
    };

    Logger.log('[Bridge] NRPN handlers module loaded');
})();
