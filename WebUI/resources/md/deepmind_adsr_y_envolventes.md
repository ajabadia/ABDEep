# DeepMind 12 — ADSR y envolventes

Fuente principal: manual adjunto `DEEPMIND-12.es.pdf`.[cite:129]

## Resumen

El DeepMind 12 usa **tres generadores de envolvente por voz**: uno para VCA, uno para VCF y uno auxiliar de modulación. Los tres son envolventes de **4 etapas ADSR**; no se describen como envolventes DAHDSR o multietapa en el sentido clásico, pero sí añaden bastante flexibilidad mediante **modos de disparo alternativos** y, sobre todo, **curvas ajustables por etapa**.[cite:129]

## Cuántas envolventes tiene

El manual confirma tres envolventes dedicadas por voz:

- `VCA Envelope`.[cite:129]
- `VCF Envelope`.[cite:129]
- `MOD Envelope`.[cite:129]

Esto significa que, conceptualmente, no necesitas una única ADSR reutilizada tres veces sin más: el DeepMind funciona como si tuviera **tres instancias separadas** de un mismo tipo de generador, cada una destinada a un papel diferente.[cite:129]

## Número de fases

Cada envolvente tiene **4 fases**:

- Attack.[cite:129]
- Decay.[cite:129]
- Sustain.[cite:129]
- Release.[cite:129]

El propio manual remarca que las fases de Attack, Decay y Release se miden en unidades de tiempo, mientras que Sustain se mide como nivel.[cite:129]

## ¿Tiene más fases, delay o hold?

Según lo que aparece en el manual, **no se menciona una fase de Delay ni de Hold** dentro del generador de envolvente como tal.[cite:129] Tampoco se presenta como una envolvente multietapa más compleja que ADSR.[cite:129]

Lo que sí añade complejidad no es una fase extra, sino el **modo de disparo** y la **forma de cada etapa**. Por eso, para una reinterpretación cercana al DeepMind, no parece necesario desarrollar un generador DADSR o DAHDSR para ser fiel al original.[cite:129]

## Modos de disparo

Cada una de las tres envolventes puede dispararse en varios modos:

- `Key`: se activa al pulsar tecla.[cite:129]
- `LFO-1`: se dispara al inicio de cada ciclo de LFO1.[cite:129]
- `LFO-2`: se dispara al inicio de cada ciclo de LFO2.[cite:129]
- `Loop`: se redispara al llegar al final de la etapa Release.[cite:129]
- `Seq` / secuenciador de control: se redispara en cada paso del control sequencer.[cite:129]

Esto es importante porque añade bastante vida al sistema sin cambiar el número de fases. En otras palabras, la sofisticación del DeepMind está más en **cómo se dispara y cómo se curva** la envolvente que en añadir más segmentos.[cite:129]

## Curvas por etapa

Aquí está una de las claves del diseño. El manual indica que las envolventes permiten cambiar la curva de cada una de sus etapas mediante el modo **CURVES**.[cite:129]

Parámetros de curva disponibles por envolvente:

- `Attack Curve`.[cite:129]
- `Decay Curve`.[cite:129]
- `Sustain Curve/Slope`.[cite:129]
- `Release Curve`.[cite:129]

Además, el manual indica que estas curvas pueden transformarse entre comportamientos **lineales, exponenciales y exponenciales invertidos**, lo que hace que una ADSR aparentemente simple sea bastante más flexible en la práctica.[cite:129]

## Qué se puede asignar desde la mod matrix

La mod matrix no solo puede usar las envolventes como fuentes, sino también modular muchos de sus parámetros.[cite:129] Entre los destinos aparecen:

- `All Attack`, `All Decay`, `All Sustain`, `All Release`.[cite:129]
- `Env1/2/3 Rates`.[cite:129]
- `Env1/2/3 Curves`.[cite:129]
- Attack, Decay, Sustain, Release individuales para cada una de las tres envolventes.[cite:129]
- Curvas individuales de ataque, decay, sustain y release para cada envolvente.[cite:129]

Esto confirma que el motor de envolventes del DeepMind está muy integrado en la modulación general, aunque estructuralmente siga siendo ADSR de 4 fases.[cite:129]

## Implicación práctica para tu desarrollo

Si tu objetivo es acercarte al DeepMind sin sobrediseñar, lo razonable sería empezar con **un único tipo de generador ADSR** y crear **tres instancias** por voz:[cite:129]

- ADSR para amplitud (VCA).[cite:129]
- ADSR para filtro (VCF).[cite:129]
- ADSR auxiliar (MOD).[cite:129]

Ese generador debería incluir, idealmente desde el principio:

- modos de trigger alternativos (`Key`, `LFO1`, `LFO2`, `Loop`, `Seq`), [cite:129]
- control de curva independiente por etapa, [cite:129]
- y exposición de sus parámetros a la mod matrix. [cite:129]

## Conclusión práctica

Para ser fiel al DeepMind, **no parece necesario crear varios tipos distintos de ADSR** ni envolventes con más fases como requisito inicial. Te serviría con **un solo motor ADSR bien hecho**, instanciado tres veces por voz, siempre que soporte curvas por etapa y modos de disparo ampliados.[cite:129]

Si en el futuro quieres expandir tu reinterpretación, añadir Delay/Hold o envolventes multisegmento tendría sentido como mejora creativa propia, pero no como requisito para reproducir la arquitectura base del DeepMind.[cite:129]
