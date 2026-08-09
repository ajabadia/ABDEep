/**
 * @purpose AudioContext initialization, AudioWorklet, oscilloscope loop, and audio output device management.
 * Extracted from wasm_bridge.js. Called via window._wasm* helpers.
 */

(function() {
    'use strict';

    /**
     * Initialize or resume the Web Audio context, master gain, and analyser.
     * @param {object} bridge - The WasmBridge instance
     * @returns {boolean} true if audio context is active, false otherwise
     */
    window._wasmInitAudioContext = function(bridge) {
        if (bridge.audioCtx && bridge.masterGain && bridge.analyser) {
            if (bridge.audioCtx.state === 'suspended') {
                bridge.audioCtx.resume().catch(function() {});
            }
            bridge.isAudioStarted = true;
            window._wasmUpdateAudioButtonUI(bridge, bridge.audioCtx.state === 'running');
            return true;
        }

        try {
            const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtxClass) {
                Logger.warn('[WasmBridge] Web Audio API no soportada.');
                return false;
            }

            const hostname = window.location.hostname || '';
            const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '';
            const isAuthorizedDomain = isLocal || hostname.endsWith('abdsynths.com') || hostname.endsWith('github.io');
            if (!isAuthorizedDomain) {
                Logger.warn('[WasmBridge] Domain protection active: execution restricted to authorized hosts.');
            }

            if (!bridge.audioCtx) {
                bridge.audioCtx = new AudioCtxClass({ sampleRate: 44100 });
            }

            if (!bridge.masterGain) {
                bridge.masterGain = bridge.audioCtx.createGain();
                bridge.masterGain.gain.setValueAtTime(1.0, bridge.audioCtx.currentTime);
                bridge.masterGain.connect(bridge.audioCtx.destination);
            }

            if (!bridge.analyser) {
                bridge.analyser = bridge.audioCtx.createAnalyser();
                bridge.analyser.fftSize = 512;
                bridge.masterGain.connect(bridge.analyser);
                window._wasmStartScopeLoop(bridge);
            }

            bridge.isAudioStarted = true;

            // Cargar el procesador AudioWorklet de forma asíncrona
            window._wasmLoadAudioWorklet(bridge);

            if (bridge.audioCtx.state === 'suspended') {
                bridge.audioCtx.resume().then(function() {
                    window._wasmUpdateAudioButtonUI(bridge, true);
                }).catch(function() {});
            } else {
                window._wasmUpdateAudioButtonUI(bridge, true);
            }

            // Restaurar dispositivo de salida de audio seleccionado previamente si la API lo soporta
            const savedSinkId = localStorage.getItem('abd-eep-audio-sink-id');
            if (savedSinkId && typeof bridge.audioCtx.setSinkId === 'function') {
                try { bridge.audioCtx.setSinkId(savedSinkId); } catch (e) {}
            }

            return true;
        } catch (err) {
            Logger.error('[WasmBridge] Error iniciando AudioContext:', err);
            return false;
        }
    };

    /**
     * Load the AudioWorklet module and create the DSP processor node.
     * @param {object} bridge - The WasmBridge instance
     */
    window._wasmLoadAudioWorklet = async function(bridge) {
        if (bridge._isInitializing || bridge.workletNode) {return;}
        bridge._isInitializing = true;

        try {
            Logger.log('[WasmBridge] Registrando AudioWorkletProcessor...');
            await bridge.audioCtx.audioWorklet.addModule('js/dsp-processor.js', { type: 'module' });

            bridge.workletNode = new AudioWorkletNode(bridge.audioCtx, 'abdeep-dsp-processor', {
                outputChannelCount: [2],
                processorOptions: { sampleRate: bridge.audioCtx.sampleRate }
            });

            // Escuchar el estado de inicialización del WASM
            bridge.workletNode.port.onmessage = function(event) {
                if (event.data && event.data.type === 'status' && event.data.ready) {
                    bridge.isWasmActive = true;
                    Logger.log('[WasmBridge] Motor DSP de C++ en WASM activo y listo para reproducir.');
                    const lcdUpdate = window.lcdSafeUpdate || function() {};
                    lcdUpdate('WASM ENGINE: ACTIVE');
                }
            };

            // Conectar el nodo del procesador WASM a nuestro gain maestro
            bridge.workletNode.connect(bridge.masterGain);
        } catch (e) {
            Logger.error('[WasmBridge] Fallo al cargar AudioWorklet:', e);
        } finally {
            bridge._isInitializing = false;
        }
    };

    /**
     * Start the requestAnimationFrame loop that feeds waveform + frequency data to dualMidiBridge.
     * @param {object} bridge - The WasmBridge instance
     */
    window._wasmStartScopeLoop = function(bridge) {
        if (bridge._scopeLoopId) {return;}
        const sampleArray = new Float32Array(512);
        const freqArray = new Uint8Array(256);

        const updateWaveform = function() {
            if (bridge.analyser) {
                bridge.analyser.getFloatTimeDomainData(sampleArray);
                if (getBridge()) {
                    getBridge()._lastAudioWaveform = Array.from(sampleArray);
                }
                bridge.analyser.getByteFrequencyData(freqArray);
                if (getBridge()) {
                    getBridge()._lastAudioFrequencyData = Array.from(freqArray);
                }
            }
            bridge._scopeLoopId = requestAnimationFrame(updateWaveform);
        };
        bridge._scopeLoopId = requestAnimationFrame(updateWaveform);
    };

    /**
     * Enumerate audio output devices available to the browser.
     * @returns {Promise<Array>} List of audiooutput device objects
     */
    window._wasmGetAudioOutputDevices = async function() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            return [];
        }
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.filter(function(device) { return device.kind === 'audiooutput'; });
        } catch (e) {
            Logger.warn('[WasmBridge] Error enumerando dispositivos de salida de audio:', e);
            return [];
        }
    };

    /**
     * Set the audio output sink device.
     * @param {object} bridge - The WasmBridge instance
     * @param {string} deviceId - The target audio output device ID
     * @returns {Promise<boolean>} true if device was set successfully
     */
    window._wasmSetAudioOutputDevice = async function(bridge, deviceId) {
        if (bridge.audioCtx && typeof bridge.audioCtx.setSinkId === 'function') {
            try {
                await bridge.audioCtx.setSinkId(deviceId);
                localStorage.setItem('abd-eep-audio-sink-id', deviceId);
                return true;
            } catch (e) {
                Logger.warn('[WasmBridge] Error cambiando dispositivo de salida de audio:', e);
                return false;
            }
        }
        return false;
    };

    /**
     * Update the audio toggle button UI state.
     * @param {boolean} active - Whether audio context is active
     */
    window._wasmUpdateAudioButtonUI = function(active) {
        const btn = document.getElementById('wasm-audio-toggle-btn');
        if (btn) {
            btn.classList.toggle('active', active);
            btn.innerText = active ? '\u{1F50A} WEB AUDIO: ON' : '\u{1F50A} ACTIVAR AUDIO WEB';
            btn.style.borderColor = active ? 'var(--accent-green,#00ffcc)' : 'var(--border,#444)';
            btn.style.color = active ? 'var(--accent-green,#00ffcc)' : 'var(--text-secondary,#ccc)';
        }
    };
})();
