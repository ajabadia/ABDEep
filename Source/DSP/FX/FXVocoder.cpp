#include "FXVocoder.h"
#include <algorithm>
#include <cmath>

namespace ABD
{

FXVocoder::FXVocoder()
{
    reset();
}

void FXVocoder::prepare(double sr, int /*samplesPerBlock*/)
{
    sampleRate = sr;
    vocoderBank.prepare(sr);
    updateVocoderParams();
    reset();
}

void FXVocoder::reset()
{
    vocoderBank.reset();
    extModL = nullptr;
    extModR = nullptr;
    extModSamples = 0;
}

void FXVocoder::setModulatorInput(const float* modL, const float* modR, int numSamples)
{
    extModL = modL;
    extModR = modR;
    extModSamples = numSamples;
}

void FXVocoder::setParameter(int index, float value)
{
    const float clamped = std::clamp(value, 0.0f, 1.0f);
    switch (index)
    {
        case 0: paramMix = clamped; break;
        case 1: paramBandCount = clamped; updateVocoderParams(); break;
        case 2: paramAttack = clamped; updateVocoderParams(); break;
        case 3: paramRelease = clamped; updateVocoderParams(); break;
        case 4: paramFormantShift = clamped; updateVocoderParams(); break;
        case 5: paramModSrc = clamped; updateVocoderParams(); break;
        default: break;
    }
}

void FXVocoder::updateVocoderParams()
{
    const int numBands = 4 + static_cast<int>(paramBandCount * 28.0f);
    vocoderBank.setBandCount(numBands);
    vocoderBank.setLogFrequencies(100.0f, static_cast<float>(sampleRate) * 0.45f);

    const float formantFactor = std::pow(2.0f, (paramFormantShift - 0.5f) * 2.0f);
    vocoderBank.setFormantShift(formantFactor);

    // Mapeo de ataque (1ms a 11ms) y caída (5ms a 55ms) consistente con el original
    const float attackSec = paramAttack * 0.01f + 0.001f;
    const float releaseSec = paramRelease * 0.05f + 0.005f;
    vocoderBank.setAttackRelease(attackSec, releaseSec);

    vocoderBank.setUseInternalModulator(paramModSrc > 0.5f);
}

void FXVocoder::process(const float* inL, const float* inR,
                        float* outL, float* outR,
                        int numSamples)
{
    // Búferes temporales estáticos en stack (512 muestras) para RT-safety
    float wetL[512];
    float wetR[512];

    for (int offset = 0; offset < numSamples; offset += 512)
    {
        const int chunkSize = std::min(512, numSamples - offset);
        const float* cL = inL + offset;
        const float* cR = inR + offset;

        const float* mL = (extModL && offset < extModSamples) ? (extModL + offset) : nullptr;
        const float* mR = (extModR && offset < extModSamples) ? (extModR + offset) : nullptr;

        vocoderBank.process(cL, cR, mL, mR, wetL, wetR, chunkSize);

        for (int i = 0; i < chunkSize; ++i)
        {
            const int s = offset + i;
            outL[s] = inL[s] + (wetL[i] - inL[s]) * paramMix;
            outR[s] = inR[s] + (wetR[i] - inR[s]) * paramMix;
        }
    }

    extModL = nullptr;
    extModR = nullptr;
    extModSamples = 0;
}

} // namespace ABD
