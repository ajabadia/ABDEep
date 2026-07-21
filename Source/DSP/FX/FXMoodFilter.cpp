#include "FXMoodFilter.h"
#include <cmath>
#include <algorithm>
#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

namespace ABD
{
    FXMoodFilter::FXMoodFilter() { reset(); }

    void FXMoodFilter::prepare(double newSampleRate, int samplesPerBlock)
    {
        sampleRate = std::max(1.0, newSampleRate);
        updateLFO();
    }

    void FXMoodFilter::setParameter(int index, float value)
    {
        value = std::clamp(value, 0.0f, 1.0f);
        switch (index)
        {
            case 0: speed = value; updateLFO(); break;
            case 1: depth = value; break;
            case 2: reso  = value; break;
            case 3: baseFreq = value; break;
            case 4: filterType = (int)(value * 3.99f); break;
            case 5: waveShape = (int)(value * 6.99f); break;
            case 6: envMod = value; break;
            case 7: drive = value; break;
            case 8: fourPole = (value > 0.5f) ? 1 : 0; break;
        }
    }

    void FXMoodFilter::reset()
    {
        svfLowL = svfLowR = svfBandL = svfBandR = svfHighL = svfHighR = 0.0f;
        envStateL = envStateR = 0.0f;
        lfoPhase = 0.0; lfoValue = 0.0f;
    }

    void FXMoodFilter::updateLFO()
    {
        float freqHz = 0.05f + 19.95f * speed;
        lfoInc = freqHz / sampleRate;
    }

    float FXMoodFilter::fastRand()
    {
        rngState = rngState * 1103515245u + 12345u;
        return (float)(rngState >> 16) / 65536.0f; // 0-1
    }

    float FXMoodFilter::getWaveform(double phase, int shape)
    {
        double p = phase - std::floor(phase);
        switch (shape)
        {
            case 0: return (float)(4.0 * std::abs(p - 0.5) - 1.0); // Tri
            case 1: return (float)std::sin(2.0 * M_PI * p);        // Sin
            case 2: return (float)(2.0 * p - 1.0);                 // Saw+
            case 3: return (float)(1.0 - 2.0 * p);                 // Saw-
            case 4: return (float)(1.0 - 4.0 * std::abs(p - 0.5)); // Ramp
            case 5: return (p < 0.5f) ? 1.0f : -1.0f;              // Square
            case 6: return fastRand() * 2.0f - 1.0f;               // Random
            default: return (float)std::sin(2.0 * M_PI * p);
        }
    }

    void FXMoodFilter::updateCoeffs(float freqHz)
    {
        float wd = (float)(2.0 * M_PI * freqHz / sampleRate);
        // Clamp gCoeff for Chamberlin SVF stability (must be < 2.0)
        gCoeff = std::min(std::tan(wd * 0.5f), 1.9f);
        float damping = 1.0f - reso * 0.95f;
        // Clamp rCoeff to prevent runaway feedback (max ~4.0 for stability)
        rCoeff = std::min(1.0f / std::max(damping, 0.01f), 4.0f);
        driveGain = 1.0f + drive * 5.0f;
    }

    void FXMoodFilter::process(const float* inL, const float* inR,
                                float* outL, float* outR, int numSamples)
    {
        for (int s = 0; s < numSamples; ++s)
        {
            // LFO
            lfoPhase += lfoInc;
            if (lfoPhase >= 1.0) lfoPhase -= 1.0;
            lfoValue = getWaveform(lfoPhase, waveShape);

            // Envelope follower
            float absL = std::abs(inL[s]), absR = std::abs(inR[s]);
            auto updateEnv = [](float& state, float in, float atk, float rel) {
                state = (in > state) ? state + atk * (in - state) : state + rel * (in - state);
            };
            updateEnv(envStateL, absL, 0.01f, 0.001f);
            updateEnv(envStateR, absR, 0.01f, 0.001f);
            float env = (envStateL + envStateR) * 0.5f;

            // Modulación = LFO + Envelope
            float envAmt = (envMod - 0.5f) * 2.0f; // -1..+1
            float mod = (lfoValue * depth) + (env * 4.0f * envAmt);
            mod = std::clamp(mod, -1.0f, 1.0f);

            // Frecuencia modulada
            float baseHz = 20.0f * std::pow(750.0f, baseFreq);
            float modRange = baseHz * 4.0f;
            float freqHz = std::clamp(baseHz + mod * modRange, 20.0f, (float)(sampleRate * 0.45f));
            updateCoeffs(freqHz);

            // Drive (overdrive pre-filtro)
            float driveL = std::tanh(inL[s] * driveGain);
            float driveR = std::tanh(inR[s] * driveGain);

            // SVF (Chamberlin)
            auto processSVF = [&](float in, float& low, float& band, float& high) {
                high = in - low - rCoeff * band;
                band = band + gCoeff * high;
                low = low + gCoeff * band;
                // Soft-limit state variables to prevent runaway
                band = std::tanh(band);
                low = std::tanh(low);
                // 2-pole: low1 = low
                if (fourPole)
                {
                    float low2 = low + gCoeff * (band - low);
                    low2 = std::tanh(low2);
                    low = low2;
                    band = band + gCoeff * (low2 - band);
                    band = std::tanh(band);
                    low = low2;
                }
            };

            processSVF(driveL, svfLowL, svfBandL, svfHighL);
            processSVF(driveR, svfLowR, svfBandR, svfHighR);

            // Selección de tipo
            float wetL, wetR;
            switch (filterType)
            {
                case 0: wetL = svfLowL;  wetR = svfLowR;  break; // LP
                case 1: wetL = svfHighL; wetR = svfHighR; break; // HP
                case 2: wetL = svfBandL; wetR = svfBandR; break; // BP
                case 3: // Notch
                default:
                    wetL = svfLowL + svfHighL;
                    wetR = svfLowR + svfHighR;
                    break;
            }

            outL[s] = wetL;
            outR[s] = wetR;
        }
    }
}
