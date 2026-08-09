#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXFDNReverb: Feedback Delay Network reverb (high-density).
     *
     * Uses an 8x8 Householder feedback matrix with diffusion
     * allpass filters for dense, smooth reverb tails.
     * Source: Odin2 FeedbackDelayNetwork.
     *
     * Parameters:
     *   0: Size     (0-1, room size / delay lengths)
     *   1: Decay    (0-1, feedback amount)
     *   2: Diffusion(0-1, allpass diffusion density)
     *   3: Damping  (0-1, high-frequency absorption)
     *   4: Mix      (0-1, dry/wet mix)
     */
    class FXFDNReverb : public FXBase
    {
    public:
        FXFDNReverb();
        ~FXFDNReverb() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 5; }
        juce::String getEffectName() const override { return "FDN Reverb"; }

    private:
        double sampleRate = 44100.0;

        float sizeParam = 0.5f, decayParam = 0.5f, diffusionParam = 0.5f, dampingParam = 0.5f, mix = 0.4f;

        static constexpr int kNumDelays = 8;
        std::vector<float> delayBuffers[kNumDelays];
        int delaySizes[kNumDelays] = {};
        int writePos[kNumDelays] = {};

        // Diffusion allpass buffers
        static constexpr int kNumAllpasses = 4;
        std::vector<float> apBuffers[kNumAllpasses];
        int apSizes[kNumAllpasses] = {};
        int apWritePos[kNumAllpasses] = {};
        float apGains[kNumAllpasses] = {};

        // Damping filter state per delay line
        float dampingState[kNumDelays] = {};

        void updateDelayLengths();
    };
}
