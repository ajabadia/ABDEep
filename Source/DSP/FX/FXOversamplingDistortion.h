/*
  ==============================================================================

    FXOversamplingDistortion.h
    Distorsión asimétrica con sobremuestreo 4x y filtro antialiasing FIR.

    ENVOLTORIO DE PRODUCTO: ABDEep
    MOTOR DSP SUBYACENTE: abd::dsp::DspOversamplingDistortion (ABDSharedCode/DspEffects/DspOversamplingDistortion.h)

    EMULACIÓN DE HARDWARE REAL:
      - DeepMind 12 FX Type 50: Oversampling Distortion
      - Inspirado en la arquitectura de distorsión analógica oversampleada de Odin2.

    DIAGNÓSTICO Y ARQUITECTURA DSP ACTUAL:
      - Sobremuestreo 4x con modelado asimétrico y ensanchamiento estéreo.
      - Diezmado FIR de 4 fases con ventana de coseno alzado para supresión de aliasing.
      - Filtro de tono pasabajos y control Dry/Wet.
      - Eliminación absoluta de vectores dinámicos (100% Real-Time Safe).

    BRECHAS DE FIDELIDAD Y LÍNEAS DE INVESTIGACIÓN PENDIENTES:
      1. Filtrado polifásico IIR / Half-band:
         Un filtro polifásico IIR de fase casi lineal (como el implementado en `OscHalfbandDecimator`)
         proporciona una pendiente de corte más abrupta (>60 dB de atenuación) reduciendo aún más
         el aliasing que el promedio ponderado FIR de 4 taps.

    PARÁMETROS (Orden hardware DeepMind 12 - Type 50):
      0: Drive  (0-1, ganancia de distorsión)
      1: Tone   (0-1, filtro pasabajos de tono)
      2: Mix    (0-1, dry/wet mix)
      3: Level  (0-1, nivel de salida)
      4: Stereo (0-1, apertura estéreo de la distorsión)

  ==============================================================================
*/

#pragma once

#include "FXBase.h"
#include <DspEffects/DspOversamplingDistortion.h>

namespace ABD
{
    class FXOversamplingDistortion : public FXBase
    {
    public:
        FXOversamplingDistortion();
        ~FXOversamplingDistortion() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 5; }
        juce::String getEffectName() const override { return "Oversampling Distortion"; }

    private:
        abd::dsp::DspOversamplingDistortion dist_;
    };
}
