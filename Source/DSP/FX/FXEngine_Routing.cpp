#include "FXEngine.h"

namespace ABD
{

// ============================================================
// Routing Mode 0: 1→2→3→4 — Simple series chain
// ============================================================
void FXEngine::processSeries(juce::AudioBuffer<float>& buffer, int numSamples)
{
    for (int s = 0; s < kNumSlots; ++s)
    {
        if (slots[s].isActive())
            slots[s].process(buffer, numSamples);
    }
}

// ============================================================
// Routing Mode 1: (1∥2)→(3∥4) — Parallel pairs in series
// ============================================================
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

// ============================================================
// Routing Mode 3: 1∥2∥3∥4 — Full parallel
// ============================================================
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
// Routing Modes 2 & 6: (1∥2)→(3∥4) — Parallel pairs in series (two stages)
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

} // namespace ABD
