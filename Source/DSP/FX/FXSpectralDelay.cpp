#include "FXSpectralDelay.h"

namespace ABD
{

FXSpectralDelay::FXSpectralDelay()
{
    reset();
}

void FXSpectralDelay::prepare(double sr, int /*samplesPerBlock*/)
{
    sampleRate = sr;
    int bufSize = kFFTSize * 8;
    delayMask = bufSize - 1;
    delayBufL.resize(bufSize, 0.0f);
    delayBufR.resize(bufSize, 0.0f);
    bandGainsL.resize(kNumBands, 1.0f);
    bandGainsR.resize(kNumBands, 1.0f);
    bandGainsTargetL.resize(kNumBands, 1.0f);
    bandGainsTargetR.resize(kNumBands, 1.0f);
    accumL.resize(kFFTSize, 0.0f);
    accumR.resize(kFFTSize, 0.0f);
    reset();
}

void FXSpectralDelay::reset()
{
    writePos = 0;
    accumPos = 0;
    noiseSeed = 0xA1B2C3D4u;
    if (!delayBufL.empty())
    {
        std::fill(delayBufL.begin(), delayBufL.end(), 0.0f);
        std::fill(delayBufR.begin(), delayBufR.end(), 0.0f);
        std::fill(accumL.begin(), accumL.end(), 0.0f);
        std::fill(accumR.begin(), accumR.end(), 0.0f);
        std::fill(bandGainsL.begin(), bandGainsL.end(), 1.0f);
        std::fill(bandGainsR.begin(), bandGainsR.end(), 1.0f);
        std::fill(bandGainsTargetL.begin(), bandGainsTargetL.end(), 1.0f);
        std::fill(bandGainsTargetR.begin(), bandGainsTargetR.end(), 1.0f);
    }
}

float FXSpectralDelay::noiseGenerate()
{
    noiseSeed = noiseSeed * 1664525u + 1013904223u;
    return static_cast<float>(noiseSeed & 0xFFFF) / 65535.0f * 2.0f - 1.0f;
}

float FXSpectralDelay::delayForBand(int band) const
{
    float baseDelayMs = paramTime * 1450.0f + 50.0f;
    float diffusionSpread = paramDiffusion * baseDelayMs * 0.5f;
    float normBand = static_cast<float>(band) / static_cast<float>(kNumBands);
    float bandDelayMs = baseDelayMs + (normBand - 0.5f) * diffusionSpread;
    return bandDelayMs * 0.001f * static_cast<float>(sampleRate);
}

void FXSpectralDelay::process(const float* inL, const float* inR,
                                float* outL, float* outR,
                                int numSamples)
{
    const float mix = paramMix;
    const float feedback = paramFeedback;
    const float bw = paramBandWidth;

    for (int i = 0; i < numSamples; ++i)
    {
        float dryL = inL[i];
        float dryR = inR[i];

        // Write to delay buffer
        delayBufL[writePos] = dryL;
        delayBufR[writePos] = dryR;

        // Spectral processing: modulate band gains with diffusion
        int pos = writePos;
        float wetL = 0.0f;
        float wetR = 0.0f;

        // Simplified spectral delay: read from multiple delay taps with band-dependent gain
        int numTaps = 8;
        for (int tap = 0; tap < numTaps; ++tap)
        {
            float normTap = static_cast<float>(tap) / static_cast<float>(numTaps);
            float delaySamples = delayForBand(static_cast<int>(normTap * kNumBands));

            // Band-dependent modulation
            float bandPhase = normTap * 6.283185f;
            float bwMod = 1.0f - bw * 0.5f * (1.0f + std::sin(bandPhase + static_cast<float>(writePos) * 0.0001f));

            int readPos = (pos - static_cast<int>(delaySamples) + delayMask * 2) & delayMask;
            wetL += delayBufL[readPos] * bwMod * (1.0f / static_cast<float>(numTaps));
            wetR += delayBufR[readPos] * bwMod * (1.0f / static_cast<float>(numTaps));
        }

        // Apply feedback
        float fbL = wetL * feedback + dryL * (1.0f - feedback);
        float fbR = wetR * feedback + dryR * (1.0f - feedback);

        // Soft clip feedback
        fbL = std::tanh(fbL);
        fbR = std::tanh(fbR);

        delayBufL[(writePos + kFFTSize) & delayMask] = fbL;
        delayBufR[(writePos + kFFTSize) & delayMask] = fbR;

        outL[i] = dryL + (wetL - dryL) * mix;
        outR[i] = dryR + (wetR - dryR) * mix;

        writePos = (writePos + 1) & delayMask;
    }
}

void FXSpectralDelay::setParameter(int index, float value)
{
    switch (index)
    {
        case 0: paramMix = value; break;
        case 1: paramTime = value; break;
        case 2: paramBandWidth = value; break;
        case 3: paramFeedback = value; break;
        case 4: paramDiffusion = value; break;
        default: break;
    }
}

} // namespace ABD
