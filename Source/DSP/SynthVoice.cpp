#include "SynthVoice.h"
#include "DSPHelpers.h"
#include <cmath>
#if DEEP_TARGET_MODEL >= 2
#include "../Core/CalibrationSpec.h"
#endif

namespace ABD
{
    SynthVoice::SynthVoice()
    {
        std::fill(std::begin(modSources), std::end(modSources), 0.0f);
    }

    void SynthVoice::prepare(double newSampleRate)
    {
        sampleRate = newSampleRate;
        invSampleRate = (sampleRate > 0.0) ? (1.0 / sampleRate) : 0.0;
        cutoffSmoothCoeff = DSP::slewCoeffFromTimeConstant(kSmoothTauSec, sampleRate);
        ampSmoothCoeff = DSP::slewCoeffFromTimeConstant(kSmoothTauSec, sampleRate);
        osc1.prepare(sampleRate);
        osc2.prepare(sampleRate);
        vcf.prepare(sampleRate);
#if DEEP_TARGET_MODEL >= 2
        moogVcf.prepare(sampleRate);
        korgVcf.prepare(sampleRate);
#endif
        env1VCA.setSampleRate(sampleRate);        env2VCF.setSampleRate(sampleRate);
        env3MOD.setSampleRate(sampleRate);
        lfo1.setSampleRate(sampleRate);
        lfo2.setSampleRate(sampleRate);
        drift.setSampleRate(sampleRate);
    }

    void SynthVoice::setExternalModulation(ModSource source, float value)
    {
        int idx = (int)source;
        if (idx >= 0 && idx < (int)ModSource::kMaxSources)
        {
            modSources[idx] = value;
        }
    }
}
