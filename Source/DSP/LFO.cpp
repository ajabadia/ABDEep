#include "LFO.h"
#include <cmath>
#include <algorithm>
#include <cstdlib>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

namespace ABD
{
    LFO::LFO()
    {
        reset();
    }

    void LFO::setSampleRate(double newSampleRate)
    {
        sampleRate = std::max(1.0, newSampleRate);
        updatePhaseIncrement();
    }

    void LFO::setRate(float rateHz)
    {
        rate = std::clamp(rateHz, 0.01f, 100.0f);
        updatePhaseIncrement();
    }

    void LFO::setShape(int shapeIndex)
    {
        currentShape = static_cast<Shape>(std::clamp(shapeIndex, 0, 6));
    }

    void LFO::setKeySync(bool sync)
    {
        keySync = sync;
    }

    void LFO::setDelay(float delaySec)
    {
        delayTime = std::max(0.0f, delaySec);
    }

    void LFO::setSlew(float slewAmount)
    {
        slew = std::clamp(slewAmount, 0.0f, 1.0f);
    }

    void LFO::reset()
    {
        phase = 0.0;
        delaySamplesElapsed = 0.0;
        lastOutput = 0.0f;
        targetSH = 0.0f;
        currentSH = 0.0f;
    }

    void LFO::trigger()
    {
        if (keySync)
        {
            phase = 0.0;
            delaySamplesElapsed = 0.0;
        }
    }

    void LFO::setPhase(double newPhase)
    {
        phase = std::fmod(newPhase, 1.0);
        if (phase < 0.0) phase += 1.0;
    }

    double LFO::getPhase() const
    {
        return phase;
    }

    void LFO::updatePhaseIncrement()
    {
        phaseIncrement = rate / sampleRate;
    }

    float LFO::generateRawWave()
    {
        float out = 0.0f;
        double p = phase;

        switch (currentShape)
        {
            case Shape::kSine:
                out = std::sin(2.0 * M_PI * p);
                break;

            case Shape::kTriangle:
                if (p < 0.25)
                    out = p * 4.0;
                else if (p < 0.75)
                    out = 2.0 - p * 4.0;
                else
                    out = p * 4.0 - 4.0;
                break;

            case Shape::kSquare:
                out = (p < 0.5) ? 1.0f : -1.0f;
                break;

            case Shape::kRampUp:
                out = -1.0f + 2.0f * (float)p;
                break;

            case Shape::kRampDown:
                out = 1.0f - 2.0f * (float)p;
                break;

            case Shape::kSampleHold:
            case Shape::kSampleGlide:
                // Se recalcula al inicio del ciclo
                break;
        }

        return out;
    }

    float LFO::nextSample()
    {
        // 1. Manejo del retraso (Delay)
        double delaySamples = delayTime * sampleRate;
        if (delaySamplesElapsed < delaySamples)
        {
            delaySamplesElapsed += 1.0;
            return 0.0f; // Silencio durante el delay
        }

        // 2. Comprobación de wrap-around del ciclo de fase
        bool phaseWrapped = false;
        double nextPhase = phase + phaseIncrement;
        if (nextPhase >= 1.0)
        {
            phaseWrapped = true;
            nextPhase = std::fmod(nextPhase, 1.0);
        }
        phase = nextPhase;

        // 3. Lógica para Sample & Hold / Sample & Glide
        if (phaseWrapped || (currentSH == 0.0f && targetSH == 0.0f))
        {
            float randVal = -1.0f + 2.0f * ((float)std::rand() / (float)RAND_MAX);
            targetSH = randVal;
            if (currentShape == Shape::kSampleHold)
            {
                currentSH = targetSH;
            }
        }

        float rawOutput = 0.0f;
        if (currentShape == Shape::kSampleHold)
        {
            rawOutput = currentSH;
        }
        else if (currentShape == Shape::kSampleGlide)
        {
            // Glidado simple hacia el target
            currentSH += (targetSH - currentSH) * 0.05f;
            rawOutput = currentSH;
        }
        else
        {
            rawOutput = generateRawWave();
        }

        // 4. Aplicación de Slew Rate (Limita cambios bruscos)
        if (slew > 0.0f)
        {
            float maxChange = 1.0f - slew; // a mayor slew, menor cambio permitido
            maxChange = std::max(0.001f, maxChange * 0.1f);
            float change = rawOutput - lastOutput;
            change = std::clamp(change, -maxChange, maxChange);
            rawOutput = lastOutput + change;
        }

        lastOutput = rawOutput;
        return rawOutput;
    }

    float LFO::getUnipolar() const
    {
        return lastOutput * 0.5f + 0.5f;
    }
}
