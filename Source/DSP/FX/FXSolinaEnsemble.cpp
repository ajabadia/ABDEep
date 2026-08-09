#include "FXSolinaEnsemble.h"
#include <cmath>

namespace ABD
{
    FXSolinaEnsemble::FXSolinaEnsemble()
    {
        reset();
    }

    void FXSolinaEnsemble::prepare(double sr, int /*samplesPerBlock*/)
    {
        sampleRate = sr;

        // Buffer: ~20ms per tap (kBaseDelayMs + kMaxModMs + margin)
        int bufLen = (int)(sampleRate * 0.025);
        // Round up to power of two
        int pow2 = 1;
        while (pow2 < bufLen)
            pow2 <<= 1;
        delayMask = pow2 - 1;

        for (int t = 0; t < kNumTaps; ++t)
        {
            delayBufL[t].assign(pow2, 0.0f);
            delayBufR[t].assign(pow2, 0.0f);
        }
        delayWPos = 0;

        float rateHz = 0.2f + 7.8f * paramRate;
        lfoInc = (float)(2.0 * 3.14159265 * rateHz / sampleRate);

        feedbackL = 0.0f;
        feedbackR = 0.0f;

        for (int t = 0; t < kNumTaps; ++t)
            lfoPhase[t] = kPhaseOffsets[t];
    }

    void FXSolinaEnsemble::reset()
    {
        paramRate = 0.4f;
        paramDepth = 0.5f;
        paramFeedback = 0.3f;
        paramSpread = 0.6f;
        paramMix = 0.5f;

        for (int t = 0; t < kNumTaps; ++t)
        {
            if (!delayBufL[t].empty())
                std::fill(delayBufL[t].begin(), delayBufL[t].end(), 0.0f);
            if (!delayBufR[t].empty())
                std::fill(delayBufR[t].begin(), delayBufR[t].end(), 0.0f);
            lfoPhase[t] = kPhaseOffsets[t];
        }
        delayWPos = 0;
        feedbackL = 0.0f;
        feedbackR = 0.0f;
    }

    void FXSolinaEnsemble::setParameter(int index, float value)
    {
        float clamped = juce::jlimit(0.0f, 1.0f, value);
        switch (index)
        {
            case 0:
                paramRate = clamped;
                lfoInc = (float)(2.0 * 3.14159265 * (0.2 + 7.8 * clamped) / sampleRate);
                break;
            case 1: paramDepth = clamped; break;
            case 2: paramFeedback = clamped * 0.85f; break;
            case 3: paramSpread = clamped; break;
            case 4: paramMix = clamped; break;
            default: break;
        }
    }

    float FXSolinaEnsemble::hermite(float frac, float y0, float y1, float y2, float y3)
    {
        float c0 = y1;
        float c1 = 0.5f * (y2 - y0);
        float c2 = y0 - 2.5f * y1 + 2.0f * y2 - 0.5f * y3;
        float c3 = 0.5f * (y3 - y0) + 1.5f * (y1 - y2);
        return ((c3 * frac + c2) * frac + c1) * frac + c0;
    }

    float FXSolinaEnsemble::readDelay(const std::vector<float>& buf, float delaySamples) const
    {
        float readPos = (float)delayWPos - delaySamples;
        if (readPos < 0.0f)
            readPos += (float)(delayMask + 1);
        int i0 = (int)readPos;
        float frac = readPos - (float)i0;
        i0 &= delayMask;
        int i1 = (i0 + 1) & delayMask;
        int i2 = (i1 + 1) & delayMask;
        int i3 = (i2 + 1) & delayMask;
        return hermite(frac, buf[i0], buf[i1], buf[i2], buf[i3]);
    }

    void FXSolinaEnsemble::process(const float* inL, const float* inR,
                                    float* outL, float* outR,
                                    int numSamples)
    {
        // Spread: maps 0-1 to stereo offset in degrees
        // 0 = all taps centered, 1 = taps spread 180° apart
        float spreadAngle = paramSpread * 3.14159265f;

        // Depth: 0-1 → 0 - kMaxModMs
        float depthMs = paramDepth * kMaxModMs;
        float baseDelaySamples = kBaseDelayMs * 0.001f * (float)sampleRate;
        float maxModSamples = depthMs * 0.001f * (float)sampleRate;

        // Tap gains: equal power sum → normalize
        // tap0=0.5, tap1=0.5, tap2=0.5 (sum ≈ 1.5, normalize later)
        float tapGains[3] = { 0.55f, 0.55f, 0.55f };

        for (int s = 0; s < numSamples; ++s)
        {
            float dryL = inL[s];
            float dryR = inR[s];

            // Advance LFO phases (each tap has 120° offset)
            for (int t = 0; t < kNumTaps; ++t)
            {
                lfoPhase[t] += lfoInc;
                if (lfoPhase[t] > 2.0f * 3.14159265f)
                    lfoPhase[t] -= 2.0f * 3.14159265f;
            }

            // Sum 3 modulated taps for left and right
            float sumL = 0.0f;
            float sumR = 0.0f;

            for (int t = 0; t < kNumTaps; ++t)
            {
                float mod = sinf(lfoPhase[t]);
                float delaySamples = baseDelaySamples + mod * maxModSamples;
                if (delaySamples < 1.0f)
                    delaySamples = 1.0f;

                // Spread offsets L/R read positions
                float spreadOffsetL = spreadAngle * (float)(t - 1) * 0.3f;
                float spreadOffsetR = -spreadOffsetL;

                float delayedL = readDelay(delayBufL[t], delaySamples - spreadOffsetL * maxModSamples * 0.3f);
                float delayedR = readDelay(delayBufR[t], delaySamples + spreadOffsetR * maxModSamples * 0.3f);

                sumL += delayedL * tapGains[t];
                sumR += delayedR * tapGains[t];
            }

            // Normalize 3-tap sum
            float normFactor = 1.0f / (float)kNumTaps;
            sumL *= normFactor;
            sumR *= normFactor;

            // Input with feedback
            float inputL = dryL + feedbackL * paramFeedback;
            float inputR = dryR + feedbackR * paramFeedback;

            // Write to all 3 delay buffers (same input, different modulation reads)
            for (int t = 0; t < kNumTaps; ++t)
            {
                delayBufL[t][delayWPos] = inputL;
                delayBufR[t][delayWPos] = inputR;
            }
            delayWPos = (delayWPos + 1) & delayMask;

            // Update feedback
            feedbackL = sumL;
            feedbackR = sumR;

            // Mix dry/wet
            float wetL = sumL;
            float wetR = sumR;
            outL[s] = dryL * (1.0f - paramMix) + wetL * paramMix;
            outR[s] = dryR * (1.0f - paramMix) + wetR * paramMix;
        }
    }
}