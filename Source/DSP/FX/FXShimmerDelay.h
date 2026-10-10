#pragma once

#include "FXBase.h"
#include <DspEffects/DspShimmerDelay.h>

namespace ABD
{
    /**
     * @brief FXShimmerDelay: Retardo ambiental etéreo con transposición de tono hacia arriba (Shimmer).
     *
     * HARDWARE EMULADO:
     *   - Efecto Shimmer Delay ambiental y celestial (DeepMind 12 FX Type 41),
     *     popularizado por las producciones de Brian Eno / Daniel Lanois y procesadores como el Eventide Space.
     *   - Parámetros:
     *     * Mix: Balance Dry/Wet (0 a 100%).
     *     * Time: Tiempo de retardo variable de 100 ms a 2000 ms.
     *     * Feedback: Regeneración de repeticiones (0 a 95%).
     *     * Pitch: Cantidad de transposición armónica (+1 Octava en feedback).
     *     * ReverbMix: Difusión de reverberación atmosférica añadida a las repeticiones.
     *
     * DIAGNÓSTICO DE FIDELIDAD ACTUAL:
     *   - Motor delegado en `abd::dsp::DspShimmerDelay` (100% RT-Safe, C++20 puro).
     *   - Búferes circulares estáticos de tamaño potencia de dos con bitmasking rápido, cero heap.
     *
     * LÍNEAS DE INVESTIGACIÓN PENDIENTES:
     *   - Tamaño de grano variable para control de textura (grano fino brillante vs grano largo etéreo).
     */
    class FXShimmerDelay : public FXBase
    {
    public:
        FXShimmerDelay();
        ~FXShimmerDelay() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 5; }
        juce::String getEffectName() const override { return "Shimmer Delay"; }

    private:
        abd::dsp::DspShimmerDelay engine_;
    };
}
