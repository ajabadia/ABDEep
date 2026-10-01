# Fase 1 — Esquema Declarativo, Generador y Pre-validación (schemaVersion 1)

> **Plan v3.2 congelado · Sección 1 (Arquitectura de 4 Capas) + Fase 1**
> **Fecha:** 2026-08-09 · **Node 24.16.0** · **Modelo:** Enhanced/Pro (DEEP_TARGET_MODEL=2)

## 1. Objetivo

Sustituir los registros de parámetros **duplicados a mano** (JS y C++) por un
**registro canónico generado** desde un esquema versionado, de modo que C++,
JS y la documentación se compilen SIEMPRE desde la misma fuente validada
(criterio de aceptación §8.1 del plan).

## 2. Arquitectura de fuentes y artefactos

```
                    schemas/parameter-registry.json   (JSON Schema, schemaVersion 1)
                                   │  (validate-and-generate)
        ┌──────────────────────────┴──────────────────────────┐
        ▼                                                      ▼
  3 fuentes de verdad                             4 artefactos .gen (commiteados)
  ┌─────────────────────────┐                    ┌─────────────────────────────┐
  │ WebUI/js/bridge-param-  │  ── fusión ──▶     │ schemas/parameter-registry. │
  │ maps.js (canónico HW)   │   + validación     │   data.json (instancia)     │
  │ WebUI/js/byte_map_data. │                    │ WebUI/js/registry.gen.js    │
  │ js (242 bytes físicos)  │                    │ Source/Core/ParameterRegistry.gen.h  │
  │ resources/parameters_   │                    │ Source/Core/ParameterRegistry.gen.cpp│
  │ spec.json (legacy)      │                    └─────────────────────────────┘
  └─────────────────────────┘
```

### Fuentes
| Fuente | Contenido | Rol |
|---|---|---|
| `bridge-param-maps.js` | `PARAM_TO_BYTE_OFFSET` (235 ids), `PARAM_TO_CC`, `BIPOLAR_BYTES` (43), `ENUM_BYTES` (48) | **Canónico hardware**: offsets, codec raw↔normalized, CC |
| `byte_map_data.js` | `BYTE_MAP`: 242 bytes `{idx, param, region, type, desc, enumLabels?}` | Display names, regiones, tipos descriptivos, descripciones |
| `parameters_spec.json` | 16 params con `name`, `type`, `min/max`, `default`, `options`, `description`, `midi_cc` | **Metadatos legacy** del emulador (universo distinto al HW) |

### Artefactos emitidos (todos versionados en el repo)
| Artefacto | Contenido |
|---|---|
| `schemas/parameter-registry.data.json` | Instancia canónica: `schemaVersion`, `generatedAt`, `sourceHashes` (SHA-256), `parameters[]`, `byteMap[]`, `specOnly[]`, `warnings[]`, `summary` |
| `WebUI/js/registry.gen.js` | UMD (`window.ParameterRegistry` + `module.exports`): mismos datos + índices `byId`/`byOffset` + codec `rawToNormalized`/`normalizedToRaw` |
| `Source/Core/ParameterRegistry.gen.h` | `ABD::Registry`: `enum class ParameterIndex` (236 índices), `struct ParameterEntry`, `kParameters`, `kByteMapParams`, `findParameterById/ByOffset` |
| `Source/Core/ParameterRegistry.gen.cpp` | Datos `const std::array` (sin JUCE — compila en cualquier toolchain) |

## 3. Datos del registro generado (baseline)

```
schemaVersion: 1
parámetros: 233  (físicos=223 · extendidos=3 · virtuales=7)
byteMap: 242 bytes físicos (contiguos 0..241)
aliasGroups: 0   (antes eran 3: los bytes 32, 88 y 160 tenían dos ids cada uno;
                  los tres se repartieron. Ver docs/parametros_sin_uso.md)
codec: enum=49 · bipolar=43 · value=141
cc: 32 mapeos canónicos (PARAM_TO_CC)
extendidos (AbyssMind Pro): vcf_model=245, vcf_moog_submode=246, vcf_korg_submode=247
virtuales: chord_enable=300, poly_chord_enable=301, chord_key=302, chord_type=303,
          fx_feedback_gain=304, fx_send_level=305, vcf_voicing_mode=306
specOnly: (ninguno — los restos `slot_a_type` / `slot_b_type` se borraron del spec;
          ver docs/parametros_sin_uso.md)
warnings: 8 divergencias CC legacy (comparisonMode §6)
```

## 4. Política de validación (rechaza antes de emitir)

El generador distingue **errores fatales** (exit 1, no emite nada) de
**advertencias no fatales** (exit 0, registradas en `warnings[]`):

### Fatales (violan §1.1 del plan)
- **IDs duplicados** o sin `byteOffset` válido en el rango 0..303.
- **NRPN/offset colisionados**: un offset compartido por >1 parámetro que **no** sea
  uno de los alias declarados `{32, 88, 160}` → `NRPN_COLLISION`.
- **Rangos incompatibles** en la spec (`min >= max`) → `RANGE_INCOMPATIBLE`.
- **Enum inválido** (`ENUM_BYTES` ausente o < 1) → `ENUM_MAX`.
- **Byte map no contiguo** (≠242 entradas, `idx` roto) → `BYTEMAP_*`.
- **Colisión de identificador C++** (`cppName` duplicado, p.ej. `vcf.model` vs `vcf_model`)
  → `CPP_NAME_COLLISION`.

### Advertencias (no fatales — alimentan comparisonMode, §6 del plan)
- **Divergencia CC legacy vs canónico** (`CC_LEGACY_DIVERGENCE`): la spec define un
  `midi_cc` distinto al `PARAM_TO_CC` canónico para el mismo id. Se conservan ambos
  (`cc` canónico, `legacyCC` de la spec, `ccConflict: true`). Hay **8** hoy
  (p.ej. `vcf_cutoff`: canónico 29 vs legacy 23). No son errores: son la divergencia
  exacta que el modo diagnóstico (§6) debe cuantificar antes de retirar legacy.
- **Parámetros spec-only**: sin byte físico, quedan documentados en `specOnly[]`
  para el emulador legacy. Los dos que había (`slot_a_type`, `slot_b_type`,
  con opciones `OSC1_Style`/`OSC2_Style` de una nomenclatura que este synth no
  tiene) se borraron del spec y del JSON: no los leía nadie.
- **Ningun id del mapa del puente fuera del spec, y ningun byte con dos ids.**
  `REGISTRY_ID_NOT_IN_SPEC`, `CC_ID_NOT_IN_SPEC` y `NRPN_COLLISION` cortan la
  generación antes de emitir. Ver `docs/parametros_sin_uso.md` §«Los tres
  guards: puestos».

## 5. Regeneración y enlace

```powershell
# Entrada humana/CI (valida + emite + verifica artefactos)
powershell -ExecutionPolicy Bypass -File scripts/validate_and_generate.ps1

# Directa
node scripts/registry_generator.js
```

**CMake** (`CMakeLists.txt`): `add_custom_command` con `OUTPUT` los 4 artefactos y
`DEPENDS` las 3 fuentes + el esquema + el generador. Se regenera automáticamente al
cambiar cualquier fuente; si `node` no está en el PATH, se usan los artefactos
commiteados (warning). `ParameterRegistry.gen.cpp/.h` están en `ABDEEP_CORE_SOURCES`,
así que se compilan en **todos** los targets (Standalone, VST3, Calibration Lab,
Unit Tests, Benchmarks).

## 6. Verificación

### Tests de paridad (`WebUI/tests/registryGen.test.js`, 21 tests)
- `schemaVersion === 1`, `generatedAt` ISO, `sourceHashes` SHA-256 de las 3 fuentes.
- Paridad **biyectiva** `id ↔ byteOffset` con `PARAM_TO_BYTE_OFFSET` (sin pérdida/ganancia).
- `codecType` y `enumMax` idénticos a `BIPOLAR_BYTES`/`ENUM_BYTES` del bridge real.
- `cc` idéntico a `PARAM_TO_CC`; `legacyCC`/`ccConflict` para las 8 divergencias.
- Únicos grupos multi-id = alias `{32, 88, 160}`; aliases bidireccionales.
- BYTE_MAP canónico: 242 contiguos, `param/region/type/desc` preservados, `id` correcto
  y `null` en los gaps (224, 226..241).
- Fusión spec: `name/desc/defaultValue` (incl. enum `osc1_range` → `"8'"` = 0.5).
- Codec del registro **coincide** con el bridge en `rawToNormalized`/`normalizedToRaw`
  y round-trip estable (±1) para raw válido.

### Resultados
| Check | Resultado |
|---|---|
| `npx vitest run WebUI/tests/registryGen.test.js` | **21/21 OK** |
| `npx vitest run` (suite completa) | **83 files / 4378 tests / 0 fallos** (baseline: 81/4351 → +27 tests) |
| `scripts/validate_and_generate.ps1` | exit 0, 4 artefactos verificados |
| Build C++ (ABDEep_Benchmarks, Release) | `.gen.cpp` compila y enlaza; benchmark idle `allocs=0` sin cambios |

## 7. Notas y decisiones

- **`bridgeParamMaps.test.js` contiene un *copy* inline desactualizado** de los mapas
  (p.ej. `ENUM_BYTES[166]=35`, cuando el archivo real tiene `49` — FX types 0..49). El
  registro canónico se genera desde el archivo **real**; el test de paridad carga el
  archivo real (no el copy). Migrar ese test al registro generado es trabajo futuro
  (Fase 6 — retirada de duplicación legacy).
- `registry.gen.js` declara `/* eslint-disable */` por ser un artefacto generado.
- Los `.gen` se commitean: el build no depende de `node` para reproducibilidad.
