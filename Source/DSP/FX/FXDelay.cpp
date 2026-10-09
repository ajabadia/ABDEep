#include "FXDelay.h"
#include <algorithm>

namespace ABD
{
    FXDelay::FXDelay()
    {
        reset();
    }

    void FXDelay::prepare(double newSampleRate, int /*samplesPerBlock*/)
    {
        engine_.prepare(newSampleRate);
    }

    void FXDelay::setParameter(int index, float value)
    {
        const float val = std::clamp(value, 0.0f, 1.0f);
        switch (index)
        {
            case 0:  break; // Mix aplicado por FXSlot
            case 1:  engine_.setTimeNorm(val);      break;
            case 2:  engine_.setModeNorm(val);      break;
            case 3:  engine_.setFactorLNorm(val);   break;
            case 4:  engine_.setFactorRNorm(val);   break;
            case 5:  engine_.setOffsetNorm(val);    break;
            case 6:  break; // LoCut almacenado
            case 7:  engine_.setHiCutNorm(val);     break;
            case 8:  break; // FeedLC almacenado
            case 9:  engine_.setFeedbackLNorm(val); break;
            case 10: engine_.setFeedbackRNorm(val); break;
            case 11: engine_.setHiCutNorm(val);     break;
            default: break;
        }
    }

    void FXDelay::reset()
    {
        engine_.reset();
    }

    void FXDelay::process(const float* inL, const float* inR,
                           float* outL, float* outR,
                           int numSamples)
    {
        engine_.process(inL, inR, outL, outR, numSamples);
    }
}
