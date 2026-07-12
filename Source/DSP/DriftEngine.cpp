#include "DriftEngine.h"
#include <algorithm>
#include <cmath>

namespace ABD
{
    DriftEngine::DriftEngine()
    {
        // Inicializar cada oscilador con valores aleatorios iniciales
        for (auto* osc : { &osc1Pitch, &osc2Pitch, &vcfCutoff, &vcfResonance, &envTime })
        {
            osc->targetValue = (-1.0f + 2.0f * ((float)std::rand() / (float)RAND_MAX)) * 0.1f;
            osc->currentValue = osc->targetValue;
            osc->samplesUntilNextTarget = 0.0; // forzar primer target de inmediato
        }
    }

    void DriftEngine::setSampleRate(double newSampleRate)
    {
        sampleRate = std::max(1.0, newSampleRate);
    }

    void DriftEngine::setDriftParams(float voiceDriftNorm, float paramDriftNorm, float driftRateNorm)
    {
        // voiceDrift: 0-1 → 0 a 50 cents de desviación máxima
        voiceDriftAmount = std::clamp(voiceDriftNorm, 0.0f, 1.0f);
        // paramDrift: 0-1 → 0 a 0.2 de modulación normalizada
        paramDriftAmount = std::clamp(paramDriftNorm, 0.0f, 1.0f);
        // driftRate: 0-1 → 0.01Hz a 10Hz (período de 100s a 0.1s)
        driftRate = std::clamp(driftRateNorm, 0.0f, 1.0f);

        // Recalcular intervalos de target para todos los osciladores
        double interval = computeTargetInterval();
        for (auto* osc : { &osc1Pitch, &osc2Pitch, &vcfCutoff, &vcfResonance, &envTime })
        {
            osc->targetIntervalSamples = interval;
        }
    }

    double DriftEngine::computeTargetInterval() const
    {
        // driftRate mapea:
        //   0.0 → período muy largo (~10 segundos = slow drift)
        //   0.5 → período medio (~1 segundo)
        //   1.0 → período rápido (~0.1 segundos = micro-shimmer)
        double minInterval = sampleRate * 0.05;   // 50ms (rápido)
        double maxInterval = sampleRate * 10.0;   // 10s (lento)
        // Mapeo exponencial para mejor respuesta perceptual
        double t = (double)driftRate;
        double interval = maxInterval * std::pow(minInterval / maxInterval, t);
        return std::max(minInterval, interval);
    }

    void DriftEngine::resetForNote(float voiceIndex)
    {
        // Al iniciar una nota, generar nuevos targets aleatorios para cada oscilador,
        // escalados por los montos de drift y con una pequeña variación por voiceIndex
        // para que cada voz tenga un carácter de drift único.

        float voiceOffset = voiceIndex * 0.1f; // pequeña variación por voz

        auto resetOsc = [&](DriftOsc& osc, float baseScale)
        {
            float scale = baseScale * (0.8f + voiceOffset);
            osc.pickNewTarget(scale);
            osc.currentValue = osc.targetValue * 0.5f; // comenzar desde la mitad del target
            osc.samplesUntilNextTarget = osc.targetIntervalSamples * (0.5f + 0.5f * ((float)std::rand() / (float)RAND_MAX));
        };

        resetOsc(osc1Pitch, voiceDriftAmount);
        resetOsc(osc2Pitch, voiceDriftAmount);
        resetOsc(vcfCutoff, paramDriftAmount);
        resetOsc(vcfResonance, paramDriftAmount);
        resetOsc(envTime, paramDriftAmount);

        // Sincronizar salidas inmediatamente
        osc1PitchDrift = osc1Pitch.currentValue;
        osc2PitchDrift = osc2Pitch.currentValue;
        vcfCutoffDrift = vcfCutoff.currentValue;
        vcfResonanceDrift = vcfResonance.currentValue;
        envTimeDrift = envTime.currentValue;
    }

    void DriftEngine::nextSample()
    {
        // Cada oscilador de drift se actualiza una muestra
        updateOscillator(osc1Pitch, voiceDriftAmount, osc1PitchDrift);
        updateOscillator(osc2Pitch, voiceDriftAmount, osc2PitchDrift);
        updateOscillator(vcfCutoff, paramDriftAmount, vcfCutoffDrift);
        updateOscillator(vcfResonance, paramDriftAmount, vcfResonanceDrift);
        updateOscillator(envTime, paramDriftAmount, envTimeDrift);
    }

    void DriftEngine::updateOscillator(DriftOsc& osc, float amplitudeScale, float& output)
    {
        // 1. Decrementar contador de samples hasta el próximo target
        osc.samplesUntilNextTarget -= 1.0;

        if (osc.samplesUntilNextTarget <= 0.0)
        {
            // Elegir nuevo target aleatorio
            osc.pickNewTarget(amplitudeScale);
            // El slew factor determina cuán rápido llegar al target
            // Más driftRate → slew más rápido (cambios más abruptos)
            double slewBase = 0.0001 + driftRate * 0.01;
            // Variar el slew aleatoriamente en cada nuevo target
            osc.slewFactor = (float)(slewBase * (0.5 + (double)std::rand() / (double)RAND_MAX));
            // Programar el próximo cambio de target con un poco de jitter
            double jitter = 0.8 + 0.4 * ((float)std::rand() / (float)RAND_MAX);
            osc.samplesUntilNextTarget = osc.targetIntervalSamples * jitter;
        }

        // 2. Glide suave hacia el target (filtro de 1-polo)
        float diff = osc.targetValue - osc.currentValue;
        osc.currentValue += diff * osc.slewFactor;

        // 3. Escalar por amplitudeScale (si amplitudeScale es 0, no hay drift)
        float scaledOutput = osc.currentValue * amplitudeScale;

        // 4. Saturación suave para evitar valores extremos
        output = std::tanh(scaledOutput * 2.0f) / 2.0f;
    }
}
