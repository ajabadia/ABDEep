/**
 * Lo que el generador ESCRIBE, lo que el CI COMPRUEBA y lo que el guard
 * DESCUBRE: las tres listas, y el cruce entre ellas.
 *
 * ESTO ES LA CONVERSA DE `gitattributesGuard`, Y TIENE OTRA FORMA
 *
 * En ABDSharedAssets la lista del preflight esta EXPORTADA, asi que cruzarla con
 * el descubrimiento es importar dos listas. Aqui no hay nada exportado, porque
 * `registry_generator.js` no se puede importar: se ejecuta al cargarlo. Asi que
 * las dos listas se LEEN del fuente.
 *
 * Parsear es fragil y no quiero fingir lo contrario: si el generador cambia de
 * forma, estos tests tienen que ponerse ROJOS diciendo que no han leido nada, y
 * nunca verdes fingiendo que si. Por eso los dos `lee` lanzan si no encuentran
 * lo que buscan, y el primer test mide que las tres listas tienen algo dentro.
 *
 * LAS TRES LISTAS, Y QUE ES CADA UNA
 *
 *   - `OUT` en `scripts/registry_generator.js`: donde el generador dice que
 *     escribe. Es su unica declaracion, y es una Constante de objeto, asi que
 *     se lee sin ejecutar nada.
 *   - `artifacts=(...)` en `.github/workflows/registry-generation.yml`: los
 *     ficheros contra los que el CI hace `git diff --exit-code` DESPUES de
 *     regenerar. Si un artefacto no esta en esa lista, el generador lo
 *     reescribe y el CI no mira si ha cambiado.
 *   - Lo que descubre `gitattributesGuard`: los ficheros que se COMPARAN byte a
 *     byte y necesitan una regla que los fije en LF.
 *
 * LA CONVERSATA: `registry_generator.js` NO TIENE `--check`
 *
 * Se comprobe, y no es un fallo: el generador escribe siempre y su puerta es
 * otra. El job del CI lo ejecuta y luego exige que el arbol quede limpio, lo
 * cual es la MISMA comprobacion con otra forma: "el fichero commiteado es
 * exactamente el que produce el generador". Un `--check` daria el mismo aviso
 * antes, en local, y por eso `generate_fx_contract.mjs` si lo tiene.
 *
 * El problema de esa puerta es el de todas las puertas con lista: la lista esta
 * escrita a mano y en el sitio equivocado. El generador declara sus cuatro
 * salidas en `OUT` y el CI vuelve a declararlas en un array de bash, y no hay
 * nada que compruebe que las dos digan lo mismo. Anade una quinta salida al
 * generador y el CI regenerara el fichero y no mirara si ha cambiado: el
 * artefacto queda commiteado desfasado, y el unico sintoma es un `.gen` viejo
 * que el panel sigue leyendo.
 *
 * Y esa es justo la direccion que este fichero comprueba, mas la contraria: que
 * la puerta exista, que el generador escriba todo lo que declara, y que el
 * guard vea todo lo que el generador escribe.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import { gitSeguro, RAIZ } from './helpers/gitSeguro.js';
import { descubreArtefactos } from './gitattributesGuard.js';

// La raiz del repo NO se cuenta aqui. Este fichero vivia en `WebUI/tests/` y se
// resolvian tres niveles a mano, y ese numero se separo del que usa
// `helpers/gitSeguro.js`: con dos, `ls-files` funcionaba —el helper tiene bien el
// suyo— mientras todo lo demas miraba `ABDEep/WebUI/`, donde
// `scripts/registry_generator.js` no existe. Los `lee*` de abajo no lanzaban por
// eso, sino porque en un fichero inexistente no hay nada que lanzar: devolvian
// listas vacias, y comparar vacias contra vacias da VERDE.
//
// Que se notara hacia falta mirar que el test comprobaba algo. Un `readFileSync`
// sobre un fichero que no existe lanza; uno que lee `undefined` y lo pasa por
// `exec` no lanza nada.
//
// Ahora las dos cosas salen del helper, que ya sabe donde esta. Aqui queda solo
// el alias, porque el resto del fichero habla de `repoRoot` y renombrarlo todo no
// aporta nada.
const repoRoot = RAIZ;
const NUL = String.fromCharCode(0);

const GENERADOR = resolve(repoRoot, 'scripts', 'registry_generator.js');
const WORKFLOW = resolve(repoRoot, '.github', 'workflows', 'registry-generation.yml');

/**
 * Los ficheros que git tiene versionados.
 *
 * AQUI NO SE TRAGA EL ERROR, Y ES LO QUE HACE ESTE FICHERO DISTINTO DE SUS TRES
 * HERMANOS. `leeOut`, `leeEscritos` y `leeArtefactosDelCi` lanzan cuando no
 * encuentran lo que buscan, porque comparar contra una lista vacia es verde y
 * mentira. Devolver [] aqui hacia eso mismo, pero PEOR: los tests de abajo no
 * comparan contra el vacio, ACUSAN. Con la lista vacia el rojo sale diciendo
 * "el guard no descubre estos cuatro artefactos", cuando el guard los descubre
 * bien y lo unico que fallo fue leer la lista. Eso manda a mirar al fichero
 * equivocado, que es el fallo mas caro de todos: el test no esta roto, lo que
 * esta roto es el diagnostico que da.
 *
 * Y POR QUE NO HAY UN CENTINELA QUE LO CATCHE, COMO EN `gitattributesGuard`.
 *
 * Alli el helper traga el error y hay un test —«el guard tiene ficheros con los
 * que trabajar»— que se pone rojo con un mensaje escrito a mano. Aqui no puede
 * haber eso: el centinela tendria que ir PRIMERO, y aunque fuera primero, los
 * otros cinco tests seguirian poniendose rojos por su cuenta y el que se lee
 * primero no seria el que dice la verdad. Un centinela que convive con cinco
 * posibles de mentira no es un centinela.
 *
 * Asi que aqui se LANZA, y se lanza por `gitSeguro`, que ya pone la excepcion de
 * `dubious ownership`. Si llega aqui, de verdad no hay checkout, y el mensaje lo
 * dice. Es la misma conclusion a la que llego `gitattributesGuard` por otra
 * puerta, y las dos son defendibles por lo mismo: la lista vacia nunca debe ser
 * una palabra sobre las reglas.
 */
function listaTrackeada () {
  try {
    return gitSeguro(['ls-files'], { stdio: ['ignore', 'pipe', 'pipe'] })
      .split('\n').filter((f) => f !== '');
  } catch (e) {
    const stderr = (e.stderr || '').toString().trim();
    const porQue = stderr === '' ? e.message : stderr.split('\n')[0];

    throw new Error('`git ls-files` fallo en ' + repoRoot + ', de modo que este test no puede '
      + 'decir NADA sobre los artefactos, ni a favor ni en contra: ' + porQue
      + '\n\nSi el repositorio pertenece a otro usuario, `git` se niega a leerlo por `dubious '
      + 'ownership`. Se puede dejar pasar solo para esta ejecucion con '
      + 'GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=safe.directory GIT_CONFIG_VALUE_0=<repo>.');
  }
}

function contenidos (ficheros) {
  const salida = [];

  for (const f of ficheros) {
    try {
      if (statSync(resolve(repoRoot, f)).size > 2 * 1024 * 1024)
        continue;

      const texto = readFileSync(resolve(repoRoot, f), 'utf8');

      if (texto.indexOf(NUL) !== -1)
        continue;

      salida.push({ ruta: f, contenido: texto });
    } catch (e) {
      console.warn('[artefactosVigilados] no se pudo leer ' + f + ': ' + e.message);
    }
  }

  return salida;
}

/** Las rutas que declara `OUT`, como claves y como ficheros. */
function leeOut (fuente) {
  const bloque = /const OUT = \{([\s\S]*?)\n\};/.exec(fuente);

  if (!bloque)
    throw new Error('no se encontro `const OUT = { ... };` en registry_generator.js. Si el '
      + 'generador cambio de forma, este test tiene que decirlo en vez de comparar listas vacias.');

  const porClave = new Map();
  const re = /(\w+):\s*path\.join\(ROOT,\s*([^)]*)\)/g;
  let m;

  while ((m = re.exec(bloque[1])) !== null) {
    const trozos = (m[2].match(/'([^']+)'/g) || []).map((t) => t.slice(1, -1));

    if (trozos.length === 0)
      throw new Error('la clave OUT.' + m[1] + ' no se pudo leer como path.join(ROOT, ...)');

    porClave.set(m[1], trozos.join('/'));
  }

  if (porClave.size === 0)
    throw new Error('`OUT` esta vacio o tiene otra forma: el bloque se leyo pero no salio ninguna ruta.');

  return porClave;
}

/** Las claves de `OUT` que aparecen como destino de escritura: `[OUT.x, ...]`. */
function leeEscritos (fuente) {
  const escritos = new Set();
  const re = /\[OUT\.(\w+)\s*,/g;
  let m;

  while ((m = re.exec(fuente)) !== null)
    escritos.add(m[1]);

  return escritos;
}

/**
 * Los ficheros contra los que el CI hace `git diff --exit-code`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE SALTA LAS LINEAS DE COMENTARIO, Y NO ES COSMETICO
 *
 * La primera version de esto buscaba `/artifacts=\(([\s\S]*?)\)/`, que corta en el
 * PRIMER parentesis cerrado que encuentra despues del nombre. El workflow tiene
 * un comentario que explica este mismo array, y al NOMBRARLO —con su parentesis
 * de apertura— la regex se quedaba con el comentario en lugar de con el codigo: el
 * bloque leido era `...` y la lista salia VACIA.
 *
 * Y ahi esta el motivo de que esto no sea un detalle: un `[]` hace que el test
 * «el CI verifica todo lo que el generador escribe» mire cuatro rutas contra
 * ninguna y lo declare BIEN, cuando en realidad el CI no vigila nada. Verde y
 * mentira, que es el unico fallo que este fichero existe para no tener.
 *
 * Un comentario no puede cambiar lo que el CI vigila, asi que la expresion exige
 * que el parentesis este CODIGO —al principio de la linea, sin nada delante— y no
 * un texto. Asi el comentario puede hablar del array con libertad.
 */
function leeArtefactosDelCi (workflow) {
  // `^` con la flag `m`: el array tiene que empezar una linea. Un comentario
  // empieza con `#`, y un `artifacts=` en mitad de un texto no cuenta.
  const bloque = /^[^\S\n\r]*artifacts=\(([^)]*)\)/m.exec(workflow);

  if (!bloque)
    throw new Error('no se encontro el array de artefactos del CI en registry-generation.yml. Si el '
      + 'workflow cambio de forma, este test tiene que decirlo en vez de comparar listas vacias: '
      + 'hoy el CI no vigila ningun artefacto y este test no lo diria.');

  const entradas = (bloque[1].match(/'([^']+)'/g) || []).map((t) => t.slice(1, -1));

  if (entradas.length === 0)
    throw new Error('el array de artefactos del CI esta ahi pero vacio. Un `artifacts=()` sin '
      + 'ficheros hace que este test.compare contra nada y de verde.');

  return entradas;
}

const FUENTE = readFileSync(GENERADOR, 'utf8');
const WORKFLOW_LEIDO = readFileSync(WORKFLOW, 'utf8');
const OUT = leeOut(FUENTE);
const ESCRITOS = leeEscritos(FUENTE);
const DEL_CI = leeArtefactosDelCi(WORKFLOW_LEIDO);
const DESCUBIERTOS = new Set(descubreArtefactos(contenidos(listaTrackeada())).map((a) => a.ruta));

describe('el generador, el CI y el guard dicen lo mismo sobre los .gen', () => {
  it('las tres listas se han leido, y no estan vacias', () => {
    // La costura. Un `lee*` que devuelve [] haria que todas las comparaciones
    // de abajo dieran verde sin comparar nada, que es el fallo mas caro que
    // puede tener un test de cruce: verde y mentira.
    expect(OUT.size, 'no se ha leido ninguna salida de OUT').toBeGreaterThan(3);
    expect(ESCRITOS.size, 'no se ha leido ningun destino de escritura `[OUT.x, ...]`')
      .toBeGreaterThan(3);
    expect(DEL_CI.length, 'la lista de artefactos del CI esta vacia').toBeGreaterThan(3);
    expect(DESCUBIERTOS.size, 'el guard no descubre ningun artefacto generado').toBeGreaterThan(3);
  });

  it('todo lo que OUT declara, el generador lo escribe', () => {
    // Una clave en `OUT` que no aparece como `[OUT.x, ...]` es configuracion
    // muerta: una ruta que el generator no produce y que el CI cree verificar.
    const muertos = [...OUT.entries()]
      .filter(([clave]) => !ESCRITOS.has(clave))
      .map(([clave, ruta]) => clave + ' -> ' + ruta);

    expect(muertos, 'claves de OUT que el generador declara y no escribe').toEqual([]);
  });

  it('el CI verifica todo lo que el generador escribe', () => {
    // LA CONVERSA QUE FALTA. `registry_generator.js` no tiene `--check`: su
    // puerta es que el job lo ejecute y exija que el arbol quede limpio. Esa
    // puerta mira una lista escrita a mano, y si el generador escribe un
    // artefacto que no esta en ella, el CI lo regenera y no mira si ha
    // cambiado. El fichero queda commiteado desfasado y no hay ningun rojo.
    const sinVigilar = [...OUT.values()].filter((ruta) => !DEL_CI.includes(ruta));

    expect(sinVigilar,
      'artefactos que el generador escribe y el CI no compara. Anadelos al array '
      + '`artifacts=(...)` de .github/workflows/registry-generation.yml, o el CI '
      + 'regenerara el fichero sin comprobar si ha cambiado.'
    ).toEqual([]);
  });

  it('y el CI no verifica nada que el generador no escriba', () => {
    // La direccion contraria, que es la que se ensucia sola: una entrada que se
    // queda en el workflow cuando el generador deja de producir ese fichero.
    // `git diff --exit-code` sobre un fichero que no existe no falla, asi que la
    // puerta sigue pareciendo verde mientras ya no vigila nada.
    const sobrantes = DEL_CI.filter((ruta) => ![...OUT.values()].includes(ruta));

    expect(sobrantes,
      'ficheros que el CI compara y el generador no produce. La lista del workflow se ha '
      + 'quedado por detrás: `git diff` sobre un fichero inexistente no falla.'
    ).toEqual([]);
  });

  it('el guard del .gitattributes descubre todo lo que el generador escribe', () => {
    // Si un artefacto generado dejara de llevar la cabecera `AUTO-GENERATED` o
    // de llamarse `.gen`, se sale del descubrimiento y se queda sin la regla que
    // lo fija en LF, y no hay ningun otro sitio que se entere.
    const invisibles = [...OUT.values()]
      .filter((ruta) => !DESCUBIERTOS.has(ruta))
      .map((ruta) => ruta + (existsSync(resolve(repoRoot, ruta))
        ? ' (existe, pero el guard no lo descubre)'
        : ' (no existe en disco: el generador declara una salida que no produce)'));

    expect(invisibles,
      'artefactos que el generador escribe y el guard NO descubre. Sin descubrimiento no hay '
      + 'quien compruebe que estan fijados en LF, y un checkout con CRLF los ensucia al '
      + 'regenerarlos.'
    ).toEqual([]);
  });

  it('la puerta del CI existe de verdad: ejecuta el generador y exige arbol limpio', () => {
    // Las tres comprobaciones anteriores comparan LISTAS. Si el workflow dejara
    // de ejecutar el generador, o de hacer `git diff`, las listas seguirian
    // cuadrando y todos estos tests seguirian en verde con una puerta que no
    // abre. Por eso la puerta se mira a ella misma.
    expect(WORKFLOW_LEIDO, 'el job tiene que ejecutar el generador').toContain('scripts/registry_generator.js');
    expect(WORKFLOW_LEIDO, 'el job tiene que comparar lo regenerado con lo commiteado')
      .toContain('git diff --exit-code');
  });
});