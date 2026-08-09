#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXVocoder: Classic multiband channel vocoder.
     *
     * Splits the modulator into frequency bands using a bank of
     * bandpass filters, extracts envelopes, and applies them to
     * resynthesized carrier bands. Creates robotic/synthesized voice effects.
     *
     * Parameters:
     *   0: Mix          (0-1, dry/wet mix)
     *   1: BandCount    (0-1, number of bands 4-32)
     *   2: Attack       (0-1, envelope follower attack time)
     *   3: Release      (0-1, envelope follower release time)
     *   4: FormantShift (0-1, shift bands up/down)
     *   5: ModSrc       (0=MIC/EXT IN, 1=NOISE/FORMANTS internal generator)
     *
     * Modulator routing:
     *   Mode 0: External modulator via setModulatorInput() (mic/sidechain)
     *   Mode 1: Internal pink noise + formant resonators
     */
    class FXVocoder : public FXBase
    {
    public:
        FXVocoder();
        ~FXVocoder() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 6; }
        juce::String getEffectName() const override { return "Multi-Band Vocoder"; }

        /** Receive external modulator audio (mic/sidechain). Called by FXSlot/FXEngine. */
        void setModulatorInput(const float* modL, const float* modR, int numSamples) override;

    private:
        double sampleRate = 44100.0;

        float paramMix = 0.5f;
        float paramBandCount = 0.4f;
        float paramAttack = 0.3f;
        float paramRelease = 0.5f;
        float paramFormantShift = 0.5f;
        float paramModSrc = 0.0f;   // 0 = external, 1 = internal noise/formants

        static constexpr int kMaxBands = 32;

        // Per-band filter state
        struct VocoderBand
        {
            // Bandpass filter (biquad)
            float b0 = 0.0f, b1 = 0.0f, b2 = 0.0f;
            float a1 = 0.0f, a2 = 0.0f;
            float x1 = 0.0f, x2 = 0.0f;
            float y1 = 0.0f, y2 = 0.0f;

            // Envelope follower
            float envelope = 0.0f;
            float centerFreq = 0.0f;
        };

        VocoderBand analysisBandsL[kMaxBands];
        VocoderBand analysisBandsR[kMaxBands];

        // Resynthesis filter state (carrier side)
        struct ResynthBand
        {
            float b0 = 0.0f, b1 = 0.0f, b2 = 0.0f;
            float a1 = 0.0f, a2 = 0.0f;
            float x1 = 0.0f, x2 = 0.0f;
            float y1 = 0.0f, y2 = 0.0f;
        };

        ResynthBand resynthBandsL[kMaxBands];
        ResynthBand resynthBandsR[kMaxBands];

        // Band center frequencies (Hz) - computed in prepare()
        float bandFreqs[kMaxBands];

        // External modulator pointers (set each block via setModulatorInput)
        const float* extModL = nullptr;
        const float* extModR = nullptr;
        int extModSamples = 0;

        // Internal modulator state (pink noise + formant resonators)
        float noiseStateL = 0.0f;
        float noiseStateR = 0.0f;
        unsigned int noiseSeed = 12345;

        // Internal formant resonator bands
        struct FormantResonator
        {
            float b0 = 0.0f, b1 = 0.0f, b2 = 0.0f;
            float a1 = 0.0f, a2 = 0.0f;
            float x1 = 0.0f, x2 = 0.0f;
            float y1 = 0.0f, y2 = 0.0f;
        };

        FormantResonator formantBandsL[kMaxBands];
        FormantResonator formantBandsR[kMaxBands];

        void updateBandpass(VocoderBand& band, float freq, float q);
        void updateFormantResonator(FormantResonator& res, float freq, float q);
        void updateResynthBand(ResynthBand& band, float freq, float q);
        void computeBandFrequencies(int numBands);
        float generatePinkNoise(float& state);
    };
}
