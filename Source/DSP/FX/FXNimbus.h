#pragma once

#include "FXBase.h"
#include <DspEffects/DspNimbus.h>

namespace ABD
{
    /**
     * @brief FXNimbus: Hybrid granular delay/reverb processor.
     *
     * ==============================================================================
     * DOCUMENTACIÓN DE HARDWARE Y FIDELIDAD DSP:
     * ==============================================================================
     * 1. HARDWARE EMULADO:
     *    - Procesador de nube granular y textura espacial
     *      (DeepMind 12 Type 54 / Mutable Instruments Clouds / Surge Nimbus).
     *    - Generador de hasta 16 granos simultáneos con dispersión espacial en el estéreo.
     *    - Transposición tonal independiente de los granos (0.5x a 2.0x, -1 a +1 octava).
     *    - Ventanas de amplitud de coseno alzado para superposición suave de granos.
     *    - Lazo de realimentación no lineal saturado en el búfer circular.
     *
     * 2. DIAGNÓSTICO DE FIDELIDAD:
     *    - Totalmente desacoplado en el motor puro `abd::dsp::DspNimbus` (C++20, 100% RT-Safe).
     *
     * 3. LÍNEAS DE INVESTIGACIÓN PENDIENTES:
     *    - Agregar modos de difusión reverb tipo Schroeder integrados post-granular.
     *    - Implementar cuantización de pitch a escalas armónicas o semitonos temperados.
     * ==============================================================================
     *
     * Parameters:
     *   0: GrainSize (0-1, grain duration 20ms-200ms)
     *   1: Density   (0-1, grain overlap count)
     *   2: Feedback  (0-1, recirculation amount)
     *   3: Pitch     (0-1, grain pitch shift 0.5x-2x)
     *   4: Mix       (0-1, dry/wet mix)
     */
    class FXNimbus : public FXBase
    {
    public:
        FXNimbus();
        ~FXNimbus() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 5; }
        juce::String getEffectName() const override { return "Nimbus"; }

    private:
        abd::dsp::DspNimbus engine;
    };
}
