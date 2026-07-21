#include "FXDecimDelay.h"
#include <cmath>
#include <algorithm>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

namespace ABD
{
    FXDecimDelay::FXDecimDelay() { reset(); }

    void FXDecimDelay::prepare(double sr, int)
    {
        sampleRate = std::max(1.0, sr);
        maxDelaySamples = (int)(sampleRate * 1.6); // 1600ms safety
        bufL.setSize(1, maxDelaySamples);
        bufR.setSize(1, maxDelaySamples);
        bufL.clear(); bufR.clear();
        writePosL = writePosR = 0;
        updateDelaySamples();
        updateDecimParams();
    }

    void FXDecimDelay::setParameter(int idx, float v)
    {
        v = std::clamp(v, 0.0f, 1.0f);
        switch (idx)
        {
            case 0: mix = v; break;
            case 1: timeMs = v; updateDelaySamples(); break;
            case 2: downSamp = v; updateDecimParams(); break;
            case 3: factorL = (int)(v * 8.99f); updateDelaySamples(); break;
            case 4: factorR = (int)(v * 8.99f); updateDelaySamples(); break;
            case 5: bitReduce = v; updateDecimParams(); break;
            case 6: cutoff = v; break;
            case 7: resonance = v; break;
            case 8: filterType = (int)(v * 3.99f); break;
            case 9: feedL = v; break;
            case 10: feedR = v; break;
            case 11: decimatePre = (v < 0.5f); break;
        }
    }

    void FXDecimDelay::reset()
    {
        bufL.clear(); bufR.clear();
        writePosL = writePosR = 0;
        decimCounterL = decimCounterR = 0;
        lastSampleL = lastSampleR = 0.0f;
        svfLowL = svfLowR = svfBandL = svfBandR = svfHighL = svfHighR = 0.0f;
    }

    void FXDecimDelay::updateDelaySamples()
    {
        float baseMs = 1.0f + 1499.0f * timeMs;
        delaySamplesL = (int)(sampleRate * baseMs / 1000.0 * factorTab[factorL]);
        delaySamplesR = (int)(sampleRate * baseMs / 1000.0 * factorTab[factorR]);
        delaySamplesL = std::max(1, std::min(delaySamplesL, maxDelaySamples - 1));
        delaySamplesR = std::max(1, std::min(delaySamplesR, maxDelaySamples - 1));
    }

    void FXDecimDelay::updateDecimParams()
    {
        decimRateL = (int)(1.0f + downSamp * 99.0f);
        decimRateR = (int)(1.0f + downSamp * 99.0f);
        int bits = (int)(1.0f + (1.0f - bitReduce) * 23.0f);
        bitMask = (1 << bits) - 1;
    }

    float FXDecimDelay::applyDecim(float sample)
    {
        if (bitMask < 0xFFFFFF)
        {
            float quant = std::floor(sample * 8388607.0f + 0.5f) / 8388607.0f;
            int intVal = (int)(quant * (float)bitMask);
            sample = (float)intVal / (float)bitMask;
        }
        return sample;
    }

    void FXDecimDelay::process(const float* inL, const float* inR,
                                float* outL, float* outR, int numSamples)
    {
        float* dL = bufL.getWritePointer(0);
        float* dR = bufR.getWritePointer(0);
        float wetMix = mix;

        for (int s = 0; s < numSamples; ++s)
        {
            float dryL = inL[s], dryR = inR[s];
            float wetL, wetR;

            // Decimación PRE (entrada)
            float procL = decimatePre ? applyDecim(dryL) : dryL;
            float procR = decimatePre ? applyDecim(dryR) : dryR;

            // Downsample
            decimCounterL++; decimCounterR++;
            if (decimCounterL >= decimRateL) { lastSampleL = procL; decimCounterL = 0; }
            if (decimCounterR >= decimRateR) { lastSampleR = procR; decimCounterR = 0; }
            procL = lastSampleL; procR = lastSampleR;

            // SVF filter
            float freqHz = 30.0f * std::pow(666.0f, cutoff);
            freqHz = std::clamp(freqHz, 20.0f, (float)(sampleRate / 6.5));
            float wd = (float)(2.0 * M_PI * freqHz / sampleRate);
            gCoeff = std::tan(wd * 0.5f);
            rCoeff = 1.0f / std::max(1.0f - resonance * 0.95f, 0.01f);
            // Clamp damping to prevent SVF instability: g*r must stay below 2
            float maxR = 2.0f / std::max(gCoeff, 0.001f);
            rCoeff = std::min(rCoeff, maxR);

            auto svf = [&](float in, float& low, float& band, float& high) {
                high = in - low - rCoeff * band;
                band = band + gCoeff * high;
                low = low + gCoeff * band;
            };
            svf(procL, svfLowL, svfBandL, svfHighL);
            svf(procR, svfLowR, svfBandR, svfHighR);

            float filtL, filtR;
            switch (filterType)
            {
                case 0: filtL = svfLowL;  filtR = svfLowR;  break;
                case 1: filtL = svfHighL; filtR = svfHighR; break;
                case 2: filtL = svfBandL; filtR = svfBandR; break;
                default: filtL = svfLowL + svfHighL; filtR = svfLowR + svfHighR; break;
            }

            // Decimación POST (delay)
            float delayInL = decimatePre ? filtL : applyDecim(filtL);
            float delayInR = decimatePre ? filtR : applyDecim(filtR);

            // Leer delay
            int readPosL = writePosL - delaySamplesL;
            if (readPosL < 0) readPosL += maxDelaySamples;
            float delayedL = dL[readPosL];
            int readPosR = writePosR - delaySamplesR;
            if (readPosR < 0) readPosR += maxDelaySamples;
            float delayedR = dR[readPosR];

            // Escribir con feedback
            dL[writePosL] = delayInL + delayedL * feedL * 0.95f;
            dR[writePosR] = delayInR + delayedR * feedR * 0.95f;
            writePosL = (writePosL + 1) % maxDelaySamples;
            writePosR = (writePosR + 1) % maxDelaySamples;

            // Mix
            wetL = dryL * (1.0f - wetMix) + delayedL * wetMix;
            wetR = dryR * (1.0f - wetMix) + delayedR * wetMix;
            outL[s] = wetL; outR[s] = wetR;
        }
    }
}
