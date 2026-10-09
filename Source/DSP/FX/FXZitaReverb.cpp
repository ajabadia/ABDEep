#include "FXZitaReverb.h"

namespace ABD
{
    FXZitaReverb::FXZitaReverb()
    {
        reset();
    }

    void FXZitaReverb::prepare(double sr, int /*samplesPerBlock*/)
    {
        engine_.prepare(sr);
    }

    void FXZitaReverb::setParameter(int index, float value)
    {
        engine_.setParameter(index, value);
    }

    void FXZitaReverb::reset()
    {
        engine_.reset();
    }

    void FXZitaReverb::process(const float* inL, const float* inR,
                              float* outL, float* outR,
                              int numSamples)
    {
        engine_.process(inL, inR, outL, outR, numSamples);
    }
}
