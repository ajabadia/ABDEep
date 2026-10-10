/*
  ==============================================================================

    FXFairComp.cpp
    Implementación del envoltorio de producto para FXFairComp.

  ==============================================================================
*/

#include "FXFairComp.h"
#include <algorithm>

namespace ABD
{
    FXFairComp::FXFairComp()
    {
        reset();
    }

    void FXFairComp::prepare(double newSampleRate, int /*samplesPerBlock*/)
    {
        sampleRate = std::max(1.0, newSampleRate);
        comp_.prepare(sampleRate);
    }

    void FXFairComp::reset()
    {
        comp_.reset();
    }

    void FXFairComp::setParameter(int index, float value)
    {
        const float v = std::clamp(value, 0.0f, 1.0f);

        switch (index)
        {
            case 0:  comp_.setMode(static_cast<int>(v * 3.9f)); break;
            case 1:  comp_.setInputGainLM(v); break;
            case 2:  comp_.setThresholdLM(v); break;
            case 3:  comp_.setTimeConstantLM(v); break;
            case 4:  comp_.setDcBiasLM(v); break;
            case 5:  comp_.setOutputGainLM(v); break;
            case 6:  comp_.setBiasBalance(v); break;
            case 7:  comp_.setInputGainRS(v); break;
            case 8:  comp_.setThresholdRS(v); break;
            case 9:  comp_.setTimeConstantRS(v); break;
            case 10: comp_.setDcBiasRS(v); break;
            case 11: comp_.setOutputGainRS(v); break;
            default: break;
        }
    }

    void FXFairComp::process(const float* inL, const float* inR,
                            float* outL, float* outR, int numSamples)
    {
        comp_.process(inL, inR, outL, outR, numSamples);
    }
}
