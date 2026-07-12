#pragma once

#include "FXBase.h"

namespace ABD
{
    class FXSimpleComp : public FXBase
    {
    public:
        FXSimpleComp();
        ~FXSimpleComp() override = default;
        void prepare(double, int) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR, int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 12; }
        juce::String getEffectName() const override { return "Fair Comp"; }

    private:
        double sampleRate = 44100.0;
        int compMode = 1;
        float inGainL = 0.5f, threshL = 0.5f, biasL = 0.5f, outGainL = 0.5f;
        float inGainR = 0.5f, threshR = 0.5f, biasR = 0.5f, outGainR = 0.5f;
        float biasBal = 0.5f;
        int timeL = 3, timeR = 3;

        // Envelope followers
        float envL = 0.0f, envR = 0.0f;
        float envStereo = 0.0f; // envelope for stereo mode
        float envMid = 0.0f, envSide = 0.0f; // for M/S mode
        float atkCoeff = 0.01f, relCoeff = 0.001f;

        float applyComp(float input, float& envelope, float inGainNorm,
                        float threshNorm, float biasNorm, float outGainNorm);
        void updateTimeConsts(int timeIdx);
    };
}
