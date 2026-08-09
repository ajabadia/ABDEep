#include "FXBonsai.h"
#include <cmath>
#include <algorithm>

namespace ABD
{

FXBonsai::FXBonsai()
{
    reset();
}

void FXBonsai::prepare(double sr, int /*samplesPerBlock*/)
{
    sampleRate = std::max(1.0, sr);
    int bufSize = 1;
    while (bufSize < kMaxDelay) bufSize *= 2;
    bufL.resize(bufSize, 0.0f);
    bufR.resize(bufSize, 0.0f);
    bufMask = bufSize - 1;
    reset();
}

void FXBonsai::reset()
{
    std::fill(bufL.begin(), bufL.end(), 0.0f);
    std::fill(bufR.begin(), bufR.end(), 0.0f);
    readPosL = readPosR = 0.0f;
    lfoPhase = 0.0f;
    lofiAccumL = lofiAccumR = 0.0f;
}

float FXBonsai::driveShape(float x) const
{
    float g = 1.0f + driveParam * 6.0f;
    return std::tanh(x * g) / std::tanh(g);
}

float FXBonsai::lofiQuantize(float x) const
{
    if (lofiParam < 0.01f) return x;

    // Bit depth reduction: 24-bit down to 3-bit
    float bits = 24.0f - lofiParam * 21.0f;
    float levels = std::pow(2.0f, bits);
    float quantized = std::round(x * levels) / levels;

    return quantized;
}

void FXBonsai::process(const float* inL, const float* inR,
                        float* outL, float* outR,
                        int numSamples)
{
    // Pitch ratio from -12 to +12 semitones
    float pitchRatio = std::pow(2.0f, (pitchParam - 0.5f) * 24.0f / 12.0f);
    float lfoInc = (0.5f + wowParam * 3.0f) / (float)sampleRate; // 0.5-3.5 Hz
    float wowDepth = wowParam * 0.02f;

    // Sample rate reduction factor
    int srFactor = 1;
    if (lofiParam > 0.3f)
        srFactor = 1 + (int)((lofiParam - 0.3f) * 10.0f);

    for (int s = 0; s < numSamples; ++s)
    {
        float xL = inL[s];
        float xR = inR[s];

        // Write to ring buffer
        int writeIdx = (int)readPosL & bufMask;
        bufL[writeIdx] = xL;
        bufR[writeIdx] = xR;

        // Wow modulation
        lfoPhase += lfoInc;
        if (lfoPhase >= 1.0f) lfoPhase -= 1.0f;
        float wow = std::sin(6.283185f * lfoPhase) * wowDepth;
        float currentRatio = pitchRatio + wow;

        // Advance read position
        readPosL += currentRatio;
        readPosR += currentRatio;

        // Wrap read position
        if (readPosL < 0.0f) readPosL += (float)bufMask;
        if (readPosL >= (float)bufMask) readPosL -= (float)bufMask;
        if (readPosR < 0.0f) readPosR += (float)bufMask;
        if (readPosR >= (float)bufMask) readPosR -= (float)bufMask;

        // Read with linear interpolation
        int readIdxL = (int)readPosL & bufMask;
        int nextIdxL = (readIdxL + 1) & bufMask;
        float fracL = readPosL - (float)(int)readPosL;
        float pitchL = bufL[readIdxL] * (1.0f - fracL) + bufL[nextIdxL] * fracL;

        int readIdxR = (int)readPosR & bufMask;
        int nextIdxR = (readIdxR + 1) & bufMask;
        float fracR = readPosR - (float)(int)readPosR;
        float pitchR = bufR[readIdxR] * (1.0f - fracR) + bufR[nextIdxR] * fracR;

        // Sample rate reduction (sample-and-hold)
        float srL, srR;
        if (srFactor > 1)
        {
            if (s % srFactor == 0)
            {
                lofiAccumL = pitchL;
                lofiAccumR = pitchR;
            }
            srL = lofiAccumL;
            srR = lofiAccumR;
        }
        else
        {
            srL = pitchL;
            srR = pitchR;
        }

        // Bit depth quantization
        srL = lofiQuantize(srL);
        srR = lofiQuantize(srR);

        // Drive saturation
        float wetL = driveShape(srL);
        float wetR = driveShape(srR);

        outL[s] = xL * (1.0f - mix) + wetL * mix;
        outR[s] = xR * (1.0f - mix) + wetR * mix;
    }
}

void FXBonsai::setParameter(int index, float value)
{
    switch (index)
    {
        case 0: pitchParam = value; break;
        case 1: lofiParam = value; break;
        case 2: driveParam = value; break;
        case 3: wowParam = value; break;
        case 4: mix = value; break;
        default: break;
    }
}

} // namespace ABD
