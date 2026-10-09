#include "FXFrequencyShifter.h"

namespace ABD
{
    FXFrequencyShifter::FXFrequencyShifter()
    {
        reset();
    }

    void FXFrequencyShifter::prepare(double sr, int /*samplesPerBlock*/)
    {
        engine_.prepare(sr);
    }

    void FXFrequencyShifter::setParameter(int index, float value)
    {
        engine_.setParameter(index, value);
    }

    void FXFrequencyShifter::reset()
    {
        engine_.reset();
    }

    void FXFrequencyShifter::process(const float* inL, const float* inR,
                                     float* outL, float* outR,
                                     int numSamples)
    {
        engine_.process(inL, inR, outL, outR, numSamples);
    }
}
