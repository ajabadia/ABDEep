#include "FXMultiBandDist.h"
#include <cmath>
#include <algorithm>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

namespace ABD
{
    FXMultiBandDist::FXMultiBandDist()
    {
        reset();
    }

    void FXMultiBandDist::prepare(double newSampleRate, int samplesPerBlock)
    {
        sampleRate = std::max(1.0, newSampleRate);
        updateCrossoverCoeffs();
        // Cabinet filter ~4kHz
        float cabFreq = 4000.0f;
        cabCoeff = (float)(cabFreq / (cabFreq + sampleRate * 0.3));
        // Post-filter LPF ~5.5kHz (coincides with 0.2f at 44100Hz)
        float postFreq = 5513.0f;
        postCoeff = (float)(postFreq / (postFreq + sampleRate * 0.5));
    }

    void FXMultiBandDist::setParameter(int index, float value)
    {
        value = std::clamp(value, 0.0f, 1.0f);

        switch (index)
        {
            case 0:  inGain = value; break;
            case 1:  distType = std::clamp((int)(value * 5.99f), 0, 5); break;
            case 2:  lowLevel = value; break;
            case 3:  lowDrive = value; break;
            case 4:  xoverLowMid = value; updateCrossoverCoeffs(); break;
            case 5:  midLevel = value; break;
            case 6:  midDrive = value; break;
            case 7:  xoverMidHi = value; updateCrossoverCoeffs(); break;
            case 8:  hiLevel = value; break;
            case 9:  hiDrive = value; break;
            case 10: cabinetType = std::clamp((int)(value * 11.99f), 0, 11); break;
            case 11: outGain = value; break;
        }
    }

    void FXMultiBandDist::reset()
    {
        xv1LowL = xv1LowR = 0.0f;
        xv1HighL = xv1HighR = 0.0f;
        xv2LowL = xv2LowR = 0.0f;
        xv2HighL = xv2HighR = 0.0f;
        cabL = cabR = 0.0f;
    }

    void FXMultiBandDist::updateCrossoverCoeffs()
    {
        // Crossover complementario de 3 bandas usando filtros de 1-polo
        // LPF + HPF complementario (HPF = in - LPF) suman a 1 ✅
        float freq1 = 30.0f * std::pow(300.0f, xoverLowMid); // 30-9000Hz
        float freq2 = 30.0f * std::pow(300.0f, xoverMidHi);

        // Asegurar que freq1 < freq2
        freq1 = std::min(freq1, freq2 * 0.8f);
        freq2 = std::max(freq2, freq1 * 1.2f);

        // Coeficiente de 1-polo: alpha = fc / (fc + fs/2)
        xv1Coeff = (float)(freq1 / (freq1 + sampleRate * 0.5));
        xv2Coeff = (float)(freq2 / (freq2 + sampleRate * 0.5));
    }

    float FXMultiBandDist::applyDistType(float sample, int type, float drive)
    {
        float gain = 1.0f + drive * 15.0f; // 1x a 16x
        float x = sample * gain;

        switch (type)
        {
            case 0: // Valve: tanh suave, saturación gradual
                return (float)std::tanh(x);

            case 1: // Saturate: hard clip suave con knee
            {
                float knee = 0.5f;
                if (std::abs(x) < knee)
                    return x;
                float excess = std::abs(x) - knee;
                float soft = knee + std::tanh(excess);
                return (x > 0.0f) ? soft : -soft;
            }

            case 2: // Tube: asimétrico (positivo ≠ negativo)
            {
                if (x > 0.0f)
                    return (float)std::tanh(x);
                else
                    return (float)std::tanh(x * 0.7f) * 0.85f;
            }

            case 3: // Post-filter valve: distorsión seguida de LPF suave
            case 4: // Post-filter saturate
            case 5: // Post-filter tube
            {
                // La aplicación del post-filter se hace en process()
                // Aquí solo aplicamos la distorsión base
                int baseType = type - 3;
                return applyDistType(sample, baseType, drive);
            }

            default:
                return (float)std::tanh(x);
        }
    }

    void FXMultiBandDist::process(const float* inL, const float* inR,
                                   float* outL, float* outR,
                                   int numSamples)
    {
        float inGainLin = std::pow(10.0f, (inGain * 48.0f - 24.0f) / 20.0f); // -24..+24 dB

        // Mapeo de niveles: 0-1 → -12dB a +12dB
        auto mapLevel = [](float norm) -> float {
            return std::pow(10.0f, (norm * 24.0f - 12.0f) / 20.0f);
        };

        float lowGain = mapLevel(lowLevel);
        float midGain = mapLevel(midLevel);
        float hiGain  = mapLevel(hiLevel);

        float outGainLin = mapLevel(outGain);

        // Reset post-filter state
        postL = 0.0f;
        postR = 0.0f;

        bool usePostFilter = (distType >= 3);
        int baseDistType = (distType >= 3) ? (distType - 3) : distType;

        for (int s = 0; s < numSamples; ++s)
        {
            float inL_s = inL[s] * inGainLin;
            float inR_s = inR[s] * inGainLin;

            // --- Crossover de 3 bandas (filtros complementarios de 1-polo) ---
            // Banda 1: low = LPF en xv1
            xv1LowL = xv1LowL + xv1Coeff * (inL_s - xv1LowL);
            xv1LowR = xv1LowR + xv1Coeff * (inR_s - xv1LowR);
            float lowL_s = xv1LowL;
            float lowR_s = xv1LowR;

            // Banda 2: mid = HPF(xv1) luego LPF(xv2)
            // HPF de 1-polo: y[n] = a * y[n-1] + a * (x[n] - x[n-1])
            // Simplificado: HPF = in - LPF (filtro complementario)
            float midInL = inL_s - xv1LowL;  // HPF complementario
            float midInR = inR_s - xv1LowR;

            xv2LowL = xv2LowL + xv2Coeff * (midInL - xv2LowL);
            xv2LowR = xv2LowR + xv2Coeff * (midInR - xv2LowR);
            float midL_s = xv2LowL;
            float midR_s = xv2LowR;

            // Banda 3: hi = HPF complementario en xv2
            float hiL_s = midInL - xv2LowL;  // HPF complementario de xv2
            float hiR_s = midInR - xv2LowR;

            // --- Distorsión por banda ---
            float distLowL = applyDistType(lowL_s, baseDistType, lowDrive);
            float distLowR = applyDistType(lowR_s, baseDistType, lowDrive);
            float distMidL = applyDistType(midL_s, baseDistType, midDrive);
            float distMidR = applyDistType(midR_s, baseDistType, midDrive);
            float distHiL  = applyDistType(hiL_s, baseDistType, hiDrive);
            float distHiR  = applyDistType(hiR_s, baseDistType, hiDrive);

            // Post-filter (LPF suave para dist types 3-5)
            if (usePostFilter)
            {
                float sumL = distLowL + distMidL + distHiL;
                float sumR = distLowR + distMidR + distHiR;
                postL = postL + postCoeff * (sumL - postL);
                postR = postR + postCoeff * (sumR - postR);
                distLowL = distMidL = distHiL = postL;
                distLowR = distMidR = distHiR = postR;
            }

            // --- Re-combinar con niveles por banda ---
            float wetL = distLowL * lowGain + distMidL * midGain + distHiL * hiGain;
            float wetR = distLowR * lowGain + distMidR * midGain + distHiR * hiGain;

            // Cabinet (LPF cuando está activo)
            if (cabinetType > 0)
            {
                cabL = cabL + cabCoeff * (wetL - cabL);
                cabR = cabR + cabCoeff * (wetR - cabR);
                wetL = cabL;
                wetR = cabR;
            }

            // Output gain
            outL[s] = wetL * outGainLin;
            outR[s] = wetR * outGainLin;
        }
    }
}
