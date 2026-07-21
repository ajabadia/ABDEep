#include "FXMultiTapDelay.h"
#include <cmath>
#include <algorithm>

namespace ABD
{
    static float getFactorFromEnum(int index)
    {
        switch (index)
        {
            case 0: return 0.25f;   // 1/4
            case 1: return 0.375f;  // 3/8
            case 2: return 0.5f;    // 1/2
            case 3: return 0.6667f; // 2/3
            case 4: return 1.0f;    // 1
            case 5: return 1.3333f; // 4/3
            case 6: return 1.5f;    // 3/2
            case 7: return 2.0f;    // 2
            case 8: return 3.0f;    // 3
            default: return 1.0f;
        }
    }

    FXMultiTapDelay::FXMultiTapDelay(int numTapsVal) : numTaps(numTapsVal)
    {
        taps[0] = { 1.0f, 0.7f, 0.0f };   // Tap 1
        taps[1] = { 0.5f, 0.5f, -0.5f };  // Tap 2
        taps[2] = { 0.75f, 0.5f, 0.5f };  // Tap 3
        taps[3] = { 1.5f, 0.3f, 0.0f };   // Tap 4
        reset();
    }

    void FXMultiTapDelay::prepare(double newSampleRate, int samplesPerBlock)
    {
        sampleRate = std::max(1.0, newSampleRate);
        
        // Máximo delay base de 1.5s * factor máximo 3.0 = 4.5s
        maxDelaySamples = (int)(sampleRate * 4.6);
        delayBufferL.setSize(1, maxDelaySamples);
        delayBufferR.setSize(1, maxDelaySamples);
        
        reset();
    }

    void FXMultiTapDelay::setParameter(int index, float value)
    {
        value = std::clamp(value, 0.0f, 1.0f);

        if (numTaps == 3)
        {
            switch (index)
            {
                case 0: masterTime = value; break; // time
                case 1: taps[0].gain = value; break; // gainT
                case 2: taps[0].pan = (value - 0.5f) * 2.0f; break; // panT
                case 3: feedback = value; break; // feedback
                case 4: taps[1].factor = getFactorFromEnum((int)(value * 8.9f)); break; // factorA
                case 5: taps[1].gain = value; break; // gainA
                case 6: taps[1].pan = (value - 0.5f) * 2.0f; break; // panA
                case 7: taps[2].factor = getFactorFromEnum((int)(value * 8.9f)); break; // factorB
                case 8: taps[2].gain = value; break; // gainB
                case 9: taps[2].pan = (value - 0.5f) * 2.0f; break; // panB
                case 10: xFeed = (value > 0.5f); break; // x-feed
                case 11: mix = value; break; // mix
            }
        }
        else // 4-Tap
        {
            switch (index)
            {
                case 0: masterTime = value; break; // time
                case 1: taps[0].gain = value; break; // gain
                case 2: feedback = value; break; // feedback
                case 3: spread = value; break; // spread
                case 4: taps[1].factor = getFactorFromEnum((int)(value * 8.9f)); break; // factorA
                case 5: taps[1].gain = value; break; // gainA
                case 6: taps[2].factor = getFactorFromEnum((int)(value * 8.9f)); break; // factorB
                case 7: taps[2].gain = value; break; // gainB
                case 8: taps[3].factor = getFactorFromEnum((int)(value * 8.9f)); break; // factorC
                case 9: taps[3].gain = value; break; // gainC
                case 10: xFeed = (value > 0.5f); break; // x-feed
                case 11: mix = value; break; // mix
            }
            
            // Distribuir el paneo de los 4 taps de acuerdo a spread
            taps[0].pan = -spread;
            taps[1].pan = -spread * 0.33f;
            taps[2].pan = spread * 0.33f;
            taps[3].pan = spread;
        }
    }

    void FXMultiTapDelay::reset()
    {
        delayBufferL.clear();
        delayBufferR.clear();
        writePos = 0;
    }

    juce::String FXMultiTapDelay::getEffectName() const
    {
        return (numTaps == 3) ? "3-Tap Delay" : "4-Tap Delay";
    }

    void FXMultiTapDelay::process(const float* inL, const float* inR,
                                 float* outL, float* outR, int numSamples)
    {
        float* delayDataL = delayBufferL.getWritePointer(0);
        float* delayDataR = delayBufferR.getWritePointer(0);

        // Mapear tiempo base: 1ms a 1500ms
        float baseTimeMs = 1.0f + masterTime * 1499.0f;
        float baseDelaySamples = (float)(sampleRate * 0.001f * baseTimeMs);

        int activeTaps = (numTaps == 3) ? 3 : 4;

        for (int s = 0; s < numSamples; ++s)
        {
            float dryL = inL[s];
            float dryR = inR[s];

            float accumL = 0.0f;
            float accumR = 0.0f;

            // Leer de los diferentes taps
            for (int t = 0; t < activeTaps; ++t)
            {
                float delaySamples = baseDelaySamples * taps[t].factor;
                float readPos = (float)writePos - delaySamples;
                
                while (readPos < 0.0f) readPos += (float)maxDelaySamples;
                while (readPos >= (float)maxDelaySamples) readPos -= (float)maxDelaySamples;

                // Interpolación lineal
                int idx = (int)readPos;
                int nextIdx = (idx + 1) % maxDelaySamples;
                float frac = readPos - (float)idx;

                float tapValL = delayDataL[idx] * (1.0f - frac) + delayDataL[nextIdx] * frac;
                float tapValR = delayDataR[idx] * (1.0f - frac) + delayDataR[nextIdx] * frac;

                // Paneo
                float panVal = taps[t].pan;
                float gainL = std::clamp(1.0f - panVal, 0.0f, 1.0f) * taps[t].gain;
                float gainR = std::clamp(1.0f + panVal, 0.0f, 1.0f) * taps[t].gain;

                accumL += tapValL * gainL;
                accumR += tapValR * gainR;
            }

            // Realimentación (Feedback)
            float fbInL = dryL;
            float fbInR = dryR;

            // Leer último tap para el feedback loop
            float lastTapL = 0.0f;
            float lastTapR = 0.0f;
            {
                float delaySamples = baseDelaySamples * taps[activeTaps - 1].factor;
                float readPos = (float)writePos - delaySamples;
                if (readPos < 0.0f) readPos += (float)maxDelaySamples;
                int idx = (int)readPos;
                lastTapL = delayDataL[idx];
                lastTapR = delayDataR[idx];
            }

            if (xFeed)
            {
                fbInL += lastTapR * feedback;
                fbInR += lastTapL * feedback;
            }
            else
            {
                fbInL += lastTapL * feedback;
                fbInR += lastTapR * feedback;
            }

            delayDataL[writePos] = fbInL;
            delayDataR[writePos] = fbInR;

            writePos = (writePos + 1) % maxDelaySamples;

            // Dry/Wet
            outL[s] = dryL * (1.0f - mix) + accumL * mix;
            outR[s] = dryR * (1.0f - mix) + accumR * mix;
        }
    }
}
