#include "FXTreemonster.h"
#include <cmath>
#include <algorithm>

namespace ABD
{

FXTreemonster::FXTreemonster()
{
    reset();
}

void FXTreemonster::prepare(double sr, int /*samplesPerBlock*/)
{
    sampleRate = std::max(1.0, sr);
    int bufSize = 1;
    while (bufSize < kMaxDelaySamples) bufSize *= 2;
    delayL.resize(bufSize, 0.0f);
    delayR.resize(bufSize, 0.0f);
    delayMask = bufSize - 1;
    reset();
}

void FXTreemonster::reset()
{
    std::fill(delayL.begin(), delayL.end(), 0.0f);
    std::fill(delayR.begin(), delayR.end(), 0.0f);
    writePos = 0.0f;
    detectorPhase = 0.0f;
    detectorFreq = 200.0f;
    detectorConfidence = 0.0f;
    prevSample = 0.0f;
    zeroCrossings = 0;
    windowSamples = 0.0f;
    lfoPhase = 0.0f;
}

float FXTreemonster::detectPitch(float sample)
{
    // Simple zero-crossing pitch detector with confidence tracking
    float diff = sample - prevSample;
    prevSample = sample;

    // Detect positive zero crossings
    if (diff > 0.0f && sample >= 0.0f && prevSample < 0.0f)
    {
        if (zeroCrossings > 0)
        {
            float period = windowSamples / (float)zeroCrossings;
            float freq = sampleRate / period;
            if (freq > 40.0f && freq < 4000.0f)
            {
                // Low-pass filter the frequency estimate
                float alpha = trackingParam * 0.3f;
                detectorFreq += alpha * (freq - detectorFreq);
                detectorConfidence = std::min(1.0f, detectorConfidence + 0.1f);
            }
        }
        zeroCrossings = 0;
        windowSamples = 0.0f;
    }

    zeroCrossings++;
    windowSamples += 1.0f;

    // Decay confidence when no stable pitch detected
    if (windowSamples > sampleRate * 0.05f) // 50ms window
    {
        detectorConfidence *= 0.95f;
        zeroCrossings = 0;
        windowSamples = 0.0f;
    }

    return detectorFreq;
}

void FXTreemonster::process(const float* inL, const float* inR,
                            float* outL, float* outR,
                            int numSamples)
{
    float baseDelay = 5.0f + speedParam * 100.0f; // 5-105ms base delay
    float depth = depthParam * baseDelay * 0.5f;
    float fbGain = feedbackParam * 0.7f;
    float lfoInc = (1.0f + speedParam * 5.0f) / (float)sampleRate;

    for (int s = 0; s < numSamples; ++s)
    {
        float xL = inL[s];
        float xR = inR[s];

        // Detect pitch from summed input
        float mono = (xL + xR) * 0.5f;
        float detectedFreq = detectPitch(mono);

        // Modulation: use pitch tracking when confident, LFO fallback
        float modPhase;
        if (detectorConfidence > 0.3f)
        {
            // Use pitch-derived modulation
            modPhase = detectorPhase;
            detectorPhase += detectedFreq / sampleRate;
            if (detectorPhase >= 1.0f) detectorPhase -= 1.0f;
        }
        else
        {
            // LFO fallback
            modPhase = lfoPhase;
            lfoPhase += lfoInc;
            if (lfoPhase >= 1.0f) lfoPhase -= 1.0f;
        }

        // Modulate delay tap
        float modAmount = std::sin(6.283185f * modPhase) * depth;
        float delayTime = baseDelay + modAmount;
        float delaySamples = delayTime * 0.001f * (float)sampleRate;

        // Write to delay buffer
        int wPos = (int)writePos & delayMask;
        delayL[wPos] = xL;
        delayR[wPos] = xR;

        // Read with fractional delay
        float readPos = writePos - delaySamples;
        if (readPos < 0.0f) readPos += (float)(delayMask + 1);
        int rIdx = (int)readPos & delayMask;
        int nextIdx = (rIdx + 1) & delayMask;
        float frac = readPos - (float)(int)readPos;

        float delayedL = delayL[rIdx] * (1.0f - frac) + delayL[nextIdx] * frac;
        float delayedR = delayR[rIdx] * (1.0f - frac) + delayR[nextIdx] * frac;

        // Apply feedback
        delayL[wPos] += delayedL * fbGain;
        delayR[wPos] += delayedR * fbGain;

        // Soft clip feedback
        delayL[wPos] = std::tanh(delayL[wPos]);
        delayR[wPos] = std::tanh(delayR[wPos]);

        writePos += 1.0f;
        if (writePos >= (float)(delayMask + 1))
            writePos -= (float)(delayMask + 1);

        outL[s] = xL * (1.0f - mix) + delayedL * mix;
        outR[s] = xR * (1.0f - mix) + delayedR * mix;
    }
}

void FXTreemonster::setParameter(int index, float value)
{
    switch (index)
    {
        case 0: speedParam = value; break;
        case 1: depthParam = value; break;
        case 2: feedbackParam = value; break;
        case 3: trackingParam = value; break;
        case 4: mix = value; break;
        default: break;
    }
}

} // namespace ABD
