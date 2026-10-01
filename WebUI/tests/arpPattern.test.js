/**
 * arpPattern.test.js — El patrón del arpegiador deja de ser decorativo
 * ============================================================================
 *
 * `arp_pattern` es un enum de 65 opciones (None + 32 Preset + 32 User). El modal
 * pinta las 65, hay un editor que dibuja 32 barras, un botón Save que las guarda en
 * el almacenamiento local y un Load que las recupera… y el motor se recorría
 * `arp_mode` sin mirar ninguna de las tres cosas. El patrón era adorno.
 *
 * Ahora el patrón es una máscara de 32 pasos sobre el ciclo del arpegiador: el paso
 * `stepIndex % 32` suena si su casilla está encendida. Sin patrón suena todo, que es
 * el comportamiento de antes.
 *
 * Run: npx vitest run tests/arpPattern.test.js
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const MODES_SRC = path.join(ROOT, 'WebUI', 'js', 'bridge-engines-arp-modes.js');
const ARP_SRC = path.join(ROOT, 'WebUI', 'js', 'bridge-engines-arp.js');
const CTRL_SRC = path.join(ROOT, 'WebUI', 'js', 'arpeggiator_controls.js');

let _arpNormalizePattern;
let _arpStepEnabled;

beforeAll(() => {
  globalThis.window = globalThis;
  new Function(fs.readFileSync(MODES_SRC, 'utf8'))();
  _arpNormalizePattern = globalThis._arpNormalizePattern;
  _arpStepEnabled = globalThis._arpStepEnabled;
});

/** Solo los pasos 1, 3 y 5 encendidos. */
const IMPAR = [true, false, true, false, true];

describe('_arpNormalizePattern', () => {
  it('rellena a 32 aunque el patrón venga corto', () => {
    // Un preset guardado con otra rejilla viene corto. Indexarlo directo daría
    // `undefined` en los pasos que falten, que es falsy: apagaría notas que el
    // usuario había encendido.
    const p = _arpNormalizePattern([true, true]);
    expect(p).toHaveLength(32);
    expect(p[0]).toBe(true);
    expect(p[1]).toBe(true);
    expect(p[2]).toBe(false);
  });

  it('rellena a 32 aunque el patrón venga largo', () => {
    expect(_arpNormalizePattern(new Array(64).fill(true))).toHaveLength(32);
  });

  it('coacciona a booleano lo que venga (1, "sí", truthy)', () => {
    const p = _arpNormalizePattern([1, 0, 'x', '', null, undefined, 2]);
    expect(p.slice(0, 7)).toEqual([true, false, true, false, false, false, true]);
  });

  it('devuelve null si no hay array (sin patrón)', () => {
    expect(_arpNormalizePattern(null)).toBeNull();
    expect(_arpNormalizePattern(undefined)).toBeNull();
    expect(_arpNormalizePattern('hola')).toBeNull();
    expect(_arpNormalizePattern({})).toBeNull();
    expect(_arpNormalizePattern([])).toHaveLength(32); // array vacío SÍ es patrón
  });

  it('un patrón de 32 ceros no es lo mismo que no tener patrón', () => {
    // La diferencia importa: uno silencia el arpegiador entero, el otro lo deja sonar.
    expect(_arpNormalizePattern(new Array(32).fill(false))).not.toBeNull();
    expect(_arpStepEnabled(_arpNormalizePattern(new Array(32).fill(false)), 0)).toBe(false);
    expect(_arpStepEnabled(null, 0)).toBe(true);
  });
});

describe('_arpStepEnabled — la máscara de 32 pasos', () => {
  it('sigue al patrón en vez de al modo de arpegio', () => {
    const p = _arpNormalizePattern(IMPAR);
    expect([0, 1, 2, 3, 4].map((s) => _arpStepEnabled(p, s)))
      .toEqual([true, false, true, false, true]);
  });

  it('sin patrón suena todo (comportamiento previo, intacto)', () => {
    for (const s of [0, 1, 7, 15, 31, 99]) expect(_arpStepEnabled(null, s)).toBe(true);
  });

  it('el ciclo es de 32: el paso 32 es el 0', () => {
    const p = _arpNormalizePattern(IMPAR);
    expect(_arpStepEnabled(p, 32)).toBe(_arpStepEnabled(p, 0));
    expect(_arpStepEnabled(p, 33)).toBe(_arpStepEnabled(p, 1));
    expect(_arpStepEnabled(p, 64)).toBe(_arpStepEnabled(p, 0));
  });

  it('aguanta un stepIndex negativo (reinicio del patrón a 0 y overshoot)', () => {
    // El módulo hace el resto en la división de JS, así que -1 % 32 es -1. Lo que
    // importa es que devuelva un booleano y no NaN ni undefined: con NaN, el
    // `if (!enabled)` del motor saltaría el paso para siempre y el arpegiador se
    // quedaría mudo.
    const p = _arpNormalizePattern(IMPAR);
    for (const s of [-1, -2, -32, -33, -99]) {
      expect(typeof _arpStepEnabled(p, s), `paso ${s}`).toBe('boolean');
    }
  });
});

describe('el motor usa la máscara (integración, sobre el fuente real)', () => {
  const src = fs.readFileSync(ARP_SRC, 'utf8');
  const ctrl = fs.readFileSync(CTRL_SRC, 'utf8');

  it('lee arp_pattern del parameterCache y mapea por 64', () => {
    // 65 opciones → el divisor es 64, el mismo mapeo que clock→12 y mode→10.
    expect(src).toMatch(/arp_pattern'\]\s*\|\|\s*0\)\s*\*\s*64/);
  });

  it('salta el paso cuando la casilla está apagada, pero AVANZA el índice', () => {
    // Si no avanzara, el arpegiador se quedaría atascado en el paso apagado: el
    // `stepIndex` no se movería, la casilla seguiría apagada y no sonaría nunca.
    // El motor llama a `enabledFn`, que es la variable local que elige entre la
    // función real y el fallback.
    expect(src).toMatch(/if \(!enabledFn\(engine\.pattern, engine\.stepIndex\)\) \{[\s\S]*?engine\.stepIndex\+\+;[\s\S]*?return;/);
  });

  it('la comprobación va ANTES de calcular la nota (no toca, no gasta nota)', () => {
    const enabled = src.indexOf('enabledFn(');
    const calc = src.indexOf('calcFn(');
    expect(enabled).toBeGreaterThan(-1);
    expect(calc).toBeGreaterThan(enabled);
  });

  it('tiene un fallback que deja sonar todo si no está el fichero de modos', () => {
    expect(src).toContain('_arpStepEnabledFallback');
    expect(src).toMatch(/function _arpStepEnabledFallback[\s\S]*?return true;/);
  });

  it('expone setArpPattern y resolveArpPattern en el bridge', () => {
    expect(src).toContain('DualMidiBridge.prototype.setArpPattern');
    expect(src).toContain('DualMidiBridge.prototype.resolveArpPattern');
  });

  it('un patrón nuevo pone el índice a 0', () => {
    // Si no, al cambiar de patrón el arpegiador sigue en medio del anterior y el
    // primer paso que «salte» es el que le toque por azar, no el primero.
    expect(src).toMatch(/setArpPattern[\s\S]*?this\._arpEngine\.stepIndex = 0;/);
  });

  it('el índice 0 (None) deja el motor sin patrón', () => {
    expect(src).toMatch(/if \(index === 0\) \{\s*this\.setArpPattern\(null\);\s*return null;/);
  });

  it('el selector de patrón resuelve el patrón, no solo el número', () => {
    // Antes solo llamaba a setParameter: el número llegaba al bridge y se quedaba ahí.
    expect(ctrl).toMatch(/resolveArpPattern/);
    expect(ctrl).toMatch(/setParameter\('arp_pattern', patVal \/ 64\.0\)/);
  });

  it('el botón Load pone a sonar el patrón que carga', () => {
    expect(ctrl).toMatch(/setArpPattern\(selected\.steps\)/);
  });
});

describe('el editor de 32 pasos alimenta al motor', () => {
  const arp = fs.readFileSync(path.join(ROOT, 'WebUI', 'js', 'arpeggiator.js'), 'utf8');

  it('cada paso que el usuario dibuja se pasa al motor', () => {
    // La rejilla era decorativa: 32 barras que se podían tocar sin que cambiara nada.
    expect(arp).toContain('setArpPattern(stepEditor.getSteps())');
    expect(arp).toMatch(/createArpStepGrid[\s\S]*?setArpPattern\(stepEditor\.getSteps\(\)\)/);
  });

  it('y se pasa el array entero, no el booleano del paso', () => {
    expect(arp).toContain('setArpPattern(stepEditor.getSteps())');
  });
});