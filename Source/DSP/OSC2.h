#pragma once

#include "Oscillator.h"

namespace ABD
{
    /**
     * OSC2: Generador de onda cuadrada con Tone Mod (Estilo Classic DeepMind).
     */
    class OSC2 : public Oscillator
    {
    public:
        OSC2();
        ~OSC2() override = default;

        void prepare(double sampleRate) override;
        void setFrequency(double hz) override;
        void setModulationValue(int destination, float value) override;

        float nextSample() override;
        void resetPhase() override { phase = 0.0; }
        double getPhase() const override { return phase; }

    private:
        double currentSampleRate = 44100.0;
        double baseFrequency = 440.0;
        double phase = 0.0;

        float pitchModValue = 0.0f;
        float toneModValue = 0.0f;
    };
}
