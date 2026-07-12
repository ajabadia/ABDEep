#include "Envelope.h"
#include <cmath>
#include <algorithm>

namespace ABD
{
    Envelope::Envelope()
    {
        reset();
    }

    void Envelope::setSampleRate(double newSampleRate)
    {
        sampleRate = std::max(1.0, newSampleRate);
    }

    void Envelope::setParameters(float attackTimeSec, float decayTimeSec, float sustainLvl, float releaseTimeSec)
    {
        attackTime = std::max(0.001f, attackTimeSec);
        decayTime = std::max(0.001f, decayTimeSec);
        sustainLevel = std::clamp(sustainLvl, 0.0f, 1.0f);
        releaseTime = std::max(0.001f, releaseTimeSec);
    }

    void Envelope::setCurves(float attackCrv, float decayCrv, float sustainCrv, float releaseCrv)
    {
        attackCurve = std::clamp(attackCrv, -1.0f, 1.0f);
        decayCurve = std::clamp(decayCrv, -1.0f, 1.0f);
        sustainCurve = std::clamp(sustainCrv, -1.0f, 1.0f);
        releaseCurve = std::clamp(releaseCrv, -1.0f, 1.0f);
    }

    void Envelope::trigger()
    {
        startLevel = currentLevel;
        targetLevel = 1.0f;
        changeStage(Stage::kAttack);
    }

    void Envelope::release()
    {
        if (currentStage != Stage::kIdle)
        {
            startLevel = currentLevel;
            targetLevel = 0.0f;
            changeStage(Stage::kRelease);
        }
    }

    void Envelope::reset()
    {
        currentStage = Stage::kIdle;
        currentLevel = 0.0f;
        currentProgress = 0.0;
        progressIncrement = 0.0;
    }

    void Envelope::changeStage(Stage newStage)
    {
        currentStage = newStage;
        currentProgress = 0.0;

        switch (currentStage)
        {
            case Stage::kAttack:
                currentStageDurationSec = attackTime;
                break;
            case Stage::kDecay:
                currentStageDurationSec = decayTime;
                break;
            case Stage::kSustain:
                currentStageDurationSec = 1.0; // No increment until release
                break;
            case Stage::kRelease:
                currentStageDurationSec = releaseTime;
                break;
            case Stage::kIdle:
            default:
                currentStageDurationSec = 1.0;
                break;
        }

        progressIncrement = 1.0 / (currentStageDurationSec * sampleRate);
    }

    void Envelope::setLoopMode(bool loop)
    {
        loopMode = loop;
    }

    void Envelope::setTimeScale(float scale)
    {
        scale = std::max(0.1f, scale); // evitar scale ≤ 0
        progressIncrement = 1.0 / (currentStageDurationSec * sampleRate * (double)scale);
    }

    float Envelope::applyCurve(float progress, float curveAmount)
    {
        if (std::abs(curveAmount) < 0.005f)
            return progress;

        float exponent = 1.0f;
        if (curveAmount < 0.0f)
            exponent = 1.0f - curveAmount * 3.0f; // curves up to 4.0
        else
            exponent = 1.0f / (1.0f + curveAmount * 3.0f); // curves down to 0.25

        return std::pow(progress, exponent);
    }

    float Envelope::nextSample()
    {
        if (currentStage == Stage::kIdle)
            return 0.0f;

        if (currentStage == Stage::kSustain)
        {
            // Sustain curve: modula sutilmente el nivel sostenido sobre el tiempo
            //   curve=0:  sustain plano (comportamiento estándar)
            //   curve<0:  el nivel decrece gradualmente (slow fade)
            //   curve>0:  el nivel crece gradualmente (slow swell)
            currentProgress += progressIncrement;
            if (currentProgress >= 1.0) currentProgress = 1.0;
            
            float curveMod = 0.0f;
            if (std::abs(sustainCurve) > 0.005f)
            {
                float progress = (float)currentProgress;
                float curvedProgress = applyCurve(progress, sustainCurve);
                // Desviación máxima: ±10% del sustain level
                float deviation = (curvedProgress - progress) * sustainLevel * 0.1f;
                curveMod = deviation;
            }
            currentLevel = std::clamp(sustainLevel + curveMod, 0.0f, 1.0f);
            return currentLevel;
        }

        currentProgress += progressIncrement;
        if (currentProgress >= 1.0)
        {
            currentProgress = 1.0;
            
            // Advance stage
            if (currentStage == Stage::kAttack)
            {
                startLevel = 1.0f;
                targetLevel = sustainLevel;
                changeStage(Stage::kDecay);
            }
            else if (currentStage == Stage::kDecay)
            {
                changeStage(Stage::kSustain);
                // Loop mode: al completar Decay, re-trigger a Attack en vez de Sustain
                if (loopMode)
                {
                    // trigger() desde startLevel=currentLevel, targetLevel=1.0
                    startLevel = currentLevel;
                    targetLevel = 1.0f;
                    changeStage(Stage::kAttack);
                }
            }
            else if (currentStage == Stage::kRelease)
            {
                reset();
                return 0.0f;
            }
        }

        float progress = (float)currentProgress;
        float curvedProgress = progress;

        if (currentStage == Stage::kAttack)
        {
            curvedProgress = applyCurve(progress, attackCurve);
            currentLevel = startLevel + (targetLevel - startLevel) * curvedProgress;
        }
        else if (currentStage == Stage::kDecay)
        {
            curvedProgress = applyCurve(progress, decayCurve);
            currentLevel = startLevel + (targetLevel - startLevel) * curvedProgress;
        }
        else if (currentStage == Stage::kRelease)
        {
            curvedProgress = applyCurve(progress, releaseCurve);
            currentLevel = startLevel + (targetLevel - startLevel) * curvedProgress;
        }

        return currentLevel;
    }
}
