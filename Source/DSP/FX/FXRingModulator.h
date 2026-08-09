#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXRingModulator: Ring modulator estilo IRCAM diode bridge.
     *
     * Modelo simplificado de RingModulatorEffect (Surge) con:
     *   - 3 formas de onda del oscilador: sine, saw, square
     *   - Frecuencia del oscilador modulada por LFO
     *   - Diode bridge soft-clip (transferencia exponencial)
     *   - Mix dry/wet
     *
     * Parámetros:
     *   0: Freq     (0-1 → 20-8000 Hz, escala exponencial)
     *   1: LFO Rate (0-1 → 0.1-10 Hz)
     *   2: LFO Depth (0-1 → 0-100% modulación de freq)
     *   3: Waveform (0-0.33=sine, 0.33-0.66=saw, 0.66-1=square)
     *   4: Mix      (0-1 → dry/wet)
     */
    class FXRingModulator : public FXBase
    {
    public:
        FXRingModulator();
        ~FXRingModulator() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 5; }
        juce::String getEffectName() const override { return "Ring Modulator"; }

    private:
        double sampleRate = 44100.0;

        // Parameters
        float paramFreq = 0.5f;
        float paramLFORate = 0.3f;
        float paramLFODepth = 0.4f;
        float paramWaveform = 0.0f;
        float paramMix = 0.5f;

        // Oscillator state
        float oscPhase = 0.0f;
        float oscInc = 0.0f;

        // LFO state
        float lfoPhase = 0.0f;
        float lfoInc = 0.0f;

        // Derived frequency (actual modulated freq)
        float currentFreq = 440.0f;

        // Diode bridge parameters
        static constexpr float kDiodeDrive = 0.8f;
        static constexpr float kDiodeThreshold = 0.3f;

        float computeOscillator(float phase, float waveform) const;
        float diodeBridge(float input) const;
    };
}