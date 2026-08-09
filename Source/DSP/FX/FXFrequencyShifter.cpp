#include "FXFrequencyShifter.h"

namespace ABD
{

FXFrequencyShifter::FXFrequencyShifter()
{
    reset();
}

void FXFrequencyShifter::prepare(double sr, int /*samplesPerBlock*/)
{
    sampleRate = sr;
    reset();
}

void FXFrequencyShifter::reset()
{
    oscPhase = 0.0f;
    lfoPhase = 0.0f;
    fbL = 0.0f;
    fbR = 0.0f;
    hilbertPos = 0;
    std::fill(hilbertBufL, hilbertBufL + kHilbertLen, 0.0f);
    std::fill(hilbertBufR, hilbertBufR + kHilbertLen, 0.0f);
}

float FXFrequencyShifter::hilbertShift(float input, float* buf)
{
    // Simple FIR Hilbert approximation (90-degree phase allpass)
    // Coefficients for 15-tap Hilbert
    static const float coeffs[kHilbertLen] = {
        -0.0124f, 0.0f, 0.0456f, 0.0f, -0.1327f,
        0.0f, 0.6184f, 0.0f, -0.6184f,
        0.0f, 0.1327f, 0.0f, -0.0456f,
        0.0f, 0.0124f
    };

    buf[hilbertPos] = input;
    float output = 0.0f;
    for (int j = 0; j < kHilbertLen; ++j)
    {
        int idx = (hilbertPos - j + kHilbertLen * 2) % kHilbertLen;
        output += buf[idx] * coeffs[j];
    }
    hilbertPos = (hilbertPos + 1) % kHilbertLen;
    return output;
}

void FXFrequencyShifter::process(const float* inL, const float* inR,
                                   float* outL, float* outR,
                                   int numSamples)
{
    float mix = paramMix;
    float lfoRate = paramLFORate * 9.9f + 0.1f;
    float lfoDepth = paramLFODepth;
    float feedback = paramFeedback;

    float baseShift = (paramShift - 0.5f) * 4000.0f;

    float lfoInc = lfoRate / static_cast<float>(sampleRate);

    for (int i = 0; i < numSamples; ++i)
    {
        float dryL = inL[i];
        float dryR = inR[i];

        // LFO modulates shift
        float lfoVal = std::sin(lfoPhase * 6.283185f) * lfoDepth;
        float shiftHz = baseShift * (1.0f + lfoVal);
        lfoPhase += lfoInc;
        if (lfoPhase >= 1.0f) lfoPhase -= 1.0f;

        float oscInc = shiftHz / static_cast<float>(sampleRate);

        // Apply feedback (adds ringing character)
        float sigL = dryL + fbL * feedback;
        float sigR = dryR + fbR * feedback;

        // Hilbert transform to get analytic signal
        float hilbL = hilbertShift(sigL, hilbertBufL);
        float hilbR = hilbertShift(sigR, hilbertBufR);

        // Heterodyne: multiply by e^(j*2*pi*f*t)
        float cosPart = std::cos(oscPhase * 6.283185f);
        float sinPart = std::sin(oscPhase * 6.283185f);

        // SSB modulation: keep only one sideband
        float wetL = sigL * cosPart + hilbL * sinPart;
        float wetR = sigR * cosPart + hilbR * sinPart;

        // Store for feedback
        fbL = wetL;
        fbR = wetR;

        oscPhase += oscInc;
        if (oscPhase >= 1.0f) oscPhase -= 1.0f;

        outL[i] = dryL + (wetL - dryL) * mix;
        outR[i] = dryR + (wetR - dryR) * mix;
    }
}

void FXFrequencyShifter::setParameter(int index, float value)
{
    switch (index)
    {
        case 0: paramMix = value; break;
        case 1: paramShift = value; break;
        case 2: paramLFORate = value; break;
        case 3: paramLFODepth = value; break;
        case 4: paramFeedback = value; break;
        default: break;
    }
}

} // namespace ABD
