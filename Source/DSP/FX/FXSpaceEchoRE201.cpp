#include "FXSpaceEchoRE201.h"
#include <algorithm>
#include <cmath>

namespace ABD
{
    FXSpaceEchoRE201::FXSpaceEchoRE201()
    {
        delayBufL.resize(kMaxDelay + 1, 0.0f);
        delayBufR.resize(kMaxDelay + 1, 0.0f);
        delayMask = kMaxDelay;

        reverbBufL.resize(kReverbSize + 1, 0.0f);
        reverbBufR.resize(kReverbSize + 1, 0.0f);
        reverbMask = kReverbSize;

        // RE-201 head configurations (normalized 0-1 within delay range)
        // Mode A: head1 only; B: head1+2; C: head1+3; D: head2+3; E: all three
        modeConfigs[0] = { 0.33f, 0.0f,  0.0f,  1.0f, 0.0f, 0.0f,  0.2f };
        modeConfigs[1] = { 0.25f, 0.50f, 0.0f,  0.8f, 0.7f, 0.0f,  0.3f };
        modeConfigs[2] = { 0.20f, 0.0f,  0.65f, 0.9f, 0.0f, 0.6f,  0.25f };
        modeConfigs[3] = { 0.0f,  0.35f, 0.55f, 0.0f, 0.8f, 0.7f,  0.35f };
        modeConfigs[4] = { 0.15f, 0.35f, 0.60f, 0.7f, 0.7f, 0.6f,  0.4f };

        std::fill(&heads[0], &heads[3], Head{ 0.0f, 0.0f, 0.0f });
    }

    void FXSpaceEchoRE201::prepare(double sr, int /*spb*/)
    {
        sampleRate = sr;
        std::fill(delayBufL.begin(), delayBufL.end(), 0.0f);
        std::fill(delayBufR.begin(), delayBufR.end(), 0.0f);
        std::fill(reverbBufL.begin(), reverbBufL.end(), 0.0f);
        std::fill(reverbBufR.begin(), reverbBufR.end(), 0.0f);
        writePos = 0;
        reverbWPos = 0;
        reverbLP = 0.0f;
        tapeWow = 0.0f;
        tapeFlutter = 0.0f;
    }

    void FXSpaceEchoRE201::reset()
    {
        std::fill(delayBufL.begin(), delayBufL.end(), 0.0f);
        std::fill(delayBufR.begin(), delayBufR.end(), 0.0f);
        std::fill(reverbBufL.begin(), reverbBufL.end(), 0.0f);
        std::fill(reverbBufR.begin(), reverbBufR.end(), 0.0f);
        writePos = 0;
        reverbWPos = 0;
    }

    void FXSpaceEchoRE201::setParameter(int index, float value)
    {
        float v = std::clamp(value, 0.0f, 1.0f);
        switch (index)
        {
            case 0: paramMode = v; break;
            case 1: paramTime = v; break;
            case 2: paramFeedback = v; break;
            case 3: paramBass = v; break;
            case 4: paramTreble = v; break;
            case 5: paramReverb = v; break;
            default: break;
        }
    }

    float FXSpaceEchoRE201::tapeNoise()
    {
        noiseSeed = noiseSeed * 1664525u + 1013904223u;
        return ((int32_t)noiseSeed) * (1.0f / 2147483648.0f) * 0.02f;
    }

    float FXSpaceEchoRE201::readTape(const std::vector<float>& buf, float delaySamples) const
    {
        float readPos = (float)writePos - delaySamples;
        if (readPos < 0.0f) readPos += (float)(delayMask + 1);
        int idx0 = (int)readPos;
        float frac = readPos - (float)idx0;
        idx0 &= delayMask;
        int idx1 = (idx0 + 1) & delayMask;
        return buf[idx0] + frac * (buf[idx1] - buf[idx0]);
    }

    void FXSpaceEchoRE201::applyToneControl(float& /*bass*/, float& /*treble*/)
    {
        // Simple shelving tone applied in process
    }

    void FXSpaceEchoRE201::process(const float* inL, const float* inR,
                                     float* outL, float* outR,
                                     int numSamples)
    {
        int modeIdx = std::clamp((int)(paramMode * 4.99f), 0, 4);
        const ModeConfig& mc = modeConfigs[modeIdx];

        // Delay time: 120ms to 1500ms
        float maxDelay = std::min((float)(kMaxDelay - 1),
                                   (float)(sampleRate * 1.5));
        float baseDelay = 0.12f + paramTime * 1.38f;
        float delaySec = baseDelay * (maxDelay / (float)sampleRate);
        float delaySamps = delaySec * (float)sampleRate;

        float fb = paramFeedback * 0.85f;
        float reverbMix = paramReverb;

        // Tone control coefficients (simple biquad shelving)
        float bassGain = 0.5f + paramBass * 0.5f;  // 0.5-1.0
        float trebleGain = 0.5f + paramTreble * 0.5f;
        float toneFreq = 800.0f;
        float a = std::exp(-2.0f * 3.14159265f * toneFreq / (float)sampleRate);
        float bCoeff = 1.0f - a;

        // Head configurations
        heads[0] = { mc.head1Pos * delaySamps, mc.head1Gain, mc.head1Gain * 0.95f };
        heads[1] = { mc.head2Pos * delaySamps, mc.head2Gain, mc.head2Gain * 0.90f };
        heads[2] = { mc.head3Pos * delaySamps, mc.head3Gain, mc.head3Gain * 0.92f };

        for (int i = 0; i < numSamples; ++i)
        {
            float inSampleL = inL[i];
            float inSampleR = inR[i];

            // Tape wow (slow drift) and flutter (fast modulation)
            tapeWow += 0.001f * ((tapeNoise() > 0.0f ? 1.0f : -1.0f) - tapeWow);
            tapeFlutter = 0.3f * std::sin((float)writePos * 0.0013f)
                        + 0.15f * std::sin((float)writePos * 0.0037f);

            float wowMod = 1.0f + tapeWow * 0.015f + tapeFlutter * 0.005f;

            // Write to delay line with feedback
            float fbL = 0.0f, fbR = 0.0f;
            for (int h = 0; h < 3; ++h)
            {
                if (heads[h].gainL > 0.001f || heads[h].gainR > 0.001f)
                {
                    float hd = heads[h].delayFrac * wowMod;
                    fbL += readTape(delayBufL, hd) * heads[h].gainL;
                    fbR += readTape(delayBufR, hd) * heads[h].gainR;
                }
            }

            // Feedback from summed heads
            float feedL = fbL * fb + tapeNoise();
            float feedR = fbR * fb + tapeNoise();

            // Tone control (simple low-shelf / high-shelf approximation)
            float tonalL = feedL * (feedL > 0 ? bassGain : trebleGain);
            float tonalR = feedR * (feedR > 0 ? bassGain : trebleGain);

            float writeL = inSampleL + tonalL;
            float writeR = inSampleR + tonalR;

            delayBufL[writePos] = writeL;
            delayBufR[writePos] = writeR;
            writePos = (writePos + 1) & delayMask;

            // Simple reverb tank
            float revIn = (fbL + fbR) * 0.5f;
            float revReadL = reverbBufL[(reverbWPos - (int)(sampleRate * 0.08f) + reverbMask + 1) & reverbMask];
            float revReadR = reverbBufR[(reverbWPos - (int)(sampleRate * 0.11f) + reverbMask + 1) & reverbMask];
            float revDiff = (revReadL + revReadR) * 0.5f;
            float revNew = revIn * 0.4f - revDiff * 0.35f;
            reverbLP += bCoeff * (revNew - reverbLP);
            reverbBufL[reverbWPos] = reverbLP + tapeNoise() * 0.5f;
            reverbBufR[reverbWPos] = reverbLP * 0.97f + tapeNoise() * 0.5f;
            reverbWPos = (reverbWPos + 1) & reverbMask;

            // Output mix: dry + heads + reverb
            float dryGain = 0.75f;
            outL[i] = inSampleL * dryGain + fbL * 0.4f + revReadL * reverbMix;
            outR[i] = inSampleR * dryGain + fbR * 0.4f + revReadR * reverbMix;
        }
    }
}
