/**
 * @purpose DualMidiBridge parameter methods: setParameter(), readFactoryBankFile(),
 * handleParameterChangeFromBackend(), onParameterChanged(), offParameterChanged().
 * Extraído de bridge-dual.js para modularización.
 * @classification Module/Bridge/Params
 * @complexity Medium
 */

(function() {
    if (typeof DualMidiBridge === 'undefined') {
        if (typeof console !== 'undefined') {console.warn('[Bridge-Params] DualMidiBridge not found — deferring...');}
        return;
    }

    const Logger = globalThis.Logger || console;

    // --- ENVIAR PARÁMETRO (Hacia el Sinte / Hardware) ---
    DualMidiBridge.prototype.setParameter = function(paramId, normalizedValue, forceResend) {
        // Nivel 1: Evitar envío si el valor no cambia significativamente (excepto en carga forzada)
        const cached = this.parameterCache[paramId];
        if (!forceResend && cached !== undefined && Math.abs(cached - normalizedValue) < 0.001) {
            this.parameterCache[paramId] = normalizedValue;
            return;
        }

        this.parameterCache[paramId] = normalizedValue;

        // Marcar patch como "dirty" cuando el usuario edita un parámetro (no durante carga)
        if (!forceResend && paramId !== 'patch_dirty' && paramId !== 'protect_unsaved_edits') {
            const wasClean = this.parameterCache['patch_dirty'] !== 1;
            if (wasClean) {
                this.parameterCache['patch_dirty'] = 1;
                if (window.juce && typeof window.juce.setParameter === 'function') {
                    window.juce.setParameter('patch_dirty', 1);
                }
            }
        }

        if (this.isJuce) {
            if (window.juce && typeof window.juce.setParameter === 'function') {
                window.juce.setParameter(paramId, normalizedValue);
            }
            this.handleParameterChangeFromBackend(paramId, normalizedValue);
        } else {
            this.sendWebMidiParameter(paramId, normalizedValue);
            this.handleParameterChangeFromBackend(paramId, normalizedValue);
            if (window.wasmBridge) {
                window.wasmBridge.setParameter(paramId, normalizedValue);
            }
        }
    };

    DualMidiBridge.prototype.readFactoryBankFile = async function(letter) {
        if (this.isJuce) {
            if (window.juce && typeof window.juce.readFactoryBankFile === 'function') {
                return window.juce.readFactoryBankFile(letter);
            }
        }
        return null;
    };

    DualMidiBridge.prototype.handleParameterChangeFromBackend = function(paramId, normalizedValue) {
        this.parameterCache[paramId] = normalizedValue;
        this.onParameterChangedCallbacks.forEach(cb => cb(paramId, normalizedValue));
    };

    DualMidiBridge.prototype.onParameterChanged = function(callback) {
        this.onParameterChangedCallbacks.push(callback);
    };

    DualMidiBridge.prototype.offParameterChanged = function(callback) {
        const idx = this.onParameterChangedCallbacks.indexOf(callback);
        if (idx !== -1) {
            this.onParameterChangedCallbacks.splice(idx, 1);
        }
    };

    Logger.log('[Bridge] Params module loaded');
})();
