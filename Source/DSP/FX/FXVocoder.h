#pragma once

#include "FXBase.h"
#include "DspEffects/DspVocoder.h"

namespace ABD
{
    /**
     * FXVocoder: Envoltorio de política sobre el vocoder multibanda compartido.
     *
     * ==============================================================================
     * EMULACIÓN HARDWARE:
     *   Vocoder multibanda analógico clásico estilo EMS Vocoder 2000 / Roland SVC-350 /
     *   VP-330 / Korg MS2000.
     *
     *   El motor algorítmico reside en `abd::dsp::DspVocoderBank`
     *   (ABDSharedCode/DspEffects/DspVocoder.h) y utiliza los detectores de envolvente
     *   analógicos `abd::dsp::EnvelopeFollower` (ABDSharedCode/DspCore/DspEnvelopeFollower.h).
     *
     * CARACTERÍSTICAS DE LA IMPLEMENTACIÓN:
     *   - Banco de 4 a 32 filtros pasabanda biquad configurables en escala logarítmica.
     *   - Detectores de envolvente analógicos con tiempos independientes de ataque y relajación.
     *   - Desplazamiento continuo de formantes (transposición tímbrica hacia arriba/abajo).
     *   - Doble modo de modulación:
     *       0 = Entrada externa (vía setModulatorInput / sidechain / micrófono).
     *       1 = Modulador interno sintético (ruido rosa + resonadores de formantes).
     *
     * PARÁMETROS DEL HARDWARE (DeepMind 12 FX Type 49):
     *   0: Mix          (0-1, mezcla seca/húmeda)
     *   1: BandCount    (0-1, número de bandas activas 4-32)
     *   2: Attack       (0-1, tiempo de ataque del seguidor)
     *   3: Release      (0-1, tiempo de relajación del seguidor)
     *   4: FormantShift (0-1, transposición de formantes)
     *   5: ModSrc       (0=micrófono/ext in, 1=ruido rosa/formantes internos)
     *
     * INVESTIGACIÓN PENDIENTE PARA ELEVAR FIDELIDAD:
     *   - Modelar la detección y puerta de sibilancia de consonantes ("Sibilance / Unvoiced Detector")
     *     conmutando a ruido blanco para consonantes fricativas (s, t, k) como en el VP-330/MS2000.
     *   - Permitir selección de frecuencias Bark o curvas fijas de hardware (Roland SVC-350 10-band,
     *     Korg MS2000 16-band).
     * ==============================================================================
     */
    class FXVocoder : public FXBase
    {
    public:
        FXVocoder();
        ~FXVocoder() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 6; }
        juce::String getEffectName() const override { return "Multi-Band Vocoder"; }

        /** Receive external modulator audio (mic/sidechain). Called by FXSlot/FXEngine. */
        void setModulatorInput(const float* modL, const float* modR, int numSamples) override;

    private:
        abd::dsp::DspVocoderBank<32> vocoderBank;

        double sampleRate = 44100.0;

        float paramMix = 0.5f;
        float paramBandCount = 0.4f;
        float paramAttack = 0.3f;
        float paramRelease = 0.5f;
        float paramFormantShift = 0.5f;
        float paramModSrc = 0.0f;

        // Punteros del modulador externo (fijados por bloque)
        const float* extModL = nullptr;
        const float* extModR = nullptr;
        int extModSamples = 0;

        void updateVocoderParams();
    };
}
