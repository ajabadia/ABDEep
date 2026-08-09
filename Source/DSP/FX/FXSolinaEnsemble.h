#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXSolinaEnsemble: Ensemble chorus estilo Solina String Ensemble / ARP Omni.
     *
     * Modelo simplificado de BBDEnsembleEffect (Surge) con:
     *   - 3 delay taps por canal (tap0=base, tap1=+120°, tap2=+240°)
     *   - Dual LFO con 120° de offset entre taps
     *   - Stereo spread (separación L/R de los taps)
     *   - Feedback variable
     *   - Hermite interpolation en cada tap
     *
     * Parámetros:
     *   0: Rate     (0-1 → 0.2-8 Hz)
     *   1: Depth    (0-1 → 0-5 ms de modulación)
     *   2: Feedback (0-1 → 0-85%)
     *   3: Spread   (0-1 → 0-100% stereo width)
     *   4: Mix      (0-1 → dry/wet)
     */
    class FXSolinaEnsemble : public FXBase
    {
    public:
        FXSolinaEnsemble();
        ~FXSolinaEnsemble() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 5; }
        juce::String getEffectName() const override { return "Solina Ensemble"; }

    private:
        double sampleRate = 44100.0;

        // Parameters
        float paramRate = 0.4f;
        float paramDepth = 0.5f;
        float paramFeedback = 0.3f;
        float paramSpread = 0.6f;
        float paramMix = 0.5f;

        // Delay lines: 3 taps, each with its own buffer
        // tap0=0°, tap1=120°, tap2=240°
        static constexpr int kNumTaps = 3;
        static constexpr float kBaseDelayMs = 8.0f;
        static constexpr float kMaxModMs = 5.0f;

        std::vector<float> delayBufL[3];
        std::vector<float> delayBufR[3];
        int delayMask = 0;
        int delayWPos = 0;

        // Feedback state
        float feedbackL = 0.0f;
        float feedbackR = 0.0f;

        // LFO state
        float lfoPhase[3] = { 0.0f, 0.0f, 0.0f };
        float lfoInc = 0.0f;

        // Phase offsets for 3 taps (0°, 120°, 240°)
        static constexpr float kPhaseOffsets[3] = { 0.0f, 2.0943951f, 4.1887902f };

        static float hermite(float frac, float y0, float y1, float y2, float y3);
        float readDelay(const std::vector<float>& buf, float delaySamples) const;
    };
}