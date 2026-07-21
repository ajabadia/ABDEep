# AGENTS.md — Reglas del juego para agentes de desarrollo

> **Proyecto:** ABD Eep — Controlador/Editor WebUI + Motor DSP (C++/JUCE) para Behringer DeepMind 12  
> **Propósito:** Este archivo es un filtro de calidad automático. Cualquier agente que entre a modificar código DEBE leer y seguir estas reglas.

---

## 1. Build System — CMake obligatorio

### 1.1 Projucer descartado, JuceHeader.h OK
- Projucer queda totalmente descartado para este proyecto — no se genera ni modifica código desde Projucer.
- Todo el build se maneja exclusivamente via CMake (`CMakeLists.txt` raíz).
- Los targets se definen con `juce_add_plugin`, `juce_add_gui_app`, o `juce_add_console_app`.

### 1.2 Reglas de CMakeLists.txt
- `juce_generate_juce_header(TargetName)` DEBE llamarse después de `juce_add_*` y ANTES de `target_sources`.
- `target_sources` usa `PRIVATE` con listas planas de `.cpp` y `.h`.
- Para añadir archivos nuevos, agregarlos a `target_sources` del target correspondiente.
- Los tests unitarios van en su propio target (`juce_add_console_app`) con `target_link_libraries` a la misma librería `abdeep_core`.
- Los tests DSP se compilan con Catch2 (no otro framework).
- Los tests WebUI se ejecutan con Vitest (configurado en `package.json` raíz).

### 1.3 Includes de JuceHeader.h
- Nuestro `CMakeLists.txt` ya llama `juce_generate_juce_header()` después de `juce_add_plugin`, lo que genera el header global.
- **Seguir usando `#include <JuceHeader.h>`** en todos los archivos C++. NO incluir módulos individuales (como `juce_core/juce_core.h`).
- NO refactorizar archivos existentes que ya usan `<JuceHeader.h>`.
- NO incluir rutas absolutas. CMake se encarga de configurar los include paths.

---

## 2. Contratos de Datos — Serialización estricta

### 2.1 C++: XML obligatorio
- Toda estructura de datos persistente o transmisible DEBE implementar `toXml()` y `fromXml()`.
- Usar `juce::XmlElement` para serialización.
- NO usar JSON en C++ salvo para archivos de configuración externos (como `CalibrationSpec`).
- Ejemplo de firma:
  ```cpp
  std::unique_ptr<juce::XmlElement> toXml() const;
  bool fromXml(const juce::XmlElement& xml);
  ```

### 2.2 WebUI: JSON + JSON Schema
- Toda comunicación bridge → UI usa JSON (normalizado a `{value: 0..1}`).
- Los filtros y configuraciones de UI se serializan a JSON y se persisten en `localStorage`.
- NO mezclar formatos: si un dato viaja como JSON en la WebUI, no serializarlo como XML en C++ (usar `toXml`/`fromXml` para almacenamiento interno, JSON para interfaz).

### 2.3 NRPN ↔ Byte Offset
- `byteOffset < 128` → NRPN(MSB=0, LSB=byteOffset)
- `byteOffset ≥ 128` → NRPN(MSB=1, LSB=byteOffset-128)
- El mapa completo está en `bridge-param-maps.js` (`PARAM_TO_BYTE_OFFSET`).

---

## 3. CSS — Tokens de diseño, no ad-hoc

### 3.1 Prohibido CSS ad-hoc
- NO escribir reglas CSS inline ni estilos en JavaScript que dupliquen tokens existentes.
- NO definir nuevos colores, radios, sombras fuera del sistema de tokens.

### 3.2 Usar los tokens preexistentes
- **Colores fondo:** `--bg-deepest`, `--bg-surface`, `--bg-elevated`, `--bg-header`, `--bg-hover`
- **Colores borde:** `--border-dim`, `--border`, `--border-strong`
- **Colores texto:** `--text-primary`, `--text-secondary`, `--text-dim`, `--text-faint`
- **Acentos:** `--accent-primary` (naranja), `--accent-blue`, `--accent-green`, `--accent-teal`, `--accent-pink`, `--accent-red`
- **Radios:** `--radius-xs`, `--radius-sm`, `--radius`, `--radius-md`, `--radius-lg`
- **Sombras:** `--shadow-chassis`, `--shadow-modal`, `--shadow-dropdown`, `--shadow-panel`, `--shadow-inset`, `--shadow-float`
- **Fuente mono:** `'Share Tech Mono'` vía clase `.mono`
- **Tamaños texto:** `--text-2xs` (7px) a `--text-2xl` (18px)

### 3.3 Convención de naming
- `cal-*` para Calibration Lab, `sysex-*` para monitor hex, `modmatrix-*` para matriz de modulación, etc.
- Estados: `is-selected`, `is-changed`, `is-delta`, `active` (ON).
- Preferir clases semánticas sobre estilos inline.

### 3.4 Temas
- 8 temas disponibles via `data-theme` en `<body>`. No romper la compatibilidad con temas existentes.
- Los temas solo redefinen `--accent-*`, `--bg-*`, `--border-*`, `--text-*`.

---

## 4. Testing — Verificación obligatoria

### 4.1 Flujo obligatorio antes de declarar una tarea completa
1. Ejecutar tests WebUI: `npm test` (Vitest, raíz del proyecto).
2. Si hay cambios en C++, ejecutar build + tests DSP: `.\build.bat --run-unit-tests` (Release config).
3. Verificar que **0 tests nuevos fallen**. Fallos preexistentes documentados se ignoran.
4. Si se añadió funcionalidad nueva, agregar tests unitarios para ella (Vitest para WebUI, Catch2 para DSP).

### 4.2 Tests preexistentes conocidos (ignorar)
Los siguientes fallos SON PREEXISTENTES y no deben ser "corregidos":
- DriftEngine tolerance (límite de 0.01 superado en algunos casos)
- Envelope lifecycle (pruebas de ciclo de vida con curvas no estándar)
- Transpose/tune mapping (conversión cents-semitonos)
- FX boundary crash (2 tests de audio en límites FX)
- Cualquier fallo documentado como preexistente en el `current-summary` del sistema.

Actualmente hay 7 fallos preexistentes documentados. No perder tiempo intentando corregirlos; se revisarán al final del proyecto.

---

## 5. Arquitectura del Proyecto

### 5.1 Capas
```
┌──────────────────┐
│   WebUI (HTML/JS)│  Interfaz de usuario, LCD, teclado virtual
├──────────────────┤
│   bridge-dual.js  │  Puente MIDI: JUCE (callNative) ↔ Web MIDI API
├──────────────────┤
│ C++ DSP (JUCE)   │  SynthEngine, FXEngine, Filter, Oscillators
├──────────────────┤
│   Hardware DM12  │  SysEx / NRPN / MIDI CC
└──────────────────┘
```

### 5.2 Modos de operación
- **JUCE mode:** bridge llama a `callNative` → `BridgeActions` → APVTS → DSP.
- **HW mode:** bridge envía NRPN/SysEx por Web MIDI → hardware real.
- **Calibration Lab:** app standalone C++ (`ABDEepCalibrationLab`) + WebUI panels.

### 5.3 Calibration Lab (Tema 11)
- 6 pestañas C++ standalone: Param Trace, Patch Diff, Round-Trip, Live Validation, Audio A/B, Calibration Editor.
- WebUI panels paralelos: Dashboard, Run List, PatchDiff, RoundTrip, LiveValidation, AudioAB.
- Datos fluyen entre C++ y WebUI vía WebSocket/bridge.

---

## 6. Proceso de Desarrollo

1. Leer `AGENTS.md` y `roadmap.md` antes de tocar código.
2. Identificar el tema/tarea en el roadmap.
3. Explorar el código existente (NO asumir APIs o patrones).
4. Implementar siguiendo los contratos de datos y tokens CSS.
5. Ejecutar tests obligatorios (sección 4).
6. Reportar resultados: qué se cambió, tests pasaron/fallaron, próximo paso.
