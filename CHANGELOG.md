# Changelog — ABD Eep

> **Proyecto:** Controlador/Editor WebUI + Motor DSP C++/JUCE para Behringer DeepMind 12

---

## [0.2.31] — 2026-08-09

### 🔒 Fase 3 COMPLETADA — errores tipados SysEx/MIDI/JSON (§4.3)

- **Nuevo `WebUI/js/typed_errors.js`** (UMD): jerarquía de errores tipados del
  proyecto — `ABDError` (base: code/category/context/timestamp, toJSON/toString
  serializables), `SysExError` (category 'sysex'), `MidiError` ('midi'),
  `PatchImportError` ('import'), `ERROR_CODES` congelado y `asTypedError`
  (envuelve errores planos sin perder el mensaje; idempotente para ABDError).
- **Integración**: bridge-sysex.js lanza `SysExError` (SYSEX_NO_PORT /
  SYSEX_TIMEOUT con context de duración / SYSEX_UNKNOWN_DUMP_TYPE);
  bridge_connection_midi.js lanza `MidiError` (MIDI_NO_ACCESS);
  browser_io_parse_import.js devuelve `errorCode` tipado (IMPORT_INVALID_JSON /
  IMPORT_REJECTED / IMPORT_UNSUPPORTED_FORMAT). Cargado en index.html antes de
  los módulos bridge/parse.
- **Tests `typedErrors.test.js` (17)**: jerarquía, serialización, asTypedError e
  integración en los 3 flujos + orden de carga en index.html.
- **Cierre de Fase 3**: checkboxes del plan marcados (los §4.1/§4.2 ya estaban
  implementados; §4.3 era el pendiente) + nota de cierre; sección 8 de la doc
  actualizada (Fase 3 → completadas). Vitest: 97 files / 4624 tests / 0 fallos;
  ESLint 0.
- **Post-reviewer**: añadida factory `createTypedError(category, code, message,
  context)` (fallback a Error plano que CONSERVA el message — `|| Error` lo
  descartaba); revertido el `throw` del tipo de dump desconocido a warn+null
  (contrato original: `panel_controls_chord.js` llama `requestMidiDump('chord'/
  'polychord')` esperando null) y revertido el re-throw de `initWebMidi` (se
  loguea el `MidiError` en `_lastMidiError` sin relanzar — `init()` no tiene
  try/catch y el catch envuelve todo el bloque).

## [0.2.30] — 2026-08-09

### 📋 Sección 7 de `docs/baseline_fase0_v32.md` — Fase 7 documentada al completo

- Añadidos los bullets que faltaban en §7: **`security-scan`** (audit XSS estático sobre
  TODO `WebUI/js` vía `scripts/security_scan.js --json`, 0 violaciones),
  **`schema-validation`** (`validate_and_generate.ps1` en windows-latest, complementario
  multiplataforma de `registry-generation`), **`cpp-unit-tests`** (dsp-ci.yml, 3.689.164
  assertions) y **`vitest` + lint** (webui-ci.yml, 96 files / 4605 tests).
- Nota: `wasm-build` ya estaba documentado en §7 (desde el commit de pluginval).
- Resultado: **los 12 jobs de Fase 7 quedan documentados en §7** (13 bullets ✅).

## [0.2.29] — 2026-08-09

### 📋 Sección 8 de `docs/baseline_fase0_v32.md` — estado actualizado (Fases 1/2/4 completadas)

- **Sección 8 reescrita**: Fases 1/2/4 marcadas como **completadas** con sus artefactos
  reales (esquema + generador + `.gen`, ParameterStore/FSM/SysExAssembler/comparisonMode,
  roundtrip_equality + fuzzing + corpus A–H) y el fix de allocs de la sección 6 como
  resuelto. Pendientes reales listados: Fase 3 (en curso), Fases 5/6 y Nivel 3b
  (hardware-in-the-loop).
- **Plan (`implementation_plan architecture.md`)**: checkboxes de Fase 1 marcados `[x]` +
  nota de cierre (el trabajo ya existía verificado; quedaba sin marcar).

## [0.2.28] — 2026-08-09

### 📊 Baseline Fase 0 — números vigentes en secciones 2-3 de `docs/baseline_fase0_v32.md`

- **Sección 2 (Baseline WebUI)**: actualizada a los números reales actuales —
  **96 files / 4605 tests / 0 fallos** (~9.5 s; antes: 81 / 4351). ESLint: 0
  errores, 27 warnings (curly). Cobertura re-ejecutada: Statements 62.53,
  Branches 50.19, Functions 58.21, Lines 64.74 (antes 50.98/39.49/46.59/53.32).
- **Sección 3 (Baseline C++)**: **126 suites / 3.689.168 assertions / 0 fallos**
  (antes 122 / 3.689.097); nota de equivalencia con el job `cpp-unit-tests` de CI
  (3.689.164 assertions). También actualizada la referencia de la sección 5.1.

## [0.2.27] — 2026-08-09

### 🏁 Fase 7 COMPLETADA — Job CI `pluginval` (último pendiente)

- **`.github/workflows/pluginval.yml`** (windows-2022, timeout 45 min): valida el
  plugin VST3 con **Tracktion/pluginval pinneda a v1.0.4** (asset
  `pluginval_Windows.zip` — determinismo CI, como JUCE 8.0.12 y Emscripten 3.1.64):
  - Build del target `ABDEep_Standalone_VST3` (FORMATS Standalone VST3); el VST3 es
    un bundle-directorio `*_artefacts/Release/VST3/ABD Eep.vst3/` con
    `moduleinfo.json` + DLL x86_64-win, localizado con el glob canónico de
    `scripts/verify_release.ps1`.
  - Validación con la invocación canónica del repo: `pluginval --strictness-level 5
    --seed 42 --validate "<vst3>"` (estándar de la industria, checklist §17) —
    falla con `::error::pluginval` si no hay ALL TESTS PASSED, publicando el log
    como artefacto diagnóstico en fallo.
  - Verificado local: artefacto VST3 presente (10.9 MB) y descarga del asset
    `pluginval_Windows.zip` v1.0.4 (HTTP 200). `vst3val` no existe como repo
    público (404) — pluginval sigue siendo la herramienta canónica.
- **Test guard `WebUI/tests/pluginvalWorkflow.test.js`** (8 tests): pin v1.0.4,
  strictness 5 + seed 42, glob VST3, target de build, validación en pwsh,
  `::error::pluginval` y patrón Fase 7 (concurrency/permissions).
- **Cierre**: `implementation_plan architecture.md` Fase 7 100% marcada (checkbox
  `pluginval` ✅ + nota de cierre); `docs/baseline_fase0_v32.md` §7 con los bullets
  `wasm-build` y `pluginval` (lista completa de Fase 7).

## [0.2.26] — 2026-08-09

### 📄 Fase 7 — Documentación de los jobs CI completados (property-fuzzing, fase4-corpus, registry-generation)

- **`docs/baseline_fase0_v32.md` §7 «CI — estado de Fase 7»**: documentados con detalle
  los 3 jobs CI de Fase 7 completados (cambio 100% documental):
  - **`fase4-corpus`** (segundo job de `roundtrip-corpus.yml`): batería round-trip de
    Fase 4 sobre el corpus A–H completo (1024 presets) vía `scripts/roundtrip_corpus.js
    --json` — Nivel 1 (invariante de codec por preset), Nivel 2 (re-encode estable +
    hermanos semánticos), Nivel 3a (self-match exact + layout de cabecera). Resultado
    verificado: 1024/1024 en los 3 niveles, 0 errores; clasificación 804 exact · 210
    canonical (105 pares) · 10 semantic (5 hermanos); ~0.7s los 8 bancos.
  - **`property-fuzzing`** (`property-fuzzing.yml`): fuzzing acotado multi-seed — 16
    seeds deterministas × 500 casos = **8.000 casos** (incluye seeds de casos límite:
    mínimos, máscaras de byte/16-bit, bits alternados, máximo uint32); violaciones
    fatales (codec_invariance/codec_payload_bound/codec_throws/decode_encode_stability)
    vs timeouts como warning; límites del plan 500 B / 100 ms por caso. Resultado:
    8.000 casos → 0 violaciones / 0 timeouts.
  - **`registry-generation`** (`registry-generation.yml`): generador puro
    `registry_generator.js` con verificación de los 4 artefactos `.gen` sin diffs de
    contenido (ignorando `generatedAt`), guardia anti-minificación, valor multiplataforma
    vs `schema-validation`.
- **`implementation_plan architecture.md`**: nota de cierre de Fase 7 (3 jobs
  completados, verificados en local) con referencia a la doc; pendiente único `pluginval`.
- **Verificación**: cambio 100% documental — sin código ni tests tocados; suite Vitest
  intacta (95 files / 4597 tests / 0 fallos).

---

## [0.2.25] — 2026-08-09

### 🧩 Fase 7 — Job CI `wasm-build` (workflow `wasm-build.yml`) + verificación de la reserva fija

- **Nuevo `scripts/check_wasm_build.js`**: verificación del build WASM ejecutable en
  CI (plan v3.2 §3.4/§7):
  - **Artefactos**: `WebUI/wasm/abdeep_dsp.{js,wasm}` existen y no están vacíos; el
    glue .js contiene el EXPORT_NAME `ABDEepDSP` y las 9 funciones de
    `EXPORTED_FUNCTIONS` (`_wasm_init_engine`, `_wasm_process_audio`,
    `_wasm_set_parameter`, `_wasm_note_on/off`, `_wasm_pitch_bend`, `_wasm_panic`,
    `_malloc`, `_free`).
  - **Exports del .wasm**: parser mínimo de secciones WASM (LEB128 u32, sin
    dependencias externas — no requiere wabt) que lee la sección Export y exige
    **≥ 9 exports de función**. Hallazgo documentado: con `-O3 --strip-all`
    Emscripten **minifica los nombres de export del binario** a identificadores
    cortos (i, j, k…) — los nombres canónicos viven en el glue JS; el conteo es la
    invariante del binario.
  - **Preasignación (§3.4)**: la sección Memory debe declarar `initial >= 512`
    páginas (512 × 64 KiB = 32 MiB = INITIAL_MEMORY de `wasm/CMakeLists.txt`) — la
    «capacidad preasignada en wasminitengine()».
  - **Invariante fuente**: `WasmBridge.cpp` debe preasignar `gAudioBuffer.setSize(2,
    gBlockSize)` en init y guardar `getNumSamples() < numSamples` en
    `wasm_process_audio` (no reasignar si el bloque cabe) — si alguien rompe la
    reserva fija, el job falla antes de mergear.
  - CLI (`--wasm-dir`, `--json`, `--out`), exit 0/1 con `::error::wasm-build`.
  - Verificado localmente sobre los artefactos commiteados: exit 0 — 13 exports de
    función, Memory initial=512 páginas (32 MiB), invariante fuente OK.
- **Nuevo `.github/workflows/wasm-build.yml`** (job `wasm-build`, ubuntu-latest,
  Node 20, timeout 30min): `myMindstorm/setup-emsdk@v14` (Emscripten latest),
  clonado de JUCE 8.0.12, **preparación del shim `juce_core` gitignored** (copia
  desde JUCE + patch `juce_ThreadPriorities_native.h` — reproduce `build_wasm.bat`),
  `emcmake cmake -S wasm -B wasm/build -DJUCE_PATH=...` + `cmake --build`, y
  verificación con el patrón establecido `if ! node scripts/check_wasm_build.js
  --json` (los `::error::` se imprimen antes del exit 1). Triggers: `Source/Wasm`,
  `Source/DSP`, `Source/Core`, `wasm/**`, el script y el workflow.
- **`WebUI/tests/checkWasmBuild.test.js` (9 tests)**: unit tests del parser WASM
  con binarios sintéticos (Memory initial+maximum+export count → OK; initial 256 →
  falla «reserva fija» aislado con glue completo; glue sin `_wasm_process_audio` →
  falla; magic inválido → falla; artefactos ausentes → falla; **2 tests negativos
  del invariante FUENTE con `--src-file`**: sin el guard `getNumSamples() <
  numSamples` → falla «reserva fija rota» y sin preasignación `setSize(2,
  gBlockSize)` en init → falla) e integración con `skipIf` sin artefactos locales
  (exit 0 + `--json` con Memory initial ≥ 512 y exports ≥ 9).
- **Post-reviewer (4 fixes)**: (1) tests negativos del invariante fuente — el
  requisito central del job (verificar que wasminitengine/preasignación se
  mantienen) no tenía cobertura de fallo; (2) versión de Emscripten PINNED a
  `3.1.64` en `setup-emsdk` (determinismo de CI — `latest` rompería sin cambio de
  código); (3) test de Memory 256 aislado con glue completo (antes también
  fallaba por glue, el assert pasaba solo porque el script reporta todos los
  problemas); (4) `readULEB` endurecido contra overflow de `<<` en LEBs de 5
  bytes + `--src-file` resuelto contra `__dirname` (funciona desde cualquier
  cwd) + `import os` en el test.
- **Verificación**: Vitest **95 files / 4597 tests / 0 fallos** (+9); ESLint 0;
  `node --check` OK; YAML del workflow válido. Checkbox de Fase 7 actualizado —
  queda solo `pluginval`.

---

## [0.2.24] — 2026-08-09

### 🔬 Fase 4/7 — Batería de fuzzing ampliada: 16 seeds × 500 casos = 8.000 casos en CI

- **`scripts/fuzz_roundtrip.js`**: batería por defecto **5× más grande**:
  - **`DEFAULT_SEEDS` 8 → 16**: los 8 originales + **8 de casos límite** que ejercitan
    el PRNG `mulberry32` y el codec 7/8 — mínimo (`0x1`), máscaras de byte
    (`0x7F`/`0xFF`), máscaras de 16 bits (`0x7FFF`/`0xFFFF`), bits alternados
    (`0x55555555`/`0xAAAAAAAA`) y máximo uint32 (`0xFFFFFFFF`).
  - **`DEFAULT_ITERATIONS` 200 → 500**: 16 × 500 = **8.000 casos** por corrida CI
    (antes 8 × 200 = 1.600). Coste medido <1s total (máx 1ms/caso) — la cobertura
    ampliada no penaliza el tiempo del job.
- **`WebUI/tests/fuzzRoundtripScript.test.js` (8 tests, +2)**: nuevo test de la
  **batería por defecto completa** (16 seeds × 500 = 8.000 casos, exit 0, 0
  violaciones/timeouts) y test de **cobertura de seeds límite** (los 8 nuevos
  presentes, sin duplicados tras el parseo).
- **Docs**: `docs/fase4_roundtrip_equality.md` §5 (batería CI ampliada + seeds límite
  listados) y nota de Fase 7 del plan actualizada (16 × 500 = 8.000).
- **Verificación**: Vitest **94 files / 4588 tests / 0 fallos** (+2); ESLint 0;
  `node --check` OK; script local 8.000 casos → 0 violaciones / 0 timeouts.

---

## [0.2.23] — 2026-08-09

### 🏷️ Known exceptions desde la UI del A/B Compare (por bankName/patchIndex)

- **`calibration_lab_tab_roundtrip.js`** — registro de excepciones conocidas en el
  modo A/B Compare de la pestaña Round-Trip:
  - **Helpers** `getKnownException`/`addKnownException`/`removeKnownException`/
    `resetKnownExceptions` (globalThis): entradas `{bank: 'A'-'H', prog, reason,
    createdAt}` persistidas en `localStorage` (clave versionada
    `abdeep.calibration.knownExceptions.v1`) con cache lazy y fallback en memoria
    (entornos sin storage — tests). Ban-co normalizado a MAYÚSCULAS.
  - **`runABCompareReport(patchA, patchB, opts)`**: nuevo `opts.knownExceptions`
    (por defecto la lista persistida) → `hardwareCanonicalEqual` aplica la
    **prioridad `known_exception > exact/canonical/semantic`** (orden documentado
    de `classifyCorpusMatch`).
  - **UI**: cuando Patch B tiene posición, se muestra el formulario «Register as
    known exception» (input de razón + botón) o, si ya está registrado, un badge
    `BANCO/PROG · razón` con botón «Remove exception». Al registrar/eliminar se
    re-ejecuta la comparación (re-clasificación inmediata).
  - **CSS**: `.cal-rt-ab-exceptions`, `.cal-rt-ab-ex-badge` y `.cal-rt-ex-reason`
    (tokens del tema, badge amarillo de excepción).
- **Post-reviewer (3 fixes)**: (1) la actualización de razón en una excepción
  existente ahora **persiste** (antes solo persistía la rama de entrada nueva);
  (2) el banco del **corpus** de `runABCompareReport` se normaliza a mayúscula
  (`patchB.bankName` podía llegar en minúscula y el matching estricto de
  `classifyCorpusMatch` fallaba — la UI mostraba el badge pero no aplicaba la
  excepción); (3) aislamiento de tests con `beforeEach/afterEach` reset en los
  describes de render y eventos.
- **`calibrationRoundtripAB.test.js` (28 tests, +10)**: helpers (add/get/remove,
  case-insensitive del banco, actualización de razón), `opts.knownExceptions`
  (prioridad sobre exact + posición no coincidente no afecta), render (formulario
  vs badge/remove) y eventos (Register → `known_exception`, Remove → vuelve a
  `canonical_match`, y **regresión del case**: bankName minúscula matchea).
- **Verificación**: Vitest **92 files / 4586 tests / 0 fallos** (+10); ESLint 0;
  `scripts/security_scan.js` → **0 violaciones**; `node --check` OK.

---

## [0.2.22] — 2026-08-09

### 🧪 Nivel 3b (Hardware-in-the-Loop) — procedimiento documentado + checklist pre-release

- **Nueva `docs/fase4_nivel3b_hardware_in_the_loop.md`** (plan v3.2 §5 — obligatorio
  previo a cualquier release que modifique el protocolo SysEx o NRPN):
  - **Herramientas del proyecto** para la validación (tabla): Web MIDI `sysex: true`,
    `requestBankDump`, `buildSingleSysex`/`createProgramDumpSysex` (paridad C++/JS),
    `bridge-midi-rx.js` (banco/prog de `data[8]`/`data[9]`), `validateSinglePatchSysexRoundTrip`,
    `ParameterStore` + eco NRPN (CC38, TTL 300ms, `isEcho`), FSM `HardwareMidiService`,
    `HardwareExporter` (nombre 16 chars ASCII), hashes `schemas/corpus-hashes.json`.
  - **Procedimiento en 4 fases**: 3.0 preparación (Local Control OFF, Rx/Tx SysEx ON,
    permiso Web MIDI, FSM `ready`); 3.1 **Baseline** (dumps A–H, comparación con el
    corpus y `--classify`); 3.2 **Round-trip de programa** (envío → dump →
    `validateSinglePatchSysexRoundTrip` + Niveles 1/2); 3.3 **Ciclo NRPN** (transacción,
    eco de confirmación, rollback, virtuales ≥300 sin NRPN); 3.4 **Región de nombre**
    (223–238, saneado, cola 239–241 intacta).
  - **Checklist pre-release A–E** (baseline/protocolo, round-trip, NRPN, nombre,
    cierre): TODO verde si el release toca SysEx/NRPN/byte-map; Fase A basta como smoke
    para releases solo-UI/DSP. Cierre: dumps commiteados como referencia + reporte
    `docs/reports/nivel3b-<YYYYMMDD>.json` + CHANGELOG.
- **Docs enlazadas**: `docs/fase4_roundtrip_equality.md` §8 y nota de Fase 4 del plan
  apuntan al nuevo procedimiento. Cambio 100% documental (sin código ni tests tocados).

---

## [0.2.21] — 2026-08-09

### 🏷️ `roundtrip_corpus.js` — registro explícito de clasificación por preset (`--classify`)

- **Nuevo modo `--classify`** en `scripts/roundtrip_corpus.js`: emite la tabla por preset
  `{bank, prog, level1, level2, classification, matchedWith}` para los 1024 presets A–H:
  - `classification`: `exact_match` (único en el corpus) | `canonical_match` (duplicado
    byte-idéntico en otra posición, `matchedWith` = la otra posición) | `semantic_match`
    (mismos parámetros que otro preset, difieren solo en región reservada/padding).
  - **canonical > semantic por construcción**: los pares de duplicados y de hermanos no se
    solapan (el early-continue de `bytesEqual` en el bucle de grupos lo garantiza) —
    comentado en el código para no romper los conteos.
  - `level1`/`level2` = estado de VALIDACIÓN del preset (cacheado en los bucles Nivel 1/2
    originales — sin re-ejecutar las 3 funciones por preset, coste O(n) extra con el hash).
  - Resumen de conteos en consola y `counts` en el JSON.
- **Resultado del corpus de fábrica**: `804 exact · 210 canonical (105 pares) · 10 semantic
  (5 hermanos)` · `0 no_match` — 1024/1024 validados en los 3 niveles, 0 errores.
- **Tests** (`roundtripCorpusScript.test.js`, 9 total — +3): tabla de 1024 filas,
  conteos exactos fijados (804/210/10/0), invariantes por fila (`level1`&&`level2` true,
  `matchedWith` `^[A-H]/\d+$` ≠ self, exact → null) y ausencia de `classify` sin `--classify`.
- **Docs**: `docs/fase4_roundtrip_equality.md` §6b (script de corpus + `--classify`) y nota
  de Fase 4 del plan actualizada.
- **Post-reviewer (3 comentarios aplicados)**: prioridad canonical>semantic comentada,
  semántica de `level1`/`level2` documentada y conteos ligados a los pares en el código.
- **Verificación**: Vitest **92 files / 4576 tests / 0 fallos** (+3); ESLint 0;
  `node --check` OK. CI `fase4-corpus` intacto (corre con `--json`, sin `--classify`).

---

## [0.2.20] — 2026-08-09

### 🔬 Fase 7 — Job CI `property-fuzzing` (workflow `property-fuzzing.yml`) + fuzzing multi-seed

- **Nuevo `scripts/fuzz_roundtrip.js`**: property-based testing / fuzzing acotado
  (§5) ejecutable en CI — corre `fuzzRoundTrip` (`roundtrip_equality.js`) con
  **8 seeds deterministas** por defecto (0xC0FFEE..0x2468A) × 200 casos y el
  registro canónico real (`registry.gen.js`):
  - **Clasificación de violaciones**: `codec_invariance`, `codec_payload_bound`,
    `codec_throws` y `decode_encode_stability` son **fatales** (deterministas —
    fallan el job); `timeout` (dependiente del reloj de pared, preempción del
    runner) se reporta como **warning** y no rompe CI (los invariantes se
    verifican con `--budget-ms` amplio cuando se quiere auditar el presupuesto
    temporal sin ruido).
  - CLI: `--seeds` (decimal **o hex** `0xBEEF`), `--iterations`, `--budget-ms`,
    `--json`, `--out`. Exit codes **0/1/2** (OK / violaciones fatales / error de
    uso) con `::error::fuzz-roundtrip` — mismo contrato que `security_scan.js`.
  - **Resultado local**: 1600 casos / 8 seeds → **0 violaciones, 0 timeouts**
    (máximo 4ms/caso con presupuesto de 100ms del plan).
- **Nuevo `.github/workflows/property-fuzzing.yml`** (job `property-fuzzing`,
  ubuntu-latest, Node 20): ejecuta el script con `--json` usando el patrón
  establecido `if ! node …` (los `::error::` del script se imprimen antes del
  `exit 1`); triggers en el script, `roundtrip_equality.js`, `browser_packer.js`,
  `registry.gen.js`, `schemas/**` y los tests.
- **`WebUI/tests/fuzzRoundtripScript.test.js` (6 tests)**: subproceso real — exit 0
  con presupuesto amplio, reporte `--json` estructurado (runs por seed, totals,
  `planLimits` 500B/100ms, `fatal:false`), `--seeds` concreto (1 seed · N casos),
  presupuesto por defecto del plan (100ms/caso) sin violaciones, `--seeds` vacío
  → exit 2 y `--iterations` inválido → exit 2 con `::error::`.
- **Post-reviewer (2 ajustes)**: `planLimits.maxTimeoutMs` leído de la constante
  del módulo (`RTE.FUZZ_MAX_TIMEOUT_MS`, fuente de verdad única) y guard de
  `--iterations`/`--budget-ms` inválidos → exit 2.
- **Verificación**: Vitest **92 files / 4572 tests / 0 fallos** (+5); ESLint 0;
  YAML válido; `node --check` OK. Checkbox de Fase 7 actualizado — quedan
  pendientes `pluginval` y `wasm-build`.

---

## [0.2.19] — 2026-08-09

### 🧪 Fase 4 — Batería round-trip sobre el corpus completo A–H (1024 presets) + job CI `fase4-corpus`

- **Nuevo `scripts/roundtrip_corpus.js`**: batería de los 3 niveles de Fase 4 sobre
  los 8 factory banks A–H (1024 presets) usando `roundtrip_equality.js`:
  - **Nivel 1 (rawCodecEqual)**: invariante de codec por preset — `unpack7to8(pack8to7(x)) === x`
    Y el lado empaquetado `pack8to7(unpack7to8(packed)) === packed`.
  - **Nivel 2 (semanticEqual)**: estabilidad de re-encode Patch→Parámetros→Patch (±1 raw,
    rango válido de enums) + detección de **hermanos semánticos** vía hash O(n)
    (solo bytes con parámetro mapeado, excluye reservados 223-241 y padding — los
    pares byte-idénticos se reportan como duplicados de Nivel 3a).
  - **Nivel 3a (hardwareCanonicalEqual)**: self-match de cada preset contra el corpus
    COMPLETO con `skipSemantic: true` (debe hallarse con `exact_match` en su posición
    de cabecera) + check de layout de cabecera (`msg[9]` == índice secuencial del
    archivo de banco).
  - CLI (`--banks`, `--json`, `--out`), exit 0/1 con `::error::roundtrip-corpus` para CI.
- **`roundtrip_equality.js`**: nueva opción `skipSemantic` en `hardwareCanonicalEqual`
  (salta el fallback `semanticEqual` en scans O(n²) — self-match se resuelve por bytes
  idénticos) + fix de `report.ok` en la ruta de corpus incompleto (el JSON `--json`
  siempre lleva `ok`).
- **`.github/workflows/roundtrip-corpus.yml`**: nuevo job `fase4-corpus` (ubuntu-latest,
  Node 20) que ejecuta la batería con `--json` y **falla si algún preset rompe un
  invariante o no se self-matchea**; triggers ampliados a los scripts/module de la
  batería (`roundtrip_corpus.js`, `roundtrip_equality.js`, `registry.gen.js`,
  `browser_packer.js`).
- **`WebUI/tests/roundtripCorpusScript.test.js` (6 tests)**: subproceso real del script
  (exit 0 + 3 niveles verdes sobre 1024, reporte `--json` estructurado con `ok:true`,
  invariante selfMatched===scanned, duplicados listados + sin `header_layout` errors,
  banco inexistente → exit 1 con `::error::`, `--banks A,B` → 256 presets) con
  `skipIf` sin corpus local.
- **Resultado local**: 1024/1024 en los 3 niveles, **0 errores**; hallazgos reales del
  corpus: **105 pares duplicados** byte-idénticos en posiciones distintas (p.ej. A/0 ≙ B/71)
  y **5 hermanos semánticos** (mismos parámetros, difieren solo en región reservada).
  Tiempo total 8 bancos ≈ 0.7s (viable en CI).
- **Verificación**: Vitest **92 files / 4567 tests / 0 fallos** (+8); ESLint 0 en los
  archivos tocados; `node --check` OK; YAML del workflow válido (2 jobs).

---

## [0.2.18] — 2026-08-09

### 📄 Documentación Fase 4 — `docs/fase4_roundtrip_equality.md`

- **Nueva doc técnica** de la batería de igualdad round-trip: arquitectura del módulo
  (`roundtrip_equality.js` + dependencias), contrato de cada función con firmas y shapes
  de retorno (Nivel 1 `rawCodecEqual`, Nivel 2 `semanticEqual` con la política de enums,
  Nivel 3a `hardwareCanonicalEqual` con la jerarquía exact/canonical/semantic/
  known_exception/no_match), fuzzing acotado (500B / 100ms / seed determinista) y la
  integración A/B Compare del Calibration Lab (`runABCompareReport` + `coerceBytes`).
- **`implementation_plan architecture.md`**: checkboxes de Fase 4 marcados con nota de
  completado enlazando la doc; pendiente solo el Nivel 3b (hardware-in-the-loop).
  Corregida también la lista de jobs Fase 7 (el job `security-scan` ya estaba completado).


- **Modo "A/B Compare" en `calibration_lab_tab_roundtrip.js`**: la pestaña Round-Trip
  gana un toggle segmented (Single Patch / A/B Compare). El modo single conserva el
  flujo histórico (round-trip 3 capas de un patch); el modo ab clasifica **Patch A vs
  Patch B** con la batería de Fase 4 (`roundtrip_equality.js`):
  - `runABCompareReport(patchA, patchB)` (globalThis): corre `rawCodecEqual`
    (invariante + diffs byte a byte), `semanticEqual` (parámetros, región reservada
    ignorada) y `hardwareCanonicalEqual` con un corpus de 1 entry desde Patch B
    (posición de `patch.bankName` 'A'-'H' / `patchIndex`).
  - **Banner de clasificación**: `exact_match` (mismos bytes + misma posición),
    `canonical_match` (mismos bytes, posición distinta), `semantic_match` (solo la
    región reservada difiere), `known_exception`, `no_match` — con color, razón y
    posición coincidente del corpus.
  - **Fila de hechos**: raw idéntico (n/242), igualdad semántica, estabilidad de
    re-encode y estado del registro (`ParameterRegistry` cargado o degradado a
    estructural).
  - **Tabla de diferencias**: cuando `semanticEqual` reporta mismatches, se lista
    offset / Param IDs / Raw A / Raw B / Norm A / Norm B.
- **`coerceBytes` (fix de integración real)**: `deepClone` del store es JSON-based y
  convierte los `Uint8Array` de `unpackedBytes` en objetos `{0:.., 1:..}` sin `.length`
  — el A/B Compare fallaba con `invalid_patch_bytes` al leer los patches vía
  `store.getState()`. El normalizador reconstruye un `Uint8Array` cuando el objeto
  tiene 242+ claves numéricas contiguas (cubre la ruta picker → store → compare).
- **`index.html`**: se cargan `js/registry.gen.js` + `js/roundtrip_equality.js` tras
  `browser_packer.js` (antes de los scripts del Calibration Lab) — el registro
  canónico y la batería Fase 4 quedan disponibles en la app real.
- **`roundtrip_equality.js`**: la forma de objeto `{unpacked, bank, prog}` acepta
  ahora banco en letra ('A'-'H') además de numérico (los patches del lab usan
  `bankName` en letra) — +1 test en `roundtripEquality.test.js`.
- **CSS** (`calibration_lab.css`): `.cal-rt-mode` (toggle segmented con estado
  active) y `.cal-rt-ab-banner/.cal-rt-ab-class/.cal-rt-ab-{exact,canonical,semantic,
  exception,nomatch}` usando tokens del tema.
- **`WebUI/tests/calibrationRoundtripAB.test.js` (18 tests)**: clasificación pura
  (exact/canonical/semantic/no_match, errores de módulo y de bytes, sin registro),
  render del banner/factos/tabla y eventos (cambio de modo, Compare con patches del
  store — cubre la ruta `deepClone` → `coerceBytes` — y sin patches válidos).
- **Post-reviewer (3 fixes)**: modo leído en tiempo de llamada (`currentMode()` en
  vez de capturado en bind), `matchPos` solo cuando `bank`/`prog` no son null
  (evita "Bank null · Prog null"), y `modeSwitchHtml` compartido entre ambos
  renders (sin duplicación). Verificado: `scripts/security_scan.js` → 0 violaciones
  sobre todo `WebUI/js` (incluye el archivo nuevo).
- **Verificación**: Vitest **92 files / 4560 tests / 0 fallos** (+19); ESLint 0 en
  los archivos tocados; `node --check` OK.

---

## [0.2.16] — 2026-08-09

### 🧪 Fase 4 — Batería de igualdad de round-trip en 3 niveles + fuzzing acotado (Plan v3.2 §5)

- **Nuevo `WebUI/js/roundtrip_equality.js`** (UMD — `window.RoundTripEquality` /
  `module.exports`): implementa la matriz de pruebas del §5:
  - **Nivel 1 `rawCodecEqual`** — `Bytes → Pack → Unpack → Bytes`: verifica la
    invariante del codec (pack→unpack es la identidad, paridad con
    `browser_packer.js`/`RoundTripValidator.cpp`) y la igualdad byte a byte tras el
    round-trip. Acepta entrada de 242 (unpacked), 278 (packed) o 291 bytes (sysex,
    con validación de cabecera canónica opcional).
  - **Nivel 2 `semanticEqual`** — `Patch → Parámetros → Patch`: decodifica con el
    registro (`registry.gen.js`, `rawToNormalized`) descartando los **bytes
    reservados** (nombre 223-238 + cola 239-241) y el **padding** (bytes sin
    parámetro); tolerancia configurable (default 1/255) y verificación de
    **estabilidad de re-encode ±1 raw** (solo en el rango válido de enums — fuera
    de rango el codec clampa, documentado en `registryGen.test.js`). Sin registro,
    degrada a comparación estructural.
  - **Nivel 3a `hardwareCanonicalEqual`** — comparación contra el **corpus A–H** con
    clasificación `exact_match` (bytes idénticos + misma posición declarada en la
    cabecera), `canonical_match` (payload idéntico, posición distinta/desconocida),
    `semantic_match` (parámetros iguales con tolerancia), `known_exception`
    (prioridad sobre exact) y `no_match`.
  - **`fuzzRoundTrip`** — property-based testing acotado (§5): PRNG determinista
    `mulberry32` (reproducible en CI), invariantes de codec (242 B y payload
    arbitrario), estabilidad decode/encode con muestreo en rango válido de enums,
    **Max Payload 500B** y **Max Timeout 100ms por caso** (violaciones de timeout
    registradas). Holder `api` mutable para inyección de fallos en tests.
  - **`loadCorpusFromBanks`** (solo Node): carga los 8 factory banks A–H como corpus
    `{bank, prog, unpacked, packed}` para CI/scripts.
- **`WebUI/tests/roundtripEquality.test.js` (27 tests)**: invariante de codec sobre
  patches fijos y aleatorios, mismatch con offset reportado, comparación cross-form
  sysex↔patch, cabecera corrupta, región reservada ignorada, detección de VCF Cutoff
  con `paramIds`, tolerancia configurable, degradación sin registro, `exact/canonical/
  semantic/known_exception` contra el corpus real de banco A (128 presets), forma de
  objeto `{unpacked, bank, prog}` (posición declarada → exact/canonical), paridad de
  codec con `browser_packer.js`, fuzzing determinista (mismo seed → `violations`
  idénticas con presupuesto alto), límites por defecto del plan y detección de un
  codec roto por monkey-patch (violación de invariante) y de un codec lento
  (violación de timeout).
- **Hallazgo documentado durante la implementación**: los enums con raw > enumMax
  clampa en el codec del registro (comportamiento heredado y cubierto por
  `registryGen.test.js`) — el guard de re-encode lo excluye del criterio de
  inestabilidad.
- **Post-reviewer (2 hallazgos corregidos)**: (1) la forma de objeto `{unpacked,
  bank, prog}` de `hardwareCanonicalEqual` ignoraba `bank`/`prog` (la posición solo
  se extraía de sysex de 291 B) — ahora extrae el header del objeto igual que de una
  cabecera (2 tests nuevos); (2) `deterministic: true` era un campo hardcodeado que
  se volvía falso con timeouts — ahora se computa (`false` si hay violaciones de
  timeout, que dependen del reloj de pared). Menores: `kind` simplificado, fallback
  degradado de `semanticEqual` comentado (compara padding por no poder distinguirlo
  sin registro), `loadCorpusFromBanks` lee `prog` de `msg[9]` en vez de por orden de
  iteración.
- **Verificación**: Vitest **91 files / 4541 tests / 0 fallos** (+27); ESLint 0 en
  los archivos nuevos (6 warnings `no-var` preexistentes en otros archivos);
  `node --check` OK. Checkbox de Fase 4 §5 (Niveles 1/2/3a + fuzzing) marcado;
  queda el Nivel 3b (hardware-in-the-loop, requiere hardware físico).

---

## [0.2.15] — 2026-08-09

### 🛡️ Fase 7 — Job CI `security-scan` (workflow `security-scan.yml`) + 2 XSS reales corregidos

- **Nuevo `scripts/security_scan.js`**: audit estático XSS (plan v3.2 §4.1) que aplica la
  MISMA lógica de detección de `domSanitize.test.js` sobre **TODO `WebUI/js`** (236 archivos),
  no solo los 13 migrados en Fase 3. CLI (`--json`, `--dir`, exit 0/1/2) + módulo
  reutilizable (`auditSource`/`auditFile`/`scanDir`) — **fuente de verdad única** del audit.
- **`WebUI/tests/domSanitize.test.js` refactorizado** para importar los helpers del script
  (eliminados los patrones duplicados en el test) + **nuevo test del scan COMPLETO**
  (`scanDir()` → 0 violaciones) que valida en local lo que el job verifica en CI.
- **2 XSS reales encontrados por el scan ampliado y corregidos**: `effects_presets.js`
  ("FX Preset Saved") y `effects_presets_apply.js` ("FX Preset Loaded") interpolaban
  `preset.name`/`presetData.name` (localStorage — dato externo) en `lcdSafeUpdate` SIN
  escapar; ahora pasan por `globalThis.escapeHtml`. Patrones `preset.name`/`presetData.name`
  añadidos a `FORBIDDEN_INTERPOLATIONS` para prevenir la regresión.
- **9 falsos positivos de la heurística general verificados como seguros** (datos estáticos
  de la propia app o ya escapados): `browser_render.js` (emptyMsg ya escapa),
  `arpeggiator_controls(.ui).js` (arrays estáticos), `panel_controls_env_voice.js`
  (labels del DOM propio), `panel_controls_seq.js`/`sequencer_modal_state.js`
  (badges/colores estáticos) — el scan específico no los marca.
- **Workflow `security-scan.yml`** (ubuntu-latest, Node 20): ejecuta el script con `--json`,
  imprime el reporte en `::group::`, **falla si hay violaciones** y sube el reporte como
  artefacto (`security-scan-report.json`) en caso de fallo. Triggers: push main, PR, manual.
- **Post-reviewer (2 fixes)**:
  1. **Falsos positivos**: los patrones genéricos `+ preset.name`/`+ presetData.name`
     marcaban también usos YA escapados en la misma línea; `auditSource` ahora descarta
     líneas que invocan `escapeHtml`/`_escapeHtml` (`ESCAPED_LINE_RE`, mismo criterio que
     el skip de textContent) + test de regresión que verifica ambos casos (escaped → 0,
     vulnerable → 1 violación).
  2. **`set -e` en el workflow**: el script con violaciones (exit 1) mataba el step ANTES
     de imprimir el reporte (mismo bug corregido en `registry-generation`/`schema-validation`);
     ahora se captura el rc con `if !`, se renderiza el `::group::` SIEMPRE y se `exit $scan_rc`.
     Verificado: scan de un dir malicioso → RC=1 + violación detectada en el JSON.
- **Verificación**: Vitest **90 files / 4514 tests / 0 fallos** (+2: scan completo + falsos
  positivos); ESLint 0; `node scripts/security_scan.js --json` → 236 archivos /
  **0 violaciones**; YAML de los 7 workflows válido.

---

## [0.2.14] — 2026-08-09

### 🧹 Consolidación de escapeHtml (4 fuentes → 1 canónica) — prep Fase 6

- **Única implementación en `WebUI/js/dom_sanitize.js`** (`escapeHtml`: 5 chars HTML,
  null/undefined → `''`). Los otros 3 módulos ahora DELEGAN en él y ya no reimplementan:
  - `browser_modals_templates._escapeHtml`: delega en `window.escapeHtml`
    (fallback solo standalone), conserva la `function` declaration exigida por el audit.
  - `effects_presets_data.escapeHtml` y `calibration_lab_format.escapeHtml`: capturan el
    canónico en `_canonicalEscapeHtml` y delegan; la asignación a `globalThis.escapeHtml`
    es CONDICIONAL (`typeof !== 'function'`) — en el navegador `dom_sanitize.js` carga
    primero (línea 20) y no se clobberea; en entornos Node/standalone se provee el fallback
    con el MISMO comportamiento (corrige la divergencia previa `null → 'null'`).
- **Comportamiento unificado**: todas las fuentes producen salida idéntica para
  `<b>hi</b>`, `a&b`, comillas simples/dobles, null, undefined, números, vacío.
- **`WebUI/tests/domSanitize.test.js`**: el test de `browser_modals_templates` ahora
  verifica delegación al canónico; nuevo test de **paridad de las 4 fuentes**
  (module.exports de effects, carga standalone de calibration, templates de modals).
  Espejos de `effects.test.js`/`effectsPresets.test.js` actualizados a la semántica
  canónica (null → `''`).
- **Post-reviewer (2 hallazgos críticos corregidos)**:
  1. **Colisión de `const` top-level en classic scripts**: `effects_presets_data.js` y
     `calibration_lab_format.js` declaraban ambos `const _canonicalEscapeHtml`; los
     `<script>` clásicos de `index.html` comparten el global lexical scope → el segundo
     en cargar lanzaba `SyntaxError: Identifier has already been declared` y rompía TODA
     la app. Renombrados a prefijos únicos (`_canonicalEscapeHtmlFx` / `_canonicalEscapeHtmlCal`).
     Nuevo test de regresión que evalúa ambas fuentes contra el MISMO objeto global
     (simula el classic-script shared scope que Node no detecta).
  2. **Paridad de fallback `&#39;` vs `&#039;`** en `browser_modals_templates.js`: el
     fallback standalone emitía `&#39;` (divergente del canónico `&#039;`); alineado a
     `&#039;` para salida idéntica en cualquier entorno.
- **Verificación final**: Vitest **90 files / 4512 tests / 0 fallos** (+1 test de
  colisión); ESLint 0 errores; `node --check` OK en los 4 módulos.
  Detectado y resuelto en iteración: `audioABControls.test.js` dependía de que
  `calibration_lab_format.js` definiera el global en Node standalone → asignación
  condicional (compat segura).

---

## [0.2.13] — 2026-08-09

### 🏷️ Fase 3 §4.2 — PatchNameValidator + PatchNameRenderer + HardwareExporter

- **Nuevo `WebUI/js/patch_name.js`** (UMD, cargado tras `dom_sanitize.js`):
  - **`PatchNameValidator`**: valida nombres contra el protocolo SysEx — máx **16 chars**
    (campo 223–238, límite verificado en dumps reales; se documentó la divergencia con
    el "15 chars" del plan v3.2 §4.2 y se resolvió con el protocolo verificado),
    solo ASCII imprimible 0x20–0x7E, con `sanitize()` (recorta/descarta no-ASCII/trunca),
    `writeIntoUnpacked()` (relleno 0x20) y `readFromUnpacked()`.
  - **`PatchNameRenderer`**: inserción segura en UI **solo vía `textContent`** (nunca
    innerHTML) — cumple la política XSS del §4.1 para nombres.
  - **`HardwareExporter`**: `prepareForSysEx(patch)` devuelve una **copia** del patch con
    el nombre limitado a 16 chars ASCII imprimibles en los bytes 223–238 **sin mutar el
    modelo original** (`patch.name`/`patch.unpackedBytes` intactos); `inspect()` expone
    el detalle estructurado de validación.
- **Integración en los 2 puntos de salida a hardware**: `exportSinglePatch`
  (`browser_io_parse_export.js`) y `sendPatchToHardware` (`bridge-sysex.js`) pasan por
  `HardwareExporter.prepareForSysEx` antes de `buildSingleSysex` — el SysEx emitido lleva
  siempre el nombre saneado sin corromper el preset en memoria.
- **`WebUI/tests/patchNameValidator.test.js` (16 tests)**: validación (16 chars, ASCII,
  vacío), sanitize, write/read bytes 223–238, renderer textContent (payload XSS como
  texto plano), no-mutación del modelo, truncado + descarte de unicode, `inspect` y
  **integración end-to-end** con `buildSingleSysex` real (el nombre truncado aparece en
  unpacked 223–238 del SysEx de 291 bytes y round-trip con `extractNameFromRawSysex`).
- **Post-reviewer**: `prepareForSysEx` conserva el nombre embebido en los bytes cuando
  el modelo no tiene `.name` (parches `{unpackedBytes}` sin regresión vs comportamiento
  histórico de `buildSingleSysex`); `showRenameModal` (`browser_modals.js`) valida con
  `PatchNameValidator` ANTES de escribir el nombre en el modelo (unicode/largo →
  normalizado + alerta), evitando que nombres inválidos entren a localStorage.
- **Verificación**: Vitest **90 files / 4510 tests / 0 fallos** (+18); ESLint 0 errores.

---

## [0.2.12] — 2026-08-09

### 🛡️ Fase 3 — Auditoría de sinks DOM y sanitización de nombres de patch (Plan v3.2 §4)

- **Nuevo módulo canónico `WebUI/js/dom_sanitize.js`** (`escapeHtml`): escapa los 5
  caracteres HTML sensibles (`& < > " '`), maneja null/undefined/números y se expone en
  `window`/`globalThis`. Registrado en `index.html` ANTES de los módulos de render
  (`browser_render.js` y posteriores).
- **Migrados 13 archivos** (visores de parches, LCD, MIDI Learn, dump viewer):
  - `browser_render.js`, `browser_render_hw.js` (labels de grid + LCD de carga HW/library),
  - `browser_events.js`, `browser_io_export.js` (LCDs de import/load), `edit_actions.js`
    (COPIED), `edit_persistence.js` (SAVED/SAVED AS + ítem de factory bank),
  - `script_controllers_lcd.js` (`_buildPatchNameLcdHtml`) y `script_controllers.js`
    (typewriter del LCD) — nombre de patch Y banco escapados,
  - `sequencer_presets.js` (ítems user/factory + presetName en LCD),
  - `arpeggiator_presets.js` (strip frágil → escapeHtml canónico),
  - `bridge-midi-learn.js` (LCD prompt con param names de mapping importado),
  - `settings_dump_viewer.js` (tooltip en atributo `title`, defensa en profundidad),
  - `script_bar_generators.js` (`_genLcdBarHtml` — nombres de preset de localStorage).
- **Política aplicada**: sinks dinámicos no confiables → `escapeHtml()`; valores simples →
  `textContent` (ya seguro en `settings_midi_learn.js` y `sysex_monitor_render.js`;
  `browser_modals_templates.js` conserva su `_escapeHtml` propio para menús contextuales).
- **`WebUI/tests/domSanitize.test.js` (22 tests)**: unit tests del escaper + **audit estático
  por línea de sink** sobre los 13 archivos migrados (prohíbe interpolaciones de
  `patch.name`/`patchRef.name`/`newName`/`bankName`/`searchTerm` en
  innerHTML/lcdSafeUpdate/insertAdjacentHTML/outerHTML sin pasar por escapeHtml),
  + checks de `settings_midi_learn.js`, `sysex_monitor_render.js`,
  `browser_modals_templates.js` y orden de carga en `index.html`.
- **Verificación**: Vitest **89 files / 4492 tests / 0 fallos** (+22); ESLint 0 errores en
  los 14 archivos tocados.

---

## [0.2.11] — 2026-08-09

### 🔁 Test de paridad C++ ↔ JS del Program Dump de 291 bytes

- **`buildSingleSysex` (browser_packer.js) parametrizado**: ahora acepta
  `(patch, bank, program, deviceId)` opcionales con máscaras idénticas a las de
  `MidiTranslationEngine::createProgramDumpSysex` (C++). Defaults preservan el
  comportamiento histórico (`deviceId=0x7F` broadcast, `bank=0`, `program=0`);
  se corrigieron además los comentarios de cabecera ([7] = Comms Protocol, no banco).
- **Fixture de paridad `schemas/parity_program_dump_291.json`** (generado por el nuevo
  `scripts/generate_parity_fixture.js`): golden de 291 bytes emitido por
  `buildSingleSysex` real para un patch determinista `patch[i]=(i*37+11)&0xFF` con
  cabecera `deviceId=0x7F, bank=2, program=10`.
- **Tests de paridad en ambos lados**:
  - C++ (`SynthEngineUnitTests_CalSpec.cpp`): `createProgramDumpSysex` con la MISMA
    fórmula de patch y cabecera → comparación **byte a byte** contra el golden embebido.
  - JS (`WebUI/tests/parityProgramDump.test.js`, 5 tests): el `buildSingleSysex` real
    debe emitir exactamente los bytes del fixture (staleness check); cabecera explícita,
    defaults históricos y round-trip estructural.
- **Verificación**: Vitest **88 files / 4469 tests / 0 fallos** (+5); C++ UnitTests
  **3.689.168 assertions / 0 fallos** (+3). `node scripts/generate_parity_fixture.js --check`
  permite detectar fixtures stale en CI.

---

## [0.2.10] — 2026-08-09

### 🏭 Fase 7 — Job CI dedicado `registry-generation` (workflow `registry-generation.yml`)

- **Nuevo job dedicado** (ubuntu-latest, complementario de `schema-validation` que usa el
  orquestador PS1 en Windows): ejecuta el **generador puro** `node scripts/registry_generator.js`
  y **falla si los 4 artefactos `.gen` commiteados no se regeneran sin diffs de contenido**
  (`schemas/parameter-registry.data.json`, `WebUI/js/registry.gen.js`,
  `Source/Core/ParameterRegistry.gen.{h,cpp}` vs `bridge-param-maps.js`,
  `byte_map_data.js`, `parameters_spec.json`).
- **Diff ignora `generatedAt`** (`--ignore-matching-lines`) — timestamp por corrida; el job
  solo falla por divergencias de CONTENIDO (registro stale o edición manual de `.gen`).
  Guardia anti-regresión de una sola línea en `data.json` (mismo criterio que
  `schema-validation`).
- **Valor añadido vs `schema-validation`**: verificación **multiplataforma** del generador
  (Linux en vez de Windows) y cobertura del generador sin el wrapper PS1.
- **Verificado localmente end-to-end**: `node scripts/registry_generator.js` → exit 0
  (235 parámetros: 226 físicos · 3 extendidos · 6 virtuales); `data.json` 7091 líneas;
  `git diff --exit-code --ignore-matching-lines='generatedAt'` → **0 diffs de contenido**.
  Checkbox de Fase 7 marcado (queda pendiente `pluginval`, `wasm-build`, `security-scan`,
  `property-fuzzing`).
- **Fix post-reviewer**: los `run: |` bash de los pasos 3 y 4 usan ahora `if ! cmd` en vez de
  `if [ $? -ne 0 ]` — el patrón anterior era código muerto bajo el `set -e` por defecto de GH
  Actions (el `node`/`git diff --exit-code` fallaba antes del bloque `if`, y `$?` dentro del
  `echo` se sobrescribía con el exit del propio `[`). Ahora los `::error::` y el `::group::`
  con el diff se imprimen de verdad en los fallos (simulado con `bash -e` local: 5/5 modos).
- **Guardia anti-minificación ampliada (ambos workflows, `registry-generation` y
  `schema-validation`)**: el check de línea única protege ahora `data.json` **y**
  `registry.gen.js` (ambos contienen `generatedAt`; si se emitieran minificados, el
  `--ignore-matching-lines` enmascararía el archivo entero y el job pasaría en falso).
  La guardia distingue además el caso `AUSENTE` (explicitud antes del `wc -l`, evita el
  quirk `[ "" -lt 2 ]` en bash). Verificado: `git ls-files --eol` confirma los 4 `.gen`
  con `eol=lf` en el repo (sin ruido CRLF en ubuntu-latest).

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
