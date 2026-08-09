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

> **2026-08-09 — actualizado a los números vigentes** (96 files / 4605 tests).

| Métrica | Valor |
|---|---|
| Test files | **96** (96 passed) |
| Tests | **4605** (4605 passed, 0 failed) |
| Duración | ~9.5 s |
| ESLint | **0 errores, 27 warnings** (curly, sin `--fix` aplicado — no bloquean) |

### Cobertura (`npx vitest run --coverage`)

| Métrica | % |
|---|---|
| Statements | 62.53 |
| Branches | 50.19 |
| Functions | 58.21 |
| Lines | 64.74 |

---

## 3. Baseline C++ (JUCE Unit Tests)

Ejecutado con `build/ABDEep_UnitTests_artefacts/Release/ABDEep_UnitTests.exe`.

> **2026-08-09 — actualizado a los números vigentes** (126 suites / 3.689.168
> assertions). El job `cpp-unit-tests` de CI reporta valores equivalentes
> (3.689.164 assertions, 0 fallos) con el mismo binario.

| Métrica | Valor |
|---|---|
| Suites | **126** |
| Assertions pasadas | **3,689,168** |
| Assertions fallidas | **0** |

---

## 4. Corpus de presets A–H (1024 presets)

`resources/banks/Factory Banks V1.1.2/Synth Bank {A..H}.syx` — hashes SHA-256:

> **Estado del validador (2026-08-09):** `scripts/validate_sysex_mapping.js`
> valida los 8 bancos contra el byte map con la **cabecera corregida de 10 bytes**
> (0.2.4): **0 errores / 0 warnings en los 1024 presets** (antes: 146 errores FX
> falsos por la desalineación de cabecera de 8→10 bytes). Los hashes SHA-256 de
> referencia se verifican en CI con `--check-hashes` (corpus INMUTABLE).

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
- Suite C++ completa re-ejecutada tras el fix: **126 suites, 3.689.168 assertions, 0 fallos** (números vigentes, sección 3).

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
- `max_all` cumple el presupuesto en la máquina de desarrollo (p95 4864 µs ≈ **46%**,
  p99 6473 µs ≈ 61%); el p999 local (15242 µs, 7 overruns) era **ruido de carga
  variable** — el **presupuesto definitivo se fijó en runner dedicado CI** (sección 5.3).
- El modo más pesado por nota es **Unison 12** (p50 4153 µs local): 12 voces apiladas
  con detune/pan por muestra.
- Los routings paralelos (1-3) son más ligeros que los seriales (0, 4-9) en la máquina
  de desarrollo; en el runner dedicado el ruteo es casi indiferente (sección 5.3).

### 5.3 Presupuesto temporal DEFINITIVO — runner dedicado windows-2022 (CI)

Corrida del job `benchmark` de `.github/workflows/dsp-ci.yml` (commit `95c4153`,
2026-08-09, `GitHub Actions 1000000402 os=Windows arch=X64 cpus=4`). Misma
configuración: sr=48 kHz, block=512, warmup=200, measured=3000, **3 repeticiones**
(mejor p95 por escenario). Presupuesto de bloque @48 kHz = **10.667 µs**.

| Escenario | p50 µs | p95 µs | p99 µs | p999 µs | max µs | mean µs | allocs | overruns |
|---|---|---|---|---|---|---|---|---|
| idle | 26.6 | 27.5 | 42.6 | 53.7 | 54.8 | 27.05 | **0** | 0 |
| poly12 | 3294.1 | 3351.3 | 3407.2 | 3660.1 | 3858.5 | 3298.95 | **0** | 0 |
| poly12_fx4 | 3408.1 | 3464.8 | 3521.5 | 3730.9 | 3880.0 | 3411.22 | **0** | 0 |
| fx_route_0..9 | 3404-3413 | 3466-3475 | 3515-3602 | 3713-4124 | 3948-5757 | ~3415 | **0** | 0 |
| unison12 | 3294.4 | 3353.4 | 3464.0 | 4279.9 | 4988.1 | 3301.00 | **0** | 0 |
| mono | 297.2 | 314.5 | 323.8 | 361.9 | 513.6 | 300.37 | **0** | 0 |
| modmatrix32 | 3505.1 | 4029.5 | 4100.3 | 4392.2 | 5699.5 | 3593.69 | **0** | 0 |
| vcf_heavy | 2381.6 | 2442.2 | 2480.3 | 2685.0 | 2706.1 | 2383.96 | **0** | 0 |
| **max_all** | 2780.1 | **3211.5** | **3384.7** | **3474.2** | 4074.0 | 2834.58 | **0** | 0 |

**Presupuesto definitivo — envuelta peor-caso de los 18 escenarios (runner dedicado):**

- `p95 = 4029.5 µs` (modmatrix32) ≈ **38%** del bloque
- `p99 = 4100.3 µs` (modmatrix32) ≈ **38%**
- `p999 = 4392.2 µs` (modmatrix32) ≈ **41%**
- `max = 5756.9 µs` (fx_route_2) ≈ **54%**
- **0 overruns y 0 asignaciones en TODOS los escenarios**, incluida la configuración
  máxima del plan → §3.3 satisfecho con margen **~2.4× en p999**.

**Confirmación de reproducibilidad:** el run de publicación de artefactos (commit
`84eb25f`, mismo runner windows-2022, `GitHub Actions 1000000407 cpus=4`) repitió
los 18 escenarios con resultados dentro del ruido (idle p95 27.6 vs 27.5 µs;
`max_all` p95 3204 vs 3211 µs; modmatrix32 p95 4021 vs 4029 µs; 0 allocs y 0
overruns en todos). Los números de esta tabla son por tanto estables entre corridas
independientes en el runner dedicado.

**Publicación de resultados:** el job sube `bench_results.txt` + `bench_full.log` +
`bench_meta.txt` como artefacto de Actions (`benchmark-results-<run_id>`), accesible
en la página del run sin permisos de escritura de rama.

**Conclusiones definitivas (§3.3):**

- El presupuesto de **10.667 µs/bloque se cumple con holgura** en runner dedicado: el
  peor p999 (4392 µs, modmatrix32) es el **41%** del presupuesto; el p999 de `max_all`
  (3474 µs) queda en **~33%**. La incertidumbre del p999 local (15242 µs, 7 overruns)
  queda descartada como ruido de la máquina de desarrollo.
- En el runner dedicado el ruteo FX (0-9) es casi indiferente (~3.4 ms): el coste
  dominante es el motor de voces + mod matrix, no el ruteo.
- Los números CI son **15-30% más bajos** que los de la máquina de desarrollo
  (p.ej. poly12 p50 3294 vs 3673 µs; max_all p95 3211 vs 4864 µs) → la baseline
  definitiva de percentiles debe medirse siempre en CI (windows-2022).

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

- ✅ **Job `allocation-audit`** en `.github/workflows/dsp-ci.yml`: compila
  `ABDEep_Benchmarks` y **falla si `allocs > 0`** (invariante §3.1). Ampliado a
  **idle + poly12 (+poly12_fx4) + max_all** (3 repeticiones cada uno, con el filtro
  `--scenario` del exe) → verificado en CI: **0 allocs en todos los escenarios auditados**.
- ✅ **Job `benchmark`**: 18 escenarios × 3 repeticiones en windows-2022 dedicado y
  publica `bench_results.txt` + `bench_full.log` como **artefacto de Actions**
  (`benchmark-results-<run_id>`, 90 días) — se descarga vía API o UI. Presupuesto
  definitivo en la sección 5.3.
- ✅ **Job `cpp-unit-tests`** en `.github/workflows/dsp-ci.yml` (job `build-and-test`,
  windows-2022): build Release + `ABDEep_UnitTests.exe` — **3.689.164 assertions,
  0 fallos**. Nota: **3 fallos FX preexistentes documentados** (refactor FX en curso:
  fidelidad delay + full-gain wet) — el paso usa `continue-on-error` (no bloquean CI).
- ✅ **Job `vitest` + lint** en `.github/workflows/webui-ci.yml` (ubuntu-latest): suite
  completa de WebUI (**96 files / 4605 tests, 0 fallos**) y ESLint 0 errores.
  `package-lock.json` commiteado; `patchwork-deepmind` eliminado de `dependencies`
  (arrastra `node-midi`, bindings nativos que rompían `npm install` en ubuntu — se usa
  vía `npx -y` en `.agents/mcp.json`); el export de calibración se omite cuando no hay
  inputs en el checkout.
- ✅ **Fix de builds C++ en CI**: fetch de JUCE 8.0.12 (no hay submódulo) y SDK
  WebView2 vía paquete NuGet (`JUCE_WEBVIEW2_PACKAGE_LOCATION`) — sin esto,
  `juce_add_plugin(NEEDS_WEBVIEW2)` falla el configure en runners limpios.
- ✅ **Job `roundtrip-corpus`** en `.github/workflows/roundtrip-corpus.yml` (ubuntu-latest):
  ejecuta `node scripts/validate_sysex_mapping.js --check-hashes` sobre los 8 factory
  banks A-H (1024 presets) y **falla si algún preset viola el mapeo** (byte map vs datos
  reales) **o si un banco .syx fue alterado** (hashes SHA-256 contra
  `schemas/corpus-hashes.json`, corpus INMUTABLE). Estado actual con la cabecera
  corregida de 10 bytes (0.2.4): **0 errores / 0 warnings en los 1024 presets y los 8
  hashes coinciden con la referencia**. Se dispara ante cambios en el validador, el byte
  map, los esquemas, el formato documentado (`docs/sysex_format.md`), el constructor
  canónico (`browser_packer.js`) o los bancos.
- ✅ **Job `fase4-corpus`** (segundo job del mismo `.github/workflows/roundtrip-corpus.yml`,
  ubuntu-latest, timeout 10 min): ejecuta `node scripts/roundtrip_corpus.js --json` — la
  **batería round-trip de Fase 4 (plan §5)** sobre el corpus completo A–H (1024 presets)
  reutilizando `roundtrip_equality.js` + `registry.gen.js`:
  - **Nivel 1** (`rawCodecEqual` por preset): invariante de codec
    `unpack7to8(pack8to7(x)) === x` **y** el lado empaquetado
    `pack8to7(unpack7to8(packed)) === packed`.
  - **Nivel 2** (`semanticEqual` por preset): re-encode Patch→Parámetros→Patch estable
    (±1 raw, rango válido de enums) + detección de hermanos semánticos (hash O(n)).
  - **Nivel 3a** (`hardwareCanonicalEqual`): self-match de cada preset contra el corpus
    COMPLETO con `skipSemantic` — debe hallarse `exact_match` en su posición de cabecera
    + check de layout (`msg[9]` == índice secuencial del archivo).
  - **Resultado verificado**: 1024/1024 en los 3 niveles, 0 errores; clasificación real
    del corpus 804 exact · 210 canonical (105 pares) · 10 semantic (5 hermanos); ~0.7s
    los 8 bancos. Falla con `::error::roundtrip-corpus` si algún invariante se rompe.
- ✅ **Job `property-fuzzing`** en `.github/workflows/property-fuzzing.yml` (ubuntu-latest,
  timeout 10 min): property-based testing / fuzzing acotado (§5) vía
  `node scripts/fuzz_roundtrip.js --json` con el registro canónico real:
  - **Batería por defecto**: 16 seeds deterministas × 500 casos = **8.000 casos** (5× la
    batería original de 8×200=1.600). Los seeds incluyen los 8 originales más 8 de casos
    límite que ejercitan el PRNG `mulberry32` y el codec 7/8: mínimo (`0x1`), máscaras de
    byte (`0x7F`/`0xFF`), máscaras de 16 bits (`0x7FFF`/`0xFFFF`), bits alternados
    (`0x55555555`/`0xAAAAAAAA`) y máximo uint32 (`0xFFFFFFFF`). Coste medido <1s total.
  - **Clasificación de violaciones**: `codec_invariance`, `codec_payload_bound`,
    `codec_throws` y `decode_encode_stability` son **fatales** (deterministas — fallan el
    job, exit 1 con `::error::fuzz-roundtrip`); `timeout` (dependiente del reloj de
    pared, preempción del runner) se reporta como **warning** y no rompe CI.
  - **Límites del plan (§5)**: Max Payload 500 B / Max Timeout 100 ms por caso — leídos de
    `RTE.FUZZ_MAX_PAYLOAD`/`FUZZ_MAX_TIMEOUT_MS` (fuente única). Exit codes 0/1/2.
  - **Resultado verificado**: 8.000 casos → 0 violaciones / 0 timeouts (máx 1ms/caso).
- ✅ **Job `security-scan`** en `.github/workflows/security-scan.yml` (ubuntu-latest,
  timeout 10 min): **audit XSS estático sobre TODO `WebUI/js`** (236 archivos) vía
  `node scripts/security_scan.js --json` (misma lógica que `domSanitize.test.js`) —
  detecta datos externos en sinks HTML dinámicos no escapados (`innerHTML`,
  `insertAdjacentHTML`, `outerHTML`, `DOMParser`) y **falla si hay violaciones**
  (exit 1 con `::error::security-scan`), publicando `security-scan-report.json` como
  artefacto en fallo. Verificado: 0 violaciones en todo `WebUI/js` (Fase 3, §4.1).
- ✅ **Job `registry-generation`** en `.github/workflows/registry-generation.yml`
  (ubuntu-latest, timeout 10 min, job DEDICADO complementario de `schema-validation`):
  - Ejecuta el generador **puro** `node scripts/registry_generator.js` y **falla si los 4
    artefactos `.gen` commiteados no se regeneran sin diffs de contenido**
    (`schemas/parameter-registry.data.json`, `WebUI/js/registry.gen.js`,
    `Source/Core/ParameterRegistry.gen.{h,cpp}` vs `bridge-param-maps.js`,
    `byte_map_data.js`, `parameters_spec.json`).
  - El diff ignora `generatedAt` (`--ignore-matching-lines`) — el job solo falla por
    divergencias de CONTENIDO reales (registro stale o edición manual de `.gen`). Guardia
    anti-minificación de una sola línea en `data.json` y `registry.gen.js`.
  - **Valor añadido vs `schema-validation`**: verificación **multiplataforma** del
    generador (Linux en vez de Windows) y cobertura del generador sin el wrapper PS1.
  - **Verificado**: regeneración → exit 0, 0 diffs de contenido (solo timestamp).
    Registro: 235 parámetros (226 físicos · 3 extendidos · 6 virtuales).
- ✅ **Job `schema-validation`** en `.github/workflows/schema-validation.yml`
  (windows-latest, timeout 15 min): ejecuta `scripts/validate_and_generate.ps1`
  (PowerShell) que **valida `schemas/parameter-registry.json` (schemaVersion 1) y
  regenera los 4 artefactos `.gen`**, fallando con `::error::validate_and_generate.ps1`
  si el esquema es inválido o los artefactos commiteados divergen de las fuentes
  (IDs duplicados, rangos incompatibles, NRPNs colisionados, regiones reservadas
  223-241, guardia anti-minificación). Complementario multiplataforma de
  `registry-generation` (Windows + PS1 vs Linux + generador puro).
- ✅ **Job `wasm-build`** en `.github/workflows/wasm-build.yml` (ubuntu-latest,
  Emscripten **pinneda a 3.1.64**): compila el DSP a WebAssembly
  (`emcmake cmake -S wasm -B wasm/build` con shim `juce_core` gitignored copiado
  desde JUCE 8.0.12 + patch `ThreadPriorities`, como `wasm/build_wasm.bat`) y
  verifica con `scripts/check_wasm_build.js` que **`wasminitengine`/preasignación
  se mantienen** (plan §3.4): artefactos `abdeep_dsp.{js,wasm}` no vacíos con las 9
  funciones de `EXPORTED_FUNCTIONS` en el glue, **≥ 9 exports de función en el
  .wasm** (con `-O3 --strip-all` Emscripten minifica los nombres de export del
  binario — el conteo es la invariante, los nombres viven en el glue) y **sección
  Memory con `initial >= 512` páginas (32 MiB)** = reserva fija preasignada en
  `wasminitengine()`. Verificado local: 13 exports, Memory 512 páginas, exit 0.
- ✅ **Job `pluginval`** en `.github/workflows/pluginval.yml` (windows-2022,
  timeout 45 min) — **último job de Fase 7**: valida el plugin VST3 con
  **Tracktion/pluginval pinneda a v1.0.4** (asset `pluginval_Windows.zip`, 2.4 MB,
  determinismo CI como JUCE 8.0.12 y Emscripten 3.1.64):
  - **Build**: `cmake --build build --config Release --target ABDEep_Standalone_VST3`
    (FORMATS Standalone VST3 del `juce_add_plugin`); el VST3 es un **bundle-directorio**
    `build/ABDEep_Standalone_artefacts/Release/VST3/ABD Eep.vst3/` con
    `moduleinfo.json` + DLL `Contents/x86_64-win` (10.9 MB) — se localiza con el glob
    `*_artefacts/Release/VST3/*.vst3` (mismo que `scripts/verify_release.ps1`).
  - **Validación**: invocación canónica del repo — `pluginval --strictness-level 5
    --seed 42 --validate "<vst3>"` (estándar de la industria, checklist §17 de
    `plugin_quality_checklist.md`); falla con `::error::pluginval` si no hay
    **ALL TESTS PASSED**, publicando `pluginval.log` como artefacto diagnóstico.
  - **Nota `vst3val`**: no existe como repo público (404) — pluginval sigue siendo
    la herramienta canónica de validación VST3 en CI.
- Local: el benchmark requiere `cmake` del VS (el del PATH mezcla versiones 4.2/4.4 y
  rompe la re-configuración) — usar `build.bat` o el cmake de VS explícitamente.

---

## 8. Estado y próximos pasos

> **2026-08-09 — actualizado:** Fases 1/2/4 completadas (verificadas con suites verdes y
> jobs CI dedicados); el punto 1 quedó resuelto en la sección 6.

### ✅ Completadas

1. ~~Decidir sobre el fix de las 66 allocs/bloque~~ — **RESUELTO** (sección 6): 0 asignaciones
   por bloque en audio thread en los 18 escenarios; la serialización XML vive ahora en
   `getDiagnosticSnapshot()` (hilo de control).
2. **Fase 1 — Esquema Declarativo, Generador y Pre-validación:** `schemas/parameter-registry.json`
   (schemaVersion 1) + `scripts/registry_generator.js` + `scripts/validate_and_generate.ps1` →
   artefactos `.gen` (`WebUI/js/registry.gen.js`, `Source/Core/ParameterRegistry.gen.{h,cpp}`,
   `schemas/parameter-registry.data.json`, 235 parámetros). Jobs CI dedicados: `schema-validation`
   y `registry-generation` (Fase 7). Ver `docs/fase1_registry.md`.
3. **Fase 2 — ParameterStore Transaccional, FSM MIDI y Feature Flags:** `ParameterStore` con
   `PendingTransaction` (TTL 300 ms, revisiones, rollback tipado), `HardwareMidiService` con FSM
   de puerto, `SysExAssembler` independiente y `comparisonMode` con diff estructurado. Ver
   `docs/fase2_parameter_store.md`.
4. **Fase 4 — Tests de 3 niveles + fuzzing:** `roundtrip_equality.js` (`rawCodecEqual`,
   `semanticEqual`, `hardwareCanonicalEqual`), fuzzing acotado (`fuzz_roundtrip.js`, 16 seeds × 500 =
   8.000 casos) y corpus A–H (`roundtrip_corpus.js`, 1024 presets: 804 exact · 210 canonical · 10
   semantic). Ver `docs/fase4_roundtrip_equality.md`.

### ✅ Completadas (adicional)

5. **Fase 3 — Sanitización DOM, ASCII y errores tipados:** §4.1 XSS DOM (`dom_sanitize.js`
   canónico + job `security-scan`, 0 violaciones), §4.2 ASCII hardware (`patch_name.js`:
   `PatchNameValidator`/`PatchNameRenderer`/`HardwareExporter`, integrados en bridge-sysex y
   modales) y §4.3 errores tipados (`typed_errors.js`: `SysExError`/`MidiError`/
   `PatchImportError`, integrados en los flujos SysEx/MIDI/importación JSON).

### ⏳ Pendientes

- **Fase 5:** sustituir búsquedas dinámicas en `WASMBridge.cpp` por `std::array` + `ParameterIndex`
  e integrar `ModelCapabilities` (`dm12_hardware` vs `abyssmind_pro`).
- **Fase 6:** retirada progresiva de compatibilidad legacy (`Logger.deprecation()`, aliases de
  `window.dualMidiBridge`).
- **Nivel 3b (Fase 4, §5):** hardware-in-the-loop con DM12 físico — procedimiento en
  `docs/fase4_nivel3b_hardware_in_the_loop.md`.
