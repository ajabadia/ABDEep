#include "OSC2.h"
#include <cmath>
#include <algorithm>

namespace ABD
{
    OSC2::OSC2() {}

    void OSC2::prepare(double sampleRate)
    {
        currentSampleRate = sampleRate;
        phase = 0.0;
    }

    void OSC2::setFrequency(double hz)
    {
        baseFrequency = hz;
    }

    void OSC2::setModulationValue(int destination, float value)
    {
        if (destination == kPitchMod)
        {
            pitchModValue = value;
        }
        else if (destination == kToneMod)
        {
            toneModValue = std::max(0.0f, std::min(value, 1.0f));
        }
    }

    float OSC2::nextSample()
    {
        if (currentSampleRate <= 0.0) return 0.0f;

        double modHz = baseFrequency * std::pow(2.0, pitchModValue / 12.0);
        double phaseIncrement = modHz / currentSampleRate;
        phase += phaseIncrement;
        if (phase >= 1.0)
            phase -= 1.0;

        double dutyCycle = 0.5 + toneModValue * 0.45;
        float outSample = (phase < dutyCycle) ? 1.0f : -1.0f;

        if (toneModValue > 0.01f)
        {
            float drive = 1.0f + toneModValue * 2.0f;
            outSample = std::tanh(outSample * drive);
        }

        return outSample;
    }
}
