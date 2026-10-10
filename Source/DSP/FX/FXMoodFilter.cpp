/*
  ==============================================================================

    FXMoodFilter.cpp
    Implementación del envoltorio de producto para FXMoodFilter.

  ==============================================================================
*/

#include "FXMoodFilter.h"
#include <algorithm>

namespace ABD
{
    FXMoodFilter::FXMoodFilter()
    {
        reset();
    }

    void FXMoodFilter::prepare(double newSampleRate, int /*samplesPerBlock*/)
    {
        sampleRate = std::max(1.0, newSampleRate);
        filter_.prepare(sampleRate);
    }

    void FXMoodFilter::reset()
    {
        filter_.reset();
    }

    void FXMoodFilter::setParameter(int index, float value)
    {
        value = std::clamp(value, 0.0f, 1.0f);

        switch (index)
        {
            case 0:  filter_.setSpeedNorm(value); break;
            case 1:  filter_.setDepthNorm(value); break;
            case 2:  filter_.setResonanceNorm(value); break;
            case 3:  filter_.setBaseFreqNorm(value); break;
            case 4:  filter_.setFilterType(static_cast<int>(value * 3.99f)); break;
            case 5:  break; // Mix gestionado por el FXSlot
            case 6:  filter_.setWaveShape(static_cast<int>(value * 6.99f)); break;
            case 7:  filter_.setEnvModNorm(value); break;
            case 8:  filter_.setAttackNorm(value); break;
            case 9:  filter_.setReleaseNorm(value); break;
            case 10: filter_.setDriveNorm(value); break;
            case 11: filter_.setFourPole(value > 0.5f); break;
            default: break;
        }
    }

    void FXMoodFilter::process(const float* inL, const float* inR,
                                float* outL, float* outR,
                                int numSamples)
    {
        filter_.process(inL, inR, outL, outR, numSamples);
    }
}
