/*
  ==============================================================================

    FXSolinaEnsemble.h
    Efecto Ensemble Chorus de cuerdas estilo Eminent 310 Unique / ARP Solina.

    ENVOLTORIO DE PRODUCTO: ABDEep
    MOTOR DSP SUBYACENTE: abd::dsp::DspSolinaEnsemble (ABDSharedCode/DspEffects/DspSolinaEnsemble.h)

    EMULACIÓN DE HARDWARE REAL:
      - DeepMind 12 FX Type 37: Solina Ensemble
      - Referencias históricas analógicas:
        * Eminent 310 Unique (órgano holandés que albergó el circuito de ensamble original).
        * ARP / Solina String Ensemble (módulo sintetizador de cuerdas icónico de 1974).
        * Circuito analógico: tres líneas de retardo BBD integradas (TDA1022 o TCA350) moduladas por tres fases a 0°, 120° y 240°.

    DIAGNÓSTICO Y ARQUITECTURA DSP ACTUAL:
      - 3 Taps de retardo por canal desfasados uniformemente en 120° (2*pi/3).
      - Retardo base de 8 ms modulado hasta 5 ms de excursión máxima.
      - Interpolación cúbica Hermite de 4 puntos por tap.
      - Control de Stereo Spread para expansión estéreo de los taps.
      - Buffer estático circular sin asignaciones de memoria en tiempo de ejecución (100% Real-Time Safe).

    BRECHAS DE FIDELIDAD Y LÍNEAS DE INVESTIGACIÓN PENDIENTES:
      1. Doble oscilador de modulación analógico del Solina:
         El Solina auténtico no utiliza un LFO único simple a 120°. Utiliza DOS generadores analógicos
         simultáneos desacoplados:
           * LFO lento (~0.6 Hz)
           * LFO rápido (~6.0 Hz)
         Las salidas de ambos LFOs se mezclan en proporciones fijas antes de alimentar las entradas de
         reloj de las líneas BBD TDA1022. Investigar este esquema bi-frecuencial aportará el característico
         "shimmer" orquestal del hardware original.
      2. Filtrado antialiasing y reconstrucción de reloj BBD:
         Cada etapa BBD analógica posee un filtro pasobajos activo Sallen-Key LC/RC (~10 kHz) para eliminar
         el ruido de reloj de muestreo.

    PARÁMETROS (Orden hardware DeepMind 12 - Type 37):
      0: Rate     (0-1 → 0.2 a 8.0 Hz)
      1: Depth    (0-1 → 0 a 5 ms de modulación)
      2: Feedback (0-1 → 0 a 85%)
      3: Spread   (0-1 → 0 a 100% stereo width)
      4: Mix      (0-1 → dry/wet)

  ==============================================================================
*/

#pragma once

#include "FXBase.h"
#include <DspEffects/DspSolinaEnsemble.h>

namespace ABD
{
    class FXSolinaEnsemble : public FXBase
    {
    public:
        FXSolinaEnsemble();
        ~FXSolinaEnsemble() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 5; }
        juce::String getEffectName() const override { return "Solina Ensemble"; }

    private:
        abd::dsp::DspSolinaEnsemble ensemble_;
    };
}