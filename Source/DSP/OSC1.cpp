#include "OSC1.h"
#include <cmath>
#include <algorithm>

namespace ABD
{
    OSC1::OSC1() {}

    void OSC1::prepare(double sampleRate)
    {
        currentSampleRate = sampleRate;
        phase = 0.0;
    }

    void OSC1::setFrequency(double hz)
    {
        baseFrequency = hz;
    }

    void OSC1::setModulationValue(int destination, float value)
    {
        if (destination == kPitchMod)
        {
            pitchModValue = value; // Semitonos de modulación de tono
        }
        else if (destination == kPWM)
        {
            pwmModValue = std::max(0.01f, std::min(value, 0.99f));
        }
    }

    void OSC1::setSawActive(bool active)
    {
        sawActive = active;
    }

    void OSC1::setSquareActive(bool active)
    {
        squareActive = active;
    }

    float OSC1::nextSample()
    {
        if (currentSampleRate <= 0.0) return 0.0f;

        double modHz = baseFrequency * std::pow(2.0, pitchModValue / 12.0);
        double phaseIncrement = modHz / currentSampleRate;
        phase += phaseIncrement;
        if (phase >= 1.0)
            phase -= 1.0;

        float outSample = 0.0f;

        if (sawActive)
        {
            outSample += static_cast<float>(2.0 * phase - 1.0);
        }

        if (squareActive)
        {
            double pulseWidth = 0.5 + (pwmModValue - 0.5) * 0.9;
            float sqVal = (phase < pulseWidth) ? 1.0f : -1.0f;
            outSample += sqVal;
        }

        if (sawActive && squareActive)
        {
            outSample *= 0.5f;
        }

        return outSample;
    }
}
