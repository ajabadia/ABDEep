# El banco de mutaciones de DspEffects

Informe del 1 de octubre de 2026 sobre la corrida completa del banco de
mutaciones del módulo compartido (`ABDSharedCode`), que es el que vigila que los
comentarios del motor sean verdad.

## Qué es esto

Un banco de mutaciones no es una frase: es una herramienta. Cada fila del
catálogo es **un defecto real que se reintroduce a propósito en el motor**, se
recompila, se corre la suite, y se mira una sola cosa: ¿se ha puesto roja por la
comprobación que dice cazar, o ha seguido verde? Un banco que solo compila y
cuenta comprobaciones no dice nada. Uno que pone rojo, dice *qué* no se puede
tocar.

La herramienta es `ABDSharedCode/tools/ds_effects_mutation_bank.py`. Modos que
importan: `--list` (el catálogo y su anclaje), `--rapido` (los dos arreglos de
guardia), `--autocomprobacion` (el banco probándose a sí mismo con salidas de
mentira), `--only N` (una mutación), `--arreglo` (volver a verde).

Tres reglas que el banco se aplica a sí mismo:

- **El código de salida pesa más que el `[OK]` impreso.** Un test que suelta
  `[OK]` y sale con 1 es rojo. Sin esto, un banco roto se lee como verde.
- **El rojo tiene que ser el que toca.** Cada mutación declara el texto que su
  comprobación debe imprimir (`debe morder`). Si la suite se pone roja por otra
  cosa, la mutación se marca `NO_DETECTADA` aunque «funcionara»: no sirve de nada
  romper cualquier cosa.
- **Anclas explícitas.** Antes de mutar, el banco comprueba que el texto que va a
  buscar está en el fichero. Si no está (`ANCLA_AUSENTE`), se para. Un parche
  que aplica sobre un fichero al que ya no corresponde es peor que no tener
  banco.

## La corrida completa

`--rapido`, sobre el repo original: 12 arreglos, 13 mutaciones, los dos `[OK]`.

Después, la corrida completa, una mutación por vez, con reconstrucción entre
medias:

```
13 de 13 mutaciones detectadas, por el motivo que toca
exit=0
```

## Las trece, una a una

| # | Arreglo | Qué reintroduce | Por qué importa | Muerde |
|---|---|---|---|---|
| 1 | `etapa-sin-vtable` | vtable a `EffectPolicy.h` | Ocho bytes y una tabla de funciones por etapa a cambio de nada | **sí** (119 s) |
| 2 | `schroeder-decay-techo` | el decay sin techo | Con `decay` > 1.111 la realimentación pasa de 1 y la cola crece sin límite. Es el defecto original | **sí** (87 s) |
| 3 | `schroeder-decay-techo` | `jlimit(0,1)` en vez de `jmin(…,1.0f)` | El «arreglo» que parecía bueno: con knobs en rango no cambia ni un bit, pero el negativo deja de ser la variante con significado propio y la realimentación se cae de 0.3 a 0 | **sí** (88 s) |
| 4 | `schroeder-damping-recorte` | la amortiguación sin `jlimit` | Con `damping = 2.0` el pasabajos `damp1 = 2, damp2 = -1` tiene el polo en −1 y crece: pico de 1.0e+30 en un segundo | **sí** (89 s) |
| 5 | `schroeder-difusion-recorte` | la difusión sin `jlimit` | La misma clase de fallo en el otro extremo: con `diffusion = 2.0` la cola llega a 3.0e+28 | **sí** (123 s) |
| 6 | `schroeder-damping-cero` | `damp2 = 1 - damping` sin vigilar | Con `damping` en 0 **exacto** el estado es `estado = estado`: la cola no decae y se queda en un offset de DC | **sí** (91 s) |
| 7 | `diodo-umbral-recorte` | el umbral del puente de diodos fuera de rango | El `jlimit` que ya estaba en las otras dos lecturas del mismo fichero, al hueco que se le escapaba. Con 1.5 el puente se volvía transparente y **amplificaba** el tramo | **sí** (72 s) |
| 8 | `repisa-techo-045fs` | techo de 0,2 × sample rate | El límite «prudente» que **movía las frecuencias del propio MS2000 a 32 kHz**: las repisas de 8 y 12 kHz sonaban en otro sitio. 12000/32000 = 0,375, así que cualquier límite por debajo cambia el sonido de un producto ya publicado | **sí** (73 s) |
| 9 | `repisa-banda-muerta` | se come la banda muerta de 0,05 dB | Un movimiento de ganancia dentro de la banda muerta no recalcula | **sí** (68 s) |
| 10 | `cascada-indice-recortado` | sin recorte de índices | Un índice por encima lee fuera de la tabla. Que el recorte sea de la máquina y no del MS2000 es justo lo que la hace servir para otro producto: un perfil de ocho no se protege solo | **sí** (43 s) |
| 11 | `cascada-ganancia-independiente` | la ganancia se lleva por delante la frecuencia | El fallo típico de un puerto de este tipo: escribir `setFrequencyHz` donde iba `setGainDB`. Con knobs en 0 dB no se oye nada, por eso cuela | **sí** (31 s) |
| 12 | `cascada-puerta-vuelve` | puerta de hercios continuos de ida | En cuanto un producto escribía un hercio a mano, su tabla de selector quedaba muerta para siempre, y el propio comentario del código decía lo contrario. **Es la mutación que cazó un defecto en la primera corrida**, y por eso existe | **sí** (34 s) |
| 13 | `cascada-puerta-independiente` | una sola bandera para las dos repisas | Defecto intermitente, que es lo que lo hacía peligroso: solo se manifestaba cuando el índice de la alta casualmente no era el que ya estaba, porque la guarda de «no ha cambiado» cortaba antes | **sí** (28 s) |

**Ninguna muerde a medias.** No hay filas huérfanas (un arreglo vigilado por
mutaciones que nunca se disparan) ni filas que muerden por el motivo equivocado.
Las 13 se detectaron por su propio texto, y las 9 que quedan después de quitar
los recortes también.

## Las cifras reales

- `941` comprobaciones en el repo original, **no 905**. El 905 era el número del
  commit `9a9090c`, y el repo ya tenía más tests que ese commit.
- `1746` con el test del barrido sin recorte (ver abajo): +805.
- Tiempos en Debug: base limpia ≈ 7 min; una mutación que muerde ≈ 30–120 s (el
  test aborta antes de terminar la suite). El rango es el motivo por el que la
  corrida entera son 25–35 min y hay que lanzarla en segundo plano.

## Los tres recortes del barrido se van

Lo que la corrida dejó ver es que **las tres mutaciones 2, 4 y 5 pierden a qué
morder** cuando el recorte se elimina: su anclaje era el propio `jlimit` del
motor.

La demostración de que el recorte nunca se tomaba está en
`DspEffects/profiles/ReverbProfile.h`: los diez perfiles usan decay entre −0.30
y 0.85, damping entre 0.20 y 0.90, diffusion entre 0.20 y 0.90. Con el mando en
0..1, un `jlimit(0,1)` es la función identidad sobre todo lo que un producto
pasa de verdad. El comentario del propio `setDecay` ya lo decía («no se toma
nunca») mientras el `if` seguía ahí.

Lo que se hace, entonces, es cambiar el motivo: en vez de esconder el valor
dentro del rango, **dejarlo pasar y que el test lo mire**.

- Los tres setters asignan directo (`decay_ = decay;` …), con el porqué reescrito
  al revés y con las cifras de la cola disparada medidas.
- Se añaden tres getters inline (`getDecay()`, `getDamping()`, `getDiffusion()`).
  Sin una puerta de lectura, «entra sin recortar» es incomprobable: no hay forma
  de distinguir un recorte de un valor guardado.
- El test pasa de `testSchroederKnobsAreClamped` a **`testMandosDelBarridoSinRecorte`**,
  con el signo invertido y cinco bloques: barrido 0..1 en 257 pasos × 3 mandos;
  los diez perfiles copiados a mano (para que cambiar la tabla de perfiles
  rompa el test); **valores fuera de rango** (decay 1.5/2.0/9.0/−0.7/−3.0,
  damping 1.4/2.0/−0.3, diffusion 1.4/2.0/−0.3) — lo que se pone rojo si alguien
  reintroduce el recorte; estabilidad en rango y decay negativo estable; y que el
  decay negativo siga siendo su propia variante (`feedback = decay < 0 ? 0.3f :
  decay * 0.9f`).

Resultado: **1746 comprobaciones, 0 fallos**. El catálogo baja a **9 arreglos, 9
mutaciones**.

Y la segunda corrida confirma que quitar los recortes **no ha vuelto sordo nada**:

```
9 de 9 mutaciones detectadas, por el motivo que toca
exit=0
```

Las nueve que quedan son las de `EffectPolicy.h`, `DiodeBridge.h`, `ShelfFilter.h`
y `CascadeShelfEq.h` más `schroeder-damping-cero`, y todas siguen mordiendo por su
propio texto. El tiempo por mutación bajó de 87–123 s a 32–102 s, que es el
efecto secundario de que la suite ya no se para antes: con los recortes fuera, el
test del barrido llega mucho más lejos antes de que otra cosa lo tumbe.

**`schroeder-damping-cero` se conserva** y no es una excepción: su anclaje es el
pasabajos (`damp1 = damping`), que sigue en el motor. Solo se van los tres
recortes y sus tres mutaciones.

## Cómo se corrió

El workspace de esta sesión es `ABDEep`, y `ABDSharedCode` está **fuera** de
él. El cambio del barrido y su verificación se hicieron sobre una copia del
módulo en `build/reverbfix/`, con un `CMakeLists.txt` mínimo que solo construye
`ABDShared_DspEffects_Tests` (apaga `AUTOUPDATER`, `SYNTHCORE_TESTS`,
`DSPCORE_TESTS`, `HARDWAREDRIVERS`; deja `DSPEFFECTS_TESTS`).

```bash
# configurar
MSYS2_ARG_CONV_EXCL="*" cmake -S . -B build -G "Visual Studio 18 2026" -A x64
# catálogo completo
python tools/ds_effects_mutation_bank.py --list
# las dos de guardia, o una sola
python tools/ds_effects_mutation_bank.py --rapido
python tools/ds_effects_mutation_bank.py --only 4
```

**El banco tarda 25–35 min.** Hay que lanzarlo en segundo plano y esperarlo:

```powershell
Start-Process python -ArgumentList 'tools/ds_effects_mutation_bank.py' `
  -RedirectStandardOutput banco.log -WindowStyle Hidden
```

## Lo que esto NO arregla

- **El cambio del barrido solo existe en la copia de `build/reverbfix/`.** Para
  que llegue al repo hace falta una sesión con `D:\desarrollos\ABDSynths\ABDSharedCode`
  como raíz. Verificado, pero no aplicado.
- **No hay CI que lo corra.** `ABDSharedCode` no tiene workflow de C++; un banco
  que solo se ejecuta a mano es un banco que se olvida. Correrlo en el pipeline,
  aunque sea en modo `--rapido`, es lo que convierte esto en una puerta y no en
  un informe.
- **El banco vigila lo que alguien escribió.** No vigila lo que nadie ha
  escrito: si mañana alguien añade un recorte nuevo a un setter que hoy no lo
  tiene, el banco no lo verá hasta que alguien escriba la mutación.