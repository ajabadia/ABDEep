#pragma once

#include "FXBase.h"
#include <DspEffects/DspModDelayRev.h>

namespace ABD
{
    /**
     * @brief FXModDelayRev: Híbrido de retardo modulado con LFO y reverberación Schroeder.
     *
     * HARDWARE EMULADO:
     *   - Procesador híbrido de reverberación y retardo espacial (DeepMind 12 FX Type 12),
     *     inspirado en algoritmos clásicos de Lexicon 224 y 480L.
     *   - Parámetros:
     *     * Time: Tiempo de retardo maestro (1 ms a 1500 ms).
     *     * Factor: Fracción métrica rítmica (1/4 a 3/1).
     *     * Feedback: Realimentación del bucle de retardo (0 a 95%).
     *     * FeedHC: Amortiguación de agudos en el lazo de retardo (200 Hz a 20 kHz).
     *     * Depth / Speed: Modulación sinusoidal del tiempo de retardo (0.1 Hz a 10 Hz).
     *     * Mode: Topología de ruteo Paralelo (PAR) o Cascada (SER).
     *     * Rtype: Perfil acústico de sala (Ambience, Club, Hall).
     *     * Decay / Damping: Tiempo de caída y absorción de altas frecuencias en la reverb.
     *     * Balance: Proporción de mezcla entre la componente de delay y la de reverb.
     *     * Mix: Balance Dry/Wet global (0 a 100%).
     *
     * DIAGNÓSTICO DE FIDELIDAD ACTUAL:
     *   - Motor delegado en `abd::dsp::DspModDelayRev` (100% RT-Safe, C++20 puro).
     *   - 4 filtros de peine y 3 etapas allpass de difusión con búferes pre-asignados en prepare().
     *
     * LÍNEAS DE INVESTIGACIÓN PENDIENTES:
     *   - Modulación de los retardos de allpass para eliminación completa de resonancias metálicas.
     */
    class FXModDelayRev : public FXBase
    {
    public:
        FXModDelayRev();
        ~FXModDelayRev() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR, int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 12; }
        juce::String getEffectName() const override { return "Mod Delay Rev"; }

    private:
        abd::dsp::DspModDelayRev engine_;
    };
}
