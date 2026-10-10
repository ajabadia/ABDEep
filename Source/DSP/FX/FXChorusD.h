#pragma once

#include "FXBase.h"
#include <DspEffects/DspChorusD.h>

namespace ABD
{
    /**
     * @brief FXChorusD: Emulación del procesador espacial Roland Dimension D (SDD-320).
     *
     * HARDWARE EMULADO:
     *   - Roland SDD-320 "Dimension D" Stereo Chorus Processor (DeepMind 12 FX Type 17).
     *   - Clásico efecto de estudio de los años 80 caracterizado por:
     *     * Dos líneas de retardo analógicas BBD moduladas en antifase (90° y 270°).
     *     * Ausencia de barrido evidente: el cruce espacial de fases (delayedL - delayedR * 0.4)
     *       cancela gran parte del pitch flutter aparente produciendo ensanchamiento tridimensional.
     *     * 4 conmutadores de preset físicos con frecuencias y profundidades fijas.
     *
     * DIAGNÓSTICO DE FIDELIDAD ACTUAL:
     *   - Motor delegado en `abd::dsp::DspChorusD` (100% RT-Safe, C++20 puro).
     *   - Búfer circular estático sin dependencias de JUCE.
     *
     * LÍNEAS DE INVESTIGACIÓN PENDIENTES:
     *   - Modo analógico "All buttons in" (pulsación simultánea de los 4 botones) con saturación.
     *   - Curva de compansión NE570 con preénfasis de agudos y recorte dinámico.
     */
    class FXChorusD : public FXBase
    {
    public:
        FXChorusD();
        ~FXChorusD() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR, int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 7; }
        juce::String getEffectName() const override { return "Chorus-D"; }

    private:
        abd::dsp::DspChorusD engine_;
    };
}
