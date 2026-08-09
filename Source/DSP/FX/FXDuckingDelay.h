#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXDuckingDelay: Delay with sidechain ducking.
     *
     * When the dry signal is loud, the delay is attenuated (ducked),
     * creating space in the mix. When the dry signal is quiet,
     * the delay rises.
     *
     * Parameters:
     *   0: Mix       (0-1, dry/wet mix)
     *   1: Time      (0-1, delay time 50ms-1500ms)
     *   2: Feedback  (0-1, feedback amount)
     *   3: Threshold (0-1, ducking threshold)
     *   4: Ratio     (0-1, ducking ratio/depth)
     */
    class FXDuckingDelay : public FXBase
    {
    public:
        FXDuckingDelay();
        ~FXDuckingDelay() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 5; }
        juce::String getEffectName() const override { return "Ducking Delay"; }

    private:
        double sampleRate = 44100.0;

        float paramMix = 0.35f;
        float paramTime = 0.35f;
        float paramFeedback = 0.45f;
        float paramThreshold = 0.5f;
        float paramRatio = 0.6f;

        static constexpr int kMaxDelay = 66150;
        std::vector<float> delayBufL;
        std::vector<float> delayBufR;
        int delayMask = 0;
        int writePos = 0;

        // Sidechain envelope follower
        float envL = 0.0f;
        float envR = 0.0f;
        float duckGain = 1.0f;
        static constexpr float kEnvAttack = 0.001f;
        static constexpr float kEnvRelease = 0.05f;

        uint32_t noiseSeed = 0xFEDCBA09u;

        float noiseGenerate();
    };
}
