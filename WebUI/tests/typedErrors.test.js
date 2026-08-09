/**
 * typedErrors.test.js — Fase 3 (plan v3.2 §4.3): errores tipados.
 *
 *   - ABDError / SysExError / MidiError / PatchImportError: clases con
 *     { code, category, context, timestamp }, serializables (toJSON/toString).
 *   - asTypedError: envuelve errores planos (JSON.parse, Web MIDI) sin perder
 *     el mensaje; no duplica ABDError existentes.
 *   - Integración:
 *       · bridge-sysex.js        → lanza SysExError (SYSEX_NO_PORT / SYSEX_TIMEOUT
 *                                 / SYSEX_UNKNOWN_DUMP_TYPE).
 *       · browser_io_parse_import.js → devuelve errorCode tipado en los resultados
 *                                 (IMPORT_INVALID_JSON / IMPORT_REJECTED /
 *                                 IMPORT_UNSUPPORTED_FORMAT).
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const { ABDError, SysExError, MidiError, PatchImportError, ERROR_CODES, asTypedError, isTypedError, createTypedError } =
  require(path.join(ROOT, 'WebUI', 'js', 'typed_errors.js'));

// ════════════════════════════════════════════════════════════════
// 1. Clases tipadas
// ════════════════════════════════════════════════════════════════

describe('errores tipados — jerarquía y metadatos', () => {
  it('SysExError/MidiError/PatchImportError extienden ABDError y Error', () => {
    for (const Ctor of [SysExError, MidiError, PatchImportError]) {
      const e = new Ctor('TEST_CODE', 'msg');
      expect(e).toBeInstanceOf(Ctor);
      expect(e).toBeInstanceOf(ABDError);
      expect(e).toBeInstanceOf(Error);
      expect(e.message).toBe('msg');
      expect(e.stack).toBeTruthy();
    }
  });

  it('categorías correctas por clase', () => {
    expect(new SysExError('A', 'm').category).toBe('sysex');
    expect(new MidiError('A', 'm').category).toBe('midi');
    expect(new PatchImportError('A', 'm').category).toBe('import');
    expect(new ABDError('A', 'm').category).toBe('generic');
  });

  it('timestamp y context se capturan', () => {
    const e = new SysExError('SYSEX_TIMEOUT', 't', { timeoutMs: 3000, elapsed: 42 });
    expect(e.timestamp).toBeGreaterThan(0);
    expect(e.context).toEqual({ timeoutMs: 3000, elapsed: 42 });
    expect(e.context).not.toBeNull();
  });

  it('toJSON es plano y serializable (sin stack), toString es diagnóstico', () => {
    const e = new PatchImportError('IMPORT_INVALID_JSON', 'bad json');
    const j = e.toJSON();
    expect(j.name).toBe('PatchImportError');
    expect(j.category).toBe('import');
    expect(j.code).toBe('IMPORT_INVALID_JSON');
    expect(j.message).toBe('bad json');
    expect(j.timestamp).toBeGreaterThan(0);
    expect(JSON.parse(JSON.stringify(j)).code).toBe('IMPORT_INVALID_JSON');
    expect(String(e)).toContain('[import] IMPORT_INVALID_JSON: bad json');
  });

  it('ERROR_CODES expone los códigos canónicos congelados', () => {
    expect(Object.isFrozen(ERROR_CODES)).toBe(true);
    expect(ERROR_CODES.SYSEX_TIMEOUT).toBe('SYSEX_TIMEOUT');
    expect(ERROR_CODES.MIDI_NO_ACCESS).toBe('MIDI_NO_ACCESS');
    expect(ERROR_CODES.IMPORT_UNSUPPORTED_FORMAT).toBe('IMPORT_UNSUPPORTED_FORMAT');
  });

  it('isTypedError distingue tipados de planos', () => {
    expect(isTypedError(new SysExError('A', 'm'))).toBe(true);
    expect(isTypedError(new Error('plano'))).toBe(false);
    expect(isTypedError(null)).toBe(false);
  });

  it('createTypedError elige la clase por categoría y conserva el mensaje', () => {
    expect(createTypedError('sysex', 'SYSEX_TIMEOUT', 't')).toBeInstanceOf(SysExError);
    expect(createTypedError('midi', 'MIDI_NO_ACCESS', 'm')).toBeInstanceOf(MidiError);
    expect(createTypedError('import', 'IMPORT_REJECTED', 'i')).toBeInstanceOf(PatchImportError);
    expect(createTypedError('generic', 'G', 'g')).toBeInstanceOf(ABDError);
    expect(createTypedError('sysex', 'SYSEX_NO_PORT', 'No MIDI port available').message).toBe('No MIDI port available');
    expect(createTypedError('unknown-cat', 'X', 'msg')).toBeInstanceOf(ABDError);
  });
});

// ════════════════════════════════════════════════════════════════
// 2. asTypedError (wrapper de errores planos)
// ════════════════════════════════════════════════════════════════

describe('asTypedError', () => {
  it('envuelve un error plano en la clase de la categoría con fallback de código', () => {
    const raw = new Error('Unexpected token } in JSON');
    const t = asTypedError(raw, 'import');
    expect(t).toBeInstanceOf(PatchImportError);
    expect(t.code).toBe('IMPORT_INVALID_JSON');
    expect(t.message).toContain('Unexpected token }');
    expect(t.cause).toBe(raw);
  });

  it('respeta el código explícito si se pasa', () => {
    const t = asTypedError(new Error('x'), 'sysex', 'SYSEX_MALFORMED_RESPONSE');
    expect(t).toBeInstanceOf(SysExError);
    expect(t.code).toBe('SYSEX_MALFORMED_RESPONSE');
  });

  it('no duplica un ABDError ya tipado (idempotente)', () => {
    const original = new MidiError('MIDI_NO_OUTPUT', 'no out');
    const t = asTypedError(original, 'midi');
    expect(t).toBe(original);
  });

  it('maneja valores no-Error (string/null)', () => {
    const t = asTypedError('string error', 'midi');
    expect(t).toBeInstanceOf(MidiError);
    expect(t.message).toContain('string error');
    const n = asTypedError(null, 'sysex');
    expect(n).toBeInstanceOf(SysExError);
  });
});

// ════════════════════════════════════════════════════════════════
// 3. Integración bridge-sysex.js (SysExError)
// ════════════════════════════════════════════════════════════════

describe('bridge-sysex.js — errores tipados', () => {
  it('requestSysEx sin puertos lanza error tipado SYSEX_NO_PORT vía createTypedError', async () => {
    const src = fs.readFileSync(path.join(ROOT, 'WebUI', 'js', 'bridge-sysex.js'), 'utf8');
    expect(src).toContain('SYSEX_NO_PORT');
    expect(src).toContain('createTypedError');
    expect(src).toContain("createTypedError('sysex', 'SYSEX_NO_PORT', 'No MIDI port available')");
  });

  it('timeout usa createTypedError SYSEX_TIMEOUT con context de duración', async () => {
    const src = fs.readFileSync(path.join(ROOT, 'WebUI', 'js', 'bridge-sysex.js'), 'utf8');
    expect(src).toContain('SYSEX_TIMEOUT');
    expect(src).toContain('{ timeoutMs, elapsed }');
  });

  it('tipo de dump desconocido conserva el contrato (warn + return null, no lanza)', () => {
    const src = fs.readFileSync(path.join(ROOT, 'WebUI', 'js', 'bridge-sysex.js'), 'utf8');
    expect(src).toContain('Unknown dump type');
    expect(src).toContain('return null');
    // Los callers tipo panel_controls_chord (chord/polychord) dependen de null, no de throw
    const chordCallers = fs.readFileSync(path.join(ROOT, 'WebUI', 'js', 'panel_controls_chord.js'), 'utf8');
    expect(chordCallers).toContain("requestMidiDump('chord')");
  });
});

// ════════════════════════════════════════════════════════════════
// 4. Integración browser_io_parse_import.js (PatchImportError / errorCode)
// ════════════════════════════════════════════════════════════════

describe('browser_io_parse_import.js — errores tipados de importación', () => {
  it('JSON inválido devuelve errorCode IMPORT_INVALID_JSON', () => {
    const src = fs.readFileSync(path.join(ROOT, 'WebUI', 'js', 'browser_io_parse_import.js'), 'utf8');
    expect(src).toContain('IMPORT_INVALID_JSON');
  });

  it('rechazo de banco/patch en modo clásico usa IMPORT_REJECTED', () => {
    const src = fs.readFileSync(path.join(ROOT, 'WebUI', 'js', 'browser_io_parse_import.js'), 'utf8');
    expect(src).toContain('IMPORT_REJECTED');
  });

  it('formato no soportado usa IMPORT_UNSUPPORTED_FORMAT', () => {
    const src = fs.readFileSync(path.join(ROOT, 'WebUI', 'js', 'browser_io_parse_import.js'), 'utf8');
    expect(src).toContain('IMPORT_UNSUPPORTED_FORMAT');
  });

  it('typed_errors.js está cargado en index.html antes de los módulos bridge/parse', () => {
    const html = fs.readFileSync(path.join(ROOT, 'WebUI', 'index.html'), 'utf8');
    const idxTyped = html.indexOf('js/typed_errors.js');
    expect(idxTyped).toBeGreaterThan(-1);
    const idxBridge = html.indexOf('js/bridge-sysex.js');
    expect(idxTyped).toBeLessThan(idxBridge);
  });
});

// ════════════════════════════════════════════════════════════════
// 5. Integración bridge_connection_midi.js (MidiError sin re-lanzar)
// ════════════════════════════════════════════════════════════════

describe('bridge_connection_midi.js — MidiError sin romper el flujo', () => {
  it('initWebMidi NO relanza desde el catch (evita unhandled rejection en init())', () => {
    const src = fs.readFileSync(path.join(ROOT, 'WebUI', 'js', 'bridge_connection_midi.js'), 'utf8');
    // El catch debe loguear el error tipado, no relanzarlo
    expect(src).toContain('createTypedError');
    expect(src).toContain("createTypedError('midi', 'MIDI_NO_ACCESS'");
    expect(src).toContain('this._lastMidiError');
    // No debe haber un throw dentro de ese catch de initWebMidi
    const catchRegion = src.slice(src.indexOf('Error al acceder a los dispositivos MIDI:'), src.indexOf('Logger.log("[Bridge] MIDI device module loaded")'));
    expect(catchRegion).not.toContain('throw typed');
  });
});
