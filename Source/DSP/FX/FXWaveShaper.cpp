/*
  ==============================================================================

    FXWaveShaper.cpp
    Implementación del envoltorio de producto para FXWaveShaper.

  ==============================================================================
*/

#include "FXWaveShaper.h"
#include <algorithm>

namespace ABD
{
    FXWaveShaper::FXWaveShaper()
    {
        reset();
    }

    void FXWaveShaper::prepare(double sampleRate, int /*samplesPerBlock*/)
    {
        shaper_.prepare(sampleRate);
    }

    void FXWaveShaper::reset()
    {
        shaper_.reset();
    }

    void FXWaveShaper::setParameter(int index, float value)
    {
        const float v = std::clamp(value, 0.0f, 1.0f);
        switch (index)
        {
            case 0: shaper_.setShapeNorm(v); break;
            case 1: shaper_.setSymmetryNorm(v); break;
            case 2: shaper_.setGainNorm(v); break;
            case 3: shaper_.setToneNorm(v); break;
            case 4: shaper_.setMixNorm(v); break;
            default: break;
        }
    }

    void FXWaveShaper::process(const float* inL, const float* inR,
                                float* outL, float* outR,
                                int numSamples)
    {
        shaper_.process(inL, inR, outL, outR, numSamples);
    }
}
