#pragma once

#include "FXSlot.h"
#include <JuceHeader.h>

namespace ABD
{
    /**
     * FXEngine: Orquestador de 4 slots de efectos con matriz de ruteo.
     * 
     * Routing modes (0-9):
     *   0: Series 1→2→3→4
     *   1: Parallel 1/2 + Series 3→4
     *   2: Parallel 1/2 + Parallel 3/4
     *   3: Full Parallel 1∥2∥3∥4
     *   4: (1→2) ∥ (3→4)  — Two series chains in parallel
     *   5: 1→(2∥3)→4      — Series with parallel middle split
     *   6: (1∥2)→(3∥4)     — Parallel pairs in series (two stages)
     *   7: (1→2→3) ∥ 4    — Series chain + parallel effect
     *   8: (1∥2)→3→4      — Parallel front, series back
     *   9: 1→2→3→4+FB     — Series with global feedback
     * 
     * FX Mode:
     *   0: Insert
     *   1: Send
     *   2: Bypass
     */
    class FXEngine
    {
    public:
        FXEngine();
        ~FXEngine() = default;

        void prepare(double sampleRate, int samplesPerBlock);

        void updateParameters(juce::AudioProcessorValueTreeState& apvts);

        void setFXMode(int mode) { fxMode = std::clamp(mode, 0, 2); }
        void setRoutingMode(int mode) { fxRouting = std::clamp(mode, 0, 9); }

        /** Procesa todo el bloque de audio a través de los 4 slots FX */
        void process(juce::AudioBuffer<float>& buffer);

        void reset();

        FXSlot& getSlot(int index);
        const FXSlot& getSlot(int index) const;

        int getRoutingMode() const { return fxRouting; }
        int getFXMode() const { return fxMode; }

    private:
        static constexpr int kNumSlots = 4;
        FXSlot slots[kNumSlots];

        int fxRouting = 0;   // 0-9 modo de ruteo
        int fxMode = 0;      // 0=Insert, 1=Send, 2=Bypass

        // Buffers auxiliares pre-alocados para routing en paralelo
        juce::AudioBuffer<float> parallelBuffer;
        juce::AudioBuffer<float> accumBuffer;
        juce::AudioBuffer<float> slotBuf1;
        juce::AudioBuffer<float> slotBuf2;
        int lastPreparedChannels = 0;
        int lastPreparedSamples = 0;

        // Send mode state
        float sendLevel = 0.5f;

        // Feedback state for mode 9
        juce::AudioBuffer<float> fbBuffer;
        float fbGain = 0.0f;

        void ensureBuffers(int numChannels, int numSamples);
        void processSeries(juce::AudioBuffer<float>& buffer, int numSamples);
        void processParallel2x2(juce::AudioBuffer<float>& buffer, int numSamples);
        void processFullParallel(juce::AudioBuffer<float>& buffer, int numSamples);

        // Nuevos routing modes
        void processDualSeriesParallel(juce::AudioBuffer<float>& buffer, int numSamples);     // mode 4
        void processSeriesSplitMid(juce::AudioBuffer<float>& buffer, int numSamples);          // mode 5
        void processParallelPairsSeries(juce::AudioBuffer<float>& buffer, int numSamples);     // mode 6
        void processSeriesChainParallel(juce::AudioBuffer<float>& buffer, int numSamples);     // mode 7
        void processParallelFrontSeries(juce::AudioBuffer<float>& buffer, int numSamples);     // mode 8
        void processSeriesWithFeedback(juce::AudioBuffer<float>& buffer, int numSamples);      // mode 9
    };
}
