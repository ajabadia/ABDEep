#pragma once

#include "FXBase.h"
#include <DspEffects/DspPatternFreeze.h>

namespace ABD
{
    /**
     * @brief FXPatternFreeze: Buffer capture and freeze effect.
     *
     * ==============================================================================
     * DOCUMENTACIÓN DE HARDWARE Y FIDELIDAD DSP:
     * ==============================================================================
     * 1. HARDWARE EMULADO:
     *    - Procesador de congelación y bucle de audio infinito
     *      (DeepMind 12 Type 43 / Electro-Harmonix Freeze / Strymon Nightsky Freeze).
     *    - Búfer circular de captura de longitud configurable (200 ms a 4000 ms).
     *    - Realimentación regenerativa continua con adición de dither analógico.
     *    - Crossfade automático y suave en el punto de ciclado del bucle.
     *
     * 2. DIAGNÓSTICO DE FIDELIDAD:
     *    - Totalmente desacoplado en el motor puro `abd::dsp::DspPatternFreeze` (C++20, 100% RT-Safe).
     *
     * 3. LÍNEAS DE INVESTIGACIÓN PENDIENTES:
     *    - Añadir opciones de reproducción invertida (reverse playback) y semitonos de transposición.
     *    - Integrar filtrado tilt en el lazo de regeneración para simular pérdidas espectrales de cinta.
     * ==============================================================================
     *
     * Parameters:
     *   0: Mix        (0-1, dry/wet mix)
     *   1: Length     (0-1, freeze buffer length 200ms-4000ms)
     *   2: Feedback   (0-1, how much new audio feeds into buffer)
     *   3: Regenerate (0-1, crossfade rate for regeneration)
     */
    class FXPatternFreeze : public FXBase
    {
    public:
        FXPatternFreeze();
        ~FXPatternFreeze() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 4; }
        juce::String getEffectName() const override { return "Pattern Freeze"; }

    private:
        abd::dsp::DspPatternFreeze engine;
    };
}
