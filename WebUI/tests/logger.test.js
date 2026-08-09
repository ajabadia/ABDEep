/**
 * logger.test.js — unit tests para `Logger.deprecation()` (plan v3.2 §6).
 *
 * Estrategia: cargar logger.js en un contexto limpio con `window` controlado para
 * forzar `enabled=true` (window._ABD_DEBUG) y espiar console.warn.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function loadLoggerFresh({ debug = true } = {}) {
  const win = {
    _ABD_DEBUG: debug,
    localStorage: {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    },
  };
  const globalEval = eval;
  globalEval('var savedWindow = typeof window !== "undefined" ? window : undefined;');
  // (re)definir window temporal para que logger.js lo vea al cargar
  const prevWindow = globalThis.window;
  globalThis.window = win;
  try {
    const code = fs.readFileSync(path.resolve('WebUI/js/logger.js'), 'utf8');
    globalEval(code);
  } finally {
    globalThis.window = prevWindow;
  }
  return win.Logger || (globalThis.window && globalThis.window.Logger);
}

describe('Logger.deprecation (plan v3.2 §6)', () => {
  let warnSpy;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    delete globalThis.Logger;
  });

  it('no emite nada cuando el debug está desactivado', () => {
    const Logger = loadLoggerFresh({ debug: false });
    Logger.deprecation('window.dualMidiBridge', { replacementId: 'getBridge()' });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('emite un warning estructurado cuando el debug está activo', () => {
    const Logger = loadLoggerFresh({ debug: true });
    Logger.deprecation('window.dualMidiBridge', { replacementId: 'getBridge()', since: '0.2.35' });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const msg = warnSpy.mock.calls[0][0];
    expect(msg).toContain('[Deprecation]');
    expect(msg).toContain('window.dualMidiBridge');
    expect(msg).toContain('getBridge()');
  });

  it('deduplica: la misma clave solo emite UN warn por sesión', () => {
    // Logger se carga CON el spy de console.warn activo: _warn queda ligado al spy
    // y cuenta los warns reales emitidos (no las invocaciones de deprecation).
    const Logger = loadLoggerFresh({ debug: true });
    warnSpy.mockClear();
    Logger.deprecation('window.dualMidiBridge');
    Logger.deprecation('window.dualMidiBridge');
    Logger.deprecation('window.dualMidiBridge');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('[Deprecation] window.dualMidiBridge');
  });

  it('claves distintas se reportan por separado', () => {
    const Logger = loadLoggerFresh({ debug: true });
    Logger.deprecation('legacy.param.vcf_cutoff');
    Logger.deprecation('window.dualMidiBridge');
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });

  it('ignora llamadas sin feature', () => {
    const Logger = loadLoggerFresh({ debug: true });
    Logger.deprecation();
    Logger.deprecation(null);
    Logger.deprecation('');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('no rompe si console.warn no existe', () => {
    const prevWarn = console.warn;
    console.warn = undefined;
    try {
      const Logger = loadLoggerFresh({ debug: true });
      expect(() => Logger.deprecation('x')).not.toThrow();
    } finally {
      console.warn = prevWarn;
    }
  });
});
