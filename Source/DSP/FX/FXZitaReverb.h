#pragma once

#include "FXBase.h"
#include <DspEffects/DspZitaReverb.h>

namespace ABD
{
    /**
     * @brief FXZitaReverb: Reverberación algorítmica transparente de alta resolución Zita/AIR (Tipo 53).
     *
     * Wrapper JUCE que delega el procesamiento DSP en el motor puro `abd::dsp::DspZitaReverb`.
     *
     * TARGET DE HARDWARE Y TOPOLOGÍA:
     *   - Topología Zita / AIR (Fons Adriaensen / Surge / Odin2):
     *     * Pre-delay estéreo de hasta 100 ms.
     *     * Allpass monofónico de entrada para dispersión y coherencia estéreo.
     *     * 4 Filtros Comb paralelos con amortiguamiento HF.
     *     * 2 Etapas Allpass estéreo a la salida.
     *   - Diseñada para espacios acústicos transparentes, colas de reverb cristalinas y mezcla limpia.
     *
     * DIAGNÓSTICO DE FIDELIDAD:
     *   - 100% Real-Time Safe: Búferes circulares preasignados en prepare(), cero heap en audio thread.
     *   - Controles de Size, Decay, Damping, PreDelay y Mix cubiertos en tests unitarios.
     *
     * LÍNEAS DE INVESTIGACIÓN:
     *   - Modulación senoidal micro-temporal en los peines (comb modulation) para colas tipo Lexicon.
     */
    class FXZitaReverb : public FXBase
    {
    public:
        FXZitaReverb();
        ~FXZitaReverb() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 5; }
        juce::String getEffectName() const override { return "Zita Reverb"; }

    private:
        abd::dsp::DspZitaReverb engine_;
    };
}
