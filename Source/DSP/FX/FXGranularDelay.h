#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXGranularDelay: Granular delay with pitch shifting.
     *
     * Captures audio into grains and plays them back at varying
     * rates and pitches, creating evolving textures.
     *
     * Parameters:
     *   0: Mix      (0-1, dry/wet mix)
     *   1: Time     (0-1, grain window size 20ms-200ms)
     *   2: Density  (0-1, grain density / overlap)
     *   3: Size     (0-1, grain envelope softness)
     *   4: Pitch    (0-1, pitch spread ±12 semitones)
     */
    class FXGranularDelay : public FXBase
    {
    public:
        FXGranularDelay();
        ~FXGranularDelay() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 5; }
        juce::String getEffectName() const override { return "Granular Delay"; }

    private:
        double sampleRate = 44100.0;

        float paramMix = 0.4f;
        float paramTime = 0.4f;
        float paramDensity = 0.5f;
        float paramSize = 0.5f;
        float paramPitch = 0.3f;

        static constexpr int kCaptureSize = 88200;
        std::vector<float> captureBufL;
        std::vector<float> captureBufR;
        int captureMask = 0;
        int capturePos = 0;

        // Grain scheduler
        struct Grain {
            float readPos;
            float pitchRatio;
            float gain;
            float age;
            float maxAge;
            bool active;
        };
        static constexpr int kMaxGrains = 16;
        Grain grains[kMaxGrains];
        float grainAccum = 0.0f;

        uint32_t noiseSeed = 0x98765432u;

        float grainEnvelope(float age, float maxAge, float softness) const;
        float noiseGenerate();
    };
}
