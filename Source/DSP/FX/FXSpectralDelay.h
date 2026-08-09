#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXSpectralDelay: FFT-based frequency-domain delay.
     *
     * Splits the signal into frequency bins via DFT, applies
     * independent delay per band, and resynthesizes. Creates
     * spectrally-sculpted echoes unlike time-domain delays.
     *
     * Parameters:
     *   0: Mix      (0-1, dry/wet mix)
     *   1: Time     (0-1, delay time 50ms-1500ms)
     *   2: BandWidth(0-1, frequency band width 0=narrow 1=wide)
     *   3: Feedback (0-1, feedback amount)
     *   4: Diffusion(0-1, spread of delay times across bands)
     */
    class FXSpectralDelay : public FXBase
    {
    public:
        FXSpectralDelay();
        ~FXSpectralDelay() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 5; }
        juce::String getEffectName() const override { return "Spectral Delay"; }

    private:
        double sampleRate = 44100.0;

        float paramMix = 0.35f;
        float paramTime = 0.35f;
        float paramBandWidth = 0.5f;
        float paramFeedback = 0.4f;
        float paramDiffusion = 0.3f;

        // DFT size (power of 2)
        static constexpr int kFFTSize = 1024;
        static constexpr int kNumBands = kFFTSize / 2;

        // Delay buffer per band (L+R)
        std::vector<float> delayBufL;
        std::vector<float> delayBufR;
        int delayMask = 0;
        int writePos = 0;

        // Band gain modulation (spectral smearing)
        std::vector<float> bandGainsL;
        std::vector<float> bandGainsR;
        std::vector<float> bandGainsTargetL;
        std::vector<float> bandGainsTargetR;

        // Running DFT accumulators (simplified overlap-add)
        std::vector<float> accumL;
        std::vector<float> accumR;
        int accumPos = 0;

        uint32_t noiseSeed = 0xA1B2C3D4u;

        float noiseGenerate();
        float delayForBand(int band) const;
    };
}
