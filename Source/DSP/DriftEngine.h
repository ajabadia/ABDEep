#pragma once

#include <cstdlib>
#include <cmath>
#include <algorithm>

namespace ABD
{
    /**
     * DriftEngine genera fluctuaciones lentas y aleatorias (Brownian noise)
     * para simular la inestabilidad de componentes analógicos (VCO, VCF, envolventes).
     *
     * Cada oscilador de drift es un random-walk suavizado:
     *   - A intervalos regulares (controlados por driftRate) se elige un nuevo target aleatorio
     *   - El valor actual glidea suavemente hacia el target
     *   - La amplitud del drift se escala por voiceDrift o paramDrift
     */
    class DriftEngine
    {
    public:
        DriftEngine();
        ~DriftEngine() = default;

        void setSampleRate(double sampleRate);

        /** Configura los parámetros de drift (llamar desde updateParameters) */
        void setDriftParams(float voiceDriftNorm, float paramDriftNorm, float driftRateNorm);

        /** Prepara el motor para una nueva nota.
         *  Solo re-randomiza el timing offset; NO toca targets ni currentValue
         *  (el drift es un proceso Browniano continuo en background). */
        void resetForNote(float voiceIndex);

        /**
         * Avanza los osciladores de drift una muestra.
         * Debe llamarse una vez por muestra en processSample.
         */
        void nextSample();

        // --- Salidas de drift ---
        /** Drift de afinación para OSC1 en semitonos (± rango según voiceDrift) */
        float getOsc1PitchDrift() const { return osc1PitchDrift; }
        /** Drift de afinación para OSC2 en semitonos (independiente de OSC1) */
        float getOsc2PitchDrift() const { return osc2PitchDrift; }
        /** Drift para VCF Cutoff (normalizado, se suma al cutoff) */
        float getVcfCutoffDrift() const { return vcfCutoffDrift; }
        /** Drift para VCF Resonance (normalizado, se suma a la resonancia) */
        float getVcfResonanceDrift() const { return vcfResonanceDrift; }
        /** Drift para tiempos de envolvente (normalizado, escala attack/decay/release) */
        float getEnvTimeDrift() const { return envTimeDrift; }

    private:
        double sampleRate = 44100.0;

        // --- Parámetros (normalizados 0-1 desde la UI) ---
        float voiceDriftAmount = 0.0f;   // escala para pitch drift (cents)
        float paramDriftAmount = 0.0f;   // escala para VCF/Env drift
        float driftRate = 0.0f;           // velocidad de cambio (0=lentísimo, 1=rápido)

        // --- Estado de cada oscilador de drift ---
        struct DriftOsc
        {
            double samplesUntilNextTarget = 0.0;
            double targetIntervalSamples = 44100.0; // samples entre cambios de target
            float currentValue = 0.0f;
            float targetValue = 0.0f;
            float slewFactor = 0.001f; // qué tan rápido glidea (mayor = más rápido)

            void pickNewTarget(float amplitudeScale)
            {
                // Valor aleatorio en [-amplitudeScale, +amplitudeScale]
                targetValue = (-1.0f + 2.0f * ((float)std::rand() / (float)RAND_MAX)) * amplitudeScale;
            }
        };

        DriftOsc osc1Pitch;    // Drift de afinación OSC1
        DriftOsc osc2Pitch;    // Drift de afinación OSC2
        DriftOsc vcfCutoff;    // Drift de cutoff del filtro
        DriftOsc vcfResonance; // Drift de resonancia del filtro
        DriftOsc envTime;      // Drift de tiempos de envolvente

        // Valores de salida actuales
        float osc1PitchDrift = 0.0f;
        float osc2PitchDrift = 0.0f;
        float vcfCutoffDrift = 0.0f;
        float vcfResonanceDrift = 0.0f;
        float envTimeDrift = 0.0f;

        /** Actualiza un oscilador: avanza el random walk una muestra */
        void updateOscillator(DriftOsc& osc, float amplitudeScale, float& output);

        /** Calcula el intervalo en samples entre cambios de target según driftRate */
        double computeTargetInterval() const;
    };
}
