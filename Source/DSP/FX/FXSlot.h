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
#include <memory>

namespace ABD
{
    /**
     * FXSlot: Contenedor para un slot de efecto individual.
     * 
     * Administra:
     *   - El tipo de efecto (0-35, 0=Bypass)
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

        void setMix(float mix);
        float getMix() const { return mix; }

        bool isActive() const { return type != 0 && effect != nullptr; }

        void process(juce::AudioBuffer<float>& buffer, int numSamples);

        void reset();

    private:
        int type = 0;                 // 0=Bypass, 1-35=tipos de efecto
        float params[12] = {};        // Parámetros normalizados 0-1
        float gain = 1.0f;            // Ganancia de salida
        float mix = 0.5f;             // Mezcla wet/dry

        std::unique_ptr<FXBase> effect;

        // Buffers pre-alocados para evitar alocaciones en hot-path
        juce::AudioBuffer<float> wetBuffer;
        bool buffersPrepared = false;

        void syncParameters();
        static std::unique_ptr<FXBase> createEffect(int type);
    };
}
