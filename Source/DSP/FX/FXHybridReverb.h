#pragma once

#include "FXBase.h"
#include "FXSimpleReverb.h"
#include "FXFlanger.h"
#include "FXChorus.h"
#include "FXDelay.h"

namespace ABD
{
    /**
     * FXHybridReverb: Combinación de Reverb y Modulación/Delay.
     * Soporta:
     *   flangVerb (23)
     *   chorusVerb (24)
     *   delayVerb (25)
     */
    class FXHybridReverb : public FXBase
    {
    public:
        FXHybridReverb(int type);
        ~FXHybridReverb() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR, int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 12; }
        juce::String getEffectName() const override;

    private:
        int type;
        float mix = 0.5f;

        std::unique_ptr<FXSimpleReverb> reverb;
        std::unique_ptr<FXFlanger> flanger;
        std::unique_ptr<FXChorus> chorus;
        std::unique_ptr<FXDelay> delay;

        juce::AudioBuffer<float> tempBuffer;
    };
}
