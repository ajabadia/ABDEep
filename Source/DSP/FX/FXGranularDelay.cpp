#include "FXGranularDelay.h"

namespace ABD
{
    FXGranularDelay::FXGranularDelay()
    {
        reset();
    }

    void FXGranularDelay::prepare(double sr, int /*spb*/)
    {
        engine.prepare(sr);
    }

    void FXGranularDelay::reset()
    {
        engine.reset();
    }

    void FXGranularDelay::setParameter(int index, float value)
    {
        engine.setParameter(index, value);
    }

    void FXGranularDelay::process(const float* inL, const float* inR,
                                    float* outL, float* outR,
                                    int numSamples)
    {
        engine.process(inL, inR, outL, outR, numSamples);
    }
}
