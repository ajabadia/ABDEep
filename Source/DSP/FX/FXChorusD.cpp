#include "FXChorusD.h"
#include <cmath>
#include <algorithm>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

namespace ABD
{
    FXChorusD::FXChorusD()
    {
        reset();
    }

    void FXChorusD::prepare(double newSampleRate, int samplesPerBlock)
    {
        sampleRate = std::max(1.0, newSampleRate);
        
        // Máximo delay de 50ms
        maxDelaySamples = (int)(sampleRate * 0.05);
        delayBufferL.setSize(1, maxDelaySamples);
        delayBufferR.setSize(1, maxDelaySamples);
        delayBufferL.clear();
        delayBufferR.clear();

        updateLFOs();
    }

    void FXChorusD::setParameter(int index, float value)
    {
        value = std::clamp(value, 0.0f, 1.0f);
        
        switch (index)
        {
            case 0: on = (value > 0.5f); break;
            case 1: monoMode = (value > 0.5f); break;
            case 2: mix = value; break;
            case 3: sw[0] = (value > 0.5f); updateLFOs(); break;
            case 4: sw[1] = (value > 0.5f); updateLFOs(); break;
            case 5: sw[2] = (value > 0.5f); updateLFOs(); break;
            case 6: sw[3] = (value > 0.5f); updateLFOs(); break;
        }
    }

    void FXChorusD::updateLFOs()
    {
        // Encontrar el botón de preset más alto seleccionado
        int presetIdx = 0;
        for (int i = 0; i < 4; ++i)
        {
            if (sw[i]) presetIdx = i + 1;
        }
        if (presetIdx == 0) presetIdx = 1; // Default fallback

        float speed1 = 0.25f;
        float speed2 = 0.4f;

        switch (presetIdx)
        {
            case 1: speed1 = 0.25f; speed2 = 0.35f; break;
            case 2: speed1 = 0.50f; speed2 = 0.65f; break;
            case 3: speed1 = 0.80f; speed2 = 1.00f; break;
            case 4: speed1 = 1.20f; speed2 = 1.50f; break;
        }

        lfoInc1 = speed1 / sampleRate;
        lfoInc2 = speed2 / sampleRate;
    }

    void FXChorusD::reset()
    {
        delayBufferL.clear();
        delayBufferR.clear();
        writePos = 0;
        lfoPhaseL1 = 0.0;
        lfoPhaseR1 = 0.25; // 90°
        lfoPhaseL2 = 0.0;
        lfoPhaseR2 = 0.75; // 270°
    }

    void FXChorusD::process(const float* inL, const float* inR,
                            float* outL, float* outR, int numSamples)
    {
        if (!on)
        {
            for (int s = 0; s < numSamples; ++s)
            {
                outL[s] = inL[s];
                outR[s] = inR[s];
            }
            return;
        }

        float* delayDataL = delayBufferL.getWritePointer(0);
        float* delayDataR = delayBufferR.getWritePointer(0);

        // Profundidades correspondientes
        int presetIdx = 0;
        for (int i = 0; i < 4; ++i)
        {
            if (sw[i]) presetIdx = i + 1;
        }
        if (presetIdx == 0) presetIdx = 1;

        float depthMs = 2.0f;
        switch (presetIdx)
        {
            case 1: depthMs = 2.0f; break;
            case 2: depthMs = 3.0f; break;
            case 3: depthMs = 4.0f; break;
            case 4: depthMs = 6.0f; break;
        }

        float baseDelaySamples = (float)(sampleRate * 0.015f); // 15ms base delay
        float modDepthSamples = (float)(sampleRate * 0.001f * depthMs);

        for (int s = 0; s < numSamples; ++s)
        {
            lfoPhaseL1 += lfoInc1; if (lfoPhaseL1 >= 1.0) lfoPhaseL1 -= 1.0;
            lfoPhaseR1 += lfoInc1; if (lfoPhaseR1 >= 1.0) lfoPhaseR1 -= 1.0;
            lfoPhaseL2 += lfoInc2; if (lfoPhaseL2 >= 1.0) lfoPhaseL2 -= 1.0;
            lfoPhaseR2 += lfoInc2; if (lfoPhaseR2 >= 1.0) lfoPhaseR2 -= 1.0;

            float dryL = inL[s];
            float dryR = inR[s];

            if (monoMode)
            {
                float mono = (dryL + dryR) * 0.5f;
                dryL = mono;
                dryR = mono;
            }

            // Dos osciladores sumados para modulación más compleja y rica
            float modValL = (float)(std::sin(2.0 * M_PI * lfoPhaseL1) * 0.6 + std::sin(2.0 * M_PI * lfoPhaseL2) * 0.4);
            float modValR = (float)(std::sin(2.0 * M_PI * lfoPhaseR1) * 0.6 + std::sin(2.0 * M_PI * lfoPhaseR2) * 0.4);

            float delayOffsetL = baseDelaySamples + modValL * modDepthSamples;
            float delayOffsetR = baseDelaySamples + modValR * modDepthSamples;

            // Leer delay con interpolación lineal
            float readPosL = (float)writePos - delayOffsetL;
            if (readPosL < 0.0f) readPosL += (float)maxDelaySamples;
            int idxL = (int)readPosL;
            int nextL = (idxL + 1) % maxDelaySamples;
            float fracL = readPosL - (float)idxL;
            float delayedL = delayDataL[idxL] * (1.0f - fracL) + delayDataL[nextL] * fracL;

            float readPosR = (float)writePos - delayOffsetR;
            if (readPosR < 0.0f) readPosR += (float)maxDelaySamples;
            int idxR = (int)readPosR;
            int nextR = (idxR + 1) % maxDelaySamples;
            float fracR = readPosR - (float)idxR;
            float delayedR = delayDataR[idxR] * (1.0f - fracR) + delayDataR[nextR] * fracR;

            // Escribir en buffer de delay (sin feedback para emular chorus Dimension D clásico)
            delayDataL[writePos] = dryL;
            delayDataR[writePos] = dryR;
            writePos = (writePos + 1) % maxDelaySamples;

            // Spatial cross-mixing con fase invertida (se cancela parte de la modulación en mono, pero da amplitud estéreo)
            float wetL = delayedL - delayedR * 0.4f;
            float wetR = delayedR - delayedL * 0.4f;

            outL[s] = dryL * (1.0f - mix) + wetL * mix;
            outR[s] = dryR * (1.0f - mix) + wetR * mix;
        }
    }
}
