#include "FXFDNReverb.h"
#include <cmath>
#include <algorithm>

namespace ABD
{

FXFDNReverb::FXFDNReverb()
{
    reset();
}

void FXFDNReverb::prepare(double sr, int /*samplesPerBlock*/)
{
    sampleRate = std::max(1.0, sr);
    updateDelayLengths();
    reset();
}

void FXFDNReverb::updateDelayLengths()
{
    // Delay line lengths (prime-ish spacing for density)
    int baseLens[8] = { 1433, 1789, 2053, 2591, 3169, 3793, 4201, 4877 };
    for (int i = 0; i < kNumDelays; ++i)
    {
        float scale = 0.3f + sizeParam * 0.7f;
        delaySizes[i] = (int)(baseLens[i] * scale);
        if (delaySizes[i] < 64) delaySizes[i] = 64;
        delayBuffers[i].resize(delaySizes[i], 0.0f);
        writePos[i] = 0;
    }

    // Allpass diffusion lengths
    int apLens[4] = { 347, 613, 919, 1201 };
    for (int i = 0; i < kNumAllpasses; ++i)
    {
        apSizes[i] = (int)(apLens[i] * (0.5f + sizeParam * 0.5f));
        if (apSizes[i] < 32) apSizes[i] = 32;
        apBuffers[i].resize(apSizes[i], 0.0f);
        apWritePos[i] = 0;
        apGains[i] = 0.5f + diffusionParam * 0.4f;
    }
}

void FXFDNReverb::reset()
{
    for (int i = 0; i < kNumDelays; ++i)
    {
        std::fill(delayBuffers[i].begin(), delayBuffers[i].end(), 0.0f);
        writePos[i] = 0;
        dampingState[i] = 0.0f;
    }
    for (int i = 0; i < kNumAllpasses; ++i)
    {
        std::fill(apBuffers[i].begin(), apBuffers[i].end(), 0.0f);
        apWritePos[i] = 0;
    }
}

void FXFDNReverb::process(const float* inL, const float* inR,
                            float* outL, float* outR,
                            int numSamples)
{
    float fb = decayParam * 0.85f;
    float dampCoeff = 0.1f + dampingParam * 0.8f; // higher = more damping

    for (int s = 0; s < numSamples; ++s)
    {
        float xL = inL[s];
        float xR = inR[s];
        float input = (xL + xR) * 0.5f;

        // Write to delay lines
        for (int d = 0; d < kNumDelays; ++d)
        {
            float inSample = (d < 2) ? input * (d == 0 ? xL : xR) : input;
            delayBuffers[d][writePos[d]] += inSample * 0.3f;
        }

        // Read from delay lines
        float delayOut[kNumDelays];
        for (int d = 0; d < kNumDelays; ++d)
        {
            int readPos = (writePos[d] - delaySizes[d] / 2 + delaySizes[d] * 2) % delaySizes[d];
            delayOut[d] = delayBuffers[d][readPos];

            // Damping (one-pole LP)
            dampingState[d] += dampCoeff * (delayOut[d] - dampingState[d]);
            delayOut[d] = dampingState[d];
        }

        // 8x8 Householder feedback matrix
        float sum = 0.0f;
        for (int d = 0; d < kNumDelays; ++d)
            sum += delayOut[d];

        float matrixOut[kNumDelays];
        for (int d = 0; d < kNumDelays; ++d)
            matrixOut[d] = sum - delayOut[d] * 2.0f; // Householder: each output = sum - 2*input

        // Apply feedback and write back
        for (int d = 0; d < kNumDelays; ++d)
        {
            delayBuffers[d][writePos[d]] = matrixOut[d] * fb;
            writePos[d] = (writePos[d] + 1) % delaySizes[d];
        }

        // Diffusion allpass chain (2 stages)
        float diff = matrixOut[0] + matrixOut[4];
        for (int a = 0; a < kNumAllpasses; ++a)
        {
            int readPos = (apWritePos[a] - apSizes[a] / 2 + apSizes[a] * 2) % apSizes[a];
            float apOut = apBuffers[a][readPos];
            apBuffers[a][apWritePos[a]] = diff + apGains[a] * apOut;
            diff = -apGains[a] * diff + apOut;
            apWritePos[a] = (apWritePos[a] + 1) % apSizes[a];
        }

        float wet = diff * 0.5f;
        outL[s] = xL * (1.0f - mix) + wet * mix;
        outR[s] = xR * (1.0f - mix) + wet * mix;
    }
}

void FXFDNReverb::setParameter(int index, float value)
{
    switch (index)
    {
        case 0: sizeParam = value; updateDelayLengths(); break;
        case 1: decayParam = value; break;
        case 2: diffusionParam = value; updateDelayLengths(); break;
        case 3: dampingParam = value; break;
        case 4: mix = value; break;
        default: break;
    }
}

} // namespace ABD
