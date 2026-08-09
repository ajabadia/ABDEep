/**
 * model_capabilities.js — Fase 5 (plan v3.2 §1.1): matriz formal de capabilities por modelo.
 *
 *   interface ModelCapabilities {
 *     model: 'dm12_hardware' | 'abyssmind_pro';
 *     standardFxCount: number;       // 35 efectos nativos DeepMind 12
 *     advancedFxCount: number;       // 21 efectos extendidos AbyssMind Pro
 *     modulationSlotCount: number;   // 8 slots estándar / extendidos
 *     supportsExtendedSequencer: boolean;
 *     supportsAbyssMindParameters: boolean;
 *   }
 *
 * Fuente de verdad de capacidades para el bridge WASM (wasm_set_model/get_model),
 * la UI de modos y el gating de features (comparisonMode / Fase 6). Los modos de
 * UI se resuelven al modelo canónico:
 *   'deepmind_hw_controller' y 'deepmind_web_standalone' → dm12_hardware
 *   'abyssmind_pro' → abyssmind_pro
 */

const MODEL_CAPABILITIES = Object.freeze({
    dm12_hardware: Object.freeze({
        model: 'dm12_hardware',
        standardFxCount: 35,
        advancedFxCount: 0,
        modulationSlotCount: 8,
        supportsExtendedSequencer: false,
        supportsAbyssMindParameters: false,
    }),
    abyssmind_pro: Object.freeze({
        model: 'abyssmind_pro',
        standardFxCount: 35,
        advancedFxCount: 21,
        modulationSlotCount: 8,
        supportsExtendedSequencer: true,
        supportsAbyssMindParameters: true,
    }),
});

const MODELS = Object.freeze(Object.keys(MODEL_CAPABILITIES));

const MODE_TO_MODEL = Object.freeze({
    deepmind_hw_controller: 'dm12_hardware',
    deepmind_web_standalone: 'dm12_hardware',
    abyssmind_pro: 'abyssmind_pro',
});

const ModelCapabilities = {
    /** Devuelve las capabilities canónicas de un modelo, o null si no existe. */
    getModelCapabilities(model) {
        return (model && MODEL_CAPABILITIES[model]) ? MODEL_CAPABILITIES[model] : null;
    },

    /**
     * Resuelve un modo de UI (o un modelo canónico directo) al modelo canónico.
     * Fallback seguro: abyssmind_pro (el DSP WASM compila en modo Enhanced).
     */
    resolveModel(modeOrModel) {
        if (MODEL_CAPABILITIES[modeOrModel]) { return modeOrModel; }
        const mapped = MODE_TO_MODEL[modeOrModel];
        return mapped || 'abyssmind_pro';
    },

    /** Capabilities para un modo de UI (resolución + lookup). */
    getCapabilitiesForMode(mode) {
        return ModelCapabilities.getModelCapabilities(ModelCapabilities.resolveModel(mode));
    },

    /** Valida un objeto contra la matriz canónica de su modelo (no por identidad). */
    isValidModelCapabilities(caps) {
        if (!caps || typeof caps !== 'object') { return false; }
        const canonical = MODEL_CAPABILITIES[caps.model];
        if (!canonical) { return false; }
        return caps.standardFxCount === canonical.standardFxCount
            && caps.advancedFxCount === canonical.advancedFxCount
            && caps.modulationSlotCount === canonical.modulationSlotCount
            && caps.supportsExtendedSequencer === canonical.supportsExtendedSequencer
            && caps.supportsAbyssMindParameters === canonical.supportsAbyssMindParameters;
    },
};

// ── Exports ──
if (typeof window !== 'undefined') {
    window.ModelCapabilities = ModelCapabilities;
}
if (typeof globalThis !== 'undefined') {
    globalThis.ModelCapabilities = ModelCapabilities;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ModelCapabilities, MODEL_CAPABILITIES, MODELS, MODE_TO_MODEL };
}
