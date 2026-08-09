/**
 * @purpose Individual HTML template renderers for each DeepMind 12 effect type.
 * Dispatcher + bypass + fallback kept here.
 * Category-specific renderers extracted to:
 *   effects_renderers_reverbs.js       — Reverbs (types 2, 4, 7, 9, 10, 11, 12, 13)
 *   effects_renderers_eq_dynamics.js   — EQ/Dynamics (types 14, 15, 16, 17)
 *   effects_renderers_modulation.js    — Modulation (types 18, 19, 20, 21, 31, 32)
 *   effects_renderers_delays_pitch.js  — Delays/Pitch (types 22, 23, 24, 25, 33, 34, 35)
 * Each renderer takes (pVals[, effectType][, selectedSlot]) and returns an HTML string.
 */

// ──────────────────────────────────────────────
// Dispatcher
// ──────────────────────────────────────────────

/**
 * Returns the appropriate template renderer function for the given effect type.
 * @param {number} effectType
 * @returns {function}
 */
window._getFXTemplateRenderer = function(effectType) {
    const renderers = {
        0:  window._renderFXBypass,
        2:  window._renderFXTcDeepVerb,
        4:  window._renderFXVintageRoomReverb,
        7:  window._renderFXPlateReverb,
        9:  window._renderFXGatedReverse,
        10: window._renderFXGatedReverse,
        11: window._renderFXDualFX,
        12: window._renderFXDualFX,
        13: window._renderFXDualFX,
        14: window._renderFXMidasEQ,
        15: window._renderFXEnhancer,
        16: window._renderFXFairComp,
        17: window._renderFXMBDistortion,
        18: window._renderFXRackAmp,
        19: window._renderFXEdison,
        20: window._renderFXAutoPan,
        21: window._renderFXNoiseGate,
        22: window._renderFXDelay,
        23: window._renderFXDelay,
        24: window._renderFXDelay,
        25: window._renderFXTRayDelay,
        31: window._renderFXStereoPhaser,
        32: window._renderFXMoodFilter,
        33: window._renderFXPitch,
        34: window._renderFXPitch,
        35: window._renderFXRotarySpeaker
    };
    return renderers[effectType] || window._renderFXFallback;
};

// ──────────────────────────────────────────────
// BYPASS
// ──────────────────────────────────────────────

window._renderFXBypass = function() {
    return '<span style="color:var(--text-faint); font-size:12px; font-family:\'Share Tech Mono\', monospace; text-transform:uppercase;">Effect Bypassed</span>';
};

// ──────────────────────────────────────────────
// Fallback renderer (default / unknown effect types)
// ──────────────────────────────────────────────

window._renderFXFallback = function(pVals, effectType, selectedSlot) {
    const theme = window._fxThemeStyle(effectType);
    return `
        <div class="fx-theme-custom" style="${theme} display: flex; flex-direction: column; width: 95%; gap: 6px;">
            <div style="display: grid; grid-template-columns: repeat(6, 1fr); text-align: center; font-family:'Share Tech Mono', monospace; color:#00ccff; font-size:10px;">
                <div>PRE DEL<br><span style="color:#ff2200; font-size:7px;">${Math.round(pVals[0] * 100)}ms</span></div>
                <div>DECAY<br><span style="color:#ff2200; font-size:7px;">${(pVals[1] * 4.0).toFixed(2)}s</span></div>
                <div>SIZE<br><span style="color:#ff2200; font-size:7px;">${Math.round(pVals[2] * 10)}</span></div>
                <div>DAMPING<br><span style="color:#ff2200; font-size:7px;">${Math.round(pVals[3] * 10)}kHz</span></div>
                <div>DIFFUSE<br><span style="color:#ff2200; font-size:7px;">${Math.round(pVals[4] * 100)}%</span></div>
                <div>MIX<br><span style="color:#ff2200; font-size:7px;">${Math.round(pVals[5] * 100)}%</span></div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(6, 1fr); justify-items: center; align-items: center;">
                ${Array(6).fill(0).map((_, idx) => `
                    <div class="ctrl-unit" data-param="fx${selectedSlot}_param${idx+1}" style="align-items: center; display: flex; flex-direction: column;">
                        <div class="v-slider" style="height: 80px;">
                            <div class="track"></div>
                            <div class="handle" style="top: ${(1.0 - pVals[idx]) * 64}px;"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
};
