#pragma once

#include "FXBase.h"
#include <DspEffects/DspEnhancer.h>

namespace ABD
{
    /**
     * @brief FXEnhancer: Procesador espectral (Enhancer / Exciter 3 bandas).
     *
     * ==============================================================================
     * DOCUMENTACIÓN DE HARDWARE Y FIDELIDAD DSP:
     * ==============================================================================
     * 1. HARDWARE EMULADO:
     *    - Basado en los procesadores analógicos de excitador psicoacústico tipo
     *      SPL Vitalizer / Behringer SX3040 Sonic Exciter / DeepMind 12 (type=18).
     *    - Estructura de procesamiento por 3 bandas:
     *      * Bass shelving filter con frecuencia ajustable (30 Hz - 20 kHz logarítmico)
     *        y control de realce/densidad de graves.
     *      * Mid peaking filter con frecuencia sintonizada en 1 kHz, control de factor Q
     *        resonante y ganancia para presencia vocal/leads.
     *      * High shelving exciter con realce de armónicos superiores y aire.
     *      * Modo Solo para monitorizar exclusivamente la banda de medios procesada.
     *      * Control Spread para amplificación espacial estéreo de la señal tratada.
     *
     * 2. DIAGNÓSTICO DE FIDELIDAD:
     *    - Recreación exacta de las etapas de filtrado shelving y biquad peaking.
     *    - Totalmente desacoplado en el motor puro `abd::dsp::DspEnhancer` (C++20, 100% RT-Safe).
     *
     * 3. LÍNEAS DE INVESTIGACIÓN PENDIENTES:
     *    - Incorporar generación dinámica de armónicos pares e impares por transducción
     *      no lineal dependiente de la envolvente de la señal en alta frecuencia.
     *    - Simular desfase dependiente de la frecuencia típico de las redes analógicas RC de SPL.
     * ==============================================================================
     *
     * Parámetros:
     *   0: OutGain   (0-1, -12..+12 dB)
     *   1: Spread    (0-1, 0-100%)
     *   2: BassGain  (0-1, 0-100%)
     *   3: BassFreq  (0-1, 1-50)
     *   4: MidGain   (0-1, 0-100%)
     *   5: MidQ      (0-1, 1-50)
     *   6: HiGain    (0-1, 0-100%)
     *   7: HiFreq    (0-1, 1-50)
     *   8: Solo      (0=OFF, 1=ON)
     */
    class FXEnhancer : public FXBase
    {
    public:
        FXEnhancer();
        ~FXEnhancer() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 9; }
        juce::String getEffectName() const override { return "Enhancer"; }

    private:
        abd::dsp::DspEnhancer engine;
    };
}
