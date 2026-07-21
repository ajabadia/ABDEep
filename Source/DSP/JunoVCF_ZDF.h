#pragma once
#include <array>
#include <cmath>
#include <algorithm>
#include <cstdint>
#include <cstring>
#include "VcfVoicing.h"

namespace ABD
{

// ============================================================
// Polyphase IIR resampler (Laurent de Soras) — 2x up/down
// ============================================================
static constexpr int kNumResamplerCoefs = 12;

struct Upsampler2x
{
    float coef[kNumResamplerCoefs] = {};
    float x[kNumResamplerCoefs] = {};
    float y[kNumResamplerCoefs] = {};

    void setCoefs(const double c[kNumResamplerCoefs]);
    void clearBuffers();
    void processSample(float& out0, float& out1, float input);
};

struct Downsampler2x
{
    float coef[kNumResamplerCoefs] = {};
    float x[kNumResamplerCoefs] = {};
    float y[kNumResamplerCoefs] = {};

    void setCoefs(const double c[kNumResamplerCoefs]);
    void clearBuffers();
    float processSample(const float in[2]);
};

/**
 * JunoVCF_ZDF — TPT ZDF OTA Ladder Filter (IR3109 / 80017A model)
 *
 * Simplified from ABDJUNiO601 JunoVCF for ABDEep:
 *   - Accepts cutoffHz directly (no MCU 14-bit arithmetic)
 *   - No CalibrationSettings dependency
 *   - Oversampling 2x/4x for Enhanced mode
 * Default voicing: DeepMind. Callers can override via setMode().
 * The voicing policy lives here, not in upstream wrappers.
 */
class JunoVCF_ZDF
{
public:
    JunoVCF_ZDF();

    enum class Mode
    {
        Juno106,
        DeepMind
    };

    enum class PoleMode
    {
        FourPole,   // 24 dB/oct — 4 integrators in cascade
        TwoPole     // 12 dB/oct — 2 integrators in cascade
    };

    void setMode(Mode m) noexcept;
    void setPoleMode(PoleMode m) noexcept;
    void setVoicing(const VcfVoicing& voicing) noexcept;

    void reset();
    void prepare(double newSampleRate);
    void setOversample(int factor);  // 1, 2, or 4

    /**
     * Process a single sample through the ZDF ladder filter.
     * @param input   Audio sample (-1..1)
     * @param frq     Normalized frequency (cutoffHz / Nyquist), 0..0.5
     * @param res     Resonance 0..1 (mapped internally to feedback k)
     * @return        Filtered output
     */
    float process(float input, float frq, float res);

private:
    // ---- OTA saturation functions (Pade 3/3 tanh approximation) ----
    static inline float OTASat(float x) noexcept
    {
        if (x > 3.f) return 1.f;
        if (x < -3.f) return -1.f;
        float x2 = x * x;
        return x * (27.f + x2) / (27.f + 9.f * x2);
    }

    static inline float OTASatDeriv(float x) noexcept
    {
        if (x > 3.f || x < -3.f) return 0.f;
        float x2 = x * x;
        float d = 27.f + 9.f * x2;
        return 27.f * (27.f - 3.f * x2) / (d * d);
    }

    // Non-linear stage solver via Newton-Raphson
    static inline float NLStage(float& s, float x, float g, float g1, float otaScale) noexcept
    {
        float y = s + g1 * (x - s);
        float diff = x - y;
        float sd = diff * otaScale;
        float t = OTASat(sd) / otaScale;
        float f = y - s - g * t;
        float df = 1.f + g * OTASatDeriv(sd);
        y -= f / df;
        s = 2.f * y - s;
        return y;
    }

    // Resonance curve: J106 polynomial fit
    static inline float ResK_J106(float res) noexcept
    {
        float r2 = res * res;
        float r3 = r2 * res;
        float r4 = r2 * r2;
        return 1.24f * (4.7116f * res - 6.5743f * r2 + 13.4633f * r3 - 8.2197f * r4);
    }

    // Resonance curve: Juno-6 exponential
    static inline float ResK_J6(float res) noexcept
    {
        constexpr float kShape = 2.128f;
        constexpr float kNorm  = 0.811f;
        return kNorm * (std::exp(kShape * res) - 1.f);
    }

    // Soft-clip resonance above k=3.0 (OTA gain compression)
    static inline float SoftClipK(float k) noexcept
    {
        if (k > 3.0f)
        {
            float excess = k - 3.0f;
            k = 3.0f + excess / (1.0f + excess * 0.2f);
        }
        return std::min(k, 6.6f);
    }

    // Cutoff compensation for high resonance
    static inline float FreqCompensationClamped(float k, float frq) noexcept
    {
        float lowQ = std::max(1.0f, 0.42f * std::pow(std::max(frq, 1e-6f), -0.12f));
        float logdist = std::log(std::max(frq, 1e-6f) / 0.012f);
        lowQ += 0.20f * std::exp(-logdist * logdist / 1.0f);
        float blend = std::min(k * k * 0.0625f, 1.f);
        return lowQ + blend * (1.f - lowQ);
    }

    // Input Q compensation
    static inline float InputComp(float k, float frq) noexcept
    {
        float qComp = 0.379f + 0.087f * k;
        float freqGain = std::pow(std::max(frq, 1e-6f) * (1.f / 0.00445f), -0.10f);
        freqGain = std::clamp(freqGain, 0.65f, 1.2f);
        return qComp * freqGain;
    }

    // OTA saturation scaling based on frequency/resonance
    static constexpr float kOTAScaleBase = 0.35f;
    static inline float OTAScaleForFreq(float frq, float res = 0.f) noexcept
    {
        float scale = kOTAScaleBase;
        if (frq < 0.005f)
        {
            float blend = std::max(frq / 0.005f, 0.15f);
            scale *= blend;
        }
        if (res > 0.f)
        {
            float resK = ResK_J106(res);
            float resBlend = std::min(resK * resK * 0.0625f, 1.f);
            scale = scale + resBlend * (kOTAScaleBase - scale);
        }
        return scale;
    }

    // Resonance feedback with self-oscillation
    static inline float computeResonanceFeedback(float res01, float selfOscThreshold = 0.95f, float selfOscInt = 1.0f) noexcept
    {
        if (res01 < selfOscThreshold)
            return res01 * (4.0f / selfOscThreshold);
        const float excess = (res01 - selfOscThreshold) / (1.0f - selfOscThreshold);
        return 4.0f + excess * selfOscInt;
    }

    // ---- Core ZDF processing ----
    float processSampleInternal(float input, float frq, float res, float k);
    float process2x(float input, float frq, float res, float k);
    float process4x(float input, float frq, float res, float k);

    // 4-stage TPT state
    std::array<float, 4> s{};
    float lastOutput = 0.0f;

    double sampleRate    = 44100.0;
    float  invSampleRate = 1.0f / 44100.0f;

    int mOversample = 1;

    // Thermal noise seed
    uint32_t mNoiseSeed = 123456789u;
    float mInputEnv = 0.f;
    float mEnvDecay = 0.999f;
    float mFreqComp = 1.f;

    // Resamplers
    Upsampler2x mUp1, mUp2;
    Downsampler2x mDown1, mDown2;

    Mode mMode = Mode::Juno106;
    PoleMode mPoleMode = PoleMode::FourPole;
    VcfVoicing mVoicing;
};

} // namespace ABD
