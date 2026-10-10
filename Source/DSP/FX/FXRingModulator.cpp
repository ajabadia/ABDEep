#include "FXRingModulator.h"
#include <algorithm>

namespace ABD
{
    FXRingModulator::FXRingModulator()
    {
        reset();
    }

    void FXRingModulator::prepare(double sr, int /*samplesPerBlock*/)
    {
        ringMod.prepare(sr);
        reset();
    }

    void FXRingModulator::reset()
    {
        paramFreq = 0.5f;
        paramLFORate = 0.3f;
        paramLFODepth = 0.4f;
        paramWaveform = 0.0f;
        paramMix = 0.5f;

        ringMod.reset();
    }

    void FXRingModulator::setParameter(int index, float value)
    {
        const float clamped = std::clamp(value, 0.0f, 1.0f);
        switch (index)
        {
            case 0: paramFreq = clamped; break;
            case 1: paramLFORate = clamped; break;
            case 2: paramLFODepth = clamped; break;
            case 3: paramWaveform = clamped; break;
            case 4: paramMix = clamped; break;
            default: break;
        }
    }

    void FXRingModulator::process(const float* inL, const float* inR,
                                   float* outL, float* outR,
                                   int numSamples)
    {
        for (int s = 0; s < numSamples; ++s)
        {
            const float dryL = inL[s];
            const float dryR = inR[s];

            // 1. Procesa cada canal con el modulador compartido y la etapa de diodos
            const float wetL = ringMod.processSample(0, dryL, paramWaveform);
            const float wetR = ringMod.processSample(1, dryR, paramWaveform);

            // 2. Avanza fase del oscilador y LFO una sola vez por muestra (fase estéreo compartida)
            ringMod.advance(paramFreq, paramLFORate, paramLFODepth);

            // 3. Mezcla seca / húmeda del slot
            outL[s] = dryL * (1.0f - paramMix) + wetL * paramMix;
            outR[s] = dryR * (1.0f - paramMix) + wetR * paramMix;
        }
    }
}