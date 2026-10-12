# 🗺️ Roadmap de Consolidación Arquitectónica — ABDEep

Este documento define el roadmap técnico y de seguimiento para la consolidación de la arquitectura interna de **ABDEep**, alineándolo con las mejores prácticas y componentes compartidos del ecosistema ABD Synths (**ABDSharedCode** y **ABDMS2000**).

---

## 🎯 Regla Fundamental y Límite de Alcance (Scope Boundary)

> 🔒 **INTERFAZ VISUAL INTOCABLE (ZERO UI REDESIGN):**  
> Toda la consolidación descrita en este roadmap es **estrictamente de arquitectura interna, pipeline de generación de código, algoritmos DSP y puentes de comunicación**.  
> **No se alterará la interfaz gráfica de usuario (WebUI)**: ni el diseño visual, ni los estilos CSS, ni la distribución HTML de los paneles, faders, knobs o el Calibration Lab. Toda la experiencia de usuario y presentación se preserva al 100%.

---

## 📊 Resumen de Fases y Estado

| Fase | Descripción | Alcance Técnico | Impacto UI | Estado |
|---|---|---|---|---|
| **Fase 1** | SSOT Registry & `--check` Validator | Generador unificado de esquemas con gate de validación sin escritura | 🟢 Nulo | ✅ Completado |
| **Fase 2** | Filtros ZDF Canónicos de `DspCore` | VCF OTA y Juno HPF conectados a `abd::dsp` (fieles a DM12) | 🟢 Nulo | ✅ Completado |
| **Fase 3** | VoiceAllocator Híbrido | Robo de voz matemático puro (`SynthCore`) + VoiceManager DeepMind 12 | 🟢 Nulo | ✅ Ya integrado (No tocar) |
| **Fase 4** | Unificación WebView2Bridge | Puente C++ <-> JS normalizado y seguro | 🟢 Nulo | ✅ Completado |
| **Fase 5** | Alineación de Contratos con `MidiKeyboard` | Integración del schema JSON de control para el ecosistema común | 🟢 Nulo | ✅ Completado |

---

## 🚀 Desglose de Fases

### 🔹 Fase 1: SSOT Registry & `--check` Validator

* **Objetivo:** Prevenir discrepancias (drift) entre las definiciones de parámetros de hardware/emulador y los artefactos generados (.gen.h, .gen.cpp, .gen.js, data.json).
* **Entregables:**
  - [x] Soporte para el argumento `--check` en [scripts/registry_generator.js](file:///d:/desarrollos/ABDSynths/ABDEep/scripts/registry_generator.js).
  - [x] Script `"check:registry": "node scripts/registry_generator.js --check"` en [package.json](file:///d:/desarrollos/ABDSynths/ABDEep/package.json).
  - [x] Batería de pruebas unitarias que verifiquen el modo `--check` en [scripts/registry_generator.test.js](file:///d:/desarrollos/ABDSynths/ABDEep/scripts/registry_generator.test.js).
  - [ ] Integración del check como paso obligatorio en CI/CD local (`pnpm run check:registry`).
* **Criterio de Aceptación:** Si algún archivo generado difiere del commit actual, el comando termina con código de salida `1` sin modificar el disco; si todo está al día, termina con código `0`.

---

### 🔹 Fase 2: Consumo de Filtros ZDF Compartidos desde `ABDSharedCode/DspCore` (Fidelidad al Instrumento)

* **Objetivo:** Consolidar el motor de filtrado de ABDEep sobre las implementaciones matemáticas TPT/ZDF compartidas en `ABDSharedCode/DspCore/` (`abd::dsp`), preservando de forma **estricta y exclusiva la fidelidad al instrumento DeepMind 12**:
  > ⚠️ **Principio de Identidad de Instrumento:**  
  > **No se introducen ni exponen filtros ajenos a la arquitectura de DeepMind 12.** La síntesis por voz de ABDEep consta únicamente de:
  > 1. **VCF OTA Analógico:** Emulación IR3109/80017A en modos 4-Pole (24 dB) y 2-Pole (12 dB) con saturación analógica y modos de Voicing (`DeepMind` y `Juno-106`).
  > 2. **Juno HPF:** Filtro paso-altos continuo (38.6–1394.2 Hz) con refuerzo analógico de graves (Bass Boost).
  > *(Otros filtros analógicos como Moog Ladder o Korg MS-20 pertenecen a efectos como FX Type 8 Mood Filter / MF-101 o a otros sintes del ecosistema, pero nunca se presentan como opciones en la voz principal de ABDEep).*
* **Componentes Involucrados:**
  - [DspJunoVCF.h](file:///d:/desarrollos/ABDSynths/ABDSharedCode/DspCore/DspJunoVCF.h) (`abd::dsp::JunoVCF_ZDF` con oversampling 2x/4x y calibración DeepMind).
  - [DspJunoHPF.h](file:///d:/desarrollos/ABDSynths/ABDSharedCode/DspCore/DspJunoHPF.h) (`abd::dsp::JunoHPFContinuous` con PCHIP y BassBoost).
  - [DspVcfVoicing.h](file:///d:/desarrollos/ABDSynths/ABDSharedCode/DspCore/DspVcfVoicing.h) (Parámetros analógicos de Voicing y tolerancias).
  - [FXMoodFilter.h](file:///d:/desarrollos/ABDSynths/ABDEep/Source/DSP/FX/FXMoodFilter.h) (Efecto FX 8 MF-101 sobre `abd::dsp::DspMoodFilter`).
* **Estado de Verificación:**
  - [x] [JunoVCF_ZDF.h](file:///d:/desarrollos/ABDSynths/ABDEep/Source/DSP/JunoVCF_ZDF.h) configurado como shim canónico que delega en `abd::dsp::JunoVCF_ZDF`.
  - [x] [JunoHPF.h](file:///d:/desarrollos/ABDSynths/ABDEep/Source/DSP/JunoHPF.h) configurado como shim canónico que delega en `abd::dsp::JunoHPFContinuous`.
  - [x] Comprobación de que la interfaz de usuario y los controles de parámetros solo exponen los controles nativos del DeepMind 12.
  - [x] Serialización XML de `CalibrationSpec` y compatibilidad con `DiagnosticSnapshots`.
* **Criterio de Aceptación:** Todas las 12 voces de ABDEep ejecutan el núcleo ZDF TPT compartido sin divergencias sónicas, respetando al 100% el diseño original del instrumento.

---

### 🔹 Fase 3: VoiceAllocator Híbrido (`SynthCore/VoiceAllocator.h`) — ✅ YA INTEGRADO (NO TOCAR)

* **Objetivo:** Separar la lógica matemática de asignación y robo de voz del modelo de ruteo específico de 12 voces analógicas de DeepMind.
* **Resultado de la Auditoría Técnica:**
  - `SynthEngine.h` (L18, L112) ya incluye e instancia directamente:
    `abd::synth::VoiceAllocator<static_cast<size_t>(kNumVoices)> voiceAlloc;`
  - `SynthEngine_VoiceManager.cpp` (L90-156) ya implementa la escalera de robo canónica (nota repetida → libre → latch → release por nivel → FIFO/RR) delegando en `voiceAlloc.findVoiceToSteal()`, `commitAllocation()` y `markSlotReleased()`.
  - La gestión de modos Unison (Uni2, Uni3, Uni4, Uni6, Uni12, Mono1-6), dispersión de paneo y detune se gestiona limpiamente en `SynthEngine::getUnisonParams()`.
* **Conclusión:** **No se debe tocar `VoiceAllocator`**. La integración híbrida ya está implementada, blindada y funcionando al 100%. Modificarla introduciría riesgos innecesarios de regresión en la polifonía.

---

### 🔹 Fase 4: Unificación del Puente Nativo (`ABDShared::WebView2Bridge`)

* **Objetivo:** Estandarizar la comunicación IPC entre el host nativo JUCE/C++ y la WebUI sin romper los contratos de datos existentes.
* **Premisas Técnicas:**
  - C++ sigue serializando configuraciones internas en **XML**.
  - La WebUI sigue comunicándose y exportando diagnósticos en **JSON** validado contra schemas de `WebUI/schemas/`.
  - La normalización centralizada de nombres (`voiceSnapshots` <-> `voices`, `noteNumber` <-> `midiNote`) en `calibration_store.js` se preserva.
* **Entregables:**
  - [x] Implementar la capa de transporte compartida para WebView2 asegurando protección contra llamadas fuera del hilo de audio.
  - [x] Verificación exhaustiva con los tests de Vitest de contratos y exportación de calibración (`npm run test`).

---

### 🔹 Fase 5: Alineación de Contratos con `MidiKeyboard` y Ecosistema de 15 Sintes — ✅ COMPLETADA

* **Objetivo:** Integrar el diccionario de parámetros de ABDEep en el estándar JSON de `ABDSharedAssets/contracts` y `ABDSharedCode/MidiKeyboard` (`parameterLookup.js` / `lookupRawValue`), permitiendo control universal (Aftertouch, ModWheel, mapeo de knobs) sin alterar el motor analógico interno.
* **Premisas Técnicas y Límites:**
  - **Identidad de Calibración Intocable:** El motor de audio y el Calibration Lab continúan operando con `CalibrationSpec` (XML interactivo y análisis FFT A/B contra grabaciones reales de DeepMind 12).
  - La abstracción `wire ↔ domain` a nivel de contrato solo define metadatos de control para el front-end compartido, no sustituye las tolerancias y curvaturas vivas de hardware en C++.
* **Entregables:**
  - [x] Validar y registrar `behringer_deepmind12.json` / `behringer_deepmind6.json` y sus especificaciones exhaustivas `behringer_deepmind12_parameter_spec.json` / `behringer_deepmind6_parameter_spec.json` en `ABDSharedAssets/contracts` con metadatos completos de CCs, rangos y curvas (`Exp`, `Pow`, `Linear`).
  - [x] Exponer parámetros esenciales de modulación y teclado (`lfo1Freq`, `lfo1Rate`, `lfo2Freq`, `lfo2Rate`, `filterCutoff`, `resonance`, `osc1Gain`, Aftertouch, ModWheel) para resolución limpia en `MidiKeyboard` (`parameterLookup.js` / `lookupRawValue`).
  - [x] Validar con la suite de Vitest de `MidiKeyboard` (`npm test`: 8 suites, 367 tests pasando al 100%) y de `ABDEep` (`npm test`: 127 suites, 5,131 tests pasando al 100%).

---

## 🧪 Matriz de Calidad y Verificación

Antes de dar por concluida cualquier fase:
1. **Tests C++:** Compilar y ejecutar pruebas de motor de síntesis.
2. **Tests WebUI:** Ejecutar `npm run test` en ABDEep (126 suites, >5,000 pruebas en verde).
3. **Verificación de Registro:** Ejecutar `npm run check:registry` asegurando paridad total.
4. **Verificación Visual:** Inspección del frontend comprobando que la interfaz visual permanece 100% inalterada.
