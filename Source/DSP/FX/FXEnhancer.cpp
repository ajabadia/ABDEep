#include "FXEnhancer.h"

namespace ABD
{
    FXEnhancer::FXEnhancer()
    {
        reset();
    }

    void FXEnhancer::prepare(double sr, int /*samplesPerBlock*/)
    {
        engine.prepare(sr);
    }

    void FXEnhancer::setParameter(int idx, float v)
    {
        engine.setParameter(idx, v);
    }

    void FXEnhancer::reset()
    {
        engine.reset();
    }

    void FXEnhancer::process(const float* inL, const float* inR,
                              float* outL, float* outR, int numSamples)
    {
        engine.process(inL, inR, outL, outR, numSamples);
    }
}
