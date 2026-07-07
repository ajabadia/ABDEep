# DeepMind 12 — Especificación de parámetros y capa de control

Fuentes principales: manual adjunto `DEEPMIND-12.es.pdf`, `patchwork-deepmind`, `pencilresearch/midi`, `KnobKraft-orm` y `midi.guide`.[cite:129][cite:134][cite:139][cite:140][cite:142]

## Propósito del documento

Este documento define una base de trabajo para usar una reinterpretación del DeepMind no solo como sintetizador propio, sino también como **superficie de control, editor y posible gestor de patches para el hardware original**. Las fuentes abiertas revisadas muestran que el DeepMind 12 expone una parte importante de sus parámetros por **MIDI CC/NRPN** y además permite trabajar con **edit buffer / snapshots vía SysEx**, lo que hace viable una arquitectura “control-first”.[cite:134][cite:140][cite:142]

La conclusión práctica es que puede tener mucho sentido empezar por la **capa de control y modelo de parámetros**, antes incluso de completar todos los módulos DSP internos. De esa forma, el proyecto serviría desde el principio para controlar un DeepMind real, y más adelante cada bloque interno del nuevo sintetizador podría ir sustituyendo o complementando al hardware original sin romper la interfaz conceptual.[cite:134][cite:140][cite:142]

## Tesis de arquitectura

La mejor separación conceptual para el proyecto es esta:

1. **Modelo de parámetros**: representación completa del estado del sinte, nombres, rangos, unidades, agrupaciones y serialización.[cite:129][cite:142]
2. **Capa de transporte/control**: envío y recepción por CC, NRPN y SysEx para hablar con el DeepMind real.[cite:134][cite:142]
3. **UI / editor**: panel visual, páginas, macros, librería y comparación de patches.[cite:129][cite:140]
4. **Motores internos**: osciladores, filtros, envolventes, LFO, FX y mod matrix del nuevo instrumento.[cite:129]

Esta secuencia tiene una ventaja clara: el trabajo no se pierde. Si primero se diseña un modelo de parámetros robusto y una capa de control MIDI/SysEx bien organizada, esa misma estructura seguirá sirviendo cuando el sinte empiece a ejecutar audio internamente.[cite:134][cite:140]

## Lo que ya se sabe del DeepMind

El manual define al DeepMind 12 como un sintetizador polifónico analógico de 12 voces con **2 osciladores y 2 LFO por voz**, **3 generadores ADSR**, **4 motores FX**, **matriz de modulación de 8 buses**, secuenciador de 32 pasos y control remoto por USB, MIDI y Wi‑Fi.[cite:129] `midi.guide` publica una implementación MIDI para el DeepMind 12 con **111 parámetros** y la organiza como tabla de CC/NRPN; además lista parámetros de osciladores, filtros, HPF, envolventes, curvas y FX, lo que confirma que una parte muy significativa del panel y menús es controlable de forma externa.[cite:142]

`patchwork-deepmind` añade otra pieza importante: expone herramientas para **control en tiempo real por NRPN**, lectura de parámetros, tipos de FX y acceso a snapshots del **edit buffer** vía SysEx, con la posibilidad de parchear bytes directamente para parámetros que no resulten cómodos vía `set_param`.[cite:134] `KnobKraft-orm` muestra que el Deepmind 12 encaja bien en una arquitectura de adaptación genérica para gestión de SysEx, librería de patches y operaciones de banco, algo especialmente interesante si el proyecto quiere convertirse también en un editor/librarian serio además de sintetizador propio.[cite:140]

## Principio rector: “Control-first, synth-second”

Para este proyecto, empezar por la capa de control no es una solución provisional: puede ser una decisión estructural correcta. Las razones son estas:

- Permite construir desde ya una **herramienta útil** para el hardware DeepMind real.[cite:134][cite:140][cite:142]
- Obliga a fijar pronto una **ontología de parámetros** coherente, algo que también beneficiará al motor DSP posterior.[cite:129][cite:142]
- Facilita pruebas A/B entre hardware y futura implementación interna, ya que ambos compartirían nombres, rangos y semántica de parámetros.[cite:129][cite:142]
- Hace posible una transición gradual: primero editor/controlador, después híbrido, después sintetizador autónomo inspirado en DeepMind.[cite:134][cite:140]

La recomendación es, por tanto, diseñar primero una **capa de modelo de estado** y una **capa de comunicación** lo bastante rigurosas como para servir simultáneamente a tres fines: controlar el hardware, almacenar patches y alimentar un motor interno futuro.[cite:134][cite:140][cite:142]

## Modelo de capas propuesto

### 1. Dominio de parámetros

Debe existir una descripción única de cada parámetro, independiente de si luego se usa para enviar NRPN, mostrar un slider en UI, guardar un preset o alimentar el DSP interno.[cite:142]

Cada parámetro debería tener como mínimo:

- identificador interno estable;
- nombre legible;
- bloque funcional (`osc`, `filter`, `env`, `lfo`, `fx`, `system`, etc.);
- ámbito (`perVoice`, `global`, `perPatch`, `perFxSlot`, `modMatrix`);
- tipo de dato (`bool`, `enum`, `int`, `float`, `bipolar`, `timeMs`, `frequencyHz`, `db`, `percent`);
- rango bruto MIDI;
- rango musical/normalizado;
- método de transporte soportado (`CC`, `NRPN`, `SysEx`, o combinación);
- posibilidad de automatización/modulación;
- correspondencia futura con el motor interno.[cite:129][cite:134][cite:142]

### 2. Transporte MIDI / SysEx

Encima del dominio de parámetros debe haber una capa que traduzca el modelo interno a mensajes reales del hardware:

- envío de CCs directos cuando existan; [cite:142]
- envío de NRPN para parámetros finos o de menú; [cite:134][cite:142]
- operaciones SysEx para snapshot/edit buffer, dumps y escritura avanzada. [cite:134][cite:140]

Esta capa no debería “conocer” la UI ni el DSP; solo traducir operaciones de alto nivel como `setParameter`, `requestEditBuffer`, `sendPatch`, `comparePatch`, `loadBank` o `writeProgram` a mensajes concretos.[cite:134][cite:140]

### 3. Vista/UI

La UI debería consumir solo el dominio de parámetros y el estado de conexión. De este modo podría funcionar en tres modos:

- **modo hardware**: la UI controla un DeepMind real; [cite:134][cite:142]
- **modo híbrido**: la UI controla hardware y un mirror interno para comparación; [cite:134]
- **modo interno**: la UI controla únicamente el motor DSP propio. [cite:129]

### 4. Motor interno

Cuando se implemente audio, el motor debe leer el mismo estado paramétrico que ya usa la UI y que ya sabe exportarse por MIDI/SysEx. Así se evita crear dos nombres distintos para la misma idea musical.[cite:129][cite:142]

## Inventario funcional de parámetros

Lo siguiente no pretende ser todavía una tabla exhaustiva de bytes o NRPN exactos, sino una **especificación funcional completa** de lo que debería existir en el modelo.

## Osciladores

El manual deja claro que el DeepMind tiene **dos osciladores distintos por voz**: OSC1 ofrece sierra y cuadrada/pulso con PWM, mientras que OSC2 se basa en cuadrada con `Tone Mod`, además de pitch y nivel propios.[cite:129]

Parámetros funcionales mínimos del bloque de osciladores:

- `osc1.saw.enable`.[cite:129]
- `osc1.square.enable`.[cite:129]
- `osc1.pwm.amount`.[cite:129]
- `osc1.pitchMod.amount`.[cite:129]
- `osc1.range` (16’, 8’, 4’). [cite:129]
- `osc2.toneMod.amount`.[cite:129]
- `osc2.pitch`.[cite:129]
- `osc2.level`.[cite:129]
- `osc2.pitchMod.amount`.[cite:129]
- `osc2.range` (16’, 8’, 4’). [cite:129]
- `osc.sync.enable` / modo de sync.[cite:129]
- `osc.drift.amount`.[cite:129]
- `noise.level`.[cite:129]

Para la reinterpretación propia conviene añadir una capa adicional no necesariamente exportable al hardware:

- `slotA.oscType` = `DeepOsc1 | DeepOsc2 | FutureTypes…`
- `slotB.oscType` = `DeepOsc1 | DeepOsc2 | FutureTypes…`

En modo hardware real, estos dos campos quedarían bloqueados en la configuración original DeepMind. En modo interno, podrían liberar combinaciones extendidas como `OSC1+OSC1` o `OSC2+OSC2`.[cite:129]

## Polifonía y comportamiento de voz

El DeepMind ofrece modos de unison/polifonía, detune, drift, pan spread y portamento polifónico; varios de estos aparecen en el manual y algunos también como destinos de mod matrix o parámetros accesibles externamente.[cite:129][cite:142]

Parámetros de esta familia:

- `poly.mode`.
- `poly.voiceCount` / submodo de unison. [cite:129]
- `poly.unisonDetune`.[cite:129]
- `poly.panSpread`.[cite:129]
- `porta.time`.[cite:129][cite:142]
- `porta.mode` (si el proyecto decide exponer tiempo fijo, tasa fija, exponencial, etc.). [cite:129]
- `osc.drift.amount` y quizá `param.drift.amount` si se modelan por separado.[cite:129][cite:142]

## Filtro VCF

El filtro principal es un **LPF resonante por voz** conmutado entre **24 dB/oct (4 polos)** y **12 dB/oct (2 polos)**, con auto-oscilación, seguimiento de teclado y modulación por envolvente y LFO.[cite:129]

Parámetros funcionales:

- `vcf.cutoff`.[cite:129][cite:142]
- `vcf.poleMode` = `4pole | 2pole`.[cite:129]
- `vcf.resonance`.[cite:129][cite:142]
- `vcf.envDepth`.[cite:129][cite:142]
- `vcf.envInvert`.[cite:129]
- `vcf.lfoDepth`.[cite:129][cite:142]
- `vcf.lfoSource` = `LFO1 | LFO2`. [cite:129]
- `vcf.keyboardTracking`.[cite:129][cite:142]

## Filtro HPF y refuerzo de graves

El HPF está después del VCA y afecta al conjunto de voces; el manual lo presenta con frecuencia ajustable y pendiente fija de **-6 dB/oct**, además de un `BOOST` analógico asociado al grave.[cite:129]

Parámetros funcionales:

- `hpf.cutoff`.[cite:129][cite:142]
- `hpf.boost.enable`.[cite:129]

En la reinterpretación interna conviene respetar esta topología: el HPF no debería modelarse como un segundo filtro multimodo por voz, sino como una etapa posterior común o al menos conceptualmente equivalente.[cite:129]

## Envolventes

El DeepMind tiene **tres ADSR por voz**: VCA, VCF y MOD. No aparecen fases Delay/Hold adicionales, pero sí modos de trigger alternativos y control de curvas por etapa.[cite:129]

Parámetros funcionales comunes por envolvente:

- `envX.attack`.[cite:129][cite:142]
- `envX.decay`.[cite:129][cite:142]
- `envX.sustain`.[cite:129][cite:142]
- `envX.release`.[cite:129][cite:142]
- `envX.attackCurve`.[cite:129][cite:142]
- `envX.decayCurve`.[cite:129][cite:142]
- `envX.sustainCurve`.[cite:129][cite:142]
- `envX.releaseCurve`.[cite:129][cite:142]
- `envX.triggerMode` = `Key | LFO1 | LFO2 | Loop | Seq`. [cite:129]

Donde `envX` es:

- `envVca`
- `envVcf`
- `envMod`

A nivel de arquitectura, esto sugiere un único motor ADSR parametrizable, instanciado tres veces por voz, con curvas por etapa y distintos modos de disparo.[cite:129]

## VCA

El manual describe una arquitectura de VCA en dos etapas: una por voz y otra etapa común para compensación de nivel entre programas. Además hay profundidad de envolvente, sensibilidad a velocidad y expansión estéreo.[cite:129]

Parámetros funcionales:

- `vca.level`.[cite:129][cite:142]
- `vca.envDepth`.[cite:129]
- `vca.velocitySensitivity`.[cite:129]
- `vca.panSpread`.[cite:129]
- `vca.mode` = `Transparent | Ballsy` si decides reflejar ese parámetro tal cual en el modelo interno/editor.[cite:129]
- `vca.pan` como posible destino de mod matrix.[cite:129][cite:142]

## LFOs

El DeepMind incluye **2 LFO por voz** con varias formas, sync, delay y fade, además de seguimiento por nota y modos mono/poly/spread.[cite:129]

Parámetros funcionales mínimos:

- `lfo1.rate`, `lfo2.rate`.[cite:129][cite:142]
- `lfo1.delay`, `lfo2.delay`.[cite:129][cite:142]
- `lfo1.slew`, `lfo2.slew`.[cite:129][cite:142]
- `lfo1.shape`, `lfo2.shape`.[cite:129][cite:142]
- `lfo1.fade`, `lfo2.fade` como fuente o parámetro derivado si se implementa tal como aparece en la mod matrix.[cite:129]
- `lfo1.sync`, `lfo2.sync`.[cite:129]
- `lfo1.phaseMode`, `lfo2.phaseMode` (`mono`, `poly`, `spread`). [cite:129]

## FX

El DeepMind tiene **4 slots de efectos por programa**, 35 algoritmos, `true bypass`, `tap tempo` y **10 configuraciones de routing**, incluidas rutas con feedback. Muchos parámetros de FX aparecen como destinos de mod matrix y la implementación MIDI lista control de tipo, parámetro y ganancia por efecto.[cite:129][cite:142]

Parámetros funcionales de nivel rack:

- `fx.enabled` / `fx.trueBypass`.[cite:129]
- `fx.routingMode`.[cite:129]
- `fx.tapTempo` / `clock.bpm`.[cite:129]
- `fx.anaThru` si decides exponer el paso analógico tal como aparece en la implementación MIDI pública.[cite:142]
- `fx.mode` si el hardware lo separa como estado propio.[cite:142]

Parámetros por slot `fx1..fx4`:

- `fxN.type`.[cite:129][cite:142]
- `fxN.param1`.[cite:142]
- `fxN.param2`.[cite:142]
- `fxN.param3`.[cite:142]
- `fxN.param4`.[cite:142]
- `fxN.level` o `gain`.[cite:142]

La tabla publicada por `midi.guide` muestra precisamente `FX1 Type`, `FX1 Param1..4`, `FX1 Gain` y equivalentes para FX2–FX4, lo cual es ideal para construir una representación homogénea del rack sin casarse demasiado pronto con una implementación DSP concreta.[cite:142]

## Arpegiador y secuenciador de control

Aunque quizá no sea la prioridad del sonido inicial, si la herramienta va a controlar hardware real conviene reservar ya el espacio conceptual para estos bloques. El manual documenta arpegiador, secuenciador de control, división de reloj, longitud, swing y slew, y además el secuenciador puede actuar como fuente de modulación.[cite:129]

Parámetros funcionales recomendados:

- `arp.enabled`.[cite:129]
- `arp.rate` / `clock.division`. [cite:129]
- `arp.gateTime`.[cite:129]
- `arp.pattern/mode`.[cite:129]
- `arp.hold`.[cite:129]
- `chord.mode`, `polychord.mode`. [cite:129]
- `seq.enabled`.[cite:129]
- `seq.length`.[cite:129]
- `seq.swing`.[cite:129]
- `seq.slew`.[cite:129][cite:142]
- `seq.steps[]` para el valor de cada paso si el proyecto acaba haciendo editor completo.[cite:129]

## Mod matrix

La matriz de modulación del DeepMind es uno de los elementos más estructurales del instrumento: **8 buses**, **24 fuentes** y **132 destinos** según el manual.[cite:129] Esto implica que el modelo de parámetros no debe ver la modulación como un “extra”, sino como un sistema nativo.[cite:129]

### Fuentes principales documentadas

- Pitch Bend.[cite:129]
- Mod Wheel.[cite:129]
- Foot Ctrl / Expression / Breath / Aftertouch.[cite:129]
- LFO1, LFO2 y versiones unipolares/fade.[cite:129]
- VCA Env, VCF Env, MOD Env.[cite:129]
- Note Number, Note Velocity, Note Off Velocity, Voice Number.[cite:129]
- Control Sequencer.[cite:129]
- CC X/Y/Z axis.[cite:129]

### Destinos especialmente relevantes para esta fase

- Pitch/fine y mod depth de osciladores.[cite:129]
- PWM depth y TMOD depth.[cite:129]
- `VCF Freq`, `VCF Res`, `VCF Env`, `VCF LFO`.[cite:129]
- Todos los tiempos y curvas de las tres envolventes.[cite:129]
- `VCA Level`, `VCA EnvDep`, `Pan Spread`, `VCA Pan`.[cite:129]
- `Noise Level`, `HP Freq`, `Uni Detune`, `OSC Drift`, `Param Drift`.[cite:129]
- `Mod 1..8 Depth`.[cite:129]
- `Fx 1..4 Parameters` y `Fx 1..4 Level`.[cite:129]

### Representación recomendada

Modelar cada ruta de modulación como un objeto estable:

- `source`
- `destination`
- `amount`
- `enabled`
- opcionalmente `transform` o `polarity`

Y reservar **8 slots fijos** compatibles con el hardware. Después, si el sinte interno crece, siempre se podría permitir un modo expandido con más rutas, pero la compatibilidad base debería conservar esos 8 buses.[cite:129]

## Librería, edit buffer y gestión de patches

Las fuentes abiertas indican que el DeepMind soporta trabajo práctico con **snapshots del edit buffer vía SysEx** y que herramientas externas pueden gestionarlo como un equipo librarizable.[cite:134][cite:140] Esto sugiere que tu proyecto debería tener desde el principio una capa de presets con tres niveles:

- **Current Edit State**: estado vivo del patch en edición.
- **Stored Patch**: preset serializable y versionable.
- **Hardware Snapshot**: dump recibido/enviado al DeepMind real.

Operaciones recomendadas:

- `pullFromHardware()`.[cite:134]
- `pushToHardware()`.[cite:134]
- `compareWithHardware()`.[cite:129]
- `storeLocalPatch()`.
- `loadLocalPatch()`.
- `exportSysex()` / `importSysex()`.[cite:140]
- `browseBank()` / `writeProgram()` si decides cubrir gestión completa de memoria. [cite:129][cite:140]

## Estados operativos del proyecto

La herramienta debería nacer con al menos estos modos explícitos:

### Modo 1 — Controlador/editor de DeepMind

- No genera audio propio.
- Todo cambio se traduce a MIDI/NRPN/SysEx contra el hardware.[cite:134][cite:142]
- La UI funciona como panel extendido y librarian.[cite:140]

### Modo 2 — Mirror/híbrido

- Controla el hardware y a la vez mantiene un estado interno equivalente.
- Permite futura comparación A/B entre hardware y emulación interna.
- Es el mejor modo para depuración del modelo paramétrico.

### Modo 3 — Sintetizador interno

- Usa el mismo modelo de parámetros.
- No necesita hardware conectado.
- Puede mantener compatibilidad “Deep-like” y a la vez desbloquear extensiones propias.[cite:129]

## Recomendación de implementación

### Fase 1: Especificación y datos

1. Definir un registro maestro de parámetros en formato estructurado (`json`, `yaml`, `csv` o clases C++ generadas). [cite:142]
2. Incluir para cada parámetro: nombre, bloque, tipo, rango, unidad, soporte de transporte y nota de compatibilidad hardware.[cite:129][cite:142]
3. Tomar como referencia pública principal la tabla de `midi.guide` y contrastarla con el manual y herramientas abiertas.[cite:129][cite:134][cite:142]

### Fase 2: Transporte hardware

1. Implementar motor MIDI con soporte CC, NRPN y SysEx.[cite:134][cite:142]
2. Crear abstracción `HardwareDeepmindTransport`.
3. Implementar lectura/escritura de estado, snapshot y compare.[cite:134][cite:140]

### Fase 3: UI/editor

1. Construir panel lógico por bloques: OSC, Poly, VCF, VCA, HPF, Envs, LFO, FX, Mod Matrix, Arp/Seq, Global.[cite:129]
2. Añadir inspección de parámetros, búsqueda y vista experta de NRPN/CC.
3. Añadir biblioteca de presets y comparación local vs hardware.[cite:140]

### Fase 4: Motores internos

1. Implementar primero ADSR, filtros, osciladores y LFO con el mismo modelo de parámetros.[cite:129]
2. Validar comportamiento contra hardware en modo mirror.
3. Añadir después FX y mod matrix interna.

## Estructura de clases sugerida

Una arquitectura razonable en C++/JUCE podría ser esta:

- `ParameterId`
- `ParameterSpec`
- `ParameterValue`
- `PatchState`
- `PatchSerializer`
- `MidiMapping`
- `DeepmindTransport`
- `NrpnCodec`
- `SysexCodec`
- `HardwareSession`
- `PatchLibrary`
- `ModRoute`
- `SynthEngine`
- `HardwareMirrorEngine`

Y a nivel de bloques musicales:

- `OscBlockState`
- `FilterBlockState`
- `EnvelopeBlockState`
- `LfoBlockState`
- `FxRackState`
- `PolyBlockState`
- `ArpSeqState`
- `GlobalState`

La idea es que `PatchState` no dependa del audio ni del MIDI, y que tanto el motor interno como el transporte hardware lean/escriban exactamente ese mismo objeto.

## Riesgos y criterios

### Riesgo 1: mezclar demasiado pronto hardware y DSP

Si la lógica de MIDI/SysEx se incrusta directamente en los módulos de audio, luego será difícil reutilizar la herramienta como editor o emulación. Conviene mantener una separación estricta entre **estado**, **transporte** y **procesamiento**.[cite:134][cite:140]

### Riesgo 2: copiar la tabla MIDI sin semántica musical

La tabla de CC/NRPN es necesaria, pero por sí sola no basta. El modelo debe reflejar conceptos musicales y topológicos: por ejemplo, que el HPF es post-VCA y global, o que hay tres ADSR separadas aunque estructuralmente iguales.[cite:129][cite:142]

### Riesgo 3: modelar extensiones propias demasiado pronto

Para no perder compatibilidad, conviene definir primero el modo **DeepMind-compatible**, y solo después añadir extensiones como doble OSC1, nuevas envolventes o más rutas de modulación. La compatibilidad debe ser una capa estable, no un efecto colateral.[cite:129]

## Conclusión

Sí tiene mucho sentido empezar por la capa de control. Las fuentes abiertas revisadas muestran que el DeepMind 12 ofrece una superficie suficiente de **CC/NRPN/SysEx** como para construir primero un editor/controlador serio y reutilizar después exactamente ese mismo modelo de parámetros para el nuevo sintetizador.[cite:134][cite:140][cite:142]

La estrategia recomendada es esta: **primero modelo de parámetros + transporte hardware + librarian/editor; después motores internos compatibles; por último extensiones creativas propias**. Eso minimiza trabajo duplicado, permite validar decisiones contra el hardware real y convierte el proyecto en una herramienta útil mucho antes de terminar la emulación completa.[cite:129][cite:134][cite:140][cite:142]
