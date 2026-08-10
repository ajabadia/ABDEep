# 🚀 Plan de Refactorización de Arquitectura e Integración v3.2 Congelado (ABDEep 9.5/10+)

Este documento representa la **especificación técnica ejecutiva definitiva y congelada** para la refactorización arquitectónica, la integración transaccional y el blindaje en tiempo real de **ABDEep** (C++20 / JUCE 8 / WASM).

---

## 🏗️ 1. Arquitectura de 4 Capas y Esquema Generador Versionado

```
                          ┌─────────────────────────────┐
                          │  schemas/parameter-registry │
                          │     (schemaVersion: 1)      │
                          └──────────────┬──────────────┘
                                         │  (validate-schema -> build generator)
                ┌────────────────────────┴────────────────────────┐
                ▼                                                 ▼
     ┌─────────────────────┐                           ┌─────────────────────┐
     │ JS Registry (.gen)  │                           │ C++ Registry (.gen) │
     └──────────┬──────────┘                           └──────────┬──────────┘
                │                                                 │
  ┌─────────────┼─────────────────────────┐         ┌─────────────┼─────────────────────────┐
  ▼             ▼                         ▼         ▼             ▼                         ▼
Physical    Parameter                   Codec    Physical    Parameter                   Codec
ByteMap     Registry                   Services  ByteMap     Registry                   Services
(242 B)    (Editables)               (SysEx/NRPN) (242 B)    (Editables)               (SysEx/NRPN)
```

### 1.1 Matriz Formal de Capabilities por Modelo
```typescript
interface ModelCapabilities {
  model: 'dm12_hardware' | 'abyssmind_pro';
  standardFxCount: number;       // 35 efectos nativos DeepMind 12
  advancedFxCount: number;       // 21 efectos extendidos AbyssMind Pro
  modulationSlotCount: number;   // 8 slots estándar / extendidos
  supportsExtendedSequencer: boolean;
  supportsAbyssMindParameters: boolean;
}
```

---

## 🔄 2. Ciclo de Vida Transaccional, Políticas de Rollback y FSM MIDI

### 2.1 Política de Rollback en `ParameterStore`

```typescript
interface PendingTransaction {
  transactionId: string;
  parameterId: string;
  originId: string;
  revision: number;
  expectedRawValue: number;
  normalizedValue: number;
  createdAt: number;
  expiresAt: number; // TTL = 300 ms
  state: 'pending' | 'confirmed' | 'timeout' | 'superseded' | 'cancelled';
}
```

- **Notificación y Transport Status:** Al confirmarse una transacción (`confirmed`), la UI actualiza únicamente `transportStatus = 'confirmed'`, evitando escrituras redundantes al slider.
- **Políticas de Rollback Tipadas:**
  - `Rollback de Edición de Parámetro:` Si expira el TTL (`timeout`), el store restaura el valor `committedValue` previo y marca `transportStatus = 'out_of_sync'`.
  - `Rollback de Carga de Patch:` Si falla la transmisión SysEx del preset completo, el motor mantiene el patch previo y notifica una alerta de resincronización.
  - `Rollback de Migración LocalStorage:` Ante un esquema corrupto, se conserva el estado original en backup y se aplica la configuración segura de fábrica.

### 2.2 FSM del Puerto MIDI y Ensamblador SysEx Independiente

```
[HardwareMidiService (Puerto)]
  connected ───> syncing ───> ready ───> transmitting ───> resync_required

[SysExAssembler (Mensajes)]
  waiting ───> collecting ───> complete / malformed / timeout
```

---

## ⚡ 3. Invariantes de Tiempo Real (Strict Audio Invariants & Presupuesto Temporal)

En el hilo de audio nativo y WASM (`processBlock()`):
1. **Comportamiento Determinista:** Cero asignaciones dinámicas de memoria, cero búsquedas por cadena de texto, cero operaciones potencialmente bloqueantes y cero locks/mutexes introducidos por el código de ABDEep.
2. **Lookup por Índice:** Acceso directo a `std::array<ParameterValue, kParameterCount>` mediante enum `ParameterIndex::VcfCutoff` generado en build-time.
3. **Presupuesto Temporal Multivariante (Benchmarking en CI):**
   - $\text{p95} \le X\,\mu\text{s}$
   - $\text{p99} \le Y\,\mu\text{s}$
   - $\text{p999} \le Z\,\mu\text{s}$ (con $0$ overruns de audio durante $N$ bloques bajo la configuración máxima de polifonía y 4 slots de FX).
4. **Reserva Fija:** Capacidad preasignada en `wasminitengine()`. Bloques excedentes son rechazados de forma segura sin reasignar ni alterar estados.

---

## 🔒 4. Política de Sanitización DOM y ASCII Diferenciadas

1. **Protección XSS DOM (Sinks no confiables):** Prohibido insertar datos externos o importados en sinks dinámicos sin escape (`innerHTML =`, `innerHTML +=`, `insertAdjacentHTML`, `outerHTML`, `DOMParser`). Templates estáticos auditados permitidos. Uso obligatorio de `textContent` para valores dinámicos.
2. **Sanitización ASCII (Compatibilidad Hardware):**
   - `PatchNameValidator`: Valida la estructura según el protocolo SysEx.
   - `PatchNameRenderer`: Inserción segura en UI vía `textContent`.
   - `HardwareExporter`: Limita a 15 caracteres ASCII imprimibles sin alterar el modelo original.

---

## 🧪 5. Matriz de Pruebas de 3 Niveles, Property-Based Testing y Fuzzing con Recurso Acotado

- **Nivel 1 (`rawCodecEqual`):** $\text{Bytes} \rightarrow \text{Pack} \rightarrow \text{Unpack} \rightarrow \text{Bytes}$.
- **Nivel 2 (`semanticEqual`):** $\text{Patch} \rightarrow \text{Parameters} \rightarrow \text{Patch}$ (descartando bytes reservados y padding).
- **Nivel 3a (`hardwareCanonicalEqual`):** Comparación contra el corpus A–H (1.024 presets) registrando `exact_match`, `canonical_match`, `semantic_match` o `known_exception`.
- **Nivel 3b (Hardware-in-the-Loop):** Dumps reales en hardware físico (obligatorio previo a cualquier release que modifique el protocolo SysEx o NRPN).
- **Property-Based Testing & Fuzzing (Límites Acotados):**
  - Propiedad de Invarianza: $\text{unpack}(\text{pack}(\text{bytes})) \equiv \text{bytes}$ y $\text{decode}(\text{encode}(\text{params})) \approx \text{params}$.
  - Límites de recurso: Max Payload 500B, Max Timeout 100ms por caso, profundidades acotadas sin mutación global ni envíos MIDI en fallo.

---

## ⚙️ 6. Feature Flags, Diff Comparativo y Logger Estructurado

1. **Diff Comparativo en Modo Diagnóstico (`comparisonMode`):**
   ```json
   {
     "parameterId": "vcf.cutoff",
     "legacy": 0.50196,
     "new": 0.5,
     "difference": 0.00196,
     "classification": "quantization"
   }
   ```
2. **Logger Estructurado Fuera de Audio:**
   - `Logger.deprecation("legacy parameter ID", { legacyId, replacementId })`
   - Invocación restringida exclusivamente a hilos de control y tests; estrictamente prohibido en el hilo de audio.

---

## 📅 7. Plan de Fases de Ejecución

### Fase 0: Inventario, Baseline y Perfilado (Pre-requisito)
- [x] Registrar baseline exacta en CI: número de test suites, cobertura, hashes de presets A–H, percentiles temporales ($\text{p95}$, $\text{p99}$, $\text{p999}$) en $\mu\text{s}$ de `processBlock()` y audit de asignaciones.

> **2026-08-10 — Completado.** Baseline exacta registrada y custodiada en
> `docs/baseline_fase0_v32.md` (referencia de Fase 0):
> - **Suites:** WebUI 103 files / 4688 tests (0 fallos, 2 skipped) + guard
>   `baselineGuard.test.js` anti-drift; C++ 126 suites / 3.689.164 assertions.
> - **Cobertura:** sección 2 (`npx vitest run --coverage`).
> - **Hashes A–H:** sección 4 + `schemas/corpus-hashes.json` — verificados en CI por el
>   job `roundtrip-corpus` (`--check-hashes`, corpus INMUTABLE).
> - **Percentiles p95/p99/p999 de `processBlock()`:** sección 5.3 — presupuesto
>   DEFINITIVO desde runner dedicado windows-2022 (job `benchmark`): `p95 = 4029.5 µs`,
>   `p99 = 4100.3 µs`, `p999 = 4392.2 µs` (envuelta de los 18 escenarios), 0 overruns.
> - **Audit de asignaciones:** sección 5.1/6 — 0 allocs/bloque en los 18 escenarios
>   (fix de las 66 allocs de `updateVoiceSnapshot`), blindado por el job
>   `allocation-audit` (idle/poly12/max_all).
> Todos los números tienen job CI dedicado (Fase 7) que los hace fallar si derivan.

### Fase 1: Esquema Declarativo, Generador y Pre-validación
- [x] Crear `schemas/parameter-registry.json` (`schemaVersion: 1`).
- [x] Desarrollar `scripts/validate_and_generate.ps1` (rechaza IDs duplicados, rangos incompatibles o NRPNs colisionados antes de emitir `.gen.js` y `.gen.cpp`).
- [x] Vincular con CMake (`add_custom_command`).

> **2026-08-09 — Completado.** Esquema declarativo `schemaVersion: 1` + generador
> `scripts/registry_generator.js` (puro, sin wrapper) + `scripts/validate_and_generate.ps1`
> (rechaza IDs duplicados, rangos incompatibles, NRPNs colisionados y regiones reservadas
> del preset 223-241 con `RESERVED_BYTE_COLLISION`). Emite 4 artefactos `.gen`
> (`schemas/parameter-registry.data.json`, `WebUI/js/registry.gen.js`,
> `Source/Core/ParameterRegistry.gen.{h,cpp}`; 235 parámetros: 226 físicos · 3 extendidos ·
> 6 virtuales). Paridad verificada por `WebUI/tests/registryGen.test.js`; jobs CI dedicados
> `schema-validation` y `registry-generation` (Fase 7). Ver `docs/fase1_registry.md`.
> Vitest: 96 files / 4605 tests / 0 fallos.

### Fase 2: ParameterStore Transaccional, FSM MIDI y Feature Flags
- [x] Implementar `ParameterStore` con `PendingTransaction` (TTL, revisiones, transactionId, rollback e inspección depurable de estado).
- [x] Implementar `HardwareMidiService` con FSM de puerto y `SysExAssembler` independiente.
- [x] Introducir **Feature Flag de comparación paralela** (`comparisonMode`) con diff estructurado.

> **2026-08-09 — Completado.** Módulos UMD: `WebUI/js/parameter_store.js`, `hardware_midi_service.js`,
> `sysex_assembler.js` + integración `bridge-parameter-store.js`. Confirmación explícita por eco NRPN
> (dedup UI/Hardware, sin bucles), sweep TTL 300ms con rollback tipado (`parameter_edit`/`patch_load`/
> `localstorage_migration`), FSM de puerto con guardas y ensamblador SysEx independiente. Ver `docs/fase2_parameter_store.md`.
> Vitest: 87 files / 4455 tests / 0 fallos.

### Fase 3: Sanitización DOM, ASCII y Manejo de Errores Tipados
- [x] Auditar sinks dinámicos HTML no escapados y migrar a `textContent` en `MIDI Learn`, monitores SysEx y visores de parches.
- [x] Implementar `PatchNameValidator` y `HardwareExporter`.
- [x] Implementar errores tipados para SysEx, MIDI e importación JSON.

> **2026-08-09 — Completado.** §4.1 (XSS DOM): escaper canónico `dom_sanitize.js`
> (única implementación; `browser_modals_templates`, `effects_presets_data` y
> `calibration_lab_format` delegan) + job CI `security-scan` sobre TODO `WebUI/js`
> (0 violaciones). §4.2 (ASCII hardware): `patch_name.js` con `PatchNameValidator`
> (16 chars ASCII imprimibles, bytes 223-238), `PatchNameRenderer` (textContent) y
> `HardwareExporter` (copia sin mutar el modelo), integrados en bridge-sysex,
> browser_modals y browser_io_parse_export. §4.3 (errores tipados):
> `typed_errors.js` (ABDError/SysExError/MidiError/PatchImportError + ERROR_CODES +
> asTypedError), integrado en bridge-sysex (SYSEX_NO_PORT/SYSEX_TIMEOUT/
> SYSEX_UNKNOWN_DUMP_TYPE), bridge_connection_midi (MIDI_NO_ACCESS) y
> browser_io_parse_import (IMPORT_INVALID_JSON/IMPORT_REJECTED/
> IMPORT_UNSUPPORTED_FORMAT). Vitest: 96 files / 4605 tests / 0 fallos.

### Fase 4: Batería de Tests de 3 Niveles y Property-Based Testing (Fuzzing)
- [x] Implementar `rawCodecEqual`, `semanticEqual` y `hardwareCanonicalEqual`.
- [x] Desarrollar suite de fuzzing/property-based testing con límites acotados de memoria y tiempo.

> **2026-08-09 — Completado (Niveles 1/2/3a + fuzzing).** Módulo UMD `WebUI/js/roundtrip_equality.js`
> (`window.RoundTripEquality`): Nivel 1 `rawCodecEqual` (invariante de codec Bytes→Pack→Unpack→Bytes),
> Nivel 2 `semanticEqual` (Patch→Parámetros→Patch descartando región reservada 223-241 y padding,
> tolerancia configurable, estabilidad de re-encode ±1 raw con rango válido de enums), Nivel 3a
> `hardwareCanonicalEqual` (corpus A–H con `exact_match`/`canonical_match`/`semantic_match`/
> `known_exception`), `fuzzRoundTrip` acotado (Max Payload 500B, Max Timeout 100ms/caso, PRNG
> determinista mulberry32). Integrado en el Calibration Lab (pestaña Round-Trip → A/B Compare con
> `runABCompareReport`, banco en letra 'A'-'H', `coerceBytes` para patches clonados por deepClone).
> `scripts/roundtrip_corpus.js` corre la batería sobre los 8 bancos A-H (1024 presets) con
> `--classify` (tabla por preset exact/canonical/semantic → 804/210/10 en el corpus de fábrica).
> **2026-08-10 — Nivel 3b (hardware-in-the-loop): Fases A–D ejecutadas con DM12 real.**
> Snapshot del edit buffer == preset A/0 de fábrica (**242/242 bytes, `exact_match`**);
> round-trip NRPN `filter.cutoff` → 100 leído de vuelta 100 (delta 0); virtuales ≥300
> rechazados sin emitir MIDI; nombre límite `Hi<>&"'ABCDEFGHI` (16 chars) round-trip
> idéntico en 223–238. Restauración del A/0 verificada. Reporte:
> `docs/reports/nivel3b-20260810.json`. **Cierre ✅ pendiente**: dumps completos de los
> 8 bancos + SHA-256 vs `schemas/corpus-hashes.json` y validación vía WebUI real
> (checklist A–E en `docs/fase4_nivel3b_hardware_in_the_loop.md`).
> Ver `docs/fase4_roundtrip_equality.md`.
> Vitest (2026-08-10): 103 files / 4688 tests / 0 fallos.

### Fase 5: Rendimiento Tiempo Real, Capabilities y Bridge WASM
- [x] Sustituir búsquedas dinámicas en `WASMBridge.cpp` por `std::array` e índices `ParameterIndex`.
- [x] Integrar `ModelCapabilities` para `dm12_hardware` vs `abyssmind_pro`.

> **Cierre (0.2.32):** mock APVTS sobre `std::array` indexado por `ParameterIndex` (slots fijos
> para los 10 parámetros internos fuera del registro), `updateParameters` solo bajo cambio
> (dirty-flag → cero lookups por string en el hilo de audio en estado estable), exports nuevos
> `wasm_set_parameter_index`/`wasm_get_parameter_index` (O(1)) y `wasm_set_model`/`wasm_get_model`
> (ModelCapabilities), verificados por el job `wasm-build`. `model_capabilities.js` (matriz §1.1)
> integrado en `wasm_bridge.js` (`getCapabilities()`).

### Fase 6: Retirada Progresiva de Compatibilidad Legacy
- [x] `Logger.deprecation(feature, info)` implementado (dedup por clave, gated por debug,
  restringido a hilos de control/tests — invariante §3) + `logger.test.js` (6 tests).
  `window.dualMidiBridge` pasa a ser **alias deprecado** (getter con `Logger.deprecation`
  deduplicado); el acceso canónico es `getBridge()` (instancia privada). **93 fuentes
  migradas** a `getBridge()` (0 refs residuales a `window.dualMidiBridge` en `WebUI/js/`),
  setup de vitest con fallback `getBridge` para tests, `bridgeAliasDeprecation.test.js`
  (5 tests) y baseline actualizada a 102 files / 4664 tests.

### Fase 7: Pipeline CI/CD Reproducible
- [x] Job `schema-validation` (`.github/workflows/schema-validation.yml`): ejecuta `validate_and_generate.ps1` y falla si los `.gen` commiteados divergen de las fuentes.
- [x] Job `registry-generation` (`.github/workflows/registry-generation.yml`): ejecuta el generador PURO `node scripts/registry_generator.js` en ubuntu-latest y verifica que los 4 artefactos `.gen` commiteados se regeneran **sin diffs de contenido** (ignorando `generatedAt`); complementario multiplataforma de `schema-validation` (Windows + PS1).
- [x] Job `vitest` + lint (`.github/workflows/webui-ci.yml`): suite completa de WebUI (4464 tests) y ESLint 0 errores.
- [x] Job `cpp-unit-tests` (`.github/workflows/dsp-ci.yml`): build Release + `ABDEep_UnitTests.exe` (3.689.164 assertions, 0 fallos).
- [x] Job `roundtrip-corpus` (`.github/workflows/roundtrip-corpus.yml`): valida los 8 factory banks A-H (1024 presets) contra el byte map + hashes SHA-256 (`--check-hashes`) — **0 errores** con la cabecera corregida de 10 bytes.
- [x] Job `fase4-corpus` (`.github/workflows/roundtrip-corpus.yml`): batería round-trip de Fase 4 sobre el corpus A–H completo (1024 presets, 3 niveles: `rawCodecEqual`/`semanticEqual`/`hardwareCanonicalEqual`) vía `node scripts/roundtrip_corpus.js --json` — 1024/1024 en los 3 niveles (804 exact · 210 canonical · 10 semantic).
- [x] Job `allocation-audit` (`.github/workflows/dsp-ci.yml`): invariante §3.1 en CI — 0 allocs en idle/poly12/max_all (3 escenarios auditados).
- [x] Job `benchmark` (`.github/workflows/dsp-ci.yml`): 18 escenarios × 3 repeticiones en runner dedicado (windows-2022) — presupuesto p95/p99/p999 definitivo en la sección 5.3 de `docs/baseline_fase0_v32.md`.
- [x] Job `security-scan` (`.github/workflows/security-scan.yml`): audit XSS estático sobre TODO `WebUI/js` (236 archivos) vía `scripts/security_scan.js` — falla si hay violaciones.
- [x] Job `property-fuzzing` (`.github/workflows/property-fuzzing.yml`): fuzzing acotado multi-seed vía `scripts/fuzz_roundtrip.js` (16 seeds deterministas × 500 casos = 8.000 casos — incluye seeds de casos límite: mínimos, máscaras de byte/16-bit, bits alternados y máximo uint32 —, registro real `registry.gen.js`, Max Payload 500B / Max Timeout 100ms/caso del plan) — **falla ante violaciones de propiedad** (codec_invariance / codec_payload_bound / codec_throws / decode_encode_stability); los timeouts (dependientes del reloj    de pared) se reportan como warning y no rompen CI.
- [x] Job `wasm-build` (`.github/workflows/wasm-build.yml`): compila el DSP a WebAssembly (emcmake + cmake --build wasm/build en ubuntu-latest con Emscripten; shim `juce_core` gitignored copiado desde JUCE 8.0.12 + patch `ThreadPriorities` como `wasm/build_wasm.bat`) y verifica con `scripts/check_wasm_build.js`: artefactos `abdeep_dsp.{js,wasm}` no vacíos con EXPORT_NAME `ABDEepDSP` y las 9 funciones de `EXPORTED_FUNCTIONS` en el glue, **≥ 9 exports de función en el .wasm** (con `-O3 --strip-all` Emscripten minifica los nombres de export del binario — el conteo es la invariante), **sección Memory con `initial >= 512` páginas (32 MiB)** = reserva fija §3.4 de `wasminitengine()` y **invariante fuente**: `WasmBridge.cpp` preasigna `gAudioBuffer` en init y no reasigna por bloque si la capacidad alcanza (`getNumSamples() < numSamples`). Falla con `::error::wasm-build` si cualquier invariante se rompe.
- [x] Job `pluginval` (`.github/workflows/pluginval.yml`): valida el plugin VST3 en windows-2022 con **Tracktion/pluginval pinneda a v1.0.4** (asset `pluginval_Windows.zip`, determinismo como JUCE 8.0.12 y Emscripten 3.1.64): build del target `ABDEep_Standalone_VST3` (FORMATS Standalone VST3, bundle-directorio `*_artefacts/Release/VST3/*.vst3` con moduleinfo.json + DLL x86_64-win) y validación con la invocación canónica de `scripts/verify_release.ps1` — `--strictness-level 5 --seed 42 --validate "<vst3>"`. Falla con `::error::pluginval` si la validación no pasa (ALL TESTS PASSED esperado, mismo estándar que el checklist §17 de `plugin_quality_checklist.md`). **Con esto Fase 7 queda 100% completada.**
- 🔎 **Verificación documental (`.github/workflows/docs-verification.yml`):** el job CI `docs-verification` comprueba que los 12 jobs de Fase 7 listados aquí coinciden con `docs/baseline_fase0_v32.md` §7 (mismo contrato) y que cada job tiene su workflow real — falla ante cualquier divergencia entre plan y doc.

> **2026-08-09 — registry-generation completado.** Verificación local end-to-end de los pasos
> exactos del job: `node scripts/registry_generator.js` → exit 0, 4 artefactos regenerados,
> `git diff --exit-code --ignore-matching-lines='generatedAt'` → 0 diffs de contenido
> (solo cambia el timestamp). Guardia de una sola línea en `data.json` incluida (mismo
> criterio que `schema-validation`).

> **2026-08-09 — Cierre documental de Fase 7 (3 jobs completados).** Los jobs
> `property-fuzzing` (16 seeds × 500 = 8.000 casos), `fase4-corpus` (batería round-trip
> A–H, 1024 presets, 3 niveles) y `registry-generation` (generador puro, 0 diffs de
> contenido) quedan documentados con detalle (workflow, runner, verificación y
> resultados) en `docs/baseline_fase0_v32.md` §7 «CI — estado de Fase 7». Todos
> verificados en local: property-fuzzing 8.000 casos → 0 violaciones/timeouts;
> fase4-corpus 1024/1024 en los 3 niveles (804 exact · 210 canonical · 10 semantic);
> registry-generation exit 0 con 0 diffs de contenido.

> **2026-08-09 — Fase 7 COMPLETADA (último job: pluginval).** Nuevo
> `.github/workflows/pluginval.yml` (windows-2022): build del target
> `ABDEep_Standalone_VST3` + validación con pluginval v1.0.4 pinneda,
> `--strictness-level 5 --seed 42 --validate` (invocación canónica de
> `scripts/verify_release.ps1`). Verificado localmente: artefacto VST3 bundle
> presente en `build/ABDEep_Standalone_artefacts/Release/VST3/ABD Eep.vst3`
> (DLL x86_64-win 10.9 MB) y descarga del asset `pluginval_Windows.zip` v1.0.4
> (HTTP 200, 2.4 MB). `vst3val` no existe como repo público (404) — pluginval
> sigue siendo la herramienta canónica. Todos los checkboxes de Fase 7 marcados.

> **2026-08-09 — roundtrip-corpus completado.** Con la corrección de cabecera de 10 bytes
> (0.2.4) el validador queda en **0 errores / 0 warnings en los 1024 presets** (antes: 146
> errores FX falsos por la desalineación de 8→10 bytes) y los hashes SHA-256 del corpus
> (A-H) coinciden con `schemas/corpus-hashes.json`. El job falla ante cualquier violación
> del mapeo o alteración de los bancos (corpus inmutable). Ver `docs/baseline_fase0_v32.md` §4 y §7.

---

## 🧪 8. Criterios de Aceptación Definitivos

1. **Schema Validation:** $100\%$ de C++, JS y docs compilados desde `schemaVersion: 1` validado.
2. **Ciclo de Vida Transaccional:** $0$ bucles de realimentación UI/Hardware gracias a deduplicación por TTL y confirmación explícita con rollback tipado.
3. **Invariantes Tiempo Real:** $0$ allocations, $0$ búsquedas por string, $0$ logs, $0$ locks en audio; cumplimiento de $\text{p95}$, $\text{p99}$ y $\text{p999}$ en $\mu\text{s}$.
4. **Seguridad DOM y ASCII:** $0$ datos externos en sinks HTML dinámicos no escapados; sanitización ASCII segura.
5. **Round-Trip y Fuzzing Verde:** Pases en `rawCodecEqual`, `semanticEqual`, `hardwareCanonicalEqual` y fuzzing generativo acotado.
6. **Feature Flags y Rollback:** Transición gradual con modo de comparación paralela legacy/nuevo validada antes de la retirada final de compatibilidad.
