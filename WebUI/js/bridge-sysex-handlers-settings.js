/**
 * @purpose Global parameter and settings handlers for DualMidiBridge.
 * Extraído de bridge-sysex-handlers.js.
 */

(function() {
    if (typeof DualMidiBridge === 'undefined') {
        console.warn('[Bridge-SysEx-Settings] DualMidiBridge not found — deferring...');
        return;
    }

    const Logger = globalThis.Logger || console;

    DualMidiBridge.prototype._parseGlobalDump = function(dump) {
        if (!dump || dump.length < 15) {return;}
        
        let payload = [];
        for (let i = 8; i < dump.length - 1; i++) {
            payload.push(dump[i]);
        }

        // Unpack payload if unpack7to8 is available
        if (typeof window.unpack7to8 === 'function') {
            try {
                const unpacked = window.unpack7to8(new Uint8Array(payload));
                payload = Array.from(unpacked);
            } catch (e) {
                Logger.warn('[Bridge] Error unpacking global dump:', e);
            }
        }

        this._hardwareInfo.globalDumpBytes = payload;

        if (payload.length >= 3) {
            const ch = payload[0] & 0x0F;
            if (ch >= 0 && ch <= 15) {
                this._hardwareInfo.midiChannel = ch + 1;
            }
            const devId = (payload[0] >> 4) & 0x0F;
            if (devId >= 0 && devId <= 15) {
                this._hardwareInfo.deviceId = String(devId);
            }

            const tuneVal = payload[1];
            const transpRaw = Math.min(payload[2], 96);
            const velCurveRaw = payload.length > 3 ? Math.min(payload[3], 4) : 0;
            const pedalRaw = payload.length > 4 ? payload[4] : 0;
            const contrastRaw = payload.length > 5 ? Math.min(payload[5], 14) : 10;

            const globals = this._globalParams || {};

            // Preserve localStorage values over hardware Global Dump
            // User settings from Settings modal should take priority
            const lsTune = typeof localStorage !== 'undefined' ? localStorage.getItem('abd-eep-master-tune') : null;
            const lsTranspose = typeof localStorage !== 'undefined' ? localStorage.getItem('abd-eep-transpose') : null;

            globals['global_tune'] = lsTune !== null ? globals['global_tune'] : tuneVal / 255.0;
            globals['transpose'] = lsTranspose !== null ? globals['transpose'] : transpRaw / 96.0;
            globals['velocity_curve'] = velCurveRaw / 4.0;
            globals['pedal_polarity'] = pedalRaw > 0 ? 1.0 : 0.0;
            globals['lcd_contrast'] = contrastRaw / 14.0;
            this._globalParams = globals;

            if (this.parameterCache) {
                this.parameterCache['global_tune'] = lsTune !== null ? this.parameterCache['global_tune'] : tuneVal / 255.0;
                this.parameterCache['transpose'] = lsTranspose !== null ? this.parameterCache['transpose'] : transpRaw / 96.0;
                this.parameterCache['velocity_curve'] = velCurveRaw / 4.0;
                this.parameterCache['pedal_polarity'] = pedalRaw > 0 ? 1.0 : 0.0;
                this.parameterCache['lcd_contrast'] = contrastRaw / 14.0;
            }
        }
    };


    DualMidiBridge.prototype.sendGlobalDump = function(payloadBytes) {
        if (!this.midiOutput || !payloadBytes || payloadBytes.length < 3) {return;}

        const devId = parseInt(this._hardwareInfo.deviceId) || 0;
        const msg = new Uint8Array(8 + payloadBytes.length + 1);
        msg[0] = 0xF0;
        msg[1] = 0x00;
        msg[2] = 0x20;
        msg[3] = 0x32;
        msg[4] = 0x20;
        msg[5] = devId & 0x0F;
        msg[6] = 0x06;
        msg[7] = 0x06;

        for (let i = 0; i < payloadBytes.length; i++) {
            msg[8 + i] = payloadBytes[i];
        }
        msg[msg.length - 1] = 0xF7;

        this._signalMidiActivity();
        this.midiOutput.send(msg);
        Logger.log('[Bridge] Global Dump escrito vía SysEx (' + payloadBytes.length + ' bytes, devId=' + devId + ')');
    };


    DualMidiBridge.prototype.getGlobalParameter = function(paramId) {
        if (this._globalParams && paramId in this._globalParams) {
            return this._globalParams[paramId];
        }
        return this.parameterCache[paramId];
    };


    DualMidiBridge.prototype.setGlobalParameter = function(paramId, normalizedValue) {
        if (this._globalParams) {
            this._globalParams[paramId] = normalizedValue;
        }
        this.parameterCache[paramId] = normalizedValue;
        this.handleParameterChangeFromBackend(paramId, normalizedValue);

        let raw8Bit = -1;
        let byteOffset = -1;
        if (paramId === 'device_id') {
            const devId = Math.round(normalizedValue * 15);
            if (this._hardwareInfo && this._hardwareInfo.globalDumpBytes) {
                const cached = this._hardwareInfo.globalDumpBytes;
                const ch = (cached[0] & 0x0F);
                const bytes = new Uint8Array(cached);
                bytes[0] = ((devId & 0x0F) << 4) | ch;
                this.sendGlobalDump(Array.from(bytes));
            }
            return;
        } else if (paramId === 'global_tune') {
            raw8Bit = Math.round(normalizedValue * 255);
            byteOffset = 1;
        } else if (paramId === 'transpose') {
            raw8Bit = Math.round(normalizedValue * 96);
            byteOffset = 2;
        } else if (paramId === 'velocity_curve') {
            raw8Bit = Math.round(normalizedValue * 4);
            byteOffset = 3;
        } else if (paramId === 'pedal_polarity') {
            raw8Bit = normalizedValue > 0.5 ? 1 : 0;
            byteOffset = 4;
        } else if (paramId === 'lcd_contrast') {
            raw8Bit = Math.round(normalizedValue * 14);
            byteOffset = 5;
        }

        if (byteOffset >= 0 && this._hardwareInfo && this._hardwareInfo.globalDumpBytes) {
            const cached = this._hardwareInfo.globalDumpBytes;
            if (cached && cached.length > byteOffset) {
                const bytes = new Uint8Array(cached);
                bytes[byteOffset] = Math.min(255, Math.max(0, raw8Bit));
                this.sendGlobalDump(Array.from(bytes));
                return;
            }
        }

        if (this.isJuce) {
            if (window.juce && typeof window.juce.setParameter === 'function') {
                window.juce.setParameter(paramId, normalizedValue);
            }
        } else {
            this.sendWebMidiParameter(paramId, normalizedValue);
        }
    };


    Logger.log('[Bridge] SysEx settings handlers module loaded');
})();
