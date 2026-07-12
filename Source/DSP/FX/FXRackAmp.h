#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXRackAmp: Simulador de amplificador de guitarra (Rack Amp).
     *
     * Basado en el hardware DeepMind 12 (type=7).
     * Modelo simplificado con preamplificador, distorsión waveshaping,
     * ecualizador de 2 bandas y simulación de cabinet.
     *
     * Parámetros:
     *   0: PreAmp  (0-1, ganancia de preamplificador)
     *   1: Buzz    (0-1, realce agudos pre-distorsión)
     *   2: Punch   (0-1, realce medios-bajos pre-distorsión)
     *   3: Crunch  (0-1, cantidad de distorsión asimétrica)
     *   4: Drive   (0-1, cantidad de distorsión general)
     *   5: Level   (0-1, volumen de salida)
     *   6: Low     (0-1, ecualizador de graves)
     *   7: High    (0-1, ecualizador de agudos)
     *   8: Cabinet (0=OFF, 1=ON, simulación de altavoz)
     */
    class FXRackAmp : public FXBase
    {
    public:
        FXRackAmp();
        ~FXRackAmp() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 9; }
        juce::String getEffectName() const override { return "Rack Amp"; }

    private:
        double sampleRate = 44100.0;

        // Parámetros (0-1 normalizados)
        float preAmp  = 0.3f;
        float buzz    = 0.3f;
        float punch   = 0.3f;
        float crunch  = 0.2f;
        float drive   = 0.3f;
        float level   = 0.5f;
        float lowEQ   = 0.5f;
        float highEQ  = 0.5f;
        float cabinet = 1.0f; // ON por defecto

    // Filtros de ecualizador shelving con boost/cut
    float lowStateL = 0.0f, lowStateR = 0.0f;
    float lowCoeff  = 0.0f;
    float lowBoost  = 0.0f;  // ganancia shelving low
    float highStateL = 0.0f, highStateR = 0.0f;
    float highCoeff  = 0.0f;
    float highBoost  = 0.0f; // ganancia shelving high

        // Filtro de cabinet (LPF ~3-5kHz con resonancia suave)
        float cabState1L = 0.0f, cabState1R = 0.0f;
        float cabState2L = 0.0f, cabState2R = 0.0f;
        float cabCoeff   = 0.0f;
        float cabRes     = 0.0f;

        void updateEQCoeffs();
        void updateCabinetCoeffs();

        /** Waveshaping no-lineal para distorsión */
        float applyDistortion(float sample, float driveAmt, float crunchAmt);
    };
}
