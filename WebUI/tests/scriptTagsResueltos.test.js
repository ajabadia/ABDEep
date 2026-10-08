/**
 * Que cada `<script src>` de index.html apunte a un fichero que existe.
 *
 * EL AGUERO, Y POR QUE NO LO CUBRE NADA MAS
 *
 * Borrar un fichero del WebUI no es borrarlo: es borrar su `<script src>`. Un
 * tag que apunta a un fichero que ya no esta NO da error de sintaxis, NO sale
 * en la consola como exception y NO rompe ningun test: el peticor devuelve 404 y
 * el resto de la pagina sigue funcionando. El sintoma es que una funcion deja de
 * existir en silencio, dias despues, en un commit que no la tocaba.
 *
 * En este repo no era hipotetico: siete tags Apuntaban a ficheros borrados, los
 * siete del keybed y los seis de los renderers de efectos. Nadie los habia
 * notado porque nada los mira. Este test es ese algo.
 *
 * POR QUE UN TEST Y NO UN SCRIPT DE VERIFICACION
 *
 * Porque el fallo tiene que saltar en la suite que se corre constantly, no en
 * un job que se mira cuando falla. Y porque elHTML lo editan personas y
 * generadores a la vez: el fichero no se regenera, asi que no hay ninguna
 * garantia de que nadie vuelva a meter un tag.
 *
 * LO QUE NO MIDE, Y HACE FALTA DECIR
 *
 * No comprueba que el fichero este BIEN, solo que este. No mira el orden de
 * carga (que para scripts clasicos importa y para modulos no), ni que el CSS de
 * un modulo llegue, ni que un `type="module"` sea el correcto para un fichero
 * concreto. Eso lo mide `keyboardSharedMount`, que si conoce el contrato del
 * keybed. Aqui la pregunta es solo mas burda y por eso no se equivoca: ¿existe
 * lo que este HTML dice que existe?
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const webui = resolve(here, '..');
const INDEX = resolve(webui, 'index.html');

const HTML = readFileSync(INDEX, 'utf8');

/** Todos los `src` de los `<script>` de index.html, en orden de documento. */
function srcDeScripts (html) {
    return [...html.matchAll(/<script[^>]*\ssrc=["']([^"']+)["']/g)].map((m) => m[1]);
}

describe('index.html', () => {
    it('el fichero se ha leido y tiene scripts que comprobar', () => {
        // La costura: si el HTML se vacia o cambia de forma, este test tiene que
        // ponerse rojo diciendo que no ha leido nada, no dar verde comparando
        // contra una lista vacia. Verde y mentira es el fallo mas caro.
        expect(srcDeScripts(HTML).length, 'no se ha leido ningun script src de index.html')
            .toBeGreaterThan(50);
    });

    it('ningun script src apunta a un fichero que no existe', () => {
        const rotos = srcDeScripts(HTML)
            .filter((src) => !existsSync(resolve(webui, src)))
            .map((src) => src + '  (404: el tag sigue, el fichero no)');

        expect(rotos,
            'index.html carga scripts que no estan en disco. Un 404 aqui no lanza excepcion ni '
            + 'rompe la pagina: solo deja de existir lo que el fichero hacia. Si acabas de borrar '
            + 'un script del WebUI, su <script src> va con el.'
        ).toEqual([]);
    });

    it('el HTML esta bien cerrado, una sola vez', () => {
        // No lo introdujo el mismo bug que los tags, pero es del mismo tipo:
        // algo se copio y nadie lo nota porque el navegador lo tolera.
        for (const tag of ['body', 'html']) {
            const abiertos = (HTML.match(new RegExp(`<${tag}[^>]*>`, 'g')) || []).length;
            const cerrados = (HTML.match(new RegExp(`</${tag}>`, 'g')) || []).length;

            expect({ [tag]: abiertos }, `faltan <${tag}>`).toEqual({ [tag]: cerrados });
        }
    });
});
