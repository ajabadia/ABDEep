#include "FXChorus.h"
#include <cmath>
#include <algorithm>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

namespace ABD
{
    FXChorus::FXChorus()
    {
        reset();
    }

    void FXChorus::prepare(double newSampleRate, int samplesPerBlock)
    {
        sampleRate = std::max(1.0, newSampleRate);
        
        // Buffer: max 50ms para chorus (suficiente para profundidad de 10ms + safety)
        maxDelaySamples = (int)(sampleRate * 0.05);
        delayBufferL.setSize(1, maxDelaySamples);
        delayBufferR.setSize(1, maxDelaySamples);
        delayBufferL.clear();
        delayBufferR.clear();
        
        writePositionL = 0;
        writePositionR = 0;
        
        updateLFOIncrement();
    }

    void FXChorus::setParameter(int index, float value)
    {
        value = std::clamp(value, 0.0f, 1.0f);
        
        switch (index)
        {
            case 0: rate = value; updateLFOIncrement(); break;
            case 1: depth = value; break;
            case 2: feedback = value * 0.95f; break;
        }
    }

    void FXChorus::reset()
    {
        delayBufferL.clear();
        delayBufferR.clear();
        writePositionL = 0;
        writePositionR = 0;
        lfoPhaseL = 0.0;
        lfoPhaseR = 0.25; // 90° offset para efecto estéreo
    }

    void FXChorus::updateLFOIncrement()
    {
        // Rate: 0-1 → 0.1Hz - 10Hz
        float freqHz = 0.1f + 9.9f * rate;
        lfoPhaseIncrement = freqHz / sampleRate;
    }

    void FXChorus::process(const float* inL, const float* inR,
                            float* outL, float* outR,
                            int numSamples)
    {
        float* delayDataL = delayBufferL.getWritePointer(0);
        float* delayDataR = delayBufferR.getWritePointer(0);
        
        // Depth: 0-1 → 0 - 10ms en samples
        float maxDepthSamples = (float)(sampleRate * 0.01 * depth);
        
        for (int s = 0; s < numSamples; ++s)
        {
            // Avanzar LFO
            lfoPhaseL += lfoPhaseIncrement;
            if (lfoPhaseL >= 1.0) lfoPhaseL -= 1.0;
            lfoPhaseR += lfoPhaseIncrement;
            if (lfoPhaseR >= 1.0) lfoPhaseR -= 1.0;
            
            // Leer muestra de entrada
            float dryL = inL[s];
            float dryR = inR[s];
            
            // Calcular delay modulado con LFO sinusoidal
            float modL = (float)(std::sin(2.0 * M_PI * lfoPhaseL));
            float modR = (float)(std::sin(2.0 * M_PI * lfoPhaseR));
            
            float delayOffsetL = (modL + 1.0f) * 0.5f * maxDepthSamples;
            float delayOffsetR = (modR + 1.0f) * 0.5f * maxDepthSamples;
            
            // Leer delay con interpolación lineal
            float readPosL = (float)(writePositionL) - delayOffsetL;
            if (readPosL < 0) readPosL += (float)maxDelaySamples;
            
            float readPosR = (float)(writePositionR) - delayOffsetR;
            if (readPosR < 0) readPosR += (float)maxDelaySamples;
            
            // Interpolación lineal
            int idxL = (int)readPosL;
            int nextL = (idxL + 1) % maxDelaySamples;
            float fracL = readPosL - (float)idxL;
            float delayedL = delayDataL[idxL] * (1.0f - fracL) + delayDataL[nextL] * fracL;
            
            int idxR = (int)readPosR;
            int nextR = (idxR + 1) % maxDelaySamples;
            float fracR = readPosR - (float)idxR;
            float delayedR = delayDataR[idxR] * (1.0f - fracR) + delayDataR[nextR] * fracR;
            
            // Escribir en buffer de delay (entrada + feedback)
            delayDataL[writePositionL] = dryL + delayedL * feedback;
            delayDataR[writePositionR] = dryR + delayedR * feedback;
            
            writePositionL = (writePositionL + 1) % maxDelaySamples;
            writePositionR = (writePositionR + 1) % maxDelaySamples;
            
            // 100% wet (el slot maneja la mezcla)
            outL[s] = delayedL;
            outR[s] = delayedR;
        }
    }
}
