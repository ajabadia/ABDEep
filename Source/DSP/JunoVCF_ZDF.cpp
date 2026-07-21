#include "JunoVCF_ZDF.h"
#include <cmath>
#include <algorithm>
#include <cstring>

namespace ABD
{

// ------------------------------------------------------------
// Resampler coefficients (Laurent de Soras, 2x polyphase IIR)
// ------------------------------------------------------------
static constexpr double kResamplerCoefs2x[kNumResamplerCoefs] = {
    0.036681502163648017, 0.13654762463195794, 0.27463175937945444,
    0.42313861743656711, 0.56109869787919531, 0.67754004997416184,
    0.76974183386322703, 0.83988962484963892, 0.89226081800387902,
    0.9315419599631839,  0.96209454837808417, 0.98781637073289585
};

static constexpr float kPi = 3.14159265358979323846f;

// ============================================================
// Upsampler2x / Downsampler2x
// ============================================================
void Upsampler2x::setCoefs(const double c[kNumResamplerCoefs])
{
    for (int i = 0; i < kNumResamplerCoefs; ++i)
        coef[i] = static_cast<float>(c[i]);
}

void Upsampler2x::clearBuffers()
{
    std::memset(x, 0, sizeof(x));
    std::memset(y, 0, sizeof(y));
}

void Upsampler2x::processSample(float& out0, float& out1, float input)
{
    float even = input;
    float odd  = input;
    for (int i = 0; i < kNumResamplerCoefs; i += 2)
    {
        float t0 = (even - y[i])     * coef[i]     + x[i];
        float t1 = (odd  - y[i + 1]) * coef[i + 1] + x[i + 1];
        x[i]     = even;   x[i + 1] = odd;
        y[i]     = t0;     y[i + 1] = t1;
        even = t0;          odd = t1;
    }
    out0 = even;
    out1 = odd;
}

void Downsampler2x::setCoefs(const double c[kNumResamplerCoefs])
{
    for (int i = 0; i < kNumResamplerCoefs; ++i)
        coef[i] = static_cast<float>(c[i]);
}

void Downsampler2x::clearBuffers()
{
    std::memset(x, 0, sizeof(x));
    std::memset(y, 0, sizeof(y));
}

float Downsampler2x::processSample(const float in[2])
{
    float spl0 = in[1];
    float spl1 = in[0];
    for (int i = 0; i < kNumResamplerCoefs; i += 2)
    {
        float t0 = (spl0 - y[i])     * coef[i]     + x[i];
        float t1 = (spl1 - y[i + 1]) * coef[i + 1] + x[i + 1];
        x[i]     = spl0;   x[i + 1] = spl1;
        y[i]     = t0;     y[i + 1] = t1;
        spl0 = t0;          spl1 = t1;
    }
    return 0.5f * (spl0 + spl1);
}

// ============================================================
// JunoVCF_ZDF
// ============================================================
JunoVCF_ZDF::JunoVCF_ZDF()
{
    mUp1.setCoefs(kResamplerCoefs2x);
    mUp2.setCoefs(kResamplerCoefs2x);
    mDown1.setCoefs(kResamplerCoefs2x);
    mDown2.setCoefs(kResamplerCoefs2x);
    // Default to DeepMind voicing — the primary mode for ABDEep.
    // JunoVCF_ZDF is the solver core; voicing policy is set here,
    // not by upstream wrappers. Callers can override via setMode().
    setMode(Mode::DeepMind);
    reset();
}

void JunoVCF_ZDF::setMode(Mode m) noexcept
{
    mMode = m;
    if (m == Mode::Juno106)
    {
        mVoicing.resonanceCurve = [](float r) {
            float r2 = r * r;
            float r3 = r2 * r;
            float r4 = r2 * r2;
            return 1.24f * (4.7116f * r - 6.5743f * r2 + 13.4633f * r3 - 8.2197f * r4);
        };
        mVoicing.gainCompCurve = [](float) {
            return 1.0f;
        };
        mVoicing.stageSaturationAmount = 1.0f;
    }
    else if (m == Mode::DeepMind)
    {
        mVoicing.resonanceCurve = [](float r) {
            float r2 = r * r;
            float r3 = r2 * r;
            float r4 = r2 * r2;
            float kJuno = 1.24f * (4.7116f * r - 6.5743f * r2 + 13.4633f * r3 - 8.2197f * r4);
            return kJuno * 0.8f;
        };
        mVoicing.gainCompCurve = [](float r) {
            float a = 2.0f;
            return 1.0f / (1.0f + a * r * r);
        };
        mVoicing.stageSaturationAmount = 0.7f;
    }
}

void JunoVCF_ZDF::setVoicing(const VcfVoicing& voicing) noexcept
{
    mVoicing = voicing;
}

void JunoVCF_ZDF::reset()
{
    s.fill(0.0f);
    lastOutput = 0.0f;
    mUp1.clearBuffers();
    mUp2.clearBuffers();
    mDown1.clearBuffers();
    mDown2.clearBuffers();
    mInputEnv = 0.0f;
}

void JunoVCF_ZDF::prepare(double newSampleRate)
{
    sampleRate    = newSampleRate;
    invSampleRate = 1.0f / static_cast<float>(newSampleRate);
    mEnvDecay = std::exp(-1.0f / (0.022f * static_cast<float>(sampleRate)
                                    * static_cast<float>(mOversample)));
}

void JunoVCF_ZDF::setOversample(int factor)
{
    int prev = mOversample;
    mOversample = (factor <= 1) ? 1 : (factor == 2) ? 2 : 4;
    mEnvDecay = std::exp(-1.0f / (0.022f * static_cast<float>(sampleRate)
                                    * static_cast<float>(mOversample)));
    if (mOversample == 4 && prev == 2)
    {
        mUp2.clearBuffers();
        mDown2.clearBuffers();
    }
}

// ============================================================
// Core ZDF processing — 4-pole TPT OTA ladder
// ============================================================
float JunoVCF_ZDF::process(float input, float frq, float res)
{
    // Clamp frq to Nyquist
    frq = std::min(frq, 0.85f);

    // Compute resonance feedback k using active voicing curve
    float selfOscThreshold = 0.95f;
    float selfOscInt       = 1.0f;
    float k = 0.0f;
    if (mVoicing.resonanceCurve)
        k = mVoicing.resonanceCurve(res) * computeResonanceFeedback(res, selfOscThreshold, selfOscInt);
    else
        k = ResK_J106(res) * computeResonanceFeedback(res, selfOscThreshold, selfOscInt);

    k = SoftClipK(k);

    float kPassed = k;

    // Stability: reduce k near Nyquist
    if (frq > 0.5f)
        k *= std::max(1.0f - (frq - 0.5f) * 1.0f, 0.5f);

    mFreqComp = FreqCompensationClamped(k, frq * 0.25f);

    float saturationScale = 1.0f;

    if (mOversample == 4)
        lastOutput = process4x(input, frq, res, kPassed) * saturationScale;
    else if (mOversample == 2)
        lastOutput = process2x(input, frq, res, kPassed) * saturationScale;
    else
        lastOutput = processSampleInternal(input, frq, res, kPassed) * saturationScale;

    return lastOutput;
}

float JunoVCF_ZDF::process2x(float input, float frq, float res, float k)
{
    float up[2], down[2];
    mUp1.processSample(up[0], up[1], input);

    float frq2x = frq * 0.5f;
    down[0] = processSampleInternal(up[0], frq2x, res, k);
    down[1] = processSampleInternal(up[1], frq2x, res, k);

    return mDown1.processSample(down);
}

float JunoVCF_ZDF::process4x(float input, float frq, float res, float k)
{
    float frq4x = frq * 0.25f;

    float up2x[2];
    mUp1.processSample(up2x[0], up2x[1], input);

    float down4x[2], down2x[2];

    float up4x_a[2];
    mUp2.processSample(up4x_a[0], up4x_a[1], up2x[0]);
    down4x[0] = processSampleInternal(up4x_a[0], frq4x, res, k);
    down4x[1] = processSampleInternal(up4x_a[1], frq4x, res, k);
    down2x[0] = mDown2.processSample(down4x);

    float up4x_b[2];
    mUp2.processSample(up4x_b[0], up4x_b[1], up2x[1]);
    down4x[0] = processSampleInternal(up4x_b[0], frq4x, res, k);
    down4x[1] = processSampleInternal(up4x_b[1], frq4x, res, k);
    down2x[1] = mDown2.processSample(down4x);

    return mDown1.processSample(down2x);
}

float JunoVCF_ZDF::processSampleInternal(float input, float frq, float res, float k)
{
    // Adaptive thermal noise — masks zipper artifacts and improves detail
    mNoiseSeed = mNoiseSeed * 196314165u + 907633515u;
    float white = static_cast<float>(mNoiseSeed) / static_cast<float>(0xFFFFFFFFu) * 2.0f - 1.0f;
    mInputEnv = std::max(std::abs(input), mInputEnv * mEnvDecay);
    float stateEnergy = std::abs(s[0]) + std::abs(s[1]) + std::abs(s[2]) + std::abs(s[3]);
    float energy = std::max(mInputEnv, stateEnergy);
    float noiseLevel = 1.0e-2f / (static_cast<float>(mOversample) * (1.0f + energy * 1000.0f));
    input += white * noiseLevel;

    // Clamp k near Nyquist
    if (frq > 0.5f)
        k *= std::max(1.0f - (frq - 0.5f) * 1.0f, 0.5f);

    float frqUnclamped = frq;
    frq = std::min(frq, 0.85f);
    float g = std::tan(frq * kPi * 0.5f);
    g *= mFreqComp;

    float g1 = g / (1.0f + g);
    float G = 0.0f;
    float S = 0.0f;

    if (mPoleMode == PoleMode::TwoPole)
    {
        G = g1 * g1;
        S = s[0] * g1 + s[1];
    }
    else
    {
        G = g1 * g1 * g1 * g1;
        S = s[0] * g1 * g1 * g1 + s[1] * g1 * g1 + s[2] * g1 + s[3];
    }

    float comp = InputComp(k, frq);

    // Resonance feedback via OTA saturation
    float kFbScale = 4.20f * std::clamp((k - 2.5f) * 1.0f, 0.3f, 1.0f);
    float fbSig = OTASat(S * kFbScale) / kFbScale;

    // ZDF input equation (scaled by active stageSaturationAmount for analog saturation adjustment)
    float u = (input * comp * mVoicing.stageSaturationAmount - k * fbSig) / (1.0f + k * G);

    // 4-stage integration with NL OTA saturation (always enabled — no hardware toggle)
    float stateAmp = std::abs(s[3]);
    float dfGain = 1.0f / std::sqrt(1.0f + 0.6f * stateAmp * stateAmp);
    dfGain = std::max(dfGain, 0.65f);

    float hfFade = std::clamp((0.12f - frq) * 25.0f, 0.0f, 1.0f);
    dfGain = 1.0f - hfFade * (1.0f - dfGain);
    float g1NL = g1 / dfGain;
    g1NL = std::min(g1NL, 0.98f);

    float gNL = g1NL / (1.0f - g1NL);
    float ota = OTAScaleForFreq(frq, res);

    float lp1 = NLStage(s[0], u,   gNL, g1NL, ota);
    float lp2 = NLStage(s[1], lp1, gNL, g1NL, ota);

    float output = 0.0f;
    if (mPoleMode == PoleMode::TwoPole)
    {
        // 2-pole output from lp2 stage (-12dB/oct). lp3/lp4 stay frozen.
        output = lp2;
    }
    else
    {
        // 4-pole output from lp4 stage (-24dB/oct).
        float lp3 = NLStage(s[2], lp2, gNL, g1NL, ota);
        float lp4 = NLStage(s[3], lp3, gNL, g1NL, ota);
        output = lp4;
    }

    // Denormal cleanup
    for (auto& st : s)
    {
        if (std::abs(st) < 1.0e-15f)
            st = 0.0f;
    }

    // Output scaling — reduced at high resonance to tame self-oscillation volume
    float frqFactor  = std::clamp((frqUnclamped - 0.02f) * 20.0f, 0.0f, 1.0f);
    float resFactor  = std::clamp((k - 2.0f) * 0.5f, 0.0f, 1.0f);
    float outputScale = 1.0f - frqFactor * resFactor * 0.5f;

    // Apply custom voicing gain compensation curve
    if (mVoicing.gainCompCurve)
        outputScale *= mVoicing.gainCompCurve(res);

    return output * 3.22f * outputScale;
}

void JunoVCF_ZDF::setPoleMode(PoleMode m) noexcept
{
    mPoleMode = m;
}

} // namespace ABD
