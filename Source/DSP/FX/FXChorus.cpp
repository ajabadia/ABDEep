#include "FXChorus.h"
#include <algorithm>

namespace ABD
{
    FXChorus::FXChorus()
    {
        reset();
    }

    void FXChorus::prepare(double newSampleRate, int /*samplesPerBlock*/)
    {
        engine_.prepare(newSampleRate);
    }

    void FXChorus::setParameter(int index, float value)
    {
        const float val = std::clamp(value, 0.0f, 1.0f);
        switch (index)
        {
            case 0:  engine_.setSpeedNorm(val);  break;
            case 1:  engine_.setWidthLNorm(val); break;
            case 2:  engine_.setWidthRNorm(val); break;
            case 3:  engine_.setDelayLNorm(val); break;
            case 4:  engine_.setDelayRNorm(val); break;
            case 5:  break; // Mix almacenado (aplicado por FXSlot)
            case 6:  break; // LoCut almacenado (sin equivalente DSP)
            case 7:  break; // HiCut almacenado (sin equivalente DSP)
            case 8:  engine_.setPhaseNorm(val);  break;
            case 9:  engine_.setWaveNorm(val);   break;
            case 10: engine_.setSpreadNorm(val); break;
            default: break;
        }
    }

    void FXChorus::reset()
    {
        engine_.reset();
    }

    void FXChorus::process(const float* inL, const float* inR,
                            float* outL, float* outR,
                            int numSamples)
    {
        engine_.process(inL, inR, outL, outR, numSamples);
    }
}
