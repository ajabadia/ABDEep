#include "FXShimmerDelay.h"
#include <algorithm>
#include <cmath>

namespace ABD
{
    FXShimmerDelay::FXShimmerDelay()
    {
        delayBufL.resize(kMaxDelay + 1, 0.0f);
        delayBufR.resize(kMaxDelay + 1, 0.0f);
        delayMask = kMaxDelay;

        grainBufL.resize(kGrainSize, 0.0f);
        grainBufR.resize(kGrainSize, 0.0f);

        reverbBuf.resize(kReverbSize + 1, 0.0f);
        reverbMask = kReverbSize;
    }

    void FXShimmerDelay::prepare(double sr, int /*spb*/)
    {
        sampleRate = sr;
        std::fill(delayBufL.begin(), delayBufL.end(), 0.0f);
        std::fill(delayBufR.begin(), delayBufR.end(), 0.0f);
        std::fill(grainBufL.begin(), grainBufL.end(), 0.0f);
        std::fill(grainBufR.begin(), grainBufR.end(), 0.0f);
        std::fill(reverbBuf.begin(), reverbBuf.end(), 0.0f);
        writePos = 0;
        grainPos = 0;
        grainCount = 0;
        reverbWPos = 0;
    }

    void FXShimmerDelay::reset()
    {
        std::fill(delayBufL.begin(), delayBufL.end(), 0.0f);
        std::fill(delayBufR.begin(), delayBufR.end(), 0.0f);
        std::fill(grainBufL.begin(), grainBufL.end(), 0.0f);
        std::fill(grainBufR.begin(), grainBufR.end(), 0.0f);
        std::fill(reverbBuf.begin(), reverbBuf.end(), 0.0f);
        writePos = 0;
        grainPos = 0;
        grainCount = 0;
        reverbWPos = 0;
    }

    void FXShimmerDelay::setParameter(int index, float value)
    {
        float v = std::clamp(value, 0.0f, 1.0f);
        switch (index)
        {
            case 0: paramMix = v; break;
            case 1: paramTime = v; break;
            case 2: paramFeedback = v; break;
            case 3: paramPitch = v; break;
            case 4: paramReverbMix = v; break;
            default: break;
        }
    }

    float FXShimmerDelay::noiseGenerate()
    {
        noiseSeed = noiseSeed * 1664525u + 1013904223u;
        return ((int32_t)noiseSeed) * (1.0f / 2147483648.0f) * 0.01f;
    }

    float FXShimmerDelay::pitchShift(float input, float pitchRatio)
    {
        grainBufL[grainPos] = input;
        grainPos = (grainPos + 1) % kGrainSize;
        grainCount++;

        if (pitchRatio < 0.01f) return input;

        float readIdx = (float)grainPos * pitchRatio;
        int idx = (int)readIdx % kGrainSize;
        float frac = readIdx - (float)(int)readIdx;
        float next = grainBufL[(idx + 1) % kGrainSize];
        return grainBufL[idx] + frac * (next - grainBufL[idx]);
    }

    void FXShimmerDelay::process(const float* inL, const float* inR,
                                   float* outL, float* outR,
                                   int numSamples)
    {
        float maxDelay = std::min((float)(kMaxDelay - 1),
                                   (float)(sampleRate * 2.0f));
        float delaySec = 0.1f + paramTime * 1.9f;
        float delaySamps = delaySec * (float)sampleRate;
        float fb = paramFeedback * 0.82f;
        float pitchRatio = 1.0f + paramPitch;  // 1.0 (off) to 2.0 (+1 octave)
        float revMix = paramReverbMix;

        for (int i = 0; i < numSamples; ++i)
        {
            float inL_s = inL[i];
            float inR_s = inR[i];

            // Read delay
            float readPos = (float)writePos - delaySamps;
            if (readPos < 0.0f) readPos += (float)(delayMask + 1);
            int idx0 = (int)readPos & delayMask;
            int idx1 = (idx0 + 1) & delayMask;
            float frac = readPos - (float)(int)readPos;
            float readL = delayBufL[idx0] + frac * (delayBufL[idx1] - delayBufL[idx0]);
            float readR = delayBufR[idx0] + frac * (delayBufR[idx1] - delayBufR[idx0]);

            // Apply pitch shift to feedback
            float shiftedL = pitchShift(readL, pitchRatio);
            float shiftedR = pitchShift(readR, pitchRatio);

            // Write to delay
            float writeL = inL_s + shiftedL * fb + noiseGenerate();
            float writeR = inR_s + shiftedR * fb + noiseGenerate();
            delayBufL[writePos] = writeL;
            delayBufR[writePos] = writeR;
            writePos = (writePos + 1) & delayMask;

            // Simple reverb tap
            int revIdx = (reverbWPos - (int)(sampleRate * 0.05f * (1.0f + (float)(i % 7) * 0.02f)) + reverbMask + 1) & reverbMask;
            float revTap = reverbBuf[revIdx];
            reverbBuf[reverbWPos] = shiftedL * 0.3f + reverbBuf[(reverbWPos - 1234 + reverbMask + 1) & reverbMask] * 0.65f;
            reverbWPos = (reverbWPos + 1) & reverbMask;

            // Output: dry + wet (pitched delay + reverb)
            float wetL = shiftedL * 0.55f + revTap * revMix;
            float wetR = shiftedR * 0.55f + revTap * revMix * 0.97f;
            outL[i] = inL_s * (1.0f - paramMix) + wetL * paramMix;
            outR[i] = inR_s * (1.0f - paramMix) + wetR * paramMix;
        }
    }
}
