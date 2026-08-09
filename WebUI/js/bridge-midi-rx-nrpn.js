/**
 * @purpose NRPN send/traffic management for DualMidiBridge: sendNRPN with dedup,
 * traffic callbacks, counter reset, and cache reset.
 * Extraído de bridge-midi-rx.js.
 */

(function() {
    if (typeof DualMidiBridge === 'undefined') {
        (globalThis.Logger || console).warn('[Bridge-NRPN] DualMidiBridge not found — deferring...');
        return;
    }

    const Logger = globalThis.Logger || console;

    DualMidiBridge.prototype.sendNRPN = function(byteOffset, rawValue, channel) {
        if (channel === undefined) {channel = this.midiChannel;}
        if (!this.midiOutput) {return;}

        // Nivel 1: Evitar envío si es el mismo byte con el mismo valor
        if (this._lastNrpnByte === byteOffset && this._lastNrpnValue === rawValue) {
            return;
        }

        const msb = byteOffset < 128 ? 0 : 1;
        const lsb = byteOffset < 128 ? byteOffset : (byteOffset - 128);
        const dataMsb = (rawValue >> 7) & 0x7F;
        const dataLsb = rawValue & 0x7F;
        const ch = (channel - 1) & 0x0F;

        const bytes = [];
        bytes.push(0xB0 | ch, 99, msb & 0x7F);
        bytes.push(0xB0 | ch, 98, lsb & 0x7F);
        bytes.push(0xB0 | ch, 6, dataMsb);
        bytes.push(0xB0 | ch, 38, dataLsb);

        this._lastNrpnByte = byteOffset;
        this._lastNrpnValue = rawValue;

        this._nrpnTxBytes += bytes.length;
        this._nrpnPktCount++;
        this._notifyNrpnTraffic();

        this._signalMidiActivity();
        this.midiOutput.send(bytes);
    };

    DualMidiBridge.prototype._onNrpnTraffic = function(cb) {
        this._nrpnTrafficCallbacks.push(cb);
    };

    DualMidiBridge.prototype._notifyNrpnTraffic = function() {
        this._nrpnTrafficCallbacks.forEach(cb => cb({
            tx: this._nrpnTxBytes,
            rx: this._nrpnRxBytes,
            pkts: this._nrpnPktCount
        }));
    };

    DualMidiBridge.prototype._resetNrpnCounters = function() {
        this._nrpnTxBytes = 0;
        this._nrpnRxBytes = 0;
        this._nrpnPktCount = 0;
        this._notifyNrpnTraffic();
    };

    DualMidiBridge.prototype._resetNrpnCache = function() {
        this._lastNrpnMsb = null;
        this._lastNrpnLsb = null;
        this._lastNrpnValue = null;
        this._lastNrpnByte = null;
        this._nrpnInMsb = null;
        this._nrpnInLsb = null;
        this._nrpnInDataMsb = 0;
        this._nrpnInTimestamp = 0;
        Logger.log('[Bridge] NRPN cache reset');
    };

    Logger.log('[Bridge] NRPN module loaded');
})();
