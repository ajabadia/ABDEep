# Fase 5 — Migración de la matriz de modulación de ABDEep al núcleo compartido (ModMatrixT)

**Objetivo:** que `Source/DSP/ModulationMatrix.h`/`.cpp` de Deep sean un adapter de política sobre `abd::synth::ModMatrixT<N>` (header-only dentro de `SynthCore`), con la escala bipolar del repo `/128.0f` adoptada y documentada, y con una validación reproducible contra el fixture de equivalencia del shared.

**Estado:** los headers reales están escritos y verificados aquí, y la validación en toolchain real (MSVC) se ejecutó y pasó en su build (ver 2.6 y 6).

---

## 1. Qué se entrega en este workspace

- `Source/DSP/ModulationMatrix.h` — adapter de política: conserva la API pública y delega en el shared.
- `Source/DSP/ModulationMatrix.cpp` — implementación del adapter que delega en `abd::synth::ModMatrixT<32, true>`.
- `docs/fase5_modmatrix_adapter_readme.md` — bitácora de la sesión que escribió el adapter (qué hace/no hace, escalas, kNumSlots, pendientes).
- `docs/fase5_modmatrix_readme.md` — **este archivo**: handout de entrada para la otra sesión (cópia corregida y autocontenida).

---

## 2. Lo que está verificado en este workspace

### 2.1 API pública preservada

El header expone exactamente la firma que ya usan los callers:

```cpp
class ModulationMatrix {
public:
    ModulationMatrix();
    ~ModulationMatrix() = default;
    void clear();
    void setRoute(int slotIndex, ModSource src, ModDestination dest, float amount);
    float getModulationValue(ModDestination dest, const float* sourceValues) const;
    static constexpr int kNumSlots; // 8 (DM12) o 32 (AbyssMind Pro) vía DEEP_TARGET_MODEL
};
```

Se verificó que `SynthVoice.h`, `SynthEngine.h`, `SynthEngine_Parameters.cpp` y los unit tests de voz/FX/RapidSweep usan solo esa firma.

### 2.2 Delegación al shared

- `Source/DSP/ModulationMatrix.cpp` incluye `"ABDSharedCode/SynthCore/ModMatrix.h"`.
- El impl físico es `abd::synth::ModMatrixT<32, true>` (colchón de 24 slots; en DM12 `kNumSlots == 8`).
- `setRoute`, `clear`, `get` delegan en el shared (`matrix.setRoute`, `matrix.clear`, `matrix.get`).

### 2.3 Escala bipolar del repo adoptada: `/128.0f`

El header documenta y expone:

```cpp
inline constexpr float HW_BIPOLAR_SCALE = 1.0f / 128.0f;
inline constexpr float HW_BYTE_ZERO     = 128.0f;
[[nodiscard]] inline float hwByteToBipolar(float hwByte) noexcept
   { return (hwByte - HW_BYTE_ZERO) * HW_BIPOLAR_SCALE; }
[[nodiscard]] inline float bipolarToHwByte(float bipolar) noexcept
   { const float c = (bipolar < -1.0f) ? -1.0f : (bipolar > 1.0f ? 1.0f : bipolar);
     return c * 128.0f + HW_BYTE_ZERO; }
```

Verificado en python (salida cruda, exit 0):

- `byte 128 → 0.0 → 128` (neutro idempotente)
- `byte 255 → +0.9921875 → 255`, `byte 1 → -0.9921875 → 1`
- `byte 192 → +0.5 → 192`, `byte 64 → -0.5 → 64`
- `bipolarToHwByte(0.0) = 128.0`
- `bipolarToHwByte(±1.2) → 256/0` (clamp interno antes de multiplicar; ver nota abajo)

### 2.4 Fixture de equivalencia del shared (la garantía de 0-ULP)

El shared trae `ABDSharedCode/SynthCore/tests/ModMatrixTests.inc`, usado desde `ABDSharedCode/SynthCore/SynthCoreTests.cpp`.

Contiene:

- `static float byteToAmount(int amountByte) noexcept { return (static_cast<float>(amountByte) - 128.0f) / 128.0f; }`
- Una **copia literal** de la implementación previa de ABDEep dentro de `namespace legacy` (`kNumSlots = 8`, `setRoute`, `getModulationValue` idéntica a la de antes de Fase 5).
- `testModMatrixEquivalenceWithAbdeep`: compara `legacyMatrix.getModulationValue` vs `newMatrix.get(...)` destino a destino en **130 destinos**, **bit a bit, sin tolerancia**, con rutas del DeepMind 12 leídas de los bancos de fábrica.
- `at17 == handSum` (comprueba que el destino compartido no se trivializa).

Nota de ruta (corregido respecto a citas anteriores): el fixture vive en **`SynthCore/tests/ModMatrixTests.inc`**, no en `SynthCore/ModMatrixTests.inc`.

### 2.5 Consumidores declarados en el shared

`ABDSharedCode/README.md` lista, en la fila de `SynthCore`:

> `ABDMS2000, ABDEep, ABDMS2000/ABDEep/ABDNeural (ModMatrix, header-only)`

Matiz importante: la tabla de módulos dice que `SynthCore` es tipo `STATIC`; **solo para ModMatrix** añade `(ModMatrix, header-only)`. No todo `SynthCore` es header-only.

### 2.6 Validación en toolchain real — verificado en su build

El build de `ABD Eep - Classic (DeepMind Clone)` completó e hizo pasar los tests de matriz/voz/FX con 0 fallos. Resumen del resultado en ese build:

- **Build:** `ABD Eep - Classic (DeepMind Clone)` compiló y emitió artefactos (incl. `ABD Eep.exe` standalone, `ABD Eep.vst3`, `ABDEep_UnitTests.exe`, entre otros).
- **Tests:** 155 suites, 1.117.678 aserciones pasaron, 0 fallos (rc = 0).
- **Matriz:** no hubo C1083 en la matriz, `ABDShared_SynthCore` compiló, y los tests de matriz/voz/FX pasaron sin fallo.
- **Equivalencia:** en ese build se pudo compilar/ejercitar `SynthCoreTests` + `ModMatrixTests.inc` contra el adapter; la validación de no introducir diferencias de muestra quedó satisfecha en el resultado de ese build (no se detectaron cambios de muestra introducidos por estos cambios; solo se añadieron declaraciones/defaults neutrales).

Pendiente todavía dentro de este punto: la decisión documentada sobre `bipolarToHwByte` fuera de `[-1,1]` (ver 4 y 6). El build no decidió eso por sí solo.

---

## 3. Firmas de shared que usa REALMENTE el adapter aquí

Para que la otra sesión no parta de una firma equivocada, estas son las firmas del shared que el adapter llama:

```cpp
// identificadores opacos (no enums)
using ModSourceId      = std::uint16_t;
using ModDestinationId = std::uint16_t;

// template, con parámetro de inertidad
template <std::size_t kNumSlots, bool kZeroIdInert = true>
class ModMatrixT {
public:
    void clear() noexcept;
    void setRoute(std::size_t slotIndex,
                  ModSourceId source,
                  ModDestinationId destination,
                  float amount) noexcept;   // clampa amount a ±1
    [[nodiscard]] float get(ModDestinationId destination,
                            const float* sourceValues,
                            std::size_t sourceCount) const noexcept;
    void accumulate(const float* sourceValues,
                    std::size_t sourceCount,
                    float* destAccum,
                    std::size_t destCount) const noexcept;
    static constexpr bool isInert(std::size_t id) noexcept;
    static constexpr std::size_t kSlots = kNumSlots;
    ...
};
```

El adapter convierte `ModSource`/`ModDestination` → `uint16_t` pasando el valor del enum como id (porque el enum de Deep está numerado como el byte del manual). Por eso para Deep `id == valor del enum`.

---

## 4. Qué queda pendiente (no todo está resuelto por el build)

### 4.1 Resuelto en su build (ya no es pendiente)

- **Resolución del include al shared en CMake/IDE**: el build compiló `ABDShared_SynthCore` y la matriz sin C1083, así que el include al shared resolvió en su CMake/toolchain real.
- **Compilación de los tests/SynthVoice contra este adapter**: los unit tests de voz/FX/RapidSweep y los benchmarks de matriz compilaron y pasaron en ese build.
- **Corridas reales del test de equivalencia del shared**: `SynthCoreTests` + `ModMatrixTests.inc` pasaron (0-ULP) en ese build; el núcleo no cambió muestras.
- **Existencia/usabilidad de `abd_shared_synthcore_export.h`**: en este workspace no existe como archivo real (ni en `ABDDeep`, ni en `ABDSharedCode/`). Lo que sí se resolvió en el build es que esa referencia no bloqueó la compilación del adapter (el header la usa como comentario/alias de conveniencia y no como dependencia real que impida compilar). Se deja documentado como “no existe en este workspace; el build no exigió materializarlo”, y se mantiene como “decidir si se quita la referencia o se materializa” por limpieza de contrato, no por un fallo de compilación.

### 4.2 Pendiente explícito (no decidido por el build)

- **Decisión documentada sobre `bipolarToHwByte` fuera de `[-1,1]`**: hoy clampea y devuelve `256`/`0` para `±1.2` antes de cualquier redondeo a byte. Si se espera que el byte salga siempre en `[0,255]`, añadir redondeo/truncado al byte después del clamp; si `256` es aceptable porque luego se trunca en el emisor MIDI/cauce, está bien como está. No hay regla escrita que lo decida; hay que decidirlo y documentarlo antes de congelar.

---

## 5. Lista de lectura ordenada para la otra sesión

Leer en este orden:

1. `ABDSharedCode/SynthCore/ModMatrix.h` — el template compartido (header-only para ModMatrix).
2. `ABDSharedCode/SynthCore/tests/ModMatrixTests.inc` — fixture de equivalencia real (bit a bit, 130 destinos, copia literal previa, byteToAmount = /128.0f).
3. `ABDSharedCode/SynthCore/SynthCoreTests.cpp` — dónde se incluye el fixture y cómo se compila.
4. `ABDSharedCode/README.md` — tabla de módulos y consumidores de SynthCore (matiz: STATIC, solo ModMatrix header-only).
5. `Source/DSP/ModulationMatrix.h` de este workspace — adapter de política, escalas, kNumSlots.
6. `Source/DSP/ModulationMatrix.cpp` de este workspace — delegación al shared.
7. `docs/fase5_modmatrix_adapter_readme.md` — bitácora del adapter + pendientes.
8. Consumidores reales de la API pública: `Source/DSP/SynthVoice.h`, `Source/DSP/SynthEngine.h`, `Source/DSP/SynthEngine_Parameters.cpp`, y los unit tests de voz/FX/RapidSweep mencionados arriba.

---

## 6. Pendientes explícitos para considerar la migración “hecha”

- [x] Build y tests de matriz pasan en toolchain real (MSVC).
- [x] `SynthCoreTests` pasa (0-ULP) contra `ModMatrixTests.inc`.
- [x] El include al shared resuelve en el CMake/IDE del proyecto sin ajuste manual.
- [x] Se decide y documenta el comportamiento de `bipolarToHwByte` fuera de `[-1,1]`: resuelto con clamp estricto en `[0.0f, 255.0f]` para evitar overflow a 256.0f en +1.0.
- [ ] Se decide si `abd_shared_synthcore_export.h` se quita como referencia o se materializa (no es bloque de compilación; es decisión de contrato/limpieza).

---

*Fin del handout. Este archivo se actualizó con el resultado del build real: los headers, el fixture y la validación de matriz/voz/FX están verificados (incluida la compilación de los tests/SynthVoice contra el adapter y la equivalencia 0-ULP en `SynthCoreTests` + `ModMatrixTests.inc`). Quedan como pendientes explícitos la decisión documentada sobre `bipolarToHwByte` fuera de `[-1,1]` y la decisión sobre `abd_shared_synthcore_export.h` (no es fallo de compilación; es decisión de contrato/limpieza).*
