#include "FXFlanger.h"
#include <algorithm>

namespace ABD
{
    FXFlanger::FXFlanger()
    {
        reset();
    }

    void FXFlanger::prepare(double newSampleRate, int /*samplesPerBlock*/)
    {
        engine_.prepare(newSampleRate);
    }

    void FXFlanger::setParameter(int index, float value)
    {
        const float val = std::clamp(value, 0.0f, 1.0f);
        switch (index)
        {
            case 0:  engine_.setRateNorm(val);        break;
            case 1:  engine_.setDepthLNorm(val);      break;
            case 2:  engine_.setDepthRNorm(val);      break;
            case 3:  engine_.setBaseDelayLNorm(val);  break;
            case 4:  engine_.setBaseDelayRNorm(val);  break;
            case 5:  break; // Mix almacenado (aplicado por FXSlot)
            case 6:  break; // LoCut almacenado (sin equivalente DSP)
            case 7:  break; // HiCut almacenado (sin equivalente DSP)
            case 8:  engine_.setPhaseNorm(val);       break;
            case 9:  break; // FeedLC almacenado (sin equivalente DSP)
            case 10: break; // FeedHC almacenado (sin equivalente DSP)
            case 11: engine_.setFeedbackNorm(val);    break;
            default: break;
        }
    }

    void FXFlanger::reset()
    {
        engine_.reset();
    }

    void FXFlanger::process(const float* inL, const float* inR,
                             float* outL, float* outR,
                             int numSamples)
    {
        engine_.process(inL, inR, outL, outR, numSamples);
    }
}
