#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXMultiTapDelay: Delay con múltiples taps en paralelo y feedback.
     * Soporta:
     *   3-Tap Delay (14): 3 taps con ganancias, paneos y factores independientes.
     *   4-Tap Delay (15): 4 taps con ganancias y factores independientes.
     */
    class FXMultiTapDelay : public FXBase
    {
    public:
        FXMultiTapDelay(int numTaps);
        ~FXMultiTapDelay() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR, int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 12; }
        juce::String getEffectName() const override;

    private:
        int numTaps;
        double sampleRate = 44100.0;

        // Parámetros comunes
        float masterTime = 0.3f; // 0-1 → 1ms a 1500ms
        float feedback = 0.3f;   // 0-1
        bool xFeed = false;      // Cross-feedback
        float mix = 0.5f;        // Dry/Wet

        // Taps individuales
        struct Tap
        {
            float factor = 1.0f; // Multiplicador de tiempo (0.25 a 3.0)
            float gain = 0.5f;   // Nivel (0-1)
            float pan = 0.0f;    // Paneo (-1 a 1, solo para 3-tap o derivado de spread)
        };

        Tap taps[4];
        float spread = 0.5f; // Para 4-tap, distribuye los taps en el campo estéreo

        // Buffers de delay circulares
        juce::AudioSampleBuffer delayBufferL;
        juce::AudioSampleBuffer delayBufferR;
        int writePos = 0;
        int maxDelaySamples = 0;

        void updateTapTimes();
    };
}
