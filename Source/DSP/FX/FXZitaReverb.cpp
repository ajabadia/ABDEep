#include "FXZitaReverb.h"
#include <cmath>
#include <algorithm>

namespace ABD
{

FXZitaReverb::FXZitaReverb()
{
    reset();
}

void FXZitaReverb::prepare(double sr, int /*samplesPerBlock*/)
{
    sampleRate = std::max(1.0, sr);
    updateCombLengths();

    inputAPBuf.resize(kInputAPSize, 0.0f);
    preDelaySize = (int)(sampleRate * 0.1); // 100ms max
    preDelayBufL.resize(preDelaySize, 0.0f);
    preDelayBufR.resize(preDelaySize, 0.0f);

    for (int a = 0; a < kOutAPCount; ++a)
    {
        outAPSizes[a] = (a == 0) ? 181 : 127;
        outAPBufL[a].resize(outAPSizes[a], 0.0f);
        outAPBufR[a].resize(outAPSizes[a], 0.0f);
    }
    reset();
}

void FXZitaReverb::updateCombLengths()
{
    int baseLens[4] = { 1557, 1617, 1491, 1423 };
    for (int i = 0; i < kNumCombs; ++i)
    {
        combSizes[i] = (int)(baseLens[i] * (0.4f + sizeParam * 0.6f));
        if (combSizes[i] < 64) combSizes[i] = 64;
        combBufL[i].resize(combSizes[i], 0.0f);
        combBufR[i].resize(combSizes[i], 0.0f);
        combWritePos[i] = 0;
    }
}

void FXZitaReverb::reset()
{
    std::fill(inputAPBuf.begin(), inputAPBuf.end(), 0.0f);
    inputAPPos = 0;
    std::fill(preDelayBufL.begin(), preDelayBufL.end(), 0.0f);
    std::fill(preDelayBufR.begin(), preDelayBufR.end(), 0.0f);
    preDelayPos = 0;

    for (int i = 0; i < kNumCombs; ++i)
    {
        std::fill(combBufL[i].begin(), combBufL[i].end(), 0.0f);
        std::fill(combBufR[i].begin(), combBufR[i].end(), 0.0f);
        combWritePos[i] = 0;
        combStateL[i] = combStateR[i] = 0.0f;
    }
    for (int a = 0; a < kOutAPCount; ++a)
    {
        std::fill(outAPBufL[a].begin(), outAPBufL[a].end(), 0.0f);
        std::fill(outAPBufR[a].begin(), outAPBufR[a].end(), 0.0f);
        outAPPos[a] = 0;
    }
}

void FXZitaReverb::process(const float* inL, const float* inR,
                            float* outL, float* outR,
                            int numSamples)
{
    float fb = decayParam * 0.82f;
    float dampCoeff = 0.2f + dampingParam * 0.7f;

    for (int s = 0; s < numSamples; ++s)
    {
        float xL = inL[s];
        float xR = inR[s];

        // Pre-delay
        preDelayBufL[preDelayPos] = xL;
        preDelayBufR[preDelayPos] = xR;
        int pdRead = (preDelayPos - (int)(preDelayParam * preDelaySize * 0.9f) + preDelaySize * 2) % preDelaySize;
        float pdL = preDelayBufL[pdRead];
        float pdR = preDelayBufR[pdRead];
        preDelayPos = (preDelayPos + 1) % preDelaySize;

        // Input allpass
        {
            int readPos = (inputAPPos - kInputAPSize / 2 + kInputAPSize * 2) % kInputAPSize;
            float apOut = inputAPBuf[readPos];
            inputAPBuf[inputAPPos] = pdL * 0.5f + 0.5f * apOut;
            float inputAP = -0.5f * pdL + apOut;
            inputAPPos = (inputAPPos + 1) % kInputAPSize;
            pdL = inputAP;
            pdR = inputAP; // mono allpass for stereo coherence
        }

        // Parallel comb bank
        float combSumL = 0.0f, combSumR = 0.0f;
        for (int i = 0; i < kNumCombs; ++i)
        {
            int readPos = (combWritePos[i] - combSizes[i] / 2 + combSizes[i] * 2) % combSizes[i];
            float cL = combBufL[i][readPos];
            float cR = combBufR[i][readPos];

            // Damping
            combStateL[i] += dampCoeff * (cL - combStateL[i]);
            combStateR[i] += dampCoeff * (cR - combStateR[i]);

            combBufL[i][combWritePos[i]] = pdL + combStateL[i] * fb;
            combBufR[i][combWritePos[i]] = pdR + combStateR[i] * fb;
            combWritePos[i] = (combWritePos[i] + 1) % combSizes[i];

            combSumL += cL;
            combSumR += cR;
        }
        combSumL /= (float)kNumCombs;
        combSumR /= (float)kNumCombs;

        // Output allpass chain
        float allpassL = combSumL, allpassR = combSumR;
        for (int a = 0; a < kOutAPCount; ++a)
        {
            int rL = (outAPPos[a] - outAPSizes[a] / 2 + outAPSizes[a] * 2) % outAPSizes[a];
            float oL = outAPBufL[a][rL];
            float oR = outAPBufR[a][rL];
            outAPBufL[a][outAPPos[a]] = allpassL + 0.5f * oL;
            outAPBufR[a][outAPPos[a]] = allpassR + 0.5f * oR;
            allpassL = -0.5f * allpassL + oL;
            allpassR = -0.5f * allpassR + oR;
            outAPPos[a] = (outAPPos[a] + 1) % outAPSizes[a];
        }

        outL[s] = xL * (1.0f - mix) + allpassL * mix;
        outR[s] = xR * (1.0f - mix) + allpassR * mix;
    }
}

void FXZitaReverb::setParameter(int index, float value)
{
    switch (index)
    {
        case 0: sizeParam = value; updateCombLengths(); break;
        case 1: decayParam = value; break;
        case 2: dampingParam = value; break;
        case 3: preDelayParam = value; break;
        case 4: mix = value; break;
        default: break;
    }
}

} // namespace ABD
