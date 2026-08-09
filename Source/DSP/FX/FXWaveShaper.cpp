#include "FXWaveShaper.h"
#include <cmath>
#include <algorithm>

namespace ABD
{

FXWaveShaper::FXWaveShaper()
{
    reset();
}

void FXWaveShaper::prepare(double sr, int /*samplesPerBlock*/)
{
    sampleRate = std::max(1.0, sr);
    reset();
}

void FXWaveShaper::reset()
{
    toneL = toneR = 0.0f;
}

float FXWaveShaper::transfer(float x) const
{
    float g = 1.0f + gainParam * 12.0f;
    float y = x * g;

    // Interpolate between transfer function families based on shape
    // shape 0-0.33: soft clip, 0.33-0.66: fold, 0.66-1.0: sin-based
    float softClip = std::tanh(y);
    float fold = 2.0f * std::abs(2.0f * (y * 0.5f - std::floor(y * 0.5f + 0.5f))) - 1.0f;
    float sinBased = std::sin(y * 1.5707963f); // sin(pi/2 * y)

    float result;
    if (shape < 0.33f)
    {
        float t = shape / 0.33f;
        result = softClip * (1.0f - t) + fold * t;
    }
    else if (shape < 0.66f)
    {
        float t = (shape - 0.33f) / 0.33f;
        result = fold * (1.0f - t) + sinBased * t;
    }
    else
    {
        result = sinBased;
    }

    // Apply symmetry (even/odd harmonic balance)
    float sym = symmetry * 2.0f - 1.0f; // -1..+1
    if (sym > 0.0f)
        result += sym * result * result; // more even harmonics
    else
        result -= (-sym) * result * result * result; // more odd harmonics

    return result / (1.0f + gainParam * 0.5f); // compensate gain
}

void FXWaveShaper::process(const float* inL, const float* inR,
                            float* outL, float* outR,
                            int numSamples)
{
    float toneCoeff = 0.05f + toneParam * 0.85f;

    for (int i = 0; i < numSamples; ++i)
    {
        float wetL = transfer(inL[i]);
        float wetR = transfer(inR[i]);

        // Tone filter
        toneL += toneCoeff * (wetL - toneL);
        toneR += toneCoeff * (wetR - toneR);

        outL[i] = inL[i] * (1.0f - mix) + toneL * mix;
        outR[i] = inR[i] * (1.0f - mix) + toneR * mix;
    }
}

void FXWaveShaper::setParameter(int index, float value)
{
    switch (index)
    {
        case 0: shape = value; break;
        case 1: symmetry = value; break;
        case 2: gainParam = value; break;
        case 3: toneParam = value; break;
        case 4: mix = value; break;
        default: break;
    }
}

} // namespace ABD
