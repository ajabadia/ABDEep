#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXShimmerDelay: Delay with pitch-shifted feedback (shimmer).
     *
     * Tape delay with +1 octave pitch shift in the feedback loop
     * and a small reverb tail for atmosphere.
     *
     * Parameters:
     *   0: Mix       (0-1, dry/wet mix)
     *   1: Time      (0-1, delay time 100ms-2000ms)
     *   2: Feedback  (0-1, feedback amount)
     *   3: Pitch     (0-1, shift amount: 0=off, 1=+1 octave)
     *   4: ReverbMix (0-1, reverb tail amount)
     */
    class FXShimmerDelay : public FXBase
    {
    public:
        FXShimmerDelay();
        ~FXShimmerDelay() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 5; }
        juce::String getEffectName() const override { return "Shimmer Delay"; }

    private:
        double sampleRate = 44100.0;

        float paramMix = 0.35f;
        float paramTime = 0.35f;
        float paramFeedback = 0.45f;
        float paramPitch = 0.7f;
        float paramReverbMix = 0.25f;

        static constexpr int kMaxDelay = 88200;
        std::vector<float> delayBufL;
        std::vector<float> delayBufR;
        int delayMask = 0;
        int writePos = 0;

        // Pitch shifter (simple granular)
        static constexpr int kGrainSize = 512;
        std::vector<float> grainBufL;
        std::vector<float> grainBufR;
        int grainPos = 0;
        int grainCount = 0;

        // Reverb
        static constexpr int kReverbSize = 32768;
        std::vector<float> reverbBuf;
        int reverbMask = 0;
        int reverbWPos = 0;

        uint32_t noiseSeed = 0xDEADBEEFu;

        float pitchShift(float input, float pitchRatio);
        float noiseGenerate();
    };
}
