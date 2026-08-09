#pragma once
#include "Filter.h"

#if DEEP_TARGET_MODEL >= 2
#include "VAOnePoleFilter.h"

namespace ABD
{
    /**
     * MoogLadderVCF: 4-pole transistor ladder filter (AbyssMind edition).
     *
     * Topology: 4 cascaded VAOnePoleFilter LP stages.
     * Input: alpha_0 * (input + k * feedback)
     * Feedback: last LP output
     * Resonance: k = 3.88 * resonance (0..3.88 range)
     * Compensation: 1/(1+k) at high resonance to prevent volume boost
     *
     * Pole modes:
     *   0 = 4-pole (24dB/oct) — output from stage 4
     *   1 = 2-pole (12dB/oct) — output from stage 2
     *
     * Derivative clipping: input is soft-clipped via std::tanh() to prevent
     * runaway at high resonance (analog-modeled transistor saturation).
     */
    class MoogLadderVCF : public Filter
    {
    public:
        MoogLadderVCF();
        ~MoogLadderVCF() override = default;

        void prepare(double sampleRate) override;
        void setCutoff(float cutoffHz) override;
        void setResonance(float resonance) override;
        void setPoleMode(int mode);   // 0 = 4-pole, 1 = 2-pole
        void setSubMode(int mode);    // 0 = LP, 1 = BP, 2 = HP

        float process(float sample) override;

    private:
        double sampleRate = 44100.0;
        float  cutoffHz  = 1000.0f;
        float  resonance  = 0.0f;
        int    poleMode   = 0;    // 0=4-pole (24dB), 1=2-pole (12dB)
        int    subMode    = 0;    // 0=LP, 1=BP, 2=HP

        VAOnePoleFilter stages[4]; // 4 cascaded LP stages

        void updateCoefficients();
    };
}

#endif // DEEP_TARGET_MODEL >= 2
