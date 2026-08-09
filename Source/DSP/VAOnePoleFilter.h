#pragma once
#include <cmath>
#include <algorithm>

#if DEEP_TARGET_MODEL >= 2

namespace ABD
{
    /**
     * VAOnePoleFilter: Minimal TPT ZDF one-pole filter.
     * Used as building block for MoogLadderVCF and KorgMS20VCF.
     *
     * Topology: TPT ZDF (bilinear transform).
     * lp = lowpass output, hp = highpass output = input - lp.
     * State stored in z1 (double precision for numerical stability).
     *
     * Coefficient formula (BZT prewarp):
     *   g  = tan(pi * fc / fs)
     *   alpha = g / (1 + g)      [0..1, approaches 1 at Nyquist]
     *
     * Process (per sample):
     *   vn = (alpha * (xn + fb) - z1) * alpha          [feedforward + feedback]
     *   lp = vn + z1                                   [lowpass output]
     *   z1 = vn + lp = 2*vn + z1_prev                  [update state]
     *   hp = xn - lp                                   [highpass output]
     */
    class VAOnePoleFilter
    {
    public:
        VAOnePoleFilter() = default;

        /** Reset internal state. Call in prepare() or when voice restarts. */
        void reset()
        {
            z1 = 0.0;
        }

        /**
         * Recalculate filter coefficient from cutoff frequency and sample rate.
         * Call whenever cutoff changes (per-voice, not per-sample ideally).
         *
         * @param cutoffHz  Filter cutoff in Hz (clamped to [10, Nyquist*0.95])
         * @param fs        Sample rate in Hz
         */
        void setCutoff(float cutoffHz, double fs)
        {
            double fc = std::clamp((double)cutoffHz, 10.0, fs * 0.49);
            double g  = std::tan(M_PI * fc / fs);
            alpha = g / (1.0 + g);    // [0..1]
        }

        /**
         * Set feedback amount (used by ladder/korg for resonance).
         * Typically 0..1 range; caller scales appropriately.
         */
        void setFeedback(double fb)
        {
            feedback = fb;
        }

        /**
         * Process one sample through the filter.
         * Updates internal state (z1) and returns lowpass output.
         *
         * @param xn  Input sample
         * @return    Lowpass filtered output
         */
        float process(float xn)
        {
            double x = (double)xn;

            // TPT ZDF one-pole: feedback goes to input summing junction
            double vn = alpha * (x + feedback) - z1 * alpha;
            double lp = vn + z1;
            z1 = vn + lp;     // state = 2*vn + z1_prev

            // Anti-denormal: flush subnormal state to zero (belt + ScopedNoDenormals)
            if (std::abs(z1) < 1.0e-15)
                z1 = 0.0;

            return (float)lp;
        }

        /**
         * Process one sample, returning both lowpass and highpass outputs.
         * hp = input - lp (by subtractive synthesis).
         *
         * @param xn   Input sample
         * @param lp   [out] Lowpass output
         * @param hp   [out] Highpass output
         */
        void process(float xn, float& lp, float& hp)
        {
            double x = (double)xn;

            double vn = alpha * (x + feedback) - z1 * alpha;
            double lpOut = vn + z1;
            z1 = vn + lpOut;

            // Anti-denormal: flush subnormal state to zero
            if (std::abs(z1) < 1.0e-15)
                z1 = 0.0;

            lp = (float)lpOut;
            hp = (float)(x - lpOut);
        }

        /** Get current lowpass output without advancing state (for debug). */
        float getLP() const { return (float)(z1 * 0.5); }

    private:
        double alpha  = 0.0;     // feedforward coefficient [0..1]
        double feedback = 0.0;   // feedback amount (set externally)
        double z1     = 0.0;     // integrator state (double precision)
    };
}

#endif // DEEP_TARGET_MODEL >= 2
