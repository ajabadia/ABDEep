#include "FXResonator.h"

namespace ABD
{
    FXResonator::FXResonator()
    {
        reset();
    }

    void FXResonator::prepare(double sr, int /*samplesPerBlock*/)
    {
        engine.prepare(sr);
    }

    void FXResonator::reset()
    {
        engine.reset();
    }

    void FXResonator::setParameter(int index, float value)
    {
        engine.setParameter(index, value);
    }

    void FXResonator::process(const float* inL, const float* inR,
                                float* outL, float* outR,
                                int numSamples)
    {
        engine.process(inL, inR, outL, outR, numSamples);
    }
}
