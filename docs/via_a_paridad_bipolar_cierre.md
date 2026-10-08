# Hito de Cierre: Vía A — Paridad Bipolar (Fórmula C) y Estabilización del Registro

**Fecha:** Octubre 2026  
**Alcance:** Reconciliación de paridad de parámetros bipolares (C++ ↔ WebUI / SysEx Bridge) y desacoplamiento del generador de registro.  
**Estado:** ✅ Consolidado en disco y verificado con 100% de tests verdes.

---

## 1. Resumen Ejecutivo

La **Vía A** resuelve la divergencia histórica entre el códec de parches C++ (`PatchByteCodec.h`) y el mapa de parámetros de la WebUI (`bridge-param-maps.js`, `registry.gen.js`). 

Anteriormente coexistían dos fórmulas incompatibles:
* **Fórmula B (lineal con zona muerta):** $((raw - 128) / 127 + 1) / 2$, que provocaba asimetría y asignaba $raw \in \{0, 1\} \to 0.0$.
* **Fórmula C (por tramos / piecewise):** divide simétricamente el dominio en dos semi-rangos $[0, 128]$ y $[128, 255]$:
  $$\text{rawToNormalized}(raw) = \begin{cases} \dfrac{raw}{128} \times 0.5 & \text{si } raw < 128 \\ 0.5 + \dfrac{raw - 128}{127} \times 0.5 & \text{si } raw \ge 128 \end{cases}$$
  $$\text{normalizedToRaw}(n) = \begin{cases} \text{round}(n \times 2 \times 128) & \text{si } n \le 0.5 \\ \text{round}(128 + (n - 0.5) \times 2 \times 127) & \text{si } n > 0.5 \end{cases}$$

Con esta migración se garantiza:
1. $0 \leftrightarrow 0.0$ (mínimo absoluto exacto).
2. $128 \leftrightarrow 0.5$ (centro neutro exacto).
3. $255 \leftrightarrow 1.0$ (máximo absoluto exacto).
4. Reversibilidad e idempotencia matemática perfecta en round-trip.

---

## 2. Modificaciones Verificadas en Disco

### 2.1 C++ Core (`Source/Core/PatchByteCodec.h`)
* `rawToNormalized()` migrado a la Fórmula C por tramos.
* Comentario docstring actualizado para reflejar la especificación por tramos y retirar referencias a la Fórmula B.
* Compatible con el layout canónico de APVTS y deserialización directa de SysEx.

### 2.2 Capa WebUI / Bridge (`WebUI/js/bridge-param-maps.js`)
* `rawToNormalized(byteOffset, rawValue)` actualizado para aplicar Fórmula C con `Math.max(0, Math.min(1, val))`.
* `normalizedToRaw(byteOffset, normalizedValue)` actualizado para aplicar el inverso exacto por tramos con discriminador en $0.5$.

### 2.3 Generador de Registro (`scripts/registry_generator.js`)
* Desacoplada la ejecución CLI mediante la función `isDirectExecution()`:
  ```javascript
  if (isDirectExecution()) {
    main();
    process.exit(0);
  }
  ```
* Se envuelve la lógica raíz en `function main()`.
* Exportación limpia de funciones puras (`canonicalizeSource`, `canonicalHash`, `sha256`, `toPascalCase`, `computeDefaultNormalized`, `codecTypeId`, `escapeCpp`, `SPECONLY_CONSUMIDOS`, `__soloParaTest`).
* Emisión de código JS (`renderJs`) actualizada para generar la Fórmula C en `WebUI/js/registry.gen.js`.
* Eliminado de disco el duplicado obsoleto `scripts/registry_generator.ts`.

### 2.4 Artefacto Generado (`WebUI/js/registry.gen.js`)
* Regenerado de forma idempotente con la nueva lógica en líneas 32 y 38.

### 2.5 Fixtures de Pruebas WebUI
* `WebUI/tests/bridgeParamMaps.test.js`: fixtures locales actualizados a Fórmula C y aserciones alineadas ($raw=64 \to 0.25$, $n=0.0 \to raw=0$, $n=0.25 \to raw=64$).
* `WebUI/tests/browserMapper.test.js`: fixtures locales actualizados y aserciones adaptadas.

---

## 3. Matriz de Certificación y Pruebas

| Entorno / Suite | Comando de Ejecución | Cobertura | Resultado |
|---|---|---|---|
| **WebUI / Tests JS** | `npx vitest run WebUI/tests/bridgeParamMaps.test.js WebUI/tests/browserMapper.test.js WebUI/tests/registryGen.test.js scripts/registry_generator.test.js` | 4 test files, 271 tests | **271 / 271 passed (100% verde)** |
| **C++ / Harness Release** | `cmake --build build --config Release --target ABDEep_UnitTests`<br>`.\build\ABDEep_UnitTests_artefacts\Release\ABDEep_UnitTests.exe` | 160 suites C++, 1.119.736 aserciones | **1.119.736 / 1.119.736 passed, 0 fallos (100% verde)** |

---

## 4. Estado de los Siguientes Frentes

1. **Vía B — Desacoplamiento DSP Nivel 2:**
   * Promover componentes desacoplados (`Arpeggiator` Nivel 1 u otros módulos) hacia la biblioteca compartida `ABDSharedCode`.
2. **Auditoría restante de la suite WebUI:**
   * Inspección y resolución de suites pendientes en `WebUI/tests/` (`scriptTagsResueltos.test.js`, `timeoutDeSubprocesos.test.js`, `bundleEnElBinario.test.js`, etc.).
