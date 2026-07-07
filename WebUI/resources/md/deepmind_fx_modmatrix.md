# DeepMind 12 — Efectos, routing y mod matrix

Fuente principal: manual adjunto `DEEPMIND-12.es.pdf`.[cite:129]

## Resumen

El DeepMind 12 incorpora una sección DSP claramente separada de la ruta analógica principal. El manual indica **35 efectos de calidad de estudio**, **4 efectos por programa**, **true bypass**, **tap tempo** y **10 configuraciones de routing**, incluidas rutas con retroalimentación.[cite:129]

## Qué define la sección de efectos

Características descritas en el manual:

- 35 efectos encadenables.[cite:129]
- 4 efectos simultáneos por programa.[cite:129]
- True bypass del bloque DSP.[cite:129]
- Tap tempo.[cite:129]
- 10 configuraciones de efectos, incluyendo rutas con feedback.[cite:129]
- Muchos parámetros de FX disponibles como destinos de la matriz de modulación.[cite:129]

## Lista de efectos mencionados en el manual

El PDF enumera explícitamente estos algoritmos o familias:

- TC-DeepVRB.[cite:129]
- Ambiente / Ambience.[cite:129]
- Habitaciones / Room Reverb.[cite:129]
- Vintage Room.[cite:129]
- Hall Reverb.[cite:129]
- Chamber Reverb.[cite:129]
- Plate Reverb.[cite:129]
- Rich Plate.[cite:129]
- Gated Reverb.[cite:129]
- Reverse Reverb.[cite:129]
- ChorusVerb.[cite:129]
- DelayVerb.[cite:129]
- FlangeVerb.[cite:129]
- 4Band EQ.[cite:129]
- Enhancer.[cite:129]
- FairComp.[cite:129]
- MultiBand Distortion.[cite:129]
- RackAmp.[cite:129]
- Edison EX1.[cite:129]
- Auto-Pan.[cite:129]
- Noise Gate.[cite:129]
- Delay.[cite:129]
- 3TapDelay.[cite:129]
- 4TapDelay.[cite:129]
- T-RayDelay.[cite:129]
- ModDlyRev.[cite:129]
- Chorus.[cite:129]
- Chorus-D / Dimensional Chorus.[cite:129]
- Flanger.[cite:129]
- Phaser.[cite:129]
- MoodFilter.[cite:129]
- Dual Pitch.[cite:129]
- Vintage Pitch.[cite:129]
- Rotary Speaker.[cite:129]

## Lectura arquitectónica

La sección de señal del manual muestra que la ruta de voz es analógica hasta llegar al bloque de FX, y que el trayecto digital puede ser anulado. Esto significa que el diseño del DeepMind no trata los efectos como un simple añadido fijo al final, sino como un bloque con **modos de inserción/envío y bypass de ruta**.[cite:129]

Por eso, una emulación conceptual no debería limitarse a una cadena rígida `fx1 -> fx2 -> fx3 -> fx4`. El rasgo más importante es disponer de un **rack de 4 slots** y de un pequeño conjunto de **templates de routing** seleccionables por programa.[cite:129]

## Lo mínimo que debería replicarse

Si el objetivo es acercarse al concepto DeepMind, estas funciones parecen esenciales:

- 4 slots FX por patch.[cite:129]
- Routing seleccionable por patch.[cite:129]
- True bypass del rack digital.[cite:129]
- Niveles por slot FX.[cite:129]
- Parámetros de cada slot expuestos a automatización/modulación.[cite:129]

## Mod matrix

El manual indica una **matriz de modulación de 8 buses**, con **24 fuentes** y **132 destinos**.[cite:129] Entre las fuentes aparecen Pitch Bend, Mod Wheel, pedal, aftertouch, expression, LFO1, LFO2, envolventes, número de nota, velocidad, secuenciador de control y ejes CC X/Y/Z, entre otras.[cite:129]

Lo más importante para tu línea de trabajo es que entre los destinos figuran explícitamente:

- `Fx 1 Parameters`.[cite:129]
- `Fx 2 Parameters`.[cite:129]
- `Fx 3 Parameters`.[cite:129]
- `Fx 4 Parameters`.[cite:129]
- `Fx 1 Level`.[cite:129]
- `Fx 2 Level`.[cite:129]
- `Fx 3 Level`.[cite:129]
- `Fx 4 Level`.[cite:129]

## Implicaciones de diseño

El DeepMind no solo añade efectos: **integra el rack de efectos dentro del sistema de modulación**. Por tanto, para una reinterpretación moderna, conviene diseñar el sistema de FX desde el principio como un conjunto de objetos modulables, aunque inicialmente no se activen todas las rutas o destinos.[cite:129]

Una arquitectura razonable sería:

- `FxRack` con 4 slots.[cite:129]
- `FxAlgorithm` por slot.[cite:129]
- `FxRoutingMode` como enum o plantilla de grafo.[cite:129]
- `FxParameterBinding` para enlazar mod matrix con parámetros y niveles.[cite:129]
- `TrueBypassState` para mantener la posibilidad de saltar totalmente el rack DSP.[cite:129]

## Carencias a recordar en una implementación básica

Si se parte de un sinte más simple, normalmente faltarán varias cosas respecto al DeepMind:

- Múltiples efectos simultáneos por patch.[cite:129]
- Más de un routing fijo.[cite:129]
- Feedback routing entre slots.[cite:129]
- Bypass real del bloque digital.[cite:129]
- Modulación directa de parámetros FX desde la matriz.[cite:129]
- Efectos utilitarios además de los clásicos: compresor, enhancer, gate, EQ, pitch, rotary.[cite:129]

## Prioridad sugerida

Orden de implementación razonable para acercarse al resultado sin rehacerlo todo:

1. Crear el rack de 4 slots y el sistema de routing.[cite:129]
2. Implementar primero chorus, delay, reverb, phaser y flanger.[cite:129]
3. Añadir bypass global y niveles por slot.[cite:129]
4. Exponer parámetros y niveles a la mod matrix.[cite:129]
5. Ampliar después con EQ, compresión, distorsión, gate, rotary y pitch FX.[cite:129]
