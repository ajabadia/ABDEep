#pragma once

#include "Oscillator.h"
#include <algorithm>

namespace ABD
{
    /**
     * OSC1: Saw + Pulse with PWM (DeepMind Classic style).
     *
     * Improvements over original:
     *   - PolyBLEP anti-aliasing on saw and pulse edges
     *   - Sawtooth curvature modeling analog RC integration
     *   - Smooth PWM duty cycle to prevent clicks
     */
    class OSC1 : public Oscillator
    {
    public:
        OSC1();
        ~OSC1() override = default;

        void prepare(double sampleRate) override;
        void setFrequency(double hz) override;
        void setModulationValue(int destination, float value) override;

        void setSawActive(bool active);
        void setSquareActive(bool active);

        /** Set sawtooth curvature (0.0 = linear, 0.15 = analog-like, 0.3 = strong bow). */
        void setSawCurvature(float curve) { sawCurve = std::max(0.0f, std::min(curve, 1.0f)); }

        float nextSample() override;
        void resetPhase() override { phase = 0.0; }
        double getPhase() const override { return phase; }

    private:
        double currentSampleRate = 44100.0;
        double baseFrequency = 440.0;
        double phase = 0.0;
        double phaseInc = 0.0;          // track phase increment for PolyBLEP

        float pitchModValue = 0.0f;
        float pwmModValue = 0.5f;
        float currentPwmDuty = 0.5f;    // slew-limited PWM duty for smooth transitions
        float pwmSlewCoeff = 0.1f;      // per-sample slew coeff, recomputed in prepare() from DAW SR
        // PWM slew time constant in seconds. Legacy per-sample coeff was 0.1 @
        // 44.1 kHz: tau = -1/(ln(1-0.1)·44100) = 0.0002152 s.
        static constexpr float kPwmSlewTauSec = 0.00021522f;

        bool sawActive = true;
        bool squareActive = false;

        float sawCurve = 0.15f;         // analog curvature depth (ABDJUNiO601 default)
    };
}
