#pragma once
#include "Filter.h"

#if DEEP_TARGET_MODEL >= 2
#include "VAOnePoleFilter.h"

namespace ABD
{
    /**
     * KorgMS20VCF: Korg MS-20 Sallen-Key K35 filter (AbyssMind edition).
     *
     * Topology: 2 LP + 2 HP VAOnePoleFilter stages in series.
     * LP path: input → LP1 → LP2 → output (feedback from LP2 to LP1 input)
     * Feedback through diode clipper (tanh waveshaper) for analog saturation.
     * Resonance: k = 0.1 + 6.0 * resonance (0.1..6.1 range).
     *
     * Pole modes:
     *   0 = 4-pole LP (24dB/oct) — full LP path
     *   1 = 2-pole LP (12dB/oct) — LP1 only (cascaded HP stages bypassed)
     *
     * The Korg35 is a simplified MS-20 topology; we omit HP mode for v1
     * (user approved: LP only).
     */
    class KorgMS20VCF : public Filter
    {
    public:
        KorgMS20VCF();
        ~KorgMS20VCF() override = default;

        void prepare(double sampleRate) override;
        void setCutoff(float cutoffHz) override;
        void setResonance(float resonance) override;
        void setPoleMode(int mode);   // 0 = 4-pole (24dB), 1 = 2-pole (12dB)
        void setSubMode(int mode);    // 0 = K35 Lowpass, 1 = K35 Highpass

        float process(float sample) override;

    private:
        double sampleRate = 44100.0;
        float  cutoffHz  = 1000.0f;
        float  resonance  = 0.0f;
        int    poleMode   = 0;
        int    subMode    = 0;    // 0=K35 LP, 1=K35 HP

        VAOnePoleFilter lp1, lp2;   // LP cascade
        VAOnePoleFilter hp1, hp2;   // HP cascade (bypassed in v1 LP-only)

        void updateCoefficients();
    };
}

#endif // DEEP_TARGET_MODEL >= 2
