#include "DriftEngine.h"
#include <algorithm>
#include <cmath>

namespace ABD
{
    DriftEngine::DriftEngine()
    {
        // Initialize to silent state — no random offsets.
        // setDriftParams() kicks the oscillators into motion when
        // the user actually turns up drift amount.
        for (auto* osc : { &osc1Pitch, &osc2Pitch, &vcfCutoff, &vcfResonance, &envTime })
        {
            osc->targetValue  = 0.0f;
            osc->currentValue = 0.0f;
            osc->samplesUntilNextTarget = 0.0;
        }
    }

    void DriftEngine::setSampleRate(double newSampleRate)
    {
        sampleRate = std::max(1.0, newSampleRate);

        // Recalculate target intervals for all oscillators at the new sample rate
        double interval = computeTargetInterval();
        for (auto* osc : { &osc1Pitch, &osc2Pitch, &vcfCutoff, &vcfResonance, &envTime })
        {
            osc->targetIntervalSamples = interval;
        }
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

    void DriftEngine::resetForNote(float /*voiceIndex*/)
    {
        // Drift is a continuous background process — reset state on Note-On to start
        // clean, which also ensures correct parameter scaling.
        for (auto* osc : { &osc1Pitch, &osc2Pitch, &vcfCutoff, &vcfResonance, &envTime })
        {
            osc->currentValue = 0.0f;
            osc->targetValue = 0.0f;
            osc->samplesUntilNextTarget = osc->targetIntervalSamples
                * (0.5 + 0.5 * ((float)std::rand() / (float)RAND_MAX));
        }
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
        // When amplitudeScale is zero, no drift is requested — hold at zero
        // deterministically.  This makes drift=0 useful for calibration.
        if (amplitudeScale <= 0.0f)
        {
            osc.currentValue = 0.0f;
            osc.targetValue  = 0.0f;
            output = 0.0f;
            return;
        }

        // 1. Decrementar contador de samples hasta el próximo target
        osc.samplesUntilNextTarget -= 1.0;

        if (osc.samplesUntilNextTarget <= 0.0)
        {
            // Elegir nuevo target aleatorio
            osc.pickNewTarget(amplitudeScale);
            // El slew factor determina cuán rápido llegar al target
            // Más driftRate → slew más rápido (cambios más abruptos)
            double slewBase = (0.0001 + driftRate * 0.01) * (44100.0 / sampleRate);
            // Variar el slew aleatoriamente en cada nuevo target
            osc.slewFactor = (float)(slewBase * (0.5 + (double)std::rand() / (double)RAND_MAX));
            // Programar el próximo cambio de target con un poco de jitter
            double jitter = 0.8 + 0.4 * ((float)std::rand() / (float)RAND_MAX);
            osc.samplesUntilNextTarget = osc.targetIntervalSamples * jitter;
        }

        // 2. Glide suave hacia el target (filtro de 1-polo)
        float diff = osc.targetValue - osc.currentValue;
        osc.currentValue += diff * osc.slewFactor;

        // 3. currentValue already scaled by amplitudeScale in pickNewTarget
        //    (removed double-scaling that produced amplitudeScale² output)

        // 4. Saturación suave para evitar valores extremos
        output = std::tanh(osc.currentValue * 2.0f) / 2.0f;
    }
}
