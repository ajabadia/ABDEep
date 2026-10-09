/*
  ==============================================================================

    FXOversamplingDistortion.cpp
    Implementación del envoltorio de producto para FXOversamplingDistortion.

  ==============================================================================
*/

#include "FXOversamplingDistortion.h"
#include <algorithm>

namespace ABD
{
    FXOversamplingDistortion::FXOversamplingDistortion()
    {
        reset();
    }

    void FXOversamplingDistortion::prepare(double sampleRate, int /*samplesPerBlock*/)
    {
        dist_.prepare(sampleRate);
    }

    void FXOversamplingDistortion::reset()
    {
        dist_.reset();
    }

    void FXOversamplingDistortion::setParameter(int index, float value)
    {
        const float v = std::clamp(value, 0.0f, 1.0f);
        switch (index)
        {
            case 0: dist_.setDriveNorm(v); break;
            case 1: dist_.setToneNorm(v); break;
            case 2: dist_.setMixNorm(v); break;
            case 3: dist_.setLevelNorm(v); break;
            case 4: dist_.setStereoNorm(v); break;
            default: break;
        }
    }

    void FXOversamplingDistortion::process(const float* inL, const float* inR,
                                            float* outL, float* outR,
                                            int numSamples)
    {
        dist_.process(inL, inR, outL, outR, numSamples);
    }
}
