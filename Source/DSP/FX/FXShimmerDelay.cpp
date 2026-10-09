#include "FXShimmerDelay.h"

namespace ABD
{
    FXShimmerDelay::FXShimmerDelay()
    {
        reset();
    }

    void FXShimmerDelay::prepare(double newSampleRate, int /*samplesPerBlock*/)
    {
        engine_.prepare(newSampleRate);
    }

    void FXShimmerDelay::setParameter(int index, float value)
    {
        engine_.setParameter(index, value);
    }

    void FXShimmerDelay::reset()
    {
        engine_.reset();
    }

    void FXShimmerDelay::process(const float* inL, const float* inR,
                                 float* outL, float* outR,
                                 int numSamples)
    {
        engine_.process(inL, inR, outL, outR, numSamples);
    }
}
