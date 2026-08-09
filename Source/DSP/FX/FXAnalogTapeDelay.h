#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXAnalogTapeDelay: Warm analog tape delay with saturation.
     *
     * Tape-style delay with soft clipping on write, wow/flutter
     * modulation, and a warm low-pass on feedback path.
     *
     * Parameters:
     *   0: Mix       (0-1, dry/wet mix)
     *   1: Time      (0-1, delay time 50ms-1200ms)
     *   2: Feedback  (0-1, tape feedback amount)
     *   3: Wobble    (0-1, wow/flutter depth)
     *   4: Saturation(0-1, tape saturation amount)
     *   5: Tone      (0-1, brightness of repeats)
     */
    class FXAnalogTapeDelay : public FXBase
    {
    public:
        FXAnalogTapeDelay();
        ~FXAnalogTapeDelay() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 6; }
        juce::String getEffectName() const override { return "Analog Tape Delay"; }

    private:
        double sampleRate = 44100.0;

        float paramMix = 0.35f;
        float paramTime = 0.35f;
        float paramFeedback = 0.4f;
        float paramWobble = 0.3f;
        float paramSaturation = 0.3f;
        float paramTone = 0.5f;

        static constexpr int kMaxDelay = 52920;
        std::vector<float> delayBufL;
        std::vector<float> delayBufR;
        int delayMask = 0;
        int writePos = 0;

        float lpStateL = 0.0f;
        float lpStateR = 0.0f;
        uint32_t noiseSeed = 0xABCD1234u;

        static float tapeSat(float x, float drive);
        float noiseGenerate();
    };
}
