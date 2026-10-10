#pragma once

#include "FXBase.h"
#include <DspEffects/DspFlanger.h>

namespace ABD
{
    /**
     * @brief FXFlanger: Efecto Flanger estéreo analógico con realimentación intensa.
     *
     * HARDWARE EMULADO:
     *   - Efecto Flanger analógico clásico (DeepMind 12 FX Type 11), inspirado en unidades
     *     de cinta y pedales BBD como el ADA Flanger, EHX Electric Mistress y TC Electronic SCF.
     *   - Parámetros de control:
     *     * Speed: Frecuencia del LFO (0.05 Hz a 8 Hz).
     *     * Width L / R: Profundidad de modulación por canal (0 ms a 5 ms).
     *     * Delay L / R: Retardo base por canal (0.5 ms a 20 ms).
     *     * Phase: Desfase angular entre LFOs (0° a 180°).
     *     * Feed: Realimentación de hasta ±90% con inversión de fase, generando los
     *       profundos filtros de peine (comb filters) armónicos característicos del flanger.
     *
     * DIAGNÓSTICO DE FIDELIDAD ACTUAL:
     *   - Motor subyacente delegado en `abd::dsp::DspFlanger` (100% RT-Safe, C++20 puro).
     *   - Búfer circular estático sin asignaciones en tiempo de ejecución.
     *
     * LÍNEAS DE INVESTIGACIÓN PENDIENTES:
     *   - Implementar filtros LoCut y HiCut en la rama de realimentación (FeedLC y FeedHC).
     *   - Modelado de asimetría analógica y compresión en la etapa de realimentación alta (>80%).
     */
    class FXFlanger : public FXBase
    {
    public:
        FXFlanger();
        ~FXFlanger() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 12; }
        juce::String getEffectName() const override { return "Flanger"; }

    private:
        abd::dsp::DspFlanger engine_;
    };
}
