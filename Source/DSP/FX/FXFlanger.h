#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXFlanger: Efecto Flanger estéreo con LFO, delay corto y feedback intenso.
     * 
     * Similar al Chorus pero con delay más corto (0-5ms) y más feedback,
     * creando el característico efecto de "jet plane" o peine espectral.
     * 
     * Parámetros:
     *   0: Rate (0-1, 0.05Hz - 8Hz)
     *   1: Depth (0-1, 0ms - 5ms)
     *   2: Feedback (0-1, 0 - 0.97)
     *   3: Delay Base (0-1, 0ms - 3ms)
     */
    class FXFlanger : public FXBase
    {
    public:
        FXFlanger();
        ~FXFlanger() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 4; }
        juce::String getEffectName() const override { return "Flanger"; }

    private:
        double sampleRate = 44100.0;

        // Parámetros
        float rate = 0.2f;
        float depth = 0.5f;
        float feedback = 0.5f;
        float baseDelay = 0.3f;

        // LFO state
        double lfoPhaseL = 0.0;
        double lfoPhaseR = 0.25;
        double lfoPhaseInc = 0.0;

        // Delay line
        juce::AudioSampleBuffer delayBufferL;
        juce::AudioSampleBuffer delayBufferR;
        int writePosL = 0;
        int writePosR = 0;
        int maxDelaySamples = 0;

        void updateLFOIncrement();
    };
}
