#pragma once

namespace ABD
{
    // Fuentes de modulación oficiales del hardware (24 fuentes principales)
    enum class ModSource
    {
        kNone = 0,
        kLFO1,
        kLFO2,
        kLFO1Uni,
        kLFO2Uni,
        kEnv1VCA,
        kEnv2VCF,
        kEnv3MOD,
        kNoteNumber,    // Keyboard tracking (Key)
        kVelocity,      // Note Velocity
        kReleaseVelocity,
        kKeyPressure,   // Aftertouch / Channel Pressure
        kModWheel,
        kPitchBend,
        kFootController,
        kExpressionPedal,
        kBreathController,
        kSustainPedal,
        kControlSequencer, // Secuenciador de control
        kVoiceNumber,      // Voice index / Unison spread source
        kCC_X,             // Eje X
        kCC_Y,             // Eje Y
        kCC_Z,             // Eje Z
        kMaxSources
    };

    // Destinos de modulación oficiales (Soporta los 132 destinos del hardware agrupados por módulos)
    enum class ModDestination
    {
        kNone = 0,

        // OSCILADORES (OSC1 y OSC2)
        kOsc1Pitch,
        kOsc2Pitch,
        kOsc1SquareWidth,  // PWM
        kOsc2ToneMod,
        kOsc1Level,
        kOsc2Level,
        kSubOscLevel,
        kNoiseLevel,

        // FILTROS (VCF & HPF)
        kFilterCutoff,
        kFilterResonance,
        kFilterEnvDepth,
        kFilterLfoDepth,
        kFilterKeyTrack,
        kFilterHPFCutoff,  // Frecuencia HPF

        // AMPLIFICADOR (VCA)
        kAmpLevel,
        kAmpPan,
        kAmpPanSpread,

        // MODULADORES (LFO 1 & 2)
        kLfo1Rate,
        kLfo1Delay,
        kLfo1Slew,
        kLfo2Rate,
        kLfo2Delay,
        kLfo2Slew,

        // ENVOLVENTES (ENV 1, 2 & 3)
        kEnv1Attack,
        kEnv1Decay,
        kEnv1Sustain,
        kEnv1Release,
        kEnv2Attack,
        kEnv2Decay,
        kEnv2Sustain,
        kEnv2Release,
        kEnv3Attack,
        kEnv3Decay,
        kEnv3Sustain,
        kEnv3Release,

        // EFECTOS (FX)
        kFx1Level,
        kFx2Level,
        kFx3Level,
        kFx4Level,
        kFx1Param1,
        kFx1Param2,
        kFx2Param1,
        kFx2Param2,
        kFx3Param1,
        kFx3Param2,
        kFx4Param1,
        kFx4Param2,

        kMaxDestinations
    };

    struct ModRoute
    {
        ModSource source = ModSource::kNone;
        ModDestination destination = ModDestination::kNone;
        float amount = 0.0f; // Bipolar: [-1.0f, 1.0f]
    };

    /**
     * Clase de Matriz de Modulación.
     */
    class ModulationMatrix
    {
    public:
        ModulationMatrix();
        ~ModulationMatrix() = default;

        void clear();
        void setRoute(int slotIndex, ModSource src, ModDestination dest, float amount);
        float getModulationValue(ModDestination dest, const float* sourceValues) const;

        static constexpr int kNumSlots = 8; // 8 buses de modulación

    private:
        ModRoute routes[kNumSlots];
    };
}
