#include "FXRingModulator.h"
#include <cmath>

namespace ABD
{
    FXRingModulator::FXRingModulator()
    {
        reset();
    }

    void FXRingModulator::prepare(double sr, int /*samplesPerBlock*/)
    {
        sampleRate = sr;
        reset();
    }

    void FXRingModulator::reset()
    {
        paramFreq = 0.5f;
        paramLFORate = 0.3f;
        paramLFODepth = 0.4f;
        paramWaveform = 0.0f;
        paramMix = 0.5f;

        oscPhase = 0.0f;
        lfoPhase = 0.0f;
        currentFreq = 440.0f;

        // Init LFO increment
        float lfoHz = 0.1f + 9.9f * paramLFORate;
        lfoInc = (float)(2.0 * 3.14159265 * lfoHz / sampleRate);

        // Init osc increment
        float freqHz = 20.0f * powf(400.0f, paramFreq);
        oscInc = (float)(2.0 * 3.14159265 * freqHz / sampleRate);
    }

    void FXRingModulator::setParameter(int index, float value)
    {
        float clamped = juce::jlimit(0.0f, 1.0f, value);
        switch (index)
        {
            case 0:
                paramFreq = clamped;
                break;
            case 1:
                paramLFORate = clamped;
                lfoInc = (float)(2.0 * 3.14159265 * (0.1 + 9.9 * clamped) / sampleRate);
                break;
            case 2: paramLFODepth = clamped; break;
            case 3: paramWaveform = clamped; break;
            case 4: paramMix = clamped; break;
            default: break;
        }
    }

    float FXRingModulator::computeOscillator(float phase, float waveform) const
    {
        // Waveform: 0-0.33=sine, 0.33-0.66=saw, 0.66-1=square
        float normPhase = phase - floorf(phase); // 0..1

        if (waveform < 0.33f)
        {
            // Sine
            return sinf(phase);
        }
        else if (waveform < 0.66f)
        {
            // Saw: -1 to +1
            return normPhase * 2.0f - 1.0f;
        }
        else
        {
            // Square
            return normPhase < 0.5f ? 1.0f : -1.0f;
        }
    }

    float FXRingModulator::diodeBridge(float input) const
    {
        // Simplified diode bridge: soft clip with asymmetric transfer
        // Modeled as tanh with drive and threshold
        float driven = input * kDiodeDrive;
        float sign = (driven >= 0.0f) ? 1.0f : -1.0f;
        float absVal = fabsf(driven);
        // Soft knee above threshold
        float output;
        if (absVal < kDiodeThreshold)
        {
            output = driven;
        }
        else
        {
            float excess = absVal - kDiodeThreshold;
            float compressed = kDiodeThreshold + tanhf(excess * 2.0f) * (1.0f - kDiodeThreshold);
            output = sign * compressed;
        }
        return output;
    }

    void FXRingModulator::process(const float* inL, const float* inR,
                                   float* outL, float* outR,
                                   int numSamples)
    {
        // Recalc osc increment from param (in case freq param changed)
        float freqHz = 20.0f * powf(400.0f, paramFreq);
        float baseOscInc = (float)(2.0 * 3.14159265 * freqHz / sampleRate);

        for (int s = 0; s < numSamples; ++s)
        {
            float dryL = inL[s];
            float dryR = inR[s];

            // LFO modulation of oscillator frequency
            lfoPhase += lfoInc;
            if (lfoPhase > 2.0f * 3.14159265f)
                lfoPhase -= 2.0f * 3.14159265f;
            float lfoVal = sinf(lfoPhase);

            // Modulated frequency
            float modulatedInc = baseOscInc * (1.0f + lfoVal * paramLFODepth);
            if (modulatedInc < 0.0f)
                modulatedInc = 0.0f;

            // Ring modulation: multiply input by oscillator
            float modSignal = computeOscillator(oscPhase, paramWaveform);

            // Apply through diode bridge
            float modulatedL = dryL * modSignal;
            float modulatedR = dryR * modSignal;
            modulatedL = diodeBridge(modulatedL);
            modulatedR = diodeBridge(modulatedR);

            // Advance oscillator
            oscPhase += modulatedInc;
            if (oscPhase > 2.0f * 3.14159265f * 1000.0f) // Prevent precision loss
                oscPhase -= 2.0f * 3.14159265f * 1000.0f;

            // Mix
            outL[s] = dryL * (1.0f - paramMix) + modulatedL * paramMix;
            outR[s] = dryR * (1.0f - paramMix) + modulatedR * paramMix;
        }
    }
}