#pragma once

#include "FXBase.h"
#include <DspEffects/DspDecimDelay.h>

namespace ABD
{
    /**
     * @brief FXDecimDelay: Retardo decimador vintage lo-fi con bit-crushing y filtro SVF.
     *
     * HARDWARE EMULADO:
     *   - Retardo y sampler digital de época de 8 y 12 bits (DeepMind 12 FX Type 34),
     *     inspirado en clásicos como el E-mu SP-1200 y el AMS DMX 15-80S.
     *   - Parámetros:
     *     * Mix: Balance Dry/Wet (0 a 100%).
     *     * Time: Tiempo maestro de 1 ms a 1500 ms.
     *     * DownSample: Reducción de tasa de muestreo de 1x a 50x.
     *     * Factor L / R: Factores métricos rítmicos por canal (1/4 a 3/1).
     *     * BitReduce: Cuantización de profundidad de bits (1 a 24 bits).
     *     * Cutoff / Resonance / FilterType: Filtro analógico multimodo SVF (LP, HP, BP, Notch).
     *     * Feed L / R: Realimentación independiente (0 a 95%).
     *     * Decimate: Conmutador de ruteo Pre-Delay o Post-Delay.
     *
     * DIAGNÓSTICO DE FIDELIDAD ACTUAL:
     *   - Motor delegado en `abd::dsp::DspDecimDelay` (100% RT-Safe, C++20 puro).
     *   - Filtro State Variable Filter numéricamente estable.
     *
     * LÍNEAS DE INVESTIGACIÓN PENDIENTES:
     *   - Emulación del convertidor DAC lineal R-2R con error de no linealidad integral (INL).
     */
    class FXDecimDelay : public FXBase
    {
    public:
        FXDecimDelay();
        ~FXDecimDelay() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR, int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 12; }
        juce::String getEffectName() const override { return "Decimator Delay"; }

    private:
        abd::dsp::DspDecimDelay engine_;
    };
}
