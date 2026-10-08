#pragma once

#include <cstddef>
#include <cstdint>

// ── Include del motor compartido ──────────────────────────────────────────
// Ruta real de inclusión: el .cpp incluye "ABDSharedCode/SynthCore/ModMatrix.h";
// este header solo es la capa de política (enum, escala HW, contrato público).
// Si en el futuro este header necesita incluir directamente al shared, usar la
// misma ruta que ya resuelve el CMake del projeto:
//   #include "ABDSharedCode/SynthCore/ModMatrix.h"
// (resuelve desde el CMake del progetto con la raíz ../ABDSharedCode).
//
// NOTA PENDIENTE (no asumida): `abd_shared_synthcore_export.h` no existe en este
// workspace (ni en ABDDeep ni en ABDSharedCode/). Si en el futuro existe y debe
// incluirse desde aquí, añadirlo y quitar este comentario. Hoy NO incluirlo
// porque no hay archivo real que lo respalde.

namespace ABD
{

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Fuentes de modulación oficiales del hardware (24 fuentes principales)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// El orden y los valores del enum son idénticos a los del manual DeepMind 12 y a
// `modmatrix_data.js`. No cambiar el orden ni los saltos sin actualizar el byte
// del sysEx y la UI que escribe los slots.
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Destinos de modulación oficiales (132 destinos del hardware, agrupados por
// módulos). Los bytes de los efectos (74..81) son EXACTAMENTE los del manual.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Los ocho destinos de FX se numeran con el código del manual, no con el
// correlativo del enum, porque el byte que ve el hardware ES ese código. Ver el
// bloque de comentarios en ModulationMatrix.h histórico y en docs/.
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
    // DeepMind 12 — `Fx 1..4 Parameters` y `Fx 1..4 Level` — y NUMERADOS
    // COMO EL MANUAL (74-81), no con el correlativo del enum.
    //
    // Y POR QUÉ EL NÚMERO ES EL DEL MANUAL Y NO EL DEL ENUM. El byte de
    // destino ES el manual: la tabla que ve el usuario la escribe
    // `modmatrix_data.js` con esos códigos y el motor castea el byte crudo
    // tal cual (`static_cast<ModDestination>`). Con el bloque al final del
    // enum, en 36-47, el motor ejecutaba una ruta distinta de la que el
    // usuario acababa de elegir sin que nada lo dijera. Aquí el código del
    // byte ES el valor del enum, así que el casteo sigue siendo el de
    // siempre y las dos historias cuentan lo mismo.
    //
    // Y POR QUÉ OCHO Y NO DOCE. El enum declaraba `kFx1Param1` Y
    // `kFx1Param2`, dos parámetros por hueco. El manual tiene UNO por
    // hueco, `Fx 1 Parameters`: los doce eran de más, y un destino de
    // modulación que el hardware no ejerce es un destino que el usuario
    // elige y no pasa nada. Un `Fx N Parameters` mueve los dos parámetros
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
        El número de códigos que cubre el enum, no el número de destinos.

        No es lo mismo porque el bloque de FX se numera con los códigos del
        manual (74-81) y el enum es más disperso que una cuenta corrida: por
        eso los bucles que-barren destinos tienen que ir hasta aquí y no
        hasta "cuántos hay".
    */
    kMaxDestinations = 82
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Ruta y escala bipolar unificada del repo
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
// `amount` se escribe y se lee en UNIDADES DEL DESTINO (semitonos, Hz, %,
// ganancia lineal...), NO en "cucharadas de hardware".
//
// La regla del repo, adoptada por todas las EMULACIONES (DeepMind 12 / MS-2000
// / Neural) y por el motor compartido `abd::synth::ModMatrixT`, es:
//
//      amount_bipolar ∈ [-1, 1]   ← lo que guarda la matriz y lo que lee el lazo
//      amount_hw      ∈ [-128, 127] ← lo que viaja por sysEx / UI / presets
//
//      amount_bipolar = amount_hw / 128.0f        (entrada EE.UU./hardware → motor)
//      amount_hw      = clamp(amount_bipolar,-1,1) * 128.0f   (salida motor → hardware)
//
// Punto de decisión: **escala bipolar unificada del repo = /128.0f**.
// - Es la escala que ya usa el descriptor de deepmind (byte 0..255 a cantidad
//   bipolar) y la que figura en los README de sesión anteriores.
// - El valor 128, no 127, es intencional: hace que ±1.0 del motor vuelva a
//   ±128 del byte y que el cero del byte (128) vuelva a 0.0 del motor, sin
//   sesgo de cuantización en la mitad.
// - El motor compartido `abd::synth::ModMatrixT` amontona en bipolar crudo
//   (clamp a ±1) y elabnda de escala: la conversión /128.0f se hace en la
//   frontera de proyecto → shared, nunca dentro del lazo de suma.
//
// Quien lee este header para usar la matriz DEBE:
//   1. Normalizar cualquier cantidad que venga de un byte / UI / preset con
//      /128.0f antes de llamar a setRoute.
//   2. Interpretar el float que devuelve getModulationValue como cantidad del
//      destino en unidades del destino, sin escalar otra vez.
//
// El adapter de abajo hace exactamente eso: expone `setRoute` y
// `getModulationValue` con las firmas y semánticas que ya esperan los tests y
// SynthVoice, pero delegando en `abd::synth::ModMatrixT<N>` inerte en el 0.

// Bytes → bipolar: el conversor estándar del repo.
inline constexpr float HW_BIPOLAR_SCALE = 1.0f / 128.0f;
inline constexpr float HW_BYTE_ZERO     = 128.0f; // byte neutro == 0.0 bipolar

[[nodiscard]] inline float hwByteToBipolar(float hwByte) noexcept
{
    // hwByte ∈ [-128,127] en teoría; en la práctica la UI recorta a
    // [0,255] y el byte neutro es 128. Esta función es la frontera de proyecto
    // → shared y por tanto es donde se aplica la escala /128.0f.
    return (hwByte - HW_BYTE_ZERO) * HW_BIPOLAR_SCALE;
}

[[nodiscard]] inline float bipolarToHwByte(float bipolar) noexcept
{
    // Clamped para no salir del byte en ruta mal formada.
    const float c = (bipolar < -1.0f) ? -1.0f : (bipolar > 1.0f ? 1.0f : bipolar);
    return c * 128.0f + HW_BYTE_ZERO;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Ruta: firma compatible con el descriptor compartido (source/dest opacos,
// amount bipolar). Se construye desde el enum local dentro del adapter.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
struct ModRoute
{
    ModSource source = ModSource::kNone;
    ModDestination destination = ModDestination::kNone;
    float amount = 0.0f; // Bipolar: [-1.0f, 1.0f], en unidades del destino
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Clase de Matriz de Modulación — adapter delgado sobre el template compartido.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
// Esta clase NO implementa la suma: delega en `abd::synth::ModMatrixT<kNumSlots>`
// (ABDSharedCode/SynthCore/ModMatrix.h). El objetivo es que Deep sea una capa de
// política (enum, nombres, escala HW, fuerza de inerte en 0) sobre un motor único
// para toda la suite.
//
// Contrato público preservado (no cambia para los callers existentes):
//   -  getModulationValue(dest, sourceValues)  → float bipolar en unidades del destino
//   -  setRoute(slot, src, dest, amount)      → amount bipolar en [-1,1]
//   -  clear()
//   -  kNumSlots (en tiempo de compilación, 8 para DM12, 32 para AbyssMind Pro)
//
// Fuente de verdad del número de slots: el #ifdef DEEP_TARGET_MODEL del header
// histórico. Se conserva el mismo mecanismo para que la same binary sirva a DM12
// (8) y a AbyssMind Pro (32) sin tocar este archivo.
//
class ModulationMatrix
{
public:
    ModulationMatrix();
    ~ModulationMatrix() = default;

    void clear();

    /**
     * Escribe una ruta en un slot.
     *
     * `amount` es bipolar en [-1,1]. El adapter lo clampa idénticamente a como
     * lo hacía la impl previa (Paradigm 0.5.x) y a como lo hace el shared, para
     * que una tabla con un slot de más o una ruta mal clipeada no pueda romper
     * el audio. `slotIndex` fuera de rango se ignora en silencio (misma política).
     *
     * No hace nada si src o dest son kNone (en-USO LOCAL del enum; el shared ya
     * trata el id 0 como inerte, pero aquí lo reafirmamos para que la semántica
     * del enum sea explícita en este archivo).
     */
    void setRoute(int slotIndex, ModSource src, ModDestination dest, float amount);

    /**
     * @brief Suma de todas las rutas que apuntan a `dest`, por esta consulta.
     *
     * `sourceValues` es un array de float, INDEXADO POR EL ID DE LA FUENTE LOCAL
     * (es decir, sourceValues[0] == fuente kNone == 0.0 siempre, y
     * sourceValues[ModSource::kLFO1] == valor de LFO1).
     *
     * El valor devuelto es la suma bipolar de las rutas en UNIDADES DEL DESTINO,
     * sin ningún escalado extra. Es exactamente lo que consumen SynthVoice.*
     * (pitch en semitonos, cutoff en Hz, level en 선형, etc.).
     *
     * Si `sourceValues` es nullptr o `dest` es kNone, devuelve 0.0f (misma
     * guarda que la impl previa).
     */
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
    // El motor real: template compartido, sin política de nombres ni de escala.
    class Impl;
    Impl* impl() const;
    mutable Impl* pImpl;
};

} // namespace ABD
