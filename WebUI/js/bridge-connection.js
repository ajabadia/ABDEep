// eslint-disable-next-line no-var
var Logger = globalThis.Logger || console;

/**
 * @purpose Web MIDI initialization + connection management + audio/piano methods for DualMidiBridge
 * @purpose_en Web MIDI init, connection management, and audio/piano methods for DualMidiBridge
 * @classification Module/Connection
 * @complexity High
 *
 * Refactored into sub-modules:
 *   - bridge_connection_utils.js: _isLikelyVirtualPort, _detectConnectionType, _selectMidiPort,
 *     _signalMidiActivity, _showNoteOnLcd, _midiNoteToName, getHardwareInfo, _updateConnectionUI
 *   - bridge_connection_midi.js: initWebMidi, scanMidiDevices, resetMidiConnection,
 *     startAutoReconnect, sendWebMidiParameter
 *   - bridge_connection_juce.js: getVoiceState, getAudioWaveform, getDiagnosticSnapshot,
 *     getCalibration, setCalibration, Audio AB methods, runRoundTripValidator
 */

/* global _selectMidiPort, _signalMidiActivity, _updateConnectionUI */

(function() {
    if (typeof DualMidiBridge === 'undefined') {
        Logger.warn('[Bridge-Connection] DualMidiBridge not found — deferring...');
        return;
    }

    DualMidiBridge.prototype.pianoNoteOn = function(note, velocity) {
        if (this.isJuce) {
            if (window.juce && typeof window.juce.pianoNoteOn === 'function') {
                window.juce.pianoNoteOn(note, velocity || 100);
            }
        } else {
            velocity = velocity === undefined ? 100 : Math.round(Math.max(1, Math.min(127, velocity * 127)));
            Logger.log(`[Bridge Web-MIDI] Note On: ${note} (vel=${velocity})`);
            if (this.midiOutput) {
                const channel = (this.midiChannel ? this.midiChannel - 1 : 0) & 0x0F;
                this.midiOutput.send([0x90 | channel, note, velocity]);
                this._signalMidiActivity();
            }
            if (window.wasmBridge) {
                window.wasmBridge.noteOn(note, velocity / 127.0);
            }
        }
        this._showNoteOnLcd(note, velocity);
    };

    DualMidiBridge.prototype.pianoNoteOff = function(note) {
        if (this.isJuce) {
            if (window.juce && typeof window.juce.pianoNoteOff === 'function') {
                window.juce.pianoNoteOff(note);
            }
        } else {
            Logger.log(`[Bridge Web-MIDI] Note Off: ${note}`);
            if (this.midiOutput) {
                const channel = (this.midiChannel ? this.midiChannel - 1 : 0) & 0x0F;
                this.midiOutput.send([0x80 | channel, note, 0]);
                this._signalMidiActivity();
            }
            if (window.wasmBridge) {
                window.wasmBridge.noteOff(note);
            }
        }
    };

    DualMidiBridge.prototype.panic = function() {
        if (this.isJuce) {
            if (window.juce && typeof window.juce.panic === 'function') {
                window.juce.panic();
            }
        }
    };

    DualMidiBridge.prototype.isConnected = async function() {
        if (this.isJuce) {
            this._connected = true;
            this._updateConnectionUI();
            return true;
        }
        if (!this.midiOutput || !this.midiInput) {
            this._connected = false;
            this._updateConnectionUI();
            return false;
        }

        const inquiry = [0xF0, 0x7E, 0x7F, 0x06, 0x01, 0xF7];
        const isIdentityReply = (msg) => {
            return msg.length >= 10 &&
                   msg[0] === 0xF0 &&
                   msg[1] === 0x7E &&
                   msg[3] === 0x06 &&
                   msg[4] === 0x02 &&
                   msg[5] === 0x00 &&
                   msg[6] === 0x20 &&
                   msg[7] === 0x32;
        };

        try {
            const response = await this.requestSysEx(inquiry, 2000, isIdentityReply);
            const isDeepMind = response[8] === 0x20 && response[9] === 0x00;

            if (response.length >= 16) {
                const deviceId = response[2] & 0x0F;
                this._hardwareInfo.deviceId = String(deviceId);
                this._hardwareInfo.midiChannel = deviceId + 1;
                this._hardwareInfo.connectionType = this._detectConnectionType(this.midiOutput.name);

                const mainMajor = response[12] >> 4;
                const mainMinor = response[12] & 0x0F;
                this._hardwareInfo.hostVersion = mainMajor + '.' + mainMinor;
                this._hardwareInfo.voiceVersion = response[14] + '.' + response[15];

                if (typeof window._updateSettingsHardwareInfo === 'function') {
                    window._hardwareInfo = this._hardwareInfo;
                    window._updateSettingsHardwareInfo();
                }
            }

            this._connected = isDeepMind;
            this._updateConnectionUI();
            return isDeepMind;
        } catch (err) {
            this._connected = false;
            this._updateConnectionUI();
            return false;
        }
    };

    Logger.log('[Bridge] Connection module loaded');
})();
