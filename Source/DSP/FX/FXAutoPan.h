#pragma once

#include "FXBase.h"
#include <DspEffects/DspAutoPan.h>

namespace ABD
{
    /**
     * @brief FXAutoPan: Efecto Auto Pan / Tremolo modulado con envelope follower interactivo.
     *
     * HARDWARE EMULADO:
     *   - Efecto Auto Pan / Tremolo clásico (DeepMind 12 FX Type 20), inspirado en los
     *     circuitos de trémolo optoelectrónico y paneo estéreo de amplificadores Fender
     *     y pianos Rhodes Suitcase.
     *   - Parámetros:
     *     * Speed: Frecuencia de modulación (0.05 Hz a 5.0 Hz).
     *     * Phase: Desfase estéreo entre canales (0° a 180°).
     *     * Wave: Forma de onda suave continua (Triangular -> Sinusoidal -> Cuadrada).
     *     * Depth: Profundidad de modulación (0 a 100%).
     *     * EnvSpd: Modulación dinámica de la velocidad LFO por la amplitud de la señal entrante.
     *     * EnvDepth: Modulación dinámica de la profundidad por la envolvente.
     *     * Attack / Release: Balística temporal del seguidor de envolvente.
     *
     * DIAGNÓSTICO DE FIDELIDAD ACTUAL:
     *   - Motor subyacente delegado en `abd::dsp::DspAutoPan` (100% RT-Safe, C++20 puro).
     *   - Paneo sinusoidal/cosenoidal equal-power para preservación de potencia acústica.
     *
     * LÍNEAS DE INVESTIGACIÓN PENDIENTES:
     *   - Modos adicionales de paneo lineal o balance estéreo personalizado.
     *   - Sincronización MIDI Clock / BPM para tempo-synced chopping.
     */
    class FXAutoPan : public FXBase
    {
    public:
        FXAutoPan();
        ~FXAutoPan() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 9; }
        juce::String getEffectName() const override { return "Auto Pan"; }

    private:
        abd::dsp::DspAutoPan engine_;
    };
}
