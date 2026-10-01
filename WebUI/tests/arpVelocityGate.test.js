/**
 * arpVelocityGate.test.js — El selector Vel Gate del arpegiador hace algo
 * ============================================================================
 *
 * `arp_velocity_gate` (enum `Gate` / `Velocity` / `Seq`) estaba declarado en el
 * spec, pintado por el panel y por el modal, y sincronizado por el handler de
 * parámetros… y ningún motor lo miraba. El arpegiador sonaba SIEMPRE con la
 * velocidad de la tecla, que es exactamente lo que dice la opción "Velocity".
 * El selector prometía tres modos y no ejecutaba ninguno.
 *
 * Estos tests fijan la política de los tres modos, que vive en
 * `WebUI/js/bridge-engines-arp-modes.js` como función pura `_arpVelocityFor`
 * (junto a `_arpCalcStep`, con el mismo "sin estado del bridge" por delante).
 *
 * Run: npx vitest run tests/arpVelocityGate.test.js
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const MODES_SRC = path.join(ROOT, 'WebUI', 'js', 'bridge-engines-arp-modes.js');
const ARP_SRC = path.join(ROOT, 'WebUI', 'js', 'bridge-engines-arp.js');

let _arpVelocityFor;

beforeAll(() => {
  globalThis.window = globalThis;
  // Se carga el fichero REAL, no una copia: una copia es lo que dejó este
  // defecto en los fixtures del mapa del puente durante meses.
  new Function(fs.readFileSync(MODES_SRC, 'utf8'))();
  _arpVelocityFor = globalThis._arpVelocityFor;
});

/** El enum son 3 opciones y llega normalizado 0..1 (`value / 2.0` en el panel). */
const idxOf = (normalized) => Math.round(normalized * 2);
const GATE = idxOf(0);
const VELOCITY = idxOf(0.5);
const SEQ = idxOf(1);

describe('arp_velocity_gate — el índice sale bien del valor normalizado', () => {
  it('el mapeo es el mismo que arp_mode y arp_octave (valor * n)', () => {
    expect(GATE).toBe(0);
    expect(VELOCITY).toBe(1);
    expect(SEQ).toBe(2);
  });
});

describe('modo Gate — velocidad constante', () => {
  it('suena igual de fuerte se toque como se toque', () => {
    const velocidades = [1, 20, 64, 100, 127].map((v) => _arpVelocityFor(GATE, v, 0, 4));
    expect(new Set(velocidades).size).toBe(1);
    expect(velocidades[0]).toBe(100);
  });

  it('da el mismo valor en cualquier nota del patrón', () => {
    // Es lo que distingue Gate de Seq: no depende del paso.
    expect([0, 1, 2, 3, 4].map((i) => _arpVelocityFor(GATE, 40, i, 5)))
      .toEqual([100, 100, 100, 100, 100]);
  });

  it('no depende de cuántas notas haya sostenidas', () => {
    expect([1, 2, 3, 8].map((n) => _arpVelocityFor(GATE, 77, 0, n)))
      .toEqual([100, 100, 100, 100]);
  });
});

describe('modo Velocity — la salida sigue a la tecla', () => {
  it('reproduce la velocidad con la que se tocó', () => {
    expect([1, 20, 64, 100, 127].map((v) => _arpVelocityFor(VELOCITY, v, 0, 4)))
      .toEqual([1, 20, 64, 100, 127]);
  });

  it('es lo que hacía el motor antes de existir el selector', () => {
    // Este es el modo que evita la regresión: sin cablear, Gate y Velocity
    // sonaban igual, que es el bug.
    expect(_arpVelocityFor(VELOCITY, 30, 0, 4)).not.toBe(_arpVelocityFor(GATE, 30, 0, 4));
  });
});

describe('modo Seq — rampa por el patrón', () => {
  it('recorre las notas sostenidas de fuerte a suave', () => {
    expect([0, 1, 2, 3].map((i) => _arpVelocityFor(SEQ, 40, i, 4)))
      .toEqual([127, 98, 69, 40]);
  });

  it('sube y baja: la rampa es triangular, no una cuenta atrás', () => {
    // Con 4 notas el periodo es 2n-2 = 6: 127 98 69 40 y vuelve 69 98 127.
    expect([0, 1, 2, 3, 4, 5, 6].map((i) => _arpVelocityFor(SEQ, 40, i, 4)))
      .toEqual([127, 98, 69, 40, 69, 98, 127]);
  });

  it('el periodo de la rampa es 2n-2, igual que el de UP-DOWN', () => {
    // No es casualidad: la rampa recorre el mismo ciclo que el modo UP-DOWN de
    // notas. Con 4 notas, 6 pasos.
    const periodo = 4 * 2 - 2;
    expect(_arpVelocityFor(SEQ, 40, periodo, 4)).toBe(_arpVelocityFor(SEQ, 40, 0, 4));
  });

  it('con dos notas recorre 127 → 40 y vuelve', () => {
    expect([0, 1, 2, 3].map((i) => _arpVelocityFor(SEQ, 40, i, 2)))
      .toEqual([127, 40, 127, 40]);
  });

  it('con una sola nota la rampa es degenerada y copia la tecla', () => {
    // Con una nota no hay hacia dónde ir: devolver un 127 fijo sería un salto
    // del que el usuario no se puede salir, y la velocidad silenciosa.
    expect([1, 40, 127].map((v) => _arpVelocityFor(SEQ, v, 0, 1)))
      .toEqual([1, 40, 127]);
  });

  it('ignora la velocidad con la que se tocó (eso es lo que lo hace "Seq")', () => {
    expect(_arpVelocityFor(SEQ, 10, 0, 4)).toBe(_arpVelocityFor(SEQ, 120, 0, 4));
  });
});

describe('los tres modos hacen cosas distintas', () => {
  it('con 4 notas y la misma tecla, dan tres velocidades distintas', () => {
    const gate = _arpVelocityFor(GATE, 40, 0, 4);
    const vel = _arpVelocityFor(VELOCITY, 40, 0, 4);
    const seq = _arpVelocityFor(SEQ, 40, 0, 4);
    expect([gate, vel, seq]).toEqual([100, 40, 127]);
  });

  it('solo Velocity depende de la velocidad con la que se tocó', () => {
    // Gate es constante por definición, y Seq recorre el patrón en vez de copiar
    // la tecla: los dos son independientes del MIDI. Velocity es el único que lo
    // copia, y es el que evita la regresión.
    const porTecla = (modo) => [_arpVelocityFor(modo, 20, 0, 4), _arpVelocityFor(modo, 110, 0, 4)];

    expect(porTecla(GATE)[0]).toBe(porTecla(GATE)[1]);
    expect(porTecla(SEQ)[0]).toBe(porTecla(SEQ)[1]);
    expect(porTecla(VELOCITY)[0]).not.toBe(porTecla(VELOCITY)[1]);
    expect(porTecla(VELOCITY)).toEqual([20, 110]);
  });

  it('solo Seq depende del paso del patrón', () => {
    // Al revés que el anterior: Seq varía con la nota del patrón, Gate y Velocity
    // no. Es la otra mitad de "son tres modos distintos".
    const porPaso = (modo) => [_arpVelocityFor(modo, 40, 0, 4), _arpVelocityFor(modo, 40, 3, 4)];

    expect(porPaso(GATE)[0]).toBe(porPaso(GATE)[1]);
    expect(porPaso(VELOCITY)[0]).toBe(porPaso(VELOCITY)[1]);
    expect(porPaso(SEQ)[0]).not.toBe(porPaso(SEQ)[1]);
  });
});

describe('la velocidad sale siempre dentro de 1..127', () => {
  it('acota los extremos', () => {
    for (const modo of [GATE, VELOCITY, SEQ]) {
      expect(_arpVelocityFor(modo, 0, 0, 4)).toBeGreaterThanOrEqual(1);
      expect(_arpVelocityFor(modo, 0, 0, 4)).toBeGreaterThan(0); // 0 sería silencio
      expect(_arpVelocityFor(modo, 999, 0, 4)).toBeLessThanOrEqual(127);
      expect(_arpVelocityFor(modo, -50, 0, 4)).toBeGreaterThanOrEqual(1);
    }
  });

  it('devuelve un entero (los drivers redondean distinto si no)', () => {
    for (const modo of [GATE, VELOCITY, SEQ]) {
      for (const v of [0, 1, 33, 64, 100, 126, 127]) {
        expect(Number.isInteger(_arpVelocityFor(modo, v, 1, 4))).toBe(true);
      }
    }
  });

  it('aguanta heldLength = 0 sin devolver NaN', () => {
    // El motor no llama así (filtra `held.length === 0` antes), pero una función
    // que devuelve NaN en un borde se propaga al audio en cuanto alguien la usa
    // desde otro sitio.
    expect(Number.isFinite(_arpVelocityFor(SEQ, 50, 0, 0))).toBe(true);
    expect(Number.isFinite(_arpVelocityFor(GATE, 50, 0, 0))).toBe(true);
  });

  it('aguanta noteIdx fuera de rango', () => {
    expect(Number.isFinite(_arpVelocityFor(SEQ, 50, -1, 4))).toBe(true);
    expect(Number.isFinite(_arpVelocityFor(SEQ, 50, 99, 4))).toBe(true);
  });

  it('un modo desconocido cae en Gate, no en NaN', () => {
    expect(_arpVelocityFor(7, 50, 0, 4)).toBe(100);
    expect(_arpVelocityFor(-1, 50, 0, 4)).toBe(100);
  });
});

describe('el motor usa la política (integración, sobre el fuente real)', () => {
  const src = fs.readFileSync(ARP_SRC, 'utf8');

  it('lee arp_velocity_gate del parameterCache', () => {
    expect(src).toContain("parameterCache['arp_velocity_gate']");
  });

  it('mapea el valor normalizado al índice del enum', () => {
    expect(src).toMatch(/arp_velocity_gate'\]\s*\|\|\s*0\)\s*\*\s*2/);
  });

  it('pasa la velocidad calculada a pianoNoteOn, no la de la tecla', () => {
    expect(src).toContain('_arpVelocityFor');
    expect(src).toMatch(/pianoNoteOn\(\s*outNote\s*,\s*stepVelocity\s*\)/);
    // Y ya no queda el camino viejo que tocaba con la velocidad de la tecla.
    expect(src).not.toMatch(/pianoNoteOn\(\s*outNote\s*,\s*h\.velocity\s*\)/);
  });

  it('la calcula DESPUÉS del clamp de octava, que puede cambiar noteIdx', () => {
    // La rampa de Seq va por noteIdx. Si se calculara antes del clamp, cuando el
    // patrón se reinicia (octava por encima del límite) la velocidad sería la del
    // paso viejo y el primer paso de cada vuelta sonaría con la rampa corrida.
    const calcIdx = src.indexOf('const result = calcFn(');
    const clamp = src.indexOf('octaveOffset > Math.min(arpOctave, 4) * 12');
    const vel = src.indexOf('const stepVelocity = velFn(');
    expect(calcIdx).toBeGreaterThan(-1);
    expect(clamp).toBeGreaterThan(calcIdx);
    expect(vel).toBeGreaterThan(clamp);
  });

  it('tiene un fallback para cuando bridge-engines-arp-modes.js no está cargado', () => {
    expect(src).toContain('_arpVelocityForFallback');
    // El fallback no puede devolver 0 (silencio) ni la velocidad sin acotar.
    expect(src).toMatch(/function _arpVelocityForFallback[\s\S]*?Math\.max\(1,\s*Math\.min\(127/);
  });
});