#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXTreemonster: Pitch-tracking modulation processor.
     *
     * Analyzes the input pitch in real-time and uses the detected
     * frequency to modulate delay lines, creating pitch-following
     * chorus/flange/shimmer effects.
     * Source: Surge TreemonsterEffect.
     *
     * Parameters:
     *   0: Speed    (0-1, modulation rate when tracking fails)
     *   1: Depth    (0-1, modulation depth)
     *   2: Feedback (0-1, delay feedback)
     *   3: Tracking (0-1, pitch tracking sensitivity)
     *   4: Mix      (0-1, dry/wet mix)
     */
    class FXTreemonster : public FXBase
    {
    public:
        FXTreemonster();
        ~FXTreemonster() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 5; }
        juce::String getEffectName() const override { return "Treemonster"; }

    private:
        double sampleRate = 44100.0;

        float speedParam = 0.5f, depthParam = 0.5f, feedbackParam = 0.3f, trackingParam = 0.5f, mix = 0.4f;

        // Delay lines (stereo)
        static constexpr int kMaxDelaySamples = 4800; // 100ms at 48kHz
        std::vector<float> delayL, delayR;
        int delayMask = 0;
        float writePos = 0.0f;

        // Pitch detector state
        float detectorPhase = 0.0f;
        float detectorFreq = 200.0f;
        float detectorConfidence = 0.0f;
        float prevSample = 0.0f;
        int zeroCrossings = 0;
        float windowSamples = 0.0f;

        // LFO fallback
        float lfoPhase = 0.0f;

        float detectPitch(float sample);
    };
}
