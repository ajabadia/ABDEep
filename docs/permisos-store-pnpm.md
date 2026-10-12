# Store de pnpm con permisos rotos: por que la suite no arrancaba, y como se arreglo

> **Resumen:** desde el sandbox, `pnpm install` queda instalado pero **51 de 200** ficheros
> de `node_modules/.pnpm` no se pueden leer. Eso no tumba 4 tests: tumba **los 128
> ficheros** de la suite con un `Startup Error` antes de correr ninguno. No hay cambio de
> codigo que lo arregle, porque el bloqueo es de Windows sobre ficheros concretos, no del
> repo. Fecha del diagnostico: **2026-10-02**.

## El sintoma

Cualquier invocacion de vitest desde el sandbox termina igual:

```
$ npx --no-install vitest run WebUI/tests/fitStage.test.js

⎯⎯⎯⎯⎯⎯ Startup Error ⎯⎯⎯⎯⎯⎯
Error: Cannot read package config \\?\D:\desarrollos\ABDSynths\node_modules\.pnpm\
vitest@4.1.11_...\node_modules\magic-string\package.json: operation not permitted.
    code: 'ERR_INVALID_PACKAGE_CONFIG'
```

`fitStage.test.js` son **6 tests** que no tienen nada que ver con vitest, con `magic-string`
ni con la API interna. Fallan igual, y eso es la prueba de que el problema no es del test.

## Lo que NO es, medido

| Hipotesis | Resultado |
|---|---|
| Solo afectan a mis contratos nuevos | Falso: `ciSubprocessTests.test.js` y `fitStage.test.js` tambien |
| Es un permiso de carpeta | Falso: la carpeta se **lista** bien (`LICENSE`, `dist`, `package.json`) |
| Los permisos del fichero estan mal | Falso: son `-rw-r--r--` y el propietario soy yo |
| Es un problema de mi shell | Falso: PowerShell da `GetContentReaderUnauthorizedAccessError` |
| Es un `node_modules` a medias por el salto de version | Falso: las copias viejas de vitest 1.6.1 tambien apuntan al mismo `magic-string` |

Que PowerShell **tambien** falle, y que no se pueda ni leer la ACL
(`Get-Acl` → `UnauthorizedAccessException`), senala a un bloqueo de Windows —muy
probablemente del Defender— y no a una ACL de usuario.

## Lo que SI es

- **51 de 200** ficheros `package.json` del store son ilegibles (25 %). Agrupados por
  familia: 41 de `eslint`, 11 de `@eslint/eslintrc`, 9 de `get-intrinsic`, 7 de
  `optionator`, 6 de `vitest`, 5 de `ajv`, 4 de `jsdom`… y **`magic-string`**, que es el
  que aparece en el error.
- **No es aleatorio y no es reciente**: los ficheros ilegibles son del **6 de marzo de
  2026**; los legibles, de **hoy**. `eslint@8.57.1` (5 de septiembre) se lee bien, asi
  que no es "todo lo viejo": es un subconjunto.
- **Una sola copia de `magic-string`**, y es la mala. El store tiene 3 versiones de
  vitest (dos de 1.6.1 y una de 4.1.11) y las tres apuntan al mismo `magic-string`.

## Por que lanzar vitest como subproceso NO lo arregla

Porque el subproceso tampoco puede leerlo. MEDIDO:

```
$ node -e 'import("vitest/node").then(...)'   # desde ABDEep
FALLA ERR_INVALID_PACKAGE_CONFIG
```

Un `node` limpio lanzado desde el repo falla igual, porque la cadena de resolucion de
`vitest/node` pasa por `magic-string/package.json` para leer su `exports`. El bloqueo es
del **contenido** del fichero: ningun proceso, con ningun arguments, puede sortearlo.

## Que se ha descartado como solucion

- **Sustituir los imports por subprocesos**: ya es lo que hacen
  `glob-test-files.mjs` y `describe-spec-shape.mjs`. Falla por lo mismo.
- **Usar la sonda aislada** de `build/vitest4-sonda/`: funciona, pero entonces **no se
  mide el vitest del repo**, que es justo lo que hay que medir. Sirve para iterar, no
  para cerrar.
- **`import.meta.resolve` / `createRequire` en vez de `import()`**: solo evita el alias
  `@id/` de Vite, que es otro problema distinto. No toca el `EPERM`.

## COMO SE TRABAJO ENTONCES (historico)

> **Superado.** Se deja como registro de lo que habia que hacer mientras el store
> estaba roto. **Hoy no hace falta elevacion para correr la suite**: ver
> «RESUELTO» mas abajo.

Con **elevacion** (`request_elevation` → `build/*.bat`). Ahi el store se lee y todo
funciona: la suite completa daba `127 passed (127)`, `5128 passed | 2 skipped
(5130)`, `SUITE_RC=0` (medido el 2026-10-02 con vitest 4.1.11, antes de anadir los
contratos de dependencias).

## RESUELTO (2026-10-02): `pnpm install --force`

**51 ilegibles -> 0.** Y la suite entera pasa en el sandbox, sin elevacion:

```
Test Files  129 passed (129)
     Tests  5159 passed | 2 skipped (5161)
  RC=0
```

La causa era permiso de Windows sobre ficheros concretos del store, no del repo y no
de la version instalada. Reinstalar los reescribio y quedo bien. El `pnpm-lock.yaml` y
el `package.json` de la raiz quedaron **con el mismo md5** antes y despues, medido.

Lo que se aprende de esto, mas util que el arreglo:

- **Un `Startup Error` que tumba los 128 ficheros no es un problema de tests.** El
  sintoma apuntaba a 4 tests; la causa era comun a los 129. Un fichero de 6 asserts sin
  relacion con vitest fallaba igual, y ese fue el dato que cambio la pregunta.
- **La comprobacion de si algo es un problema de permisos o de version se hace antes de
  tocar codigo.** `vitestInstaladoCoincide.test.js` ya distingue las dos cosas, y por
  eso el diagnostico no se fue por el camino de "subir mas el rango".
- **Los ficheros ilegibles eran del 6 de marzo y los legibles de hoy**, con `eslint`
  de septiembre en medio. Si todo lo viejo estuviera roto, la explicacion seria "un
  install viejo"; que un fichero de septiembre se lea bien descarta esa lectura y
  apunta a un subconjunto bloqueado por algo externo.

## COMO SE ARREGLO

**`pnpm install --force` en la raiz del monorepo**, desde una consola con
privilegios. Basto, y no hizo falta tocar el Defender ni copiar el store:

```
pnpm install --force            # en D:\desarrollos\ABDSynths
```

Si `pnpm install` no basta, lo siguiente seria una excepcion de Defender para
`D:\desarrollos\ABDSynths\node_modules\.pnpm`, o copiar el store a una ruta sin
cuarantena. **Cualquiera de las dos cosas toca fuera de este repo**, asi que es
decision de quien lo lleve, no de una sesion de pruebas.

## Lo que este hallazgo NO invalida

- Los 4 contratos de `WebUI/tests/contratosDeDependencias.test.js` siguen en pie:
  **17/17 verdes** con el vitest del repo en elevacion.
- `vitestInstaladoCoincide.test.js` sigue verde, y es el que habria detectado un store a
  medias por version. Que aqui el problema sea de **permisos** y no de version es
  justamente lo que ese guard distingue.