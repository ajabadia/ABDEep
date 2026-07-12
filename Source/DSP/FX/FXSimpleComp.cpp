#include "FXSimpleComp.h"
#include <cmath>
#include <algorithm>

namespace ABD
{
    static const float kTimeConsts[6] = { 0.5f, 2.0f, 5.0f, 10.0f, 20.0f, 50.0f };

    FXSimpleComp::FXSimpleComp() { reset(); }
    void FXSimpleComp::prepare(double sr, int) { sampleRate = std::max(1.0, sr); }

    void FXSimpleComp::reset()
    {
        envL = envR = envStereo = envMid = envSide = 0.0f;
    }

    void FXSimpleComp::setParameter(int idx, float v)
    {
        v = std::clamp(v, 0.0f, 1.0f);
        switch (idx)
        {
            case 0: compMode = (int)(v * 3.99f); break;
            case 1: inGainL = v; break;
            case 2: threshL = v; break;
            case 3: timeL = (int)(v * 5.99f); updateTimeConsts(timeL); break;
            case 4: biasL = v; break;
            case 5: outGainL = v; break;
            case 6: biasBal = v; break;
            case 7: inGainR = v; break;
            case 8: threshR = v; break;
            case 9: timeR = (int)(v * 5.99f); break;
            case 10: biasR = v; break;
            case 11: outGainR = v; break;
        }
    }

    void FXSimpleComp::updateTimeConsts(int t)
    {
        t = std::clamp(t, 0, 5);
        float atkMs = kTimeConsts[t];
        float relMs = kTimeConsts[t] * 10.0f;
        atkCoeff = 1.0f - std::exp(-1.0f / (float)(sampleRate * atkMs / 1000.0));
        relCoeff = 1.0f - std::exp(-1.0f / (float)(sampleRate * relMs / 1000.0));
    }

    float FXSimpleComp::applyComp(float input, float& envelope,
                                   float inGainNorm, float threshNorm,
                                   float biasNorm, float outGainNorm)
    {
        float inGainLin = std::pow(10.0f, (inGainNorm * 20.0f - 20.0f) / 20.0f);
        float x = input * inGainLin;

        float absSig = std::abs(x);
        envelope = (absSig > envelope)
            ? envelope + atkCoeff * (absSig - envelope)
            : envelope + relCoeff * (absSig - envelope);

        float threshLin = std::pow(10.0f, (threshNorm * -60.0f) / 20.0f);
        float ratio = 1.0f + biasNorm * 19.0f;

        float gainReduction = 1.0f;
        if (envelope > threshLin)
        {
            float envDB = 20.0f * std::log10(std::max(envelope, 1e-10f));
            float thDB = 20.0f * std::log10(std::max(threshLin, 1e-10f));
            float overDB = envDB - thDB;
            float reducedDB = overDB / ratio;
            float gainDB = reducedDB - overDB;
            gainReduction = std::pow(10.0f, gainDB / 20.0f);
        }

        float out = x * gainReduction;
        float outLin = std::pow(10.0f, (outGainNorm * 24.0f - 18.0f) / 20.0f);
        return out * outLin;
    }

    void FXSimpleComp::process(const float* inL, const float* inR,
                                float* outL, float* outR, int numSamples)
    {
        float bal = (biasBal - 0.5f) * 2.0f;

        for (int s = 0; s < numSamples; ++s)
        {
            float l = inL[s], r = inR[s];

            if (compMode == 1) // Stereo
            {
                float sum = (l + r) * 0.5f;
                float comped = applyComp(sum, envStereo, inGainL, threshL, biasL, outGainL);
                float panL = 1.0f - std::max(0.0f, bal) * 0.3f;
                float panR = 1.0f - std::max(0.0f, -bal) * 0.3f;
                outL[s] = l * panL + (comped - sum) * 0.5f;
                outR[s] = r * panR + (comped - sum) * 0.5f;
            }
            else if (compMode == 2) // Dual
            {
                outL[s] = applyComp(l, envL, inGainL, threshL, biasL, outGainL);
                outR[s] = applyComp(r, envR, inGainR, threshR, biasR, outGainR);
            }
            else if (compMode == 3) // M/S
            {
                float m = (l + r) * 0.5f;
                float s_ = (l - r) * 0.5f;
                float compM = applyComp(m, envMid, inGainL, threshL, biasL, outGainL);
                float compS = applyComp(s_, envSide, inGainR, threshR, biasR, outGainR);
                outL[s] = compM + compS;
                outR[s] = compM - compS;
            }
            else // OFF
            {
                outL[s] = l; outR[s] = r;
            }
        }
    }
}
