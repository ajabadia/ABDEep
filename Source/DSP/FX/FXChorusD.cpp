#include "FXChorusD.h"
#include <algorithm>

namespace ABD
{
    FXChorusD::FXChorusD()
    {
        reset();
    }

    void FXChorusD::prepare(double newSampleRate, int /*samplesPerBlock*/)
    {
        engine_.prepare(newSampleRate);
    }

    void FXChorusD::setParameter(int index, float value)
    {
        const float val = std::clamp(value, 0.0f, 1.0f);
        switch (index)
        {
            case 0: engine_.setOn(val > 0.5f);        break;
            case 1: engine_.setMonoMode(val > 0.5f);  break;
            case 2: engine_.setMixNorm(val);          break;
            case 3: engine_.setPreset(0, val > 0.5f); break;
            case 4: engine_.setPreset(1, val > 0.5f); break;
            case 5: engine_.setPreset(2, val > 0.5f); break;
            case 6: engine_.setPreset(3, val > 0.5f); break;
            default: break;
        }
    }

    void FXChorusD::reset()
    {
        engine_.reset();
    }

    void FXChorusD::process(const float* inL, const float* inR,
                            float* outL, float* outR, int numSamples)
    {
        engine_.process(inL, inR, outL, outR, numSamples);
    }
}
