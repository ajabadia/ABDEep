#include "FXEngine.h"
#include <algorithm>

namespace ABD
{
    FXEngine::FXEngine()
    {
    }

    void FXEngine::prepare(double sampleRate, int samplesPerBlock)
    {
        for (int i = 0; i < kNumSlots; ++i)
            slots[i].prepare(sampleRate, samplesPerBlock);

        // Pre-alocar buffers internos
        ensureBuffers(2, samplesPerBlock);
    }

    void FXEngine::ensureBuffers(int numChannels, int numSamples)
    {
        if (lastPreparedChannels >= numChannels && lastPreparedSamples >= numSamples)
            return;
        lastPreparedChannels = std::max(lastPreparedChannels, numChannels);
        lastPreparedSamples = std::max(lastPreparedSamples, numSamples);
        parallelBuffer.setSize(numChannels, numSamples, false, false, true);
        accumBuffer.setSize(numChannels, numSamples, false, false, true);
        slotBuf1.setSize(numChannels, numSamples, false, false, true);
        slotBuf2.setSize(numChannels, numSamples, false, false, true);
    }

    void FXEngine::updateParameters(juce::AudioProcessorValueTreeState& apvts)
    {
        auto getInt = [&](const juce::String& id) -> int {
            if (auto* param = apvts.getParameter(id))
                if (auto* choice = dynamic_cast<juce::AudioParameterChoice*>(param))
                    return choice->getIndex();
            return 0;
        };

        auto getFloat = [&](const juce::String& id) -> float {
            if (auto* param = apvts.getRawParameterValue(id))
                return param->load();
            return 0.0f;
        };

        // Routing global
        fxRouting = std::clamp(getInt("fx_routing"), 0, 9);
        fxMode = std::clamp(getInt("fx_mode"), 0, 2);

        // Feedback gain for Routing Mode 9 (Series with Feedback)
        fbGain = std::clamp(getFloat("fx_feedback_gain"), 0.0f, 1.0f);

        // Send mode dry/wet blend level
        sendLevel = std::clamp(getFloat("fx_send_level"), 0.0f, 1.0f);

        for (int s = 0; s < kNumSlots; ++s)
        {
            juce::String prefix = "fx" + juce::String(s + 1);

            int newType = getInt(prefix + "_type");
            slots[s].setType(newType);

            float newGain = getFloat(prefix + "_gain");
            slots[s].setGain(newGain);

            float newMix = getFloat(prefix + "_mix");
            slots[s].setMix(newMix);

            // Leer parámetros 1-12 para este slot
            for (int p = 0; p < 12; ++p)
            {
                juce::String paramId = prefix + "_param" + juce::String(p + 1);
                float val = getFloat(paramId);
                slots[s].setParameter(p, val);
            }
        }
    }

    void FXEngine::setModulatorBuffer(const float* modL, const float* modR, int numSamples)
    {
        extModL = modL;
        extModR = modR;
        extModNumSamples = numSamples;
    }

    void FXEngine::process(juce::AudioBuffer<float>& buffer)
    {
        if (fxMode == 2) return; // Bypass global

        // Forward modulator to all slots (for FXVocoder external mode)
        if (extModL != nullptr || extModR != nullptr)
        {
            for (int s = 0; s < kNumSlots; ++s)
                slots[s].setModulatorInput(extModL, extModR, extModNumSamples);
        }

        int numSamples = buffer.getNumSamples();
        if (numSamples <= 0) return;

        int numCh = buffer.getNumChannels();

        // For Send mode (1): save dry signal before processing
        if (fxMode == 1)
        {
            ensureBuffers(numCh, numSamples);
            for (int ch = 0; ch < numCh; ++ch)
                parallelBuffer.copyFrom(ch, 0, buffer, ch, 0, numSamples);
        }

        switch (fxRouting)
        {
            case 0: processSeries(buffer, numSamples); break;
            case 1: processParallel2x2(buffer, numSamples); break;
            case 2: processParallelPairsSeries(buffer, numSamples); break; // (1∥2)→(3∥4) en serie
            case 3: processFullParallel(buffer, numSamples); break;          // 1∥2∥3∥4 en full paralelo
            case 4: processDualSeriesParallel(buffer, numSamples); break;
            case 5: processSeriesSplitMid(buffer, numSamples); break;
            case 6: processParallelPairsSeries(buffer, numSamples); break;
            case 7: processSeriesChainParallel(buffer, numSamples); break;
            case 8: processParallelFrontSeries(buffer, numSamples); break;
            case 9: processSeriesWithFeedback(buffer, numSamples); break;
            default: processSeries(buffer, numSamples); break;
        }

        // For Send mode (1): mix dry + processed at the send level ratio.
        // The dry signal passes through at (1 - sendLevel), and the processed
        // FX output at sendLevel. Since each slot already applies its own dry/wet mix,
        // the final blend is: out = dry * (1 - sendLevel) + processed * sendLevel
        // sendLevel=0.5 → previously hardcoded 50/50; sendLevel=0 → dry only; sendLevel=1 → full wet
        if (fxMode == 1)
        {
            for (int ch = 0; ch < numCh; ++ch)
            {
                float* out = buffer.getWritePointer(ch);
                const float* dry = parallelBuffer.getReadPointer(ch);
                for (int s = 0; s < numSamples; ++s)
                    out[s] = dry[s] * (1.0f - sendLevel) + out[s] * sendLevel;
            }
        }

        // Clear modulator pointers after processing
        extModL = nullptr;
        extModR = nullptr;
        extModNumSamples = 0;
    }

    void FXEngine::reset()
    {
        for (int i = 0; i < kNumSlots; ++i)
            slots[i].reset();
        fbBuffer.clear();
    }

    FXSlot& FXEngine::getSlot(int index)
    {
        return slots[index];
    }

    const FXSlot& FXEngine::getSlot(int index) const
    {
        return slots[index];
    }
}
