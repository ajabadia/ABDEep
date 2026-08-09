#include "FXOversamplingDistortion.h"
#include <cmath>
#include <algorithm>

namespace ABD
{

FXOversamplingDistortion::FXOversamplingDistortion()
{
    reset();
}

void FXOversamplingDistortion::prepare(double sr, int samplesPerBlock)
{
    sampleRate = std::max(1.0, sr);
    internalBufSize = samplesPerBlock * kOversample + 16;
    upBufL.resize(internalBufSize, 0.0f);
    upBufR.resize(internalBufSize, 0.0f);
    downBufL.resize(internalBufSize / kOversample + 4, 0.0f);
    downBufR.resize(internalBufSize / kOversample + 4, 0.0f);
    firL.resize(kFirLen, 0.0f);
    firR.resize(kFirLen, 0.0f);
    reset();
}

void FXOversamplingDistortion::reset()
{
    std::fill(upBufL.begin(), upBufL.end(), 0.0f);
    std::fill(upBufR.begin(), upBufR.end(), 0.0f);
    std::fill(firL.begin(), firL.end(), 0.0f);
    std::fill(firR.begin(), firR.end(), 0.0f);
    toneL = toneR = 0.0f;
}

float FXOversamplingDistortion::waveshape(float x) const
{
    // Asymmetric waveshaper: soft clip + odd harmonics
    float g = 1.0f + drive * 8.0f;
    float shaped = std::tanh(x * g);
    // Add subtle asymmetry for even harmonics
    shaped += 0.1f * drive * shaped * shaped * shaped;
    return shaped / (1.0f + 0.1f * drive);
}

void FXOversamplingDistortion::processInternal(float* buf, int n)
{
    for (int i = 0; i < n; ++i)
        buf[i] = waveshape(buf[i]);
}

void FXOversamplingDistortion::process(const float* inL, const float* inR,
                                        float* outL, float* outR,
                                        int numSamples)
{
    // Simple linear upsample, waveshape, FIR downsample
    for (int i = 0; i < numSamples; ++i)
    {
        // Upsample: repeat sample 4x (zero-order hold)
        for (int j = 0; j < kOversample; ++j)
            upBufL[i * kOversample + j] = inL[i];
        for (int j = 0; j < kOversample; ++j)
            upBufR[i * kOversample + j] = inR[i];
    }

    int totalUp = numSamples * kOversample;

    // Apply waveshaping with stereo width
    float widthL = 1.0f + stereo * 0.3f;
    float widthR = 1.0f - stereo * 0.3f;
    for (int i = 0; i < totalUp; ++i)
    {
        upBufL[i] = waveshape(upBufL[i] * widthL) / widthL;
        upBufR[i] = waveshape(upBufR[i] * widthR) / widthR;
    }

    // Downsample with simple anti-alias FIR (5-tap average for simplicity)
    for (int i = 0; i < numSamples; ++i)
    {
        int base = i * kOversample;
        float accL = 0.0f, accR = 0.0f;
        for (int j = 0; j < kOversample; ++j)
        {
            float w = 0.5f + 0.5f * std::cos(3.14159265f * (float)j / (float)kOversample);
            accL += upBufL[base + j] * w;
            accR += upBufR[base + j] * w;
        }
        downBufL[i] = accL / (float)kOversample;
        downBufR[i] = accR / (float)kOversample;
    }

    // Tone shaping (simple one-pole LP)
    float toneCoeff = 0.1f + tone * 0.8f;
    for (int i = 0; i < numSamples; ++i)
    {
        toneL += toneCoeff * (downBufL[i] - toneL);
        toneR += toneCoeff * (downBufR[i] - toneR);
        float wetL = toneL * level;
        float wetR = toneR * level;
        outL[i] = inL[i] * (1.0f - mix) + wetL * mix;
        outR[i] = inR[i] * (1.0f - mix) + wetR * mix;
    }
}

void FXOversamplingDistortion::setParameter(int index, float value)
{
    switch (index)
    {
        case 0: drive = value; break;
        case 1: tone = value; break;
        case 2: mix = value; break;
        case 3: level = value; break;
        case 4: stereo = value; break;
        default: break;
    }
}

} // namespace ABD
