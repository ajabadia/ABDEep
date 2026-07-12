#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXPhaser: Efecto Phaser con cascada de allpass filters modulados por LFO.
     *
     * Basado en el hardware DeepMind 12 (type=9).
     * Usa una cascada de N filtros allpass de primer orden con LFO
     * modulando la frecuencia de corte para crear el característico
     * barrido espectral con nulos.
     *
     * Parámetros:
     *   0: Rate    (0-1, 0.05Hz - 5.0Hz)
     *   1: Depth   (0-1, 0-100%)
     *   2: Reso    (0-1, 0-100%, feedback de la cascada)
     *   3: Base    (0-1, 20Hz - 15000Hz, frecuencia central)
     *   4: Stages  (0-1, mapeado a 2,4,6,8,10,12 etapas)
     *   5: Wave    (0-1, -50 a +50, simetría del LFO)
     *   6: Phase   (0-1, 0-180°, offset estéreo del LFO)
     */
    class FXPhaser : public FXBase
    {
    public:
        FXPhaser();
        ~FXPhaser() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 7; }
        juce::String getEffectName() const override { return "Phaser"; }

    private:
        static constexpr int kMaxStages = 12;
        double sampleRate = 44100.0;

        // Parámetros
        float rate   = 0.2f;  // 0.05-5 Hz
        float depth  = 0.5f;  // 0-100%
        float reso   = 0.3f;  // 0-100%
        float base   = 0.3f;  // 20-15000 Hz
        int   stages = 6;     // número activo de etapas allpass
        float wave   = 0.0f;  // -50 a +50 simetría
        float phase  = 0.0f;  // 0-180° offset estéreo

        // LFO state
        double lfoPhaseL = 0.0;
        double lfoPhaseR = 0.0;
        double lfoInc = 0.0;

        // Allpass filter states (L y R)
        // Cada etapa allpass: y[n] = -a * x[n] + x[n-1] + a * y[n-1]
        float stateL[kMaxStages] = {};
        float stateR[kMaxStages] = {};
        float delayL[kMaxStages] = {};
        float delayR[kMaxStages] = {};

        // Feedback acumulado (Resonancia)
        float fbStateL = 0.0f;
        float fbStateR = 0.0f;

        // Rango de frecuencia de corte (base + depth)
        float baseHz = 200.0f;
        float modRange = 5000.0f;

        void updateLFOIncrement();
        void updateFreqRange();
        float calcAllpassCoeff(float cutoffHz);
        float getLFOWave(double phase);
    };
}
