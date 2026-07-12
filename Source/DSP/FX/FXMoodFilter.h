#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXMoodFilter: Filtro multimodo resonante con LFO y envelope follower.
     * Basado en DeepMind 12 (type=8).
     *
     * Parámetros:
     *   0: Speed   (0-1, 0.05-20 Hz)
     *   1: Depth   (0-1, 0-100%)
     *   2: Reso    (0-1, 0-100%)
     *   3: Base    (0-1, 20-15000 Hz)
     *   4: Type    (0-1, Low/High/Band/Notch)
     *   5: Wave    (0-1, Tri/Sin/Saw+/Saw-/Ramp/Sq/Rand)
     *   6: EnvMod  (0-1, -100..+100%)
     *   7: Drive   (0-1, 0-100% overdrive)
     *   8: Poles   (0=2P, 1=4P)
     */
    class FXMoodFilter : public FXBase
    {
    public:
        FXMoodFilter();
        ~FXMoodFilter() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 9; }
        juce::String getEffectName() const override { return "Mood Filter"; }

    private:
        double sampleRate = 44100.0;
        float speed = 0.3f, depth = 0.5f, reso = 0.2f, baseFreq = 0.5f;
        int filterType = 0, waveShape = 0, fourPole = 0;
        float envMod = 0.0f, drive = 0.0f;

        // LFO state
        double lfoPhase = 0.0, lfoInc = 0.0;
        float lfoValue = 0.0f;

        // State variable filter (SVF)
        float svfLowL = 0.0f, svfBandL = 0.0f, svfHighL = 0.0f;
        float svfLowR = 0.0f, svfBandR = 0.0f, svfHighR = 0.0f;

        // Envelope follower
        float envStateL = 0.0f, envStateR = 0.0f;
        float envAttack = 0.01f, envRelease = 0.001f;

    // SVF coefficients
    float gCoeff = 0.0f, rCoeff = 0.0f, driveGain = 0.0f;

    // LCG random generator (thread-safe, no static state)
    unsigned int rngState = 12345;

    void updateLFO();
    float getWaveform(double phase, int shape);
    void updateCoeffs(float freqHz);
    float fastRand();
    };
}
