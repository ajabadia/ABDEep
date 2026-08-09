#include "FXVocoder.h"

namespace ABD
{

void FXVocoder::computeBandFrequencies(int numBands)
{
    // Logarithmically spaced bands from 100 Hz to Nyquist/2
    float minFreq = 100.0f;
    float maxFreq = static_cast<float>(sampleRate) * 0.45f;
    for (int i = 0; i < numBands; ++i)
    {
        float t = static_cast<float>(i) / static_cast<float>(numBands - 1);
        bandFreqs[i] = minFreq * std::pow(maxFreq / minFreq, t);
    }
}

void FXVocoder::updateBandpass(VocoderBand& band, float freq, float q)
{
    float nyq = static_cast<float>(sampleRate) * 0.5f;
    if (freq >= nyq) freq = nyq * 0.9f;
    if (freq < 1.0f) freq = 1.0f;

    float w0 = 6.283185f * freq / static_cast<float>(sampleRate);
    float alpha = std::sin(w0) / (2.0f * q);
    float cosw0 = std::cos(w0);
    float a0 = 1.0f + alpha;

    band.b0 = alpha / a0;
    band.b1 = 0.0f;
    band.b2 = -alpha / a0;
    band.a1 = -2.0f * cosw0 / a0;
    band.a2 = (1.0f - alpha) / a0;
    band.centerFreq = freq;
}

void FXVocoder::updateFormantResonator(FormantResonator& res, float freq, float q)
{
    float nyq = static_cast<float>(sampleRate) * 0.5f;
    if (freq >= nyq) freq = nyq * 0.9f;
    if (freq < 1.0f) freq = 1.0f;

    float w0 = 6.283185f * freq / static_cast<float>(sampleRate);
    float alpha = std::sin(w0) / (2.0f * q);
    float cosw0 = std::cos(w0);
    float a0 = 1.0f + alpha;

    // Bandpass resonator
    res.b0 = alpha / a0;
    res.b1 = 0.0f;
    res.b2 = -alpha / a0;
    res.a1 = -2.0f * cosw0 / a0;
    res.a2 = (1.0f - alpha) / a0;
}

void FXVocoder::updateResynthBand(ResynthBand& band, float freq, float q)
{
    float nyq = static_cast<float>(sampleRate) * 0.5f;
    if (freq >= nyq) freq = nyq * 0.9f;
    if (freq < 1.0f) freq = 1.0f;

    float w0 = 6.283185f * freq / static_cast<float>(sampleRate);
    float alpha = std::sin(w0) / (2.0f * q);
    float cosw0 = std::cos(w0);
    float a0 = 1.0f + alpha;

    band.b0 = alpha / a0;
    band.b1 = 0.0f;
    band.b2 = -alpha / a0;
    band.a1 = -2.0f * cosw0 / a0;
    band.a2 = (1.0f - alpha) / a0;
}

float FXVocoder::generatePinkNoise(float& state)
{
    // Voss-McCartney pink noise: sum of octaves with different update rates
    // Simple and efficient approximation
    noiseSeed = noiseSeed * 1103515245u + 12345u;
    float white = (static_cast<float>(noiseSeed & 0x7FFFFFFF) / 1073741823.5f) - 1.0f;

    // Leak integrator for pink-like spectrum (tilt ~ -3dB/oct)
    state = state * 0.99765f + white * 0.0412156f;
    return state * 2.0f;
}

} // namespace ABD
