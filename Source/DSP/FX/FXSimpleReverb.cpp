#include "FXSimpleReverb.h"
#include <cmath>
#include <algorithm>
#include <cstring>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

namespace ABD
{
    FXSimpleReverb::FXSimpleReverb(int reverbType)
        : reverbType(reverbType)
    {
        setDefaultsForType(reverbType);
        reset();
    }

    juce::String FXSimpleReverb::getEffectName() const
    {
        switch (reverbType)
        {
            case 1:  return "Hall";
            case 2:  return "Plate";
            case 3:  return "Rich Plate";
            case 4:  return "Ambience";
            case 5:  return "Gated";
            case 6:  return "Reverse";
            case 22: return "Deep Verb";
            case 26: return "Chamber";
            case 27: return "Room";
            case 28: return "Vintage";
            default: return "Reverb";
        }
    }

    void FXSimpleReverb::setDefaultsForType(int type)
    {
        switch (type)
        {
            case 1: // Hall
                decay = 0.7f; damping = 0.4f; diffusion = 0.7f; roomSize = 0.8f; preDelayTime = 0.1f; break;
            case 2: // Plate
                decay = 0.6f; damping = 0.3f; diffusion = 0.8f; roomSize = 0.5f; preDelayTime = 0.05f; break;
            case 3: // Rich Plate
                decay = 0.75f; damping = 0.2f; diffusion = 0.9f; roomSize = 0.6f; preDelayTime = 0.05f; break;
            case 4: // Ambience
                decay = 0.3f; damping = 0.6f; diffusion = 0.5f; roomSize = 0.3f; preDelayTime = 0.0f; break;
            case 5: // Gated
                decay = 0.2f; damping = 0.8f; diffusion = 0.3f; roomSize = 0.4f; preDelayTime = 0.0f; break;
            case 6: // Reverse
                decay = -0.3f; damping = 0.9f; diffusion = 0.2f; roomSize = 0.7f; preDelayTime = 0.15f; break;
            case 22: // Deep Verb
                decay = 0.85f; damping = 0.3f; diffusion = 0.8f; roomSize = 0.9f; preDelayTime = 0.1f; break;
            case 26: // Chamber
                decay = 0.5f; damping = 0.5f; diffusion = 0.6f; roomSize = 0.6f; preDelayTime = 0.05f; break;
            case 27: // Room
                decay = 0.35f; damping = 0.6f; diffusion = 0.4f; roomSize = 0.4f; preDelayTime = 0.02f; break;
            case 28: // Vintage
                decay = 0.65f; damping = 0.35f; diffusion = 0.7f; roomSize = 0.7f; preDelayTime = 0.08f; break;
            default:
                decay = 0.5f; damping = 0.5f; diffusion = 0.5f; roomSize = 0.5f; preDelayTime = 0.05f; break;
        }
    }

    void FXSimpleReverb::prepare(double newSampleRate, int samplesPerBlock)
    {
        sampleRate = std::max(1.0, newSampleRate);
        
        // Calcular tamaños de buffer según roomSize y sampleRate
        updateFilters();
        
        // Pre-delay buffer (máximo 200ms)
        int maxPreDelay = (int)(sampleRate * 0.2);
        preDelayBuffer.setSize(1, maxPreDelay);
        preDelayBuffer.clear();
        preDelayWritePos = 0;
    }

    void FXSimpleReverb::updateCombParams()
    {
        for (int i = 0; i < 4; ++i)
        {
            combL[i].feedback = (decay < 0) ? 0.3f : decay * 0.9f;
            combL[i].damp1 = damping;
            combL[i].damp2 = 1.0f - damping;
            combR[i].feedback = combL[i].feedback;
            combR[i].damp1 = damping;
            combR[i].damp2 = 1.0f - damping;
        }
        for (int i = 0; i < 3; ++i)
        {
            allpassL[i].gain = diffusion * 0.7f;
            allpassR[i].gain = diffusion * 0.7f;
        }
    }

    void FXSimpleReverb::updateFilters()
    {
        // Longitudes de comb filters (en samples) - valores clásicos de Schroeder
        // Escalados por roomSize (0.5-1.5x)
        float sizeScale = 0.5f + roomSize;
        
        int combLen[4] = {
            (int)(sampleRate * 0.0297 * sizeScale),
            (int)(sampleRate * 0.0331 * sizeScale),
            (int)(sampleRate * 0.0378 * sizeScale),
            (int)(sampleRate * 0.0411 * sizeScale)
        };
        
        // Asegurar que sean primos relativos
        for (int i = 0; i < 4; ++i)
        {
            combLen[i] = std::max(1, combLen[i]);
            // Pequeño ajuste para evitar periodicidad
            combLen[i] += (i * 7);
        }

        // Redimensionar buffers comb
        combBufferL.setSize(4, combLen[0] + combLen[1] + combLen[2] + combLen[3] + 10);
        combBufferR.setSize(4, combLen[0] + combLen[1] + combLen[2] + combLen[3] + 10);
        
        size_t offset = 0;
        for (int i = 0; i < 4; ++i)
        {
            combL[i].buffer = combBufferL.getWritePointer(0) + offset;
            combL[i].bufferSize = combLen[i];
            combL[i].writePos = 0;
            combL[i].feedback = (decay < 0) ? 0.3f : decay * 0.9f;
            combL[i].damp1 = damping;
            combL[i].damp2 = 1.0f - damping;
            combL[i].filterState = 0.0f;

            combR[i].buffer = combBufferR.getWritePointer(0) + offset;
            combR[i].bufferSize = combLen[i];
            combR[i].writePos = 0;
            combR[i].feedback = (decay < 0) ? 0.3f : decay * 0.9f;
            combR[i].damp1 = damping;
            combR[i].damp2 = 1.0f - damping;
            combR[i].filterState = 0.0f;

            offset += combLen[i];
        }

        // All-pass filters
        int apLen[3] = {
            (int)(sampleRate * 0.0051 * sizeScale),
            (int)(sampleRate * 0.0068 * sizeScale),
            (int)(sampleRate * 0.0083 * sizeScale)
        };
        
        int apTotal = 0;
        for (int i = 0; i < 3; ++i) apTotal += std::max(1, apLen[i]);

        allpassBufferL.setSize(3, apTotal + 10);
        allpassBufferR.setSize(3, apTotal + 10);
        
        offset = 0;
        for (int i = 0; i < 3; ++i)
        {
            allpassL[i].buffer = allpassBufferL.getWritePointer(0) + offset;
            allpassL[i].bufferSize = std::max(1, apLen[i]);
            allpassL[i].writePos = 0;
            allpassL[i].gain = diffusion * 0.7f;

            allpassR[i].buffer = allpassBufferR.getWritePointer(0) + offset;
            allpassR[i].bufferSize = std::max(1, apLen[i]);
            allpassR[i].writePos = 0;
            allpassR[i].gain = diffusion * 0.7f;

            offset += std::max(1, apLen[i]);
        }

        // Pre-delay
        preDelaySamples = (int)(preDelayTime * sampleRate * 0.2);
        preDelaySamples = std::clamp(preDelaySamples, 0, (int)(sampleRate * 0.2));
    }

    void FXSimpleReverb::setParameter(int index, float value)
    {
        value = std::clamp(value, 0.0f, 1.0f);

        switch (index)
        {
            case 0: decay = value; updateCombParams(); break;
            case 1: preDelayTime = value; updateFilters(); break;
            case 2: damping = value; updateCombParams(); break;
            case 3: diffusion = value; updateCombParams(); break;
            case 4: roomSize = value; updateFilters(); break;
        }
    }

    void FXSimpleReverb::reset()
    {
        combBufferL.clear();
        combBufferR.clear();
        allpassBufferL.clear();
        allpassBufferR.clear();
        preDelayBuffer.clear();
        preDelayWritePos = 0;

        for (int i = 0; i < 4; ++i)
        {
            combL[i].writePos = 0;
            combL[i].filterState = 0.0f;
            combR[i].writePos = 0;
            combR[i].filterState = 0.0f;
        }
        for (int i = 0; i < 3; ++i)
        {
            allpassL[i].writePos = 0;
            allpassR[i].writePos = 0;
        }
    }

    float FXSimpleReverb::processComb(CombFilter& comb, float input)
    {
        int readPos = comb.writePos;
        float output = comb.buffer[readPos];
        
        // Low-pass damping en feedback
        comb.filterState = output * comb.damp1 + comb.filterState * comb.damp2;
        
        // Escribir: input + feedback con damping
        comb.buffer[comb.writePos] = input + comb.filterState * comb.feedback;
        
        // Avanzar puntero
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

            // Gated/Reverse: decay negativo invierte la fase
            float dryScale = 1.0f;
            if (reverbType == 5) // Gated: decay corto y seco
                dryScale = 1.0f;
            else if (reverbType == 6) // Reverse: fase invertida
                wetL = -wetL;

            // Procesar comb filters en paralelo
            float combSumL = 0.0f, combSumR = 0.0f;
            for (int i = 0; i < 4; ++i)
            {
                combSumL += processComb(combL[i], wetL);
                combSumR += processComb(combR[i], wetR);
            }
            combSumL *= 0.25f; // Promedio
            combSumR *= 0.25f;

            // Procesar all-pass filters en serie
            for (int i = 0; i < 3; ++i)
            {
                combSumL = processAllPass(allpassL[i], combSumL);
                combSumR = processAllPass(allpassR[i], combSumR);
            }

            // Escalar por decay (para gated: decay corto)
            float reverbScale = (decay < 0) ? 0.5f : decay * 0.7f + 0.3f;
            
            // 100% wet (el slot maneja la mezcla)
            outL[s] = combSumL * reverbScale;
            outR[s] = combSumR * reverbScale;
        }
    }
}
