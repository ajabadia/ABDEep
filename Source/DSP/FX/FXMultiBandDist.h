#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXMultiBandDist: Distorsión multibanda con 3 bandas (Low/Mid/High).
     *
     * Basado en el hardware DeepMind 12 (type=32).
     * Divide la señal en 3 bandas mediante cruces, aplica distorsión
     * independiente a cada banda, y recombina.
     *
     * Parámetros:
     *   0: InGain      (0-1, -24dB a +24dB)
     *   1: DistType    (0-1, valve/saturate/tube + post-filter variants)
     *   2: LowLevel    (0-1, -12dB a +12dB)
     *   3: LowDrive    (0-1, 0-100%)
     *   4: XoverLowMid (0-1, 30Hz - 9000Hz)
     *   5: MidLevel    (0-1, -12dB a +12dB)
     *   6: MidDrive    (0-1, 0-100%)
     *   7: XoverMidHi  (0-1, 30Hz - 9000Hz)
     *   8: HiLevel     (0-1, -12dB a +12dB)
     *   9: HiDrive     (0-1, 0-100%)
     *   10: Cabinet    (0-1, 0=OFF, 1-11 tipos de cabinet)
     *   11: OutGain    (0-1, -12dB a +12dB)
     */
    class FXMultiBandDist : public FXBase
    {
    public:
        FXMultiBandDist();
        ~FXMultiBandDist() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 12; }
        juce::String getEffectName() const override { return "Multi-Band Dist"; }

    private:
        double sampleRate = 44100.0;

        // Parámetros
        float inGain      = 0.5f; // 0-1 → -24..+24 dB
        int   distType    = 0;    // 0-valve, 1-saturate, 2-tube, 3-5 post-filter
        float lowLevel    = 0.5f;
        float lowDrive    = 0.3f;
        float xoverLowMid = 0.3f; // 30-9000Hz
        float midLevel    = 0.5f;
        float midDrive    = 0.3f;
        float xoverMidHi  = 0.7f; // 30-9000Hz
        float hiLevel     = 0.5f;
        float hiDrive     = 0.3f;
        int   cabinetType = 0;    // 0=OFF, 1-11
        float outGain     = 0.5f;

        // Crossover filters (Linkwitz-Riley 2-polos por banda)
        float xv1LowL = 0.0f, xv1LowR = 0.0f;  // lowpass state
        float xv1HighL = 0.0f, xv1HighR = 0.0f; // highpass state (complementario)
        float xv2LowL = 0.0f, xv2LowR = 0.0f;  // lowpass state
        float xv2HighL = 0.0f, xv2HighR = 0.0f; // highpass state

        float xv1Coeff = 0.0f; // crossover 1
        float xv2Coeff = 0.0f; // crossover 2

        // Cabinet filter (para simulación de altavoz)
        float cabL = 0.0f, cabR = 0.0f;
        float cabCoeff = 0.0f;

        // Post-filter para dist types 3-5 (SR-dependiente)
        float postCoeff = 0.0f;
        float postL = 0.0f, postR = 0.0f;

        void updateCrossoverCoeffs();

        /** Aplica distorsión según tipo seleccionado */
        float applyDistType(float sample, int type, float drive);
    };
}
