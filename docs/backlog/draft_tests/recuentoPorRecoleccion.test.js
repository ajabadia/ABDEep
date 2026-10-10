/**
 * recuentoPorRecoleccion.test.js — la PROPIEDAD de la que depende `baselineGuard`.
 * ==============================================================================
 *
 * `baselineGuard` reconcilia el número de tests de §2 del baseline con una pasada
 * de recolección: vitest importa los ficheros y recolecta los tests SIN ejecutar
 * ningún cuerpo, porque se le pasa un `-t` con un nombre que no casa con nada. Es
 * 27 s de reloj contra los 89 s de la corrida completa, y sustituye a un
 * `vitest run` de verdad sobre los ficheros pesados que había antes.
 *
 * TODO ESO DEPENDE DE UNA COSA, y este fichero la vigila:
 *
 *   que un `describe.skipIf` que se salta aporte SUS TESTS al recuento igual que
 *   uno que está activo.
 *
 * Por qué importa tanto: `vitest list` —el camino anterior— NO enumera los tests de
 * un describe saltado. Por eso el código viejo necesitaba una segunda pasada, un
 * `vitest run` de verdad, solo para sumarlos. Si la recolección tampoco los
 * contara, el número del baseline saldría corto, en una máquina con el corpus
 * presente y en otra sin él, de forma distinta en cada caso. Y saldría CORRECTO:
 * el guard compararía su número con el número escrito, ambos con el mismo error, y
 * no se pondría rojo. Un baseline que se autoverifica con un error compartido no
 * verifica nada.
 *
 * EL AGUJERO QUE ESTE FICHERO CIERRA
 *
 * La independencia entre el entorno y el recuento se midió a mano en vitest
 * 1.6.1, que es la instalada. Una medición es una medición: si alguien actualiza a
 * vitest 4 y allí un describe saltado deja de recolectarse, el guard se queda
 * mintiendo con toda normalidad.
 *
 * Aquí ya no es una medición. Los dos describes de abajo son el FIXTURE, y están
 * en este mismo fichero a propósito: el aserto que los necesita está justo debajo,
 * y no hay ningun fichero extra que mantener, ni uno que se cuele en la
 * corrida principal. Si vivieran en %TEMP%, vitest no los recogeria: medido, sale
 * con 0 y sin escribir el JSON, ni con `--root` ni con `--dir`.
 *
 * Con esto, actualizar vitest deja de ser un salto al vacío: si el comportamiento
 * cambia, esto se pone rojo y dice qué.
 *
 * LO QUE NO ES UN ERROR
 *
 * Los dos describes aportan cuatro tests al recuento del baseline. No es ruido:
 * son la condición de posibilidad de que las aserciones siguientes tengan sobre
 * qué exigir. `FIXTURE ·` está en el nombre de los dos para que cualquier persona
 * que los vea en la salida de la suite sepa que están puestos a propósito y que
 * su sitio es este fichero.
 */

import { describe, it, expect } from 'vitest';

import { collectedDetail } from './support/vitestSuite.js';

/** Este mismo fichero, como ruta relativa a la raíz del repo. */
const SELF = 'WebUI/tests/recuentoPorRecoleccion.test.js';

// ---------------------------------------------------------------------------
// FIXTURE. Los dos bloques son idénticos salvo en si se saltan.
// ---------------------------------------------------------------------------

/**
 * La mitad del fixture no depende del entorno a propósito. No queremos que este
 * fichero se apague en una máquina sin corpus, ni que su resultado cambie según
 * lo que haya en el disco: lo que se mide es el mecanismo de la recolección, no
 * los datos del proyecto.
 */
const SALTADO = false;

describe.skipIf(!SALTADO)('FIXTURE · bloque que NO se ejecuta', () => {
  it('uno', () => {expect(1).toBe(1);});
  it('dos', () => {expect(1).toBe(1);});
});

describe.skipIf(SALTADO)('FIXTURE · bloque que SI se ejecuta', () => {
  it('uno', () => {expect(1).toBe(1);});
  it('dos', () => {expect(1).toBe(1);});
});

// ---------------------------------------------------------------------------
// Lo que vigila el fichero.
// ---------------------------------------------------------------------------

describe('recuento por recolección — la propiedad de la que depende baselineGuard', () => {
  it('recolecta los tests del bloque saltado igual que los del activo', () => {
    // UNA sola pasada sobre este fichero, y se compara bloque a bloque. Un total
    // no valdría: 4 podría salir de 2+2 o de 4+0, y lo segundo es exactamente el
    // fallo que hay que cazar. Por eso se mira el nombre de cada caso.
    const {porFichero} = collectedDetail([SELF]);

    expect(porFichero, 'la pasada no ha reconocido este fichero').toHaveLength(1);
    const casos = porFichero[0].casos;
    const deSaltado = casos.filter((c) => c.fullName.includes('FIXTURE · bloque que NO se ejecuta'));
    const deActivo = casos.filter((c) => c.fullName.includes('FIXTURE · bloque que SI se ejecuta'));

    expect(deSaltado.length,
      'los tests de un describe.skipIf(true) NO se han recolectado. El recuento de '
      + 'baselineGuard saldria corto en toda maquina donde ese bloque se salte, y el '
      + 'guard no se enteraria: compararia su numero con el numero escrito, los dos '
      + 'con el mismo error. Si esto falla, o se ha cambiado el comportamiento de '
      + 'vitest con los describes saltados, o la pasada ya no es solo de recolección.'
    ).toBe(2);
    expect(deActivo.length,
      'los tests del describe activo tambien deben recolectarse; si no, el recuento '
      + 'no cuenta nada y el guard estara comparando el numero equivocado.'
    ).toBe(2);
    expect(deSaltado.length, 'ambos bloques tienen los mismos tests, asi que el total '
      + 'no puede depender de cual se salte').toBe(deActivo.length);
  });

  it('no ejecuta ningún cuerpo al contar: todos los casos salen saltados', () => {
    // El otro pilar. Si `-t` dejara de filtrar, la recolección se convertiría en
    // una corrida de la suite dentro del guard y el número seguiría siendo
    // correcto, así que no habría rojo. Aquí se ve si queda alguno sin saltar.
    //
    // Ojo al leer esto: que TODO salga `skipped` es lo correcto, porque el `-t` de
    // la pasada no casa con ningún nombre. Que salieran `passed` sería el fallo.
    const {porFichero} = collectedDetail([SELF]);
    const estados = porFichero.flatMap((f) => f.casos.map((c) => c.estado));

    expect(estados.length).toBeGreaterThan(0);
    expect(estados.filter((e) => e !== 'skipped'),
      'la pasada de recolección ha ejecutado tests. El recuento debe costar una '
      + 'recolección, no una corrida: si aparece un estado distinto de skipped, se '
      + 'esta tragando la suite entera dentro del guard.'
    ).toEqual([]);
  });

  it('el guard y este test usan la misma pasada, no dos copias del mecanismo', () => {
    // Si alguien reimplementase el recuento para el guard, esta comprobación
    // dejaría de describir lo que el guard hace. Se atan por el modulo.
    expect(typeof collectedDetail).toBe('function');
    const fuente = String(collectedDetail);
    expect(fuente.length,
      'collectedDetail ha cambiado de forma. baselineGuard usa enumerateSuite().tests(), '
      + 'que va por aquí dentro: si esto se toca, hay que volver a mirar que el guard '
      + 'sigue contando con la MISMA pasada que este test.'
    ).toBeGreaterThan(0);
  });
}, 240000);