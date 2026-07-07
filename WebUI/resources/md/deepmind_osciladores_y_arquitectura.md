# DeepMind 12 — Osciladores y arquitectura base

Fuente principal: manual adjunto `DEEPMIND-12.es.pdf`.[cite:129]

## Resumen

El DeepMind 12 tiene 12 voces independientes y **dos osciladores discretos por voz**.[cite:129] No son dos osciladores idénticos: OSC1 y OSC2 tienen funciones y controles distintos, lo que hace razonable tratarlos como dos tipos de oscilador diferentes en una reinterpretación.[cite:129]

## Estructura general de voz

- 12 voces independientes.[cite:129]
- 2 osciladores por voz.[cite:129]
- 2 LFO por voz.[cite:129]
- 3 envolventes ADSR por voz: VCF, VCA y MOD.[cite:129]
- VCF paso bajo resonante conmutables 2 polos / 4 polos.[cite:129]
- HPF global/compartido en la ruta de señal.[cite:129]
- VCA estéreo por voz con control de panorama.[cite:129]

## OSC1

Según el manual, OSC1 genera simultáneamente **diente de sierra** y **onda cuadrada/pulso**, y dispone de modulación de ancho de pulso (PWM). El panel también expone conmutadores dedicados para activar/desactivar la sierra y la cuadrada, y un control de PWM para OSC1.[cite:129]

Funciones asociadas a OSC1 descritas en el manual:

- Saw on/off.[cite:129]
- Square/Pulse on/off.[cite:129]
- PWM depth/manual amount.[cite:129]
- Pitch modulation amount compartido en la sección OSC 1/2 Pitch Mod.[cite:129]
- Selección de rango/octava del oscilador dentro de las opciones globales del bloque de osciladores.[cite:129]

## OSC2

OSC2 no replica la arquitectura de OSC1. El manual lo describe como un oscilador de **onda cuadrada** con **Tone Mod**, además de control propio de pitch y nivel.[cite:129]

Funciones asociadas a OSC2 descritas en el manual:

- Onda cuadrada como forma base.[cite:129]
- Tone Mod para alterar la forma/timbre de OSC2.[cite:129]
- Pitch de OSC2.[cite:129]
- Level de OSC2.[cite:129]
- Pitch modulation amount compartido en la sección OSC 1/2 Pitch Mod.[cite:129]
- Desplazamiento variable de OSC2 de hasta ±1 octava para enriquecer el tono.[cite:129]

## Diferencias funcionales entre OSC1 y OSC2

| Aspecto | OSC1 | OSC2 |
|---|---|---|
| Formas de onda principales | Sierra + cuadrada/pulso simultáneas [cite:129] | Cuadrada [cite:129] |
| Modulación característica | PWM [cite:129] | Tone Mod [cite:129] |
| Conmutadores de forma en panel | Sí, sierra y cuadrada [cite:129] | No aparecen equivalentes de sierra; se controla pitch y nivel [cite:129] |
| Nivel dedicado en panel | No destacado en el mismo modo que OSC2 [cite:129] | Sí, OSC2 Level [cite:129] |
| Papel típico | Oscilador principal rico en armónicos [cite:129] | Segundo oscilador para refuerzo, sync y color tímbrico [cite:129] |

## Sync, drift y ruido

El manual confirma una opción de **hard sync** en la que OSC2 se sincroniza con OSC1 o puede liberarse de esa sincronización.[cite:129] También hay un parámetro de **OSC drift** para introducir inestabilidad controlable de afinación, y un generador de **ruido blanco** con nivel dedicado.[cite:129]

## Implicaciones para una reinterpretación

Una reinterpretación coherente puede separar el concepto de **tipo de oscilador** del concepto de **slot de oscilador**. Es decir, definir dos modelos, por ejemplo `DeepOsc1` y `DeepOsc2`, pero permitir que el usuario los asigne libremente a Slot A y Slot B, dejando como configuración por defecto la del DeepMind original: Slot A = tipo OSC1 y Slot B = tipo OSC2.[cite:129]

Esto permitiría tres modos especialmente útiles:

- Compatibilidad conceptual con DeepMind: `OSC1 + OSC2`.[cite:129]
- Expansión tímbrica: `OSC1 + OSC1`.[cite:129]
- Variante experimental: `OSC2 + OSC2`.[cite:129]

## Recomendación de modelado

Para no perder la identidad original y a la vez expandir el instrumento, conviene distinguir entre:

- **Preset default DeepMind-like**: reproduce la asimetría real entre ambos osciladores.[cite:129]
- **Modo expandido**: permite cualquier combinación de tipos de oscilador.[cite:129]
- **Capa de compatibilidad de parámetros**: conserva nombres y comportamiento de PWM, Tone Mod, sync, drift y niveles para poder reconstruir patches inspirados en el manual.[cite:129]
