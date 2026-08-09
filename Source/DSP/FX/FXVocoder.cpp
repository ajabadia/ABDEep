#include "FXVocoder.h"

namespace ABD
{

FXVocoder::FXVocoder()
{
    reset();
}

void FXVocoder::prepare(double sr, int /*samplesPerBlock*/)
{
    sampleRate = sr;
    reset();
}

void FXVocoder::reset()
{
    std::fill(bandFreqs, bandFreqs + kMaxBands, 0.0f);
    for (int i = 0; i < kMaxBands; ++i)
    {
        analysisBandsL[i] = VocoderBand();
        analysisBandsR[i] = VocoderBand();
        resynthBandsL[i] = ResynthBand();
        resynthBandsR[i] = ResynthBand();
        formantBandsL[i] = FormantResonator();
        formantBandsR[i] = FormantResonator();
    }
    noiseStateL = 0.0f;
    noiseStateR = 0.0f;
    noiseSeed = 12345;
    extModL = nullptr;
    extModR = nullptr;
    extModSamples = 0;
}

void FXVocoder::setModulatorInput(const float* modL, const float* modR, int numSamples)
{
    extModL = modL;
    extModR = modR;
    extModSamples = numSamples;
}

void FXVocoder::setParameter(int index, float value)
{
    switch (index)
    {
        case 0: paramMix = value; break;
        case 1: paramBandCount = value; break;
        case 2: paramAttack = value; break;
        case 3: paramRelease = value; break;
        case 4: paramFormantShift = value; break;
        case 5: paramModSrc = value; break;
        default: break;
    }
}

} // namespace ABD
