#pragma once
#include <cmath>
#include <algorithm>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

namespace ABD
{
    // ============================================================
    // Juno-6 HPF — continuous pot (measured PCHIP interpolation)
    // Output: HPF cutoff frequency in Hz (38.6 – 1394.2 Hz)
    // ============================================================
    inline float getJuno6HPFFreqPCHIP(float x)
    {
        static const float y[] = {
            38.6f, 83.5f, 181.3f, 394.7f, 418.4f,
            437.1f, 455.8f, 605.5f, 988.6f, 1183.2f, 1394.2f
        };
        static constexpr int N = 11;
        static constexpr float h = 0.1f;

        if (x <= 0.0f) return y[0];
        if (x >= 1.0f) return y[N - 1];

        float x_scaled = x * 10.0f;
        int i = (int)x_scaled;
        if (i >= N - 1) i = N - 2;
        float t = x_scaled - (float)i;

        auto get_slope = [&](int idx) -> float {
            if (idx <= 0 || idx >= N - 1) return 0.0f;
            float d_prev = (y[idx] - y[idx - 1]) / h;
            float d_next = (y[idx + 1] - y[idx]) / h;
            if (d_prev * d_next <= 0.0f) return 0.0f;
            return 2.0f / (1.0f / d_prev + 1.0f / d_next);
        };

        float m_i = get_slope(i);
        float m_next = get_slope(i + 1);

        float t2 = t * t;
        float t3 = t2 * t;
        float h00 = 2.0f * t3 - 3.0f * t2 + 1.0f;
        float h10 = t3 - 2.0f * t2 + t;
        float h01 = -2.0f * t3 + 3.0f * t2;
        float h11 = t3 - t2;

        return h00 * y[i] + h10 * h * m_i + h01 * y[i + 1] + h11 * h * m_next;
    }

    // ============================================================
    // BassBoostFilter — Juno-106 HPF position 0
    // 2nd-order biquad derived from analog circuit simulation
    // ============================================================
    struct BassBoostFilter
    {
        static constexpr float kR1  = 47e3f;
        static constexpr float kC1  = 0.047e-6f;
        static constexpr float kCA  = 0.01e-6f;
        static constexpr float kRg  = 10e3f;
        static constexpr float kRf  = 100e3f;
        static constexpr float kCf  = 0.022e-6f;
        static constexpr float kR43 = 47e3f;
        static constexpr float kR44 = 220e3f;
        static constexpr float kR45 = 47e3f;

        float b0 = 1.f, b1 = 0.f, b2 = 0.f;
        float a1 = 0.f, a2 = 0.f;
        double z1 = 0.0, z2 = 0.0;

        void init(float sr)
        {
            const float tau_1z = kR1 * kC1;
            const float tau_1p = kR1 * (kC1 + kCA);
            const float tau_2z = (kRg * kRf / (kRg + kRf)) * kCf;
            const float tau_2p = kRf * kCf;

            const float G2_dc  = 1.f + kRf / kRg;
            const float alpha  = kR45 / kR44;
            const float direct = kR45 / kR43;

            const float D0 = 1.f;
            const float D1 = tau_1p + tau_2p;
            const float D2 = tau_1p * tau_2p;

            const float Nb0 = 1.f;
            const float Nb1 = tau_1z + tau_2z;
            const float Nb2 = tau_1z * tau_2z;

            const float ag = alpha * G2_dc;
            const float N0 = direct * D0 + ag * Nb0;
            const float N1 = direct * D1 + ag * Nb1;
            const float N2 = direct * D2 + ag * Nb2;

            const float K  = 2.f * sr;
            const float K2 = K * K;
            const float a0 = D0 + D1 * K + D2 * K2;
            b0 = (N0 + N1 * K + N2 * K2) / a0;
            b1 = 2.f * (N0 - N2 * K2) / a0;
            b2 = (N0 - N1 * K + N2 * K2) / a0;
            a1 = 2.f * (D0 - D2 * K2) / a0;
            a2 = (D0 - D1 * K + D2 * K2) / a0;

            reset();
        }

        void reset() { z1 = z2 = 0.0; }

        float process(float x)
        {
            float y = b0 * x + static_cast<float>(z1);
            z1 = b1 * x - a1 * y + z2;
            z2 = b2 * x - a2 * y;
            return y;
        }
    };

    // ============================================================
    // JunoHPF — J6 continuous HPF + J106 bass boost (independent)
    //
    // Two independent controls:
    //   1. HPF cutoff (J6 continuous, 38.6–1394.2 Hz via PCHIP)
    //   2. Bass boost gain (J106-style, 0.1–3.0 calibration)
    //
    // When cutoff == 0 Hz, signal bypasses the HPF (FLAT).
    // Bass boost is always available regardless of cutoff position.
    // ============================================================
    struct JunoHPF
    {
        BassBoostFilter bassBoost;

        // 1-pole TPT state
        float hpState = 0.f;
        float hpG     = 0.f;

        float currentFreqHz = 0.f;
        float sampleRate    = 44100.f;
        float bassBoostGain = 1.0f;
        bool  bassBoostActive = false;

        void prepare(double sr)
        {
            sampleRate = static_cast<float>(sr);
            bassBoost.init(static_cast<float>(sr));
            reset();
        }

        void reset()
        {
            hpState = 0.f;
            bassBoost.reset();
        }

        // Set HPF cutoff directly in Hz (0 = FLAT/bypass)
        void setCutoff(float cutoffHz)
        {
            currentFreqHz = std::max(cutoffHz, 0.f);
            updateCoefs();
        }

        // Set HPF from continuous slider value [0..1]
        // Maps through PCHIP interpolation to 38.6–1394.2 Hz
        void setContinuousPosition(float sliderVal)
        {
            currentFreqHz = getJuno6HPFFreqPCHIP(sliderVal);
            updateCoefs();
        }

        void setBassBoostGain(float gain)
        {
            bassBoostGain = std::clamp(gain, 0.1f, 3.0f);
        }

        void setBassBoostActive(bool active)
        {
            bassBoostActive = active;
        }

        void updateCoefs()
        {
            if (currentFreqHz > 0.f)
            {
                float fc = std::min(currentFreqHz / sampleRate, 0.49f);
                hpG = std::tan(static_cast<float>(M_PI) * fc);
            }
            else
            {
                hpG = 0.f;
            }
        }

        // Process one sample
        float process(float x)
        {
            float y = x;

            // 1-pole TPT HPF (active when cutoff > 0)
            if (hpG > 0.f)
            {
                float v  = (y - hpState) * hpG / (1.f + hpG);
                float lp = hpState + v;
                hpState  = lp + v;
                y = y - lp;
            }

            // Bass boost (independent, always available)
            if (bassBoostActive)
            {
                y = bassBoost.process(y) * bassBoostGain;
            }

            return y;
        }
    };
}
