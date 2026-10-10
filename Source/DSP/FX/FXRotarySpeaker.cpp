#include "FXRotarySpeaker.h"
#include <algorithm>

namespace ABD
{
    FXRotarySpeaker::FXRotarySpeaker()
    {
        reset();
    }

    void FXRotarySpeaker::prepare(double newSampleRate, int /*samplesPerBlock*/)
    {
        engine_.prepare(newSampleRate);
    }

    void FXRotarySpeaker::setParameter(int index, float value)
    {
        const float val = std::clamp(value, 0.0f, 1.0f);
        switch (index)
        {
            case 0: engine_.setLoSpeedNorm(val);     break;
            case 1: engine_.setHiSpeedNorm(val);     break;
            case 2: engine_.setAccelNorm(val);       break;
            case 3: engine_.setDistanceNorm(val);    break;
            case 4: engine_.setBalanceNorm(val);     break;
            case 5: break; // Mix almacenado (aplicado por FXSlot)
            case 6: engine_.setMotorRunning(val < 0.5f); break; // 0=RUN, 1=STOP
            case 7: engine_.setSpeedFast(val > 0.5f);    break; // 0=SLOW, 1=FAST
            default: break;
        }
    }

    void FXRotarySpeaker::reset()
    {
        engine_.reset();
    }

    void FXRotarySpeaker::process(const float* inL, const float* inR,
                                   float* outL, float* outR,
                                   int numSamples)
    {
        engine_.process(inL, inR, outL, outR, numSamples);
    }
}
