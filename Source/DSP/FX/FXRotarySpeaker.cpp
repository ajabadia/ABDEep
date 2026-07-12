#include "FXRotarySpeaker.h"
#include <cmath>
#include <algorithm>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

namespace ABD
{
    FXRotarySpeaker::FXRotarySpeaker()
    {
        reset();
    }

    void FXRotarySpeaker::prepare(double newSampleRate, int samplesPerBlock)
    {
        sampleRate = std::max(1.0, newSampleRate);
        // Crossover a ~800Hz
        xoverCoeff = (float)(800.0 / (800.0 + sampleRate * 0.5));
        updateTargets();
        updateAccelRate();
    }

    void FXRotarySpeaker::setParameter(int index, float value)
    {
        value = std::clamp(value, 0.0f, 1.0f);

        switch (index)
        {
            case 0: loSpeed = value; updateTargets(); break;
            case 1: hiSpeed = value; updateTargets(); break;
            case 2: accel   = value; updateAccelRate(); break;
            case 3: distance = value; break;
            case 4: balance  = value; break;
            case 5: // Speed toggle (0=SLOW, 1=FAST)
                targetSpeed = (value > 0.5f) ? 1.0f : 0.0f;
                updateTargets();
                break;
            case 6: // Motor (0=RUN, 1=STOP)
                motorRunning = (value < 0.5f);
                if (!motorRunning)
                {
                    // Frenar rotores
                    hornTarget = 0.0;
                    rotorTarget = 0.0;
                }
                break;
        }
    }

    void FXRotarySpeaker::reset()
    {
        hornPhase  = 0.0;
        rotorPhase = 0.0;
        hornSpeed  = 0.0;
        rotorSpeed = 0.0;
        hornTarget = 0.0;
        rotorTarget = 0.0;
        hornDelayL = 0.0f;
        hornDelayR = 0.0f;
        rotorDelayL = 0.0f;
        rotorDelayR = 0.0f;
        xoverStateL = 0.0f;
        xoverStateR = 0.0f;
        motorRunning = true;
        targetSpeed = 0.0f; // SLOW por defecto
    }

    void FXRotarySpeaker::updateTargets()
    {
        if (!motorRunning)
        {
            hornTarget = 0.0;
            rotorTarget = 0.0;
            return;
        }

        if (targetSpeed > 0.5f) // FAST
        {
            // HiSpeed: 2.0 - 9.9 Hz
            hornTarget = 2.0 + 7.9 * hiSpeed;  // el horn va a la velocidad configurada
            rotorTarget = hornTarget * 0.5;     // rotor va más lento
        }
        else // SLOW
        {
            // LoSpeed: 0.1 - 4.0 Hz
            hornTarget = 0.1 + 3.9 * loSpeed;
            rotorTarget = hornTarget * 0.5;
        }
    }

    void FXRotarySpeaker::updateAccelRate()
    {
        // Accel: 0-100% → factor de suavizado
        // accel=0 → muy lento (~3s para cambio de velocidad)
        // accel=100 → instantáneo
        accelRate = 0.001 + 0.999 * accel;
    }

    float FXRotarySpeaker::getDistanceAtten(float distanceNorm, double phase)
    {
        // Distancia modula la intensidad del Doppler
        // phase 0-1: el altavoz se acerca y se aleja
        // A mayor distancia, mayor modulación de volumen (tremolo)
        float doppler = (float)std::sin(2.0 * M_PI * phase);
        // Distance 0-1: 0=solo modulacion suave, 1=modulacion fuerte
        float modAmount = distanceNorm * 0.3f; // max ±30% volumen
        return 1.0f + doppler * modAmount;
    }

    void FXRotarySpeaker::process(const float* inL, const float* inR,
                                   float* outL, float* outR,
                                   int numSamples)
    {
        for (int s = 0; s < numSamples; ++s)
        {
            // Aceleración/desaceleración suave (filtro de 1-polo)
            hornSpeed = hornSpeed + (hornTarget - hornSpeed) * accelRate;
            rotorSpeed = rotorSpeed + (rotorTarget - rotorSpeed) * accelRate;

            // Avanzar fases de rotación
            hornPhase  += hornSpeed / sampleRate;
            rotorPhase += rotorSpeed / sampleRate;
            if (hornPhase >= 1.0)  hornPhase  -= 1.0;
            if (rotorPhase >= 1.0) rotorPhase -= 1.0;

            // Crossover: separar graves y agudos
            float inputL = inL[s];
            float inputR = inR[s];

            // Filtro pasa-bajos simple (LPF → rotor, HPF → horn)
            xoverStateL = xoverStateL + xoverCoeff * (inputL - xoverStateL);
            xoverStateR = xoverStateR + xoverCoeff * (inputR - xoverStateR);

            float rotorSignalL = xoverStateL;               // graves
            float hornSignalL  = inputL - xoverStateL;       // agudos
            float rotorSignalR = xoverStateR;
            float hornSignalR  = inputR - xoverStateR;

            // --- Efecto Doppler (modulación de fase/retardo) ---
            // El horn (agudo) usa modulación de fase rápida
            float hornPhaseOffset = (float)std::sin(2.0 * M_PI * hornPhase);
            // Distance controla la amplitud del desplazamiento Doppler
            float dopplerHorn = hornPhaseOffset * distance * 0.05f; // max ±5% de mod

            // El rotor (grave) usa modulación más lenta y sutil
            float rotorPhaseOffset = (float)std::sin(2.0 * M_PI * rotorPhase);
            float dopplerRotor = rotorPhaseOffset * distance * 0.03f;

            // Modulación de fase simple (interpolación lineal para delay variable)
            // Simulamos Doppler como un allpass modulado
            float hornOutL = hornSignalL + dopplerHorn * hornDelayL;
            float hornOutR = hornSignalR + dopplerHorn * hornDelayR;
            hornDelayL = hornSignalL;
            hornDelayR = hornSignalR;

            float rotorOutL = rotorSignalL + dopplerRotor * rotorDelayL;
            float rotorOutR = rotorSignalR + dopplerRotor * rotorDelayR;
            rotorDelayL = rotorSignalL;
            rotorDelayR = rotorSignalR;

            // --- Tremolo (modulación de volumen por rotación) ---
            float hornTremL = getDistanceAtten(distance, hornPhase);
            float hornTremR = getDistanceAtten(distance, hornPhase + 0.5); // anti-fase estéreo
            float rotorTremL = getDistanceAtten(distance * 0.5f, rotorPhase);
            float rotorTremR = getDistanceAtten(distance * 0.5f, rotorPhase + 0.5);

            hornOutL *= hornTremL;
            hornOutR *= hornTremR;
            rotorOutL *= rotorTremL;
            rotorOutR *= rotorTremR;

            // --- Balance horn/rotor ---
            // balance: 0-1 → -100% a +100%
            // 0 = solo rotor, 0.5 = mezcla igual, 1 = solo horn
            float hornGain = balance;         // 0-1
            float rotorGain = 1.0f - balance; // 0-1

            // Motor STOP → fade out
            float motorGain = motorRunning ? 1.0f : 0.0f;
            // Cuando motor se detiene, hacer fade gradual
            // (simplificado: corte directo cuando se apaga)

            // Mezcla final
            outL[s] = (hornOutL * hornGain + rotorOutL * rotorGain) * motorGain;
            outR[s] = (hornOutR * hornGain + rotorOutR * rotorGain) * motorGain;
        }
    }
}
