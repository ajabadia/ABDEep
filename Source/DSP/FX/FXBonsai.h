#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXBonsai: Lo-fi pitch processor with degradation and micro-granulation.
     *
     * Combines pitch shifting, bit-crushing/sample-rate reduction,
     * and tape-like wow/flutter for lo-fi character.
     * Source: Surge BonsaiEffect.
     *
     * Parameters:
     *   0: Pitch    (0-1, -12 to +12 semitones)
     *   1: LoFi     (0-1, bit depth reduction + sample rate reduction)
     *   2: Drive    (0-1, saturation amount)
     *   3: Wow      (0-1, pitch modulation depth)
     *   4: Mix      (0-1, dry/wet mix)
     */
    class FXBonsai : public FXBase
    {
    public:
        FXBonsai();
        ~FXBonsai() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 5; }
        juce::String getEffectName() const override { return "Bonsai"; }

    private:
        double sampleRate = 44100.0;

        float pitchParam = 0.5f, lofiParam = 0.0f, driveParam = 0.0f, wowParam = 0.0f, mix = 0.4f;

        // Pitch shift read state
        float readPosL = 0.0f, readPosR = 0.0f;

        // Wow LFO
        float lfoPhase = 0.0f;

        // Lo-fi state
        float lofiAccumL = 0.0f, lofiAccumR = 0.0f;

        // Ring buffer for pitch shift
        static constexpr int kMaxDelay = 19200; // ~400ms at 48kHz
        std::vector<float> bufL, bufR;
        int bufMask = 0;

        float driveShape(float x) const;
        float lofiQuantize(float x) const;
    };
}
