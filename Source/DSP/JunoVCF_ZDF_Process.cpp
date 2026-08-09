#include "JunoVCF_ZDF.h"
#include "DSPHelpers.h"
#include <cmath>
#include <algorithm>
#include <cstdint>

namespace ABD
{

// ============================================================
// ZDF core processing
// ============================================================
float JunoVCF_ZDF::process(float input, float frq, float res)
{
    // Clamp frq to the calibrated maximum/minimum cutoff (keeps std::tan stable)
    frq = std::clamp(frq, 0.00001f, VcfCalibration::kMaxNormalizedFreq);

    // Compute resonance feedback k using the active voicing curve.
    // Single mapping (no double multiply): the resonance curve already maps
    // the unipolar 0..1 fader to the solver's feedback k, reaching the
    // self-oscillation threshold (k≈4) at res≈0.86 — the DeepMind 12 hardware
    // onset. A previous version multiplied this by computeResonanceFeedback(),
    // a second res→k map, which pulled self-oscillation down to res≈0.47.
    float k = 0.0f;
    if (mVoicing.resonanceCurve)
        k = mVoicing.resonanceCurve(res);
    else
        k = ResK_J106(res);

    k = SoftClipK(k);

    float kPassed = k;

    // Stability: reduce k near Nyquist
    if (frq > 0.5f)
        k *= std::max(1.0f - (frq - 0.5f) * 1.0f, 0.5f);

    // Frequency compensation (pow/log/exp) — cached across static controls
    if (std::abs(mLastOutFrq - frq) > kJunoVCFCacheEps ||
        std::abs(mLastOutK - k) > kJunoVCFCacheEps)
    {
        mLastOutFrq = frq;
        mLastOutK = k;
        mCachedFreqComp = FreqCompensationClamped(k, frq * 0.25f);
    }
    mFreqComp = mCachedFreqComp;

    if (mOversample == 4)
        lastOutput = process4x(input, frq, res, kPassed);
    else if (mOversample == 2)
        lastOutput = process2x(input, frq, res, kPassed);
    else
        lastOutput = processSampleInternal(input, frq, res, kPassed);

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
    float noiseLevel = VcfCalibration::kNoiseLevelBase / (static_cast<float>(mOversample) * (1.0f + energy * VcfCalibration::kNoiseEnergyGain));
    input += white * noiseLevel;

    // Clamp k near Nyquist
    if (frq > 0.5f)
        k *= std::max(1.0f - (frq - 0.5f) * 1.0f, 0.5f);

    // frq is already clamped to 0.85 at process() entry.
    // std::tan + InputComp(std::pow) dominate the per-sample cost; recompute
    // only when the controls have moved beyond epsilon.
    float g, g1, comp;
    if (std::abs(mLastIntFrq - frq) > kJunoVCFCacheEps ||
        std::abs(mLastIntRes - res) > kJunoVCFCacheEps ||
        std::abs(mLastIntK - k) > kJunoVCFCacheEps ||
        mLastIntFreqComp != mFreqComp)
    {
        mLastIntFrq = frq;
        mLastIntRes = res;
        mLastIntK = k;
        mLastIntFreqComp = mFreqComp;
        g = ABD::DSP::fastTan(frq * kJunoVCFPi * 0.5f);
        g *= mFreqComp;
        g1 = g / (1.0f + g);
        comp = InputComp(k, frq);
        mCachedG = g;
        mCachedG1 = g1;
        mCachedComp = comp;
    }
    else
    {
        g = mCachedG;
        g1 = mCachedG1;
        comp = mCachedComp;
    }

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
    float frqFactor  = std::clamp((frq - VcfCalibration::kOutTameFreqFloor) * VcfCalibration::kOutTameFreqSlope, 0.0f, 1.0f);
    float resFactor  = std::clamp((k - VcfCalibration::kOutTameResStart) * VcfCalibration::kOutTameResSlope, 0.0f, 1.0f);
    float outputScale = 1.0f - frqFactor * resFactor * VcfCalibration::kOutTameMaxReduction;

    // Apply custom voicing gain compensation curve
    if (mVoicing.gainCompCurve)
        outputScale *= mVoicing.gainCompCurve(res);

    return output * VcfCalibration::kOutputScale * outputScale;
}

} // namespace ABD
