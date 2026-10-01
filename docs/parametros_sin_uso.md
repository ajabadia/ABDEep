# Parámetros que nadie usa

Informe del 1 de octubre de 2026 sobre los parámetros que el host declara y
que no terminan Moving the sound. No es una lista de stark Errors: hay cuatro
situaciones distintas detrás de los mismos 52 identificadores, y confundirlas
es lo que hace que elrepo parezca más roto de lo que está.

## De dónde sale cada lista

Un parámetro de este proyecto está escrito en tres sitios y solo uno de ellos
decide si suena:

| Dónde | Qué es | Quién lo escribe |
|---|---|---|
| `Source/Core/ParametersSpec_*.cpp` | La APVTS: los 250 del spec, más 3 globales en `ParametersSpec.cpp` | a mano |
| `Source/Core/ParameterRegistry.gen.cpp`, `WebUI/js/registry.gen.js`, `schemas/parameter-registry.data.json` | El registro: byte, CC y región de cada parámetro | `scripts/registry_generator.ts` |
| `Source/DSP/SynthEngine_Parameters.cpp`, `Source/DSP/FX/FXEngine.cpp` | El motor: quien realmente aplica el valor | a mano |

Los tres no se avisan entre sí. El generador tiene ocho avisos y todos son
`CC_LEGACY_DIVERGENCE`; no avisa de que un id del registro no exista en el spec,
ni de que dos ids compartan byte.

**Y HAY QUE MIRAR DOS FORMAS DE USAR UN PARÁMETRO.** Ochenta y cuatro
identificadores no aparecen nunca como literal en el motor porque se
CONSTRUYEN: en `FXEngine.cpp` el hueco y el parámetro son
`"fx" + String(s + 1)` y `prefix + "_param" + String(p + 1)` (sesenta en total:
cuatro huecos por type, gain, mix y doce parámetros), y en
`SynthEngine_Parameters.cpp` los ocho huecos de la matriz son
`"mod_matrix_slot" + String(slot + 1) + "_src"` (veinticuatro). Un buscador
ingenuo da 84 falsos positivos. Los 84 están vivos.

## Las cifras

- 250 declarados en el spec, sin ids duplicados.
- 200 los lee el motor.
- 50 no los lee el motor.
- 0 no aparecen en ningún sitio: los 50 se mueven, pero solo por serializadores.

## Los 50, en cuatro grupos

### Grupo 1. Estado de una función que vive en el WebUI (47)

Los 38 `seq_*` y 9 de los 11 `arp_*`.

**NO ES UN ERROR, Y POR QUÉ NO.** No hay motor de secuenciador ni de arpegio en
C++: no existen `Source/DSP/Seq*`, ni `Source/Plugin/BridgeActions_Seq.cpp`, ni
un `ArpEngine`. El secuenciador es `WebUI/js/bridge-engines-seq.js` y el
arpegiador es `WebUI/js/bridge-engines-arp.js`, que leen sus parametros de
`parameterCache`. La APVTS los declara para que el host los acepte, los guarde
en el preset y los devuelva al abrir la interfaz.

Lo único que el motor C++ hace con el arp es usar `arp_rate` y
`arp_clock_divider` como reloj para el sync del LFO
(`SynthEngine::lfoArpSyncHzFromRate`). Los otros nueve no tienen a quién llegar.

**LO QUE SÍ SE PEDE DECIR.** Un preset guardado con el secuenciador programmed
funciona si el plugin se abre con su WebUI. Abierto sin ella (un host que no
monte WebView), esos 49 parámetros viajan en el preset y no mueven nada. Eso no
está escrito en ninguna parte.

### Grupo 2. Un mando visible que no hace nada (1) — YA CABLEADO

`arp_velocity_gate` (NRPN ninguno, enum `Gate` / `Velocity` / `Seq`).

Este era el más caro de los 50 porque el usuario lo VE:
`WebUI/js/components/arp-modal.js:37` pinta un `<select>` con las tres
opciones, y `WebUI/js/panel_param_handler.js:186` lo vuelve a leer para
sincronizarlo. Pero `bridge-engines-arp.js` hacía `pianoNoteOn(outNote,
h.velocity)` y nunca miraba el parámetro: **el arpegiador sonaba siempre con la
velocidad de la tecla, que es exactamente lo que dice la opción «Velocity»**. El
selector prometía tres modos y no ejecutaba ninguno.

**AHORA ESTÁ CABLEADO.** La política vive en `_arpVelocityFor`, en
`WebUI/js/bridge-engines-arp-modes.js` —función pura junto a `_arpCalcStep`, con
el mismo «sin estado del bridge» por delante— y `_arpStep` la usa al tocar:

| Modo | Qué hace | Por qué ese valor |
|---|---|---|
| **Gate** (0) | Velocidad constante (100), se toque como se toque | Es el modo en el que el arp no te hace caso. El 100 es el `velocity \|\| 100` que ya usa `pianoNoteOn`: la velocidad neutra del propio puente, no un número inventado |
| **Velocity** (1) | La salida es la de la tecla | Es lo que hacía el motor siempre; ahora es lo que dice la opción |
| **Seq** (2) | Rampa triangular sobre las notas sostenidas (127 → 40 y vuelta), periodo 2n−2 | Hace que el mismo acorde suene distinto cada vuelta. El periodo es el mismo que el de UP-DOWN de notas, no por casualidad |

El valor normalizado 0..1 que manda el panel (`value / 2.0`) se mapea al índice
del enum igual que `arp_mode` por 10 y `arp_octave` por 3. Con **una sola nota** la
rampa de Seq es degenerada y copia la tecla: un 127 fijo sería un salto del que
el usuario no puede salir. Y la velocidad se calcula **después** del clamp de
octava de `_arpStep`, que puede cambiar `noteIdx`, y la rampa va por él.

**POR QUÉ NO TIENE BYTE.** No es un parámetro virtual: en el preset real el
**byte 112** se llama «Arp Velocity Gate» (`docs/sysex_format.md` §4.12). Es un
byte *dual* que el hardware comparte con Mod Slot 7 Destination, así que el
registro no puede darle ese byte sin romper la matriz de modulación. Es el mismo
caso que `arp_enable` (109), `arp_hold` (110) y `arp_key_sync` (111).

Tests: `WebUI/tests/arpVelocityGate.test.js` (27 tests), cargando el fichero real
—no una copia— y comprobando el orden respecto al clamp de octava.

### Y el que quedaba: `arp_pattern` — YA CABLEADO

65 opciones (None + 32 Preset + 32 User), un editor que dibuja 32 barras, un
botón Save que las guarda en el almacenamiento local y un Load que las recupera.
El motor se recurría `arp_mode` y no miraba ninguna de las tres cosas.

Ahora el patrón es una **máscara de 32 pasos** sobre el ciclo: el paso
`stepIndex % 32` suena si su casilla está encendida. Sin patrón suena todo. Los
tres puntos del cableado estaban a medias: `setArpPattern` / `resolveArpPattern`
en el bridge no existían, el editor dibujaba barras que no cambiaban nada, y el
Load no ponía a sonar lo que cargaba.

Tests: `WebUI/tests/arpPattern.test.js`.

### Grupo 3. Restos de una nomenclatura que este synth no tiene (2)

`slot_a_type` y `slot_b_type`, con las opciones `OSC1_Style` / `OSC2_Style`.

Este motor no tiene ranuras A y B: tiene `osc1_*` y `osc2_*`. Estos dos no
tienen byte, no tienen CC, no los lee el motor y no los usa ningún fichero del
WebUI salvo el propio registro, donde el generador ya los marca `specOnly`. O
sea: la herramienta llevaba diciendo "esto no existe" desde el 25 de septiembre.

### Grupo 4. Un parámetro a medio cablear (1)

`osc_drift`. El spec lo declara SIN NRPN (`ParametersSpec_Voice.cpp:32`), pero
el registro le asigna el byte 88, que es el de `voice_drift`, que sí suena y sí
lo lee el motor. El drift ya tiene tres parámetros en el motor
(`voice_drift`, `param_drift`, `drift_rate`, leídos en
`SynthEngine_Parameters.cpp:181-186`), así que un cuarto no aporta nada.

## Del lado contrario: dos ids que el registro usa y el host no declara

Estos son peores que los anteriores, porque no son un parámetro inútil: son un
escritura que no tiene destino.

| id | Viene de | Byte | Colisiona con |
|---|---|---|---|
| `osc2_pitch_mod_select` | `WebUI/js/bridge-param-maps.js:41` | 32 | `osc2_pm_source`, que sí lee el motor |
| `arp_gate` | el registro | 160 | `arp_gate_time` |

`PatchByteCodec.h:21` resuelve el byte con `Registry::findParameterByOffset`, así
que una escritura al byte 32 se guarda como fuente de modulación del OSC2 o como
selector de modulación de tono, según cuál encuentre primero. No es un parámetro
inactivo: es un byte con dos respuestas.

Y hay una tercera colisión, entre dos que sí están declarados: `voice_drift`
(byte 88) y `osc_drift` (byte 88 en el registro).

## Qué hacer con cada uno

| Parámetro | Propuesta | Por qué |
|---|---|---|
| `slot_a_type`, `slot_b_type` | **Borrados** del spec y del JSON | Hecho. No hay motor, byte, CC ni consumidor |
| `osc_drift` | **Borrado** del spec y del mapa del puente | Hecho. El drift ya está cubierto por tres parámetros que el motor lee |
| `arp_velocity_gate` | **Cableado** en el arpegiador JS, vía `_arpVelocityFor` | Hecho. Los tres modos hacen cosas distintas y distintas entre sí |
| `osc2_pitch_mod_select` | **Quitado** del mapa del puente | Hecho. Pisaba `osc2_pm_source`, que sí suena |
| `arp_gate` | **Borrado** del mapa del puente, del CC y del `script_midi_mappings.js` | Hecho. El spec ya tenía `arp_gate_time` en el 160 |

**LO QUE CUESTA BORRAR UN PARÁMETRO.** No es quitar su línea: es que cada
sitio que lo nombraba tiene que volverse a entera. Para estos cinco fueron el
spec de C++, el mapa del puente, el JSON legacy, el mapa de NRPN que ve el
usuario (`script_midi_mappings.js`) y el randomizador de patches, más sus
fixtures de test. El que más se esconde es el último: un fixture replica el
código del generador, así que al borrar el parámetro de uno hay que borrarlo del
otro, y si no, el test falla por el número de parámetros o —peor— pasa
comprobando el nombre viejo.

**Y POR QUÉ PASABA TANTA VEZ.** Porque nada lo obligaba. Los tres guards del
generador vigilan **el mapa del puente**; el resto del árbol podía escribir lo
que quisiera. Ahora hay un cuarto: `WebUI/tests/registryIdsSweep.test.js`
comprueba que las cuatro tablas que **declaran** ids usen solo ids que existen.
No barre el repo entero —eso dio 10 falsos positivos: los parámetros internos
del bridge (`patch_dirty`) llevan guion bajo igual que uno de verdad, y los ids
construidos por prefijo no existen como literal—; verifica las tablas, que son
un contrato.

Lo encontró uno más: `script_randomizer.js` seguía escribiendo
`osc2_pitch_mod_select` en cada patch aleatorio. Un byte que el host no declara,
en cada patch que generaba la máquina.
| Los 47 de `seq_*` y `arp_*` | **Dejarlos y documentarlos** | Guardar el estado de una función del WebUI no es un error; lo que falta es que se diga |
| Los 3 colisiones de byte | **Guard en el generador** | Hecho: `NRPN_COLLISION`, sin lista de escapes |

## Los tres guards: puestos

Las tres comprobaciones que faltaban están **en `scripts/registry_generator.js`
y `scripts/registry_core.ts`**, y fallan con exit 1 sin emitir artefactos. Los
cuatro datos que las violaban se limpiaron antes, así que el generador está verde
y los guards son una puerta, no una puerta atascada.

| Guard | Código | Qué falla | Limpieza que lo dejó verde |
|---|---|---|---|
| 1 | `REGISTRY_ID_NOT_IN_SPEC` | Un id en `PARAM_TO_BYTE_OFFSET` que el host no declara | Fuera `osc2_pitch_mod_select` y `arp_gate` |
| 1b | `CC_ID_NOT_IN_SPEC` | Un id en `PARAM_TO_CC` que el host no declara | (nada: ya no hay ninguno) |
| 2 | `NRPN_COLLISION` | Un byteOffset con dos ids | Fuera `osc2_pitch_mod_select` (32), `osc_drift` (88) y `arp_gate` (160) |
| 3 | `SPECONLY_UNCONSUMED` | Un id declarado en el spec, sin byte, que no está en la allowlist | Fuera `slot_a_type` y `slot_b_type` |

El guard 1 mira **las dos** tablas de ids del mapa del puente. `PARAM_TO_CC` es
la segunda puerta, y sin mirarla un identificador inventado colado ahí pasaba el
generador entero: es el mismo defecto —un mando que el host no declara— con el
solo extra de que además se mueve desde el MIDI externo. Los tres ids que viven
solo en la tabla de CC (`global_volume`, `global_tune`, `transpose`) son de la
APVTS y no tienen byte porque no son del sintet; no necesitan lista de escapes
porque están declarados, que es lo que el guard mira.

### El guard 2 es el que más dolía

No era un guard nuevo: **ya existía**, con una lista de escapes
(`kKnownAliasOffsets = {32, 88, 160}`) que llamaba «alias intencionales» a los
tres bytes con dos respuestas. La lista llegaba exactamente a los tres defectos
de este informe, y por eso el generador llevaba semanas verde con un byte que
tenía dos nombres. La lista se ha vaciado; un alias de verdad, si algún día hace
falta, se declara con su byte propio.

### Por qué el guard mide contra el spec de C++

El spec que declara el host son los **247** ids de
`Source/Core/ParametersSpec_*.cpp`, no los **15** de
`resources/parameters_spec.json` (metadatos legacy del emulador). Un guard que
comparara el registro contra el JSON daría 220 falsos positivos y nadie lo
encendería nunca. El generador ahora lee los cinco ficheros de C++ y saca solo
el conjunto de ids; los metadatos (`name`, `desc`, `min`/`max`, `default`,
`midi_cc`) siguen viniendo del JSON, que se fusiona igual que antes. Ese conjunto
entra además en `sourceHashes` como cuarta fuente.

### Por qué el guard 3 no escanea el motor

Los ids que el motor construye por prefijo (`fx1_mix` sale de
`"fx" + String(s + 1) + "_mix"`) no aparecen como literal en ningún fichero. Un
escaneo los daría por muertos —o peor, por vivos, y habría que mantener la lista
de prefijos al día—. Así que el guard 3 compara contra una lista explícita de los
**16** declarados-sin-byte que sí están vivos, cada uno con su porqué: los cuatro
`fx*_mix` construidos, cinco globales de la APVTS, cuatro que pertenecen al panel,
y `arp_velocity_gate`, que ya está cableado en `_arpVelocityFor`. Una entrada de
la lista que ya no aplica avisa (`SPECONLY_ALLOWLIST_STALE`); lo que no esté en la
lista es un error.

### Un bug que estos guards enseñan

`!paramToOffset[id]` es `true` para el byte **0**, así que un guard escrito con
truthiness declararía «sin byte» al primer parámetro del registro
(`lfo1_rate`). Corregido con `hasOwnProperty` en los tres sitios, con un test que
comprueba exactamente ese caso. Un guard que se equivoca en el primer id no es un
guard: es ruido que se aprende a ignorar.

### Lo que encontró el guard mientras se ponía

Los fixtures de `bridgeParamMaps.test.js` y `browserMapper.test.js` tienen su
propia copia del mapa del puente, y esa copia llevaba meses desfasada: los
`chord_*` en 105-108 (encima de `mod_matrix_slot5/6`, un **cuarto** grupo de
colisión) en vez de 300-303, y `fx_feedback_gain` en el **223**, que es el
primer byte del nombre del patch. El generador nunca lo vio porque no lee los
tests; los tests tampoco lo veían porque comparaban el fixture consigo mismo.

### Después

`registry_generator` pasa de 236 a **233** parámetros, con `aliasGroups=0`.
Para que no se repita, `registryGen.test.js` §5c comprueba los tres guards sobre
el artefacto **emitido**, no solo sobre las fuentes: así también cazan a quien suba
un `.gen` viejo o lo edite a mano.

## Cómo reproducir el recuento

```bash
# Los declarados: una linea por parametro (250). Los espacios doubles cuentan,
# porque seis envolventes alinean las columnas.
grep -hoE '\{ +"[a-z0-9_]+", +"[^"]+", +"[^"]+", +"[a-z]+"' \
  Source/Core/ParametersSpec_*.cpp | wc -l

# Los que el motor lee, sin contar los que construye por prefijo.
grep -oE '(getFloat|getInt|getBool)\("?[a-z0-9_]+' Source/DSP/SynthEngine_Parameters.cpp \
  Source/DSP/FX/FXEngine.cpp | sort -u

# Los ids del registro que no estan en el spec, y los bytes con dos ids.
node -e "const p=require('./schemas/parameter-registry.data.json').parameters;
const by={};for(const x of p)(by[x.byteOffset]??=[]).push(x.id);
for(const [b,i]of Object.entries(by))if(i.length>1)console.log(b,i);"
```

Los 84 construidos no salen por el primer comando y hay que contarlos aparte:
`fx{1..4}_{type,gain,mix}` son 12, `fx{1..4}_param{1..12}` son 48, y
`mod_matrix_slot{1..8}_{src,dest,depth}` son 24.
