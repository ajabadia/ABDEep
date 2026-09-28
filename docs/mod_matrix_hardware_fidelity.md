# La matriz de modulación del DeepMind 12: qué dice el hardware y qué decide el proyecto

> **Fecha:** 2026-09-28 · **Alcance:** Fase 0 del plan de matriz de modulación compartida
> (núcleo común en `ABDSharedCode/SynthCore`).
> **Guard que lo verifica:** `WebUI/tests/modMatrixTables.test.js` (17 tests).

Este documento existe porque la matriz de modulación estaba descrita por **cuatro
sitios que no concuerdan entre sí** y nadie lo tenía noticed. Aquí queda la
medición, la decisión y lo que queda pendiente. Cuando se toque la matriz, este
fichero es lo que hay que actualizar junto al guard.

---

## 1. El arbitro: el hardware, medido

La regla que se adoptó: **ninguna de las tablas del repositorio es la verdad.**
La fuente de verdad es el comportamiento del equipo, y se mide sobre los
**1024 presets de fábrica** volcados del propio sintetizador
(`resources/hardware_dumps/2026-08-10/`, 8 bancos × 128 programas, commiteados).

Medición sobre los **8192 slots** de matriz (1024 presets × 8 buses), desempaquetando
el payload 7-a-8 igual que `WebUI/js/browser_packer.js` y leyendo los bytes
**93–116** (los que `schemas/parameter-registry.data.json` y
`docs/sysex_format.md` identifican como matriz de modulación):

| Dato | Valor medido | Lo que decía el repo |
|---|---|---|
| Mensajes leídos | 1024 presets, 8192 slots | — |
| Rango de **fuente** (byte 93+3n) | **0 – 19** (20 valores distintos) | `docs/` decía 0–22; la WebUI listaba 25 |
| Rango de **destino** (byte 94+3n) | **0 – 129** (115 valores distintos) | `docs/` decía 0–129 ✔ |
| **Profundidad** (byte 95+3n) | **0 – 255**, y el **128 aparece** (valor más frecuente) | bipolar con centro en 128 ✔ |

**Consecuencia:** la profundidad bipolar con centro en 128 que asume el código es
correcta y está confirmada por los datos de fábrica. Los rangos de fuente y
destino que exercise el hardware caben dentro de los que declara el contrato de
bytes. El manual (`resources/md/deepmind_fx_modmatrix.md`) habla de 24 fuentes y
132 destinos, pero el contrato de bytes (`docs/sysex_format.md`, la referencia NRPN
y el registro generado) va a 22 y 129, y el hardware nunca pide más de 19/129: el
manual va por delante de lo que al que el equipo llega en estos bancos. **Se sigue la
referencia del byte**, que es lo que el equipo acepta y acepta de vuelta.

> Nota de método: una primera medición dio "la profundidad nunca llega a 128" y un
> rango de fuentes/destinos recortado. Era un error del propio script de sondeo
> (enmascaraba el bit alto con `& 0x7F` al desempaquetar). Corregido contra el
> desempaquetador canónico del proyecto; la tabla de arriba es la buena.

## 2. Las cuatro descripciones y dónde discrepan

| # | Dónde | Qué dice |
|---|---|---|
| 1 | `Source/DSP/ModulationMatrix.h` (motor) | enum `ModSource` (24) y `ModDestination` (**48**) |
| 2 | `WebUI/js/modmatrix_data.js` (vista) | 25 fuentes; 74 destinos + relleno a 133; `Fx 1..4 Level` en 129–132 |
| 3 | `WebUI/js/components/mod-matrix-canvas_data.js` (vista de grafos) | **otra** copia: 25 fuentes y **237** destinos, con `Fx1` en el índice **233** |
| 4 | `docs/sysex_format.md` + registro | bytes 93–116; fuente 0–22, destino 0–129, profundidad bipolar |

**La divergencia 2 vs 3 era la grave:** la vista de grafos pintaba nombres
distintos de los de la vista de lista, y situaba `Fx1` en un índice (233) donde el
byte no llega. Nadie lo detectó porque no había nada que lo comprobara.

**La divergencia 1 vs 4 es la más importante y sigue abierta:** el motor castea el
byte crudo a su propio enum (`SynthEngine_Parameters.cpp`, `setRoute` con
`static_cast<ModDestination>`), pero **el enum del motor (48 destinos) y la tabla
del manual (133) solo coinciden en 1 de las primeras 48 posiciones**. Es decir: el
orden del enum del motor **no es** el orden del manual. Los destinos 48–129 (82
índices) no los cubre el motor. Esto significa que, hoy, la ruta que el usuario
ve en la lista no es necesariamente la que el motor ejecuta.

## 3. Decisiones tomadas en esta fase

1. **La tabla de la vista de grafos se deriva de la tabla del dato, por
   construcción.** `mod-matrix-canvas_data.js` ya no declara ningún literal de
   nombre: usa accesores perezosos (`modSrcShort`, `modDestShort`) que leen
   `MOD_SOURCES` / `FULL_MOD_DESTINATIONS`. No pueden volver a separarse. El
   orden de carga de `index.html` (la vista de grafos se carga antes) se
   respeta porque el acceso es perezoso, no al cargar.

2. **Los colores se quedan duplicados, a propósito, y atados por el guard.** El
   canvas no puede recibir `var(--accent-blue)` (`fillStyle` no resuelve variables
   CSS), así que la vista de grafos lleva hex y la lista lleva variables CSS. Son
   dos representaciones de la misma clasificación; el guard compara las dos
   **por categoría** en todos los índices, así que si una cambia y la otra no, falla.

3. **El hueco de categoría del destino 19 se arregla.** "Porta Time" (índice 19)
   caía entre dos rangos en `getDestCategoryColor`: la lista lo dejaba sin color y
   el grafo lo pintaba rosa. Ahora la tabla del dato lo incluye en el rango de
   osciladores (9–19) y las dos vistas coinciden.

4. **`modmatrix.test.js` deja de llevar su propia copia de las tablas.** Tenía una
   tercera copia literal (y una cuarta reconstrucción de `FULL_MOD_DESTINATIONS`);
   además afirmaba `MOD_SOURCES.length === 25`, un número que no sale de ningún
   sitio. Ahora carga el fichero real, de modo que sus 39 tests verifican el
   código de la página contra la tabla de la página. Su aserción de longitud se
   deriva del contrato de bytes (cubre 0–22) en vez del 25 inventado.

5. **El desacuerdo motor↔manual se AVISA, no se arregla aquí.** El guard imprime
   en cada corrida cuántos destinos del byte no cubre el enum (hoy 82, del 48 al
   129) y cuántos de los primeros 48 coinciden con la tabla del manual (hoy 1).
   No es un fallo del guard: es una carencia real que arregla la **Fase 5** (la
   capa de traducción), y su número queda escrito para que la Fase 5 parta de un
   dato medido en vez de descubrirlo.

## 4. Lo que este guard NO cubre

- Que el motor suene a la ruta que el usuario elige (eso es la Fase 5: el orden
  del enum del motor no es el del manual).
- Los **32 slots** del modo Pro: el modo clásico declara 8 buses, el manual habla
  de 8, y el guard mide 8. El modo Pro (`DEEP_TARGET_MODEL >= 2`) amplía a 32 en
  el motor pero no tiene contrato de byte ni aparecen en los bancos de fábrica.
- Los nombres exactos de destinos 74–128: el hardware los ejerce (el guard lo
  comprueba) pero no hay evidencia de su etiqueta, y la tabla dice `Dest N` a
  propósito. Una etiqueta honesta vale más que una inventada.

## 5. Cómo volver a verificarlo

```bash
cd ABDEep
npx vitest run WebUI/tests/modMatrixTables.test.js   # el guard (17 tests)
npx vitest run                                          # suite completa
pnpm run lint
```

El guard lee los dumps de fábrica commiteados, así que corre **sin hardware**
conectado y es reproducible en CI.
