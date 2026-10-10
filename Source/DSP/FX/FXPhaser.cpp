/*
  ==============================================================================

    FXPhaser.cpp
    Implementación del envoltorio de producto para FXPhaser.

  ==============================================================================
*/

#include "FXPhaser.h"
#include <algorithm>

namespace ABD
{
    FXPhaser::FXPhaser()
    {
        reset();
    }

    void FXPhaser::prepare(double newSampleRate, int /*samplesPerBlock*/)
    {
        sampleRate = std::max(1.0, newSampleRate);
        phaser_.prepare(sampleRate);
    }

    void FXPhaser::reset()
    {
        phaser_.reset();
    }

    void FXPhaser::setParameter(int index, float value)
    {
        value = std::clamp(value, 0.0f, 1.0f);

        switch (index)
        {
            case 0:  phaser_.setRateNorm(value); break;
            case 1:  phaser_.setDepthNorm(value); break;
            case 2:  phaser_.setFeedbackNorm(value); break;
            case 3:  phaser_.setBaseFreqNorm(value); break;
            case 4: {
                static const int stageMap[] = { 2, 4, 6, 8, 10, 12 };
                int idx = std::clamp((int)(value * 5.99f), 0, 5);
                phaser_.setStageCount(stageMap[idx]);
                break;
            }
            case 5:  break; // Mix gestionado por el FXSlot
            case 6:  phaser_.setWaveSymmetry(value); break;
            case 7:  phaser_.setStereoPhaseNorm(value); break;
            case 8:  phaser_.setEnvModNorm(value); break;
            case 9:  phaser_.setAttackNorm(value); break;
            case 10: hold = value; break; // Almacenado por compatibilidad de contrato
            case 11: phaser_.setReleaseNorm(value); break;
            default: break;
        }
    }

    void FXPhaser::process(const float* inL, const float* inR,
                            float* outL, float* outR,
                            int numSamples)
    {
        phaser_.process(inL, inR, outL, outR, numSamples);
    }
}
