/*
  ==============================================================================

    FXFairComp.h
    Compresor/limitador a válvulas estéreo estilo Fairchild 670 (Vari-Mu).

    ENVOLTORIO DE PRODUCTO: ABDEep
    MOTOR DSP SUBYACENTE: abd::dsp::DspFairComp (ABDSharedCode/DspEffects/DspFairComp.h)

    EMULACIÓN DE HARDWARE REAL:
      - DeepMind 12 FX Type 31: FairComp
      - Referencia histórica analógica:
        * Fairchild 670 Stereo Compressor / Limiter (diseñado por Rein Narma en 1959).
        * Topología Vari-Mu: el nivel de la señal de audio polariza las rejillas de las válvulas
          remotas de corte rápido (cuatro tubos 6386 en push-pull por canal), reduciendo la ganancia
          de forma continua y no lineal sin atenuadores VCA de estado sólido.

    DIAGNÓSTICO Y ARQUITECTURA DSP ACTUAL:
      - 4 Modos de operación: Bypass (0), Estéreo vinculado (1), Dual Mono (2) y Mid/Side (3).
      - Las 6 constantes de tiempo oficiales Fairchild de constante RC (Time Constant 1 a 6).
      - Control de DC Bias que altera la polarización de rejilla, ajustando de forma continua
        el ratio de compresión (de 2:1 a 30:1) y la curvatura del codo soft knee (de 20 dB a 2 dB).
      - 100% Real-Time Safe: sin asignaciones dinámicas en hilos de audio.

    BRECHAS DE FIDELIDAD Y LÍNEAS DE INVESTIGACIÓN PENDIENTES:
      1. Curva de polarización de válvulas 6386 emparejadas:
         Las válvulas 6386 no tienen una curva exponencial pura; la transconductancia decae según
         gm(Vbias) con armónicos de segundo orden compensados en push-pull pero presentes ante
         desequilibrios de DC Bias. Se debe investigar modelar la ecuación diferencial de corriente
         anódica y transformador de salida UTC A-26.
      2. Descarga dependiente de programa en posiciones 5 y 6:
         Las constantes 5 y 6 del Fairchild original poseen una red RC dual (un condensador rápido
         y uno lento en paralelo) que responde de forma adaptativa a la duración de los picos.

    PARÁMETROS (Orden hardware DeepMind 12 - Type 31):
      0:  Mode         (0-1, 0=OFF, 1=Stereo, 2=Dual, 3=M/S)
      1:  InGain LM    (0-1, -20 dB a 0 dB)
      2:  Threshold LM (0-1, -40 dB a 0 dB)
      3:  TimeConst LM (0-1, Constantes 1 a 6)
      4:  DC Bias LM   (0-1, Ratio y codo)
      5:  OutGain LM   (0-1, -18 dB a +6 dB)
      6:  Bias Balance (0-1, balance de bias L/R)
      7:  InGain RS    (0-1, -20 dB a 0 dB)
      8:  Threshold RS (0-1, -40 dB a 0 dB)
      9:  TimeConst RS (0-1, Constantes 1 a 6)
      10: DC Bias RS   (0-1, Ratio y codo)
      11: OutGain RS   (0-1, -18 dB a +6 dB)

  ==============================================================================
*/

#pragma once

#include "FXBase.h"
#include <DspEffects/DspFairComp.h>

namespace ABD
{
    class FXFairComp : public FXBase
    {
    public:
        FXFairComp();
        ~FXFairComp() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR, int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 12; }
        juce::String getEffectName() const override { return "FairComp"; }

    private:
        abd::dsp::DspFairComp comp_;
        double sampleRate = 44100.0;
    };
}
