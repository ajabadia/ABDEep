#pragma once
#include <cmath>
#include "JunoVCF_ZDF.h"
#include "JunoHPF.h"

namespace ABD
{
    /**
     * Interfaz base abstracta para los filtros del sintetizador.
     */
    class Filter
    {
    public:
        virtual ~Filter() = default;

        virtual void prepare(double sampleRate) = 0;
        virtual void setCutoff(float cutoffHz) = 0;
        virtual void setResonance(float resonance) = 0;

        virtual float process(float sample) = 0;
    };

    /**
     * VCF: TPT ZDF OTA Ladder Filter (JunoVCF_ZDF core).
     * 4-pole 24dB/oct or 2-pole 12dB/oct with analog-modeled
     * saturation and resonance.
     */
    class VCF : public Filter
    {
    public:
        VCF();
        ~VCF() override = default;

        void prepare(double sampleRate) override;
        void setCutoff(float cutoffHz) override;
        void setResonance(float resonance) override;
        void setPoleMode(int mode); // 0 = 4-Pole (24dB), 1 = 2-Pole (12dB)
        void setOversample(int factor); // 1x/2x/4x
        void setMode(JunoVCF_ZDF::Mode mode);

        float process(float sample) override;

    private:
        double sampleRate = 44100.0;
        float cutoff = 1000.0f;
        float resonance = 0.0f;
        int poleMode = 0; // 0 = 4-pole (default), 1 = 2-pole (stub)
        int mOversample = 1;

        JunoVCF_ZDF mFilter;

        // 2-pole output for poleMode==0
        float m2PoleState[2] = {};
        float m2PoleOutput = 0.0f;
    };

    /**
     * HPF: JunoHPF hybrid — J6 continuous HPF + J106 bass boost.
     * Two independent controls: HPF cutoff (38.6–1394.2 Hz) + bass boost gain.
     */
    class HPF : public Filter
    {
    public:
        HPF();
        ~HPF() override = default;

        void prepare(double sampleRate) override;
        void setCutoff(float cutoffHz) override;
        void setResonance(float resonance) override { (void)resonance; }
        void setBassBoostActive(bool active);
        void setBassBoostGain(float gain);

        float process(float sample) override;

    private:
        JunoHPF mHPF;
    };
}
