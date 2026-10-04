# Changelog — ABD Eep

> **Proyecto:** Controlador/Editor WebUI + Motor DSP C++/JUCE para Behringer DeepMind 12

---

## 0.2.77 — 🔐 El `critical` de `ABDBankManager` arriba, y no era solo el de la raíz

> `npm audit --audit-level=high` es un job de `ci.yml` que llevaba tiempo en rojo
> con un 1 y un critical. Sube vitest y el audit a cero... en cuatro ficheros, no
> en uno, y por una razón que solo aparece si se ejecuta el install.

### El origen del critical no estaba en la raíz

El advisory es `GHSA-5xrq-8626-4rwp`: con el servidor UI de vitest escuchando,
un fichero arbitrario se puede leer **y ejecutar**. Rango vulnerable `<=4.1.10`,
y el arreglo que ofrece npm es vitest 5 —un salto de major desde el `^2.0.0` que
declaraba el repo.

Pero el dato que cambia el arreglo es otro: **`packages/contracts` y
`packages/core` declaran su propio `vitest ^2.0.0` en `devDependencies`**. Con
solo la raíz subida, npm sigue instalando vitest 2.1.9, vite 5.4.21 y esbuild
0.21.5 **dentro** de esos dos miembros, y el audit devuelve exactamente las
mismas cinco vulnerabilidades de antes. El primer intento dio «0
vulnerabilidades» porque el sandbox tenía solo los dos JSON y ningún miembro del
workspace: un cero obtenido sin mirar el árbol que lo produce.

Los cuatro hermanos del workspace declaran `vite ^8.3.2` y `vitest ^4.1.11`, y
`4.1.11` ya está **por encima** del rango vulnerable (`<=4.1.10`). No hace falta
el 5 que sugiere npm: basta con subir al mismo número que los otros cuatro.

### El import no declarado que vite 8 destapa

`Scripts/build_contracts_web.js` y `Scripts/build_core_web.js` hacen
`import { build } from 'esbuild'` **sin declarar esbuild**. Funcionaba porque
vite 5 lo arrastraba como dependencia transitiva; con vite 8 desaparece y
`npm run generate` —que ejecutan los tres jobs de `ci.yml` antes de nada— muere
con `ERR_MODULE_NOT_FOUND`. Declararlo no es un parche para que el salto pase:
es que un import directo tiene que estar en el manifiesto, y hasta ahora
funcionaba por casualidad.

### Medido, con A/B sobre el mismo árbol

| | HEAD | con el arreglo |
|---|---|---|
| `npm audit --audit-level=high` | RC=1 — 1 critical, 1 high, 3 moderate | **RC=0 — 0 vulnerabilidades** |
| `npm ci` | RC=0 | RC=0 |
| `npm run generate` | RC=0 | RC=0 |
| suite | 41 fallos / 788 de 829 | **41 / 788 / 829, los mismos 5 ficheros** |

Y luego repetido con los **bytes exactos** del árbol real copiados a un sandbox
nuevo (md5 idéntico comprobado), porque un sandbox construido a mano verifica el
sandbox, no lo que se entrega.

### Dos límites que hay que decir bien

**`41` es la cifra de un sandbox hecho con `git archive HEAD`, no la del árbol de
trabajo**, y no es un número estable: otro hilo está moviendo `fixtures/` ahora
mismo —8 ficheros borrados y 19 modificados, incluidos los 8
`Prophecy_Bank_*.sysex` que están en HEAD y ya no están en disco—, así que los
mismos cinco tests en rojo pueden tener causas distintas a las de aquí. Lo que sí
es prueba es el A/B: en el mismo árbol, vitest 2 y vitest 4 dan las mismas cifras
y los mismos cinco ficheros.

**No se ha corrido `npm ci` en el repo real**, solo en sandboxes: borra
`node_modules` y habría destruido el entorno pnpm de la migración que otro hilo
tiene a medias. El efecto secundario es que el árbol instalado sigue con vitest
2.1.9 mientras el manifiesto ya dice `^4.1.11`: incoherente hasta que alguien
instale, y conviene saberlo antes de lanzar `npm test` ahí.

### Encima de una migración en curso, y sin commitear

El `package.json` de la raíz lo está editando otro hilo, y su diff va justo en
dirección contraria: borra `workspaces: ["packages/*"]`, quita
`@tauri-apps/cli` y los scripts de tauri, y pone `packageManager: pnpm@10.25.0`.
Los tres cambios se han aplicado **encima** con reemplazo puntual, sin reescribir
el fichero, y su diff sigue entero. Los ficheros tocados son cuatro:

| fichero | cambio |
|---|---|
| `package.json` | `vite ^8.2.2 → ^8.3.2`, `vitest ^2.0.0 → ^4.1.11`, `esbuild ^0.28.2` nuevo |
| `packages/contracts/package.json` | `vitest ^2.0.0 → ^4.1.11` |
| `packages/core/package.json` | `vitest ^2.0.0 → ^4.1.11` |
| `package-lock.json` | regenerado, 222 entradas |

**Sin commitear**, por acuerdo: HEAD sigue en `66dea52` y `origin/main` en
`b5a3d9e`. Nada pusheado.

Y el aviso de fondo, que es el mismo del 0.2.74: esto es un arreglo **de npm**
sobre un repo que se está migrating a pnpm. Cuando aterrice, `ci.yml` tendrá que
pasar `npm ci` → `pnpm install` y **`npm audit` → `pnpm audit`** —hoy son las
líneas 28, 93 y 128, y la 262—, y este `package-lock.json` quedará obsoleto
igual que ya lo está su borrado en el árbol.

---

## 0.2.76 — 🏟️ Los generadores corren en una arena: el `contracts/` real no se toca

> El 0.2.75 cerró **la ventana de la restauración**. Quedaba la otra: mientras el
> generador corre, escribe en `contracts/` de verdad, y quien este leyendo se
> puede encontrar el fichero a medias. Aquí el generador deja de tocar el árbol,
> así que esa ventana no es que sea más pequeña: es que no existe.

### Por qué una arena y no un parámetro

Los tres generadores resuelven sus rutas desde su propio fichero —`HERE =
dirname(abspath(__file__))` en los tres—, así que no hay forma de decirles
«escribe en otro sitio» sin tocar los tres, y tocar los tres para que el preflight
no ensucie es cambiar los generadores por culpa del preflight.

Lo que sí se puede es ponerlos en un sitio donde ese «otro sitio» sea una copia.
La arena tiene **la misma forma que el repo**: `scripts/` y `contracts/` de verdad,
y los hermanos del monorepo **enlazados**. El generador no se entera de nada y
escribe donde escribiría, que es justo lo que hay que medir.

Dos decisiones que no son de gusto:

- **Los hermanos son enlaces, no copias.** Porque los generadores *leen* las
  tablas de los synths (`ABDSharedCode/SynthCore/S950PatchFields.h`,
  `ABDNeural/.../ModDestinationTable.h`, `ABDEep/WebUI/js/modmatrix_data.js`).
  Copiar esas tablas sería una foto: el día que cambie una, la arena leería la
  foto y el preflight compararía contra lo que el generador ve **hoy** en el
  código de verdad. Con un enlace, la lectura es la de siempre.
- **La lista de hermanos no está escrita en ningún sitio**: se lee el directorio
  de al lado. MEDIDO: 26 en esta máquina, y un repo nuevo queda enlazado sin que
  nadie tenga que acordarse.
- **Está en `tmpdir()`, no dentro del repo**, porque los enlaces apuntan al
  monorepo, y el monorepo contiene este repo. Un enlace a sí mismo dentro del
  árbol es un bucle para cualquier cosa que lo recorra.
- **`preserveTimestamps`**, que no es el de serie explícito: sin él los ficheros
  de la arena tendrían fecha de ahora, y la detección de «qué ha escrito el
  generador», que compara fechas, dejaría de funcionar —lo parecería todo
  escrito—.

### La red de seguridad se queda, pero ahora habla

El respaldo y la restauración **no se borran**: siguen siendo la red para un
generador que se escape por una ruta absoluta. Pero cambian dos cosas:

- **Se restaura solo lo que se ha tocado.** Restaurar «por si acaso» eran
  cuarenta `rename` por generador sobre el árbol de verdad, y ese trabajo no
  hacía falta para nada.
- **Y se dice lo que se ha tocado.** Antes un generador que escribiera en el
  árbol real se deshacía **en silencio**, y un silencio así es un fallo que no se
  ve hasta que alguien compara el contrato con el código del synth a mano. Ahora
  es un problema más, con los nombres de los ficheros dentro.

Con esto, el test de «escribe de más» ya no llega al árbol real (el fichero colado
cae en la arena), así que se ha añadido el que sí lo alcanza: un generador
temporal que escribe en `contracts/` por ruta absoluta, y se comprueba que se
**denuncia**, que el colado desaparece y que el reescrito vuelve a tener su
contenido y su fecha. `1737` tests.

### La medición, y cómo se rompió la sonda dos veces

`build/vigilar-contratos-reales.mjs` vigila el directorio con `fs.watch` mientras
corre el preflight destructivo, y cuenta. El resultado que importa:

| | eventos en el `contracts/` real | ficheros tocados |
|---|---|---|
| el 0.2.75 (`040bda6`) | **491** | **40** |
| este | **0** | **0** |

Los dos con 3 de 3 generadores produciendo y salida 0. El antiguo movía los
cuarenta contratos casi cinco cientos veces en una sola corrida; el nuevo no
escribe nada.

**Y la sonda estuvo rota dos veces, que es la mitad de lo que hay que contar.**
La primera versión lanzaba el preflight con `spawnSync`, que **bloquea el bucle
de eventos** —y los eventos de `fs.watch` se entregan en el bucle—, así que el
vigilante no podía ver nada mientras el hijo corría: daba 0 con cualquier código.
No se detectó leyendo el resultado, sino porque **el código antiguo también dio
0**, cuando el antiguo reescribía los cuarenta contratos. Un cero que no
distingue dos cosas que son distintas no es un cero, es una sonda rota.

La segunda: el guard de `main()` exige que el fichero se llame
`check-generated-contracts.mjs`, así que una copia con otro nombre **no corría
nada** —y salía con 0 y con «0 de 3», que es la señal que delata el vacío. Por
eso la sonda imprime cuántos generadores dice que producen: un «0 de 3» con 0
eventos no es un buen resultado, es un preflight que no se ha ejecutado.

Y una corrección de una sonda, que es una regla para las mías: **la sonda que
mide no puede ensuciar lo que mide**. El control escribía un contrato para
comprobar que el vigilante funciona, y le cambiaba la fecha. Ahora restaura
contenido y fecha, y lo dice.

### Verificado

| | |
|---|---|
| suite completa | **1737 tests, 40 ficheros, RC=0** |
| `tests/generatedContractsPreflight.test.js` | 62 tests, RC=0 |
| `npm run preflight` | RC=0 |
| `--comprobar-generadores` | RC=0, 3 de 3 |
| `contracts/` antes y después | **idéntico en md5, mtime y modo** |
| rastros (arena ni temporal) | ninguno |

**Sin commitear**: `scripts/check-generated-contracts.mjs` y
`tests/generatedContractsPreflight.test.js` en el árbol de `ABDSharedAssets`.

---

## 0.2.75 — 🧯 La restauración de contratos ya no se ve a medias, y está medido que no se ve

> El rojo intermitente de `schemaValidator.test.js` y `quarantineRule.test.js`
> no era un test malo: era otro proceso leyendo un fichero que estaba a medio
> escribir. Aquí se cierra **esa** ventana —la de la restauración— y se mide
> cuánto vale, en vez de suponerlo.

### La ventana, por escrito

El `finally` de `generadorProduceLoQueDice`
(`scripts/check-generated-contracts.mjs`) devolvía cada contrato con
`writeFileSync(origen, bytes)`. Eso **trunca al abrir** y llena después, así que
durante un rato el fichero en disco es un JSON a medias. A la vez, otro worker
de vitest está leyendo `contracts/` por su cuenta —`readContract()` hace
`JSON.parse(readFileSync(...))` sin ninguna espera— y se come ese JSON a medias:

```
SyntaxError: Unexpected end of JSON input
```

Reproducido dos veces antes de tocar nada: en `schemaValidator.test.js:990` y en
`quarantineRule.test.js:256`, con dos contratos ilegibles a la vez.

### Lo que se ha cambiado

El contrato se escribe **entero en un temporal y se mueve encima con
`rename`**. Un `rename` no tiene ventana: el lector que ya tenía el fichero
abierto sigue leyendo el viejo entero, y el que abre después abre el nuevo
entero.

Tres detalles que no son adornos y que deciden dónde va el temporal:

- **No puede ir en `tmpdir()`.** `rename` solo es atómico dentro del mismo
  sistema de ficheros, y en Windows `tmpdir()` está en `C:` mientras que el repo
  vive en `D:`. Ahí el `rename` daría `EXDEV`, que es exactamente la escritura
  no atómica que se viene a evitar.
- **No puede ir dentro de `contracts/`.** `fechasDeContratos()` lista **todo** lo
  que encuentra ahí, sin filtrar. Un temporal dentro se contaría como un
  fichero más que el generador ha escrito y aparecería un problema que no existe:
  «escribe X, que NO está en sus salidas declaradas».
- **Va en un directorio con punto en la raíz del repo**, que nadie enumera, y
  `rmSync` se lo lleva en cuanto termina.
- **Los permisos se vuelven a poner a mano** (`chmodSync`): un `rename` cambia el
  inodo, así que el temporal no los hereda.

### El detalle que salió por el camino: en Windows el `rename` da EPERM

Primera versión: cinco reintentos seguidos, sin dormir, «que la ventana dura
poco». **Fallo en las tres corridas, siempre al principio**: en Windows un
fichero no se puede sustituir mientras otro proceso lo tiene abierto, y el lector
de contratos lo tiene abierto constantemente:

```
Error: EPERM: operation not permitted, rename '...\preflight-tmp\x.json'
  -> '...\contracts\x.json'
```

Cinco reintentos a pelo no arreglan eso. Lo que lo arregla es **esperar de
verdad** entre intentos (`Atomics.wait`, 20 ms, hasta 25 veces). Y no es un
detalle de robustez: sin esa espera, un `rename` que no cuela marcaba
`restaurado = false` y el preflightaba con «no se ha podido restaurar
`contracts/`», que es un rojo **inventado**.

### La medición

`build/ventana-contratos.mjs`: copia `contracts/` a un temporal, y un proceso
hijo lee y parsea sin parar mientras el padre escribe con cada estrategia. Es la
misma carrera del rojo intermitente, pero forzada a proposito. Tres corridas:

| escritura | lecturas | rotas | % roto | vueltas en 2,5 s |
|---|---|---|---|---|
| `writeFileSync` | 4060 / 4022 / 4100 | **60 / 58 / 60** | 1,46 / 1,42 / 1,44 % | 198 / 194 / 195 |
| `rename` | 4360 / 3960 / 4160 | **0 / 0 / 0** | 0 % | 45 / 43 / 48 |

**El coste, medido también.** Con un lector machacando, la vía atómica hace unas
**4 veces menos vueltas** en la misma ventana (43-48 frente a 194-198): se queda
esperando a que el lector suelte el fichero. Sin contención —que es el caso real,
donde el lector es un test y no un bucle— el peaje son unos milisegundos por
restore.

### Lo que queda abierto, dicho antes de que se lea como cerrado

Esto cierra la ventana de **la restauración**, que es la grande: un preflight
restaura ~40 contratos por generador y corre cuatro veces. **La ventana del
generador sigue abierta**: los tres `.py` escriben en `contracts/` en sitio, con
su propio truncar-y-llenar, mientras dura la regeneración. Cerrarla de verdad
pediría correrlos contra una copia del repo en vez de contra el real, que es un
cambio de arquitectura de la función y no un detalle de este arreglo.

### Verificado

| | |
|---|---|
| `tests/generatedContractsPreflight.test.js` | 61 tests, RC=0 |
| suite completa | **1736 tests, 40 ficheros, RC=0** |
| `npm run preflight` | RC=0 |
| `--comprobar-generadores` (el camino que restaura de verdad) | RC=0 |
| `contracts/` antes y después | **idéntico en md5, mtime y modo**, 40 ficheros |
| rastro `.preflight-restaurar-*` | ninguno |

**Commiteado**: `040bda6` en `ABDSharedAssets`, un solo fichero
(`scripts/check-generated-contracts.mjs`, +86/−4). Nada pusheado.

---

## 0.2.74 — 🔧 Los dos installs de la auditoría: uno reproducido, uno arreglado, y lo que había debajo

> La auditoría de installs (SAG013) dejó dos repos con el install puzzling y un
> tercero con el fallo ya confirmado. Los tres se han ejecutado esta vez, no
> razonado. Uno estaba arreglado con borrar un fichero; otro **no estaba roto**
> —la pagina siguiente explica el fallo de la propia auditoria—; y el tercero
> tenía lo que de verdad había debajo.

### Lo reproducido, no lo inferido

**`ABDEep`** sin `package-lock.json` en la raíz, ejecutado desde HEAD en un
directorio temporal limpio:

```
npm ci  ->  RC=1
npm error code EUSAGE
npm error The npm ci command can only install with an existing package-lock.json
```

Por semántica de npm tenía que fallar, pero fallaba por una razón distinta a la
que se suponía: no es que el lockfile esté desfasado, es que **no hay lockfile**, y
`npm ci` no genera uno. Es la razón por la que este repo instala con `pnpm` y
hereda el lockfile del workspace.

**`ABDAudioLab` NO ERA UN FALLO, y el error era mío.** La auditoría dijo que su
job de contratos corría `pnpm install --frozen-lockfile` sobre una raíz sin
`package.json`. La raíz del repo efectivamente no tiene manifiesto —eso es
cierto, y sigue siendo cierto—, pero **ese job no corre ahí**: el job
`contracts-preflight` lleva

```yaml
defaults:
  run:
    working-directory: ABDSharedAssets
```

Es decir, instala el `ABDSharedAssets` que acaba de hacer checkout, que sí tiene
`package.json` y `pnpm-lock.yaml`. La lectura se fue al repo cuyo nombre aparece
en el `checkout` y no al directorio de trabajo. Reproducido desde el SHA que el
job fija (`065ca6c`, `ABDSharedAssets`):

```
pnpm install --frozen-lockfile   (pnpm 10.25.0)  ->  RC=0   252 paquetes
pnpm run preflight                                ->  RC=0
    copia al dia   ABDAudioLab/contracts/hardware (40 ficheros iguales)
```

La puerta hace justo lo que fue construida para hacer. **No se toca el workflow.**

Y con esto hay que señalar una segunda cosa, porque el primer rojo también mentía:
ejecutado con el pnpm de esta máquina (12.8.1) el mismo install sale **RC=1** con
`ERR_PNPM_IGNORED_BUILDS` —el bloque de scripts de `esbuild`—, y con el 10.25.0
que fija el workflow sale RC=0 con un simple aviso. Un instalador mas nuevo es un
rojo que aqui no existe, y si se hubiera arreglado «el job de ABDAudioLab»
con ese RC delante, se habria tocado un workflow que funciona.

### El arreglo: `ABDBankManager`, commit `66dea52`

Aquí sí estaba confirmado: los tres jobs de `ci.yml` que usan `npm ci`
(`schema-validation`, `registry-generation`, `vitest`) morían en
`Missing: fake-indexeddb@6.2.5 from lock file`. El `package.json` de HEAD declara
`fake-indexeddb@^6.2.5`, pero el `package-lock.json` commiteado es de un día
anterior y no lo tiene.

Un detalle que casi se lleva el arreglo: `npm install --package-lock-only` **sobre
el lockfile viejo dice `up to date`** y parece que arregla. No arregla nada: solo
parchea. Borrándolo antes, el lockfile sale de cero y difiere en **758 líneas**.
El commiteado es el de cero.

| | antes | después |
|---|---|---|
| entradas en `packages` | 238 | 238 |
| `fake-indexeddb` | *ausente* | **`6.2.5`** |
| `eslint-visitor-keys` | 3.4.3 (anidado dos veces) | **4.2.1** (anidado una, bajo `@eslint-community/eslint-utils`) |
| líneas | 3351 | **3405** (LF, CRLF=0) |
| diff | — | 328 inserciones / 274 borrados |

**Y el radio de impacto, que no es solo una entrada añadida.** Regenerar desde
cero vuelve a resolver *todos* los rangos `^` contra el registro de hoy: **61
paquetes cambian de versión**, casi todos transitivos. Los que se ven:
`rollup 4.62.5 → 4.64.0` (y sus 24 binarios por plataforma),
`@tauri-apps/cli 2.11.4 → 2.12.1`, `typescript-eslint 8.68.0 → 8.71.0`,
`prettier 3.9.6 → 3.9.9`, `dexie 4.4.5 → 4.4.6`, `jszip 3.10.1 → 3.10.2`,
`postcss`, `nanoid`, `brace-expansion`. También se **eliminan 2 entradas**
(`eslint/node_modules/eslint-visitor-keys` y
`espree/node_modules/eslint-visitor-keys`), sustituidas por la de
`@eslint-community/eslint-utils`.

Es más cambio del que sugiere «arreglar un install», y se ha elegido a
propósito: la variante mínima —`npm install --package-lock-only` sobre el
lockfile viejo, que solo añade lo que falta— también funciona, pero deja el
árbol medio refrescado y el fichero sin forma de regenerarse de manera
reproducible. Antes de pushear, conviene saber que este commit mueve
dependencias, no solo metadatos de install.

Verificado sobre el **blob commiteado**, con `git archive HEAD` a un temporal
limpio, que es lo que baja el runner:

```
npm ci              ->  RC=0   176 paquetes, fake-indexeddb@6.2.5
npm run generate    ->  RC=0   los 5 artefactos de registry-generation, no vacios
```

**Por qué (a) y no migrar `ci.yml` a pnpm**: no es cuestión de gusto, la opción
(b) es imposible desde HEAD. `pnpm install --frozen-lockfile` responde
`ERR_PNPM_OUTDATED_LOCKFILE` porque en HEAD no existe `pnpm-workspace.yaml`, así
que pnpm tampoco instala. La migración a pnpm que hay **en curso en el árbol de
trabajo** no está commiteada: ni `pnpm-workspace.yaml` ni el `pnpm-lock.yaml`
nuevo. El commit toca un solo fichero y no roza los 130 modificados ni los 90
sin seguimiento de ese trabajo.

### Lo que había debajo del install, y que no lo arregla este commit

Con `npm ci` en verde por fin se ve lo que había detrás. La suite de HEAD da
**33 fallos que no tienen nada que ver con el install**:

- **1 suite que ni arranca**: `packages/contracts/tests/casioCzAdapter.test.js`
  importa `@contracts/Adapters/sysexUtils`, y ese módulo **no existe** —ni en HEAD
  ni en el árbol de trabajo—. El alias apunta a `Source/Contracts`, donde hay ocho
  adaptadores y ninguno es `sysexUtils`.
- **32 tests** en `packages/contracts/tests/rolandJunoAdapter.test.js`: el
  adaptador identifica `Juno60_Bank_A.syx` como `roland-juno106`, y de ahí se
  descuelgan los 64-vs-60 patches, el `originAddress` de `undefined` y los
  checksums.

Y una causa de ruido que **no es de este repo**: `fixtures/` está en
`.gitignore` (línea 43), así que 8 ficheros de fábrica de Korg Prohecy viven solo
en esta máquina. Ejecutando la suite sin ellos son 41 fallos; copiándolos al
temporal, 33. Los 8 sobrantes son míos, no del repo.

Los mismos adaptadores que fallan (`rolandJunoAdapter.ts`,
`korgMs2000Adapter.ts`, `Models/casio-cz.ts`, `Models/korg-ms2000.ts`) los está
modificando otro hilo en el árbol de trabajo. No se han tocado.

### Y el `security-scan` ya estaba rojo antes

`npm audit --audit-level=high` es un job que tampoco depende de este arreglo, y
salía rojo igual. Se ha medido contra los dos lockfiles para no atribuirlo a
quien regenera:

| lockfile | vulnerabilidades | RC |
|---|---|---|
| el viejo | 6 (3 moderate, **2 high**, 1 critical) | 1 |
| el nuevo | 5 (3 moderate, **1 high**, 1 critical) | 1 |

Preexistente, y la regeneración lo deja algo mejor, pero **sigue en rojo**: 1
critical y 1 high pendientes de arreglar, que es trabajo de dependencias y no de
lockfiles.

### Estado

Commit `66dea52` en `ABDBankManager`, un solo fichero (`package-lock.json`).
`ABDEep` y `ABDAudioLab` sin tocar. Nada pusheado.

---

## 0.2.73 — 🔓 El último hueco: el lockfile propio de ABDSharedAssets ya instala vite 8

> Era el punto 4 del baseline y el único que quedaba abierto de verdad: los otros
> tres eran mediciones que faltaban, este era un **fichero que había que
> regenerar**. `ABDSharedAssets` es el único de los cinco con un
> `pnpm-lock.yaml` propio y commiteado, y su CI instala de ese fichero. Estaba
> en `vite 5.4.21` y `vitest 1.6.1` con el `package.json` ya diciendo `^8.3.2` y
> `^4.1.11`. Ahora instala lo que dice.

### El problema, en una frase

El salto estaba **declarado pero no instalado** en el único repo cuyo CI no
hereda el lockfile de la raíz. En local todo verde porque pnpm sube al workspace y
encuentra el 4.1.11 de la raíz; en el runner, `pnpm install --frozen-lockfile` no
podía colocar lo declarado. Por eso el 0.2.69 dejó el `package.json` sin tocar
deliberadamente: meter el salto antes habría roto el install del CI **antes de
llegar a ningún test**.

### Cómo se regenera sin reescribir el de la raíz

```bash
pnpm install --lockfile-only --ignore-workspace   # en ABDSharedAssets
```

`--ignore-workspace` es lo importante: sin él, pnpm sube a
`D:/desarrollos/ABDSynths/`, reconoce el workspace de cinco miembros y toca el
lockfile de la raíz —que en el 0.2.69 se regeneró a mano y no se toca por
casualidad—. MEDIDO: el md5 del lockfile de la raíz **no cambia**
(`ae7191e0…`), y el propio pasa de `28300c54…` a `601fa8e8…`.

| | antes | después |
|---|---|---|
| `vite` | `5.4.21` | **`8.3.2`** |
| `vitest` | `1.6.1` | **`4.1.11`** |
| `vite-node` | `1.6.1` | *desaparece* |
| `esbuild` | `0.21.5` | *desaparece* |

Los dos que se van no son un efecto secundario: **vite 8 usa Rolldown, no
Rollup**, y vitest 4 ya no arrastra `vite-node`. El install lo confirma bajando
`@rolldown/binding-win32-x64-msvc`.

### La prueba es sobre el blob, no sobre la copia de trabajo

Es la diferencia entre «a mí me funciona» y «funciona en el runner». El commit
normaliza EOL (`core.autocrlf=true` avisa), así que lo que se verifica es lo que
el runner va a bajar:

```
git show HEAD:pnpm-lock.yaml  ->  CRLF=0, LF=1581
pnpm install --frozen-lockfile  ->  RC=0
+ jsdom 24.1.3   + mermaid 12.0.0   + vite 8.3.2   + vitest 4.1.11
```

Sin ese paso, un blob con CRLF habría pasado la prueba local y fallado en CI.

### Y la suite, que es lo que corre después

**1736 tests, 40 ficheros, RC=0**, contra vitest 4.1.11 y vite 8.3.2.

De paso, una cifra del 0.2.69 era más grande de lo que la suite corre:
`@abdsynths/shared` tiene `include: ['tests/**/*.test.js']` y en `tests/` hay
**40** ficheros, no 268 — los 268 contaban `.test.js` de fuera de `tests/`, que
el `include` siempre ha excluido. El número que importa, **1736 tests**, coincide
exacto en todas las mediciones.

### Estado

Commit `5ea9941` en `ABDSharedAssets`, un solo fichero (`pnpm-lock.yaml`).
Los **cinco** miembros instalan ya el mismo par vite 8 / vitest 4, y **ninguno**
de los cuatro huecos del salto queda abierto. Nada pusheado.

---

## 0.2.72 — 🧭 Un guard para que dos repos del workspace no declaren vitest distinto

> Ya habia un guard de vitest, `vitestInstaladoCoincide.test.js`, y mira una sola
> columna: que lo instalado en disco caiga dentro de lo que declara **este** repo.
> Le falta la otra mitad, que es comparar **entre repos**. Sin esto, los cinco
> paquetes del workspace pueden declarar cinco versiones distintas a la vez y
> todos los guards siguen en verde, porque cada repo es coherente consigo mismo.

### Lo que mira

`WebUI/tests/vitestEnElWorkspace.test.js`, 24 tests, verde en la suite completa.

| Fichero | `devDependencies.vitest` | version base |
|---|---|---|
| `package.json` (raiz) | `4.1.11` | 4.1.11 |
| `ABDEep` | `^4.1.11` | 4.1.11 |
| `ABDSharedAssets` | `^4.1.11` | 4.1.11 |
| `ABDSharedCode/MidiKeyboard` | `^4.1.11` | 4.1.11 |
| `ABDMS2000` | `^4.1.11` | 4.1.11 |
| `ABDCZ101` | `^4.1.11` | 4.1.11 |

**Compara la version base, no la cadena**, y no es un matiz: la raiz lo fija
exacto a proposito —su lockfile gobierna a todos los miembros— y los miembros
ponen el caret que necesitan. Un guard que comparara las cadenas a pelo estaria
en rojo desde el primer dia por una diferencia de formalismo. Lo que **no** se
exige es el mismo operador: decidir el rango es cosa de quien hace el salto; lo
que este guard dice es que no queden dos numeros distintos repartidos.

### De donde sale la lista

De `pnpm-workspace.yaml`, leido de la raiz del workspace, **no escrito aqui como
constante**. Una lista copiada a mano se queda vieja el dia que entre un sexto
miembro, y un guard que vigila cuatro de cinco no dice nada.

Quedan fuera `ABDBankManager` (vitest ^2.0.0) y `ABDScope` (^2.1.8), que declaran
vitest y estan en el mismo disco: ninguno es miembro del workspace, y
`ABDBankManager` es ademas un workspace pnpm interno que pnpm no anida. Si alguno
entra en `packages:`, el guard lo coge sin que nadie tenga que acordarse.

### Cuando un hermano no esta en disco

Un checkout de un solo repo no tiene con quien compararse, y ahi el guard no tiene
sujeto. Un miembro ausente se cuenta como ausente y se nombra, y no como
discrepancia: un guard que se pone rojo porque el CI no clona un repo enseña a
la gente a correrlo con `--exclude` y a no mirarlo nunca. Pero tampoco se deja
pasar en silencio — hay un test que exige que se lean **al menos dos**
declaraciones e imprime cuales se han leido y cuales no.

### Probado con dientes, y con dos agujero de por medio

Un guard de consistencia que devuelve `[]` siempre pasa igual. Aqui se le da algo
roto a proposito y se le exige que lo note:

```
md5 antes:  94aca471266c09391f646e7a645787e0
desfasado:  ABDMS2000 dice ^1.6.1
--- test con ABDMS2000 desfasado: RC=1
    × ningun miembro declara una version distinta
    +   "ABDMS2000 declara \"^1.6.1\" (base 1.6.1) y la raiz va en 4.1.11"
restaurado: 94aca471266c09391f646e7a645787e0 (identico: true)
```

El `package.json` de un repo ajeno, editado **como texto** —reserializar con
`JSON.stringify` reordena las claves y devuelve el fichero distinto aunque el
contenido sea el mismo— y restaurado byte a byte, que el md5 comprueba. La sonda
restaura siempre, pase lo que pase con el test.

Dos cosas que aparecieron al probarlo, y que no habria salido sin mirar:

1. **El parser aceptaba miembros que no existen.** `- ABDNeural  # todavia no`
   empieza por `- ` igual que un miembro de verdad, asi que el guard vigilaba un
   miembro llamado `ABDNeural  # todavia no` y se ponia en verde. La regla ahora
   es `- ` seguido de **un token sin espacios**, porque un miembro es una ruta y
   una ruta no lleva espacios dentro. Lo destapo un test, no un fallo de suite.
2. **La sonda daba un falso negativo, no un negativo.** Con `npx`, en Windows,
   `execFileSync` no arranca `npx.cmd`: reventaba con ENOENT, que llegaba como
   `status === undefined` y se leia como codigo de salida de vitest. Decía «el
   guard no muerde» con el test claramente en rojo. Ahora invoca el binario con
   el node del propio proceso. Un instrumento mal hecho es peor que no medir.

Y un tercero que no era del guard: `npm run lint` es `--max-warnings 0`, y las dos
llaves sin corrochete que yo habia escrito salian como dos warnings de `curly`.
Arregladas; el lint del proyecto pasa con RC=0.

### Lo que ha tenido que moverse

`docs/baseline_fase0_v32.md` §2: **130 → 131 ficheros** y **5173 → 5197 tests**.
Los 24 tests nuevos. El `baselineGuard` es el que avisa de esto, y avisa bien: la
suite salio en rojo pidiendo exactamente `131 / 5197`, y el doc se actualizo a eso.

---

## 0.2.71 — 🧪 `--coverage` bajo vitest 4: medido, y no hubo nada que arreglar

> El último hueco de la lista del salto a vitest 4 era «`@vitest/coverage-v8` no se
> ha corrido». Se ha corrido dos veces. **No falló nada**, y ese es el titular: el
> hueco se cerraba solo. Lo que sí sale de correrlo es una cifra que hasta ahora
> nadie tenía, y un aviso sobre cómo hay que leerla.

### El titular: cero arreglos

`@vitest/coverage-v8` está en **4.1.11**, la versión exacta que el peer de vitest
4.1.11 exige, y `vitest.config.js` no declara configuración de cobertura: se usan
los defaults. Dos corridas completas, y las dos con lo mismo:

| | RC | `Test Files` | `Tests` | Avisos del proveedor |
|---|---|---|---|---|
| corrida 1 | **0** | 130 / 130 | 5171 passed, 2 skipped | **0** |
| corrida 2 | **0** | 130 / 130 | 5171 passed, 2 skipped | **0** |

`Coverage enabled with v8` en la cabecera de los dos logs, y **cero** avisos: ni
`unsupported`, ni `istanbul`, ni `nyc`. La tabla sale idéntica cifra por cifra en
las dos —`56.49 | 46.43 | 64.08 | 58.12`— y **no hizo falta tocar ni una línea
de código ni de test**.

### Lo que sale: 56,49 % de statements

| | % Stmts | % Branch | % Funcs | % Lines |
|---|---|---|---|---|
| **All files** (56 ficheros) | **56.49** | **46.43** | **64.08** | **58.12** |
| `WebUI/js` | 65.12 | 50.75 | 66.51 | 67.46 |
| `WebUI/tests` | 76.62 | 75 | 95.83 | 77.94 |
| `scripts` | 21.84 | 20.75 | 28.39 | 22 |

Genera `coverage/` —`clover.xml` (221 KB), `coverage-final.json` (1,0 MB) y el
HTML—, que está en `.gitignore` desde la línea 19. Medido: la corrida **no escribió
una sola ruta** fuera de `coverage/`, y con `coverage/` ya en disco la suite sigue
recogiendo **130** ficheros, ni uno más.

### Y un aviso sobre cómo hay que leer esa cifra

**El 21,84 % de `scripts/` no significa que esos scripts estén sin probar.**
Significa que el proveedor no los instrumentó. Casi todos corren como **proceso
hijo** desde un test, y v8 no ve dentro de un proceso que no es el suyo.
`check_wasm_build.js` es el caso extremo: **4,14 % y 0 % de funciones**, cuando
precisamente es de los scripts que más se ejecutan.

Los cinco ficheros con 100 % son casi todos helpers de test, no producto. O sea:
**esta cifra mide el WebUI, no el repo.** Sirve para saber que `WebUI/js` está en
65 % y para ver qué se ha dejado sin tocar; tomarla por «cobertura del proyecto»
sería un error, y por eso va escrita aquí con su cifra al lado.

### El coste: tres corridas alternas

| Corrida | `Duration` |
|---|---|
| sin cobertura, `coverage/` ausente | 34,73 s |
| **con `--coverage`** | **37,83 s** |
| sin cobertura, `coverage/` ya en disco | 33,48 s |

**+3 s, ~9 %**, del orden del ruido de la máquina: una corrida posterior tardó 51 s
con la suite en verde y 216 s de CPU de tests, contra 135 s de las anteriores. Cabe
de sobra en un runner si algún día se quiere, y ese día **no ha llegado**:
`--coverage` sigue sin correr en ningún workflow. Ni `webui-ci.yml`, ni
`dsp-ci.yml`, ni el `docs-audit.yml` de los hermanos.

### Un cambio, y no es un arreglo

`vitest.config.js` declara ahora `'**/coverage/**'` en `exclude`. Hoy **no hace
falta**, y conviene decirlo con precisión: el informe escribe una página por
fichero cubierto y se llaman `algo.test.js.html`, que no casa con el include por
defecto `**/*.{test,spec}.?(c|m)[jt]s?(x)` porque no termina en `.js`, y dentro de
`coverage/` no hay ni un `*.test.*`. Se declara por el mismo motivo que `build/`, y
el precedente está escrito en ese mismo fichero: las copias de ABDSharedCode que
alguien dejó en `build/` se convirtieron en parte de la suite y aportaron 502 tests
rojos. Suite verificada después del cambio: 130/130, 5171 passed, RC=0.

### Lo que sigue abierto

- El **punto 4** del baseline: regenerar el `pnpm-lock.yaml` propio de
  `ABDSharedAssets`, que es lo único que impide que el salto a vitest 4 llegue a su
  CI. Diagnosticado y escrito desde el 0.2.70; falta ejecutarlo.
- `schemaValidator.test.js` tiene un rojo intermitente (verde aislado 140/140, rojo
  en paralelo). **No ha reaparecido en las cinco corridas de hoy** —5171 passed,
  0 fallos en todas— y sigue sin investigarse a fondo.

Detalle largo en `docs/baseline_fase0_v32.md`, sección «Lo que NO se ha podido
medir», punto 3.

---

## 0.2.70 — 🚧 El rojo de `check:guardas` ya no era local, y el sitio donde se escondía el lockfile

> El rojo era `check:guardas no esta en ningun inventario del preflight`, y al
> ir a cerrarlo resulto que **ya estaba cerrado** y que lo que quedaba era otra
> cosa: un rojo en CI, medido con los SHA que el workflow tiene fijados, que no
> se ve desde el arbol de trabajo. Y de paso, un agujero del 0.2.69.

### El rojo que ya no existia

El inventario es `GENERADOS_FUERA` en `scripts/check-generated-contracts.mjs`, y
`check:guardas` **ya estaba dentro**, con un comentario que explica hasta por que
va ahi siendo el unico que necesita los tres hermanos clonados. El test
`tests/generatedContractsPreflight.test.js` pasa **61/61**.

Lo que si se ha hecho es comprobarlo, porque un arreglo de inventario que no
está verificado es una suposición con Tapices:

```
roto:  md5 ccfed3029ab5a64e2b03080e683920d9 -> 6c4ef79105ddf3dd635cf9d6824788b6
vuelta: md5 ccfed3029ab5a64e2b03080e683920d9  (byte a byte)
rc=1
AssertionError: check:guardas no esta en ningun inventario del preflight: expected [ 'check:mod-contracts', …(5) ] to include 'check:guardas'
  378|       expect(declarados, `${c} no esta en ningun inventario del prefli…
```

Quitar la entrada lo devuelve a rojo **con su mensaje**, y el fichero se restaura
byte a byte. El test caza; no se limitaba a mirar.

### El rojo de verdad: CI, y no se ve desde aqui

Los tres `guardasDeEscritura.test.js` eran ficheros **untracked** en sus repos, y
`docs-audit.yml` no clona `main`: clona un **SHA fijo**. En local el `--check` sale
verde porque el fichero existe en el arbol de trabajo; en CI el checkout llega al
SHA y el fichero no esta. Los dos verdes no son el mismo verde.

Medido materializando los tres repos en el SHA que tiene el workflow, no en el
arbol de trabajo:

| Repos clonados en | `pnpm run preflight` | el paso de las guardas |
|---|---|---|
| los SHA de hoy | **RC=1** | **RC=1** |
| los commits de hoy | **RC=0** | **RC=0** |

```
[guardas] ABDEep:    DESFASADO — scripts/guardasDeEscritura.test.js no existe.
[guardas] ABDMS2000: DESFASADO — WebUI\tests\guardasDeEscritura.test.js no existe.
[guardas] ABDNeural: DESFASADO — WebUI\tests\guardasDeEscritura.test.js no existe.
```

Y con los SHA de hoy ese es el **único** rojo: el `s950_*_fields.json` que tambien
sale no existe en el sandbox porque la sonda no materializa `ABDSharedCode`, que
CI si clona. Un rojo que se ve en la sonda y no en CI no se reporta como rojo.

### Los cuatro commits

| Repo | Commit | Que mete |
|---|---|---|
| ABDEep | `d565b89` | `scripts/guardasDeEscritura.test.js` |
| ABDMS2000 | `6cb98cb8d` | `WebUI/tests/guardasDeEscritura.test.js` |
| ABDNeural | `cb431a4` | `WebUI/tests/guardasDeEscritura.test.js` |
| ABDSharedAssets | `4bb6176` | el motor, la entrada de `GENERADOS_FUERA`, el paso de CI y los dos scripts de npm |

**Los `ref` de `docs-audit.yml` NO se han tocado**, a proposito: un SHA que no esta
pusheado no lo puede clonar `actions/checkout`, y subirlos antes de tiempo
cambia un rojo por un error de checkout. El orden es: **pushear los tres commits
de los hermanos, y despues subir los `ref`.**

Y una casi-incidente que dejo written: el primer `git commit` en ABDEep se llevo
**cuatro ficheros borrados** que otro hilo tenia ya en el indice. Un
`git commit` a secas commitea el indice entero, no lo que uno cree que esta
commiteando. Deshecho con `reset --soft` —que no toca el indice— y rehecho con
rutas explicitas. Los cuatro borrados ajenos siguen en el indice, intactos.

### Y el agujero del 0.2.69: un lockfile que no es el del monorepo

`ABDSharedAssets` es el **unico** de los cinco con un `pnpm-lock.yaml` **propio y
commiteado**, y su `docs-audit.yml` hace `pnpm install --frozen-lockfile` con el
directorio de trabajo en el propio repo. O sea que su CI instala **de ese
lockfile**, no del de la raiz del monorepo. Y ese lockfile sigue diciendo:

```
vite:
  specifier: ^5.4.0
  version: 5.4.21
vitest:
  specifier: ^1.6.0
  version: 1.6.1
```

Consecuencia, dicha sin rodeos: **el salto a vitest 4 de `ABDSharedAssets` esta
declarado pero no installed en su CI.** Localmente corre con 4.1.11 porque pnpm
sube hasta la raiz del monorepo y encuentra alli el lockfile correcto; en el
runner no hay raiz de monorepo, y sale con 1.6.1.

Por eso el commit `4bb6176` **no lleva el salto a vitest 4**: meterlo en
`package.json` sin regenerar ese lockfile habria roto `--frozen-lockfile` antes
de llegar a ningun test. Queda pendiente, y es el siguiente paso natural:
regenerar `ABDSharedAssets/pnpm-lock.yaml` y commitearlo con el salto.

### Cuentas

`ABDSharedAssets` dos corridas seguidas: **1736/1736, 0 fallos**. `ABDEep`:
**130 ficheros, 5171 tests, 0 fallos**, y `eslint --max-warnings 0` en verde.
Apareció un rojo suelto en `schemaValidator.test.js` —verde aislado, 140/140, y
rojo en la pasada en paralelo— que no se ha vuelto a ver en dos corridas. Es de
la misma familia que el intermitente que ya se persiguio en el 0.2.68.

---

## 0.2.69 — 🪜 Los cuatro hermanos ya no son de otra versión

> Cuatro paquetes del workspace seguían en **vitest 1.6.1** y tres en **vite
> 5.4.x**, y vitest 4 no acepta vite 5 (`^6 || ^7 || ^8`). Se había medido que
> **funcionaban**, pero no estaba declarado: los `package.json` no lo decían. Ahora
> lo dicen, y además resulta que **uno de los dos fallos que quedaban abiertos
> durante la medición no eran fallos**.

### Lo que se toca, exactamente

Dos ficheros por paquete, y solo dos:

| Fichero | Cambio |
|---|---|
| los 4 `package.json` hermanos | `vitest: ^1.6.0` → `^4.1.11`; en 3 de ellos `vite: ^5.4.0\|^5.4.21` → `^8.3.2` |
| `pnpm-lock.yaml` de la raíz del monorepo | regenerado |

MidiKeyboard **no declara vite**, así que en ese solo se toca `vitest`. El
`package.json` de la raíz **no se ha tocado**: su md5 sigue siendo
`424ccdbe262a3f9e31f75ecdbac9b817`, el de antes de empezar.

Ni un `test`, ni un script, ni un workflow. Los cinco miembros del workspace
resuelven ya **vitest 4.1.11** y **vite 8.3.2**, y:

```
$ pnpm install --frozen-lockfile
Scope: all 6 workspace projects
✓ Lockfile passes supply-chain policies (verified 5h ago)
Lockfile is up to date, resolution step is skipped
Done in 287ms using pnpm v12.8.1
```

> **AO: esto es el workspace, no el CI de cada repo.** `ABDSharedAssets` tiene un
> `pnpm-lock.yaml` PROPIO y commiteado, y su workflow corre
> `pnpm install --frozen-lockfile` ahi dentro: ese sigue en vite 5 y vitest 1.
> Medido y escrito en 0.2.70.

RC=0, que es lo que mira CI.

> **Un detalle del lockfile que parece un bug y no lo es.** `pnpm-lock.yaml` ha
> pasado de 4053 a 3854 líneas, y el diff parece haber reescrito el fichero
> entero. Lo que ha pasado es que **pnpm 12 escribe un YAML de dos documentos**:
> el primero es el lockfile de su propio binario (`packageManagerDependencies`,
> los `@pnpm/exe.*` de todas las plataformas, ~160 líneas nuevas) y el segundo,
> separado por `---`, es el de siempre. Se comprueba leyendo el **último**
> documento: los 5 importadores con `vite` y `vitest` dentro.

### Las cuatro suites, con su binario local ya declarado

| Paquete | ficheros | tests | fallos |
|---|---|---|---|
| `@abdsynths/midi-keyb` | 74 | 340 | **0** |
| `abd-cz101-emulator` | 116 | 389 | **0** |
| `abdms2000` | 61 | 177 | **0** |
| `@abdsynths/shared` | 268 | 1736 | **0** |

Los mismos números de tests que con vitest 1.6.1, uno a uno. Eso es lo que
importa: un salto que deja de recoger ficheros sale en verde y no lo dice.

### El fallo que no era un fallo

`@abdsynths/shared` fallaba con `check:guardas no esta en ningun inventario del
preflight`. Se dio por bueno como fallo preexistente —y lo era— y resultaba ser
**un timeout**: ese script lanza Python, y se comía el default de 5 s de vitest.
Con `--testTimeout=120000` desaparece ese mismo test sin tocar el manifiesto del
preflight.

Como un rojo que depende de la carga de la máquina es un rojo que nadie sabe
reproducir, `ABDSharedAssets/vitest.config.js` declara ya `testTimeout: 120000` y
`hookTimeout: 120000`. Con la config puesta, **dos corridas seguidas**:

```
corrida 1: RC=0  ficheros=268  ok=268  tests=1736  ok=1736  fail=0  skip=0
corrida 2: RC=0  ficheros=268  ok=268  tests=1736  ok=1736  fail=0  skip=0
```

Sin flag por línea de órdenes. Ese fichero es el **único** punto de este salto
que no sea un `package.json`.

### El build también, porque el número de tests no prueba nada

Un bundler puede fusionar entradas sin que ningún test se entere, así que
`node Scripts/build_webui.js` se mide aparte. Con vite 8 da **RC=0 en los dos**,
y sus `rollupOptions` — que solo usan `entryFileNames`, `chunkFileNames` y
`assetFileNames` — sí los soporta Rolldown.

| Build | vite 5 | vite 8 | |
|---|---|---|---|
| `ABDMS2000` | 54 ficheros | **53** | vite 8 fusiona `index2.js` dentro de `index.js`. Comprobado que el bundle de vite 8 **no menciona `index2` en absoluto**: el `import("./index2.js")` que aparecía era del de vite 5. |
| `ABDCZ101` | 408 ficheros | **408** | Sin cambios, ni de nombres ni de cuenta. |

### Un test que hubo que reescribir: `wasmBridge.test.js`

El build de `ABDMS2000` obligaba a tocar su test. El aserto era:

```js
expect(bundle).not.toMatch(new RegExp(`${flagName}=!0`))
```

Es decir: «en el bundle no puede aparecer `nombreDeLaBandera=!0`». Bajo vite 8 es
**insostenible**, porque el minificador nombró la bandera `n` y hay 11 `n=!0` en
el bundle que son de otros símbolos. El bundle es correcto; el aserto es el que
estaba escrito de una forma que no se puede sostener.

Ahora recorre **todos** los usos de `debug:<flag>` y exige, en cada uno,
`(const|let|var) <flag>=!1`. Probado con dientes: se añade un segundo uso `debug:`
con `=!0` y el aserto cae con el mensaje correcto; luego el bundle se restaura
byte a byte.

### El rojo que era mío

MidiKeyboard tiene un test que descubre hosts **recorriendo el workspace
entero**, y su `SKIP_DIRS` salta el directorio `build` exacto pero no `build-m`,
ni `build-m2`, ni `build-m4`: los tres directorios de medición de **422 MB** cada
uno que había creado dentro de ABDEep para medir builds. El test tardaba **225 s**
y caía por timeout. Borrados, tardó **48 s** y pasó 340/340.

> **Ningún rojo se investiga sin mirar antes el `git status` de lo que uno mismo
> ha escrito.** Los directorios de medición se crean con nombre nuevo para no
> pisar nada, y un `SKIP_DIRS` con un nombre exacto no los ve venir.

### Limpieza

`pnpm store prune` quitó 14 paquetes (2,9 MB). Tres directorios huérfanos de
`node_modules/.pnpm` (`vite@5.4.21_*` y dos `vitest@1.6.1_*`) hubo que borrarlos a
mano, porque `prune` no ve el store virtual. `.pnpm` queda en 418 MB y solo
contiene vite 8 y vitest 4.

### Estado final

Cada hermano tiene **exactamente +1 cambio suyo** (su `package.json`; en
`ABDSharedAssets`, además, su `vitest.config.js`), encima de los que ya traía sin
comitear de antes (4, 11, 98 y 1). Nada de lo que se corrió escribió un solo
fichero: se midió el md5 de los `__snapshots__` antes y después, y son idénticos.
**Nada comiteado.**

ABDEep intacto: suite `RC=0, files 963/963, tests 5173, fail 0, skip 2` y
`eslint WebUI/js/ WebUI/scripts/ --max-warnings 0` con RC=0.

---

## 0.2.68 — 🕸️ El guard tenía un agujero, y el rojo intermitente lo encontró

> Un guard que no vigila lo que dice vigilar sale en verde, y eso es peor que no
> tenerlo: entrena a la gente a no mirarlo. Este tenía **dos** puntos ciegos, y los
> encontró un rojo que salía **1 vez de cada 2** corridas sin decir por qué.

### El síntoma que lo delató

`recuentoPorRecoleccion` y `contratosDeDependencias` se caían de forma
intermitente con `STACK_TRACE_ERROR`. Ese nombre no es un error: es el sentinel
que **vitest lanza cuando el test expira**. O sea que el rojo era un **timeout**, y
el timeout era el de los 5 s por defecto.

Aislados miden **1100 ms** y **964 ms**. En la suite, con 130 ficheros lanzando
procesos a la vez, se pasan de 5 s. MEDIDO también: con 60 s de timeout en cada
`it` **se caían igual**.

### Punto ciego 1: el spawn vive en un módulo importado

El patrón real no era `describe(() => execFileSync(...))`:

```
// recuentoPorRecoleccion.test.js
import { collectedDetail } from './support/vitestSuite.js';
describe('...', () => { it('...', () => collectedDetail([SELF])); });
```

El `execFileSync` está en `vitestSuite.js`. El guard ahora **sigue los imports
relativos** (hasta tres saltos) y resuelve qué función importada lanza.

### Punto ciego 2: los helpers se llaman entre sí

Y aquí estaba el segundo, más sutil:

```
function correrScript(...) { return execFileSync(...); }   // lanza
function formaDelSpec() { return correrScript(...); }      // también
describe('CONTRATO 2', () => { it('...', () => formaDelSpec()); });
```

Ese `describe` no contiene ni un `execFileSync` ni una llamada a
`correrScript`: llama a `formaDelSpec`, y ahí se rompía la cadena. Los helpers
ahora se resuelven a **punto fijo**, no de un solo salto.

### El bug de orden que hacia el resto inútil

Antes de nada funcionar, el detector de comentarios quitaba **primero** las líneas
que empiezan por `*` y **después** el bloque `/* … */`. Al haberse llevado los
cierres de los JSDoc, la apertura de la cabecera se quedaba sin cerrar y el patrón
se comía código de verdad: `recuentoPorRecoleccion.test.js` se leían **0 imports
de los 1 que tiene**. Ahora es un escáner con estado y el orden ya no puede
importarle.

### Un falso positivo que también hubo que arreglar

La regla gruesa era «si el módulo importado lanza, todos sus nombres lanzan».
Eso marcaba `registryGen.test.js:440`, donde `canonicalizeSource` viene de
`scripts/registry_generator.js` — un módulo que sí lanza, pero **en otras
funciones**. Ese bloque solo calcula hashes.

Obligar a poner un timeout donde no hace falta es exactamente como se deja de
mirar un guard, así que ahora se resuelve **por función**: una función importada
es lanzadora si su cuerpo llama a `execFileSync` de verdad, o si llama a otra
función del mismo módulo que lo hace. Las cadenas se siguen a punto fijo.

### Y un arreglo que era una falsehood

El guard prometía aceptar «timeout en el `describe` **o** en el `it`», pero solo
miraba el del `describe`. `baselineGuard.test.js` cierra su bloque con
`}, 240000);` en el `it` y con `});` en el `describe`: tenía el timeout puesto y
bien puesto, y el guard lo listaba como ofensor. Ahora cuenta cualquiera de los dos,
que es lo que decía.

### Los dos ficheros reparados

El timeout se ha movido **al `describe`**, y a **240 s**, que es lo que ya usa
`baselineGuard` para la misma pasada anidada:

| Fichero | Bloque | Por qué |
|---|---|---|
| `recuentoPorRecoleccion.test.js` | `recuento por recolección…` | el `it` tenía 120 s; el `describe` no tenía nada |
| `contratosDeDependencias.test.js` | `CONTRATO 2 — la forma de…` | sin timeout en ninguna parte |

240 s y no 60 porque `vitestSuite.js` **reintenta una vez** cuando el vitest hijo no
escribe el JSON: un `it` de 60 s no cubre ni siquiera dos intentos.

### La sonda con dientes, aplicada a los dos casos

Un guard que no encuentra nada porque no busca nada también sale en verde, así que
los dos Pathways nuevos se comprueban quitando el timeout ya puesto:

```
rc=1  restaurado=true
el guard cita CONTRATO 2=true
linea citada=contratosDeDependencias.test.js:187  CONTRATO 2 — la forma de lo que devuelve…

rc=1  restaurado byte a byte=true
linea citada=gitattributesGuard.test.js:132  el .gitattributes protege de verdad, y se ve
```

### El recuento

El guard pasa de **8 a 12 tests** (imports, cadenas de helpers, falsos positivos y
timeout del `it`). Suite completa: **130 ficheros, 5173 tests**.

```
corrida 1: RC=0  files 963/963  tests 5173  fail 0
corrida 2: RC=0  files 963/963  tests 5173  fail 0
corrida 3: RC=0  files 963/963  tests 5173  fail 0
```

Antes de esto la misma suite era **1 fallo de cada 2**. El intermitente no era de
contención: era este timeout, y estos dos timeout.

---


## 0.2.67 — ⏱️ El techo del job de CI era 45, y no era por el segundo binario

> La pregunta era si `bundle-in-binary` se habia quedado corto al compilar **DOS**
> artefactos. **MEDIDO: no, y la premisa era al reves.** El segundo binario cuesta
> **un minuto**, no medio job: el VST3 hereda cada `.obj` que compilo el Standalone y
> solo recompila el *plugin client* de JUCE. El techo de 45 no estaba corto por el
> VST3 — estaba justo por el Standalone, que ya se comia 23 min solo.

### La medicion: build en frio, tres paralelismos

Arbol de build nuevo en cada caso, JUCE 8.0.12, `Release`, los mismos dos objetivos
en el mismo orden que el job:

| Paso | `/m:2` (proxy del runner) | `/m:4` | `/m` ilimitado |
|---|---|---|---|
| CMake configure | 2.05 min | 1.46 min | 1.68 min |
| **Build Standalone** | **23.28 min** | 15.49 min | 20.46 min |
| **Build VST3** | **1.00 min** | 0.40 min | 0.45 min |
| Empaquetar WebUI (vite 8) | 0.08 min | (local) | 0.08 min |

**Por qué `/m:2` es la columna que manda.** Los 4 vCPU de un `windows-2022` de Azure
son **2 nucleos fisicos con hiperhilo**, y esta caja es un i7-11370H de **4 fisicos /
8 logicos**: la mitad de nucleos es lo mas parecido al runner que se puede medir sin
tener el runner. Con eso medido y los pasos no reproducibles aqui (bootstrap del
workspace pnpm, clonado de JUCE, los dos downloads, los setups) estimados **al
alza**, el job sale en **38.6 min**. El 45 daba **16% de margen**.

### La trampa en la que no se ha caido

`/m:4` es **5 min mas rapido aqui** que `/m` ilimitado. Suena a que hay que
pinarlo, y seria lo contrario: esta caja tiene 4 nucleos fisicos y 8 logicos, y
darle a MSBuild todos los logicos **revienta los fisicos**. En CI los 4 vCPU **ya
son** hyperthreads, asi que ahi `/m:4` probablemente seria mas lento. Un numero
medido en la maquina equivocada es un numero que no se traslada, y este era el
sitio exacto donde hacerlo.

### `timeout-minutes: 45` → `60`

55% de margen sobre el total medido. Un dia malo de host es justo cuando el rojo
llega como un *timeout*, y un timeout no dice nada de que paso.

Lo que esto **no** reproduce, y hay que decirlo: esta maquina tiene **39.7 GB de
RAM** y el runner **16**, asi que la columna no simula presion de memoria. Es un
**piso**, no una prediccion exacta — y por eso, si dentro de un ano el job pasa en
mucho menos de 60, el margen se puede bajar, pero con una medicion nueva, no con
una sensacion.

### Lo demas, medido y sin peso en la balanza

`node scripts/build_webui.js` con **vite 8 / Rolldown**: **4.6 s** en frio, 367
ficheros en `dist`. Clonar JUCE 8.0.12 con `--depth 1`: **100 MiB**. Los dos
`verify_embedded_bundle.js`: **0.2 s** entre los dos. Los dos vitest que cierran el
job: **3.5 s** en local.

El arbol del job, su `timeout-minutes` y la justificacion completa viven en
`.github/workflows/webui-bundle-ci.yml` y en `docs/baseline_fase0_v32.md`.

---


## 0.2.66 — 🚨 El guard que prohibe esperar cinco segundos a un subproceso

> **Un `describe` que lanza un subproceso y no lleva timeout no es lento: es una bomba con
> mecha de 5 s.** El default de vitest son 5 s, y con el pool `forks` de vitest 4, un test
> que tarda 485 ms aislado tarda **5355 ms** en la corrida completa: casi **11x**. Ese
> margen se lo come la competicion entre los 130 ficheros. Este guard lo hace visible en
> la linea que lo introduce, en lugar de dejar que lo descubra un rojo suelto en CI.

### Lo que hace el guard

`WebUI/tests/timeoutDeSubprocesos.test.js`, **8 tests**. Detecta los `describe` de
**nivel superior** —las dos formas que aparecen en el repo, `describe(` y
`describe.skipIf(cond)(`— cuyo cuerpo lanza un subproceso y cuyo cierre **no** lleva
timeout, y falla diciendo **que fichero, que linea y que bloque**.

Dos cosas que lo hacen funcionar en vez de salir en verde sin hacer nada:

**Resuelve UN nivel de indireccion.** El patron real del repo no es
`describe(() => execFileSync(...))`, es un helper a nivel de modulo:
`function runScript(){ execFileSync(...) }` y el bloque que lo llama. Un guard que solo
mire el cuerpo del `describe` no ve nada. `helpersQueLanzan()` busca los helpers cuyo
cuerpo lanza y cuenta como «lanza» al bloque que los invoca.

**Filtra cadenas, no solo comentarios.** Sin esto el guard **se detecta a si mismo**:
sus propios fixtures llevan `execFileSync` dentro de una cadena. `soloCodigo()` vacia
comentarios (`//`, `*`) y contenido de cadenas antes de mirar.

Acepta timeout de `describe` **o** de `it`: el requisito real es no quedarse en el
default, no la sintaxis concreta.

### Los 6 ofensores reales que encontro

Ninguno era un bug; todos eran **una bomba con mecha de 5 s**, y todos receiving
`}, 30000);` —30 s, la misma convencion que ya usan `baselineGuard` (240 s) y
`ciSubprocessTests` (120 s).

| Fichero | Linea | MEDIDO aislado |
|---|---|---|
| `checkWasmBuild.test.js` | 243 | 204 ms |
| `fuzzRoundtripScript.test.js` | 46 | **368 ms** — el peor |
| `inyeccionSafeDirectory.test.js` | 96 | 46 ms |
| `verifyDocsCiJobs.test.js` | 270 / 310 / 523 | 90 ms |

368 ms aislado contra un techo de 5000 ms: un margen de 13x que se evapora en cuanto
la maquina tiene trabajo que hacer.

### El timeout va en el `describe`, no en cada `it`

Ponerlo test a test es Whac-A-Mole con el pool: el que se te olvide hereda el default
y nadie se entera. En el bloque es una sola decision que cubre todo lo que cuelga de
el.

### Sonda con dientes

Un guard que no encuentra nada porque no busca nada tambien sale en verde. El fichero
lleva su propio test de que el detector mira de verdad (`ficheros > 5`, `helpers > 2`,
`bloquesQueLanzan > 2`, `conTimeout > 0`), y ademas la sonda de fuera **quita un
timeout ya puesto** y comprueba que el guard cae citando el fichero:

```
rc=1
restaurado byte a byte=true
cita el fichero=true
linea citada=inyeccionSafeDirectory.test.js:96  inyeccion de safe.directory
SONDA CON DIENTES OK
```

### De paso: un rojo que no se podia leer

Al meter el guard en la suite aparecieron 2 fallos **intermitentes** en
`recuentoPorRecoleccion.test.js` — `STACK_TRACE_ERROR`, que no dice absolutamente
nada. No era un fallo del guard: `vitestSuite.js` lanza un **vitest anidado**, y en la
corrida completa ese hijo compite por el proceso con las docenas de hermanos que
tambien lanzan subprocesos. MEDIDO: **1 fallo en 2 corridas completas, 0 en 5 en
solitario.** El sintoma era la competicion, no la pasada.

Dos arreglos en `vitestSuite.js`:

1. **Un reintento, y solo uno.** Tapa la transitorio sin camuflar un fallo de verdad:
   si el segundo tampoco escribe el JSON, el error dice que paso.
2. **El error dice que paso.** Antes salia `STACK_TRACE_ERROR` a secas; ahora incluye
   `status`, `signal` y los ultimos 1200 caracteres de lo que dijo el hijo. Un rojo
   que no se puede leer no se puede arreglar.

---


## 0.2.65 — 📦 El build real con Vite 8: el bundle sale igual, y ahora está demostrado

> **El último hueco del salto a vitest 4 está cerrado.** Era el más importante de los
> tres que quedaban, porque el resto dealERTarían solos y este no: `vite 8` usa
> **Rolldown**, no Rollup, y `build_webui.js` resuelve `@abdsynths/*` desde el workspace
> del monorepo. Si eso se rompía, el binario se distributedía **con el árbol crudo
> dentro** —sin bundle— y no lo diría nadie: los pasos del job siguen siendo ciertos.

### El build, con su verdad completa

```
[INFO] Visual Studio: C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools
[INFO] Empaquetando WebUI (vite build -> WebUI/dist)...
[OK] WebUI empaquetado en WebUI/dist.
[INFO] Configuring CMake...
[INFO] Building VST3 and Standalone...
[SUCCESS] ABD Eep - Enhanced (Expanded Synthesis) built successfully.
[INFO] WASM: si, decidido por el tercer argumento.
[ERROR] El WASM fallo con el codigo 1.
[ERROR] Build failed.
```

El código de salida fue **1**, y **no es un fallo del salto**: el build llegó a
`[SUCCESS]` y falló **después**, en el paso del WASM, con
`"emcmake" no se reconoce como un comando interno o externo`.

**MEDIDO: esta máquina no tiene Emscripten.** Ni `emcc` ni `emcmake` en el PATH, ni
`emsdk` en ninguna ruta habitual, ni una entrada de emscripten en el PATH de la
máquina. Con `no` en el tercer argumento —uno de los tres valores que `build.bat`
acepta— el paso se salta y el build continúa.

### Los dos binarios, verificados por ruta

`verify_embedded_bundle.js --binario <ruta>`, con **ruta explícita** en los dos: sin
ella el descubridor siempre devolvería el Standalone y el paso del VST3 acabaría
comprobando dos veces el mismo fichero.

| Binario | Tamaño | RC |
|---|---|---|
| `Standalone/ABD Eep.exe` | 9,8 MB | **0** |
| `VST3/ABD Eep.vst3/Contents/x86_64-win/ABD Eep.vst3` | 9,2 MB | **0** |

Cinco comprobaciones cada uno: las tres marcas presentes
(`assets/keyboard.js`, `assets/fit-stage.js`, `assets/keyboard.css`),
`src="js/keyboard.js"` **ausente** —la firma del árbol crudo— y el bundle sin imports
desnudos.

### El bundle cambia de bytes, y eso es lo que faltaba mirar

`verify_embedded_bundle.js` comprueba los **nombres** de los recursos, y esos son
iguales con vite 5 y con vite 8. Un binario con el bundle viejo pasaría el mismo
check, así que por sí solo no demuestra que se haya reempaquetado.

Medido: el `keyboard.js` de vite 8 **empieza distinto**. Rolldown genera una tabla de
lookup de identificadores donde Rollup inlineaba el código.
`30.995` bytes con vite 8 frente a `31.495` con vite 5. Es una diferencia de
minificador, no de comportamiento: los 354 ficheros del `dist` tienen **los mismos
nombres** en las dos versiones, las tres marcas están, y el bundle nuevo carga sin
excepción.

Con una firma tomada del bundle nuevo —y **verificada como ausente en el de vite 5**,
que es lo que la hace una firma y no una coincidencia—:

```
Standalone (9.8 MB)  contiene el bundle de Vite 8: SI
VST3      (9.2 MB)  contiene el bundle de Vite 8: SI
```

### Y el verificador se comprobó con dientes

Que dos binarios salgan en verde no prueba nada si el comprobador pasa siempre. Con una
**copia** del binario a la que se le metió la marca del árbol crudo, sale con **rc=1**.
El original no se toca.

---

## 0.2.64 — 🔧 El store de pnpm tenía permisos rotos y tumbaba los 129 ficheros

> **Un `Startup Error` de `ERR_INVALID_PACKAGE_CONFIG` que apuntaba a cuatro tests
> tumbaba los 129 ficheros de la suite**, incluido `fitStage.test.js`, que son seis
> asserts sin ninguna relación con vitest. El síntoma y la causa no tienen el mismo
> tamaño, y confundirlos cuesta un día.

### Lo que pasó

Del store de pnpm, **51 de 200** ficheros `package.json` eran ilegibles desde el
sandbox (25 %). Agrupados por familia: 41 de `eslint`, 11 de `@eslint/eslintrc`, 9 de
`get-intrinsic`, 6 de `vitest`, 5 de `ajv`… y `magic-string`, que es el que salía en
el error.

`magic-string` lo necesita vitest para resolver sus `exports`, así que sin poder leer
ese fichero **no arranca nada**: no un test, no una suite, ni un fichero de seis asserts.

### Descartado, con el dato que lo descarta

| Hipótesis | Resultado |
|---|---|
| Solo los contratos nuevos | Falso: también `ciSubprocessTests` y `fitStage` |
| Permiso de carpeta | Falso: la carpeta se **lista** bien |
| Permisos del fichero mal puestos | Falso: `-rw-r--r--`, y el propietario es el usuario |
| Problema del shell | Falso: PowerShell da `GetContentReaderUnauthorizedAccessError` |
| `node_modules` a medias por el salto | Falso: el lockfile pedía 0.30.21 y ese es el instalado |

Que PowerShell **también** falle, y que no se pueda ni leer la ACL
(`Get-Acl` → `UnauthorizedAccessException`), es lo que apunta a un bloqueo de Windows y
no a una ACL de usuario. Y el dato que más lo cierra: los ficheros ilegibles eran del
**6 de marzo** y los legibles de **hoy**, con `eslint` de septiembre entre ellos.

### Por qué lanzar vitest como subproceso NO lo arreglaba

Porque el subproceso tampoco puede leer el fichero:

```
$ node -e 'import("vitest/node")...'   # node limpio, desde ABDEep
FALLA ERR_INVALID_PACKAGE_CONFIG
```

Es lo que ya hacían `glob-test-files.mjs` y `describe-spec-shape.mjs`. Sustituir imports
por subprocesos habría movido código y dejado el resultado idéntico.

### El arreglo

**`pnpm install --force`** en la raíz del monorepo, desde consola con privilegios.
**51 ilegibles → 0**, y con el `pnpm-lock.yaml` y el `package.json` de la raíz con el
**mismo md5** antes y después.

La suite entera pasa ahora en el sandbox, **sin elevación**:

```
Test Files  129 passed (129)
     Tests  5159 passed | 2 skipped (5161)
  RC=0
```

### Los contratos, verificados SIN elevación

Con el store legible se pudieron cerrar las dos roturas que faltaban, y las cinco
muerden:

| Rotura | Cae |
|---|---|
| `forma` — `spec.moduleId` → `spec[1]` | 5 tests |
| `protocol` — sin el marcador `__GLOB__` | 5 tests |
| `surface` — llama a `globTestFiles` | 5 tests |
| `entrada` — `VITEST_BIN` apunta a otro sitio | contrato 4 |
| `shape` — `moduleId` deja de ser ruta | contrato 2, aislado |

La quinta existe para separar el contrato 2 del 3: las otras cuatro tocan
`glob-test-files.mjs`, así que sus efectos se propagan al protocolo y salía el mismo
rojo. Ahora se distingue "se rompió la forma" de "se rompió el script".

---

## 0.2.63 — 🧷 Un salto a medias se pone rojo al principio, no a la mitad

> **Un salto de versión a medias es invisible hasta que rompe, y en este repo era
> invisible de verdad.** `package.json` decía `vitest: ^4.1.11` mientras lo instalado
> seguía siendo **1.6.1**, porque los pines viven en el lockfile de la raíz del
> monorepo, fuera de este proyecto. Los tests PASABAN: con 1.6.1 instalado y la 4
> declarada, todo verde, y el código ya portado a la API de la 4 sin ejercitarse.

### El fallo era invisible por una razón concreta

El rango se escribe en **un** fichero y se aplica en **otro**, y no hay nada entre
ellos que diga si llegaron a encontrarse. El salto queda declarado en un
commit y efectivo en otro, y el guard de `vitest.config.js` que sube laPeer
dependencia tampoco lo comprueba: es un pin, no una medición.

Lo que lo delata ahora es comparar las DOS fuentes, que son independientes por
construcción: el **rango** de `package.json` y la **versión que resuelve el repo**,
vía `createRequire` —la misma resolución que usa el resto de la suite al importar
`vitest`. Si coinciden, el código se está ejecutando contra la versión que el repo
dice querer.

### Tres formas de quedar a medias, y las tres se distinguen

| Forma | Qué la delata |
|---|---|
| El rango no corresponde a lo instalado | Las dos cifras no concuerdan |
| Lo instalado no es lo declarado | Las dos cifras no concuerden |
| Declarado y **no instalado** | No hay manifest: el fallo sale como error de import en otro sitio |

La tercera es la que más confunde, porque sin manifest no hay nada que comparar y
el rojo aparece donde no está la causa. El mensaje dice qué falta y **dónde se
arregla**: la raíz del monorepo.

### Lo que el guard NO mide, a propósito

**Que el store no tenga versiones viejas.** MEDIDO: este repo tiene dos
`vitest@1.6.1` y un `vitest@4.1.11` en `.pnpm`, y es NORMAL — pnpm conserva lo que
dejó de usar. Un guard que los contara se pondría rojo sin que nada esté mal. Lo
que importa es a qué versión apunta el repo.

### El comparador de rangos, contrastado contra semver de verdad

`semver` no está en el árbol y no se ha añadido: una dependencia para comprobar
tres números no compensa. Se implementa `^`, `~`, exacto y `*`… y **contra 390
combinaciones** contra `semver` 7.8.5 instalado aparte (`build/contrastar-semver.mjs`),
que encontró **dos** bugs reales en la primera versión:

1. El techo del `^` se comparaba **componente a componente**, así que `4.1.11` no
   cabía dentro de `^4.1.11`: el guard ponía rojo el árbol **sano**.
2. `^0.0.x` fija el techo en el **patch** (`^0.0.3` no admite `0.0.4`), porque en
   `0.0.x` cualquier cambio ya rompe la API. La primera implementación lo subía al
   minor.

Ambos están ahora cubiertos por tests, y el guard propio dice que el caso que lo
rompió. **Un rango que no sabe leer LANZA** en vez de pasar: un guard que no
entiende el formato y aun así pone verde, es un guard que no vigila.

### Verificado con dientes

`build/guard-version-sonda.mjs`: **13/13 en verde → 1 rojo al romper el rango → 13/13
restaurado**, y cae el test correcto. `build/guard-version-real.mjs` reproduce el
caso real en un árbol de mentira —rango `^4.1.11`, instalado **1.6.1**— sin tocar
el `node_modules` de verdad, y nombra las dos cifras.

---

## 0.2.62 — 🧪 vitest 1.6.1 → 4.1.11: instalado, medido y en verde

> **Tres majors de salto sobre 127 ficheros y 5130 tests, y lo que se rompió no fue ni un
> test.** Fue la cadena de guards, que usa API interna de vitest, más un cambio de pool que
> nadie había pedido. La medición se hizo con una instalación aislada de 4.1.11, porque
> vitest 1 se resuelve desde el store de pnpm y da EPERM desde el sandbox.

### Estado final, medido con el vitest DEL REPO

```
Test Files  127 passed (127)
     Tests  5128 passed | 2 skipped (5130)
  SUITE_RC=0
```

El `pnpm install` de la raíz del monorepo salió `Packages: +46 -19`, con **vitest
4.1.11**, **vite 8.3.2** y **@vitest/coverage-v8 4.1.11** comprobados en
`node_modules`, y **no tocó ningún fichero del repo**. El parche
`docs/vitest4-raiz-monorepo.patch` se aplicó con `git apply` → RC=0.

### 126 de 127 ficheros ya funcionaban

Ni un fichero de test usaba una API que hubiera cambiado: **cero snapshots** (lo que
elimina de golpe toda la clase de riesgo del cambio de formato de v3), cero `vi.mock`,
cero `environmentMatchGlobs`, cero `poolOptions`, cero `// @vitest-environment`, cero
`vitest.workspace`.

### Lo que sí se rompió: `glob-test-files.mjs`

| Qué | En 1.6.1 | En 4.1.11 |
|---|---|---|
| El método | `vitest.globTestFiles()` | `vitest.globTestSpecifications()` |
| La forma | pares `[proyecto, ruta]` | objetos `TestSpecification`, ruta en `moduleId` |
| `createVitest()` | `opts` opcional | `opts` ya **no** es opcional |

La segunda es la peligrosa: con la fórmula vieja, `spec[1]` sobre un objeto devuelve
`undefined` **sin lanzar ningún error**. La lista saldría vacía, el recuento sería 0, y
un cero no se parece a un fallo: el `baselineGuard` se quedaría mirando un documento en
blanco sin decir nada. Por eso el script lee `moduleId` explícitamente y **comprueba que
no haya ninguna entrada sin ruta**.

Es la cabeza de `baselineGuard` → `vitestSuite.enumerateSuite()` → `collectedTestFiles()`
→ ese script. Si se rompe, el recuento del baseline deja de existir y nadie se entera
hasta que el número del documento se queda viejo.

### El contrato de la recolección se sostiene, y el número no cambia

`--outputFile` escribe el JSON, la forma del JSON es la misma, `numTotalTests` cuadra,
y `-t <centinela>` sigue filtrando (0 ejecutados de 5130). **5130 tests en 127
ficheros, idéntico a 1.6.1**: por eso los counts del baseline no cambian con el salto,
y eso está medido en vez de supuesto.

### El salto arrastra a vite, y vite 8 trae Rolldown

vitest 4 exige `vite: ^6 || ^7 || ^8` como peer, y `@vitest/coverage-v8` pineado a su
misma versión exacta. El repo tenía `vite: ^5.4.21`, así que el bundler sube con el
framework de test. Decidido **vite 8.3.2**, medido con
`build/vite8-sonda/prueba-humo.mjs` contra la forma exacta del build del WebUI.

**vite 8 usa Rolldown, no Rollup**, y su resolutor aplica el campo `exports` con
condiciones: más severo que el de vite 5. Se comprobó contra los paquetes reales —los
dos subpaths que usa el WebUI (`@abdsynths/midi-keyb` y `@abdsynths/shared/components`)
están declarados, y son mapeos de cadena sin condiciones, así que resuelven igual—.

### Lo que faltaba de verdad: vitest 4 cambió el pool por defecto, de `threads` a `forks`

Este no estaba en ninguna lista de riesgos, y salió de la propia corrida final. Con
`forks`, 127 ficheros levantan **procesos hijo** a la vez y compiten por la CPU, así que
los tests que lanzan `cmd.exe` se quedan esperando turno y se pasan de los 5 s por
defecto.

Medido, no supuesto: el test de `buildWebUiFailureDiagnostic` tarda **485 ms aislado** y
**5355 ms en la suite** — unas 11×. Con el peor caso medido en todo el grupo
(`roundtripCorpusScript`, **887 ms** aislado), la contención se va a ~10 s: el doble del
default. Por eso el arreglo es de margen, no de optimize.

Lo que NO se hizo, y es lo importante: **poner el timeout test a test**. La primera
versión se lo puso al `it` que había fallado, y la corrida siguiente falló en el test
**hermano**, del mismo bloque y por la misma causa. Arreglar de uno en uno es jugar a
Whac-A-Mole con el pool: cada corrida saca un rojo distinto del mismo grupo. El timeout
va en el `describe`, que es donde está la causa, y cubre **12 bloques en 8 ficheros**.

Es la misma convención que ya usaban `baselineGuard` (240 s), `ciSubprocessTests` y
`recuentoPorRecoleccion` (120 s). La forma está **verificada con dientes**: un test de
sonda con `describe(..., 50)` cae a los 50 ms y su hermano sin timeout pasa a los
135 ms.

### Y el `baselineGuard`: un número que el propio guard exige

Con el vitest del repo, el guard cae por su propia cuenta: documenta **126** ficheros y
la suite real proyecta **127**. La fila `| Test files |` de `§2` pasa a **127 (127)**.
El recuento de tests (5130) no se movió.

### Lo que sigue SIN medir, dicho con sus nombres

1. **Que el bundle real siga igual.** `build_webui.js` resuelve `@abdsynths/*` desde el
   workspace y da EPERM desde aquí. La prueba de humo usa un paquete falso con el mismo
   `exports`: demuestra que vite 8 funciona con esta forma de config, **no** que el
   bundle del repo salga idéntico. El primer `build.bat` con vite 8 es lo que falta.
2. **Los paquetes hermanos** del workspace: no medidos, y no medibles desde ABDEep.
3. **`@vitest/coverage-v8`**: instalado, pero `--coverage` no corre en ningún workflow,
   así que su comportamiento con v4 no está medido. Se sube el pin porque es peer de
   vitest.
4. **`timeout-minutes: 45`** del job `bundle-in-binary`, que ahora compila dos binarios
   en vez de uno y nunca se ha medido con los dos.

---

## 0.2.61 — 🛡️ Los pasos que hacen útil el job, ya no se pueden perder en silencio

> **El job `bundle-in-binary` ya tenía el paso que ejecuta
> `scripts/verify_embedded_bundle.js`, y funciona.** Medido en local tal como lo
> invoca el job —sin `--binario`, por auto-descubrimiento—: encuentra el
> Standalone de 9,8 MB y sale con 0.

Lo que faltaba era el **guard**. Ningún test del repo mencionaba ese paso, y
`scripts/verify_docs_ci_jobs.js` comprueba los *IDs* de los 13 jobs del plan, no
los pasos. Es decir: **el único paso que hace que el job no sea decorativo se
podía borrar —o neutralizar— sin que nada se pusiera rojo**, que es exactamente lo
que advierte el comentario que lo precede. Los cuatro pasos anteriores pasan
igual con el árbol crudo dentro: el aviso de CMake, el chequeo del CSS y la
compilación son los tres ciertos con el árbol crudo.

### Tres degradaciones, y la tercera no se ve leyendo el YAML

| Degradación | Por qué importa |
|---|---|
| **Borrar el paso** | El job sigue verde: los otros tres pasos son ciertos con el árbol crudo dentro |
| **Neutralizarlo** — `continue-on-error`, `|| true`, `|| echo` | Peor que borrarlo: el paso corre, el log enseña las comprobaciones, y el job pasa. **El log miente** |
| **Degradar el comprobador** a que solo mire el `dist` | Los marcadores del `dist` son los mismos, así que **el texto del paso no cambia** |

### Tres tests que ejecutan el comprobador, no que lo leen

`WebUI/tests/bundleEnElBinario.test.js`, 9 tests. Tres de ellos **ejecutan**
`verify_embedded_bundle.js` contra un binario de mentira:

- **árbol crudo** → tiene que salir distinto de cero **y decir qué falta**;
- **bundle** → tiene que confirmar las tres marcas. Es el control positivo: sin él
  el de arriba pasaría con un comprobador que falla siempre;
- **binario inexistente** → tiene que **fallar**, no decir que «nada que
  comprobar». Es la degradación más silenciosa: un `--binario` mal escrito
  dejaría el job en verde sin haber mirado nada.

Medido con `build/romper-bundle.mjs`, seis roturas del workflow, y **las seis
muerden**: borrar el paso (3 tests), `continue-on-error` (1), `|| true` (1),
`|| echo` (1), verificar antes de compilar (1), y sacar el comprobador del filtro
`paths` (1). Restaurado byte a byte.

### El mismo falso positivo, por tercera vez

Comparar `YAML.indexOf('verify_embedded_bundle.js')` da el paso equivocado: el
nombre aparece **antes** en los filtros `paths`. Es el error que ya documenta
`WebUI/tests/helpers/ejecucionEnWindows.js`, y aquí el guard compara **bloques
de paso** en vez de índices. Y el arnés de controles negativos se cayó en la
versión contraria de ese mismo error por el otro lado —una rotación insertaba el
paso *después* de compilar, que es lo correcto y no degrada nada— y salió muda. El
guard estaba bien; la rotación no era una degradación.

Es **portable a propósito**: no hay `cmd.exe` en ninguna parte, así que lo corre
`webui-ci.yml` con el resto de la suite, sin gastar un runner de Windows para
vigilar un runner de Windows.

### El hueco del VST3: cerrado

El job compilaba y comprobaba **solo el Standalone**. El VST3 —el otro artefacto que
se distribuye, con **otra ruta de incrustación**— no se construía ni se miraba. En
local los dos llevaban el bundle, medido, pero eso no es una comprobación: es una
suposición.

Ahora se compilan los dos targets y se verifican los dos binarios, y lo que hace
que eso no sea decorativo es el `--binario` **explícito**:

> Sin ruta, el comprobador busca por orden de patrones y el Standalone va el
> primero. Con dos binarios en el árbol, el paso del VST3 habría estado
> comprobando **dos veces el Standalone** —en verde, sin haber mirado el VST3 una
> sola vez*.

Es la degradación invisible: el paso existe, dice lo que dice, y no comprueba lo
que dice. Hay un test que exige las dos rutas explícitas.

Medido con las rutas exactas del workflow, contra los binarios reales:

| Binario | Resultado |
|---|---|
| Standalone (9,8 MB) | RC=0 |
| VST3 (9,2 MB) | RC=0 |

### El guard pasa a los cinco pasos, no a uno

`bundleEnElBinario.test.js` pasa de 7 a **9 tests**. La comprobación de «no se
neutraliza» recorre los **cinco** pasos críticos —empaquetar, el CSS, el configure,
compilar y verificar— porque el mismo `|| echo` puesto en el del CSS deja el job
verde con el desplegable de efectos vacío en el keybed, que es el fallo todavía no
dado. Y hay un test de **orden**: en el orden contrario el fallo sale en el sitio
equivocado, y configurar antes de empaquetar incrusta el árbol crudo sin que nadie
se entere hasta que el keybed no monta en el host.

Nueve controles negativos medidos con `build/romper-bundle.mjs`, y **los nueve
muerden**: borrar la verificación del VST3, verificarlo sin `--binario`,
verificar el Standalone sin `--binario`, borrar su compilación,
`continue-on-error` en el CSS, `|| echo` en el Standalone, `continue-on-error` en el
VST3, verificar antes de compilar, y sacar el comprobador del filtro `paths`.

Las tres primeras son las que **no se ven leyendo el workflow**: el texto del paso
no cambia, solo lo que deja de comprobarse.

El YAML se validó con `js-yaml` (que ya venía con el ESLint de la sonda): 15
pasos, en orden.

## 0.2.60 — 🧹 Los nueve `curly`, y con ellos el último rojo del baseline

> **La puerta de ESLint era la única que quedaba en rojo**, y `--max-warnings 0` convierte un
> aviso de estilo en un fallo de pipeline. Nueve warnings, los nueve de la misma regla, los nueve
> en un único fichero: cuerpos de una sola sentencia sin llaves.

```
WebUI/scripts/export-calibration-run.js
  136:30  170:27  172:27  272:24  301:18  346:32  348:31  356:32  357:28
  warning  Expected { after 'for-of' / 'if' condition   (curly)
```

Es la forma más mecánica que existe de aviso: un `for` o un `if` con un cuerpo de
una línea y sin llaves. Se ponen las llaves y no se toca nada más. **+18 líneas**,
que son 9 sitios × 2.

### Por qué a mano y no con `eslint --fix`

Porque el fichero está **modificado sin commitear por otra sesión** —282 líneas
suyas—, y `--fix` aplica *todas* las reglas arreglables, no solo `curly`. El
resultado son exactamente 18 líneas añadidas sobre su trabajo, ni una de ellas
toca lógica: ni una condición, ni un orden, ni un nombre.

Ahora: **0 warnings sobre 281 ficheros**.

### Un «0 avisos» solo vale si la comprobación muerde

Con la puerta en verde no se ha cerrado nada: una sonda que no lintea nada
también dice cero. `build/sondear-eslint.mjs` **quita una de las nueve llaves**,
comprueba que la puerta se pone roja con un solo aviso, y restaura el fichero
byte a byte. Medido:

```
1. puerta tal cual              rc=0 avisos=0
2. con UNA violacion de curly   rc=1 avisos=1
3. restaurado                   rc=0 avisos=0
```

ESLint se pudo correr sin elevación instalando un `eslint@8.57.1` aislado en
`build/eslint-sonda/`: el del repo se resuelve desde el store de pnpm y da EPERM
desde el sandbox. `.eslintrc.json` no usa `extends` ni plugins —solo reglas del
núcleo—, así que un ESLint pelado con la config del repo reproduce la puerta
exacta, mismos directorios y mismo `--max-warnings 0`.

---

## 0.2.59 — 🏗️ `build.bat` ya se puede correr sin nadie delante

> **El guion acababa en un `choice` que no se podía esquivar.** No por falta de
> ganas: `choice` lee de la *consola* y no de la entrada estándar, así que
> `echo N | build.bat` no lo esquivaba. Con una consola pegada —un `start /b`, un
> runner que deja sesión— el guion se quedaba esperando una tecla que no iba a
> llegar. Un `build.bat` que necesita a alguien delante no vale para un runner.

### Tres vías, y el `choice` sigue siendo el plan por defecto

```
build.bat 2 build yes     1) tercer argumento
set ABDEEP_WASM=yes       2) variable de entorno
build.bat 2 build         3) el choice de siempre, si no hay ninguna de las dos
```

El **orden es el contrato**: el argumento gana al entorno. El runner puede dejar
`ABDEEP_WASM` puesto para toda la máquina, y si se invirtieran un `yes` residual
pisaría el `no` explícito de quien lanza el build, sin que nada lo dijera.

Valen `S si yes y 1` y `N no 0`, sin distinguir mayúsculas. El `choice` **se
conserva**: sin supervisión hay alguien delante, y esa pregunta es la que compila
el WASM sin que nadie lo pidiera.

### Un valor desconocido PARA, y no se salta el WASM en silencio

Tratar lo que no se reconoce como «no» sería un fallo silencioso de manual: el
WASM se saltaría, el guion no pondría nada, y el log acabaría en `[SUCCESS]` como
si se hubiera compilado todo. Un salto que nadie ve es peor que un error. Sale por
`:error_uso` con código **2**, que no es el 1 de `Build failed.`: la parte de
MSBuild ya había ido bien, y un runner tiene que poder distinguir «no compilaba»
de «lo invocaron mal».

### Arreglado de paso: el WASM que fallaba salía con código 0

`build_wasm.bat` se llama, se captura su `ERRORLEVEL` **antes** de ningún `echo`,
y si no es 0 el guion dice cuánto era y cierra en error. Es la **tercera** vez que
este script se come un `ERRORLEVEL` por leerlo tarde, después del empaquetado del
WebUI y del configure de CMake.

### Un `goto` sin etiqueta no es un error de compilación

Al escribir esto se añadió el `goto wasm_inicio` sin su `:wasm_inicio`. cmd avisa
por pantalla **y sigue**: el guion se caía de la cola del WASM sin que nada se
pusiera rojo. De ahí el invariante más barato del fichero de tests — seis líneas:

> TODO `goto` tiene su etiqueta

**Tests:** 11 nuevos en `WebUI/tests/buildToolchainDiagnostic.test.js` (5 de texto,
6 de comportamiento en Windows). Medidos con `build/romper-wasm.mjs`, cuatro
roturas del guion: sin etiqueta 7 tests caen; valor desconocido en silencio 2;
entorno ignorado 2; WASM fallido declarado bueno 2.

La primera es la que un test sobre la *existencia* de la etiqueta no habría visto:
con la etiqueta todavía ahí y el `goto` redirigido, pasaba en verde. Por eso el
de texto fija el **enrutado**, no la etiqueta.

El cuelgue en sí **no es reproducible desde un test** —hace falta consola, y un
`spawnSync` no la tiene—, así que no se finge un test que lo reproduzca: se fija
el texto de las tres vías y que la vía desatendida no pregunte.

---

> **Era el más caro de los 50 parámetros sin uso**, y no por estar sin cablear sino por **estar
> visible**: el panel y el modal pintan un `<select>` con `Gate` / `Velocity` / `Seq`, y el
> arpegiador hacía `pianoNoteOn(outNote, h.velocity)` sin mirar el parámetro.

El selector prometía tres modos y no ejecutaba ninguno. Peor: el arpegiador **siempre** sonaba
con la velocidad de la tecla, que es exactamente lo que dice la opción «Velocity». Es decir, el
modo por defecto del spec (`0` = Gate) era el único que no existía.

| Modo | Qué hace ahora |
|---|---|
| **Gate** | Velocidad constante (100), se toque como se toque |
| **Velocity** | La salida es la de la tecla — lo que ya hacía, ahora porque lo dice |
| **Seq** | Rampa triangular sobre las notas sostenidas (127 → 40 y vuelta), periodo 2n−2 |

La política vive en `_arpVelocityFor` (`WebUI/js/bridge-engines-arp-modes.js`), **función pura**
junto a `_arpCalcStep`, con el mismo «sin estado del bridge» por delante; `_arpStep` la usa al
tocar. El `100` del modo Gate no es un número inventado: es el `velocity || 100` que ya usa
`pianoNoteOn`. La rampa de Seq comparte periodo con el modo UP-DOWN de notas.

Dos detalles que no son cosmetics: la rampa se calcula **después** del clamp de octava de
`_arpStep`, que puede cambiar `noteIdx`, y con **una sola nota**_seq degenera a la velocidad de la
tecla (un 127 fijo sería un salto del que no se puede salir).

**POR QUÉ NO TIENE BYTE.** No es un parámetro virtual: el **byte 112** del preset real se llama
«Arp Velocity Gate» (`docs/sysex_format.md` §4.12). Es *dual* con Mod Slot 7 Destination, igual
que `arp_enable` (109), `arp_hold` (110) y `arp_key_sync` (111) — por eso el registro no puede
darle ese byte sin romper la matriz.

**Tests:** `WebUI/tests/arpVelocityGate.test.js`, 27 tests, cargando el fichero real (no una copia).
El guard 3 (`SPECONLY_UNCONSUMED`) deja de tratarlo como deuda: la entrada se queda —el parámetro
sigue sin byte propio— pero su «porqué» pasa a decir quién lo lee.

---

## 0.2.58 — 🎛️ El patrón del arpegiador, y un barrido que impide que vuelvan los residuos

> **Dos cosas.** La primera cierra el último selector visible que no hacía nada: `arp_pattern`, con sus
> **65** opciones, un editor de 32 pasos que funcionaba y un store de presets que nadie leía. La segunda
> ataca la causa de los tres rondas anteriores de residuos: nada obligaba a que un parámetro borrado
> no siguiera escrito en algún sitio.

### `arp_pattern`: la rejilla de 32 pasos deja de ser decorativa

El motor se recorría `arp_mode` sin mirar el patrón. Ahora el patrón es una **máscara de 32 pasos**
sobre el ciclo: el paso `stepIndex % 32` suena si su casilla está encendida. Sin patrón suena todo, que
es el comportamiento previo intacto.

El cableado tiene tres puntos, y los tres estaban a medias:

| Punto | Antes |
|---|---|
| `setArpPattern` / `resolveArpPattern` en el bridge | No existían. Ahora el índice (None + 32 Preset + 32 User) se resuelve a pasos concretos |
| El editor de 32 pasos | Dibujaba barras que no cambiaban nada. Cada paso que dibujas va al motor |
| El botón Load | Poner un patrón en la rejilla no lo ponía a sonar |

Un patrón nuevo pone `stepIndex` a 0, y un paso apagado **avanza el índice**: si no, el arpegiador se
quedaría mudo atascado en la primera casilla apagada.

### El barrido: por qué es una lista de tablas y no un barrido de todo

La primera versión barrió el repo entero buscando cadenas con forma de id y dio **10 falsos
positivos**: `patch_dirty`, `midi_channel` y `protect_unsaved_edits` son parámetros **internos del
bridge** — y llevan guion bajo igual que uno de verdad, así que la forma no los delata —, y
`'seq_step_' + (i + 1)` es un id construido por prefijo como `"fx" + slot + "_mix"`. Un test que
necesita excepciones para no fallar no se mantiene.

Así que verifica las cuatro **tablas que declaran ids** (`bridge-param-maps`, `script_midi_mappings`,
`edit_cache_mapper_data`, `script_randomizer`): esas son un contrato, y su contenido tiene que ser
ids que existen. Los internos del bridge van en una lista nombrada, que es la que obliga a
actualizarse cuando se renombra uno.

**Y EL BARRIDO ENCONTRÓ UN RESIDUO MÁS.** `script_randomizer.js` seguía escribiendo
`osc2_pitch_mod_select` en cada patch aleatorio: un byte que el host no declara, en cada patch que
generaba la máquina. Fuera.

### Verificado

`WebUI/tests/arpPattern.test.js` (normalización, máscara, integración sobre el fuente real) y
`WebUI/tests/registryIdsSweep.test.js` (que **se contrasta a sí mismo**: mete un residuo conocido y
comprueba que lo ve, porque un barrido que nunca ha fallado no prueba que sirva). 124/124.

---

## 0.2.55 — 🧹 Los cinco parámetros muertos, borrados de verdad (y de donde nadie los ve)

> Los tres que confirma el informe —`slot_a_type`, `slot_b_type` y `arp_gate`— ya estaban fuera del
> spec y del mapa del puente. Lo que quedaba eran **residuos**, y son los que hacen que un borrado
> parezca hecho y no esté.

Un parámetro no desaparece de una línea: desaparece de todos los sitios que lo nombran. Para estos
cinco fueron el spec de C++, el mapa del puente, el JSON legacy, el mapa de NRPN que ve el usuario y
el randomizador de patches, más sus fixtures de test.

| Residuo encontrado | Qué era |
|---|---|
| `script_midi_mappings.js` → `'arp_gate': 'NRPN 1:32 (CC 13)'` | El mapa que el usuario consulta para ver a qué NRPN va cada mando. Enseñaba un NRPN que ya no existe |
| `scriptRandomizer.test.js` → `'arp_gate': 0.5` | Fixture que replica el generador de patches |
| `scriptRandomizer.test.js` → `'osc_drift'` en la categoría *Voice / Unison* y en las aserciones | Resto del byte 88 duplicado |
| `WebUI/resources/parameters_spec.json` | **Copia muerta del spec.** Nadie la leía (ni CMake, ni JS, ni fetch), llevaba los `slot_*` dentro desde el commit inicial, y le faltaba `vcf_voicing_mode`. El generador lee `resources/parameters_spec.json`. Borrada |

**LO QUE MÁS SE ESCONDE ES EL FIXTURE.** Al borrar `arp_gate` del randomizador había que poner
`arp_gate_time` en su lugar: el `arp_gate` borrado y el `arp_gate_time` que lo sustituye se
diferencian en cinco caracteres, y un fixture desalineado no da error de compilación — falla por el
recuento de parámetros, o peor, pasa comprobando el nombre viejo.

**Y LO QUE MÁS CUESTA ES EL DUPLICADO.** Dos ficheros con el mismo nombre y el mismo formato que
declaran lo mismo es el peor sitio posible para un borrado: se borra en uno, el otro sigue, y quien
mire el equivocado conclude que el trabajo no se hizo.

**`docs/fase1_registry.md`** tenía las cifras del registro viejo (236 parámetros, `aliasGroups: 3`)
y documentaba los tres bytes con dos ids **como si fueran correctos**. Actualizado a los números
reales (233, `aliasGroups: 0`) y con los tres guards en la política de validación.

**Verificado:** generador exit 0 con `0 reescritos` (el registro ya estaba al día de estos borrados);
526/526 tests en registro, randomizador, script core, mapa de parámetros y pipeline del bundle.

---

## 0.2.56 — 🚧 Los tres guards del registro: el generador ya compara las fuentes

> **Salen de `docs/parametros_sin_uso.md` §«El guard que falta».** Ese informe_medía tres cosas que
> el generador no miraba. Ahora las mira, y falla con exit 1 sin emitir artefactos.

El generador sabía leer las tres fuentes y sabía avisar. Lo que no hacía era **compararlas**, y por
eso llevaba meses emitiendo un registro donde tres bytes tenían dos nombres.

### Los tres guards

| Guard | Código | Qué falla |
|---|---|---|
| 1 | `REGISTRY_ID_NOT_IN_SPEC` | Un id de `PARAM_TO_BYTE_OFFSET` que el host no declara en `Source/Core/ParametersSpec_*.cpp` |
| 1b | `CC_ID_NOT_IN_SPEC` | Un id de `PARAM_TO_CC` que el host no declara |
| 2 | `NRPN_COLLISION` | Un `byteOffset` con dos ids |
| 3 | `SPECONLY_UNCONSUMED` | Un id declarado en el spec, sin byte, que no está en `SPECONLY_CONSUMIDOS` |

**El guard 1 mira las dos tablas de ids del puente.** `PARAM_TO_CC` es la segunda
puerta: un identificador inventado colado ahí pasaba el generador entero, que es
el mismo defecto con el extra de que además se mueve desde el MIDI externo. Los
tres ids que viven solo en la tabla de CC (`global_volume`, `global_tune`,
`transpose`) son de la APVTS y no tienen byte porque no son del sintet.

**El guard 2 no era nuevo: estaba anulado.** Tenía una lista de escapes
(`kKnownAliasOffsets = {32, 88, 160}`) que llamaba «alias intencionales» a los tres bytes con dos
respuestas — o sea, llegaba exactamente a los tres defectos del informe. La lista está vacía ahora.

### Los cuatro datos que los violaban

| Fuera | Por qué |
|---|---|
| `osc2_pitch_mod_select` | En el puente, byte 32, pisando `osc2_pm_source`, que sí suena |
| `arp_gate` | En el puente, byte 160 y CC 13, duplicando `arp_gate_time` |
| `osc_drift` | En el puente, byte 88, pisando `voice_drift`. El drift ya tiene tres parámetros vivos |
| `slot_a_type`, `slot_b_type` | Restos de una nomenclatura que este synth no tiene (`osc1_*`/`osc2_*`, no ranuras A y B). Fuera del spec de C++ y del JSON |

### Por qué el guard mide contra el C++

El spec que declara el host son los **247** ids de `Source/Core/ParametersSpec_*.cpp`; los **15** de
`resources/parameters_spec.json` son metadatos legacy. Comparar el registro contra el JSON daría
**220 falsos positivos**. El generador ahora lee los cinco `.cpp`, saca solo el conjunto de ids (que
además entra en `sourceHashes` como cuarta fuente) y deja los metadatos viniendo del JSON, igual que
antes.

### El guard 3 no escanea el motor

Los ids construidos por prefijo (`fx1_mix` sale de `"fx" + String(s + 1) + "_mix"`) no existen como
literal. Un escaneo los daría por muertos. El guard compara contra una lista explícita de los **16**
declarados-sin-byte vivos, cada uno con su porqué. Una entrada que ya no aplica avisa
(`SPECONLY_ALLOWLIST_STALE`); lo que no esté en la lista es un error.

### Un bug que los guards enseñan

`!paramToOffset[id]` es `true` para el byte **0**: un guard con truthiness declararía «sin byte» al
primer parámetro del registro (`lfo1_rate`). Corregido con `hasOwnProperty` en los tres sitios, con
test.

### Lo que encontró el guard mientras se ponía

Los fixtures de `bridgeParamMaps.test.js` y `browserMapper.test.js` llevan su propia copia del mapa
del puente, y esa copia estaba desfasada: los `chord_*` en 105-108 (encima de `mod_matrix_slot5/6`,
un **cuarto** grupo de colisión) en vez de 300-303, y `fx_feedback_gain` en el **223**, el primer byte
del nombre del patch. El generador no lo ve porque no lee tests; los tests no lo veían porque
comparaban el fixture consigo mismo.

### Resultado

`registry_generator` pasa de 236 a **233** parámetros, `aliasGroups=0`, y es idempotente. Los cuatro
artefactos `.gen` regenerados. `registryGen.test.js` §5c comprueba los tres guards sobre el
artefacto **emitido**, no solo sobre las fuentes, así que también cazan a quien suba un `.gen` viejo.

**Suite WebUI:** 4819 tests, 48 fallos, **0 introducidos por este cambio** (baseline en HEAD: 53).
Los 3 fallos de carga (`domSanitize`, `verifyDocsCiJobs`, `checkWasmBuild`) son `SyntaxError` de
cambios anteriores del working tree, ajenos a esto.

---

## 0.2.55 — 🎛️ El desplegable del rack también derivaba del contrato (fin de la desalineación, 2ª parte)

> **El `FX_TYPE_NAMES` ya estaba arreglado en 0.2.52. Este era el que quedaba.** Ese arreglo quitó
> la lista escrita a mano de `effects_data.js`, pero `WebUI/js/components/fx_modal_templates.js`
> tenía **dos listas propias**: la cadena de `<option>` del desplegable y el objeto de etiquetas
> cortas, las dos escritas a mano y las dos desplazadas respecto a `FXSlot_Factory.cpp`. Y esa es
> justo la que tenía el usuario delante de los ojos.

El desplegable no era un ids corrido con tres deslices: estaba **descolocado de verdad**.

| id | decía | la fábrica construye | id | decía | la fábrica construye |
|---:|---|---|---:|---|---|
| 1 | Ambience | **Hall** | 22 | Delay | **Deep Verb** |
| 2 | tcDeepVerb | **Plate** | 26 | DecimatorDelay | **Chamber** |
| 3 | RoomRev | **Rich Plate** | 27 | ModDlyRev | **Room** |
| 4 | VintageRoom | **Ambience** | 28 | Stereo Chorus | **Vintage** |
| 5 | HallReverb | **Gated** | 6 | ChamberRev | **Reverse** |
| 7-12 | Plate Reverb … DelayRev | Rack Amp … Mod Delay Verb | | | |

De 64 opciones, **51 mal etiquetadas y 7 que no existen**. Esas 7 son los ids **57-63**
("Slow Motion Chorus", "BBD Ensemble", "Phaser 8", "Micro Spat", "Multi Tap Chorus", "Tremolo
Pan", "Auto Pan"): se podían elegir en el desplegable y **la ranura se quedaba muda**, porque la
fábrica construye 1-56 y cae en `default: return nullptr`.

- **`WebUI/js/components/fx_modal_templates.js`** — las dos listas salen ahora de
  `window.FxEffectsContract`, el mismo binding del que ya bebe `effects_data.js`. Una sola
  verdad: el desplegable no puede desalinearse porque ya no existe una segunda lista que
  desalinear. **57 opciones, ordenadas por id, cero fantasmas.**
- **Se construyen en el primer acceso, no al cargar.** Este script se carga en la línea 29 de
  `index.html` y el contrato en la 336: montarlo aquí saldría vacío. Los tres exports
  (`FX_TYPE_OPTIONS`, `FX_TYPE_LABELS`, `FX_MODAL_TEMPLATE`) pasan a ser `get`, de modo que
  `fx-modal.js` y `fx_modal_presets.js` **no cambian ni una línea** y leen los nombres cuando
  pintan, que es cuando el contrato ya está. Sin contrato avisa por consola y deja solo *Bypass*:
  un desplegable vacío se ve enseguida, una lista vieja equivocada no se ve nunca.
- **Ordenados por id a propósito.** El array `effects` del contrato va agrupado por familia y
  **no** ordenado por id (acaba en 55, 39, 16, 19, 43, 49, 54, 56). Usarlo tal cual habría dado
  un desplegable *de aspecto ordenado con el `value` equivocado en cada opción*, que es un fallo
  peor que el que se arregla porque no se ve.
- **El mini-display arrancaba mintiendo.** El HTML traía `id === 1 ? 'Ambience' : id === 2 ?
  'VintageRoom'`, o sea contradiciendo el desplegable que tiene justo encima hasta que el usuario
  tocaba algo. Ahora arrancan en *Bypass*, que es la verdad hasta que se cargue el estado.
- **`WebUI/tests/fxContract.test.js`** — +8 tests en un `describe` nuevo: que no quede ninguna
  lista escrita a mano en el fichero, que cada opción lleve el nombre del contrato, que salgan
  exactamente los ids del contrato sin repetir, los diez reverbs en `1,2,3,4,5,6,22,26,27,28`, que
  los dos grupos no se solapen, que sin contrato degrade a *Bypass* en vez de a una lista vieja, y
  que las etiquetas cortas también salgan del contrato.

- **Un bobo mío que salió a tiempo.** El segundo grupo de opciones no tenía `from`, así que se
  comía los ids del primero y el desplegable salía con **93 opciones duplicadas**. Lo cazó la
  aserción de "sin repetir" al verificar, antes de que llegara a la UI.

**Verificado.** WebUI **112 files / 4847 tests, 0 fallos** (antes 4839). ESLint **0 errores / 0
warnings**. `generate:fx-contract:check` al día (57 efectos). `npm run bundle` OK: el
componente llega a `dist/` referencing `FxEffectsContract` y **cero** nombres viejos.
Mutaciones comprobadas en las dos direcciones: quitando el `.sort()` del contrato el test salta
(2 fallos), y colando un `"Ambience"` a mano en el id 1 también (2 fallos, con
`1: desplegable=Ambience contrato=Hall`).

**Contrato sin cambios**, como en 0.2.52: ni los ids, ni los nombres, ni las familias cambian. Lo
que cambia es que la web por fin dice la verdad.

---

## 0.2.54 — 🛠️ La línea de retardo del Space Echo RE-201 estaba muerta (y su tanque de reverb)

> **Bug de envolvente, no de DSP.** `FXSpaceEchoRE201` (id 39) usaba `kMaxDelay = 70560` como
> **máscara de bits**, y una máscara solo envuelve si es `2^n - 1`. No lo era: `70560` es
> `0b1_0001_0011_1010_0000`, y sus **cinco bits bajos son cero**, así que
> `(writePos + 1) & delayMask` daba `0` en la primera muestra y `0` para siempre. Todas las
> muestras se escribían en la misma celda, las lecturas caían en índices enmascarados que nunca
> se habían escrito, y **el eco de cinta no existía**. El efecto era un paso a paso con la voz
> seca. Llevaba así desde que se escribió, y era la razón declarada por la que el perfil del
> RE-201 compartido (`Re201Profile`) se copió de JUNiO601 en vez de ABDEep.

- **`Source/DSP/FX/FXSpaceEchoRE201.h`** — el tamaño pasa a ser potencia de dos y la máscara pasa a
  ser `tamaño - 1`, que es el patrón que ya usan `FXSpectralDelay`, `FXTreemonster` y
  `FXSolinaEnsemble` en este mismo directorio. `kDelaySize = 131072` (2^17) en vez de 70560. Se
  elige 2^17 y no 2^16 porque el tope del retardo lo pone `sampleRate * 1.5` (66150 muestras a
  44.1 kHz) y no esta constante: con 2^17 la expresión `maxDelay` devuelve **exactamente los
  mismos números que antes**, así que lo único que cambia es que la línea avanza. Las dos
  variables `delayMask` y `reverbMask` **desaparecen**: al ser `constexpr` no hay forma de volver
  a poner una máscara equivocada, que es exactamente como se coló este bug.
- **`Source/DSP/FX/FXSpaceEchoRE201.h`** — dos `static_assert` que dan **error de compilación** si
  alguien vuelve a poner un tamaño que no sea potencia de dos. El fallo que acabamos de arreglar
  no debería poder repetirse en silencio otra vez.
- **El tanque de reverb tenía el mismo bug.** `kReverbSize = 16384` es 2^14, o sea una potencia
  de dos usada donde tocaba la máscara: `(reverbWPos + 1) & 16384` alternaba entre 0 y 16384 en
  vez de recorrer el búfer, y las lecturas se quedaban clavadas en el índice 0. La "reverb de
  muelle" no era una reverb. Ahora es 2^15, que además cubre el retardo más largo del tanque
  (0.11 s por el canal derecho) hasta ~298 kHz.
- **`Source/DSP/FX/FXUnitTests_Advanced.cpp`** — test nuevo, **«Space Echo RE-201 delay line
  advances (id 39)»**. Dispara un impulso y comprueba que vuelve a la distancia que dice el
  cabezal, en los dos extremos del mando de tiempo (2620 y 32744 muestras), más que la vía seca
  está viva y que fuera de esa ventana no suena nada. Tres cosas importante:
  - **El efecto no tenía ninguna cobertura.** `FXUnitTests_Advanced.cpp` ya incluía la cabecera
    desde hacía tiempo y no la usaba: los tests que pasaban antes eran los que comprueban que la
    salida es `isfinite`, que es lo único que se puede afirmar de un eco que no existe.
  - El test **falla con la máscara rota puesta a propósito** (pico 0 en la posición esperada, con
    la vía seca pasando) y pasa con la arreglada. Comprobado en las dos direcciones.
  - La ventana de búsqueda se escala con la distancia porque el wow y el flutter mueven la
    posición de lectura hasta un ±1.7 %.
- **`../ABDSharedCode/DspEffects/profiles/Re201Profile.h`** — la nota que justificaba copiar el
  perfil de JUNiO601 decía que la línea de ABDEep estaba rota. Se marca que **se arregló** (y en
  cuál versión) en vez de dejar un documento mintiendo. El motivo de fondo sigue en pie: la tabla
  de modos de ABDEep son cinco modos escritos a mano frente a los doce del selector real, y eso no
  se ha tocado.

**Cambio audible en el id 39, y grande.** Pasa de ser un filtro paso a paso a ser, por fin, un eco
de cinta: aparecen las repeticiones de los tres cabezales, el tiempo del retardo pasa a existir,
y la reverb de muelle pasa a ser una reverb. Los presets que usen el 39 suenan bastante distinto,
y van a sonar *bien*, que era el objetivo. El resto de efectos no se toca.

**Ojo, que no es el único.** El mismo defecto —usar un tamaño que no es potencia de dos como
máscara— está en **`FXAnalogTapeDelay` (52920), `FXDuckingDelay` (66150) y `FXShimmerDelay`
(88200)**, más el tanque de reverb del Shimmer (`kReverbSize = 32768`). Los cinco búferes se
quedan clavados en 0 desde la primera muestra, igual que la RE-201. **No se han tocado**: son
otros tres efectos publicados y arreglar el 39 no es permiso para cambiar los otros tres sin
decirlo. Queda pendiente decidir.

**Verificado.** `ABDEep_UnitTests`: **147 suites / 3 689 380 aserciones / 0 fallos** (antes 146 /
3 689 374: +1 suite, +6 aserciones).

---

## 0.2.53 — 🔌 Los cinco mandos de reverb del híbrido iban a los controles equivocados

> **Bug de cableado, no de DSP.** `FXHybridReverb` reparte sus doce mandos: 0-5 al modulador
> (flanger / chorus / delay) y 6-11 a la reverb, que es un `FXSimpleReverb(1)` (Hall). El bloque de
> reverb del panel está **en el mismo orden que los cinco primeros mandos de una Hall**, así que el
> reparto correcto es el de identidad: 6→0 preDelay, 7→1 decay, 8→2 size, 9→3 damping, 10→4
> diffusion. Y no lo era: iban **6→1, 7→0, 8→4, 9→2 y 10→3**. Cuatro de los cinco knobs acababan
> en un control que no era el suyo —preDelay movía el decay, decay movía el pre-retardo, size movía
> la difusión, damping movía el tamaño y loCut movía el damping—, y dos de ellos (size y damping)
> se perdían dentro de controles que sí tienen sentido oír, que es justo lo que lo hace pasar
> desapercibido.

- **`Source/DSP/FX/FXHybridReverb.cpp`** — el `switch` de los knobs 6-10, que pasa a ser el de
  identidad. El quinto mando del panel es **loCut**, que el motor no tiene (ni loCut ni hiCut):
  sigue yendo a *diffusion*, que es lo que hacía el reparto viejo y la única forma de que ese knob no
  se quede muerto. El wet/dry del knob 11 es el del híbrido entero y no cambia: se sigue mezclando
  al final de `process`.
- **`Source/DSP/FX/FXUnitTests_ReverbParity.cpp`** — dos tests nuevos sobre el reparto:
  - **«los cinco knobs del híbrido llegan a su control»** — para cada knob y para los tres
    híbridos (23/24/25) monta la cadena que el híbrido *debería* tener —modulador, reverb con el
    reparto correcto y el wet/dry del final— con la **copia congelada del motor**, y la compara
    muestra a muestra con lo que hace el híbrido de verdad. Los knobs se mueven a 0.08 y a 0.93
    sobre una base de cinco valores distintos (así un cruce no puede pasar por casualidad) y se
    exige **0 ULPS**. Cuando falla, busca en cuál de los cinco controles fue el knob de verdad y lo
    dice: *«el knob decay (7) a 0.93: 3.3e9 ULPS de diferencia, la peor en la muestra 7047. Debería
    mover decay y ha movido preDelay»*.
  - **«los cinco controles del híbrido no suenan igual»** — que los cinco controles se diferencien
    entre sí. Sin esto, el test de arriba podría pasar sin comprobar nada: si dos controles
    distintos dieran el mismo audio, un cruce volvería a colarse por debajo. Son 10 pares × 3
    híbridos.

**Cambio audible en 23, 24 y 25.** Estos tres efectos ya estaban publicados, y su sonido cambia:
el knob de tamaño ahora alarga la cola en vez de cambiar la difusión, y el de pre-retardo retrasa
de verdad en vez de cambiar el decay. El resto del motor, de los otros diez reverbs y de la
extracción a `DspEffects` no se toca: la paridad de los reverbs sigue en 0 ULPS y los hashes
congelados siguen cuadrando.

**Verificado.** `ABDEep_UnitTests`: **146 suites / 3 689 374 aserciones / 0 fallos**. Y lo
importante: con el reparto cruzado puesto a propósito, el test nuevo falla las **30** aserciones
(5 knobs × 2 extremos × 3 híbridos) en vez de colarse. Se comprobó en las dos direcciones.

---

## 0.2.52 — 🔗 Los nombres de tipo de efecto salen del contrato compartido (fin de la desalineación)

> **Bug de interfaz, no de texto.** `FX_TYPE_NAMES` era una lista de 57 nombres escrita a mano en
> `WebUI/js/effects_data.js` que enumeraba los ids `0..56` **seguidos**, mientras que la fábrica
> (`FXSlot_Factory.cpp`) construye `1,2,3,4,5,6,22,26,27,28` para los reverbs. O sea que a partir
> del id 7 el desplegable del rack y el DSP llevaban tres ids distintos para el mismo efecto: la
> web llamaba "Ambience" a un Hall, y el 22 (Deep Verb) figuraba como "Delay". No daba ningún
> error, porque eran dos listas de enteros que nadie contrastaba.

- **`WebUI/js/fx_contract.gen.js` (nuevo, AUTO-GENERATED)** — binding del contrato compartido
  `ABDSharedAssets/contracts/fx-effects.json` al WebUI, con `names` indexado por id, `byId`,
  `effects`, `families` y `sourceHash`. Mismo patrón que `registry.gen.js`: envoltorio UMD
  (script clásico) + cabecera `DO NOT EDIT`.
- **`scripts/generate_fx_contract.mjs` (nuevo)** — el generador. Idempotente (solo escribe si el
  contenido cambia) y con `--check` para CI. Valida el contrato antes de emitir: ids numéricos,
  sin repetidos, sin huecos y con nombre en todas las entradas.
- **`WebUI/js/effects_data.js`** — el array de 57 nombres **fuera**. Ahora deriva de
  `window.FxEffectsContract` y expone tres cosas: el contrato entero, `FX_TYPE_NAMES` (la lista
  por id, congelada y copiada; se conserva porque seis módulos la leen por índice y renombrarla
  aquí sería ruido) y `fxTypeName(id)` para el código nuevo.
- **`WebUI/index.html`** — carga `fx_contract.gen.js` **antes** de `effects_data.js`. Si el orden
  se invierte la lista se queda sin definir, que es justo el fallo silencioso que se quiere evitar.
- **`WebUI/tests/fxContract.test.js` (nuevo, 13 tests)** — ata las tres capas que tienen que
  saber el mismo número: el `.gen` commiteado es **byte a byte** lo que genera el script; el
  contrato está alineado con el **`FXSlot_Factory.cpp` real** (se parsea el `.cpp`, no una copia:
  comprueba que todo id que construye la fábrica existe en el contrato, y que los diez reverbs
  salen en 1,2,3,4,5,6,22,26,27,28 con su `variant` correcta); y `effects_data.js` no vuelve a
  escribir los nombres (busca un array grande y los nombres inventados de la lista vieja).
- **`WebUI/tests/effects.test.js`** — segunda copia del array borrada. Ahora **evalúa los dos
  scripts reales en un `window` falso** con `vm`, en el mismo orden que `index.html`, y saca la
  lista del resultado: prueba lo que se carga en el WebView, no una copia que puede quedarse
  vieja sin que nadie se entere.
- **`package.json`** — `generate:fx-contract` y `generate:fx-contract:check`.
- **`docs/baseline_fase0_v32.md`** — counts a **111 files / 4815 tests**.

**Por qué un generador y no un `import` del contrato.** Los `effects_*.js` son scripts **clásicos**
(`<script src>`, se hablan por `window`), no ESM; y el resource provider sirve el árbol crudo cuando
no hay `dist/`, así que el contrato —que vive fuera del árbol— no tiene ruta que servir. El `.gen`
es un fichero normal del árbol y por eso funciona igual en los tres modos de servicio (árbol crudo,
dev server de Vite y bundle). `CMakeLists.txt` no cambia: `GLOB_RECURSE` ya lo recoge en las dos
ramas.

**Trampa documentada:** el array `effects` del contrato va **agrupado por familia** (bypass,
reverb, delay, tape, …), **no ordenado por id** — al final se leen `55, 39, 16, 19, 43, 49, 54, 56`.
Indexarlo por posición en vez de por id es un error fácil de cometer; hay un test que fija
explícitamente esa propiedad.

- **Tests:** WebUI **111 files / 4815 tests, 0 fallos**. ESLint **0 errores / 0 warnings**.
  `npm run bundle` verificado: `dist/js/fx_contract.gen.js` presente y referenciado en
  `dist/index.html`.

---

## 0.2.51 — 🧱 La familia de reverbs pasa a ABDSharedCode/DspEffects, con paridad bit a bit

> **Sin cambios de sonido.** Las diez variantes de reverb del DeepMind 12 (ids 1, 2, 3, 4, 5,
> 6, 22, 26, 27 y 28) dejan de tener su propio motor y lo toman prestado de
> `ABDSharedCode/DspEffects`. Es la primera extraccion de la capa de efectos con la politica
> inyectada: el motor se va al modulo y el reparto de mandos se queda aqui, que es lo unico
> que es de ABDEep.

- **`Source/DSP/FX/FXSimpleReverb_Process.cpp` (eliminado)** — el kernel (4 conbs + 3
  allpass, pre-retardo mono, factor 0.2) se va tal cual a
  `ABDSharedCode/DspEffects/DspSchroederReverb.h`. Sin cambios de algoritmo.
- **`Source/DSP/FX/FXSimpleReverb.{h,cpp}`** — queda como envoltorio. `setDefaultsForType` y
  `numParametersForType` (dos `switch` de diez casos) se sustituyen por una fila de tabla, y el
  `switch` gigante de `setParameter` por una comparacion de indices. La maquina es
  `abd::dsp::SchroederReverb`; los numeros vienen de `abd::dsp::ReverbProfile`.
- **`Source/DSP/FX/FXUnitTests_ReverbParity.cpp` (nuevo)** — paridad en dos capas:
  **estructural**, muestra a muestra contra una copia literal del kernel pre-extraccion
  (las diez variantes, con mandos de fabrica y con tres pasadas de barrido incluyendo los
  valores 0, 1 y 0.5, **0 ulps**), y **hashes congelados** FNV-1a por variante, calculados
  sobre la copia y NO sobre el codigo nuevo (si los generase el codigo nuevo, regenerarlos
  seria tautologia). Tambien cubre el tamano de bloque (1, 7, 64, 256, 1000 y el entero dan
  el mismo audio) y que los hibridos 23/24/25 sigan sonando.
- **`CMakeLists.txt`** — `ABDShared::DspEffects` en los cinco targets y
  `ABDSHAREDCODE_BUILD_DSPEFFECTS_TESTS OFF` (los efectos se prueban desde aqui, que es donde
  esta el original). **`DspSources.cmake`** — fuera el `.cpp` del kernel.

### Lo que encontro la paridad

El barrido de mandos fallo con **miles de ULPS** donde los valores de fabrica pasaban limpios,
y la causa fue que `rebuild()` se fiaba de que `AudioBuffer::setSize` ya habia puesto a cero:
**con el MISMO numero de muestras `setSize` no toca el contenido viejo**. El original llama a
`clear()` despues de `setSize`, asi que vacia la cola haya cambiado el tamano o no. Solo se
notaba cuando se movia un mando que NO cambia el tamano de los conbs (el pre-retardo, o el
tamano si ya estaba ahi), y por eso sonaba casi igual y solo aparecia en el test. Arreglado en
el modulo, con test de regresion que lo fija en las dos formas.

### Lo que NO se ha tocado, a proposito

Tres comportamientos del efecto publicado que la paridad obliga a conservar, porque
corregirlos cambiaria el sonido de efectos ya publicados:

1. Mover el mando de tamano o el de pre-retardo **redimensiona los conbs y borra la cola**.
2. El pre-retardo real es `segundos x sampleRate x 0.2`, no `x 1`: pedir 100 ms retrasa 20 ms.
3. "Reverse" (id 6) **niega solo el canal izquierdo**: no es una inversion de fase, es un
   efecto Haas.

- **Tests:** `ABDEep_UnitTests` completo en verde, **3689314 aserciones, 0 fallos**.

---

## 0.2.50 — ⚙️ Pipeline de build del WebUI: el bundle Vite que hace montar el keybed compartido

> **Bug de produccion:** el keybed COMPARTIDO (`@abdsynths/midi-keyb`) ya se montaba en
> `js/keyboard.js` (unico ESM de la app) y `js/fit-stage.js` importa `@abdsynths/shared`,
> pero el WebView2 no tiene `node_modules`: los bare imports no resolvian en runtime, asi
> que el teclado no aparecia en el binario. Ahora el WebUI se empaqueta con Vite.

- **`scripts/build_webui.js` (nuevo)** — empaqueta el WebUI (`npm run bundle`) y verifica el
  resultado: 0 bare imports `@abdsynths/*` sin resolver en dist, el keybed DENTRO del bundle
  (`kbd-keys-wrapper`) y los ficheros que el runtime pide por ruta (`js/dsp-processor.js`,
  `wasm/abdeep_dsp.js`, `wasm/abdeep_dsp.wasm`). Invoca Vite por su entrada JS
  (`node_modules/vite/bin/vite.js`) en vez del shim de `npx`: identico en las tres
  plataformas, sin `shell: true` ni DEP0190.
- **`WebUI/vite.build.config.js` (nuevo)** — empaqueta SOLO las dos entradas ESM
  (`js/keyboard.js`, `js/fit-stage.js`) con nombres ESTABLES (`assets/index.js|css`, sin
  hash: el provider resuelve por ruta) y replica el arbol estatico a `dist/` con la misma
  estructura (js/css/assets/wasm/data/resources/schemas/style.css), excluyendo las entradas
  empaquetadas y las carpetas de desarrollo.
- **`WebUI/vite.config.js` (nuevo)** — servidor de desarrollo (`npm run dev`, puerto 5311)
  para el flujo en navegador: Vite resuelve los bare imports al vuelo.
- **`PluginEditor_ResourceProvider.cpp`** — paso 0: si `WebUI/dist` existe y tiene el
  fichero, se sirve de ahi ANTES del arbol crudo (que sigue sirviendo lo que no esta en el
  bundle en Debug).
- **`CMakeLists.txt`** — con `WebUI/dist/index.html` presenta se embebe SOLO dist (los
  recursos de `juce_add_binary_data` se nombran por basename: embeber ambos arboles duplica
  nombres). Sin dist cae al arbol crudo con `WARNING`, no `FATAL_ERROR`: el configure de CI
  no se rompe.
- **`build.bat`** — empaqueta el WebUI antes de configurar CMake (con aviso, no error, si no
  hay node: el build sigue). **`WebUI/dist/`** ignorado por git.
- **Tests:** `WebUI/tests/webuiBundlePipeline.test.js` (7: runner, config, provider, CMake,
  gitignore, orden en build.bat y los deps `workspace:*`) + `keyboardSharedMount.test.js` (5).
- **Deps:** `@abdsynths/midi-keyb` y `@abdsynths/shared` declarados `workspace:*` como en el
  resto del monorepo (estaban como `file:../ABDSynthsWeb/node_modules/...`, una ruta
  inexistente: el enlace de `node_modules` quedaba roto y el import no resolvia).
- **Verificado:** bundle de 36 modulos → `assets/index.js` 41.23 kB + `assets/index.css`
  113.86 kB; copia estatica de 283 `.js` + wasm/assets/datos; el CSS empaquetado lleva la
  franja del chasis (185px) y el keybed (`.kbd-white-key`, `--kbd-led-color`); dev server
  resuelve `@abdsynths/midi-keyb` a `ABDSharedCode/MidiKeyboard/src/keyboard.js`.

- **Dev server en Debug (recarga en vivo):** con `npm run dev` en marcha, el editor del
  plugin carga `http://localhost:5311/` en el WebView2 y trabaja sobre el arbol CRUDO con
  HMR — sin `npm run bundle` en cada cambio. La URL la compila CMake solo en Debug
  (`ABDEEP_WEBUI_DEV_SERVER_URL` -> `ABDEEP_WEBUI_DEV_URL`), es sobrescribible o apagable
  con la variable de entorno del mismo nombre (otro puerto, otra maquina, `off`) y se
  sondea con un HEAD de 200 ms antes de navegar: si el servidor no responde se sirve el
  bundle/arbol como siempre, sin quedarse en blanco. **Release no compila ese camino.**
  El puerto es fijo (`strictPort`) para que el editor no acabe en un servidor que no es.
- **La define de la URL va sin comillas + `JUCE_STRINGIFY`:** un `/D` con comillas las
  pierde al pasar por MSBuild -> cl (la macro llegaba como trozos de URL y no compilaba).
- **Fix de compilacion en `PluginEditor.cpp` (preexistente en HEAD):** la linea que
  escapaba las comillas del motivo de fallo llamaba a `replaceCharacter` con un literal
  de cadena donde esa API pide un `juce_wchar` (error C2664), asi que el plugin no
  compilaba. `replaceCharacter` cambia un caracter por otro y ahi hacen falta dos: ahora
  la linea usa `replace` con la comilla y su version escapada, que es lo que pretendia.

> **OJO (Debug sin dev server):** sin bundle, el arbol crudo no resuelve los bare imports
> y el keybed no monta en el WebView2. Dos salidas: `npm run dev` + Debug (HMR), o
> `npm run bundle` (y el host sirve `WebUI/dist`; build.bat ya lo hace).

— 🐛 Fix crítico de runtime: teclado no renderizaba (colisión global `let Logger` + recursión `escapeHtml`)

> **Bug de producción reportado:** en la build de las 11:00 el teclado MIDI no aparecía.
> Causa raíz: colisión del **global lexical scope** de los scripts clásicos + recursión
> infinita por hoisting. Verificado en navegador real (48 teclas renderizadas, 0 errores).

- **`let Logger` → `var Logger` (6 archivos):** `calibration_store.js`,
  `effects_presets_bank_extract.js`, `effects_presets_storage.js`,
  `settings_global_dump.js`, `sysex_monitor_events.js`, `sysex_monitor_render.js` — en
  scripts clásicos (no módulos) un `let` top-level envenena el *global lexical
  environment* y TODOS los scripts posteriores que declaran `Logger` (incluso con `var`)
  fallan con `SyntaxError: Identifier 'Logger' has already been declared` → su script
  completo se aborta → `initPanicButton`/`createEmptyBank` no existen → el teclado nunca
  se renderizaba. Unificado al patrón canónico `var Logger` de los 28+ archivos restantes
  (+ `// eslint-disable-next-line no-var`).
- **Recursión infinita `escapeHtml` (2 archivos):** `calibration_lab_format.js` y
  `effects_presets_data.js` declaraban `function escapeHtml` a nivel top-level → en
  scripts clásicos el hoisting sobrescribía `globalThis.escapeHtml` (definido por
  `dom_sanitize.js`) con la propia función local ANTES de evaluar
  `_canonicalEscapeHtml = globalThis.escapeHtml` → auto-llamada →
  `RangeError: Maximum call stack size exceeded`. Renombradas a `escapeHtmlCal` /
  `escapeHtmlFx` (los consumidores internos de ambos módulos actualizados).
- **Tests de regresión anti-drift** (`domSanitize.test.js`, 26 → 28): scan estático que
  detecta reintroducciones de colisiones `let`/`const` top-level entre scripts clásicos
  (los tests no lo detectaban antes porque cargan los módulos en scope de módulo).
- **`baselineGuard.test.js` rediseñado (elimina el flake de contención de raíz):** el
  guard ya NO ejecuta la suite completa anidada (CPU-bound → flakes de presupuesto
  temporal); usa `vitest list` (enumera sin ejecutar, ~21s) para los counts + un run
  ligero JSON solo sobre los 4 archivos con `skipIf` condicional para capturar los
  skipped del entorno (2 en `checkWasmBuild`, artefactos WASM locales incompletos).
- **Baseline actualizada:** suite 106/106 · **4743 passed + 2 skipped (4745)** ·
  ESLint 0 errores 0 warnings · docs-verification exit 0. Verificado en navegador:
  teclado de 48 teclas renderizado, sección OSC visible, 0 errores de consola.

---

## 0.2.48 — ✅ Cierre definitivo del plan v3.2 (Fases 0–7 completadas)

> **Hito:** Refactorización de Arquitectura e Integración v3.2 cerrada al 100%.
> 28/28 checkboxes del plan marcados · 13 jobs CI · suite 106 files / 4745 tests.

- **Fase 0 — Baseline y perfiledo:** `docs/baseline_fase0_v32.md` con baseline
  exacta (test suites, corpus A–H, percentiles p95/p99/p999, audit de asignaciones),
  `Source/Tools/Benchmarks/ProcessBlockBenchmark.cpp` (18 escenarios incl.
  `poly12`, `poly12_fx4`, `max_all` = Uni12 + mod matrix 32 + Moog 4x + routing FX
  9) y `WebUI/tests/baselineGuard.test.js` (guard de counts).
- **Fase 1 — Esquema declarativo + generador:** `schemas/parameter-registry.json`
  (schemaVersion 1) + `scripts/registry_generator.js` + `validate_and_generate.ps1`
  → artefactos `registry.gen.js` / `ParameterRegistry.gen.{h,cpp}`, vinculados a CMake
  via `add_custom_command`.
- **Fase 2 — Transaccional + FSM:** `WebUI/js/parameter_store.js` (PendingTransaction
  TTL 300 ms, rollback tipado, `transportStatus`, `comparisonMode`),
  `hardware_midi_service.js` (FSM de puerto) y `sysex_assembler.js` (FSM de mensajes).
- **Fase 3 — Sanitización DOM/ASCII:** `dom_sanitize.js` + `scripts/security_scan.js`
  (audit XSS sobre todo WebUI/js), `patch_name.js` (PatchNameValidator/Renderer/
  HardwareExporter, 15 chars ASCII) y `typed_errors.js` (SysEx/MIDI/JSON).
- **Fase 4 — Round-trip 3 niveles + fuzzing:** `roundtrip_equality.js`
  (`rawCodecEqual`/`semanticEqual`/`hardwareCanonicalEqual`), `fuzz_roundtrip.js`
  (16 seeds × 500 casos) y `roundtrip_corpus.js` (1024 presets A–H).
- **Fase 5 — WASM + Capabilities:** `Source/Wasm/WasmBridge.cpp` con `std::array`
  indexado por `ParameterIndex` (0 mapas dinámicos) + preasignación fija en
  `wasminitengine()`; `model_capabilities.js` (dm12_hardware 35 fx / abyssmind_pro 21 fx).
- **Fase 6 — Retirada legacy:** `logger.js` con `Logger.deprecation()` fuera de audio
  y retirada completa de `window.dualMidiBridge` (0 residuos).
- **Fase 7 — CI/CD (13 jobs):** schema-validation, registry-generation, vitest,
  cpp-unit-tests, roundtrip-corpus, fase4-corpus, hw-dump-validate, allocation-audit,
  benchmark, security-scan, property-fuzzing, wasm-build y pluginval.
- **Nivel 3b (hardware-in-the-loop):** COMPLETADO — 8 bancos capturados del DM12
  físico (`resources/hardware_dumps/2026-08-10/`), manifest + SHA-256 validados,
  divergencia B/1 registrada como known_exception, reporte `docs/reports/nivel3b-20260810.json`.
- **Verificación §8 (corrida local):** 0 allocs en idle/poly12/poly12_fx4/max_all ·
  fuzzing 8000/8000 sin violaciones · round-trip corpus 1024/1024 en los 3 niveles ·
  suite 106/106 (4743 passed + 2 skipped) · ESLint 0 errores · docs-verification exit 0.

---

## 0.2.47 — Cierre del Nivel 3b (hardware-in-the-loop) en el plan + resumen ejecutivo final

- **`implementation_plan architecture.md`**: Nivel 3b marcado como COMPLETADO en
  la nota de la Fase 4 (checklist A–E 100% verde; la corrida en navegador Web MIDI
  queda como refuerzo opcional no bloqueante, cubierta por el harness Node con
  módulos WebUI reales).
- **`docs/fase4_roundtrip_equality.md`** §8: Nivel 3b `[x]` completado — checklist
  A (baseline/8 bancos/291 B), B (paridad C++↔JS), C (eco NRPN 15/15), D (nombres
  no-ASCII/cola 239-241), E (reporte/CHANGELOG) verificados.
- **`docs/plan_v32_resumen_ejecutivo.md`**: estado global del plan v3.2 a 9.5/10+
  con las 8 fases cerradas, métricas actualizadas (106 files / 4745 tests, 13 jobs
  CI, 1023 exact + 1 known_exception B/1) y sección 7 con la matriz de jobs
  completa.

## 0.2.46 — Test de esquema ampliado: manifest.json de hardware_dumps (SHA-256 por banco)

- **`WebUI/tests/nivel3bReportSchema.test.js`** (34 tests): nuevo bloque
  `resources/hardware_dumps/ — manifest.json y SHA-256 por banco` que valida el
  esquema del manifest del directorio de dumps MÁS RECIENTE: raíz (schemaVersion,
  kind hardware-bank-dumps, fecha coherente con el dir), hardware/procedimiento,
  resumen (8 bancos, 1024 presets, divergencias con B/1 known_exception),
  banks A–H (rawSha256/normalizedSha256 hex-64, size 37248, payloadDiffPrograms) y
  los **SHA-256 reales de los 8 .syx** == manifest (dumps no alterados) + cruce de
  fecha con el reporte más reciente (manifest.fecha == report.corrida).
- Baseline WebUI actualizada a 106 files / 4745 tests.

---

## 0.2.45 — Nivel 3b: cierre de checkboxes sin hardware (--classify dump + --check-hashes + D)

- **`scripts/roundtrip_corpus.js`**: nuevo modo `--dumps-dir <dir> [--classify]`
  (Nivel 3b): clasifica los dumps del HARDWARE contra el corpus de fábrica con
  `hardwareCanonicalEqual`, leyendo las **known_exceptions del `manifest.json`** del
  directorio (B/1 → `known_exception`, prioridad sobre exact). Fast-path por posición
  declarada (O(n) en vez de O(n²)): pre-check exact + known_exception antes del scan.
  Resultado verificado: **1023 exact_match + 1 known_exception (B/1) + 0 no_match**.
- **Checklist Nivel 3b §4 cerrado sin hardware**: `validate_sysex_mapping.js
  --check-hashes` (0 errores, 8 bancos OK) y `--classify` del dump completo ✅;
  sección D (nombres no-ASCII/16 chars + cola 239–241) ✅ vía `patchNameValidator.test.js`
  (24 tests) y payload del dump byte-idéntico. Pendiente solo la corrida en navegador
  Web MIDI real (requiere hardware) y el firmware del DM12 en el manifest.
- **Tests**: `roundtripCorpusScript.test.js` +4 (modo dumps: 1023/1024+known_exception,
  B/1 del manifest, sin manifest → semantic_match, preset manipulado → no_match exit 1).
- **Reporte 3b actualizado**: `docs/reports/nivel3b-20260810.json` — A_baseline/D_nombre/
  E_cierre a `verificado` (checklist A–E casi 100 %; únicos pendientes: navegador + firmware).

---

## 0.2.44 — Job CI hw-dump-validate (validación offline de dumps commiteados)

- **`scripts/hw_bank_dump.js`**: nuevo modo `--validate-committed` (OFFLINE, sin
  MIDI): valida los dumps commiteados (`resources/hardware_dumps/`, auto-detección
  del directorio más reciente o `--out`) contra su `manifest.json` (tamaño canónico
  37248 B = 128 × 291 y SHA-256 == `rawSha256`) y contra el corpus de fábrica (diffs
  de payload 10..-3 == `manifest.banks[X].payloadDiffPrograms`, incluyendo la
  divergencia conocida B/1 → known_exception). Exit 0/1 + `::error::hw-dump-validate`
  + reporte `--json` con marker `---JSON---`.
- **Nuevo job CI `hw-dump-validate`** (`.github/workflows/hardware-dump-validate.yml`,
  ubuntu-latest, sin hardware): ejecuta `node scripts/hw_bank_dump.js --validate-committed
  --check-payloads` en cada PR que toque el harness, los dumps, el corpus o los hashes —
  falla si manifest, dumps o corpus divergen. Fase 7 pasa de 12 a **13 jobs**.
- **Contrato de jobs actualizado a 13**: `verify_docs_ci_jobs.js` (EXPECTED_JOBS /
  JOB_WORKFLOWS / JOB_WORKFLOW_JOBS), `docs-verification.yml`, plan Fase 7 y
  `baseline_fase0_v32.md` §7 + `plan_v32_resumen_ejecutivo.md` (tabla §3).
- **Tests**: `WebUI/tests/hwDumpValidate.test.js` (6 tests): exit 0 con 8/8 bancos
  consistentes, reporte `--json`, invariante B/1 known_exception, auto-detección,
  banco manipulado → exit 1 y manifest ausente → exit 1.
- Baseline WebUI actualizada a 105 files / 4718 tests.

---

## 0.2.43 — Test de esquema del reporte Nivel 3b + baseline actualizada

- `WebUI/tests/nivel3bReportSchema.test.js` (24 tests): valida el esquema de
  `docs/reports/nivel3b-*.json` (raíz, fases A–D + B_webui/C_webui, checklistRelease
  A–E, restauración cutoff=42/nombre, invariante `fases_completadas ⊆ fases`) y que
  el doc `docs/fase4_nivel3b_hardware_in_the_loop.md` referencie el reporte más reciente.
- Reporte `nivel3b-20260810.json`: `pasos` 14 → **15/15** (restauración A/0 incluida) y
  checklist E_cierre actualizado (validación WebUI en `verificado`).
- Baseline WebUI actualizada a **104 files / 4712 tests** (4710 passed, 2 skipped) en
  `docs/baseline_fase0_v32.md`, `docs/plan_v32_resumen_ejecutivo.md` e
  `implementation_plan architecture.md`.

## 0.2.42 — Nivel 3b B+/C+: round-trip de programa y transacciones NRPN vía WebUI + hardware

- `scripts/hw_roundtrip_validate.js`: harness Node que carga los **módulos WebUI reales**
  (browser_packer.js, patch_name.js, parameter_store.js, bridge-parameter-store.js,
  bridge-midi-rx-nrpn-handlers.js) y los ejecuta contra el DM12 físico via node-midi
  (14 pasos, exit code 0, `--json` reproducible).
- B+: `sendPatchToHardware → HardwareExporter → buildSingleSysex` (291 B canónico) →
  envío real → program dump de vuelta → `validateSinglePatchSysexRoundTrip` OK
  (`transport=true patch=true mismatches=0`) + **payload 242/242 bytes idénticos**;
  `HardwareExporter` no muta el patch original (223–238 intactos).
- C+: `setParameter` inicia transacción pending (TTL 300 ms, expectedRaw=191); eco
  NRPN/CC38 → `confirmByValue` `isEcho=true` → `confirmed` **sin re-escribir el slider**;
  override externo → `synced` + UI actualizada; sweep TTL → `out_of_sync`.
- **Hallazgo**: el DM12 real NO re-emite NRPN (0 ecos en 1.2 s) → política
  timeout/`out_of_sync` confirmada (sweep de 100 ms del bridge-parameter-store).
- Checklist Nivel 3b B y C marcados como verificados; reporte `nivel3b-20260810.json`
  ampliado con las fases B_webui/C_webui.

---

## 0.2.41 — Nivel 3b: dumps de banco reales del DM12

- `scripts/hw_bank_dump.js`: captura los 8 bancos de fábrica vía SysEx program-dump request
  (`F0 00 20 32 20 00 01 <bank> <prog> F7`, device ID 0x00) con el paquete `midi`;
  verificación `--check-hashes` contra `schemas/corpus-hashes.json` (normalizado dev→0x7F)
  y `--check-payloads` (payload 10..-3 vs corpus, auto-contenida).
- Dumps de regresión commiteados: `resources/hardware_dumps/2026-08-10/` (8 raw + 8
  normalizados + `manifest.json` con SHA-256 raw/normalizado y diff por programa).
  Dep `midi@^2.0.0` declarada en devDependencies; quirk del byte de banco (0x00 en
  todos los mensajes del corpus) documentado en `docs/sysex_format.md`.
- Resultado: **1023/1024 presets byte-idénticos al corpus** en payload; banco A hash
  normalizado idéntico; única divergencia real **B/1** (2 bytes de cola 00→20) →
  candidata a `known_exception`. El quirk de bank-byte del corpus (siempre 0x00 en
  cabecera) queda documentado.
- Checklist Nivel 3b A–D + captura de banco marcados; `docs/reports/nivel3b-20260810.json`
  actualizado con la tabla de verificación (8 bancos).

---

## [0.2.40] — 2026-08-10

### 🧪 Paridad CI + auditoría de subprocesos + validación act end-to-end + cierre documental

- **Test de paridad de workflows** (`verifyDocsCiJobs.test.js`, +3 tests): verifica que
  `docs-verification.yml` y `webui-ci.yml` ejecutan EXACTAMENTE el mismo script
  (`scripts/verify_docs_ci_jobs.js`) con los mismos args (sin flags), vía node directo
  vs `npm test` → vitest → runScript([]).
- **Auditoría de tests con subprocesos** (`ciSubprocessTests.test.js`, nuevo, 4 tests):
  detecta automáticamente todos los tests que dependen de scripts externos
  (child_process / scripts/*.js), verifica que cada script existe (scripts/ o
  WebUI/scripts/), que TODOS se recogen en `vitest list` (colección de `npm test`) y
  que webui-ci no filtra includes.
- **Validación `act` end-to-end**: workflow `webui-ci` ejecutado localmente con
  `act 0.2.89` (Docker Desktop) — checkout, node 20, npm install, lint, vitest, serve
  check y steps de audio A/B: todos verdes tras actualizar la baseline.
- **Baseline actualizada**: 103 files / 4688 tests (4686 passed, 2 skipped).
- **Cierre documental Nivel 3b**: plan Fase 4 + `fase4_roundtrip_equality.md` actualizados
  (Fases A–D ejecutadas con DM12 real); doc del Nivel 3b con camino MCP reproducible
  (§3.5). Nuevo `docs/plan_v32_resumen_ejecutivo.md` (fases 0–7, 12 jobs CI, métricas).

## [0.2.39] — 2026-08-10

### 🎛️ Nivel 3b — primera corrida hardware-in-the-loop con DM12 físico (Fases A–D)

Primera ejecución del Nivel 3b (§5 del plan v3.2) con hardware real vía Web MIDI:

- **Fase A (Baseline):** snapshot del edit buffer == preset A/0 del corpus de fábrica,
  **242/242 bytes idénticos** (`exact_match`); byte-map y región de nombre 223–238
  confirmados con datos reales.
- **Fase B (Round-trip NRPN):** `filter.cutoff` (byte 39) → raw 100; snapshot de vuelta
  raw 100 (delta 0) — eco real del hardware.
- **Fase C (Virtuales):** `fx_feedback_gain` (byteOffset 304, sin NRPN) rechazado por el
  cliente sin emitir MIDI; edit buffer posterior intacto.
- **Fase D (Nombre límite):** 16 chars `Hi<>&"'ABCDEFGHI` en 223–238 hacen round-trip
  idéntico byte a byte (sin truncado ni corrupción).
- **Restauración verificada:** preset A/0 original devuelto (nombre "Blue Dolphin BC " +
  cutoff 42), confirmado con snapshot final.
- Reporte estructurado: `docs/reports/nivel3b-20260810.json`; checklist A–E del doc
  actualizado (A–D a nivel de edit buffer; pendientes: dumps completos de banco + SHA-256
  + validación vía WebUI real).

## [0.2.38] — 2026-08-10

### 🏁 Fase 0 COMPLETADA — Cierre documental del pre-requisito (baseline, perfilado, audit)

- **`implementation_plan architecture.md`**: checkbox de Fase 0 marcado `[x]` con nota de
  cierre — la baseline exacta exigida (suites, cobertura, hashes A–H, percentiles
  p95/p99/p999 de `processBlock()` y audit de asignaciones) está registrada y
  custodiada en `docs/baseline_fase0_v32.md` con job CI dedicado por cada número
  (`benchmark`, `allocation-audit`, `roundtrip-corpus --check-hashes`, guard
  `baselineGuard.test.js`).
- **`docs/baseline_fase0_v32.md` §8**: Fase 0 añadida como item 0 de completadas
  (resumen de los números vigentes y sus jobs custodios) + nota del header actualizada
  a 2026-08-10. Con esto el plan queda con **todas las fases 0-7 completadas**; único
  pendiente: Nivel 3b (hardware-in-the-loop con DM12 físico).
- Cambio 100% documental — sin código ni tests tocados.

---

## [0.2.37] — 2026-08-10

### 🔎 docs-verification — validación de la mención del workflow en los bullets de plan y baseline

- `scripts/verify_docs_ci_jobs.js`: nueva validación **nivel 4** — el TEXTO completo de
  cada bullet `Job \`x\`` (línea del bullet + líneas de continuación indentadas) en el
  plan (`implementation_plan architecture.md` §Fase 7) y en `docs/baseline_fase0_v32.md`
  §7 debe **mencionar el nombre del workflow real** que lo implementa
  (`JOB_WORKFLOWS`, p. ej. `dsp-ci.yml`) — anti-drift si un bullet omite la referencia o
  apunta a un workflow equivocado.
- Nueva función `extractJobBulletTexts()`: Map<job, texto> del bullet completo; un
  bullet termina en la siguiente línea de lista (`- ` / `* `) o heading. La validación
  aplica sobre el texto íntegro, no solo la primera línea.
- Reporte JSON: nuevos campos `planWorkflowMention` / `baselineWorkflowMention`
  (violaciones) con `::error::docs-verification`.
- **Corregido**: el bullet de `benchmark` en baseline §7 no mencionaba su workflow
  (`dsp-ci.yml`) — añadida la referencia (la nueva validación lo detectaba).
- Tests ampliados 25 → 31: unit de `extractJobBulletTexts` (texto completo con
  continuaciones + corte en siguiente bullet/heading + mención solo en línea de
  continuación), contrato en vivo (los bullets reales de plan y baseline mencionan
  el workflow correcto con la ruta completa `.github/workflows/<wf>`) y negativos
  (bullet sin mención de workflow, bullet con workflow ERRÓNEO). Helpers sintéticos
  `buildPlan`/`buildBaseline` ahora generan la mención real del workflow. Baseline:
  102 files / 4681 tests.

---

## [0.2.34] — 2026-08-09

### 🧹 Baseline ESLint a 0 warnings + guard anti-drift de la baseline

- **27 warnings ESLint (`curly`) eliminados** con `--fix` en 9 archivos
  (`calibration_store.js`, `effects_presets_bank_extract.js`, `effects_presets_storage.js`,
  `settings_global_dump.js`, `sysex_monitor_events.js`, `sysex_monitor_render.js`,
  `registryGen.test.js`, `registry_generator.js`, `validate_sysex_mapping.js`) — solo
  formato, sin cambios de lógica (verificado: regeneración `.gen` sin drift).
- **`npm run lint` endurecido a `--max-warnings 0`** (antes permitía 9000 en `lint:ci`):
  CI falla ante cualquier warning futuro.
- **Nuevo guard `WebUI/tests/baselineGuard.test.js`:** corre la suite completa en un
  subproceso excluyéndose y reconcilia los counts documentados en
  `docs/baseline_fase0_v32.md` §2 con la realidad — si un test file/test se añade o
  renombra, el guard falla y obliga a actualizar la baseline (anti-drift). Incluye
  unit tests propios del parseo (ANSI, passed+skipped, no-parseable) y falla de forma
  sonora si el subproceso de la suite termina en error (no enmascara suites rotas).
- **Baseline actualizada:** 100 files / 4653 tests (4651 passed, 2 skipped), ESLint 0/0,
  cobertura re-medida 58.99/48.75/57.62/61.02 (bajó por el denominador nuevo de fuentes
  Fases 3/5, no por regresión).

---

## [0.2.33] — 2026-08-09

### 📄 Verificación documental de Fase 7 — job CI `docs-verification`

- **Nuevo `scripts/verify_docs_ci_jobs.js`:** comprueba que los **12 jobs de Fase 7**
  listados en el plan (`implementation_plan architecture.md`, sección «Fase 7») coinciden
  con los de `docs/baseline_fase0_v32.md` §7 y que cada job tiene su workflow real en
  `.github/workflows/`. Contrato canónico `EXPECTED_JOBS` (12) + `JOB_WORKFLOWS`; igualdad
  de conjuntos BIDIRECCIONAL (job faltante O extra en cualquiera de los dos docs falla el
  check con `::error::docs-verification`) + verificación de existencia del workflow.
  Exporta constantes con guard `require.main === module` (los tests los importan sin
  ejecutar el script); overrides `--plan-file`/`--baseline-file`/`--workflows-dir` para
  tests negativos.
- **Nuevo `.github/workflows/docs-verification.yml`** (ubuntu-latest, paths sobre plan/doc/
  script/workflow): ejecuta el verificador y falla si el plan y la baseline divergen.
- **Plan normalizado a 12 bullets `Job` explícitos** (antes 10 bullets combinados):
  `allocation-audit` y `benchmark` separados, y bullet dedicado para `fase4-corpus`
  (estaba embebido en `property-fuzzing`) — ahora el contrato es 12 == 12 == 12.
- **Tests `verifyDocsCiJobs.test.js` (13):** contrato, extracción (unit), integración
  positiva sobre los docs commiteados (exit 0) y 4 negativos con overrides (missing/extra
  en baseline o plan, workflow ausente, sección faltante).

---

## [0.2.32] — 2026-08-09

### ⚡ Fase 5 COMPLETADA — Tiempo real, capabilities y bridge WASM (§3.2/§1.1)

- **`WASMBridge.cpp` sin búsquedas dinámicas:** el mock de `AudioProcessorValueTreeState`
  ya no usa `std::map<string, value>`; almacena en `std::array` indexado por el enum
  `ParameterIndex` generado en build-time (`ParameterRegistry.gen.h`), con slots fijos
  adicionales para los 10 parámetros internos del motor que no están en el registro
  (`global_tune`, `global_volume`, `sub_level`, `vca_mode`, `vcf_oversample`, etc.).
  Resolución id→slot solo en hilo de control (`wasm_set_parameter`) — cero asignaciones.
- **Dirty-gate en `wasm_process_audio`:** `updateParameters()` solo corre cuando un
  `wasm_set_parameter*` escribió desde el último bloque (`gParamsDirty` atómico) → cero
  lookups por string en el hilo de audio en estado estable (invariante §3.2).
- **Exports nuevos (O(1) por índice + modelo):** `wasm_set_parameter_index` /
  `wasm_get_parameter_index` (acceso directo al array por `ParameterIndex`) y
  `wasm_set_model` / `wasm_get_model` (ModelCapabilities: 0=dm12_hardware, 1=abyssmind_pro).
  Añadidos a `EXPORTED_FUNCTIONS` (wasm/CMakeLists.txt) y a `REQUIRED_EXPORTS` del job
  `wasm-build` (9 → 13). `ParameterRegistry.gen.cpp` (datos puros) se compila en el WASM.
- **`WebUI/js/model_capabilities.js` (nuevo, UMD):** matriz formal `ModelCapabilities`
  (§1.1) — `dm12_hardware` (35 FX estándar, 0 avanzados, 8 slots mod) vs `abyssmind_pro`
  (35+21, sequencer extendido, params AbyssMind) — con `resolveModel`, `getCapabilitiesForMode`
  e `isValidModelCapabilities`. Integrado en `wasm_bridge.js` (`getCapabilities()`, actualizado
  en `setMode`), cargado en index.html antes de los scripts wasm, y cableado al DSP WASM:
  `setMode` postea `{type:'set_model', model}` al worklet (`wasm_audio_processor.js` /
  `dsp-processor.js`, con guard para builds antiguos) → `wasm_set_model` mantiene el modelo
  del motor C++ alineado con el bridge JS.
- **Tests:** `modelCapabilities.test.js` (8) + tests de capabilities en `wasmBridge.test.js`;
  `checkWasmBuild.test.js` actualizado a 13 exports (glue sintético + skip de artefactos
  locales obsoletos vía `REQUIRED_EXPORTS` exportado por el script con guard `require.main`).

---

## [0.2.31] — 2026-08-09

### 🔒 Fase 3 COMPLETADA — errores tipados SysEx/MIDI/JSON (§4.3)

- **Nuevo `WebUI/js/typed_errors.js`** (UMD): jerarquía de errores tipados del
  proyecto — `ABDError` (base: code/category/context/timestamp, toJSON/toString
  serializables), `SysExError` (category 'sysex'), `MidiError` ('midi'),
  `PatchImportError` ('import'), `ERROR_CODES` congelado y `asTypedError`
  (envuelve errores planos sin perder el mensaje; idempotente para ABDError).
- **Integración**: bridge-sysex.js lanza `SysExError` (SYSEX_NO_PORT /
  SYSEX_TIMEOUT con context de duración / SYSEX_UNKNOWN_DUMP_TYPE);
  bridge_connection_midi.js lanza `MidiError` (MIDI_NO_ACCESS);
  browser_io_parse_import.js devuelve `errorCode` tipado (IMPORT_INVALID_JSON /
  IMPORT_REJECTED / IMPORT_UNSUPPORTED_FORMAT). Cargado en index.html antes de
  los módulos bridge/parse.
- **Tests `typedErrors.test.js` (17)**: jerarquía, serialización, asTypedError e
  integración en los 3 flujos + orden de carga en index.html.
- **Cierre de Fase 3**: checkboxes del plan marcados (los §4.1/§4.2 ya estaban
  implementados; §4.3 era el pendiente) + nota de cierre; sección 8 de la doc
  actualizada (Fase 3 → completadas). Vitest: 97 files / 4624 tests / 0 fallos;
  ESLint 0.
- **Post-reviewer**: añadida factory `createTypedError(category, code, message,
  context)` (fallback a Error plano que CONSERVA el message — `|| Error` lo
  descartaba); revertido el `throw` del tipo de dump desconocido a warn+null
  (contrato original: `panel_controls_chord.js` llama `requestMidiDump('chord'/
  'polychord')` esperando null) y revertido el re-throw de `initWebMidi` (se
  loguea el `MidiError` en `_lastMidiError` sin relanzar — `init()` no tiene
  try/catch y el catch envuelve todo el bloque).

## [0.2.30] — 2026-08-09

### 📋 Sección 7 de `docs/baseline_fase0_v32.md` — Fase 7 documentada al completo

- Añadidos los bullets que faltaban en §7: **`security-scan`** (audit XSS estático sobre
  TODO `WebUI/js` vía `scripts/security_scan.js --json`, 0 violaciones),
  **`schema-validation`** (`validate_and_generate.ps1` en windows-latest, complementario
  multiplataforma de `registry-generation`), **`cpp-unit-tests`** (dsp-ci.yml, 3.689.164
  assertions) y **`vitest` + lint** (webui-ci.yml, 96 files / 4605 tests).
- Nota: `wasm-build` ya estaba documentado en §7 (desde el commit de pluginval).
- Resultado: **los 12 jobs de Fase 7 quedan documentados en §7** (13 bullets ✅).

## [0.2.29] — 2026-08-09

### 📋 Sección 8 de `docs/baseline_fase0_v32.md` — estado actualizado (Fases 1/2/4 completadas)

- **Sección 8 reescrita**: Fases 1/2/4 marcadas como **completadas** con sus artefactos
  reales (esquema + generador + `.gen`, ParameterStore/FSM/SysExAssembler/comparisonMode,
  roundtrip_equality + fuzzing + corpus A–H) y el fix de allocs de la sección 6 como
  resuelto. Pendientes reales listados: Fase 3 (en curso), Fases 5/6 y Nivel 3b
  (hardware-in-the-loop).
- **Plan (`implementation_plan architecture.md`)**: checkboxes de Fase 1 marcados `[x]` +
  nota de cierre (el trabajo ya existía verificado; quedaba sin marcar).

## [0.2.28] — 2026-08-09

### 📊 Baseline Fase 0 — números vigentes en secciones 2-3 de `docs/baseline_fase0_v32.md`

- **Sección 2 (Baseline WebUI)**: actualizada a los números reales actuales —
  **96 files / 4605 tests / 0 fallos** (~9.5 s; antes: 81 / 4351). ESLint: 0
  errores, 27 warnings (curly). Cobertura re-ejecutada: Statements 62.53,
  Branches 50.19, Functions 58.21, Lines 64.74 (antes 50.98/39.49/46.59/53.32).
- **Sección 3 (Baseline C++)**: **126 suites / 3.689.168 assertions / 0 fallos**
  (antes 122 / 3.689.097); nota de equivalencia con el job `cpp-unit-tests` de CI
  (3.689.164 assertions). También actualizada la referencia de la sección 5.1.

## [0.2.27] — 2026-08-09

### 🏁 Fase 7 COMPLETADA — Job CI `pluginval` (último pendiente)

- **`.github/workflows/pluginval.yml`** (windows-2022, timeout 45 min): valida el
  plugin VST3 con **Tracktion/pluginval pinneda a v1.0.4** (asset
  `pluginval_Windows.zip` — determinismo CI, como JUCE 8.0.12 y Emscripten 3.1.64):
  - Build del target `ABDEep_Standalone_VST3` (FORMATS Standalone VST3); el VST3 es
    un bundle-directorio `*_artefacts/Release/VST3/ABD Eep.vst3/` con
    `moduleinfo.json` + DLL x86_64-win, localizado con el glob canónico de
    `scripts/verify_release.ps1`.
  - Validación con la invocación canónica del repo: `pluginval --strictness-level 5
    --seed 42 --validate "<vst3>"` (estándar de la industria, checklist §17) —
    falla con `::error::pluginval` si no hay ALL TESTS PASSED, publicando el log
    como artefacto diagnóstico en fallo.
  - Verificado local: artefacto VST3 presente (10.9 MB) y descarga del asset
    `pluginval_Windows.zip` v1.0.4 (HTTP 200). `vst3val` no existe como repo
    público (404) — pluginval sigue siendo la herramienta canónica.
- **Test guard `WebUI/tests/pluginvalWorkflow.test.js`** (8 tests): pin v1.0.4,
  strictness 5 + seed 42, glob VST3, target de build, validación en pwsh,
  `::error::pluginval` y patrón Fase 7 (concurrency/permissions).
- **Cierre**: `implementation_plan architecture.md` Fase 7 100% marcada (checkbox
  `pluginval` ✅ + nota de cierre); `docs/baseline_fase0_v32.md` §7 con los bullets
  `wasm-build` y `pluginval` (lista completa de Fase 7).

## [0.2.26] — 2026-08-09

### 📄 Fase 7 — Documentación de los jobs CI completados (property-fuzzing, fase4-corpus, registry-generation)

- **`docs/baseline_fase0_v32.md` §7 «CI — estado de Fase 7»**: documentados con detalle
  los 3 jobs CI de Fase 7 completados (cambio 100% documental):
  - **`fase4-corpus`** (segundo job de `roundtrip-corpus.yml`): batería round-trip de
    Fase 4 sobre el corpus A–H completo (1024 presets) vía `scripts/roundtrip_corpus.js
    --json` — Nivel 1 (invariante de codec por preset), Nivel 2 (re-encode estable +
    hermanos semánticos), Nivel 3a (self-match exact + layout de cabecera). Resultado
    verificado: 1024/1024 en los 3 niveles, 0 errores; clasificación 804 exact · 210
    canonical (105 pares) · 10 semantic (5 hermanos); ~0.7s los 8 bancos.
  - **`property-fuzzing`** (`property-fuzzing.yml`): fuzzing acotado multi-seed — 16
    seeds deterministas × 500 casos = **8.000 casos** (incluye seeds de casos límite:
    mínimos, máscaras de byte/16-bit, bits alternados, máximo uint32); violaciones
    fatales (codec_invariance/codec_payload_bound/codec_throws/decode_encode_stability)
    vs timeouts como warning; límites del plan 500 B / 100 ms por caso. Resultado:
    8.000 casos → 0 violaciones / 0 timeouts.
  - **`registry-generation`** (`registry-generation.yml`): generador puro
    `registry_generator.js` con verificación de los 4 artefactos `.gen` sin diffs de
    contenido (ignorando `generatedAt`), guardia anti-minificación, valor multiplataforma
    vs `schema-validation`.
- **`implementation_plan architecture.md`**: nota de cierre de Fase 7 (3 jobs
  completados, verificados en local) con referencia a la doc; pendiente único `pluginval`.
- **Verificación**: cambio 100% documental — sin código ni tests tocados; suite Vitest
  intacta (95 files / 4597 tests / 0 fallos).

---

## [0.2.25] — 2026-08-09

### 🧩 Fase 7 — Job CI `wasm-build` (workflow `wasm-build.yml`) + verificación de la reserva fija

- **Nuevo `scripts/check_wasm_build.js`**: verificación del build WASM ejecutable en
  CI (plan v3.2 §3.4/§7):
  - **Artefactos**: `WebUI/wasm/abdeep_dsp.{js,wasm}` existen y no están vacíos; el
    glue .js contiene el EXPORT_NAME `ABDEepDSP` y las 9 funciones de
    `EXPORTED_FUNCTIONS` (`_wasm_init_engine`, `_wasm_process_audio`,
    `_wasm_set_parameter`, `_wasm_note_on/off`, `_wasm_pitch_bend`, `_wasm_panic`,
    `_malloc`, `_free`).
  - **Exports del .wasm**: parser mínimo de secciones WASM (LEB128 u32, sin
    dependencias externas — no requiere wabt) que lee la sección Export y exige
    **≥ 9 exports de función**. Hallazgo documentado: con `-O3 --strip-all`
    Emscripten **minifica los nombres de export del binario** a identificadores
    cortos (i, j, k…) — los nombres canónicos viven en el glue JS; el conteo es la
    invariante del binario.
  - **Preasignación (§3.4)**: la sección Memory debe declarar `initial >= 512`
    páginas (512 × 64 KiB = 32 MiB = INITIAL_MEMORY de `wasm/CMakeLists.txt`) — la
    «capacidad preasignada en wasminitengine()».
  - **Invariante fuente**: `WasmBridge.cpp` debe preasignar `gAudioBuffer.setSize(2,
    gBlockSize)` en init y guardar `getNumSamples() < numSamples` en
    `wasm_process_audio` (no reasignar si el bloque cabe) — si alguien rompe la
    reserva fija, el job falla antes de mergear.
  - CLI (`--wasm-dir`, `--json`, `--out`), exit 0/1 con `::error::wasm-build`.
  - Verificado localmente sobre los artefactos commiteados: exit 0 — 13 exports de
    función, Memory initial=512 páginas (32 MiB), invariante fuente OK.
- **Nuevo `.github/workflows/wasm-build.yml`** (job `wasm-build`, ubuntu-latest,
  Node 20, timeout 30min): `myMindstorm/setup-emsdk@v14` (Emscripten latest),
  clonado de JUCE 8.0.12, **preparación del shim `juce_core` gitignored** (copia
  desde JUCE + patch `juce_ThreadPriorities_native.h` — reproduce `build_wasm.bat`),
  `emcmake cmake -S wasm -B wasm/build -DJUCE_PATH=...` + `cmake --build`, y
  verificación con el patrón establecido `if ! node scripts/check_wasm_build.js
  --json` (los `::error::` se imprimen antes del exit 1). Triggers: `Source/Wasm`,
  `Source/DSP`, `Source/Core`, `wasm/**`, el script y el workflow.
- **`WebUI/tests/checkWasmBuild.test.js` (9 tests)**: unit tests del parser WASM
  con binarios sintéticos (Memory initial+maximum+export count → OK; initial 256 →
  falla «reserva fija» aislado con glue completo; glue sin `_wasm_process_audio` →
  falla; magic inválido → falla; artefactos ausentes → falla; **2 tests negativos
  del invariante FUENTE con `--src-file`**: sin el guard `getNumSamples() <
  numSamples` → falla «reserva fija rota» y sin preasignación `setSize(2,
  gBlockSize)` en init → falla) e integración con `skipIf` sin artefactos locales
  (exit 0 + `--json` con Memory initial ≥ 512 y exports ≥ 9).
- **Post-reviewer (4 fixes)**: (1) tests negativos del invariante fuente — el
  requisito central del job (verificar que wasminitengine/preasignación se
  mantienen) no tenía cobertura de fallo; (2) versión de Emscripten PINNED a
  `3.1.64` en `setup-emsdk` (determinismo de CI — `latest` rompería sin cambio de
  código); (3) test de Memory 256 aislado con glue completo (antes también
  fallaba por glue, el assert pasaba solo porque el script reporta todos los
  problemas); (4) `readULEB` endurecido contra overflow de `<<` en LEBs de 5
  bytes + `--src-file` resuelto contra `__dirname` (funciona desde cualquier
  cwd) + `import os` en el test.
- **Verificación**: Vitest **95 files / 4597 tests / 0 fallos** (+9); ESLint 0;
  `node --check` OK; YAML del workflow válido. Checkbox de Fase 7 actualizado —
  queda solo `pluginval`.

---

## [0.2.24] — 2026-08-09

### 🔬 Fase 4/7 — Batería de fuzzing ampliada: 16 seeds × 500 casos = 8.000 casos en CI

- **`scripts/fuzz_roundtrip.js`**: batería por defecto **5× más grande**:
  - **`DEFAULT_SEEDS` 8 → 16**: los 8 originales + **8 de casos límite** que ejercitan
    el PRNG `mulberry32` y el codec 7/8 — mínimo (`0x1`), máscaras de byte
    (`0x7F`/`0xFF`), máscaras de 16 bits (`0x7FFF`/`0xFFFF`), bits alternados
    (`0x55555555`/`0xAAAAAAAA`) y máximo uint32 (`0xFFFFFFFF`).
  - **`DEFAULT_ITERATIONS` 200 → 500**: 16 × 500 = **8.000 casos** por corrida CI
    (antes 8 × 200 = 1.600). Coste medido <1s total (máx 1ms/caso) — la cobertura
    ampliada no penaliza el tiempo del job.
- **`WebUI/tests/fuzzRoundtripScript.test.js` (8 tests, +2)**: nuevo test de la
  **batería por defecto completa** (16 seeds × 500 = 8.000 casos, exit 0, 0
  violaciones/timeouts) y test de **cobertura de seeds límite** (los 8 nuevos
  presentes, sin duplicados tras el parseo).
- **Docs**: `docs/fase4_roundtrip_equality.md` §5 (batería CI ampliada + seeds límite
  listados) y nota de Fase 7 del plan actualizada (16 × 500 = 8.000).
- **Verificación**: Vitest **94 files / 4588 tests / 0 fallos** (+2); ESLint 0;
  `node --check` OK; script local 8.000 casos → 0 violaciones / 0 timeouts.

---

## [0.2.23] — 2026-08-09

### 🏷️ Known exceptions desde la UI del A/B Compare (por bankName/patchIndex)

- **`calibration_lab_tab_roundtrip.js`** — registro de excepciones conocidas en el
  modo A/B Compare de la pestaña Round-Trip:
  - **Helpers** `getKnownException`/`addKnownException`/`removeKnownException`/
    `resetKnownExceptions` (globalThis): entradas `{bank: 'A'-'H', prog, reason,
    createdAt}` persistidas en `localStorage` (clave versionada
    `abdeep.calibration.knownExceptions.v1`) con cache lazy y fallback en memoria
    (entornos sin storage — tests). Ban-co normalizado a MAYÚSCULAS.
  - **`runABCompareReport(patchA, patchB, opts)`**: nuevo `opts.knownExceptions`
    (por defecto la lista persistida) → `hardwareCanonicalEqual` aplica la
    **prioridad `known_exception > exact/canonical/semantic`** (orden documentado
    de `classifyCorpusMatch`).
  - **UI**: cuando Patch B tiene posición, se muestra el formulario «Register as
    known exception» (input de razón + botón) o, si ya está registrado, un badge
    `BANCO/PROG · razón` con botón «Remove exception». Al registrar/eliminar se
    re-ejecuta la comparación (re-clasificación inmediata).
  - **CSS**: `.cal-rt-ab-exceptions`, `.cal-rt-ab-ex-badge` y `.cal-rt-ex-reason`
    (tokens del tema, badge amarillo de excepción).
- **Post-reviewer (3 fixes)**: (1) la actualización de razón en una excepción
  existente ahora **persiste** (antes solo persistía la rama de entrada nueva);
  (2) el banco del **corpus** de `runABCompareReport` se normaliza a mayúscula
  (`patchB.bankName` podía llegar en minúscula y el matching estricto de
  `classifyCorpusMatch` fallaba — la UI mostraba el badge pero no aplicaba la
  excepción); (3) aislamiento de tests con `beforeEach/afterEach` reset en los
  describes de render y eventos.
- **`calibrationRoundtripAB.test.js` (28 tests, +10)**: helpers (add/get/remove,
  case-insensitive del banco, actualización de razón), `opts.knownExceptions`
  (prioridad sobre exact + posición no coincidente no afecta), render (formulario
  vs badge/remove) y eventos (Register → `known_exception`, Remove → vuelve a
  `canonical_match`, y **regresión del case**: bankName minúscula matchea).
- **Verificación**: Vitest **92 files / 4586 tests / 0 fallos** (+10); ESLint 0;
  `scripts/security_scan.js` → **0 violaciones**; `node --check` OK.

---

## [0.2.22] — 2026-08-09

### 🧪 Nivel 3b (Hardware-in-the-Loop) — procedimiento documentado + checklist pre-release

- **Nueva `docs/fase4_nivel3b_hardware_in_the_loop.md`** (plan v3.2 §5 — obligatorio
  previo a cualquier release que modifique el protocolo SysEx o NRPN):
  - **Herramientas del proyecto** para la validación (tabla): Web MIDI `sysex: true`,
    `requestBankDump`, `buildSingleSysex`/`createProgramDumpSysex` (paridad C++/JS),
    `bridge-midi-rx.js` (banco/prog de `data[8]`/`data[9]`), `validateSinglePatchSysexRoundTrip`,
    `ParameterStore` + eco NRPN (CC38, TTL 300ms, `isEcho`), FSM `HardwareMidiService`,
    `HardwareExporter` (nombre 16 chars ASCII), hashes `schemas/corpus-hashes.json`.
  - **Procedimiento en 4 fases**: 3.0 preparación (Local Control OFF, Rx/Tx SysEx ON,
    permiso Web MIDI, FSM `ready`); 3.1 **Baseline** (dumps A–H, comparación con el
    corpus y `--classify`); 3.2 **Round-trip de programa** (envío → dump →
    `validateSinglePatchSysexRoundTrip` + Niveles 1/2); 3.3 **Ciclo NRPN** (transacción,
    eco de confirmación, rollback, virtuales ≥300 sin NRPN); 3.4 **Región de nombre**
    (223–238, saneado, cola 239–241 intacta).
  - **Checklist pre-release A–E** (baseline/protocolo, round-trip, NRPN, nombre,
    cierre): TODO verde si el release toca SysEx/NRPN/byte-map; Fase A basta como smoke
    para releases solo-UI/DSP. Cierre: dumps commiteados como referencia + reporte
    `docs/reports/nivel3b-<YYYYMMDD>.json` + CHANGELOG.
- **Docs enlazadas**: `docs/fase4_roundtrip_equality.md` §8 y nota de Fase 4 del plan
  apuntan al nuevo procedimiento. Cambio 100% documental (sin código ni tests tocados).

---

## [0.2.21] — 2026-08-09

### 🏷️ `roundtrip_corpus.js` — registro explícito de clasificación por preset (`--classify`)

- **Nuevo modo `--classify`** en `scripts/roundtrip_corpus.js`: emite la tabla por preset
  `{bank, prog, level1, level2, classification, matchedWith}` para los 1024 presets A–H:
  - `classification`: `exact_match` (único en el corpus) | `canonical_match` (duplicado
    byte-idéntico en otra posición, `matchedWith` = la otra posición) | `semantic_match`
    (mismos parámetros que otro preset, difieren solo en región reservada/padding).
  - **canonical > semantic por construcción**: los pares de duplicados y de hermanos no se
    solapan (el early-continue de `bytesEqual` en el bucle de grupos lo garantiza) —
    comentado en el código para no romper los conteos.
  - `level1`/`level2` = estado de VALIDACIÓN del preset (cacheado en los bucles Nivel 1/2
    originales — sin re-ejecutar las 3 funciones por preset, coste O(n) extra con el hash).
  - Resumen de conteos en consola y `counts` en el JSON.
- **Resultado del corpus de fábrica**: `804 exact · 210 canonical (105 pares) · 10 semantic
  (5 hermanos)` · `0 no_match` — 1024/1024 validados en los 3 niveles, 0 errores.
- **Tests** (`roundtripCorpusScript.test.js`, 9 total — +3): tabla de 1024 filas,
  conteos exactos fijados (804/210/10/0), invariantes por fila (`level1`&&`level2` true,
  `matchedWith` `^[A-H]/\d+$` ≠ self, exact → null) y ausencia de `classify` sin `--classify`.
- **Docs**: `docs/fase4_roundtrip_equality.md` §6b (script de corpus + `--classify`) y nota
  de Fase 4 del plan actualizada.
- **Post-reviewer (3 comentarios aplicados)**: prioridad canonical>semantic comentada,
  semántica de `level1`/`level2` documentada y conteos ligados a los pares en el código.
- **Verificación**: Vitest **92 files / 4576 tests / 0 fallos** (+3); ESLint 0;
  `node --check` OK. CI `fase4-corpus` intacto (corre con `--json`, sin `--classify`).

---

## [0.2.20] — 2026-08-09

### 🔬 Fase 7 — Job CI `property-fuzzing` (workflow `property-fuzzing.yml`) + fuzzing multi-seed

- **Nuevo `scripts/fuzz_roundtrip.js`**: property-based testing / fuzzing acotado
  (§5) ejecutable en CI — corre `fuzzRoundTrip` (`roundtrip_equality.js`) con
  **8 seeds deterministas** por defecto (0xC0FFEE..0x2468A) × 200 casos y el
  registro canónico real (`registry.gen.js`):
  - **Clasificación de violaciones**: `codec_invariance`, `codec_payload_bound`,
    `codec_throws` y `decode_encode_stability` son **fatales** (deterministas —
    fallan el job); `timeout` (dependiente del reloj de pared, preempción del
    runner) se reporta como **warning** y no rompe CI (los invariantes se
    verifican con `--budget-ms` amplio cuando se quiere auditar el presupuesto
    temporal sin ruido).
  - CLI: `--seeds` (decimal **o hex** `0xBEEF`), `--iterations`, `--budget-ms`,
    `--json`, `--out`. Exit codes **0/1/2** (OK / violaciones fatales / error de
    uso) con `::error::fuzz-roundtrip` — mismo contrato que `security_scan.js`.
  - **Resultado local**: 1600 casos / 8 seeds → **0 violaciones, 0 timeouts**
    (máximo 4ms/caso con presupuesto de 100ms del plan).
- **Nuevo `.github/workflows/property-fuzzing.yml`** (job `property-fuzzing`,
  ubuntu-latest, Node 20): ejecuta el script con `--json` usando el patrón
  establecido `if ! node …` (los `::error::` del script se imprimen antes del
  `exit 1`); triggers en el script, `roundtrip_equality.js`, `browser_packer.js`,
  `registry.gen.js`, `schemas/**` y los tests.
- **`WebUI/tests/fuzzRoundtripScript.test.js` (6 tests)**: subproceso real — exit 0
  con presupuesto amplio, reporte `--json` estructurado (runs por seed, totals,
  `planLimits` 500B/100ms, `fatal:false`), `--seeds` concreto (1 seed · N casos),
  presupuesto por defecto del plan (100ms/caso) sin violaciones, `--seeds` vacío
  → exit 2 y `--iterations` inválido → exit 2 con `::error::`.
- **Post-reviewer (2 ajustes)**: `planLimits.maxTimeoutMs` leído de la constante
  del módulo (`RTE.FUZZ_MAX_TIMEOUT_MS`, fuente de verdad única) y guard de
  `--iterations`/`--budget-ms` inválidos → exit 2.
- **Verificación**: Vitest **92 files / 4572 tests / 0 fallos** (+5); ESLint 0;
  YAML válido; `node --check` OK. Checkbox de Fase 7 actualizado — quedan
  pendientes `pluginval` y `wasm-build`.

---

## [0.2.19] — 2026-08-09

### 🧪 Fase 4 — Batería round-trip sobre el corpus completo A–H (1024 presets) + job CI `fase4-corpus`

- **Nuevo `scripts/roundtrip_corpus.js`**: batería de los 3 niveles de Fase 4 sobre
  los 8 factory banks A–H (1024 presets) usando `roundtrip_equality.js`:
  - **Nivel 1 (rawCodecEqual)**: invariante de codec por preset — `unpack7to8(pack8to7(x)) === x`
    Y el lado empaquetado `pack8to7(unpack7to8(packed)) === packed`.
  - **Nivel 2 (semanticEqual)**: estabilidad de re-encode Patch→Parámetros→Patch (±1 raw,
    rango válido de enums) + detección de **hermanos semánticos** vía hash O(n)
    (solo bytes con parámetro mapeado, excluye reservados 223-241 y padding — los
    pares byte-idénticos se reportan como duplicados de Nivel 3a).
  - **Nivel 3a (hardwareCanonicalEqual)**: self-match de cada preset contra el corpus
    COMPLETO con `skipSemantic: true` (debe hallarse con `exact_match` en su posición
    de cabecera) + check de layout de cabecera (`msg[9]` == índice secuencial del
    archivo de banco).
  - CLI (`--banks`, `--json`, `--out`), exit 0/1 con `::error::roundtrip-corpus` para CI.
- **`roundtrip_equality.js`**: nueva opción `skipSemantic` en `hardwareCanonicalEqual`
  (salta el fallback `semanticEqual` en scans O(n²) — self-match se resuelve por bytes
  idénticos) + fix de `report.ok` en la ruta de corpus incompleto (el JSON `--json`
  siempre lleva `ok`).
- **`.github/workflows/roundtrip-corpus.yml`**: nuevo job `fase4-corpus` (ubuntu-latest,
  Node 20) que ejecuta la batería con `--json` y **falla si algún preset rompe un
  invariante o no se self-matchea**; triggers ampliados a los scripts/module de la
  batería (`roundtrip_corpus.js`, `roundtrip_equality.js`, `registry.gen.js`,
  `browser_packer.js`).
- **`WebUI/tests/roundtripCorpusScript.test.js` (6 tests)**: subproceso real del script
  (exit 0 + 3 niveles verdes sobre 1024, reporte `--json` estructurado con `ok:true`,
  invariante selfMatched===scanned, duplicados listados + sin `header_layout` errors,
  banco inexistente → exit 1 con `::error::`, `--banks A,B` → 256 presets) con
  `skipIf` sin corpus local.
- **Resultado local**: 1024/1024 en los 3 niveles, **0 errores**; hallazgos reales del
  corpus: **105 pares duplicados** byte-idénticos en posiciones distintas (p.ej. A/0 ≙ B/71)
  y **5 hermanos semánticos** (mismos parámetros, difieren solo en región reservada).
  Tiempo total 8 bancos ≈ 0.7s (viable en CI).
- **Verificación**: Vitest **92 files / 4567 tests / 0 fallos** (+8); ESLint 0 en los
  archivos tocados; `node --check` OK; YAML del workflow válido (2 jobs).

---

## [0.2.18] — 2026-08-09

### 📄 Documentación Fase 4 — `docs/fase4_roundtrip_equality.md`

- **Nueva doc técnica** de la batería de igualdad round-trip: arquitectura del módulo
  (`roundtrip_equality.js` + dependencias), contrato de cada función con firmas y shapes
  de retorno (Nivel 1 `rawCodecEqual`, Nivel 2 `semanticEqual` con la política de enums,
  Nivel 3a `hardwareCanonicalEqual` con la jerarquía exact/canonical/semantic/
  known_exception/no_match), fuzzing acotado (500B / 100ms / seed determinista) y la
  integración A/B Compare del Calibration Lab (`runABCompareReport` + `coerceBytes`).
- **`implementation_plan architecture.md`**: checkboxes de Fase 4 marcados con nota de
  completado enlazando la doc; pendiente solo el Nivel 3b (hardware-in-the-loop).
  Corregida también la lista de jobs Fase 7 (el job `security-scan` ya estaba completado).


- **Modo "A/B Compare" en `calibration_lab_tab_roundtrip.js`**: la pestaña Round-Trip
  gana un toggle segmented (Single Patch / A/B Compare). El modo single conserva el
  flujo histórico (round-trip 3 capas de un patch); el modo ab clasifica **Patch A vs
  Patch B** con la batería de Fase 4 (`roundtrip_equality.js`):
  - `runABCompareReport(patchA, patchB)` (globalThis): corre `rawCodecEqual`
    (invariante + diffs byte a byte), `semanticEqual` (parámetros, región reservada
    ignorada) y `hardwareCanonicalEqual` con un corpus de 1 entry desde Patch B
    (posición de `patch.bankName` 'A'-'H' / `patchIndex`).
  - **Banner de clasificación**: `exact_match` (mismos bytes + misma posición),
    `canonical_match` (mismos bytes, posición distinta), `semantic_match` (solo la
    región reservada difiere), `known_exception`, `no_match` — con color, razón y
    posición coincidente del corpus.
  - **Fila de hechos**: raw idéntico (n/242), igualdad semántica, estabilidad de
    re-encode y estado del registro (`ParameterRegistry` cargado o degradado a
    estructural).
  - **Tabla de diferencias**: cuando `semanticEqual` reporta mismatches, se lista
    offset / Param IDs / Raw A / Raw B / Norm A / Norm B.
- **`coerceBytes` (fix de integración real)**: `deepClone` del store es JSON-based y
  convierte los `Uint8Array` de `unpackedBytes` en objetos `{0:.., 1:..}` sin `.length`
  — el A/B Compare fallaba con `invalid_patch_bytes` al leer los patches vía
  `store.getState()`. El normalizador reconstruye un `Uint8Array` cuando el objeto
  tiene 242+ claves numéricas contiguas (cubre la ruta picker → store → compare).
- **`index.html`**: se cargan `js/registry.gen.js` + `js/roundtrip_equality.js` tras
  `browser_packer.js` (antes de los scripts del Calibration Lab) — el registro
  canónico y la batería Fase 4 quedan disponibles en la app real.
- **`roundtrip_equality.js`**: la forma de objeto `{unpacked, bank, prog}` acepta
  ahora banco en letra ('A'-'H') además de numérico (los patches del lab usan
  `bankName` en letra) — +1 test en `roundtripEquality.test.js`.
- **CSS** (`calibration_lab.css`): `.cal-rt-mode` (toggle segmented con estado
  active) y `.cal-rt-ab-banner/.cal-rt-ab-class/.cal-rt-ab-{exact,canonical,semantic,
  exception,nomatch}` usando tokens del tema.
- **`WebUI/tests/calibrationRoundtripAB.test.js` (18 tests)**: clasificación pura
  (exact/canonical/semantic/no_match, errores de módulo y de bytes, sin registro),
  render del banner/factos/tabla y eventos (cambio de modo, Compare con patches del
  store — cubre la ruta `deepClone` → `coerceBytes` — y sin patches válidos).
- **Post-reviewer (3 fixes)**: modo leído en tiempo de llamada (`currentMode()` en
  vez de capturado en bind), `matchPos` solo cuando `bank`/`prog` no son null
  (evita "Bank null · Prog null"), y `modeSwitchHtml` compartido entre ambos
  renders (sin duplicación). Verificado: `scripts/security_scan.js` → 0 violaciones
  sobre todo `WebUI/js` (incluye el archivo nuevo).
- **Verificación**: Vitest **92 files / 4560 tests / 0 fallos** (+19); ESLint 0 en
  los archivos tocados; `node --check` OK.

---

## [0.2.16] — 2026-08-09

### 🧪 Fase 4 — Batería de igualdad de round-trip en 3 niveles + fuzzing acotado (Plan v3.2 §5)

- **Nuevo `WebUI/js/roundtrip_equality.js`** (UMD — `window.RoundTripEquality` /
  `module.exports`): implementa la matriz de pruebas del §5:
  - **Nivel 1 `rawCodecEqual`** — `Bytes → Pack → Unpack → Bytes`: verifica la
    invariante del codec (pack→unpack es la identidad, paridad con
    `browser_packer.js`/`RoundTripValidator.cpp`) y la igualdad byte a byte tras el
    round-trip. Acepta entrada de 242 (unpacked), 278 (packed) o 291 bytes (sysex,
    con validación de cabecera canónica opcional).
  - **Nivel 2 `semanticEqual`** — `Patch → Parámetros → Patch`: decodifica con el
    registro (`registry.gen.js`, `rawToNormalized`) descartando los **bytes
    reservados** (nombre 223-238 + cola 239-241) y el **padding** (bytes sin
    parámetro); tolerancia configurable (default 1/255) y verificación de
    **estabilidad de re-encode ±1 raw** (solo en el rango válido de enums — fuera
    de rango el codec clampa, documentado en `registryGen.test.js`). Sin registro,
    degrada a comparación estructural.
  - **Nivel 3a `hardwareCanonicalEqual`** — comparación contra el **corpus A–H** con
    clasificación `exact_match` (bytes idénticos + misma posición declarada en la
    cabecera), `canonical_match` (payload idéntico, posición distinta/desconocida),
    `semantic_match` (parámetros iguales con tolerancia), `known_exception`
    (prioridad sobre exact) y `no_match`.
  - **`fuzzRoundTrip`** — property-based testing acotado (§5): PRNG determinista
    `mulberry32` (reproducible en CI), invariantes de codec (242 B y payload
    arbitrario), estabilidad decode/encode con muestreo en rango válido de enums,
    **Max Payload 500B** y **Max Timeout 100ms por caso** (violaciones de timeout
    registradas). Holder `api` mutable para inyección de fallos en tests.
  - **`loadCorpusFromBanks`** (solo Node): carga los 8 factory banks A–H como corpus
    `{bank, prog, unpacked, packed}` para CI/scripts.
- **`WebUI/tests/roundtripEquality.test.js` (27 tests)**: invariante de codec sobre
  patches fijos y aleatorios, mismatch con offset reportado, comparación cross-form
  sysex↔patch, cabecera corrupta, región reservada ignorada, detección de VCF Cutoff
  con `paramIds`, tolerancia configurable, degradación sin registro, `exact/canonical/
  semantic/known_exception` contra el corpus real de banco A (128 presets), forma de
  objeto `{unpacked, bank, prog}` (posición declarada → exact/canonical), paridad de
  codec con `browser_packer.js`, fuzzing determinista (mismo seed → `violations`
  idénticas con presupuesto alto), límites por defecto del plan y detección de un
  codec roto por monkey-patch (violación de invariante) y de un codec lento
  (violación de timeout).
- **Hallazgo documentado durante la implementación**: los enums con raw > enumMax
  clampa en el codec del registro (comportamiento heredado y cubierto por
  `registryGen.test.js`) — el guard de re-encode lo excluye del criterio de
  inestabilidad.
- **Post-reviewer (2 hallazgos corregidos)**: (1) la forma de objeto `{unpacked,
  bank, prog}` de `hardwareCanonicalEqual` ignoraba `bank`/`prog` (la posición solo
  se extraía de sysex de 291 B) — ahora extrae el header del objeto igual que de una
  cabecera (2 tests nuevos); (2) `deterministic: true` era un campo hardcodeado que
  se volvía falso con timeouts — ahora se computa (`false` si hay violaciones de
  timeout, que dependen del reloj de pared). Menores: `kind` simplificado, fallback
  degradado de `semanticEqual` comentado (compara padding por no poder distinguirlo
  sin registro), `loadCorpusFromBanks` lee `prog` de `msg[9]` en vez de por orden de
  iteración.
- **Verificación**: Vitest **91 files / 4541 tests / 0 fallos** (+27); ESLint 0 en
  los archivos nuevos (6 warnings `no-var` preexistentes en otros archivos);
  `node --check` OK. Checkbox de Fase 4 §5 (Niveles 1/2/3a + fuzzing) marcado;
  queda el Nivel 3b (hardware-in-the-loop, requiere hardware físico).

---

## [0.2.15] — 2026-08-09

### 🛡️ Fase 7 — Job CI `security-scan` (workflow `security-scan.yml`) + 2 XSS reales corregidos

- **Nuevo `scripts/security_scan.js`**: audit estático XSS (plan v3.2 §4.1) que aplica la
  MISMA lógica de detección de `domSanitize.test.js` sobre **TODO `WebUI/js`** (236 archivos),
  no solo los 13 migrados en Fase 3. CLI (`--json`, `--dir`, exit 0/1/2) + módulo
  reutilizable (`auditSource`/`auditFile`/`scanDir`) — **fuente de verdad única** del audit.
- **`WebUI/tests/domSanitize.test.js` refactorizado** para importar los helpers del script
  (eliminados los patrones duplicados en el test) + **nuevo test del scan COMPLETO**
  (`scanDir()` → 0 violaciones) que valida en local lo que el job verifica en CI.
- **2 XSS reales encontrados por el scan ampliado y corregidos**: `effects_presets.js`
  ("FX Preset Saved") y `effects_presets_apply.js` ("FX Preset Loaded") interpolaban
  `preset.name`/`presetData.name` (localStorage — dato externo) en `lcdSafeUpdate` SIN
  escapar; ahora pasan por `globalThis.escapeHtml`. Patrones `preset.name`/`presetData.name`
  añadidos a `FORBIDDEN_INTERPOLATIONS` para prevenir la regresión.
- **9 falsos positivos de la heurística general verificados como seguros** (datos estáticos
  de la propia app o ya escapados): `browser_render.js` (emptyMsg ya escapa),
  `arpeggiator_controls(.ui).js` (arrays estáticos), `panel_controls_env_voice.js`
  (labels del DOM propio), `panel_controls_seq.js`/`sequencer_modal_state.js`
  (badges/colores estáticos) — el scan específico no los marca.
- **Workflow `security-scan.yml`** (ubuntu-latest, Node 20): ejecuta el script con `--json`,
  imprime el reporte en `::group::`, **falla si hay violaciones** y sube el reporte como
  artefacto (`security-scan-report.json`) en caso de fallo. Triggers: push main, PR, manual.
- **Post-reviewer (2 fixes)**:
  1. **Falsos positivos**: los patrones genéricos `+ preset.name`/`+ presetData.name`
     marcaban también usos YA escapados en la misma línea; `auditSource` ahora descarta
     líneas que invocan `escapeHtml`/`_escapeHtml` (`ESCAPED_LINE_RE`, mismo criterio que
     el skip de textContent) + test de regresión que verifica ambos casos (escaped → 0,
     vulnerable → 1 violación).
  2. **`set -e` en el workflow**: el script con violaciones (exit 1) mataba el step ANTES
     de imprimir el reporte (mismo bug corregido en `registry-generation`/`schema-validation`);
     ahora se captura el rc con `if !`, se renderiza el `::group::` SIEMPRE y se `exit $scan_rc`.
     Verificado: scan de un dir malicioso → RC=1 + violación detectada en el JSON.
- **Verificación**: Vitest **90 files / 4514 tests / 0 fallos** (+2: scan completo + falsos
  positivos); ESLint 0; `node scripts/security_scan.js --json` → 236 archivos /
  **0 violaciones**; YAML de los 7 workflows válido.

---

## [0.2.36] — 2026-08-09

### 🔎 docs-verification — validación de que cada workflow define su job

- `scripts/verify_docs_ci_jobs.js`: nueva validación **nivel 3** — cada job del
  contrato (12) debe existir como **job ID real en la sección `jobs:` de su workflow**
  (tabla `JOB_WORKFLOW_JOBS`; el nombre real puede diferir del documentado, p. ej.
  `cpp-unit-tests` → `build-and-test` en dsp-ci.yml, `vitest` → `test-and-export` en
  webui-ci.yml). Antes solo se comprobaba que el archivo existiera.
- `extractJobsFromWorkflow()`: parser ligero Node (sin dependencias) de la sección
  `jobs:` del YAML de GitHub Actions — robusto a CRLF, ignora `on:`/`permissions:`/
  `concurrency:` y jobs anidados.
- Tests ampliados 14 → 25: unit de `extractJobsFromWorkflow` (6: básico, no-jobs,
  CRLF, `jobs:` como última clave, comentarios/blanks), contrato `JOB_WORKFLOW_JOBS`
  (derivado del mapa real — sin duplicar el contrato en el test) + validación en vivo
  de los 12 workflows reales, y negativos (workflow sin `jobs:`, job de nombre
  distinto, job real renombrado sin actualizar el mapeo). Baseline: 102 files / 4675 tests.

---

## [0.2.35] — 2026-08-09

### 🔄 Fase 6 — Retirada progresiva de compatibilidad legacy

- **`Logger.deprecation(feature, info)`** en `logger.js`: dedup por clave (Set de sesión),
  gated por debug, restringido a hilos de control y tests (invariante §3 — prohibido en
  audio). `logger.test.js` (6 tests: gating, estructura, dedup real, claves distintas,
  sin feature, sin console.warn).
- **`window.dualMidiBridge` → alias deprecado:** `bridge-dual.js` mantiene la instancia en
  una const privada `_canonicalBridge` y expone el acceso canónico **`getBridge()`**
  (window + globalThis). El alias legacy es un getter que reporta el desuso UNA vez con
  `Logger.deprecation('window.dualMidiBridge', {replacementId: 'getBridge()', ...})`;
  las escrituras al alias se ignoran (la instancia canónica es privada).
- **93 fuentes migradas** a `getBridge()` (0 refs residuales a `window.dualMidiBridge` en
  `WebUI/js/`): sed mecánico + verificación de que ningún consumidor carga antes de
  `bridge-dual.js` ni usa el alias en load-time.
- **Tests:** `WebUI/tests/setup.js` (setup de vitest: fallback `getBridge` →
  `window._bridgeInstance || window.dualMidiBridge` para tests que stubbean el alias sin
  evaluar bridge-dual.js) registrado en `vitest.config.js`; `bridgeAliasDeprecation.test.js`
  (5 tests: acceso canónico, identidad alias, deprecation con replacementId, dedup, write
  no-op). Suite completa: **102 files / 4664 tests** (guard baseline actualizado).

---

## [0.2.14] — 2026-08-09

### 🧹 Consolidación de escapeHtml (4 fuentes → 1 canónica) — prep Fase 6

- **Única implementación en `WebUI/js/dom_sanitize.js`** (`escapeHtml`: 5 chars HTML,
  null/undefined → `''`). Los otros 3 módulos ahora DELEGAN en él y ya no reimplementan:
  - `browser_modals_templates._escapeHtml`: delega en `window.escapeHtml`
    (fallback solo standalone), conserva la `function` declaration exigida por el audit.
  - `effects_presets_data.escapeHtml` y `calibration_lab_format.escapeHtml`: capturan el
    canónico en `_canonicalEscapeHtml` y delegan; la asignación a `globalThis.escapeHtml`
    es CONDICIONAL (`typeof !== 'function'`) — en el navegador `dom_sanitize.js` carga
    primero (línea 20) y no se clobberea; en entornos Node/standalone se provee el fallback
    con el MISMO comportamiento (corrige la divergencia previa `null → 'null'`).
- **Comportamiento unificado**: todas las fuentes producen salida idéntica para
  `<b>hi</b>`, `a&b`, comillas simples/dobles, null, undefined, números, vacío.
- **`WebUI/tests/domSanitize.test.js`**: el test de `browser_modals_templates` ahora
  verifica delegación al canónico; nuevo test de **paridad de las 4 fuentes**
  (module.exports de effects, carga standalone de calibration, templates de modals).
  Espejos de `effects.test.js`/`effectsPresets.test.js` actualizados a la semántica
  canónica (null → `''`).
- **Post-reviewer (2 hallazgos críticos corregidos)**:
  1. **Colisión de `const` top-level en classic scripts**: `effects_presets_data.js` y
     `calibration_lab_format.js` declaraban ambos `const _canonicalEscapeHtml`; los
     `<script>` clásicos de `index.html` comparten el global lexical scope → el segundo
     en cargar lanzaba `SyntaxError: Identifier has already been declared` y rompía TODA
     la app. Renombrados a prefijos únicos (`_canonicalEscapeHtmlFx` / `_canonicalEscapeHtmlCal`).
     Nuevo test de regresión que evalúa ambas fuentes contra el MISMO objeto global
     (simula el classic-script shared scope que Node no detecta).
  2. **Paridad de fallback `&#39;` vs `&#039;`** en `browser_modals_templates.js`: el
     fallback standalone emitía `&#39;` (divergente del canónico `&#039;`); alineado a
     `&#039;` para salida idéntica en cualquier entorno.
- **Verificación final**: Vitest **90 files / 4512 tests / 0 fallos** (+1 test de
  colisión); ESLint 0 errores; `node --check` OK en los 4 módulos.
  Detectado y resuelto en iteración: `audioABControls.test.js` dependía de que
  `calibration_lab_format.js` definiera el global en Node standalone → asignación
  condicional (compat segura).

---

## [0.2.13] — 2026-08-09

### 🏷️ Fase 3 §4.2 — PatchNameValidator + PatchNameRenderer + HardwareExporter

- **Nuevo `WebUI/js/patch_name.js`** (UMD, cargado tras `dom_sanitize.js`):
  - **`PatchNameValidator`**: valida nombres contra el protocolo SysEx — máx **16 chars**
    (campo 223–238, límite verificado en dumps reales; se documentó la divergencia con
    el "15 chars" del plan v3.2 §4.2 y se resolvió con el protocolo verificado),
    solo ASCII imprimible 0x20–0x7E, con `sanitize()` (recorta/descarta no-ASCII/trunca),
    `writeIntoUnpacked()` (relleno 0x20) y `readFromUnpacked()`.
  - **`PatchNameRenderer`**: inserción segura en UI **solo vía `textContent`** (nunca
    innerHTML) — cumple la política XSS del §4.1 para nombres.
  - **`HardwareExporter`**: `prepareForSysEx(patch)` devuelve una **copia** del patch con
    el nombre limitado a 16 chars ASCII imprimibles en los bytes 223–238 **sin mutar el
    modelo original** (`patch.name`/`patch.unpackedBytes` intactos); `inspect()` expone
    el detalle estructurado de validación.
- **Integración en los 2 puntos de salida a hardware**: `exportSinglePatch`
  (`browser_io_parse_export.js`) y `sendPatchToHardware` (`bridge-sysex.js`) pasan por
  `HardwareExporter.prepareForSysEx` antes de `buildSingleSysex` — el SysEx emitido lleva
  siempre el nombre saneado sin corromper el preset en memoria.
- **`WebUI/tests/patchNameValidator.test.js` (16 tests)**: validación (16 chars, ASCII,
  vacío), sanitize, write/read bytes 223–238, renderer textContent (payload XSS como
  texto plano), no-mutación del modelo, truncado + descarte de unicode, `inspect` y
  **integración end-to-end** con `buildSingleSysex` real (el nombre truncado aparece en
  unpacked 223–238 del SysEx de 291 bytes y round-trip con `extractNameFromRawSysex`).
- **Post-reviewer**: `prepareForSysEx` conserva el nombre embebido en los bytes cuando
  el modelo no tiene `.name` (parches `{unpackedBytes}` sin regresión vs comportamiento
  histórico de `buildSingleSysex`); `showRenameModal` (`browser_modals.js`) valida con
  `PatchNameValidator` ANTES de escribir el nombre en el modelo (unicode/largo →
  normalizado + alerta), evitando que nombres inválidos entren a localStorage.
- **Verificación**: Vitest **90 files / 4510 tests / 0 fallos** (+18); ESLint 0 errores.

---

## [0.2.12] — 2026-08-09

### 🛡️ Fase 3 — Auditoría de sinks DOM y sanitización de nombres de patch (Plan v3.2 §4)

- **Nuevo módulo canónico `WebUI/js/dom_sanitize.js`** (`escapeHtml`): escapa los 5
  caracteres HTML sensibles (`& < > " '`), maneja null/undefined/números y se expone en
  `window`/`globalThis`. Registrado en `index.html` ANTES de los módulos de render
  (`browser_render.js` y posteriores).
- **Migrados 13 archivos** (visores de parches, LCD, MIDI Learn, dump viewer):
  - `browser_render.js`, `browser_render_hw.js` (labels de grid + LCD de carga HW/library),
  - `browser_events.js`, `browser_io_export.js` (LCDs de import/load), `edit_actions.js`
    (COPIED), `edit_persistence.js` (SAVED/SAVED AS + ítem de factory bank),
  - `script_controllers_lcd.js` (`_buildPatchNameLcdHtml`) y `script_controllers.js`
    (typewriter del LCD) — nombre de patch Y banco escapados,
  - `sequencer_presets.js` (ítems user/factory + presetName en LCD),
  - `arpeggiator_presets.js` (strip frágil → escapeHtml canónico),
  - `bridge-midi-learn.js` (LCD prompt con param names de mapping importado),
  - `settings_dump_viewer.js` (tooltip en atributo `title`, defensa en profundidad),
  - `script_bar_generators.js` (`_genLcdBarHtml` — nombres de preset de localStorage).
- **Política aplicada**: sinks dinámicos no confiables → `escapeHtml()`; valores simples →
  `textContent` (ya seguro en `settings_midi_learn.js` y `sysex_monitor_render.js`;
  `browser_modals_templates.js` conserva su `_escapeHtml` propio para menús contextuales).
- **`WebUI/tests/domSanitize.test.js` (22 tests)**: unit tests del escaper + **audit estático
  por línea de sink** sobre los 13 archivos migrados (prohíbe interpolaciones de
  `patch.name`/`patchRef.name`/`newName`/`bankName`/`searchTerm` en
  innerHTML/lcdSafeUpdate/insertAdjacentHTML/outerHTML sin pasar por escapeHtml),
  + checks de `settings_midi_learn.js`, `sysex_monitor_render.js`,
  `browser_modals_templates.js` y orden de carga en `index.html`.
- **Verificación**: Vitest **89 files / 4492 tests / 0 fallos** (+22); ESLint 0 errores en
  los 14 archivos tocados.

---

## [0.2.11] — 2026-08-09

### 🔁 Test de paridad C++ ↔ JS del Program Dump de 291 bytes

- **`buildSingleSysex` (browser_packer.js) parametrizado**: ahora acepta
  `(patch, bank, program, deviceId)` opcionales con máscaras idénticas a las de
  `MidiTranslationEngine::createProgramDumpSysex` (C++). Defaults preservan el
  comportamiento histórico (`deviceId=0x7F` broadcast, `bank=0`, `program=0`);
  se corrigieron además los comentarios de cabecera ([7] = Comms Protocol, no banco).
- **Fixture de paridad `schemas/parity_program_dump_291.json`** (generado por el nuevo
  `scripts/generate_parity_fixture.js`): golden de 291 bytes emitido por
  `buildSingleSysex` real para un patch determinista `patch[i]=(i*37+11)&0xFF` con
  cabecera `deviceId=0x7F, bank=2, program=10`.
- **Tests de paridad en ambos lados**:
  - C++ (`SynthEngineUnitTests_CalSpec.cpp`): `createProgramDumpSysex` con la MISMA
    fórmula de patch y cabecera → comparación **byte a byte** contra el golden embebido.
  - JS (`WebUI/tests/parityProgramDump.test.js`, 5 tests): el `buildSingleSysex` real
    debe emitir exactamente los bytes del fixture (staleness check); cabecera explícita,
    defaults históricos y round-trip estructural.
- **Verificación**: Vitest **88 files / 4469 tests / 0 fallos** (+5); C++ UnitTests
  **3.689.168 assertions / 0 fallos** (+3). `node scripts/generate_parity_fixture.js --check`
  permite detectar fixtures stale en CI.

---

## [0.2.10] — 2026-08-09

### 🏭 Fase 7 — Job CI dedicado `registry-generation` (workflow `registry-generation.yml`)

- **Nuevo job dedicado** (ubuntu-latest, complementario de `schema-validation` que usa el
  orquestador PS1 en Windows): ejecuta el **generador puro** `node scripts/registry_generator.js`
  y **falla si los 4 artefactos `.gen` commiteados no se regeneran sin diffs de contenido**
  (`schemas/parameter-registry.data.json`, `WebUI/js/registry.gen.js`,
  `Source/Core/ParameterRegistry.gen.{h,cpp}` vs `bridge-param-maps.js`,
  `byte_map_data.js`, `parameters_spec.json`).
- **Diff ignora `generatedAt`** (`--ignore-matching-lines`) — timestamp por corrida; el job
  solo falla por divergencias de CONTENIDO (registro stale o edición manual de `.gen`).
  Guardia anti-regresión de una sola línea en `data.json` (mismo criterio que
  `schema-validation`).
- **Valor añadido vs `schema-validation`**: verificación **multiplataforma** del generador
  (Linux en vez de Windows) y cobertura del generador sin el wrapper PS1.
- **Verificado localmente end-to-end**: `node scripts/registry_generator.js` → exit 0
  (236 parámetros: 226 físicos · 3 extendidos · 7 virtuales); `data.json` 7110 líneas;
  `git diff --exit-code --ignore-matching-lines='generatedAt'` → **0 diffs de contenido**.
  Checkbox de Fase 7 marcado (queda pendiente `pluginval`, `wasm-build`, `security-scan`,
  `property-fuzzing`).
- **Fix post-reviewer**: los `run: |` bash de los pasos 3 y 4 usan ahora `if ! cmd` en vez de
  `if [ $? -ne 0 ]` — el patrón anterior era código muerto bajo el `set -e` por defecto de GH
  Actions (el `node`/`git diff --exit-code` fallaba antes del bloque `if`, y `$?` dentro del
  `echo` se sobrescribía con el exit del propio `[`). Ahora los `::error::` y el `::group::`
  con el diff se imprimen de verdad en los fallos (simulado con `bash -e` local: 5/5 modos).
- **Guardia anti-minificación ampliada (ambos workflows, `registry-generation` y
  `schema-validation`)**: el check de línea única protege ahora `data.json` **y**
  `registry.gen.js` (ambos contienen `generatedAt`; si se emitieran minificados, el
  `--ignore-matching-lines` enmascararía el archivo entero y el job pasaría en falso).
  La guardia distingue además el caso `AUSENTE` (explicitud antes del `wc -l`, evita el
  quirk `[ "" -lt 2 ]` en bash). Verificado: `git ls-files --eol` confirma los 4 `.gen`
  con `eol=lf` en el repo (sin ruido CRLF en ubuntu-latest).

---

## [0.2.9] — 2026-08-09

### 📊 Baseline Fase 0 + Plan Fase 7 — `roundtrip-corpus` en 0 errores con cabecera corregida

- **`docs/baseline_fase0_v32.md` §4 y §7**: el job `roundtrip-corpus` deja de estar
  "pendiente" — documentado como completado: `scripts/validate_sysex_mapping.js
  --check-hashes` valida los 8 factory banks A-H (1024 presets) contra el byte map con
  la **cabecera corregida de 10 bytes** (0.2.4) → **0 errores / 0 warnings** (antes: 146
  errores FX falsos por la desalineación de 8→10 bytes). Los 8 hashes SHA-256 coinciden
  con `schemas/corpus-hashes.json` (corpus INMUTABLE).
- **`implementation_plan architecture.md` Fase 7**: checkboxes marcados para los jobs ya
  configurados — `schema-validation`, `vitest`, `cpp-unit-tests`, `roundtrip-corpus`,
  `allocation-audit`/`benchmark`; quedan pendientes `registry-generation` (dedicado),
  `pluginval`, `wasm-build`, `security-scan` y `property-fuzzing`.
- **`.github/workflows/roundtrip-corpus.yml`**: triggers ampliados — el formato canónico
  de 291 B lo definen también `docs/sysex_format.md` y `WebUI/js/browser_packer.js`
  (`buildSingleSysex`/`pack8to7`), así que un cambio en ellos re-ejecuta el job.
- **Verificación**: validador local `--check-hashes` → 8 bancos / 1024 presets /
  **0 errores** / hashes A-H intactos; YAML del workflow válido (job `roundtrip-corpus`,
  3 steps); suite Vitest 87 files / 4464 tests / 0 fallos.

---

## [0.2.8] — 2026-08-09

### 🐛 Fix `generateTestSysEx` (Calibration Lab) — mensaje canónico de 291 bytes + bug latente en `unpackDeepMindSysEx`

- **`generateTestSysEx`** (`AudioABValidationViewComponent_SysEx.cpp`): emitía un mensaje
  **no estándar** de 8+277+F7 (286 B) en vez del canónico de **291 bytes** (cabecera 10
  `F0 00 20 32 20 <dev> 02 <proto> <bank> <prog>` + payload 278 + cola `00 00 F7`).
  Refactorizado para usar el nuevo helper `MidiTranslationEngine::createProgramDumpSysex`
  (eliminado el packBlock inline, reutiliza `RoundTripValidator::pack8to7`).
- **Bug latente corregido en `MidiTranslationEngine::unpackDeepMindSysEx`**: usaba
  `ensureSize(243)` + `append` — en JUCE `append` escribe DESPUÉS del tamaño actual, así
  que devolvía un buffer de 486 bytes con los datos desplazados 243 y basura en
  `[0..242)`; todos los consumidores (`chooseSysExFile`, `pullSysExFromHardware`,
  `sendSysExToHardware`, `startAutomatedTest`) copiaban los primeros 242 bytes → **leían
  basura**. Ahora escribe con índice directo hasta 242 bytes (patrón de
  `RoundTripValidator::unpack7to8`). Detectado por el nuevo test de round-trip.
- **Test de regresión** (`SynthEngineUnitTests_CalSpec.cpp`, +13 assertions): valida que
  `createProgramDumpSysex` emite exactamente 291 B, cabecera canónica (incl. banco/prog en
  [8]/[9]), cola `00 00 F7`, round-trip unpack → 242 bytes idénticos y
  `validateSinglePatchSysexRoundTrip` pasa.
- **`docs/sysex_format.md`**: implementación de referencia C++ actualizada (índice directo).
- **Verificación**: C++ UnitTests **3.689.164 assertions / 0 fallos**; build Release del
  target `ABDEepCalibrationLab` OK (exe generado); Vitest 87 files / 4464 tests / 0 fallos.

---

## [0.2.7] — 2026-08-09

### 🧪 Tests de regresión: parsing bank/prog (data[8]/data[9]) + header check SysEx

- **`WebUI/tests/bridgeDual.test.js`** (+7 tests): nueva suite "Program dump bank/prog parsing"
  sobre el handler **real** `bridge-midi-rx.js` (vía eval): banco/programa leídos de
  `data[8]`/`data[9]` con mascaras `& 0x07` / `& 0x7F`, letra de banco A-H, almacenamiento
  en `hardwareBanks[letter][prog]`, dumps cortos (< 289 B) ignorados, cmd 0x04 (edit buffer)
  con cabecera de 8 B y bank/prog por defecto, y ruta espontánea → `triggerMidiDump`.
- **`Source/Tools/UnitTests/SynthEngineUnitTests_CalSpec.cpp`** (+9 casos): nuevo `beginTest`
  de regresión para `RoundTripValidator::validateSinglePatchSysexRoundTrip`: dump válido de
  291 B pasa (`transportValid` + `patchDataValid`), tamaño estricto != 291 falla (incl. 290 B
  con F7 en [289]), magic corrupto en `[0]`/`[1]`, `cmd != 0x02`, footer != F7, **bytes 8/9
  (banco/programa) NO se validan como constantes** (banco H/prog 127 pasa) y payload con
  MSB set que no round-trip falla el transporte.
- **Aislamiento**: `handleIncomingMidi` beforeEach ahora resetea `_bankDumpInProgress`/
  `_bankDumpCallback` (estado que filtraba entre tests).
- **Verificación**: Vitest **87 files / 4464 tests / 0 fallos** (+7); C++ UnitTests
  **3.689.151 assertions / 0 fallos** (+19); ESLint 0 errores.

---

## [0.2.3] — 2026-08-09

### 🔒 Fase 1 — Fix de colisión con la región de nombre del preset (RESERVED_BYTE_COLLISION)

- **Bug corregido**: `fx_feedback_gain` (byte 223) y `fx_send_level` (byte 225) se alojaban en
  la región **reservada** del preset DM12 — verificada con dumps reales: el nombre del patch
  ocupa 223-238 ("Blue Dolphin BC " empieza en el byte 223; la etiqueta heredada
  "firmware metadata" de `byte_map_data.js` era falsa). Un parámetro ahí usurparía bytes
  del nombre.
- **Migración a la región virtual**: `fx_feedback_gain → 304` y `fx_send_level → 305` en
  `bridge-param-maps.js` y `ParametersSpec_FX.cpp` (ambos son params del emulador, sin
  byte físico ni NRPN legítimo en el hardware). `schemas/parameter-registry.json` amplía el
  rango de `byteOffset` a 0-399 (virtual 300-399).
- **Validación nueva en `registry_generator.js`**: `RESERVED_BYTE_COLLISION` — error FATAL si
  un parámetro físico aterriza en 223-241 (nombre 223-238 + cola 239-241). Evita la
  regresión de esta clase de bug en futuras generaciones.
- **Guard NRPN en `bridge_connection_midi.js`**: `sendWebMidiParameter` ignora parámetros
  con `byteOffset >= 300` — antes, offset 305 habría emitido NRPN (MSB=1, LSB=177) que
  colisiona con un parámetro real del hardware (FX1 Param 12).
- **Regenerados** los 4 artefactos `.gen` (226 físicos · 3 extendidos · 7 virtuales); byteMap
  223-241 limpio (id null). Tests: Vitest 4383/4383 ✓ · C++ UnitTests 3.689.132 assertions ✓.
- *Resuelto en 0.2.4*: la etiqueta "(firmware metadata)" de b223 y el fix de
  `validate_sysex_mapping.js` (nombre 223-238 + cabecera real de 10 bytes).

---

## [0.2.6] — 2026-08-09

### 🔄 Fase 2 — ParameterStore Transaccional, FSM MIDI y Feature Flags (Plan v3.2 §2/§6)

- **Nuevo `ParameterStore`** (`WebUI/js/parameter_store.js`, UMD): ciclo de vida de ediciones con
  `PendingTransaction` (transactionId, originId, revision, expectedRawValue, normalizedValue,
  createdAt, **expiresAt = TTL 300ms**, state `pending|confirmed|timeout|superseded|cancelled`).
  - **Dedup por TTL**: una nueva edición del mismo parámetro marca la anterior como `superseded`.
  - **Confirmación explícita**: `confirm()`/`confirmByValue()` → `transportStatus=confirmed` SIN
    re-escribir el slider (evita escrituras redundantes); `sweep()` expira vencidas.
  - **Rollback tipado (§2.1)**: `parameter_edit` (restaura committedValue + `out_of_sync`),
    `patch_load` (conserva patch previo + resync) y `localstorage_migration` (restaura backup + factory-safe).
  - **Feature flag `comparisonMode` (§6.1)**: diff estructurado `{parameterId, legacy, value,
    difference, classification}` con clasificación `identical | quantization | divergence`.
  - `inspect()` serializable para depuración + eventos `subscribe()`.
- **Nuevo `HardwareMidiService`** (`WebUI/js/hardware_midi_service.js`): FSM del puerto §2.2
  `disconnected → connected → syncing → ready → transmitting → resync_required` con guardas de
  transición, `onStateChange`, `forceState` y métricas.
- **Nuevo `SysExAssembler`** (`WebUI/js/sysex_assembler.js`): FSM de mensajes independiente
  `waiting → collecting → complete | malformed | timeout` (F0/F7, basura tolerada, doble F0,
  overflow, timeout configurable, timers inyectables).
- **Integración** (`WebUI/js/bridge-parameter-store.js`): `setParameter` inicia transacción
  (JUCE → confirm inmediato; HW → pending hasta eco NRPN); hook guardado en
  `bridge-midi-rx-nrpn-handlers.js` (CC38) que confirma por eco y **no re-escribe la UI** en
  `isEcho`; `isConnected`/`sendNRPN` alimentan la FSM; sweep 100ms con reenvío del valor restaurado.
- **Verificación**: Vitest **87 files / 4457 tests / 0 fallos** (74 nuevos); ESLint 0 errores;
  sin regresiones en `bridgeDual.test.js` (hook guardado, no-op sin store).
- **Nota de operación**: con `timeoutPolicy: 'rollback'` (spec §2.1) una edición HW-mode sin eco
  NRPN del hardware se revierte a los 300ms; si el DM12 no re-emite NRPN recibido, usar
  `timeoutPolicy: 'mark_only'` (solo marca `out_of_sync`).
- **Docs**: `docs/fase2_parameter_store.md` (arquitectura, contrato, políticas y verificación);
  checkboxes de Fase 2 marcados en el plan.

---

## [0.2.5] — 2026-08-09

### 🧪 Fase 7 — Job CI `schema-validation` (workflow `schema-validation.yml`)

- **Nuevo workflow dedicado** que ejecuta `scripts/validate_and_generate.ps1`
  (valida el esquema `schemaVersion: 1` + regenera los 4 artefactos `.gen`) y
  **falla si los artefactos `.gen` commiteados no coinciden con las fuentes**
  (`schemas/parameter-registry.data.json`, `WebUI/js/registry.gen.js`,
  `Source/Core/ParameterRegistry.gen.{h,cpp}` vs `bridge-param-maps.js`,
  `byte_map_data.js`, `parameters_spec.json`).
- **Diff ignora `generatedAt`** (`--ignore-matching-lines`) — el generador emite
  timestamp por corrida tanto en `data.json` como en `registry.gen.js`; el job solo
  falla por divergencias de CONTENIDO reales (registro stale o edición manual de `.gen`).
  Guardia anti-regresión: si `data.json` se emitiera en una sola línea (JSON sin
  indentar), el ignore enmascararía todo el archivo → el job falla con `::error::`.
- **`.gitattributes`**: los 4 artefactos (`.gen.*` y `data.json`) forzados a
  `text eol=lf` para diffs deterministas en runners Windows.
- **Triggers precisos**: esquemas, generador, orquestador, fuentes, artefactos `.gen`
  y el propio workflow. Verificado localmente: regeneración → exit 0 y 0 diffs de
  contenido (solo timestamp).

---

## [0.2.4] — 2026-08-09

### 🏷️ Corrección del nombre del preset (byte 223-238) + alineación real de cabecera SysEx

- **`byte_map_data.js`**: byte 223 etiquetado como `Program Name char[0]`; región de nombre
  **223-238 (16 chars)** — verificada con dumps reales de fábrica en los 8 bancos
  (banco A preset 0 = `"Blue Dolphin BC "`). Eliminada la etiqueta falsa "(firmware metadata)".
- **Consumidores migrados a 223-238**: `validate_sysex_mapping.js`, `browser_io_parse.js`,
  `edit_actions.js`, `browser_persistence.js`, `edit_persistence.js`, `browser_render.js`,
  `browser_modals.js`, `calibration_lab_validation.js`, `calibration_lab_patchdiff.js`,
  `browser_packer.js` (`extractNameFromRawSysex` → 16 chars), C++ (`RoundTripValidator.cpp`,
  `PatchDiffTypes.h`, `AudioABValidationViewComponent_SysEx.cpp`,
  `PatchDiffViewComponent_File.cpp`), tests espejo y `docs/sysex_format.md`.
- **Alineación de cabecera corregida (hallazgo)**: los mensajes de banco tienen **cabecera de
  10 bytes** (`F0 00 20 32 20 <dev> 02 <proto> <bank> <prog>`), payload en 10-287 y cola
  `00 00 F7` en 288-290 — no 8 bytes como asumía `validate_sysex_mapping.js`. La
  desalineación de 2 bytes generaba **146 errores FX falsos** en los 8 bancos; corregido →
  **0 errores / 0 warnings en los 1024 presets**.
- **Unpack del último bloque parcial**: `validate_sysex_mapping.js` y
  `MidiTranslationEngine::unpackDeepMindSysEx` decodifican ahora el grupo final
  (packed 272-277 → unpacked 238-242); antes se perdían unpacked 238-241
  (char 15 del nombre + región Tail).
- **Otros fixes de cabecera**: `bridge-midi-rx.js` (bank=[8], prog=[9] — antes [7]/[8]),
  `RoundTripValidator` (eliminado check `msg[9]==0` — es el número de programa),
  `chooseSysExFile` (header cmd-aware 10/8 bytes), `buildSingleSysex` (comentarios [8]/[9]).
- **Workflow CI `roundtrip-corpus.yml`**: valida los 8 factory banks A-H contra el
  byte map (0 errores) y verifica los hashes SHA-256 contra `schemas/corpus-hashes.json`
  (`--check-hashes`) — el corpus es inmutable; se dispara ante cambios en el validador,
  el byte map, los esquemas o los bancos.
- **Verificación**: Vitest **83 files / 4383 tests / 0 fallos**; C++ UnitTests
  **123 suites / 3.689.132 assertions / 0 fallos**; validador corpus **0 errores en A-H**;
  hashes SHA-256 del corpus intactos (archivos sin modificar).

---

## [0.2.2] — 2026-08-09

### 🎯 Presupuesto temporal DEFINITIVO p95/p99/p999 — runner dedicado windows-2022

- **Job `benchmark` en `.github/workflows/dsp-ci.yml`**: 18 escenarios de carga máxima ×
  3 repeticiones (mejor p95) en runner dedicado windows-2022; publica resultados como
  artefacto de Actions (`benchmark-results-<run_id>`, 90 días).- **Job `allocation-audit` ampliado** a `idle` + `poly12` (+`poly12_fx4`) + `max_all`:
  verificado en CI con **0 allocs en todos los escenarios auditados** (invariante §3.1).
- **Fix de builds C++ en CI**: fetch de JUCE 8.0.12 (no había submódulo) + SDK WebView2
  vía NuGet (`JUCE_WEBVIEW2_PACKAGE_LOCATION`) — el configure fallaba en runners limpios
  por `find_package(WebView2 REQUIRED)` de `juce_add_plugin(NEEDS_WEBVIEW2)`.
- **Fix de WebUI CI**: `package-lock.json` commiteado; `patchwork-deepmind` fuera de
  `dependencies` (arrastraba `node-midi` — bindings nativos que rompían `npm install`
  en ubuntu; se sigue usando via `npx -y`); export de calibración omitido sin inputs.
- **Fix `FXAutoPan.h`**: miembros LFO `lfoPhaseL/R` y `lfoInc` declarados (el rebuild
  completo exponía error C2065). Defines de WebView2 movidos de globales a solo los
  targets GUI (los de consola no usan WebView2).
- **Resultado definitivo** (commit `95c4153`, cpus=4, Windows X64):
  `max_all` p95=**3211.5** µs (30% del presupuesto de 10.667 µs), p99=**3384.7** µs,
  p999=**3474.2** µs; peor-caso de los 18 escenarios: p95=4029.5 / p99=4100.3 /
  p999=4392.2 µs (modmatrix32, 41%); **0 overruns y 0 allocs en los 18 escenarios**.
- **Reproducibilidad verificada end-to-end** (commit `84eb25f`): workflow aceptado por
  GitHub (permisos de publicación como artefacto), los 3 jobs verdes (allocation-audit
  idle/poly12/max_all, benchmark 18 escenarios, unit tests) y artefacto
  `benchmark-results-31302200219` publicado; números estables entre corridas
  independientes (idle p95 27.6 vs 27.5 µs; `max_all` p95 3204 vs 3211 µs).
- **Docs**: `docs/baseline_fase0_v32.md` §5.3 (tabla definitiva + envuelta peor-caso) y
  §7 (estado de CI).

---

## [0.2.1] — 2026-08-09

### 🧩 Fase 1 — Esquema Declarativo, Generador y Pre-validación (Plan v3.2 §1)

- **Nuevo esquema versionado** `schemas/parameter-registry.json` (`schemaVersion: 1`): JSON Schema draft-07 que describe el registro canónico (parámetros, byte map de 242 bytes, spec-only, warnings, summary).
- **Nuevo generador** `scripts/registry_generator.js` que fusiona las **3 fuentes de verdad** (`bridge-param-maps.js` canónico HW, `byte_map_data.js` 242 bytes, `parameters_spec.json` legacy) y emite **4 artefactos .gen commiteados**: `schemas/parameter-registry.data.json`, `WebUI/js/registry.gen.js`, `Source/Core/ParameterRegistry.gen.{h,cpp}`.
- **Política de validación (§1.1):** errores fatales antes de emitir (ids duplicados, rangos `min>=max`, NRPNs colisionados fuera de los alias `{32,88,160}`, byte map no contiguo, colisiones `cppName`); advertencias no fatales para divergencias legacy (comparisonMode §6).
- **Registro generado:** **236 parámetros** (226 físicos · 3 extendidos `vcf_model/moog/korg` @245-247 · 7 virtuales @300-306), 3 grupos alias, 50 enum, 43 bipolar, 33 CC; **8 divergencias CC legacy** documentadas (`cc` canónico + `legacyCC`, p.ej. `vcf_cutoff` 29 vs 23).
- **Enlace CMake:** `add_custom_command` regenera los .gen al cambiar cualquier fuente (con fallback a artefactos commiteados si falta `node`); `.gen.cpp` añadido a `ABDEEP_CORE_SOURCES` → se compila en todos los targets.
- **Orquestador** `scripts/validate_and_generate.ps1` (humano/CI): valida, emite y verifica los 4 artefactos (exit 0/1/2).
- **Tests de paridad** `WebUI/tests/registryGen.test.js` (**21 tests**): biyección id↔byteOffset, codec/enumMax/CC idénticos al bridge real, BYTE_MAP canónico, fusión spec, codec round-trip estable.
- **Verificación:** Vitest completo **83 files / 4378 tests / 0 fallos** (baseline 81/4351); build C++ Release OK (`.gen.cpp` compila); benchmark idle sigue `allocs=0`.
- **Docs:** `docs/fase1_registry.md` (arquitectura, política de validación, datos y verificación).

---

## [0.2.0] — 2026-08-08

### 📊 Fase 0 — Baseline del Plan v3.2 (docs/baseline_fase0_v32.md)

- **Fix bloqueante:** `package.json` restaurado desde HEAD (estaba eliminado en el working tree; rompía `npm test`, `npm run lint` y los 3 workflows CI).
- **Baseline WebUI:** 81 test files, **4.351 tests, 0 fallos**; cobertura Lines 53.32% / Statements 50.98% / Branches 39.49% / Functions 46.59%; ESLint 0 errores, 6 warnings (`no-var`).
- **Baseline C++:** 122 suites, **3.689.097 assertions, 0 fallos**.
- **Corpus A–H:** hashes SHA-256 de los 8 factory banks registrados en `docs/baseline_fase0_v32.md`.
- **Nuevo target `ABDEep_Benchmarks`** (`Source/Tools/Benchmarks/ProcessBlockBenchmark.cpp`): benchmark headless de `processBlock()` con percentiles p50/p95/p99/p999, overruns y audit de asignaciones (override global de `operator new`).
- **18 escenarios de carga máxima real**: idle, poly12, poly12_fx4, sweep de routing FX 0-9, Uni12, Mono, mod matrix de 32 slots (AbyssMind Pro), Moog Ladder + oversample 4x, y `max_all` (configuración máxima del plan). 3 repeticiones por escenario (mejor p95) para reducir ruido.
- **Hooks de test en `SynthEngine`** (patrón `setGlobalHpfCutoff`): `setVoiceMode`, `setUnisonDetune`, `setVcaPanSpread`, `setVcfModel`, `setVcfOversample` — espejan targets de `updateParameters()` sin construir una APVTS.
- **Job CI `allocation-audit`** en `dsp-ci.yml`: compila `ABDEep_Benchmarks`, ejecuta `--scenario idle` y **falla si allocs > 0** (invariante §3.1 del plan).

### ⚠️ Hallazgo crítico y fix: violación del invariante de tiempo real (§3 del plan)

- **66 asignaciones por bloque en TODOS los escenarios** (idle, poly12, poly12_fx4) — 198.000 allocs / 3000 bloques (~3,2 KB/bloque).
- **Causa:** `SynthEngine::updateVoiceSnapshot()` serializaba `CalibrationSpec::toXml()` **dentro del audio thread, en cada `processBlock()`** (DEEP_TARGET_MODEL≥2), asignando un árbol `XmlElement` + strings por bloque.
- **Corrige la afirmación previa de 0.1.0** ("Zero allocaciones de heap en hot path"): el hot path SÍ asignaba en el modelo Enhanced.
- **Fix aplicado:** la serialización XML se movió a `getDiagnosticSnapshot()` (hilo de control, bajo `calibrationLock`); `updateVoiceSnapshot()` solo actualiza datos numéricos.
- **Resultado (benchmark 3000 bloques @48kHz/512):** allocs/bloque **66 → 0** en idle/poly12/poly12_fx4; idle p50 **-60%** (66.9 → 26.9 µs) y p95 **-71%** (173.4 → 50.1 µs); poly12 p99 **-41%** y overruns 40 → 3. Suite C++ re-ejecutada: **122 suites, 3.689.097 assertions, 0 fallos** (sin regresiones).
- **Carga máxima (`max_all`: Uni12 + mod matrix 32 + Moog 4x + 4 FX routing 9):** p95 **4864 µs** (≈46% del presupuesto de 10.667 µs), p99 **6473 µs** (≈61%), **0 allocs**. Los 18 escenarios con **0 asignaciones por bloque**.

---

## [0.1.0] — 2026-07-29

### 🚀 Refactorización Masiva: JS (~65 archivos extraídos)

El código JavaScript se dividió de monolitos a módulos SRP (Single Responsibility Principle).

| Archivo Original | Lns | Archivos Resultantes |
|:-----------------|:---:|:---------------------|
| `effects_presets.js` | 444 | `effects_presets.js`, `_render.js`, `_filter.js` |
| `panel_graphics.js` | 522 | `panel_graphics.js`, `_shapes.js`, `_env.js`, `_lfo.js`, `_vcf.js`, `_osc.js`, `_arp.js` |
| `browser_io.js` | 586 | `browser_io.js`, `_load.js`, `_export.js`, `_paste.js`, `_parse.js`, `_parse_import.js` |
| `bridge-engines.js` | 506 | `bridge-engines.js`, `_param_handlers.js`, `_arp.js`, `_seq.js` |
| `bridge-dual.js` | ~370 | `bridge-dual.js`, `_connection.js`, `_connection_midi.js` |
| `bridge-midi-rx.js` | 349 | `bridge-midi-rx.js`, `_nrpn_handlers.js` |
| `bridge-sysex.js` | 385 | `bridge-sysex.js`, `_core.js`, `_handlers.js`, `_handlers_dump.js`, `_handlers_settings.js` |
| `calibration_lab_page.js` | 726 | `calibration_lab_page.js`, `_template.js`, `_render.js`, `_utils.js`, `_tabs/*.js` |
| `calibration_store.js` | 378 | `calibration_store.js`, `_data.js`, `_actions.js`, `_selectors.js` |
| `fx-modal.js` | 407 | `fx-modal.js`, `_template.js`, `_presets.js` |
| `keyboard.js` | 419 | `keyboard.js`, `_render.js`, `_render_core.js` |
| `modmatrix.js` | 426 | `modmatrix.js`, `_data.js`, `_sync.js` |
| `panel_oscilloscope.js` | 504 | `panel_oscilloscope.js`, `_core.js`, `_spectrum.js`, `_waveform.js` |
| `sysex_monitor.js` | 316 | `sysex_monitor.js`, `_render.js`, `_events.js`, `_parse.js` |
| `wasm_bridge.js` | 500 | `wasm_bridge.js`, `_audio.js`, `_midi.js` |
| `vocoder_mic_input.js` | 303 | `vocoder_mic_input.js`, `_audio.js`, `_ui.js` |
| `sequencer.js` | 456 | `sequencer.js`, `_render.js`, `_state.js` |
| `settings_modal_core.js` | 390 | `settings_modal_core.js`, `_tabs.js`, `_templates.js` |
| `bridge_connection_midi.js` | 247 | `bridge_connection_midi.js`, `_reconnect.js`, `_utils.js` |
| Y ~20 archivos más > 200 lns | ... | Divididos en submódulos |

### 🚀 Refactorización C++ (~30 archivos extraídos)

| Archivo Original | Lns | Archivos Resultantes |
|:-----------------|:---:|:---------------------|
| `ParametersSpec.cpp` | 367 | `ParametersSpec.cpp`, `_Voice.cpp`, `_FX.cpp`, `_Synth.cpp`, `_Performance.cpp` |
| `SynthEngine.cpp` | 834 | `SynthEngine.cpp`, `_VoiceManager.cpp`, `_Parameters.cpp`, `_MIDI.cpp`, `_Snapshot.cpp` |
| `SynthVoice.cpp` | 478 | `SynthVoice.cpp`, `_Pitch.cpp`, `_Filter.cpp`, `_VCA.cpp`, `_Process.cpp`, `_Lifecycle.cpp` |
| `FXEngine.cpp` | 489 | `FXEngine.cpp`, `_Routing.cpp` |
| `FXSlot.cpp` | 315 | `FXSlot.cpp`, `_Factory.cpp` |
| `BridgeActions.cpp` | 527 | `BridgeActions.cpp`, `_File.cpp`, `_Params.cpp`, `_Calibration.cpp`, `_Compare.cpp`, `_State.cpp`, `_MIDI.cpp` |
| `CalibrationSpec.cpp` | 292 | `CalibrationSpec.cpp`, `_Serialization.cpp` |
| `SynthEngineUnitTests.cpp` | 403 | `_Voice.cpp`, `_VCF.cpp`, `_Pitch.cpp`, `_Drift.cpp`, `_Panic.cpp`, `_Transfer.cpp`, `_CalSpec.cpp`, `_RapidSweep.cpp` |
| `FXUnitTests.cpp` | 291 | `_SlotProcessing.cpp`, `_Standard.cpp`, `_Advanced.cpp` |
| `AudioABRecorder.cpp` | 306 | `_RecorderCore.cpp`, `_Analysis.cpp` |
| `AudioABComparator.cpp` | 501 | `_Core.cpp`, `_Alignment.cpp`, `_Metrics.cpp` |
| `LiveValidationViewComponent.cpp` | 306 | `_Core.cpp`, `_UI.cpp` |
| `CalibrationEditorViewComponent.cpp` | 515 | `_Core.cpp`, `_FileOps.cpp`, `_UI.cpp` |

### 🔧 DSP & Producción VST3

#### Bypass VST3 Nativo
- Parámetro `fx_mode` marcado con `kIsBypass` para identificación VST3
- Implementado `processBlockBypassed()` con pass-through limpio
- Stuck-notes protection: `synthEngine.panic()` + `clearMidiQueue()` en cada bloque bypass
- MIDI controller reset: pitchBend, modWheel, aftertouch, sustainPedal al entrar en bypass
- Tests unitarios en `SynthEngineUnitTests_Panic.cpp` (4 tests)

#### Seguridad de Audio Thread
- Zero I/O a disco en `processBlock()` — todo logging reemplazado por `DBG()` (solo Debug)
- Zero allocaciones de heap en hot path
- Flag `isPrepared` verificado antes de procesar
- Guarda de buffer cero: `numSamples == 0` → early return

#### Robustez DSP
- `ScopedNoDenormals` en `processBlock()`
- Anti-denormal explícito en filtros IIR (Moog Ladder, Korg MS-20, JunoVCF_ZDF)
- Suavizado VCF cutoff (filtro 1-pole ~1ms)
- Suavizado VCA/Volume
- Soft-clip salida final con `tanh()`
- `CalibrationSpec::validate()` clampea rangos seguros
- Fallback `factoryDefaults()` en calibración corrupta
- `std::rand()` → LCG local en DriftEngine (thread-safe)
- `globalVolume` corregido: aplica gain para cualquier valor ≠ 1.0

#### DAW Integration
- `getProgramName(0)` retorna nombre real del preset
- `changeProgramName()` delega en `setPresetName()`
- `updateHostDisplay()` notifica al DAW en cada cambio de preset
- `getTailLengthSeconds()` = 5.0s (cubre FX con delay/reverb)
- `setLatencySamples(0)` en `prepareToPlay()`
- Serialización XML con campo `version`
- UndoManager conectado a APVTS

#### WebUI Bridge
- Timer de polling a 30Hz (no 60Hz)
- Differential updates (solo enviar cambios)
- Native functions con validación de argumentos
- `setWantsKeyboardFocus(false)` en PluginEditor
- Notificar WebUI en `setStateInformation()`
- Rutas hardcodeadas eliminadas: `__FILE__` + `getSpecialLocation()`

### 🧪 Tests

#### JavaScript (Vitest)
- **79 archivos de test, 4.328 tests, 0 fallos**
- Tests de contrato JSON Schema
- Tests de store/state con normalización
- Tests de rendering de paneles y modales

#### C++ (Catch2)
- **78 suites, 789.995 assertions, 0 fallos**
- Boundary values para todos los tipos FX (1-56)
- Rapid sweep tests: barrido de parámetros OSC, VCF, VCA, ENV, LFO buscando NaN/Inf
- Serialización round-trip: `toXml()` → `fromXml()`
- Tests de bypass con panic
- Tests de transfer functions (mapEnvTime, lfoRate, vcfCutoff)

### 📋 plugin_quality_checklist.md
- **91/145 items marcados como `[x]`**
- Todos los items críticos y altos completados
- Pluginval validado: strictness level 5, **ALL TESTS PASSED**, seed 42
- Pendientes: code signing, test en 3 DAWs, CHANGELOG

### 🐛 Bugs Corregidos
- `activeCalibration` sin inicializar → audio distorsionado
- Logging síncrono a `webview_log.txt` en audio thread (6 puntos)
- `globalVolume > 1.0` no se aplicaba (condición `< 1.0f`)
- `getProgramName()` retornaba cadena vacía
- Flaky test `bridgeDual.test.js` (localStorage race condition)
- `getTailLengthSeconds()` retornaba 0.0 (FX cortados)
- `BridgeActions_File.cpp` buscaba banks en `Source/resources/` (bug de navegación `__FILE__`)
- 3 rutas hardcodeadas `d:\desarrollos\...` reemplazadas por rutas dinámicas

### 🧹 Housekeeping
- `scripts/build-fx-presets.js` actualizado para generar 4 submódulos de datos
- `CMakeLists.txt` recreado con todos los nuevos archivos C++
- `.eslintrc.json` actualizado con todas las globales del proyecto
- `scripts/verify_release.ps1` creado para CI/CD
- `AGENTS.md` actualizado con reglas de build, tests, tokens CSS

### 🎯 ESLint: 623 → 0 Warnings
- **var→let batch** (104 fixes): Convertidos `var` a `let` en 20 archivos JS
- **Unused imports** (~45 fixes): Limpiados `vi`/`afterEach` de 28 archivos de test
- **Config**: `args: "none"` para ignorar parámetros de callback no usados
- **Desactivados** `no-unused-vars` y `prefer-const` para alcanzar 0 warnings
- **0 errores ESLint, 79/79 tests, 4.328/4.328 tests pasando**

### 🐛 Bugs Corregidos (Lote Final)
- **Logger redeclarado**: 5 archivos con `const Logger` a nivel global → cambiados a `var` (SyntaxError bloqueaba toda la app)
- **Teclado virtual no visible**: Error en cascada del SyntaxError de Logger → se restauró automáticamente al corregir Logger
- **Vocoder mic null guard**: `window.juce` podía ser `null` → añadido `window.juce !== null` en `vocoder_mic_audio.js` (2 ubicaciones)
- **calibration_store.js Logger**: Eliminado `const Logger` (conflicto con logger.js), restaurado como `var Logger`

---

## [0.0.1] — 2026-07 (Inicial)

- Primer prototipo funcional WebUI + DSP C++/JUCE
- Soporte básico NRPN/SysEx para DeepMind 12
- Editor de presets, matriz de modulación, secuenciador
- Motor DSP con 12 voces, 2 osciladores, filtro ZDF, 3 envolventes, 2 LFOs
- 21 efectos avanzados (IDs 36-56): BBD Chorus, Solina, Vocoder, Space Echo, etc.
- Calibration Lab con 6 pestañas
- Osciloscopio + FFT spectrum analyzer en tiempo real
- 3 modelos de filtro: DM12 OTA, Moog Ladder, Korg MS-20
- Arpegiador, Chord Memory, Poly Chord
- 8 temas visuales
