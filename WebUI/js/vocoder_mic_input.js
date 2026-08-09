/**
 * @purpose Vocoder microphone input: facade that initializes shared state and wires
 *          audio (vocoder_mic_audio.js) and UI (vocoder_mic_ui.js) modules.
 *          Load AFTER both sub-modules in index.html.
 * @classification Module/Vocoder/Facade
 * @dependencies vocoder_mic_audio.js → vocoder_mic_ui.js → vocoder_mic_input.js
 */

(function () {
    'use strict';

    const audio = window._vocoderMicAudio;
    const ui = window._vocoderMicUI;

    if (!audio || !ui) {
        console.warn('[VocoderMic] Audio or UI module not loaded');
        return;
    }

    // --- Public API ---

    /** Inicializa el módulo: detecta bridge, inyecta UI, observa cambios */
    window.initVocoderMic = function () {
        audio.detectBridge();
        ui.injectVocoderUI();

        // MutationObserver: reacciona a cambios en el modal FX
        const fxModal = document.querySelector('fx-modal') || document.getElementById('fx-modal');
        if (fxModal) {
            let timer = null;
            const observer = new MutationObserver(function () {
                if (timer) {clearTimeout(timer);}
                timer = setTimeout(function () {
                    window.syncVocoderMicUI();
                }, 150);
            });
            observer.observe(fxModal, { childList: true, subtree: true, attributes: false });
        }
    };

    /** Hook para effects.js — se llama después de re-render del panel FX */
    window._onFxTypeChanged = function () {
        window.syncVocoderMicUI();
    };

    /** Sincroniza la UI del vocoder: muestra/oculta según el tipo FX activo */
    window.syncVocoderMicUI = function () {
        if (!ui.isVocoderActive()) {
            if (window._vocoderMicState.micEnabled) {ui.toggleMic();}
            const section = document.getElementById('vocoder-mic-section');
            if (section) {section.remove();}
        } else {
            ui.injectVocoderUI();
        }
    };

    // --- Auto-init cuando el DOM está listo ---
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', window.initVocoderMic);
    } else {
        window.initVocoderMic();
    }

    // Support for vitest / Node.js
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            initVocoderMic: window.initVocoderMic,
            syncVocoderMicUI: window.syncVocoderMicUI,
            _onFxTypeChanged: window._onFxTypeChanged
        };
    }
})();
