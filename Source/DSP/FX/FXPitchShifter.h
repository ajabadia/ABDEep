#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXPitchShifter: Pitch shifter dual (type=29) y vintage (type=35).
     * Usa overlapping grains con ventana Hann para pitch shifting.
     *
     * Parámetros (Dual Pitch / Vintage Pitch):
     *   0: Semi1    (0-1, -12..+12 st)
     *   1: Cent1    (0-1, -50..+50 cents)
     *   2: Delay1   (0-1, 1-500ms / feedback si vintage)
     *   3: Gain1    (0-1, 0-100%) / Feedback1 si vintage
     *   4: Pan1     (0-1, -100..+100%)
     *   5: Mix      (0-1, 0-100%)
     *   6: Semi2    (0-1, -12..+12 st)
     *   7: Cent2    (0-1, -50..+50 cents)
     *   8: Delay2   (0-1, 1-500ms) / Feedback2 si vintage
     *   9: Gain2    (0-1, 0-100%) / Pan2 si vintage
     *   10: Pan2    (0-1) / feedback2 si vintage
     *   11: HiCut   (0-1, 200-20000Hz)
     *
     * vintageMode = true → usa feedback en vez de delay+gain
     */
    class FXPitchShifter : public FXBase
    {
    public:
        FXPitchShifter(bool vintageMode = false);
        ~FXPitchShifter() override = default;

        void prepare(double, int) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR, int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 12; }
        juce::String getEffectName() const override;

    private:
        double sampleRate = 44100.0;
        bool vintage;

        // Parámetros voice 1 y 2
        float semi1 = 0.5f, cent1 = 0.5f, delay1 = 0.3f;
        float gain1 = 0.5f, pan1 = 0.5f;
        float semi2 = 0.5f, cent2 = 0.5f, delay2 = 0.3f;
        float gain2 = 0.5f, pan2 = 0.5f;
        float mix = 0.5f, hiCut = 0.8f;

        // Buffers de delay circulares para pitch shifting
        juce::AudioSampleBuffer bufL, bufR;
        int writePosL = 0, writePosR = 0;
        int maxDelaySamples = 0;
        float hiCutLP = 0.0f;

        // Crossfade state
        double phase1 = 0.0, phase2 = 0.0;
        double grainInc1 = 0.0, grainInc2 = 0.0;
        int grainLen = 1024;

    // Feedback state (vintage mode)
    float fbL = 0.0f, fbR = 0.0f;

    // HiCut filter state (was incorrectly static local)
    float hcStateL = 0.0f, hcStateR = 0.0f;

        void updateGrainParams();
        float readDelay(juce::AudioSampleBuffer& buf, int writePos, float readOffset, int maxSamp);
    };
}
