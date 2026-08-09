#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXFrequencyShifter: Inharmonic frequency shifting via heterodyning.
     *
     * Multiplies the signal by a complex oscillator (sine + cosine),
     * shifting all partials by a fixed Hz offset. Produces inharmonic
     * metallic textures, bell-like tones, and sci-fi effects.
     *
     * Parameters:
     *   0: Mix      (0-1, dry/wet mix)
     *   1: Shift    (0-1, shift amount: -2000 to +2000 Hz)
     *   2: LFO Rate (0-1, LFO modulation rate 0.1-10 Hz)
     *   3: LFO Depth(0-1, LFO modulation depth)
     *   4: Feedback (0-1, feedback for ringing effects)
     */
    class FXFrequencyShifter : public FXBase
    {
    public:
        FXFrequencyShifter();
        ~FXFrequencyShifter() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 5; }
        juce::String getEffectName() const override { return "Frequency Shifter"; }

    private:
        double sampleRate = 44100.0;

        float paramMix = 0.5f;
        float paramShift = 0.5f;
        float paramLFORate = 0.3f;
        float paramLFODepth = 0.0f;
        float paramFeedback = 0.0f;

        // Oscillator for heterodyne
        float oscPhase = 0.0f;
        float oscInc = 0.0f;

        // LFO
        float lfoPhase = 0.0f;
        float lfoInc = 0.0f;

        // Current shift in Hz
        float currentShiftHz = 0.0f;

        // Feedback buffer (IIR comb-like)
        float fbL = 0.0f;
        float fbR = 0.0f;

        // Hilbert transform approximation (90-degree phase shift)
        static constexpr int kHilbertLen = 15;
        float hilbertBufL[kHilbertLen] = {};
        float hilbertBufR[kHilbertLen] = {};
        int hilbertPos = 0;

        static constexpr float kPi = 3.14159265f;

        float hilbertShift(float input, float* buf);
    };
}
