#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXNimbus: Hybrid granular delay/reverb processor.
     *
     * Divides the input into overlapping grains with independent
     * pitch and pan positions, creating complex evolving textures.
     * Source: Surge NimbusEffect.
     *
     * Parameters:
     *   0: GrainSize (0-1, grain duration 20ms-200ms)
     *   1: Density   (0-1, grain overlap count)
     *   2: Feedback  (0-1, recirculation amount)
     *   3: Pitch     (0-1, grain pitch shift 0.5x-2x)
     *   4: Mix       (0-1, dry/wet mix)
     */
    class FXNimbus : public FXBase
    {
    public:
        FXNimbus();
        ~FXNimbus() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 5; }
        juce::String getEffectName() const override { return "Nimbus"; }

    private:
        double sampleRate = 44100.0;

        float grainSizeParam = 0.5f, densityParam = 0.5f, feedbackParam = 0.3f, pitchParam = 0.5f, mix = 0.4f;

        // Input ring buffer
        static constexpr int kMaxBufSize = 96000; // ~2s at 48kHz
        std::vector<float> ringBufL, ringBufR;
        int ringWritePos = 0;

        // Grain state
        struct Grain
        {
            bool active = false;
            int readPos = 0;
            int length = 0;
            int age = 0;
            float pitchRatio = 1.0f;
            float pan = 0.5f;
            float gain = 0.0f;
        };

        static constexpr int kMaxGrains = 16;
        Grain grains[kMaxGrains];
        int nextGrainIdx = 0;

        void spawnGrain();
    };
}
