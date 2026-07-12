#include "FXFlanger.h"
#include <cmath>
#include <algorithm>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

namespace ABD
{
    FXFlanger::FXFlanger()
    {
        reset();
    }

    void FXFlanger::prepare(double newSampleRate, int samplesPerBlock)
    {
        sampleRate = std::max(1.0, newSampleRate);
        maxDelaySamples = (int)(sampleRate * 0.02); // 20ms máx
        delayBufferL.setSize(1, maxDelaySamples);
        delayBufferR.setSize(1, maxDelaySamples);
        delayBufferL.clear();
        delayBufferR.clear();
        writePosL = 0;
        writePosR = 0;
        updateLFOIncrement();
    }

    void FXFlanger::setParameter(int index, float value)
    {
        value = std::clamp(value, 0.0f, 1.0f);
        switch (index)
        {
            case 0: rate = value; updateLFOIncrement(); break;
            case 1: depth = value; break;
            case 2: feedback = value; break;
            case 3: baseDelay = value; break;
        }
    }

    void FXFlanger::reset()
    {
        delayBufferL.clear();
        delayBufferR.clear();
        writePosL = 0;
        writePosR = 0;
        lfoPhaseL = 0.0;
        lfoPhaseR = 0.25;
    }

    void FXFlanger::updateLFOIncrement()
    {
        float freqHz = 0.05f + 7.95f * rate;
        lfoPhaseInc = freqHz / sampleRate;
    }

    void FXFlanger::process(const float* inL, const float* inR,
                             float* outL, float* outR,
                             int numSamples)
    {
        float* dL = delayBufferL.getWritePointer(0);
        float* dR = delayBufferR.getWritePointer(0);

        float maxDepthSamp = (float)(sampleRate * 0.005 * depth);
        float baseSamp = (float)(sampleRate * 0.003 * baseDelay);

        for (int s = 0; s < numSamples; ++s)
        {
            lfoPhaseL += lfoPhaseInc;
            if (lfoPhaseL >= 1.0) lfoPhaseL -= 1.0;
            lfoPhaseR += lfoPhaseInc;
            if (lfoPhaseR >= 1.0) lfoPhaseR -= 1.0;

            float dryL = inL[s];
            float dryR = inR[s];

            // LFO sinusoidal para delay modulation
            float modL = (float)std::sin(2.0 * M_PI * lfoPhaseL);
            float modR = (float)std::sin(2.0 * M_PI * lfoPhaseR);

            float delaySampL = baseSamp + (modL + 1.0f) * 0.5f * maxDepthSamp;
            float delaySampR = baseSamp + (modR + 1.0f) * 0.5f * maxDepthSamp;

            // Leer delay con interpolación lineal
            float readPosL = (float)writePosL - delaySampL;
            if (readPosL < 0) readPosL += (float)maxDelaySamples;
            int idxL = (int)readPosL;
            int nextL = (idxL + 1) % maxDelaySamples;
            float fracL = readPosL - (float)idxL;
            float delayedL = dL[idxL] * (1.0f - fracL) + dL[nextL] * fracL;

            float readPosR = (float)writePosR - delaySampR;
            if (readPosR < 0) readPosR += (float)maxDelaySamples;
            int idxR = (int)readPosR;
            int nextR = (idxR + 1) % maxDelaySamples;
            float fracR = readPosR - (float)idxR;
            float delayedR = dR[idxR] * (1.0f - fracR) + dR[nextR] * fracR;

            // Escribir en buffer: entrada + feedback con fase invertida (flanger característico)
            dL[writePosL] = dryL + delayedL * -feedback;
            dR[writePosR] = dryR + delayedR * -feedback;

            writePosL = (writePosL + 1) % maxDelaySamples;
            writePosR = (writePosR + 1) % maxDelaySamples;

            // 100% wet (slot maneja la mezcla)
            outL[s] = delayedL;
            outR[s] = delayedR;
        }
    }
}
