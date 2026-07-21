#pragma once

#include "Oscillator.h"

namespace ABD
{
    /**
     * OSC2: Square/Pulse wave with Tone Mod (DeepMind Classic style).
     *
     * Improvements over original:
     *   - PolyBLEP anti-aliasing on both square wave edges
     *   - Slew-limited duty cycle to prevent clicks on Tone Mod changes
     *   - Improved tone modulation: soft saturation replaces naive tanh waveshaping
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
        double phaseInc = 0.0;

        float pitchModValue = 0.0f;
        float toneModValue = 0.0f;
        float currentDuty = 0.5f;       // slew-limited duty cycle
    };
}
