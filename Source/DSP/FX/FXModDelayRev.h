#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXModDelayRev: Modulated Delay + Reverb híbrido.
     * Basado en DeepMind 12 (type=12). Modos Parallel/Serial.
     * Usa delay modulado + reverb Schroeder (comb + allpass).
     *
     * Parámetros:
     *   0: Time     (0-1, 1-1500ms)
     *   1: Factor   (0-1, factor rítmico)
     *   2: Feedback (0-1, 0-100%)
     *   3: FeedHC   (0-1, 200-20000Hz)
     *   4: Depth    (0-1, 0-100%)
     *   5: Speed    (0-1, 0-10Hz)
     *   6: Mode     (0=PAR, 1=SER)
     *   7: Rtype    (0-1, AMB/CLUB/HALL)
     *   8: Decay    (0-1, 1-10)
     *   9: Damping  (0-1, 1-20kHz)
     *   10: Balance (0-1, delay/reverb)
     *   11: Mix     (0-1, 0-100%)
     */
    class FXModDelayRev : public FXBase
    {
    public:
        FXModDelayRev();
        ~FXModDelayRev() override = default;
        void prepare(double, int) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR, int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 12; }
        juce::String getEffectName() const override { return "Mod Delay Rev"; }

    private:
        double sampleRate = 44100.0;
        float time_ = 0.3f, feedback = 0.3f, feedHC = 0.8f;
        float depth = 0.3f, speed = 0.3f, decay = 0.5f;
        float damping = 0.5f, balance = 0.5f, mix = 0.3f;
        int factor = 0, rType = 0, mode = 0;

        // Delay line
        juce::AudioSampleBuffer delayBufL, delayBufR;
        int writePosL = 0, writePosR = 0, maxDelaySamples = 0;
        int delaySamples = 0;

        // LFO modulation
        double lfoPhase = 0.0, lfoInc = 0.0;

        // Feedback high-cut filter
        float lpfL = 0.0f, lpfR = 0.0f, hcCoeff = 0.0f;

        // Reverb (Schroeder simplificado): 4 comb + 3 allpass
        juce::AudioSampleBuffer combBufL, combBufR;
        int combPos = 0;
        int combDelay[4] = {};
        int allpassDelay[3] = {};
        float combStateL[4] = {}, combStateR[4] = {};
        float apStateL[3] = {}, apStateR[3] = {};
        float dampCoeff = 0.0f;
        float wetL = 0.0f, wetR = 0.0f;

        void updateParams();
    };
}
