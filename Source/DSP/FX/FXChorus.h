#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXChorus: Efecto de Chorus estéreo con LFO modulando delay modulado.
     *
     * Parámetros (orden hardware, docs/deepmind_fx.md FX Type 10):
     *   0: Speed   (0-1, 0.1Hz - 10Hz)
     *   1: WidthL  (0-1, profundidad de modulación canal izquierdo)
     *   2: WidthR  (0-1, profundidad de modulación canal derecho)
     *   3: DelayL  (0-1, 0.5ms - 50ms delay base izquierdo)
     *   4: DelayR  (0-1, 0.5ms - 50ms delay base derecho)
     *   5: Mix     (0-1, wet/dry — aplicado por FXSlot)
     *   6: LoCut   (0-1, almacenado — sin equivalente DSP)
     *   7: HiCut   (0-1, almacenado — sin equivalente DSP)
     *   8: Phase   (0-1, 0-180°, offset estéreo del LFO)
     *   9: Wave    (0-1, tri→sin, forma de onda del LFO)
     *   10: Spread (0-1, ancho estéreo adicional del LFO)
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
        int getNumParameters() const override { return 11; }
        juce::String getEffectName() const override { return "Chorus"; }

    private:
        double sampleRate = 44100.0;

        // Parámetros (orden hardware)
        float rate = 0.3f;        // 0-1 → 0.1Hz - 10Hz
        float depthL = 0.4f;      // 0-1 → 0ms - 10ms
        float depthR = 0.4f;      // 0-1 → 0ms - 10ms
        float baseDelayL = 0.5f;  // 0-1 → 0.5ms - 50ms
        float baseDelayR = 0.5f;  // 0-1 → 0.5ms - 50ms
        float phase = 0.25f;      // 0-1 → 0-180° offset estéreo (ciclo 0-0.5)
        float wave = 0.5f;        // 0-1 → tri..sin
        float spread = 0.0f;      // 0-1 → ancho estéreo extra

        // Feedback interno fijo del chorus (no expuesto en hardware)
        float feedback = 0.2f;

        // LFO state
        double lfoPhaseL = 0.0;
        double lfoPhaseR = 0.0;
        double lfoPhaseIncrement = 0.0;

        // Delay line modulada
        juce::AudioSampleBuffer delayBufferL;
        juce::AudioSampleBuffer delayBufferR;
        int writePositionL = 0;
        int writePositionR = 0;
        int maxDelaySamples = 0;

        void updateLFOIncrement();
        float getWaveform(double phaseVal);
    };
}
