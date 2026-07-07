# DeepMind 12 — Filtros

Fuente principal: manual adjunto `DEEPMIND-12.es.pdf`.[cite:129]

## Resumen

El DeepMind 12 no parece tener una colección de muchos “modelos” de filtro alternativos; más bien tiene una arquitectura concreta compuesta por un **VCF paso bajo resonante por voz** y un **HPF posterior** en la ruta de señal. El paso bajo es seleccionable entre **4 polos y 2 polos**, puede entrar en auto-oscilación y dispone de modulación por envolvente, LFO y keyboard tracking; el pasaalto tiene pendiente fija de **-6 dB/oct** y además añade una función **Bass Boost** separada.[cite:129]

## Qué filtros tiene

### 1. VCF paso bajo

El manual describe el VCF como un **filtro de paso bajo controlado por voltaje** usado para atenuar las frecuencias altas del sonido del sintetizador.[cite:129] En la sección de características se menciona como un filtro analógico Midas resonante seleccionable entre **24 dB/oct y 12 dB/oct**, lo que en la interfaz aparece como el cambio entre **4 polos** y **2 polos**.[cite:129]

Características confirmadas:

- Tipo: paso bajo resonante por voz.[cite:129]
- Pendiente seleccionable: 4 polos / 24 dB por octava, o 2 polos / 12 dB por octava.[cite:129]
- Resonancia ajustable.[cite:129]
- Puede ser llevado a auto-oscilación.[cite:129]
- Profundidad de envolvente conmutable en polaridad normal o invertida.[cite:129]
- Keyboard tracking variable.[cite:129]
- Modulación por LFO seleccionable.[cite:129]

### 2. HPF pasaalto

El manual también describe un **filtro de paso alto** situado después del VCA, por lo que afecta a la suma de todas las voces y no a cada voz individual por separado.[cite:129] Su pendiente es fija de **-6 dB por octava**, con frecuencia ajustable entre **20 Hz y 2000 Hz**.[cite:129]

Características confirmadas:

- Tipo: paso alto.[cite:129]
- Ubicación: después del VCA, afecta al conjunto de voces.[cite:129]
- Pendiente: fija de -6 dB/oct.[cite:129]
- Rango de frecuencia: 20 Hz a 2000 Hz.[cite:129]
- Puede usarse también como destino de mod matrix (`HP Freq`).[cite:129]

### 3. Bass Boost

Además del HPF, el DeepMind tiene un interruptor **BOOST** que no es otro filtro distinto sino una etapa analógica adicional para reforzar las bajas frecuencias alrededor de **100 Hz** mediante una ecualización shelving y función de bloqueo DC.[cite:129] El manual lo presenta como un refuerzo de **6 dB** orientado a dar más cuerpo y profundidad al programa.[cite:129]

## Parámetros del VCF

En panel y menús aparecen estos parámetros asociados al filtro principal:

| Parámetro | Función |
|---|---|
| `Frequency` | Frecuencia de corte del VCF.[cite:129] |
| `2-Pole` | Cambia de 4 polos a 2 polos.[cite:129] |
| `Res` | Resonancia del punto de corte.[cite:129] |
| `Env` | Profundidad de la envolvente aplicada al filtro.[cite:129] |
| `Invert` | Invierte la polaridad de la envolvente del filtro.[cite:129] |
| `LFO` | Profundidad de modulación por LFO sobre el cutoff.[cite:129] |
| `KYBD` | Seguimiento de teclado aplicado al cutoff.[cite:129] |

El manual aclara además que la profundidad `VCF ENV` puede quedar limitada por la posición del cutoff: si el filtro ya está completamente abierto, una modulación positiva adicional no podrá abrirlo más; y lo mismo ocurre con modulación negativa cuando la polaridad está invertida.[cite:129]

## Qué emula o a qué se parece

El manual no habla de varios modelos conmutables tipo ladder, SEM, state-variable o comb. Lo que presenta es una **ruta analógica concreta basada en un VCF Midas** y un HPF separado, sin sugerir una biblioteca de emulaciones de filtro intercambiables.[cite:129]

Por tanto, si estás diseñando una reinterpretación, la lectura más fiel sería esta:

- **Un único carácter principal de LPF**, conmutando solo su pendiente 12/24 dB.[cite:129]
- **Un único HPF complementario** con pendiente fija y posición posterior en la cadena.[cite:129]
- **Bass Boost** como coloración adicional, no como un tercer filtro propiamente dicho.[cite:129]

## Conclusión práctica para tu sinte

A nivel de desarrollo, no parece necesario crear “muchos tipos” de filtros para acercarte al DeepMind. Con una arquitectura que tenga:

- 1 LPF resonante por voz con modo 12/24 dB,[cite:129]
- 1 HPF global/post-VCA de 6 dB/oct,[cite:129]
- modulación por envelope, LFO y keyboard tracking,[cite:129]
- y un refuerzo de graves tipo shelving opcional,[cite:129]

ya cubrirías lo esencial de su filosofía de filtrado. La parte crítica no es el número de modelos, sino **la topología de colocación y sus parámetros de control**.[cite:129]
