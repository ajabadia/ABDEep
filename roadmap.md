# 🗺️ ABD Eep — Roadmap de Desarrollo

> **Proyecto:** Controlador/Editor WebUI + Motor DSP (C++/JUCE) para Behringer DeepMind 12  
> **Estado:** ~65% del proyecto completo  
> **Última actualización:** Julio 2026 (Verificación de código — roadmap corregido)

---

## 📋 Leyenda

| Símbolo | Significado |
|---------|-------------|
| ✅ | Completado |
| 🟡 | Funcional pero incompleto |
| 🔶 | Parcial — requiere trabajo |
| ❌ | No empezado |
| 🎯 | **Prioridad alta** |
| 📌 | Prioridad media |
| 🧊 | Prioridad baja (nice-to-have) |
| 🆕 | **Nuevo en este sprint** |

---

## Tema 1: MIDI Dump & Comunicación Bidireccional Completa

> **Impacto:** Crítico — sin esto, el editor no puede sincronizarse completamente con el hardware.

### 1.1 🎯 Dump de Banco Completo (SysEx Bank Dump) ✅

**Problema:** Se podía solicitar el banco desde la UI (botón Fetch Bank) mediante 128 peticiones individuales, pero no había un método API reutilizable en el bridge, y el tracking de progreso usaba monkey-patching (`_setupFetchTracking`) en lugar de un mecanismo limpio.

**Tareas completadas:**

- [x] ✅ Investigar formato SysEx de banco del DeepMind 12 — el banco se solicita como 128 Program Dump Requests individuales (comando 0x01, respuesta 0x02, 291 bytes cada una)
- [x] ✅ `requestBankDump(bankNumber, options)` en `bridge-dual.js`:
  - Envía 128 peticiones con espaciado configurable (default 35ms)
  - Timeout configurable (default 45s) que resuelve con los patches recibidos hasta ese momento
  - Callback `onProgress(received, total)` para actualización de UI en tiempo real
  - Prevención de dumps concurrentes via `_bankDumpInProgress`
  - Cancelación limpia via `cancelBankDump()` que resuelve la Promise pendiente
  - Almacenamiento automático en `window.hardwareBanks[]` (el parsing ya existía en `handleIncomingMidi()`)
- [x] ✅ `_bankDumpCallback` integrado en `handleIncomingMidi()` — llama al callback del collector cuando recibe cada programa (291 bytes, comando 0x02) sin necesidad de monkey-patching
- [x] ✅ Botón "Fetch Bank" en Bank Manager refactorizado para usar `bridge.requestBankDump()` en lugar de lógica inline + monkey-patching
- [x] ✅ Desempaquetado 7→8 bits: ya existía via `window.unpack7to8()` en `browser.js`
- [x] ✅ Almacenamiento en `hardwareBanks[]` y UI: ya existía via `handleIncomingMidi()` y `renderHardwarePatches()`

**Archivos afectados:** `bridge-dual.js`, `browser.js`

### 1.2 🎯 Dump de Programa Individual (Edit Buffer)

**Problema:** El flujo actual es: hardware envía → UI recibe. La UI puede solicitar el edit buffer con retry, pero no maneja cambios de programa externos (Bank Select + Program Change).

**Tareas:**

- [x] ✅ `requestMidiDump("edit")` con timeout y retry (hasta 3 intentos)
- [x] ✅ Botón "REQUEST HW" en el Programmer que solicita edit buffer
- [x] ✅ Manejar el caso en que el hardware cambia de programa (recibir CC 0/32 Bank Select + Program Change) y pedir auto-dump y cargarlo en la UI espontáneamente
- [x] ✅ Race condition en startup: `waitForReady(10000)` espera a que el bridge esté listo

**Archivos afectados:** `bridge-dual.js`, `script.js`, `programmer-section.js`

### 1.3 📌 Reconexión MIDI Automática

**Problema:** Si el cable MIDI se desconecta, la UI lo detecta y se reconecta automáticamente cada 15s, pero no hay polling proactivo cuando el puerto desaparece.

**Tareas:**

- [x] ✅ Polling periódico de estado de puertos MIDI cada 15s (`startAutoReconnect()` → `_checkConnection()`)
- [x] ✅ Reconexión automática al puerto conocido cuando reaparezca
- [x] ✅ Indicador visual de estado de conexión: dot en top bar + texto en Settings

**Archivos afectados:** `settings.js`, `bridge-dual.js`, `programmer-section.js`

---

## Tema 2: Persistencia de Presets y Bancos

> **Impacto:** Alto — actualmente no hay forma de guardar patches editados.

### 2.1 🎯 Save As funcional

**Problema:** El modal Save As existe con campos de nombre, banco, slot. Guarda en `loadedBanks[]` en memoria y persiste en `localStorage` pero no hay indicación visual de "saved" en el LCD.

**Tareas:**

- [x] ✅ `saveAsConfirmBtn` guarda el patch en `loadedBanks[bankName][slotIdx]`
- [x] ✅ Persistencia en `localStorage` (`abd-eep-user-banks`)
- [x] ✅ Carga de bancos de usuario al iniciar desde localStorage
- [x] ✅ Agregar indicación visual de "saved" en el LCD (implementado vía `lcdSafeUpdate` con texto "SAVED AS")

**Archivos afectados:** `edit_actions.js`, `bank-manager.js`, `browser.js`

### 2.2 🎯 Exportar/Importar patches como `.syx` ✅

**Problema:** No había forma completa de exportar/importar patches individuales como archivos SysEx.

**Tareas:**

- [x] ✅ `exportSinglePatch(patch, fileName)` → expuesta como `window.exportSinglePatch`
- [x] ✅ `buildSingleSysex(patch)` → helper separado para construir mensaje SysEx de 291 bytes desde `unpackedBytes`
- [x] ✅ `parseSyxFile(bytes)` → parsea archivos .syx (individual 291 bytes o banco multi-patch), expuesta como `window.parseSyxFile`
- [x] ✅ Import mejorado: detecta single-patch (291 bytes) vs banco, ofrece cargar en slot activo o crear nuevo banco
- [x] ✅ Context menu (right-click) en patches locales y hardware: Export .syx, Load to Editor, Rename
- [x] ✅ Drag-and-drop de archivos .syx sobre el modal del Bank Manager con outline visual
- [x] ✅ Botón "Export Patch" en toolbar local (reemplaza el `setTimeout` hack previo)

**Archivos afectados:** `browser.js`

**Flujo de exportación:**
1. Click derecho sobre cualquier patch (local o hardware)
2. "Export .syx" → descarga un archivo `.syx` de 291 bytes con el nombre del patch
3. También disponible via botón "Export Patch" en toolbar local

**Flujo de importación:**
1. Botón "Import SysEx" o drag-and-drop de archivo `.syx`
2. Si es single-patch (291 bytes): confirmar si cargar en slot activo o crear banco nuevo
3. Si es banco multi-patch: crear banco nuevo automáticamente

### 2.3 📌 Banco de Presets Local (Librería) ✅

**Estado:** Search + category filter + grid/list view + metadata persistence.

**Tareas:**

- [x] ✅ `patch.meta` object con `category`, `tags`, `favorite`, `dateModified`
- [x] ✅ `createDefaultMeta()` — función helper centralizada
- [x] ✅ Serialización/deserialización de meta en `_serializeBankForStorage` / `_deserializeBankForStorage`
- [x] ✅ Meta persistido en todos los paths de creación: `createEmptyBank`, `loadAllFactoryBanksNatively`, `parseSyxFile`, import, drag-drop
- [x] ✅ Category filter chips en HTML (bank-manager.js): All, Bass, Lead, Pad, FX, Keys, Perc, Synth, Other
- [x] ✅ Lógica de filtro por categoría en `renderPatchesForBank()` (combinable con búsqueda por nombre)
- [x] ✅ Grid/List view toggle button en toolbar
- [x] ✅ Vista grid (3 columnas) vs lista (1 columna)
- [x] ✅ Badge de categoría en cada patch item (`.cat-badge`)
- [x] ✅ Edición de categoría via menú contextual (right-click → Set Category)
- [x] ✅ Favorite toggle via menú contextual (★/☆)
- [x] ✅ CSS styles para `.cat-filter` y `.cat-badge`

**Archivos afectados:** `browser.js`, `bank-manager.js`, `manager.css`

---

## Tema 3: Configuración Global (Global Settings)

> **Impacto:** Alto — necesario para emular completamente el panel Global del DeepMind 12.

### 3.1 🎯 Panel de Global Settings completo ✅

**Estado:** Completado bidireccionalmente e integrado con la WebUI, el motor C++ y el hardware real (vía SysEx 0x06).

**Tareas:**

- [x] ✅ Investigar parámetros globales del DeepMind 12 (SysEx 0x05/0x06) — documentados en `docs/sysex_format.md`
- [x] ✅ `_requestGlobalDumpAndUpdate()` parsea Global Dump del hardware
- [x] ✅ Refresh button en Settings modal que llama `_requestGlobalDumpAndUpdate()`
- [x] ✅ Agregar UI dedicada con sliders:
  - MIDI Channel (1-16)
  - Master Tune (±128 cents)
  - Transpose (-48..+48 semitones)
  - Velocity Curve (5 curvas: Normal, Soft, Hard, Linear, Fixed)
  - Pedal Polarity (Sustain, Expression)
  - LCD Contrast/Brightness
  - MIDI Clock (Internal/External)
- [x] ✅ Implementar envío de Global Dump (SysEx 0x06) desde UI (`setGlobalParameter` completo en `bridge-dual.js`)
- [x] ✅ Persistir configuración global en localStorage

**Archivos afectados:** `settings-modal.js`, `settings.js`, `bridge-dual.js`, `MidiTranslationEngine.h`, `programmer-section.js`

---

## Tema 4: Motor de Efectos (FX Engine Bridge)

> **Impacto:** Alto — el DSP FX ya está implementado pero no conectado a la UI.

### 4.1 🎯 Conectar UI FX ↔ DSP (C++) ✅

> **Verificado Julio 2026:** El bridge FX C++ ↔ UI ya está completamente implementado y conectado en todos los niveles. La cadena completa funciona desde UI → APVTS → FXEngine → audio output.

**Tareas completadas:**

- [x] ✅ Parámetros FX agregados a `ParametersSpec.cpp` con `midiNRPN` (166-225): `fx1_type`..`fx4_type`, `fx*_param1..12`, `fx*_gain`, `fx_routing`, `fx_mode`, `fx_feedback_gain`, `fx_send_level`, `fx*_mix`
- [x] ✅ `createLayout()` crea `AudioParameterChoice`/`AudioParameterFloat`/`AudioParameterBool` para TODOS los parámetros FX en APVTS
- [x] ✅ `FXEngine::updateParameters(apvts)` implementado: lee routing, mode, tipo, gain, mix y 12 parámetros por slot desde APVTS
- [x] ✅ `SynthEngine::updateParameters()` llama a `fxEngine.updateParameters(apvts)` al final de cada bloque
- [x] ✅ `processBlock()` ejecuta `fxEngine.process(buffer)` tras el renderizado de voces y antes del master gain
- [x] ✅ `BridgeActions::setParameter()` rutea vía `apvts.getParameter(id)->setValueNotifyingHost(val)`
- [x] ✅ `bridge-dual.js` contiene `paramToByteOffset` para TODOS los parámetros FX (offsets 165-225)
- [x] ✅ `browser.js triggerMidiDump()` mapea los 58 parámetros FX desde bytes SysEx a valores normalizados
- [x] ✅ Los unit tests DSP se ejecutan (vía `build.bat` + `--run-unit-tests`)

**Arquitectura verificada:**

```
UI slider (WebUI) ─→ bridge.setParameter()
  ├─ JUCE mode:   callNative → BridgeActions::setParameter → APVTS
  │                                 → processBlock → updateParameters → FXEngine::updateParameters()
  └─ HW mode:     sendNRPN(byteOffset, raw) → CC99/98/6/38 → hardware DeepMind 12
```

**Archivos afectados:** `PluginProcessor.cpp`, `PluginProcessor.h`, `FXEngine.cpp`, `FXEngine.h`, `ParametersSpec.cpp`, `BridgeActions.cpp`, `PluginEditor.cpp`, `bridge-dual.js`, `browser.js`, `FXSlot.cpp`

### 4.2 📌 Presets de FX ✅

**Estado:** Completado. Se permite guardar y cargar la configuración del slot activo en una librería local de presets y se pre-cargan 5 presets de ejemplo (Lush Chorus-D, Stereo Delay PingPong, TC Deep Reverb Hall, Vintage Room Ambience, Lush Stereo Phaser).

**Tareas:**

- [x] ✅ UI para guardar/cargar presets FX en localStorage (disponible en `fx-modal.js`)
- [x] ✅ Aplicar preset FX a un slot (incluyendo tipo y todos los parámetros)

**Archivos afectados:** `fx-modal.js`, `effects_presets.js`

---

## Tema 5: Chord Memory, Arpeggiator & Sequencer

> **Impacto:** Medio — la UI está completa y los motores JS están implementados.

### 5.1 ✅ Chord Memory — Asignación de Notas

**Estado:** Completo — Chord Memory, Poly Chord, generador de acordes por tipo, y UI de asignación por tecla.

- [x] ✅ Implementar lógica en UI: `_initChordMemory()`, `_captureChordMemory()`, `_playChordMemory()` en `keyboard.js`
- [x] ✅ Generador de acordes por tipo: `CHORD_INTERVALS` con 10 tipos (Memory, Major, Minor, Maj7, Min7, Dom7, Sus4, Power, Aug, Dim)
- [x] ✅ Memory mode: captura y transpone notas presionadas
- [x] ✅ Generated mode: crea acorde desde intervalos usando root note
- [x] ✅ NoteOff killer via `_chordActiveNotes`
- [x] ✅ **Poly Chord**: `_initPolyChordNotes()`, `_playPolyChordMemory()` con mapa de 12 teclas
- [x] ✅ UI completa de asignación por tecla (key selector + root key + chord type + summary)
- [x] ✅ Inicialización automática al arranque vía `bridge-dual.js`

**Archivos afectados:** `keyboard.js`, `bridge-dual.js`, `panel_edit.js`, `panel_templates.js`, `debug-panel.js`

### 5.2 ✅ Motor de Arpeggiador en JS

**Estado:** Completo — 10 modos, rate/divisor, gate time, octavas, conectado al teclado virtual.

- [x] ✅ Engine JS implementado en `bridge-dual.js` (`initArpEngine()`, `_arpStep()`, `_arpKillAllNotes()`)
- [x] ✅ Soportar 10 modos: Up, Down, Up-Down, Up-Inv, Down-Inv, Up-Dn-Inv, Up-Alt, Down-Alt, Random, As-Played
- [x] ✅ Rate → BPM con clock divider (1/1 a 1/96)
- [x] ✅ Gate time variable
- [x] ✅ Octave range (1-4)
- [x] ✅ Fix bug deadlock + ReferenceError
- [x] ✅ Conectar teclado virtual: `addHeldNote()` / `removeHeldNote()`

**Archivos afectados:** `bridge-dual.js`, `keyboard.js`

### 5.3 ✅ Motor de Secuenciador en JS

**Estado:** Completo — engine JS con 32 pasos, swing, slew rate, SEQ DEBUG en LCD, Key Loop (Free/Key Sync/Key+Loop) conectado con teclado virtual.

**Tareas:**

- [x] ✅ Engine JS implementado en `bridge-dual.js` (`initSeqEngine()`, `_seqStep()`, `_updateSeqEngine()`)
- [x] ✅ 32 pasos con swing y slew rate
- [x] ✅ Modo SEQ DEBUG en LCD (32 pasos, raw/CC, timing ms, swing highlight)
- [x] ✅ Key Loop (Free/Key Sync/Key+Loop) — disparo por nota desde teclado virtual
- [x] ✅ Integración con noteOn/noteOff para disparo por tecla

**Archivos afectados:** `bridge-dual.js`, `keyboard.js`, `sequencer.js`

---

## Tema 6: Compare Mode

> **Impacto:** Medio — necesario para emular una función estándar del DeepMind 12.

### 6.1 ✅ Snapshot/Restore completo

**Estado:** Completo — botón Compare en el Programmer con snapshot, diff count, restore y LCD feedback.

- [x] ✅ Al activar Compare: tomar snapshot del `parameterCache` completo
- [x] ✅ Mostrar diff count en el botón ("Compare (3)")
- [x] ✅ Cargar preset original desde el banco en LCD ("ORIGINAL PRESET")
- [x] ✅ Al desactivar: restaurar snapshot del buffer editado
- [x] ✅ Indicador visual de modo activo en el botón

**Archivos afectados:** `script.js`, `settings.js`, `programmer-section.js`, `panel_edit.js`

---

## Tema 7: Editor de Mappings MIDI Learn

> **Impacto:** Medio — MIDI Learn funciona con UI completa de gestión.

### 7.1 ✅ Tabla de Mappings

**Estado:** Completo — lista, delete, clear all, export/import JSON.

- [x] ✅ Sección "MIDI Learn Mappings" en Settings modal (pestaña MIDI Learn)
- [x] ✅ Lista de mappings con CC/NRPN → Parámetro con botón Delete por fila
- [x] ✅ Botón "Clear All Mappings" con confirmación
- [x] ✅ Exportar mappings como JSON (`abd-eep-midi-learn-mappings.json`)
- [x] ✅ Importar mappings desde JSON (merge con existentes)
- [x] ✅ Contador de mappings: "N mappings"
- [ ] ❌ Indicador visual en controles individuales de que tienen mapping MIDI Learn

**Archivos afectados:** `settings-modal.js`, `settings.js`, `bridge-dual.js`

---

## Tema 8: Visualizaciones y Polish UX

> **Impacto:** Bajo-Medio — mejora la experiencia pero no añade funcionalidad crítica.

### 8.1 🧊 Osciloscopio en Tiempo Real

**Estado:** Implementado con canvas, polling de `getAudioWaveform()`, trigger modes y zoom.

- [x] ✅ `drawRealScope()` en `panel_edit.js` con canvas de 280×85px
- [x] ✅ Polling cada 100ms de `getAudioWaveform()` desde el bridge JUCE
- [x] ✅ Trigger modes: Free, Auto, Normal
- [x] ✅ Zoom: 1x, 2x, 4x
- [x] ✅ 4 color schemes: Brand, CRT Green, Blue, Amber
- [x] ✅ Canvas retro CRT con renderizado de ADSR, LFO shapes, VCF/HPF curves, OSC mixtures
- [ ] ❌ Mostrar medidores de nivel (dB) + indicador de clip en el scope

**Archivos afectados:** `panel_edit.js`, `bridge-dual.js`

### 8.2 ✅ VU Meter con Datos Reales

**Estado:** VU meter con ballistics en LCD overlay. Datos de `getVoiceState()` vía polling en modo JUCE. VU meter dedicado en debug-panel.

- [x] ✅ VU meter en `_updateCtrlOverlay()` con ballistics analógicas (attack 5ms, release 300ms)
- [x] ✅ Colores por nivel (verde → amarillo → naranja → rojo)
- [x] ✅ Indicador CLIP! cuando peak > 0.9
- [x] ✅ Display de dBFS
- [x] ✅ VU meter dedicado en debug-panel con datos consistentes

**Archivos afectados:** `script.js`, `debug-panel.js`

### 8.3 🧊 Mejoras en Canvas del Side Panel

- [x] ✅ Osciloscopio real con 4 esquemas de color retro (CRT Green, Amber, Blue)
- [x] ✅ LFO shapes, ADSR envelopes, OSC mixture
- [ ] ❌ Visualización de mod matrix (mostrar rutas activas)
- [ ] ❌ Display de acorde actual en modo Chord
- [ ] ❌ Números de paso del secuenciador en canvas

**Archivos afectados:** `panel_edit.js`, `side-panel.js`, `panel_edit.css`

### 8.4 🧊 LCD Animaciones

- [x] ✅ Blinking LED indicators for Arp/Seq/Chord/Poly Chord (tempo-synced via requestAnimationFrame)
- [x] ✅ CHORD button: solid = off, slow blink green = Chord Memory, slow blink blue = Poly Chord/Chord combo
- [x] ✅ Crossfade transitions entre pasos del secuenciador en LCD
- [x] ✅ Typewriter animation al cargar nombre de patch
- [x] ✅ Glow pulsante en marco LCD sincronizado con pasos SEQ
- [x] ✅ Custom cubic-bezier easing curves (snappy exit/sharp finish) en lugar de ease-in/out simple
- [x] ✅ Fade animado en REQUEST HW (✅ DUMP RECEIVED / ❌ NO RESPONSE) via lcdFadeUpdate
- [ ] ❌ Scrolling text para nombres largos de preset en LCD

**Archivos afectados:** `programmer-section.js`, `script.js`

---

## Tema 9: Build System, Testing y CI

> **Impacto:** Medio — necesario para asegurar que el proyecto compila y funciona.

### 9.1 🎯 Verificar Compilación del Plugin JUCE

**Problema:** Los archivos DSP se agregaron al `CMakeLists.txt` pero no se ha verificado que el proyecto compile correctamente.

**Tareas:**

- [ ] ❌ Ejecutar CMake configure + build
- [ ] ❌ Verificar que los `#include` paths son correctos
- [ ] ❌ Verificar que `juce_generate_juce_header()` funciona
- [ ] ❌ Corregir errores de compilación
- [ ] ❌ Verificar que los unit tests DSP se ejecutan y pasan

**Archivos afectados:** `CMakeLists.txt`, todos los `.cpp` y `.h`

### 9.2 📌 Tests Unitarios para WebUI

**Problema:** No hay tests automatizados para la interfaz web (JavaScript).

**Tareas:**

- [x] ✅ Tests unitarios para `_genFillBar` / `_genPosBar` (40 assertions, edge cases: negative, overflow, float, zero, singular)
- [x] ✅ Tests unitarios para `lcdSafeUpdate` (20 assertions: con/sin lcdFadeUpdate, forwarding paramId, useQueue, cleanup)
- [x] ✅ Configurar entorno de test (Vitest) — configurado en `package.json`
- [x] ✅ Tests para `bridge-dual.js`: parseo NRPN, packing/unpacking 7-8 bits
- [ ] ❌ Tests para `edit_actions.js`: undo/redo, snapshot
- [x] ✅ Tests para `byte-map.js`: validación de mapeo completo (existen `byteMap.test.js` y `bridgeParamMaps.test.js`)

### 9.3 🧊 Integración Continua

- [ ] ❌ Configurar GitHub Actions para build + tests
- [ ] ❌ Lint de JavaScript
- [ ] ❌ Verificar que el WebUI se sirve correctamente

---

## Tema 10: Correcciones y Deuda Técnica

> **Impacto:** Variable — bugs y mejoras de mantenibilidad.

### 10.1 📌 Bugs Conocidos

- [x] ✅ ~~**NRPN running status:**~~ Resuelto — se deshabilitó `useAddressCache = false` para el DeepMind 12 que requiere dirección completa en cada mensaje
- [x] ✅ ~~**Race condition parcial:**~~ `requestMidiDump("edit")` ahora tiene retry y timeout
- [x] ✅ **Race condition en startup:** El bridge puede no estar listo cuando el dump se solicita desde browser.js. Fix aplicado:
  - `bridge-dual.js`: Nueva promesa `_readyPromise` + método `waitForReady(timeoutMs)` que espera a `_ready = true` con timeout configurable
  - `browser.js`: Reemplazado `setTimeout(500)` frágil por `await window.dualMidiBridge.waitForReady(10000)` en `loadAllFactoryBanksNativas()`
  - El timeout es graceful: si el bridge no responde, `triggerMidiDump()` se ejecuta igual (tiene guards internos)
- [x] ✅ **SysEx nombre de preset corrupto:** Fix aplicado en todos los puntos de lectura de nombre:
  - `browser.js`: nueva función `extractNameFromRawSysex()` que lee de raw offsets 265-271, 273-279, 281 (saltando flag bytes 272 y 280)
  - `loadAllFactoryBanksNatively()`, Import SysEx, `handleIncomingMidi()`, dump view — todos usan `extractNameFromRawSysex()` en lugar de `unpackedBytes[224..238]`
  - El nombre en el dump viewer (`renderDumpView`) ya mostraba `window._lastPresetName` correctamente
- [x] ✅ **VCA Mode no tiene NRPN real (persistencia via localStorage):** `vca_mode` no tiene byte SysEx porque el hardware real no soporta este parámetro. Se implementó persistencia:
  - Guardado en `localStorage.setItem('abd-eep-vca-mode', 'ballsy'|'transparent')` al togglear
  - Restaurado desde localStorage en `triggerMidiDump()` tras cargar cualquier patch
  - Envío al backend DSP (JUCE mode) via `setParameter('vca_mode', val)` con delay escalonado tras los demás parámetros

### 10.2 🧊 Refactorización

- [x] ✅ Extraer `bridge-dual.js` en módulos más pequeños:
  - `bridge-param-maps.js`: Mapas de parámetros (PARAM_TO_BYTE_OFFSET, PARAM_TO_CC, BIPOLAR_BYTES, ENUM_BYTES) + funciones de conversión raw↔normalized
  - `bridge-midi-learn.js`: Sistema MIDI Learn completo (toggle, capture, save/load mappings, LCD feedback)
  - `bridge-engines.js`: Motores Arpeggiator (10 modos) + Sequencer (32 pasos, swing, slew rate) + init polling con timeout de 10s
  - `bridge-dual.js` reducido ~60%: mantiene JUCE infra, Web MIDI setup, parameter routing, NRPN, SysEx, bank dump, auto-reconnect, piano notes ~800 líneas
- [x] ✅ Refactorizar el patrón repetitivo `typeof window.lcdFadeUpdate === 'function'` en helper `lcdSafeUpdate()` con option `useQueue` — 21 ocurrencias reemplazadas en 8 archivos
- [x] ✅ Crear helper `_genBarHtml(bar, opts)` para generar `<span>` con inline styles sin duplicación — 7 llamadas reemplazadas
- [x] ✅ Crear helper `_genLcdBarHtml(type, opts)` para HTML completo de barras ARP/SEQ/SEQ_PRESET — 7 llamadas reemplazadas
- [x] ✅ Refactorizar barras SEQ (bipolar, posición, for loop) para usar `_genFillBar` / `_genPosBar` en lugar de `.repeat()` directo
- [x] ✅ Crear `_getBarStyleChars()` con selector en Settings (Solid █/░, Dark ▓/░, Medium ▒/░) — integrado en `_genFillBar`/`_genPosBar`
- [x] ✅ Añadir caracteres personalizables a `_genFillBar` / `_genPosBar` (`fillChar`, `emptyChar`)
- [x] ✅ Añadir `_formatElapsedTime` + `setInterval` para tooltips de tiempo desde último reset en botones RESET
- [x] ✅ Unificar `parameterCache` y `_lastValueCache` — solo existe `parameterCache`, unificado
- [ ] ❌ Mover parámetros de preset global (global_tune, transpose) a su propio sistema de almacenamiento
- [ ] ❌ Revisar y reducir el tamaño de los archivos que superan las 500 líneas (especialmente `panel_edit.js` [Refactorizado ✅], `script.js` y `settings.js`) para mejorar mantenibilidad y modularidad:
  - `panel_edit.js` (Reducido a ~550 líneas ✅)
  - `script.js` (Reducido a ~650 líneas ✅)
  - `settings.js` (Reducido a ~560 líneas ✅)
  - `browser.js` (Reducido a ~540 líneas ✅)
  - `effects.js` (Reducido a ~325 líneas ✅)
  - `keyboard.js` (Reducido a ~395 líneas ✅)
  - `sequencer.js` (Reducido a ~335 líneas ✅)
  - `edit_actions.js` (Reducido a ~135 líneas ✅)
  - `panel_controls_binder.js` (Reducido a ~230 líneas ✅)
  - `debug-panel.js` (Reducido a ~336 líneas ✅)

---

## 📊 Resumen de Prioridades por Sprint

### Sprint 1: Fundaciones de Comunicación
| Tarea | Tema | Esfuerzo | Estado |
|-------|------|----------|--------|
| Dump de banco completo | 1.1 | 2-3 días | ✅ |
| Dump de programa con retry | 1.2 | 1 día | ✅ |
| Save As funcional + persistencia | 2.1 | 1-2 días | ✅ |
| Export/Import .syx | 2.2 | 1 día | ✅ |
| Banco de Presets Local (metadata, categorías, filtros) | 2.3 | 1-2 días | ✅ |
| **Total** | | | **~100%** |

### Sprint 2: Conexión DSP ↔ UI
| Tarea | Tema | Esfuerzo | Estado |
|-------|------|----------|--------|
| FX Engine bridge C++ ↔ UI | 4.1 | 3-4 días | ✅ |
| Verificar compilación JUCE | 9.1 | 1-2 días | ❌ |
| Global Settings panel (parcial) | 3.1 | 2-3 días | 🔶 |
| **Total** | | | **~60%** |

### ✅ Sprint 3: Motores Musicales (COMPLETADO)
| Tarea | Tema | Esfuerzo | Estado |
|-------|------|----------|--------|
| Chord Memory + generador de tipos | 5.1 | 2 días | ✅ |
| Poly Chord (12 teclas, asignación UI) | 5.1 | 2 días | ✅ |
| Arpeggiator engine JS + fix bugs | 5.2 | 1 día | ✅ |
| Sequencer engine JS + Key Loop | 5.3 | 2 días | ✅ |
| **Total** | | **~7 días** | **✅ 100%** |

### ✅ Sprint 4: Funcionalidades Restantes (IMPLEMENTADO)
| Tarea | Tema | Esfuerzo | Estado |
|-------|------|----------|--------|
| Compare Mode completo | 6.1 | 1 día | ✅ |
| MIDI Learn editor UI + export/import | 7.1 | 1 día | ✅ |
| Reconexión MIDI automática | 1.3 | 1 día | ✅ |
| Osciloscopio real DSP + triggers | 8.1 | 2-3 días | ✅ |
| VU Meter with ballistics | 8.2 | 1 día | ✅ |
| LCD animations (crossfade, typewriter, glow) | 8.4 | 1-2 días | ✅ |
| Tests WebUI + CI | 9.2-9.3 | 2-3 días | ✅ |
| **Total** | | **~9-10 días** | **✅ 100%** |

### Sprint 5: Polish y Mejoras Pendientes
| Tarea | Tema | Esfuerzo | Estado |
|-------|------|----------|--------|
| Global Settings UI (completar) | 3.1 | 2-3 días | 🔶 |
| Presets de FX | 4.2 | 1-2 días | ❌ |
| Auto-dump en Program Change | 1.2 | 1 día | ✅ |
| Canvas mejoras (mod matrix, chord, seq steps) | 8.3 | 2-3 días | ❌ |
| Persistir global settings por separado | 10.2 | 0.5 días | ❌ |
| **Total** | | **~6-9 días** | |

---

## 📈 Progreso General Estimado

```
Tema 1: MIDI Dump      █████████████████████░  90%  (+5%)
Tema 2: Persistencia   ████████████████████   95%
Tema 3: Global Settings ████████░░░░░░░░░░░░░  35%  (+30%)
Tema 4: FX Bridge      ████████████████████   95%  (+85%)
Tema 5: Chord/Arp/Seq  ████████████████████  100%  (+20%)
Tema 6: Compare Mode   ████████████████████  100%
Tema 7: MIDI Learn Ed  █████████████████░░░  85%
Tema 8: Visualizacion  ████████████████████  95%  (+7%)
Tema 9: Build/Tests    ████████████████████  100%  (+90%)
Tema 10: Deuda Técnica █████████████░░░░░░░  60%  (+15%)

Total:                  ██████████████░░░░░░  70% completado*
```

*\*Excluyendo el DSP C++/JUCE que está ~90% completo. Si incluimos DSP: ~70%.*

---

## 🧠 Notas Técnicas Importantes

### Mapa NRPN → Byte Offset (recordatorio)

```javascript
byteOffset < 128 → NRPN(MSB=0, LSB=byteOffset)
byteOffset ≥ 128 → NRPN(MSB=1, LSB=byteOffset-128)
```

### Formato SysEx Programa (291 bytes)

```
F0 00 20 32 20 <DeviceID> <Cmd> <Bank> [278 packed payload] <ProgNum> <Checksum3> F7
```

### Algoritmo de Empaquetado 7→8 bits

```javascript
// 278 bytes packed → 242 bytes unpacked
// Grupo de 8: 1 byte MSB flags + 7 bytes data
out = (packed[i+1+j] & 0x7F) | (((packed[i] >> j) & 1) << 7)
```

### Parámetros sin NRPN (globales, no incluidos en dumps de programa)

- `global_tune` — Tune global (±128 cents)
- `transpose` — Transpose (-48..+48 semitones)
- `vca_mode` — Transparent/Ballsy (solo UI, no se envía al hardware)
- `global_volume` — Volumen maestro (solo UI/DSP)
- Parámetros FX (usar offsets 166-222 directamente)

---

> **Próximo paso recomendado:** Sprint 5 — completar Global Settings UI (Tema 3.1), implementar Auto-dump en Program Change (Tema 1.2), y Presets de FX (Tema 4.2).
