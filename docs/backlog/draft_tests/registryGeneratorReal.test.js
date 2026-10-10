/**
 * registryGeneratorReal.test.js — el generador del registro, EJECUTADO.
 *
 * `scripts/registry_generator.js` tiene dos caminos, y solo uno estaba probado:
 *
 *   node scripts/registry_generator.js --check   compara contra el disco y sale
 *   node scripts/registry_generator.js           emite, y luego REVALIDA lo emitido
 *
 * El segundo es el que llama a `validateEmitted()`, y no lo ejecutaba nadie en
 * ningun sitio: `--check` lo salta a proposito (no hay nada emitido que
 * revalidar) y `scripts/registry_generator.test.js` importa funciones del modulo
 * sin llegar a `main()`. Es un agujero del tamaño de un ReferenceError: la
 * funcion llego a comparar contra `entries` y `specCppIds`, que son locales de
 * `main()`, y eso no reventaba en ningun test — reventaba en cada
 * `cmake --build` de la maquina, y solo si se llegaba a esa linea.
 *
 * Este test ejecuta el camino de verdad. Lo hace sobre una COPIA del arbol en
 * el temporal, nunca sobre el repo: el generador deriva ROOT de su propia
 * ubicacion y no hay forma de redirigir sus salidas, asi que si se ejecutara
 * aqui escribiria los cuatro artefactos versionados. La copia tambien hace que
 * el test sea silencioso por construccion en vez de por disciplina: no puede
 * ensuciar el arbol porque no lo toca.
 *
 * El arbol y la llamada al generador viven en helpers/arbolTemporal.js, que
 * comparte con el caso negativo de registryGen.test.js. La razon esta ahi.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RAIZ,
  ARTEFACTOS,
  GENERADOR,
  nuevoArbol,
  ejecutaGenerador,
  borraArbol,
  digest,
  huellaDeArtefactos,
} from './helpers/arbolTemporal.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Los cuatro artefactos, con `generatedAt` o sin el. */
const SIN_FECHA = ['Source/Core/ParameterRegistry.gen.h', 'Source/Core/ParameterRegistry.gen.cpp'];
const CON_FECHA = ['schemas/parameter-registry.data.json', 'WebUI/js/registry.gen.js'];

/** Lo que hay que ver en la salida para dar el generador por bueno. */
const MARCA_OK = '[registry] OK';

/**
 * La llamada tal cual la escribe el generador hoy. Se usa para romperla a
 * proposito y comprobar que este test tiene dientes.
 */
const LLAMADA_A_VALIDAR = 'validateEmitted(emitted, registry.parameters);';

/**
 * Sin `generatedAt`, que es lo UNICO que el generador deja cambiar entre dos
 * corridas con las mismas fuentes. En el JSON se borra la clave; en el .js, que
 * la lleva embebida como linea, se sustituye la linea entera.
 */
function sinFecha(texto, esJson) {
  if (esJson) {
    const obj = JSON.parse(texto);
    delete obj.generatedAt;
    return JSON.stringify(obj);
  }
  return texto.replace(/^(\s*)generatedAt: .*$/m, '$1generatedAt: <fecha>');
}

describe('el generador del registro, ejecutado de verdad', () => {
  let arbol = null;
  let corrida = null;
  let artefactos = null;
  let huellaDelRepo = null;

  beforeAll(() => {
    // Huella de los cuatro artefactos COMO ESTAN, para poder afirmar al final
    // que la corrida no los toco. Sin esto, un test que escribe en el repo
    // pasaria igual de verde que uno que no.
    huellaDelRepo = huellaDeArtefactos();

    arbol = nuevoArbol();
    corrida = ejecutaGenerador(arbol);
    artefactos = Object.fromEntries(
      ARTEFACTOS.map((rel) => [rel, fs.readFileSync(path.join(arbol, rel), 'utf8')]),
    );
  });

  afterAll(() => {
    borraArbol(arbol);
  });

  it('sale en verde (codigo 0)', () => {
    // El fallo que motiva este test salia aqui: ReferenceError: entries is not
    // defined, y --check no lo veía.
    expect(
      corrida.codigo,
      `el generador salió con código ${corrida.codigo}:\n${corrida.salida}`,
    ).toBe(0);
    expect(corrida.salida).toContain(MARCA_OK);
  });

  it('validateEmitted se ejecuta DE VERDAD, y se nota cuando se rompe', () => {
    // Un test que ejecuta el generador y solo mira el codigo de salida puede
    // estar mirando una funcion que no se llama. Esto lo comprueba de verdad:
    // parte una copia, rompe la llamada a proposito (el recuento que recibe no
    // cuadra con lo emitido) y exige que el generador lo note y salga con 1.
    //
    // Es la misma forma que el fallo que motiva este fichero —un recuento que
    // no corresponde con lo emitido— pero aqui el error cae donde se puede
    // provocar a proposito, para que lo que se vea sea el fallo esperado y no
    // un ReferenceError. Por eso se quita UN elemento del array en vez de
    // pasar un numero: con un numero, validateEmitted revienta en
    // `generated.map` antes de poder reportar nada, y el test veria un
    // TypeError en vez del fallo que quiere comprobar.
    const roto = nuevoArbol();
    try {
      const ruta = path.join(roto, GENERADOR);
      const fuente = fs.readFileSync(ruta, 'utf8');
      expect(
        fuente.includes(LLAMADA_A_VALIDAR),
        'la llamada a validateEmitted ha cambiado de forma. Si es intencionado, '
        + `actualiza LLAMADA_A_VALIDAR en ${__dirname}/registryGeneratorReal.test.js.`,
      ).toBe(true);
      fs.writeFileSync(
        ruta,
        fuente.replace(LLAMADA_A_VALIDAR, 'validateEmitted(emitted, registry.parameters.slice(0, -1));'),
        'utf8',
      );

      const r = ejecutaGenerador(roto);
      expect(r.codigo, `con el recuento roto deberia fallar, y salió ${r.codigo}:\n${r.salida}`).toBe(1);
      expect(r.salida).toContain('EMITTED_PARAMETERS');
    } finally {
      borraArbol(roto);
    }
  });

  it('lo que emite en la copia es lo mismo que hay commiteado en el repo', () => {
    // Si la copia no fuera fiel —si faltara un fichero o el temporal cambiara
    // una ruta— el resto de este test seguiria dando verde sin comprobar nada.
    // Comparar lo emitido contra lo commiteado es lo que ancla la copia a la
    // realidad. Solo se puede permitir una diferencia: `generatedAt`, que el
    // generador avanza solo cuando el contenido cambia, y aqui no cambia.
    for (const rel of SIN_FECHA) {
      expect(
        digest(artefactos[rel]),
        `${rel} emitido en la copia NO es el que hay en el repo`,
      ).toBe(huellaDelRepo.get(rel));
    }
    for (const rel of CON_FECHA) {
      expect(
        digest(sinFecha(artefactos[rel], rel.endsWith('.json'))),
        `${rel} emitido en la copia NO es el que hay en el repo (sin generatedAt)`,
      ).toBe(digest(sinFecha(fs.readFileSync(path.join(RAIZ, rel), 'utf8'), rel.endsWith('.json'))));
    }
  });

  it('los cuatro artefactos del repo no se tocan', () => {
    for (const rel of ARTEFACTOS) {
      expect(
        digest(fs.readFileSync(path.join(RAIZ, rel), 'utf8')),
        `${rel} ha cambiado: el generador no debe escribir en el repo desde un test`,
      ).toBe(huellaDelRepo.get(rel));
    }
  });

  it('el guard de completitud muerde: un id del APVTS sin entrada de conversion es fatal', () => {
    // El guard que el plan de la capa de traduccion pide por su nombre: NINGUN
    // parametro del host puede entrar sin declarar como se traduce. Aqui se
    // prueba quitando una entrada a proposito y exigiendo que el generador lo
    // note. Sin este caso, un `CONVERSION_MISSING` que dejara de disparar
    // seguiria verde y el defecto solo se veria el dia que un mando sonara mal.
    const roto = nuevoArbol();
    try {
      const spec = path.join(roto, 'schemas', 'parameter-conversion.json');
      const doc = JSON.parse(fs.readFileSync(spec, 'utf8'));
      const id = 'vcf_cutoff';
      expect(doc.parameters[id], `el spec deberia declarar "${id}" para poder quitarlo`).toBeTruthy();
      delete doc.parameters[id];
      fs.writeFileSync(spec, JSON.stringify(doc), 'utf8');

      const r = ejecutaGenerador(roto);
      expect(
        r.codigo,
        `con "${id}" fuera del spec el generador deberia salir 1, y salio ${r.codigo}:\n${r.salida}`,
      ).toBe(1);
      expect(r.salida).toContain('CONVERSION_MISSING');
      expect(r.salida).toContain(id);
    } finally {
      borraArbol(roto);
    }
  });

  it('el guard del codec muerde: un bipolar que el registro no tiene es fatal', () => {
    // El otro extremo del mismo invariante: el libro de bytes lo decodifica HOY
    // el registro, y el spec declara la traduccion. Si uno dice bipolar (neutro
    // en el byte 128) y el otro value (neutro en el 0), el mando tiene DOS
    // mediciones y la curva del preset se mueve medio byte. Sin este caso,
    // CONVERSION_CODEC_CONFLICT podria dejar de disparar sin que nadie se
    // entere: justo la clase de fallo silencioso que dejo pasar el defecto 5.
    const roto = nuevoArbol();
    try {
      const spec = path.join(roto, 'schemas', 'parameter-conversion.json');
      const doc = JSON.parse(fs.readFileSync(spec, 'utf8'));
      const id = 'env1_attack_curve';
      expect(doc.parameters[id].wireCodec,
        `el spec deberia declarar "${id}" como value (0=linear…255=exp)`).toBe('value');
      doc.parameters[id].wireCodec = 'bipolar';
      fs.writeFileSync(spec, JSON.stringify(doc), 'utf8');

      const r = ejecutaGenerador(roto);
      expect(
        r.codigo,
        `con "${id}" en bipolar el generador deberia salir 1, y salio ${r.codigo}:\n${r.salida}`,
      ).toBe(1);
      expect(r.salida).toContain('CONVERSION_CODEC_CONFLICT');
      expect(r.salida).toContain(id);
    } finally {
      borraArbol(roto);
    }
  });
});