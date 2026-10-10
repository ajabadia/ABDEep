/*
  ==============================================================================

    FXMoodFilter.h
    Filtro multimodo resonante con saturación, LFO y seguidor de envolvente.

    ENVOLTORIO DE PRODUCTO: ABDEep
    MOTOR DSP SUBYACENTE: abd::dsp::DspMoodFilter (ABDSharedCode/DspEffects/DspMoodFilter.h)

    EMULACIÓN DE HARDWARE REAL:
      - DeepMind 12 FX Type 8: Mood Filter
      - Referencias de hardware analógico:
        * Moog Moogerfooger MF-101 Lowpass Filter (filtro ladder transistorizado con
          seguidor de envolvente dinámico diseñado por Bob Moog).
        * Minimoog Model D Filter (auto-oscilación, overdrive de entrada por saturación de etapa de mezcla).

    DIAGNÓSTICO Y ARQUITECTURA DSP ACTUAL:
      - Filtro de estado variable (SVF) multimodo con topología configurable de 2 polos (12 dB/oct)
        o 4 polos (24 dB/oct).
      - 4 Modos de filtrado: Lowpass, Highpass, Bandpass y Notch.
      - Etapa de Overdrive pre-filtro no lineal modelada mediante saturación tangencial (tanh).
      - LFO de modulación (0.05 a 20 Hz) con 7 formas de onda: Triangular, Sinusoidal, Rampa ascendente (+),
        Rampa descendente (-), Triángulo invertido/Ramp, Cuadrada y Aleatoria (Sample & Hold).
      - Seguidor de envolvente dinámico que modula la frecuencia de corte (EnvMod de -100% a +100%).
      - Soft-limiting interno en las variables de estado para garantizar estabilidad absoluta y calidez armónica.
      - 100% Real-Time Safe: sin asignaciones dinámicas en hilos de audio.

    BRECHAS DE FIDELIDAD Y LÍNEAS DE INVESTIGACIÓN PENDIENTES:
      1. Topología Transistor Ladder auténtica:
         El hardware Moog original no es un SVF, sino una escalera de 4 pares diferenciales de transistores
         con respuesta en fase específica y atenuación progresiva de frecuencias graves a medida que
         aumenta la resonancia. Se debe investigar una vía para conmutar opcionalmente hacia la topología
         ZDF TPT Ladder (`abd::dsp::DspMoogLadder`) manteniendo el soporte multimodo (HP/BP/Notch mediante
         combinaciones lineales de los polos de la escalera).
      2. Asimetría de saturación térmica:
         En circuitos analógicos discretos, la saturación no es simétrica `tanh(x)`; presenta offsets DC
         ligeros y armónicos de segundo orden apreciables.
      3. Sensibilidad del Envelope Follower:
         Modelar la rectificación de onda completa y constantes de integración RC exactas del MF-101.

    PARÁMETROS (Orden hardware DeepMind 12 - Type 8):
      0: Speed   (0-1, 0.05 - 20 Hz)
      1: Depth   (0-1, 0 - 100%)
      2: Reso    (0-1, 0 - 100%)
      3: Base    (0-1, 20 - 15000 Hz)
      4: Type    (0-1, Low/High/Band/Notch)
      5: Mix     (0-1, wet/dry — aplicado por FXSlot)
      6: Wave    (0-1, Tri/Sin/Saw+/Saw-/Ramp/Sq/Rand)
      7: EnvMod  (0-1, -100..+100%)
      8: Attack  (0-1, tiempo del envelope follower)
      9: Release (0-1, tiempo del envelope follower)
      10: Drive  (0-1, 0-100% overdrive)
      11: Poles  (0=2P, 1=4P)

  ==============================================================================
*/

#pragma once

#include "FXBase.h"
#include <DspEffects/DspMoodFilter.h>

namespace ABD
{
    class FXMoodFilter : public FXBase
    {
    public:
        FXMoodFilter();
        ~FXMoodFilter() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 12; }
        juce::String getEffectName() const override { return "Mood Filter"; }

    private:
        abd::dsp::DspMoodFilter filter_;
        double sampleRate = 44100.0;
    };
}
