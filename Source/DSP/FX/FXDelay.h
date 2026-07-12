#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXDelay: Efecto de Delay estéreo con feedback y filtro pasa-bajos.
     * 
     * Parámetros:
     *   0: Mix (0-1, wet/dry)
     *   1: Delay Time Left (0-1, mapeado a 1ms - 2000ms)
     *   2: Delay Time Right (0-1, mapeado a 1ms - 2000ms)
     *   3: Feedback (0-0.99)
     *   4: LPF Cutoff (0-1, mapeado a 200Hz - 20000Hz)
     */
    class FXDelay : public FXBase
    {
    public:
        FXDelay();
        ~FXDelay() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 5; }
        juce::String getEffectName() const override { return "Delay"; }

    private:
        double sampleRate = 44100.0;

        // Parámetros
        float mix = 0.3f;           // 0-1
        float delayTimeL = 0.25f;   // 0-1 → 1ms-2000ms
        float delayTimeR = 0.3f;    // 0-1
        float feedback = 0.3f;      // 0-0.99
        float lpfCutoff = 0.8f;     // 0-1

        // Buffers de delay circulares
        juce::AudioSampleBuffer delayBufferL;
        juce::AudioSampleBuffer delayBufferR;
        int writePositionL = 0;
        int writePositionR = 0;
        int delaySamplesL = 0;
        int delaySamplesR = 0;

        // Filtro LPF de 1-polo para feedback
        float lpfStateL = 0.0f;
        float lpfStateR = 0.0f;
        float lpfCoeff = 0.5f;

        void updateDelaySamples();
        void updateLPFCoeff();
    };
}
