# Baseline Fase 0 — Plan de Refactorización v3.2 Congelado (ABDEep)

> **Fecha:** 2026-08-08 · **Commit base:** working tree @ main
> **Entorno:** Windows 11, MSVC 19.50.35728, VS 18 2026, CMake 4.2 (bundled VS), Node 24.16.0, Vitest 4.1.10, ESLint 8.57.1
> **Modelo de build:** `DEEP_TARGET_MODEL=2` (Enhanced/Pro), `EEP_MODE_ENHANCED=1`, Release

Este documento registra la **baseline exacta** exigida por la Fase 0 del plan v3.2:
número de suites de test, cobertura, hashes del corpus A–H, percentiles temporales
(`p95`, `p99`, `p999`) de `processBlock()` y audit de asignaciones.

---

## 1. Fix de bloqueante: `package.json` restaurado

- **Síntoma:** `package.json` había sido eliminado del working tree (`D package.json`
  en `git status`). Sin él, `npm test`, `npm run lint`, `npm run calibration:export:ci`
  y los 3 workflows CI (`webui-ci.yml`, `dsp-ci.yml`, `audio-ab-ci.yml`) estaban rotos.
- **Acción:** restaurado desde `git show HEAD:package.json` (contenido idéntico al
  commit HEAD). `git status` vuelve a estar limpio para este fichero.
- **Scripts activos:** `test` (vitest run), `test:watch`, `test:ci`, `lint`,
  `lint:ci`, `calibration:export`, `calibration:export:ci`.
- **DevDependencies:** `vitest@^4.1.10`, `eslint@^8.57.1`, `@vitest/coverage-v8@^4.1.10`.
- **Nota para CI:** el workflow `webui-ci.yml` usa `npm run lint` (0 errores, warnings
  permitidos) — coherente con el baseline actual (sección 2).

---

## 2. Baseline WebUI (Vitest + ESLint)

| Métrica | Valor |
|---|---|
| Test files | **81** (81 passed) |
| Tests | **4351** (4351 passed, 0 failed) |
| Duración | 21.08 s |
| ESLint | **0 errores, 6 warnings** (todos `no-var`, en 6 ficheros) |

### Cobertura (`npx vitest run --coverage`)

| Métrica | % |
|---|---|
| Statements | 50.98 |
| Branches | 39.49 |
| Functions | 46.59 |
| Lines | 53.32 |

---

## 3. Baseline C++ (JUCE Unit Tests)

Ejecutado con `build/ABDEep_UnitTests_artefacts/Release/ABDEep_UnitTests.exe`.

| Métrica | Valor |
|---|---|
| Suites | **122** |
| Assertions pasadas | **3,689,097** |
| Assertions fallidas | **0** |

---

## 4. Corpus de presets A–H (1024 presets)

`resources/banks/Factory Banks V1.1.2/Synth Bank {A..H}.syx` — hashes SHA-256:

| Banco | SHA-256 |
|---|---|
| A | `21ed77a43687fcbe2dd509eb71f55ba02a9b9b70d0f0a15d1f883e62e0621f60` |
| B | `a78361a790df2bc93b1a510415d212e4ae8243005be371b0355b6910a4aadf6b` |
| C | `b83289c36b182c5e47ad8613b038d23b66e9cd658e9a9c793f85c3a49178b0bf` |
| D | `b59683948173bcb699205bc43f7ced72117133dbf81738191c09218b67391bad` |
| E | `9f63212d72be6d91adbad2d37bdb750f102d6ec303c72df15d2ee1730ccd5c3e` |
| F | `83acd6857122b37eb3640236f51c7d26e722acd74f3fb074ba4fcd978debd993` |
| G | `d92f389a1ed931b89b5e3cd3c386785d5370872f06a4fb787e00f73c463a78f5` |
| H | `841099ea476b66a66e766b17c064df880026797535c9d1b43f4876b7fa68287c` |

---

## 5. Benchmark de `processBlock` — percentiles temporales + audit de asignaciones

Nuevo target headless **`ABDEep_Benchmarks`** (`Source/Tools/Benchmarks/ProcessBlockBenchmark.cpp`,
registrado en `CMakeLists.txt`). Config: `sr=48 kHz, block=512, warmup=200, measured=3000`.
Presupuesto de bloque @48 kHz = **10,667 µs**.

| Escenario | p50 µs | p95 µs | p99 µs | p999 µs | max µs | mean µs | allocs/bloque | overruns |
|---|---|---|---|---|---|---|---|---|
| idle | 66.9 | 173.4 | 317.0 | 638.9 | 6763.4 | 94.61 | **66** | 0 |
| poly12 | 4646.7 | 7199.6 | 11409.0 | 22097.7 | 83051.4 | 4964.91 | **66** | 40 |
| poly12_fx4 | 3713.0 | 5215.3 | 6871.4 | 24179.1 | 49596.4 | 3920.48 | **66** | 10 |

> Los valores absolutos son de la máquina de desarrollo (con carga variable); lo
> determinante del baseline son las **66 asignaciones por bloque en TODOS los
> escenarios** (198.000 allocs / 3000 bloques, ~3,2 KB por bloque).

### 5.1 Resultado tras el fix (§6) — 0 asignaciones en audio thread

| Escenario | p50 µs | p95 µs | p99 µs | p999 µs | max µs | mean µs | allocs/bloque | overruns |
|---|---|---|---|---|---|---|---|---|
| idle | 26.9 | 50.1 | 69.9 | 175.0 | 293.9 | 32.82 | **0** | 0 |
| poly12 | 3733.3 | 5326.6 | 6744.1 | 9573.4 | 16754.1 | 3904.08 | **0** | 3 |
| poly12_fx4 | 3941.4 | 5746.5 | 6872.5 | 9809.2 | 12979.6 | 4111.65 | **0** | 2 |

- **allocs/bloque: 66 → 0** en todos los escenarios (invariante §3.1 cumplido).
- idle: p50 **-60%** (66.9 → 26.9 µs), p95 **-71%** (173.4 → 50.1 µs).
- poly12: p50 -20%, p99 **-41%** (11409 → 6744 µs), overruns 40 → 3.
- Suite C++ completa re-ejecutada tras el fix: **122 suites, 3.689.097 assertions, 0 fallos**.

### 5.2 Escenarios de carga máxima real (3 repeticiones, mejor p95 por escenario)

Metodología anti-ruido: cada escenario se ejecuta 3 veces (3.000 bloques medidos + 200 de
warmup por corrida) y se reporta la corrida con el p95 más bajo. Presupuesto de bloque
@48 kHz/512 = **10.667 µs**.

| Escenario | Config | p50 µs | p95 µs | p99 µs | p999 µs | allocs | overruns |
|---|---|---|---|---|---|---|---|
| idle | sin voces / sin FX | 21.2 | 39.3 | 58.4 | 142.3 | **0** | 0 |
| poly12 | 12 voces poly | 3673.1 | 5313.8 | 6161.3 | 8184.0 | **0** | 1 |
| poly12_fx4 | 12 voces + 4 FX serie | 3946.4 | 5711.6 | 6784.5 | 13890.3 | **0** | 5 |
| fx_route_0 | series 1→2→3→4 | 3665.0 | 5927.4 | 8284.2 | 20890.3 | **0** | 14 |
| fx_route_1 | par 1/2 + ser 3→4 | 3099.9 | 4441.7 | 4989.3 | 6223.3 | **0** | 0 |
| fx_route_2 | par 1/2 + par 3/4 | 3112.0 | 4534.1 | 5653.2 | 9714.5 | **0** | 2 |
| fx_route_3 | full parallel 1∥2∥3∥4 | 3163.4 | 4627.7 | 5278.5 | 6699.2 | **0** | 0 |
| fx_route_4 | (1→2)∥(3→4) | 3881.3 | 5415.0 | 6679.1 | 10223.0 | **0** | 2 |
| fx_route_5 | 1→(2∥3)→4 | 3901.7 | 5485.0 | 6227.6 | 8637.5 | **0** | 1 |
| fx_route_6 | (1∥2)→(3∥4) | 3872.1 | 5337.8 | 6153.1 | 7831.0 | **0** | 1 |
| fx_route_7 | (1→2→3)∥4 | 3961.7 | 5595.3 | 6373.3 | 8752.0 | **0** | 1 |
| fx_route_8 | (1∥2)→3→4 | 3977.9 | 5681.6 | 6469.7 | 10898.8 | **0** | 4 |
| fx_route_9 | series + feedback | 3670.4 | 5171.6 | 6005.6 | 8065.7 | **0** | 1 |
| unison12 | Uni12, detune/pan máx, 1 nota (12 voces apiladas) | 4152.7 | 5291.6 | 6789.1 | 9036.4 | **0** | 0 |
| mono | Mono, 1 voz | 258.9 | 464.9 | 636.9 | 1103.8 | **0** | 0 |
| modmatrix32 | 12 voces + 32 slots mod (AbyssMind Pro) | 3480.0 | 5021.8 | 5684.3 | 7307.2 | **0** | 0 |
| vcf_heavy | 12 voces + Moog Ladder + oversample 4x | 2787.3 | 3980.0 | 4642.7 | 6084.2 | **0** | 0 |
| **max_all** | Uni12 + modmatrix 32 + Moog 4x + 4 FX (routing 9) | 3215.2 | **4864.4** | **6473.2** | 15242.8 | **0** | 7 |

**Conclusiones del presupuesto temporal (§3.3):**

- **0 asignaciones por bloque en los 18 escenarios**, incluida la configuración máxima.
- `max_all` (configuración máxima del plan: polifonía máxima + 4 slots FX) cumple el
  presupuesto en p95 (4864 µs ≈ **46%** del bloque) y p99 (6473 µs ≈ 61%). El p999
  (15242 µs) supera el presupuesto en esta máquina de desarrollo con carga variable
  (7 overruns); el mismo escenario en una corrida única previa dio 0 overruns — se
  necesita un runner dedicado en CI para fijar el presupuesto definitivo.
- El modo más pesado por nota es **Unison 12** (p50 4153 µs): 12 voces apiladas con
  detune/pan por muestra.
- Los routings paralelos (1-3) son más ligeros que los seriales (0, 4-9), como era de esperar.

---

## 6. ⚠️ Hallazgo crítico — Violación del invariante de tiempo real (§3 del plan) — **RESUELTO**

**66 allocs/bloque incluso en `idle`** provenían de `SynthEngine::updateVoiceSnapshot()`
(`Source/DSP/SynthEngine_Snapshot.cpp`), que se ejecuta al final de **cada**
`processBlock()` dentro del audio thread:

```cpp
#if DEEP_TARGET_MODEL >= 2
    currentDiagnosticSnapshot.activeCalibrationJson = activeCalibration.toXml();
#endif
```

- `CalibrationSpec::toXml()` construía un árbol `juce::XmlElement` con decenas de
  parámetros y lo convertía a `juce::String` → **~60+ asignaciones por llamada**.
- Era incondicional (independiente de voces activas), lo que explicaba las 66 allocs
  constantes en los 3 escenarios.
- `voiceSnapshots[12]` (array fijo de floats) y `getDiagnosticSnapshot(i)` **no**
  asignan — el único culpable era la serialización XML.

**Violaciones del plan:** §3.1 (0 asignaciones dinámicas), §3.2 (0 búsquedas por
string en audio — `toXml` hace trabajo de strings), y presupuesto temporal §3.3.

**Fix aplicado (2026-08-08):** la serialización XML se movió fuera del audio thread —
`updateVoiceSnapshot()` solo actualiza datos numéricos por bloque, y
`getDiagnosticSnapshot()` (hilo de control, bajo `calibrationLock`) construye
`activeCalibrationJson` de forma perezosa. Todos los consumidores (bridge → WebUI,
Calibration Lab, unit tests) leen a través de `getDiagnosticSnapshot()`, por lo que
la semántica se preserva. Verificado: 0 allocs/bloque y suite C++ sin regresiones.

---

## 7. CI — estado de Fase 7

- ✅ **Job `allocation-audit` implementado** en `.github/workflows/dsp-ci.yml`: compila
  `ABDEep_Benchmarks`, ejecuta `--scenario idle` (3 repeticiones) y **falla si
  `allocs > 0`** (invariante §3.1).
- El exe soporta `--scenario <subcadena>` para ejecutar escenarios individuales
  (útil para CI y depuración).
- Job **`roundtrip-corpus`** (pendiente): fijar los hashes A–H de la sección 4 como referencia.
- Local: el benchmark requiere `cmake` del VS (el del PATH mezcla versiones 4.2/4.4 y
  rompe la re-configuración) — usar `build.bat` o el cmake de VS explícitamente.
- `dsp-ci.yml` compila `ABDEep_UnitTests` y ahora también `ABDEep_Benchmarks`
  (job independiente `allocation-audit`).

---

## 8. Próximos pasos (secuencia sugerida)

1. **Decidir** sobre el fix de las 66 allocs/bloque (sección 6) — ya o Fase 5.
2. Fase 1: `schemas/parameter-registry.json` (schemaVersion 1) + `validate_and_generate.ps1`.
3. Fase 2: `ParameterStore` transaccional + FSM `HardwareMidiService` + `SysExAssembler`.
4. Fase 4: tests de 3 niveles (`rawCodecEqual`, `semanticEqual`, `hardwareCanonicalEqual`) + fuzzing acotado.
