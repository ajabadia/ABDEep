#include "FXPhaser.h"
#include <cmath>
#include <algorithm>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

namespace ABD
{
    FXPhaser::FXPhaser()
    {
        reset();
    }

    void FXPhaser::prepare(double newSampleRate, int samplesPerBlock)
    {
        sampleRate = std::max(1.0, newSampleRate);
        updateLFOIncrement();
        updateFreqRange();
    }

    void FXPhaser::setParameter(int index, float value)
    {
        value = std::clamp(value, 0.0f, 1.0f);

        switch (index)
        {
            case 0: rate = value;   updateLFOIncrement(); break;
            case 1: depth = value;  updateFreqRange(); break;
            case 2: reso = value;   break; // feedback, no necesita recalcular
            case 3: base = value;   updateFreqRange(); break;
            case 4: {
                // 0-1 → 2,4,6,8,10,12 stages
                static const int stageMap[] = { 2, 4, 6, 8, 10, 12 };
                int idx = std::clamp((int)(value * 5.99f), 0, 5);
                stages = stageMap[idx];
                break;
            }
            case 5: wave = value;   break;
            case 6: phase = value;  break;
        }
    }

    void FXPhaser::reset()
    {
        std::fill(std::begin(stateL), std::end(stateL), 0.0f);
        std::fill(std::begin(stateR), std::end(stateR), 0.0f);
        std::fill(std::begin(delayL), std::end(delayL), 0.0f);
        std::fill(std::begin(delayR), std::end(delayR), 0.0f);
        fbStateL = 0.0f;
        fbStateR = 0.0f;
        lfoPhaseL = 0.0;
        lfoPhaseR = 0.0;
    }

    void FXPhaser::updateLFOIncrement()
    {
        // Rate: 0-1 → 0.05Hz - 5.0Hz
        float freqHz = 0.05f + 4.95f * rate;
        lfoInc = freqHz / sampleRate;
    }

    void FXPhaser::updateFreqRange()
    {
        // Base: 0-1 → 20Hz - 15000Hz (mapeo exponencial)
        baseHz = 20.0f * std::pow(750.0f, base); // 20 * 750^base, 750≈15000/20
        // Depth: 0-1 → rango de modulación 0Hz - 6000Hz
        modRange = 6000.0f * depth;
    }

    float FXPhaser::calcAllpassCoeff(float cutoffHz)
    {
        // Allpass de primer orden: H(z) = (a + z^-1) / (1 + a*z^-1)
        // a = (1 - tan(π*fc/fs)) / (1 + tan(π*fc/fs))
        // Donde fc es la frecuencia de corte deseada
        if (cutoffHz <= 0.0f) return 0.0f;
        float wd = std::tan((float)(M_PI * cutoffHz / sampleRate));
        wd = std::clamp(wd, 0.001f, 100.0f);
        return (1.0f - wd) / (1.0f + wd);
    }

    float FXPhaser::getLFOWave(double phase)
    {
        // LFO base: sinusoidal
        float lfo = (float)std::sin(2.0 * M_PI * phase);

        // Wave (simetría): -50 a +50
        // wave=0.5 → sin simétrica. wave<0.5 → saw-up, wave>0.5 → saw-down
        float w = (wave - 0.5f) * 2.0f; // -1 a 1
        if (std::abs(w) > 0.01f)
        {
            // Distorsión de simetría: skew la fase
            double skewed = phase + (double)w * 0.3 * std::sin(2.0 * M_PI * phase);
            if (skewed > 1.0) skewed -= 1.0;
            if (skewed < 0.0) skewed += 1.0;
            lfo = (float)std::sin(2.0 * M_PI * skewed);
        }

        return lfo;
    }

    void FXPhaser::process(const float* inL, const float* inR,
                            float* outL, float* outR,
                            int numSamples)
    {
        float feedback = reso * 0.7f; // 0-70% feedback para resonancia

        for (int s = 0; s < numSamples; ++s)
        {
            // Avanzar LFO
            lfoPhaseL += lfoInc;
            if (lfoPhaseL >= 1.0) lfoPhaseL -= 1.0;

            float phaseOffsetR = (float)(phase * 0.5); // 0-0.5 (0°-180°)
            lfoPhaseR = lfoPhaseL + phaseOffsetR;
            if (lfoPhaseR >= 1.0) lfoPhaseR -= 1.0;

            // LFO modula la frecuencia de corte
            float lfoValL = getLFOWave(lfoPhaseL);
            float lfoValR = getLFOWave(lfoPhaseR);

            float freqModL = baseHz + (lfoValL * 0.5f + 0.5f) * modRange;
            float freqModR = baseHz + (lfoValR * 0.5f + 0.5f) * modRange;

            float coeffL = calcAllpassCoeff(freqModL);
            float coeffR = calcAllpassCoeff(freqModR);

            // Procesar entrada con feedback
            float dryL = inL[s] + fbStateL * feedback;
            float dryR = inR[s] + fbStateR * feedback;

            // Cascada de allpass filters
            for (int i = 0; i < stages; ++i)
            {
                // Allpass: y[n] = -a * x[n] + x[n-1] + a * y[n-1]
                float aL = coeffL;
                float aR = coeffR;

                float newStateL = -aL * dryL + delayL[i] + aL * stateL[i];
                float newStateR = -aR * dryR + delayR[i] + aR * stateR[i];

                delayL[i] = dryL;
                delayR[i] = dryR;
                stateL[i] = newStateL;
                stateR[i] = newStateR;

                dryL = newStateL;
                dryR = newStateR;
            }

            // Guardar feedback para la siguiente muestra
            fbStateL = dryL;
            fbStateR = dryR;

            // 100% wet (el slot maneja la mezcla)
            outL[s] = dryL;
            outR[s] = dryR;
        }
    }
}
