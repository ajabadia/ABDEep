# Resultado de la ejecución del subgrupo de diagnósticos

**Qué se lanzó:**
- `WebUI/tests/vitestInstaladoCoincide.test.js`
- `WebUI/tests/vitestEnElWorkspace.test.js`
- `WebUI/tests/buildWebUiFailureDiagnostic.test.js`
- `WebUI/tests/buildToolchainDiagnostic.test.js`
- `WebUI/tests/bundleEnElBinario.test.js`
- `WebUI/tests/inyeccionSafeDirectory.test.js`
- `WebUI/tests/timeoutDeSubprocesos.test.js`

**Resumen numérico:**
- Archivos: 2 pasados, 5 fallidos
- Tests: 60 pasados, 48 fallidos

## Veredicto por archivo

### 1. `vitestInstaladoCoincide.test.js` — pasa
- 13 tests ok
- Mínimo riesgo, mantener sin cambios

### 2. `vitestEnElWorkspace.test.js` — falla
- Fallo real: el workspace-root de Vitest es `1.6.1`, pero `ABDEep/package.json` declara `^1.6.1`. Este test exige que todos los miembros compartan la misma versión base que la raíz del monorepo.
- No es un falso positivo por entorno: es una divergencia de dependencia entre workspace-root y el paquete de ABDEep.
- Impacto real: el test está protegiendo una propiedad que hoy no se cumple.

### 3. `buildWebUiFailureDiagnostic.test.js` — falla
- El contenido del archivo marca la diferencia real. El test lee `build.bat` con `latin1`, y el archivo actual ya no contiene las etiquetas, bloques y mensajes que este test fija.
- Texto que el archivo sí incluye en esta revisión:
  - `ACENTOS CONCIDOS`
  - Dos bytes no ASCII para `ó`
- Por eso los asserts de texto y de posición fallan en bloque: la forma del diagnóstico en `build.bat` cambió, y este test detecta esa divergencia.

### 4. `buildToolchainDiagnostic.test.js` — falla
- Mismo caso que arriba: los bloques y mensajes esperados para Visual Studio / CMake / WASM no están presentes en la forma actual de `build.bat`.
- De los fallos, la mayoría son asserts de posición/estructura/texto, y esa clase de fallo es informativa: dice exactamente qué partes del contrato de `build.bat` se rompieron.

### 5. `bundleEnElBinario.test.js` — pasa
- 9 tests ok
- El test pasó porque es portable, no depende de `dist/` preexistente, y verifica el comprobador contra un binario falso.
- Mantener sin cambios.

### 6. `inyeccionSafeDirectory.test.js` — falla
- Fallo claro y esperado en una ejecución aparte: `GIT_CONFIG_COUNT=undefined`. Este test solo tiene sentido cuando Vitest carga `vitest.config.js` de forma que inyecte las variables `GIT_CONFIG_*`.
- Con `npx vitest run` directo desde el workspace-root actual, esa inyección no llega al proceso, por lo que el test falla con `la corrida no lleva safe.directory inyectado`.
- Esto es un fallo de entorno de ejecución, no un fallo del test.

### 7. `timeoutDeSubprocesos.test.js` — falla
- Detectó 13 `describe` que lanzan subprocesos sin timeout explícito.
- Esa lista incluye archivos fuera del lanzamiento actual: `checkWasmBuild.test.js`, `exportCalibrationRun.test.js`, `fuzzRoundtripScript.test.js`, `fxContract.test.js`, `gitattributesGuard.test.js`, `hwDumpValidate.test.js`, `roundtripCorpusScript.test.js`, `verifyDocsCiJobs.test.js`.
- Fallo real de guard, no un falso positivo.

## Interpretación

Este lanzamiento confirma dos cosas distintas que hay que no mezclar:

1. **Hay diferencias reales entre `build.bat` y los textos que los tests exigen.**
   - Esto vale tanto para `buildToolchainDiagnostic.test.js` como para `buildWebUiFailureDiagnostic.test.js`.
   - No es un problema de plataforma ni de entorno: es que la forma actual del script no contiene los bloques que estos tests fueron escritos para vigilar.

2. **Hay un fallo de entorno en `inyeccionSafeDirectory.test.js`, y un fallo de guard en `timeoutDeSubprocesos.test.js`.**
   - El primero necesita que la suite se ejecute desde una configuración que inyecte `GIT_CONFIG_*`.
   - El segundo necesita que se revisen los 13 archivos que lanza, muchos de ellos no incluidos en este lanzamiento.

## Decisión lógica

El siguiente paso ya no es volver a lanzar esto igual, sino separar:

- **Arquitectura C++:** definir contrato de Arpeggiator para `ABDSharedCode/SynthCore`, o cerrar ModMatrix.
- **Suite WebUI:** no es un lote uniforme. `bundleEnElBinario.test.js` y `vitestInstaladoCoincide.test.js` están sanos; `inyeccionSafeDirectory.test.js` necesita lanzarse en el contexto correcto; y `buildToolchainDiagnostic` / `buildWebUiFailureDiagnostic` están señalando que `build.bat` cambió de forma.

Esto queda como punto de espacio: el diagnóstico del entorno de la suite ya está claro, y el del build.bat también.
