#include "FXNoiseGate.h"
#include <cmath>
#include <algorithm>

namespace ABD
{
    FXNoiseGate::FXNoiseGate() { reset(); }

    void FXNoiseGate::prepare(double sr, int)
    {
        sampleRate = std::max(1.0, sr);
        updateTimeCoeffs();
    }

    void FXNoiseGate::setParameter(int idx, float v)
    {
        v = std::clamp(v, 0.0f, 1.0f);
        switch (idx)
        {
            case 0: threshold = v; break;
            case 1: range = v; break;
            case 2: attackMs = 0.5f + 19.5f * v; updateTimeCoeffs(); break;
            case 3: releaseMs = 2.0f + 1998.0f * v; updateTimeCoeffs(); break;
            case 4: holdMs = 2.0f + 1998.0f * v; updateTimeCoeffs(); break;
            case 5: punch = v; break;
            case 6: gateMode = (int)(v * 2.99f); break;
            case 7: power = (v < 0.5f); break;
        }
    }

    void FXNoiseGate::reset()
    {
        envL = envR = 0.0f;
        gainL = gainR = 1.0f;
        holdTimerL = holdTimerR = 0.0f;
    }

    void FXNoiseGate::updateTimeCoeffs()
    {
        atkCoeff = 1.0f - std::exp(-1.0f / (sampleRate * attackMs / 1000.0f));
        relCoeff = 1.0f - std::exp(-1.0f / (sampleRate * releaseMs / 1000.0f));
        holdSamples = (float)(sampleRate * holdMs / 1000.0f);
    }

    void FXNoiseGate::process(const float* inL, const float* inR,
                               float* outL, float* outR, int numSamples)
    {
        if (!power) {
            for (int s = 0; s < numSamples; ++s) { outL[s] = inL[s]; outR[s] = inR[s]; }
            return;
        }

        float threshLin = std::pow(10.0f, (threshold * -50.0f) / 20.0f);
        float rangeLin = std::pow(10.0f, (range * -100.0f) / 20.0f);
        float punchGain = std::pow(10.0f, (punch * 12.0f - 6.0f) / 20.0f);

        for (int s = 0; s < numSamples; ++s)
        {
            float l = inL[s], r = inR[s];
            float absL = std::abs(l), absR = std::abs(r);

            // Envelope followers
            auto updateEnv = [&](float& env, float absIn) {
                env = (absIn > env) ? env + atkCoeff * (absIn - env)
                                    : env + relCoeff * (absIn - env);
            };
            updateEnv(envL, absL);
            updateEnv(envR, absR);

            // Gate: gain reduction por canal
            for (int ch = 0; ch < 2; ++ch)
            {
                float& env = (ch == 0) ? envL : envR;
                float& gain = (ch == 0) ? gainL : gainR;
                float& timer = (ch == 0) ? holdTimerL : holdTimerR;

                if (env > threshLin)
                {
                    // Open gate
                    float atkSmooth = 1.0f - std::exp(-1.0f / (sampleRate * attackMs / 1000.0f));
                    gain += atkSmooth * (1.0f - gain);
                    timer = holdSamples;
                }
                else
                {
                    if (timer > 0)
                    {
                        timer -= 1.0f; // Hold period
                    }
                    else
                    {
                        // Close gate: fade a rangeLin
                        float relSmooth = 1.0f - std::exp(-1.0f / (sampleRate * releaseMs / 1000.0f));
                        float target = rangeLin;
                        gain += relSmooth * (target - gain);
                    }
                }
            }

            // Apply + Punch (transient boost) - simula transient gate
            float outL_s = l * gainL;
            float outR_s = r * gainR;

            if (gateMode == 1) // Transient: boost attack
            {
                float transientL = std::max(0.0f, absL - envL) * punchGain;
                float transientR = std::max(0.0f, absR - envR) * punchGain;
                outL_s += (l > 0 ? transientL : -transientL) * 0.5f;
                outR_s += (r > 0 ? transientR : -transientR) * 0.5f;
            }
            else if (gateMode == 2) // Ducker: invertir gate
            {
                float duckGainL = 1.0f - gainL * (1.0f - rangeLin);
                outL_s = l * duckGainL;
                float duckGainR = 1.0f - gainR * (1.0f - rangeLin);
                outR_s = r * duckGainR;
            }

            outL[s] = outL_s;
            outR[s] = outR_s;
        }
    }
}
