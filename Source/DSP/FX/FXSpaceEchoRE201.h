#pragma once

#include "FXBase.h"
#include "DspEffects/MultiHeadEcho.h"
#include "DspEffects/profiles/Dm12SpaceEchoProfile.h"
#include "DspEffects/characters/TapeColour.h"

namespace ABD
{
    /**
     * FXSpaceEchoRE201: Envoltorio de política sobre el eco de cinta multicabezal compartido.
     *
     * ==============================================================================
     * EMULACIÓN HARDWARE:
     *   Roland Space Echo RE-201 (1974) con tanque de reverb de muelles.
     *   El motor de transporte de cinta y lectura multicabezal reside en `abd::dsp::MultiHeadEcho`
     *   (ABDSharedCode/DspEffects/MultiHeadEcho.h), la saturación magnética y siseo en
     *   `abd::dsp::TapeColour` (ABDSharedCode/DspEffects/characters/TapeColour.h),
     *   y el perfil de modos del DeepMind en `abd::dsp::Dm12SpaceEchoProfile`
     *   (ABDSharedCode/DspEffects/profiles/Dm12SpaceEchoProfile.h).
     *
     * CARACTERÍSTICAS DE LA IMPLEMENTACIÓN:
     *   - 3 cabezales de reproducción virtuales sobre una línea de cinta continua.
     *   - 5 modos rítmicos de combinación de cabezales (A=Cabezal 1 solo, B=1+2, C=1+3, D=2+3, E=1+2+3).
     *   - Tanque de reverberación de muelles estéreo (tiempos de dispersión 80ms L / 110ms R).
     *   - Deriva mecánica de motor: Wow lento a 0.5 Hz y Flutter rápido a 8.0 Hz.
     *   - Control de tono analógico mediante filtrado de absorción de cinta.
     *
     * PARÁMETROS DEL HARDWARE (DeepMind 12 FX Type 39):
     *   0: Mode     (0-1 -> Modos A, B, C, D, E)
     *   1: Time     (0-1 -> Retardo base 120 ms a 1500 ms escalado)
     *   2: Feedback (0-1 -> Realimentación con saturación no lineal)
     *   3: Bass     (0-1 -> Control de graves)
     *   4: Treble   (0-1 -> Control de agudos)
     *   5: Reverb   (0-1 -> Nivel del tanque de muelles)
     *
     * INVESTIGACIÓN PENDIENTE PARA ELEVAR FIDELIDAD:
     *   - Modelar el "splice bump" (el golpe sutil periódico cuando el empalme físico
     *     de la cinta pasa por el cabezal de reproducción, típicamente cada 3-4 segundos).
     *   - Reemplazar el tanque de muelles biquad simple por un modelo físico de muelles
     *     helicoidales acoplados con dispersión tipo chirp.
     *   - Proporcionar opción de conmutar al perfil `Re201Profile` con los 12 modos
     *     originales del selector físico del hardware Roland de 1974.
     * ==============================================================================
     */
    class FXSpaceEchoRE201 : public FXBase
    {
    public:
        FXSpaceEchoRE201();
        ~FXSpaceEchoRE201() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 6; }
        juce::String getEffectName() const override { return "Space Echo RE-201"; }

    private:
        abd::dsp::MultiHeadEcho<abd::dsp::Dm12SpaceEchoProfile, abd::dsp::TapeColour> echo;

        float paramMode = 0.0f;
        float paramTime = 0.4f;
        float paramFeedback = 0.4f;
        float paramBass = 0.5f;
        float paramTreble = 0.5f;
        float paramReverb = 0.3f;
    };
}
