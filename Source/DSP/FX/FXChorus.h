#pragma once

#include "FXBase.h"
#include <DspEffects/DspStereoChorus.h>

namespace ABD
{
    /**
     * @brief FXChorus: Efecto de Chorus estéreo analógico con LFO multimórfico.
     *
     * HARDWARE EMULADO:
     *   - Efecto de Chorus estéreo analógico clásico (DeepMind 12 FX Type 10),
     *     inspirado en las unidades BBD Boss CE-1 Chorus Ensemble y TC Electronic SCF.
     *   - Parámetros de control:
     *     * Speed: Frecuencia de modulación (0.1 Hz a 10 Hz).
     *     * Width L / R: Profundidad independiente por canal (0 a 10 ms).
     *     * Delay L / R: Retardo base por canal (0.5 ms a 50 ms).
     *     * Phase: Desfase angular entre LFOs (0 a 180°).
     *     * Wave: Morfología continua de modulación (Triangular a Sinusoidal).
     *     * Spread: Extensión estéreo espacial adicional.
     *
     * DIAGNÓSTICO DE FIDELIDAD ACTUAL:
     *   - Motor subyacente delegado en `abd::dsp::DspStereoChorus` (100% RT-Safe, C++20).
     *   - Búfer circular estático sin asignaciones dinámicas en `prepare()` ni `process()`.
     *
     * LÍNEAS DE INVESTIGACIÓN PENDIENTES:
     *   - Modelado no lineal de pérdida de agudos típica de las etapas de filtrado anti-aliasing
     *     pre/post BBD (MN3007 / MN3101).
     *   - Ruido de reloj de dispersión analógica y companding NE570/571.
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
        abd::dsp::DspStereoChorus engine_;
    };
}
