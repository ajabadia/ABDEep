#include "FXRackAmp.h"
#include <cmath>
#include <algorithm>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

namespace ABD
{
    FXRackAmp::FXRackAmp()
    {
        reset();
    }

    void FXRackAmp::prepare(double newSampleRate, int samplesPerBlock)
    {
        sampleRate = std::max(1.0, newSampleRate);
        updateEQCoeffs();
        updateCabinetCoeffs();
    }

    void FXRackAmp::setParameter(int index, float value)
    {
        value = std::clamp(value, 0.0f, 1.0f);

        switch (index)
        {
            case 0: preAmp = value; break;
            case 1: buzz   = value; updateEQCoeffs(); break;
            case 2: punch  = value; updateEQCoeffs(); break;
            case 3: crunch = value; break;
            case 4: drive  = value; break;
            case 5: level  = value; break;
            case 6: lowEQ  = value; updateEQCoeffs(); break;
            case 7: highEQ = value; updateEQCoeffs(); break;
            case 8: cabinet = (value > 0.5f) ? 1.0f : 0.0f; break;
        }
    }

    void FXRackAmp::reset()
    {
        lowStateL = lowStateR = 0.0f;
        highStateL = highStateR = 0.0f;
        cabState1L = cabState1R = 0.0f;
        cabState2L = cabState2R = 0.0f;
    }

    void FXRackAmp::updateEQCoeffs()
    {
        // Low shelving: cutoff ~200Hz
        float lowFreq = 200.0f;
        lowCoeff = (float)(lowFreq / (lowFreq + sampleRate * 0.5));

        // Low boost/cut: -1 a 1
        lowBoost = (lowEQ - 0.5f) * 2.0f;
        // Punch: low-mid boost pre-distorsión
        lowBoost += (punch * 2.0f) * 0.2f;

        // High shelving: cutoff ~5kHz
        float highFreq = 5000.0f;
        highCoeff = (float)(highFreq / (highFreq + sampleRate * 0.5));

        // High boost/cut: -1 a 1
        highBoost = (highEQ - 0.5f) * 2.0f;
        // Buzz: high boost pre-distorsión
        highBoost += (buzz * 2.0f) * 0.3f;
    }

    void FXRackAmp::updateCabinetCoeffs()
    {
        // Cabinet: LPF resonante a ~3.5kHz (simula altavoz de guitarra)
        float cabFreq = 3500.0f;
        cabCoeff = (float)(cabFreq / (cabFreq + sampleRate * 0.3));
        cabRes = 0.2f; // resonancia suave
    }

    float FXRackAmp::applyDistortion(float sample, float driveAmt, float crunchAmt)
    {
        // Pre-gain según drive
        float preGain = 1.0f + driveAmt * 20.0f; // 1x a 21x
        float shaped = sample * preGain;

        // Crunch: distorsión asimétrica (rectificación de media onda suave)
        if (crunchAmt > 0.01f)
        {
            float crunchGain = 1.0f + crunchAmt * 15.0f;
            float crunchSig = sample * crunchGain;
            // Soft clip asimétrico: positivo diferente de negativo
            if (crunchSig > 0.0f)
                shaped = shaped + std::tanh(crunchSig * 0.5f) * crunchAmt;
            else
                shaped = shaped + std::tanh(crunchSig * 0.3f) * crunchAmt * 0.7f;
        }

        // Waveshaping principal: tanh suave para saturación tipo válvula
        shaped = (float)std::tanh(shaped);

        // Compresión suave post-distorsión
        shaped = shaped * (1.0f + 0.3f * (1.0f - std::abs(shaped)));

        return shaped;
    }

    void FXRackAmp::process(const float* inL, const float* inR,
                             float* outL, float* outR,
                             int numSamples)
    {
        float preAmpGain = 1.0f + preAmp * 10.0f;
        float levelGain = 0.3f + level * 0.7f;

        for (int s = 0; s < numSamples; ++s)
        {
            // Pre-amplificación
            float sampL = inL[s] * preAmpGain;
            float sampR = inR[s] * preAmpGain;

            // Filtro pre-dist (low shelving): dry + (filtered - dry) * boost
            lowStateL = lowStateL + lowCoeff * (sampL - lowStateL);
            lowStateR = lowStateR + lowCoeff * (sampR - lowStateR);
            float preEqL = sampL + (lowStateL - sampL) * lowBoost;
            float preEqR = sampR + (lowStateR - sampR) * lowBoost;

            // Distorsión aplicada sobre señal ecualizada
            float distL = applyDistortion(preEqL, drive, crunch);
            float distR = applyDistortion(preEqR, drive, crunch);

            // Filtro post-dist (high shelving): dry + (filtered - dry) * boost
            highStateL = highStateL + highCoeff * (distL - highStateL);
            highStateR = highStateR + highCoeff * (distR - highStateR);
            float wetL = distL + (highStateL - distL) * highBoost;
            float wetR = distR + (highStateR - distR) * highBoost;

            // Cabinet (LPF resonante de 2-polos)
            if (cabinet > 0.5f)
            {
                cabState1L = cabState1L + cabCoeff * (wetL - cabState1L + cabRes * (cabState1L - cabState2L));
                cabState2L = cabState2L + cabCoeff * (cabState1L - cabState2L);
                wetL = cabState2L;

                cabState1R = cabState1R + cabCoeff * (wetR - cabState1R + cabRes * (cabState1R - cabState2R));
                cabState2R = cabState2R + cabCoeff * (cabState1R - cabState2R);
                wetR = cabState2R;
            }

            // Nivel de salida
            outL[s] = wetL * levelGain;
            outR[s] = wetR * levelGain;
        }
    }
}
