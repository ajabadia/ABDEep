#pragma once
#include <cmath>

namespace ABD
{
    /**
     * Interfaz base abstracta para los filtros del sintetizador.
     */
    class Filter
    {
    public:
        virtual ~Filter() = default;

        virtual void prepare(double sampleRate) = 0;
        virtual void setCutoff(float cutoffHz) = 0;
        virtual void setResonance(float resonance) = 0;

        virtual float process(float sample) = 0;
    };

    /**
     * VCF: Filtro pasa-bajos resonante de 2 o 4 polos (12dB / 24dB por octava).
     */
    class VCF : public Filter
    {
    public:
        VCF();
        ~VCF() override = default;

        void prepare(double sampleRate) override;
        void setCutoff(float cutoffHz) override;
        void setResonance(float resonance) override;
        void setPoleMode(int mode); // 0 = 4-Pole (24dB), 1 = 2-Pole (12dB)

        float process(float sample) override;

    private:
        double sampleRate = 44100.0;
        float cutoff = 1000.0f;
        float resonance = 0.0f;
        int poleMode = 1; // Default 24dB

        // Coeficientes del filtro (Biquads en cascada para simplicidad y estabilidad)
        struct Biquad
        {
            float a0 = 1.0f, a1 = 0.0f, a2 = 0.0f;
            float b1 = 0.0f, b2 = 0.0f;
            float x1 = 0.0f, x2 = 0.0f;
            float y1 = 0.0f, y2 = 0.0f;

            void reset()
            {
                x1 = x2 = y1 = y2 = 0.0f;
            }

            float process(float x)
            {
                float y = a0 * x + a1 * x1 + a2 * x2 - b1 * y1 - b2 * y2;
                // Saturación interna suave
                y = std::tanh(y);
                x2 = x1;
                x1 = x;
                y2 = y1;
                y1 = y;
                return y;
            }
        };

        Biquad stages[2]; // Dos biquads en cascada (cada uno es de 12dB/2-pole)

        void updateCoefficients();
    };

    /**
     * HPF: Filtro pasa-altos de 1 polo (6dB/octava) con Bass Boost opcional.
     */
    class HPF : public Filter
    {
    public:
        HPF();
        ~HPF() override = default;

        void prepare(double sampleRate) override;
        void setCutoff(float cutoffHz) override;
        void setResonance(float resonance) override { /* No resonante */ }
        void setBassBoostActive(bool active);

        float process(float sample) override;

    private:
        double sampleRate = 44100.0;
        float cutoff = 20.0f;
        bool bassBoost = false;

        float x1 = 0.0f;
        float y1 = 0.0f;
        float alpha = 0.99f; // Coeficiente para el filtro pasa-altos de 1 polo

        void updateCoefficients();
    };
}
