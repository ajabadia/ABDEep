#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXEdison: Procesador estéreo / imagen / distorsión (Edison EX1).
     *
     * Basado en el hardware DeepMind 12 (type=19).
     * Opera en modo Estéreo o Mid/Side. Permite controlar el ancho
     * estéreo, la distribución LMF (Low-Mid Frequency), balance,
     * distorsión de centro (M), y ganancia.
     *
     * Parámetros:
     *   0: On        (0=OFF, 1=ON)
     *   1: InMode    (0=ST, 1=M/S)
     *   2: OutMode   (0=ST, 1=M/S)
     *   3: StSpread  (0-1, -50 a +50, ancho estéreo)
     *   4: LMFSpread (0-1, -50 a +50, spread low-mid)
     *   5: Balance   (0-1, -50 a +50, balance L/R)
     *   6: CntrDist  (0-1, -50 a +50, distorsión central)
     *   7: Gain      (0-1, -12dB a +12dB)
     */
    class FXEdison : public FXBase
    {
    public:
        FXEdison();
        ~FXEdison() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 8; }
        juce::String getEffectName() const override { return "Edison EX1"; }

    private:
        double sampleRate = 44100.0;

        // Parámetros
        bool    on        = true;
        int     inMode    = 0;   // 0=ST, 1=M/S
        int     outMode   = 0;   // 0=ST, 1=M/S
        float   stSpread  = 0.5f; // 0-1 → -50..+50
        float   lmfSpread = 0.5f; // 0-1 → -50..+50
        float   balance   = 0.5f; // 0-1 → -50..+50
        float   cntrDist  = 0.0f; // 0-1 → -50..+50
        float   gain      = 0.5f; // 0-1 → -12..+12 dB

    // Filtro crossover para LMF (Low-Mid Frequency split) en Side
    float lmfSideL = 0.0f; // low-pass state for Side left
    float lmfSideR = 0.0f; // low-pass state for Side right
    float lmfCoeff = 0.0f;

        void updateLMF();
    };
}
