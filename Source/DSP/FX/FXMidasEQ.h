#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXMidasEQ: Ecualizador paramétrico de 4 bandas (Midas Pro X).
     * Basado en DeepMind 12 (type=30).
     *
     * Parámetros:
     *   0: loShelfGain (0-1, -12..12 dB)
     *   1: loShelfFreq (0-1, 30..20000 Hz)
     *   2: loMidGain   (0-1, -12..12 dB)
     *   3: loMidFreq   (0-1, 30..20000 Hz)
     *   4: loMidQ      (0-1, 0.3..5)
     *   5: hiMidGain   (0-1, -12..12 dB)
     *   6: hiMidFreq   (0-1, 30..20000 Hz)
     *   7: hiMidQ      (0-1, 0.3..5)
     *   8: hiShelfGain (0-1, -12..12 dB)
     *   9: hiShelfFreq (0-1, 30..20000 Hz)
     *   10: eq         (0=IN, 1=OUT)
     */
    class FXMidasEQ : public FXBase
    {
    public:
        FXMidasEQ();
        ~FXMidasEQ() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR, int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 11; }
        juce::String getEffectName() const override { return "MidasEQ"; }

    private:
        double sampleRate = 44100.0;

        // Parámetros
        float loShelfGain = 0.5f;
        float loShelfFreq = 0.3f;
        float loMidGain   = 0.5f;
        float loMidFreq   = 0.5f;
        float loMidQ      = 0.3f;
        float hiMidGain   = 0.5f;
        float hiMidFreq   = 0.7f;
        float hiMidQ      = 0.3f;
        float hiShelfGain = 0.5f;
        float hiShelfFreq = 0.8f;
        bool eqIn = true; // 0=IN, 1=OUT

        // Filtros para canal izquierdo y derecho
        juce::dsp::IIR::Filter<float> lowShelfL, lowShelfR;
        juce::dsp::IIR::Filter<float> lowMidL, lowMidR;
        juce::dsp::IIR::Filter<float> highMidL, highMidR;
        juce::dsp::IIR::Filter<float> highShelfL, highShelfR;

        void updateCoefficients();
    };
}
