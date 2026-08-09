#include "MoogLadderVCF.h"

#if DEEP_TARGET_MODEL >= 2
#include <cmath>
#include <algorithm>

namespace ABD
{
    MoogLadderVCF::MoogLadderVCF()
    {
    }

    void MoogLadderVCF::prepare(double newSampleRate)
    {
        sampleRate = std::max(1.0, newSampleRate);
        for (auto& s : stages)
            s.reset();
        updateCoefficients();
    }

    void MoogLadderVCF::setCutoff(float hz)
    {
        float clamped = std::clamp(hz, 10.0f, (float)(sampleRate * 0.49));
        if (std::abs(clamped - cutoffHz) > 0.01f)
        {
            cutoffHz = clamped;
            updateCoefficients();
        }
    }

    void MoogLadderVCF::setResonance(float res)
    {
        float clamped = std::clamp(res, 0.0f, 1.0f);
        if (std::abs(clamped - resonance) > 0.001f)
        {
            resonance = clamped;
            updateCoefficients();
        }
    }

    void MoogLadderVCF::setPoleMode(int mode)
    {
        poleMode = std::clamp(mode, 0, 1);
    }

    void MoogLadderVCF::setSubMode(int mode)
    {
        subMode = std::clamp(mode, 0, 2);
    }

    void MoogLadderVCF::updateCoefficients()
    {
        // BZT prewarp: g = tan(pi * fc / fs)
        double fc = std::clamp((double)cutoffHz, 10.0, sampleRate * 0.49);
        double g  = std::tan(M_PI * fc / sampleRate);

        // Each stage: alpha = g / (1 + g)
        double alpha = g / (1.0 + g);

        for (auto& s : stages)
            s.setCutoff(cutoffHz, sampleRate);

        // Resonance feedback gain: k = 3.88 * res (scaled for musical range)
        // High resonance: compensate input gain to prevent volume boost
        double k = 3.88 * (double)resonance;
        double inputGain = 1.0 / (1.0 + k);  // normalize at high resonance

        // Set feedback on all stages: feedback = k * inputGain (from last stage output)
        double fb = k * inputGain;
        for (auto& s : stages)
            s.setFeedback(fb);
    }

    float MoogLadderVCF::process(float sample)
    {
        // Resonance feedback gain and input normalization
        double k = 3.88 * (double)resonance;
        double inputGain = 1.0 / (1.0 + k);

        // Input: soft-clip via tanh to prevent runaway (analog transistor saturation)
        double x = std::tanh((double)sample);

        // Feedback: last stage output (pre-computed from previous sample)
        // We use stage[3].getLP() as the feedback tap
        double fb = k * inputGain * (double)stages[3].getLP();

        // Input stage: alpha_0 * (input + feedback)
        double in = inputGain * (x + fb);

        // Cascade through 4 LP stages
        float lp1 = stages[0].process((float)in);
        float lp2 = stages[1].process(lp1);
        float lp3 = stages[2].process(lp2);
        float lp4 = stages[3].process(lp3);

        // Select output based on sub-mode (LP / BP / HP)
        float lpOut = (poleMode == 1) ? lp2 : lp4;  // 2-pole vs 4-pole

        switch (subMode)
        {
            case 1:  // Bandpass: stage2 LP − stage4 LP (mid-band emphasis)
                return lp2 - lp4;
            case 2:  // Highpass: input − 4-pole LP (subtractive)
                return (float)((float)sample - lp4);
            default: // Lowpass (standard ladder output)
                return lpOut;
        }
    }
}

#endif // DEEP_TARGET_MODEL >= 2
