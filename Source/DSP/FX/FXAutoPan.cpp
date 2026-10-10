#include "FXAutoPan.h"
#include <algorithm>

namespace ABD
{
    FXAutoPan::FXAutoPan()
    {
        reset();
    }

    void FXAutoPan::prepare(double newSampleRate, int /*samplesPerBlock*/)
    {
        engine_.prepare(newSampleRate);
    }

    void FXAutoPan::setParameter(int index, float value)
    {
        const float val = std::clamp(value, 0.0f, 1.0f);
        switch (index)
        {
            case 0:  engine_.setSpeedNorm(val);    break;
            case 1:  engine_.setPhaseNorm(val);    break;
            case 2:  engine_.setWaveNorm(val);     break;
            case 3:  engine_.setDepthNorm(val);    break;
            case 4:  engine_.setEnvSpdNorm(val);   break;
            case 5:  engine_.setEnvDepthNorm(val); break;
            case 6:  engine_.setAttackNorm(val);   break;
            case 7:  engine_.setHoldNorm(val);     break; // almacenado
            case 8:  engine_.setReleaseNorm(val);  break;
            default: break;
        }
    }

    void FXAutoPan::reset()
    {
        engine_.reset();
    }

    void FXAutoPan::process(const float* inL, const float* inR,
                             float* outL, float* outR,
                             int numSamples)
    {
        engine_.process(inL, inR, outL, outR, numSamples);
    }
}
