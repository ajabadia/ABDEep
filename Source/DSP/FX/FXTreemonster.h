#pragma once

#include "FXBase.h"
#include <DspEffects/DspTreemonster.h>

namespace ABD
{
    /**
     * @brief FXTreemonster: Pitch-tracking modulation processor.
     *
     * ==============================================================================
     * DOCUMENTACIÓN DE HARDWARE Y FIDELIDAD DSP:
     * ==============================================================================
     * 1. HARDWARE EMULADO:
     *    - Procesador de retardo modulado por seguimiento de tono
     *      (DeepMind 12 Type 56 / Korg MS-20 ESP / Surge Treemonster).
     *    - Detector de cruces por cero en tiempo real con filtro paso bajo de histéresis
     *      y cálculo continuo de confianza del tono detectado.
     *    - Conmutación automática: modulación con oscilador sintonizado al tono analizado
     *      cuando la confianza supera 0.3, o repliegue fluido a LFO sinusoidal convencional.
     *    - Línea de retardo continuo fraccional (5 ms a 105 ms).
     *    - Lazo de realimentación con saturación no lineal suave (tanh).
     *
     * 2. DIAGNÓSTICO DE FIDELIDAD:
     *    - Totalmente desacoplado en el motor puro `abd::dsp::DspTreemonster` (C++20, 100% RT-Safe).
     *
     * 3. LÍNEAS DE INVESTIGACIÓN PENDIENTES:
     *    - Incorporar detector de tono basado en autocorrelación (YIN) o transformada Wavelet
     *      para mayor robustez frente a fuentes polifónicas complejas.
     *    - Permitir cuantización de la modulación a intervalos musicales (quintas, octavas).
     * ==============================================================================
     *
     * Parameters:
     *   0: Speed    (0-1, modulation rate when tracking fails)
     *   1: Depth    (0-1, modulation depth)
     *   2: Feedback (0-1, delay feedback)
     *   3: Tracking (0-1, pitch tracking sensitivity)
     *   4: Mix      (0-1, dry/wet mix)
     */
    class FXTreemonster : public FXBase
    {
    public:
        FXTreemonster();
        ~FXTreemonster() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 5; }
        juce::String getEffectName() const override { return "Treemonster"; }

    private:
        abd::dsp::DspTreemonster engine;
    };
}
