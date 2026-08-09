#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXWaveShaper: Non-linear waveshaper with multiple transfer curves.
     *
     * Implements soft-clip, hard-clip, fold, and sin-based transfer functions.
     * Source: Surge WaveShaperEffect.
     *
     * Parameters:
     *   0: Shape   (0-1, selects transfer curve family)
     *   1: Symmetry(0-1, even/odd harmonic balance)
     *   2: Gain    (0-1, input gain)
     *   3: Tone    (0-1, post-shaper LPF)
     *   4: Mix     (0-1, dry/wet mix)
     */
    class FXWaveShaper : public FXBase
    {
    public:
        FXWaveShaper();
        ~FXWaveShaper() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 5; }
        juce::String getEffectName() const override { return "WaveShaper"; }

    private:
        double sampleRate = 44100.0;

        float shape = 0.3f, symmetry = 0.5f, gainParam = 0.5f, toneParam = 0.5f, mix = 0.4f;

        float toneL = 0.0f, toneR = 0.0f;

        float transfer(float x) const;
    };
}
