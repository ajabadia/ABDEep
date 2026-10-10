#pragma once

#include "FXBase.h"
#include <DspEffects/DspSpectralDelay.h>

namespace ABD
{
    /**
     * @brief FXSpectralDelay: Frequency-dispersive Multi-band Delay Processor.
     *
     * ==============================================================================
     * DOCUMENTACIÓN DE HARDWARE Y FIDELIDAD DSP:
     * ==============================================================================
     * 1. HARDWARE EMULADO:
     *    - Procesador de retardo espectral dispersivo
     *      (DeepMind 12 Type 45 / Eventide DSP7000 Band Delays / Soundtoys Crystallizer).
     *    - Distribuye la señal en múltiples bandas de retardo dispersivo (50 ms a 1500 ms).
     *    - Modulación de ancho de banda y fase para generar smearing espectral y difusión.
     *    - Saturación no lineal suave (tanh) en la ruta de realimentación.
     *
     * 2. DIAGNÓSTICO DE FIDELIDAD:
     *    - Totalmente desacoplado en el motor puro `abd::dsp::DspSpectralDelay` (C++20, 100% RT-Safe).
     *
     * 3. LÍNEAS DE INVESTIGACIÓN PENDIENTES:
     *    - Implementación alternativa con banco de filtros polifásicos WOLA / FFT directa para mayor resolución espectral.
     *    - Paneo estéreo independiente y desfase en cuadratura por cada banda espectral.
     * ==============================================================================
     *
     * Parameters:
     *   0: Mix      (0-1, dry/wet mix)
     *   1: Time     (0-1, delay time 50ms-1500ms)
     *   2: BandWidth(0-1, frequency band width 0=narrow 1=wide)
     *   3: Feedback (0-1, feedback amount)
     *   4: Diffusion(0-1, spread of delay times across bands)
     */
    class FXSpectralDelay : public FXBase
    {
    public:
        FXSpectralDelay();
        ~FXSpectralDelay() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 5; }
        juce::String getEffectName() const override { return "Spectral Delay"; }

    private:
        abd::dsp::DspSpectralDelay engine;
    };
}
