#pragma once
#include <cmath>
#include <algorithm>
#include <cstdint>
#include <bit>

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

    /**
     * Convert a smoothing time constant (in seconds) to the per-sample
     * coefficient of a 1-pole exponential smoother.
     *
     * A 1-pole smoother with per-sample coefficient c has time constant
     *   tau = -1/ln(1-c) samples = -1/(ln(1-c)·sr) seconds,
     * so the coefficient that realizes a given tau at sample rate sr is
     *   c(tau, sr) = 1 - exp(-1/(tau·sr)).
     *
     * Use the DAW-provided sample rate here (prepare()/setSampleRate()), never a
     * hardcoded rate: this keeps the physical response identical across sample
     * rates. Tuning constants are expressed in seconds (legacy 44.1 kHz values
     * are converted to seconds at the call sites, with the conversion documented).
     * Call once in prepare()/setSampleRate(), never per-sample (exp is hot).
     */
    inline float slewCoeffFromTimeConstant(float tauSeconds, double sampleRate)
    {
        const double sr = std::max(1.0, sampleRate);
        return 1.0f - static_cast<float>(std::exp(-1.0 / (static_cast<double>(tauSeconds) * sr)));
    }

    /**
     * VCF keytracking ratio — 1:1 per octave, multiplicative, pivoting at middle C.
     *
     *   cutoff_keytracked = cutoff * filterKeyTrackRatio(freqHz, referenceHz, keyTrackAmount)
     *
     * keyTrackAmount 0.0 → ratio 1 (cutoff unchanged for every note).
     * keyTrackAmount 1.0 → a note one octave above the reference doubles the
     * cutoff; one octave below halves it (1:1 pitch tracking, hardware behavior).
     * Intermediate values scale the tracking linearly (the ratio is the exponent).
     * referenceHz is the pivot note — hardware middle C (261.63 Hz).
     */
    inline float filterKeyTrackRatio(float freqHz, float referenceHz, float keyTrackAmount)
    {
        if (keyTrackAmount <= 0.0f || freqHz <= 0.0f || referenceHz <= 0.0f)
            return 1.0f;
        return std::pow(freqHz / referenceHz, keyTrackAmount);
    }

    /**
     * Fast tangent for the ZDF VCF, replacing std::tan on a bounded domain.
     *
     * Computes tan(x) = sin(x) / cos(x) via truncated Taylor series. Valid only
     * for x in [0, ~1.43]: the VCF clamps cutoff to 0.85·f_s so x = π·fc/f_s
     * never exceeds π·0.85 ≈ 2.67 at the filter itself, and in-engine sweeps cap
     * at fc=20 kHz with f_s=44.1 kHz (x = 1.425). No pole inside the domain, so
     * both series converge and the relative error is deterministic:
     *
     *   max |fastTan(x) - tan(x)| / |tan(x)|  <  1e-6   on [0.0001, 1.425]
     *
     * Verified against IEEE double std::tan on a dense sweep (see FastMath tests).
     * Cost: ~14 FMAs + 1 division vs MSVC std::tan (range reduction + polynomial).
     *
     * NOTE: must NOT be called with |x| >= 1.425 (error degrades sharply past
     * the Taylor convergence knee).
     */
    inline float fastTan(float x)
    {
        x = std::clamp(x, 0.0f, 1.425f);
        float x2 = x * x;
        float s = x * (1.0f + x2 * (-1.0f / 6.0f + x2 * (1.0f / 120.0f + x2 * (-1.0f / 5040.0f
                  + x2 * (1.0f / 362880.0f + x2 * (-1.0f / 39916800.0f))))));
        float c = 1.0f + x2 * (-1.0f / 2.0f + x2 * (1.0f / 24.0f + x2 * (-1.0f / 720.0f
                  + x2 * (1.0f / 40320.0f + x2 * (-1.0f / 3628800.0f)))));
        return (c > 1.0e-7f) ? (s / c) : (s * 1.0e7f);
    }

    /**
     * Fast 2^x on [-10, 10], replacing std::pow(2.0, x) in pitch/coeff paths.
     *
     * Splits x = n + f with n integer, f in [0, 1). 2^n is built exactly via
     * IEEE-754 exponent bits; 2^f uses a degree-5 least-squares (near-minimax)
     * polynomial. Verified pitch error over [-10, 10]:
     *
     *   max |1200·log2(fastExp2(x) / 2^x)|  <  0.001 cents
     *
     * The 2^f polynomial alone is accurate to ~2.3e-7 relative, so the pitch
     * error is dominated by the exponent-bit construction (exact) — total is far
     * under the 0.01 cents threshold agreed with the DSP Inspector.
     * Cost: ~7 FLOPs vs std::pow (log + exp path).
     */
    inline float fastExp2(float x)
    {
        if (x <= -126.0f) return 0.0f;
        if (x >= 126.0f) return 8.50705917e+37f;

        const float n = std::floor(x);
        const float f = x - n;
        float y = 0.99999976988588368f
                + f * (0.69315677328528258f
                + f * (0.24013170481445656f
                + f * (0.05587653949897675f
                + f * (0.00894058820920421f
                + f * 0.00189438161165486f))));
        
        int32_t expVal = static_cast<int32_t>(n) + 127;
        if (expVal <= 0) return 0.0f;
        if (expVal >= 255) expVal = 254;

        const std::uint32_t e = static_cast<std::uint32_t>(expVal);
        return y * std::bit_cast<float>(e << 23);
    }

    /**
     * Master output soft-clip: tanh with configurable headroom.
     *
     *   headroom == 1.0f  →  y = tanh(x)            (legacy behaviour, knee at |x| = 1.0)
     *   headroom == 2.0f  →  y = 2·tanh(x/2)        (linear up to |x| ~ 2.0, only extreme peaks fold)
     *
     * Preserves low-level signals (y ≈ x near 0 regardless of headroom) and bounds the
     * final output magnitude to exactly |y| ≤ headroom.
     */
    inline float masterSoftClip(float x, float headroom)
    {
        const float inv = 1.0f / headroom;
        return headroom * std::tanh(x * inv);
    }

    // Master soft-clip headroom mapping (SynthEngine master bus, F3-4):
    // the normalized 0..1 UI headroom is expanded to a 0..6 dB range, then
    // converted to a linear voltage ratio (20 dB per voltage decade).
    constexpr float kMasterSoftclipMaxHeadroomDb = 6.0f;
    constexpr float kDbPerVoltageRatio = 20.0f;

    /**
     * Minimal LCG random generator for deterministic per-voice personality.
     *
     * Constants from Numerical Recipes (multiplier=1664525, increment=1013904223).
     * Output: 16-bit precision normalized to [0, 1].
     */
    struct LCG {
        uint32_t state;
        explicit LCG(uint32_t seed) : state(seed) {}
        float next() {
            state = state * 1664525u + 1013904223u;
            return (float)(state & 0xFFFF) / 65535.0f;
        }
    };

} // namespace DSP
} // namespace ABD
