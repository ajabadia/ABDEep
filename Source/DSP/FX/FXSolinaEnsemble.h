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
      - DOS MODOS en el motor, seleccionables con `setMode()`:
          * `Mode::Standard` (defecto): el DeepMind 12 de toda la vida, con
            rate, depth, feedback, spread y mix continuos.
          * `Mode::DualLFO`: el esquema bi-frecuencial auténtico del Solina
            (LFO lento a ~0.5 Hz + LFO rápido a ~6.0 Hz, relación fija 1:12,
            mezclados 0.8/0.2) sobre un retardo base de 15 ms, con matriz
            estéreo asimétrica en contrafase.

    ESTADO DEL DUALLFO, Y POR QUÉ NO ES ALCANZABLE DESDE EL PRODUCTO:
      El modo DualLFO ESTÁ implementado y commiteado en el motor compartido
      (ABDSharedCode, 59c501e) y su sonido está fijado por el test de paridad
      `Source/DSP/FX/FXUnitTests_SolinaParity.cpp` (0 ULPS contra su copia
      congelada). Lo que falta es el camino del producto: el envoltorio de
      abajo no expone parámetro de modo, así que hoy siempre corre en
      `Mode::Standard`. Cablearlo requiere decidir antes dónde vive el mando
      en el contrato de 5 parámetros del slot 37 y en el puente WebUI, porque
      los mandos que la rama DualLFO ignora hoy (feedback, spread y mix, medidos
      con diferencia exacta 0) dejarían de responder según el modo elegido.

    BRECHAS DE FIDELIDAD Y LÍNEAS DE INVESTIGACIÓN PENDIENTES:
      1. Filtrado antialiasing y reconstrucción de reloj BBD:
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