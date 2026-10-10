/*
  ==============================================================================

    FXNoiseGate.h
    Puerta de ruido estéreo con Transient Punch y modo Ducker.

    ENVOLTORIO DE PRODUCTO: ABDEep
    MOTOR DSP SUBYACENTE: abd::dsp::DspNoiseGate (ABDSharedCode/DspEffects/DspNoiseGate.h)

    EMULACIÓN DE HARDWARE REAL:
      - DeepMind 12 FX Type 33: Noise Gate
      - Referencias históricas analógicas:
        * Drawmer DS201 Dual Gate (estándar de estudio con envolventes independientes y ataque rápido).
        * Klark Teknik DN6000 / Behringer expander/gate con transient punch.

    DIAGNÓSTICO Y ARQUITECTURA DSP ACTUAL:
      - 3 Modos: Gate (0), Transient (1), Ducker (2).
      - Threshold (-50 dB a 0 dB) y Range (-100 dB a 0 dB).
      - Envolventes ajustables: Attack (0.5 a 20 ms), Release (2 a 2000 ms), Hold (2 a 2000 ms).
      - Punch: Realce dinámico de transitorios de ataque (-6 dB a +6 dB).
      - 100% Real-Time Safe: sin asignaciones dinámicas en hilos de audio.

    BRECHAS DE FIDELIDAD Y LÍNEAS DE INVESTIGACIÓN PENDIENTES:
      1. Filtro Sidechain pasabanda (Key Listen):
         El Drawmer DS201 analógico posee filtros pasa-altos y pasa-bajos sintonizables en el circuito
         de sidechain/detección ("Frequency Conscious Gating") para disparar la puerta solo con
         ciertos instrumentos (ej. caja o bombo). Investigar añadir filtro SVF en el sidechain.
      2. Detección RMS vs Pico:
         El hardware combina rectificación de valor medio con detección rápida de picos.

    PARÁMETROS (Orden hardware DeepMind 12 - Type 33):
      0: Threshold (0-1, -50..0 dB)
      1: Range     (0-1, -100..0 dB)
      2: Attack    (0-1, 0.5 - 20 ms)
      3: Release   (0-1, 2 - 2000 ms)
      4: Hold      (0-1, 2 - 2000 ms)
      5: Punch     (0-1, -6..+6 dB)
      6: Mode      (0=GAT, 1=TRN, 2=DUC)
      7: Power     (0=ON, 1=OFF)

  ==============================================================================
*/

#pragma once

#include "FXBase.h"
#include <DspEffects/DspNoiseGate.h>

namespace ABD
{
    class FXNoiseGate : public FXBase
    {
    public:
        FXNoiseGate();
        ~FXNoiseGate() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR, int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 8; }
        juce::String getEffectName() const override { return "Noise Gate"; }

    private:
        abd::dsp::DspNoiseGate gate_;
    };
}
