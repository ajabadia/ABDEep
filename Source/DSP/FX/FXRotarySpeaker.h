#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXRotarySpeaker: Efecto de altavoz rotatorio (Leslie).
     *
     * Basado en el hardware DeepMind 12 (type=16).
     * Simula un Leslie con dos rotores:
     *   - Horn (agudo): rotación más rápida, modulación de fase
     *   - Rotor (grave): rotación más lenta, tremolo + modulación
     *
     * Parámetros:
     *   0: LoSpeed  (0-1, 0.1Hz - 4.0Hz, velocidad lenta)
     *   1: HiSpeed  (0-1, 2.0Hz - 9.9Hz, velocidad rápida)
     *   2: Accel    (0-1, 0-100%, tasa de aceleración entre slow↔fast)
     *   3: Distance (0-1, 0-100%, distancia micrófono-virtual)
     *   4: Balance  (0-1, -100% a +100%, balance horn/rotor)
     *   5: Speed    (0=SLOW, 1=FAST)
     *   6: Motor    (0=RUN, 1=STOP)
     */
    class FXRotarySpeaker : public FXBase
    {
    public:
        FXRotarySpeaker();
        ~FXRotarySpeaker() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 7; }
        juce::String getEffectName() const override { return "Rotary Speaker"; }

    private:
        double sampleRate = 44100.0;

        // Parámetros
        float loSpeed  = 0.3f;   // 0.1-4.0 Hz
        float hiSpeed  = 0.6f;   // 2.0-9.9 Hz
        float accel    = 0.5f;   // 0-100%
        float distance = 0.5f;   // 0-100%
        float balance  = 0.5f;   // 0-1 → -100% a +100%
        float targetSpeed = 0.0f; // 0=SLOW, 1=FAST (normalized toggle)

        // State
        double hornPhase  = 0.0;  // fase del rotor agudo (rápido)
        double rotorPhase = 0.0;  // fase del rotor grave (lento)
        double hornSpeed  = 0.0;  // Hz actual del horn (con aceleración)
        double rotorSpeed = 0.0;  // Hz actual del rotor (con aceleración)
        bool motorRunning = true;

        // LFO filtros para suavizado de velocidad
        double hornTarget  = 0.0;
        double rotorTarget = 0.0;
        double accelRate   = 0.0; // factor de suavizado

        // Allpass filter states para Doppler sim
        float hornDelayL = 0.0f;
        float hornDelayR = 0.0f;
        float rotorDelayL = 0.0f;
        float rotorDelayR = 0.0f;

        // Filtro crossover simple (separa horn/rotor)
        float xoverStateL = 0.0f;
        float xoverStateR = 0.0f;
        float xoverCoeff  = 0.0f; // ~800Hz crossover

        void updateTargets();
        void updateAccelRate();
        float getDistanceAtten(float distanceNorm, double phase);
    };
}
