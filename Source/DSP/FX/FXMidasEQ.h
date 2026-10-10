#pragma once

#include "FXBase.h"
#include <DspEffects/DspMidasEQ.h>

namespace ABD
{
    /**
     * @brief FXMidasEQ: Ecualizador paramétrico de 4 bandas de canal de consola Midas PRO / Heritage.
     *
     * HARDWARE EMULADO:
     *   - Mesa de mezclas Midas Heritage 3000 / PRO Series Channel EQ (DeepMind 12 FX Type 30).
     *   - 4 bandas continuas de ecualización musical británica:
     *     * Low Shelf: 30 Hz a 20 kHz, ±12 dB (Q=0.707).
     *     * Low-Mid Parametric Peak: 30 Hz a 20 kHz, ±12 dB, Q variable 0.3 a 5.0.
     *     * High-Mid Parametric Peak: 30 Hz a 20 kHz, ±12 dB, Q variable 0.3 a 5.0.
     *     * High Shelf: 30 Hz a 20 kHz, ±12 dB (Q=0.707).
     *     * Interruptor EQ IN / OUT para bypass analógico limpio sin artefactos.
     *
     * DIAGNÓSTICO DE FIDELIDAD ACTUAL:
     *   - Modelo biquad en Forma Directa II Transpuesta (DF2T) con coeficientes RBJ estándar.
     *   - Motor subyacente delegado en `abd::dsp::DspMidasEQ` (100% RT-Safe, C++20 puro, cero heap).
     *   - Cero dependencias de `juce::dsp::IIR::Filter`.
     *
     * LÍNEAS DE INVESTIGACIÓN PENDIENTES:
     *   - Modelado de saturación asimétrica por transformador Midas en etapas de realce > +9 dB.
     *   - Comportamiento de interacción proporcional de Q (Proportional-Q analógico).
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
        abd::dsp::DspMidasEQ engine_;
    };
}
