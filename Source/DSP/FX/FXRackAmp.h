/*
  ==============================================================================

    FXRackAmp.h
    Simulador de previo y amplificador analógico de guitarra estilo SansAmp.

    ENVOLTORIO DE PRODUCTO: ABDEep
    MOTOR DSP SUBYACENTE: abd::dsp::DspRackAmp (ABDSharedCode/DspEffects/DspRackAmp.h)

    EMULACIÓN DE HARDWARE REAL:
      - DeepMind 12 FX Type 7: Rack Amp
      - Emulación clásica de previos analógicos en rack (Tech 21 SansAmp PSA-1 / Rockman).

    DIAGNÓSTICO Y ARQUITECTURA DSP ACTUAL:
      - Pre-amplificación y modelado de color: Buzz (agudos pre) y Punch (medios pre).
      - Distorsión armónica no lineal con componente asimétrico Crunch y saturación valvular Drive.
      - Ecualizador de 2 bandas shelving post-saturación (Low 200 Hz, High 5 kHz).
      - Emulación de pantalla/cono (Cabinet) mediante filtro paso-bajos resonante de 2 polos.
      - 100% Real-Time Safe: sin asignaciones dinámicas en hilos de audio.

    BRECHAS DE FIDELIDAD Y LÍNEAS DE INVESTIGACIÓN PENDIENTES:
      1. Modelado de etapa de potencia push-pull y crossover distortion:
         En amplificadores reales, la distorsión de cruce en los transistores/válvulas de potencia
         aporta armónicos cuando la señal decae.
      2. Simulación acústica del recinto de altavoz:
         Añadir filtro de resonancia de caja (notch en ~500 Hz y pico de presencia en ~2.5-3 kHz).

    PARÁMETROS (Orden hardware DeepMind 12 - Type 7):
      0: PreAmp  (0-1, ganancia del previo)
      1: Buzz    (0-1, realce agudos pre-distorsión)
      2: Punch   (0-1, realce medios-bajos pre-distorsión)
      3: Crunch  (0-1, distorsión asimétrica)
      4: Drive   (0-1, saturación general)
      5: Level   (0-1, volumen master)
      6: Low     (0-1, ecualizador graves)
      7: High    (0-1, ecualizador agudos)
      8: Cabinet (0=OFF, 1=ON, simulación altavoz)

  ==============================================================================
*/

#pragma once

#include "FXBase.h"
#include <DspEffects/DspRackAmp.h>

namespace ABD
{
    class FXRackAmp : public FXBase
    {
    public:
        FXRackAmp();
        ~FXRackAmp() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 9; }
        juce::String getEffectName() const override { return "Rack Amp"; }

    private:
        abd::dsp::DspRackAmp amp_;
    };
}
