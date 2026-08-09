#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXFlanger: Efecto Flanger estéreo con LFO, delay corto y feedback intenso.
     *
     * Parámetros (orden hardware, docs/deepmind_fx.md FX Type 11):
     *   0: Speed   (0-1, 0.05Hz - 8Hz)
     *   1: WidthL  (0-1, profundidad de modulación canal izquierdo)
     *   2: WidthR  (0-1, profundidad de modulación canal derecho)
     *   3: DelayL  (0-1, 0.5ms - 20ms delay base izquierdo)
     *   4: DelayR  (0-1, 0.5ms - 20ms delay base derecho)
     *   5: Mix     (0-1, wet/dry — aplicado por FXSlot)
     *   6: LoCut   (0-1, almacenado — sin equivalente DSP)
     *   7: HiCut   (0-1, almacenado — sin equivalente DSP)
     *   8: Phase   (0-1, 0-180°, offset estéreo del LFO)
     *   9: FeedLC  (0-1, almacenado — sin equivalente DSP)
     *   10: FeedHC (0-1, almacenado — sin equivalente DSP)
     *   11: Feed   (0-1, feedback ±90%)
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
        int getNumParameters() const override { return 12; }
        juce::String getEffectName() const override { return "Flanger"; }

    private:
        double sampleRate = 44100.0;

        // Parámetros (orden hardware)
        float rate = 0.2f;        // 0-1 → 0.05Hz - 8Hz
        float depthL = 0.5f;      // 0-1 → 0ms - 5ms
        float depthR = 0.5f;      // 0-1 → 0ms - 5ms
        float baseDelayL = 0.3f;  // 0-1 → 0.5ms - 20ms
        float baseDelayR = 0.3f;  // 0-1 → 0.5ms - 20ms
        float phase = 0.25f;      // 0-1 → 0-180° offset estéreo (ciclo 0-0.5)
        float feedback = 0.5f;    // 0-0.9

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
