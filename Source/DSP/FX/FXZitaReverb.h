#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXZitaReverb: Clean high-fidelity algorithmic reverb.
     *
     * Based on the Zita/AIR reverb topology: input allpass,
     * parallel bank of 4 modulated comb filters, output allpass chain.
     * Source: Odin2 ZitaReverb / Surge clean reverb.
     *
     * Parameters:
     *   0: Size     (0-1, room size / comb delay scaling)
     *   1: Decay    (0-1, comb feedback)
     *   2: Damping  (0-1, HF absorption in combs)
     *   3: PreDelay (0-1, 0-100ms input pre-delay)
     *   4: Mix      (0-1, dry/wet mix)
     */
    class FXZitaReverb : public FXBase
    {
    public:
        FXZitaReverb();
        ~FXZitaReverb() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 5; }
        juce::String getEffectName() const override { return "Zita Reverb"; }

    private:
        double sampleRate = 44100.0;

        float sizeParam = 0.5f, decayParam = 0.5f, dampingParam = 0.5f, preDelayParam = 0.0f, mix = 0.4f;

        // Input allpass
        static constexpr int kInputAPSize = 512;
        std::vector<float> inputAPBuf;
        int inputAPPos = 0;

        // 4 parallel combs (stereo)
        static constexpr int kNumCombs = 4;
        std::vector<float> combBufL[kNumCombs], combBufR[kNumCombs];
        int combSizes[kNumCombs] = {};
        int combWritePos[kNumCombs] = {};
        float combStateL[kNumCombs] = {}, combStateR[kNumCombs] = {};

        // 2 output allpass (stereo)
        static constexpr int kOutAPCount = 2;
        std::vector<float> outAPBufL[kOutAPCount], outAPBufR[kOutAPCount];
        int outAPSizes[kOutAPCount] = {};
        int outAPPos[kOutAPCount] = {};

        // Pre-delay
        std::vector<float> preDelayBufL, preDelayBufR;
        int preDelaySize = 0;
        int preDelayPos = 0;

        void updateCombLengths();
    };
}
