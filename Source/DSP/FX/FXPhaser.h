/*
  ==============================================================================

    FXPhaser.h
    Efecto Phaser multietapa con LFO estéreo y seguidor de envolvente dinámico.

    ENVOLTORIO DE PRODUCTO: ABDEep
    MOTOR DSP SUBYACENTE: abd::dsp::DspPhaser (ABDSharedCode/DspEffects/DspPhaser.h)

    EMULACIÓN DE HARDWARE REAL:
      - DeepMind 12 FX Type 9: Phaser
      - Referencias analógicas históricas:
        * Electro-Harmonix Small Stone (EH4800, basado en OTAs CA3080 / LM13600 con resonancia "Color").
        * MXR Phase 90 / Phase 100 (4 y 6 etapas con transistores de efecto de campo JFET apareados).
        * Mu-Tron Phasor II (6 etapas ópticas/allpass con feedback regenerativo profundo y amplio barrido).

    DIAGNÓSTICO Y ARQUITECTURA DSP ACTUAL:
      - Cascada todo-paso (allpass) de 1 polo bilineal configurable en 2, 4, 6, 8, 10 o 12 etapas.
      - Frecuencia base de 20 Hz a 15 kHz con mapeo exponencial y modulación de barrido de hasta 6 kHz.
      - LFO estéreo (0.05 Hz a 5.0 Hz) con desfase entre canales (0° a 180°) y asimetría de forma de onda (Wave).
      - Seguidor de envolvente (envelope follower) analógico de 1 polo con constantes de tiempo
        configurables (Attack / Release de 10ms a 1000ms) que modula dinámicamente la profundidad (EnvMod).
      - 100% Real-Time Safe: sin asignaciones dinámicas en memoria durante el procesamiento de audio.

    BRECHAS DE FIDELIDAD Y LÍNEAS DE INVESTIGACIÓN PENDIENTES:
      1. Saturación y no-linealidad de transconductancia OTA:
         En el Small Stone y Mu-Tron real, las etapas allpass distorsionan suavemente según la función
         Iout = Iabc * tanh(Vin / (2 * Vt)). Añadir saturación no-lineal suave por etapa otorgará la
         calidez y compresión armónica del hardware original.
      2. No-linealidad VCR de JFETs (MXR Phase 90):
         Los transistores FET operando como resistencias variables introducen armónicos pares en los
         nulos de fase si el nivel de señal es alto.
      3. Dispersión de tolerancias de componentes pasivos (drift):
         Los condensadores de fase en pedales vintage tienen tolerancias del 5% al 10%, lo que produce
         separaciones asimétricas de los picos/valles que enriquecen el timbre frente a filtros idénticos.

    PARÁMETROS (Orden hardware DeepMind 12 - Type 9):
      0: Speed    (0-1, 0.05Hz - 5.0Hz)
      1: Depth    (0-1, 0-100%)
      2: Reso     (0-1, 0-100%, feedback de la cascada)
      3: Base     (0-1, 20Hz - 15000Hz, frecuencia central)
      4: Stages   (0-1, mapeado a 2, 4, 6, 8, 10, 12 etapas)
      5: Mix      (0-1, wet/dry — aplicado por FXSlot)
      6: Wave     (0-1, -50 a +50, simetría del LFO)
      7: Phase    (0-1, 0-180°, offset estéreo del LFO)
      8: EnvMod   (0-1, -100..+100%, envelope modula la profundidad)
      9: Attack   (0-1, 10ms - 1000ms, tiempo del envelope follower)
      10: Hold    (0-1, almacenado — sin equivalente DSP)
      11: Release (0-1, 10ms - 1000ms, tiempo del envelope follower)

  ==============================================================================
*/

#pragma once

#include "FXBase.h"
#include <DspEffects/DspPhaser.h>

namespace ABD
{
    class FXPhaser : public FXBase
    {
    public:
        FXPhaser();
        ~FXPhaser() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 12; }
        juce::String getEffectName() const override { return "Phaser"; }

    private:
        abd::dsp::DspPhaser phaser_;
        double sampleRate = 44100.0;
        float hold = 0.5f; // Parámetro almacenado por compatibilidad de contrato
    };
}
