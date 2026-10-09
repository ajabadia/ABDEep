#include "FXCombulator.h"

namespace ABD
{
    FXCombulator::FXCombulator()
    {
        reset();
    }

    void FXCombulator::prepare(double sr, int /*samplesPerBlock*/)
    {
        engine.prepare(sr);
    }

    void FXCombulator::reset()
    {
        engine.reset();
    }

    void FXCombulator::process(const float* inL, const float* inR,
                                 float* outL, float* outR,
                                 int numSamples)
    {
        engine.process(inL, inR, outL, outR, numSamples);
    }

    void FXCombulator::setParameter(int index, float value)
    {
        engine.setParameter(index, value);
    }
}
