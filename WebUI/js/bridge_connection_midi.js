// eslint-disable-next-line no-var
var Logger = globalThis.Logger || console;

/**
 * @purpose Web MIDI initialization and device management methods for DualMidiBridge (extracted from bridge-connection.js)
 * @classification Module/Connection/MIDI
 * @complexity High
 */

(function() {
    if (typeof DualMidiBridge === 'undefined') {
        Logger.warn('[Bridge-Connection-MIDI] DualMidiBridge not found — deferring...');
        return;
    }

    DualMidiBridge.prototype.initWebMidi = async function() {
        if (!navigator.requestMIDIAccess) {
            Logger.error('[WebMIDI] Este navegador no soporta Web MIDI API.');
            return;
        }

        try {
            this.midiAccess = await navigator.requestMIDIAccess({ sysex: true });
            Logger.log('[WebMIDI] Acceso MIDI concedido.');
            this.scanMidiDevices();

            setTimeout(async () => {
                const connected = await this.isConnected();
                this._connected = connected;
                this._updateConnectionUI();
                if (connected) {
                    Logger.log('[Bridge] ✅ DeepMind 12 listo para comunicación');
                    try {
                        const globalDump = await this.requestMidiDump('global', 3000, 1);
                        if (globalDump && globalDump.length >= 30) {
                            this._parseGlobalDump(globalDump);
                            if (typeof window._updateSettingsHardwareInfo === 'function') {
                                window._updateSettingsHardwareInfo();
                            }
                        }
                    } catch (e) {
                        Logger.warn('[Bridge] No se pudo obtener Global Dump inicial:', e.message);
                    }
                } else {
                    Logger.warn('[Bridge] ⚠️ DeepMind 12 no detectado. Solo modo editor local.');
                }
            }, 500);

            this.midiAccess.onstatechange = () => this.scanMidiDevices();
        } catch (err) {
            // Fase 3 (§4.3): se LOGUEA el error tipado MIDI pero NO se relanza —
            // initWebMidi() se llama desde init() sin try/catch, y el catch envuelve
            // todo el bloque (requestMIDIAccess + scanMidiDevices + setTimeout), así
            // que un re-throw aquí causaría un unhandled rejection. El error tipado
            // queda disponible para diagnóstico vía this._lastMidiError.
            const typed = (typeof globalThis.createTypedError === 'function')
                ? globalThis.createTypedError('midi', 'MIDI_NO_ACCESS', 'Error al acceder a los dispositivos MIDI: ' + (err && err.message ? err.message : err))
                : null;
            if (typed) { typed.cause = err; this._lastMidiError = typed; }
            Logger.error('[WebMIDI] Error al acceder a los dispositivos MIDI:', typed || err);
        }
    };

    DualMidiBridge.prototype.scanMidiDevices = function() {
        const outputs = this.midiAccess.outputs;
        const inputs = this.midiAccess.inputs;

        if (this.midiInput) {
            this.midiInput.onmidimessage = null;
        }

        this.midiOutput = this._selectMidiPort(outputs, 'output');
        this.midiInput = this._selectMidiPort(inputs, 'input');

        if (this.midiOutput) {
            Logger.log(`[WebMIDI] Salida seleccionada: ${this.midiOutput.name}`);
        }
        if (this.midiInput) {
            Logger.log(`[WebMIDI] Entrada seleccionada: ${this.midiInput.name}`);
            this.midiInput.onmidimessage = (msg) => this.handleIncomingMidi(msg);
        }
    };

    DualMidiBridge.prototype.resetMidiConnection = async function() {
        if (this.isJuce) {return true;}
        if (!this.midiAccess) {
            Logger.warn('[Bridge] No MIDI Access disponible. Inicializando...');
            try {
                this.midiAccess = await navigator.requestMIDIAccess({ sysex: true });
                this.midiAccess.onstatechange = () => this.scanMidiDevices();
            } catch (err) {
                Logger.error('[Bridge] Error al reinicializar MIDI Access:', err);
                return false;
            }
        }

        this._resetNrpnCache();
        this._resetNrpnCounters();

        const savedCh = localStorage.getItem('abd-eep-midi-channel');
        if (savedCh) {
            const parsed = parseInt(savedCh);
            if (parsed >= 1 && parsed <= 16) {
                this.midiChannel = parsed;
                this._hardwareInfo.midiChannel = parsed;
                Logger.log('[Bridge] MIDI Channel restaurado desde localStorage: ch ' + parsed);
            }
        }

        this.scanMidiDevices();
        const connected = await this.isConnected();
        this._connected = connected;
        this._updateConnectionUI();
        if (connected) {
            Logger.log('[Bridge] ✅ Reconexión MIDI exitosa — DeepMind 12 detectado');
            if (this.midiOutput) {
                this._hardwareInfo.connectionType = this._detectConnectionType(this.midiOutput.name);
            }
            try {
                const globalDump = await this.requestMidiDump('global', 3000, 1);
                if (globalDump && globalDump.length >= 30) {
                    this._parseGlobalDump(globalDump);
                }
            } catch (e) {
                Logger.warn('[Bridge] No se pudo obtener Global Dump para versiones:', e.message);
            }
        } else {
            Logger.warn('[Bridge] ⚠️ Reconexión MIDI: DeepMind 12 no responde');
        }
        return connected;
    };

    // startAutoReconnect extraído a bridge_connection_reconnect.js

    DualMidiBridge.prototype.sendWebMidiParameter = function(paramId, normalizedValue) {
        if (!this.midiOutput) {return;}

        if (paramId === 'chord_enable' || paramId === 'poly_chord_enable' || paramId === 'chord_key' || paramId === 'chord_type') {
            setTimeout(() => {
                if (paramId === 'chord_enable' || paramId === 'chord_key' || paramId === 'chord_type') {
                    const chordNotes = this.parameterCache['chord_notes'] || new Array(28).fill(0xFF);
                    const keyVal = Math.round((this.parameterCache['chord_key'] || 0.0) * 11.0);
                    const typeVal = Math.round((this.parameterCache['chord_type'] || 0.0) * 11.0);

                    const unpacked = new Uint8Array(26);
                    unpacked[0] = keyVal;
                    unpacked[1] = typeVal;
                    let noteIdx = 2;
                    chordNotes.forEach(note => {
                        if (note !== 0xFF && noteIdx < 26) {
                            unpacked[noteIdx++] = note;
                        }
                    });
                    while (noteIdx < 26) { unpacked[noteIdx++] = 0xFF; }

                    if (typeof window.pack8to7 === 'function') {
                        const packed = window.pack8to7(unpacked);
                        const header = [0xF0, 0x00, 0x20, 0x32, 0x20, 0x01, 0x1C, 0x06];
                        const footer = [0xF7];
                        const msg = new Uint8Array(header.length + 32 + footer.length);
                        msg.set(header, 0);
                        msg.set(packed.slice(0, 32), header.length);
                        msg.set(footer, header.length + 32);
                        this.midiOutput.send(msg);
                    }
                } else if (paramId === 'poly_chord_enable') {
                    const polyNotes = this.parameterCache['poly_chord_notes'] || new Array(512).fill(0xFF);
                    const unpacked = new Uint8Array(512);
                    for (let i = 0; i < 512; i++) {
                        unpacked[i] = polyNotes[i] !== undefined ? polyNotes[i] : 0xFF;
                    }
                    const packed = new Uint8Array(592);
                    let readIdx = 0;
                    let writeIdx = 0;
                    while (readIdx < 512 && writeIdx < 592) {
                        let msbFlags = 0;
                        const startWriteIdx = writeIdx;
                        writeIdx++;
                        for (let k = 1; k < 8; k++) {
                            let val = 0xFF;
                            if (readIdx < 512) {
                                val = unpacked[readIdx++];
                            }
                            if (val & 0x80) {
                                msbFlags |= (1 << (k - 1));
                                val &= 0x7F;
                            }
                            packed[startWriteIdx + k] = val;
                            writeIdx++;
                        }
                        packed[startWriteIdx] = msbFlags;
                    }

                    const header = [0xF0, 0x00, 0x20, 0x32, 0x20, 0x01, 0x1E, 0x06];
                    const footer = [0xF7];
                    const msg = new Uint8Array(header.length + 592 + footer.length);
                    msg.set(header, 0);
                    msg.set(packed, header.length);
                    msg.set(footer, header.length + 592);
                    this.midiOutput.send(msg);
                }
            }, 50);
            return;
        }

        const byteOffset = this.paramToByteOffset[paramId];
        if (byteOffset !== undefined) {
            // Parámetros virtuales del emulador (>=300, p.ej. fx_feedback_gain=304,
            // fx_send_level=305) NO tienen byte físico en el preset DM12 ni NRPN
            // legítimo; emitirlos aquí enviaría un NRPN corrupto a un parámetro
            // real del hardware (lsb=byteOffset-128 colisiona). Solo se aplican
            // en modo JUCE/WASM vía APVTS por paramId.
            if (byteOffset >= 300) { return; }
            const rawValue = this._normalizedToRaw(byteOffset, normalizedValue);
            this.sendNRPN(byteOffset, rawValue);
            return;
        }

        const cc = this.paramToCC[paramId];
        if (cc !== undefined) {
            const midiVal = Math.round(normalizedValue * 127);
            const statusByte = 0xB0 | (this.midiChannel - 1);
            this.midiOutput.send([statusByte, cc, midiVal]);
        }
    };

    Logger.log('[Bridge] MIDI device module loaded');
})();
