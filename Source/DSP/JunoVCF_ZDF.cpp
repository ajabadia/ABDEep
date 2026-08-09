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
// JunoVCF_ZDF — Lifecycle
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

void JunoVCF_ZDF::invalidateCoefficientCaches() noexcept
{
    // Sentinel keys that can never match a live control value
    mLastOutFrq = -1.0f;
    mLastOutK = -1.0f;
    mLastIntFrq = -1.0f;
    mLastIntRes = -1.0f;
    mLastIntK = -1.0f;
    mLastIntFreqComp = -1.0f;
}

void JunoVCF_ZDF::setMode(Mode m) noexcept
{
    mMode = m;
    invalidateCoefficientCaches();
    if (m == Mode::Juno106)
    {
        mVoicing.resonanceCurve = [](float r) {
            return ResK_J106(r);
        };
        mVoicing.gainCompCurve = [](float) {
            return 1.0f;
        };
        mVoicing.stageSaturationAmount = 1.0f;
    }
    else if (m == Mode::DeepMind)
    {
        mVoicing.resonanceCurve = [](float r) {
            return ResK_J106(r) * VcfCalibration::kDeepMindResCurveScale;
        };
        mVoicing.gainCompCurve = [](float r) {
            float a = VcfCalibration::kDeepMindGainCompStrength;
            return 1.0f / (1.0f + a * r * r);
        };
        mVoicing.stageSaturationAmount = VcfCalibration::kDeepMindStageSaturation;
    }
}

void JunoVCF_ZDF::setVoicing(const VcfVoicing& voicing) noexcept
{
    mVoicing = voicing;
    invalidateCoefficientCaches();
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
    invalidateCoefficientCaches();
}

void JunoVCF_ZDF::prepare(double newSampleRate)
{
    sampleRate = newSampleRate;
    mEnvDecay = std::exp(-1.0f / (VcfCalibration::kInputEnvTauSec * static_cast<float>(sampleRate)
                                    * static_cast<float>(mOversample)));
    // Limpiar estados al cambiar sample rate para evitar residuales de SR anterior
    reset();
}

void JunoVCF_ZDF::setOversample(int factor)
{
    int prev = mOversample;
    mOversample = (factor <= 1) ? 1 : (factor == 2) ? 2 : 4;
    mEnvDecay = std::exp(-1.0f / (VcfCalibration::kInputEnvTauSec * static_cast<float>(sampleRate)
                                    * static_cast<float>(mOversample)));
    if (mOversample == 4 && prev == 2)
    {
        mUp2.clearBuffers();
        mDown2.clearBuffers();
    }
}

void JunoVCF_ZDF::setPoleMode(PoleMode m) noexcept
{
    mPoleMode = m;
    invalidateCoefficientCaches();
}

} // namespace ABD
