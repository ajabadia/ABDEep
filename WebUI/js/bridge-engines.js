/**
 * @purpose Motores de Arpeggiator y Sequencer para DualMidiBridge — añade métodos al prototipo + init engines.
 * @purpose_en Arpeggiator and Sequencer engines for DualMidiBridge — adds prototype methods + engine initialization.
 * @classification Module/Engines
 * @complexity High
 * @lastUpdated 2026-07-10
 */

// --- Motores Arp + Seq — se añaden al prototipo tras la definición de la clase ---
(function() {
    if (typeof DualMidiBridge === 'undefined') {
        console.warn('[Engines] DualMidiBridge not found — deferring...');
        return;
    }

    // ================================================================
    // ARPEGGIATOR ENGINE
    // ================================================================

    /** Initialize the arpeggiator engine. Call once. */
    DualMidiBridge.prototype.initArpEngine = function() {
        if (this._arpEngine) {return;}
        const self = this;
        this._arpEngine = {
            heldNotes: [],
            running: false,
            stepIndex: 0,
            timerId: null,
            currentDirection: 1,

            isRunning: function() {
                return this.running;
            },

            addHeldNote: function(note, velocity) {
                for (let i = 0; i < this.heldNotes.length; i++) {
                    if (this.heldNotes[i].note === note) {return;}
                }
                this.heldNotes.push({ note: note, velocity: velocity });
                this.heldNotes.sort(function(a, b) { return a.note - b.note; });
                if (!this.running && self.parameterCache['arp_enable'] > 0.5) {
                    this.start();
                }
            },

            removeHeldNote: function(note) {
                for (let i = 0; i < this.heldNotes.length; i++) {
                    if (this.heldNotes[i].note === note) {
                        this.heldNotes.splice(i, 1);
                        break;
                    }
                }
                if (this.heldNotes.length === 0) {
                    this.stop();
                }
            },

            start: function() {
                if (this.running || this.heldNotes.length === 0) {return;}
                this.running = true;
                this.stepIndex = 0;
                this.currentDirection = 1;
                const self2 = this;
                const bpm = 20 + (self.parameterCache['arp_rate'] || 0.5) * 220;
                const clockDiv = Math.round((self.parameterCache['arp_clock_divider'] || 0) * 12);
                let divider = 1;
                if (clockDiv <= 5) {divider = Math.pow(2, clockDiv);}
                else if (clockDiv <= 8) {divider = 3 * Math.pow(2, clockDiv - 5);}
                else if (clockDiv <= 12) {divider = 6 * Math.pow(2, clockDiv - 9);}
                let intervalMs = (60000 / bpm) / divider;
                intervalMs = Math.max(20, Math.min(5000, intervalMs));
                this.intervalMs = intervalMs;

                this.timerId = setInterval(function() {
                    self._arpStep(self);
                }, intervalMs);
                console.log('[ArpEngine] Started at', Math.round(bpm), 'BPM, divider', divider, 'interval', Math.round(intervalMs) + 'ms');
            },

            stop: function() {
                if (!this.running) {return;}
                this.running = false;
                if (this.timerId) {
                    clearInterval(this.timerId);
                    this.timerId = null;
                }
                self._arpKillAllNotes();
                console.log('[ArpEngine] Stopped');
            },

            updateTimer: function() {
                if (!this.running) {return;}
                const self2 = this;
                const bpm = 20 + (self.parameterCache['arp_rate'] || 0.5) * 220;
                const clockDiv = Math.round((self.parameterCache['arp_clock_divider'] || 0) * 12);
                let divider = 1;
                if (clockDiv <= 5) {divider = Math.pow(2, clockDiv);}
                else if (clockDiv <= 8) {divider = 3 * Math.pow(2, clockDiv - 5);}
                else if (clockDiv <= 12) {divider = 6 * Math.pow(2, clockDiv - 9);}
                let intervalMs = (60000 / bpm) / divider;
                intervalMs = Math.max(20, Math.min(5000, intervalMs));
                this.intervalMs = intervalMs;

                if (this.timerId) {
                    clearInterval(this.timerId);
                }
                this.timerId = setInterval(function() {
                    self._arpStep(self);
                }, intervalMs);
                console.log('[ArpEngine] Updated interval to', Math.round(intervalMs) + 'ms');
            },

            setHeldNotes: function(notes) {
                this.heldNotes = notes;
                if (this.heldNotes.length > 0 && !this.running) {
                    this.start();
                } else if (this.heldNotes.length === 0 && this.running) {
                    this.stop();
                }
            }
        };

        this._arpActiveNotes = [];
        this._arpNoteOffTimers = {};
    };

    /** Internal: called by the arp timer. Generates one step of the arpeggio. */
    DualMidiBridge.prototype._arpStep = function(self) {
        if (!self) {self = this;}
        const engine = self._arpEngine;
        if (!engine || !engine.running) {return;}

        const held = engine.heldNotes;
        if (held.length === 0) {
            engine.stop();
            return;
        }

        const arpMode = Math.round((self.parameterCache['arp_mode'] || 0) * 10);
        const arpOctave = Math.round((self.parameterCache['arp_octave'] || 0) * 3);
        const gateTime = self.parameterCache['arp_gate_time'] || 0.5;
        const arpHold = (self.parameterCache['arp_hold'] || 0) > 0.5;
        const arpKeySync = (self.parameterCache['arp_key_sync'] || 0) > 0.5;

        self._arpKillAllNotes();

        let noteIdx = engine.stepIndex % held.length;
        let octaveOffset = 0;

        switch (arpMode) {
            case 0:
                noteIdx = engine.stepIndex % held.length;
                octaveOffset = Math.floor(engine.stepIndex / held.length) * 12;
                break;
            case 1:
                noteIdx = (held.length - 1) - (engine.stepIndex % held.length);
                octaveOffset = Math.floor(engine.stepIndex / held.length) * 12;
                break;
            case 2:
                var cycleLen = held.length * 2 - (held.length > 1 ? 2 : 1);
                var pos = engine.stepIndex % cycleLen;
                if (pos < held.length) {
                    noteIdx = pos;
                } else {
                    noteIdx = cycleLen - pos;
                }
                octaveOffset = Math.floor(engine.stepIndex / cycleLen) * 12;
                break;
            case 3:
                noteIdx = engine.stepIndex % held.length;
                octaveOffset = Math.floor(engine.stepIndex / held.length) * 12;
                break;
            case 4:
                noteIdx = (held.length - 1) - (engine.stepIndex % held.length);
                octaveOffset = Math.floor(engine.stepIndex / held.length) * 12;
                break;
            case 5:
                var cycleLen2 = held.length * 2 - (held.length > 1 ? 2 : 1);
                var pos2 = engine.stepIndex % cycleLen2;
                if (pos2 < held.length) {
                    noteIdx = pos2;
                } else {
                    noteIdx = cycleLen2 - pos2;
                }
                octaveOffset = Math.floor(engine.stepIndex / cycleLen2) * 12;
                break;
            case 6:
                noteIdx = engine.stepIndex % held.length;
                octaveOffset = (Math.floor(engine.stepIndex / held.length) % 2) * 12;
                break;
            case 7:
                noteIdx = (held.length - 1) - (engine.stepIndex % held.length);
                octaveOffset = (Math.floor(engine.stepIndex / held.length) % 2) * 12;
                break;
            case 8:
                noteIdx = Math.floor(Math.random() * held.length);
                octaveOffset = Math.floor(Math.random() * (arpOctave + 1)) * 12;
                break;
            case 9:
                noteIdx = engine.stepIndex % held.length;
                octaveOffset = Math.floor(engine.stepIndex / held.length) * 12;
                break;
            default:
                noteIdx = engine.stepIndex % held.length;
        }

        const maxOctave = Math.min(arpOctave, 4);
        if (octaveOffset > maxOctave * 12) {
            engine.stepIndex = 0;
            noteIdx = 0;
            octaveOffset = 0;
        }

        engine.stepIndex++;

        if (noteIdx >= 0 && noteIdx < held.length) {
            const h = held[noteIdx];
            const outNote = h.note + octaveOffset;
            if (outNote >= 0 && outNote <= 127) {
                self._arpActiveNotes.push(outNote);
                self.pianoNoteOn(outNote, h.velocity);

                if (gateTime < 0.95) {
                    const intervalMs = engine.intervalMs || 200;
                    const offDelay = Math.max(10, Math.round(gateTime * intervalMs));
                    (function(n) {
                        // Cancelar timer pendiente previo para evitar race condition
                        if (self._arpNoteOffTimers[n] !== undefined) {
                            clearTimeout(self._arpNoteOffTimers[n]);
                        }
                        self._arpNoteOffTimers[n] = setTimeout(function() {
                            self.pianoNoteOff(n);
                            delete self._arpNoteOffTimers[n];
                            const idx = self._arpActiveNotes.indexOf(n);
                            if (idx >= 0) {self._arpActiveNotes.splice(idx, 1);}
                        }, offDelay);
                    })(outNote);
                }
            }
        }
    };

    /** Kill all currently active arp-generated notes */
    DualMidiBridge.prototype._arpKillAllNotes = function() {
        for (let i = 0; i < this._arpActiveNotes.length; i++) {
            this.pianoNoteOff(this._arpActiveNotes[i]);
        }
        this._arpActiveNotes = [];
        // Cancelar todos los note-off timers pendientes
        if (this._arpNoteOffTimers) {
            for (const key in this._arpNoteOffTimers) {
                clearTimeout(this._arpNoteOffTimers[key]);
            }
            this._arpNoteOffTimers = {};
        }
    };

    // ================================================================
    // SEQUENCER ENGINE
    // ================================================================

    /** Initialize the sequencer engine. Call once. */
    DualMidiBridge.prototype.initSeqEngine = function() {
        if (this._seqEngine) {return;}
        const self = this;
        this._seqEngine = {
            running: false,
            stepIndex: 0,
            timerId: null,
            previousValues: new Array(32).fill(0),
            heldNotes: [],
            _forcedFreeRunning: false, // true cuando _updateSeqEngine auto-forzó Free Running

            addHeldNote: function(note, velocity) {
                for (let i = 0; i < this.heldNotes.length; i++) {
                    if (this.heldNotes[i].note === note) {return;}
                }
                this.heldNotes.push({ note: note, velocity: velocity });
                const seqEn = self.parameterCache['seq_enable'] || 0;
                const keyLoop = Math.round((self.parameterCache['seq_key_loop'] || 0) * 2);
                const needsKeySync = (keyLoop === 1 || keyLoop === 2);
                if (seqEn > 0.5 && !this.running && needsKeySync) {
                    this.start();
                }
            },

            removeHeldNote: function(note) {
                for (let i = 0; i < this.heldNotes.length; i++) {
                    if (this.heldNotes[i].note === note) {
                        this.heldNotes.splice(i, 1);
                        break;
                    }
                }
                const keyLoop = Math.round((self.parameterCache['seq_key_loop'] || 0) * 2);
                const needsKeySync = (keyLoop === 1 || keyLoop === 2);
                if (this.heldNotes.length === 0 && this.running && needsKeySync) {
                    this.stop();
                }
            },

            start: function() {
                if (this.running) {return;}
                this.running = true;
                this.stepIndex = 0;
                const self2 = this;

                const bpm = 20 + (self.parameterCache['arp_rate'] || 0.5) * 220;
                const clockVal = Math.round((self.parameterCache['seq_clock'] || 0) * 15);
                const divider = [2, 8 / 3, 3, 4, 16 / 3, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192][clockVal] || 4;
                let intervalMs = (60000 / bpm) / divider;
                intervalMs = Math.max(20, Math.min(5000, intervalMs));

                this.timerId = setInterval(function() {
                    self2._seqStep(self);
                }, intervalMs);
                console.log('[SeqEngine] Started, interval', Math.round(intervalMs) + 'ms');
            },

            stop: function() {
                if (!this.running) {return;}
                this.running = false;
                if (this.timerId) {
                    clearInterval(this.timerId);
                    this.timerId = null;
                }
                console.log('[SeqEngine] Stopped');
            },

            updateTimer: function() {
                if (!this.running) {return;}
                const self2 = this;
                const bpm = 20 + (self.parameterCache['arp_rate'] || 0.5) * 220;
                const clockVal = Math.round((self.parameterCache['seq_clock'] || 0) * 15);
                const divider = [2, 8 / 3, 3, 4, 16 / 3, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192][clockVal] || 4;
                let intervalMs = (60000 / bpm) / divider;
                intervalMs = Math.max(20, Math.min(5000, intervalMs));

                if (this.timerId) {
                    clearInterval(this.timerId);
                }
                this.timerId = setInterval(function() {
                    self2._seqStep(self);
                }, intervalMs);
                console.log('[SeqEngine] Updated interval to', Math.round(intervalMs) + 'ms');
            },

            _seqStep: function(bridge) {
                const eng = bridge._seqEngine;
                if (!eng || !eng.running) {return;}

                const keyLoop = Math.round((bridge.parameterCache['seq_key_loop'] || 0) * 2);
                const needsKeySync = (keyLoop === 1 || keyLoop === 2);

                if (needsKeySync && eng.heldNotes.length === 0) {
                    return;
                }

                const seqLength = Math.round((bridge.parameterCache['seq_length'] || 0) * 31) + 2;
                const swing = bridge.parameterCache['seq_swing'] || 0;
                const slewRate = bridge.parameterCache['seq_slew_rate'] || 0;

                const stepIdx = eng.stepIndex % seqLength;
                const paramId = 'seq_step_' + (stepIdx + 1);
                let stepVal = bridge.parameterCache[paramId];
                let isSkip = false;
                if (stepVal !== undefined && stepVal < 0.001 && Math.round(stepVal * 255) === 0) {
                    isSkip = true;
                }
                if (stepVal === undefined) {
                    const raw = bridge.parameterCache['seq_step_' + (stepIdx + 1) + '_raw'];
                    if (raw !== undefined && raw === 0) {
                        isSkip = true;
                    }
                    stepVal = isSkip ? 0.0 : (stepVal || 0.5);
                }

                if (!isSkip) {
                    const prev = eng.previousValues[stepIdx];
                    if (prev !== undefined && slewRate > 0.01) {
                        const slewFactor = Math.max(0.01, 1.0 - (slewRate * 0.5));
                        stepVal = prev + (stepVal - prev) * (1 - slewFactor);
                    }
                    eng.previousValues[stepIdx] = stepVal;
                }

                bridge.parameterCache['seq_current_value'] = stepVal;
                bridge.parameterCache['seq_current_step'] = stepIdx;
                bridge.parameterCache['seq_current_step_skip'] = isSkip ? 1.0 : 0.0;
                bridge.handleParameterChangeFromBackend('seq_current_value', stepVal);

                const ccMap = window.BRIDGE_PARAM_MAPS && window.BRIDGE_PARAM_MAPS.PARAM_TO_CC;
                const cc = ccMap['seq_current_value'];
                if (cc !== undefined && bridge.midiOutput) {
                    const midiVal = Math.round(stepVal * 127);
                    bridge.midiOutput.send([0xB0 | (bridge.midiChannel - 1), cc, midiVal]);
                }

                bridge._signalMidiActivity();
                eng.stepIndex++;
            }
        };

        for (let i = 0; i < 32; i++) {
            this._seqEngine.previousValues[i] = 0;
        }
    };

    /** Start/stop the sequencer based on seq_enable param. Respects key sync mode. */
    DualMidiBridge.prototype._updateSeqEngine = function() {
        const seqEn = this.parameterCache['seq_enable'] || 0;
        if (!this._seqEngine) {this.initSeqEngine();}
        const keyLoop = Math.round((this.parameterCache['seq_key_loop'] || 0) * 2);
        const needsKeySync = (keyLoop === 1 || keyLoop === 2);

        if (seqEn > 0.5) {
            if (!needsKeySync || this._seqEngine.heldNotes.length > 0) {
                this._seqEngine.start();
            }
            // When needsKeySync && heldNotes.length === 0, keep sequencer stopped
            // It will start when addHeldNote is called
        } else {
            if (this._seqEngine) {
                this._seqEngine._forcedFreeRunning = false;
                this._seqEngine.stop();
            }
        }
    };

    console.log('[Bridge] Engines module loaded');
})();

// --- Inicialización de motores después de la creación del bridge ---
// Se ejecuta cuando el bridge ya existe y los módulos están cargados
(function() {
    let _initAttempts = 0;
    const _maxInitAttempts = 200; // 200 × 50ms = 10s timeout
    var checkBridge = setInterval(function() {
        _initAttempts++;
        if (_initAttempts > _maxInitAttempts) {
            clearInterval(checkBridge);
            console.warn('[Bridge] Engine init timeout — bridge not available after 10s');
            return;
        }
        const bridge = window.dualMidiBridge;
        if (bridge && typeof bridge.startAutoReconnect === 'function') {
            clearInterval(checkBridge);

            // Start auto-reconnect (non-JUCE mode)
            bridge.startAutoReconnect();

            // Initialize arp engine
            bridge.initArpEngine();

            // Initialize seq engine
            bridge.initSeqEngine();

            // Initialize chord memory
            if (typeof window._initChordMemory === 'function') {
                window._initChordMemory();
            }

            // Initialize poly chord notes
            if (typeof window._initPolyChordNotes === 'function') {
                window._initPolyChordNotes();
            }

            // Wire arp_enable changes to arp engine start/stop
            if (typeof bridge.onParameterChanged === 'function') {
                bridge.onParameterChanged(function(paramId, val) {
                    if (paramId === 'arp_enable') {
                        if (val > 0.5 && bridge._arpEngine && bridge._arpEngine.heldNotes.length > 0) {
                            bridge._arpEngine.start();
                        } else if (bridge._arpEngine) {
                            bridge._arpEngine.stop();
                        }
                    }
                    if (paramId === 'seq_enable') {
                        bridge._updateSeqEngine();
                    }
                    if (paramId === 'seq_key_loop') {
                        // El usuario cambió manualmente el modo Key Loop → limpiar el flag
                        // de Free Running forzado para que el LCD muestre el modo real.
                        if (bridge._seqEngine) {
                            bridge._seqEngine._forcedFreeRunning = false;
                        }
                    }
                    if (paramId === 'seq_clock' && bridge._seqEngine) {
                        bridge._seqEngine.updateTimer();
                    }
                    if (paramId === 'arp_rate') {
                        if (bridge._arpEngine) {bridge._arpEngine.updateTimer();}
                        if (bridge._seqEngine) {bridge._seqEngine.updateTimer();}
                    }
                    if (paramId === 'arp_clock_divider' && bridge._arpEngine) {
                        bridge._arpEngine.updateTimer();
                    }
                });
            }

            console.log('[Bridge] Engine initialization complete');
        }
    }, 50);
})();
