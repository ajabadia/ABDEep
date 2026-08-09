# Fase 4 — Nivel 3b: Hardware-in-the-Loop (procedimiento + checklist pre-release)

> Plan de Refactorización v3.2 congelado · Sección §5 «Matriz de Pruebas de 3 Niveles,
> Property-Based Testing y Fuzzing con Recurso Acotado» — **Nivel 3b (Hardware-in-the-Loop)**:
>
> > *Dumps reales en hardware físico — **obligatorio previo a cualquier release que
> > modifique el protocolo SysEx o NRPN**.*
>
> Estado: **pendiente de ejecución** (requiere hardware DM12 físico) · Fecha doc: 2026-08-09
> · Doc de la batería de Fase 4: `docs/fase4_roundtrip_equality.md`

---

## 1. Objetivo

Validar el contrato de protocolo (SysEx 291 B / NRPN / edit buffer) contra el
**hardware real Behringer DeepMind 12**, cerrando el bucle que los Niveles 1/2/3a
verifican solo contra el corpus de fábrica (1024 presets) y los fixtures.

| Nivel | Verifica contra | Hardware | Cuándo es obligatorio |
|-------|-----------------|----------|------------------------|
| 1 / 2 / 3a | corpus A–H + fixtures | ✗ (solo CI) | siempre (CI) |
| **3b** | **hardware DM12 físico** | ✓ | **cualquier release que toque SysEx o NRPN** |

El Nivel 3b **no sustituye** a la CI: la complementa detectando divergencias que solo
el hardware real puede mostrar (cabeceras no canónicas toleradas por el firmware,
redondeos NRPN, eco de confirmación, límites del campo de nombre, byte-map real).

---

## 2. Herramientas del proyecto para la validación

Todo el armado ya existe en el repo; el procedimiento solo las orquesta:

| Herramienta | Ruta | Uso en 3b |
|-------------|------|-----------|
| Web MIDI con SysEx | `WebUI/js/bridge_connection_midi.js` (`navigator.requestMIDIAccess({ sysex: true })`) | acceso al puerto MIDI real |
| `requestBankDump(bankNumber)` | `WebUI/js/bridge-sysex-handlers-dump.js` | petición de dump de banco A–H al hardware |
| `buildSingleSysex(patch, bank, program, deviceId)` | `WebUI/js/browser_packer.js` | emisión del mensaje canónico de 291 B hacia el hardware |
| `createProgramDumpSysex` (C++) | `Source/Core/MidiTranslationEngine` | paridad C++ del mismo mensaje (test `parityProgramDump.test.js`) |
| Parsing banco/programa | `WebUI/js/bridge-midi-rx.js` (`data[8]`/`data[9]`) | almacenado en `window.hardwareBanks[letter][prog]` |
| `validateSinglePatchSysexRoundTrip` | `Source/Core/RoundTripValidator` (C++) | round-trip estricto de 291 B (regresión en `SynthEngineUnitTests_CalSpec.cpp`) |
| `ParameterStore` + eco NRPN | `WebUI/js/bridge-parameter-store.js`, `bridge-midi-rx-nrpn-handlers.js` (CC38) | confirmación por eco (TTL 300 ms, `isEcho`) |
| `HardwareMidiService` (FSM) | `WebUI/js/hardware_midi_service.js` | estados `connected → syncing → ready → transmitting → resync_required` |
| `HardwareExporter.prepareForSysEx` | `WebUI/js/patch_name.js` | nombre ASCII 16 chars en bytes 223–238 sin mutar el modelo |
| Hashes de referencia | `schemas/corpus-hashes.json` + `docs/baseline_fase0_v32.md` | verificación de que un dump del hardware NO altera los bancos |
| `validate_sysex_mapping.js --check-hashes` | `scripts/` | re-validación del byte-map tras capturas |

---

## 3. Procedimiento (4 fases)

### 3.0 Preparación del banco de pruebas

1. Conectar el DM12 por **MIDI DIN/USB** (interfaz clase-compliant, sin drivers propietarios).
2. En el DM12: **Global Settings → MIDI → Local Control = OFF** (evita doble disparo de
   notas), **Rx SysEx = ON**, **Tx SysEx = ON**, **Device ID** anotado (default `0x7F`).
3. Abrir la WebUI de ABDEep en **Chrome/Edge** y conceder el permiso de SysEx del Web MIDI
   (prompt del navegador). Verificar en Settings → MIDI Ports que el DM12 aparece como
   puerto de entrada **y** de salida.
4. Registrar el estado de la FSM (`HardwareMidiService`): debe quedar en `ready` tras el
   sync inicial. Si entra en `resync_required`, usar el botón RE-CONNECT HARDWARE.

### 3.1 Fase A — Baseline del hardware (captura de bancos)

1. `requestBankDump(0..7)` para cada banco A–H del hardware (estado de fábrica o del
   usuario). Cada preset debe llegar como mensaje canónico de **291 B** con cabecera
   `F0 00 20 32 20 <dev> 02 <proto> <bank> <prog> ... 00 00 F7`.
2. Comprobar que `bridge-midi-rx.js` almacena `hardwareBanks[letra][prog]` con
   `data[8]`/`data[9]` correctos (banco A–H, programa 0–127).
3. **Comparación con el corpus**: si el hardware está en fábrica, los dumps deben
   coincidir byte a byte con los factory banks de `resources/banks/Factory Banks V1.1.2`
   (hashes SHA-256 → `schemas/corpus-hashes.json`). Clasificar cada preset con
   `scripts/roundtrip_corpus.js --classify` contra el corpus.
4. **Registrar desviaciones**: presets con `canonical_match` (misma posición, bytes
   distintos) o `semantic_match` (solo región reservada) se documentan con su
   clasificación; un preset con diferencias en bytes de parámetros **fuera de tolerancia**
   es un hallazgo a investigar (posible byte-map desalineado o variante de firmware).

### 3.2 Fase B — Round-trip de programa (escritura → lectura)

Por cada preset de prueba (recomendar: factory A/0 + 3 ediciones manuales + 1 nombre
con caracteres ASCII límite):

1. **Enviar** el preset con `sendPatchToHardware` (pasa por `HardwareExporter`:
   nombre truncado/saneado a 16 chars ASCII en 223–238, sin mutar el modelo).
2. **Pedir el dump de vuelta** (request de programa del mismo bank/prog).
3. **Validar** el mensaje recibido con `validateSinglePatchSysexRoundTrip` (291 B,
   cabecera canónica, round-trip unpack → 242 bytes).
4. **Clasificar** con `rawCodecEqual` + `semanticEqual` (Nivel 1/2): el dump del
   hardware debe ser `equal`/`semantic` contra el preset enviado. La región del nombre
   puede diferir solo si el hardware truncó el nombre.

### 3.3 Fase C — Ciclo NRPN y eco de confirmación

1. Editar un parámetro físico (p.ej. `vcf.cutoff`, byte 39) vía `setParameter` en modo HW.
2. Verificar que `ParameterStore` crea una `PendingTransaction` (TTL 300 ms) y que el
   **eco NRPN** del hardware (CC38) la confirma con `confirmByValue` → `isEcho`, **sin
   re-escribir el slider** (0 bucles de realimentación UI ↔ hardware, criterio §2.1).
3. Verificar el **rollback tipado**: un parámetro con `byteOffset >= 300` (virtuales
   `fx_feedback_gain`/`fx_send_level`) NO debe emitir NRPN (`bridge_connection_midi.js`
   los ignora) — confirmar que el hardware no recibe mensajes corruptos.
4. Comprobar que el valor leído de vuelta por el snapshot del hardware coincide con el
   esperado (redondeo NRPN dentro de ±1 raw).

### 3.4 Fase D — Región de nombre (223–238) y cola (239–241)

1. Enviar nombres de 16 chars, 15 chars y con chars no-ASCII/`<>&"'`: el hardware debe
   mostrar el nombre saneado; el dump de vuelta debe contener el mismo nombre en
   223–238 (16 chars, relleno `0x20`).
2. Confirmar que los bytes 239–241 (cola) y el payload empaquetado 10–287 no se ven
   alterados por el nombre (dumps de fábrica verificados: "Blue Dolphin BC " en A/0).

---

## 4. Checklist de validación previa a release

> Requisito: **TODO** el checklist verde si el release toca SysEx/NRPN/byte-map.
> Si el release es solo UI/DSP (sin protocolo), la Fase A (captura de referencia) basta
> como smoke test.

### A. Baseline y protocolo

- [ ] Web MIDI conectado (`sysex: true`) y FSM en `ready` (sin `resync_required` persistente).
- [ ] `requestBankDump(0..7)` → 8 × 128 mensajes de **291 B** con cabecera canónica.
- [ ] `hardwareBanks[letra][prog]` poblado correctamente (banco `data[8]` & 0x07, prog `data[9]` & 0x7F).
- [ ] Hashes SHA-256 de los dumps de fábrica == `schemas/corpus-hashes.json` (corpus inmutable).
- [ ] `node scripts/roundtrip_corpus.js --classify` contra el corpus: **0 errores**; toda
      desviación clasificada (`exact`/`canonical`/`semantic`) y documentada.
- [ ] `node scripts/validate_sysex_mapping.js --check-hashes` → 0 errores / 0 warnings.

### B. Round-trip de programa

- [ ] Envío → dump de vuelta → `validateSinglePatchSysexRoundTrip` **OK** para cada preset de prueba.
- [ ] `rawCodecEqual` (Nivel 1) igual tras el round-trip; `semanticEqual` (Nivel 2) sin
      mismatches fuera de tolerancia.
- [ ] `HardwareExporter` no muta `patch.name`/`patch.unpackedBytes` al exportar.
- [ ] Paridad C++/JS del mensaje emitido (`createProgramDumpSysex` vs `buildSingleSysex`).

### C. NRPN y transacciones

- [ ] Eco NRPN confirma la transacción (`confirmed`, `isEcho`) sin re-escribir el slider.
- [ ] Rollback `parameter_edit` a los 300 ms si NO hay eco (o `mark_only` si el DM12 no
      re-emite; anotar la política usada).
- [ ] Parámetros virtuales (≥300) no emiten NRPN al hardware.
- [ ] Valores leídos de vuelta dentro de ±1 raw del valor enviado.

### D. Nombre y región reservada

- [ ] Nombres de 16 chars ASCII redondean 223–238 correctamente (dump de vuelta idéntico).
- [ ] Nombres inválidos (no-ASCII, >16) saneados sin corromper el preset.
- [ ] Cola 239–241 y payload 10–287 intactos tras re-nombrar.

### E. Cierre

- [ ] Dumps capturados commiteados como **referencia de regresión** (carpeta
      `resources/hardware_dumps/` con fecha) + hashes actualizados.
- [ ] Desviaciones documentadas en el reporte de la corrida (JSON con `--json --classify`).
- [ ] CHANGELOG con la corrida 3b (fecha, firmware del DM12, resultado por fase).

---

## 5. Registro de resultados

El reporte de la corrida debe persistirse como `docs/reports/nivel3b-<YYYYMMDD>.json`
(incluir: fecha, firmware DM12, device ID, política de timeout del store, tabla por
preset `--classify`, desviaciones y resultado de cada checklist). El commit de cierre
marca el Nivel 3b como completado en `docs/fase4_roundtrip_equality.md` §8 y en el plan.

**Precondición para marcar 3b ✅ en el plan**: checklist A–E 100 % verde en una corrida
con hardware físico (no simulada).
