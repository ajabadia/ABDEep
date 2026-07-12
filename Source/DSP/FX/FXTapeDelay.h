#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXTapeDelay: Tape delay (T-Ray) con wobble, sustain y tone.
     * Basado en DeepMind 12 (type=21).
     *
     * Parámetros:
     *   0: Mix     (0-1, 0-100%)
     *   1: Delay   (0-1, 0-100%)
     *   2: Sustain (0-1, 0-100% feedback)
     *   3: Wobble  (0-1, 0-100%)
     *   4: Tone    (0-1, 0-100%)
     */
    class FXTapeDelay : public FXBase
    {
    public:
        FXTapeDelay();
        ~FXTapeDelay() override = default;
        void prepare(double, int) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR, int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 5; }
        juce::String getEffectName() const override { return "T-Ray Delay"; }

    private:
        double sampleRate = 44100.0;
        float mix = 0.3f, delayPct = 0.3f, sustain = 0.3f, wobble = 0.2f, tone = 0.5f;

        juce::AudioSampleBuffer bufL, bufR;
        int writePosL = 0, writePosR = 0, maxDelaySamples = 0;
        int delaySamples = 0;

        // Wow/flutter LFO
        double lfoPhase = 0.0, lfoInc = 0.0;

        // Tape saturation state
        float satState = 0.0f;

        // Tone filter (LPF)
        float lpfL = 0.0f, lpfR = 0.0f, toneCoeff = 0.0f;

        void updateDelay();
    };
}
