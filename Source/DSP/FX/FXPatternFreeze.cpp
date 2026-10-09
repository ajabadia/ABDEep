#include "FXPatternFreeze.h"

namespace ABD
{
    FXPatternFreeze::FXPatternFreeze()
    {
        reset();
    }

    void FXPatternFreeze::prepare(double sr, int /*spb*/)
    {
        engine.prepare(sr);
    }

    void FXPatternFreeze::reset()
    {
        engine.reset();
    }

    void FXPatternFreeze::setParameter(int index, float value)
    {
        engine.setParameter(index, value);
    }

    void FXPatternFreeze::process(const float* inL, const float* inR,
                                    float* outL, float* outR,
                                    int numSamples)
    {
        engine.process(inL, inR, outL, outR, numSamples);
    }
}
