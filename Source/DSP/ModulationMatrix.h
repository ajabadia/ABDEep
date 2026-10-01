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

        // BUS DE EFECTOS (FX). Los ocho destinos que nombra el manual del
        // DeepMind 12 --`Fx 1..4 Parameters` y `Fx 1..4 Level`-- y NUMERADOS
        // COMO EL MANUAL (74-81), no con el correlativo del enum.
        //
        // Y POR QUE EL NUMERO ES EL DEL MANUAL Y NO EL DEL ENUM. El byte de
        // destino ES el manual: la tabla que ve el usuario la escribe
        // `modmatrix_data.js` con esos codigos y el motor castea el byte crudo
        // tal cual (`static_cast<ModDestination>`). Con el bloque al final del
        // enum, en 36-47, el motor ejecutaba una ruta distinta de la que el
        // usuario acababa de elegir sin que nada lo dijera. Aqui el codigo del
        // byte ES el valor del enum, asi que el casteo sigue siendo el de
        // siempre y las dos historias cuentan lo mismo.
        //
        // Y POR QUE OCHO Y NO DOCE. El enum declaraba `kFx1Param1` Y
        // `kFx1Param2`, dos parametros por hueco. El manual tiene UNO por
        // hueco, `Fx 1 Parameters`: los doce eran de mas, y un destino de
        // modulacion que el hardware no ejerce es un destino que el usuario
        // elige y no pasa nada. Un `Fx N Parameters` mueve los dos parametros
        // que cada efecto declare modulables (ver `FXBase::getModulationParams`).
        kFx1Parameters = 74,
        kFx2Parameters = 75,
        kFx3Parameters = 76,
        kFx4Parameters = 77,
        kFx1Level     = 78,
        kFx2Level     = 79,
        kFx3Level     = 80,
        kFx4Level     = 81,

        /**
            El numero de codigos que cubre el enum, no el numero de destinos.

            No es lo mismo porque el bloque de FX se numera con los codigos del
            manual (74-81) y el enum es mas disperso que una cuenta corrida: por
            eso los bucles que-barren destinos tienen que ir hasta aqui y no
            hasta "cuantos hay".
        */
        kMaxDestinations = 82
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

#ifndef DEEP_TARGET_MODEL
 #define DEEP_TARGET_MODEL 1
#endif

#if DEEP_TARGET_MODEL >= 2
        static constexpr int kNumSlots = 32; // 32 buses de modulación (AbyssMind Pro)
#else
        static constexpr int kNumSlots = 8;  // 8 buses de modulación (DeepMind 12)
#endif

    private:
        ModRoute routes[kNumSlots];
    };
}
