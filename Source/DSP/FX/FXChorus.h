#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXChorus: Efecto de Chorus estéreo con LFO modulando delay modulado.
     * 
     * Parámetros:
     *   0: Rate (0-1, 0.1Hz - 10Hz)
     *   1: Depth (0-1, 0ms - 10ms)
     *   2: Feedback (0-0.95)
     *   3: (reservado)
     */
    class FXChorus : public FXBase
    {
    public:
        FXChorus();
        ~FXChorus() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 3; }
        juce::String getEffectName() const override { return "Chorus"; }

    private:
        double sampleRate = 44100.0;

        // Parámetros
        float rate = 0.3f;       // 0-1 → 0.1Hz - 10Hz
        float depth = 0.4f;      // 0-1 → 0ms - 10ms
        float feedback = 0.2f;   // 0-0.95

        // LFO state
        double lfoPhaseL = 0.0;
        double lfoPhaseR = 0.0;
        double lfoPhaseIncrement = 0.0;

        // Delay line modulated
        juce::AudioSampleBuffer delayBufferL;
        juce::AudioSampleBuffer delayBufferR;
        int writePositionL = 0;
        int writePositionR = 0;
        int maxDelaySamples = 0;

        void updateLFOIncrement();
    };
}
