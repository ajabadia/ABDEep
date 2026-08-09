#include "FXNimbus.h"
#include <cmath>
#include <algorithm>

namespace ABD
{

FXNimbus::FXNimbus()
{
    reset();
}

void FXNimbus::prepare(double sr, int /*samplesPerBlock*/)
{
    sampleRate = std::max(1.0, sr);
    int bufSize = std::min(kMaxBufSize, (int)(sampleRate * 2.0));
    ringBufL.resize(bufSize, 0.0f);
    ringBufR.resize(bufSize, 0.0f);
    reset();
}

void FXNimbus::reset()
{
    std::fill(ringBufL.begin(), ringBufL.end(), 0.0f);
    std::fill(ringBufR.begin(), ringBufR.end(), 0.0f);
    ringWritePos = 0;
    for (int i = 0; i < kMaxGrains; ++i)
        grains[i] = Grain{};
    nextGrainIdx = 0;
}

void FXNimbus::spawnGrain()
{
    int bufLen = (int)ringBufL.size();
    float grainDur = 0.02f + grainSizeParam * 0.18f; // 20-200ms
    int grainLen = (int)(sampleRate * grainDur);
    if (grainLen < 16) grainLen = 16;
    if (grainLen > bufLen / 2) grainLen = bufLen / 2;

    float pitchRatio = std::pow(2.0f, (pitchParam - 0.5f) * 2.0f); // 0.5x-2x

    grains[nextGrainIdx].active = true;
    grains[nextGrainIdx].readPos = (ringWritePos - grainLen + bufLen * 2) % bufLen;
    grains[nextGrainIdx].length = grainLen;
    grains[nextGrainIdx].age = 0;
    grains[nextGrainIdx].pitchRatio = pitchRatio;
    grains[nextGrainIdx].pan = 0.2f + 0.6f * ((float)(nextGrainIdx % 3) / 2.0f);
    grains[nextGrainIdx].gain = 0.5f + 0.5f * densityParam;

    nextGrainIdx = (nextGrainIdx + 1) % kMaxGrains;
}

void FXNimbus::process(const float* inL, const float* inR,
                        float* outL, float* outR,
                        int numSamples)
{
    int bufLen = (int)ringBufL.size();
    int maxGrainCount = 1 + (int)(densityParam * 7.0f); // 1-8 simultaneous grains
    float spawnRate = 0.3f + densityParam * 0.7f;
    int samplesPerGrain = (int)(sampleRate / (spawnRate * 4.0f + 1.0f));
    if (samplesPerGrain < 16) samplesPerGrain = 16;

    for (int s = 0; s < numSamples; ++s)
    {
        float xL = inL[s];
        float xR = inR[s];

        // Write to ring buffer
        ringBufL[ringWritePos] = xL;
        ringBufR[ringWritePos] = xR;

        // Spawn grains periodically
        if (s % samplesPerGrain == 0)
        {
            int activeCount = 0;
            for (int g = 0; g < kMaxGrains; ++g)
                if (grains[g].active) activeCount++;
            if (activeCount < maxGrainCount)
                spawnGrain();
        }

        // Sum all active grains
        float wetL = 0.0f, wetR = 0.0f;
        for (int g = 0; g < kMaxGrains; ++g)
        {
            if (!grains[g].active) continue;

            float readPosF = (float)grains[g].readPos;
            int idx = (int)readPosF % bufLen;
            int next = (idx + 1) % bufLen;
            float frac = readPosF - (float)idx;
            float sampL = ringBufL[idx] * (1.0f - frac) + ringBufL[next] * frac;
            float sampR = ringBufR[idx] * (1.0f - frac) + ringBufR[next] * frac;

            // Apply grain gain envelope (raised cosine)
            float progress = (float)grains[g].age / (float)grains[g].length;
            float envelope = 0.5f * (1.0f + std::cos(3.14159265f * progress));
            sampL *= envelope * grains[g].gain;
            sampR *= envelope * grains[g].gain;

            wetL += sampL;
            wetR += sampR;

            grains[g].readPos += (int)grains[g].pitchRatio;
            grains[g].age++;
            if (grains[g].age >= grains[g].length)
                grains[g].active = false;
        }

        // Normalize wet by max grain count
        wetL /= (float)maxGrainCount;
        wetR /= (float)maxGrainCount;

        // Apply feedback: write wet back into ring buffer
        float fb = feedbackParam * 0.4f;
        ringBufL[ringWritePos] += wetL * fb;
        ringBufR[ringWritePos] += wetR * fb;

        // Soft clip feedback
        ringBufL[ringWritePos] = std::tanh(ringBufL[ringWritePos]);
        ringBufR[ringWritePos] = std::tanh(ringBufR[ringWritePos]);

        ringWritePos = (ringWritePos + 1) % bufLen;

        outL[s] = xL * (1.0f - mix) + wetL * mix;
        outR[s] = xR * (1.0f - mix) + wetR * mix;
    }
}

void FXNimbus::setParameter(int index, float value)
{
    switch (index)
    {
        case 0: grainSizeParam = value; break;
        case 1: densityParam = value; break;
        case 2: feedbackParam = value; break;
        case 3: pitchParam = value; break;
        case 4: mix = value; break;
        default: break;
    }
}

} // namespace ABD
