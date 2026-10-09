#pragma once

#include "FXBase.h"
#include <DspEffects/DspTapeDelay.h>

namespace ABD
{
    /**
     * @brief FXTapeDelay: Emulación de eco de cinta magnética analógica estilo T-Ray.
     *
     * HARDWARE EMULADO:
     *   - Eco de cinta analógico vintage (DeepMind 12 FX Type 21 T-Ray), inspirado en el
     *     Maestro Echoplex EP-3 con circuito de preamplificador a transistores FET.
     *   - Parámetros de control:
     *     * Mix: Balance Dry/Wet (0 a 100%).
     *     * Delay: Tiempo de retardo ajustable (10 ms a 1500 ms).
     *     * Sustain: Realimentación y regeneración de ecos (0 a 95%).
     *     * Wobble: Fluctuación mecánica del motor y cinta (wow and flutter).
     *     * Tone: Brillo y amortiguación paso-bajos analógica en el bucle de repeticiones.
     *
     * DIAGNÓSTICO DE FIDELIDAD ACTUAL:
     *   - Motor subyacente delegado en `abd::dsp::DspTapeDelay` (100% RT-Safe, C++20 puro).
     *   - Saturación de cabezal magnético no lineal integrada en el lazo de feedback.
     *
     * LÍNEAS DE INVESTIGACIÓN PENDIENTES:
     *   - Modelado de ruido de arrastre de cinta (tape hiss) y desgaste de cabezales.
     *   - Efecto de auto-oscilación extrema cálida en saturaciones > 90%.
     */
    class FXTapeDelay : public FXBase
    {
    public:
        FXTapeDelay();
        ~FXTapeDelay() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR, int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 5; }
        juce::String getEffectName() const override { return "T-Ray Delay"; }

    private:
        abd::dsp::DspTapeDelay engine_;
    };
}
