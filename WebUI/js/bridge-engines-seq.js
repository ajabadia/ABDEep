/**
 * @purpose Sequencer engine for DualMidiBridge — extracted from bridge-engines.js IIFE 1.
 * Adds prototype methods: initSeqEngine, _updateSeqEngine.
 */

(function() {
    if (typeof DualMidiBridge === 'undefined') {
        const Logger = globalThis.Logger || console;
        Logger.warn('[Engines-Seq] DualMidiBridge not found — deferring...');
        return;
    }

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
            _forcedFreeRunning: false,

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
                if (!self._isSimulatorMode()) {return;} // controlador: el sequencer lo ejecuta el hardware
                if (this.running) {return;}
                this.running = true;
                this.stepIndex = 0;
                const self2 = this;

                const bpm = 20 + (self.parameterCache['arp_rate'] || 0.5) * 220;
                const rawClockVal = self.parameterCache['seq_clock'] !== undefined ? self.parameterCache['seq_clock'] : 3 / 15;
                const clockIdx = Math.max(0, Math.min(15, Math.round(rawClockVal * 15)));
                const stepsPerBeat = [0.5, 2.0 / 3.0, 0.75, 1.0, 4.0 / 3.0, 1.5, 2.0, 3.0, 4.0, 6.0, 8.0, 12.0, 16.0, 24.0, 32.0, 48.0][clockIdx] || 1.0;
                let intervalMs = (60000 / bpm) / stepsPerBeat;
                intervalMs = Math.max(20, Math.min(5000, intervalMs));
                this.intervalMs = intervalMs;

                this.timerId = setInterval(function() {
                    self2._seqStep(self);
                }, intervalMs);
                const Logger = globalThis.Logger || console;
                Logger.log('[SeqEngine] Started, steps/beat', stepsPerBeat, 'interval', Math.round(intervalMs) + 'ms');
            },

            stop: function() {
                if (!this.running) {return;}
                this.running = false;
                if (this.timerId) {
                    clearInterval(this.timerId);
                    this.timerId = null;
                }
                const Logger = globalThis.Logger || console;
                Logger.log('[SeqEngine] Stopped');
            },

            updateTimer: function() {
                if (!this.running || !self._isSimulatorMode()) {return;}
                const self2 = this;
                const bpm = 20 + (self.parameterCache['arp_rate'] || 0.5) * 220;
                const rawClockVal = self.parameterCache['seq_clock'] !== undefined ? self.parameterCache['seq_clock'] : 3 / 15;
                const clockIdx = Math.max(0, Math.min(15, Math.round(rawClockVal * 15)));
                const stepsPerBeat = [0.5, 2.0 / 3.0, 0.75, 1.0, 4.0 / 3.0, 1.5, 2.0, 3.0, 4.0, 6.0, 8.0, 12.0, 16.0, 24.0, 32.0, 48.0][clockIdx] || 1.0;
                let intervalMs = (60000 / bpm) / stepsPerBeat;
                intervalMs = Math.max(20, Math.min(5000, intervalMs));

                if (Math.abs(intervalMs - (this.intervalMs || 0)) > 2) {
                    this.intervalMs = intervalMs;
                    if (this.timerId) {
                        clearInterval(this.timerId);
                    }
                    this.timerId = setInterval(function() {
                        self2._seqStep(self);
                    }, intervalMs);
                    const Logger = globalThis.Logger || console;
                    Logger.log('[SeqEngine] Updated interval to', Math.round(intervalMs) + 'ms');
                }
            },

            _seqStep: function(bridge) {
                const eng = bridge._seqEngine;
                if (!eng || !eng.running) {return;}
                if (!bridge._isSimulatorMode()) { // controlador: el sequencer lo ejecuta el hardware
                    eng.stop();
                    return;
                }

                const keyLoop = Math.round((bridge.parameterCache['seq_key_loop'] || 0) * 2);
                const needsKeySync = (keyLoop === 1 || keyLoop === 2);

                if (needsKeySync && eng.heldNotes.length === 0) {
                    return;
                }

                const seqLength = Math.round((bridge.parameterCache['seq_length'] || 0) * 31) + 2;
                const _swing = bridge.parameterCache['seq_swing'] || 0;
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
        if (!this._isSimulatorMode()) {return;} // controlador: el sequencer lo ejecuta el hardware
        const seqEn = this.parameterCache['seq_enable'] || 0;
        if (!this._seqEngine) {this.initSeqEngine();}
        const keyLoop = Math.round((this.parameterCache['seq_key_loop'] || 0) * 2);
        const needsKeySync = (keyLoop === 1 || keyLoop === 2);

        if (seqEn > 0.5) {
            if (!needsKeySync || this._seqEngine.heldNotes.length > 0) {
                this._seqEngine.start();
            }
        } else {
            if (this._seqEngine) {
                this._seqEngine._forcedFreeRunning = false;
                this._seqEngine.stop();
            }
        }
    };
})();
