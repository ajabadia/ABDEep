#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXAutoPan: Efecto Auto Pan / Tremolo con LFO y envelope follower.
     *
     * Basado en el hardware DeepMind 12 (type=18).
     * Modula la posición panorámica (Auto Pan) o el volumen (Tremolo)
     * usando un LFO con control de forma de onda y offset estéreo.
     *
     * Parámetros:
     *   0: Speed    (0-1, 0.05-5.0 Hz, o tempo-synced)
     *   1: Phase    (0-1, 0-180°, offset estéreo del LFO)
     *   2: Wave     (0-1, triangular → cuadrado, simetría -50..+50)
     *   3: Depth    (0-1, 0-100%, profundidad de modulación)
     *   4: EnvSpd   (0-1, envelope modula la velocidad)
     *   5: EnvDepth (0-1, envelope modula la profundidad)
     */
    class FXAutoPan : public FXBase
    {
    public:
        FXAutoPan();
        ~FXAutoPan() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 6; }
        juce::String getEffectName() const override { return "Auto Pan"; }

    private:
        double sampleRate = 44100.0;

        // Parámetros
        float speed    = 0.3f;  // 0.05-5.0 Hz
        float phase    = 0.0f;  // 0-180° offset estéreo (0-0.5 en ciclo)
        float wave     = 0.5f;  // triangular (0) → cuadrado (1), con simetría
        float depth    = 0.5f;  // 0-100%
        float envSpd   = 0.0f;  // 0-100%, envelope → speed
        float envDepth = 0.0f;  // 0-100%, envelope → depth

        // LFO state
        double lfoPhaseL = 0.0;
        double lfoPhaseR = 0.0;
        double lfoInc = 0.0;

        // Envelope follower state (detector de envolvente simple)
        float envStateL = 0.0f;
        float envStateR = 0.0f;
        float envAttack  = 0.01f; // factor de suavizado
        float envRelease = 0.001f;

        void updateLFOIncrement();
        float getLFOWave(double phase, float waveParam);
    };
}
