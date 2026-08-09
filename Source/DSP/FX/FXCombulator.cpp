#include "FXCombulator.h"

namespace ABD
{

FXCombulator::FXCombulator()
{
    reset();
}

void FXCombulator::prepare(double sr, int /*samplesPerBlock*/)
{
    sampleRate = sr;
    delayBufL.resize(kMaxDelay, 0.0f);
    delayBufR.resize(kMaxDelay, 0.0f);
    reset();
}

void FXCombulator::reset()
{
    writePosL = 0;
    writePosR = 0;
    lpfStateL = 0.0f;
    lpfStateR = 0.0f;
    noiseSeed = 0xDEADBEEFu;
    if (!delayBufL.empty())
    {
        std::fill(delayBufL.begin(), delayBufL.end(), 0.0f);
        std::fill(delayBufR.begin(), delayBufR.end(), 0.0f);
    }
}

float FXCombulator::noiseGenerate()
{
    noiseSeed = noiseSeed * 1664525u + 1013904223u;
    return static_cast<float>(noiseSeed & 0xFFFF) / 65535.0f * 2.0f - 1.0f;
}

void FXCombulator::process(const float* inL, const float* inR,
                             float* outL, float* outR,
                             int numSamples)
{
    float mix = paramMix;
    float feedback = paramFeedback;
    float damping = paramDamping;

    // Delay times in samples
    float delaySamplesL = paramDelayL * 49.0f + 1.0f;  // 1-50ms range
    float delaySamplesR = paramDelayR * 49.0f + 1.0f;
    delaySamplesL *= static_cast<float>(sampleRate) * 0.001f;
    delaySamplesR *= static_cast<float>(sampleRate) * 0.001f;

    // Damping coefficient (one-pole lowpass)
    // Higher damping = more high-frequency loss in feedback
    float dampingCoeff = 1.0f - damping * 0.95f;

    for (int i = 0; i < numSamples; ++i)
    {
        float dryL = inL[i];
        float dryR = inR[i];

        // Read from delay lines
        int readPosL = (writePosL - static_cast<int>(delaySamplesL) + kMaxDelay * 2) % kMaxDelay;
        int readPosR = (writePosR - static_cast<int>(delaySamplesR) + kMaxDelay * 2) % kMaxDelay;

        float delayedL = delayBufL[readPosL];
        float delayedR = delayBufR[readPosR];

        // Apply one-pole lowpass damping
        lpfStateL += dampingCoeff * (delayedL - lpfStateL);
        lpfStateR += dampingCoeff * (delayedR - lpfStateR);

        // Cross-feedback: L feeds R, R feeds L
        float fbL = lpfStateL + lpfStateR * 0.3f;  // 30% cross
        float fbR = lpfStateR + lpfStateL * 0.3f;

        // Write new samples into delay lines
        delayBufL[writePosL] = dryL + fbL * feedback;
        delayBufR[writePosR] = dryR + fbR * feedback;

        // Soft clip
        delayBufL[writePosL] = std::tanh(delayBufL[writePosL]);
        delayBufR[writePosR] = std::tanh(delayBufR[writePosR]);

        // Output: dry + wet * feedback (self-oscillation at high feedback)
        outL[i] = dryL + fbL * mix;
        outR[i] = dryR + fbR * mix;

        writePosL = (writePosL + 1) % kMaxDelay;
        writePosR = (writePosR + 1) % kMaxDelay;
    }
}

void FXCombulator::setParameter(int index, float value)
{
    switch (index)
    {
        case 0: paramMix = value; break;
        case 1: paramDelayL = value; break;
        case 2: paramDelayR = value; break;
        case 3: paramFeedback = value; break;
        case 4: paramDamping = value; break;
        default: break;
    }
}

} // namespace ABD
