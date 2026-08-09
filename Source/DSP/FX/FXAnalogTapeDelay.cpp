#include "FXAnalogTapeDelay.h"
#include <algorithm>
#include <cmath>

namespace ABD
{
    FXAnalogTapeDelay::FXAnalogTapeDelay()
    {
        delayBufL.resize(kMaxDelay + 1, 0.0f);
        delayBufR.resize(kMaxDelay + 1, 0.0f);
        delayMask = kMaxDelay;
    }

    void FXAnalogTapeDelay::prepare(double sr, int /*spb*/)
    {
        sampleRate = sr;
        std::fill(delayBufL.begin(), delayBufL.end(), 0.0f);
        std::fill(delayBufR.begin(), delayBufR.end(), 0.0f);
        writePos = 0;
        lpStateL = 0.0f;
        lpStateR = 0.0f;
    }

    void FXAnalogTapeDelay::reset()
    {
        std::fill(delayBufL.begin(), delayBufL.end(), 0.0f);
        std::fill(delayBufR.begin(), delayBufR.end(), 0.0f);
        writePos = 0;
        lpStateL = 0.0f;
        lpStateR = 0.0f;
    }

    void FXAnalogTapeDelay::setParameter(int index, float value)
    {
        float v = std::clamp(value, 0.0f, 1.0f);
        switch (index)
        {
            case 0: paramMix = v; break;
            case 1: paramTime = v; break;
            case 2: paramFeedback = v; break;
            case 3: paramWobble = v; break;
            case 4: paramSaturation = v; break;
            case 5: paramTone = v; break;
            default: break;
        }
    }

    float FXAnalogTapeDelay::tapeSat(float x, float drive)
    {
        if (drive < 0.01f) return x;
        float d = 1.0f + drive * 15.0f;
        return std::tanh(x * d) / std::tanh(d);
    }

    float FXAnalogTapeDelay::noiseGenerate()
    {
        noiseSeed = noiseSeed * 1664525u + 1013904223u;
        return ((int32_t)noiseSeed) * (1.0f / 2147483648.0f) * 0.015f;
    }

    void FXAnalogTapeDelay::process(const float* inL, const float* inR,
                                      float* outL, float* outR,
                                      int numSamples)
    {
        float maxDelay = std::min((float)(kMaxDelay - 1),
                                   (float)(sampleRate * 1.2));
        float delaySec = 0.05f + paramTime * 1.15f;
        float delaySamps = delaySec * (float)sampleRate;
        float fb = paramFeedback * 0.88f;
        float drive = paramSaturation;
        float wobbleDepth = paramWobble * 0.02f;

        // Tone LPF coefficient: low tone = darker repeats
        float toneCutoff = 800.0f + paramTone * 6000.0f;
        float toneCoeff = 1.0f - std::exp(-2.0f * 3.14159265f * toneCutoff / (float)sampleRate);

        for (int i = 0; i < numSamples; ++i)
        {
            float inL_s = inL[i];
            float inR_s = inR[i];

            // Wow (slow) + flutter (fast)
            float wow = std::sin((float)writePos * 0.0008f) * 0.6f
                      + std::sin((float)writePos * 0.0023f) * 0.3f
                      + std::sin((float)writePos * 0.0057f) * 0.1f;
            float modDelay = delaySamps * (1.0f + wow * wobbleDepth);
            modDelay = std::clamp(modDelay, 1.0f, (float)maxDelay);

            // Read with linear interpolation
            float readPos = (float)writePos - modDelay;
            if (readPos < 0.0f) readPos += (float)(delayMask + 1);
            int idx0 = (int)readPos & delayMask;
            int idx1 = (idx0 + 1) & delayMask;
            float frac = readPos - (float)(int)readPos;
            float readL = delayBufL[idx0] + frac * (delayBufL[idx1] - delayBufL[idx0]);
            float readR = delayBufR[idx0] + frac * (delayBufR[idx1] - delayBufR[idx0]);

            // Low-pass filter on feedback
            lpStateL += toneCoeff * (readL - lpStateL);
            lpStateR += toneCoeff * (readR - lpStateR);

            // Apply tape saturation
            float satL = tapeSat(lpStateL, drive);
            float satR = tapeSat(lpStateR, drive);

            // Write: input + saturated feedback
            float writeL = inL_s + satL * fb + noiseGenerate();
            float writeR = inR_s + satR * fb + noiseGenerate();
            delayBufL[writePos] = writeL;
            delayBufR[writePos] = writeR;
            writePos = (writePos + 1) & delayMask;

            // Output mix
            float wetL = satL * 0.6f;
            float wetR = satR * 0.6f;
            outL[i] = inL_s * (1.0f - paramMix) + wetL * paramMix;
            outR[i] = inR_s * (1.0f - paramMix) + wetR * paramMix;
        }
    }
}
