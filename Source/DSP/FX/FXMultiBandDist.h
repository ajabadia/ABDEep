/*
  ==============================================================================

    FXMultiBandDist.h
    Distorsión de 3 bandas con cruces complementarios y emulación de altavoz/cabinet.

    ENVOLTORIO DE PRODUCTO: ABDEep
    MOTOR DSP SUBYACENTE: abd::dsp::DspMultiBandDist (ABDSharedCode/DspEffects/DspMultiBandDist.h)

    EMULACIÓN DE HARDWARE REAL:
      - DeepMind 12 FX Type 32: Multi-Band Distortion
      - Inspirado en procesadores de distorsión multibanda analógicos y de estudio.

    DIAGNÓSTICO Y ARQUITECTURA DSP ACTUAL:
      - Crossover complementario de 3 bandas (Low, Mid, High) de 30 Hz a 9000 Hz.
      - 6 algoritmos de distorsión: Valve (tanh), Saturate (knee), Tube (asimétrico)
        y sus variantes con post-filtrado suave.
      - 11 emulaciones de recinto/altavoz (Cabinet) con filtrado pasabajos resonante.
      - Controles de ganancia, drive y nivel independientes por banda.
      - 100% Real-Time Safe: sin asignaciones dinámicas en hilos de audio.

    BRECHAS DE FIDELIDAD Y LÍNEAS DE INVESTIGACIÓN PENDIENTES:
      1. Crossovers Linkwitz-Riley de 4º orden (LR4):
         Sustituir los crossovers de 1 polo por filtros IIR Linkwitz-Riley de 24 dB/oct
         con coherencia de fase perfecta en la suma para eliminar solapamiento entre bandas.
      2. Modelos de Cabinet basados en respuestas impulsionales (IR):
         Modelar perfiles acústicos de pantallas 1x12", 2x12" y 4x12" más precisos que el LPF simple.

    PARÁMETROS (Orden hardware DeepMind 12 - Type 32):
      0:  InGain      (0-1, -24 dB a +24 dB)
      1:  DistType    (0-1, Valve/Saturate/Tube + post-filter)
      2:  LowLevel    (0-1, -12 dB a +12 dB)
      3:  LowDrive    (0-1, 0-100%)
      4:  XoverLowMid (0-1, 30 Hz - 9000 Hz)
      5:  MidLevel    (0-1, -12 dB a +12 dB)
      6:  MidDrive    (0-1, 0-100%)
      7:  XoverMidHi  (0-1, 30 Hz - 9000 Hz)
      8:  HiLevel     (0-1, -12 dB a +12 dB)
      9:  HiDrive     (0-1, 0-100%)
      10: Cabinet     (0-1, 0=OFF, 1-11 tipos)
      11: OutGain     (0-1, -12 dB a +12 dB)

  ==============================================================================
*/

#pragma once

#include "FXBase.h"
#include <DspEffects/DspMultiBandDist.h>

namespace ABD
{
    class FXMultiBandDist : public FXBase
    {
    public:
        FXMultiBandDist();
        ~FXMultiBandDist() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 12; }
        juce::String getEffectName() const override { return "Multi-Band Dist"; }

    private:
        abd::dsp::DspMultiBandDist dist_;
    };
}
