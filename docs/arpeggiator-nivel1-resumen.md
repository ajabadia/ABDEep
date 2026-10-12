# Hito de Desacoplamiento de Arpeggiator (Nivel 1) y Estado de Reconciliación

**Fecha:** Octubre 2026  
**Componente:** `Source/DSP/Arpeggiator`  
**Estado:** ✅ Consolidado y verificado en verde (160 suites C++, 0 fallos).

---

## 1. Resumen Ejecutivo

En este hito se completó el **desacoplamiento de Nivel 1** del arpegiador de ABDEep (`Source/DSP/Arpeggiator.h` y `Source/DSP/Arpeggiator.cpp`), transformándolo en un componente de DSP portátil escrito en **C++20 puro**, libre de dependencias del framework JUCE en su núcleo algorítmico, y preservando al 100% la compatibilidad binaria y funcional con los consumidores existentes (`SynthEngine` y suites de prueba).

Paralelamente, se completó la auditoría técnica del trilema bipolar del repositorio, delimitando con precisión el bloque de migración para la reconciliación entre la carga de presets y la capa de conversión wire-dominio.

---

## 2. Cambios Implementados (Arpeggiator Nivel 1)

### 2.1 `Source/DSP/Arpeggiator.h`
* **Eliminación de JUCE:** Se retiró `#include <JuceHeader.h>`. El header ahora solo incluye primitivas de la biblioteca estándar de C++ (`<algorithm>`, `<cmath>`, `<cstdint>`, `<utility>`).
* **Primitivas estándar:** Se reemplazaron todas las llamadas a `juce::jlimit` por `std::clamp`.
* **PRNG determinista (`FastRng`):** En sustitución de `juce::Random`, se introdujo un generador Xorshift32 de 32 bits (`state = 0x12345678`), garantizando reproducibilidad idéntica y libre de dependencias de plataforma para el Modo 8 (Random).
* **Contrato neutro de eventos (`NoteEvent`):**
  ```cpp
  struct NoteEvent
  {
      int   sampleOffset = 0;
      int   note         = 0;
      float velocity     = 0.0f;
      bool  isNoteOn     = false;
  };
  ```
* **Interfaz de emisión desacoplada (Zero-Alloc, sample-accurate):**
  ```cpp
  template <typename EventConsumer>
  void generate(int numSamples, EventConsumer&& consumeEvent);
  ```
  Permite al optimizador C++20 monomorfizar e inlinear la emisión de notas directamente en el lazo de audio del consumidor, sin allocations ni punteros a función.
* **Wrapper de compatibilidad JUCE:**
  Se declaró la sobrecarga `void generate(juce::MidiBuffer& out, int numSamples)` empleando forward declaration (`namespace juce { class MidiBuffer; }`), evitando que el header arrastre cabeceras de JUCE.

### 2.2 `Source/DSP/Arpeggiator.cpp`
* Se actualizó `fillStepNotes` (modo 8) para invocar `rng.nextInt(n)`.
* Se implementó la sobrecarga pública de compatibilidad con JUCE delegando en la plantilla:
  ```cpp
  void Arpeggiator::generate(juce::MidiBuffer& out, int numSamples)
  {
      generate(numSamples, [&out](const NoteEvent& ev) {
          if (ev.isNoteOn)
              out.addEvent(juce::MidiMessage::noteOn(1, ev.note, ev.velocity), ev.sampleOffset);
          else
              out.addEvent(juce::MidiMessage::noteOff(1, ev.note, 0.0f), ev.sampleOffset);
      });
  }
  ```

---

## 3. Certificación y Pruebas C++

La compilación y ejecución de la batería completa en configuración Release arrojó:

* **Target:** `ABDEep_UnitTests.exe`
* **Suites ejecutadas:** 160 (incluyendo `SynthEngine DSP: los destinos 71 ("Arp Gate") y 72 ("Seq Slew")`, modulación a FX y comparadores bit a bit).
* **Aserciones superadas:** 1.119.736
* **Aserciones fallidas:** **0**
* **Regresiones:** Cero. Los cálculos de muestras de gate y timing del reloj se mantienen bit a bit idénticos.

---

## 4. Estado de los Frentes Pendientes (Delimitados y sin ejecutar)

### 4.1 Vía A — Reconciliación Bipolar C++ ↔ JS (Frente Patch/Puente)
* **Contexto:**
  * **Fórmula A** (DSP $[-1, 1]$ en `ModulationMatrix.h`): Convención de modulación signed 8-bit. Definitiva.
  * **Fórmula C** (Normalizada $[0, 1]$ en `ParameterConversion.gen.h/.cpp` y `conversion.gen.js`): Canónica simétrica que corrige el Defecto 5 (`BIPOLAR_ASYMMETRY`). Ya implementada y en verde.
  * **Fórmula B** (Normalizada $[0, 1]$ en `PatchByteCodec.h`, `bridge-param-maps.js` y `registry.gen.js`): Legacy con colisión en $raw \in \{0, 1\}$.
* **Bloque de cambio delimitado (5 archivos):**
  1. `Source/Core/PatchByteCodec.h` (L31)
  2. `WebUI/js/bridge-param-maps.js` (L195, L206)
  3. `scripts/registry_generator.js` (L764, L770) → reemite `WebUI/js/registry.gen.js`
  4. `WebUI/tests/bridgeParamMaps.test.js` (L228)
  5. `WebUI/tests/browserMapper.test.js` (L897-900)
* **Cualificación de impacto:** Para $raw \ge 128$, B y C son idénticas al 100%. Para $raw < 128$, la diferencia máxima es de $\approx 0.00196$ (menos de medio paso físico o $< 0.5$ LSB en faders de 8 bits), restaurando la linealidad.

### 4.2 Vía WebUI — Saneamiento de Deuda de Empaquetado
* **Contexto:** 113 suites de Vitest pasan (5.045 tests OK), pero 23 suites fallan debido a scripts huérfanos en `index.html` (referencias a módulos fusionados de FX y keyboard) y diferencias de versión de Vitest en workspace.
* **Objetivo:** Saneamiento de configuración y empaquetado para dejar la batería WebUI al 100% en verde.

### 4.3 Vía B Nivel 2 — Promoción a `ABDSharedCode/SynthCore`
* **Decisiones de diseño pendientes:**
  * Determinar si se expone como familia `abd::synth::deepmind::Arpeggiator` o se abstraen los 11 modos en rasgos configurables.
  * Ubicar el wrapper JUCE exclusivamente en la capa de consumo del plugin (`ABDEep`).
