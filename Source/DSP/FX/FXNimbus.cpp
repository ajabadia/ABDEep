#include "FXNimbus.h"

namespace ABD
{
    FXNimbus::FXNimbus()
    {
        reset();
    }

    void FXNimbus::prepare(double sr, int /*samplesPerBlock*/)
    {
        engine.prepare(sr);
    }

    void FXNimbus::reset()
    {
        engine.reset();
    }

    void FXNimbus::setParameter(int index, float value)
    {
        engine.setParameter(index, value);
    }

    void FXNimbus::process(const float* inL, const float* inR,
                            float* outL, float* outR,
                            int numSamples)
    {
        engine.process(inL, inR, outL, outR, numSamples);
    }
}
