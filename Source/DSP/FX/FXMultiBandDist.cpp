/*
  ==============================================================================

    FXMultiBandDist.cpp
    Implementación del envoltorio de producto para FXMultiBandDist.

  ==============================================================================
*/

#include "FXMultiBandDist.h"
#include <algorithm>

namespace ABD
{
    FXMultiBandDist::FXMultiBandDist()
    {
        reset();
    }

    void FXMultiBandDist::prepare(double newSampleRate, int /*samplesPerBlock*/)
    {
        dist_.prepare(newSampleRate);
    }

    void FXMultiBandDist::reset()
    {
        dist_.reset();
    }

    void FXMultiBandDist::setParameter(int index, float value)
    {
        const float v = std::clamp(value, 0.0f, 1.0f);

        switch (index)
        {
            case 0:  dist_.setInGainNorm(v); break;
            case 1:  dist_.setDistType(std::clamp(static_cast<int>(v * 5.99f), 0, 5)); break;
            case 2:  dist_.setLowLevelNorm(v); break;
            case 3:  dist_.setLowDriveNorm(v); break;
            case 4:  dist_.setXoverLowMidNorm(v); break;
            case 5:  dist_.setMidLevelNorm(v); break;
            case 6:  dist_.setMidDriveNorm(v); break;
            case 7:  dist_.setXoverMidHiNorm(v); break;
            case 8:  dist_.setHiLevelNorm(v); break;
            case 9:  dist_.setHiDriveNorm(v); break;
            case 10: dist_.setCabinetType(std::clamp(static_cast<int>(v * 11.99f), 0, 11)); break;
            case 11: dist_.setOutGainNorm(v); break;
            default: break;
        }
    }

    void FXMultiBandDist::process(const float* inL, const float* inR,
                                   float* outL, float* outR,
                                   int numSamples)
    {
        dist_.process(inL, inR, outL, outR, numSamples);
    }
}
