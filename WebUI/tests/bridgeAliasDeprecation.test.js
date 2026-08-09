/**
 * bridgeAliasDeprecation.test.js — Fase 6 (plan v3.2 §6).
 *
 * Verifica la retirada progresiva del alias `window.dualMidiBridge`:
 *   1. `getBridge()` es el acceso canónico y devuelve la instancia.
 *   2. `window.dualMidiBridge` sigue siendo accesible como alias deprecado
 *      (getter que reporta el desuso UNA vez vía Logger.deprecation).
 *   3. Escribir sobre el alias no rompe la instancia canónica.
 *
 * Carga bridge-dual.js real con eval (patrón de bridgeDual.test.js). La asignación
 * de `globalThis.window` se hace ANTES de evaluar logger.js para que `_enabled()`
 * vea `window._ABD_DEBUG=true` y `Logger.deprecation` sea funcional.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function _evalSource(relativePath) {
  const cleanPath = relativePath.replace(/^WebUI\//, '');
  const fullPath = path.resolve(__dirname, '..', cleanPath);
  const code = fs.readFileSync(fullPath, 'utf-8');
  const globalEval = eval;
  return globalEval(code);
}

let win;
let deprecationSpy;
let _currentBridge;

beforeEach(async () => {
  delete global.window;
  delete globalThis.window;

  win = {
    console: global.console,
    setTimeout: global.setTimeout,
    clearTimeout: global.clearTimeout,
    setInterval: global.setInterval,
    clearInterval: global.clearInterval,
    Date: global.Date,
    Promise: global.Promise,
    Array: global.Array,
    Object: global.Object,
    Math: global.Math,
    String: global.String,
    Number: global.Number,
    JSON: global.JSON,
    Error: global.Error,
    parseInt: global.parseInt,
    parseFloat: global.parseFloat,
    isNaN: global.isNaN,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    location: { protocol: 'http:', hostname: 'localhost', port: '8080' },
    navigator: { userAgent: 'test-agent' },
    _ABD_DEBUG: true, // Logger: deprecation funcional
  };
  win.unpack7to8 = vi.fn(() => new Uint8Array(0));
  win.pack8to7 = vi.fn(() => new Uint8Array(0));
  win.extractNameFromRawSysex = vi.fn(() => 'Hw Patch');
  win.hardwareBanks = {};

  // Binding global REAL de window ANTES de evaluar logger.js / bridge-dual.js.
  globalThis.window = win;

  vi.stubGlobal('document', {
    getElementById: vi.fn(() => null),
    querySelector: vi.fn(() => null),
    querySelectorAll: vi.fn(() => []),
  });

  const storage = {};
  vi.stubGlobal('localStorage', {
    getItem: (k) => (storage[k] !== undefined ? storage[k] : null),
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: (k) => { delete storage[k]; },
    clear: () => { Object.keys(storage).forEach((k) => delete storage[k]); },
  });

  // Logger real (debug activo) → deprecation funcional. El eval de logger.js corre
  // en un scope propio (no comparte el `window` del test), así que exponemos la
  // instancia en globalThis.Logger — es la referencia que lee el getter del alias.
  _evalSource('WebUI/js/logger.js');
  const loggerRef = (typeof globalThis.Logger !== 'undefined' && globalThis.Logger) || win.Logger;
  globalThis.Logger = loggerRef;
  win.Logger = loggerRef;
  // Spy SIN mock: la lógica de dedup vive dentro de deprecation() (Set de sesión).
  // Cada beforeEach recrea el logger → Set fresco por test. El warn real puede
  // sonar (debug activo) — es ruido de test, no fallo.
  deprecationSpy = vi.spyOn(loggerRef, 'deprecation');

  // Bridge real
  _evalSource('WebUI/js/bridge-param-maps.js');
  _evalSource('WebUI/js/bridge-dual.js');
  _evalSource('WebUI/js/bridge-dual_init.js');
  _evalSource('WebUI/js/bridge-dual_params.js');

  _currentBridge = win.dualMidiBridge;
  expect(_currentBridge).toBeDefined();

  // Esperar a que el init async del constructor se asiente ANTES de que afterEach
  // borre window (evita unhandled rejections).
  if (typeof _currentBridge.waitForReady === 'function') {
    await _currentBridge.waitForReady(2000);
  }
});

afterEach(() => {
  _currentBridge = null;
  vi.restoreAllMocks();
  delete global.window;
  delete globalThis.window;
  delete globalThis.Logger;
  delete globalThis.DualMidiBridge;
  delete globalThis.getBridge;
});

describe('Fase 6 — acceso canónico getBridge() vs alias deprecado window.dualMidiBridge', () => {
  it('getBridge() devuelve la instancia canónica', () => {
    expect(typeof win.getBridge).toBe('function');
    expect(win.getBridge()).toBeDefined();
    expect(win.getBridge()).toBe(_currentBridge);
  });

  it('window.dualMidiBridge es un alias del mismo objeto que getBridge()', () => {
    expect(win.dualMidiBridge).toBe(win.getBridge());
  });

  it('acceder al alias dispara Logger.deprecation con replacementId getBridge()', () => {
    const alias = win.dualMidiBridge; // eslint-disable-line no-unused-vars
    expect(alias).toBeDefined();
    expect(deprecationSpy).toHaveBeenCalledWith('window.dualMidiBridge', expect.objectContaining({ replacementId: 'getBridge()' }));
  });

  it('acceder al alias múltiples veces no lanza y reporta el desuso en cada acceso', () => {
    // NOTA: la dedup del warn (1 solo aviso por sesión) NO se verifica aquí — ese
    // es el contrato de Logger.deprecation y lo cubre logger.test.js (spy de
    // console.warn). Este test solo garantiza que el getter no lanza en accesos
    // repetidos y que la invocación llega al Logger.
    deprecationSpy.mockClear();
    void win.dualMidiBridge;
    void win.dualMidiBridge;
    void win.dualMidiBridge;
    expect(deprecationSpy).toHaveBeenCalledTimes(3);
    expect(win.dualMidiBridge).toBe(win.getBridge());
  });

  it('escribir sobre el alias no rompe la instancia canónica', () => {
    win.dualMidiBridge = { fake: true };
    expect(win.getBridge()).toBe(_currentBridge);
    expect(win.dualMidiBridge).toBe(win.getBridge());
  });
});
