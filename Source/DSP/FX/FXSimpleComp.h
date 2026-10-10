/*
  ==============================================================================

    FXSimpleComp.h
    Envoltorio heredado de Fair Comp (Fairchild 670) para compatibilidad.

    ENVOLTORIO DE PRODUCTO: ABDEep
    MOTOR DSP SUBYACENTE: abd::dsp::DspFairComp (ABDSharedCode/DspEffects/DspFairComp.h)

  ==============================================================================
*/

#pragma once

#include "FXBase.h"
#include <DspEffects/DspFairComp.h>

namespace ABD
{
    class FXSimpleComp : public FXBase
    {
    public:
        FXSimpleComp();
        ~FXSimpleComp() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR, int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 12; }
        juce::String getEffectName() const override { return "Fair Comp"; }

    private:
        abd::dsp::DspFairComp comp_;
        double sampleRate = 44100.0;
    };
}
