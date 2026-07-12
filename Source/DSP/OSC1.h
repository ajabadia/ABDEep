#pragma once

#include "Oscillator.h"

namespace ABD
{
    /**
     * OSC1: Generador simultáneo de Sierra y Pulso con PWM (Estilo Classic DeepMind).
     */
    class OSC1 : public Oscillator
    {
    public:
        OSC1();
        ~OSC1() override = default;

        void prepare(double sampleRate) override;
        void setFrequency(double hz) override;
        void setModulationValue(int destination, float value) override;

        void setSawActive(bool active);
        void setSquareActive(bool active);

        float nextSample() override;
        void resetPhase() override { phase = 0.0; }
        double getPhase() const override { return phase; }

    private:
        double currentSampleRate = 44100.0;
        double baseFrequency = 440.0;
        double phase = 0.0;

        float pitchModValue = 0.0f;
        float pwmModValue = 0.5f;

        bool sawActive = true;
        bool squareActive = false;
    };
}
