/**
 * @purpose Arpeggiator engine for DualMidiBridge — extracted from bridge-engines.js IIFE 1.
 * Adds prototype methods: initArpEngine, _arpStep, _arpKillAllNotes.
 */

(function() {
    if (typeof DualMidiBridge === 'undefined') {
        const Logger = globalThis.Logger || console;
        Logger.warn('[Engines-Arp] DualMidiBridge not found — deferring...');
        return;
    }

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
                if (!self._isSimulatorMode()) {return;} // controlador: el arp lo ejecuta el hardware
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
                if (!self._isSimulatorMode()) {return;} // controlador: no crear timer local
                if (this.running || this.heldNotes.length === 0) {return;}
                this.running = true;
                this.stepIndex = 0;
                this.currentDirection = 1;
                const _self2 = this;
                const bpm = 20 + (self.parameterCache['arp_rate'] || 0.5) * 220;
                const rawClockDiv = self.parameterCache['arp_clock_divider'] !== undefined ? self.parameterCache['arp_clock_divider'] : 0;
                const clockIdx = Math.max(0, Math.min(12, Math.round(rawClockDiv * 12)));
                const stepsPerBeat = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 4.0, 6.0, 8.0, 12.0, 16.0, 24.0][clockIdx] || 1.0;
                let intervalMs = (60000 / bpm) / stepsPerBeat;
                intervalMs = Math.max(20, Math.min(5000, intervalMs));
                this.intervalMs = intervalMs;

                this.timerId = setInterval(function() {
                    self._arpStep(self);
                }, intervalMs);
                const Logger = globalThis.Logger || console;
                Logger.log('[ArpEngine] Started at', Math.round(bpm), 'BPM, steps/beat', stepsPerBeat, 'interval', Math.round(intervalMs) + 'ms');
            },

            stop: function() {
                if (!this.running) {return;}
                this.running = false;
                if (this.timerId) {
                    clearInterval(this.timerId);
                    this.timerId = null;
                }
                self._arpKillAllNotes();
                const Logger = globalThis.Logger || console;
                Logger.log('[ArpEngine] Stopped');
            },

            updateTimer: function() {
                if (!this.running || !self._isSimulatorMode()) {return;}
                const _self2 = this;
                const bpm = 20 + (self.parameterCache['arp_rate'] || 0.5) * 220;
                const rawClockDiv = self.parameterCache['arp_clock_divider'] !== undefined ? self.parameterCache['arp_clock_divider'] : 0;
                const clockIdx = Math.max(0, Math.min(12, Math.round(rawClockDiv * 12)));
                const stepsPerBeat = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 4.0, 6.0, 8.0, 12.0, 16.0, 24.0][clockIdx] || 1.0;
                let intervalMs = (60000 / bpm) / stepsPerBeat;
                intervalMs = Math.max(20, Math.min(5000, intervalMs));

                if (Math.abs(intervalMs - this.intervalMs) > 2) {
                    this.intervalMs = intervalMs;
                    clearInterval(this.timerId);
                    this.timerId = setInterval(function() {
                        self._arpStep(self);
                    }, intervalMs);
                    const Logger = globalThis.Logger || console;
                    Logger.log('[ArpEngine] Updated interval to', Math.round(intervalMs) + 'ms');
                }
            },

            setHeldNotes: function(notes) {
                if (!self._isSimulatorMode()) {return;} // controlador: no computar secuencia
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
        if (!self._isSimulatorMode()) { // controlador: el arp lo ejecuta el hardware
            engine.stop();
            return;
        }

        const held = engine.heldNotes;
        if (held.length === 0) {
            engine.stop();
            return;
        }

        const arpMode = Math.round((self.parameterCache['arp_mode'] || 0) * 10);
        const arpOctave = Math.round((self.parameterCache['arp_octave'] || 0) * 3);
        const gateTime = self.parameterCache['arp_gate_time'] || 0.5;
        const _arpHold = (self.parameterCache['arp_hold'] || 0) > 0.5;
        const _arpKeySync = (self.parameterCache['arp_key_sync'] || 0) > 0.5;

        self._arpKillAllNotes();

        // Calcular paso via función extraída (bridge-engines-arp-modes.js)
        const calcFn = (typeof window._arpCalcStep === 'function') ? window._arpCalcStep : _arpCalcStepFallback;
        const result = calcFn(arpMode, engine.stepIndex, held.length, arpOctave);
        let noteIdx = result.noteIdx;
        let octaveOffset = result.octaveOffset;

        // Clamp octava y reiniciar patrón al superar el límite
        if (octaveOffset > Math.min(arpOctave, 4) * 12) {
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

    /** Fallback: función de cálculo de paso en caso de que bridge-engines-arp-modes.js no esté cargado */
function _arpCalcStepFallback(mode, stepIndex, heldLength, arpOctave) {
    let idx = stepIndex % heldLength;
    let off = Math.floor(stepIndex / heldLength) * 12;
    const maxOct = Math.min(arpOctave, 4);
    if (off > maxOct * 12) { idx = 0; off = 0; }
    return { noteIdx: idx, octaveOffset: off };
}

/** Kill all currently active arp-generated notes */
    DualMidiBridge.prototype._arpKillAllNotes = function() {
        for (let i = 0; i < this._arpActiveNotes.length; i++) {
            this.pianoNoteOff(this._arpActiveNotes[i]);
        }
        this._arpActiveNotes = [];
        if (this._arpNoteOffTimers) {
            for (const key in this._arpNoteOffTimers) {
                clearTimeout(this._arpNoteOffTimers[key]);
            }
            this._arpNoteOffTimers = {};
        }
    };
})();
