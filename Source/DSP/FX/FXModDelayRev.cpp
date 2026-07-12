#include "FXModDelayRev.h"
#include <cmath>
#include <algorithm>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

namespace ABD
{
    FXModDelayRev::FXModDelayRev() { reset(); }

    void FXModDelayRev::prepare(double sr, int)
    {
        sampleRate = std::max(1.0, sr);
        maxDelaySamples = (int)(sampleRate * 1.6);
        delayBufL.setSize(1, maxDelaySamples);
        delayBufR.setSize(1, maxDelaySamples);
        delayBufL.clear(); delayBufR.clear();
        writePosL = writePosR = 0;
        updateParams();
        // Reverb comb filters
        combDelay[0] = (int)(sampleRate * 0.0297);
        combDelay[1] = (int)(sampleRate * 0.0371);
        combDelay[2] = (int)(sampleRate * 0.0411);
        combDelay[3] = (int)(sampleRate * 0.0437);
        allpassDelay[0] = (int)(sampleRate * 0.005);
        allpassDelay[1] = (int)(sampleRate * 0.0017);
        allpassDelay[2] = (int)(sampleRate * 0.0037);
        combBufL.setSize(1, (int)(sampleRate * 0.05));
        combBufR.setSize(1, (int)(sampleRate * 0.05));
        combBufL.clear(); combBufR.clear();
        combPos = 0;
    }

    void FXModDelayRev::setParameter(int idx, float v)
    {
        v = std::clamp(v, 0.0f, 1.0f);
        switch (idx)
        {
            case 0: time_ = v; updateParams(); break;
            case 1: factor = (int)(v * 3.99f); updateParams(); break;
            case 2: feedback = v; break;
            case 3: feedHC = v; break;
            case 4: depth = v; break;
            case 5: speed = v; updateParams(); break;
            case 6: mode = (v > 0.5f) ? 1 : 0; break;
            case 7: rType = (int)(v * 2.99f); break;
            case 8: decay = v; break;
            case 9: damping = v; break;
            case 10: balance = v; break;
            case 11: mix = v; break;
        }
    }

    void FXModDelayRev::reset()
    {
        delayBufL.clear(); delayBufR.clear();
        combBufL.clear(); combBufR.clear();
        writePosL = writePosR = combPos = 0;
        combStateL[0] = combStateL[1] = combStateL[2] = combStateL[3] = 0.0f;
        combStateR[0] = combStateR[1] = combStateR[2] = combStateR[3] = 0.0f;
        apStateL[0] = apStateL[1] = apStateL[2] = 0.0f;
        apStateR[0] = apStateR[1] = apStateR[2] = 0.0f;
        lfoPhase = 0.0;
        lpfL = lpfR = 0.0f;
    }

    void FXModDelayRev::updateParams()
    {
        float baseMs = 1.0f + 1499.0f * time_;
        float factorTab[4] = { 1.0f, 0.5f, 0.667f, 1.5f };
        delaySamples = (int)(sampleRate * baseMs / 1000.0 * factorTab[factor]);
        delaySamples = std::max(1, std::min(delaySamples, maxDelaySamples - 1));
        float freqHz = 0.05f + 9.95f * speed;
        lfoInc = freqHz / sampleRate;
        float hcHz = 200.0f + 19800.0f * feedHC;
        hcCoeff = (float)(hcHz / (hcHz + sampleRate * 0.5));
        // Damping: 1000-20000Hz
        float dampHz = 1000.0f + 19000.0f * damping;
        dampCoeff = (float)(dampHz / (dampHz + sampleRate * 0.5));
    }

    void FXModDelayRev::process(const float* inL, const float* inR,
                                 float* outL, float* outR, int numSamples)
    {
        float* dBufL = delayBufL.getWritePointer(0);
        float* dBufR = delayBufR.getWritePointer(0);
        float* cBufL = combBufL.getWritePointer(0);
        float* cBufR = combBufR.getWritePointer(0);
        float bal = (balance - 0.5f) * 2.0f;

        for (int s = 0; s < numSamples; ++s)
        {
            float dryL = inL[s], dryR = inR[s];
            float delayOutL = 0.0f, delayOutR = 0.0f;

            // --- Modulated delay ---
            lfoPhase += lfoInc;
            if (lfoPhase >= 1.0) lfoPhase -= 1.0;
            float mod = (float)std::sin(2.0 * M_PI * lfoPhase) * depth * 0.2f;
            float delaySamp = (float)delaySamples * (1.0f + mod);

            int readPosL = writePosL - (int)delaySamp;
            if (readPosL < 0) readPosL += maxDelaySamples;
            float dL = dBufL[readPosL];
            int readPosR = writePosR - (int)delaySamp;
            if (readPosR < 0) readPosR += maxDelaySamples;
            float dR = dBufR[readPosR];

            // High cut en feedback
            lpfL += hcCoeff * (dL - lpfL);
            lpfR += hcCoeff * (dR - lpfR);

            dBufL[writePosL] = dryL + lpfL * feedback * 0.95f;
            dBufR[writePosR] = dryR + lpfR * feedback * 0.95f;
            writePosL = (writePosL + 1) % maxDelaySamples;
            writePosR = (writePosR + 1) % maxDelaySamples;

            delayOutL = dL; delayOutR = dR;

            // --- Reverb (Schroeder simplificado) ---
            float revInL = dryL + dL * std::max(0.0f, bal);
            float revInR = dryR + dR * std::max(0.0f, -bal);
            float decayGain = 0.3f + decay * 0.6f;

            // Comb filters
            for (int i = 0; i < 4; ++i)
            {
                int combRead = combPos - combDelay[i];
                if (combRead < 0) combRead += (int)(sampleRate * 0.05);
                float cL = cBufL[combRead];
                float cR = cBufR[combRead];
                cBufL[combPos] = revInL + cL * decayGain * dampCoeff;
                cBufR[combPos] = revInR + cR * decayGain * dampCoeff;
                combStateL[i] = cL; combStateR[i] = cR;
            }
            combPos = (combPos + 1) % (int)(sampleRate * 0.05);

            // Allpass filters
            float revL = (combStateL[0] + combStateL[1] + combStateL[2] + combStateL[3]) * 0.25f;
            float revR = (combStateR[0] + combStateR[1] + combStateR[2] + combStateR[3]) * 0.25f;
            float apGain = 0.5f;
            for (int i = 0; i < 3; ++i)
            {
                float apL = revL + apGain * apStateL[i];
                apStateL[i] = revL - apGain * apL;
                revL = apL;
                float apR = revR + apGain * apStateR[i];
                apStateR[i] = revR - apGain * apR;
                revR = apR;
            }

            // Balance delay/reverb
            float mixDelay = delayOutL * (1.0f - std::abs(bal)) * mix;
            float mixRev = revL * 0.3f * mix;
            wetL = mixDelay + mixRev;
            wetR = mixDelay + mixRev; // mono reverb

            // Mix con dry
            outL[s] = dryL * (1.0f - mix) + wetL * mix;
            outR[s] = dryR * (1.0f - mix) + wetR * mix;
        }
    }
}
