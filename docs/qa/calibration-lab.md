# Guía Operativa de Calibration Lab para QA

Esta guía describe el flujo de trabajo para que el equipo de QA pueda verificar la calibración y el comportamiento del motor DSP de manera automatizada y estructurada utilizando las herramientas del **Calibration Lab**.

---

## 1. Lanzar una Sesión de Validación (Stratified Bank Run)

El Calibration Lab permite muestrear presets de forma determinista para auditar un banco sin necesidad de revisarlo manualmente preset por preset al azar:

1. Abre el panel de control desde el menú principal de la app: `View` -> `Calibration Lab Diagnostics...`.
2. En el panel lateral derecho, abre la sección **Stratified Bank Run**.
3. Configura los parámetros de muestreo:
   * **Sample size**: Cantidad de presets a auditar (recomendado: `24` o `12`).
   * **Seed**: Semilla aleatoria reproducible (por defecto: `42`).
   * **Category Filter / Favorites only**: Filtros para enfocar el run a familias de sonido (p. ej. `bass`).
   * **Critical only**: Filtra únicamente aquellos patches que configuran parámetros críticos (VCF, HPF, voicedrift, etc.).
4. Haz clic en **Generate Run**. Esto poblará la tabla del run en el panel lateral.

---

## 2. Ejecutar el Workflow de Inspección Paso a Paso

Una vez generado el run, usa el **Workflow Drawer** para auditar cada preset secuencialmente:

1. Haz clic en el primer elemento de la lista del run para activarlo.
2. Presiona el botón **Load to Editor**. Esto cargará el preset directamente al sintetizador para que puedas escucharlo y ver su respuesta de señal.
3. Puedes utilizar los botones **Use as Patch A** y **Use as Patch B** para poblar el inspector de comparación y evaluar los bytes de SysEx.
4. Evalúa el estado del preset y márcalo usando los CTAs:
   * **✓ Pass**: Si no hay discrepancias audibles ni Badges críticos de `mismatch`.
   * **? Review**: Si encuentras algún comportamiento inconsistente que requiera análisis del equipo DSP.
   * **✕ Fail**: Si hay un mismatch directo evidente en parámetros críticos de VCF, HPF o drift.
   * **— Skip**: Si deseas saltar este patch.
5. Agrega tus comentarios detallados en el cuadro de texto **Notes**.
6. Haz clic en **Next ▶** para continuar con el siguiente patch.

---

## 3. Exportar Reportes y Evidencias

Al finalizar o durante el run, puedes guardar y reportar los resultados utilizando la barra de acciones superior del Calibration Lab:

* **📄 JSON**: Descarga el snapshot inmutable completo de la sesión. Es el formato recomendado para adjuntar a incidencias o para análisis automatizado.
* **📊 CSV**: Genera una tabla plana compatible con MS Excel o Jira. Úsala para tus reportes de estado semanales.
* **💾 .SYX**: Descarga el archivo de SysEx nativo del preset seleccionado en el workflow actual para adjuntarlo como evidencia de fallos de calibración.

---

## 4. Ejecución en Integración Continua (CI)

El pipeline de CI ejecuta automáticamente validaciones unitarias en cada Pull Request y empaqueta los reportes en la rama `main` o vía ejecuciones manuales (`workflow_dispatch`).

* **Workflow de GitHub Actions:** `WebUI CI` (`.github/workflows/webui-ci.yml`)
* **Salida de Artefactos:** Los reportes exportados (`JSON`/`CSV`/`SYX` y `manifest.json`) se publican bajo el nombre de artefacto `calibration-runs-<run_id>` (donde `<run_id>` es el ID de ejecución de GitHub Actions).
* **Ruta de almacenamiento local y en CI:** `artifacts/calibration-runs/`

Para lanzar de forma local la recopilación y empaquetado de reportes exportados:

```bash
npm run calibration:export:ci -- --input-dir WebUI/tmp/calibration-exports --output-dir artifacts/calibration-runs --run-id "test-local-run"
```

