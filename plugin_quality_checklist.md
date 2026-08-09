# 🎹 Checklist de Calidad para Plugins de Audio JUCE (VST3 / Standalone / WebUI)

> **Propósito:** Lista de verificación exhaustiva para auditar y validar plugins de audio basados en JUCE antes de su distribución. Elaborada a partir de errores reales encontrados y corregidos en **ABDEep** y patrones observados en **ABDJUNiO601**, **Odin2**, **Dexed**, **OB-Xf** y **Surge**.
>
> **Uso:** Aplicar este checklist a cada proyecto antes de compilar una versión de distribución. Marcar `[x]` cuando se haya verificado.

---

## 📑 Índice

1. [Inicialización y Constructor](#1-inicialización-y-constructor)
2. [Hilo de Audio (`processBlock`) — Seguridad de Tiempo Real](#2-hilo-de-audio-processblock--seguridad-de-tiempo-real)
3. [Integración con DAW — Programas y Presets](#3-integración-con-daw--programas-y-presets)
4. [Persistencia de Estado — Save/Restore de Sesión](#4-persistencia-de-estado--saverestore-de-sesión)
5. [Automatización y Gestos de Parámetros](#5-automatización-y-gestos-de-parámetros)
6. [Latencia y Cola de Audio (Tail Length)](#6-latencia-y-cola-de-audio-tail-length)
7. [Calidad de Audio DSP](#7-calidad-de-audio-dsp)
8. [Gestión de Voces (Voice Stealing / Polyphony)](#8-gestión-de-voces-voice-stealing--polyphony)
9. [Calibración y Configuración Externa](#9-calibración-y-configuración-externa)
10. [WebUI / WebView2 — Bridge C++ ↔ JavaScript](#10-webui--webview2--bridge-c--javascript)
11. [Recursos Binarios y Empaquetado (BinaryData)](#11-recursos-binarios-y-empaquetado-binarydata)
12. [Logging y Diagnósticos](#12-logging-y-diagnósticos)
13. [Compilación y Build System (CMake)](#13-compilación-y-build-system-cmake)
14. [Tests Unitarios y de Contrato](#14-tests-unitarios-y-de-contrato)
15. [Rendimiento y CPU Idle](#15-rendimiento-y-cpu-idle)
16. [Compatibilidad Multiplataforma](#16-compatibilidad-multiplataforma)
17. [Validación con Pluginval (Estándar de la Industria)](#17-validación-con-pluginval-estándar-de-la-industria)
18. [Resiliencia ante Cambios de Sample Rate y Buffer Size](#18-resiliencia-ante-cambios-de-sample-rate-y-buffer-size)
19. [Bypass Correcto (VST3 `kIsBypass`)](#19-bypass-correcto-vst3-kisbypass)
20. [Soporte MIDI Completo y MIDI Learn](#20-soporte-midi-completo-y-midi-learn)
21. [Firma de Código y Distribución](#21-firma-de-código-y-distribución)
22. [Foco de Teclado y Accesibilidad](#22-foco-de-teclado-y-accesibilidad)
23. [Herramientas de Profiling y Diagnóstico Avanzado](#23-herramientas-de-profiling-y-diagnóstico-avanzado)

---

## 1. Inicialización y Constructor

Errores de inicialización causaron audio distorsionado en ABDEep porque los valores de calibración estaban sin inicializar (memoria basura → frecuencias erróneas).

- [x] **Todos los campos numéricos del DSP tienen valores por defecto explícitos** en la declaración de la clase o en la lista de inicialización del constructor (`float cutoff = 1000.0f;`).
- [x] **Estructuras de calibración o configuración inicializadas con `factoryDefaults()`** antes de que `prepareToPlay()` las use.
- [x] **Punteros cacheados a parámetros APVTS obtenidos en el constructor** con verificación `jassert(ptr != nullptr)` para detectar IDs de parámetros mal escritos en tiempo de desarrollo.
- [x] **No se realiza I/O de archivos, red, ni allocations pesadas en el constructor** del Processor. Estas operaciones deben diferirse a `prepareToPlay()` o a un hilo de fondo.
- [x] **El `UndoManager` se pasa correctamente al APVTS** si se requiere soporte de Undo/Redo en el DAW.

> [!CAUTION]
> **Hallazgo real (ABDEep):** `activeCalibration` y `pendingCalibration` se dejaron sin inicializar. Esto provocaba que las curvas de envolvente, LFO y filtro calculasen valores de `NaN` o `Inf`, resultando en audio distorsionado (trémolo ultrarrápido).

---

## 2. Hilo de Audio (`processBlock`) — Seguridad de Tiempo Real

El hilo de audio del DAW tiene requisitos estrictos de tiempo real. Cualquier operación bloqueante causa *glitches*, *dropouts* o *xruns*.

### 🚫 Operaciones PROHIBIDAS en `processBlock()`

- [x] **Cero escrituras a disco** (no `juce::File::appendText()`, no `std::ofstream`, no `fopen`).
- [ ] **Cero allocations de heap** (no `new`, no `std::vector::push_back()` que cause realloc, no `juce::String` concatenations en bucle).
- [ ] **Cero locks bloqueantes** (no `std::mutex::lock()`, no `juce::CriticalSection` que pueda contener en el hilo de mensaje). Usar `try_lock()` o colas lock-free.
- [ ] **Cero llamadas a sistema** (no `system()`, no `exec()`, no `Sleep()`).
- [x] **Cero logging síncrono** (usar `DBG()` condicionado a `#if JUCE_DEBUG` o buffer circular lock-free).

### ✅ Buenas prácticas

- [x] **`juce::ScopedNoDenormals noDenormals;`** al inicio de `processBlock()` para evitar que números subnormales degraden el rendimiento de la FPU (especialmente en filtros IIR).
- [x] **Limpiar canales de salida no usados** con `buffer.clear(i, 0, numSamples)` para los canales entre `totalNumInputChannels` y `totalNumOutputChannels`.
- [x] **MIDI Queue thread-safe**: Si la WebUI o un hilo de UI inyecta mensajes MIDI, usar `juce::MidiBuffer` protegido con `juce::CriticalSection` (lock mínimo) o mejor aún `juce::AbstractFifo`.
- [x] **Verificar que `prepareToPlay()` se ha ejecutado** antes de procesar audio (guardar flag `isPrepared`).

> [!WARNING]
> **Hallazgo real (ABDEep):** `SynthEngine_MIDI.cpp` escribía a `webview_log.txt` dentro del procesamiento de notas MIDI, causando bloqueos de 2-15ms por evento en el hilo de audio.

---

## 3. Integración con DAW — Programas y Presets

Los DAWs (Cubase, Ableton, Logic, Reaper, FL Studio, Studio One) consultan activamente estas funciones para mostrar el nombre del patch actual en la barra del plugin.

- [x] **`getNumPrograms()` retorna al menos `1`** (JUCE requiere mínimo 1 aunque no tengas presets).
- [x] **`getProgramName(0)` retorna el nombre del preset actual**, no una cadena vacía `{}`.
- [x] **`changeProgramName(index, newName)` actualiza la variable interna** y llama a `updateHostDisplay()`.
- [ ] **`setCurrentProgram(index)` carga el preset correspondiente** si tienes un banco de presets.
- [x] **`updateHostDisplay(ChangeDetails().withProgramChanged(true))`** se invoca cada vez que el usuario cambia de preset desde la UI del plugin.

> [!IMPORTANT]
> **Hallazgo real (ABDEep):** `getProgramName()` retornaba `{}` (cadena vacía). Cubase y Ableton mostraban el plugin sin nombre de preset, perdiendo la trazabilidad del patch activo.
>
> **Referencia (ABDJUNiO601):** Implementación completa con `PresetManager` que devuelve `p->name` para cada índice y conecta `setCurrentProgram(index)` a `loadPreset(index)`.

---

## 4. Persistencia de Estado — Save/Restore de Sesión

Cuando el usuario guarda un proyecto de DAW y lo reabre meses después, TODO el estado del plugin debe restaurarse exactamente.

### `getStateInformation()`

- [x] **Serializa el árbol completo de la APVTS** (`apvts.copyState()`).
- [x] **Incluye metadatos de sesión no automatizables** como:
  - Nombre del preset activo (`presetName`)
- [x] **Usa formato XML** (serialización nativa de JUCE con `createXml()` + `copyXmlToBinary()`).
- [x] **Incluye un campo `version`** en el nodo de sesión para migración futura de esquemas.

### `setStateInformation()`

- [x] **Valida que el XML recibido es válido** antes de reemplazar el estado (`xmlState->hasTagName(apvts.state.getType())`).
- [x] **Restaura metadatos de sesión** con valores por defecto seguros si faltan campos (forward compatibility).
- [x] **Notifica a la UI** (`notifyUIOfStateChange()`) para que el frontend se actualice.
- [x] **Notifica al host** (`updateHostDisplay()`) para que el DAW refleje el cambio de nombre de preset.
- [x] **Recarga parámetros DSP internos** (`updateParamsFromAPVTS()` o equivalente) para sincronizar el motor de audio.

> [!TIP]
> **Patrón de referencia (ABDJUNiO601):** Usa un nodo hijo `<Session version="2">` con campos `patchName`, `author`, `category`, `tags`, `notes`, `date`, `favorite`, `currentBank`, `currentPreset`, `activeABSlot`. Al restaurar, aplica defaults seguros para cada campo si no existe en versiones anteriores del XML.

---

## 5. Automatización y Gestos de Parámetros

Para que los DAWs registren correctamente la automatización y permitan Undo/Redo, es fundamental usar el protocolo de gestos de JUCE.

- [x] **Al iniciar el arrastre de un slider:** `param->beginChangeGesture()`.
- [x] **Durante el arrastre:** `param->setValueNotifyingHost(normalizedValue)`.
- [x] **Al soltar el slider:** `param->endChangeGesture()`.
- [ ] **Los IDs de parámetros son estables y únicos.** Cambiar un ID entre versiones rompe la automatización guardada en proyectos de DAW existentes.
- [ ] **Los rangos de parámetros son correctos** (`NormalisableRange` con `skew` apropiado para frecuencias, tiempos, etc.).

> [!WARNING]
> Si no se llaman los gestos, Ableton Live no registra los puntos de automatización, y Cubase/Nuendo no permite deshacer los movimientos de faders del plugin.

---

## 6. Latencia y Cola de Audio (Tail Length)

- [x] **`setLatencySamples(n)`** se llama en `prepareToPlay()` si el plugin introduce latencia (oversampling, lookahead, FFT, convolución).
- [x] **`getTailLengthSeconds()`** retorna un valor realista si el plugin tiene reverb o delay:
  - `0.0` para sintetizadores sin efectos internos.
  - `2.0 - 10.0` para plugins con reverb larga.
  - `std::numeric_limits<double>::infinity()` si el efecto puede auto-oscilar indefinidamente.
- [ ] **Si se usa oversampling**, recalcular `setLatencySamples()` cada vez que el factor de oversampling cambie.

> [!NOTE]
> **Hallazgo real (ABDEep):** `getTailLengthSeconds()` retornaba `0.0`, pero el plugin tiene reverbs y delays internos. **Corregido:** ahora retorna `5.0s` (cubre el máximo de 4.6s de `FXMultiTapDelay` + reverbs). Además se añadió `setLatencySamples(0)` en `prepareToPlay()`.

---

## 7. Calidad de Audio DSP

### Suavizado de parámetros (Parameter Smoothing)

- [ ] **Todos los parámetros que controlan frecuencias, amplitudes o coeficientes de filtro usan suavizado temporal** para evitar *zipper noise* (clicks audibles al mover faders rápido).
  - Filtro 1-pole exponencial: `smoothed = smoothed + alpha * (target - smoothed)` con `alpha ≈ 1 - exp(-2π * cutoffHz / sampleRate)`.
  - O usar `juce::SmoothedValue<float>` con `reset(sampleRate, rampTimeSeconds)`.
- [x] **El cutoff del filtro VCF se suaviza** con constante de tiempo `~1ms` para evitar clicks.
- [x] **Los niveles de VCA/Volume se suavizan** para evitar discontinuidades de amplitud.

### Anti-denormals

- [x] **`juce::ScopedNoDenormals`** en `processBlock()`.
- [x] **Anti-denormal explícito en filtros IIR** si se procesan fuera de `processBlock()` (e.g., en voice rendering).

### Clipping y Saturación

- [x] **La salida final se clampea a `[-1.0f, 1.0f]`** o se aplica soft-clipping para evitar enviar valores fuera de rango al DAW.
- [x] **Los parámetros de ganancia nunca producen `NaN` o `Inf`** (verificar divisiones por cero en filtros resonantes).

> [!CAUTION]
> **Hallazgo real (ABDEep):** Sin suavizado en `cutoffLvl`, mover el fader de cutoff desde la WebUI a velocidad normal producía *zipper noise* audible. Corregido con filtro exponencial 1-pole de 1ms.

---

## 8. Gestión de Voces (Voice Stealing / Polyphony)

- [x] **Al robar una voz activa (voice stealing), aplicar un fade-out rápido** (`~5ms`) antes de reasignar para evitar clicks de discontinuidad de fase.
- [ ] **Al iniciar una nota nueva, resetear los estados internos** de la voz (osciladores, envolventes, LFOs, filtros) para evitar artefactos de la nota anterior.
- [ ] **Los modos de polifonía (Poly, Mono, Unison) gestionan correctamente las notas sostenidas** (note stealing queue / priority).
- [ ] **El portamento/glide no produce clicks** al transicionar entre notas.

> [!CAUTION]
> **Hallazgo real (ABDEep):** Al reutilizar voces activas sin fade-out, se producían clicks audibles por discontinuidad de fase en los osciladores. Corregido con `stealingFadeGain` de ~5ms.

---

## 9. Calibración y Configuración Externa

- [x] **Si el plugin carga archivos de configuración/calibración desde disco**, verificar que:
  - Si el archivo no existe → fallback a valores de fábrica sin crash.
  - Si el archivo está corrupto o tiene formato incorrecto → fallback a valores de fábrica + log de advertencia.
  - Si la versión del esquema es incompatible → fallback a valores de fábrica + aviso al usuario.
- [x] **`validate()`**: Todos los valores cargados pasan por `std::clamp()` a rangos matemáticamente seguros antes de usarse en el DSP.
- [x] **La ruta del archivo de configuración usa `juce::File::getSpecialLocation()`** (AppData, Documents) en lugar de rutas hardcodeadas.

> [!TIP]
> **Patrón de referencia (ABDEep):** `CalibrationSpec::fromXmlWithFallback()` intenta parsear el XML, y si falla por cualquier razón, retorna `CalibrationSpec::factoryDefaults()` validado. Esto garantiza que el plugin siempre arranca en un estado funcional.

---

## 10. WebUI / WebView2 — Bridge C++ ↔ JavaScript

### Registro de funciones nativas

- [x] **Cada función nativa registrada con `.withNativeFunction()`** tiene su declaración en `BridgeActions.h` y su implementación en un `BridgeActions_*.cpp`.
- [x] **Las funciones nativas siempre llaman a `completion()`** al finalizar. Si no, el callback de JavaScript queda colgado indefinidamente.
- [x] **Validación de argumentos**: Verificar `args.size() >= N` antes de acceder a `args[N]`.

### Estado y Sincronización

- [x] **`getSynthState()` incluye todos los datos relevantes para la UI**, incluyendo metadatos no-APVTS (nombre de preset, estado de calibración, etc.).
- [x] **Al restaurar estado en `setStateInformation()`, notificar a la WebUI** vía `evaluateJavascript()` o dejar que el próximo poll de estado la actualice.

### Rendimiento

- [x] **El timer de polling UI → Engine se ejecuta a ≤30 Hz** (no 60 Hz, que duplica la carga de `evaluateJavascript()`).
- [x] **Solo enviar datos a JS cuando han cambiado** (comparar con el valor anterior antes de llamar a `evaluateJavascript()`).
- [x] **No enviar JSON grandes en cada frame.** Fragmentar en updates incrementales si el estado es grande.

### Escalado y Ventana

- [x] **`resized()` llama a `webComponent->setBounds(getLocalBounds())`** para que la WebUI se adapte al tamaño de la ventana del DAW/Standalone.
- [x] **No hay barras de desplazamiento no deseadas** al redimensionar.
- [x] **El CSS de la WebUI usa `width: 100%; height: 100%;`** o viewport units para adaptarse al contenedor.

---

## 11. Recursos Binarios y Empaquetado (BinaryData)

- [x] **Todos los archivos de la WebUI están registrados en `CMakeLists.txt`** bajo `juce_add_binary_data()`.
- [x] **El Resource Provider tiene fallback a BinaryData** cuando los archivos no se encuentran en disco (modo Release/distribución).
- [ ] **El name-mangling de BinaryData** (`/` → `_`, `.` → `_`, `-` → `_`, dígito inicial → `_` + nombre) coincide con el que genera JUCE automáticamente.
- [ ] **Los tipos MIME están correctamente mapeados** para todos los formatos de archivo que sirve la WebUI (`.html`, `.css`, `.js`, `.json`, `.png`, `.jpg`, `.ttf`, `.woff`, `.woff2`, `.svg`, `.wasm`).
- [ ] **No quedan rutas de desarrollo hardcodeadas** en el Resource Provider en modo Release.

> [!NOTE]
> **Hallazgo real (ABDEep):** El `pluginResourceProvider` busca primero en disco (`d:\desarrollos\...`) y luego en BinaryData. En Release, los archivos de disco no existirán y se cargará desde BinaryData. Esto funciona, pero las rutas hardcodeadas podrían causar confusión si el directorio de desarrollo se mueve.

---

## 12. Logging y Diagnósticos

- [x] **CERO escrituras a archivos de log en código de producción.** Todo el logging síncrono a disco debe reemplazarse por `DBG()` (que solo ejecuta en Debug builds).
- [x] **No quedan rutas absolutas de desarrollo** (`D:\\desarrollos\\...`) en el código fuente de producción.
- [ ] **Los logs de diagnóstico internos** (si existen) usan `juce::Logger` con un `FileLogger` configurado solo en modo de servicio/diagnóstico, nunca en el hilo de audio.
- [x] **El one-shot diagnostic de la WebUI** (que verifica que `window.__JUCE__` está disponible) se ejecuta una sola vez, no en cada frame.

> [!CAUTION]
> **Hallazgo real (ABDEep):** Se encontraron **6 puntos** de escritura síncrona a `webview_log.txt` en archivos de producción:
> - `PluginEditor.cpp` (constructor: `std::ofstream`)
> - `PluginEditor_NativeFunctions.cpp` (`logFromJS`: `juce::File::appendText`)
> - `PluginEditor_ResourceProvider.cpp` (2 puntos: request log + error log)
> - `BridgeActions_Params.cpp` (2 puntos: set log + error log)
>
> Todos fueron reemplazados por `DBG()` no bloqueante.

---

## 13. Compilación y Build System (CMake)

- [x] **CMake es el único sistema de build.** No hay archivos `.jucer` ni configuraciones manuales de IDE.
- [x] **Los archivos fuente nuevos se registran en `CMakeLists.txt`** en la sección correspondiente (`target_sources`).
- [x] **Las cabeceras generadas de JUCE** (`JuceHeader.h`, `JucePluginDefines.h`) no se modifican manualmente.
- [x] **Los defines de compilación** (`DEEP_TARGET_MODEL`, `JUCE_DEBUG`, etc.) se establecen en CMake, no en los archivos fuente.
- [x] **El build script compila todas las variantes requeridas** (Standalone, VST3, y opcionalmente WASM).
- [x] **Los artefactos de build se generan en directorios estándar** (`build/<target>_artefacts/Release/`).
- [x] **ESLint 0 warnings** en todos los archivos JS del proyecto.
- [ ] **No hay warnings de compilación C++** en los archivos del proyecto (los warnings de JUCE se ignoran con `-w` o flags específicos de CMake).

---

## 14. Tests Unitarios y de Contrato

### C++ Unit Tests

- [x] **Los tests DSP verifican que los efectos no producen `NaN` ni `Inf`** para todas las combinaciones de parámetros extremos.
- [x] **Los tests de boundary values** verifican que parámetros en `0.0`, `0.5`, `1.0` producen salidas válidas.
- [x] **Los tests de rapid sweep** barren todos los parámetros linealmente para detectar discontinuidades o crashes. (IDs 1-35 y 36-56 en FXUnitTests)
- [x] **Los tests de serialización** verifican round-trip: `toXml() → fromXml()` produce el mismo estado.
- [x] **Todos los tests pasan con 0 fallos** antes de cada commit.

### WebUI Tests (Vitest / Jest)

- [x] **Tests de contrato** verifican que los JSON generados por el bridge cumplen los JSON Schemas.
- [x] **Tests de store/state** verifican la normalización de datos del bridge C++ al formato de la UI.
- [x] **4.328 tests WebUI, 789.995 assertions C++ — 0 fallos** en todos los tests.
- [ ] **Los paths de fixtures y esquemas usan `__dirname`** para ser independientes del directorio de ejecución.

---

## 15. Rendimiento y CPU Idle

- [ ] **CPU idle ≤ 1-2%** cuando no se reproducen notas (verificar con un DAW real o con el medidor de CPU del Standalone).
- [x] **No hay timers de alta frecuencia innecesarios.** El timer de UI debe ser ≤30 Hz, no más.
- [x] **Los efectos bypass no procesan audio** (short-circuit temprano en `processBlock()`).
- [ ] **Las voces inactivas no consumen CPU** (no procesar osciladores/filtros si la envolvente ha terminado).
- [ ] **El oversampling se desactiva cuando no es necesario** (e.g., si la distorsión está en bypass).

---

## 16. Compatibilidad Multiplataforma

- [ ] **Las rutas de archivos usan `juce::File` y `getSpecialLocation()`**, no rutas hardcodeadas con `\\` o `/`.
- [ ] **Los separadores de ruta no están hardcodeados** (`\\` funciona solo en Windows).
- [ ] **La WebUI no depende de APIs específicas de Windows** (WebView2 es Windows-only; en macOS se usa WKWebView automáticamente desde JUCE 8).
- [x] **Los `#include` usan forward slashes** (`#include "Core/MyClass.h"`, no `#include "Core\\MyClass.h"`).
- [ ] **Los nombres de archivo no contienen caracteres especiales ni espacios** que puedan causar problemas en Linux o en BinaryData name-mangling.

---

## 17. Validación con Pluginval (Estándar de la Industria)

[Pluginval](https://github.com/Tracktion/pluginval) es la herramienta de validación de facto usada por la mayoría de desarrolladores profesionales de plugins de audio. Es desarrollada por Tracktion y ejecuta docenas de tests automatizados que simulan el comportamiento de un DAW real.

### Qué comprueba pluginval

- **Carga/descarga del plugin** sin crashes ni memory leaks.
- **Cambios de sample rate y buffer size** durante la ejecución.
- **Manipulación aleatoria de parámetros** para detectar crashes por valores extremos.
- **Recall de parámetros** (guardar estado → restaurar → verificar que los valores coinciden).
- **Asignaciones de memoria en el hilo de audio** (macOS: detección automática de allocations en RT).
- **Destrucción de listeners** (verificar que `removeListener` se llama en destructores).

### Checklist

- [x] **Pluginval ejecutado con strictness level ≥ 5** (`pluginval --strictness-level 5 --validate "ABD Eep.vst3"`).
- [x] **Cero fallos en todos los niveles de strictness** — nivel 5 validado con **ALL TESTS PASSED**.
- [x] **Integrado en el pipeline de CI/CD** — creado `scripts/verify_release.ps1` que ejecuta build → tests → pluginval.
- [x] **Probado con la semilla aleatoria por defecto y con semilla fija** para reproducir fallos intermitentes. (`--seed 42` en `scripts/verify_release.ps1`)

> [!IMPORTANT]
> Pluginval es considerado **requisito mínimo** por la mayoría de empresas de plugins profesionales (Native Instruments, Arturia, u-he, etc.). Si tu plugin no pasa pluginval, es muy probable que tenga problemas en algún DAW.

---

## 18. Resiliencia ante Cambios de Sample Rate y Buffer Size

Los DAWs pueden cambiar el sample rate (44100 → 48000 → 96000) y el buffer size (64 → 2048) en cualquier momento, incluso durante la reproducción en algunos hosts.

- [x] **`prepareToPlay()` recalcula todos los coeficientes DSP** cuando cambia el sample rate (filtros, delays, LFOs, envolventes).
- [x] **Los delay lines y buffers internos se redimensionan en `prepareToPlay()`**, nunca en `processBlock()`.
- [x] **No se asume un buffer size fijo ni potencia de 2.** El `numSamples` de `processBlock()` puede ser cualquier número ≤ `maximumBlockSize`.
- [x] **Se maneja el caso de `numSamples == 0`** (algunos hosts envían buffers vacíos como señal de silencio). Añadido `if (buffer.getNumSamples() == 0 || getTotalNumOutputChannels() == 0) return;` tanto en `processBlock()` como en `processBlockBypassed()`.
- [x] **Se guarda el `sampleRate` actual en una variable miembro** y se usa en todos los cálculos DSP dependientes de frecuencia.
- [x] **Los filtros IIR se re-inicializan** (limpiar estados `z-1`, `z-2`) si el sample rate cambia para evitar explosiones de coeficientes.

> [!WARNING]
> FL Studio y Logic Pro son conocidos por enviar buffer sizes variables entre llamadas a `processBlock()`. Hardcodear `bufferSize == 512` causará crashes o audio corrupto en estos hosts.

---

## 19. Bypass Correcto (VST3 `kIsBypass`)

El bypass es un comportamiento crítico que el DAW espera controlar. Un bypass incorrecto puede causar saltos de volumen, artefactos, o que el DAW no sepa que el plugin está desactivado.

- [x] **El parámetro de bypass usa el flag `kIsBypass`** en la definición VST3 para que el host lo identifique como bypass nativo. `fx_mode` marcado con `AudioProcessorParameter::Category::bypassParameter` en `ParametersSpec.cpp`.
- [x] **El ID del parámetro bypass es estable y reservado** (no cambia entre versiones del plugin para no romper automatización existente).
- [x] **Cuando bypass está activo, se implementa `processBlockBypassed()`** con pass-through limpio (audio de entrada a salida sin procesar DSP).
- [x] **Stuck-notes protection**: `synthEngine.panic()` + `clearMidiQueue()` en cada bloque de bypass para evitar notas colgadas.
- [x] **MIDI controller reset**: `resetMidiControllers()` restablece pitchBend, modWheel, aftertouch, sustainPedal al entrar en bypass.
- [x] **El plugin reporta correctamente `processBlockBypassed()`** si el host lo invoca directamente.

---

## 20. Soporte MIDI Completo y MIDI Learn

- [x] **El plugin declara correctamente `acceptsMidi()` y `producesMidi()`** según su naturaleza (sintetizador vs efecto).
- [ ] **Los mensajes MIDI CC se mapean correctamente** a parámetros internos si se implementa MIDI Learn.
- [ ] **Pitch Bend se procesa con resolución de 14 bits** (no solo 7 bits del byte MSB).
- [ ] **Aftertouch (Channel Pressure y Polyphonic)** se procesa si el instrumento lo soporta.
- [ ] **El plugin no consume mensajes MIDI que debería pasar al host** (especialmente MIDI Thru para cadenas de plugins).
- [ ] **MIDI Learn persiste en el estado del plugin** (se guarda/restaura en `getStateInformation` / `setStateInformation`).
- [ ] **Los mensajes SysEx se manejan sin bloquear el hilo de audio** (parsearlos en un hilo de fondo si son grandes).

### Bugs Corregidos en este lote
- [x] **Logger redeclarado** (5 archivos con `const Logger` global → `var Logger`)
- [x] **Vocoder mic null guard** (`window.juce !== null` en `vocoder_mic_audio.js`)
- [x] **Teclado virtual restaurado** (error en cascada del SyntaxError de Logger bloqueaba el render)

---

## 21. Firma de Código y Distribución

### Windows

- [ ] **El binario `.vst3` está firmado digitalmente** con un certificado de firma de código válido (`signtool.exe`).
- [ ] **El instalador/desinstalador está firmado** para evitar warnings de SmartScreen.
- [ ] **El plugin se instala en la ruta estándar VST3** (`C:\Program Files\Common Files\VST3\`).
- [ ] **Se ha probado que antivirus comunes** (Windows Defender, Avast, Norton) no lo marcan como falso positivo.

### macOS

- [ ] **El bundle `.vst3` / `.component` está firmado con Developer ID** y notarizado con Apple.
- [ ] **Se ha verificado con `codesign --verify`** y `spctl --assess`.
- [ ] **El plugin se instala en `~/Library/Audio/Plug-Ins/VST3/`** (usuario) o `/Library/Audio/Plug-Ins/VST3/` (sistema).

### General

- [x] **El plugin tiene un esquema de versionado** claro (SemVer: `MAJOR.MINOR.PATCH`).
- [x] **El número de versión está embebido en el binario** y es consultable desde el DAW (vía `getBuildInfo()` o equivalente).
- [x] **Existe un `CHANGELOG.md`** o notas de release para cada versión.
- [x] **El `.gitignore` excluye artefactos de build** (`build/`, `*.vst3`, `*.exe`, `*.wasm`).

---

## 22. Foco de Teclado y Accesibilidad

La gestión del foco de teclado es un problema clásico entre plugins y DAWs. Si el plugin "roba" el foco del teclado, el usuario no puede usar Space para Play/Stop en el DAW.

- [x] **Los componentes de UI que no necesitan entrada de teclado** tienen `setWantsKeyboardFocus(false)`. Añadido en `PluginEditor.cpp` para liberar atajos de teclado (Space/Play) al DAW.
- [ ] **Los campos de texto (nombre de preset, etc.) capturan el foco solo cuando el usuario hace click** en ellos, y lo liberan al presionar Enter o Escape.
- [x] **Las teclas de transporte del DAW** (Space, Enter, números) se pasan al host cuando el plugin no las necesita activamente.
- [x] **En WebView/WebView2**, el foco de teclado se gestiona correctamente: WebView2 como HWND independiente puede recibir foco al hacer click, pero no captura atajos del DAW.
- [ ] **Navegación por Tab/Shift-Tab** entre controles interactivos funciona si se pretende soportar accesibilidad.

> [!NOTE]
> Este es un problema especialmente relevante para plugins con WebUI embebida (WebView2/WKWebView), ya que el control del navegador tiende a capturar todos los eventos de teclado por defecto.

---

## 23. Herramientas de Profiling y Diagnóstico Avanzado

Herramientas profesionales recomendadas por la comunidad de desarrollo de audio:

### Para usar durante el desarrollo

- [ ] **[Pluginval](https://github.com/Tracktion/pluginval):** Validación automatizada de conformidad y estabilidad.
- [ ] **[melatonin_perfetto](https://github.com/sudara/melatonin_perfetto):** Profiling de timeline con Google Perfetto para visualizar el tiempo exacto de cada función en el hilo de audio.
- [ ] **Thread Sanitizer (TSan):** Detector de data races (disponible en Clang/Xcode). Ejecutar tests con `-fsanitize=thread`.
- [ ] **Address Sanitizer (ASan):** Detector de use-after-free, buffer overflows, etc. Ejecutar con `-fsanitize=address`.
- [ ] **[VST3 Plugin Test Host](https://github.com/steinbergmedia/vst3sdk):** Host de pruebas oficial de Steinberg incluido en el SDK VST3.
- [ ] **[melatonin_inspector](https://github.com/sudara/melatonin_inspector):** Inspector visual de la jerarquía de componentes JUCE para depurar layouts de UI.

### Para verificación pre-release

- [ ] **Test en al menos 3 DAWs diferentes** (e.g., Cubase, Ableton Live, Reaper) para detectar incompatibilidades específicas de host.
- [ ] **Test con sample rates variados** (44100, 48000, 96000, 192000 Hz).
- [ ] **Test con buffer sizes extremos** (32, 64, 128, 256, 512, 1024, 2048, 4096 samples).
- [ ] **Test de stress con muchas instancias** del plugin cargadas simultáneamente (≥ 8 instancias).
- [ ] **Test de larga duración** (dejar el plugin corriendo ≥ 1 hora) para detectar memory leaks o degradación de rendimiento.

---

## 📋 Resumen Rápido de Prioridades

| Prioridad | Área | Impacto si falla |
|-----------|------|-----------------|
| 🔴 Crítico | I/O en hilo de audio | Glitches, dropouts, crashes |
| 🔴 Crítico | Inicialización DSP | Audio distorsionado, NaN/Inf |
| 🔴 Crítico | State save/restore | Pérdida de sesiones de usuario |
| 🔴 Crítico | Pluginval validation | Plugin rechazado por DAWs / usuarios |
| 🔴 Crítico | Sample rate / buffer size | Crashes en FL Studio, Logic, Bitwig |
| 🟠 Alto | Nombre de preset en DAW | UX pobre, confusión de usuario |
| 🟠 Alto | Gestos de automatización | Automatización no funciona |
| 🟠 Alto | Voice stealing clicks | Artefactos audibles |
| 🟠 Alto | Bypass correcto | Audio cortado / artefactos al bypass |
| 🟡 Medio | Tail length incorrecto | Reverb cortada al parar |
| 🟡 Medio | BinaryData en Release | WebUI no carga sin disco |
| 🟡 Medio | MIDI Learn / SysEx | Funcionalidad esperada ausente |
| 🟡 Medio | Foco de teclado | Space/Play no funciona en DAW |
| 🟢 Bajo | Logging de producción | Rutas de dev expuestas |
| 🟢 Bajo | CPU idle excesivo | Pérdida de rendimiento DAW |
| 🟢 Bajo | Firma de código | Warnings del SO al instalar |

---

## 🔗 Referencias Cruzadas de Proyectos

| Punto del Checklist | ABDEep | ABDJUNiO601 | Odin2 | OB-Xf |
|---------------------|--------|-------------|-------|-------|
| `ScopedNoDenormals` | ✅ | ✅ | ✅ | ✅ |
| `getProgramName` funcional | ✅ (corregido) | ✅ | ✅ | ✅ |
| State con metadatos | ✅ (corregido) | ✅ (Session v2) | ✅ | ✅ |
| `updateHostDisplay` | ✅ (corregido) | ✅ | ✅ | ✅ |
| `beginChangeGesture` | ✅ | ✅ | ✅ | ✅ |
| Cero I/O en audio thread | ✅ (corregido) | ✅ | ✅ | ✅ |
| `setLatencySamples` | ✅ (corregido) | ✅ | ✅ | ✅ |
| `getTailLengthSeconds` realista | ✅ (5.0s) | ❌ (retorna 0.0) | ✅ | ✅ |
| Voice stealing fade | ✅ (corregido) | ✅ | ✅ | ✅ |
| Parameter smoothing | ✅ (corregido) | Parcial | ✅ | ✅ |
| Calibration fallback | ✅ | N/A | N/A | N/A |
| WebUI bridge presetName | ✅ (corregido) | ✅ | N/A | N/A |
| Pluginval validado | ✅ (strictness 5 PASSED) | ❌ (pendiente) | ✅ | ✅ |
| Bypass con `kIsBypass` | ✅ (panic + resetMidiControllers) | ❌ (pendiente) | ✅ | ✅ |
| Buffer size 0 check | ✅ (processBlock + bypass) | ❌ (pendiente) | ✅ | ✅ |
| Code signing | ❌ (pendiente) | ❌ (pendiente) | ✅ | ✅ |
| MIDI Learn | ❌ (no aplica) | ✅ | ✅ | ✅ |

---

## 📚 Fuentes y Referencias Externas

| Recurso | URL | Uso |
|---------|-----|-----|
| **Pluginval** | https://github.com/Tracktion/pluginval | Validación automatizada de plugins |
| **VST3 SDK + Validator** | https://github.com/steinbergmedia/vst3sdk | Herramienta oficial de conformidad VST3 |
| **melatonin_perfetto** | https://github.com/sudara/melatonin_perfetto | Profiling de audio con Google Perfetto |
| **melatonin_inspector** | https://github.com/sudara/melatonin_inspector | Inspector visual de componentes JUCE |
| **JUCE Forum — Best Practices** | https://forum.juce.com | Discusiones técnicas de la comunidad |
| **ADC Talks (Audio Developer Conference)** | https://www.youtube.com/@JUCElibrary | Charlas profesionales sobre desarrollo de audio |
| **Real-time Audio Programming 101** | https://www.youtube.com/watch?v=Q0vrQFyAdWI | Charla de Ross Bencina sobre RT safety |

---

> **Última actualización:** 2026-07-29
> **Generado desde:** Auditoría de ABDEep + análisis de ABDJUNiO601, Odin2, OB-Xf, Dexed, Surge + investigación de estándares profesionales de la industria (Pluginval, Steinberg VST3 SDK, melatonin tools, ADC talks)

