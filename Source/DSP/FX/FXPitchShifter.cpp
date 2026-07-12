#include "FXPitchShifter.h"
#include <cmath>
#include <algorithm>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

namespace ABD
{
    FXPitchShifter::FXPitchShifter(bool vintageMode) : vintage(vintageMode) { reset(); }

    void FXPitchShifter::prepare(double sr, int)
    {
        sampleRate = std::max(1.0, sr);
        maxDelaySamples = (int)(sampleRate * 0.5); // 500ms
        bufL.setSize(1, maxDelaySamples);
        bufR.setSize(1, maxDelaySamples);
        bufL.clear(); bufR.clear();
        writePosL = writePosR = 0;
        updateGrainParams();
    }

    void FXPitchShifter::setParameter(int idx, float v)
    {
        v = std::clamp(v, 0.0f, 1.0f);
        switch (idx)
        {
            case 0: semi1 = v; updateGrainParams(); break;
            case 1: cent1 = v; updateGrainParams(); break;
            case 2: delay1 = v; break;
            case 3: gain1 = v; break;
            case 4: pan1 = v; break;
            case 5: mix = v; break;
            case 6: semi2 = v; updateGrainParams(); break;
            case 7: cent2 = v; updateGrainParams(); break;
            case 8: delay2 = v; break;
            case 9: gain2 = v; break;
            case 10: pan2 = v; break;
            case 11: hiCut = v; break;
        }
    }

    void FXPitchShifter::reset()
    {
        bufL.clear(); bufR.clear();
        writePosL = writePosR = 0;
        phase1 = phase2 = 0.0;
        fbL = fbR = 0.0f;
        hcStateL = hcStateR = 0.0f;
    }

    juce::String FXPitchShifter::getEffectName() const
    {
        return vintage ? "Vintage Pitch" : "Dual Pitch";
    }

    void FXPitchShifter::updateGrainParams()
    {
        auto calcRatio = [](float semiNorm, float centNorm) -> double {
            int st = (int)((semiNorm - 0.5f) * 24.0f + 0.5f); // -12..+12
            int ct = (int)((centNorm - 0.5f) * 100.0f + 0.5f); // -50..+50
            return std::pow(2.0, (st * 100.0 + ct) / 1200.0);
        };

        double ratio1 = calcRatio(semi1, cent1);
        grainInc1 = (1.0 - ratio1) / grainLen;

        double ratio2 = calcRatio(semi2, cent2);
        grainInc2 = (1.0 - ratio2) / grainLen;

        hiCutLP = (float)((hiCut * 19800.0f + 200.0f) / (hiCut * 19800.0f + 200.0f + sampleRate * 0.5));
    }

    float FXPitchShifter::readDelay(juce::AudioSampleBuffer& buf, int writePos, float readOffset, int maxSamp)
    {
        // Interpolación lineal
        float readPos = (float)writePos - readOffset;
        if (readPos < 0) readPos += (float)maxSamp;
        int idx = (int)readPos;
        int next = (idx + 1) % maxSamp;
        float frac = readPos - (float)idx;
        float* data = buf.getWritePointer(0);
        return data[idx] * (1.0f - frac) + data[next] * frac;
    }

    void FXPitchShifter::process(const float* inL, const float* inR,
                                  float* outL, float* outR, int numSamples)
    {
        float mixWet = mix;
        float* dL = bufL.getWritePointer(0);
        float* dR = bufR.getWritePointer(0);

        auto calcPan = [](float norm) -> float { return (norm - 0.5f) * 2.0f; };
        float pLeft1  = 1.0f - std::max(0.0f, calcPan(pan1)) * 0.5f;
        float pRight1 = 1.0f - std::max(0.0f, -calcPan(pan1)) * 0.5f;
        float pLeft2  = 1.0f - std::max(0.0f, calcPan(pan2)) * 0.5f;
        float pRight2 = 1.0f - std::max(0.0f, -calcPan(pan2)) * 0.5f;

        float delaySamp1 = delay1 * 0.5f * sampleRate; // 0-500ms
        float delaySamp2 = delay2 * 0.5f * sampleRate;

        for (int s = 0; s < numSamples; ++s)
        {
            float dryL = inL[s], dryR = inR[s];
            float inWetL, inWetR;

            // Vintage: feedback al input
            if (vintage)
            {
                inWetL = dryL + fbL * gain1;
                inWetR = dryR + fbR * gain2;
            }
            else
            {
                inWetL = dryL;
                inWetR = dryR;
            }

            // Escribir en delay line
            dL[writePosL] = inWetL;
            dR[writePosR] = inWetR;

            // Leer con pitch shift (grain-based crossfading)
            phase1 += grainInc1;
            if (phase1 >= 1.0 || phase1 < 0.0) phase1 -= std::floor(phase1);
            float win1 = (float)(0.5 - 0.5 * std::cos(2.0 * M_PI * phase1));

            phase2 += grainInc2;
            if (phase2 >= 1.0 || phase2 < 0.0) phase2 -= std::floor(phase2);
            float win2 = (float)(0.5 - 0.5 * std::cos(2.0 * M_PI * phase2));

            // Leer voice 1
            float readOff1 = delaySamp1 + phase1 * grainLen;
            float shiftedL1 = readDelay(bufL, writePosL, readOff1, maxDelaySamples);
            float shiftedR1 = readDelay(bufR, writePosR, readOff1, maxDelaySamples);

            // Leer voice 2
            float readOff2 = delaySamp2 + phase2 * grainLen;
            float shiftedL2 = readDelay(bufL, writePosL, readOff2, maxDelaySamples);
            float shiftedR2 = readDelay(bufR, writePosR, readOff2, maxDelaySamples);

            writePosL = (writePosL + 1) % maxDelaySamples;
            writePosR = (writePosR + 1) % maxDelaySamples;

            // Mezclar voces con pan y window
            float voiceL = shiftedL1 * win1 * gain1 * pLeft1 + shiftedL2 * win2 * gain2 * pLeft2;
            float voiceR = shiftedR1 * win1 * gain1 * pRight1 + shiftedR2 * win2 * gain2 * pRight2;

            // Vintage: guardar feedback
            if (vintage)
            {
                fbL = voiceL;
                fbR = voiceR;
            }

            // HiCut filter
            hcStateL += hiCutLP * (voiceL - hcStateL);
            hcStateR += hiCutLP * (voiceR - hcStateR);

            // Mix wet/dry
            outL[s] = dryL * (1.0f - mixWet) + hcStateL * mixWet;
            outR[s] = dryR * (1.0f - mixWet) + hcStateR * mixWet;
        }
    }
}
