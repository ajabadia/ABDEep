#include "FXBonsai.h"

namespace ABD
{
    FXBonsai::FXBonsai()
    {
        reset();
    }

    void FXBonsai::prepare(double sr, int /*samplesPerBlock*/)
    {
        engine.prepare(sr);
    }

    void FXBonsai::reset()
    {
        engine.reset();
    }

    void FXBonsai::setParameter(int index, float value)
    {
        engine.setParameter(index, value);
    }

    void FXBonsai::process(const float* inL, const float* inR,
                            float* outL, float* outR,
                            int numSamples)
    {
        engine.process(inL, inR, outL, outR, numSamples);
    }
}
