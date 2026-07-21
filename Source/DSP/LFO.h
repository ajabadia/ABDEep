#pragma once
#include <cstdint>

namespace ABD
{
    /**
     * Generador de LFO multionda (Seno, Triángulo, Cuadrada, Rampas, S&H, S&G).
     */
    class LFO
    {
    public:
        enum class Shape
        {
            kSine = 0,
            kTriangle,
            kSquare,
            kRampUp,
            kRampDown,
            kSampleHold,
            kSampleGlide
        };

        LFO();
        ~LFO() = default;

        void setSampleRate(double sampleRate);
        void setRate(float rateHz);
        void setShape(int shapeIndex);
        void setKeySync(bool sync);
        void setDelay(float delaySec);
        void setSlew(float slewAmount);

        void reset();
        void trigger();
        void setPhase(double newPhase);
        double getPhase() const;

        float nextSample();
        float getUnipolar() const;

    private:
        double sampleRate = 44100.0;
        Shape currentShape = Shape::kSine;
        float rate = 1.0f;
        bool keySync = true;
        float delayTime = 0.0f;
        float slew = 0.0f;

        double phase = 0.0;
        double phaseIncrement = 0.0;
        double delaySamplesElapsed = 0.0;

        float lastOutput = 0.0f;
        float targetSH = 0.0f;
        float currentSH = 0.0f;

        uint32_t randomSeed = 123456789u;

        float generateRawWave();
        void updatePhaseIncrement();
        float nextRandomFloat();
    };
}
