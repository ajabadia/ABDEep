#include "FXTreemonster.h"

namespace ABD
{
    FXTreemonster::FXTreemonster()
    {
        reset();
    }

    void FXTreemonster::prepare(double sr, int /*samplesPerBlock*/)
    {
        engine.prepare(sr);
    }

    void FXTreemonster::reset()
    {
        engine.reset();
    }

    void FXTreemonster::setParameter(int index, float value)
    {
        engine.setParameter(index, value);
    }

    void FXTreemonster::process(const float* inL, const float* inR,
                                float* outL, float* outR,
                                int numSamples)
    {
        engine.process(inL, inR, outL, outR, numSamples);
    }
}
