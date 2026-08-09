/**
 * roundtripEquality.test.js — Fase 4 (plan v3.2 §5)
 *
 * Batería de igualdad de round-trip en 3 niveles + fuzzing acotado:
 *   - Nivel 1 `rawCodecEqual`         : Bytes → Pack → Unpack → Bytes (invariante de codec).
 *   - Nivel 2 `semanticEqual`         : Patch → Parámetros → Patch, descartando bytes
 *                                       reservados (nombre 223-238 + cola 239-241) y padding.
 *   - Nivel 3a `hardwareCanonicalEqual`: comparación contra el corpus A–H con
 *                                       exact_match | canonical_match | semantic_match |
 *                                       known_exception.
 *   - `fuzzRoundTrip`                 : property-based testing con Max Payload 500B y
 *                                       Max Timeout 100ms por caso (determinista por seed).
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import registry from '../js/registry.gen.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

// ── Cargar módulos UMD (mismo sandbox que el resto de la suite) ──
function loadJsGlobal(relPath) {
  const code = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
  const sandbox = { window: {} };
  const fn = new Function('window', code + '\n;return window;');
  return fn(sandbox.window);
}

const RTE = loadJsGlobal('WebUI/js/roundtrip_equality.js').RoundTripEquality;
const PACKER = loadJsGlobal('WebUI/js/browser_packer.js');

// Instancia en contexto Node real (con `require`) para cargar el corpus A–H;
// el sandbox `new Function` no expone `require` a los módulos UMD.
const requireNode = createRequire(import.meta.url);
const RTE_NODE = requireNode('../../WebUI/js/roundtrip_equality.js');

// ── Corpus A–H (disponible en local y en CI roundtrip-corpus) ──
const BANKS_DIR = path.join(ROOT, 'resources', 'banks', 'Factory Banks V1.1.2');
const hasCorpus = fs.existsSync(BANKS_DIR);
const CORPUS_A = hasCorpus ? RTE_NODE.loadCorpusFromBanks(BANKS_DIR, ['A']) : [];

function buildSysex(patch, bank, prog, device) {
  return PACKER.buildSingleSysex({ unpackedBytes: patch }, bank, prog, device);
}

function randomPatch(seed) {
  const rng = RTE.mulberry32(seed);
  const out = new Uint8Array(242);
  for (let i = 0; i < 242; i++) {out[i] = Math.floor(rng() * 256);}
  return out;
}

// ════════════════════════════════════════════════════════════════
// Nivel 1 — rawCodecEqual (Bytes → Pack → Unpack → Bytes)
// ════════════════════════════════════════════════════════════════

describe('rawCodecEqual — Nivel 1 (invariante de codec)', () => {
  it('un patch es igual a sí mismo y el round-trip pack→unpack es identidad', () => {
    const patch = randomPatch(0xAB12);
    const r = RTE.rawCodecEqual(patch, patch);
    expect(r.equal).toBe(true);
    expect(r.classification).toBe('exact');
    expect(r.level).toBe(1);
    expect(r.roundTripExact.a).toBe(true);
    expect(r.roundTripExact.b).toBe(true);
    expect(r.mismatches).toEqual([]);
  });

  it('la invariante se cumple para 20 patches aleatorios (sin registro)', () => {
    for (let s = 1; s <= 20; s++) {
      const patch = randomPatch(s * 7919);
      const r = RTE.rawCodecEqual(patch, patch);
      expect(r.equal, `seed ${s}`).toBe(true);
    }
  });

  it('dos patches que difieren en un byte → mismatch con el offset reportado', () => {
    const a = randomPatch(7);
    const b = a.slice();
    b[39] = (b[39] + 1) & 0xFF; // VCF Cutoff
    const r = RTE.rawCodecEqual(a, b);
    expect(r.equal).toBe(false);
    expect(r.classification).toBe('mismatch');
    expect(r.mismatches).toContain(39);
  });

  it('acepta entrada en formato sysex (291B) y la compara con el patch desempaquetado', () => {
    const patch = randomPatch(0xDEAD);
    const syx = buildSysex(patch, 2, 10, 0x7F);
    expect(syx.length).toBe(291);
    const r = RTE.rawCodecEqual(syx, patch);
    expect(r.equal).toBe(true);
    expect(r.roundTripExact.a).toBe(true);
  });

  it('rechaza sysex con cabecera corrupta cuando requireHeader está activo', () => {
    const patch = randomPatch(0xCAFE);
    const syx = buildSysex(patch, 0, 0, 0x7F);
    syx[6] = 0x01; // rompe el comando 0x02 (Program Dump Response)
    const r = RTE.rawCodecEqual(syx, syx, { requireHeader: true });
    expect(r.equal).toBe(false);
    expect(r.error).toMatch(/header/);
  });

  it('rechaza longitudes no válidas', () => {
    const r = RTE.rawCodecEqual(new Uint8Array(100), new Uint8Array(242));
    expect(r.equal).toBe(false);
    expect(r.error).toMatch(/invalid_length/);
  });
});

// ════════════════════════════════════════════════════════════════
// Nivel 2 — semanticEqual (Patch → Parámetros → Patch)
// ════════════════════════════════════════════════════════════════

describe('semanticEqual — Nivel 2 (espacio de parámetros)', () => {
  it('un patch es semánticamente igual a sí mismo (reencode estable)', () => {
    const patch = randomPatch(0x4242);
    const r = RTE.semanticEqual(patch, patch, { registry });
    expect(r.equal).toBe(true);
    expect(r.classification).toBe('semantic');
    expect(r.reencodeStable).toBe(true);
    expect(r.checkedBytes).toBeGreaterThan(0);
  });

  it('ignora la región reservada (nombre 223-238 + cola 239-241) y el padding', () => {
    const a = randomPatch(0x1111);
    const b = a.slice();
    for (let i = 223; i <= 241; i++) {b[i] = (b[i] + 1) & 0xFF;} // solo región reservada
    const r = RTE.semanticEqual(a, b, { registry });
    expect(r.equal).toBe(true);
    expect(r.mismatches).toEqual([]);
    expect(r.ignoredBytes).toContain(223);
    expect(r.ignoredBytes).toContain(241);
    expect(r.ignoredBytes.length).toBeGreaterThanOrEqual(19);
  });

  it('detecta una diferencia en VCF Cutoff (byte 39, parámetro mapeado)', () => {
    const a = randomPatch(0x2222);
    const b = a.slice();
    b[39] = (b[39] + 10) & 0xFF;
    const r = RTE.semanticEqual(a, b, { registry });
    expect(r.equal).toBe(false);
    expect(r.classification).toBe('mismatch');
    expect(r.mismatches.length).toBeGreaterThanOrEqual(1);
    const m = r.mismatches.find((x) => x.byteOffset === 39);
    expect(m).toBeDefined();
    expect(m.paramIds).toContain('vcf_cutoff');
    expect(Math.abs(m.normA - m.normB)).toBeGreaterThan(1 / 255);
  });

  it('decodifica con rawToNormalized del registro (0 vs 255 → normalizados 0 vs 1)', () => {
    const a = randomPatch(0x3333);
    const b = a.slice();
    b[39] = 255;
    a[39] = 0;
    const r = RTE.semanticEqual(a, b, { registry });
    const m = r.mismatches.find((x) => x.byteOffset === 39);
    expect(m.normA).toBeCloseTo(0, 5);
    expect(m.normB).toBeCloseTo(1, 5);
  });

  it('respeta la tolerancia configurable (diferencia de 1 raw con tol 2/255)', () => {
    const a = randomPatch(0x4444);
    const b = a.slice();
    b[39] = (b[39] + 1) & 0xFF;
    const strict = RTE.semanticEqual(a, b, { registry, tolerance: 0 });   // tol 0 → mismatch
    const loose = RTE.semanticEqual(a, b, { registry, tolerance: 2 / 255 }); // tol 2/255 → equal
    expect(strict.equal).toBe(false);
    expect(loose.equal).toBe(true);
  });

  it('degradación sin registro: comparación estructural excluyendo solo la región reservada', () => {
    const a = randomPatch(0x5555);
    const b = a.slice();
    b[39] = (b[39] + 1) & 0xFF;
    const r = RTE.semanticEqual(a, b, { registry: null });
    expect(r.registryAvailable).toBe(false);
    expect(r.equal).toBe(false);
    expect(r.checkedBytes).toBeGreaterThan(0);
  });
});

// ════════════════════════════════════════════════════════════════
// Nivel 3a — hardwareCanonicalEqual (corpus A–H)
// ════════════════════════════════════════════════════════════════

describe.skipIf(!hasCorpus)('hardwareCanonicalEqual — Nivel 3a (corpus A–H)', () => {
  it('un preset del corpus en su posición declarada → exact_match', () => {
    const entry = CORPUS_A[0];
    const syx = buildSysex(entry.unpacked, 0, 0, 0x7F); // banco A (0) · programa 0
    const r = RTE.hardwareCanonicalEqual(syx, CORPUS_A, { registry });
    expect(r.best).toBe(RTE.EXACT);
    expect(r.bestMatch.bank).toBe('A');
    expect(r.bestMatch.prog).toBe(0);
    expect(r.corpusSize).toBe(128);
  });

  it('el mismo patch con cabecera de posición distinta (bank/prog) → canonical_match', () => {
    const entry = CORPUS_A[0];
    const syx = buildSysex(entry.unpacked, 5, 42, 0x01); // mismo payload, otra posición
    const r = RTE.hardwareCanonicalEqual(syx, CORPUS_A, { registry });
    expect(r.best).toBe(RTE.CANONICAL);
    expect(r.bestMatch.bank).toBe('A');
  });

  it('un patch desnudo (sin cabecera) con bytes idénticos → canonical_match (posición desconocida)', () => {
    const r = RTE.hardwareCanonicalEqual(CORPUS_A[0].unpacked, CORPUS_A, { registry });
    expect(r.best).toBe(RTE.CANONICAL);
    expect(r.bestMatch.bank).toBe('A');
  });

  it('la forma de objeto {unpacked, bank, prog} usa la posición declarada → exact_match', () => {
    const entry = CORPUS_A[0];
    const r = RTE.hardwareCanonicalEqual(
      { unpacked: entry.unpacked, bank: 0, prog: 0 }, // banco A (0) · programa 0
      CORPUS_A,
      { registry }
    );
    expect(r.best).toBe(RTE.EXACT);
    expect(r.bestMatch.prog).toBe(0);
  });

  it('la forma de objeto con posición distinta → canonical_match', () => {
    const entry = CORPUS_A[0];
    const r = RTE.hardwareCanonicalEqual(
      { unpacked: entry.unpacked, bank: 5, prog: 42 },
      CORPUS_A,
      { registry }
    );
    expect(r.best).toBe(RTE.CANONICAL);
    expect(r.bestMatch.bank).toBe('A');
  });

  it('un patch con solo la región del nombre alterada → semantic_match', () => {
    const entry = CORPUS_A[0];
    const tweaked = entry.unpacked.slice();
    for (let i = 223; i <= 238; i++) {tweaked[i] = (tweaked[i] + 1) & 0xFF;} // nombre cambiado
    const r = RTE.hardwareCanonicalEqual(tweaked, CORPUS_A, { registry });
    expect(r.best).toBe(RTE.SEMANTIC);
    expect(r.bestMatch.bank).toBe('A');
  });

  it('un patch aleatorio sin correspondencia → no_match', () => {
    const r = RTE.hardwareCanonicalEqual(randomPatch(0xF00D), CORPUS_A, { registry });
    expect(r.best).toBe(RTE.NO_MATCH);
    expect(r.bestMatch).toBeNull();
  });

  it('una excepción registrada (known_exception) tiene prioridad sobre exact_match', () => {
    const target = CORPUS_A[0].unpacked;
    const known = [{ bank: 'A', prog: 0, reason: 'regresión conocida del preset 0' }];
    const r = RTE.hardwareCanonicalEqual(target, CORPUS_A, { registry, knownExceptions: known });
    expect(r.best).toBe(RTE.KNOWN_EXCEPTION);
    expect(r.knownExceptionApplied).toBe(true);
    expect(r.bestMatch.reason).toContain('regresión');
  });
});

// ════════════════════════════════════════════════════════════════
// Paridad del codec con browser_packer.js (guardia anti-drift)
// ════════════════════════════════════════════════════════════════

describe('paridad de codec — roundtrip_equality.js vs browser_packer.js', () => {
  it('pack8to7 y unpack7to8 producen exactamente los mismos bytes', () => {
    const patch = hasCorpus ? CORPUS_A[0].unpacked : randomPatch(0x9999);
    const theirsPacked = PACKER.pack8to7(patch);
    const minePacked = RTE.pack8to7(patch);
    expect(Array.from(minePacked)).toEqual(Array.from(theirsPacked));
    expect(Array.from(RTE.unpack7to8(theirsPacked))).toEqual(Array.from(patch));
  });
});

// ════════════════════════════════════════════════════════════════
// Fuzzing acotado (Max Payload 500B, Max Timeout 100ms, seed determinista)
// ════════════════════════════════════════════════════════════════

describe('fuzzRoundTrip — property-based testing acotado', () => {
  it('100 casos con seed fijo: 0 fallos, 0 violaciones, presupuesto temporal respetado', () => {
    const r = RTE.fuzzRoundTrip({ seed: 0xBEEF, iterations: 100, registry });
    expect(r.deterministic).toBe(true);
    expect(r.passed).toBe(100);
    expect(r.failed).toBe(0);
    expect(r.violations).toEqual([]);
    expect(r.maxCaseMs).toBeLessThanOrEqual(r.maxTimeoutMs);
  });

  it('es determinista: mismo seed → mismos resultados (los invariantes no dependen del reloj)', () => {
    // maxTimeoutMs alto para que el presupuesto temporal (dependiente del reloj de
    // pared) nunca intervenga: passed/failed/violations dependen solo del PRNG y
    // del codec, ambos deterministas.
    const a = RTE.fuzzRoundTrip({ seed: 0x1234, iterations: 50, registry, maxTimeoutMs: 60000 });
    const b = RTE.fuzzRoundTrip({ seed: 0x1234, iterations: 50, registry, maxTimeoutMs: 60000 });
    expect(a.passed).toBe(b.passed);
    expect(a.failed).toBe(b.failed);
    expect(a.violations).toEqual(b.violations);
  });

  it('los límites por defecto del plan son 500B de payload y 100ms por caso', () => {
    expect(RTE.FUZZ_MAX_PAYLOAD).toBe(500);
    expect(RTE.FUZZ_MAX_TIMEOUT_MS).toBe(100);
    expect(RTE.fuzzRoundTrip().maxPayload).toBe(500);
    expect(RTE.fuzzRoundTrip().maxTimeoutMs).toBe(100);
  });

  it('impone el presupuesto temporal: un codec lento fuerza violaciones de timeout', () => {
    // Inyecta un codec lento (~6ms por llamada) vía el holder mutable `api`:
    // con maxTimeoutMs=1 cada caso excede el presupuesto y se registra timeout.
    const orig = RTE.unpack7to8;
    RTE.unpack7to8 = function (b) {
      const t0 = Date.now();
      while (Date.now() - t0 < 6) { /* busy-wait */ }
      return orig(b);
    };
    try {
      const r = RTE.fuzzRoundTrip({ seed: 1, iterations: 5, maxTimeoutMs: 1 });
      expect(r.failed).toBeGreaterThan(0);
      expect(r.violations.some((v) => v.property === 'timeout')).toBe(true);
    } finally {
      RTE.unpack7to8 = orig;
    }
  });

  it('respetar maxPayload: nunca genera payloads por encima del límite', () => {
    const r = RTE.fuzzRoundTrip({ seed: 2, iterations: 10, maxPayload: 300 });
    expect(r.maxPayload).toBe(300);
    expect(r.failed).toBe(0);
  });

  it('detecta un codec roto (monkey-patch de pack8to7) como violación de invariante', () => {
    const orig = RTE.pack8to7;
    RTE.pack8to7 = function (b) { const p = orig(b); if (p.length > 0) {p[0] = (p[0] + 1) & 0xFF;} return p; };
    try {
      const r = RTE.fuzzRoundTrip({ seed: 3, iterations: 20, registry });
      expect(r.failed).toBeGreaterThan(0);
      expect(r.violations.some((v) => v.property === 'codec_invariance')).toBe(true);
    } finally {
      RTE.pack8to7 = orig;
    }
  });
});
