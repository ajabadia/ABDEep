/**
 * patchNameValidator.test.js — Fase 3 (plan v3.2 §4.2).
 *
 *   - PatchNameValidator: valida un nombre contra el protocolo SysEx (16 chars ASCII
 *     imprimibles, bytes 223-238 del preset desempaquetado — verificado en dumps reales).
 *   - PatchNameRenderer: inserción segura en UI vía textContent.
 *   - HardwareExporter: copia del patch con el nombre limitado a 16 chars ASCII,
 *     SIN alterar el modelo original (patch.name / patch.unpackedBytes intactos).
 *
 * Incluye integración con buildSingleSysex real (browser_packer.js) para verificar que
 * un nombre largo/unicode se trunca en los bytes 223-238 del SysEx emitido.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

function loadJsGlobal(relPath) {
  const code = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
  const sandbox = { window: {} };
  const fn = new Function('window', code + '\n;return window;');
  return fn(sandbox.window);
}

const { PatchNameValidator, PatchNameRenderer, HardwareExporter } = require(path.join(ROOT, 'WebUI', 'js', 'patch_name.js'));
const PACKER = loadJsGlobal('WebUI/js/browser_packer.js');

function makePatch(name, filler) {
  const unpackedBytes = new Uint8Array(242);
  for (let i = 0; i < 242; i++) {unpackedBytes[i] = (filler !== undefined) ? filler : (i & 0xFF);}
  if (name !== undefined) {
    for (let k = 0; k < 16; k++) {
      unpackedBytes[223 + k] = k < name.length ? name.charCodeAt(k) : 0x20;
    }
  }
  return { name, unpackedBytes };
}

function unpackedName(bytes) {
  const chars = [];
  for (let k = 0; k < 16; k++) {
    const c = bytes[223 + k];
    if (c === 0) {break;}
    if (c >= 32 && c <= 126) {chars.push(String.fromCharCode(c));}
  }
  return chars.join('').trim();
}

// ════════════════════════════════════════════════════════════════
// 1. PatchNameValidator
// ════════════════════════════════════════════════════════════════

describe('PatchNameValidator', () => {
  it('acepta nombres válidos ASCII imprimibles ≤ 16 chars', () => {
    expect(PatchNameValidator.validate('Bass 01').valid).toBe(true);
    expect(PatchNameValidator.validate('Blue Dolphin BC ').valid).toBe(true); // 16 chars exactos
    expect(PatchNameValidator.validate('Synth Lead X').valid).toBe(true);
    expect(PatchNameValidator.validate('').valid).toBe(false); // vacío
  });

  it('rechaza nombres > 16 chars (límite protocolo bytes 223-238)', () => {
    const r = PatchNameValidator.validate('ABCDEFGHIJKLMNOPQ'); // 17 chars
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toContain('16');
  });

  it('rechaza caracteres no-ASCII (unicode) y de control', () => {
    const uni = PatchNameValidator.validate('Pad «Ñandú»');
    expect(uni.valid).toBe(false);
    expect(uni.errors.join(' ')).toContain('no-ASCII');

    const ctrl = PatchNameValidator.validate('Tab\tName');
    expect(ctrl.valid).toBe(false);
    expect(ctrl.errors.join(' ')).toContain('control');
  });

  it('sanitize normaliza: recorta, descarta no-ASCII y limita a 16 chars', () => {
    expect(PatchNameValidator.sanitize('  Pad ñ  ')).toBe('Pad');
    expect(PatchNameValidator.sanitize('A'.repeat(30))).toBe('A'.repeat(16));
    expect(PatchNameValidator.sanitize('Clean-Name_1')).toBe('Clean-Name_1');
    expect(PatchNameValidator.sanitize(null)).toBe('');
    expect(PatchNameValidator.sanitize(undefined)).toBe('');
  });

  it('writeIntoUnpacked rellena el campo 223-238 con 0x20', () => {
    const bytes = new Uint8Array(242);
    PatchNameValidator.writeIntoUnpacked(bytes, 'HI');
    expect(bytes[223]).toBe('H'.charCodeAt(0));
    expect(bytes[224]).toBe('I'.charCodeAt(0));
    for (let k = 2; k < 16; k++) {expect(bytes[223 + k]).toBe(0x20);}
  });

  it('readFromUnpacked reconstruye el nombre recortado', () => {
    const bytes = new Uint8Array(242);
    PatchNameValidator.writeIntoUnpacked(bytes, '  My Patch  ');
    expect(PatchNameValidator.readFromUnpacked(bytes)).toBe('My Patch');
  });
});

// ════════════════════════════════════════════════════════════════
// 2. PatchNameRenderer (textContent, nunca innerHTML)
// ════════════════════════════════════════════════════════════════

describe('PatchNameRenderer', () => {
  it('inserta con textContent (sin parsear HTML)', () => {
    const el = { textContent: '' };
    PatchNameRenderer.render(el, '<img src=x onerror=alert(1)>');
    expect(el.textContent).toBe('<img src=x onerror=alert(1)>'); // texto plano, no HTML
    expect(el.innerHTML).toBeUndefined();
  });

  it('maneja null/undefined y devuelve el elemento', () => {
    const el = { textContent: 'x' };
    expect(PatchNameRenderer.render(el, null)).toBe(el);
    expect(el.textContent).toBe('');
    expect(PatchNameRenderer.render(el, undefined)).toBe(el);
    expect(el.textContent).toBe('');
    expect(PatchNameRenderer.render(null, 'nope')).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════
// 3. HardwareExporter (no muta el modelo original)
// ════════════════════════════════════════════════════════════════

describe('HardwareExporter', () => {
  it('no altera el patch original (name y unpackedBytes intactos)', () => {
    const patch = makePatch('Long Name '.repeat(3)); // 27 chars
    const originalBytes = Uint8Array.from(patch.unpackedBytes);
    const originalName = patch.name;

    const prep = HardwareExporter.prepareForSysEx(patch);

    expect(patch.name).toBe(originalName);
    expect(patch.unpackedBytes).toEqual(originalBytes); // sin mutación
    expect(prep.patch).not.toBe(patch);
    expect(prep.patch.unpackedBytes).not.toBe(patch.unpackedBytes);
  });

  it('trunca el nombre a 16 chars ASCII imprimibles en la copia exportada', () => {
    const patch = makePatch('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    const prep = HardwareExporter.prepareForSysEx(patch);
    expect(prep.name).toBe('ABCDEFGHIJKLMNOP'); // 16 chars
    expect(prep.truncated).toBe(true);
    expect(unpackedName(prep.patch.unpackedBytes)).toBe('ABCDEFGHIJKLMNOP');
  });

  it('descartan caracteres no-ASCII del nombre exportado', () => {
    const patch = makePatch('Pad ñ→x');
    const prep = HardwareExporter.prepareForSysEx(patch);
    expect(prep.name).toBe('Pad x'); // ñ y → descartados (el espacio interior se conserva)
    expect(prep.truncated).toBe(true);
    expect(unpackedName(prep.patch.unpackedBytes)).toBe('Pad x');
  });

  it('nombres válidos pasan sin cambios (changed=false cuando ya eran compatibles)', () => {
    const patch = makePatch('Bass 01');
    const prep = HardwareExporter.prepareForSysEx(patch);
    expect(prep.name).toBe('Bass 01');
    expect(prep.changed).toBe(false);
  });

  it('inspect devuelve el detalle estructurado de validación', () => {
    const bad = HardwareExporter.inspect(makePatch('Über-Pad')); // no-ASCII
    expect(bad.valid).toBe(false);
    expect(bad.errors.length).toBeGreaterThan(0);
    expect(bad.hardwareName).toBe('ber-Pad'); // Ü descartado

    const good = HardwareExporter.inspect(makePatch('Pad OK'));
    expect(good.valid).toBe(true);
    expect(good.hardwareName).toBe('Pad OK');
    expect(good.changed).toBe(false);
  });

  it('conserva el nombre embebido en los bytes si el modelo no tiene .name (sin regresión)', () => {
    // patch construido como {unpackedBytes} sin .name → el nombre vive solo en 223-238
    const bytes = new Uint8Array(242);
    PatchNameValidator.writeIntoUnpacked(bytes, 'Embedded Name');
    const barePatch = { unpackedBytes: bytes }; // sin .name
    const prep = HardwareExporter.prepareForSysEx(barePatch);
    expect(prep.name).toBe('Embedded Name');
    expect(prep.truncated).toBe(false);
    expect(unpackedName(prep.patch.unpackedBytes)).toBe('Embedded Name');
  });

  it('la copia exportada conserva intactos los bytes fuera del campo de nombre', () => {
    const patch = makePatch('Short', 0);
    for (let i = 0; i < 242; i++) {patch.unpackedBytes[i] = i & 0xFF;} // patrón único por byte
    const prep = HardwareExporter.prepareForSysEx(patch);
    const copy = prep.patch.unpackedBytes;
    for (let i = 0; i < 242; i++) {
      if (i >= 223 && i <= 238) {continue;} // región de nombre (saneada)
      expect(copy[i]).toBe(patch.unpackedBytes[i]);
    }
  });

  it('null-safe', () => {
    expect(HardwareExporter.prepareForSysEx(null)).toBeNull();
    expect(HardwareExporter.inspect(null)).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════
// 4. Integración end-to-end con buildSingleSysex (browser_packer.js real)
// ════════════════════════════════════════════════════════════════

describe('HardwareExporter + buildSingleSysex (bytes 223-238 en el SysEx)', () => {
  it('el SysEx emitido lleva el nombre truncado a 16 chars en unpacked 223-238', () => {
    const patch = makePatch('X'.repeat(40), 0);
    const prep = HardwareExporter.prepareForSysEx(patch);
    const syx = PACKER.buildSingleSysex(prep.patch);
    expect(syx.length).toBe(291);
    const recovered = PACKER.unpack7to8(syx.slice(10, 288));
    expect(PACKER.extractNameFromRawSysex(syx, 0)).toBe('X'.repeat(16));
    expect(unpackedName(recovered)).toBe('X'.repeat(16));
  });

  it('nombres válidos round-trip sin pérdida a través del SysEx', () => {
    const patch = makePatch('Phat Lead 07', 7);
    const prep = HardwareExporter.prepareForSysEx(patch);
    const syx = PACKER.buildSingleSysex(prep.patch);
    expect(PACKER.extractNameFromRawSysex(syx, 0)).toBe('Phat Lead 07');
  });
});
