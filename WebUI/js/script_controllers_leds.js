/**
 * @purpose LCD glow pulse animation on SEQ step changes.
 * Extracted from script_controllers.js RAF loop for modularity.
 * @classification Module/Controllers/LEDs
 * @lastUpdated 2026-07-25
 */

(function() {
    // Glow pulse state (persistent across frames)
    window._seqGlowPulse = 0;
    window._seqGlowLastStep = -1;

    /**
     * Update LCD glow pulse effect when SEQ step changes.
     * Called every RAF frame from script_controllers.js
     */
    window._updateLcdGlowPulse = function(bridge) {
        const glowEl = document.getElementById('lcd-glow-pulse');
        if (!glowEl) {return;}

        const seqEn = bridge.parameterCache && (bridge.parameterCache['seq_enable'] || 0) > 0.5;
        const curStep = bridge.parameterCache ? bridge.parameterCache['seq_current_step'] : undefined;
        const stepChanged = curStep !== undefined && curStep !== window._seqGlowLastStep;

        if (stepChanged) {
            window._seqGlowLastStep = curStep;
            window._seqGlowPulse = Date.now();
        }

        if (seqEn && curStep !== undefined) {
            const age = Date.now() - window._seqGlowPulse;
            const duration = 400;
            if (age < duration) {
                const intensity = 1.0 - (age / duration);
                const size = 2 + intensity * 4;
                glowEl.style.boxShadow = '0 0 ' + size.toFixed(1) + 'px color-mix(in srgb, var(--accent-pink) 40%, transparent)';
            } else if (glowEl.style.boxShadow) {
                glowEl.style.boxShadow = '';
            }
        } else if (glowEl.style.boxShadow) {
            glowEl.style.boxShadow = '';
        }
    };
})();
