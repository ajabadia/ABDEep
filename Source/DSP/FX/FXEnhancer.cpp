#include "FXEnhancer.h"
#include <cmath>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

namespace ABD
{
    FXEnhancer::FXEnhancer() { reset(); }

    void FXEnhancer::prepare(double sr, int)
    {
        sampleRate = std::max(1.0, sr);
        updateCoeffs();
    }

    void FXEnhancer::setParameter(int idx, float v)
    {
        v = std::clamp(v, 0.0f, 1.0f);
        switch (idx)
        {
            case 0: outGain = v; break;
            case 1: spread = v; break;
            case 2: bassGain = v; updateCoeffs(); break;
            case 3: bassFreq = v; updateCoeffs(); break;
            case 4: midGain = v; updateCoeffs(); break;
            case 5: midQ = v; updateCoeffs(); break;
            case 6: hiGain = v; updateCoeffs(); break;
            case 7: hiFreq = v; updateCoeffs(); break;
            case 8: solo = (v > 0.5f); break;
        }
    }

    void FXEnhancer::reset()
    {
        bassStateL = bassStateR = 0.0f;
        midStateL = midStateR = midDelayL = midDelayR = 0.0f;
        hiStateL = hiStateR = 0.0f;
    }

    void FXEnhancer::updateCoeffs()
    {
        auto mapFreq = [](float norm) -> float { return 30.0f * std::pow(666.0f, norm); };
        float bFreq = mapFreq(bassFreq);
        float hFreq = mapFreq(hiFreq);
        bassCoeff = (float)(bFreq / (bFreq + sampleRate * 0.5));
        hiCoeff   = (float)(hFreq / (hFreq + sampleRate * 0.5));

        // Mid: peaking filter (bandpass con Q)
        float mFreq = 1000.0f;
        float Q = 0.5f + midQ * 5.0f;
        float w0 = (float)(2.0 * M_PI * mFreq / sampleRate);
        float alpha = std::sin(w0) / (2.0f * Q);
        float gain = midGain * 3.0f;
        midCoeffA = (1.0f + gain) * alpha;
        midCoeffB = 1.0f - alpha;
    }

    void FXEnhancer::process(const float* inL, const float* inR,
                              float* outL, float* outR, int numSamples)
    {
        float gainLin = std::pow(10.0f, (outGain * 24.0f - 12.0f) / 20.0f);
        float spreadAmt = spread * 0.5f;

        for (int s = 0; s < numSamples; ++s)
        {
            float l = inL[s], r = inR[s];

            // Bass shelf
            bassStateL += bassCoeff * (l - bassStateL);
            bassStateR += bassCoeff * (r - bassStateR);
            float bassL = l + (bassStateL - l) * bassGain * 3.0f;
            float bassR = r + (bassStateR - r) * bassGain * 3.0f;

            // Mid peaking
            float midInL = l - bassStateL;
            float midInR = r - bassStateR;
            float midOutL = midCoeffA * midInL + midDelayL;
            midDelayL = midInL - midCoeffB * midOutL;
            float midOutR = midCoeffA * midInR + midDelayR;
            midDelayR = midInR - midCoeffB * midOutR;

            // High shelf
            float hiInL = l - bassStateL;
            float hiInR = r - bassStateR;
            hiStateL += hiCoeff * (hiInL - hiStateL);
            hiStateR += hiCoeff * (hiInR - hiStateR);
            float hiL = hiInL + (hiStateL - hiInL) * hiGain * 3.0f;
            float hiR = hiInR + (hiStateR - hiInR) * hiGain * 3.0f;

            // Solo mode
            float wetL, wetR;
            if (solo) { wetL = midOutL; wetR = midOutR; }
            else { wetL = bassL + midOutL + hiL; wetR = bassR + midOutR + hiR; }

            // Stereo spread
            float m = (wetL + wetR) * 0.5f;
            float side = (wetL - wetR) * 0.5f;
            side *= (1.0f + spreadAmt);
            outL[s] = (m + side) * gainLin;
            outR[s] = (m - side) * gainLin;
        }
    }
}
