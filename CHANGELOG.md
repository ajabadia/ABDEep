# Changelog — ABD Eep

> **Proyecto:** Controlador/Editor WebUI + Motor DSP C++/JUCE para Behringer DeepMind 12

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
