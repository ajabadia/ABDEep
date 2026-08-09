#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXResonator: Tuned resonant filter bank.
     *
     * Bank of bandpass resonators tuned to harmonic or inharmonic
     * frequencies. Creates metallic, tuned percussion effects
     * and physical modeling-style textures.
     *
     * Parameters:
     *   0: Mix       (0-1, dry/wet mix)
     *   1: Frequency (0-1, base frequency 50-5000 Hz)
     *   2: Resonance (0-1, Q factor)
     *   3: Damping   (0-1, high-frequency damping)
     *   4: Mode      (0-0.33=harmonic, 0.33-0.66=inharmonic, 0.66-1=stretched)
     */
    class FXResonator : public FXBase
    {
    public:
        FXResonator();
        ~FXResonator() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 5; }
        juce::String getEffectName() const override { return "Harmonic Resonator"; }

    private:
        double sampleRate = 44100.0;

        float paramMix = 0.5f;
        float paramFrequency = 0.3f;
        float paramResonance = 0.5f;
        float paramDamping = 0.3f;
        float paramMode = 0.0f;

        static constexpr int kNumResonators = 8;

        // State for each resonator (biquad bandpass)
        struct ResonatorState
        {
            float b0 = 0.0f, b1 = 0.0f, b2 = 0.0f;
            float a1 = 0.0f, a2 = 0.0f;
            float x1 = 0.0f, x2 = 0.0f;
            float y1 = 0.0f, y2 = 0.0f;
            float freq = 0.0f;
        };

        ResonatorState resonatorsL[kNumResonators];
        ResonatorState resonatorsR[kNumResonators];

        void updateResonator(ResonatorState& res, float freq, float q, float damping);
        static float exponentialMap(float normalized, float minHz, float maxHz);
    };
}
