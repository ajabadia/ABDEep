#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXSimpleReverb: Reverberador Schroeder-Moorer (4 comb + 3 all-pass).
     * 
     * Sirve para múltiples tipos de reverb del DeepMind 12:
     *   Hall (1), Plate (2), Rich Plate (3), Ambience (4),
     *   Gated (5), Reverse (6), Chamber (26), Room (27), Vintage (28)
     * 
     * Parámetros:
     *   0: Decay (0-1, tiempo de reverb)
     *   1: Pre-delay (0-1, 0-200ms)
     *   2: Damping (0-1, absorción HF)
     *   3: Diffusion (0-1, densidad all-pass)
     *   4: Room Size (0-1, escala longitudes de comb)
     */
    class FXSimpleReverb : public FXBase
    {
    public:
        FXSimpleReverb(int reverbType = 1); // 1=Hall, 2=Plate, etc.
        ~FXSimpleReverb() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 5; }
        juce::String getEffectName() const override;

    private:
        int reverbType;
        double sampleRate = 44100.0;

        // Parámetros
        float decay = 0.5f;
        float preDelayTime = 0.0f;
        float damping = 0.5f;
        float diffusion = 0.5f;
        float roomSize = 0.5f;

        // Pre-delay buffer
        juce::AudioSampleBuffer preDelayBuffer;
        int preDelaySamples = 0;
        int preDelayWritePos = 0;

        // Comb filters: 4 por canal
        struct CombFilter {
            float* buffer = nullptr;
            int bufferSize = 0;
            int writePos = 0;
            float feedback = 0.5f;
            float damp1 = 0.5f;
            float damp2 = 0.5f;
            float filterState = 0.0f;
        };

        CombFilter combL[4], combR[4];

        // All-pass filters: 3 por canal
        struct AllPassFilter {
            float* buffer = nullptr;
            int bufferSize = 0;
            int writePos = 0;
            float gain = 0.5f;
        };

        AllPassFilter allpassL[3], allpassR[3];

        // Almacenamiento de buffers
        juce::AudioBuffer<float> combBufferL;
        juce::AudioBuffer<float> combBufferR;
        juce::AudioBuffer<float> allpassBufferL;
        juce::AudioBuffer<float> allpassBufferR;

        void updateFilters();
        void updateCombParams();
        void setDefaultsForType(int type);
        float processComb(CombFilter& comb, float input);
        float processAllPass(AllPassFilter& ap, float input);
    };
}
