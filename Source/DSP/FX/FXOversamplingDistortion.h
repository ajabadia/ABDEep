#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXOversamplingDistortion: Oversampled distortion/saturation with anti-aliasing.
     *
     * Applies nonlinear waveshaping at 4x internal sample rate, then
     * decimates back with a 5th-order FIR anti-aliasing filter.
     * Source: Odin2 OversamplingDistortion.
     *
     * Parameters:
     *   0: Drive   (0-1, distortion amount)
     *   1: Tone    (0-1, post-dist tone shaping)
     *   2: Mix     (0-1, dry/wet mix)
     *   3: Level   (0-1, output level)
     *   4: Stereo  (0-1, stereo width of distortion)
     */
    class FXOversamplingDistortion : public FXBase
    {
    public:
        FXOversamplingDistortion();
        ~FXOversamplingDistortion() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 5; }
        juce::String getEffectName() const override { return "Oversampling Distortion"; }

    private:
        double sampleRate = 44100.0;
        static constexpr int kOversample = 4;

        float drive = 0.3f, tone = 0.5f, mix = 0.4f, level = 0.7f, stereo = 0.5f;

        // Oversample buffers
        std::vector<float> upBufL, upBufR, downBufL, downBufR;
        int internalBufSize = 0;

        // Anti-alias filter state (5th order FIR)
        static constexpr int kFirLen = 12;
        std::vector<float> firL, firR;

        // Tone filter state
        float toneL = 0.0f, toneR = 0.0f;

        float waveshape(float x) const;
        void processInternal(float* buf, int numSamples);
    };
}
