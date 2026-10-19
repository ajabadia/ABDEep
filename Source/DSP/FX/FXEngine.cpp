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
        parallelBuffer.setSize(numChannels, numSamples, false, true, true);
        accumBuffer.setSize(numChannels, numSamples, false, true, true);
        slotBuf1.setSize(numChannels, numSamples, false, true, true);
        slotBuf2.setSize(numChannels, numSamples, false, true, true);
        fbBuffer.setSize(numChannels, numSamples, false, true, true);
    }

    namespace
    {
        // Tabla hardware DeepMind 12 (DeepMind12.exe @ 0x004F1D07):
        // Determina si el slot `slot` (0..3) tiene un tap de ganancia de salida activo
        // en el modo de ruteo `routing` (0..9 = M-1..M-10). Los slots en serie que
        // alimentan a otro slot tienen su slider de Gain deshabilitado en el hardware
        // (y byte 218..221 = 0 en 349 presets de fábrica, incluido Blue Dolphin BC),
        // pasando a ganancia unitaria (1.0f) hacia el siguiente eslabón de la cadena.
        bool isHardwareSlotGainActive(int routing, int slot) noexcept
        {
            switch (routing)
            {
                case 0: return slot == 3;                           // M-1: 1->2->3->4 (solo FX4 tiene gain de salida)
                case 1: return slot == 0 || slot == 1 || slot == 3; // M-2
                case 2: return slot == 1 || slot == 3;              // M-3
                case 3: return true;                                // M-4: paralelo completo
                case 4: return true;                                // M-5
                case 5: return slot == 2 || slot == 3;              // M-6
                case 6: return slot >= 1;                           // M-7
                case 7: return slot == 2 || slot == 3;              // M-8
                case 8: return slot == 1 || slot == 3;              // M-9
                case 9: return slot == 2 || slot == 3;              // M-10
                default: return true;
            }
        }

        // Índice del parámetro Mix (0..11) para efectos cuyo process() genera señal
        // 100% wet y delegan la mezcla dry/wet a FXSlot (DeepMind12.exe @ 0x004E2BB6).
        // Devuelve -1 si el efecto ya gestiona su propio Mix internamente o es 100% insert.
        int getSlotDelegatedMixParamIndex(int fxType) noexcept
        {
            switch (fxType)
            {
                case 1: case 2: case 3: case 4: case 5: case 6:
                case 8: case 9: case 10: case 11: case 16:
                case 26: case 27:
                    return 5;  // param6 = Mix
                case 13:
                    return 0;  // Delay: param1 = Mix
                case 22:
                    return 4;  // tcDeepVerb: param5 = Mix
                case 28:
                    return 10; // VintageRev: param11 = Mix
                default:
                    return -1;
            }
        }
    }

    void FXEngine::updateParameters(juce::AudioProcessorValueTreeState& apvts)
    {
        auto getInt = [&](const char* id) -> int {
            if (auto* raw = apvts.getRawParameterValue(id))
                return static_cast<int>(std::round(raw->load()));
            if (auto* param = apvts.getParameter(id))
                if (auto* choice = dynamic_cast<juce::AudioParameterChoice*>(param))
                    return choice->getIndex();
            return 0;
        };

        auto getFloat = [&](const char* id, float fallback = 0.0f) -> float {
            if (auto* param = apvts.getRawParameterValue(id))
                return param->load();
            return fallback;
        };

        static constexpr const char* kSlotTypeIds[kNumSlots] = { "fx1_type", "fx2_type", "fx3_type", "fx4_type" };
        static constexpr const char* kSlotGainIds[kNumSlots] = { "fx1_gain", "fx2_gain", "fx3_gain", "fx4_gain" };
        static constexpr const char* kSlotMixIds[kNumSlots]  = { "fx1_mix",  "fx2_mix",  "fx3_mix",  "fx4_mix"  };
        static constexpr const char* kSlotParamIds[kNumSlots][12] = {
            { "fx1_param1", "fx1_param2", "fx1_param3", "fx1_param4", "fx1_param5", "fx1_param6",
              "fx1_param7", "fx1_param8", "fx1_param9", "fx1_param10", "fx1_param11", "fx1_param12" },
            { "fx2_param1", "fx2_param2", "fx2_param3", "fx2_param4", "fx2_param5", "fx2_param6",
              "fx2_param7", "fx2_param8", "fx2_param9", "fx2_param10", "fx2_param11", "fx2_param12" },
            { "fx3_param1", "fx3_param2", "fx3_param3", "fx3_param4", "fx3_param5", "fx3_param6",
              "fx3_param7", "fx3_param8", "fx3_param9", "fx3_param10", "fx3_param11", "fx3_param12" },
            { "fx4_param1", "fx4_param2", "fx4_param3", "fx4_param4", "fx4_param5", "fx4_param6",
              "fx4_param7", "fx4_param8", "fx4_param9", "fx4_param10", "fx4_param11", "fx4_param12" }
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
            int newType = getInt(kSlotTypeIds[s]);
            slots[s].setType(newType);

            float newGain = getFloat(kSlotGainIds[s]);
            if (!isHardwareSlotGainActive(fxRouting, s) && newGain <= 0.001f)
                newGain = 1.0f;
            slots[s].setGain(newGain);

            // Leer parámetros 1-12 para este slot
            float slotParams[12] = {};
            for (int p = 0; p < 12; ++p)
            {
                slotParams[p] = getFloat(kSlotParamIds[s][p]);
                slots[s].setParameter(p, slotParams[p]);
            }

            float newMix = getFloat(kSlotMixIds[s], 1.0f);
            const int delegatedMixIdx = getSlotDelegatedMixParamIndex(newType);
            if (delegatedMixIdx >= 0 && delegatedMixIdx < 12 && newMix >= 0.999f)
                newMix = slotParams[delegatedMixIdx];
            slots[s].setMix(newMix);
        }
    }

    void FXEngine::copyExternalModulatorData(const float* modL, const float* modR, int numSamples)
    {
        const int count = juce::jlimit(0, kMaxExternalModSamples, numSamples);
        if (count > 0 && modL != nullptr)
        {
            const juce::SpinLock::ScopedLockType sl(modLock);
            std::memcpy(internalModL.data(), modL, static_cast<size_t>(count) * sizeof(float));
            if (modR != nullptr)
                std::memcpy(internalModR.data(), modR, static_cast<size_t>(count) * sizeof(float));
            else
                std::memcpy(internalModR.data(), modL, static_cast<size_t>(count) * sizeof(float));
            internalModCount.store(count, std::memory_order_release);
            extModL = internalModL.data();
            extModR = internalModR.data();
            extModNumSamples = count;
        }
    }

    void FXEngine::setModulatorBuffer(const float* modL, const float* modR, int numSamples)
    {
        copyExternalModulatorData(modL, modR, numSamples);
    }

    void FXEngine::setSlotModulation(int slot, const float* level, float paramAmount, int numSamples)
    {
        if (slot < 0 || slot >= kNumSlots)
            return;

        slots[slot].setMatrixModulation(level, paramAmount, numSamples);
    }

    void FXEngine::process(juce::AudioBuffer<float>& buffer)
    {
        if (fxMode == 2) return; // Bypass global

        // Forward modulator to all slots (for FXVocoder external mode) under try-lock
        const juce::SpinLock::ScopedTryLockType modTryLock(modLock);
        if (modTryLock.isLocked() && (extModL != nullptr || extModR != nullptr))
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
        if (modTryLock.isLocked())
        {
            extModL = nullptr;
            extModR = nullptr;
            extModNumSamples = 0;
        }
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
