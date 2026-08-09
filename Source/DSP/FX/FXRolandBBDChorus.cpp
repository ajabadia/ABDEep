#include "FXRolandBBDChorus.h"
#include <cmath>

namespace ABD
{
    FXRolandBBDChorus::FXRolandBBDChorus()
    {
        reset();
    }

    void FXRolandBBDChorus::prepare(double sr, int /*samplesPerBlock*/)
    {
        sampleRate = sr;

        // BBD buffer: 4096 samples (~93ms @ 44.1k, más que suficiente)
        auto allocBuf = [](std::vector<float>& buf, int& mask)
        {
            buf.assign(4096, 0.0f);
            mask = (int)buf.size() - 1;
        };
        allocBuf(bbdBuf0, bbdMask0);
        allocBuf(bbdBuf1, bbdMask1);

        noiseHPCoeff = expf(-2.0f * 3.14159265f * 6800.0f / (float)sampleRate);
        noiseLPCoeff = expf(-2.0f * 3.14159265f * 1200.0f / (float)sampleRate);

        configureMode();
    }

    void FXRolandBBDChorus::reset()
    {
        paramMode = 0.0f;
        paramRate = 0.3f;
        paramDepth = 0.5f;
        paramBBDNoise = 0.3f;

        currentMode = 0;
        pendingMode = 0;
        fade = 0.0f;
        fadeTarget = 0.0f;
        fadeInc = 0.0f;
        useSineLFO = false;

        targetDepthMs = kModeIDepthMs;
        smoothDepthMs = kModeIDepthMs;

        lfoPhase = 0.0f;
        lfoInc = 0.0f;

        noiseSeed = 0xDEADBEEFu;
        noiseHPState = 0.0f;
        noiseLPState = 0.0f;

        for (auto* buf : { &bbdBuf0, &bbdBuf1 })
        {
            std::fill(buf->begin(), buf->end(), 0.0f);
        }
        bbdWPos0 = 0;
        bbdWPos1 = 0;
    }

    void FXRolandBBDChorus::setParameter(int index, float value)
    {
        switch (index)
        {
            case 0: // Mode
            {
                float clamped = juce::jlimit(0.0f, 0.999f, value);
                int newMode = (int)(clamped * 4.0f);
                if (newMode != pendingMode)
                {
                    pendingMode = newMode;
                    fadeTarget = 0.0f;
                    fadeInc = -1.0f / (kFadeMs * 0.001f * (float)sampleRate);
                }
                paramMode = clamped;
                break;
            }
            case 1: paramRate = juce::jlimit(0.0f, 1.0f, value); break;
            case 2: paramDepth = juce::jlimit(0.0f, 1.0f, value); break;
            case 3: paramBBDNoise = juce::jlimit(0.0f, 1.0f, value); break;
            default: break;
        }
    }

    void FXRolandBBDChorus::configureMode()
    {
        switch (pendingMode)
        {
            case 0: // Off
                targetDepthMs = 0.0f;
                useSineLFO = false;
                break;
            case 1: // Mode I
                targetDepthMs = kModeIDepthMs;
                useSineLFO = false;
                lfoInc = (float)(2.0 * 3.14159265 * kModeIRate / sampleRate);
                break;
            case 2: // Mode II
                targetDepthMs = kModeIIDepthMs;
                useSineLFO = false;
                lfoInc = (float)(2.0 * 3.14159265 * kModeIIRate / sampleRate);
                break;
            case 3: // Mode I+II
                targetDepthMs = kModeI_IIDepthMs;
                useSineLFO = true;
                lfoInc = (float)(2.0 * 3.14159265 * kModeI_IIRate / sampleRate);
                break;
            default:
                break;
        }
    }

    float FXRolandBBDChorus::lfoTriangle()
    {
        lfoPhase += lfoInc;
        if (lfoPhase > 2.0f * 3.14159265f)
            lfoPhase -= 2.0f * 3.14159265f;
        // Triangle from phase: peaks at pi, zero at 0 and 2pi
        float norm = lfoPhase / (3.14159265f); // 0..2
        if (norm > 1.0f)
            norm = 2.0f - norm;
        return norm * 2.0f - 1.0f; // -1..+1
    }

    float FXRolandBBDChorus::lfoSine()
    {
        lfoPhase += lfoInc;
        if (lfoPhase > 2.0f * 3.14159265f)
            lfoPhase -= 2.0f * 3.14159265f;
        return sinf(lfoPhase);
    }

    float FXRolandBBDChorus::noiseGenerate()
    {
        // 32-bit LCG → float [0, 1)
        noiseSeed = noiseSeed * 1664525u + 1013904223u;
        return (float)(noiseSeed >> 8) / 16777216.0f;
    }

    float FXRolandBBDChorus::hermite(float frac, float y0, float y1, float y2, float y3)
    {
        float c0 = y1;
        float c1 = 0.5f * (y2 - y0);
        float c2 = y0 - 2.5f * y1 + 2.0f * y2 - 0.5f * y3;
        float c3 = 0.5f * (y3 - y0) + 1.5f * (y1 - y2);
        return ((c3 * frac + c2) * frac + c1) * frac + c0;
    }

    float FXRolandBBDChorus::readHermite(const std::vector<float>& buf, int mask, int wPos, float delaySamples) const
    {
        float readPos = (float)wPos - delaySamples;
        if (readPos < 0.0f)
            readPos += (float)(mask + 1);
        int i0 = (int)readPos;
        float frac = readPos - (float)i0;
        i0 &= mask;
        int i1 = (i0 + 1) & mask;
        int i2 = (i1 + 1) & mask;
        int i3 = (i2 + 1) & mask;
        return hermite(frac, buf[i0], buf[i1], buf[i2], buf[i3]);
    }

    void FXRolandBBDChorus::processBBD(std::vector<float>& buf, int& mask, int& wPos,
                                        float input, float delaySamples, float injectedNoise)
    {
        buf[wPos] = input + injectedNoise;
        wPos = (wPos + 1) & mask;
    }

    void FXRolandBBDChorus::process(const float* inL, const float* inR,
                                     float* outL, float* outR,
                                     int numSamples)
    {
        // Fade state machine (crossfade between modes)
        bool modeTransitioning = (fadeTarget < 0.5f && pendingMode != currentMode);
        if (fadeInc < 0.0f && fade <= 0.0f)
        {
            currentMode = pendingMode;
            configureMode();
            fadeInc = 1.0f / (kFadeMs * 0.001f * (float)sampleRate);
            fadeTarget = 1.0f;
        }

        float depthMs = smoothDepthMs;

        for (int i = 0; i < numSamples; ++i)
        {
            float inSampleL = inL[i];
            float inSampleR = inR[i];

            // Mode transition crossfade
            if (modeTransitioning)
            {
                fade += fadeInc;
                if (fade >= 1.0f)
                {
                    fade = 1.0f;
                    fadeInc = 0.0f;
                    fadeTarget = 1.0f;
                    modeTransitioning = false;
                }
            }

            // Smooth depth toward target
            depthMs += (targetDepthMs - depthMs) * 0.001f;

            // LFO value (triangle for modes I/II, sine for I+II)
            float lfoVal = useSineLFO ? lfoSine() : lfoTriangle();

            // Scale depth by user param (0.75 of max for control range)
            float depthScaled = depthMs * paramDepth * 0.75f;

            // Modulate center delay by depth + LFO
            float delayMs = kCenterDelayMs + lfoVal * depthScaled;
            if (delayMs < kMinDelayMs)
                delayMs = kMinDelayMs;
            float delaySamples = delayMs * 0.001f * (float)sampleRate;

            // Per-BBD clock trim: BBD1 slightly faster, BBD2 slightly slower
            float trim0 = 1.0f + kBBDClockTrim * 0.5f;
            float trim1 = 1.0f - kBBDClockTrim * 0.5f;
            float delaySamples0 = delaySamples * trim0;
            float delaySamples1 = delaySamples * trim1;

            // BBD noise injection (charge-transfer)
            float noiseRaw = noiseGenerate();
            float noiseCentered = noiseRaw - 0.5f;
            noiseHPState = noiseHPState * noiseHPCoeff + noiseCentered * (1.0f - noiseHPCoeff);
            float noiseFiltered = noiseHPState;
            noiseLPState = noiseLPState * noiseLPCoeff + noiseFiltered * (1.0f - noiseLPCoeff);
            float noiseVal = noiseLPState * paramBBDNoise * 0.03f;

            // Write input into BBD buffers (mono sum, same as KR106)
            float monoIn = (inSampleL + inSampleR) * 0.5f;
            processBBD(bbdBuf0, bbdMask0, bbdWPos0, monoIn, 0.0f, noiseVal);
            processBBD(bbdBuf1, bbdMask1, bbdWPos1, monoIn, 0.0f, -noiseVal);

            // Read with modulation delay
            float delayedL = readHermite(bbdBuf0, bbdMask0, bbdWPos0, delaySamples0);
            float delayedR = readHermite(bbdBuf1, bbdMask1, bbdWPos1, delaySamples1);

            // Mix dry + wet (IC6 gains)
            float dryL = inSampleL * kDryGain;
            float dryR = inSampleR * kDryGain;
            float wetL = delayedL * kWetGain;
            float wetR = delayedR * kWetGain;

            // Mode crossfade
            float mixL = dryL + wetL * fade;
            float mixR = dryR + wetR * fade;

            // Soft-clip output
            mixL = tanhf(mixL);
            mixR = tanhf(mixR);

            outL[i] = mixL;
            outR[i] = mixR;
        }
    }
}