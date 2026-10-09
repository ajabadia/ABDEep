#include "FXFDNReverb.h"

namespace ABD
{
    FXFDNReverb::FXFDNReverb()
    {
        reset();
    }

    void FXFDNReverb::prepare(double sr, int /*samplesPerBlock*/)
    {
        engine_.prepare(sr);
    }

    void FXFDNReverb::setParameter(int index, float value)
    {
        engine_.setParameter(index, value);
    }

    void FXFDNReverb::reset()
    {
        engine_.reset();
    }

    void FXFDNReverb::process(const float* inL, const float* inR,
                              float* outL, float* outR,
                              int numSamples)
    {
        engine_.process(inL, inR, outL, outR, numSamples);
    }
}
