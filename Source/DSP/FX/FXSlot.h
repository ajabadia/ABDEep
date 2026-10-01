#pragma once

#include "FXBase.h"
#include "FXDelay.h"
#include "FXChorus.h"
#include "FXSimpleReverb.h"
#include "FXFlanger.h"
#include "FXPhaser.h"
#include "FXRotarySpeaker.h"
#include "FXAutoPan.h"
#include "FXRackAmp.h"
#include "FXMultiBandDist.h"
#include "FXEdison.h"
#include "FXMoodFilter.h"
#include "FXEnhancer.h"
#include "FXSimpleComp.h"
#include "FXNoiseGate.h"
#include "FXPitchShifter.h"
#include "FXDecimDelay.h"
#include "FXTapeDelay.h"
#include "FXModDelayRev.h"
#include "FXMidasEQ.h"
#include "FXHybridReverb.h"
#include "FXMultiTapDelay.h"
#include "FXChorusD.h"
#include "FXFairComp.h"
#include "FXRolandBBDChorus.h"
#include "FXSolinaEnsemble.h"
#include "FXRingModulator.h"
#include "FXSpaceEchoRE201.h"
#include "FXAnalogTapeDelay.h"
#include "FXShimmerDelay.h"
#include "FXGranularDelay.h"
#include "FXPatternFreeze.h"
#include "FXDuckingDelay.h"
#include "FXSpectralDelay.h"
#include "FXFrequencyShifter.h"
#include "FXResonator.h"
#include "FXCombulator.h"
#include "FXVocoder.h"
#include "FXOversamplingDistortion.h"
#include "FXWaveShaper.h"
#include "FXFDNReverb.h"
#include "FXZitaReverb.h"
#include "FXNimbus.h"
#include "FXBonsai.h"
#include "FXTreemonster.h"
#include <memory>

namespace ABD
{
    /**
     * FXSlot: Contenedor para un slot de efecto individual.
     * 
     * Administra:
         *   - El tipo de efecto (0-56, 0=Bypass)
     *   - 12 parámetros normalizados
     *   - La ganancia de salida
     *   - La mezcla wet/dry
     *   - La instancia del efecto concreto (creada por factory)
     */
    class FXSlot
    {
    public:
        FXSlot();
        ~FXSlot() = default;

        void prepare(double sampleRate, int samplesPerBlock);
        void prepareBuffers(int numChannels, int numSamples);

        void setType(int type);
        int getType() const { return type; }

        void setParameter(int index, float value);
        float getParameter(int index) const { return (index >= 0 && index < 12) ? params[index] : 0.0f; }

        void setGain(float gain);
        float getGain() const { return gain; }

        /**
         * Modulacion de la matriz sobre ESTE hueco, para los dos destinos que
         * el manual le da: `Fx N Level` y `Fx N Parameters`.
         *
         * @param level       Buffer de la modulacion de nivel, UNA muestra por
         *                    bloque de audio, con la cantidad YA DENTRO
         *                    (`fuente * profundidad`, bipolar). No se copia: lo
         *                    consume `process` y el llamante lo rellena en su
         *                    propio bucle. Con `nullptr` el nivel no se modula.
         * @param paramAmount Cantidad, en bipolar, con la que se mueven los
         *                    parametros que el efecto declare modulables
         *                    (`FXBase::getModulationParams`). Es una CONSTANTE de
         *                    todo el bloque, no otra serie: el efecto lee sus
         *                    parametros una vez al procesar. Con 0 no se tocan.
         * @param numSamples  Longitud de `level`.
         */
        void setMatrixModulation(const float* level, float paramAmount, int numSamples);

        void setMix(float mix);
        float getMix() const { return mix; }

        bool isActive() const { return type != 0 && effect != nullptr; }

        /** Acceso a la instancia interna del efecto (inspección de parámetros). */
        FXBase* getEffect() { return effect.get(); }
        const FXBase* getEffect() const { return effect.get(); }

        /** Forward external modulator audio to the effect (used by FXVocoder). */
        void setModulatorInput(const float* modL, const float* modR, int numSamples);

        void process(juce::AudioBuffer<float>& buffer, int numSamples);

        void reset();

    private:
        int type = 0;                 // 0=Bypass, 1-49=tipos de efecto
        float params[12] = {};        // Parámetros normalizados 0-1
        float gain = 1.0f;            // Ganancia de salida
        float mix = 0.5f;             // Mezcla wet/dry

        // Modulación de la matriz. `levelMod` NO se copia: apunta al buffer del
        // motor, que lo rellena muestra a muestra en el mismo bucle. `paramMod`
        // es una constante por bloque, y el motivo está en `process`.
        const float* levelMod = nullptr;
        float paramMod = 0.0f;

        std::unique_ptr<FXBase> effect;

        double lastSampleRate = 44100.0;
        int lastSamplesPerBlock = 256;

        // Buffers pre-alocados para evitar alocaciones en hot-path
        juce::AudioBuffer<float> wetBuffer;
        bool buffersPrepared = false;

        void syncParameters();
        static std::unique_ptr<FXBase> createEffect(int type);
    };
}
