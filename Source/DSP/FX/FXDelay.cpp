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
            case 1: timeParam = value; updateDelaySamples(); break;
            case 2: mode = std::clamp((int)(value * 3.99f), 0, 3); break;
            case 3: factorL = value; updateDelaySamples(); break;
            case 4: factorR = value; updateDelaySamples(); break;
            case 5: offsetParam = value; updateDelaySamples(); break;
            case 6: break; // LoCut almacenado (sin equivalente DSP)
            case 7: lpfCutoff = value; updateLPFCoeff(); break;
            case 8: break; // FeedLC almacenado (sin equivalente DSP)
            case 9: feedbackL = value; break;
            case 10: feedbackR = value; break;
            case 11: lpfCutoff = value; updateLPFCoeff(); break;
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

    float FXDelay::factorToScale(float normalized) const
    {
        static const float scales[] = { 0.25f, 0.375f, 0.5f, 0.6667f, 1.0f, 1.3333f, 1.5f, 2.0f, 3.0f };
        int idx = std::clamp((int)(normalized * 8.99f), 0, 8);
        return scales[idx];
    }

    void FXDelay::updateDelaySamples()
    {
        // Time: 0-1 → 1ms - 2000ms (logarítmico para mejor respuesta musical)
        float masterMs = 1.0f + 1999.0f * std::pow(timeParam, 2.0f);

        // FactorL/FactorR: fracción rítmica del tiempo maestro
        float leftMs = masterMs * factorToScale(factorL);

        // Offset: -100ms..+100ms diferencia entre L y R (añadido al derecho)
        float offsetMs = (offsetParam - 0.5f) * 2.0f * 100.0f;
        float rightMs = masterMs * factorToScale(factorR) + offsetMs;

        leftMs = std::clamp(leftMs, 1.0f, 2000.0f);
        rightMs = std::clamp(rightMs, 1.0f, 2000.0f);

        delaySamplesL = (int)(sampleRate * leftMs / 1000.0);
        delaySamplesL = std::max(1, delaySamplesL);
        
        delaySamplesR = (int)(sampleRate * rightMs / 1000.0);
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
        
        float fbL = feedbackL * 0.99f;
        float fbR = feedbackR * 0.99f;
        
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
            
            // Escritura del buffer según el modo de ruteo
            float writeL, writeR;
            switch (mode)
            {
                case 1: // X — feedback cruzado entre canales
                    writeL = dryL + lpfStateR * fbR;
                    writeR = dryR + lpfStateL * fbL;
                    break;
                case 2: // M — mezcla mono en la cadena de feedback
                    {
                        float mono = (lpfStateL + lpfStateR) * 0.5f;
                        float fb = (fbL + fbR) * 0.5f;
                        writeL = dryL + mono * fb;
                        writeR = dryR + mono * fb;
                    }
                    break;
                case 3: // P-P — ping pong (feedback derecho desactivado)
                    writeL = dryL + lpfStateL * fbL;
                    writeR = dryR;
                    break;
                default: // ST — feedback estéreo independiente
                    writeL = dryL + lpfStateL * fbL;
                    writeR = dryR + lpfStateR * fbR;
                    break;
            }
            
            delayDataL[writePositionL] = writeL;
            delayDataR[writePositionR] = writeR;
            
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
