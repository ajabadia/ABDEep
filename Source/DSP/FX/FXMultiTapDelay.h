#pragma once

#include "FXBase.h"
#include <DspEffects/DspMultiTapDelay.h>

namespace ABD
{
    /**
     * @brief FXMultiTapDelay: Delay con múltiples tomas en paralelo y realimentación rítmica.
     *
     * HARDWARE EMULADO:
     *   - Procesador de retardo digital multi-toma de estudio (DeepMind 12 FX Types 14 y 15),
     *     inspirado en clásicos como el Lexicon PCM 70 y Roland SDE-330.
     *   - Soporta dos modos según configuración:
     *     * 3-Tap Delay (Tipo 14): Tres tomas con tiempos, ganancias y panoramas individuales.
     *     * 4-Tap Delay (Tipo 15): Cuatro tomas con tiempos y ganancias individuales,
     *       distribuidas en el espectro estéreo mediante el control Spread.
     *     * Factores rítmicos independientes seleccionables: 1/4, 3/8, 1/2, 2/3, 1/1, 4/3, 3/2, 2/1, 3/1.
     *     * Realimentación del último tap con opción de Cross-Feedback cruzado.
     *
     * DIAGNÓSTICO DE FIDELIDAD ACTUAL:
     *   - Motor delegado en `abd::dsp::DspMultiTapDelay` (100% RT-Safe, C++20 puro).
     *   - Búfer circular pre-asignado en prepare(), cero heap en process().
     *
     * LÍNEAS DE INVESTIGACIÓN PENDIENTES:
     *   - Filtro pasa-altos / pasa-bajos individual por tap.
     *   - Difusión de los taps iniciales mediante redes allpass cruzadas.
     */
    class FXMultiTapDelay : public FXBase
    {
    public:
        explicit FXMultiTapDelay(int numTaps);
        ~FXMultiTapDelay() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR, int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 12; }
        juce::String getEffectName() const override;

    private:
        abd::dsp::DspMultiTapDelay engine_;
    };
}
