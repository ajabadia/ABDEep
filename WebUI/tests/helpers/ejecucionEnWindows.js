/**
 * Guard de CI para los tests que necesitan `cmd.exe`.
 *
 * POR QUE ESTE FICHERO EXISTE
 *
 * Un test de Windows en este repo se salta solo: `ctx.skip()` cuando no hay
 * cmd.exe, que es el caso de `webui-ci.yml`, el workflow que corre la suite en
 * ubuntu. Eso esta bien para el test, pero es una trampa para el conjunto: la
 * capa de texto se comprueba en todas partes y la de comportamiento no se
 * comprueba en NINGUNA, sin que nada se ponga rojo. El sintoma es que puede
 * faltar media proteccion sin enterarse, y un rojo asi solo aparece por
 * casualidad, en un PR que toque el fichero vigilado por otra razon.
 *
 * La unica forma de cerrarlo es exigir que ALGUN workflow EJECUTE el fichero de
 * test con vitest, en un runner de Windows, y que ese workflow se dispare con
 * cambios en el fichero que el test vigila. Si alguien quita el paso, esto falla:
 * no hace falta acordarse.
 *
 * POR QUE ESTA EN UN HELPER Y NO COPIADO EN CADA TEST
 *
 * Porque la copia es lo que deja de vigilar. Con el guard pegado a un solo
 * fichero, el segundo fichero de tests de Windows nace sin el y parece correcto.
 * Aqui la exigencia es la misma para todos, y anadir un fichero nuevo obliga a
 * cablearlo en el workflow porque el propio test lo dice.
 *
 * "EJECUTAR" Y NO "MENTIONAR"
 *
 * La diferencia es de una linea y es todo el guard. La primera version buscaba
 * el nombre del fichero en cualquier workflow, y daba FALSO POSITIVO: el nombre
 * esta tambien en los filtros `paths`, que existen para disparar el workflow.
 * Quitar el paso de ejecucion no hacia fallar nada.
 *
 * Por eso se exige que el nombre vaya en la MISMA linea que `vitest`: un filtro
 * de `paths` es `- "WebUI/tests/...test.js"` y no lleva `vitest` delante.
 *
 * Se busca en TODOS los workflows, no en uno fijo: no importa donde viva,
 * importa que exista.
 */

import { expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', '..');

/**
 * Escapa una ruta para usarla dentro de un `RegExp`.
 *
 * Se escapan solo los metacaracteres que de verdad pueden aparecer en una ruta:
 * el conjunto canonico, con `]` y barra invertida escapados DENTRO de la clase
 * de caracteres. El `\\$&` devuelve el caracter encontrado con la barra ya
 * antepuesta, que es justo lo que hay que anteponer.
 *
 * (En un intento anterior, este conjunto se escribio con una escapada "de
 * manual" por capas y las barras se perdieron dos veces, dejando un RegExp
 * invalido que hacia que el guard aceptase cualquier cosa. Con `replace` no hay
 * capas: la escapada ocurre exactamente una vez.)
 */
export function escaparParaRegExp(ruta) {
  return ruta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** RegExp que exige linea de comando: `vitest` y el nombre en la MISMA linea. */
export function requiereEjecucion(ficheroTest) {
  return new RegExp('vitest[^\\n]*' + escaparParaRegExp(ficheroTest));
}

/** Workflows del repo, leidos una vez. */
export function workflows() {
  const dir = path.join(ROOT, '.github', 'workflows');
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
    .map((f) => ({nombre: f, texto: fs.readFileSync(path.join(dir, f), 'utf8')}));
}

/**
 * Exige que `ficheroTest` se EJECUTE en Windows y con el disparador correcto.
 *
 * Pensado para usarse como CUERPO de un `it`, porque las aserciones necesitan
 * el contexto de vitest:
 *
 *   it('el CI ejecuta estos tests en Windows', () => {
 *     exigirEjecucionEnWindows(WEBSITE, 'build.bat');
 *   });
 *
 * @param {string} ficheroTest ruta desde la raiz del repo, p. ej. del propio test
 * @param {string} ficheroVigilado lo que el test vigila; tiene que estar en `paths`
 */
export function exigirEjecucionEnWindows(ficheroTest, ficheroVigilado) {
  const EJECUTA = requiereEjecucion(ficheroTest);
  const candidatos = workflows().filter((w) => EJECUTA.test(w.texto));

  expect(
    candidatos.map((w) => w.nombre),
    'ningun workflow EJECUTA ' + ficheroTest + ' con vitest. Los tests de '
    + 'comportamiento se saltan donde no hay cmd.exe, asi que si nadie los corre '
    + 'en Windows no se comprueba nada. Ojo: aparecer en un filtro de paths no '
    + 'es ejecutarlo.',
  ).not.toEqual([]);

  for (const {nombre, texto} of candidatos) {
    expect(
      /runs-on:\s*windows/.test(texto),
      `${nombre} ejecuta ${ficheroTest} en un runner que no es Windows, donde se saltan`,
    ).toBe(true);

    // Los items de `paths` del workflow: seis espacios, guion y comillas.
    const disparadores = [...texto.matchAll(/^ {6}- "(.+)"$/gm)].map((m) => m[1]);
    expect(
      disparadores.some((p) => p.includes(ficheroVigilado)),
      `${nombre} ejecuta ${ficheroTest} pero no se dispara con cambios en `
      + `${ficheroVigilado}: el fichero que se vigila y el test que lo vigila se `
      + 'moverian sin que se ejecuten nunca.',
    ).toBe(true);
  }
}