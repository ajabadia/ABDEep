/**
 * @purpose Vocoder microphone audio core: getUserMedia, AudioContext, AnalyserNode,
 *          ScriptProcessorNode PCM capture, and JUCE bridge forwarding.
 *          Receives state via window._vocoderMicState (set by vocoder_mic_input.js).
 * @classification Module/Vocoder/Audio
 * @dependencies Requires window._vocoderMicState to be initialized first.
 */

(function () {
    'use strict';

    // Shared state (consumed by audio, UI, and facade modules)
    window._vocoderMicState = {
        audioContext: null,
        micStream: null,
        analyserNode: null,
        micEnabled: false,
        vuIntervalId: null,
        micSourceNode: null,
        captureNode: null,
        pcmBuffer: [],
        bridgeActive: false
    };

    const state = window._vocoderMicState;

    /** Solicita permiso de micrófono y captura el MediaStream */
    async function requestMic() {
        if (state.micStream) {return true;}
        try {
            state.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            return true;
        } catch (err) {
            console.warn('[VocoderMic] Mic permission denied or unavailable:', err.message);
            return false;
        }
    }

    /** Construye AudioContext + AnalyserNode + ScriptProcessorNode para PCM */
    function startAudioPipeline() {
        if (state.audioContext) {return;}

        try {
            state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            state.analyserNode = state.audioContext.createAnalyser();
            state.analyserNode.fftSize = 256;

            if (state.micStream) {
                state.micSourceNode = state.audioContext.createMediaStreamSource(state.micStream);
                state.micSourceNode.connect(state.analyserNode);

                state.captureNode = state.audioContext.createScriptProcessor(1024, 1, 1);
                state.analyserNode.connect(state.captureNode);
                state.captureNode.connect(state.audioContext.destination);

                state.captureNode.onaudioprocess = function (e) {
                    const input = e.inputBuffer.getChannelData(0);
                    state.pcmBuffer = Array.from(input);

                    if (state.bridgeActive &&
                        typeof window.juce !== 'undefined' && window.juce !== null &&
                        typeof window.juce.sendModulatorAudioBuffer === 'function') {
                        try {
                            window.juce.sendModulatorAudioBuffer(state.pcmBuffer);
                        } catch (err) {
                            // bridge not available in this context
                        }
                    }
                };
            }
        } catch (err) {
            console.warn('[VocoderMic] Audio pipeline error:', err.message);
        }
    }

    /** Detiene y limpia todo el pipeline de audio */
    function stopAudioPipeline() {
        if (state.captureNode) {
            try { state.captureNode.disconnect(); } catch (e) { /* ignore */ }
            state.captureNode = null;
        }
        if (state.analyserNode) {
            try { state.analyserNode.disconnect(); } catch (e) { /* ignore */ }
            state.analyserNode = null;
        }
        if (state.micSourceNode) {
            try { state.micSourceNode.disconnect(); } catch (e) { /* ignore */ }
            state.micSourceNode = null;
        }
        if (state.audioContext) {
            state.audioContext.close().catch(function () {});
            state.audioContext = null;
        }
        state.pcmBuffer = [];
    }

    /** Detiene el MediaStream y libera los tracks */
    function stopMicStream() {
        if (state.micStream) {
            state.micStream.getTracks().forEach(function (t) { t.stop(); });
            state.micStream = null;
        }
    }

    /** Detecta si el bridge JUCE está disponible para recibir buffers PCM */
    function detectBridge() {
        state.bridgeActive = !!(typeof window.juce !== 'undefined' && window.juce !== null &&
            typeof window.juce.sendModulatorAudioBuffer === 'function');
    }

    // --- Public API ---
    window._vocoderMicAudio = {
        requestMic: requestMic,
        startAudioPipeline: startAudioPipeline,
        stopAudioPipeline: stopAudioPipeline,
        stopMicStream: stopMicStream,
        detectBridge: detectBridge
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = window._vocoderMicAudio;
    }
})();
