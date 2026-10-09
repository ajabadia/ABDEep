#include "FXDecimDelay.h"

namespace ABD
{
    FXDecimDelay::FXDecimDelay()
    {
        reset();
    }

    void FXDecimDelay::prepare(double newSampleRate, int /*samplesPerBlock*/)
    {
        engine_.prepare(newSampleRate);
    }

    void FXDecimDelay::setParameter(int index, float value)
    {
        engine_.setParameter(index, value);
    }

    void FXDecimDelay::reset()
    {
        engine_.reset();
    }

    void FXDecimDelay::process(const float* inL, const float* inR,
                               float* outL, float* outR, int numSamples)
    {
        engine_.process(inL, inR, outL, outR, numSamples);
    }
}
