#include "FXResonator.h"

namespace ABD
{

FXResonator::FXResonator()
{
    reset();
}

void FXResonator::prepare(double sr, int /*samplesPerBlock*/)
{
    sampleRate = sr;
    reset();
}

void FXResonator::reset()
{
    for (int i = 0; i < kNumResonators; ++i)
    {
        resonatorsL[i] = ResonatorState();
        resonatorsR[i] = ResonatorState();
    }
}

float FXResonator::exponentialMap(float normalized, float minHz, float maxHz)
{
    return minHz * std::pow(maxHz / minHz, normalized);
}

void FXResonator::updateResonator(ResonatorState& res, float freq, float q, float damping)
{
    // Clamp frequency to Nyquist/2
    float nyq = static_cast<float>(sampleRate) * 0.5f;
    if (freq >= nyq) freq = nyq * 0.95f;
    if (freq < 1.0f) freq = 1.0f;

    float w0 = 6.283185f * freq / static_cast<float>(sampleRate);
    float alpha = std::sin(w0) / (2.0f * q);

    // Bandpass filter coefficients
    float cosw0 = std::cos(w0);
    float a0 = 1.0f + alpha;
    res.b0 = alpha / a0;
    res.b1 = 0.0f;
    res.b2 = -alpha / a0;
    res.a1 = -2.0f * cosw0 / a0;
    res.a2 = (1.0f - alpha) / a0;

    // Apply damping (one-pole lowpass on feedback)
    float dampingCoeff = 1.0f - damping * 0.99f;
    res.a1 *= dampingCoeff;

    res.freq = freq;
}

void FXResonator::process(const float* inL, const float* inR,
                            float* outL, float* outR,
                            int numSamples)
{
    float mix = paramMix;
    float baseFreq = exponentialMap(paramFrequency, 50.0f, 5000.0f);
    float q = 1.0f + paramResonance * 49.0f;
    float damping = paramDamping;
    float mode = paramMode;

    // Compute harmonic ratios based on mode
    float ratios[kNumResonators];
    for (int i = 0; i < kNumResonators; ++i)
    {
        float n = static_cast<float>(i + 1);
        if (mode < 0.33f)
        {
            // Harmonic: 1, 2, 3, 4, ...
            ratios[i] = n;
        }
        else if (mode < 0.66f)
        {
            // Inharmonic: bell-like ratios
            static const float bellRatios[] = { 1.0f, 2.4f, 3.76f, 5.12f, 6.8f, 8.3f, 10.6f, 12.9f };
            ratios[i] = bellRatios[i];
        }
        else
        {
            // Stretched: harmonic with inharmonicity factor
            float B = 0.01f * paramResonance;
            ratios[i] = n * std::sqrt(1.0f + B * n * n);
        }
    }

    // Update filter coefficients
    for (int i = 0; i < kNumResonators; ++i)
    {
        float freq = baseFreq * ratios[i];
        updateResonator(resonatorsL[i], freq, q, damping);
        updateResonator(resonatorsR[i], freq, q, damping);
    }

    // Process
    for (int s = 0; s < numSamples; ++s)
    {
        float dryL = inL[s];
        float dryR = inR[s];

        float wetL = 0.0f;
        float wetR = 0.0f;
        float gain = 1.0f / static_cast<float>(kNumResonators);

        for (int i = 0; i < kNumResonators; ++i)
        {
            auto processBiquad = [&](ResonatorState& res, float input) -> float
            {
                float y = res.b0 * input + res.b1 * res.x1 + res.b2 * res.x2
                        - res.a1 * res.y1 - res.a2 * res.y2;
                res.x2 = res.x1;
                res.x1 = input;
                res.y2 = res.y1;
                res.y1 = y;
                return y;
            };

            wetL += processBiquad(resonatorsL[i], dryL) * gain;
            wetR += processBiquad(resonatorsR[i], dryR) * gain;
        }

        outL[s] = dryL + (wetL - dryL) * mix;
        outR[s] = dryR + (wetR - dryR) * mix;
    }
}

void FXResonator::setParameter(int index, float value)
{
    switch (index)
    {
        case 0: paramMix = value; break;
        case 1: paramFrequency = value; break;
        case 2: paramResonance = value; break;
        case 3: paramDamping = value; break;
        case 4: paramMode = value; break;
        default: break;
    }
}

} // namespace ABD
