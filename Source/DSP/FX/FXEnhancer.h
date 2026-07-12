#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXEnhancer: Procesador espectral (Enhancer).
     * Basado en DeepMind 12 (type=18). 3-bandas con Bass/Mid/High + spread estéreo.
     *
     * Parámetros:
     *   0: OutGain   (0-1, -12..+12 dB)
     *   1: Spread    (0-1, 0-100%)
     *   2: BassGain  (0-1, 0-100%)
     *   3: BassFreq  (0-1, 1-50)
     *   4: MidGain   (0-1, 0-100%)
     *   5: MidQ      (0-1, 1-50)
     *   6: HiGain    (0-1, 0-100%)
     *   7: HiFreq    (0-1, 1-50)
     *   8: Solo      (0=OFF, 1=ON)
     */
    class FXEnhancer : public FXBase
    {
    public:
        FXEnhancer();
        ~FXEnhancer() override = default;
        void prepare(double, int) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR, int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 9; }
        juce::String getEffectName() const override { return "Enhancer"; }

    private:
        double sampleRate = 44100.0;
        float outGain = 0.5f, spread = 0.3f;
        float bassGain = 0.3f, bassFreq = 0.3f;
        float midGain  = 0.3f, midQ = 0.3f;
        float hiGain   = 0.3f, hiFreq = 0.3f;
        bool  solo = false;

        // Bass shelving filter
        float bassStateL = 0.0f, bassStateR = 0.0f;
        float bassCoeff = 0.0f;
        // Peak filter (mid)
        float midStateL = 0.0f, midStateR = 0.0f;
        float midDelayL = 0.0f, midDelayR = 0.0f;
        float midCoeffA = 0.0f, midCoeffB = 0.0f;
        // High shelving
        float hiStateL = 0.0f, hiStateR = 0.0f;
        float hiCoeff = 0.0f;

        void updateCoeffs();
    };
}
