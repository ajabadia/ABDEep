#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXSpaceEchoRE201: Roland Space Echo RE-201 emulation.
     *
     * 3 playback head tape echo with spring reverb tank.
     * Uses multi-tap delay with independent head levels and
     * a simple reverb plate for the spring tank.
     *
     * Parameters:
     *   0: Mode     (0-1 → 5 intensity modes: A,B,C,D,E)
     *   1: Time     (0-1, delay time 120ms-1500ms)
     *   2: Feedback (0-1, tape feedback amount)
     *   3: Bass     (0-1, tone control bass)
     *   4: Treble   (0-1, tone control treble)
     *   5: Reverb   (0-1, spring reverb mix)
     */
    class FXSpaceEchoRE201 : public FXBase
    {
    public:
        FXSpaceEchoRE201();
        ~FXSpaceEchoRE201() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 6; }
        juce::String getEffectName() const override { return "Space Echo RE-201"; }

    private:
        double sampleRate = 44100.0;

        // Parameters
        float paramMode = 0.0f;
        float paramTime = 0.4f;
        float paramFeedback = 0.4f;
        float paramBass = 0.5f;
        float paramTreble = 0.5f;
        float paramReverb = 0.3f;

        // Tape delay line (max ~1.6s at 44.1kHz)
        static constexpr int kMaxDelay = 70560;
        std::vector<float> delayBufL;
        std::vector<float> delayBufR;
        int delayMask = 0;
        int writePos = 0;

        // Reverb tank (simple plate)
        static constexpr int kReverbSize = 16384;
        std::vector<float> reverbBufL;
        std::vector<float> reverbBufR;
        int reverbMask = 0;
        int reverbWPos = 0;
        float reverbLP = 0.0f;

        // Tape degradation state
        float tapeWow = 0.0f;
        float tapeFlutter = 0.0f;
        uint32_t noiseSeed = 0x12345678u;

        // 3 playback heads (normalized positions within delay)
        struct Head { float delayFrac; float gainL; float gainR; };
        Head heads[3];

        // Head config per mode
        struct ModeConfig { float head1Pos; float head2Pos; float head3Pos;
                            float head1Gain; float head2Gain; float head3Gain;
                            float reverbSend; };
        ModeConfig modeConfigs[5];

        float tapeNoise();
        float readTape(const std::vector<float>& buf, float delaySamples) const;
        void applyToneControl(float& bass, float& treble);
    };
}
