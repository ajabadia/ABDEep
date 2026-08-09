/**
 * @purpose Wheel overlay updaters (Pitch Bend, Mod Wheel, Aftertouch) + VU Meter.
 * Extracted from script_controllers.js RAF loop for modularity.
 * @classification Module/Controllers/Wheels
 * @lastUpdated 2026-07-25
 */

(function() {
    // VU ballistics state (persistent across frames)
    window._vuSmoothed = 0.0;
    window._vuLastTime = Date.now();

    /**
     * Update Pitch Bend, Mod Wheel, and Aftertouch overlay bars.
     * Called every RAF frame from script_controllers.js
     */
    window._updateWheelOverlays = function(pb, mw, at) {
        // ── Pitch Bend ──
        const pbFill = document.getElementById('ctrl-o-pb-fill');
        const pbVal = document.getElementById('ctrl-o-pb-val');
        if (pbFill) {
            const center = 50;
            const left = pb >= 0 ? center : center + pb * 50;
            const width = Math.abs(pb) * 50;
            pbFill.style.left = left + '%';
            pbFill.style.width = width + '%';
            pbFill.style.background = pb >= 0 ? 'var(--accent-green)' : 'var(--accent-pink)';
        }
        if (pbVal) {
            const st = pb * 2.0;
            pbVal.textContent = (st >= 0 ? '+' : '') + st.toFixed(2);
            pbVal.style.color = pb >= 0 ? 'var(--accent-green)' : 'var(--accent-pink)';
        }

        // ── Mod Wheel ──
        const mwFill = document.getElementById('ctrl-o-mw-fill');
        const mwVal = document.getElementById('ctrl-o-mw-val');
        if (mwFill) {
            mwFill.style.width = Math.round(mw * 100) + '%';
            mwFill.style.background = mw > 0.01 ? 'var(--accent-blue)' : 'var(--text-faint)';
        }
        if (mwVal) {
            mwVal.textContent = Math.round(mw * 100) + '%';
            mwVal.style.color = mw > 0.01 ? 'var(--accent-blue)' : 'var(--text-faint)';
        }

        // ── Aftertouch ──
        const atFill = document.getElementById('ctrl-o-at-fill');
        const atVal = document.getElementById('ctrl-o-at-val');
        if (atFill) {
            atFill.style.width = Math.round(at * 100) + '%';
            atFill.style.background = at > 0.01 ? 'var(--accent-orange)' : 'var(--text-faint)';
        }
        if (atVal) {
            atVal.textContent = Math.round(at * 100) + '%';
            atVal.style.color = at > 0.01 ? 'var(--accent-orange)' : 'var(--text-faint)';
        }
    };

    /**
     * Update VU meter with ballistic smoothing (attack/release).
     * Called every RAF frame from script_controllers.js
     * @returns {number} smoothed peak level (0..1)
     */
    window._updateVuMeter = function(rawPeak) {
        rawPeak = Math.max(0, Math.min(1, rawPeak));

        const VU_ATTACK_MS = 5;
        const VU_RELEASE_MS = 300;
        const now = Date.now();
        const dt = Math.min(100, Math.max(1, now - window._vuLastTime));
        window._vuLastTime = now;

        if (rawPeak > window._vuSmoothed) {
            const attackCoeff = Math.exp(-dt / VU_ATTACK_MS);
            window._vuSmoothed = window._vuSmoothed * attackCoeff + rawPeak * (1 - attackCoeff);
        } else {
            const releaseCoeff = Math.exp(-dt / VU_RELEASE_MS);
            window._vuSmoothed = rawPeak + (window._vuSmoothed - rawPeak) * releaseCoeff;
        }
        if (window._vuSmoothed < 0.001) {window._vuSmoothed = 0.0;}

        return window._vuSmoothed;
    };
})();
