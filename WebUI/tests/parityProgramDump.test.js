/**
 * parityProgramDump.test.js — Paridad C++ ↔ JS del Program Dump de 291 bytes.
 *
 * Fuente de verdad compartida: schemas/parity_program_dump_291.json (generado por
 * scripts/generate_parity_fixture.js desde buildSingleSysex real).
 *
 *   - JS : buildSingleSysex (WebUI/js/browser_packer.js) debe emitir EXACTAMENTE
 *          los 291 bytes del fixture para el patch determinista + cabecera explícita.
 *   - C++: MidiTranslationEngine::createProgramDumpSysex debe emitir los MISMOS
 *          291 bytes (verificado en SynthEngineUnitTests_CalSpec.cpp con el mismo golden).
 *
 * Si buildSingleSysex cambia su layout, este test falla → regenerar el fixture:
 *   node scripts/generate_parity_fixture.js
 * y re-embeber el nuevo golden en el test C++ (SynthEngineUnitTests_CalSpec.cpp).
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

// ── Cargar browser_packer.js REAL (mismo sandbox que registry_generator.js) ──
function loadJsGlobal(relPath) {
  const code = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
  const sandbox = { window: {} };
  const fn = new Function('window', code + '\n;return window;');
  return fn(sandbox.window);
}

const PACKER = loadJsGlobal('WebUI/js/browser_packer.js');
const FIXTURE = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'schemas', 'parity_program_dump_291.json'), 'utf8')
);

function buildParityPatch() {
  const unpackedBytes = new Uint8Array(242);
  for (let i = 0; i < 242; i++) {
    unpackedBytes[i] = (i * 37 + 11) & 0xFF; // misma fórmula que el fixture y el test C++
  }
  return { name: 'PARITY TEST', unpackedBytes };
}

function toHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

describe('Parity C++ ↔ JS — buildSingleSysex vs createProgramDumpSysex (291 bytes)', () => {
  it('el fixture está al día (el golden commiteado coincide con buildSingleSysex real)', () => {
    const patch = buildParityPatch();
    const syx = PACKER.buildSingleSysex(
      patch,
      FIXTURE.header.bank,
      FIXTURE.header.program,
      FIXTURE.header.deviceId
    );
    expect(syx.length).toBe(291);
    expect(toHex(syx)).toBe(FIXTURE.expected291Hex);
  });

  it('la fórmula del patch del fixture coincide con la del test (242 bytes)', () => {
    const patch = buildParityPatch();
    expect(toHex(patch.unpackedBytes)).toBe(FIXTURE.patchHex);
    expect(FIXTURE.patchHex.length / 2).toBe(242);
  });

  it('cabecera explícita (deviceId=0x7F, bank=2, program=10) mapea a los bytes 5/8/9', () => {
    const patch = buildParityPatch();
    const syx = PACKER.buildSingleSysex(patch, 2, 10, 0x7F);
    expect(syx[5]).toBe(0x7F);
    expect(syx[6]).toBe(0x02); // Program Dump Response
    expect(syx[7]).toBe(0x07); // Comms Protocol V1.1.2
    expect(syx[8]).toBe(2);
    expect(syx[9]).toBe(10);
  });

  it('defaults preservan el comportamiento histórico (deviceId 0x7F broadcast, bank 0, prog 0)', () => {
    const patch = buildParityPatch();
    const syx = PACKER.buildSingleSysex(patch);
    expect(syx[5]).toBe(0x7F);
    expect(syx[8]).toBe(0);
    expect(syx[9]).toBe(0);
    // el resto del mensaje (payload+cola) es idéntico al de cabecera explícita
    const syxExplicit = PACKER.buildSingleSysex(patch, 0, 0, 0x7F);
    expect(toHex(syx)).toBe(toHex(syxExplicit));
  });

  it('estructura canónica: cabecera 10 + payload 278 + cola 00 00 F7 = 291 bytes', () => {
    const patch = buildParityPatch();
    const syx = PACKER.buildSingleSysex(patch, 2, 10, 0x7F);
    expect(syx[0]).toBe(0xF0);
    expect(syx[1]).toBe(0x00);
    expect(syx[2]).toBe(0x20);
    expect(syx[3]).toBe(0x32);
    expect(syx[4]).toBe(0x20);
    expect(syx[288]).toBe(0x00);
    expect(syx[289]).toBe(0x00);
    expect(syx[290]).toBe(0xF7);
    // payload 10..287 round-trip a los 242 bytes del patch
    const recovered = PACKER.unpack7to8(syx.slice(10, 288));
    expect(recovered.length).toBe(242);
    for (let i = 0; i < 242; i++) {
      expect(recovered[i]).toBe(patch.unpackedBytes[i]);
    }
  });
});
