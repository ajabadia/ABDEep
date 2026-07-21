#pragma once
#include <functional>

namespace ABD
{
    struct VcfVoicing
    {
        // Curva de resonancia: mapea el valor unipolar 0..1 del fader al feedback K del solver
        std::function<float(float)> resonanceCurve;

        // Compensación de ganancia: escala el nivel final de salida en función del nivel de resonancia
        std::function<float(float)> gainCompCurve;

        // Factor de saturación por etapa: escala de distorsión analógica (std::tanh)
        float stageSaturationAmount = 1.0f;
    };
}
