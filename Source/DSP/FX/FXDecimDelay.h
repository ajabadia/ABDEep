#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXDecimDelay: Decimator Delay (bit crusher + downsampler + delay).
     * Basado en DeepMind 12 (type=34).
     *
     * Parámetros:
     *   0: Mix      (0-1, 0-100%)
     *   1: Time     (0-1, 1-1500ms)
     *   2: DownSample (0-1, 0-100%)
     *   3: FactorL  (0-1, factor rítmico L)
     *   4: FactorR  (0-1, factor rítmico R)
     *   5: BitReduce (0-1, 1-24 bits)
     *   6: Cutoff   (0-1, 30-20000Hz)
     *   7: Resonance(0-1, 0-100%)
     *   8: FilterType (0-1, LP/HP/BP/Notch)
     *   9: FeedL    (0-1, feedback L 0-100%)
     *   10: FeedR   (0-1, feedback R 0-100%)
     *   11: Decimate (0=PRE, 1=POST)
     */
    class FXDecimDelay : public FXBase
    {
    public:
        FXDecimDelay();
        ~FXDecimDelay() override = default;
        void prepare(double, int) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR, int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 12; }
        juce::String getEffectName() const override { return "Decimator Delay"; }

    private:
        double sampleRate = 44100.0;
        float mix = 0.3f, timeMs = 0.3f;
        float downSamp = 0.0f, bitReduce = 0.8f;
        float cutoff = 0.8f, resonance = 0.2f;
        float feedL = 0.3f, feedR = 0.3f;
        int filterType = 0;
        int factorL = 4, factorR = 4; // rhythmic factors
        bool decimatePre = true;

        float factorTab[9] = { 0.25f, 0.375f, 0.5f, 0.667f, 1.0f, 1.333f, 1.5f, 2.0f, 3.0f };

        // Delay buffers
        juce::AudioSampleBuffer bufL, bufR;
        int writePosL = 0, writePosR = 0, maxDelaySamples = 0;
        int delaySamplesL = 0, delaySamplesR = 0;

        // Decimation state
        int decimCounterL = 0, decimCounterR = 0;
        int decimRateL = 1, decimRateR = 1;
        float lastSampleL = 0.0f, lastSampleR = 0.0f;
        int bitMask = 0xFFFFFF;

        // SVF filter state
        float svfLowL = 0.0f, svfBandL = 0.0f, svfHighL = 0.0f;
        float svfLowR = 0.0f, svfBandR = 0.0f, svfHighR = 0.0f;
        float gCoeff = 0.0f, rCoeff = 0.0f;

        void updateDelaySamples();
        void updateDecimParams();
        float applyDecim(float sample);
    };
}
