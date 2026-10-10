#pragma once
#include "Filter.h"

#if DEEP_TARGET_MODEL >= 2
#include "DspCore/DspKorgMS20.h"

namespace ABD
{
    /**
     * KorgMS20VCF: Thin shim delegating to canonical abd::dsp::KorgMS20VCF
     * while implementing ABDEep's polymorphic Filter interface.
     */
    class KorgMS20VCF : public Filter
    {
    public:
        KorgMS20VCF() = default;
        ~KorgMS20VCF() override = default;

        void prepare(double sampleRate) override { mFilter.prepare(sampleRate); }
        void setCutoff(float cutoffHz) override  { mFilter.setCutoff(cutoffHz); }
        void setResonance(float resonance) override { mFilter.setResonance(resonance); }
        void setPoleMode(int mode) { mFilter.setPoleMode(mode); }
        void setSubMode(int mode)  { mFilter.setSubMode(mode); }

        float process(float sample) override { return mFilter.process(sample); }

        float getCutoff() const noexcept    { return mFilter.getCutoff(); }
        float getResonance() const noexcept { return mFilter.getResonance(); }
        int getPoleMode() const noexcept    { return mFilter.getPoleMode(); }
        int getSubMode() const noexcept     { return mFilter.getSubMode(); }

    private:
        abd::dsp::KorgMS20VCF mFilter;
    };
}

#endif // DEEP_TARGET_MODEL >= 2
