#include "FXSpaceEchoRE201.h"
#include <algorithm>

namespace ABD
{
    FXSpaceEchoRE201::FXSpaceEchoRE201()
    {
        reset();
    }

    void FXSpaceEchoRE201::prepare(double sr, int /*spb*/)
    {
        echo.prepare(sr);
        reset();
    }

    void FXSpaceEchoRE201::reset()
    {
        paramMode = 0.0f;
        paramTime = 0.4f;
        paramFeedback = 0.4f;
        paramBass = 0.5f;
        paramTreble = 0.5f;
        paramReverb = 0.3f;

        echo.setMode(0);
        echo.reset();
    }

    void FXSpaceEchoRE201::setParameter(int index, float value)
    {
        const float v = std::clamp(value, 0.0f, 1.0f);
        switch (index)
        {
            case 0:
            {
                paramMode = v;
                const int modeIdx = std::clamp(static_cast<int>(v * 4.99f), 0, 4);
                echo.setMode(modeIdx);
                break;
            }
            case 1: paramTime = v; break;
            case 2: paramFeedback = v; break;
            case 3: paramBass = v; break;
            case 4: paramTreble = v; break;
            case 5: paramReverb = v; break;
            default: break;
        }
    }

    void FXSpaceEchoRE201::process(const float* inL, const float* inR,
                                   float* outL, float* outR,
                                   int numSamples)
    {
        // Retardo base: 120 ms a 1500 ms con escala de techo 1.5 del hardware DeepMind
        const float baseDelay = 0.12f + paramTime * 1.38f;
        const float delaySec  = baseDelay * 1.5f;
        const float fb        = paramFeedback * 0.85f;
        const float reverbMix = paramReverb;

        for (int s = 0; s < numSamples; ++s)
        {
            // 1. Procesa cada canal con el motor multicabezal y el tanque de muelles
            outL[s] = echo.processSample(0, inL[s], delaySec, fb, paramBass, paramTreble, reverbMix);
            outR[s] = echo.processSample(1, inR[s], delaySec, fb, paramBass, paramTreble, reverbMix);

            // 2. Avanza transporte de cinta y modulación wow/flutter una sola vez por muestra
            echo.advance();
        }
    }
}
