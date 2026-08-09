#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXCombulator: Crossed stereo comb filter network.
     *
     * Two independent comb filters (L+R) with cross-feedback
     * between channels. Creates pitched resonances, flanging
     * textures, and metallic echoes with stereo width.
     *
     * Parameters:
     *   0: Mix     (0-1, dry/wet mix)
     *   1: DelayL  (0-1, L delay time 1-50ms)
     *   2: DelayR  (0-1, R delay time 1-50ms)
     *   3: Feedback(0-1, feedback + cross-feedback amount)
     *   4: Damping (0-1, high-frequency damping of feedback)
     */
    class FXCombulator : public FXBase
    {
    public:
        FXCombulator();
        ~FXCombulator() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 5; }
        juce::String getEffectName() const override { return "Combulator"; }

    private:
        double sampleRate = 44100.0;

        float paramMix = 0.4f;
        float paramDelayL = 0.25f;
        float paramDelayR = 0.35f;
        float paramFeedback = 0.5f;
        float paramDamping = 0.3f;

        // Delay buffers (max ~50ms at 96kHz = 4800 samples)
        static constexpr int kMaxDelay = 5000;
        std::vector<float> delayBufL;
        std::vector<float> delayBufR;
        int writePosL = 0;
        int writePosR = 0;

        // One-pole lowpass state for damping
        float lpfStateL = 0.0f;
        float lpfStateR = 0.0f;

        uint32_t noiseSeed = 0xDEADBEEFu;
        float noiseGenerate();
    };
}
