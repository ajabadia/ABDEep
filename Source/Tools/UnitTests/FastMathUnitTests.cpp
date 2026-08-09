/**
 * @purpose Tolerance validation for fast-math DSP candidates (fastTan, fastExp2)
 *          against their stdlib counterparts, over the exact domains used in the
 *          synth hot paths. Written BEFORE replacing any hot-path call — the
 *          approved Tier 3 strategy is "prove the candidate under tolerance, then
 *          substitute".
 *
 * Tolerances (per DSP Inspector dictamen):
 *   fastTan   -> relative error < 1e-5  (SNR > 100 dB) on x in [0.0001, 1.335]
 *                (~0.85·pi/2). This is the true domain of the ZDF VCF: the filter
 *                computes g = tan(frq·pi/2) with frq clamped to 0.907 at process()
 *                entry (0.907 = 20 kHz / Nyquist @44.1k), so x never exceeds
 *                0.907·pi/2 ≈ 1.425 (just under the fastTan Taylor knee).
 *                Oversampled paths halve frq, so their tan arguments are strictly smaller.
 *   fastExp2  -> pitch error < 0.01 cents on x in [-10, +10]  (vs std::exp2).
 * @classification Test
 */
#include <JuceHeader.h>
#include "DSPHelpers.h"

#include <cmath>
#include <algorithm>
#include <limits>

namespace ABD
{

class FastMathUnitTests : public juce::UnitTest
{
public:
    static constexpr double kPi = 3.14159265358979323846;

    FastMathUnitTests() : juce::UnitTest("FastMath Tolerance Tests", "ABD") {}

    void runTest() override
    {
        using namespace ABD::DSP;

        //==============================================================================
        beginTest("fastTan — max relative error vs std::tan on full engine spec domain");
        {
            // Real ZDF domain: x = frq·pi/2, frq in [fc_min/nyquist, 0.907] (clamped).
            // Covers 1x path at fs 44.1/48/96 kHz for fc up to the 0.907 clamp.
            const double xMin = kPi * 20.0 / 96000.0;   // ~0.00065 (lowest engine x)
            const double xMax = kPi * 0.907 * 0.5;      // 0.907·pi/2 ≈ 1.425 (clamp)

            double worstRel = 0.0, worstX = 0.0;
            constexpr int kSteps = 400000;

            for (int i = 0; i <= kSteps; ++i)
            {
                const double x = xMin + (xMax - xMin) * i / kSteps;
                const double ref = std::tan(x);
                if (ref == 0.0) continue;
                const double err = std::abs((double)fastTan((float)x) - ref) / std::abs(ref);
                if (err > worstRel) { worstRel = err; worstX = x; }
            }

            constexpr double kTol = 1e-5;
            logMessage(juce::String("fastTan max relative error: ") + juce::String(worstRel, 8)
                       + " at x=" + juce::String(worstX, 6) + " (tolerance " + juce::String(kTol) + ")");
            expect(worstRel < kTol,
                   "fastTan must stay under 1e-5 relative error across the whole VCF spec domain");
        }

        //==============================================================================
        beginTest("fastTan — headroom beyond clamp up to the Taylor knee (x = 1.425)");
        {
            // Margin guard: the fc/fs interpretation of the 44.1 kHz worst case
            // (fc=20 kHz, pre-clamp) reaches x = 1.4247. The candidate must still
            // hold tolerance there so callers never silently degrade.
            double worstRel = 0.0;
            constexpr int kSteps = 200000;
            const double xMin = kPi * 0.907 * 0.5;      // 1.425 (clamp)
            const double xMax = 1.425;                   // Taylor convergence knee
            for (int i = 0; i <= kSteps; ++i)
            {
                const double x = xMin + (xMax - xMin) * i / kSteps;
                const double ref = std::tan(x);
                if (ref == 0.0) continue;
                const double err = std::abs((double)fastTan((float)x) - ref) / std::abs(ref);
                if (err > worstRel) worstRel = err;
            }
            logMessage(juce::String("fastTan headroom max relative error: ") + juce::String(worstRel, 8));
            expect(worstRel < 1e-5,
                   "fastTan must stay under 1e-5 relative error up to the 1.425 knee");
        }

        //==============================================================================
        beginTest("fastExp2 — max pitch error in cents vs std::exp2 on [-10, +10]");
        {
            double worstCents = 0.0, worstX = 0.0;
            constexpr int kSteps = 400000;
            constexpr double kLo = -10.0, kHi = 10.0;
            for (int i = 0; i <= kSteps; ++i)
            {
                const double x = kLo + (kHi - kLo) * i / kSteps;
                const double ref = std::exp2(x);
                const double got = (double)fastExp2((float)x);
                const double cents = std::abs(1200.0 * std::log2(got / ref));
                if (cents > worstCents) { worstCents = cents; worstX = x; }
            }
            constexpr double kTol = 0.01;
            logMessage(juce::String("fastExp2 max pitch error: ") + juce::String(worstCents, 6)
                       + " cents at x=" + juce::String(worstX, 4)
                       + " (tolerance " + juce::String(kTol) + " cents)");
            expect(worstCents < kTol,
                   "fastExp2 must stay under 0.01 cents over the full [-10, 10] domain");
        }

        //==============================================================================
        beginTest("fastExp2 — cutoff call-site equivalence vs std::pow over the curveBase clamp");
        {
            // SynthVoice_Filter.cpp maps cutoff = vcfMinHz * pow(curveBase, lvl) with
            // lvl in [0,1]. curveBase is clamped to [50, 2000] (CalibrationSpec.cpp:54),
            // so the fastExp2 argument x = lvl*log2(curveBase) reaches log2(2000) ~ 10.97 —
            // slightly past the nominal [-10,+10] dictamen domain. Prove the candidate
            // still holds 0.01 cents pitch error across the FULL clamp range before the
            // substitution is allowed.
            double worstCents = 0.0, worstBase = 0.0, worstLvl = 0.0;
            constexpr int kBaseSteps = 1951;   // 50..2000
            constexpr int kLvlSteps = 500;     // 0..1
            for (int ib = 0; ib <= kBaseSteps; ++ib)
            {
                const double base = 50.0 + (2000.0 - 50.0) * ib / kBaseSteps;
                for (int il = 0; il <= kLvlSteps; ++il)
                {
                    const double lvl = (double)il / kLvlSteps;
                    const double ref = std::pow(base, lvl);
                    const float x = (float)(lvl * std::log2(base));
                    const double got = (double)fastExp2(x);
                    const double cents = std::abs(1200.0 * std::log2(got / ref));
                    if (cents > worstCents) { worstCents = cents; worstBase = base; worstLvl = lvl; }
                }
            }
            constexpr double kTol = 0.01;
            logMessage(juce::String("fastExp2 cutoff mapping max pitch error: ") + juce::String(worstCents, 6)
                       + " cents at curveBase=" + juce::String(worstBase, 4)
                       + ", lvl=" + juce::String(worstLvl, 4)
                       + " (tolerance " + juce::String(kTol) + " cents)");
            expect(worstCents < kTol,
                   "fastExp2 cutoff mapping must stay under 0.01 cents across the full curveBase clamp");
        }

        //==============================================================================
        beginTest("masterSoftClip -- headroom=1.0 reproduces legacy tanh exactly");
        {
            bool identical = true;
            float worstDiff = 0.0f;
            for (int i = -2000; i <= 2000; ++i)
            {
                const float x = (float)i / 100.0f; // [-20, +20]
                const float ref = std::tanh(x);
                const float got = masterSoftClip(x, 1.0f);
                worstDiff = std::max(worstDiff, std::abs(got - ref));
                if (std::abs(got - ref) > 1e-6f)
                    identical = false;
            }
            logMessage("masterSoftClip headroom=1.0 vs std::tanh: max |diff| = " + juce::String(worstDiff, 8));
            expect(identical, "masterSoftClip(x, 1.0) must equal std::tanh(x) over [-20, +20]");
        }

        //==============================================================================
        beginTest("masterSoftClip -- transparent for small x at higher headroom");
        {
            // tanh curvature gives relative error ~ (x/headroom)^2 / 3, so the
            // soft-clip must be transparent (|y-x|/|x| < 1e-3) for |x| <= 0.05·headroom.
            bool transparent = true;
            float worstRel = 0.0f;
            for (const float h : { 1.5f, 2.0f })
            {
                const float xMax = 0.05f * h;
                for (int i = -1000; i <= 1000; ++i)
                {
                    const float x = (float)i / 1000.0f * xMax;
                    if (std::abs(x) < 1e-6f) continue;
                    const float got = masterSoftClip(x, h);
                    const float rel = std::abs(got - x) / std::abs(x);
                    worstRel = std::max(worstRel, rel);
                    if (rel >= 1e-3f) transparent = false;
                }
            }
            logMessage("masterSoftClip transparency (max |y-x|/|x| on |x|<=0.1*h): " + juce::String(worstRel, 8));
            expect(transparent, "masterSoftClip must be transparent (rel err < 1e-3) well below the headroom knee");
        }

        //==============================================================================
        beginTest("masterSoftClip -- output bounded by headroom and monotonic");
        {
            bool bounded = true, monotonic = true;
            float prev = -std::numeric_limits<float>::infinity();
            for (int i = -5000; i <= 5000; ++i)
            {
                const float x = (float)i / 250.0f; // [-20, +20]
                for (const float h : { 1.0f, 1.5f, 2.0f })
                {
                    const float y = masterSoftClip(x, h);
                    if (std::abs(y) > h + 1e-6f) bounded = false;
                }
                const float y20 = masterSoftClip(x, 2.0f);
                if (y20 < prev - 1e-6f) monotonic = false;
                prev = y20;
            }
            expect(bounded, "masterSoftClip output magnitude must never exceed headroom");
            expect(monotonic, "masterSoftClip must be monotonically non-decreasing");
            logMessage("masterSoftClip bound + monotonicity: OK");
        }
        //==============================================================================
        beginTest("slewCoeffFromTimeConstant -- physical time-constant invariance across SR");
        {
            // Formula check: c = 1 - exp(-1/(tau·sr)), driven only by tau + DAW SR.
            {
                const float c = slewCoeffFromTimeConstant(0.0004f, 48000.0);
                const float ref = 1.0f - (float)std::exp(-1.0 / (0.0004 * 48000.0));
                if (std::abs(c - ref) > 1e-6f)
                    expect(false, "slewCoeffFromTimeConstant must match 1-exp(-1/(tau*sr))");
            }

            // Physical invariance: simulating the 1-pole smoother of a unit step for a
            // fixed duration T must reach the same value at every sample rate.
            // Uses only the time constant (seconds) + the per-rate coefficient.
            auto simulate = [](float tau, double sr, double seconds)
            {
                const float c = slewCoeffFromTimeConstant(tau, sr);
                const int n = (int)(sr * seconds);
                double y = 0.0;
                for (int i = 0; i < n; ++i)
                    y += (1.0 - y) * c;
                return y;
            };

            const double T = 0.02; // 20 ms step response
            const double ref = simulate(0.0004f, 44100.0, T);
            double worstRel = 0.0;
            for (const double sr : { 48000.0, 88200.0, 96000.0, 192000.0 })
            {
                const double y = simulate(0.0004f, sr, T);
                worstRel = std::max(worstRel, std::abs(y - ref) / std::max(ref, 1e-9));
            }
            logMessage("slewCoeffFromTimeConstant step-response drift across SR (worst rel): "
                       + juce::String(worstRel, 10));
            expect(worstRel < 1e-4, "smoothing step response must be invariant across sample rates");

            // Monotonicity: higher sample rate => smaller per-sample coefficient (fixed tau).
            const float c96 = slewCoeffFromTimeConstant(0.00021522f, 96000.0);
            const float c48 = slewCoeffFromTimeConstant(0.00021522f, 48000.0);
            expect(c96 > 0.0f && c96 < c48, "coeff must shrink as sample rate rises (0 < c96 < c48)");

            // Legacy tuning provenance: the time constants used in production (voice
            // cutoff/amp smoothing and oscillator PWM/duty slews) must reproduce the
            // original per-sample coefficients at the 44.1 kHz legacy reference rate.
            // Reference only; production code computes coeff from the DAW SR alone.
            constexpr double kLegacyRefSR = 44100.0;
            constexpr float kSmoothTauSec = 0.00044208f;   // legacy 0.05/sample @ 44.1 kHz
            constexpr float kPwmSlewTauSec = 0.00021522f;  // legacy 0.1/sample @ 44.1 kHz
            const float cCutoff = slewCoeffFromTimeConstant(kSmoothTauSec, kLegacyRefSR);
            const float cOscSlew = slewCoeffFromTimeConstant(kPwmSlewTauSec, kLegacyRefSR);
            expect(std::abs(cCutoff - 0.05f) < 1e-5f, "smooth tau must reproduce legacy 0.05 @44.1kHz");
            expect(std::abs(cOscSlew - 0.1f) < 1e-5f, "osc slew tau must reproduce legacy 0.1 @44.1kHz");
        }
    }
};

static FastMathUnitTests fastMathUnitTests;

} // namespace ABD
