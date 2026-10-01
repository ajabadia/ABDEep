/**
 * Un guard GENERICO sobre `.gitattributes`, para toda la suite y no solo para
 * el contrato de efectos.
 *
 * EL AGUJERO QUE CIERRA. Los `.gen` del registro (`registry.gen.js`,
 * `ParameterRegistry.gen.h/.cpp`, `parameter-registry.data.json`) SI estaban
 * fijados a `eol=lf`, y no hacia falta arreglar nada: el problema era que nadie
 * lo COMPROBABA. "Esta en la lista" y "esta protegido" son dos afirmaciones
 * distintas, y solo la segunda importa. Este guard es el que las iguala.
 *
 * Y de paso caza el caso inverso, que es el que mas caro sale: una regla que
 * no cubre NINGUN fichero. En este repo habia una, `resources/banks/*.syx
 * binary`, que no cubria ni uno de los ocho bancos porque estan en un
 * subdirectorio y `*` no cruza `/`. Los bancos no se rompian porque tienen un
 * 47% de bytes NUL y git los detecta como binarios por contenido: la proteccion
 * era de Reposo, no de la regla. El dia que un banco venga sin NUL, o que
 * alguien mueva los ficheros, esa regla no protege nada.
 *
 * QUE NO HACE, Y POR QUE. No comprueba que las reglas esten BIEN elegidas: que
 * un `.h` vaya con `eol=lf` o con `text=auto` es decision de cada repo. Comprueba
 * que no sean INERTES, que es el fallo que no se ve.
 *
 * POR QUE NO SE USA `git check-attr` COMO UNICA FUENTE. Es la autoridad y se usa
 * como contrapeso, pero no sabe responder "que ficheros cubre esta regla", que
 * es justo la pregunta de una regla huerfana. Se necesitan las dos.
 */

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  reglasDe, cubreLa, obligaLf, reglasQueFijan, patronARegex,
  cuentaCrlf, pareceComparadoComoDato, esPreventiva, reglasInertes
} from './gitattributesGuard.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const GITATTRIBUTES = resolve(repoRoot, '.gitattributes');

/**
 * Los ficheros que git lleva, que es lo unico que las reglas pueden cubrir.
 *
 * Si `git ls-files` falla, se avisa con un mensaje util y la lista queda VACIA a
 * proposito, no se lanza. Con la lista vacia el primer test de este fichero
 * (`el guard tiene ficheros con los que trabajar`) se pone rojo diciendo
 * exactamente que pasa. Lanzar el error de git seria peor: el stack apuntaria a
 * `execFileSync` y no a que el problema es que no hay checkout.
 */
function listaTrackeada () {
  try {
    return execFileSync('git', ['ls-files'], {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe']
    }).split('\n').filter((f) => f !== '');
  } catch (e) {
    console.error(
      '[gitattributesGuard] no se pudo ejecutar `git ls-files` en ' + repoRoot + ': ' + e.message
    );
    return [];
  }
}

const TRACKEADOS = listaTrackeada();

const ga = readFileSync(GITATTRIBUTES, 'utf8');
const REGLAS = reglasDe(ga);

describe('el .gitattributes protege de verdad, y se ve', () => {
  it('el guard tiene ficheros con los que trabajar', () => {
    // La costura de todo lo de abajo. Si `git ls-files` devolviera una lista
    // vacia, "ninguna regla cubre nada" seria cierto y el guard pasaria sin
    // haber mirado un solo fichero.
    expect(TRACKEADOS.length,
      'la lista de ficheros trackeados esta vacia: `git ls-files` no ha funcionado. '
      + 'Sin ella, NINGUNA REGLA CUBRE NADA seria cierto y este guard pasaria sin haber '
      + 'mirado un solo fichero').toBeGreaterThan(100);
    expect(REGLAS.length).toBeGreaterThan(5);
  });

  it('ninguna regla sobre un fichero CONCRETO queda huerfana', () => {
    // EL CASO QUE ESTA GUARD EXISTE PARA ATRAPAR. Una regla que nombra un
    // fichero que no esta, o una ruta mal escrita, se lee como una proteccion y
    // no protege nada. `resources/banks/*.syx` estuvo años así: cubría cero
    // bancos porque están en un subdirectorio y `*` no cruza `/`.
    //
    // Y aquí NO se mira las reglas por extension, que pueden no tener ficheros
    // hoy y ser la intencion de mañana. Ver el test de esPreventiva.
    const { errores } = reglasInertes(REGLAS, TRACKEADOS);

    expect(
      errores.map((r) => r.cruda),
      'reglas de .gitattributes sobre un fichero o ruta CONCRETOS que no cubren '
      + 'NINGUN fichero trackeado. O la ruta esta mal (recuerda: `*` NO cruza `/`, '
      + 'asi que hace falta `**`), o el fichero se ha movido, o la regla se ha '
      + 'quedado sin nada que proteger. Mismo caso: una proteccion que solo existe '
      + 'en el texto.'
    ).toEqual([]);
  });

  it('este repo no acumula reglas preventivas sin cubrir', () => {
    // El contrapeso del de arriba, y es lo que hace que el guard se pueda
    // llevar a otro repo. Un repo que declara su futuro con veinte reglas por
    // extension es normal; uno que acumula quince rutas concretas que no cubren
    // nada esta lleno de reglas muertas, y este test lo dice.
    //
    // En ABDEep el limite es 0 a proposito: aqui las reglas son todas
    // concretas y todas cubren algo. En ABDSharedAssets, donde si hay
    // declarativas, el limite es mas alto. Lo que no cambia es que el numero
    // este ESCRITO y no "cero", porque si fuera cero este test no miraria nada.
    const { preventivas } = reglasInertes(REGLAS, TRACKEADOS);

    expect(preventivas.length, 'reglas por extension que hoy no cubren nada:\n  ' +
      preventivas.map((r) => r.cruda).join('\n  ')).toBeLessThanOrEqual(0);
  });

  it('todo artefacto generado esta fijado a LF en checkout', () => {
    // Aqui esta el encargo original, extendido al resto de `.gen`. No basta con
    // que esten en la lista: tiene que haber una regla que los cubra de verdad.
    const generados = TRACKEADOS.filter(pareceComparadoComoDato);

    expect(generados.length, 'no hay artefactos .gen trackeados: el filtro esta mal')
      .toBeGreaterThan(0);

    const sinFijar = generados
      .filter((f) => reglasQueFijan(f, ga).length === 0)
      .map((f) => f + '  (reglas que lo cubren: ' +
        JSON.stringify(reglasDe(ga).filter((r) => patronARegex(r.patron).test(f)).map((r) => r.cruda)) + ')');

    expect(
      sinFijar,
      'artefactos .gen que se COMPARAN como datos y no estan fijados a eol=lf. Un '
      + 'checkout en Windows los trae con CRLF y la comparacion falla solo ahi.\n  ' +
      sinFijar.join('\n  ')
    ).toEqual([]);
  });

  it('y ninguno tiene CRLF en este checkout', () => {
    // La regla es una intencion; esto es el estado. Si alguien regenera un .gen
    // desde un editor de Windows, la regla sigue ahi y esto se pone rojo, que es
    // justo cuando hace falta.
    const conCrlf = generados()
      .filter((f) => {
        try {
          return cuentaCrlf(readFileSync(resolve(repoRoot, f), 'utf8')) > 0;
        } catch (e) {
          return false;
        }
      })
      .map((f) => f + ' -> ' + cuentaCrlf(readFileSync(resolve(repoRoot, f), 'utf8')) + ' CRLF');

    expect(conCrlf, 'artefactos .gen con CRLF en el arbol de trabajo:\n  ' + conCrlf.join('\n  '))
      .toEqual([]);
  });

  it('el contrato de efectos sigue fijado, aunque este guard no depende de el', () => {
    // La regresion directa del arreglo anterior. Este guard es generico, asi que
    // nada garantiza que siga mirando el `.gen` del contrato: lo dice aqui.
    expect(reglasQueFijan('WebUI/js/fx_contract.gen.js', ga).length).toBeGreaterThan(0);
  });

  describe('y el parser de patrones hace lo que dice, en los dos sentidos', () => {
    it('`*` NO cruza el `/`, que es el fallo que hizo huerfana la regla de los bancos', () => {
      // Este es el caso REAL de este repo, no un caso inventado.
      const bancos = TRACKEADOS.filter((f) => f.endsWith('.syx'));

      expect(bancos.length, 'no hay bancos .syx trackeados: el caso ya no aplica')
        .toBeGreaterThan(0);
      // Todos estan en un subdirectorio.
      expect(bancos.every((f) => f.slice('resources/banks/'.length).includes('/'))).toBe(true);
      // Y ninguna regla de un solo nivel los cubre.
      expect(reglasQueFijan(bancos[0], 'resources/banks/*.syx binary').length).toBe(0);
      // Con `**` si. Solo se comparan los de `resources/banks/`: hay mas `.syx`
      // en otros arboles del repo, y una regla con ruta no pretende cubrirlos.
      const enBancos = bancos.filter((f) => f.startsWith('resources/banks/'));

      expect(enBancos.length).toBeGreaterThan(0);
      expect(cubreLa(reglasDe('resources/banks/**/*.syx binary')[0], enBancos).length)
        .toBe(enBancos.length);
    });

    it('un patron SIN barra matchea en cualquier directorio', () => {
      // El caso contrario al de los bancos, y el que se pasa por alto en la
      // direccion contraria: `*.gen.js` no es solo para la raiz. Aqui se
      // ancla a la raiz y ese patron no encuentra NADA, que es un `.gen` real
      //perdido de vista.
      expect(cubreLa(reglasDe('*.gen.js text eol=lf')[0], ['WebUI/js/fx_contract.gen.js']).length)
        .toBe(1);
      expect(cubreLa(reglasDe('*.gen.js text eol=lf')[0], ['Source/Core/ParameterRegistry.gen.h'])).toEqual([]);
      // Con barra si va anclado, y entonces no cruza.
      expect(cubreLa(reglasDe('WebUI/js/*.gen.js text eol=lf')[0], ['WebUI/js/otro/x.gen.js'])).toEqual([]);
      expect(cubreLa(reglasDe('WebUI/js/*.gen.js text eol=lf')[0], ['WebUI/js/x.gen.js']).length).toBe(1);
    });

    it('el punto se escapa, para que un nombre con punto no case con cualquier cosa', () => {
      expect(cubreLa(reglasDe('a.js text eol=lf')[0], ['aXjs'])).toEqual([]);
      expect(cubreLa(reglasDe('a.js text eol=lf')[0], ['a.js'])).toEqual(['a.js']);
    });

    it('un patron entre corchetes es una macro, no una regla de ficheros', () => {
      expect(reglasDe('*.txt text eol=lf').length).toBe(1);
      expect(reglasDe('[attr]miAttr text eol=lf')).toEqual([]);
    });

    it('la forma con comillas se lee bien', () => {
      const r = reglasDe('"*.txt" text eol=lf')[0];

      expect(r.patron).toBe('*.txt');
      expect(obligaLf(r)).toBe(true);
    });

    it('obligaLf distingue las tres cosas que un toContain no distingue', () => {
      // No hay ninguna regla.
      expect(reglasQueFijan('x.js', '')).toEqual([]);
      // Hay una que dice otra cosa.
      expect(reglasQueFijan('x.js', 'x.js text eol=crlf')).toEqual([]);
      expect(reglasQueFijan('x.js', 'x.js -text eol=lf')).toEqual([]);
      // Hay una que no cubre el fichero.
      expect(reglasQueFijan('x.js', 'y.js text eol=lf')).toEqual([]);
      // Y la que si.
      expect(reglasQueFijan('x.js', 'x.js text eol=lf').length).toBe(1);
      // Un glob que cubre tambien cuenta.
      expect(reglasQueFijan('WebUI/js/fx_contract.gen.js', '*.gen.js text eol=lf').length).toBe(1);
    });

    it('esPreventiva separa "declaro una extension" de "nombro este fichero"', () => {
      // La distincion que hace que este guard se pueda llevar a un repo donde
      // las reglas por extension son la norma. Sin ella, un repo con 18 reglas
      // de futuro tiene un guard que solo se puede apagar.
      const preventivas = ['*.cpp', '*.h', '*.txt', '**/*.tmp', 'a/**/b.js'];
      const concretas = ['CMakeLists.txt', '.gitignore', '.gitattributes',
        'WebUI/js/fx_contract.gen.js', 'resources/banks/*.syx'];

      for (const p of preventivas) {
        expect(esPreventiva({ patron: p }), p + ' deberia ser preventiva').toBe(true);
      }
      for (const p of concretas) {
        expect(esPreventiva({ patron: p }), p + ' deberia ser concreta').toBe(false);
      }
    });

    it('y reglasInertes separa las dos clases sin perder ninguna', () => {
      const reglas = reglasDe([
        '*.cpp text eol=lf',                    // preventiva, no cubre
        '*.js text eol=lf',                     // preventiva, SI cubre
        'WebUI/js/fx_contract.gen.js text eol=lf', // concreta, SI cubre
        'WebUI/js/inexistente.js text eol=lf'    // concreta, NO cubre
      ].join('\n'));
      const { errores, preventivas } = reglasInertes(reglas, ['WebUI/js/fx_contract.gen.js']);

      expect(errores.map((r) => r.cruda)).toEqual(['WebUI/js/inexistente.js text eol=lf']);
      expect(preventivas.map((r) => r.cruda)).toEqual(['*.cpp text eol=lf']);
      // Y ninguna se pierde por el camino, que seria el fallo de una separacion
      // hecha con dos filtros seguidos en vez de con una particion.
      expect(errores.length + preventivas.length).toBe(2);
    });

    it('cuentaCrlf ve los CRLF y no ve los LF', () => {
      expect(cuentaCrlf('a\nb\nc')).toBe(0);
      expect(cuentaCrlf('a\r\nb\r\nc')).toBe(2);
      // Un CR suelto no es un CRLF, que son cosas distintas.
      expect(cuentaCrlf('a\rb')).toBe(0);
    });

    it('el filtro de artefactos generados no se come ficheros que no son', () => {
      expect(pareceComparadoComoDato('WebUI/js/registry.gen.js')).toBe(true);
      expect(pareceComparadoComoDato('Source/Core/ParameterRegistry.gen.h')).toBe(true);
      expect(pareceComparadoComoDato('Source/Core/ParameterRegistry.gen.cpp')).toBe(true);
      expect(pareceComparadoComoDato('schemas/parameter-registry.data.json')).toBe(true);
      // Un `.gen` bajo dist/ es salida de build, no un artefacto commiteado.
      expect(pareceComparadoComoDato('WebUI/js/effects_data.js')).toBe(false);
      expect(pareceComparadoComoDato('WebUI/js/keyboard.js')).toBe(false);
      expect(pareceComparadoComoDato('Source/DSP/FX/FXSlot_Factory.cpp')).toBe(false);
    });
  });
});

/** Los .gen trackeados, para los dos tests de estado. */
function generados () {
  return TRACKEADOS.filter(pareceComparadoComoDato);
}
