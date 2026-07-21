#pragma once
#include <cmath>
#include <algorithm>

namespace ABD
{
namespace DSP
{
    /**
     * 2nd-order PolyBLEP residual for anti-aliasing at waveform discontinuities.
     *
     * @param t  Current phase position in [0, 1).
     * @param dt Phase increment (freq / sampleRate).
     * @return   Correction sample to add/subtract near the discontinuity, 0 otherwise.
     *
     * Algorithm: two 2nd-order polynomial pieces (one on each side of the discontinuity)
     * that smoothly remove the staircase error from bandlimited step functions.
     * Cheaper than 4th-order (polyBlep4 in ABDJUNiO601) — sufficient for 2x oversampling
     * and good enough for the junior dev team's DSP learning curve.
     */
    inline float polyBlep2(float t, float dt)
    {
        // Near start discontinuity (phase wrap: jumps from +1 down to -1)
        if (t < dt)
        {
            float n = t / dt;
            return n + n - n * n - 1.0f;
        }
        // Near end discontinuity (approaching the wrap)
        if (t > 1.0f - dt)
        {
            float n = (t - 1.0f) / dt;
            return n + n + n * n + 1.0f;
        }
        return 0.0f;
    }

    /**
     * Sawtooth curvature — adds a parabolic bulge to a linear ramp [0, 1).
     *
     * At curvature = 0: pure linear ramp (ideal mathematical saw).
     * At curvature > 0: the ramp is slightly bowed upward, being steeper near the
     * midpoint and flatter near the ends. This models the slight nonlinearity of
     * analog RC integration circuits (Juno-106, DeepMind, etc.).
     *
     * Default calibration value from ABDJUNiO601: 0.15.
     *
     * @param phase      Current phase in [0, 1).
     * @param curvature  Bow amount, typically 0.0–0.3.
     * @return           Curved phase value in [0, 1).
     */
    inline float sawCurvature(float phase, float curvature)
    {
        return phase * (1.0f + curvature * (1.0f - phase));
    }

    /**
     * Simple 1-pole exponential smoother for slew limiting.
     *
     * @param current   Current value.
     * @param target    Target value.
     * @param coeff     Smoothing coefficient (0..1). Higher = faster response.
     * @return          Updated value.
     */
    inline float slewLimit(float current, float target, float coeff)
    {
        return current + (target - current) * coeff;
    }

} // namespace DSP
} // namespace ABD
