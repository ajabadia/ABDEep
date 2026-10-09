#pragma once
#include <cmath>
#include <algorithm>
#include <cstdint>
#include <bit>

#include "SynthCore/PolyBLEP.h"
#include "SynthCore/DSPUtils.h"

namespace ABD
{
namespace DSP
{
    /**
     * 2nd-order PolyBLEP residual for anti-aliasing at waveform discontinuities.
     * Delegated to canonical abd::synth::PolyBLEP::getResidual.
     *
     * @param t  Current phase position in [0, 1).
     * @param dt Phase increment (freq / sampleRate).
     * @return   Correction sample to add/subtract near the discontinuity, 0 otherwise.
     */
    inline float polyBlep2(float t, float dt)
    {
        return abd::synth::PolyBLEP::getResidual(t, dt);
    }

    /**
     * Sawtooth curvature — adds a parabolic bulge to a linear ramp [0, 1).
     * Delegated to canonical abd::synth::DSPUtils::sawCurvature.
     *
     * @param phase      Current phase in [0, 1).
     * @param curvature  Bow amount, typically 0.0–0.3 (default 0.15).
     * @return           Curved phase value in [0, 1).
     */
    inline float sawCurvature(float phase, float curvature)
    {
        return abd::synth::DSPUtils::sawCurvature(phase, curvature);
    }

    /**
     * Simple 1-pole exponential smoother for slew limiting.
     * Delegated to canonical abd::synth::DSPUtils::slewLimit.
     *
     * @param current   Current value.
     * @param target    Target value.
     * @param coeff     Smoothing coefficient (0..1). Higher = faster response.
     * @return          Updated value.
     */
    inline float slewLimit(float current, float target, float coeff)
    {
        return abd::synth::DSPUtils::slewLimit(current, target, coeff);
    }

    /**
     * Convert a smoothing time constant (in seconds) to the per-sample
     * coefficient of a 1-pole exponential smoother.
     * Delegated to canonical abd::synth::DSPUtils::slewCoeffFromTimeConstant.
     *
     * @param tauSeconds Time constant in seconds.
     * @param sampleRate Current sample rate in Hz.
     * @return           Per-sample smoothing coefficient.
     */
    inline float slewCoeffFromTimeConstant(float tauSeconds, double sampleRate)
    {
        return abd::synth::DSPUtils::slewCoeffFromTimeConstant(tauSeconds, sampleRate);
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

// === Centralized tuning constants (legacy 44.1kHz values converted to seconds) ===
    // Cutoff/amp smoothing: tau = -1/(ln(1-0.05)·44100) = 0.00044208s @ 44.1kHz
    constexpr float kCutoffSmoothTauSec = 0.00044208f;
    constexpr float kAmpSmoothTauSec = 0.00044208f;

    // PWM/duty slew: tau = -1/(ln(1-0.1)·44100) = 0.00021522s @ 44.1kHz
    constexpr float kPwmSlewTauSec = 0.00021522f;
    constexpr float kDutySlewTauSec = 0.00021522f;

    // Minimum sample rate validation
    constexpr double kMinSampleRate = 1000.0;
    constexpr double kDefaultSampleRate = 44100.0;

    inline double validateSampleRate(double sr) noexcept
    {
        return (sr > kMinSampleRate) ? sr : kDefaultSampleRate;
    }

} // namespace DSP
} // namespace ABD
