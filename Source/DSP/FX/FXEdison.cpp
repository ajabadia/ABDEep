#include "FXEdison.h"

namespace ABD
{
    FXEdison::FXEdison()
    {
        reset();
    }

    void FXEdison::prepare(double newSampleRate, int /*samplesPerBlock*/)
    {
        engine.prepare(newSampleRate);
    }

    void FXEdison::setParameter(int index, float value)
    {
        engine.setParameter(index, value);
    }

    void FXEdison::reset()
    {
        engine.reset();
    }

    void FXEdison::process(const float* inL, const float* inR,
                            float* outL, float* outR,
                            int numSamples)
    {
        engine.process(inL, inR, outL, outR, numSamples);
    }
}
