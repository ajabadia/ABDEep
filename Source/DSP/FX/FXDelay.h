#pragma once

#include "FXBase.h"
#include <DspEffects/DspStereoDelay.h>

namespace ABD
{
    /**
     * @brief FXDelay: Efecto de Delay estéreo con realimentación y filtrado analógico.
     *
     * HARDWARE EMULADO:
     *   - Procesador de retardo digital/analógico de rack vintage (DeepMind 12 FX Type 13),
     *     inspirado en clásicos como el Roland SDE-3000 y el Korg SDD-3000.
     *   - Parámetros de control:
     *     * Time: Tiempo maestro de 1 ms a 2000 ms.
     *     * Mode: 4 topologías de ruteo estéreo (ST, Cross-Feedback X, Mono Sum M, Ping-Pong P-P).
     *     * Factor L / R: Fracción métrica rítmica por canal (1/4 a 3/1).
     *     * Offset: Micro-desplazamiento temporal estéreo (-100 ms a +100 ms).
     *     * Feed L / R: Realimentación por canal (0 a 99%).
     *     * HiCut / FeedHC: Filtro paso-bajos analógico de 1-polo en la realimentación (200 Hz a 20 kHz).
     *
     * DESTINOS DE MATRIZ DE MODULACIÓN:
     *   - Declara los índices {1, 9, 10} (Time, FeedL, FeedR) como destinos activos de `Fx N Parameters`.
     *
     * DIAGNÓSTICO DE FIDELIDAD ACTUAL:
     *   - Motor subyacente delegado en `abd::dsp::DspStereoDelay` (100% RT-Safe, C++20 puro).
     *   - Cero dependencias de JUCE en el núcleo DSP.
     *
     * LÍNEAS DE INVESTIGACIÓN PENDIENTES:
     *   - Modelado de saturación de etapa de entrada de previo analógico SDD-3000.
     *   - Sincronización precisa con BPM de transporte DAW.
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

        int getModulationParams(int* indices, int maxCount) const override
        {
            const int declarados[3] = { 1, 9, 10 }; // tiempo, feedback L, feedback R
            const int n = juce::jmin(maxCount, 3);
            for (int i = 0; i < n; ++i)
                indices[i] = declarados[i];
            return n;
        }

        juce::String getEffectName() const override { return "Delay"; }

    private:
        abd::dsp::DspStereoDelay engine_;
    };
}
