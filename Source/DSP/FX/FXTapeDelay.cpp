#include "FXTapeDelay.h"
#include <cmath>
#include <algorithm>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

namespace ABD
{
    FXTapeDelay::FXTapeDelay() { reset(); }

    void FXTapeDelay::prepare(double sr, int)
    {
        sampleRate = std::max(1.0, sr);
        maxDelaySamples = (int)(sampleRate * 2.0); // 2s max
        bufL.setSize(1, maxDelaySamples);
        bufR.setSize(1, maxDelaySamples);
        bufL.clear(); bufR.clear();
        writePosL = writePosR = 0;
        updateDelay();
    }

    void FXTapeDelay::setParameter(int idx, float v)
    {
        v = std::clamp(v, 0.0f, 1.0f);
        switch (idx)
        {
            case 0: mix = v; break;
            case 1: delayPct = v; updateDelay(); break;
            case 2: sustain = v; break;
            case 3: wobble = v; break;
            case 4: tone = v; break;
        }
    }

    void FXTapeDelay::reset()
    {
        bufL.clear(); bufR.clear();
        writePosL = writePosR = 0;
        satState = 0.0f;
        lpfL = lpfR = 0.0f;
        lfoPhase = 0.0;
    }

    void FXTapeDelay::updateDelay()
    {
        // 0-100% → 20ms - 1500ms
        float ms = 20.0f + 1480.0f * delayPct;
        delaySamples = (int)(sampleRate * ms / 1000.0);
        delaySamples = std::max(1, std::min(delaySamples, maxDelaySamples - 1));
        lfoInc = (4.0 + wobble * 2.0) / sampleRate; // 4-6 Hz wobble
        toneCoeff = (float)((tone * 19000.0f + 1000.0f) / ((tone * 19000.0f + 1000.0f) + sampleRate * 0.5));
    }

    void FXTapeDelay::process(const float* inL, const float* inR,
                               float* outL, float* outR, int numSamples)
    {
        float* dL = bufL.getWritePointer(0);
        float* dR = bufR.getWritePointer(0);
        float wetMix = mix;
        float susGain = sustain * 0.97f;

        for (int s = 0; s < numSamples; ++s)
        {
            // Wow/flutter: modula la velocidad de lectura
            lfoPhase += lfoInc;
            if (lfoPhase >= 1.0) lfoPhase -= 1.0;
            float wob = (float)std::sin(2.0 * M_PI * lfoPhase) * wobble * 0.03f;

            // Tape saturation (soft clip)
            float satL = std::tanh(inL[s] * 1.2f) * 0.85f;
            float satR = std::tanh(inR[s] * 1.2f) * 0.85f;

            // Wobble delay read position (interpolated)
            float baseDelay = (float)delaySamples;
            float wobOffset = wob * (float)delaySamples;
            float readPosL = (float)writePosL - baseDelay - wobOffset;
            if (readPosL < 0) readPosL += (float)maxDelaySamples;
            int idxL = (int)readPosL;
            int nextL = (idxL + 1) % maxDelaySamples;
            float fracL = readPosL - (float)idxL;
            float delayedL = dL[idxL] * (1.0f - fracL) + dL[nextL] * fracL;

            float readPosR = (float)writePosR - baseDelay - wobOffset;
            if (readPosR < 0) readPosR += (float)maxDelaySamples;
            int idxR = (int)readPosR;
            int nextR = (idxR + 1) % maxDelaySamples;
            float fracR = readPosR - (float)idxR;
            float delayedR = dR[idxR] * (1.0f - fracR) + dR[nextR] * fracR;

            // Tone filter on feedback
            lpfL += toneCoeff * (delayedL - lpfL);
            lpfR += toneCoeff * (delayedR - lpfR);
            float fbL = lpfL * susGain;
            float fbR = lpfR * susGain;

            // Write to buffer (input + feedback)
            dL[writePosL] = satL + fbL;
            dR[writePosR] = satR + fbR;
            writePosL = (writePosL + 1) % maxDelaySamples;
            writePosR = (writePosR + 1) % maxDelaySamples;

            // Mix
            outL[s] = inL[s] * (1.0f - wetMix) + delayedL * wetMix;
            outR[s] = inR[s] * (1.0f - wetMix) + delayedR * wetMix;
        }
    }
}
