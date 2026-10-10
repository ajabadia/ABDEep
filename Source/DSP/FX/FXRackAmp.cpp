/*
  ==============================================================================

    FXRackAmp.cpp
    Implementación del envoltorio de producto para FXRackAmp.

  ==============================================================================
*/

#include "FXRackAmp.h"
#include <algorithm>

namespace ABD
{
    FXRackAmp::FXRackAmp()
    {
        reset();
    }

    void FXRackAmp::prepare(double newSampleRate, int /*samplesPerBlock*/)
    {
        amp_.prepare(newSampleRate);
    }

    void FXRackAmp::reset()
    {
        amp_.reset();
    }

    void FXRackAmp::setParameter(int index, float value)
    {
        const float v = std::clamp(value, 0.0f, 1.0f);

        switch (index)
        {
            case 0: amp_.setPreAmpNorm(v); break;
            case 1: amp_.setBuzzNorm(v); break;
            case 2: amp_.setPunchNorm(v); break;
            case 3: amp_.setCrunchNorm(v); break;
            case 4: amp_.setDriveNorm(v); break;
            case 5: amp_.setLevelNorm(v); break;
            case 6: amp_.setLowEQNorm(v); break;
            case 7: amp_.setHighEQNorm(v); break;
            case 8: amp_.setCabinet(v > 0.5f); break;
            default: break;
        }
    }

    void FXRackAmp::process(const float* inL, const float* inR,
                             float* outL, float* outR,
                             int numSamples)
    {
        amp_.process(inL, inR, outL, outR, numSamples);
    }
}
