#include "FXDuckingDelay.h"

namespace ABD
{
    FXDuckingDelay::FXDuckingDelay()
    {
        reset();
    }

    void FXDuckingDelay::prepare(double newSampleRate, int /*samplesPerBlock*/)
    {
        engine_.prepare(newSampleRate);
    }

    void FXDuckingDelay::setParameter(int index, float value)
    {
        engine_.setParameter(index, value);
    }

    void FXDuckingDelay::reset()
    {
        engine_.reset();
    }

    void FXDuckingDelay::process(const float* inL, const float* inR,
                                 float* outL, float* outR,
                                 int numSamples)
    {
        engine_.process(inL, inR, outL, outR, numSamples);
    }
}
