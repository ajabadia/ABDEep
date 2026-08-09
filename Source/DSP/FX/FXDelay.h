#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXDelay: Efecto de Delay estéreo con feedback y filtro pasa-bajos.
     *
     * Parámetros (orden hardware, docs/deepmind_fx.md FX Type 13):
     *   0: Mix      (0-1, wet/dry — aplicado por FXSlot)
     *   1: Time     (0-1, mapeado a 1ms - 2000ms)
     *   2: Mode     (0-1, 0=ST, 1=X, 2=M, 3=P-P)
     *   3: FactorL  (0-1, fracción rítmica del delay izquierdo)
     *   4: FactorR  (0-1, fracción rítmica del delay derecho)
     *   5: Offset   (0-1, -100ms a +100ms diferencia L/R)
     *   6: LoCut    (0-1, almacenado — sin equivalente DSP)
     *   7: HiCut    (0-1, mapeado al LPF del feedback)
     *   8: FeedLC   (0-1, almacenado — sin equivalente DSP)
     *   9: FeedL    (0-1, feedback canal izquierdo)
     *   10: FeedR   (0-1, feedback canal derecho)
     *   11: FeedHC  (0-1, mapeado al LPF del feedback)
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
        int getNumParameters() const override { return 12; }
        juce::String getEffectName() const override { return "Delay"; }

    private:
        double sampleRate = 44100.0;

        // Parámetros (orden hardware)
        float mix = 0.3f;           // 0-1 (aplicado por FXSlot)
        float timeParam = 0.5f;     // 0-1 → 1ms-2000ms
        int   mode = 0;             // 0=ST, 1=X, 2=M, 3=P-P
        float factorL = 0.5f;       // 0-1 → fracción rítmica 1/4..3
        float factorR = 0.5f;       // 0-1 → fracción rítmica 1/4..3
        float offsetParam = 0.5f;   // 0-1 → -100ms..+100ms
        float feedbackL = 0.3f;     // 0-0.99
        float feedbackR = 0.3f;     // 0-0.99
        float lpfCutoff = 0.8f;     // 0-1 (HiCut/FeedHC)

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
        float factorToScale(float normalized) const;
    };
}
