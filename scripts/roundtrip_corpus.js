#!/usr/bin/env node
/**
 * @file roundtrip_corpus.js
 * @purpose Fase 4 (plan v3.2 §5) — batería de igualdad round-trip sobre el corpus
 *          completo de fábrica A-H (1024 presets) usando roundtrip_equality.js.
 *
 * Niveles ejecutados sobre CADA preset:
 *   Nivel 1 (rawCodecEqual)   : invariante de codec — unpack7to8(pack8to7(x)) === x
 *                               y pack8to7(unpack7to8(packed)) === packed.
 *   Nivel 2 (semanticEqual)   : estabilidad de re-encode Patch→Parámetros→Patch (±1 raw,
 *                               rango válido de enums) + detección de hermanos
 *                               semánticos (mismos parámetros, solo región reservada/padding).
 *   Nivel 3a (hardwareCanonicalEqual): self-match contra el corpus COMPLETO — cada
 *                               preset debe encontrarse a sí mismo con `exact_match`
 *                               en su posición de cabecera (banco A-H / programa),
 *                               y la posición de cabecera debe coincidir con el
 *                               orden del archivo de banco (0..127).
 *
 * Uso:
 *   node scripts/roundtrip_corpus.js                 # 8 bancos, resumen en consola
 *   node scripts/roundtrip_corpus.js --banks A,B     # solo bancos indicados
 *   node scripts/roundtrip_corpus.js --json          # reporte JSON en stdout
 *   node scripts/roundtrip_corpus.js --out report.json
 *
 * Exit code: 0 = OK · 1 = errores (invariante roto, self-match fallido, banco ausente).
 */

const path = require('path');
const fs = require('fs');

const RTE = require('../WebUI/js/roundtrip_equality.js');
const REGISTRY = require('../WebUI/js/registry.gen.js');

const BANKS_DIR = path.resolve(__dirname, '..', 'resources', 'banks', 'Factory Banks V1.1.2');
const PRESETS_PER_BANK = 128;
const UNPACKED_LEN = 242;

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function bytesEqual(a, b) {
  if (a.length !== b.length) { return false; }
  for (let i = 0; i < a.length; i++) { if (a[i] !== b[i]) { return false; } }
  return true;
}

function posKey(entry) {
  return entry.bank + '/' + entry.prog;
}

/**
 * Hash semántico: solo los bytes con parámetro mapeado (excluye la región reservada
 * 223-241 y el padding sin `byOffset`) — agrupa presets con los MISMOS parámetros.
 */
function semanticHash(unpacked) {
  let h = 0;
  for (let i = 0; i < UNPACKED_LEN; i++) {
    if (i >= RTE.NAME_START && i <= RTE.TAIL_END) { continue; }
    const ids = REGISTRY.byOffset && REGISTRY.byOffset[i];
    if (!ids || ids.length === 0) { continue; }
    h = ((h * 31) + (unpacked[i] & 0xFF)) >>> 0;
  }
  return h;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const banks = args.includes('--banks')
    ? args[args.indexOf('--banks') + 1].split(',').map((s) => s.trim().toUpperCase())
    : ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const wantJson = args.includes('--json');
  const outFile = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;
  return { banks, wantJson, outFile };
}

// ────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────

function main() {
  const { banks, wantJson, outFile } = parseArgs();

  const report = {
    schemaVersion: 1,
    tool: 'roundtrip_corpus',
    generatedAt: new Date().toISOString(),
    banks,
    banksDir: BANKS_DIR,
    corpusSize: 0, // se rellena tras cargar el corpus
    levels: {
      nivel1: { checked: 0, passed: 0, failed: 0 },
      nivel2: { checked: 0, passed: 0, failed: 0, semanticSiblings: 0 },
      nivel3a: { scanned: 0, selfMatched: 0, failed: 0, duplicates: 0 },
    },
    errors: [],
    duplicates: [],       // pares de presets byte-idénticos en posiciones distintas
    semanticSiblings: [], // pares con mismos parámetros (difieren solo en región reservada)
  };

  // 1. Cargar corpus (Node require → loadCorpusFromBanks)
  const corpus = RTE.loadCorpusFromBanks(BANKS_DIR, banks);
  report.corpusSize = corpus.length;
  const expected = banks.length * PRESETS_PER_BANK;
  if (corpus.length !== expected) {
    report.errors.push(`Corpus incompleto: ${corpus.length}/${expected} presets cargados de ${BANKS_DIR}`);
    report.ok = false;
    finish(report, wantJson, outFile, 1);
    return;
  }

  // 2. Nivel 1 — invariante de codec (rawCodecEqual + lado empaquetado)
  const level1 = report.levels.nivel1;
  for (const e of corpus) {
    level1.checked++;
    const rt = RTE.rawCodecEqual(e.unpacked, e.unpacked);
    if (!rt.roundTripExact.a) {
      level1.failed++;
      report.errors.push(`N1 codec_invariance [${posKey(e)}]: unpack7to8(pack8to7(x)) !== x`);
      continue;
    }
    const repacked = RTE.pack8to7(RTE.unpack7to8(e.packed));
    if (!bytesEqual(repacked, e.packed)) {
      level1.failed++;
      report.errors.push(`N1 packed_roundtrip [${posKey(e)}]: pack8to7(unpack7to8(packed)) !== packed`);
      continue;
    }
    level1.passed++;
  }

  // 3. Nivel 2 — estabilidad de re-encode + hermanos semánticos (hash O(n))
  const level2 = report.levels.nivel2;
  const bySemHash = new Map();
  for (const e of corpus) {
    level2.checked++;
    const sem = RTE.semanticEqual(e.unpacked, e.unpacked, { registry: REGISTRY });
    if (!sem.reencodeStable) {
      level2.failed++;
      report.errors.push(`N2 reencode_unstable [${posKey(e)}]: normalizedToRaw(rawToNormalized) fuera de ±1`);
      continue;
    }
    level2.passed++;

    const h = semanticHash(e.unpacked);
    if (!bySemHash.has(h)) { bySemHash.set(h, []); }
    bySemHash.get(h).push(e);
  }

  for (const group of bySemHash.values()) {
    if (group.length < 2) { continue; }
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        if (bytesEqual(a.unpacked, b.unpacked)) {
          // Duplicado byte-idéntico en otra posición → se reporta en Nivel 3a
          report.duplicates.push({ a: posKey(a), b: posKey(b) });
          continue;
        }
        // Mismos parámetros, difieren en la región reservada/padding → hermano semántico
        const sem = RTE.semanticEqual(a.unpacked, b.unpacked, { registry: REGISTRY });
        if (sem.equal) {
          report.semanticSiblings.push({ a: posKey(a), b: posKey(b) });
          level2.semanticSiblings++;
        }
      }
    }
  }

  // 4. Nivel 3a — self-match exact contra el corpus COMPLETO (skipSemantic: scan O(n²) rápido)
  const level3a = report.levels.nivel3a;
  // Comprobar además que la posición de cabecera (msg[9]) coincide con el orden del archivo
  const layoutByBank = new Map();
  for (const e of corpus) {
    if (!layoutByBank.has(e.bank)) { layoutByBank.set(e.bank, []); }
    layoutByBank.get(e.bank).push(e.prog);
  }

  for (const e of corpus) {
    level3a.scanned++;
    const r = RTE.hardwareCanonicalEqual(
      { unpacked: e.unpacked, bank: e.bank, prog: e.prog },
      corpus,
      { registry: REGISTRY, skipSemantic: true }
    );
    const self = r.bestMatch;
    if (r.best !== RTE.EXACT || !self || self.bank !== e.bank || self.prog !== e.prog) {
      level3a.failed++;
      report.errors.push(
        `N3a self_match [${posKey(e)}]: best=${r.best}, bestMatch=${self ? posKey(self) : 'null'}`
      );
      continue;
    }
    level3a.selfMatched++;
  }

  // Posición de cabecera vs orden del archivo (los factory banks son secuenciales 0..127)
  for (const [bank, progs] of layoutByBank) {
    for (let i = 0; i < progs.length; i++) {
      if (progs[i] !== i) {
        report.errors.push(`N3a header_layout [bank ${bank}]: prog ${progs[i]} en índice ${i} (se esperaba ${i})`);
      }
    }
  }
  level3a.duplicates = report.duplicates.length;

  // 5. Resumen
  const ok = report.errors.length === 0;
  report.ok = ok;
  finish(report, wantJson, outFile, ok ? 0 : 1);
}

function finish(report, wantJson, outFile, exitCode) {
  const L = report.levels;
  const lines = [
    '='.repeat(64),
    '🧪 ROUND-TRIP CORPUS (Fase 4) — batería de igualdad sobre el corpus de fábrica',
    '='.repeat(64),
    `Corpus: ${report.banks.length} banco(s) · ${report.banks.join(',')} · ${L.nivel1.checked} presets`,
    `Nivel 1 (rawCodecEqual)      : ${L.nivel1.passed}/${L.nivel1.checked} invariante de codec OK`,
    `Nivel 2 (semanticEqual)      : ${L.nivel2.passed}/${L.nivel2.checked} re-encode estable · ${L.nivel2.semanticSiblings} hermano(s) semántico(s)`,
    `Nivel 3a (canonical)         : ${L.nivel3a.selfMatched}/${L.nivel3a.scanned} self-match exact · ${L.nivel3a.duplicates} duplicado(s)`,
  ];

  if (report.duplicates.length > 0) {
    lines.push('\nDuplicados byte-idénticos en posiciones distintas (canonical_match):');
    for (const d of report.duplicates) { lines.push(`  ${d.a} ≙ ${d.b}`); }
  }
  if (report.semanticSiblings.length > 0) {
    lines.push('\nHermanos semánticos (mismos parámetros, difieren solo en región reservada):');
    for (const s of report.semanticSiblings) { lines.push(`  ${s.a} ~ ${s.b}`); }
  }
  if (report.errors.length > 0) {
    lines.push(`\n❌ ${report.errors.length} error(es):`);
    for (const err of report.errors) { lines.push(`  - ${err}`); }
  } else {
    lines.push('\n✅ Todos los niveles verdes sobre el corpus completo.');
  }

  const out = lines.join('\n') + '\n';
  process.stdout.write(out);
  for (const err of report.errors) {
    process.stderr.write(`::error::roundtrip-corpus — ${err}\n`);
  }

  if (wantJson) {
    process.stdout.write('\n---JSON---\n');
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  }
  if (outFile) {
    fs.writeFileSync(path.resolve(outFile), JSON.stringify(report, null, 2) + '\n');
  }
  process.exitCode = exitCode;
}

main();
