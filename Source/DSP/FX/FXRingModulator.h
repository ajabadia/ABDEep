#pragma once

#include "FXBase.h"
#include "DspEffects/RingMod.h"
#include "DspEffects/characters/DiodeBridge.h"

namespace ABD
{
    /**
     * FXRingModulator: Envoltorio de política sobre el modulador en anillo compartido.
     *
     * ==============================================================================
     * EMULACIÓN HARDWARE:
     *   Modulador en anillo estilo IRCAM con puente de diodos (IRCAM Diode Bridge /
     *   Maestro Ring Modulator / Moog Moogerfooger MF-102 Ring Mod).
     *
     *   El núcleo algorítmico del motor reside en `abd::dsp::RingMod`
     *   (ABDSharedCode/DspEffects/RingMod.h), y la etapa de no linealidad asimétrica
     *   analógica reside en `abd::dsp::DiodeBridge`
     *   (ABDSharedCode/DspEffects/characters/DiodeBridge.h).
     *
     * CARACTERÍSTICAS DE LA IMPLEMENTACIÓN:
     *   - 3 formas de onda de portadora: Seno, Sierra y Cuadrada.
     *   - Rango de frecuencia portadora: 20 Hz a 8000 Hz en escala logarítmica/exponencial.
     *   - LFO interno de modulación de frecuencia portadora: 0.1 Hz a 10 Hz.
     *   - Puente de diodos modelado con umbral y codo de compresión hiperbólica (tanh):
     *     evita el sonido aséptico/digital de la simple multiplicación matemática y
     *     añade los productos armónicos ricos propios del choque de diodos analógico.
     *
     * PARÁMETROS DEL HARDWARE (DeepMind 12 FX Type 38):
     *   0: Freq     (0-1 -> 20 Hz a 8000 Hz exponencial)
     *   1: LFO Rate (0-1 -> 0.1 Hz a 10 Hz)
     *   2: LFO Depth(0-1 -> 0% a 100% modulación de frecuencia)
     *   3: Waveform (0-0.33=seno, 0.33-0.66=sierra, 0.66-1=cuadrada)
     *   4: Mix      (0-1 -> seca / húmeda)
     *
     * INVESTIGACIÓN PENDIENTE PARA ELEVAR FIDELIDAD:
     *   - Añadir entrada externa de modulación (portadora sidechain en lugar de solo oscilador interno).
     *   - Medir curvas IV reales de diodos de germanio (1N34A / 1N60) frente a diodos de silicio
     *     para modelar la caída de tensión de umbral (0.2V germanio vs 0.6V silicio).
     * ==============================================================================
     */
    class FXRingModulator : public FXBase
    {
    public:
        FXRingModulator();
        ~FXRingModulator() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 5; }
        juce::String getEffectName() const override { return "Ring Modulator"; }

    private:
        abd::dsp::RingMod<abd::dsp::RingModProfile, abd::dsp::DiodeBridge> ringMod;

        float paramFreq = 0.5f;
        float paramLFORate = 0.3f;
        float paramLFODepth = 0.4f;
        float paramWaveform = 0.0f;
        float paramMix = 0.5f;
    };
}