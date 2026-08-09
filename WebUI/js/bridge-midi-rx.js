/**
 * @purpose MIDI receive handler (handleIncomingMidi) + MIDI Learn for DualMidiBridge.
 * NRPN send/traffic → bridge-midi-rx-nrpn.js.
 * NRPN incoming → bridge-midi-rx-nrpn-handlers.js.
 * @classification Module/MIDI
 * @complexity High
 */

(function() {
    if (typeof DualMidiBridge === 'undefined') {
        (globalThis.Logger || console).warn('[Bridge-MIDI-RX] DualMidiBridge not found — deferring...');
        return;
    }

    const Logger = globalThis.Logger || console;

    DualMidiBridge.prototype._applyMidiLearnMapping = function(key, val, nrpnInfo) {
        if (typeof window.dualMidiBridge._applyMidiLearnMappingInternal === 'function') {
            return window.dualMidiBridge._applyMidiLearnMappingInternal(key, val, nrpnInfo);
        }
        const paramId = this.midiLearnMappings ? this.midiLearnMappings[key] : null;
        if (!paramId) {return false;}

        const byteOffset = this.paramToByteOffset[paramId];
        let normalized;
        if (byteOffset !== undefined) {
            const rawVal = nrpnInfo ? (val & 0xFF) : Math.round(val * 255.0 / 127.0);
            normalized = this._rawToNormalized(byteOffset, rawVal);
        } else {
            normalized = val / 127.0;
        }

        this.setParameter(paramId, normalized);
        return true;
    };

    DualMidiBridge.prototype._captureMidiLearnMessage = function(ccNum, val, nrpnInfo) {
        if (typeof window.dualMidiBridge._captureMidiLearnMessageInternal === 'function') {
            window.dualMidiBridge._captureMidiLearnMessageInternal(ccNum, val, nrpnInfo);
        }
    };

    // --- RECIBIR MIDI EN MODO WEB ---

    DualMidiBridge.prototype.handleIncomingMidi = function(midiMessage) {
        this._signalMidiActivity();
        const data = midiMessage.data;
        if (!data || data.length === 0) {return;}

        // 1) Despachar a solicitudes SysEx pendientes
        if (data[0] === 0xF0 && data[data.length - 1] === 0xF7) {
            const msg = new Uint8Array(data);
            const pending = [...this._pendingSysExRequests];
            for (const req of pending) {
                try {
                    if (req.predicate(msg)) {
                        req.resolve(msg);
                        return;
                    }
                } catch (e) {
                    Logger.warn('[SysEx] Error en predicate:', e);
                }
            }
        }

        const status = data[0] & 0xF0;
        // 2) Comprobar si es un mensaje SysEx de volcado de programa o edit buffer
        if (data[0] === 0xF0 && data[1] === 0x00 && data[2] === 0x20 && data[3] === 0x32) {
            const cmd = data[6];
            if (cmd === 0x02 || cmd === 0x04) {
                const headerLen = (cmd === 0x02) ? 10 : 8;
                const payloadLen = 278;
                const expectedMinLen = headerLen + payloadLen + 1; // Cabecera + Payload + F7
                
                if (data.length < expectedMinLen) {
                    Logger.warn('[WebMIDI SysEx] Ignorando dump cmd 0x0' + cmd.toString(16) + ' por longitud insuficiente: ' + data.length + ' bytes (mínimo esperado ' + expectedMinLen + ')');
                    return;
                }

                const packedPayload = data.slice(headerLen, headerLen + payloadLen);
                if (typeof window.unpack7to8 === 'function') {
                    const unpackedBytes = window.unpack7to8(packedPayload);
                    
                    let bankIndex = 0;
                    let progIndex = 0;
                    let bankLetter = 'A';
                    
                    if (cmd === 0x02) {
                        // Cabecera cmd 0x02 (Program Dump Response):
                        //   F0 00 20 32 20 <dev> 02 <proto> <bank> <prog>
                        // (banco/programa en [8]/[9] según el decoder de referencia
                        // patchwork-deepmind; los archivos de fábrica confirman [9]=prog,
                        // con [8]=0 en los dumps exportados).
                        bankIndex = data[8] & 0x07;  // Byte 8 = banco (0-7 = A-H)
                        progIndex = data[9] & 0x7F;  // Byte 9 = programa (0-127)
                        bankLetter = String.fromCharCode(65 + bankIndex);
                    }

                    const patchName = (typeof window.extractNameFromRawSysex === 'function'
                        ? window.extractNameFromRawSysex(data, cmd === 0x02 ? 0 : -2)
                        : undefined) || 'Hw Patch ' + (progIndex + 1);

                    if (this._bankDumpInProgress) {
                        if (this._bankDumpCallback) {
                            try {
                                this._bankDumpCallback({
                                    bankIndex: bankIndex,
                                    bankLetter: bankLetter,
                                    progIndex: progIndex,
                                    patchName: patchName,
                                    unpackedBytes: unpackedBytes
                                });
                            } catch (e) {
                                Logger.warn('[SysEx] Error en bankDumpCallback:', e);
                            }
                        }

                        if (window.hardwareBanks && window.hardwareBanks[bankLetter]) {
                            window.hardwareBanks[bankLetter][progIndex] = {
                                index: progIndex,
                                name: patchName,
                                unpackedBytes: unpackedBytes
                            };
                            Logger.log('[WebMIDI SysEx] Guardado preset de entrada en Hardware ' + bankLetter + '-' + (progIndex+1) + ': ' + patchName);
                            if (typeof window.renderHardwarePatches === 'function' && window.currentHwBankLetter === bankLetter) {
                                window.renderHardwarePatches();
                            }
                        }
                    } else {
                        // Carga espontánea en el editor principal
                        if (typeof window.triggerMidiDump === 'function') {
                            window.triggerMidiDump({
                                name: patchName,
                                unpackedBytes: unpackedBytes
                            });
                            Logger.log('[Bridge] Spontaneous program dump (cmd=0x' + data[6].toString(16) + ') loaded into UI: ' + patchName);
                        }
                    }
                }
            }
            return;
        }

        // 2b) Comprobar si es un mensaje SysEx de volcado de Chord (0x1C) o Poly Chord (0x1E)
        if (data[0] === 0xF0 && data[1] === 0x00 && data[2] === 0x20 && data[3] === 0x32) {
            const command = data[6];
            if (command === 0x1C) {
                Logger.log('[WebMIDI SysEx] Recibido Chord Memory Dump del hardware (' + data.length + ' bytes)');
                if (typeof window.unpack7to8 === 'function' && data.length >= 40) {
                    const packed = data.slice(8, 40);
                    const unpacked = window.unpack7to8(packed);
                    this.parameterCache['chord_notes'] = Array.from(unpacked);
                    this.handleParameterChangeFromBackend('chord_notes', Array.from(unpacked));
                }
            } else if (command === 0x1E) {
                Logger.log('[WebMIDI SysEx] Recibido Poly Chord Memory Dump del hardware (' + data.length + ' bytes)');
                if (typeof window.unpack7to8 === 'function' && data.length >= 600) {
                    const packed = data.slice(8, 600);
                    const unpacked = window.unpack7to8(packed);
                    this.parameterCache['poly_chord_notes'] = Array.from(unpacked);
                    this.handleParameterChangeFromBackend('poly_chord_notes', Array.from(unpacked));
                }
            }
            return;
        }

        if (status === 0xB0) {
            const cc = data[1];
            const val = data[2];

            // --- NRPN INCOMING (extraído a bridge-midi-rx-nrpn-handlers.js) ---
            if (this._handleIncomingNrpn(cc, val)) {
                return;
            }

            // --- CC 0/32: Bank Select ---
            if (cc === 0 || cc === 32) {
                const bankKey = cc === 0 ? '_lastBankSelectMSB' : '_lastBankSelectLSB';
                const prev = this[bankKey];
                this[bankKey] = val;
                if (prev !== val) {
                    Logger.log('[Bridge] Bank Select CC' + cc + ' changed: ' + prev + ' → ' + val);
                    if (typeof this._scheduleAutoDump === 'function') {
                        this._scheduleAutoDump();
                    }
                }
                return;
            }

            // MIDI Learn CC intercept
            if (this.midiLearnActive && cc !== 0 && cc !== 32) {
                this._captureMidiLearnMessage(cc, val, null);
                return;
            }

            // Stored CC MIDI Learn mapping
            const ccKey = 'cc:' + cc;
            if (this._applyMidiLearnMapping(ccKey, val, null)) {
                return;
            }

            // CC estándar fallback
            const normalized = val / 127.0;
            const paramId = this.ccToParam[cc];
            if (paramId) {
                // Route global params through setGlobalParameter for proper _globalParams + SysEx
                if (paramId === 'global_tune' || paramId === 'transpose' ||
                    paramId === 'velocity_curve' || paramId === 'pedal_polarity' ||
                    paramId === 'lcd_contrast') {
                    if (typeof this.setGlobalParameter === 'function') {
                        this.setGlobalParameter(paramId, normalized);
                    }
                } else {
                    this.handleParameterChangeFromBackend(paramId, normalized);
                }
            }
        }

        // 4) Program Change
        if (status === 0xC0) {
            const prog = data[1];
            if (this._lastProgramChange !== prog) {
                Logger.log('[Bridge] Program Change: ' + (this._lastProgramChange !== undefined ? this._lastProgramChange : '-') + ' → ' + prog);
                this._lastProgramChange = prog;
                if (typeof this._scheduleAutoDump === 'function') {
                    this._scheduleAutoDump();
                }
            }
        }
    };

    Logger.log('[Bridge] MIDI RX module loaded');
})();
