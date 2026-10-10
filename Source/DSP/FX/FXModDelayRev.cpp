#include "FXModDelayRev.h"

namespace ABD
{
    FXModDelayRev::FXModDelayRev()
    {
        reset();
    }

    void FXModDelayRev::prepare(double newSampleRate, int /*samplesPerBlock*/)
    {
        engine_.prepare(newSampleRate);
    }

    void FXModDelayRev::setParameter(int index, float value)
    {
        engine_.setParameter(index, value);
    }

    void FXModDelayRev::reset()
    {
        engine_.reset();
    }

    void FXModDelayRev::process(const float* inL, const float* inR,
                               float* outL, float* outR, int numSamples)
    {
        engine_.process(inL, inR, outL, outR, numSamples);
    }
}
