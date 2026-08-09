#include "FXSimpleReverb.h"
#include <cmath>
#include <algorithm>

/**
 * @purpose FXSimpleReverb lifecycle, parameter, and filter setup methods.
 * DSP audio processing (processComb, processAllPass, process) is in
 * FXSimpleReverb_Process.cpp.
 */

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
        (void)samplesPerBlock;
        sampleRate = std::max(1.0, newSampleRate);

        // Recalculate buffer sizes and pre-delay
        updateFilters();

        // Pre-delay buffer (max 200ms)
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
        // Comb filter lengths (in samples) — classic Schroeder values
        // Scaled by roomSize (0.5-1.5x)
        float sizeScale = 0.5f + roomSize;

        int combLen[4] = {
            (int)(sampleRate * 0.0297 * sizeScale),
            (int)(sampleRate * 0.0331 * sizeScale),
            (int)(sampleRate * 0.0378 * sizeScale),
            (int)(sampleRate * 0.0411 * sizeScale)
        };

        // Ensure relatively prime lengths
        for (int i = 0; i < 4; ++i)
        {
            combLen[i] = std::max(1, combLen[i]);
            combLen[i] += (i * 7); // Small offset to avoid periodicity
        }

        // Resize comb buffers
        int combTotal = combLen[0] + combLen[1] + combLen[2] + combLen[3];
        combBufferL.setSize(4, combTotal + 10);
        combBufferL.clear();
        combBufferR.setSize(4, combTotal + 10);
        combBufferR.clear();

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
        allpassBufferL.clear();
        allpassBufferR.setSize(3, apTotal + 10);
        allpassBufferR.clear();

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

    int FXSimpleReverb::numParametersForType(int type) const
    {
        switch (type)
        {
            case 1: case 2: case 3: case 26: case 27: case 28: return 12; // Hall/Plate/Rich/Chamber/Room/Vintage
            case 4: case 5: return 10;    // Ambience / Gated
            case 6: return 9;             // Reverse
            case 22: return 5;            // Deep Verb
            default: return 12;
        }
    }

    int FXSimpleReverb::getNumParameters() const
    {
        return numParametersForType(reverbType);
    }

    void FXSimpleReverb::setParameter(int index, float value)
    {
        value = std::clamp(value, 0.0f, 1.0f);
        if (index >= getNumParameters())
            return;

        const int type = reverbType;

        // Mapeo por-tipo desde el orden hardware (docs/deepmind_fx.md).
        // Controles con equivalente interno: preDelay, decay, size→roomSize,
        // damping, diffusion. El resto (mix, loCut/hiCut, bassMult, spread,
        // shape, spin, mod*, attack, density, ...) se almacena/ignora.
        switch (type)
        {
            case 1: case 2: case 3: case 4: case 26: case 27: case 28:
                // [preDelay, decay, size, damping, diffusion, ...]
                switch (index)
                {
                    case 0: preDelayTime = value; updateFilters(); break;
                    case 1: decay = value; updateCombParams(); break;
                    case 2: roomSize = value; updateFilters(); break;
                    case 3: damping = value; updateCombParams(); break;
                    case 4: diffusion = value; updateCombParams(); break;
                    default: break; // mix/loCut/hiCut/bassMult/spread/shape/spin/mod/tailGain
                }
                break;

            case 5: // Gated: [preDelay, decay, attack, density, spread, mix, loCut, hiSvFreq, hiSvGain, diffusion]
                switch (index)
                {
                    case 0: preDelayTime = value; updateFilters(); break;
                    case 1: decay = value; updateCombParams(); break;
                    case 9: diffusion = value; updateCombParams(); break;
                    default: break; // attack/density/spread/mix/loCut/hiSvFreq/hiSvGain
                }
                break;

            case 6: // Reverse: [preDelay, decay, rise, diffusion, spread, mix, loCut, hiSvFreq, hiSvGain]
                switch (index)
                {
                    case 0: preDelayTime = value; updateFilters(); break;
                    case 1: decay = value; updateCombParams(); break;
                    case 3: diffusion = value; updateCombParams(); break;
                    default: break; // rise/spread/mix/loCut/hiSvFreq/hiSvGain
                }
                break;

            case 22: // DeepVerb: [preset, decay, tone, preDelay, mix]
                switch (index)
                {
                    case 1: decay = value; updateCombParams(); break;
                    case 3: preDelayTime = value; updateFilters(); break;
                    default: break; // preset/tone/mix
                }
                break;

            default:
                break;
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
}
