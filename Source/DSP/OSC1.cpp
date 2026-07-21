#include "OSC1.h"
#include "DSPHelpers.h"
#include <cmath>
#include <algorithm>

namespace ABD
{
    OSC1::OSC1() {}

    void OSC1::prepare(double sampleRate)
    {
        currentSampleRate = sampleRate;
        phase = 0.0;
        phaseInc = 0.0;
        currentPwmDuty = 0.5;
    }

    void OSC1::setFrequency(double hz)
    {
        baseFrequency = hz;
    }

    void OSC1::setModulationValue(int destination, float value)
    {
        if (destination == kPitchMod)
        {
            pitchModValue = value;
        }
        else if (destination == kPWM)
        {
            pwmModValue = value;
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

        // --- Phase advance ---
        double modHz = baseFrequency * std::pow(2.0, pitchModValue / 12.0);
        double dt = modHz / currentSampleRate;
        phase += dt;
        bool phaseWrapped = (phase >= 1.0);
        if (phaseWrapped)
            phase -= 1.0;

        phaseInc = dt;

        float outSample = 0.0f;

        // --- Sawtooth with curvature + PolyBLEP ---
        if (sawActive)
        {
            float pos = DSP::sawCurvature(static_cast<float>(phase), sawCurve);
            float saw = 2.0f * pos - 1.0f;

            // PolyBLEP correction at phase wrap (saw jumps from +1 to -1, step = -2)
            if (phaseWrapped)
                saw -= DSP::polyBlep2(static_cast<float>(phase), static_cast<float>(dt));

            outSample += saw;
        }

        // --- Pulse with PWM + slew limiting + PolyBLEP at both edges ---
        if (squareActive)
        {
            // Map PWM modulation [0..1] to duty cycle with reduced range
            // At 0.5 center: 50% duty; at 0/1: ~5.5%/94.5% duty
            float targetDuty = 0.5f + (pwmModValue - 0.5f) * 0.89f;
            targetDuty = std::clamp(targetDuty, 0.055f, 0.945f);

            // Slew limit to smooth PWM transitions (prevents clicks)
            currentPwmDuty = DSP::slewLimit(currentPwmDuty, targetDuty, 0.1f);

            // Bipolar pulse wave
            float pulse = (phase < currentPwmDuty) ? 1.0f : -1.0f;

            // PolyBLEP correction at phase wrap
            if (phaseWrapped)
            {
                float blepAtReset = DSP::polyBlep2(static_cast<float>(phase), static_cast<float>(dt));
                pulse += blepAtReset;  // add because phase jumped down, edge is positive
            }

            // PolyBLEP correction at duty cycle edge (phase crosses currentPwmDuty)
            float distFromEdge = static_cast<float>(phase) - currentPwmDuty;
            if (distFromEdge < 0.0f)
                distFromEdge += 1.0f;
            pulse += DSP::polyBlep2(distFromEdge, static_cast<float>(dt));

            outSample += pulse;
        }

        // --- Halve level if both waveforms active (matches original scaling) ---
        if (sawActive && squareActive)
        {
            outSample *= 0.5f;
        }

        return outSample;
    }
}
