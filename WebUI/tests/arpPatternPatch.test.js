/**
 * arpPatternPatch.test.js — El patrón del arpegio viaja DENTRO del patch
 * ============================================================================
 *
 * El byte 162 del SysEx dice qué patrón suena, y los 32 pasos de un «User N»
 * vivían en una lista global. Consequences que se prueban aquí:
 *
 *   - muevo tres pasos en la rejilla, guardo el patch, lo cargo: y el arpegiador
 *     suena a otra cosa, o a nada.
 *
 * La pieza que lo arregla guarda los 32 pasos en `patch.meta.arpPattern` como
 * una cadena de 32 caracteres de `0` y `1`. Se prueba el viaje entero: dibujo →
 * guardo en el patch → cargo OTRO patch → el motor recibe los pasos del primero.
 *
 * Y se prueban los tres bordes que hacen que esto no sea un invento: un `meta`
 * escrito a mano, un patrón de otra longitud y un `meta` vacío tienen que hacer
 * lo que ya se hacía (nada), no inventarse una máscara.
 *
 * Run: npx vitest run WebUI/tests/arpPatternPatch.test.js
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const MODULE_SRC = path.join(ROOT, 'WebUI', 'js', 'arp_pattern_patch.js');
const INDEX_HTML = path.join(ROOT, 'WebUI', 'index.html');
const EXPORT_SRC = path.join(ROOT, 'WebUI', 'js', 'browser_io_parse_export.js');

let pasosDeMeta;
let pasosAMeta;
let guardarEnPatch;
let restaurarDelPatch;

beforeAll(() => {
  globalThis.window = globalThis;
  new Function(fs.readFileSync(MODULE_SRC, 'utf8'))();
  pasosDeMeta = globalThis._arpPatternPasosDeMeta;
  pasosAMeta = globalThis._arpPatternPasosAMeta;
  guardarEnPatch = globalThis._arpPatternGuardarEnPatch;
  restaurarDelPatch = globalThis._arpPatternRestaurarDelPatch;
});

/** Un patch de 242 bytes con el arpegiador encendido, como sale de la máquina. */
function patchDePrueba (nombre) {
  const unpackedBytes = new Uint8Array(242);
  unpackedBytes[155] = 255; // arp_enable
  return { index: 0, name: nombre || 'TEST', unpackedBytes, meta: { category: '', tags: '' } };
}

beforeEach(() => {
  globalThis.loadedBanks = { 'Banco A': [patchDePrueba('PATCH UNO')] };
  globalThis.currentActiveBank = 'Banco A';
  globalThis.currentActivePatchIndex = 0;

  const puestos = [];
  globalThis.dualMidiBridge = {
    setArpPattern (pasos) { puestos.push(pasos); },
    _puestos: puestos
  };
  const pintados = [];
  globalThis._arpStepEditor = {
    setSteps (pasos) { pintados.push(pasos); },
    _pintados: pintados
  };
});

describe('_arpPatternPasosAMeta', () => {
  it('convierte 32 booleanos en 32 caracteres de 0 y 1', () => {
    const pasos = new Array(32).fill(false);
    pasos[0] = true;
    pasos[31] = true;
    expect(pasosAMeta(pasos)).toBe('1' + '0'.repeat(30) + '1');
  });

  it('rechaza lo que no son 32 pasos', () => {
    // Aceptar un array corto y rellenarlo con ceros seria inventar una mascara
    // que nadie dibujo: 29 pasos en off donde el usuario quiza no decidio nada.
    expect(pasosAMeta([true, false, true])).toBe(null);
    expect(pasosAMeta(new Array(33).fill(true))).toBe(null);
    expect(pasosAMeta(null)).toBe(null);
    expect(pasosAMeta('1010')).toBe(null);
  });

  it('coacciona a booleano en vez de copiar el valor', () => {
    // `!!` es lo que impide que un 1 de un editor que uso numeros acabe como
    // el caracter "undefined" en la cadena, que al releer daria NaN.
    const pasos = new Array(32).fill(0);
    pasos[3] = 1;
    pasos[4] = 'sí';
    const s = pasosAMeta(pasos);
    expect(s[3]).toBe('1');
    expect(s[4]).toBe('1');
  });
});

describe('_arpPatternPasosDeMeta', () => {
  it('lee los 32 pasos de la cadena', () => {
    const pasos = pasosDeMeta({ arpPattern: '101' + '0'.repeat(29) });
    expect(pasos).toHaveLength(32);
    expect(pasos[0]).toBe(true);
    expect(pasos[1]).toBe(false);
    expect(pasos[2]).toBe(true);
    expect(pasos[31]).toBe(false);
  });

  it('ignora un meta sin patron', () => {
    // Es el caso normal: patches de fabrica, patches viejos y patches en los
    // que nunca se toco la rejilla. None es la respuesta correcta.
    expect(pasosDeMeta(null)).toBe(null);
    expect(pasosDeMeta(undefined)).toBe(null);
    expect(pasosDeMeta({})).toBe(null);
    expect(pasosDeMeta({ category: 'bajos' })).toBe(null);
  });

  it('ignora un patron que no son 32 caracteres de 0 y 1', () => {
    // Un `meta` de otra version, o escrito a mano. Adivinar seria inventarse el
    // patron en vez de leerlo, y un patron inventado suena a algo.
    expect(pasosDeMeta({ arpPattern: '1010' })).toBe(null);
    expect(pasosDeMeta({ arpPattern: '1'.repeat(33) })).toBe(null);
    expect(pasosDeMeta({ arpPattern: '10x1' + '0'.repeat(28) })).toBe(null);
    expect(pasosDeMeta({ arpPattern: 12345 })).toBe(null);
  });

  it('ida y vuelta exacta: 32 patrones distintos y vuelven iguales', () => {
    for (let mascara = 0; mascara < 256; mascara++) {
      const pasos = new Array(32).fill(false);
      for (let b = 0; b < 8; b++) { pasos[b] = !!(mascara & (1 << b)); }
      expect(pasosDeMeta({ arpPattern: pasosAMeta(pasos) })).toEqual(pasos);
    }
  });
});

describe('_arpPatternGuardarEnPatch', () => {
  it('escribe el patron en el meta del patch activo', () => {
    const pasos = new Array(32).fill(false);
    pasos[5] = true;
    expect(guardarEnPatch(pasos)).toBe(pasosAMeta(pasos));
    expect(globalThis.loadedBanks['Banco A'][0].meta.arpPattern).toBe(pasosAMeta(pasos));
  });

  it('crea el meta si el patch no lo tenia', () => {
    // Un patch que venga de un SysEx pegado puede no traer meta. Sin esto, el
    // primer paso dibujado reventaria con «no se puede asignar a undefined».
    globalThis.loadedBanks['Banco A'][0].meta = undefined;
    const pasos = new Array(32).fill(true);
    guardarEnPatch(pasos);
    expect(globalThis.loadedBanks['Banco A'][0].meta.arpPattern).toBe('1'.repeat(32));
  });

  it('no toca los 242 bytes del SysEx', () => {
    // LA RAZON de que esto viva en `meta`. El volcado tiene que seguir siendo
    // identico byte a byte a `createProgramDumpSysex` de C++, y ese codigo esta
    // en ABDSharedCode. Un byte de mas aqui no es un byte de mas: rompe la
    // paridad de todos los dumps de fabrica.
    const antes = Array.from(globalThis.loadedBanks['Banco A'][0].unpackedBytes);
    guardarEnPatch(new Array(32).fill(true));
    expect(Array.from(globalThis.loadedBanks['Banco A'][0].unpackedBytes)).toEqual(antes);
  });

  it('devuelve null, y no revienta, si no hay patch activo', () => {
    globalThis.currentActivePatchIndex = -1;
    expect(guardarEnPatch(new Array(32).fill(true))).toBe(null);
  });
});

describe('_arpPatternRestaurarDelPatch', () => {
  it('pone los pasos del patch en el motor y en la rejilla', () => {
    const pasos = new Array(32).fill(false);
    pasos[7] = true;
    globalThis.loadedBanks['Banco A'][0].meta.arpPattern = pasosAMeta(pasos);

    const leidos = restaurarDelPatch();

    expect(leidos).toEqual(pasos);
    expect(globalThis.dualMidiBridge._puestos.at(-1)).toEqual(pasos);
    // La rejilla tambien. Si solo se pusiera el motor, el usuario veria 32
    // barras que no son las que suenan.
    expect(globalThis._arpStepEditor._pintados.at(-1)).toEqual(pasos);
  });

  it('es el viaje entero: dibujo, cargo OTRO patch, y suena lo que dibujé', () => {
    const dibujado = new Array(32).fill(false);
    dibujado[1] = true;
    dibujado[2] = true;
    dibujado[17] = true;

    // 1. Dibujo en el patch UNO y guardo.
    guardarEnPatch(dibujado);
    expect(globalThis.loadedBanks['Banco A'][0].meta.arpPattern).toBe(pasosAMeta(dibujado));

    // 2. Cambio a otro patch del mismo banco: no tiene patron.
    const patchDos = patchDePrueba('PATCH DOS');
    globalThis.loadedBanks['Banco A'][1] = patchDos;
    globalThis.currentActivePatchIndex = 1;
    expect(restaurarDelPatch()).toBe(null);

    // 3. Vuelvo al UNO. Esto es lo que fallaba: sonaba lo que hubiera en la
    //    lista global, no lo dibujado.
    globalThis.currentActivePatchIndex = 0;
    expect(restaurarDelPatch()).toEqual(dibujado);
    expect(globalThis.dualMidiBridge._puestos.at(-1)).toEqual(dibujado);
  });

  it('no toca el motor cuando el patch no trae patron', () => {
    // El caso que mas tentador es «pillar» de verdad: un patch sin patron no
    // significa «deja el motor sin mascara», sino «este patch no opina». El
    // selector ya ha resuelto lo suyo y pisarlo con null apagaria una mascara
    // que venia sonando.
    const engineCallsAntes = globalThis.dualMidiBridge._puestos.length;
    expect(restaurarDelPatch()).toBe(null);
    expect(globalThis.dualMidiBridge._puestos).toHaveLength(engineCallsAntes);
  });

  it('sobrevive a que no haya patch activo', () => {
    globalThis.currentActivePatchIndex = -1;
    expect(restaurarDelPatch()).toBe(null);
  });
});

describe('el export del banco', () => {
  const html = fs.readFileSync(INDEX_HTML, 'utf8');

  it('index.html carga el modulo del patron', () => {
    // El guard de tags rotos no habria pillado un modulo nuevo que nadie
    // referencia: solo mira que lo referenciado exista, no que lo nuevo se use.
    expect(html).toContain('js/arp_pattern_patch.js');
  });

  it('el export JSON se lleva el meta, donde vive el patron', () => {
    const fuente = fs.readFileSync(EXPORT_SRC, 'utf8');
    expect(fuente, 'el export sigue tirandose el meta, que es donde va el patron')
      .toMatch(/meta:\s*patch\.meta/);
  });
});
