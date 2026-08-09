#include "FXDuckingDelay.h"
#include <algorithm>
#include <cmath>

namespace ABD
{
    FXDuckingDelay::FXDuckingDelay()
    {
        delayBufL.resize(kMaxDelay + 1, 0.0f);
        delayBufR.resize(kMaxDelay + 1, 0.0f);
        delayMask = kMaxDelay;
    }

    void FXDuckingDelay::prepare(double sr, int /*spb*/)
    {
        sampleRate = sr;
        std::fill(delayBufL.begin(), delayBufL.end(), 0.0f);
        std::fill(delayBufR.begin(), delayBufR.end(), 0.0f);
        writePos = 0;
        envL = 0.0f;
        envR = 0.0f;
        duckGain = 1.0f;
    }

    void FXDuckingDelay::reset()
    {
        std::fill(delayBufL.begin(), delayBufL.end(), 0.0f);
        std::fill(delayBufR.begin(), delayBufR.end(), 0.0f);
        writePos = 0;
        envL = 0.0f;
        envR = 0.0f;
        duckGain = 1.0f;
    }

    void FXDuckingDelay::setParameter(int index, float value)
    {
        float v = std::clamp(value, 0.0f, 1.0f);
        switch (index)
        {
            case 0: paramMix = v; break;
            case 1: paramTime = v; break;
            case 2: paramFeedback = v; break;
            case 3: paramThreshold = v; break;
            case 4: paramRatio = v; break;
            default: break;
        }
    }

    float FXDuckingDelay::noiseGenerate()
    {
        noiseSeed = noiseSeed * 1664525u + 1013904223u;
        return ((int32_t)noiseSeed) * (1.0f / 2147483648.0f) * 0.01f;
    }

    void FXDuckingDelay::process(const float* inL, const float* inR,
                                   float* outL, float* outR,
                                   int numSamples)
    {
        float maxDelay = std::min((float)(kMaxDelay - 1),
                                   (float)(sampleRate * 1.5f));
        float delaySec = 0.05f + paramTime * 1.45f;
        float delaySamps = delaySec * (float)sampleRate;
        float fb = paramFeedback * 0.85f;

        // Ducking parameters
        float thresholdLin = paramThreshold * paramThreshold * 0.5f;
        float duckRatio = 1.0f + paramRatio * 19.0f;
        float attackCoeff = 1.0f - std::exp(-1.0f / ((float)sampleRate * kEnvAttack));
        float releaseCoeff = 1.0f - std::exp(-1.0f / ((float)sampleRate * kEnvRelease));

        for (int i = 0; i < numSamples; ++i)
        {
            float inL_s = inL[i];
            float inR_s = inR[i];

            // Sidechain envelope follower
            float levelL = std::abs(inL_s);
            float levelR = std::abs(inR_s);
            float level = std::max(levelL, levelR);

            float attack = (level > envL) ? attackCoeff : releaseCoeff;
            envL += attack * (level - envL);

            // Compute duck gain
            float overThreshold = envL / (thresholdLin + 0.0001f);
            if (overThreshold > 1.0f)
                duckGain = 1.0f / (1.0f + (overThreshold - 1.0f) * duckRatio);
            else
                duckGain = 1.0f;

            duckGain = std::clamp(duckGain, 0.05f, 1.0f);

            // Read delay
            float readPos = (float)writePos - delaySamps;
            if (readPos < 0.0f) readPos += (float)(delayMask + 1);
            int idx0 = (int)readPos & delayMask;
            int idx1 = (idx0 + 1) & delayMask;
            float frac = readPos - (float)(int)readPos;
            float readL = delayBufL[idx0] + frac * (delayBufL[idx1] - delayBufL[idx0]);
            float readR = delayBufR[idx0] + frac * (delayBufR[idx1] - delayBufR[idx0]);

            // Write to delay: input + ducked feedback
            float writeL = inL_s + readL * fb * duckGain + noiseGenerate();
            float writeR = inR_s + readR * fb * duckGain + noiseGenerate();
            delayBufL[writePos] = writeL;
            delayBufR[writePos] = writeR;
            writePos = (writePos + 1) & delayMask;

            // Output: dry + ducked wet
            float wetL = readL * duckGain;
            float wetR = readR * duckGain;
            outL[i] = inL_s * (1.0f - paramMix) + wetL * paramMix;
            outR[i] = inR_s * (1.0f - paramMix) + wetR * paramMix;
        }
    }
}
