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
        if (this._arpEngine) return;
        var self = this;
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
                for (var i = 0; i < this.heldNotes.length; i++) {
                    if (this.heldNotes[i].note === note) return;
                }
                this.heldNotes.push({ note: note, velocity: velocity });
                this.heldNotes.sort(function(a, b) { return a.note - b.note; });
                if (!this.running && self.parameterCache['arp_enable'] > 0.5) {
                    this.start();
                }
            },

            removeHeldNote: function(note) {
                for (var i = 0; i < this.heldNotes.length; i++) {
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
                if (this.running || this.heldNotes.length === 0) return;
                this.running = true;
                this.stepIndex = 0;
                this.currentDirection = 1;
                var self2 = this;
                var bpm = 20 + (self.parameterCache['arp_rate'] || 0.5) * 220;
                var clockDiv = Math.round((self.parameterCache['arp_clock_divider'] || 0) * 12);
                var divider = 1;
                if (clockDiv <= 5) divider = Math.pow(2, clockDiv);
                else if (clockDiv <= 8) divider = 3 * Math.pow(2, clockDiv - 5);
                else if (clockDiv <= 12) divider = 6 * Math.pow(2, clockDiv - 9);
                var intervalMs = (60000 / bpm) / divider;
                intervalMs = Math.max(20, Math.min(5000, intervalMs));

                this.timerId = setInterval(function() {
                    self._arpStep(self);
                }, intervalMs);
                console.log('[ArpEngine] Started at', Math.round(bpm), 'BPM, divider', divider, 'interval', Math.round(intervalMs) + 'ms');
            },

            stop: function() {
                if (!this.running) return;
                this.running = false;
                if (this.timerId) {
                    clearInterval(this.timerId);
                    this.timerId = null;
                }
                self._arpKillAllNotes();
                console.log('[ArpEngine] Stopped');
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
    };

    /** Internal: called by the arp timer. Generates one step of the arpeggio. */
    DualMidiBridge.prototype._arpStep = function(self) {
        if (!self) self = this;
        var engine = self._arpEngine;
        if (!engine || !engine.running) return;

        var held = engine.heldNotes;
        if (held.length === 0) {
            engine.stop();
            return;
        }

        var arpMode = Math.round((self.parameterCache['arp_mode'] || 0) * 10);
        var arpOctave = Math.round((self.parameterCache['arp_octave'] || 0) * 3);
        var gateTime = self.parameterCache['arp_gate_time'] || 0.5;
        var arpHold = (self.parameterCache['arp_hold'] || 0) > 0.5;
        var arpKeySync = (self.parameterCache['arp_key_sync'] || 0) > 0.5;

        self._arpKillAllNotes();

        var noteIdx = engine.stepIndex % held.length;
        var octaveOffset = 0;

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

        var maxOctave = Math.min(arpOctave, 4);
        if (octaveOffset > maxOctave * 12) {
            engine.stepIndex = 0;
            noteIdx = 0;
            octaveOffset = 0;
        }

        engine.stepIndex++;

        if (noteIdx >= 0 && noteIdx < held.length) {
            var h = held[noteIdx];
            var outNote = h.note + octaveOffset;
            if (outNote >= 0 && outNote <= 127) {
                self._arpActiveNotes.push(outNote);
                self.pianoNoteOn(outNote, h.velocity);

                if (gateTime < 0.95) {
                    var offDelay = Math.max(10, Math.round(gateTime * 1000));
                    (function(n) {
                        setTimeout(function() {
                            self.pianoNoteOff(n);
                            var idx = self._arpActiveNotes.indexOf(n);
                            if (idx >= 0) self._arpActiveNotes.splice(idx, 1);
                        }, offDelay);
                    })(outNote);
                }
            }
        }
    };

    /** Kill all currently active arp-generated notes */
    DualMidiBridge.prototype._arpKillAllNotes = function() {
        for (var i = 0; i < this._arpActiveNotes.length; i++) {
            this.pianoNoteOff(this._arpActiveNotes[i]);
        }
        this._arpActiveNotes = [];
    };

    // ================================================================
    // SEQUENCER ENGINE
    // ================================================================

    /** Initialize the sequencer engine. Call once. */
    DualMidiBridge.prototype.initSeqEngine = function() {
        if (this._seqEngine) return;
        var self = this;
        this._seqEngine = {
            running: false,
            stepIndex: 0,
            timerId: null,
            previousValues: new Array(32).fill(0),
            heldNotes: [],
            _forcedFreeRunning: false, // true cuando _updateSeqEngine auto-forzó Free Running

            addHeldNote: function(note, velocity) {
                for (var i = 0; i < this.heldNotes.length; i++) {
                    if (this.heldNotes[i].note === note) return;
                }
                this.heldNotes.push({ note: note, velocity: velocity });
                var seqEn = self.parameterCache['seq_enable'] || 0;
                var keyLoop = Math.round((self.parameterCache['seq_key_loop'] || 0) * 2);
                var needsKeySync = (keyLoop === 1 || keyLoop === 2);
                if (seqEn > 0.5 && !this.running && needsKeySync) {
                    this.start();
                }
            },

            removeHeldNote: function(note) {
                for (var i = 0; i < this.heldNotes.length; i++) {
                    if (this.heldNotes[i].note === note) {
                        this.heldNotes.splice(i, 1);
                        break;
                    }
                }
                var keyLoop = Math.round((self.parameterCache['seq_key_loop'] || 0) * 2);
                var needsKeySync = (keyLoop === 1 || keyLoop === 2);
                if (this.heldNotes.length === 0 && this.running && needsKeySync) {
                    this.stop();
                }
            },

            start: function() {
                if (this.running) return;
                this.running = true;
                this.stepIndex = 0;
                var self2 = this;

                var bpm = 20 + (self.parameterCache['arp_rate'] || 0.5) * 220;
                var clockVal = Math.round((self.parameterCache['seq_clock'] || 0) * 15);
                var divider = [2, 8 / 3, 3, 4, 16 / 3, 6, 8, 12, 16, 24, 32][clockVal] || 4;
                var intervalMs = (60000 / bpm) / divider;
                intervalMs = Math.max(20, Math.min(5000, intervalMs));

                this.timerId = setInterval(function() {
                    self2._seqStep(self);
                }, intervalMs);
                console.log('[SeqEngine] Started, interval', Math.round(intervalMs) + 'ms');
            },

            stop: function() {
                if (!this.running) return;
                this.running = false;
                if (this.timerId) {
                    clearInterval(this.timerId);
                    this.timerId = null;
                }
                console.log('[SeqEngine] Stopped');
            },

            _seqStep: function(bridge) {
                var eng = bridge._seqEngine;
                if (!eng || !eng.running) return;

                var keyLoop = Math.round((bridge.parameterCache['seq_key_loop'] || 0) * 2);
                var needsKeySync = (keyLoop === 1 || keyLoop === 2);

                if (needsKeySync && eng.heldNotes.length === 0) {
                    return;
                }

                var seqLength = Math.round((bridge.parameterCache['seq_length'] || 0) * 31) + 2;
                var swing = bridge.parameterCache['seq_swing'] || 0;
                var slewRate = bridge.parameterCache['seq_slew_rate'] || 0;

                var stepIdx = eng.stepIndex % seqLength;
                var paramId = 'seq_step_' + (stepIdx + 1);
                var stepVal = bridge.parameterCache[paramId];
                var isSkip = false;
                if (stepVal !== undefined && stepVal < 0.001 && Math.round(stepVal * 255) === 0) {
                    isSkip = true;
                }
                if (stepVal === undefined) {
                    var raw = bridge.parameterCache['seq_step_' + (stepIdx + 1) + '_raw'];
                    if (raw === 0) {
                        isSkip = true;
                    }
                    stepVal = stepVal || 0.5;
                }

                if (!isSkip) {
                    var prev = eng.previousValues[stepIdx];
                    if (prev !== undefined && slewRate > 0.01) {
                        var slewFactor = Math.max(0.01, 1.0 - (slewRate * 0.5));
                        stepVal = prev + (stepVal - prev) * (1 - slewFactor);
                    }
                    eng.previousValues[stepIdx] = stepVal;
                }

                bridge.parameterCache['seq_current_value'] = stepVal;
                bridge.parameterCache['seq_current_step'] = stepIdx;
                bridge.parameterCache['seq_current_step_skip'] = isSkip ? 1.0 : 0.0;
                bridge.handleParameterChangeFromBackend('seq_current_value', stepVal);

                var ccMap = window.BRIDGE_PARAM_MAPS.PARAM_TO_CC;
                var cc = ccMap['seq_current_value'];
                if (cc !== undefined && bridge.midiOutput) {
                    var midiVal = Math.round(stepVal * 127);
                    bridge.midiOutput.send([0xB0 | (bridge.midiChannel - 1), cc, midiVal]);
                }

                bridge._signalMidiActivity();
                eng.stepIndex++;
            }
        };

        for (var i = 0; i < 32; i++) {
            this._seqEngine.previousValues[i] = 0;
        }
    };

    /** Start/stop the sequencer based on seq_enable param. Respects key sync mode. */
    DualMidiBridge.prototype._updateSeqEngine = function() {
        var seqEn = this.parameterCache['seq_enable'] || 0;
        if (!this._seqEngine) this.initSeqEngine();
        var keyLoop = Math.round((this.parameterCache['seq_key_loop'] || 0) * 2);
        var needsKeySync = (keyLoop === 1 || keyLoop === 2);

        if (seqEn > 0.5) {
            if (!needsKeySync || this._seqEngine.heldNotes.length > 0) {
                this._seqEngine.start();
            } else {
                // Key Sync pero sin notas presionadas → forzar Free Running (seq_key_loop=0)
                // para que el secuenciador arranque al activarlo desde el frontal.
                this.parameterCache['seq_key_loop'] = 0;
                this._seqEngine._forcedFreeRunning = true;
                // Sincronizar el cambio con la UI (modal SEQ) y el hardware
                this.handleParameterChangeFromBackend('seq_key_loop', 0);
                this._seqEngine.start();
            }
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
    var _initAttempts = 0;
    var _maxInitAttempts = 200; // 200 × 50ms = 10s timeout
    var checkBridge = setInterval(function() {
        _initAttempts++;
        if (_initAttempts > _maxInitAttempts) {
            clearInterval(checkBridge);
            console.warn('[Bridge] Engine init timeout — bridge not available after 10s');
            return;
        }
        var bridge = window.dualMidiBridge;
        if (bridge && typeof bridge.startAutoReconnect === 'function') {
            clearInterval(checkBridge);

            // Start auto-reconnect (non-JUCE mode)
            bridge.startAutoReconnect();

            // Initialize arp engine
            bridge.initArpEngine();

            // Initialize seq engine
            bridge.initSeqEngine();

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
                });
            }

            console.log('[Bridge] Engine initialization complete');
        }
    }, 50);
})();
