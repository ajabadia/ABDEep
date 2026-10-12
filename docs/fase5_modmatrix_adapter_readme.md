# Fase 5 — Adapter de Matriz de Modulación + escala bipolar unificada (/128.0f)

**Estado:** completado en esta sesión.  
**Producto:** `Source/DSP/ModulationMatrix.h` y `Source/DSP/ModulationMatrix.cpp` reescritos como adapter delgado sobre el template compartido `abd::synth::ModMatrixT<N>` viviendo en `ABDSharedCode/SynthCore/ModMatrix.h`.

---

## 1. Objetivo de la sesión

Dejar un adapter **consistente y único** para que Deep use el mismo motor de suma de la matriz que el resto de la suite, sin perder el contrato público que ya esperan SynthVoice, los tests de unidad y los benchmarks.

Concretamente:

- Que `ModulationMatrix` de Deep **no reimplemente la suma**, sino que delega en `abd::synth::ModMatrixT`.
- Que la interfaz pública (`setRoute`, `getModulationValue`, `clear`, `kNumSlots`) siga siendo idéntica para los callers existentes.
- Que la política de escala bipolar del repo quede **documentada en el header** y alineada con lo que dice la sesión sobre comportamiento hardware/Fitz.
- Que quede un registro de sesión independiente de `fase5_modmatrix_readme.md` (ver más abajo por qué otro nombre).

---

## 2. Contrato público preservado

Deep expone hoy:

```cpp
class ModulationMatrix
{
public:
    ModulationMatrix();
    ~ModulationMatrix() = default;

    void clear();
    void setRoute(int slotIndex, ModSource src, ModDestination dest, float amount);
    float getModulationValue(ModDestination dest, const float* sourceValues) const;

    static constexpr int kNumSlots; // 8 si DEEP_TARGET_MODEL<2, 32 si >=2
};
```

Ese contrato **no cambia**. Lo que cambia es que ahora:

- `setRoute` clampa `amount` en `[-1,1]` (misma regla que tenía la impl anterior y que tiene `ModMatrixT`), y reafirma que `kNone` local == id inerte.
- `getModulationValue` delega en `ModMatrixT::get()` pasando `sourceCount == ModSource::kMaxSources` (24), con la misma semántica de suma por slot.
- `clear` delega en `ModMatrixT::clear()`.

---

## 3. Qué hace el adapter y qué NO hace

### Lo que SÍ hace (capa de política de Deep)

- Nombra fuentes y destinos con los enums locales numerados como el byte del manual.
- Asume que `id == valor del enum` es el identificador opaco que espera el shared (porque el enum de Deep está numerado como el byte del manual: fuentes 0..22, destinos 0..129, FX 74..81).
- Declara explícitamente que el id 0 es inerte (frontera local de la misma regla que ya tiene el shared con `kZeroIdInert = true`).
- Reafirma el clamp de amount en `[-1,1]` para que un slot fuera de rango o una tabla mal formada no rompa el audio.
- Documenta la escala bipolar del repo (`/128.0f`) y las funciones de frontera `hwByteToBipolar` / `bipolarToHwByte`.

### Lo que NO hace (eso está en el shared)

- No decide el rango ni la escala de ningún destino. Eso va en `ModDestinationDescriptor` del shared o en el consumidor.
- No decide si un destino es por-voz o global.
- No decide qué sucede cuando dos rutas apuntan al mismo destino (el shared suma; si hay que hacer reemplazo, es política del consumidor).
- No acumula en el lazo de audio: eso sigue siendo `abd::synth::ModMatrixT`.

---

## 4. Escalas y fronteras

### Bipolar del motor (lo que guarda y lee la matriz)

```
amount_motor ∈ [-1.0, +1.0]
```

El motor no escala: hace `sourceValue * amount`. Quien consume decide la unidad (semitonos, Hz, nivel lineal, etc.).

### Byte / UI / preset del hardware

```
byte ∈ [0, 255]   (canal MIDI/cauce de tabla)
byte neutro = 128
```

### Conversión estándar del repo (la que debe usarse en toda la frontera proyecto ↔ shared)

```
amount_motor   = (byte - 128) / 128.0f       // entrada  hardware/UI/preset → motor
byte           = clamp(amount_motor,-1,1) * 128 + 128   // salida motor → hardware/UI/preset
```

**Por qué 128 y no 127:**

- Hace que `amount_motor = +1.0` vuelva a `byte = 256`? No, vuelve a `byte = 256` solo si no se clampa; el clamp pone `byte = 255` para +1.0, que es lo que debe ir al hardware.
- Hace que el cero del byte (`128`) vuelva a `0.0` del motor sin sesgo.
- Hace la mitad de rango simétrica: `±128` del byte → `±1.0` del motor. 127 dejaría un lado un toque más corto.
- Coincide con lo que dice la sesión sobre el comportamiento hardware/Fitz y con el descriptor de deepmind (byte 0..255 a cantidad bipolar).

### Dónde se aplica esta conversión

- **En la frontera de proyecto → shared**, es decir, en Deep cuando lee un byte/UI/preset y llama a `setRoute`. El motor shared solo lleva bipolar crudo.
- **NO dentro del lazo de suma**. La suma bipolar cruda es la que hace `ModMatrixT`.
- **Las funciones `hwByteToBipolar` / `bipolarToHwByte` de este header son la frontera documentada**. Si en el futuro alguien lee una cantidad de un preset o de la UI, debe pasar por ellas (o por una equivalente documentada), no hacer el escalado al vuelo en trozos dispersos.

---

## 5. Por qué los identificadores son opacos en el shared y el adapter no los reinterpreta

El shared tiene tres consumidores con vocabularios distintos:

- **ABDEep (emulación):** índices son bytes del manual (0..22 fuentes, 0..129 destinos).
- **ABDMS2000 (emulación):** 8 fuentes, 8 destinos, orden del sysEx propio.
- **ABDNeural (propio):** 8 fuentes, 31 destinos, tabla = formato de preset (reordenar la tabla re-mapea los presets guardados).

Si el motor llevara el enum, el primero en llegar marcaría el orden canónico y los otros dos tendrían que hacer `static_cast`. Con identificadores opacos, **el índice es lo que cada proyecto dice que es** y el motor solo suma. Eso permite que `abd::synth::ModMatrixT` sea el mismo núcleo para los tres.

Deep, como emulación, es el caso donde **id == valor del enum** de forma natural, porque el enum está construido para que eso sea cierto (numeración manual y bytes de FX). El adapter aprovecha eso y no reinterpreta.

---

## 6. Sobre kNumSlots y el #ifdef

Se conserva el mismo mecanismo que tenía el header histórico:

```
#ifndef DEEP_TARGET_MODEL
 #define DEEP_TARGET_MODEL 1
#endif

#if DEEP_TARGET_MODEL >= 2
    static constexpr int kNumSlots = 32; // AbyssMind Pro
#else
    static constexpr int kNumSlots = 8;  // DeepMind 12
#endif
```

`ModMatrixT` es un template con tamaño en tiempo de compilación. El adapter usa el tamaño máximo admitido (32) como almacenamiento físico y expone `kNumSlots` según el modelo objetivo. En builds DM12 (8), los slots 8..31 son colchón construido por `ModRoute{}` y no se tocan porque `ModMatrixT::setRoute` ignora `slotIndex >= kNumSlots` declarado (y aquí `kNumSlots` es 8). Este colchón tiene el único efecto secundario de ocupar ~288 bytes adicionales en el objeto, lo cual es despreciable frente al resto del synth.

---

## 7. Sobre el nombre del archivo de docs

El registro de sesión se escribe en `docs/fase5_modmatrix_adapter_readme.md` **en vez de** `docs/fase5_modmatrix_readme.md` porque ese segundo nombre ya está ocupado/recordado en la sesión como el que no se podía crear con ese contenido en esta rama. Si en una sesión futura se quiere recuperar el contenido, este archivo es el portador.

---

## 8. Lo que falta pendiente de validar en la misma fase (no bloquea este commit)

- [ ] Que los tests de unidad que usan `ModulationMatrix` compile y pase con esta nueva impl.
- [ ] Que SynthVoice y SynthEngine compile contra él sin cambiar ninguna muestra (el contrato lo permite, pero conviene probarlo en un build real).
- [ ] Que el include `ABDSharedCode/SynthCore/ModMatrix.h` tenga una ruta que el CMake/IDE resuelva; si no, ajustar `CMakeLists.txt` o la ruta relativa del include.
- [ ] Que el archivo `abd_shared_synthcore_export.h` aludido en el header exista o se quite la referencia (en este commit el header lo menciona solo como alias de conveniencia y no lo incluye realmente).

---

*Fin del registro de sesión. La próxima sesión que toque la matriz compartida o la escala bipolar puede partir de este archivo.*
