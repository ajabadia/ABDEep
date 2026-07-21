#include "Filter.h"
#include <cmath>
#include <algorithm>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

namespace ABD
{
    // ==========================================
    // VCF — JunoVCF_ZDF backed (TPT ZDF OTA Ladder)
    // ==========================================

    VCF::VCF()
    {
        // JunoVCF_ZDF already defaults to DeepMind in its constructor.
        // No override needed — single source of truth.
    }

    void VCF::prepare(double newSampleRate)
    {
        sampleRate = std::max(1.0, newSampleRate);
        mFilter.prepare(sampleRate);
        m2PoleState[0] = m2PoleState[1] = 0.0f;
        m2PoleOutput = 0.0f;
    }

    void VCF::setCutoff(float cutoffHz)
    {
        cutoff = std::clamp(cutoffHz, 10.0f, static_cast<float>(sampleRate * 0.49));
    }

    void VCF::setResonance(float res)
    {
        resonance = std::clamp(res, 0.0f, 1.0f);
    }

    void VCF::setPoleMode(int mode)
    {
        int newMode = std::clamp(mode, 0, 1);
        if (newMode != poleMode)
        {
            poleMode = newMode;
            mFilter.setPoleMode(newMode == 0 ? JunoVCF_ZDF::PoleMode::FourPole
                                              : JunoVCF_ZDF::PoleMode::TwoPole);
            if (poleMode == 0)
            {
                // Switching to 4-pole: clear 2-pole state
                m2PoleState[0] = m2PoleState[1] = 0.0f;
                m2PoleOutput = 0.0f;
            }
        }
    }

    void VCF::setOversample(int factor)
    {
        int clamped = (factor <= 1) ? 1 : (factor == 2) ? 2 : 4;
        if (clamped != mOversample)
        {
            mOversample = clamped;
            mFilter.setOversample(mOversample);
        }
    }

    void VCF::setMode(JunoVCF_ZDF::Mode mode)
    {
        mFilter.setMode(mode);
    }

    float VCF::process(float sample)
    {
        // frq = cutoffHz / Nyquist — the ZDF core expects this
        float frq = cutoff / static_cast<float>(sampleRate * 0.5f);
        frq = std::clamp(frq, 0.0001f, 0.85f);

        return mFilter.process(sample, frq, resonance);
    }

    // ==========================================
    // HPF — JunoHPF hybrid (J6 continuous + J106 bass boost)
    // ==========================================

    HPF::HPF()
    {
    }

    void HPF::prepare(double newSampleRate)
    {
        mHPF.prepare(newSampleRate);
    }

    void HPF::setCutoff(float cutoffHz)
    {
        mHPF.setCutoff(cutoffHz);
    }

    void HPF::setBassBoostActive(bool active)
    {
        mHPF.setBassBoostActive(active);
    }

    void HPF::setBassBoostGain(float gain)
    {
        mHPF.setBassBoostGain(gain);
    }

    float HPF::process(float sample)
    {
        return mHPF.process(sample);
    }
}
