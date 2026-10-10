# Capa de traducción wire ↔ dominio — implementación y exportación a otros sintetizadores

> **Fase 1 de la capa de traducción · `schemas/parameter-conversion.json` (schemaVersion 1, conversionVersion 1)**
> Generador único: `scripts/registry_generator.js` · Artefactos: C++ + JS
> Cubre **los 246 parámetros del APVTS** (223 físicos · 3 extendidos · 6 virtuales · 14 sin byte)

## 1. Objetivo y regla de oro

Un parámetro se controla desde tres sitios distintos, y cada uno habla su
idioma: el **wire** (un byte SysEx, un NRPN, o nada), la **pantalla** (un fader
0..1) y el **motor** (milisegundos, hercios, decibelios). Antes de esta capa cada
sitio hacía su propia aritmética y los números «mágicos» (`*10.0f`, `*6.59f`,
`15 * 550^t`) vivían dentro de `SynthEngine_Parameters.cpp`.

Esta capa mete toda esa aritmética en **un dato versionado** y deja el motor
leyendo el valor de dominio ya resuelto. La regla que separa las dos cosas:

> **mando → respuesta audible = capa de conversión (dato versionado);**
> **estabilidad / carácter del algoritmo = dentro del DSP (no se toca).**

El **día 1 no cambia ningún sonido**: cada entrada se sembró del comportamiento
actual, de modo que `wireToDomain(raw)` reproduce exactamente lo que el motor ya
hacía (`raw/255*10` para los tiempos de envolvente, `0.035*e^(7.5t)` para el LFO,
`15*550^t` para el cutoff, `(x-0.5)*2` para las curvas, …).

## 2. Los tres espacios y los dos regímenes

| Espacio | Qué es | Dónde vive | Versiona |
|---|---|---|---|
| **Wire** | byte SysEx (0..255), NRPN, o **ninguno** | códec de protocolo | `protocolVersion` |
| **0..1** | posición normalizada (host / automatización / UI / fader) | `NormalisableRange` del APVTS | — |
| **Dominio** | ms, Hz, cents, semitonos, dB, % | APVTS + preset + **motor** | `conversionVersion` + `model` |

La regla general que pedimos para la UI es la de siempre:

- **Un fader / knob en pantalla vale 0..1.** Si un SysEx lo mueve, el fader
  representa ese byte normalizado: `wireMax` = 255 para el cable 8 bits, así que
  el punto medio 128 → **0.5** (en un mando de 7 bits tipo CC, 64/127 ≈ 0.5).
- **Al motor le llega el dominio que corresponda**, no el 0..1: el traductor
  convierte `raw → 0..1 → dominio`, y de ahí sale, por ejemplo, `100 ms`.

Hay **excepciones**, y por eso el spec las declara en vez de suponerlas:

- **Enums**: el dominio es el **índice** de la opción (`0..N`); siguen expresándose
  0..1 en el APVTS, pero el valor discreto no es «un byte partido por 255».
- **Bipolar**: el centro (128) es 0.5 y los extremos son exactos (ver defecto 5).
- **Sin wire** (`virtuales`, `sin byte`): no hay byte del que normalizar; sólo
  existen 0..1 y dominio.
- **Régimen libre**: en el sintetizador propio el dominio lo **elegimos nosotros**.

Y dos **regímenes de autoridad**, explícitos en el spec:

- **Fidelidad — `model = dm12_hardware`** (los 223 físicos, bytes 0..241). El
  conversor está **atado a medición**, no a opinión: todo cambio exige evidencia
  de hardware (los bancos de fábrica de `resources/hardware_dumps/` y el Audio A/B
  del Calibration Lab). **Round-trip byte-exacto obligatorio.**
- **Libre — `model = abyssmind_pro`** (3 extendidos, 6 virtuales, 14 sin byte). Es
  sintetizador propio: el dominio se elige libremente, se puede rediseñar sin
  evidencia de hardware, y sólo se versiona **para no romper presets guardados**
  (nunca salió a producción, así que no hay obligación de migración).

## 3. La clave de entrada: `(model, protocolVersion, parameterId)`

Cada entrada del spec lleva **su** `model` y **su** `protocolVersion`. Hoy un
parámetro pertenece a un único modelo —los físicos a `dm12_hardware`, el resto a
`abyssmind_pro`— y el lookup por id devuelve esa entrada. El `model` +
`protocolVersion` están en el dato justamente para que un segundo modelo pueda
convivir con el primero sin tocar el DSP (§8, «exportar a otros sintetizadores»).

## 4. El spec: `schemas/parameter-conversion.json`

Es la **fuente de verdad** y se edita a mano. Escribe el conversor, no el `.gen`.

### 4.1 Claves de primer nivel

| Clave | Contenido |
|---|---|
| `schemaVersion` | versión del **esquema** del spec (hoy `1`) |
| `conversionVersion` | versión de **los valores** de conversión (sube al cambiar un dominio publicado) |
| `description` | el contrato en prosa |
| `models` | un objeto por modelo: `{ protocolVersion, regime, description }` |
| `wireRules` | cómo se lee cada tipo de cable: `value`, `bipolar`, `enum` |
| `divergences` | los defectos medidos que esta capa corrige, con su `code`, `ids` y `fix` |
| `parameters` | el mapa `id → entrada` (246 entradas) |

### 4.2 Campos por entrada

| Campo | Valores | Qué significa |
|---|---|---|
| `id` | p. ej. `vcf_cutoff` | el id del parámetro en el APVTS |
| `model` | `dm12_hardware` \| `abyssmind_pro` | a qué modelo pertenece (fija el régimen) |
| `protocolVersion` | `1` (DM12) · `2` (AbyssMind) | versión del **formato de cable** del modelo |
| `regime` | `fidelity` \| `free` | atado a medición, o libre |
| `wire` | `sysex` \| `nrpn` \| `none` | de dónde viene el valor; `none` = sin byte |
| `wireOffset` | `0..241` (DM12) · `≥242` (propio) · `null` | el byte dentro del dump (o del protocolo propio) |
| `wireCodec` | `value` \| `bipolar` \| `enum` | cómo se lee el byte → 0..1 (o índice) |
| `wireMax` | `255` (value/bipolar) o el tope del enum | techo del cable |
| `unit` | `Hz`, `s`, `dB`, `ms`, `semitone`, `cent`, `ratio`, `bipolar`, `index` | unidad del dominio |
| `domain` | `[min, max]` | **el valor que el motor consume** |
| `curve` | `linear` \| `exp` \| `pow` \| `lut` | mapa 0..1 ↔ dominio |
| `curveParams` | p. ej. `[0.035, 7.5]` | parámetros de la curva (`exp`: escala, exponente) |
| `enumOrder` | `"identity"` o una permutación | lleva el byte al índice de enum del motor |
| `smoothingSpace` | `linear` \| `log` | **en qué espacio se suaviza** (defecto 9) |
| `registryIndex` | `0..231` o `null` | índice en el registro generado (los 14 sin byte: `null`) |

### 4.3 `wireRules`

```
value    : t = raw / wireMax          → luego la curva → dominio
bipolar  : punto medio 128 → 0.5; SIMÉTRICO:
             raw <  128 → (raw / 128) * 0.5
             raw >= 128 → 0.5 + ((raw - 128) / 127) * 0.5
enum     : el dominio es el índice; enumOrder lleva el byte a ese índice
```

### 4.4 `divergences` — los 9 defectos medidos, corregidos aquí

| `code` | Defecto | Corrección |
|---|---|---|
| `GLOBAL_VOLUME_RANGE` | APVTS 0..1 vs motor 0..2 | dominio `[0,2]` |
| `SOFTCLIP_HEADROOM_DB` | APVTS 0..1 vs motor 0..6 dB | dominio en **dB** `[0,6]` |
| `PORTA_MODE_ENUM_MAX` | spec/BYTE_MAP 14 opciones vs `ENUM_BYTES[35]=9` | `wireMax = 9` (10 alcanzables) |
| `BIPOLAR_ASYMMETRY` | `((raw-128)/127+1)/2` no llega a 0 | `wireRules.bipolar` simétrico |
| `EXTENDED_NOT_IN_DM12_DUMP` | `vcf_model` (245-247) inalcanzable en el dump de 242 | wire del **modelo propio** |
| `MOD_MATRIX_SRC_DEST_CODEC` | src/dest como `value` (raw/255) decodifican mal | `wireCodec: enum` |
| `MOD_MATRIX_DEST_UNREACHABLE` | códigos 130-132 sin byte que los produzca | `wireMax = 129` |
| `CC_LEGACY_DIVERGENCE` | `osc1_pwm_amount` CC 21 vs legacy 17 | wire multi-dialecto declarado |
| *(cubierto por el modelo, no por un código)* | slots de matriz 5-8 `dual` (byte compartido con chord) | advertencia `CONVERSION_DUAL_BYTE` + byte declarado |

## 5. Cobertura (baseline medido)

```
entradas: 246   (fidelity = 223 · free = 23)
wire:     sysex = 226 · none = 20
modelo:   dm12_hardware = 223 · abyssmind_pro = 23
codec:    value = 131 · enum = 72 · bipolar = 43
curve:    exp = 3 · linear = 243
casos de round-trip verificados = 43186
kConversionCount = 246 · kConversionSchemaVersion = 1 · kConversionVersion = 1
```

## 6. Una sola fuente → artefactos

```
                    schemas/parameter-conversion.json   (fuente de verdad)
                                    │
                    scripts/registry_generator.js  (validación + emisión)
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
 Source/Core/ParameterConversion.gen.h    WebUI/js/conversion.gen.js
 Source/Core/ParameterConversion.gen.cpp  (UMD: window.ParameterConversion)
        └──────────────┬────────────────────────────┘
                       ▼
   motor nativo + WASM (DspSources.cmake)   ·   WebUI / Calibration Lab
```

El generador emite **7 artefactos** (4 del registro + 3 de la capa). El CI
(`.github/workflows/registry-generation.yml`) los regenera y exige árbol limpio:
si el `.gen` commiteado no es el que produce el generador, el job falla.

## 7. La API generada

Misma semántica en C++ y en JS.

### C++ — `namespace ABD::Registry::Conversion` (`ParameterConversion.gen.h`)

```cpp
enum class Model  : uint8_t { Dm12Hardware, AbyssmindPro };
enum class Regime : uint8_t { Fidelity, Free };
enum class Wire   : uint8_t { None, SysEx, Nrpn };
enum class WireCodec : uint8_t { Value, Bipolar, Enum };
enum class Curve  : uint8_t { Linear, Exp, Pow, Lut };
enum class Smoothing : uint8_t { Linear, Log };

constexpr uint16_t kWireOffsetNone   = 0xFFFF;   // wire == None
constexpr uint16_t kNoRegistryIndex  = 0xFFFF;   // sin entrada en el registro
constexpr uint16_t kBipolarCenter = 128, kBipolarLowSpan = 128, kBipolarHighSpan = 127;

struct Entry { /* id, model, protocolVersion, regime, wire, wireOffset, wireCodec,
                  wireMax, unit, domainMin/Max, curve, curveP0/P1, lut, enumOrder,
                  smoothingSpace, registryIndex */ };

const Entry* findConversionById (std::string_view id) noexcept;

float normalizedToDomain (const Entry&, float t)     noexcept;  // 0..1 → Hz/ms/dB
float domainToNormalized (const Entry&, float domain) noexcept; // dominio → 0..1
float wireToDomain (const Entry&, uint16_t raw)      noexcept;  // EL CODEC
uint16_t domainToWire (const Entry&, float domain)   noexcept;  // inverso
```

### JS — `window.ParameterConversion` (`conversion.gen.js`)

```js
const e = ParameterConversion.findById('vcf_cutoff');
ParameterConversion.wireToDomain(e, 128);       // → Hz que consume el motor
ParameterConversion.domainToWire(e, 1000);      // → byte SysEx
ParameterConversion.normalizedToDomain(e, 0.5); // 0..1 del fader → dominio
ParameterConversion.domainToNormalized(e, 1000);// dominio → 0..1 del fader
ParameterConversion.entries;                    // las 246, con su model/protocolVersion
```

`wireToDomain` es el camino **de entrada** (mensaje → motor) y es lo que sustituye
a los números mágicos. `findConversionById` es de **hilo de control**, nunca del
hilo de audio.

## 8. Exportar el modelo a otros sintetizadores

La capa está pensada para ser **portable**: el conversor es dato, así que llevarlo
a otro sintetizador es añadir datos, no reescribir DSP.

### Paso 1 — Declara el modelo

Añade una entrada a `models` con su `protocolVersion` y su `regime`:

```json
"otro_synth": {
  "protocolVersion": 1,
  "regime": "fidelity",
  "description": "Otro hardware. Todo cambio exige evidencia del aparato."
}
```

El `regime` es la promesa: `fidelity` = atado a medición; `free` = lo elegimos.

### Paso 2 — Declara las entradas (una por parámetro)

- **Synth compatible** (mismo protocolo y misma respuesta): puedes **reutilizar**
  los valores de `dm12_hardware` y marcar `fidelity` citando la evidencia (dump +
  Audio A/B). El conversor es el mismo dato.
- **Synth propio / otro protocolo**: marca `free` y elige `wire`, `domain`,
  `curve`, `enumOrder` y `smoothingSpace` libremente. **No hay que pedir permiso
  al hardware** porque no es el hardware.
- Usa **offsets fuera del dump DM12** (`≥ 242`) para el cable propio, como ya
  hacen los extendidos `vcf_*` (245-247): así el dump de 242 bytes sigue siendo
  íntegro y nadie mezcla espacios.

### Paso 3 — Regenera (una sola fuente)

```
node scripts/registry_generator.js          # emite los 7 artefactos
node scripts/registry_generator.js --check  # sólo comprueba (CI)
```

Los tres artefactos de la capa salen de ahí; **nunca** edites un `.gen` a mano.

### Paso 4 — Cablea el decodificador del nuevo protocolo

El parser de bytes del nuevo modelo (SysEx o NRPN) llama a la capa en vez de
hacer aritmética propia:

```cpp
if (auto* e = ABD::Registry::Conversion::findConversionById (id))
    motorValue = ABD::Registry::Conversion::wireToDomain (*e, rawByte);
```

Para la UI, `normalizedToDomain` da el valor del fader → dominio y
`domainToNormalized` el camino inverso. El DSP **no cambia**: sigue leyendo
dominio, como hoy.

### Paso 5 — Verifica

- `wireToDomain` / `domainToWire` hacen **round-trip `raw → dominio → raw`**
  (byte-exacto para `fidelity`).
- Pasan los **guards** (§9) y el test `Source/Tools/UnitTests/ParamConversionUnitTests.cpp`.

### Paso 6 — Versiona para no romper presets

- Cambias el **wire** de un modelo → sube su `protocolVersion`.
- Cambias el **dominio** de un parámetro ya publicado → sube `conversionVersion`.

Los presets guardados se leen siempre a través de la capa, así que basta con no
reciclar una versión.

### Extensión: dos modelos en un mismo binario

Hoy `parameters` es un mapa `id → entrada` (`CONVERSION_DUPLICATE` prohíbe el
mismo id dos veces) y `findConversionById` devuelve una sola entrada. Es lo
correcto cuando **un modelo está activo por build** (físicos → `dm12_hardware`,
resto → `abyssmind_pro`). Si algún día un mismo id debe convertirse **distinto
según el modelo cargado**, el punto de extensión está ya a la vista: la entrada
lleva `model` y `protocolVersion`, así que basta con (a) permitir el mismo id en
modelos distintos —clave `(model, id)` en el guard de duplicados— y (b) que el
lookup acepte el modelo. El dato ya lo tiene; sólo hay que dejar de colapsarlo.

## 9. Guards: rechaza antes de emitir

**Fatales** (exit 1, no escribe nada) — el spec no puede mentir:

| Código | Qué detecta |
|---|---|
| `CONVERSION_SCHEMA_VERSION` / `CONVERSION_SHAPE` | esquema o forma incorrectos |
| **`CONVERSION_MISSING`** | **un id del APVTS sin entrada — el guard de completitud** |
| `CONVERSION_ORPHAN` | una entrada sin parámetro en el host |
| `CONVERSION_DUPLICATE` | el mismo id dos veces |
| `CONVERSION_MODEL_DECL` / `CONVERSION_MODEL_UNKNOWN` | modelo no declarado |
| `CONVERSION_REGIME` / `CONVERSION_WIRE` / `CONVERSION_WIRECODEC` | valores fuera del enum |
| `CONVERSION_CURVE` / `CONVERSION_CURVE_PARAMS` / `CONVERSION_SMOOTHING` | curva o parámetros inválidos |
| `CONVERSION_UNIT` / `CONVERSION_DOMAIN` | unidad vacía o `min >= max` |
| `CONVERSION_WIRE_MAX` / `CONVERSION_WIRE_OFFSET` / `CONVERSION_WIRE_OFFSET_MISMATCH` | cable inconsistente con el registro |
| `CONVERSION_ENUM_MAX_MISMATCH` / `CONVERSION_ENUM_ORDER` / `CONVERSION_ENUM_ORDER_MISSING` | enum wire↔índice incoherente |
| **`CONVERSION_CODEC_CONFLICT`** | **el spec dice `bipolar` y el registro `value` (o al revés): dos mediciones para el mismo mando** |

`CONVERSION_MISSING` es **el** guard del plan: impide que un parámetro entre sin
conversor. Un id nuevo del host no compila el generador hasta que declare cómo se
traduce.

`CONVERSION_CODEC_CONFLICT` es la red contra el fallo silencioso más caro de esta
capa: el registro (`bridge-param-maps.js`: `BIPOLAR_BYTES`/`ENUM_BYTES`) es quien
decodifica el byte **hoy**, y el spec declara la traducción. Si uno dice `bipolar`
(neutro en el byte 128) y el otro `value` (neutro en el 0), el punto neutro del
mando se mueve medio byte y la curva de todos los presets se corre. Es fatal, no
aviso, porque no hay forma de elegir sin evidencia de hardware.

**Advertencias** (exit 0, registradas):

`CONVERSION_WIRE_NOT_IN_REGISTRY`, `CONVERSION_ENUM_SPEC_DIVERGENCE`
(`porta_mode`: el spec declara 14 y el byte llega a 10), `CONVERSION_DUAL_BYTE`
(11 bytes de los slots de matriz 5-8 compartidos con chord),
`CONVERSION_EXTENDED_OUT_OF_DUMP` (los 3 extendidos, fuera del dump DM12),
`CONVERSION_CODEC_NOT_WIRED` (el spec ya traduce como `enum` y el registro todavía
decodifica como `value` — la migración pendiente, hoy **3 ids**: el bloque de Chord,
que al no tener byte (`wire: none`) no lo puede cablear el puente).

**Cerrado en `conversionVersion: 2` — los 16 selectores de la matriz (bytes
93-116).** El puente los decodificaba con el códec `value` (`raw/255`) pese a que
el spec los declara `enum` con `wireMax` 22 (fuente) y 129 (destino). Medido: el
selector de fuente usaba solo el **8,6 %** del recorrido y el de destino el
**50,6 %**, así que `round(0,0863 * 22) = 2` para el código 22 — **20 de las 23
fuentes y la mitad alta de los destinos eran inalcanzables desde la UI**. El ida y
vuelta seguía funcionando (`round(0,0863 * 255) = 22`), y por eso ningún test de
round-trip lo veía: era un defecto de **mapeo**, no de pérdida de datos. Ahora los
16 bytes están en el `ENUM_BYTES` del puente, el registro los declara `enum` con su
`enumMax`, y el selector cubre 0..1 entero.

### 9.1 PREGUNTA ABIERTA: el byte neutro de las curvas de envolvente

Las 12 curvas (`envN_*_curve`, bytes 58-61 / 67-70 / 76-79) tienen **dominio**
bipolar `[-1, 1]` y **cable** `value` de 0 a 255, declarado así en el spec y en el
registro (byte 58 ∉ `BIPOLAR_BYTES`). Esa declaración procede de una **nota de
ingeniería inversa**, [docs/sysex_format.md](sysex_format.md), que las tabula como
`0=linear…255=exp` — es decir, con el neutro en el byte 0.

**Esa nota está disputada por dos fuentes mejores.** No se ha cambiado el spec
porque el cambio tiene que ser coordinado (spec + registro + puente), pero la duda
queda aquí escrita con su evidencia:

1. **El manual del hardware dice que son tres regímenes, no dos.**
   [resources/md/deepmind_adsr_y_envolventes.md:59](resources/md/deepmind_adsr_y_envolventes.md#L59):
   «estas curvas pueden transformarse entre comportamientos **lineales,
   exponenciales y exponenciales invertidos**». Un control de tres posiciones con
   el lineal en medio (invertida ← lineal → exponencial) es **bipolar centrado en
   128**, no un rango unipolar con el neutro en 0.
2. **Los 1024 presets de fábrica usan el 128 como neutro en esta familia de
   mandos.** Medido sobre `resources/banks/Factory Banks V1.1.2/` (desempaquetado
   7-to-8 del repo): `env*_attack_curve` y `env*_sustain_curve` tienen su moda en
   el byte **128** (50,7 / 59,8 / 37,7 / 49,1 / 67,1 / 69,7 %), mientras
   `env*_decay_curve` y `env*_release_curve` la tienen en el **0** (69,0 / 68,4 /
   64,8 / 77,5 / 72,9 / 89,6 %). El mismo dump usa 128 como neutro en los
   `seq_step_*` (bytes 123-154, que el registro **sí** marca bipolares): 73-98 % de
   la masa está en 127/128. Es la misma convención de centrado.

Con la lectura bipolar, el neutro de las curvas cae en el byte **128** y no en el
127,5 que produce hoy el códec `value` (`raw/255` → `norm`, y el motor aplicando
`(norm-0.5)*2`): medio byte de desviación, que es exactamente el defecto 5. La
regla bipolar **simétrica** que ya declara `wireRules.bipolar` lo deja en 128
exacto.

**La polaridad por etapa sigue sin resolver**: que la moda esté en 0 para
decay/release significa que el preset de fábrica se apoya en un extremo, pero no
dice *cuál* de los dos extremos (exponencial o invertida) es. Eso necesita el
barrido de audio de la Fase 4 — y ahora se sabe que hay que barrer **por etapa**,
no por familia, porque las cuatro etapas de una misma envolvente no se comportan
igual.

Resolverlo toca tres sitios a la vez (y el guard `CONVERSION_CODEC_CONFLICT`
obliga a hacerlo así): el `wireCodec` del spec, `BIPOLAR_BYTES` del puente y la
regla simétrica de decodificación. **Hallazgo colateral de la misma medición**:
`porta_osc_bal` (byte 91) está en `BIPOLAR_BYTES` pero el 47,4 % de los presets
lo tiene en 0 con asimetría −0,992 — se comporta como **unipolar**, así que el
defecto 5 lo estaría distorsionando en toda su mitad inferior.

### 9.2 El cutoff: el spec declara, el motor calibra

`vcf_cutoff` es exponencial en los dos sitios, pero el motor **no** lee su curva
del spec: [SynthVoice_Filter.cpp:82](Source/DSP/SynthVoice_Filter.cpp#L82) calcula
`cal.vcfMinHz * fastExp2(nivel * log2(cal.vcfCurveBase))` con los numeros de
[resources/calibration.json](resources/calibration.json) (`minHz 15`, `curveBase 550`),
porque opera sobre el valor **modulado** muestra a muestra y `fastExp2` es la via
rapida. Editar el JSON **no** cambiaria el filtro: actualizaria el JS/UI y el
artefacto generado, pero el sonido seguiria igual — un fallo silencioso. Por eso el
guard de §10 cruza los dos ficheros (`domain[0]` ↔ `minHz`, `exp(curveParams[1])` ↔
`curveBase`) y se pone rojo si alguien mueve uno solo.

## 10. Cómo se verifica

- `Source/Tools/UnitTests/ParamConversionUnitTests.cpp` — cobertura (246/223/23),
  ids únicos, dominio creciente, round-trip exhaustivo, inversa 0..1↔dominio,
  bipolar simétrico, anclas del día 1, correcciones de defectos. Doble modo: como
  `juce::UnitTest` dentro de `ABDEep_UnitTests` y como harnero propio
  (`ABD_PARAM_CONVERSION_STANDALONE`).
- `scripts/registry_generator.js --check` — los 7 artefactos al día.
- `WebUI/tests/registryGeneratorReal.test.js` — ejecuta el generador de verdad y
  revalida lo emitido. Incluye los casos negativos que prueban que `CONVERSION_MISSING`
  y `CONVERSION_CODEC_CONFLICT` muerden (quitar una entrada del spec, o poner una
  curva de envolvente en `bipolar` → el generador sale 1 con el codigo en el log).
- `scripts/registry_generator.test.js` — **guard de consistencia spec ↔ motor**:
  cruza el spec con `resources/calibration.json` en los tres acoplamientos que
  comparten (cutoff: `domain[0]`/base ↔ `vcfCutoff.minHz`/`curveBase`; tiempos de
  envolvente: techo del dominio ↔ `envelopes.maxTimeSec`; rate del LFO:
  `curveParams` ↔ `lfo.rateScale/rateExp`). Existe porque el motor **no** lee el
  cutoff del spec (usa `fastExp2` sobre el valor modulado y las constantes de
  calibración), así que editar sólo uno de los dos dejaba el spec diciendo una
  cosa y el motor sonando otra **sin ningún rojo**. Verificado que muerde: con la
  base del spec cambiada a 400, el test falla con el mensaje que lo dice.
  Añade además el **invariante de codec**: los 43 bipolares del spec son
exactamente los del registro, las 12 curvas de envolvente declaran dominio bipolar
con un cable que coincide con el del registro (sin prejuzgar que `value` sea la
respuesta correcta — eso es la pregunta abierta de §9.1, que tiene su propio
candado de memoria) y el inventario de migraciones `enum` declaradas y no cableadas
es exactamente el juego conocido (16 src/dest de matriz +
`chord_enable`/`chord_type`/`poly_chord_enable`).
- `WebUI/tests/artefactosVigilados.test.js` + `gitattributesGuard.test.js` — todo
  lo que el generador escribe está en el CI y fijado en LF.
- `.github/workflows/registry-generation.yml` — regenera y exige árbol limpio.

## 11. Estado del cableado (Fase 1 y Fase 2)

**Fase 1 (spec + generador):** la capa se siembra del comportamiento actual y se
valida. El `SynthEngine` todavía no la usaba; el día 1 era, por construcción, el
mismo sonido.

**Fase 2 (el motor consume dominio):** los números mágicos de
`SynthEngine_Parameters.cpp` ya no están ahí — el mapeo de **tiempos de envolvente**
(`raw*10`), **curvas de envolvente** (`(x-0.5)*2`), **rate de LFO** (`0.035*e^(7.5t)`)
y **delay de LFO** (`*6.59f`) se piden a la capa con `domainOf(id, valor0a1)`, que
devuelve el dominio (segundos, Hz). El motor ya no escala: consume dominio.

La refactorización es **byte-exacta**: para los 256 valores de un cable de 8 bits,
las dos formas dan el mismo `float` (medido, 0/256 diferencias), y la suite C++
completa (191 suites · 1.119.897 aserciones) sigue en verde con los mismos
recuentos. Eso es lo que garantiza la paridad del día 1.

**Lo que queda fuera de este PR (fases posteriores, a propósito):**

- **Rangos del APVTS**: siguen declarando 0..1 donde el dominio no es 0..1
  (`global_volume` [0,2], `master_softclip_headroom` [0,6] dB, ...). Cambiarlos es
  la corrección masiva de defectos medidos, y va en un PR que sube
  `conversionVersion` a 2. No se hace aquí para no romper la paridad del día 1.
- **`wireCodec: enum` de la matriz** (src/dest): el spec ya lo declara, pero el
  puente (`bridge-param-maps.js` / decodificador SysEx) todavía los trata como
  `value`. El conversor posee el `enumOrder`; falta que el puente lo consuma.
- **`smoothingSpace`**: el suavizado del cutoff ya opera sobre el nivel
  normalizado (que, con la curva exponencial, es espacio **log**) — coincide con
  lo que el spec declara. Falta auditar el resto de parámetros `log`.
- **Curva del cutoff**: su exponencial se queda en el DSP (no en el APVTS) porque
  opera sobre el valor **modulado** y usa `fastExp2`; moverla rompería la paridad
  estricta. Sus constantes (15 Hz, base 550) ya son datos de calibración, no
  números mágicos.

**El fallback Web Audio dice lo mismo que el motor:**
[wasm_bridge_synth.js](WebUI/js/wasm_bridge_synth.js) aplica las mismas dos leyes
(el spec como fuente única cuando `window.ParameterConversion` está cargado, y si
no la misma ley medida: tiempos `norm * 10`, cutoff `15 * 550^norm`), de modo que
el fallback nativo y el motor C++/WASM no divergen. Su test cruza `envTimeSec` y
`cutoffHz` contra `conversion.gen.js` y contra los números de la calibración.

**Auditoría de paridad de audio**: el plan pide una prueba Audio A/B (motor
antiguo vs. motor con dominio) con cancelación de fase. Los números de arriba
(bit-exactitud + suite completa) son la evidencia disponible en este entorno; el
render A/B del Calibration Lab queda pendiente de ejecutar.
