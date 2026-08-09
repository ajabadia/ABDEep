# Fase 4 — Batería de Igualdad Round-Trip en 3 Niveles + Fuzzing Acotado

> Plan de Refactorización v3.2 congelado · Sección §5 «Matriz de Pruebas de 3 Niveles,
> Property-Based Testing y Fuzzing con Recurso Acotado».
> Estado: **completado (Niveles 1/2/3a + fuzzing)** · Nivel 3b pendiente (hardware-in-the-loop)
> · Fecha: 2026-08-09

---

## 1. Arquitectura entregada

```
┌────────────────────────────────────────────────────────────────────────┐
│  WebUI/js/roundtrip_equality.js (UMD)  —  window.RoundTripEquality      │
│                                                                        │
│  Nivel 1  rawCodecEqual           Bytes → Pack → Unpack → Bytes        │
│  Nivel 2  semanticEqual           Patch → Parámetros → Patch           │
│                                   (descarta reservados 223-241 + padding)│
│  Nivel 3a hardwareCanonicalEqual  Comparación contra el corpus A–H     │
│                                   exact | canonical | semantic |       │
│                                   known_exception | no_match           │
│  Fuzzing  fuzzRoundTrip           Property-based testing acotado       │
│                                   (500B payload · 100ms/caso · seed)   │
├────────────────────────────────────────────────────────────────────────┤
│  Integración: Calibration Lab pestaña Round-Trip → modo A/B Compare    │
│  (calibration_lab_tab_roundtrip.js · runABCompareReport)               │
└────────────────────────────────────────────────────────────────────────┘
```

Dependencias:
- `WebUI/js/registry.gen.js` (`window.ParameterRegistry`) — decodificación `rawToNormalized`
  para el Nivel 2. Opcional: sin registro, `semanticEqual` degrada a comparación estructural.
- Codecs `pack8to7`/`unpack7to8` — copia exacta de `browser_packer.js` /
  `RoundTripValidator.cpp` (paridad byte a byte verificada por `parityProgramDump.test.js`
  y `validate_sysex_mapping.js`).

Carga en `index.html` (tras `browser_packer.js`, antes de los scripts del Calibration Lab):

```html
<script src="js/registry.gen.js"></script>
<script src="js/roundtrip_equality.js"></script>
```

---

## 2. Nivel 1 — `rawCodecEqual` (Bytes → Pack → Unpack → Bytes)

```js
rawCodecEqual(aInput, bInput, opts?) → {
  level: 1,
  equal: boolean,
  classification: 'exact' | 'mismatch',
  roundTripExact: { a: boolean, b: boolean },  // invariante de codec por lado
  mismatches: number[],                        // offsets con bytes distintos
  kind: 'unpacked' | 'packed' | 'sysex' | 'unpacked/sysex' | ...,
  error?: 'a:invalid_length' | 'b:invalid_sysex_header' | ...
}
```

- **Entrada aceptada**: 242 bytes (unpacked), 278 bytes (payload empaquetado) o 291 bytes
  (mensaje SysEx canónico). `opts.requireHeader: true` exige la cabecera canónica
  (`F0 00 20 32 20 <dev> 02 <proto> <bank> <prog> ... 00 00 F7`).
- **Invariante de codec**: `unpack7to8(pack8to7(x)) === x` para cualquier x de 242 bytes
  (el empaquetado 7→8 es biyectivo: flags de MSB en el byte prefijo de cada grupo de 8).
- `equal = roundTripExact.a && roundTripExact.b && mismatches.length === 0`.

## 3. Nivel 2 — `semanticEqual` (Patch → Parámetros → Patch)

```js
semanticEqual(aInput, bInput, { registry?, tolerance? = 1/255 }) → {
  level: 2,
  equal: boolean,
  classification: 'semantic' | 'mismatch',
  mismatches: [{ byteOffset, paramIds, rawA, rawB, normA, normB }],
  ignoredBytes: number[],     // región reservada (223-241) + padding (bytes sin parámetro)
  checkedBytes: number,
  reencodeStable: boolean,    // Patch → Parámetros → Patch dentro de ±1 raw
  registryAvailable: boolean,
  error?: string
}
```

- **Bytes descartados** (§5 «descartando bytes reservados y padding»):
  - Región reservada del preset: nombre 223-238 + cola 239-241 (verificada en dumps reales).
  - Padding: bytes sin parámetro mapeado en `registry.byOffset`.
- **Comparación en espacio normalizado**: cada byte mapeado se decodifica con
  `registry.rawToNormalized(byteOffset, raw)`; dos bytes son iguales si
  `|normA - normB| ≤ tolerance` (default `1/255`).
- **Estabilidad de re-encode**: `registry.normalizedToRaw(idx, rawToNormalized(idx, raw))`
  debe quedar dentro de ±1 del raw original. Para **enums** solo se evalúa el rango válido
  `[0..enumMax]` — fuera de rango el codec clampa (comportamiento documentado en
  `registryGen.test.js`, no es inestabilidad).
- **Sin registro**: degrada a comparación estructural (raw, excluyendo solo la región
  reservada) — más estricto que el camino con registro, a propósito.

## 4. Nivel 3a — `hardwareCanonicalEqual` (corpus A–H)

```js
hardwareCanonicalEqual(target, corpus, { registry?, knownExceptions?, tolerance? }) → {
  matches: [{ bank, prog, classification, reason }],  // una entrada por ítem del corpus
  best: 'exact_match' | 'canonical_match' | 'semantic_match'
      | 'known_exception' | 'no_match',
  bestMatch: object | null,
  knownExceptionApplied: boolean,
  corpusSize: number,
  error?: string
}
```

Clasificación por entrada (jerarquía `exact > canonical > semantic > known_exception > no_match`):

| Clasificación | Condición |
|---------------|-----------|
| `exact_match` | 242 bytes idénticos **y** misma posición declarada (bank/prog de la cabecera del target). |
| `canonical_match` | 242 bytes idénticos pero posición distinta o desconocida. |
| `semantic_match` | `semanticEqual` sin violaciones (solo difiere la región reservada / padding). |
| `known_exception` | Entrada listada en `opts.knownExceptions` `{bank, prog}` — tiene prioridad sobre `exact`. |
| `no_match` | Ninguno de los anteriores. |

- **Target**: 242/278/291 bytes, o forma de objeto `{unpacked, bank, prog}` donde el banco
  se acepta como número (0-7) **o letra ('A'-'H')** (los patches del Calibration Lab usan
  `bankName` en letra).
- **Corpus**: array de `{bank, prog, unpacked, packed}`. `loadCorpusFromBanks(banksDir,
  ['A'..'H'])` (solo Node) carga los 8 factory banks A–H (128 presets c/u) leyendo `prog`
  de `msg[9]` de la cabecera.
- La posición se compara en la forma `bankLetter === entry.bank || bank === entry.bank`
  (normaliza letra ↔ número del byte de cabecera).

## 5. Fuzzing acotado — `fuzzRoundTrip`

```js
fuzzRoundTrip({ seed? = 0xC0FFEE, iterations? = 100,
                maxPayload? = 500, maxTimeoutMs? = 100, registry? }) → {
  seed, iterations, maxPayload, maxTimeoutMs,
  passed, failed,
  maxCaseMs,            // peor caso medido (reloj real)
  violations: [{ case, property, detail?, length?, caseMs?, maxTimeoutMs? }],
  deterministic: boolean // false si hubo violaciones de timeout (dependen del reloj)
}
```

**Límites de recurso del plan (§5)**: `Max Payload = 500 B` y `Max Timeout = 100 ms` por caso.

Propiedades verificadas por caso:
1. **`codec_invariance`** (Nivel 1): `unpack7to8(pack8to7(x)) === x` para x aleatorio de
   242 bytes.
2. **`codec_payload_bound` / `codec_throws`**: payloads arbitrarios de 1..500 B no deben
   lanzar ni producir más de 242 bytes al desempaquetar.
3. **`decode_encode_stability`** (Nivel 2, con registro): `normalizedToRaw(rawToNormalized(raw))`
   dentro de ±1 para todos los bytes mapeados, muestreando enums en `[0..enumMax]`.
4. **`timeout`**: si un caso excede `maxTimeoutMs` se registra la violación y el caso se
   cuenta como fallo (abort del caso, no del fuzz).

**Determinismo**: PRNG `mulberry32(seed)` — mismo seed ⇒ misma secuencia ⇒ `violations`
idénticas (cuando no hay timeouts). Reproducible en CI.

**Inyección de fallos**: las funciones internas invocan el codec a través del holder mutable
`api` (la API exportada) — permite a los tests romper `RTE.pack8to7`/`RTE.unpack7to8` y
verificar que el invariante se detecta (`codec_invariance`) y que el presupuesto temporal se
impone (`timeout` con codec lento).

## 6. Integración — Calibration Lab (A/B Compare)

La pestaña **Round-Trip** del Calibration Lab (`WebUI/js/calibration_lab_tab_roundtrip.js`)
tiene dos modos (toggle segmented):

- **Single Patch** (histórico): valida el round-trip 3 capas de un patch.
- **A/B Compare** (Fase 4): clasifica Patch A vs Patch B.

```js
runABCompareReport(patchA, patchB) → {
  raw, sem, cls,          // resultados de rawCodecEqual / semanticEqual / hardwareCanonicalEqual
  registryAvailable: boolean,
  error?: 'RoundTripEquality not loaded' | 'invalid_patch_bytes'
}
```

- El corpus es de **1 entry** construida desde Patch B (`unpacked` + `packed` + posición de
  `patchB.bankName`/`patchIndex`); el target es Patch A con su posición.
- **`coerceBytes()`**: `deepClone` del store (`JSON.parse(JSON.stringify(...))`) convierte los
  `Uint8Array` de `unpackedBytes` en objetos `{0:.., 1:..}` **sin `.length`** — el normalizador
  reconstruye un `Uint8Array` cuando el objeto tiene 242+ claves numéricas contiguas. Sin esto,
  la comparación A/B vía `store.getState()` fallaba con `invalid_patch_bytes`.
- **UI**: banner de clasificación (label + color + razón + posición coincidente), fila de
  hechos (raw idéntico n/242 · semántica · re-encode · registro) y tabla de diferencias
  (offset / Param IDs / Raw A / Raw B / Norm A / Norm B). El modo se lee en tiempo de llamada
  (`currentMode()`), no capturado en el bind.
- **Seguridad**: todos los valores dinámicos del render pasan por `escapeHtml`
  (verificado con `scripts/security_scan.js` → 0 violaciones).

## 6b. Script de corpus — `scripts/roundtrip_corpus.js`

Batería de los 3 niveles sobre el **corpus de fábrica completo A–H (1024 presets)**,
reutilizando `roundtrip_equality.js` + `registry.gen.js` (job CI `fase4-corpus` en
`.github/workflows/roundtrip-corpus.yml`):

```
node scripts/roundtrip_corpus.js [--banks A,B] [--json] [--classify] [--out f.json]
```

- **Nivel 1** (`rawCodecEqual` por preset): invariante `unpack7to8(pack8to7(x)) === x`
  **y** `pack8to7(unpack7to8(packed)) === packed`.
- **Nivel 2** (`semanticEqual` por preset): re-encode estable (±1 raw, rango válido de
  enums) + detección de **hermanos semánticos** vía hash O(n) de los bytes con parámetro
  (excluye región reservada 223-241 y padding). Los pares byte-idénticos se reportan como
  duplicados (Nivel 3a).
- **Nivel 3a** (`hardwareCanonicalEqual`): self-match de cada preset contra el corpus
  **completo** con `skipSemantic: true` — debe hallarse `exact_match` en su posición de
  cabecera; verifica además que `msg[9]` coincide con el índice secuencial del archivo.
- **`--classify`**: emite la tabla por preset
  `{bank, prog, level1, level2, classification, matchedWith}` —
  `level1`/`level2` = estado de validación del preset; `classification` =
  `exact_match` (único) | `canonical_match` (duplicado byte-idéntico, `matchedWith` =
  la otra posición) | `semantic_match` (hermano de parámetros) con **canonical > semantic
  por construcción** (los pares de duplicados y de hermanos no se solapan). Coste O(n)
  (reutiliza los grupos hash), sin escaneos O(n²) extra.

**Resultado del corpus de fábrica** (verificado en CI `fase4-corpus`): 1024/1024 en los
3 niveles, **0 errores**; clasificación `804 exact · 210 canonical (105 pares) · 10 semantic
(5 hermanos)` · `0 no_match`. ~0.7s los 8 bancos.

## 7. Verificación

- **Vitest**: 92 test files · **4560 tests · 0 fallos**.
  - `roundtripEquality.test.js` (**28 tests**): invariante de codec, mismatch con offset,
    cross-form sysex↔patch, cabecera corrupta, región reservada ignorada, `paramIds` de VCF
    Cutoff, tolerancia configurable, degradación sin registro, exact/canonical/semantic/
    known_exception contra el **corpus real de banco A** (128 presets, `skipIf` sin corpus),
    forma de objeto con banco numérico **y en letra**, paridad de codec con
    `browser_packer.js`, fuzzing determinista (mismo seed → `violations` idénticas), codec
    roto por monkey-patch y codec lento (timeout).
  - `calibrationRoundtripAB.test.js` (**18 tests**): clasificación pura, render del
    banner/factos/tabla, eventos (incluida la ruta `deepClone` → `coerceBytes`).
- **ESLint**: 0 errores en los módulos nuevos (los 6 warnings `no-var` del repo son
  preexistentes en otros archivos).
- **Security scan**: `node scripts/security_scan.js` → **0 violaciones** sobre TODO
  `WebUI/js` (incluye el render nuevo del A/B Compare).
- **Paridad C++/JS**: codec idéntico a `RoundTripValidator.cpp` (verificado por
  `parityProgramDump.test.js` y el job `roundtrip-corpus`).

## 8. Estado del plan

- [x] Nivel 1 — `rawCodecEqual`: `Bytes → Pack → Unpack → Bytes` (invariante de codec).
- [x] Nivel 2 — `semanticEqual`: `Patch → Parámetros → Patch` (descarta reservados + padding).
- [x] Nivel 3a — `hardwareCanonicalEqual`: corpus A–H con `exact_match | canonical_match |
  semantic_match | known_exception`.
- [x] Property-Based Testing / Fuzzing acotado: invariantes + límites `500 B` / `100 ms`.
- [ ] **Nivel 3b — Hardware-in-the-loop**: dumps reales en hardware físico (obligatorio previo
  a cualquier release que modifique el protocolo SysEx o NRPN — §5). Requiere hardware DM12.

Pendiente de Fases posteriores: WASM/capabilities (Fase 5) y retirada legacy +
`Logger.deprecation` (Fase 6). Jobs CI de Fase 7 relacionados: `roundtrip-corpus`
(`fase4-corpus` — batería sobre los 1024 presets) y `property-fuzzing`
(`scripts/fuzz_roundtrip.js` — multi-seed determinista) — ambos completados.
