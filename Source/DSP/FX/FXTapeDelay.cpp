#include "FXTapeDelay.h"

namespace ABD
{
    FXTapeDelay::FXTapeDelay()
    {
        reset();
    }

    void FXTapeDelay::prepare(double newSampleRate, int /*samplesPerBlock*/)
    {
        engine_.prepare(newSampleRate);
    }

    void FXTapeDelay::setParameter(int index, float value)
    {
        engine_.setParameter(index, value);
    }

    void FXTapeDelay::reset()
    {
        engine_.reset();
    }

    void FXTapeDelay::process(const float* inL, const float* inR,
                              float* outL, float* outR, int numSamples)
    {
        engine_.process(inL, inR, outL, outR, numSamples);
    }
}
