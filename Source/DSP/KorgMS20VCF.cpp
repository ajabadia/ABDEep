#include "KorgMS20VCF.h"

#if DEEP_TARGET_MODEL >= 2
#include <cmath>
#include <algorithm>

namespace ABD
{
    KorgMS20VCF::KorgMS20VCF()
    {
    }

    void KorgMS20VCF::prepare(double newSampleRate)
    {
        sampleRate = std::max(1.0, newSampleRate);
        lp1.reset(); lp2.reset();
        hp1.reset(); hp2.reset();
        updateCoefficients();
    }

    void KorgMS20VCF::setCutoff(float hz)
    {
        float clamped = std::clamp(hz, 10.0f, (float)(sampleRate * 0.49));
        if (std::abs(clamped - cutoffHz) > 0.01f)
        {
            cutoffHz = clamped;
            updateCoefficients();
        }
    }

    void KorgMS20VCF::setResonance(float res)
    {
        float clamped = std::clamp(res, 0.0f, 1.0f);
        if (std::abs(clamped - resonance) > 0.001f)
        {
            resonance = clamped;
            updateCoefficients();
        }
    }

    void KorgMS20VCF::setPoleMode(int mode)
    {
        poleMode = std::clamp(mode, 0, 1);
    }

    void KorgMS20VCF::setSubMode(int mode)
    {
        subMode = std::clamp(mode, 0, 1);
    }

    void KorgMS20VCF::updateCoefficients()
    {
        // Set LP stages to same cutoff
        lp1.setCutoff(cutoffHz, sampleRate);
        lp2.setCutoff(cutoffHz, sampleRate);

        // HP stages: we use 2x cutoff for the HP stages (MS-20 convention)
        // This gives a brighter, more aggressive character when HP is active.
        // In v1 LP-only mode these are not used, but kept for future HP support.
        float hpCutoff = std::min(cutoffHz * 2.0f, (float)(sampleRate * 0.48));
        hp1.setCutoff(hpCutoff, sampleRate);
        hp2.setCutoff(hpCutoff, sampleRate);

        // Resonance feedback: k = 0.1 + 6.0 * res
        // Range: 0.1 (min) to 6.1 (max self-oscillation)
        double k = 0.1 + 6.0 * (double)resonance;

        // Feedback from LP2 output → LP1 input, via diode clipper (tanh)
        // The feedback amount includes k; we pass k to the LP1 stage
        // and let it compute feedback from LP2.getLP()
        lp1.setFeedback(k);
        lp2.setFeedback(0.0);   // LP2 receives from LP1, no self-feedback
        hp1.setFeedback(0.0);
        hp2.setFeedback(0.0);
    }

    float KorgMS20VCF::process(float sample)
    {
        double k = 0.1 + 6.0 * (double)resonance;

        if (subMode == 1)
        {
            // K35 Highpass mode: input → HP1 → HP2 → output
            // Feedback from hp2 output through diode clipper (tanh waveshaper)
            double hpFeedback = std::tanh((double)hp2.getLP() * k);

            // Sallen-Key HP: input + feedback into first HP stage
            double xHP = (double)sample + hpFeedback;

            float hpOut1 = hp1.process((float)xHP);
            float hpOut2 = hp2.process(hpOut1);

            if (poleMode == 1)
                return hpOut1;   // 2-pole HP (12dB/oct)
            else
                return hpOut2;   // 4-pole HP (24dB/oct)
        }
        else
        {
            // K35 Lowpass mode (standard): input → LP1 → LP2 → output
            // Feedback from LP2 output through diode clipper (tanh waveshaper)
            double feedbackSignal = std::tanh((double)lp2.getLP() * k);

            // Sallen-Key LP: input + feedback into first stage
            double x = (double)sample + feedbackSignal;

            float lpOut1 = lp1.process((float)x);
            float lpOut2 = lp2.process(lpOut1);

            if (poleMode == 1)
                return lpOut1;   // 2-pole LP (12dB/oct)
            else
                return lpOut2;   // 4-pole LP (24dB/oct)
        }
    }
}

#endif // DEEP_TARGET_MODEL >= 2
