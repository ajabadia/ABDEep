/*
  ==============================================================================

    FXWaveShaper.h
    Modelador de ondas no lineal (WaveShaper) con familias de curvas continuas.

    ENVOLTORIO DE PRODUCTO: ABDEep
    MOTOR DSP SUBYACENTE: abd::dsp::DspWaveShaper (ABDSharedCode/DspEffects/DspWaveShaper.h)

    EMULACIÓN DE HARDWARE REAL:
      - DeepMind 12 FX Type 51: Wave Shaper
      - Algoritmo digital de conformación no lineal (Surge WaveShaperEffect / Korg Prophecy waveshaper).

    DIAGNÓSTICO Y ARQUITECTURA DSP ACTUAL:
      - Curvas de transferencia continuas: Soft-Clip (tanh), Wavefold y Sine-based.
      - Control de simetría armónica (pares cuadráticos vs impares cúbicos).
      - Filtro de tono pasabajos y control de mezcla Dry/Wet.
      - 100% Real-Time Safe: sin asignaciones dinámicas en hilos de audio.

    BRECHAS DE FIDELIDAD Y LÍNEAS DE INVESTIGACIÓN PENDIENTES:
      1. Aliasing en pliegues de onda (Wavefolding):
         El plegado agresivo de ondas genera frecuencias que superan la frecuencia de Nyquist.
         Se debe investigar añadir sobremuestreo opcional o algoritmos de anti-derivada (ADAA).

    PARÁMETROS (Orden hardware DeepMind 12 - Type 51):
      0: Shape    (0-1, familia de curvas de transferencia)
      1: Symmetry (0-1, balance armónicos pares/impares)
      2: Gain     (0-1, ganancia de entrada)
      3: Tone     (0-1, filtro pasabajos post-shaper)
      4: Mix      (0-1, dry/wet mix)

  ==============================================================================
*/

#pragma once

#include "FXBase.h"
#include <DspEffects/DspWaveShaper.h>

namespace ABD
{
    class FXWaveShaper : public FXBase
    {
    public:
        FXWaveShaper();
        ~FXWaveShaper() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 5; }
        juce::String getEffectName() const override { return "WaveShaper"; }

    private:
        abd::dsp::DspWaveShaper shaper_;
    };
}
