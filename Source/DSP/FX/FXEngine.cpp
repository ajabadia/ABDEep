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

    void FXEngine::process(juce::AudioBuffer<float>& buffer)
    {
        if (fxMode == 2) return; // Bypass global

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
    }

    void FXEngine::processSeries(juce::AudioBuffer<float>& buffer, int numSamples)
    {
        for (int s = 0; s < kNumSlots; ++s)
        {
            if (slots[s].isActive())
                slots[s].process(buffer, numSamples);
        }
    }

    void FXEngine::processParallel2x2(juce::AudioBuffer<float>& buffer, int numSamples)
    {
        int numCh = buffer.getNumChannels();
        ensureBuffers(numCh, numSamples);

        // FX1 y FX2 en paralelo usando buffers pre-alocados
        for (int ch = 0; ch < numCh; ++ch)
        {
            slotBuf1.copyFrom(ch, 0, buffer, ch, 0, numSamples);
            slotBuf2.copyFrom(ch, 0, buffer, ch, 0, numSamples);
        }

        if (slots[0].isActive()) slots[0].process(slotBuf1, numSamples);
        if (slots[1].isActive()) slots[1].process(slotBuf2, numSamples);

        // Sumar: buffer = (slotBuf1 + slotBuf2) * 0.5
        for (int ch = 0; ch < numCh; ++ch)
        {
            float* out = buffer.getWritePointer(ch);
            const float* b1 = slotBuf1.getReadPointer(ch);
            const float* b2 = slotBuf2.getReadPointer(ch);
            for (int s = 0; s < numSamples; ++s)
                out[s] = (b1[s] + b2[s]) * 0.5f;
        }

        // Series: FX3 → FX4
        if (slots[2].isActive()) slots[2].process(buffer, numSamples);
        if (slots[3].isActive()) slots[3].process(buffer, numSamples);
    }

    void FXEngine::processFullParallel(juce::AudioBuffer<float>& buffer, int numSamples)
    {
        int numCh = buffer.getNumChannels();
        ensureBuffers(numCh, numSamples);
        accumBuffer.clear();

        int activeCount = 0;
        for (int s = 0; s < kNumSlots; ++s)
        {
            if (!slots[s].isActive()) continue;
            activeCount++;

            // Copiar dry a slotBuf1 y procesar
            for (int ch = 0; ch < numCh; ++ch)
                slotBuf1.copyFrom(ch, 0, buffer, ch, 0, numSamples);
            slots[s].process(slotBuf1, numSamples);

            // Acumular
            for (int ch = 0; ch < numCh; ++ch)
            {
                float* a = accumBuffer.getWritePointer(ch);
                const float* sData = slotBuf1.getReadPointer(ch);
                for (int n = 0; n < numSamples; ++n)
                    a[n] += sData[n];
            }
        }

        if (activeCount > 0)
        {
            float scale = 1.0f / (float)activeCount;
            for (int ch = 0; ch < numCh; ++ch)
            {
                float* out = buffer.getWritePointer(ch);
                const float* a = accumBuffer.getReadPointer(ch);
                for (int s = 0; s < numSamples; ++s)
                    out[s] = a[s] * scale;
            }
        }
    }

    // ============================================================
    // Routing Mode 4: (1→2) ∥ (3→4) — Two series chains in parallel
    // ============================================================
    void FXEngine::processDualSeriesParallel(juce::AudioBuffer<float>& buffer, int numSamples)
    {
        int numCh = buffer.getNumChannels();
        ensureBuffers(numCh, numSamples);

        // Copiar dry a slotBuf1 y slotBuf2
        for (int ch = 0; ch < numCh; ++ch)
        {
            slotBuf1.copyFrom(ch, 0, buffer, ch, 0, numSamples);
            slotBuf2.copyFrom(ch, 0, buffer, ch, 0, numSamples);
        }

        // Chain A: FX1 → FX2
        if (slots[0].isActive()) slots[0].process(slotBuf1, numSamples);
        if (slots[1].isActive()) slots[1].process(slotBuf1, numSamples);

        // Chain B: FX3 → FX4
        if (slots[2].isActive()) slots[2].process(slotBuf2, numSamples);
        if (slots[3].isActive()) slots[3].process(slotBuf2, numSamples);

        // Mix A + B equally
        for (int ch = 0; ch < numCh; ++ch)
        {
            float* out = buffer.getWritePointer(ch);
            const float* a = slotBuf1.getReadPointer(ch);
            const float* b = slotBuf2.getReadPointer(ch);
            for (int s = 0; s < numSamples; ++s)
                out[s] = (a[s] + b[s]) * 0.5f;
        }
    }

    // ============================================================
    // Routing Mode 5: 1→(2∥3)→4 — Series with parallel middle split
    // ============================================================
    void FXEngine::processSeriesSplitMid(juce::AudioBuffer<float>& buffer, int numSamples)
    {
        int numCh = buffer.getNumChannels();
        ensureBuffers(numCh, numSamples);

        // FX1 en serie
        if (slots[0].isActive()) slots[0].process(buffer, numSamples);

        // Copiar para paralelo en medio (FX2 ∥ FX3)
        for (int ch = 0; ch < numCh; ++ch)
        {
            slotBuf1.copyFrom(ch, 0, buffer, ch, 0, numSamples);
            slotBuf2.copyFrom(ch, 0, buffer, ch, 0, numSamples);
        }

        if (slots[1].isActive()) slots[1].process(slotBuf1, numSamples);
        if (slots[2].isActive()) slots[2].process(slotBuf2, numSamples);

        // Mezclar FX2 + FX3
        for (int ch = 0; ch < numCh; ++ch)
        {
            float* out = buffer.getWritePointer(ch);
            const float* b1 = slotBuf1.getReadPointer(ch);
            const float* b2 = slotBuf2.getReadPointer(ch);
            for (int s = 0; s < numSamples; ++s)
                out[s] = (b1[s] + b2[s]) * 0.5f;
        }

        // FX4 en serie
        if (slots[3].isActive()) slots[3].process(buffer, numSamples);
    }

    // ============================================================
    // Routing Mode 6: (1∥2)→(3∥4) — Parallel pairs in series (two stages)
    // ============================================================
    void FXEngine::processParallelPairsSeries(juce::AudioBuffer<float>& buffer, int numSamples)
    {
        int numCh = buffer.getNumChannels();
        ensureBuffers(numCh, numSamples);

        // Stage 1: FX1 ∥ FX2
        for (int ch = 0; ch < numCh; ++ch)
        {
            slotBuf1.copyFrom(ch, 0, buffer, ch, 0, numSamples);
            slotBuf2.copyFrom(ch, 0, buffer, ch, 0, numSamples);
        }
        if (slots[0].isActive()) slots[0].process(slotBuf1, numSamples);
        if (slots[1].isActive()) slots[1].process(slotBuf2, numSamples);

        // Mezclar Stage 1 en buffer principal
        int activeStage1 = (slots[0].isActive() ? 1 : 0) + (slots[1].isActive() ? 1 : 0);
        if (activeStage1 > 0)
        {
            float scale = 1.0f / (float)activeStage1;
            for (int ch = 0; ch < numCh; ++ch)
            {
                float* out = buffer.getWritePointer(ch);
                const float* b1 = slotBuf1.getReadPointer(ch);
                const float* b2 = slotBuf2.getReadPointer(ch);
                for (int s = 0; s < numSamples; ++s)
                    out[s] = (b1[s] * (slots[0].isActive() ? 1.0f : 0.0f)
                            + b2[s] * (slots[1].isActive() ? 1.0f : 0.0f)) * scale;
            }
        }

        // Stage 2: FX3 ∥ FX4
        for (int ch = 0; ch < numCh; ++ch)
        {
            slotBuf1.copyFrom(ch, 0, buffer, ch, 0, numSamples);
            slotBuf2.copyFrom(ch, 0, buffer, ch, 0, numSamples);
        }
        if (slots[2].isActive()) slots[2].process(slotBuf1, numSamples);
        if (slots[3].isActive()) slots[3].process(slotBuf2, numSamples);

        // Mezclar Stage 2 en buffer principal
        int activeStage2 = (slots[2].isActive() ? 1 : 0) + (slots[3].isActive() ? 1 : 0);
        if (activeStage2 > 0)
        {
            float scale = 1.0f / (float)activeStage2;
            for (int ch = 0; ch < numCh; ++ch)
            {
                float* out = buffer.getWritePointer(ch);
                const float* b1 = slotBuf1.getReadPointer(ch);
                const float* b2 = slotBuf2.getReadPointer(ch);
                for (int s = 0; s < numSamples; ++s)
                    out[s] = (b1[s] * (slots[2].isActive() ? 1.0f : 0.0f)
                            + b2[s] * (slots[3].isActive() ? 1.0f : 0.0f)) * scale;
            }
        }
    }

    // ============================================================
    // Routing Mode 7: (1→2→3) ∥ 4 — Series chain + parallel effect
    // ============================================================
    void FXEngine::processSeriesChainParallel(juce::AudioBuffer<float>& buffer, int numSamples)
    {
        int numCh = buffer.getNumChannels();
        ensureBuffers(numCh, numSamples);

        // Copiar dry para FX4
        for (int ch = 0; ch < numCh; ++ch)
            slotBuf1.copyFrom(ch, 0, buffer, ch, 0, numSamples);

        // FX1 → FX2 → FX3 en serie
        if (slots[0].isActive()) slots[0].process(buffer, numSamples);
        if (slots[1].isActive()) slots[1].process(buffer, numSamples);
        if (slots[2].isActive()) slots[2].process(buffer, numSamples);

        // FX4 en paralelo (sobre copia dry)
        if (slots[3].isActive()) slots[3].process(slotBuf1, numSamples);

        // Mezclar: serie (buffer) + FX4 (slotBuf1)
        bool hasSeries = slots[0].isActive() || slots[1].isActive() || slots[2].isActive();
        bool hasParallel = slots[3].isActive();
        if (hasSeries && hasParallel)
        {
            for (int ch = 0; ch < numCh; ++ch)
            {
                float* out = buffer.getWritePointer(ch);
                const float* par = slotBuf1.getReadPointer(ch);
                for (int s = 0; s < numSamples; ++s)
                    out[s] = (out[s] + par[s]) * 0.5f;
            }
        }
        else if (hasParallel && !hasSeries)
        {
            // Solo FX4 activo, copiar resultado
            for (int ch = 0; ch < numCh; ++ch)
                buffer.copyFrom(ch, 0, slotBuf1, ch, 0, numSamples);
        }
    }

    // ============================================================
    // Routing Mode 8: (1∥2)→3→4 — Parallel front, series back
    // ============================================================
    void FXEngine::processParallelFrontSeries(juce::AudioBuffer<float>& buffer, int numSamples)
    {
        int numCh = buffer.getNumChannels();
        ensureBuffers(numCh, numSamples);

        // FX1 ∥ FX2 en paralelo al inicio
        for (int ch = 0; ch < numCh; ++ch)
        {
            slotBuf1.copyFrom(ch, 0, buffer, ch, 0, numSamples);
            slotBuf2.copyFrom(ch, 0, buffer, ch, 0, numSamples);
        }
        if (slots[0].isActive()) slots[0].process(slotBuf1, numSamples);
        if (slots[1].isActive()) slots[1].process(slotBuf2, numSamples);

        // Mezclar paralelo en buffer
        int activePar = (slots[0].isActive() ? 1 : 0) + (slots[1].isActive() ? 1 : 0);
        if (activePar > 0)
        {
            float scale = 1.0f / (float)activePar;
            for (int ch = 0; ch < numCh; ++ch)
            {
                float* out = buffer.getWritePointer(ch);
                const float* b1 = slotBuf1.getReadPointer(ch);
                const float* b2 = slotBuf2.getReadPointer(ch);
                for (int s = 0; s < numSamples; ++s)
                    out[s] = (b1[s] * (slots[0].isActive() ? 1.0f : 0.0f)
                            + b2[s] * (slots[1].isActive() ? 1.0f : 0.0f)) * scale;
            }
        }

        // Series: FX3 → FX4
        if (slots[2].isActive()) slots[2].process(buffer, numSamples);
        if (slots[3].isActive()) slots[3].process(buffer, numSamples);
    }

    // ============================================================
    // Routing Mode 9: 1→2→3→4+FB — Series with global feedback
    // ============================================================
    void FXEngine::processSeriesWithFeedback(juce::AudioBuffer<float>& buffer, int numSamples)
    {
        int numCh = buffer.getNumChannels();
        ensureBuffers(numCh, numSamples);

        // Asegurar buffer de feedback del tamaño correcto
        if (fbBuffer.getNumSamples() < numSamples || fbBuffer.getNumChannels() < numCh)
            fbBuffer.setSize(numCh, numSamples, false, false, true);
        // NOTA: No hacer clear() aquí — el buffer se inicializa vacío al allocarse
        // y conserva la salida del bloque anterior como señal de feedback.

        // fbGain se actualiza desde updateParameters
        // Si es 0, no hay feedback — funciona como series normal

        // Mezclar feedback con entrada (solo si hay feedback)
        if (fbGain > 0.001f)
        {
            for (int ch = 0; ch < numCh; ++ch)
            {
                float* out = buffer.getWritePointer(ch);
                const float* fb = fbBuffer.getReadPointer(ch);
                for (int s = 0; s < numSamples; ++s)
                    out[s] = out[s] + fb[s] * fbGain;
            }
        }

        // Series: FX1 → FX2 → FX3 → FX4
        if (slots[0].isActive()) slots[0].process(buffer, numSamples);
        if (slots[1].isActive()) slots[1].process(buffer, numSamples);
        if (slots[2].isActive()) slots[2].process(buffer, numSamples);
        if (slots[3].isActive()) slots[3].process(buffer, numSamples);

        // Guardar salida para feedback en el próximo bloque
        for (int ch = 0; ch < numCh; ++ch)
            fbBuffer.copyFrom(ch, 0, buffer, ch, 0, numSamples);
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
