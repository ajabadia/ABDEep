#include "FXVocoder.h"

namespace ABD
{

void FXVocoder::process(const float* inL, const float* inR,
                          float* outL, float* outR,
                          int numSamples)
{
    float mix = paramMix;
    float attack = paramAttack;
    float release = paramRelease;
    float formantShift = paramFormantShift;
    bool useInternal = (paramModSrc > 0.5f);

    int numBands = 4 + static_cast<int>(paramBandCount * 28.0f);
    if (numBands > kMaxBands) numBands = kMaxBands;

    computeBandFrequencies(numBands);

    // Formant shift: offset center frequencies
    float formantFactor = std::pow(2.0f, (formantShift - 0.5f) * 2.0f);

    float nyq = static_cast<float>(sampleRate) * 0.5f;
    float q = static_cast<float>(numBands) * 0.5f;

    // Update filter coefficients for analysis and resynthesis banks
    for (int b = 0; b < numBands; ++b)
    {
        float freq = bandFreqs[b] * formantFactor;
        if (freq >= nyq) freq = nyq * 0.9f;
        if (freq < 1.0f) freq = 1.0f;

        updateBandpass(analysisBandsL[b], freq, q);
        updateBandpass(analysisBandsR[b], freq, q);
        updateResynthBand(resynthBandsL[b], freq, q);
        updateResynthBand(resynthBandsR[b], freq, q);

        if (useInternal)
            updateFormantResonator(formantBandsL[b], freq * 0.85f, q * 0.7f);
    }

    // Envelope follower coefficients
    float attackCoeff = std::exp(-1.0f / (static_cast<float>(sampleRate) * attack * 0.01f + 1.0f));
    float releaseCoeff = std::exp(-1.0f / (static_cast<float>(sampleRate) * release * 0.05f + 1.0f));

    float bandGain = 1.0f / static_cast<float>(numBands);

    // Biquad lambda for analysis bands
    auto processAnalysisBiquad = [](VocoderBand& band, float input) -> float
    {
        float y = band.b0 * input + band.b1 * band.x1 + band.b2 * band.x2
                - band.a1 * band.y1 - band.a2 * band.y2;
        band.x2 = band.x1;
        band.x1 = input;
        band.y2 = band.y1;
        band.y1 = y;
        return y;
    };

    // Biquad lambda for resynthesis bands
    auto processResynthBiquad = [](ResynthBand& band, float input) -> float
    {
        float y = band.b0 * input + band.b1 * band.x1 + band.b2 * band.x2
                - band.a1 * band.y1 - band.a2 * band.y2;
        band.x2 = band.x1;
        band.x1 = input;
        band.y2 = band.y1;
        band.y1 = y;
        return y;
    };

    // Biquad lambda for formant resonators
    auto processFormantBiquad = [](FormantResonator& res, float input) -> float
    {
        float y = res.b0 * input + res.b1 * res.x1 + res.b2 * res.x2
                - res.a1 * res.y1 - res.a2 * res.y2;
        res.x2 = res.x1;
        res.x1 = input;
        res.y2 = res.y1;
        res.y1 = y;
        return y;
    };

    for (int s = 0; s < numSamples; ++s)
    {
        float dryL = inL[s];
        float dryR = inR[s];

        // --- Get modulator signal ---
        float modL = 0.0f;
        float modR = 0.0f;

        if (useInternal)
        {
            // Internal: pink noise passed through formant resonators
            float noiseL = generatePinkNoise(noiseStateL);
            float noiseR = generatePinkNoise(noiseStateR);

            modL = 0.0f;
            modR = 0.0f;
            for (int b = 0; b < numBands; ++b)
            {
                modL += processFormantBiquad(formantBandsL[b], noiseL);
                modR += processFormantBiquad(formantBandsR[b], noiseR);
            }
            modL *= bandGain * 0.8f;
            modR *= bandGain * 0.8f;
        }
        else
        {
            // External: use sidechain/mic input
            if (extModL != nullptr && extModR != nullptr && s < extModSamples)
            {
                modL = extModL[s];
                modR = extModR[s];
            }
            else
            {
                // No external modulator available - pass through dry
                modL = dryL;
                modR = dryR;
            }
        }

        float wetL = 0.0f;
        float wetR = 0.0f;

        for (int b = 0; b < numBands; ++b)
        {
            // Analysis: extract envelope from modulator
            float filteredModL = processAnalysisBiquad(analysisBandsL[b], modL);
            float filteredModR = processAnalysisBiquad(analysisBandsR[b], modR);

            // Envelope follower
            float envL = std::abs(filteredModL);
            float envR = std::abs(filteredModR);

            float currentCoeffL = (envL > analysisBandsL[b].envelope) ? attackCoeff : releaseCoeff;
            analysisBandsL[b].envelope += currentCoeffL * (envL - analysisBandsL[b].envelope);
            float currentCoeffR = (envR > analysisBandsR[b].envelope) ? attackCoeff : releaseCoeff;
            analysisBandsR[b].envelope += currentCoeffR * (envR - analysisBandsR[b].envelope);

            // Resynthesis: apply envelope to carrier band
            float filteredCarrierL = processResynthBiquad(resynthBandsL[b], dryL);
            float filteredCarrierR = processResynthBiquad(resynthBandsR[b], dryR);

            wetL += filteredCarrierL * analysisBandsL[b].envelope * bandGain;
            wetR += filteredCarrierR * analysisBandsR[b].envelope * bandGain;
        }

        outL[s] = dryL + (wetL - dryL) * mix;
        outR[s] = dryR + (wetR - dryR) * mix;
    }

    // Clear modulator pointers after processing (they're set per-block)
    extModL = nullptr;
    extModR = nullptr;
    extModSamples = 0;
}

} // namespace ABD
