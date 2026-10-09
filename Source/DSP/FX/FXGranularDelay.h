#pragma once

#include "FXBase.h"
#include <DspEffects/DspGranularDelay.h>

namespace ABD
{
    /**
     * @brief FXGranularDelay: Granular delay with pitch shifting.
     *
     * ==============================================================================
     * DOCUMENTACIÓN DE HARDWARE Y FIDELIDAD DSP:
     * ==============================================================================
     * 1. HARDWARE EMULADO:
     *    - Procesador de retardo granular y micro-muestreo
     *      (DeepMind 12 Type 42 / Eventide TimeFactor / Red Panda Particle).
     *    - Fragmenta la señal de audio en pequeños granos temporales (20 ms a 200 ms).
     *    - Transposición tonal independiente de los granos (±12 semitonos).
     *    - Ventana temporal de coseno alzado (raised-cosine) para suavizar transiciones
     *      y evitar artefactos de discontinuidad de fase.
     *    - Control de densidad de granos concurrentes y fluctuación estocástica.
     *
     * 2. DIAGNÓSTICO DE FIDELIDAD:
     *    - Totalmente desacoplado en el motor puro `abd::dsp::DspGranularDelay` (C++20, 100% RT-Safe).
     *
     * 3. LÍNEAS DE INVESTIGACIÓN PENDIENTES:
     *    - Implementar envolventes de grano asimétricas (Tukey, Blackman, Gaussiana).
     *    - Permitir sincronización rítmica (tempo sync) del tamaño de grano y tasa de disparo.
     * ==============================================================================
     *
     * Parameters:
     *   0: Mix      (0-1, dry/wet mix)
     *   1: Time     (0-1, grain window size 20ms-200ms)
     *   2: Density  (0-1, grain density / overlap)
     *   3: Size     (0-1, grain envelope softness)
     *   4: Pitch    (0-1, pitch spread ±12 semitones)
     */
    class FXGranularDelay : public FXBase
    {
    public:
        FXGranularDelay();
        ~FXGranularDelay() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 5; }
        juce::String getEffectName() const override { return "Granular Delay"; }

    private:
        abd::dsp::DspGranularDelay engine;
    };
}
