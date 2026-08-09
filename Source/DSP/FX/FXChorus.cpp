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
        
        // Buffer: 80ms (delay base 50ms + profundidad 10ms + margen)
        maxDelaySamples = (int)(sampleRate * 0.08);
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
            case 1: depthL = value; break;
            case 2: depthR = value; break;
            case 3: baseDelayL = value; break;
            case 4: baseDelayR = value; break;
            case 5: break; // Mix almacenado (aplicado por FXSlot)
            case 6: break; // LoCut almacenado (sin equivalente DSP)
            case 7: break; // HiCut almacenado (sin equivalente DSP)
            case 8: phase = value; break;
            case 9: wave = value; break;
            case 10: spread = value; break;
        }
    }

    void FXChorus::reset()
    {
        delayBufferL.clear();
        delayBufferR.clear();
        writePositionL = 0;
        writePositionR = 0;
        lfoPhaseL = 0.0;
        lfoPhaseR = 0.25;
    }

    void FXChorus::updateLFOIncrement()
    {
        // Rate: 0-1 → 0.1Hz - 10Hz
        float freqHz = 0.1f + 9.9f * rate;
        lfoPhaseIncrement = freqHz / sampleRate;
    }

    float FXChorus::getWaveform(double phaseVal)
    {
        // Wave 0-1: tri (0) → sin (1)
        float s = (float)std::sin(2.0 * M_PI * phaseVal);
        float t = (float)(4.0 * std::abs(phaseVal - std::floor(phaseVal + 0.5)) - 1.0);
        return t * (1.0f - wave) + s * wave;
    }

    void FXChorus::process(const float* inL, const float* inR,
                            float* outL, float* outR,
                            int numSamples)
    {
        float* delayDataL = delayBufferL.getWritePointer(0);
        float* delayDataR = delayBufferR.getWritePointer(0);
        
        // Depth: 0-1 → 0 - 10ms en samples (por canal)
        float maxDepthSamplesL = (float)(sampleRate * 0.01 * depthL);
        float maxDepthSamplesR = (float)(sampleRate * 0.01 * depthR);
        
        // Delay base: 0.5ms - 50ms (por canal)
        float baseSampL = (float)(sampleRate * (0.0005f + 0.0495f * baseDelayL));
        float baseSampR = (float)(sampleRate * (0.0005f + 0.0495f * baseDelayR));
        
        // Phase 0-1 → 0-180° (0-0.5 de ciclo) + spread adicional
        float phaseOffset = phase * 0.5f + spread * 0.25f;
        if (phaseOffset >= 1.0) phaseOffset -= 1.0;
        
        for (int s = 0; s < numSamples; ++s)
        {
            // Avanzar LFO
            lfoPhaseL += lfoPhaseIncrement;
            if (lfoPhaseL >= 1.0) lfoPhaseL -= 1.0;
            
            lfoPhaseR = lfoPhaseL + phaseOffset;
            if (lfoPhaseR >= 1.0) lfoPhaseR -= 1.0;
            
            // Leer muestra de entrada
            float dryL = inL[s];
            float dryR = inR[s];
            
            // Calcular delay modulado con LFO
            float modL = getWaveform(lfoPhaseL);
            float modR = getWaveform(lfoPhaseR);
            
            float delayOffsetL = baseSampL + (modL + 1.0f) * 0.5f * maxDepthSamplesL;
            float delayOffsetR = baseSampR + (modR + 1.0f) * 0.5f * maxDepthSamplesR;
            
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
