#include "FXDelay.h"
#include <cmath>
#include <algorithm>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

namespace ABD
{
    FXDelay::FXDelay()
    {
        reset();
    }

    void FXDelay::prepare(double newSampleRate, int samplesPerBlock)
    {
        sampleRate = std::max(1.0, newSampleRate);
        
        // Buffer de delay: máximo 2 segundos
        int maxDelaySamples = (int)(sampleRate * 2.0);
        delayBufferL.setSize(1, maxDelaySamples);
        delayBufferR.setSize(1, maxDelaySamples);
        delayBufferL.clear();
        delayBufferR.clear();
        
        writePositionL = 0;
        writePositionR = 0;
        
        updateDelaySamples();
        updateLPFCoeff();
    }

    void FXDelay::setParameter(int index, float value)
    {
        value = std::clamp(value, 0.0f, 1.0f);
        
        switch (index)
        {
            case 0: mix = value; break;
            case 1: delayTimeL = value; updateDelaySamples(); break;
            case 2: delayTimeR = value; updateDelaySamples(); break;
            case 3: feedback = value * 0.99f; break;
            case 4: lpfCutoff = value; updateLPFCoeff(); break;
        }
    }

    void FXDelay::reset()
    {
        delayBufferL.clear();
        delayBufferR.clear();
        writePositionL = 0;
        writePositionR = 0;
        lpfStateL = 0.0f;
        lpfStateR = 0.0f;
    }

    void FXDelay::updateDelaySamples()
    {
        // Mapeo: 0-1 → 1ms - 2000ms (logarítmico para mejor respuesta musical)
        float timeMs = 1.0f + 1999.0f * std::pow(delayTimeL, 2.0f);
        delaySamplesL = (int)(sampleRate * timeMs / 1000.0);
        delaySamplesL = std::max(1, delaySamplesL);
        
        timeMs = 1.0f + 1999.0f * std::pow(delayTimeR, 2.0f);
        delaySamplesR = (int)(sampleRate * timeMs / 1000.0);
        delaySamplesR = std::max(1, delaySamplesR);
    }

    void FXDelay::updateLPFCoeff()
    {
        // Mapeo exponencial: 200Hz - 20000Hz
        float freqHz = 200.0f * std::pow(100.0f, lpfCutoff);
        freqHz = std::min(freqHz, (float)(sampleRate * 0.45));
        
        // Filtro RC de 1-polo: alpha = e^(-2*pi*fc/fs)
        lpfCoeff = std::exp(-2.0 * M_PI * freqHz / sampleRate);
    }

    void FXDelay::process(const float* inL, const float* inR,
                           float* outL, float* outR,
                           int numSamples)
    {
        int bufferSizeL = delayBufferL.getNumSamples();
        int bufferSizeR = delayBufferR.getNumSamples();
        
        float* delayDataL = delayBufferL.getWritePointer(0);
        float* delayDataR = delayBufferR.getWritePointer(0);
        
        for (int s = 0; s < numSamples; ++s)
        {
            // Leer muestra seca
            float dryL = inL[s];
            float dryR = inR[s];
            
            // Leer delay
            int readPosL = writePositionL - delaySamplesL;
            if (readPosL < 0) readPosL += bufferSizeL;
            
            int readPosR = writePositionR - delaySamplesR;
            if (readPosR < 0) readPosR += bufferSizeR;
            
            float delayedL = delayDataL[readPosL];
            float delayedR = delayDataR[readPosR];
            
            // Aplicar LPF al feedback
            lpfStateL = lpfStateL + lpfCoeff * (delayedL - lpfStateL);
            lpfStateR = lpfStateR + lpfCoeff * (delayedR - lpfStateR);
            
            // Escribir en el buffer de delay (entrada + feedback)
            delayDataL[writePositionL] = dryL + lpfStateL * feedback;
            delayDataR[writePositionR] = dryR + lpfStateR * feedback;
            
            // Incrementar posiciones de escritura
            writePositionL = (writePositionL + 1) % bufferSizeL;
            writePositionR = (writePositionR + 1) % bufferSizeR;
            
            // 100% wet: el slot externo (FXSlot) maneja la mezcla wet/dry
            // para evitar doble mezcla y permitir control de mix uniforme
            outL[s] = delayedL;
            outR[s] = delayedR;
        }
    }
}
