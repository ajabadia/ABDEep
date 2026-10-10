#include "FXPitchShifter.h"

namespace ABD
{
    FXPitchShifter::FXPitchShifter(bool vintageMode)
        : engine_(vintageMode), vintage_(vintageMode)
    {
        reset();
    }

    void FXPitchShifter::prepare(double sr, int /*samplesPerBlock*/)
    {
        engine_.prepare(sr);
    }

    void FXPitchShifter::setParameter(int idx, float v)
    {
        engine_.setParameter(idx, v);
    }

    void FXPitchShifter::reset()
    {
        engine_.reset();
    }

    juce::String FXPitchShifter::getEffectName() const
    {
        return vintage_ ? "Vintage Pitch" : "Dual Pitch";
    }

    void FXPitchShifter::process(const float* inL, const float* inR,
                                 float* outL, float* outR, int numSamples)
    {
        engine_.process(inL, inR, outL, outR, numSamples);
    }
}
