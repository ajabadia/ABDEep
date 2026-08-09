#include "FXGranularDelay.h"
#include <algorithm>
#include <cmath>

namespace ABD
{
    FXGranularDelay::FXGranularDelay()
    {
        captureBufL.resize(kCaptureSize + 1, 0.0f);
        captureBufR.resize(kCaptureSize + 1, 0.0f);
        captureMask = kCaptureSize;

        for (auto& g : grains) { g.active = false; g.age = 0; g.maxAge = 1; }
    }

    void FXGranularDelay::prepare(double sr, int /*spb*/)
    {
        sampleRate = sr;
        std::fill(captureBufL.begin(), captureBufL.end(), 0.0f);
        std::fill(captureBufR.begin(), captureBufR.end(), 0.0f);
        capturePos = 0;
        grainAccum = 0.0f;
        for (auto& g : grains) { g.active = false; g.age = 0; g.maxAge = 1; }
    }

    void FXGranularDelay::reset()
    {
        std::fill(captureBufL.begin(), captureBufL.end(), 0.0f);
        std::fill(captureBufR.begin(), captureBufR.end(), 0.0f);
        capturePos = 0;
        grainAccum = 0.0f;
        for (auto& g : grains) { g.active = false; g.age = 0; g.maxAge = 1; }
    }

    void FXGranularDelay::setParameter(int index, float value)
    {
        float v = std::clamp(value, 0.0f, 1.0f);
        switch (index)
        {
            case 0: paramMix = v; break;
            case 1: paramTime = v; break;
            case 2: paramDensity = v; break;
            case 3: paramSize = v; break;
            case 4: paramPitch = v; break;
            default: break;
        }
    }

    float FXGranularDelay::noiseGenerate()
    {
        noiseSeed = noiseSeed * 1664525u + 1013904223u;
        return ((int32_t)noiseSeed) * (1.0f / 2147483648.0f) * 0.01f;
    }

    float FXGranularDelay::grainEnvelope(float age, float maxAge, float softness) const
    {
        float t = age / maxAge;
        if (t < 0.0f || t > 1.0f) return 0.0f;
        // Raised cosine window (softness controls width)
        float windowWidth = 0.3f + softness * 0.7f;
        float center = 0.5f;
        float dist = std::abs(t - center) / (windowWidth * 0.5f);
        return std::clamp(1.0f - dist, 0.0f, 1.0f);
    }

    void FXGranularDelay::process(const float* inL, const float* inR,
                                    float* outL, float* outR,
                                    int numSamples)
    {
        // Grain window size: 20ms to 200ms
        float grainSizeMs = 20.0f + paramTime * 180.0f;
        float grainSizeSamps = grainSizeMs * (float)sampleRate * 0.001f;
        float grainRate = 1.0f + paramDensity * 4.0f;  // grains per grain-size window
        float softness = paramSize;
        float pitchSpread = paramPitch * 12.0f;  // ±12 semitones

        float outSumL = 0.0f;
        float outSumR = 0.0f;

        for (int i = 0; i < numSamples; ++i)
        {
            // Capture input
            captureBufL[capturePos] = inL[i];
            captureBufR[capturePos] = inR[i];
            capturePos = (capturePos + 1) & captureMask;

            // Accumulate grains
            grainAccum += grainRate;
            while (grainAccum >= grainSizeSamps && grainAccum >= 1.0f)
            {
                grainAccum -= 1.0f;

                // Find free grain slot
                for (auto& g : grains)
                {
                    if (!g.active)
                    {
                        g.active = true;
                        g.age = 0.0f;
                        g.maxAge = grainSizeSamps;
                        g.readPos = (float)capturePos;

                        // Random pitch within spread
                        float semitones = pitchSpread * (noiseGenerate() * 2.0f);
                        g.pitchRatio = std::pow(2.0f, semitones / 12.0f);
                        g.gain = 0.5f + 0.5f * std::abs(noiseGenerate());
                        break;
                    }
                }
            }

            // Sum active grains
            float sumL = 0.0f, sumR = 0.0f;
            for (auto& g : grains)
            {
                if (!g.active) continue;

                float env = grainEnvelope(g.age, g.maxAge, softness);
                int readIdx = ((int)g.readPos) & captureMask;
                float sampL = captureBufL[readIdx];
                float sampR = captureBufR[readIdx];

                sumL += sampL * env * g.gain;
                sumR += sampR * env * g.gain;

                g.readPos += g.pitchRatio;
                g.age += 1.0f;

                if (g.age >= g.maxAge)
                    g.active = false;
            }

            // Mix
            outL[i] = inL[i] * (1.0f - paramMix) + sumL * paramMix;
            outR[i] = inR[i] * (1.0f - paramMix) + sumR * paramMix;
        }
    }
}
