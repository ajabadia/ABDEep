#include "FXAutoPan.h"
#include <cmath>
#include <algorithm>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

namespace ABD
{
    FXAutoPan::FXAutoPan()
    {
        reset();
    }

    void FXAutoPan::prepare(double newSampleRate, int samplesPerBlock)
    {
        sampleRate = std::max(1.0, newSampleRate);
        updateLFOIncrement();
    }

    void FXAutoPan::setParameter(int index, float value)
    {
        value = std::clamp(value, 0.0f, 1.0f);

        switch (index)
        {
            case 0: speed = value;  updateLFOIncrement(); break;
            case 1: phase = value;  break; // 0-1 → 0-180°
            case 2: wave  = value;  break; // 0-1 → triangular..cuadrado con simetría
            case 3: depth = value;  break;
            case 4: envSpd = value; break;
            case 5: envDepth = value; break;
        }
    }

    void FXAutoPan::reset()
    {
        lfoPhaseL = 0.0;
        lfoPhaseR = 0.0;
        envStateL = 0.0f;
        envStateR = 0.0f;
    }

    void FXAutoPan::updateLFOIncrement()
    {
        // Speed: 0-1 → 0.05Hz - 5.0Hz
        float freqHz = 0.05f + 4.95f * speed;
        lfoInc = freqHz / sampleRate;
    }

    float FXAutoPan::getLFOWave(double phase, float waveParam)
    {
        // waveParam 0-1:
        //   0.0 → triangular
        //   0.5 → sinusoidal
        //   1.0 → cuadrado
        // La simetría del hardware (-50 a +50) se implementa skeweando la fase

        // Generar onda base sinusoidal
        float sinVal = (float)std::sin(2.0 * M_PI * phase);
        float out;

        if (waveParam < 0.3f)
        {
            // Mezcla triangular + sinusoidal
            float tri = (float)(4.0 * std::abs(phase - std::floor(phase + 0.5)) - 1.0);
            float t = waveParam / 0.3f; // 0-1
            out = tri * (1.0f - t) + sinVal * t;
        }
        else if (waveParam < 0.7f)
        {
            // Mezcla sinusoidal pura, con algo de simetría
            float t = (waveParam - 0.3f) / 0.4f; // 0-1
            // Simetría leve: skewed phase
            double skew = (phase - 0.5) * 0.3 * t;
            double skewedPhase = phase + skew;
            if (skewedPhase > 1.0) skewedPhase -= 1.0;
            if (skewedPhase < 0.0) skewedPhase += 1.0;
            out = (float)std::sin(2.0 * M_PI * skewedPhase);
        }
        else
        {
            // Mezcla sinusoidal + cuadrado
            float sq = (sinVal >= 0.0f) ? 1.0f : -1.0f;
            float t = (waveParam - 0.7f) / 0.3f; // 0-1
            out = sinVal * (1.0f - t) + sq * t;
            // Suavizado del cuadrado (evita clicks)
            if (t > 0.5f)
            {
                float soft = (float)std::tanh(out * 0.5f) * 2.0f;
                out = out * (1.0f - t) + soft * t;
            }
        }

        return out;
    }

    void FXAutoPan::process(const float* inL, const float* inR,
                             float* outL, float* outR,
                             int numSamples)
    {
        for (int s = 0; s < numSamples; ++s)
        {
            // Envelope modulator: incremento base + modulación
            float envL = 0.0f, envR = 0.0f;
            {
                float absL = std::abs(inL[s]);
                float absR = std::abs(inR[s]);

                if (absL > envStateL)
                    envStateL = envStateL + envAttack * (absL - envStateL);
                else
                    envStateL = envStateL + envRelease * (absL - envStateL);

                if (absR > envStateR)
                    envStateR = envStateR + envAttack * (absR - envStateR);
                else
                    envStateR = envStateR + envRelease * (absR - envStateR);

                envL = std::clamp(envStateL * 4.0f, 0.0f, 1.0f);
                envR = std::clamp(envStateR * 4.0f, 0.0f, 1.0f);
            }

            // Avanzar LFO con modulación de velocidad por envelope
            float effectiveIncL = lfoInc * (1.0f + envSpd * envL);
            float effectiveIncR = lfoInc * (1.0f + envSpd * envR);

            lfoPhaseL += effectiveIncL;
            if (lfoPhaseL >= 1.0) lfoPhaseL -= 1.0;

            float phaseOffset = phase * 0.5f;
            lfoPhaseR = lfoPhaseL + phaseOffset;
            if (lfoPhaseR >= 1.0) lfoPhaseR -= 1.0;
            // Aplicar incremento de R por separado (mantiene offset estéreo)
            // Nota: lfoPhaseR ya se derivó de lfoPhaseL para el offset, ahora aplicamos envR
            // para que la velocidad R pueda diferir ligeramente
            lfoPhaseR += (effectiveIncR - effectiveIncL);
            if (lfoPhaseR >= 1.0) lfoPhaseR -= 1.0;
            if (lfoPhaseR < 0.0)  lfoPhaseR += 1.0;

            // Obtener valor del LFO con forma de onda
            float lfoL = getLFOWave(lfoPhaseL, wave);
            float lfoR = getLFOWave(lfoPhaseR, wave);

            // Depth modulado por envelope
            float effectiveDepth = depth * (1.0f + envDepth * (envL - 0.5f));
            effectiveDepth = std::clamp(effectiveDepth, 0.0f, 1.0f);

            if (effectiveDepth < 0.01f)
            {
                // Señal seca
                outL[s] = inL[s];
                outR[s] = inR[s];
            }
            else
            {
                // Auto Pan: lfo modula la posición estéreo (equal power)
                float panPos = lfoL * effectiveDepth;
                float gainL = (float)std::cos((M_PI / 4.0) * (panPos + 1.0f));
                float gainR = (float)std::sin((M_PI / 4.0) * (panPos + 1.0f));

                outL[s] = inL[s] * gainL;
                outR[s] = inR[s] * gainR;
            }
        }
    }
}
