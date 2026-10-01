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
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { descubreArtefactos } from './gitattributesGuard.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const NUL = String.fromCharCode(0);

const GENERADOR = resolve(repoRoot, 'scripts', 'registry_generator.js');
const WORKFLOW = resolve(repoRoot, '.github', 'workflows', 'registry-generation.yml');

function listaTrackeada () {
  try {
    return execFileSync('git', ['ls-files'], {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe']
    }).split('\n').filter((f) => f !== '');
  } catch (e) {
    console.error('[artefactosVigilados] `git ls-files` fallo: ' + e.message);
    return [];
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

/** Los ficheros contra los que el CI hace `git diff --exit-code`. */
function leeArtefactosDelCi (workflow) {
  const bloque = /artifacts=\(([\s\S]*?)\)/.exec(workflow);

  if (!bloque)
    throw new Error('no se encontro el array `artifacts=(...)` en registry-generation.yml. Si el '
      + 'workflow cambio de forma, este test tiene que decirlo en vez de comparar listas vacias.');

  return (bloque[1].match(/'([^']+)'/g) || []).map((t) => t.slice(1, -1));
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