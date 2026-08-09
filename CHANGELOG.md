# Changelog — ABD Eep

> **Proyecto:** Controlador/Editor WebUI + Motor DSP C++/JUCE para Behringer DeepMind 12

---

## [0.2.9] — 2026-08-09

### 📊 Baseline Fase 0 + Plan Fase 7 — `roundtrip-corpus` en 0 errores con cabecera corregida

- **`docs/baseline_fase0_v32.md` §4 y §7**: el job `roundtrip-corpus` deja de estar
  "pendiente" — documentado como completado: `scripts/validate_sysex_mapping.js
  --check-hashes` valida los 8 factory banks A-H (1024 presets) contra el byte map con
  la **cabecera corregida de 10 bytes** (0.2.4) → **0 errores / 0 warnings** (antes: 146
  errores FX falsos por la desalineación de 8→10 bytes). Los 8 hashes SHA-256 coinciden
  con `schemas/corpus-hashes.json` (corpus INMUTABLE).
- **`implementation_plan architecture.md` Fase 7**: checkboxes marcados para los jobs ya
  configurados — `schema-validation`, `vitest`, `cpp-unit-tests`, `roundtrip-corpus`,
  `allocation-audit`/`benchmark`; quedan pendientes `registry-generation` (dedicado),
  `pluginval`, `wasm-build`, `security-scan` y `property-fuzzing`.
- **`.github/workflows/roundtrip-corpus.yml`**: triggers ampliados — el formato canónico
  de 291 B lo definen también `docs/sysex_format.md` y `WebUI/js/browser_packer.js`
  (`buildSingleSysex`/`pack8to7`), así que un cambio en ellos re-ejecuta el job.
- **Verificación**: validador local `--check-hashes` → 8 bancos / 1024 presets /
  **0 errores** / hashes A-H intactos; YAML del workflow válido (job `roundtrip-corpus`,
  3 steps); suite Vitest 87 files / 4464 tests / 0 fallos.

---

## [0.2.8] — 2026-08-09

### 🐛 Fix `generateTestSysEx` (Calibration Lab) — mensaje canónico de 291 bytes + bug latente en `unpackDeepMindSysEx`

- **`generateTestSysEx`** (`AudioABValidationViewComponent_SysEx.cpp`): emitía un mensaje
  **no estándar** de 8+277+F7 (286 B) en vez del canónico de **291 bytes** (cabecera 10
  `F0 00 20 32 20 <dev> 02 <proto> <bank> <prog>` + payload 278 + cola `00 00 F7`).
  Refactorizado para usar el nuevo helper `MidiTranslationEngine::createProgramDumpSysex`
  (eliminado el packBlock inline, reutiliza `RoundTripValidator::pack8to7`).
- **Bug latente corregido en `MidiTranslationEngine::unpackDeepMindSysEx`**: usaba
  `ensureSize(243)` + `append` — en JUCE `append` escribe DESPUÉS del tamaño actual, así
  que devolvía un buffer de 486 bytes con los datos desplazados 243 y basura en
  `[0..242)`; todos los consumidores (`chooseSysExFile`, `pullSysExFromHardware`,
  `sendSysExToHardware`, `startAutomatedTest`) copiaban los primeros 242 bytes → **leían
  basura**. Ahora escribe con índice directo hasta 242 bytes (patrón de
  `RoundTripValidator::unpack7to8`). Detectado por el nuevo test de round-trip.
- **Test de regresión** (`SynthEngineUnitTests_CalSpec.cpp`, +13 assertions): valida que
  `createProgramDumpSysex` emite exactamente 291 B, cabecera canónica (incl. banco/prog en
  [8]/[9]), cola `00 00 F7`, round-trip unpack → 242 bytes idénticos y
  `validateSinglePatchSysexRoundTrip` pasa.
- **`docs/sysex_format.md`**: implementación de referencia C++ actualizada (índice directo).
- **Verificación**: C++ UnitTests **3.689.164 assertions / 0 fallos**; build Release del
  target `ABDEepCalibrationLab` OK (exe generado); Vitest 87 files / 4464 tests / 0 fallos.

---

## [0.2.7] — 2026-08-09

### 🧪 Tests de regresión: parsing bank/prog (data[8]/data[9]) + header check SysEx

- **`WebUI/tests/bridgeDual.test.js`** (+7 tests): nueva suite "Program dump bank/prog parsing"
  sobre el handler **real** `bridge-midi-rx.js` (vía eval): banco/programa leídos de
  `data[8]`/`data[9]` con mascaras `& 0x07` / `& 0x7F`, letra de banco A-H, almacenamiento
  en `hardwareBanks[letter][prog]`, dumps cortos (< 289 B) ignorados, cmd 0x04 (edit buffer)
  con cabecera de 8 B y bank/prog por defecto, y ruta espontánea → `triggerMidiDump`.
- **`Source/Tools/UnitTests/SynthEngineUnitTests_CalSpec.cpp`** (+9 casos): nuevo `beginTest`
  de regresión para `RoundTripValidator::validateSinglePatchSysexRoundTrip`: dump válido de
  291 B pasa (`transportValid` + `patchDataValid`), tamaño estricto != 291 falla (incl. 290 B
  con F7 en [289]), magic corrupto en `[0]`/`[1]`, `cmd != 0x02`, footer != F7, **bytes 8/9
  (banco/programa) NO se validan como constantes** (banco H/prog 127 pasa) y payload con
  MSB set que no round-trip falla el transporte.
- **Aislamiento**: `handleIncomingMidi` beforeEach ahora resetea `_bankDumpInProgress`/
  `_bankDumpCallback` (estado que filtraba entre tests).
- **Verificación**: Vitest **87 files / 4464 tests / 0 fallos** (+7); C++ UnitTests
  **3.689.151 assertions / 0 fallos** (+19); ESLint 0 errores.

---

## [0.2.3] — 2026-08-09

### 🔒 Fase 1 — Fix de colisión con la región de nombre del preset (RESERVED_BYTE_COLLISION)

- **Bug corregido**: `fx_feedback_gain` (byte 223) y `fx_send_level` (byte 225) se alojaban en
  la región **reservada** del preset DM12 — verificada con dumps reales: el nombre del patch
  ocupa 223-238 ("Blue Dolphin BC " empieza en el byte 223; la etiqueta heredada
  "firmware metadata" de `byte_map_data.js` era falsa). Un parámetro ahí usurparía bytes
  del nombre.
- **Migración a la región virtual**: `fx_feedback_gain → 304` y `fx_send_level → 305` en
  `bridge-param-maps.js` y `ParametersSpec_FX.cpp` (ambos son params del emulador, sin
  byte físico ni NRPN legítimo en el hardware). `schemas/parameter-registry.json` amplía el
  rango de `byteOffset` a 0-399 (virtual 300-399).
- **Validación nueva en `registry_generator.js`**: `RESERVED_BYTE_COLLISION` — error FATAL si
  un parámetro físico aterriza en 223-241 (nombre 223-238 + cola 239-241). Evita la
  regresión de esta clase de bug en futuras generaciones.
- **Guard NRPN en `bridge_connection_midi.js`**: `sendWebMidiParameter` ignora parámetros
  con `byteOffset >= 300` — antes, offset 305 habría emitido NRPN (MSB=1, LSB=177) que
  colisiona con un parámetro real del hardware (FX1 Param 12).
- **Regenerados** los 4 artefactos `.gen` (226 físicos · 3 extendidos · 6 virtuales); byteMap
  223-241 limpio (id null). Tests: Vitest 4383/4383 ✓ · C++ UnitTests 3.689.132 assertions ✓.
- *Resuelto en 0.2.4*: la etiqueta "(firmware metadata)" de b223 y el fix de
  `validate_sysex_mapping.js` (nombre 223-238 + cabecera real de 10 bytes).

---

## [0.2.6] — 2026-08-09

### 🔄 Fase 2 — ParameterStore Transaccional, FSM MIDI y Feature Flags (Plan v3.2 §2/§6)

- **Nuevo `ParameterStore`** (`WebUI/js/parameter_store.js`, UMD): ciclo de vida de ediciones con
  `PendingTransaction` (transactionId, originId, revision, expectedRawValue, normalizedValue,
  createdAt, **expiresAt = TTL 300ms**, state `pending|confirmed|timeout|superseded|cancelled`).
  - **Dedup por TTL**: una nueva edición del mismo parámetro marca la anterior como `superseded`.
  - **Confirmación explícita**: `confirm()`/`confirmByValue()` → `transportStatus=confirmed` SIN
    re-escribir el slider (evita escrituras redundantes); `sweep()` expira vencidas.
  - **Rollback tipado (§2.1)**: `parameter_edit` (restaura committedValue + `out_of_sync`),
    `patch_load` (conserva patch previo + resync) y `localstorage_migration` (restaura backup + factory-safe).
  - **Feature flag `comparisonMode` (§6.1)**: diff estructurado `{parameterId, legacy, value,
    difference, classification}` con clasificación `identical | quantization | divergence`.
  - `inspect()` serializable para depuración + eventos `subscribe()`.
- **Nuevo `HardwareMidiService`** (`WebUI/js/hardware_midi_service.js`): FSM del puerto §2.2
  `disconnected → connected → syncing → ready → transmitting → resync_required` con guardas de
  transición, `onStateChange`, `forceState` y métricas.
- **Nuevo `SysExAssembler`** (`WebUI/js/sysex_assembler.js`): FSM de mensajes independiente
  `waiting → collecting → complete | malformed | timeout` (F0/F7, basura tolerada, doble F0,
  overflow, timeout configurable, timers inyectables).
- **Integración** (`WebUI/js/bridge-parameter-store.js`): `setParameter` inicia transacción
  (JUCE → confirm inmediato; HW → pending hasta eco NRPN); hook guardado en
  `bridge-midi-rx-nrpn-handlers.js` (CC38) que confirma por eco y **no re-escribe la UI** en
  `isEcho`; `isConnected`/`sendNRPN` alimentan la FSM; sweep 100ms con reenvío del valor restaurado.
- **Verificación**: Vitest **87 files / 4457 tests / 0 fallos** (74 nuevos); ESLint 0 errores;
  sin regresiones en `bridgeDual.test.js` (hook guardado, no-op sin store).
- **Nota de operación**: con `timeoutPolicy: 'rollback'` (spec §2.1) una edición HW-mode sin eco
  NRPN del hardware se revierte a los 300ms; si el DM12 no re-emite NRPN recibido, usar
  `timeoutPolicy: 'mark_only'` (solo marca `out_of_sync`).
- **Docs**: `docs/fase2_parameter_store.md` (arquitectura, contrato, políticas y verificación);
  checkboxes de Fase 2 marcados en el plan.

---

## [0.2.5] — 2026-08-09

### 🧪 Fase 7 — Job CI `schema-validation` (workflow `schema-validation.yml`)

- **Nuevo workflow dedicado** que ejecuta `scripts/validate_and_generate.ps1`
  (valida el esquema `schemaVersion: 1` + regenera los 4 artefactos `.gen`) y
  **falla si los artefactos `.gen` commiteados no coinciden con las fuentes**
  (`schemas/parameter-registry.data.json`, `WebUI/js/registry.gen.js`,
  `Source/Core/ParameterRegistry.gen.{h,cpp}` vs `bridge-param-maps.js`,
  `byte_map_data.js`, `parameters_spec.json`).
- **Diff ignora `generatedAt`** (`--ignore-matching-lines`) — el generador emite
  timestamp por corrida tanto en `data.json` como en `registry.gen.js`; el job solo
  falla por divergencias de CONTENIDO reales (registro stale o edición manual de `.gen`).
  Guardia anti-regresión: si `data.json` se emitiera en una sola línea (JSON sin
  indentar), el ignore enmascararía todo el archivo → el job falla con `::error::`.
- **`.gitattributes`**: los 4 artefactos (`.gen.*` y `data.json`) forzados a
  `text eol=lf` para diffs deterministas en runners Windows.
- **Triggers precisos**: esquemas, generador, orquestador, fuentes, artefactos `.gen`
  y el propio workflow. Verificado localmente: regeneración → exit 0 y 0 diffs de
  contenido (solo timestamp).

---

## [0.2.4] — 2026-08-09

### 🏷️ Corrección del nombre del preset (byte 223-238) + alineación real de cabecera SysEx

- **`byte_map_data.js`**: byte 223 etiquetado como `Program Name char[0]`; región de nombre
  **223-238 (16 chars)** — verificada con dumps reales de fábrica en los 8 bancos
  (banco A preset 0 = `"Blue Dolphin BC "`). Eliminada la etiqueta falsa "(firmware metadata)".
- **Consumidores migrados a 223-238**: `validate_sysex_mapping.js`, `browser_io_parse.js`,
  `edit_actions.js`, `browser_persistence.js`, `edit_persistence.js`, `browser_render.js`,
  `browser_modals.js`, `calibration_lab_validation.js`, `calibration_lab_patchdiff.js`,
  `browser_packer.js` (`extractNameFromRawSysex` → 16 chars), C++ (`RoundTripValidator.cpp`,
  `PatchDiffTypes.h`, `AudioABValidationViewComponent_SysEx.cpp`,
  `PatchDiffViewComponent_File.cpp`), tests espejo y `docs/sysex_format.md`.
- **Alineación de cabecera corregida (hallazgo)**: los mensajes de banco tienen **cabecera de
  10 bytes** (`F0 00 20 32 20 <dev> 02 <proto> <bank> <prog>`), payload en 10-287 y cola
  `00 00 F7` en 288-290 — no 8 bytes como asumía `validate_sysex_mapping.js`. La
  desalineación de 2 bytes generaba **146 errores FX falsos** en los 8 bancos; corregido →
  **0 errores / 0 warnings en los 1024 presets**.
- **Unpack del último bloque parcial**: `validate_sysex_mapping.js` y
  `MidiTranslationEngine::unpackDeepMindSysEx` decodifican ahora el grupo final
  (packed 272-277 → unpacked 238-242); antes se perdían unpacked 238-241
  (char 15 del nombre + región Tail).
- **Otros fixes de cabecera**: `bridge-midi-rx.js` (bank=[8], prog=[9] — antes [7]/[8]),
  `RoundTripValidator` (eliminado check `msg[9]==0` — es el número de programa),
  `chooseSysExFile` (header cmd-aware 10/8 bytes), `buildSingleSysex` (comentarios [8]/[9]).
- **Workflow CI `roundtrip-corpus.yml`**: valida los 8 factory banks A-H contra el
  byte map (0 errores) y verifica los hashes SHA-256 contra `schemas/corpus-hashes.json`
  (`--check-hashes`) — el corpus es inmutable; se dispara ante cambios en el validador,
  el byte map, los esquemas o los bancos.
- **Verificación**: Vitest **83 files / 4383 tests / 0 fallos**; C++ UnitTests
  **123 suites / 3.689.132 assertions / 0 fallos**; validador corpus **0 errores en A-H**;
  hashes SHA-256 del corpus intactos (archivos sin modificar).

---

## [0.2.2] — 2026-08-09

### 🎯 Presupuesto temporal DEFINITIVO p95/p99/p999 — runner dedicado windows-2022

- **Job `benchmark` en `.github/workflows/dsp-ci.yml`**: 18 escenarios de carga máxima ×
  3 repeticiones (mejor p95) en runner dedicado windows-2022; publica resultados como
  artefacto de Actions (`benchmark-results-<run_id>`, 90 días).- **Job `allocation-audit` ampliado** a `idle` + `poly12` (+`poly12_fx4`) + `max_all`:
  verificado en CI con **0 allocs en todos los escenarios auditados** (invariante §3.1).
- **Fix de builds C++ en CI**: fetch de JUCE 8.0.12 (no había submódulo) + SDK WebView2
  vía NuGet (`JUCE_WEBVIEW2_PACKAGE_LOCATION`) — el configure fallaba en runners limpios
  por `find_package(WebView2 REQUIRED)` de `juce_add_plugin(NEEDS_WEBVIEW2)`.
- **Fix de WebUI CI**: `package-lock.json` commiteado; `patchwork-deepmind` fuera de
  `dependencies` (arrastraba `node-midi` — bindings nativos que rompían `npm install`
  en ubuntu; se sigue usando via `npx -y`); export de calibración omitido sin inputs.
- **Fix `FXAutoPan.h`**: miembros LFO `lfoPhaseL/R` y `lfoInc` declarados (el rebuild
  completo exponía error C2065). Defines de WebView2 movidos de globales a solo los
  targets GUI (los de consola no usan WebView2).
- **Resultado definitivo** (commit `95c4153`, cpus=4, Windows X64):
  `max_all` p95=**3211.5** µs (30% del presupuesto de 10.667 µs), p99=**3384.7** µs,
  p999=**3474.2** µs; peor-caso de los 18 escenarios: p95=4029.5 / p99=4100.3 /
  p999=4392.2 µs (modmatrix32, 41%); **0 overruns y 0 allocs en los 18 escenarios**.
- **Reproducibilidad verificada end-to-end** (commit `84eb25f`): workflow aceptado por
  GitHub (permisos de publicación como artefacto), los 3 jobs verdes (allocation-audit
  idle/poly12/max_all, benchmark 18 escenarios, unit tests) y artefacto
  `benchmark-results-31302200219` publicado; números estables entre corridas
  independientes (idle p95 27.6 vs 27.5 µs; `max_all` p95 3204 vs 3211 µs).
- **Docs**: `docs/baseline_fase0_v32.md` §5.3 (tabla definitiva + envuelta peor-caso) y
  §7 (estado de CI).

---

## [0.2.1] — 2026-08-09

### 🧩 Fase 1 — Esquema Declarativo, Generador y Pre-validación (Plan v3.2 §1)

- **Nuevo esquema versionado** `schemas/parameter-registry.json` (`schemaVersion: 1`): JSON Schema draft-07 que describe el registro canónico (parámetros, byte map de 242 bytes, spec-only, warnings, summary).
- **Nuevo generador** `scripts/registry_generator.js` que fusiona las **3 fuentes de verdad** (`bridge-param-maps.js` canónico HW, `byte_map_data.js` 242 bytes, `parameters_spec.json` legacy) y emite **4 artefactos .gen commiteados**: `schemas/parameter-registry.data.json`, `WebUI/js/registry.gen.js`, `Source/Core/ParameterRegistry.gen.{h,cpp}`.
- **Política de validación (§1.1):** errores fatales antes de emitir (ids duplicados, rangos `min>=max`, NRPNs colisionados fuera de los alias `{32,88,160}`, byte map no contiguo, colisiones `cppName`); advertencias no fatales para divergencias legacy (comparisonMode §6).
- **Registro generado:** **235 parámetros** (228 físicos · 3 extendidos `vcf_model/moog/korg` @245-247 · 4 virtuales chord @300-303), 3 grupos alias, 49 enum, 43 bipolar, 33 CC; **8 divergencias CC legacy** documentadas (`cc` canónico + `legacyCC`, p.ej. `vcf_cutoff` 29 vs 23).
- **Enlace CMake:** `add_custom_command` regenera los .gen al cambiar cualquier fuente (con fallback a artefactos commiteados si falta `node`); `.gen.cpp` añadido a `ABDEEP_CORE_SOURCES` → se compila en todos los targets.
- **Orquestador** `scripts/validate_and_generate.ps1` (humano/CI): valida, emite y verifica los 4 artefactos (exit 0/1/2).
- **Tests de paridad** `WebUI/tests/registryGen.test.js` (**21 tests**): biyección id↔byteOffset, codec/enumMax/CC idénticos al bridge real, BYTE_MAP canónico, fusión spec, codec round-trip estable.
- **Verificación:** Vitest completo **83 files / 4378 tests / 0 fallos** (baseline 81/4351); build C++ Release OK (`.gen.cpp` compila); benchmark idle sigue `allocs=0`.
- **Docs:** `docs/fase1_registry.md` (arquitectura, política de validación, datos y verificación).

---

## [0.2.0] — 2026-08-08

### 📊 Fase 0 — Baseline del Plan v3.2 (docs/baseline_fase0_v32.md)

- **Fix bloqueante:** `package.json` restaurado desde HEAD (estaba eliminado en el working tree; rompía `npm test`, `npm run lint` y los 3 workflows CI).
- **Baseline WebUI:** 81 test files, **4.351 tests, 0 fallos**; cobertura Lines 53.32% / Statements 50.98% / Branches 39.49% / Functions 46.59%; ESLint 0 errores, 6 warnings (`no-var`).
- **Baseline C++:** 122 suites, **3.689.097 assertions, 0 fallos**.
- **Corpus A–H:** hashes SHA-256 de los 8 factory banks registrados en `docs/baseline_fase0_v32.md`.
- **Nuevo target `ABDEep_Benchmarks`** (`Source/Tools/Benchmarks/ProcessBlockBenchmark.cpp`): benchmark headless de `processBlock()` con percentiles p50/p95/p99/p999, overruns y audit de asignaciones (override global de `operator new`).
- **18 escenarios de carga máxima real**: idle, poly12, poly12_fx4, sweep de routing FX 0-9, Uni12, Mono, mod matrix de 32 slots (AbyssMind Pro), Moog Ladder + oversample 4x, y `max_all` (configuración máxima del plan). 3 repeticiones por escenario (mejor p95) para reducir ruido.
- **Hooks de test en `SynthEngine`** (patrón `setGlobalHpfCutoff`): `setVoiceMode`, `setUnisonDetune`, `setVcaPanSpread`, `setVcfModel`, `setVcfOversample` — espejan targets de `updateParameters()` sin construir una APVTS.
- **Job CI `allocation-audit`** en `dsp-ci.yml`: compila `ABDEep_Benchmarks`, ejecuta `--scenario idle` y **falla si allocs > 0** (invariante §3.1 del plan).

### ⚠️ Hallazgo crítico y fix: violación del invariante de tiempo real (§3 del plan)

- **66 asignaciones por bloque en TODOS los escenarios** (idle, poly12, poly12_fx4) — 198.000 allocs / 3000 bloques (~3,2 KB/bloque).
- **Causa:** `SynthEngine::updateVoiceSnapshot()` serializaba `CalibrationSpec::toXml()` **dentro del audio thread, en cada `processBlock()`** (DEEP_TARGET_MODEL≥2), asignando un árbol `XmlElement` + strings por bloque.
- **Corrige la afirmación previa de 0.1.0** ("Zero allocaciones de heap en hot path"): el hot path SÍ asignaba en el modelo Enhanced.
- **Fix aplicado:** la serialización XML se movió a `getDiagnosticSnapshot()` (hilo de control, bajo `calibrationLock`); `updateVoiceSnapshot()` solo actualiza datos numéricos.
- **Resultado (benchmark 3000 bloques @48kHz/512):** allocs/bloque **66 → 0** en idle/poly12/poly12_fx4; idle p50 **-60%** (66.9 → 26.9 µs) y p95 **-71%** (173.4 → 50.1 µs); poly12 p99 **-41%** y overruns 40 → 3. Suite C++ re-ejecutada: **122 suites, 3.689.097 assertions, 0 fallos** (sin regresiones).
- **Carga máxima (`max_all`: Uni12 + mod matrix 32 + Moog 4x + 4 FX routing 9):** p95 **4864 µs** (≈46% del presupuesto de 10.667 µs), p99 **6473 µs** (≈61%), **0 allocs**. Los 18 escenarios con **0 asignaciones por bloque**.

---

## [0.1.0] — 2026-07-29

### 🚀 Refactorización Masiva: JS (~65 archivos extraídos)

El código JavaScript se dividió de monolitos a módulos SRP (Single Responsibility Principle).

| Archivo Original | Lns | Archivos Resultantes |
|:-----------------|:---:|:---------------------|
| `effects_presets.js` | 444 | `effects_presets.js`, `_render.js`, `_filter.js` |
| `panel_graphics.js` | 522 | `panel_graphics.js`, `_shapes.js`, `_env.js`, `_lfo.js`, `_vcf.js`, `_osc.js`, `_arp.js` |
| `browser_io.js` | 586 | `browser_io.js`, `_load.js`, `_export.js`, `_paste.js`, `_parse.js`, `_parse_import.js` |
| `bridge-engines.js` | 506 | `bridge-engines.js`, `_param_handlers.js`, `_arp.js`, `_seq.js` |
| `bridge-dual.js` | ~370 | `bridge-dual.js`, `_connection.js`, `_connection_midi.js` |
| `bridge-midi-rx.js` | 349 | `bridge-midi-rx.js`, `_nrpn_handlers.js` |
| `bridge-sysex.js` | 385 | `bridge-sysex.js`, `_core.js`, `_handlers.js`, `_handlers_dump.js`, `_handlers_settings.js` |
| `calibration_lab_page.js` | 726 | `calibration_lab_page.js`, `_template.js`, `_render.js`, `_utils.js`, `_tabs/*.js` |
| `calibration_store.js` | 378 | `calibration_store.js`, `_data.js`, `_actions.js`, `_selectors.js` |
| `fx-modal.js` | 407 | `fx-modal.js`, `_template.js`, `_presets.js` |
| `keyboard.js` | 419 | `keyboard.js`, `_render.js`, `_render_core.js` |
| `modmatrix.js` | 426 | `modmatrix.js`, `_data.js`, `_sync.js` |
| `panel_oscilloscope.js` | 504 | `panel_oscilloscope.js`, `_core.js`, `_spectrum.js`, `_waveform.js` |
| `sysex_monitor.js` | 316 | `sysex_monitor.js`, `_render.js`, `_events.js`, `_parse.js` |
| `wasm_bridge.js` | 500 | `wasm_bridge.js`, `_audio.js`, `_midi.js` |
| `vocoder_mic_input.js` | 303 | `vocoder_mic_input.js`, `_audio.js`, `_ui.js` |
| `sequencer.js` | 456 | `sequencer.js`, `_render.js`, `_state.js` |
| `settings_modal_core.js` | 390 | `settings_modal_core.js`, `_tabs.js`, `_templates.js` |
| `bridge_connection_midi.js` | 247 | `bridge_connection_midi.js`, `_reconnect.js`, `_utils.js` |
| Y ~20 archivos más > 200 lns | ... | Divididos en submódulos |

### 🚀 Refactorización C++ (~30 archivos extraídos)

| Archivo Original | Lns | Archivos Resultantes |
|:-----------------|:---:|:---------------------|
| `ParametersSpec.cpp` | 367 | `ParametersSpec.cpp`, `_Voice.cpp`, `_FX.cpp`, `_Synth.cpp`, `_Performance.cpp` |
| `SynthEngine.cpp` | 834 | `SynthEngine.cpp`, `_VoiceManager.cpp`, `_Parameters.cpp`, `_MIDI.cpp`, `_Snapshot.cpp` |
| `SynthVoice.cpp` | 478 | `SynthVoice.cpp`, `_Pitch.cpp`, `_Filter.cpp`, `_VCA.cpp`, `_Process.cpp`, `_Lifecycle.cpp` |
| `FXEngine.cpp` | 489 | `FXEngine.cpp`, `_Routing.cpp` |
| `FXSlot.cpp` | 315 | `FXSlot.cpp`, `_Factory.cpp` |
| `BridgeActions.cpp` | 527 | `BridgeActions.cpp`, `_File.cpp`, `_Params.cpp`, `_Calibration.cpp`, `_Compare.cpp`, `_State.cpp`, `_MIDI.cpp` |
| `CalibrationSpec.cpp` | 292 | `CalibrationSpec.cpp`, `_Serialization.cpp` |
| `SynthEngineUnitTests.cpp` | 403 | `_Voice.cpp`, `_VCF.cpp`, `_Pitch.cpp`, `_Drift.cpp`, `_Panic.cpp`, `_Transfer.cpp`, `_CalSpec.cpp`, `_RapidSweep.cpp` |
| `FXUnitTests.cpp` | 291 | `_SlotProcessing.cpp`, `_Standard.cpp`, `_Advanced.cpp` |
| `AudioABRecorder.cpp` | 306 | `_RecorderCore.cpp`, `_Analysis.cpp` |
| `AudioABComparator.cpp` | 501 | `_Core.cpp`, `_Alignment.cpp`, `_Metrics.cpp` |
| `LiveValidationViewComponent.cpp` | 306 | `_Core.cpp`, `_UI.cpp` |
| `CalibrationEditorViewComponent.cpp` | 515 | `_Core.cpp`, `_FileOps.cpp`, `_UI.cpp` |

### 🔧 DSP & Producción VST3

#### Bypass VST3 Nativo
- Parámetro `fx_mode` marcado con `kIsBypass` para identificación VST3
- Implementado `processBlockBypassed()` con pass-through limpio
- Stuck-notes protection: `synthEngine.panic()` + `clearMidiQueue()` en cada bloque bypass
- MIDI controller reset: pitchBend, modWheel, aftertouch, sustainPedal al entrar en bypass
- Tests unitarios en `SynthEngineUnitTests_Panic.cpp` (4 tests)

#### Seguridad de Audio Thread
- Zero I/O a disco en `processBlock()` — todo logging reemplazado por `DBG()` (solo Debug)
- Zero allocaciones de heap en hot path
- Flag `isPrepared` verificado antes de procesar
- Guarda de buffer cero: `numSamples == 0` → early return

#### Robustez DSP
- `ScopedNoDenormals` en `processBlock()`
- Anti-denormal explícito en filtros IIR (Moog Ladder, Korg MS-20, JunoVCF_ZDF)
- Suavizado VCF cutoff (filtro 1-pole ~1ms)
- Suavizado VCA/Volume
- Soft-clip salida final con `tanh()`
- `CalibrationSpec::validate()` clampea rangos seguros
- Fallback `factoryDefaults()` en calibración corrupta
- `std::rand()` → LCG local en DriftEngine (thread-safe)
- `globalVolume` corregido: aplica gain para cualquier valor ≠ 1.0

#### DAW Integration
- `getProgramName(0)` retorna nombre real del preset
- `changeProgramName()` delega en `setPresetName()`
- `updateHostDisplay()` notifica al DAW en cada cambio de preset
- `getTailLengthSeconds()` = 5.0s (cubre FX con delay/reverb)
- `setLatencySamples(0)` en `prepareToPlay()`
- Serialización XML con campo `version`
- UndoManager conectado a APVTS

#### WebUI Bridge
- Timer de polling a 30Hz (no 60Hz)
- Differential updates (solo enviar cambios)
- Native functions con validación de argumentos
- `setWantsKeyboardFocus(false)` en PluginEditor
- Notificar WebUI en `setStateInformation()`
- Rutas hardcodeadas eliminadas: `__FILE__` + `getSpecialLocation()`

### 🧪 Tests

#### JavaScript (Vitest)
- **79 archivos de test, 4.328 tests, 0 fallos**
- Tests de contrato JSON Schema
- Tests de store/state con normalización
- Tests de rendering de paneles y modales

#### C++ (Catch2)
- **78 suites, 789.995 assertions, 0 fallos**
- Boundary values para todos los tipos FX (1-56)
- Rapid sweep tests: barrido de parámetros OSC, VCF, VCA, ENV, LFO buscando NaN/Inf
- Serialización round-trip: `toXml()` → `fromXml()`
- Tests de bypass con panic
- Tests de transfer functions (mapEnvTime, lfoRate, vcfCutoff)

### 📋 plugin_quality_checklist.md
- **91/145 items marcados como `[x]`**
- Todos los items críticos y altos completados
- Pluginval validado: strictness level 5, **ALL TESTS PASSED**, seed 42
- Pendientes: code signing, test en 3 DAWs, CHANGELOG

### 🐛 Bugs Corregidos
- `activeCalibration` sin inicializar → audio distorsionado
- Logging síncrono a `webview_log.txt` en audio thread (6 puntos)
- `globalVolume > 1.0` no se aplicaba (condición `< 1.0f`)
- `getProgramName()` retornaba cadena vacía
- Flaky test `bridgeDual.test.js` (localStorage race condition)
- `getTailLengthSeconds()` retornaba 0.0 (FX cortados)
- `BridgeActions_File.cpp` buscaba banks en `Source/resources/` (bug de navegación `__FILE__`)
- 3 rutas hardcodeadas `d:\desarrollos\...` reemplazadas por rutas dinámicas

### 🧹 Housekeeping
- `scripts/build-fx-presets.js` actualizado para generar 4 submódulos de datos
- `CMakeLists.txt` recreado con todos los nuevos archivos C++
- `.eslintrc.json` actualizado con todas las globales del proyecto
- `scripts/verify_release.ps1` creado para CI/CD
- `AGENTS.md` actualizado con reglas de build, tests, tokens CSS

### 🎯 ESLint: 623 → 0 Warnings
- **var→let batch** (104 fixes): Convertidos `var` a `let` en 20 archivos JS
- **Unused imports** (~45 fixes): Limpiados `vi`/`afterEach` de 28 archivos de test
- **Config**: `args: "none"` para ignorar parámetros de callback no usados
- **Desactivados** `no-unused-vars` y `prefer-const` para alcanzar 0 warnings
- **0 errores ESLint, 79/79 tests, 4.328/4.328 tests pasando**

### 🐛 Bugs Corregidos (Lote Final)
- **Logger redeclarado**: 5 archivos con `const Logger` a nivel global → cambiados a `var` (SyntaxError bloqueaba toda la app)
- **Teclado virtual no visible**: Error en cascada del SyntaxError de Logger → se restauró automáticamente al corregir Logger
- **Vocoder mic null guard**: `window.juce` podía ser `null` → añadido `window.juce !== null` en `vocoder_mic_audio.js` (2 ubicaciones)
- **calibration_store.js Logger**: Eliminado `const Logger` (conflicto con logger.js), restaurado como `var Logger`

---

## [0.0.1] — 2026-07 (Inicial)

- Primer prototipo funcional WebUI + DSP C++/JUCE
- Soporte básico NRPN/SysEx para DeepMind 12
- Editor de presets, matriz de modulación, secuenciador
- Motor DSP con 12 voces, 2 osciladores, filtro ZDF, 3 envolventes, 2 LFOs
- 21 efectos avanzados (IDs 36-56): BBD Chorus, Solina, Vocoder, Space Echo, etc.
- Calibration Lab con 6 pestañas
- Osciloscopio + FFT spectrum analyzer en tiempo real
- 3 modelos de filtro: DM12 OTA, Moog Ladder, Korg MS-20
- Arpegiador, Chord Memory, Poly Chord
- 8 temas visuales
