#pragma once

#include "FXBase.h"
#include <DspEffects/DspPitchShifter.h>

namespace ABD
{
    /**
     * @brief FXPitchShifter: Pitch shifter dual (Tipo 29) y vintage (Tipo 35).
     *
     * Wrapper JUCE que delega el procesamiento DSP en el motor puro `abd::dsp::DspPitchShifter`.
     *
     * TARGET DE HARDWARE Y TOPOLOGÍA:
     *   - Eventide H910 / H949 y algoritmos de Pitch Shifting de DeepMind 12:
     *     * 2 Voces transpuestas independientes (-12 a +12 st, -50 a +50 cents).
     *     * Overlapping grains con modulación de fase circular y ventana Hann.
     *     * Paneo, delay de voz y ganancia estéreo individuales.
     *     * Modo Vintage (Tipo 35): Realimentación de los granos transpuestos a la entrada.
     *     * Filtro HiCut paso-bajos de 1-polo.
     *
     * DIAGNÓSTICO DE FIDELIDAD:
     *   - 100% Real-Time Safe: Búferes preasignados en prepare(), cero heap en process().
     *   - Validado contra pruebas de barrido de parámetros, direct instantiation y verificación de contrato.
     *
     * LÍNEAS DE INVESTIGACIÓN:
     *   - Algoritmo pitch sinc / wavelet para transposición con menor modulación de formantes.
     */
    class FXPitchShifter : public FXBase
    {
    public:
        explicit FXPitchShifter(bool vintageMode = false);
        ~FXPitchShifter() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR, int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 12; }
        juce::String getEffectName() const override;

    private:
        abd::dsp::DspPitchShifter engine_;
        bool vintage_ = false;
    };
}
