#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXPatternFreeze: Buffer capture and freeze effect.
     *
     * Captures audio into a circular buffer and can freeze/loop
     * segments with crossfading to create ambient textures.
     *
     * Parameters:
     *   0: Mix        (0-1, dry/wet mix)
     *   1: Length     (0-1, freeze buffer length 200ms-4000ms)
     *   2: Feedback   (0-1, how much new audio feeds into buffer)
     *   3: Regenerate (0-1, crossfade rate for regeneration)
     */
    class FXPatternFreeze : public FXBase
    {
    public:
        FXPatternFreeze();
        ~FXPatternFreeze() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 4; }
        juce::String getEffectName() const override { return "Pattern Freeze"; }

    private:
        double sampleRate = 44100.0;

        float paramMix = 0.4f;
        float paramLength = 0.3f;
        float paramFeedback = 0.6f;
        float paramRegenerate = 0.5f;

        static constexpr int kMaxBuffer = 176400;
        std::vector<float> freezeBufL;
        std::vector<float> freezeBufR;
        int bufferMask = 0;
        int writePos = 0;
        int readPos = 0;

        // Crossfade state
        float xfadeL = 0.0f;
        float xfadeR = 0.0f;
        int xfadeCount = 0;
        int xfadeLength = 0;

        uint32_t noiseSeed = 0x13572468u;

        float noiseGenerate();
    };
}
