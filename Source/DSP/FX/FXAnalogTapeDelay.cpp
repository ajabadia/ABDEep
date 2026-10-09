#include "FXAnalogTapeDelay.h"

namespace ABD
{
    FXAnalogTapeDelay::FXAnalogTapeDelay()
    {
        reset();
    }

    void FXAnalogTapeDelay::prepare(double newSampleRate, int /*samplesPerBlock*/)
    {
        engine_.prepare(newSampleRate);
    }

    void FXAnalogTapeDelay::setParameter(int index, float value)
    {
        engine_.setParameter(index, value);
    }

    void FXAnalogTapeDelay::reset()
    {
        engine_.reset();
    }

    void FXAnalogTapeDelay::process(const float* inL, const float* inR,
                                   float* outL, float* outR,
                                   int numSamples)
    {
        engine_.process(inL, inR, outL, outR, numSamples);
    }
}
