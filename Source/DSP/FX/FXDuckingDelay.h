#pragma once

#include "FXBase.h"
#include <DspEffects/DspDuckingDelay.h>

namespace ABD
{
    /**
     * @brief FXDuckingDelay: Retardo dinámico con atenuación inteligente (Ducking).
     *
     * HARDWARE EMULADO:
     *   - Procesador dinámico de retardo digital de estudio (DeepMind 12 FX Type 44),
     *     inspirado en el TC Electronic 2290 Dynamic Digital Delay.
     *   - Parámetros:
     *     * Mix: Balance Dry/Wet (0 a 100%).
     *     * Time: Tiempo de retardo variable de 50 ms a 1500 ms.
     *     * Feedback: Regeneración de repeticiones (0 a 95%).
     *     * Threshold: Umbral de entrada que activa la atenuación del retardo.
     *     * Ratio: Intensidad y profundidad de reducción de ganancia (Ducking).
     *
     * DIAGNÓSTICO DE FIDELIDAD ACTUAL:
     *   - Motor delegado en `abd::dsp::DspDuckingDelay` (100% RT-Safe, C++20 puro).
     *   - Búfer circular estático de 65536 muestras con bitmasking rápido, cero heap.
     *
     * LÍNEAS DE INVESTIGACIÓN PENDIENTES:
     *   - Constantes de tiempo de ataque y relajación configurables por el usuario.
     */
    class FXDuckingDelay : public FXBase
    {
    public:
        FXDuckingDelay();
        ~FXDuckingDelay() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 5; }
        juce::String getEffectName() const override { return "Ducking Delay"; }

    private:
        abd::dsp::DspDuckingDelay engine_;
    };
}
