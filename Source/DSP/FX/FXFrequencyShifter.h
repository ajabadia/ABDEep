#pragma once

#include "FXBase.h"
#include <DspEffects/DspFrequencyShifter.h>

namespace ABD
{
    /**
     * @brief FXFrequencyShifter: Desplazador de frecuencia inarmónico SSB por heterodinación (Tipo 46).
     *
     * Wrapper JUCE que delega el procesamiento DSP en el motor puro `abd::dsp::DspFrequencyShifter`.
     *
     * TARGET DE HARDWARE Y TOPOLOGÍA:
     *   - Harold Bode / Moog Frequency Shifter:
     *     * Transformada de Hilbert FIR de 15 coeficientes para señal analítica.
     *     * Heterodinación compleja en cuadratura (Single Sideband, SSB).
     *     * Rango de desplazamiento lineal: -2000 Hz a +2000 Hz.
     *     * Modulación por LFO y lazo de feedback para campanillas y timbres metálicos resonantes.
     *
     * DIAGNÓSTICO DE FIDELIDAD:
     *   - 100% Real-Time Safe: Búferes estáticos sin heap en process().
     *   - Mapeo de parámetros: Mix, Shift, LFO Rate, LFO Depth, Feedback.
     *
     * LÍNEAS DE INVESTIGACIÓN:
     *   - Filtro Hilbert IIR polifásico (Weaver method) para mayor rechazo de banda no deseada con menor latencia.
     */
    class FXFrequencyShifter : public FXBase
    {
    public:
        FXFrequencyShifter();
        ~FXFrequencyShifter() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 5; }
        juce::String getEffectName() const override { return "Frequency Shifter"; }

    private:
        abd::dsp::DspFrequencyShifter engine_;
    };
}
