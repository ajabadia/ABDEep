#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXChorusD: Emulación del Roland Dimension D Spatial Chorus (type=17).
     *
     * Parámetros:
     *   0: on (0=Bypass, 1=ON)
     *   1: mode (0=Stereo, 1=Mono)
     *   2: mix (0-1, Dry/Wet mix)
     *   3: sw1 (0-1, Preset 1)
     *   4: sw2 (0-1, Preset 2)
     *   5: sw3 (0-1, Preset 3)
     *   6: sw4 (0-1, Preset 4)
     */
    class FXChorusD : public FXBase
    {
    public:
        FXChorusD();
        ~FXChorusD() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR, int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 7; }
        juce::String getEffectName() const override { return "Chorus-D"; }

    private:
        double sampleRate = 44100.0;
        bool on = true;
        bool monoMode = false;
        float mix = 0.5f;
        
        bool sw[4] = { true, false, false, false }; // Presets 1-4, por defecto el 1 está activo

        // LFOs duales independientes
        double lfoPhaseL1 = 0.0, lfoPhaseR1 = 0.0;
        double lfoPhaseL2 = 0.0, lfoPhaseR2 = 0.0;
        double lfoInc1 = 0.0, lfoInc2 = 0.0;

        // Buffers de delay
        juce::AudioSampleBuffer delayBufferL;
        juce::AudioSampleBuffer delayBufferR;
        int writePos = 0;
        int maxDelaySamples = 0;

        void updateLFOs();
    };
}
