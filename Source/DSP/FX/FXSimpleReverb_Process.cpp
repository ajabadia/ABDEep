/**
 * @purpose DSP audio processing kernel for FXSimpleReverb.
 * Contains the hot-path methods: processComb(), processAllPass(), and process().
 */
#include "FXSimpleReverb.h"

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

namespace ABD
{

    float FXSimpleReverb::processComb(CombFilter& comb, float input)
    {
        int readPos = comb.writePos;
        float output = comb.buffer[readPos];

        // Low-pass damping in feedback
        comb.filterState = output * comb.damp1 + comb.filterState * comb.damp2;

        // Write: input + damped feedback
        comb.buffer[comb.writePos] = input + comb.filterState * comb.feedback;

        // Advance pointer
        comb.writePos = (comb.writePos + 1) % comb.bufferSize;

        return output;
    }

    float FXSimpleReverb::processAllPass(AllPassFilter& ap, float input)
    {
        int readPos = ap.writePos;
        float bufOut = ap.buffer[readPos];
        float output = -input + bufOut;
        ap.buffer[ap.writePos] = input + bufOut * ap.gain;
        ap.writePos = (ap.writePos + 1) % ap.bufferSize;
        return output;
    }

    void FXSimpleReverb::process(const float* inL, const float* inR,
                                  float* outL, float* outR,
                                  int numSamples)
    {
        for (int s = 0; s < numSamples; ++s)
        {
            // Pre-delay
            float wetL = inL[s];
            float wetR = inR[s];

            if (preDelaySamples > 0)
            {
                int preDelayReadPos = preDelayWritePos - preDelaySamples;
                if (preDelayReadPos < 0)
                    preDelayReadPos += (int)(sampleRate * 0.2);

                float* preData = preDelayBuffer.getWritePointer(0);
                wetL = preData[preDelayReadPos];
                wetR = preData[preDelayReadPos];
                preData[preDelayWritePos] = (inL[s] + inR[s]) * 0.5f;
                preDelayWritePos = (preDelayWritePos + 1) % (int)(sampleRate * 0.2);
            }

            // Reverse: inverted phase (gated is handled by reverbScale below)
            if (reverbType == 6)
                wetL = -wetL;

            // Process comb filters in parallel
            float combSumL = 0.0f, combSumR = 0.0f;
            for (int i = 0; i < 4; ++i)
            {
                combSumL += processComb(combL[i], wetL);
                combSumR += processComb(combR[i], wetR);
            }
            combSumL *= 0.25f; // Average
            combSumR *= 0.25f;

            // Process all-pass filters in series
            for (int i = 0; i < 3; ++i)
            {
                combSumL = processAllPass(allpassL[i], combSumL);
                combSumR = processAllPass(allpassR[i], combSumR);
            }

            // Scale by decay (gated: short decay)
            float reverbScale = (decay < 0) ? 0.5f : decay * 0.7f + 0.3f;

            // 100% wet (the FXSlot handles dry/wet mix)
            outL[s] = combSumL * reverbScale;
            outR[s] = combSumR * reverbScale;
        }
    }

} // namespace ABD
