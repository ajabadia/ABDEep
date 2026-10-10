#include "FXSpectralDelay.h"

namespace ABD
{
    FXSpectralDelay::FXSpectralDelay()
    {
        reset();
    }

    void FXSpectralDelay::prepare(double sr, int /*samplesPerBlock*/)
    {
        engine.prepare(sr);
    }

    void FXSpectralDelay::reset()
    {
        engine.reset();
    }

    void FXSpectralDelay::setParameter(int index, float value)
    {
        engine.setParameter(index, value);
    }

    void FXSpectralDelay::process(const float* inL, const float* inR,
                                    float* outL, float* outR,
                                    int numSamples)
    {
        engine.process(inL, inR, outL, outR, numSamples);
    }
}
