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
        //
        // THE SIZE MUST BE A POWER OF TWO, because the wrap is a bit mask and a
        // mask only wraps when it is 2^n - 1. The old `kMaxDelay = 70560`
        // (0b1_0001_0011_1010_0000) was not, and its low five bits were zero,
        // so `(writePos + 1) & delayMask` evaluated to 0 on the very first
        // sample and stayed 0 forever: every sample was written to the same
        // cell, the reads landed on masked-off indices that had never been
        // written, and the tape echo did not exist at all.
        //
        // 2^17 = 131072 is the first size that covers the 1.6s this comment
        // claims, and 2^16 would have been enough for the buffer but not for
        // the delay range (see `maxDelay` in process: at 44.1kHz the ceiling
        // is `sampleRate * 1.5` = 66150 samples, and 2^16 would have clipped it
        // to 65535). With 2^17 the `maxDelay` expression returns exactly the
        // same numbers it returned before, so the ONLY thing that changes is
        // that the line advances.
        static constexpr int kDelaySize = 131072;          // 2^17 = 1.6s at 44.1kHz
        static constexpr int kDelayMask = kDelaySize - 1;  // 2^17 - 1
        std::vector<float> delayBufL;                      // kDelaySize cells
        std::vector<float> delayBufR;
        int writePos = 0;

        // Reverb tank (simple plate). Same requirement: 16384 was 2^14, a power
        // of two used as the SIZE where the mask belongs, so
        // `(reverbWPos + 1) & reverbMask` alternated between 0 and 16384
        // instead of walking the buffer, and the reads were stuck on index 0.
        // 2^15 also has to cover the tank's longest tap, which is 0.11s on the
        // right channel, so the `&` cannot run off the end: 32768 works up to
        // ~298kHz, and at 44.1kHz it does not move a single tank delay.
        static constexpr int kReverbSize = 32768;           // 2^15
        static constexpr int kReverbMask = kReverbSize - 1; // 2^15 - 1
        std::vector<float> reverbBufL;                      // kReverbSize cells
        std::vector<float> reverbBufR;
        int reverbWPos = 0;
        float reverbLP = 0.0f;

        // A mask that is not 2^n - 1 does not wrap, it truncates. This is the
        // whole bug, so it is worth a compile error rather than a comment.
        static_assert((kDelaySize & (kDelaySize - 1)) == 0,
                      "kDelaySize must be a power of two or the & mask does not wrap");
        static_assert((kReverbSize & (kReverbSize - 1)) == 0,
                      "kReverbSize must be a power of two or the & mask does not wrap");

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
