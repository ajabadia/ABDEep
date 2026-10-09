/*
  ==============================================================================

    FXSolinaEnsemble.cpp
    Implementación del envoltorio de producto para FXSolinaEnsemble.

  ==============================================================================
*/

#include "FXSolinaEnsemble.h"
#include <algorithm>

namespace ABD
{
    FXSolinaEnsemble::FXSolinaEnsemble()
    {
        reset();
    }

    void FXSolinaEnsemble::prepare(double sampleRate, int /*samplesPerBlock*/)
    {
        ensemble_.prepare(sampleRate);
    }

    void FXSolinaEnsemble::reset()
    {
        ensemble_.reset();
    }

    void FXSolinaEnsemble::setParameter(int index, float value)
    {
        const float clamped = std::clamp(value, 0.0f, 1.0f);
        switch (index)
        {
            case 0: ensemble_.setRateNorm(clamped); break;
            case 1: ensemble_.setDepthNorm(clamped); break;
            case 2: ensemble_.setFeedbackNorm(clamped); break;
            case 3: ensemble_.setSpreadNorm(clamped); break;
            case 4: ensemble_.setMixNorm(clamped); break;
            default: break;
        }
    }

    void FXSolinaEnsemble::process(const float* inL, const float* inR,
                                    float* outL, float* outR,
                                    int numSamples)
    {
        ensemble_.process(inL, inR, outL, outR, numSamples);
    }
}