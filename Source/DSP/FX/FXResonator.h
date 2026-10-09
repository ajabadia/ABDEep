#pragma once

#include "FXBase.h"
#include <DspEffects/DspResonator.h>

namespace ABD
{
    /**
     * @brief FXResonator: Tuned resonant filter bank (Harmonic Resonator).
     *
     * ==============================================================================
     * DOCUMENTACIÓN DE HARDWARE Y FIDELIDAD DSP:
     * ==============================================================================
     * 1. HARDWARE EMULADO:
     *    - Banco de resonadores sintonizados multimodales (DeepMind 12 Type 47 /
     *      Moog Modular 907 Fixed Filter Bank / Serge Resonant Filter).
     *    - Estructura modal de 8 resonadores biquad paso banda en paralelo:
     *      * Modo Armónico: Razón armónica entera (1, 2, 3, 4, 5, 6, 7, 8).
     *      * Modo Inarmónico: Ratios de campana / percusión metálica
     *        (1.0, 2.4, 3.76, 5.12, 6.8, 8.3, 10.6, 12.9).
     *      * Modo Stretched: Modelo de cuerda con inarmonicidad y rigidez:
     *        f_n = n * sqrt(1 + B * n^2).
     *      * Frecuencia base exponencial de 50 Hz a 5000 Hz.
     *      * Amortiguación de altas frecuencias (damping) y factor Q de resonancia.
     *
     * 2. DIAGNÓSTICO DE FIDELIDAD:
     *    - Filtros biquad normalizados con ganancia 1/8 para evitar saturación en suma.
     *    - Delegado en el motor desacoplado `abd::dsp::DspResonator` (C++20 puro, 100% RT-Safe).
     *
     * 3. LÍNEAS DE INVESTIGACIÓN PENDIENTES:
     *    - Añadir acoplamiento de modos y pérdida no lineal por fricción o aire.
     *    - Permitir asignación polifónica o keytracking MIDI de la frecuencia base del banco.
     * ==============================================================================
     *
     * Parameters:
     *   0: Mix       (0-1, dry/wet mix)
     *   1: Frequency (0-1, base frequency 50-5000 Hz)
     *   2: Resonance (0-1, Q factor)
     *   3: Damping   (0-1, high-frequency damping)
     *   4: Mode      (0-0.33=harmonic, 0.33-0.66=inharmonic, 0.66-1=stretched)
     */
    class FXResonator : public FXBase
    {
    public:
        FXResonator();
        ~FXResonator() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 5; }
        juce::String getEffectName() const override { return "Harmonic Resonator"; }

    private:
        abd::dsp::DspResonator engine;
    };
}
