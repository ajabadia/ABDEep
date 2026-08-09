#include "FXSlot.h"
#include <algorithm>

namespace ABD
{
    FXSlot::FXSlot()
    {
        std::fill(std::begin(params), std::end(params), 0.5f);
    }

    void FXSlot::prepare(double newSampleRate, int samplesPerBlock)
    {
        lastSampleRate = newSampleRate;
        lastSamplesPerBlock = samplesPerBlock;
        if (effect)
            effect->prepare(newSampleRate, samplesPerBlock);
        buffersPrepared = false;
    }

    void FXSlot::prepareBuffers(int numChannels, int numSamples)
    {
        if (buffersPrepared && wetBuffer.getNumSamples() >= numSamples
            && wetBuffer.getNumChannels() >= numChannels)
            return; // Ya preparado y suficientemente grande
        
        wetBuffer.setSize(numChannels, numSamples, false, false, true);
        buffersPrepared = true;
    }

    void FXSlot::setType(int newType)
    {
        newType = std::clamp(newType, 0, 56);
        if (newType == type && effect)
            return; // Mismo tipo, no recrear
        
        type = newType;
        
        if (type == 0)
        {
            effect.reset(); // Bypass
            return;
        }
        
        effect = createEffect(type);
        if (effect)
        {
            effect->prepare(lastSampleRate, lastSamplesPerBlock); // Auto-prepare with stored values
            syncParameters();
        }
    }

    void FXSlot::setParameter(int index, float value)
    {
        if (index >= 0 && index < 12)
        {
            params[index] = std::clamp(value, 0.0f, 1.0f);
            if (effect && index < effect->getNumParameters())
                effect->setParameter(index, params[index]);
        }
    }

    void FXSlot::setGain(float newGain)
    {
        gain = std::clamp(newGain, 0.0f, 1.0f);
    }

    void FXSlot::setMix(float newMix)
    {
        mix = std::clamp(newMix, 0.0f, 1.0f);
    }

    void FXSlot::process(juce::AudioBuffer<float>& buffer, int numSamples)
    {
        if (!isActive())
            return;
        
        int numChannels = std::min(buffer.getNumChannels(), 2);
        if (numChannels == 0) return;
        
        // Usar buffer pre-alocado (evita alocaciones en audio thread)
        prepareBuffers(numChannels, numSamples);
        wetBuffer.clear();
        
        const float* inL = buffer.getReadPointer(0);
        const float* inR = (numChannels > 1) ? buffer.getReadPointer(1) : buffer.getReadPointer(0);
        float* outL = wetBuffer.getWritePointer(0);
        float* outR = (numChannels > 1) ? wetBuffer.getWritePointer(1) : wetBuffer.getWritePointer(0);
        
        // Procesar el efecto
        effect->process(inL, inR, outL, outR, numSamples);
        
        // Aplicar ganancia y mezcla wet/dry
        for (int ch = 0; ch < numChannels; ++ch)
        {
            const float* dry = buffer.getReadPointer(ch);
            float* wet = wetBuffer.getWritePointer(ch);
            float* out = buffer.getWritePointer(ch);
            
            for (int s = 0; s < numSamples; ++s)
            {
                out[s] = dry[s] * (1.0f - mix) + wet[s] * mix * gain;
            }
        }
    }

    void FXSlot::setModulatorInput(const float* modL, const float* modR, int numSamples)
    {
        if (effect)
            effect->setModulatorInput(modL, modR, numSamples);
    }

    void FXSlot::reset()
    {
        if (effect)
            effect->reset();
    }

    void FXSlot::syncParameters()
    {
        if (!effect) return;
        int numParams = std::min(12, effect->getNumParameters());
        for (int i = 0; i < numParams; ++i)
            effect->setParameter(i, params[i]);
    }


}
