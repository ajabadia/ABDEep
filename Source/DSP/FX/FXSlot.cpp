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
        newType = std::clamp(newType, 0, 35);
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

    std::unique_ptr<FXBase> FXSlot::createEffect(int newType)
    {
        switch (newType)
        {
            // Reverbs (Schroeder-Moorer)
            case 1:  return std::make_unique<FXSimpleReverb>(1);  // Hall
            case 2:  return std::make_unique<FXSimpleReverb>(2);  // Plate
            case 3:  return std::make_unique<FXSimpleReverb>(3);  // Rich Plate
            case 4:  return std::make_unique<FXSimpleReverb>(4);  // Ambience
            case 5:  return std::make_unique<FXSimpleReverb>(5);  // Gated
            case 6:  return std::make_unique<FXSimpleReverb>(6);  // Reverse
            case 22: return std::make_unique<FXSimpleReverb>(22); // Deep Verb
            case 26: return std::make_unique<FXSimpleReverb>(26); // Chamber
            case 27: return std::make_unique<FXSimpleReverb>(27); // Room
            case 28: return std::make_unique<FXSimpleReverb>(28); // Vintage

            // Phaser
            case 9:
                return std::make_unique<FXPhaser>();

            case 11: // Flanger
                return std::make_unique<FXFlanger>();

            case 10: // Stereo Chorus
                return std::make_unique<FXChorus>();
            case 17: // Chorus-D
                return std::make_unique<FXChorusD>();

            case 13: // Delay (single)
                return std::make_unique<FXDelay>();
            case 14: // 3Tap Delay
                return std::make_unique<FXMultiTapDelay>(3);
            case 15: // 4Tap Delay
                return std::make_unique<FXMultiTapDelay>(4);
            
            // Rotary Speaker
            case 16:
                return std::make_unique<FXRotarySpeaker>();

            // Rack Amp
            case 7:
                return std::make_unique<FXRackAmp>();

            // Edison EX1 (stereo imager)
            case 19:
                return std::make_unique<FXEdison>();

            // Auto Pan / Tremolo
            case 20:
                return std::make_unique<FXAutoPan>();

            // Multi-Band Distortion
            case 32:
                return std::make_unique<FXMultiBandDist>();

            // Mood Filter
            case 8:
                return std::make_unique<FXMoodFilter>();

            // Enhancer
            case 18:
                return std::make_unique<FXEnhancer>();

            // Fair Compressor
            case 31:
                return std::make_unique<FXFairComp>();

            // Noise Gate
            case 33:
                return std::make_unique<FXNoiseGate>();

            // Dual Pitch
            case 29:
                return std::make_unique<FXPitchShifter>(false);

            // Vintage Pitch
            case 35:
                return std::make_unique<FXPitchShifter>(true);

            // Decimator Delay
            case 34:
                return std::make_unique<FXDecimDelay>();

            // T-Ray Delay (tape)
            case 21:
                return std::make_unique<FXTapeDelay>();

            // Modulated Delay Reverb
            case 12:
                return std::make_unique<FXModDelayRev>();

            // Reverb hybrids
            case 23: // flangVerb
            case 24: // chorusVerb
            case 25: // delayVerb
                return std::make_unique<FXHybridReverb>(newType);

            // Midas EQ
            case 30:
                return std::make_unique<FXMidasEQ>();

            default:
                return nullptr; // Bypass para tipos no implementados
        }
    }
}
