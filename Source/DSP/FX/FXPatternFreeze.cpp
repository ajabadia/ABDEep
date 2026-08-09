#include "FXPatternFreeze.h"
#include <algorithm>
#include <cmath>

namespace ABD
{
    FXPatternFreeze::FXPatternFreeze()
    {
        freezeBufL.resize(kMaxBuffer + 1, 0.0f);
        freezeBufR.resize(kMaxBuffer + 1, 0.0f);
        bufferMask = kMaxBuffer;
    }

    void FXPatternFreeze::prepare(double sr, int /*spb*/)
    {
        sampleRate = sr;
        std::fill(freezeBufL.begin(), freezeBufL.end(), 0.0f);
        std::fill(freezeBufR.begin(), freezeBufR.end(), 0.0f);
        writePos = 0;
        readPos = 0;
        xfadeCount = 0;
        xfadeLength = 0;
    }

    void FXPatternFreeze::reset()
    {
        std::fill(freezeBufL.begin(), freezeBufL.end(), 0.0f);
        std::fill(freezeBufR.begin(), freezeBufR.end(), 0.0f);
        writePos = 0;
        readPos = 0;
        xfadeCount = 0;
        xfadeLength = 0;
    }

    void FXPatternFreeze::setParameter(int index, float value)
    {
        float v = std::clamp(value, 0.0f, 1.0f);
        switch (index)
        {
            case 0: paramMix = v; break;
            case 1: paramLength = v; break;
            case 2: paramFeedback = v; break;
            case 3: paramRegenerate = v; break;
            default: break;
        }
    }

    float FXPatternFreeze::noiseGenerate()
    {
        noiseSeed = noiseSeed * 1664525u + 1013904223u;
        return ((int32_t)noiseSeed) * (1.0f / 2147483648.0f) * 0.005f;
    }

    void FXPatternFreeze::process(const float* inL, const float* inR,
                                    float* outL, float* outR,
                                    int numSamples)
    {
        // Buffer length: 200ms to 4000ms
        float bufLenMs = 200.0f + paramLength * 3800.0f;
        int bufLen = std::clamp((int)(bufLenMs * (float)sampleRate * 0.001f),
                                 1, kMaxBuffer);
        int bufMask = bufLen - 1;

        float fb = paramFeedback * 0.95f;
        float regen = paramRegenerate;
        int xfadeLen = std::clamp((int)(regen * 2048.0f), 0, 2048);

        for (int i = 0; i < numSamples; ++i)
        {
            float inL_s = inL[i];
            float inR_s = inR[i];

            // Write new audio with feedback
            float writeL = inL_s + freezeBufL[writePos & bufMask] * fb;
            float writeR = inR_s + freezeBufR[writePos & bufMask] * fb;
            freezeBufL[writePos & bufMask] = writeL + noiseGenerate();
            freezeBufR[writePos & bufMask] = writeR + noiseGenerate();

            // Read from buffer (looping)
            float readSampleL = freezeBufL[readPos & bufMask];
            float readSampleR = freezeBufR[readPos & bufMask];

            // Crossfade at loop point
            if (xfadeLen > 0)
            {
                int loopEnd = writePos;
                int dist = (readPos - loopEnd + bufMask + 1) & bufMask;
                if (dist < xfadeLen)
                {
                    float xf = (float)dist / (float)xfadeLen;
                    readSampleL = readSampleL * (1.0f - xf) + freezeBufL[(readPos - bufLen + bufMask + 1) & bufMask] * xf;
                    readSampleR = readSampleR * (1.0f - xf) + freezeBufR[(readPos - bufLen + bufMask + 1) & bufMask] * xf;
                }
            }

            writePos = (writePos + 1);
            readPos = (readPos + 1);

            // Wrap readPos to stay within buffer length
            if (readPos - writePos >= bufLen)
                readPos = writePos - bufLen;

            // Output mix
            outL[i] = inL_s * (1.0f - paramMix) + readSampleL * paramMix;
            outR[i] = inR_s * (1.0f - paramMix) + readSampleR * paramMix;
        }
    }
}
