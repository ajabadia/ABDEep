#pragma once

#include "FXBase.h"
#include <DspEffects/DspCombulator.h>

namespace ABD
{
    /**
     * @brief FXCombulator: Crossed stereo comb filter network.
     *
     * ==============================================================================
     * DOCUMENTACIÓN DE HARDWARE Y FIDELIDAD DSP:
     * ==============================================================================
     * 1. HARDWARE EMULADO:
     *    - Basado en los resonadores de filtros peines cruzados estéreo
     *      (DeepMind 12 Type 48 / Eventide DSP4000 Comb Filter Banks / Kurzweil KDFX).
     *    - Dos líneas de delay independientes para canal izquierdo y derecho (1 a 50 ms).
     *    - Realimentación cruzada (cross-feedback) al 30% entre canales L y R para
     *      generar texturas espaciales resonantes, flanging complejo y auto-oscilación.
     *    - Filtro de amortiguación paso bajo de un polo en el lazo de feedback.
     *    - Saturador no lineal suave (tanh) para limitar picos resonantes.
     *
     * 2. DIAGNÓSTICO DE FIDELIDAD:
     *    - Comportamiento idéntico al algoritmo original de DeepMind.
     *    - Totalmente desacoplado en el motor puro `abd::dsp::DspCombulator` (C++20, 100% RT-Safe).
     *
     * 3. LÍNEAS DE INVESTIGACIÓN PENDIENTES:
     *    - Interpolación fraccional cúbica hermite o sinc en lectura de delay para modulación continua de pitch.
     *    - Modos de fase invertida (feedforward/feedback inverso) para emular peines con muescas en lugar de picos.
     * ==============================================================================
     *
     * Parameters:
     *   0: Mix     (0-1, dry/wet mix)
     *   1: DelayL  (0-1, L delay time 1-50ms)
     *   2: DelayR  (0-1, R delay time 1-50ms)
     *   3: Feedback(0-1, feedback + cross-feedback amount)
     *   4: Damping (0-1, high-frequency damping of feedback)
     */
    class FXCombulator : public FXBase
    {
    public:
        FXCombulator();
        ~FXCombulator() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 5; }
        juce::String getEffectName() const override { return "Combulator"; }

    private:
        abd::dsp::DspCombulator engine;
    };
}
