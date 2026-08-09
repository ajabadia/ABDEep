/**
 * @purpose WasmBridge Manager: mode management, gesture init, and delegation to extracted audio/synth modules.
 * AudioContext init/loop/worklet → wasm_bridge_audio.js
 * Web Audio fallback synthesizer (noteOn/noteOff) → wasm_bridge_synth.js
 *
 * Operating Modes:
 *   1. 'deepmind_hw_controller': Pure canonical MIDI SysEx/NRPN hardware editor.
 *   2. 'deepmind_web_standalone': Canonical synth engine playing 100% in browser via Web Audio / WASM.
 *   3. 'abyssmind_pro': Extended super-synth (32 slots ModMatrix, 57 FX, Moog/MS20 filters).
 */

(function() {
    'use strict';

    /* global _wasmInitAudioContext, _wasmLoadAudioWorklet, _wasmStartScopeLoop */
    /* global _wasmGetAudioOutputDevices, _wasmSetAudioOutputDevice, _wasmUpdateAudioButtonUI */
    /* global _wasmNoteOn, _wasmNoteOff */

    class WasmBridge {
        constructor() {
            this.audioCtx = null;
            this.masterGain = null;
            this.analyser = null;
            this.workletNode = null;
            this.isAudioStarted = false;
            this._isInitializing = false;
            this.isWasmActive = false;
            this.currentMode = localStorage.getItem('abd-eep-operating-mode') || 'abyssmind_pro';
            this.activeVoices = {};
            this._scopeLoopId = null;
            // Fase 5 (§1.1): capabilities del modelo vigente (dm12_hardware | abyssmind_pro).
            this.capabilities = this._resolveCapabilities(this.currentMode);
        }

        /** Resuelve las ModelCapabilities para un modo (null si el módulo no está cargado). */
        _resolveCapabilities(mode) {
            if (typeof window !== 'undefined' && window.ModelCapabilities
                    && typeof window.ModelCapabilities.getCapabilitiesForMode === 'function') {
                return window.ModelCapabilities.getCapabilitiesForMode(mode);
            }
            return null;
        }

        /** Devuelve las capabilities del modelo vigente (objeto congelado o null). */
        getCapabilities() {
            return this.capabilities;
        }

        /** Índice ModelCapabilities del modo (0=dm12_hardware, 1=abyssmind_pro). */
        _modelIndexForMode(mode) {
            if (typeof window !== 'undefined' && window.ModelCapabilities
                    && typeof window.ModelCapabilities.resolveModel === 'function') {
                return window.ModelCapabilities.resolveModel(mode) === 'dm12_hardware' ? 0 : 1;
            }
            // Fallback sin el módulo: todo lo que no sea abyssmind_pro es hardware DM12.
            return (mode === 'abyssmind_pro') ? 1 : 0;
        }

        getMode() {
            return this.currentMode;
        }

        setMode(newMode) {
            if (!['deepmind_hw_controller', 'deepmind_web_standalone', 'abyssmind_pro'].includes(newMode)) {
                newMode = 'abyssmind_pro';
            }
            this.currentMode = newMode;
            this.capabilities = this._resolveCapabilities(newMode);
            localStorage.setItem('abd-eep-operating-mode', newMode);
            window.appMode = (newMode === 'deepmind_hw_controller') ? 'standard' : 'advanced';
            localStorage.setItem('abd-eep-app-mode', window.appMode);

            // Fase 5 (§1.1): notifica el modelo al DSP WASM (wasm_set_model) para
            // que bridge JS y motor C++ no diverjan. Si el worklet no maneja el
            // mensaje (build antiguo), lo ignora sin error.
            if (this.workletNode && this.workletNode.port) {
                this.workletNode.port.postMessage({ type: 'set_model', model: this._modelIndexForMode(newMode) });
            }

            this._updateModeUI();

            const lcdUpdate = window.lcdSafeUpdate || function() {};
            const modeLabels = {
                'deepmind_hw_controller': 'MODE: DM12 HW CONTROLLER',
                'deepmind_web_standalone': 'MODE: DM12 WEB STANDALONE',
                'abyssmind_pro': 'MODE: ABYSSMIND PRO (WEB+HW)'
            };
            lcdUpdate(modeLabels[newMode] || 'MODE: ABYSSMIND PRO (WEB+HW)');
        }

        _updateModeUI() {
            const selector = document.getElementById('app-operating-mode-select');
            if (selector) {selector.value = this.currentMode;}

            const audioBtn = document.getElementById('wasm-audio-toggle-btn');
            if (audioBtn) {
                audioBtn.style.display = (this.currentMode !== 'deepmind_hw_controller') ? 'inline-flex' : 'none';
            }
        }

        // ─── Audio Context Management (delegated to wasm_bridge_audio.js) ───

        initAudioContext() {
            return typeof window._wasmInitAudioContext === 'function'
                ? window._wasmInitAudioContext(this)
                : false;
        }

        _loadAudioWorklet() {
            if (typeof window._wasmLoadAudioWorklet === 'function') {
                return window._wasmLoadAudioWorklet(this);
            }
        }

        _startOscilloscopeLoop() {
            if (typeof window._wasmStartScopeLoop === 'function') {
                window._wasmStartScopeLoop(this);
            }
        }

        async getAudioOutputDevices() {
            return typeof window._wasmGetAudioOutputDevices === 'function'
                ? window._wasmGetAudioOutputDevices()
                : [];
        }

        async setAudioOutputDevice(deviceId) {
            return typeof window._wasmSetAudioOutputDevice === 'function'
                ? window._wasmSetAudioOutputDevice(this, deviceId)
                : false;
        }

        _updateAudioButtonUI(active) {
            if (typeof window._wasmUpdateAudioButtonUI === 'function') {
                window._wasmUpdateAudioButtonUI(active);
            }
        }

        // ─── Synthesizer (delegated to wasm_bridge_synth.js) ───

        noteOn(note, velocity) {
            if (velocity === undefined) {velocity = 0.8;}
            if (this.currentMode === 'deepmind_hw_controller') {return;}

            this.initAudioContext();
            if (!this.audioCtx || !this.masterGain) {return;}

            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume().catch(function() {});
            }

            // Forward to AudioWorklet DSP (when available)
            if (this.workletNode && this.workletNode.port) {
                this.workletNode.port.postMessage({ type: 'note_on', note: note, velocity: velocity });
            }

            // If WASM DSP engine is active, skip the fallback synthesis
            if (this.isWasmActive) {return;}

            // Fallback: Web Audio API subtractive synthesizer
            if (typeof window._wasmNoteOn === 'function') {
                window._wasmNoteOn(this, note, velocity);
            }
        }

        noteOff(note) {
            if (this.currentMode === 'deepmind_hw_controller') {return;}

            // Forward to AudioWorklet DSP
            if (this.workletNode && this.workletNode.port) {
                this.workletNode.port.postMessage({ type: 'note_off', note: note });
            }

            if (this.isWasmActive) {return;}

            // Fallback: release voice
            if (typeof window._wasmNoteOff === 'function') {
                window._wasmNoteOff(this, note);
            } else if (this.activeVoices[note]) {
                delete this.activeVoices[note];
            }
        }

        setParameter(paramId, value) {
            if (this.workletNode && this.workletNode.port) {
                this.workletNode.port.postMessage({ type: 'set_param', paramId: paramId, value: value });
            }
        }

        pitchBend(value) {
            if (this.workletNode && this.workletNode.port) {
                this.workletNode.port.postMessage({ type: 'pitch_bend', value: value });
            }
        }

        panic() {
            if (this.workletNode && this.workletNode.port) {
                this.workletNode.port.postMessage({ type: 'panic' });
            }
            const self = this;
            Object.keys(this.activeVoices).forEach(function(note) {
                self.noteOff(parseInt(note));
            });
        }
    }

    window.wasmBridge = new WasmBridge();

    // ─── Gesture handler: resume AudioContext on first user interaction ───

    const resumeAudioOnGesture = function() {
        const bridge = window.wasmBridge;
        if (bridge) {
            if (!bridge.audioCtx) {
                bridge.initAudioContext();
            } else if (bridge.audioCtx.state === 'suspended') {
                bridge.audioCtx.resume().then(function() {
                    bridge._updateAudioButtonUI(true);
                }).catch(function() {});
            }
        }
    };

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('mousedown', resumeAudioOnGesture, { capture: true, passive: true });
        window.addEventListener('pointerdown', resumeAudioOnGesture, { capture: true, passive: true });
        window.addEventListener('touchstart', resumeAudioOnGesture, { capture: true, passive: true });
        window.addEventListener('keydown', resumeAudioOnGesture, { capture: true, passive: true });
        window.addEventListener('click', resumeAudioOnGesture, { capture: true, passive: true });
    }

    // ─── DOMContentLoaded: wire up mode selector and audio button ───

    document.addEventListener('DOMContentLoaded', function() {
        window.wasmBridge._updateModeUI();

        const selector = document.getElementById('app-operating-mode-select');
        if (selector) {
            selector.addEventListener('change', function(e) {
                window.wasmBridge.setMode(e.target.value);
            });
        }

        const audioBtn = document.getElementById('wasm-audio-toggle-btn');
        if (audioBtn) {
            audioBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                window.wasmBridge.initAudioContext();
            });
        }
    });
})();
