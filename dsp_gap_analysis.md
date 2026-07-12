# Análisis de Integración MIDI y Brechas del Motor DSP (JUCE C++)

Este documento resume los problemas resueltos en el sistema MIDI y de la interfaz gráfica (WebUI), y detalla las características que deben ser implementadas en el motor DSP C++ (JUCE) para equiparar el sintetizador emulado con el hardware real del Behringer DeepMind 12.

---

## 1. Resumen de Mejoras Realizadas en el Sistema MIDI y WebUI

Durante las pruebas de integración directa con el sintetizador hardware original, se detectaron y corrigieron los siguientes fallos de comunicación bidireccional:

### A. Entrada MIDI (Hardware -> WebUI)
* **Soporte de Running Status (NRPN):** El hardware optimiza la transmisión de NRPN enviando la dirección (`CC99` y `CC98`) una sola vez al inicio del movimiento y luego transmitiendo únicamente valores (`CC6` y `CC38`). Se corrigió el bridge (`bridge-dual.js`) para que no borre la dirección activa tras procesar el primer valor.
* **Eliminación de Timeout:** Se retiró el timeout de 500 ms en la recepción de NRPN, permitiendo mantener la dirección activa durante movimientos continuos prolongados.

### B. Salida MIDI (WebUI -> Hardware)
* **Escalado de Rangos (Enums y Bipolares):** El bridge escalaba todos los valores salientes a 0-255. Esto causaba que los selectores (ej. formas de onda del LFO, que van de 0 a 6) enviaran valores fuera de rango y fueran ignorados por el hardware. Se implementó `_normalizedToRaw` para escalar correctamente cada parámetro según su tipo.
* **Envío Seguro de Dirección (Desactivación de Caché):** Se deshabilitó la caché de dirección de salida (`useAddressCache = false`) de forma que el software envíe siempre la trama completa de 4 mensajes (`CC99` + `CC98` + `CC6` + `CC38`) para cada NRPN, garantizando que el hardware no ignore los mensajes.
* **Limpieza de Caché al Recibir Mensajes:** Al recibir un `CC99` o `CC98` desde el hardware (cuando el usuario toca controles físicos), se invalida inmediatamente la caché de envío para evitar desincronizaciones en el siguiente movimiento desde la pantalla.

### C. Corrección Crítica en Panel de Edición Detallada
* **Bypass de MIDI en Arrastre de Faders:** Los faders dinámicos del panel deslizable izquierdo (como Slew y Phase) se bloqueaban en el envío MIDI debido a que `panel_edit.js` actualizaba directamente la caché (`parameterCache`) antes de invocar a `setParameter`. Esto hacía creer al bridge que el valor no había cambiado, cancelando la transmisión. Se eliminó esta asignación redundante y ahora el flujo viaja de forma directa.

### D. Rediseño del Panel de LFO, POLY, VCF, VCA, OSC 1 y OSC 2
* **LFO:**
  * **LFO Phase:** Añadido el fader **Phase** (conectado a `mono_mode` bytes 5/12) y rediseñada la fila a 4 faders (`Rate`, `Delay`, `Slew`, `Phase`).
  * **Etiqueta Dinámica:** El fader "Rate" cambia su etiqueta a "Clock Div" si el **Arp Sync** está activo.
* **POLY / UNISON:**
  * **Voice Modes:** Ampliado el menú desplegable a las 13 opciones de voz del hardware original.
  * **Botones LED Reemplazando Selectores:** Sustituidos los selectores desplegables de **Note Priority** y **Envelope Trigger Mode** por cuadrículas premium con indicación LED táctiles bidireccionales.
  * **Nuevos Faders:** Añadidos faders para `param_drift` (Par Drft) y `drift_rate` (Drft Rate) para completar el panel.
* **VCF (Filtro):**
  * **LPF Type (Slopes):** Corregida la polaridad invertida del control 2-Poles / 4-Poles (`vcf_pole_mode`: 2-Pole es raw `1` y 4-Pole es raw `0`).
  * **Faders Añadidos:** Implementados los deslizadores faltantes para `vcf_key_tracking` (Keyb), `vcf_pitch_bend` (P.Bend), `vcf_aftertouch_lfo` (Aft-LFO) y `vcf_modwheel_lfo` (MW-LFO) en una segunda fila.
* **VCA (Amplificador):**
  * **VCA Mode:** Corregida la sincronización visual de los botones Transparent/Ballsy en la WebUI. Anteriormente se activaban y desactivaban en paralelo por compartir el parámetro virtual sin lógica de exclusión. Ahora funcionan como botones excluyentes.
* **OSC 1:**
  * **Range (16', 8', 4'):** Migrados de botones de texto a filas con indicadores LED táctiles premium.
  * **P.Mod Dest Mode:** Migrado de botones a indicadores LED táctiles (OSC 1+2 vs OSC 1 Only).
  * **P.Mod & PWM Source Scales:** Corregido el factor de división en `panel_edit.js` que erróneamente escalaba por 23.0 en lugar de por 6.0 (PM Source, LSB 22) y 5.0 (PWM Source, LSB 16).
  * **Faders Añadidos:** Incorporados faders de profundidad directa para `osc1_lfo_aftertouch` (Aft>Pmod) y `osc1_lfo_modwheel` (Whl>Pmod).
  * **OSC Key Down Reset:** Añadido el switch de control para `osc_key_reset` (LSB 92).
* **OSC 2:**
  * **Range (16', 8', 4'):** Migrados a indicadores LED táctiles.
  * **P.Mod & T.Mod Decoupling & Scales:** Decoplado el control de modulación de pitch `osc2_pm_source` (Pitch Mod Select, byte 32) de `osc2_tpm_source` (Tone Mod Source, byte 17). Anteriormente ambos compartían el offset 17 en `bridge-dual.js` y `ParametersSpec.cpp`, interfiriendo entre sí. Se corrigieron además los factores de división a 6.0 y 5.0 respectivamente.
  * **Faders Añadidos:** Incorporados faders de profundidad directa para `osc2_aftertouch_pitch` (Aft>Pmod) y `osc2_modwheel_pitch` (Whl>Pmod).
* **Arpegiador y Secuenciador (WebUI):**
  * **Arp Clock Divider:** Se renombró el selector de "Clock Source" (que no es un parámetro de patch sino global) a "Clock Rate / Divider" en la UI, configurándolo con sus 13 subdivisiones reales (1/1 a 1/96). Corregido el factor de escala a `/ 12.0` (LSB 158).
  * **Arp Octave:** Limitado el rango real del hardware a 4 octavas máximas (escala `0.0` a `3.0`, LSB 164) en lugar de 6.
  * **Seq Clock & Length:** Corregida la normalización en el modal del secuenciador para dividir y multiplicar correctamente según sus límites reales: `/ 15.0` (LSB 118, 16 opciones) y `/ 31.0` (LSB 119, 32 opciones).
* **FX Rack (Efectos):**
  * **Corrupción en carga de parches (SysEx):** Se removió una multiplicación redundante en `syncFxModalUI` que multiplicaba el tipo de efecto (0-35), el ruteo (0-9) y el modo de FX por sus máximos nuevamente al cargar volcados, desbordando los selects.
  * **Soporte de Efectos en FX1:** Ampliado el rango del primer slot (`fx1_type`) para soportar los 36 efectos disponibles en el sintetizador real (antes limitado a 10 en C++).
  * **Bridge MIDI:** Registrados los offsets NRPN de tipo de efectos (`166`, `179`, `192`, `205`), clock de secuencia (`118`), steps de secuencia (`119`) y presets de arpegiador (`162`, `164`) en el mapa de `ENUM_BYTES` para garantizar una traducción bidireccional limpia y lineal de los NRPN.
* **Panel PORTA / Glide (WebUI):**
  * **Bug `porta_mode` (ENUM_BYTES):** Corregido el factor de escala en el bridge de `35: 13` a `35: 9` (el modo tiene 10 opciones, índice 0–9). También corregido el rango máximo en `ParametersSpec.cpp` de `10.0` a `9.0`.
  * **LED Rows:** Sustituidos los selectores desplegables de `Porta Mode`, `Note Priority` y `Trigger Mode` por cuadrículas de LED táctiles bidireccionales, consistentes con el resto de paneles.
  * **Porta Time añadido:** El fader `Porta Time` (mapeado a `global_portamento`, NRPN byte 34) ahora aparece en el panel junto con Tune, Transpose y Osc Bal.
  * **Transpose / Global Tune:** Confirmado que estos parámetros **no tienen NRPN** en el DeepMind 12 (son ajustes globales del instrumento, no del programa/patch), por lo que no pueden sincronizarse con el hardware. Están disponibles en la UI como control local del plugin C++.


---

## 2. Brechas Identificadas en el Motor DSP C++ (Faltantes por Emular)

### A. LFO Phase / Mono Mode (LFO 1 & LFO 2) — ✅ IMPLEMENTADO
* **Estado actual:** Implementación completa con soporte Poly/Mono/Spread.
* **Parámetro:** `lfoX_mono_mode` (Offset 5/12), leído como normalized 0-1, escalado a raw 0-255.
* **Implementación:**
  - `SynthEngine` mantiene dos LFOs globales (`globalLfo1`, `globalLfo2`) que se pre-calcular muestra a muestra en `processBlock()` y se pasan como buffers a cada voz.
  - `SynthVoice::startNote()`:
    - **Poly (raw=0):** LFO se resetea por nota (`lfo.trigger()`) — comportamiento independiente por voz.
    - **Mono (raw=1):** El LFO local no avanza; se usa el valor del buffer global (idéntico para todas las voces activas).
    - **Spread (raw≥2):** Se fija un offset de fase inicial por voz vía `lfo.setPhase(voiceIndex * spreadCycles)`, donde `spreadCycles = (raw-1)/254 * 4.0`, expandiendo el campo estéreo de la modulación.
  - `SynthVoice::updateModulationSources()` decide muestra a muestra entre LFO local, LFO global (Mono) o LFO con Spread según el raw.
* **Verificado en:** SynthEngine.cpp/h, SynthVoice.cpp/h.

### B. Unison Voice Stacking & Detuning (Voice Engine) — ✅ IMPLEMENTADO
* **Estado actual:** Implementación completa de stacking, detuning simétrico y pan spread.
* **Parámetros:** `voice_mode` (Offset 85), `unison_detune` (Offset 87), `vca_pan_spread` (Offset 83).
* **Implementación:**
  1. **Stacking de Voces:** `SynthEngine::triggerNote()` usa `getVoicesPerNote(voiceMode)` que mapea los 13 modos:
     - Poly/Poly6/Poly8/Mono: 1 voz/nota
     - Uni2/Mono2: 2 voces/nota
     - Uni3/Mono3: 3 voces/nota
     - Uni4/Mono4: 4 voces/nota
     - Uni6/Mono6: 6 voces/nota
     - Uni12: 12 voces/nota
     - En modos Mono (6-10): force-stop de todas las voces previas antes de apilar.
  2. **Unison Detuning:** `getUnisonParams()` calcula distribución simétrica:
     - Max: `unisonDetune * 50.0` cents (±50¢ cuando el parámetro está al máximo)
     - 2 voces: extremos opuestos. N voces: step uniforme a través del rango.
     - Se aplica como `unisonDetuneSemitones` a ambos osciladores (OSC1 y OSC2) en `processSample()`.
  3. **Pan Spread:** Distribución uniforme 0-1 escalada por `voicePanSpread`:
     - `basePan = 0.5 + (unisonPanPosition - 0.5) * voicePanSpread`
     - Cuando spread=0, todas las voces centradas. Spread=1, extremos L/R.
* **Verificado en:** SynthEngine.cpp/h, SynthVoice.cpp/h.

### C. Inestabilidad Analógica (Analog Drift Engine) — ✅ IMPLEMENTADO
* **Estado actual:** Implementación completa con `DriftEngine` integrado en cada voz.
* **Parámetros:** `voice_drift` (Offset 88), `param_drift` (Offset 89), `drift_rate` (Offset 90).
* **Implementación:**
  1. **`DriftEngine`** (clase independiente en `Source/DSP/DriftEngine.h/.cpp`):
     - Cuatro osciladores de ruido lentos internos: osc1Pitch, osc2Pitch, vcfCutoff, vcfResonance, más un drift de tiempo para envolventes.
     - `resetForNote(voiceIndex)` — inicializa semilla por voz y por nota.
     - `setDriftParams(voiceDrift, paramDrift, driftRate)` — escalado de intensidad y velocidad.
     - `nextSample()` — avanza los osciladores una muestra.
  2. **SynthVoice::processSample()**:
     - **Oscillator Drift:** `driftOsc1` y `driftOsc2` en cents, convertidos a semitonos y sumados a `osc1Note`/`osc2Note` (junto con `unisonDetuneSemitones`).
     - **VCF Drift:** `driftCutoff * paramDrift` sumado a cutoffLvl; `driftResonance * paramDrift * 0.5` sumado a resonancia.
     - **Envelope Drift:** `driftEnvScale = 1.0 + drift.getEnvTimeDrift() * 0.3` (±30% en velocidad de envolventes cuando paramDrift=1.0).
  3. Sincronizado desde `SynthEngine::updateParameters()` vía `voices[i].drift.setDriftParams(...)`.
* **Verificado en:** SynthEngine.cpp, SynthVoice.cpp/h, Source/DSP/DriftEngine.h, Source/DSP/DriftEngine.cpp.

### D. Enlace de MIDI Translation Engine en C++ con Datos de 8 Bits / NRPN de 14 Bits — ✅ IMPLEMENTADO
* **Estado actual:** `MidiTranslationEngine.h` ahora maneja NRPN completo de 14 bits.
* **Implementación:**
  1. **`translateParamToMidi` (salida → hardware):**
     - Escala normalized (0-1) a 8-bit raw (0-255): `raw8 = round(normalized * 255)`.
     - Divide en MSB + LSB: `dataMsb = (raw8 >> 7) & 0x7F`, `dataLsb = raw8 & 0x7F`.
     - Secuencia completa de 4 mensajes: `CC99→CC98→CC6(dataMsb)→CC38(dataLsb)`.
  2. **`translateMidiToParam` (entrada ← hardware):**
     - Rastrea `CC6` en `nrpnValMsb` y `CC38` en `nrpnValLsb`.
     - Al recibir CC38: combina `raw14 = (nrpnValMsb << 7) | nrpnValLsb`, normaliza contra 255.
     - Guardia contra CC38 sin CC6 previo (`nrpnValMsb >= 0`).
     - Reset de los 3 estados temporales tras decodificar.
  3. Miembros privados: `nrpnVal` reemplazado por `nrpnValMsb` + `nrpnValLsb`.
* **Verificado en:** Source/MidiTranslationEngine.h.

### E. VCA Mode (Transparent vs Ballsy) en el DSP — ✅ IMPLEMENTADO (mejorado)
* **Estado actual:** Modelo de saturación analógica mejorado en el DSP.
* **Implementación:**
  - **Ballsy mode (antes):** `std::tanh(signal * 1.5f)` — saturador simple.
  - **Ballsy mode (ahora):** Modelo analógico 3-etapas en una sola llamada tanh:
    ```cpp
    float drive = (signal * ampLevel) * (1.0f + ampLevel);       // Pre-drive variable 0x-2x
    float asymmetry = drive * 0.04f * ampLevel;                    // Bias asimétrico para armónicos pares
    float shaped = std::tanh(drive + asymmetry);                   // Saturador principal
    float makeup = 1.0f + (1.0f - std::abs(shaped)) * 0.3f * ampLevel; // Makeup gain compensatorio
    return shaped * makeup;
    ```
  - **Transparent mode (antes):** Amplificación lineal + soft-clip discontínuo (bug: caída abrupta de 0.95→0.727).
  - **Transparent mode (ahora):** `return signal * ampLevel` — amplificación lineal pura, sin clipping. Los overs se manejan en la etapa de mezcla final (práctica estándar).
  - **UI:** Botones Transparent/Ballsy conmutan correctamente (bug de sincronización invertida corregido en panel_edit.js).
* **Verificado en:** SynthVoice.cpp (sección 6 de `processSample()`), panel_edit.js.

### F. Simulación LPF de 2 Polos (12dB/oct) vs 4 Polos (24dB/oct) — ✅ IMPLEMENTADO
* **Estado actual:** Conmutación dinámica completa en tiempo real.
* **Implementación:**
  - `VCF::setPoleMode(int mode)`: 0 = 2-Pole (12dB/oct), 1 = 4-Pole (24dB/oct).
  - `VCF::process()`:
    - 2-Pole: procesa solo `stages[0]` (un biquad → 12dB/oct).
    - 4-Pole: cascada `stages[1].process(stages[0].process(sample))` → 24dB/oct.
  - Cada stage biquad tiene saturación interna `tanh()` para estabilidad.
  - Mejora adicional: `stages[1].reset()` al conmutar de 2→4 polos para eliminar estado residual que podía causar clics/transientes.
  - Cadena completa: `ParametersSpec → SynthEngine::updateParameters() → SynthVoice::processSample() → VCF`.
* **Verificado en:** Source/DSP/Filter.h, Filter.cpp.

### G. Chord Memory y Poly Chord (Voice Allocator) — ✅ IMPLEMENTADO
* **Estado actual:** Implementación completa en el Voice Allocator de SynthEngine.
* **Parámetros:** `chord_enable`, `poly_chord_enable` (bool), `chord_key` (0-11, raíz), `chord_type` (0-7, tipo de acorde). Sin NRPN (comparten bytes con Mod Matrix slots 5-6).
* **Implementación:**
  1. **Tabla de intervalos** (`kChordTable[8][6]` en SynthEngine.cpp):
     - Memory: 0, 4, 7, 12, 16, 19 (6 notas)
     - Major/Minor: tríadas (3 notas)
     - Major 7th / Minor 7th / Dom 7th: tétradas (4 notas)
     - Sus4, Power Chord: 3 y 2 notas respectivamente
  2. **Chord Memory** (`triggerNote()`):
     - Si `chord_enable` activo, cada nota-on se expande en N notas según `chordType` vía `triggerChordForRoot()`
     - Respeta Mono force-stop y Unison stacking (cada nota del acorde recibe `voicesPerNote` voces apiladas)
  3. **Poly Chord** (`triggerNote()` + `releaseNote()`):
     - Acumula notas raíz en `polyChordHeldNotes[12]`
     - Cada nuevo note-on: force-stop de todas las voces previas, re-trigger del acorde completo desde todas las raíces acumuladas
     - Note-off: remueve del acumulador; si queda vacío, libera todas las voces
  4. **Integración con WebUI**: `bridge-dual.js` ya tiene soporte para enviar/recibir dumps SysEx `1C` (Chord Memory) y `1E` (Poly Chord) desde/hacia el hardware físico.
* **Verificado en:** SynthEngine.cpp/h, bridge-dual.js.

### H. Transpose y Global Tune (Global Settings) — ✅ IMPLEMENTADO
* **Estado actual:** Implementación completa en el motor DSP C++.
* **Parámetros:**
  - `transpose` — rango **-48..+48 semitonos** (normalized 0-1, width=96, center=48)
  - `global_tune` — rango **-128..+127 cents** (normalized 0-1, width=255, center=128)
  - Sin NRPN (son parámetros globales del instrumento, no por patch)
* **Implementación:**
  | Capa | Archivo | Rol |
  |---|---|---|
  | **SynthEngine** | `SynthEngine.h` | Miembros `transposeSemitones` (int) y `globalTuneCents` (float) |
  | **updateParameters()** | `SynthEngine.cpp` | `transposeSemitones = round(getFloat("transpose") * 96 - 48)`; `globalTuneCents = getFloat("global_tune") * 255 - 128` |
  | **processBlock()** | `SynthEngine.cpp` | `clamp(midiNote + transposeSemitones, 0, 127)` antes de triggerNote/releaseNote (MIDI físico + teclado virtual) |
  | **SynthVoice** | `SynthVoice.h` | Miembro `globalTuneCents`. En `processSample()`: cent to semitone (`/100`), sumado a `lastModOsc1/2DetuneSemitones` → frecuencia de ambos osciladores |
* **Layout de aplicación (orden en la cadena de audio):**
  `MIDI IN → Transpose (±48st, dispatch MIDI) → SynthVoice → Global Tune (cents, por voz) → Detune/Drift/PitchBend (por muestra)`
* **Verificado en:** SynthEngine.cpp/h, SynthVoice.cpp/h.

#### Mapa de verificación normalized → real
| Normalized | Transpose | Global Tune | Nota C4 → |
|:---:|:---:|:---:|:---:|
| 0.0 | -48 st | -128¢ | C1 |
| 0.25 | -24 st | -64¢ | C2 |
| 0.50 | **0 st** | **0¢** | **C4** ✅ |
| 0.75 | +24 st | +64¢ | C6 |
| 1.0 | +48 st | +127¢ | C8 |

#### Validación contra hardware (Jul 2026)
Tras corregir los comandos SysEx del servidor `patchwork-deepmind` (que usaba `cmd=0x04/0x06` en lugar de los correctos `0x03/0x05`), se leyó el Global Parameter Dump del hardware:
- **Global Parameter Dump:** 73 bytes recibidos (56 decodificados ✅)
- **Transpose decodificado:** raw=0 → **-48 semitonos** (hardware en mínimo)
- **Global Tune decodificado:** raw=0 → **-128 cents** (hardware en mínimo)
- **Herramienta:** `node .agents/mcp-handshake/diagnose-sysex.js` con `DEEPMIND_DEVICE_ID=0`
- **MCP:** Las operaciones NRPN (`set_param`, `snapshot_state`) no se ven afectadas.

### I. Puente C++ → WebUI para DebugPanel (Voice State) — ✅ IMPLEMENTADO
* **Estado actual:** Bridge completo y thread-safe para monitoreo en tiempo real.
* **Implementación:**
  1. **Bridge nativo** (`BridgeActions::getVoiceState()`):
     - Expone el estado de las 12 voces como JSON vía native function `"getVoiceState"`
     - Cada voz reporta: active, midiNote, detuneSemitones, panPosition, voicePanSpread, modOsc1DetuneSemitones, modOsc2DetuneSemitones, modPan, modVcfCutoffHz
  2. **Thread safety** (snapshot + CriticalSection):
     - `SynthEngine::updateVoiceSnapshot()` copia el estado de las voces bajo `voiceStateLock` al final de cada `processBlock()`
     - `SynthEngine::getVoiceState()` lee del snapshot bajo el mismo lock
     - El audio thread retiene el lock solo nanosegundos (copia de ~400 bytes)
  3. **WebUI DebugPanel** (`debug-panel.js`):
     - Modal accesible desde `View → Debug: Unison Stacking...`
     - Muestra voces activas con MIDI note name, detune modulado OSC1/OSC2, pan modulado, VCF cutoff modulado
     - Slots inactivos atenuados; indicador "C++ Engine" vs "Theoretical" como data source
     - Auto-refresh cada 250ms
* **Verificado en:** SynthEngine.cpp/h, SynthVoice.h, BridgeActions.h/.cpp, PluginEditor.cpp, bridge-dual.js, debug-panel.js.

### J. Modulation Matrix (8 Slots) — ✅ IMPLEMENTADO
* **Estado actual:** Sistema completo de 8 slots de ruteo con 24 fuentes de modulación y ~45 destinos.
* **Archivos:** `Source/DSP/ModulationMatrix.h`, `Source/DSP/ModulationMatrix.cpp`, `SynthVoice.cpp`, `SynthEngine.cpp`.
* **Implementación:**

  **Estructura de datos (`ModulationMatrix`):**
  - 8 slots de ruteo configurables (`kNumSlots = 8`)
  - Cada slot contiene: `ModSource source`, `ModDestination destination`, `float amount` (bipolar [-1.0, 1.0])
  - `setRoute(slotIndex, src, dest, amount)` — configura un slot (con guarda de rango)
  - `getModulationValue(dest, sourceValues[])` — acumula la contribución de **todos los slots** cuyo destination coincide con `dest`, multiplicando el valor de la fuente por la cantidad del slot

  **24 Fuentes de Modulación (`ModSource` enum):**
  | Valor | Fuente | Procedencia |
  |---|---|---|
  | 0 | kNone | — |
  | 1 | kLFO1 | LFO1 de la voz (o global si Mono)
  | 2 | kLFO2 | LFO2 de la voz (o global si Mono)
  | 3 | kLFO1Uni | LFO1 unipolar (0..1)
  | 4 | kLFO2Uni | LFO2 unipolar (0..1)
  | 5 | kEnv1VCA | Envolvente VCA (actualizada muestra a muestra)
  | 6 | kEnv2VCF | Envolvente VCF
  | 7 | kEnv3MOD | Envolvente MOD
  | 8 | kNoteNumber | Keyboard tracking (MIDI note / 127)
  | 9 | kVelocity | Velocidad de nota (0..1)
  | 10 | kReleaseVelocity | Velocidad de release
  | 11 | kKeyPressure | Aftertouch / Channel Pressure (desde MIDI)
  | 12 | kModWheel | Mod Wheel CC1 (desde MIDI)
  | 13 | kPitchBend | Pitch Bend (bipolar -1..1)
  | 14 | kFootController | Controlador de pie
  | 15 | kExpressionPedal | Pedal de expresión
  | 16 | kBreathController | Controlador de respiración
  | 17 | kSustainPedal | Sustain Pedal CC64
  | 18 | kControlSequencer | Secuenciador de control
  | 19 | kVoiceNumber | Índice de voz normalizado (para Unison spread)
  | 20-22 | kCC_X, kCC_Y, kCC_Z | Controladores continuos X/Y/Z
  | 23 | kMaxSources | (centinela)

  **~45 Destinos de Modulación (`ModDestination` enum):**
  - **OSC1:** Pitch, SquareWidth (PWM), Level
  - **OSC2:** Pitch, ToneMod, Level
  - **Sub/Noise:** SubOscLevel, NoiseLevel
  - **Filtros:** VCF Cutoff, Resonance, EnvDepth, LfoDepth, KeyTrack; HPF Cutoff
  - **VCA:** AmpLevel, AmpPan, PanSpread
  - **LFOs:** Rate, Delay, Slew (LFO1 y LFO2)
  - **Envolventes:** Attack, Decay, Sustain, Release (ENV1, ENV2, ENV3)
  - **FX:** Fx1-4 Level, Fx1-4 Param1/Param2

  **Integración con SynthEngine (`updateParameters()`):**
  ```cpp
  for (int slot = 0; slot < ModulationMatrix::kNumSlots; ++slot)
  {
      juce::String prefix = "mod_matrix_slot" + juce::String(slot + 1);
      int srcVal = getInt(prefix + "_src");
      int destVal = getInt(prefix + "_dest");
      float amount = getFloat(prefix + "_depth");

      modMatrix.setRoute(slot,
          static_cast<ModSource>(srcVal),
          static_cast<ModDestination>(destVal),
          amount);
  }
  ```
  Los parámetros se leen desde APVTS con prefijo `mod_matrix_slot{N}_src`/`_dest`/`_depth` para N=1..8.

  **Resolución en tiempo real (`SynthVoice::processSample()`):**
  La matriz se consulta en múltiples puntos de la cadena de audio:
  1. **Pitch OSC1/OSC2:** `matrix.getModulationValue(kOsc1Pitch, modSources) * 12.0f` (±1 octava)
  2. **PWM OSC1:** `matrix.getModulationValue(kOsc1SquareWidth, modSources)` sumado a `osc1PwmAmount`
  3. **Tone Mod OSC2:** `matrix.getModulationValue(kOsc2ToneMod, modSources)` sumado a `osc2ToneMod`
  4. **Niveles OSC:** `kOsc1Level`, `kOsc2Level`, `kNoiseLevel` escalan la amplitud de cada oscilador
  5. **Filtro VCF:** `kFilterCutoff`, `kFilterResonance` sumados a cutoff/resonancia antes de `vcf.process()`
  6. **Filtro HPF:** `kFilterHPFCutoff` escalado por `* 500.0f` sumado a `hpfCutoffHz`
  7. **VCA Level:** `kAmpLevel` sumado a `vcaLevel`
  8. **Pan:** `kAmpPan` sumado a `basePan` antes de distribuir estéreo

* **Verificado en:** ModulationMatrix.h/.cpp, SynthEngine.cpp (updateParameters), SynthVoice.cpp (processSample).

### K. Sistema de Envolventes (3 ENV: VCA, VCF, MOD) — ✅ IMPLEMENTADO
* **Estado actual:** Tres envolventes ADSR independientes con curvas configurables y time scale drift.
* **Archivos:** `Source/DSP/Envelope.h`, `Source/DSP/Envelope.cpp`, `SynthVoice.cpp`, `SynthEngine.cpp`.
* **Implementación:**

  **Estructura de la clase `Envelope`:**
  - 5 etapas: `kIdle`, `kAttack`, `kDecay`, `kSustain`, `kRelease`
  - Transiciones: `trigger()` → Attack, `release()` → Release (desde cualquier etapa activa)
  - `reset()` → Idle + currentLevel=0

  **Parámetros ADSR:**
  - `setParameters(attackTimeSec, decayTimeSec, sustainLevel, releaseTimeSec)`
    - Todos los tiempos en segundos (0.001s..10s, se clamp a ≥0.001s)
    - `sustainLevel` normalizado 0..1
  - Leídos desde APVTS por `SynthEngine::updateParameters()`:
    ```cpp
    voices[i].env1VCA.setParameters(
        getFloat("env1_attack"),   // 0.001..10.0 segundos
        getFloat("env1_decay"),    // 0.001..10.0 segundos
        getFloat("env1_sustain"),  // 0..1
        getFloat("env1_release")   // 0.001..10.0 segundos
    );
    ```

  **Curvas configurables:**
  - `setCurves(attackCurve, decayCurve, releaseCurve)` — bipolar [-1.0, 1.0]
    - `< 0` → curva exponencial (ataque rápido inicial, decae suavemente)
    - `≈ 0` → lineal
    - `> 0` → curva logarítmica (subida lenta inicial, acelera al final)
  - `applyCurve(progress, curveAmount)`:
    ```cpp
    // curveAmount < 0 → exponent = 1.0 - curveAmount * 3.0 (hasta 4.0)
    // curveAmount > 0 → exponent = 1.0 / (1.0 + curveAmount * 3.0) (hasta 0.25)
    return std::pow(progress, exponent);
    ```
  - Parámetros: `env{N}_attack_curve`, `env{N}_decay_curve`, `env{N}_release_curve` (normalized 0..1, mapeado a -1..1)

  **Time Scale Drift (`setTimeScale`):**
  - Ajusta dinámicamente la velocidad de la fase actual
  - `scale=1.0` → velocidad normal
  - `scale>1.0` → fase más rápida (menor duración)
  - `scale<1.0` → fase más lenta (mayor duración)
  - Se usa para aplicar `envTimeDrift` del Analog Drift Engine:
    ```cpp
    // En SynthVoice::processSample(), antes de avanzar envolventes:
    float driftEnvScale = 1.0f + drift.getEnvTimeDrift() * 0.3f;  // ±30%
    env1VCA.setTimeScale(driftEnvScale);
    env2VCF.setTimeScale(driftEnvScale);
    env3MOD.setTimeScale(driftEnvScale);
    ```

  **Trigger Modes (desde WebUI):**
  - La WebUI soporta 5 modos de trigger (`env{N}_trigger_mode`): Key, LFO 1, LFO 2, Loop, Seq
  - **Key:** Gatillado normal por nota MIDI (`startNote()` → `env.trigger()`)
  - **LFO1/LFO2:** ✅ **IMPLEMENTADO** Jul 2026 — Detección de zero-crossing del LFO correspondiente (prev<0 && current>=0) en `updateModulationSources()`. El re-trigger ocurre en el mismo sample donde el LFO cruza de negativo a positivo.
  - **Loop:** ✅ **IMPLEMENTADO** Jul 2026 — `Envelope::loopMode` hace que al completar la fase Decay (entrar a Sustain), la envolvente se re-triggere automáticamente a Attack, creando un loop Attack→Decay→Attack→... hasta que se recibe `release()`. El release completa normalmente (no loop).
  - **Seq:** (pendiente) — sincronizado con el Control Sequencer (inactivo porque el Control Sequencer DSP no está implementado; cae como Key mode)

  **Distribución en la cadena de audio:**
  | Envolvente | Rol | Conexión |
  |---|---|---|
  | `env1VCA` (ENV1) | Envolvente de amplitud principal | `modSources[kEnv1VCA]` → escala VCA level y se propaga a mod matrix destinos que la usen |
  | `env2VCF` (ENV2) | Envolvente de filtro | `modSources[kEnv2VCF]` → escalada por `vcfEnvDepth` → sumada a cutoff |
  | `env3MOD` (ENV3) | Envolvente de modulación auxiliar | `modSources[kEnv3MOD]` → disponible como fuente de mod matrix (destinos arbitrarios) |

* **Verificado en:** Envelope.h/.cpp, SynthVoice.cpp (processSample), SynthEngine.cpp (updateParameters).

### L. Cadena de Audio Completa (Signal Flow) — ✅ IMPLEMENTADO

* **Diagrama de flujo:**
  ```
  MIDI IN → SynthEngine::processBlock()
              │
              ├── Transpose (±48 semitonos) ─── clamp(0, 127)
              │
              ├── triggerNote() / releaseNote()
              │       │
              │       ├── Chord Memory: expandir nota única en acorde (2-6 notas)
              │       ├── Poly Chord: acumular raíces, re-trigger acorde completo
              │       ├── Mono modes: force-stop de todas las voces previas
              │       └── Unison stacking (1-12 voces por nota)
              │
              ├── LFOs Globales (pre-cálculo para todo el bloque)
              │   globalLfo1.nextSample() para cada sample del buffer
              │   globalLfo2.nextSample() para cada sample del buffer
              │
              └── Por cada voz activa:
                  SynthVoice::process() → processSample()
  ```

  **Cadena interna de `SynthVoice::processSample()` (por muestra):**
  ```
  1. Drift Engine
     ├── drift.getOsc1PitchDrift()      ← cents (ruido browniano para OSC1)
     ├── drift.getOsc2PitchDrift()      ← cents (ruido browniano para OSC2)
     ├── drift.getVcfCutoffDrift()       ← normalized (fluctuación de cutoff)
     ├── drift.getVcfResonanceDrift()    ← normalized (fluctuación de resonancia)
     └── drift.getEnvTimeDrift()         ← normalized (velocidad de envolventes)
     
     → setTimeScale() para env1VCA/env2VCF/env3MOD (±30%)
  
  2. Actualizar Fuentes de Modulación
     ├── LFO1.nextSample() o globalLfo1[sampleIndex] (según Poly/Mono/Spread)
     ├── LFO2.nextSample() o globalLfo2[sampleIndex]
     ├── env1VCA.nextSample()  → modSources[kEnv1VCA]
     ├── env2VCF.nextSample()  → modSources[kEnv2VCF]
     ├── env3MOD.nextSample()  → modSources[kEnv3MOD]
     └── drift.nextSample()
  
  3. Resolver Modulaciones de Pitch
     ├── ModMatrix: kOsc1Pitch × sourceValues  (+-12 semitonos)
     ├── ModMatrix: kOsc2Pitch × sourceValues
     ├── Pitch Bend externo (+-2 semitonos)
     ├── Drift OSC1/OSC2 (cents → semitonos)
     ├── Unison Detune (simétrico, ±0-50 cents)
     └── Global Tune (cents → semitonos)
     
     → lastModOsc1/2DetuneSemitones (para DebugPanel)
  
  4. Generación de Osciladores
     ├── OSC1: osc1.nextSample()
     │   ├── Saw wave (si osc1SawEnable)
     │   ├── Pulse wave (si osc1PulseEnable) con PWM modulado
     │   └── Rango: 16'/8'/4' (±12 semitonos)
     │
     ├── OSC2: osc2.nextSample()
     │   ├── Forma de onda según selección
     │   ├── Tone Mod modulado
     │   └── Rango: 16'/8'/4'
     │
     └── Noise: (-1..1) * noiseLevel
     
     → combinedOsc = osc1Sample * osc1Level + osc2Sample * osc2Level + noiseSample
  
  5. Filtro VCF (Pasa-Bajos)
     ├── Cutoff base + mod matrix (kFilterCutoff)
     ├── + Envolvente VCF (env2 × vcfEnvDepth)
     ├── + LFO (lfo1/2 × vcfLfoDepth)
     ├── + Drift cutoff
     ├── + Key tracking (keyTrack × (freq - 261.63Hz))
     ├── Resolución: cutoffLvl ∈ [0, 1] → cutoffHz ∈ [20Hz, 20kHz]
     ├── Resonancia base + mod matrix (kFilterResonance) + drift
     ├── Pole mode: 2-Pole (12dB/oct, 1 biquad) / 4-Pole (24dB/oct, 2 biquads)
     └── Saturación interna tanh() en cada biquad
     
     → filtered = vcf.process(combinedOsc)
  
  6. Filtro HPF (Pasa-Altos)
     ├── Cutoff base + mod matrix (kFilterHPFCutoff × 500Hz)
     ├── Bass Boost (refuerzo de graves opcional)
     └── → finalFiltered = hpf.process(filtered)
  
  7. Amplificador VCA
     ├── Nivel base + mod matrix (kAmpLevel)
     ├── Escalado por envolvente VCA (env1VCA.nextSample())
     ├── Ballsy mode: tanh() con pre-drive + asimetría + makeup gain
     └── Transparent mode: amplificación lineal pura
     
     → signal = vcaOutput
  
  8. Panorámica Estéreo
     ├── Pan base: 0.5 + (unisonPanPosition - 0.5) × voicePanSpread
     ├── Mod matrix: kAmpPan
     ├── Clamp [0, 1]
     └── → outputBuffer[L] += signal × (1 - pan)
                outputBuffer[R] += signal × pan
  ```

  **Resumen de señal por voz:**
  ```
  OSC1 ─┐
  OSC2 ─┤
  Noise ─┤
         v
    [MIX] → VCF (LPF) → HPF → VCA → [PAN] → L─────┐
                                           R─────┐  │
                                                 │  │
    [12 voces sumadas en el buffer estéreo de salida] │
    ←──────────────────────────────────────────────────┘
  ```

  **Controladores MIDI externos en `processBlock()`:**
  | Control | CC/Mensaje | Propagación |
  |---|---|---|
  | Pitch Bend | Pitch Wheel msg | `-1.0..1.0` → `setExternalMod(kPitchBend)` en todas las voces |
  | Mod Wheel | CC 1 | `0..1` → `setExternalMod(kModWheel)` en todas las voces |
  | Sustain Pedal | CC 64 | `0..1` → `setExternalMod(kSustainPedal)` en todas las voces |
  | Aftertouch | Channel Pressure | `0..1` → `setExternalMod(kKeyPressure)` en todas las voces |
  Los controladores se propagan en `triggerNote()` y en cada evento MIDI entrante, afectando todas las voces activas e inactivas (estarán listas cuando se activen).

* **Verificado en:** SynthEngine.cpp (processBlock), SynthVoice.cpp (processSample, process).

### M. HPF (Filtro Pasa-Altos) + Bass Boost — ✅ IMPLEMENTADO
* **Estado actual:** Implementación completa del filtro pasa-altos de 1 polo (6dB/oct) con refuerzo de graves opcional.
* **Archivos:** `Source/DSP/Filter.h`, `Source/DSP/Filter.cpp`, `SynthVoice.cpp`, `SynthEngine.cpp`.
* **Implementación:**

  **Clase `HPF` (Filter.h/cpp):**
  - Filtro pasa-altos RC de **1 polo** (6dB/octava) — simplificado, sin resonancia
  - Algoritmo: `y[n] = alpha * (y[n-1] + x[n] - x[n-1])` donde `alpha = rc / (rc + dt)`
  - `alpha` se recalcula via `updateCoefficients()` cada vez que cambia el cutoff
  - Cutoff configurable: 10Hz a `sampleRate * 0.45` (clamp automático)
  - `setBassBoostActive(bool active)` — activa refuerzo de graves opcional

  **Bass Boost:**
  - Se activa vía `hpf_boost_enable` (parámetro bool, LSB 52)
  - Funciona sumando la **componente pasa-bajos** de la señal original de vuelta al output:
    ```cpp
    float lowPassComponent = sample - y;   // La parte que el HPF eliminó
    y += lowPassComponent * 0.45f;          // Refuerzo suave del 45%
    ```
  - El factor 0.45 produce un realce sutil de graves sin distorsión audible

  **Parámetros (ParametersSpec.cpp):**
  | Parámetro | Tipo | Rango normalized | Rango real | NRPN LSB |
  |---|---|---|---|---|
  | `hpf_cutoff` | float | 0.0–1.0 | 20–2000 Hz | 40 |
  | `hpf_boost_enable` | bool | 0/1 | on/off | 52 |

  **Integración en SynthVoice::processSample() (paso 5-6 de la cadena):**
  ```cpp
  float hpfCutoffMod = matrix.getModulationValue(ModDestination::kFilterHPFCutoff, modSources);
  float hpfCutoffHz = std::clamp(params.hpfCutoff + hpfCutoffMod * 500.0f, 10.0f, 10000.0f);
  hpf.setCutoff(hpfCutoffHz);
  hpf.setBassBoostActive(params.hpfBassBoost);
  float finalFiltered = hpf.process(filtered);
  ```
  El destino `kFilterHPFCutoff` en la Mod Matrix escala por ×500 Hz para un rango musicalmente útil (±500Hz desde el cutoff base).

* **Verificado en:** Filter.h/.cpp (HPF class), SynthVoice.cpp (processSample), SynthEngine.cpp (updateParameters).


### N. Hard Sync de Osciladores (OSC Sync) — ✅ IMPLEMENTADO

* **Implementado:** Jul 2026 — Ver sección 2.N en código fuente (Oscillator.h, OSC1.h/.cpp, OSC2.h/.cpp, SynthVoice.h/.cpp)
* **Estado actual:** El parámetro `osc_sync_enable` se lee desde APVTS, se almacena como `bool oscSync` en `SynthVoice::VoiceParams`, y **se consulta en cada muestra** en `processSample()` para detectar el wrap de fase de OSC2 y resetear OSC1.
* **Archivos:** `Source/ParametersSpec.cpp`, `Source/DSP/SynthVoice.h`, `Source/DSP/SynthEngine.cpp`, `Source/DSP/SynthVoice.cpp`, `Source/DSP/Oscillator.h`, `Source/DSP/OSC1.h/.cpp`, `Source/DSP/OSC2.h/.cpp`.
* **Archivos:** `Source/ParametersSpec.cpp` (línea 38), `Source/DSP/SynthVoice.h` (línea 101), `Source/DSP/SynthEngine.cpp` (línea 73).
* **Implementación actual:**

  **Lo que SÍ existe:**
  - Parámetro registrado en `ParametersSpec.cpp` con rango bool, default=0 (off):
    ```cpp
    { "osc_sync_enable", "OSC Hard Sync", "oscilador", "bool", 0.0f, 1.0f, 0.0f, -1, 20, {} },
    ```
  - Lectura en `SynthEngine::updateParameters()`:
    ```cpp
    p.oscSync = getBool("osc_sync_enable");
    ```
  - Almacenamiento en `SynthVoice::VoiceParams`:
    ```cpp
    bool oscSync = false;   // ← declarado pero NUNCA leído en processSample()
    ```

  **Lo que NO existe (brecha):**
  - `params.oscSync` **no se consulta** en `SynthVoice::processSample()`
  - `OSC1::nextSample()` y `OSC2::nextSample()` avanzan su fase independientemente, sin sincronización
  - No hay método para resetear la fase de OSC1 desde OSC2 (ni viceversa)

  **Guía de implementación requerida:**
  1. **`Oscillator.h`** — exponer `virtual void resetPhase() = 0` y `virtual double getPhase() const = 0` en la interfaz base
  2. **`OSC1.h/.cpp` y `OSC2.h/.cpp`** — implementar `resetPhase()` (phase=0) y `getPhase()` (retorna phase)
  3. **`SynthVoice::processSample()`** — detectar wrap de fase de OSC2 y resetear OSC1:
     ```cpp
     if (params.oscSync && osc2.getPhase() < prevOsc2Phase)
         osc1.resetPhase();
     prevOsc2Phase = osc2.getPhase();
     ```

  **Efecto sonoro esperado:** OSC1 reinicia su ciclo cada vez que OSC2 completa el suyo, generando el característico "hard sync sweep" al variar `osc2_pitch`.

* **Verificado en:** ParametersSpec.cpp, SynthVoice.h, SynthEngine.cpp. Búsqueda de `oscSync` en SynthVoice.cpp — sin referencias. Parámetro declarado pero inerte.


### O. Portamento / Glide (10 modos) — ✅ IMPLEMENTADO

* **Nota:** `global_portamento`, `porta_mode` y `porta_osc_bal` son parámetros que ahora se leen en `updateParameters()`. Antes de la implementación (Jul 2026) estaban inertes. Ver sección 2.P para otros parámetros que aún no se leen.
* **Implementado:** Jul 2026 — Ver sección 2.O en código fuente (SynthEngine.h/.cpp, SynthVoice.h/.cpp)
* **Estado actual:** Los tres parámetros de portamento existen en `ParametersSpec.cpp` y la UI WebUI los expone (panel PORTA/Glide con LED rows, Porta Time, Osc Bal), pero **el motor DSP C++ no los procesa**. Ni se leen desde APVTS, ni hay lógica de glide entre notas.
* **Archivos:** `Source/ParametersSpec.cpp` (líneas 61-62, 131), `Source/DSP/SynthEngine.cpp` (ausente en `updateParameters()`), `Source/DSP/SynthVoice.h/.cpp` (ausente en `VoiceParams` y `processSample()`).

  **Parámetros definidos pero inertes:**
  | Parámetro | NRPN LSB | Tipo | Rango | Descripción |
  |---|---|---|---|---|
  | `global_portamento` | 34 | float | 0.0–1.0 | Tiempo de portamento/glide |
  | `porta_mode` | 35 | enum | 0–9 | 10 modos de comportamiento |
  | `porta_osc_bal` | 91 | float | -128–127 | Balance de oscilador durante glide |

  **10 modos de Portamento (`porta_mode`, LSB 35):**
  | Raw | Modo | Comportamiento |
  |:---:|---|---|
  | 0 | **Normal** | Glide a velocidad constante entre notas consecutivas |
  | 1 | **Fingered** | Glide solo en legato (notas solapadas); sin glide en staccato |
  | 2 | **Fix-Rate** | Tasa de glide fija (independiente del intervalo) |
  | 3 | **Fix-Fing** | Fingered + Fix-Rate combinados |
  | 4 | **Exp** | Curva exponencial de glide (acelera hacia el final) |
  | 5 | **Exp-Fing** | Exp + Fingered |
  | 6 | **Fixed+2** | Fix-Rate + 2 semitonos de pre-glide |
  | 7 | **Fixed-2** | Fix-Rate - 2 semitonos de pre-glide |
  | 8 | **Fixed+5** | Fix-Rate + 5 semitonos de pre-glide |
  | 9 | **Fixed-5** | Fix-Rate - 5 semitonos de pre-glide |

  **Lo que NO existe (brecha):**

  **1. Lectura en `SynthEngine::updateParameters()`:** No hay código que lea `global_portamento`, `porta_mode` ni `porta_osc_bal` desde APVTS. No se propagan a ninguna voz.

  **2. Estado en `SynthVoice::VoiceParams`:** No hay miembros para portamento en la estructura `VoiceParams`.

  **3. Almacenamiento en `SynthEngine`:** No hay variables de estado de portamento (ni por voz ni globales).

  **4. Lógica de glide en `triggerNote()` / `processSample()`:**
  - `SynthEngine::triggerNote()` asigna `currentMidiNote` directamente sin interpolación
  - `SynthVoice::processSample()` calcula frecuencia desde `currentMidiNote` sin glide: `freq = 440 * 2^((note-69)/12)`
  - El comentario en `processSample()` línea 170 dice "Pitch base de la nota + Portamento / Pitch Bend externo" pero **solo implementa Pitch Bend**

  **Implementación requerida:**

  **A. Añadir estado de portamento a `SynthEngine`:**
  ```cpp
  // SynthEngine.h — nuevos miembros
  float globalPortamentoTime = 0.0f;     // normalized 0-1
  int portaMode = 0;                      // 0-9
  float portaOscBal = 0.0f;               // -128..127
  ```

  **B. Leer parámetros en `updateParameters()`:**
  ```cpp
  globalPortamentoTime = getFloat("global_portamento");
  portaMode = getInt("porta_mode");
  portaOscBal = getFloat("porta_osc_bal");
  ```

  **C. Añadir estado de glide por voz en `SynthVoice`:**
  ```cpp
  // SynthVoice.h — nuevos miembros
  float currentPortaPitch = 0.0f;          // pitch actual interpolado
  float targetPortaPitch = 0.0f;           // pitch destino
  float portaTimeNormalized = 0.0f;        // tiempo de glide para esta voz
  int portaMode = 0;
  bool portaActive = false;
  ```

  **D. Inicializar glide en `SynthVoice::startNote()`:**
  ```cpp
  void SynthVoice::startNote(int midiNoteNumber, ...)
  {
      // Calcular pitch destino
      targetPortaPitch = midiNoteNumber;
      
      // Si es la primera nota o modo sin glide, saltar directamente
      if (!portaActive || portaMode == 1 /* Fingered con staccato */) {
          currentPortaPitch = targetPortaPitch;
          currentMidiNote = midiNoteNumber;
      } else {
          // Para Fingered: glide solo si nota anterior está activa (legato)
          // Para Normal: glide siempre
      }
  }
  ```

  **E. Interpolar pitch en `processSample()`:**
  ```cpp
  // Antes de calcular frecuencia:
  if (std::abs(currentPortaPitch - targetPortaPitch) > 0.001f)
  {
      float glideSpeed = portaTimeToGlideRate(portaTimeNormalized, portaMode);
      currentPortaPitch += (targetPortaPitch - currentPortaPitch) * glideSpeed;
      float effectiveNote = currentPortaPitch + /* modulations */;
      freq = 440 * 2^((effectiveNote - 69)/12);
  }
  ```

  **F. `portaTimeToGlideRate()` — convertir tiempo a velocidad de interpolación:**
  ```cpp
  // Mapeo normalized 0-1 → velocidad de glide
  // 0.0 = instantáneo (sin glide), 1.0 = muy lento (~5 segundos para 1 octava)
  float glideRate = 1.0f - portaTimeNormalized * 0.998f;  // 1.0 → 0.002 (lento)
  // Modos especiales:
  switch (portaMode) {
      case 2: case 3: /* Fix-Rate: tasa constante independiente del intervalo */ break;
      case 4: case 5: /* Exp: curva exponencial */ glideRate = glideRate * glideRate; break;
      // Fixed+N: pre-glide de N semitonos
  }
  ```

  **G. `porta_osc_bal` — balance OSC1/OSC2 durante glide:**
  Controla qué oscilador se desliza (-128 = solo OSC2 glides, +127 = solo OSC1 glides, 0 = ambos). Implementar como factor de mezcla entre `osc1Note` (con glide) y `osc2Note` (sin glide, o viceversa).

  **Efecto sonoro esperado:** Al activar portamento, las notas consecutivas deslizan suavemente entre sí en lugar de saltar. Los modos Fingered solo deslizan cuando se tocan notas en legato (sin soltar la anterior). Los modos Fixed adornan el glide con un pre-salto de N semitonos. El parámetro `porta_osc_bal` permite desacoplar el glide de OSC1 vs OSC2 para efectos de "desafinación temporal".

* **Verificado en:** ParametersSpec.cpp (parámetros definidos), SynthEngine.cpp (ausencia de lectura en updateParameters), SynthVoice.cpp/h (ausencia de lógica de glide en startNote y processSample). Portamento no implementado en el motor DSP C++.


---

### P. Parámetros Inertes en el DSP C++ (Análisis Completo de Brechas de Lectura)

* **Estado actual:** De los **~120+ parámetros** definidos en `ParametersSpec.cpp`, todos los que tienen efecto audible en el motor DSP ahora se leen y propagan correctamente. Anteriormente existía un **bug de truncamiento de enums** (ver sección 2.Q) que hacía que los parámetros tipo `AudioParameterChoice` se leyeran incorrectamente aunque aparecieran en `getInt()`.
* **Archivos:** `Source/ParametersSpec.cpp` (definición), `Source/DSP/SynthEngine.cpp` (lectura), `Source/DSP/FX/FXEngine.cpp` (lectura).
* **Metodología:** Se compararon los IDs de todos los parámetros registrados en `ParametersSpec::getSpecs()` contra las llamadas `getFloat/`getInt/`getBool` en `updateParameters()` de `SynthEngine.cpp`.

#### Parámetros leídos correctamente (70+ parámetros) ✅

```
OSC1:       osc1_saw_enable, osc1_square_enable, osc1_pwm_amount, osc1_range, osc1_pitch_mod
OSC2:       osc2_pitch, osc2_tone_mod, osc2_level, osc2_pitch_mod, osc2_range
Global:     noise_level, osc_sync_enable (leído pero inerte — ver 2.N)
VCF:        vcf_cutoff, vcf_resonance, vcf_pole_mode, vcf_env_depth, vcf_env_vel,
            vcf_lfo_depth, vcf_lfo_select, vcf_env_polarity, vcf_key_track, vcf_pitch_bend
HPF:        hpf_cutoff, hpf_boost_enable
VCA:        vca_level, vca_mode, vca_env_depth, vca_vel_sens
Envelopes:  env{1,2,3}_attack, env{1,2,3}_decay, env{1,2,3}_sustain, env{1,2,3}_release,
            env{1,2,3}_attack_curve, env{1,2,3}_decay_curve, env{1,2,3}_release_curve
LFOs:       lfo{1,2}_rate, lfo{1,2}_delay, lfo{1,2}_slew, lfo{1,2}_shape, lfo{1,2}_key_sync,
            lfo{1,2}_mono_mode
Drift:      voice_drift, param_drift, drift_rate
Chord:      chord_enable, poly_chord_enable, chord_key, chord_type
Portamento: global_portamento, porta_mode, porta_osc_bal  (implementados Jul 2026)
Transpose:  transpose, global_tune
Mod Matrix: mod_matrix_slot{1..8}_{src,dest,depth}  (24 parámetros)
Unison:     voice_mode, unison_detune, vca_pan_spread
```

**Todos los parámetros DSP se leen correctamente.** Ver sección 2.Q para la corrección del bug de truncamiento de enums que afectaba a la lectura de `AudioParameterChoice`.

#### Parámetros UI-only (esperado) ℹ️

Los siguientes parámetros se manejan exclusivamente en la **WebUI (JavaScript)** y no necesitan estar en el DSP C++:

| Categoría | Parámetros | Justificación |
|---|---|---|
| **Efectos (FX)** | `fx{1..4}_type`, `fx{1..4}_param{1..12}`, `fx{1..4}_gain`, `fx_routing`, `fx_mode`, `fx{1..4}_mix` | Sin motor de efectos en C++ — todo se procesa en WebUI |
| **Secuenciador** | `seq_enable`, `seq_clock`, `seq_length`, `seq_swing`, `seq_key_loop`, `seq_slew_rate` | Control secuencial solo en WebUI |
| **Arpegiador** | `arp_enable`, `arp_mode`, `arp_rate`, `arp_clock_divider`, `arp_key_sync`, `arp_gate_time`, `arp_hold`, `arp_pattern`, `arp_swing`, `arp_octave`, `arp_velocity_gate` | Arpegiador solo en WebUI |
| **Emulador** | `slot_a_type`, `slot_b_type`, `unison_voices` | Parámetros internos de la UI, sin mapeo NRPN real |
| **Alias** | `osc_drift` | Alias de `voice_drift` (ya leído) |
| **Duplicados** ~~`osc1_lfo_aftertouch` (x2), `osc1_lfo_modwheel` (x2), `osc2_aftertouch_pitch` (x2), `osc2_modwheel_pitch` (x2)~~ | ✅ Eliminados — las 4 entradas duplicadas han sido removidas de `ParametersSpec.cpp` |

#### Resumen de brechas DSP activas

| Prioridad | Parámetros | Estado |
|---|---|---|
| **Todas** | Los 14 parámetros DSP críticos + 2 Performance/Settings | ✅ **Implementados y leídos correctamente** (ver 2.Q para corrección de truncamiento de enums) |

* **Verificado en:** Comparación manual de `ParametersSpec::getSpecs()` (152+ entradas) contra `SynthEngine::updateParameters()` (~70+ lecturas activas). Sin brechas activas.


---

### Q. Corrección de Truncamiento de Enums en SynthEngine y FXEngine — ✅ CORREGIDO

* **Corregido:** Jul 2026 — `Source/DSP/SynthEngine.cpp`, `Source/DSP/FX/FXEngine.cpp`
* **Bug:** La lambda `getInt()` usaba `static_cast<int>(param->load())` que **truncaba** el valor normalizado (0.0–1.0) devuelto por `getRawParameterValue()`. `AudioParameterChoice` almacena su índice como float normalizado, por lo que para un enum con 13 opciones (ej. `voice_mode`), el índice 1 se almacena como `1/12 ~ 0.083`, y `static_cast<int>(0.083)` = **0**, no 1.

**Efecto:** Todos los parámetros tipo `AudioParameterChoice` con más de 2 opciones se leían como 0 o 1, ignorando los valores intermedios:

| Parámetro | Opciones | Antes (leía) | Ahora (lee) |
|---|---|---|---|
| `voice_mode` | 13 (Poly...Poly8) | solo 0 y 12 | **0–12** ✅ |
| `porta_mode` | 14 (Normal...Fixed-24) | solo 0 y 13 | **0–13** ✅ |
| `osc1_pm_source` | 7 (LFO1...LFO2Uni) | solo 0 y 6 | **0–6** ✅ |
| `osc1_pwm_source` | 6 (Manual...Env3) | solo 0 y 5 | **0–5** ✅ |
| `osc2_pm_source` | 7 (LFO1...LFO2Uni) | solo 0 y 6 | **0–6** ✅ |
| `fx_routing` | 10 (Series...Feedback) | solo 0 y 9 | **0–9** ✅ |
| `fx1_type` | 36 (Bypass...Rotary) | solo 0 y 35 | **0–35** ✅ |
| `arp_mode` | 11 (Up...Chord) | solo 0 y 10 | **0–10** ✅ |
| `note_priority` | 3 (Lowest/Highest/Last) | solo 0 y 2 | **0–2** ✅ |
| ... y ~30+ más | ... | ... | ✅ |

**Fix aplicado en ambos archivos:**
```cpp
// ANTES (roto):
auto getInt = [&](const juce::String& id) -> int {
    if (auto* param = apvts.getRawParameterValue(id))
        return static_cast<int>(param->load());  // trunca 0.083 a 0
    return 0;
};

// DESPUES (correcto):
auto getInt = [&](const juce::String& id) -> int {
    if (auto* param = apvts.getParameter(id))
        if (auto* choice = dynamic_cast<juce::AudioParameterChoice*>(param))
            return choice->getIndex();  // devuelve el indice real
    return 0;
};
```

**Archivos modificados:**
| Archivo | Cambio |
|---|---|
| `Source/DSP/SynthEngine.cpp` | Lambda `getInt` reemplazada por `dynamic_cast<AudioParameterChoice>` |
| `Source/DSP/FX/FXEngine.cpp` | Misma corrección |

**Verificado:** Build Debug exitoso para ambos targets (`ABDEep`, `ABDEep_UnitTests`). Sin errores de compilación.


---

### R. Cobertura de Tests Unitarios — ANÁLISIS

* **Última actualización:** Jul 2026
* **Archivo:** `Source/DSP/FX/FXUnitTests.cpp`
* **Runner:** `ABDEep_UnitTests.exe` (headless, vía `juce_add_console_app` + `initialiseJuce_GUI()`)
* **Nota:** Los tests no pueden ejecutarse en entornos sin hardware de audio (segfault en `initialiseJuce_GUI()`). Se compilan y linkean correctamente.

#### Tests existentes

| Test | Lo que cubre | Estado |
|---|---|---|
| **All FX types through FXSlot factory** | Tipos 1-35 vía `FXSlot::setType()`, proceso 5 bloques, verifica NaN | ✅ Completo |
| **Direct effect instantiation** | 20 efectos instanciados directamente (Delay, Chorus, Reverb Hall/Plate, Flanger, Phaser, Rotary, AutoPan, Amp, Dist, Edison, MoodFilter, Enhancer, Comp, NoiseGate, Dual/Vintage Pitch, DecimDelay, TapeDelay, ModDelayRev) | ✅ Completo |
| **FXEngine routing modes** | Itera routing 0-9 con `setRoutingMode()` activo. Verifica no-NaN para cada modo | ✅ **CORREGIDO** |
| **FXSlot edge cases** | Bypass (type=0), type toggle cíclico 10 veces, verifica NaN | ✅ Completo |
| **Parameter range safety** | `setParameter()` con valores negativos, out-of-range, >1.0 — no debe crashear | ✅ Completo |
| **Stereo vs mono handling** | Buffer mono (1 canal) con FX slot activo | ✅ Completo |
| **FX Mode: Insert/Send/Bypass** | Modos 0-2 con routing=0. Verifica: no-NaN, Bypass=passthrough exacto, Insert=cambia la señal | ✅ Completo |
| **FX Mode: Bypass with all routing** | Bypass con routing modes 0-9, verifica passthrough exacto (tolerancia 1e-6) | ✅ Completo |
| **FX Gain range clamping** | Clamping [0,1], zero-gain=silence, full-gain=output, scaling ratio 0.5x | ✅ Completo |
| **FX parameter boundary values per type** | 35 tipos × N parámetros × 5 valores límite (0.0, 1.0, 0.5, 0.0, 1.0) + índices extra (numParams..11) | ✅ Completo |
| **FX parameter rapid sweep** | 35 tipos × 20 pasos, barrido 0→1→0 de todos los parámetros simultáneamente | ✅ Completo |
| **FXEngine integration: routing + gain + mode** | 8 sub-tests combinando routing 0-9 + gain profiles + FX mode Insert/Send/Bypass + inactive slots | ✅ Completo |

#### Parámetros FX sin cobertura de tests unitarios

| Parámetro | ¿Cubierto? | Nota |
|---|---|---|
| `fx_routing` | ✅ Sí (parcial) | Routing 0-9 con Bypass; routing real sin setter |
| `fx_mode` | ✅ Sí | Insert (0), Send (1), Bypass (2) con verificación de passthrough |
| `fx{1..4}_type` | ✅ Sí | Via FXSlot factory (tipos 1-35) + instanciación directa (20 efectos) |
| `fx{1..4}_gain` | ✅ Sí | Clamping [-0.5→0.0, 1.5→1.0], zero-gain=silence, full-gain=output, scaling ratio 0.5x |
| `fx{1..4}_param{1..12}` | ✅ Sí | 5 valores límite por parámetro × 35 tipos + sweep 0→1→0 por tipo. Cobertura completa de boundary values |

#### Parámetros DSP sin cobertura de tests unitarios

Los siguientes parámetros del `SynthEngine` no tienen tests unitarios porque `FXUnitTests.cpp` solo cubre el FX Engine:

| Parámetro | Dónde se lee | Test existente |
|---|---|---|
| `voice_mode` | `SynthEngine.cpp` | ❌ No |
| `osc1_pm_source` | `SynthEngine.cpp` | ❌ No |
| `porta_mode` | `SynthEngine.cpp` | ❌ No |
| `note_priority` | `SynthEngine.cpp` | ❌ No |
| ... ~70+ parámetros DSP | `SynthEngine.cpp` | ❌ No |

Se recomienda crear un `SynthEngineUnitTests.cpp` para cubrir la lectura de estos parámetros.

#### Resumen de cobertura

| Área | Tests | Líneas de test | Cobertura de parámetros |
|---|---|---|---|
| **FXSlot** (efectos individuales) | 3 tests | ~120 | 35/35 tipos ✅ |
| **FXEngine** (ruteo + modos + gain + params + integración) | 7 tests | ~500 | fx_routing + fx_mode + fx_gain + fx_param combinados en 8 escenarios de integración ✅ |
| **SynthEngine** (motor DSP completo) | 0 tests | 0 | ❌ |

* **Verificado en:** `Source/DSP/FX/FXUnitTests.cpp`, `Source/DSP/FX/FXEngine.h/.cpp`.


---

### S. Auditoría de Brechas DSP Activas (Jul 2026)

* **Última actualización:** Jul 2026
* **Metodología:** Cruce manual de `ParametersSpec::getSpecs()` contra cada llamada `getFloat/getInt/getBool` en `SynthEngine::updateParameters()` y `FXEngine::updateParameters()`, más revisión del flujo de audio en `SynthVoice::processSample()`.

#### 🚨 CRÍTICO — Parámetros definidos en APVTS pero NUNCA leídos en el DSP

Estos parámetros existen en `ParametersSpec.cpp`, tienen NRPN asignado (el hardware los envía), y la UI los escribe en APVTS — pero **ningún código en el motor C++ los lee**:

| Parámetro | NRPN LSB | Tipo | Esperado | Estado |
|---|---|---|---|---|
| ~~`env1_trigger_mode`~~ | 57 | enum | Envolvente 1 puede resetear por LFO o Loop | ✅ **LEÍDO** Jul 2026 |
| ~~`env2_trigger_mode`~~ | 66 | enum | Envolvente 2 puede resetear por LFO o Loop | ✅ **LEÍDO** Jul 2026 |
| ~~`env3_trigger_mode`~~ | 75 | enum | Envolvente 3 puede resetear por LFO o Loop | ✅ **LEÍDO** Jul 2026 |
| ~~`lfo1_arp_sync`~~ | 4 | bool | LFO 1 sincronizado al reloj del arpegiador | ✅ **LEÍDO + IMPLEMENTADO** Jul 2026 |
| ~~`lfo2_arp_sync`~~ | 11 | bool | LFO 2 sincronizado al reloj del arpegiador | ✅ **LEÍDO + IMPLEMENTADO** Jul 2026 |
| ~~`fx1_mix`~~ | — | float | Mezcla wet/dry del slot FX1 | ✅ **CORREGIDO** Jul 2026 |
| ~~`fx2_mix`~~ | — | float | Mezcla wet/dry del slot FX2 | ✅ **CORREGIDO** Jul 2026 |
| ~~`fx3_mix`~~ | — | float | Mezcla wet/dry del slot FX3 | ✅ **CORREGIDO** Jul 2026 |
| ~~`fx4_mix`~~ | — | float | Mezcla wet/dry del slot FX4 | ✅ **CORREGIDO** Jul 2026 |

#### 🚨 CRÍTICO — Características DSP faltantes por completo

| Feature | Hardware | Emulador | Impacto |
|---|---|---|---|
| ~~**FX Feedback Gain** (Routing 9)~~ | Parámetro de feedback global que realimenta la salida → entrada del FX Engine | ~~`fbGain` siempre es 0.0, **nunca se asigna desde APVTS**. Modo 9 ≡ Modo 0~~ → **CORREGIDO**: `fx_feedback_gain` agregado, `fbGain` conectado en `updateParameters()`. Además, se eliminó `fbBuffer.clear()` que mataba el feedback loop. | ✅ **ACTIVO** Jul 2026 |
| **Control Sequencer DSP** | Secuenciador de 32 pasos modula cualquier destino vía Mod Matrix como fuente `kControlSequencer` | Parámetros en APVTS y UI, pero **sin código DSP**. La fuente Mod Matrix siempre es 0 | Secuenciador visible pero inaudible |
| **Arpeggiator DSP** | Arpegiador genera notas MIDI internas en el DSP | Solo en WebUI, no genera notas en el motor C++ | Sin arpegiador en modo standalone |

#### ~~⚠️ MEDIO — Sub Oscillator~~ ✅ **IMPLEMENTADO** Jul 2026

El hardware DeepMind 12 tiene un **Sub Oscillator** (onda cuadrada, 1 octava abajo) con nivel independiente:
- Parámetro `sub_level` agregado a `ParametersSpec.cpp`
- `ModulationMatrix` destino `kSubOscLevel` ahora se lee y aplica
- `SynthVoice::processSample()` genera sub oscillator y lo suma a `combinedOsc`
- `subPhase` es miembro por voz, reseteable vía `oscKeyReset`

#### 🔧 MENOR — Cosas que funcionan pero incompletas

| Item | Detalle |
|---|---|
| **Routing modes 2 y 3 idénticos** | Mode 2 (Par 1/2 + Par 3/4) y Mode 3 (Full Parallel) llaman a la misma función `processFullParallel()` |
| **Insert vs Send idénticos** | `FXEngine::process()` trata mode 0 y 1 igual (solo bypass en mode 2). El hardware diferencia Insert (señal sustituida) de Send (mezcla send/return) |
| **OSC2 Waveform Selection** | El hardware permite seleccionar forma de onda en OSC2 (Saw, Square, PWM, Tone Mod). Nuestra implementación solo varía Tone Mod |
| **`trigger_mode` no propaga a env trigger modes** | El parámetro global `trigger_mode` (NRPN 86) se lee pero no afecta a `env{1,2,3}_trigger_mode`. Son parámetros separados en el hardware |

#### Resumen de brechas activas

| Prioridad | Cantidad | Impacto |
|---|---|---|
| ~~🔴 **CRÍTICO: No leídos en DSP**~~ | ~~5 parámetros~~ | ✅ **CORREGIDO** Jul 2026 — env trigger modes + lfo arp sync ahora se leen desde APVTS |
| ~~🔴 **CRÍTICO: Feature ausente: FB Gain**~~ | ~~1~~ | ✅ **CORREGIDO** Jul 2026 — `fx_feedback_gain` agregado y conectado |
| 🔴 **CRÍTICO: Feature ausente** | 2 (Control Seq, Arp DSP) | Secuenciador y arpegiador no funcionan en DSP |
| 🟡 **MEDIO: Sub Oscillator** | 1 | Falta un oscilador completo |
| 🔵 **MENOR: Incompleto** | 4 | Mejorable pero no bloqueante |

* **Verificado en:** Comparación exhaustiva de `ParametersSpec::getSpecs()` (~160+ entradas) contra `SynthEngine::updateParameters()`, `FXEngine::updateParameters()`, y `SynthVoice::processSample()`.


---

## 3. Próximos Pasos Recomendados para el Desarrollo

### Características DSP del DeepMind 12 ya implementadas (✔️)

| Feature | Archivos | Estado |
|---|---|---|
| LFO Phase Mono/Spread | SynthEngine, SynthVoice, LFO | ✅ Completo |
| Unison Voice Stacking & Detuning | SynthEngine, SynthVoice | ✅ Completo |
| Analog Drift Engine | DriftEngine, SynthVoice | ✅ Completo |
| MidiTranslationEngine 14-bit NRPN | MidiTranslationEngine.h | ✅ Completo |
| VCA Mode (Ballsy mejorado) | SynthVoice | ✅ Completo |
| VCF 2-Pole / 4-Pole switching | Filter (VCF) | ✅ Completo |
| Chord Memory & Poly Chord | SynthEngine, bridge-dual.js | ✅ Completo |
| C++ → WebUI Voice State Bridge | BridgeActions, SynthEngine, debug-panel.js | ✅ Completo |
| Thread Safety (CriticalSection) | SynthEngine | ✅ Completo |
| Transpose & Global Tune | SynthEngine, SynthVoice | ✅ Completo |
| Modulation Matrix (8 Slots) | ModulationMatrix, SynthEngine, SynthVoice | ✅ Completo |
| Sistema de Envolventes (3 ENV) | Envelope, SynthVoice, SynthEngine | ✅ Completo |
| Cadena de Audio Completa (Signal Flow) | SynthVoice, SynthEngine | ✅ Completo |
| HPF + Bass Boost | Filter (HPF), SynthVoice, SynthEngine | ✅ Completo |
| Hard Sync de Osciladores (2.N) | Oscillator, OSC1/OSC2, SynthVoice | ✅ Completo |
| Portamento / Glide 10 modos (2.O) | SynthEngine, SynthVoice | ✅ Completo |
| Parámetros DSP inertes (2.P) | ParametersSpec, SynthEngine (updateParameters) | ✅ 9 implementados — 7 pendientes |

### Características pendientes de implementar

Se han identificado las siguientes brechas en el motor DSP C++:

**Brechas activas de parámetros DSP (7 parámetros restantes, ver 2.P):**
1. ✅ ~~`osc1_pm_source`, `osc1_pwm_source`, `osc1_pm_mode`, `osc1_lfo_aftertouch`, `osc1_lfo_modwheel`~~ → **IMPLEMENTADOS**
2. ✅ ~~**Fuentes de modulación OSC2** (Alta): `osc2_pm_source`/`osc2_pitch_mod_select`, `osc2_tpm_source`, `osc2_aftertouch_pitch`, `osc2_modwheel_pitch`~~ → **IMPLEMENTADOS**
3. ✅ ~~**Modulación VCF** (Alta): `vcf_aftertouch_lfo`, `vcf_modwheel_lfo`~~ → **IMPLEMENTADOS**
4. ✅ ~~**Voice allocation** (Media): `note_priority`, `trigger_mode`, `osc_key_reset`~~ → **IMPLEMENTADOS**
5. ✅ ~~**Pitch Bend Range** (Baja): `pitch_bend_up`, `pitch_bend_down`~~ → **IMPLEMENTADOS**

**Brecha DSP estructural:**
6. ✅ ~~**Hard Sync de Osciladores (2.N)**: `osc_sync_enable` se almacena en `VoiceParams` pero nunca se consultaba en `processSample()`.~~ → **IMPLEMENTADO**

**Brecha DSP estructural:**
6. ✅ ~~**Hard Sync de Osciladores (2.N)**: `osc_sync_enable` se almacena en `VoiceParams` pero nunca se consultaba en `processSample()`.~~ → **IMPLEMENTADO**

**Mejoras opcionales:**
7. **(Opcional) Efectos DSP en C++**: Actualmente los efectos se manejan solo desde la WebUI. Para un plugin standalone completo, sería ideal implementar los 36 tipos de efectos en el motor C++.
8. **(Opcional) Envolventes multisegmento avanzadas**: Aunque las envolventes ADSR curvas ya están implementadas, se podrían añadir envolventes multisegmento personalizables.
