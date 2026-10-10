#include "FXMidasEQ.h"
#include <algorithm>

namespace ABD
{
    FXMidasEQ::FXMidasEQ()
    {
        reset();
    }

    void FXMidasEQ::prepare(double newSampleRate, int /*samplesPerBlock*/)
    {
        engine_.prepare(newSampleRate);
    }

    void FXMidasEQ::setParameter(int index, float value)
    {
        const float val = std::clamp(value, 0.0f, 1.0f);
        switch (index)
        {
            case 0:  engine_.setLoShelfGainNorm(val); break;
            case 1:  engine_.setLoShelfFreqNorm(val); break;
            case 2:  engine_.setLoMidGainNorm(val);   break;
            case 3:  engine_.setLoMidFreqNorm(val);   break;
            case 4:  engine_.setLoMidQNorm(val);      break;
            case 5:  engine_.setHiMidGainNorm(val);   break;
            case 6:  engine_.setHiMidFreqNorm(val);   break;
            case 7:  engine_.setHiMidQNorm(val);      break;
            case 8:  engine_.setHiShelfGainNorm(val); break;
            case 9:  engine_.setHiShelfFreqNorm(val); break;
            case 10: engine_.setEqIn(val <= 0.5f);    break; // 0 = IN, 1 = OUT
            default: break;
        }
    }

    void FXMidasEQ::reset()
    {
        engine_.reset();
    }

    void FXMidasEQ::process(const float* inL, const float* inR,
                            float* outL, float* outR, int numSamples)
    {
        engine_.process(inL, inR, outL, outR, numSamples);
    }
}
