#include "FXMultiTapDelay.h"

namespace ABD
{
    FXMultiTapDelay::FXMultiTapDelay(int numTapsVal)
        : engine_(numTapsVal)
    {
        reset();
    }

    void FXMultiTapDelay::prepare(double newSampleRate, int /*samplesPerBlock*/)
    {
        engine_.prepare(newSampleRate);
    }

    void FXMultiTapDelay::setParameter(int index, float value)
    {
        engine_.setParameter(index, value);
    }

    void FXMultiTapDelay::reset()
    {
        engine_.reset();
    }

    juce::String FXMultiTapDelay::getEffectName() const
    {
        return (engine_.getTapCount() == 3) ? "3-Tap Delay" : "4-Tap Delay";
    }

    void FXMultiTapDelay::process(const float* inL, const float* inR,
                                 float* outL, float* outR, int numSamples)
    {
        engine_.process(inL, inR, outL, outR, numSamples);
    }
}
