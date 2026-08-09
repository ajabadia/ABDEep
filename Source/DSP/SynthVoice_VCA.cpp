#include "SynthVoice.h"
#include <cmath>

namespace ABD
{

float SynthVoice::processVCASection(float finalFiltered, float velocityValue,
                                     const ModulationMatrix& matrix)
{
    float ampLevelMod = matrix.getModulationValue(ModDestination::kAmpLevel, modSources);
    float vcaEnvelopeValue = modSources[(int)ModSource::kEnv1VCA];

    // VCA Env Depth: escala cuánto afecta la envolvente al nivel
    //   depth=0: sin envolvente (sonido continuo al nivel base)
    //   depth=1: envolvente controla completamente el nivel
    float envScaled = 1.0f - params.vcaEnvDepth + params.vcaEnvDepth * vcaEnvelopeValue;

    // VCA Velocity Sensitivity: la velocity escala el nivel VCA
    //   velSens=0: sin efecto de velocity
    //   velSens=1: velocity controla completamente el nivel
    float velScale = 1.0f - params.vcaVelSens + params.vcaVelSens * velocityValue;

    float ampLevel = (params.vcaLevel + ampLevelMod) * envScaled * velScale;
    ampLevel = std::clamp(ampLevel, 0.0f, 1.0f);

    // Exponential smoothing on amp level (SR-normalized coeff, ~1ms at 44.1 kHz)
    // Prevents zipper noise on fast VCA level/velocity/envelope changes
    // Same approach as VCF cutoff smoothing �?" preserves modulation sharpness
    smoothedAmpLevel += (ampLevel - smoothedAmpLevel) * ampSmoothCoeff;
    ampLevel = smoothedAmpLevel;

    // Modo Ballsy / Transparent
    if (params.vcaMode == 1)
    {
        // --- Ballsy: Analog VCA saturation con carácter valve/tube ---
        // Modelo de saturación analógica en una sola etapa:
        //   1. Pre-drive variable según ampLevel
        //   2. Asymmetric bias para armónicos pares (tube warmth)
        //   3. Soft makeup gain para compensar compresión de la saturación
        float drive = (finalFiltered * ampLevel) * (1.0f + ampLevel);
        // Asymmetry: pequeña asimetría proporcional al nivel para armónicos pares
        float asymmetry = drive * 0.04f * ampLevel;
        float shaped = std::tanh(drive + asymmetry);
        // Makeup gain suave: cuando el tanh aplana la señal, la restaurar ligeramente
        float makeup = 1.0f + (1.0f - std::abs(shaped)) * 0.3f * ampLevel;
        return shaped * makeup * stealingFadeGain;
    }

    // --- Transparent: amplificación lineal limpia ---
    return finalFiltered * ampLevel * stealingFadeGain;
}

} // namespace ABD
