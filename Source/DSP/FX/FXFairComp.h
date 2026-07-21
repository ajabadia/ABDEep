#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXFairComp: Emulación del Fairchild 670 Stereo Compressor (type=31).
     *
     * Soporta:
     *   - Modos Estéreo, Dual y Mid/Side.
     *   - 6 Constantes de tiempo oficiales de ataque/relajación.
     *   - Ratio y codo dependientes de DC Bias.
     *   - Controles independientes para Left/Mid y Right/Side.
     */
    class FXFairComp : public FXBase
    {
    public:
        FXFairComp();
        ~FXFairComp() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR, int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 12; }
        juce::String getEffectName() const override { return "FairComp"; }

    private:
        double sampleRate = 44100.0;

        // Estructura para el detector del canal de compresión
        struct CompChannel
        {
            float inputGainNorm = 1.0f;
            float thresholdNorm = 0.5f;
            float timeConstantNorm = 0.0f; // 1 a 6
            float dcBiasNorm = 0.5f;
            float outputGainNorm = 0.75f;

            // Constantes dinámicas calculadas
            float attackTimeSec = 0.0002f; // Ataque ultra-rápido Fairchild
            float releaseTimeSec = 0.3f;
            float ratio = 4.0f;
            float kneeDb = 10.0f;

            // Estado del detector de envolvente
            float envelope = 0.0f;

            void update(double sr);
            float processSample(float inputSample, double sr);
        };

        CompChannel chanLM; // Left / Mid
        CompChannel chanRS; // Right / Side

        int mode = 1; // 0=OFF, 1=Stereo, 2=Dual, 3=M/S
        float biasBal = 0.5f;
    };
}
