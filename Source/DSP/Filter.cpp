#include "Filter.h"
#include <cmath>
#include <algorithm>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

namespace ABD
{
    VCF::VCF()
    {
        updateCoefficients();
    }

    void VCF::prepare(double newSampleRate)
    {
        sampleRate = std::max(1.0, newSampleRate);
        stages[0].reset();
        stages[1].reset();
        updateCoefficients();
    }

    void VCF::setCutoff(float cutoffHz)
    {
        cutoff = std::clamp(cutoffHz, 10.0f, (float)(sampleRate * 0.49));
        updateCoefficients();
    }

    void VCF::setResonance(float res)
    {
        resonance = std::clamp(res, 0.0f, 0.99f);
        updateCoefficients();
    }

    void VCF::setPoleMode(int mode)
    {
        int newMode = std::clamp(mode, 0, 1);
        if (newMode != poleMode)
        {
            poleMode = newMode;
            // Al pasar de 2→4 polos, resetear la segunda etapa para evitar transientes
            if (poleMode == 1)
                stages[1].reset();
        }
    }

    void VCF::updateCoefficients()
    {
        // 1. Calcular Q a partir de la resonancia (exponencial para un mapeo más musical)
        float Q = 0.707f + 9.5f * std::pow(resonance, 3.0f);

        // 2. Frecuencia angular normalizada
        double w0 = 2.0 * M_PI * cutoff / sampleRate;
        double cosW0 = std::cos(w0);
        double sinW0 = std::sin(w0);
        double alpha = sinW0 / (2.0 * Q);

        // 3. Coeficientes biquad estándar para LPF de segundo orden
        double b0 = (1.0 - cosW0) / 2.0;
        double b1 = 1.0 - cosW0;
        double b2 = (1.0 - cosW0) / 2.0;
        double a0 = 1.0 + alpha;
        double a1 = -2.0 * cosW0;
        double a2 = 1.0 - alpha;

        // Normalización de coeficientes
        float norm_a0 = (float)(b0 / a0);
        float norm_a1 = (float)(b1 / a0);
        float norm_a2 = (float)(b2 / a0);
        float norm_b1 = (float)(a1 / a0);
        float norm_b2 = (float)(a2 / a0);

        // Asignar a ambas etapas
        for (int i = 0; i < 2; ++i)
        {
            stages[i].a0 = norm_a0;
            stages[i].a1 = norm_a1;
            stages[i].a2 = norm_a2;
            stages[i].b1 = norm_b1;
            stages[i].b2 = norm_b2;
        }
    }

    float VCF::process(float sample)
    {
        // poleMode: 0 = 4-Pole (24dB) en cascada, 1 = 2-Pole (12dB) una etapa
        // Esto coincide con los valores raw del hardware DeepMind 12
        if (poleMode == 1)
        {
            // 2-Pole (12dB): procesamos solo una etapa
            return stages[0].process(sample);
        }
        else // 4-Pole (24dB): dos etapas en cascada
        {
            return stages[1].process(stages[0].process(sample));
        }
    }

    // ==========================================
    // HPF Implementation
    // ==========================================

    HPF::HPF()
    {
        updateCoefficients();
    }

    void HPF::prepare(double newSampleRate)
    {
        sampleRate = std::max(1.0, newSampleRate);
        x1 = 0.0f;
        y1 = 0.0f;
        updateCoefficients();
    }

    void HPF::setCutoff(float cutoffHz)
    {
        cutoff = std::clamp(cutoffHz, 10.0f, (float)(sampleRate * 0.45));
        updateCoefficients();
    }

    void HPF::setBassBoostActive(bool active)
    {
        bassBoost = active;
    }

    void HPF::updateCoefficients()
    {
        // Filtro pasa-altos RC de 1 polo simplificado
        double dt = 1.0 / sampleRate;
        double rc = 1.0 / (2.0 * M_PI * cutoff);
        alpha = (float)(rc / (rc + dt));
    }

    float HPF::process(float sample)
    {
        // 1. Filtrado pasa-altos estándar de 1 polo: y[n] = alpha * (y[n-1] + x[n] - x[n-1])
        float y = alpha * (y1 + sample - x1);
        x1 = sample;
        y1 = y;

        // 2. Bass Boost opcional (realza las frecuencias graves sumando una parte de la señal original saturada)
        if (bassBoost)
        {
            float lowPassComponent = sample - y;
            y += lowPassComponent * 0.45f; // Realce suave de graves
        }

        return y;
    }
}
