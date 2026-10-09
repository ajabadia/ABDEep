#pragma once

#include "FXBase.h"
#include <DspEffects/DspFdnReverb.h>

namespace ABD
{
    /**
     * @brief FXFDNReverb: Reverberación algorítmica de Feedback Delay Network 8x8 (Tipo 52).
     *
     * Wrapper JUCE que delega el procesamiento DSP en el motor puro `abd::dsp::DspFdnReverb`.
     *
     * TARGET DE HARDWARE Y TOPOLOGÍA:
     *   - Feedback Delay Network de 8 líneas de retardo acopladas por matriz unitaria Householder.
     *   - Difusión de alta densidad mediante 4 etapas Allpass simétricas.
     *   - Simula salas y cámaras reverberantes de estudio con decaimiento natural y cero resonancias metálicas.
     *
     * DIAGNÓSTICO DE FIDELIDAD:
     *   - Sin asignaciones en audio thread (100% Real-Time Safe).
     *   - Control de Size, Decay, Diffusion, Damping y Mix verificado en suite de tests.
     *
     * LÍNEAS DE INVESTIGACIÓN:
     *   - Matriz ortogonal variable Hadamard vs Householder para control de dispersión espacial.
     */
    class FXFDNReverb : public FXBase
    {
    public:
        FXFDNReverb();
        ~FXFDNReverb() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 5; }
        juce::String getEffectName() const override { return "FDN Reverb"; }

    private:
        abd::dsp::DspFdnReverb engine_;
    };
}
