#include "FXEdison.h"
#include <cmath>
#include <algorithm>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

namespace ABD
{
    FXEdison::FXEdison()
    {
        reset();
    }

    void FXEdison::prepare(double newSampleRate, int samplesPerBlock)
    {
        sampleRate = std::max(1.0, newSampleRate);
        updateLMF();
    }

    void FXEdison::setParameter(int index, float value)
    {
        value = std::clamp(value, 0.0f, 1.0f);

        switch (index)
        {
            case 0: on = (value > 0.5f); break;
            case 1: inMode = (value > 0.5f) ? 1 : 0; break;
            case 2: outMode = (value > 0.5f) ? 1 : 0; break;
            case 3: stSpread = value; break;
            case 4: lmfSpread = value; updateLMF(); break;
            case 5: balance = value; break;
            case 6: cntrDist = value; break;
            case 7: gain = value; break;
        }
    }

    void FXEdison::reset()
    {
        lmfSideL = lmfSideR = 0.0f;
    }

    void FXEdison::updateLMF()
    {
        // LMF crossover: ~300Hz cuando lmfSpread cambia
        // El filtro separa low-mid para aplicar spread diferencial
        float freq = 300.0f;
        lmfCoeff = (float)(freq / (freq + sampleRate * 0.5));
    }

    void FXEdison::process(const float* inL, const float* inR,
                            float* outL, float* outR,
                            int numSamples)
    {
        if (!on)
        {
            for (int s = 0; s < numSamples; ++s)
            {
                outL[s] = inL[s];
                outR[s] = inR[s];
            }
            return;
        }

        // Mapeo de parámetros
        // stSpread: 0-1 → -50..+50, centrado en 0
        float spreadVal = (stSpread - 0.5f) * 2.0f; // -1 a 1
        // lmfSpread: 0-1 → -50..+50
        float lmfVal = (lmfSpread - 0.5f) * 2.0f;
        // balance: 0-1 → -50..+50 (0=centro)
        float balVal = (balance - 0.5f) * 2.0f;
        // cntrDist: 0-1 → -50..+50
        float centerDistAmt = (cntrDist - 0.5f) * 2.0f;
        // gain: 0-1 → -12..+12 dB
        float gainLin = std::pow(10.0f, (gain * 24.0f - 12.0f) / 20.0f);

        for (int s = 0; s < numSamples; ++s)
        {
            float left = inL[s];
            float right = inR[s];

            // --- Decodificar M/S si inMode = M/S ---
            float mid, side;
            if (inMode == 1)
            {
                // La entrada ya es M/S
                mid = left;
                side = right;
            }
            else
            {
                // ST → M/S
                mid = (left + right) * 0.5f;
                side = (left - right) * 0.5f;
            }

            // --- Stereo Spread: modula la señal side ---
            // spreadVal: -1 = mono, 0 = normal, +1 = expandido
            float spreadFactor = 1.0f + spreadVal;
            side *= spreadFactor;

            // --- LMF Spread: spread diferencial en frecuencias bajas del Side ---
            if (std::abs(lmfVal) > 0.01f)
            {
                // Separar low-mid de Side usando LPF por canal
                lmfSideL = lmfSideL + lmfCoeff * (side - lmfSideL);
                lmfSideR = lmfSideR + lmfCoeff * (side - lmfSideR);

                // Side low = filtered, Side high = original - filtered
                float sideLowL = lmfSideL;
                float sideLowR = lmfSideR;
                float sideHighL = side - lmfSideL;
                float sideHighR = side - lmfSideR;

                // Aplicar spread diferente a low-mid del Side
                float lmfSpreadFactor = 1.0f + lmfVal;
                // Reconstruir Side con low-mid procesado
                side = sideLowL * lmfSpreadFactor + sideHighL;
                // Para simplificar usamos sideL para side unificado (M/S mono side)
                // side ya es un valor escalar (el mismo para L y R en M/S)
            }

            // --- Center Distortion: distorsión en la señal Mid ---
            if (std::abs(centerDistAmt) > 0.01f)
            {
                // Distorsión suave (tanh) en la señal central
                float distGain = 1.0f + std::abs(centerDistAmt) * 8.0f;
                float distMid = mid * distGain;
                distMid = (float)std::tanh(distMid);
                // Mezclar: centerDistAmt negativo = comprimir, positivo = distorsionar
                mid = mid * (1.0f - std::abs(centerDistAmt)) + distMid * std::abs(centerDistAmt);
            }

            // --- Balance: modula ganancia L/R ---
            float balGainL = 1.0f - std::max(0.0f, balVal) * 0.5f;
            float balGainR = 1.0f - std::max(0.0f, -balVal) * 0.5f;

            // --- Codificar salida según outMode ---
            float outLeft, outRight;
            if (outMode == 1)
            {
                // Salida M/S directamente
                outLeft = mid * balGainL;
                outRight = side * balGainR;
            }
            else
            {
                // M/S → ST
                outLeft = (mid + side) * balGainL;
                outRight = (mid - side) * balGainR;
            }

            // Ganancia de salida
            outL[s] = outLeft * gainLin;
            outR[s] = outRight * gainLin;
        }
    }
}
