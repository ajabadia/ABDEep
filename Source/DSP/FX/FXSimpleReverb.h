#pragma once

#include "FXBase.h"
#include "DspEffects/DspSchroederReverb.h"
#include "DspEffects/profiles/ReverbProfile.h"

namespace ABD
{
    /**
     * FXSimpleReverb: ENVOLTORIO de politica sobre el reverberador compartido.
     *
     * Este efecto ya NO tiene reverberador. La maquina vive en
     * `abd::dsp::SchroederReverb` (ABDSharedCode/DspEffects) y los numeros de
     * cada variante en `abd::dsp::ReverbProfile`. Lo que queda aqui es
     * exactamente la parte que es de ABDEep y no del modulo:
     *
     *   - el reparto de los doce mandos normalizados a controles del motor,
     *     que es el orden del HARDWARE del DeepMind 12 y cambia por variante;
     *   - el wet/dry, que no esta aqui: lo mezcla `FXSlot`.
     *
     * Sirve para múltiples tipos de reverb del DeepMind 12:
     *   Hall (1), Plate (2), Rich Plate (3), Ambience (4),
     *   Gated (5), Reverse (6), Chamber (26), Room (27), Vintage (28),
     *   Deep Verb (22)
     *
     * Parámetros (orden hardware por tipo, docs/deepmind_fx.md):
     *   Hall(1)/Plate(2)/RichPlate(3)/Chamber(26)/Room(27)/Vintage(28): 12 params
     *     [preDelay, decay, size, damping, diffusion, mix, loCut, hiCut,
     *      bassMult, spread, shape, spin]
     *   Ambience(4): 10 params [preDelay, decay, size, damping, diffusion,
     *     mix, loCut, hiCut, mod, tailGain]
     *   Gated(5): 10 params [preDelay, decay, attack, density, spread,
     *     mix, loCut, hiSvFreq, hiSvGain, diffusion]
     *   Reverse(6): 9 params [preDelay, decay, rise, diffusion, spread,
     *     mix, loCut, hiSvFreq, hiSvGain]
     *   DeepVerb(22): 5 params [preset, decay, tone, preDelay, mix]
     *
     * DSP real para los controles con equivalente interno (preDelay, decay,
     * size→roomSize, damping, diffusion); el resto se almacena/ignora. Cual de
     * los doce mandos mueve cual de los cinco controles lo dice `ReverbProfile`
     * (`paramIndex*`), no este fichero: por eso el `switch` de abajo se ha
     * quedado en una tabla en vez de en diez casos escritos a mano.
     *
     * PARIDAD. Este envoltorio no cambia ni una muestra: la comprobacion bit a
     * bit esta en `FXUnitTests_ReverbParity.cpp`, contra una copia congelada
     * del kernel anterior a la extraccion.
     */
    class FXSimpleReverb : public FXBase
    {
    public:
        FXSimpleReverb(int reverbType = 1); // 1=Hall, 2=Plate, etc.
        ~FXSimpleReverb() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override;
        juce::String getEffectName() const override;

    private:
        int reverbType;

        // La variante del DeepMind 12 que sirve este slot. Apunta a una fila de
        // `ReverbProfile::variants` (o a la fila generica), nunca a memoria
        // propia, asi que no hay nada que liberar.
        const abd::dsp::ReverbProfile::Variant* variant = nullptr;

        // Cache de los cinco controles del motor. Se guardan aqui, y no se
        // releen del perfil, por una razon concreta: el perfil solo tiene los
        // valores de FABRICA, y un mando que se mueva tiene que sobrevivir a que
        // otro se mueva despues. `setGeometry` recalcula longitudes sin tocar
        // estos numeros, asi que el cache es lo que conserva el estado.
        float decay = 0.5f;
        float preDelayTime = 0.0f;
        float damping = 0.5f;
        float diffusion = 0.5f;
        float roomSize = 0.5f;

        // La maquina. Es un solo motor para las diez variantes: lo que las
        // diferencia son los cinco numeros de arriba.
        abd::dsp::SchroederReverb engine;

        void updateFilters();
        void updateCombParams();
    };
}
