#include "OSC2.h"
#include "DSPHelpers.h"
#include <cmath>
#include <algorithm>

namespace ABD
{
    OSC2::OSC2() {}

    void OSC2::prepare(double sampleRate)
    {
        currentSampleRate = sampleRate;
        phase = 0.0;
        phaseInc = 0.0;
        currentDuty = 0.5;
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

        // --- Phase advance ---
        double modHz = baseFrequency * std::pow(2.0, pitchModValue / 12.0);
        double dt = modHz / currentSampleRate;
        phase += dt;
        bool phaseWrapped = (phase >= 1.0);
        if (phaseWrapped)
            phase -= 1.0;

        phaseInc = dt;

        // --- Duty cycle with slew limiting (prevents clicks on Tone Mod changes) ---
        float targetDuty = 0.5f + toneModValue * 0.45f;
        targetDuty = std::clamp(targetDuty, 0.01f, 0.99f);
        currentDuty = DSP::slewLimit(currentDuty, targetDuty, 0.1f);

        // --- Generate square/pulse with PolyBLEP ---
        float square = (phase < currentDuty) ? 1.0f : -1.0f;
        float blepDt = static_cast<float>(dt);

        // PolyBLEP at phase wrap — RISING edge (-1 → +1)
        // polyBlep2 handles both sides: t≈0 (after wrap, +1 side) and t≈1 (before wrap, -1 side)
        square += DSP::polyBlep2(static_cast<float>(phase), blepDt);

        // PolyBLEP at duty edge — FALLING edge (+1 → -1), so subtract
        float distFromEdge = static_cast<float>(phase) - currentDuty;
        if (distFromEdge < 0.0f)
            distFromEdge += 1.0f;
        square -= DSP::polyBlep2(distFromEdge, blepDt);

        // --- Tone Mod: blend square → tanh-compressed triangle ---
        float outSample = square;

        if (toneModValue > 0.01f)
        {
            float tri = 1.0f - 2.0f * std::abs(static_cast<float>(phase) - 0.5f);
            float drive = 1.0f + toneModValue * 4.0f;
            float softClip = std::tanh(tri * drive);

            outSample = square * (1.0f - toneModValue) + softClip * toneModValue;
        }

        return outSample;
    }
}
