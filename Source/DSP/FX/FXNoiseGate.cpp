/*
  ==============================================================================

    FXNoiseGate.cpp
    Implementación del envoltorio de producto para FXNoiseGate.

  ==============================================================================
*/

#include "FXNoiseGate.h"
#include <algorithm>

namespace ABD
{
    FXNoiseGate::FXNoiseGate()
    {
        reset();
    }

    void FXNoiseGate::prepare(double sampleRate, int /*samplesPerBlock*/)
    {
        gate_.prepare(sampleRate);
    }

    void FXNoiseGate::reset()
    {
        gate_.reset();
    }

    void FXNoiseGate::setParameter(int index, float value)
    {
        const float v = std::clamp(value, 0.0f, 1.0f);
        switch (index)
        {
            case 0: gate_.setThresholdNorm(v); break;
            case 1: gate_.setRangeNorm(v); break;
            case 2: gate_.setAttackNorm(v); break;
            case 3: gate_.setReleaseNorm(v); break;
            case 4: gate_.setHoldNorm(v); break;
            case 5: gate_.setPunchNorm(v); break;
            case 6: gate_.setMode(static_cast<int>(v * 2.99f)); break;
            case 7: gate_.setPower(v < 0.5f); break;
            default: break;
        }
    }

    void FXNoiseGate::process(const float* inL, const float* inR,
                               float* outL, float* outR, int numSamples)
    {
        gate_.process(inL, inR, outL, outR, numSamples);
    }
}
