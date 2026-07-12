#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXNoiseGate: Noise Gate / Transient Gate / Ducker.
     * Basado en DeepMind 12 (type=33).
     *
     * Parámetros:
     *   0: Threshold (0-1, -50..0 dB)
     *   1: Range     (0-1, -100..0 dB)
     *   2: Attack    (0-1, 0-20 ms)
     *   3: Release   (0-1, 2-2000 ms)
     *   4: Hold      (0-1, 2-2000 ms)
     *   5: Punch     (0-1, -6..+6 dB)
     *   6: Mode      (0=GAT, 1=TRN, 2=DUC)
     *   7: Power     (0=ON, 1=OFF)
     */
    class FXNoiseGate : public FXBase
    {
    public:
        FXNoiseGate();
        ~FXNoiseGate() override = default;
        void prepare(double, int) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR, int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 8; }
        juce::String getEffectName() const override { return "Noise Gate"; }

    private:
        double sampleRate = 44100.0;
        float threshold = 0.5f, range = 0.5f;
        float attackMs = 1.0f, releaseMs = 100.0f, holdMs = 50.0f;
        float punch = 0.5f;
        int gateMode = 0; // 0=GAT, 1=TRN, 2=DUC
        bool power = true;

        float envL = 0.0f, envR = 0.0f;
        float gainL = 1.0f, gainR = 1.0f;
        float atkCoeff = 0.01f, relCoeff = 0.001f;
        float holdTimerL = 0.0f, holdTimerR = 0.0f;
        float holdSamples = 0.0f;

        void updateTimeCoeffs();
    };
}
