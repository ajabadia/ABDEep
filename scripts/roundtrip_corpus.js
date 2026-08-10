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
 *   node scripts/roundtrip_corpus.js --classify      # + tabla por preset (exact/canonical/semantic)
 *   node scripts/roundtrip_corpus.js --dumps-dir <dir>  # clasifica dumps del HARDWARE
 *                                            (Nivel 3b) contra el corpus de fábrica; la
 *                                            clasificación es SIEMPRE activa en este modo
 *                                            (--classify es un no-op); las known_exceptions
 *                                            se leen del manifest.json del directorio
 *                                            (p.ej. B/1) y tienen prioridad
 *   node scripts/roundtrip_corpus.js --out report.json
 *
 * Exit code: 0 = OK · 1 = errores (invariante roto, self-match fallido, banco ausente,
 *             desviación sin clasificar en modo dumps).
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
  const wantClassify = args.includes('--classify');
  const outFile = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;
  const dumpsDir = args.includes('--dumps-dir') ? path.resolve(args[args.indexOf('--dumps-dir') + 1]) : null;
  return { banks, wantJson, wantClassify, outFile, dumpsDir };
}

/**
 * Carga las known_exceptions del manifest.json de un directorio de dumps
 * (formato nivel3b: resumen.divergencias[] con clasificacion known_exception).
 * Devuelve Array<{bank, prog, reason}> — el formato que espera RoundTripEquality.
 */
function loadKnownExceptionsFromManifest(dumpsDir) {
  const manifestPath = path.join(dumpsDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) { return []; }
  let manifest = null;
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
  catch (e) { return []; }
  const divergencias = (manifest.resumen && manifest.resumen.divergencias) || [];
  const out = [];
  for (const d of divergencias) {
    if (d && d.clasificacion === 'known_exception' && d.banco && d.prog !== undefined) {
      const offsets = Array.isArray(d.offsets) ? d.offsets.join(',') : '? ';
      out.push({
        bank: String(d.banco).toUpperCase(),
        prog: Number(d.prog),
        reason: `${d.diffBytes} bytes en offsets [${offsets}] (${d.factory}->${d.hw}) — known_exception registrada en manifest`,
      });
    }
  }
  return out;
}

// ────────────────────────────────────────────────────────────────
// Modo dumps (Nivel 3b): clasificar dumps del HARDWARE vs corpus de fábrica
// ────────────────────────────────────────────────────────────────

function classifyDumps({ banks, dumpsDir, wantJson, outFile }) {
  const report = {
    schemaVersion: 1,
    tool: 'roundtrip_corpus',
    mode: 'dumps-vs-corpus',
    generatedAt: new Date().toISOString(),
    banks,
    dumpsDir,
    corpusSize: 0,
    dumpsLoaded: 0,
    knownExceptions: [],
    classify: { byPreset: [], counts: { exact_match: 0, canonical_match: 0, semantic_match: 0, known_exception: 0, no_match: 0 } },
    errors: [],
  };

  const corpus = RTE.loadCorpusFromBanks(BANKS_DIR, banks);
  report.corpusSize = corpus.length;
  const expected = banks.length * PRESETS_PER_BANK;
  if (corpus.length !== expected) {
    report.errors.push(`Corpus incompleto: ${corpus.length}/${expected} presets cargados de ${BANKS_DIR}`);
    report.ok = false;
    finishDumps(report, wantJson, outFile, 1);
    return;
  }

  if (!fs.existsSync(dumpsDir)) {
    report.errors.push(`Directorio de dumps no encontrado: ${dumpsDir}`);
    report.ok = false;
    finishDumps(report, wantJson, outFile, 1);
    return;
  }

  const dumps = RTE.loadCorpusFromBanks(dumpsDir, banks);
  report.dumpsLoaded = dumps.length;
  if (dumps.length !== expected) {
    report.errors.push(`Dumps incompletos: ${dumps.length}/${expected} presets cargados de ${dumpsDir}`);
    report.ok = false;
    finishDumps(report, wantJson, outFile, 1);
    return;
  }

  const knownExceptions = loadKnownExceptionsFromManifest(dumpsDir);
  report.knownExceptions = knownExceptions;

  // Fast path por posición declarada: la mayoría de presets del dump son byte-
  // idénticos al corpus en su MISMA posición (1023/1024) — se clasifican con un
  // pre-check O(1) (exact) o la known_exception registrada (B/1), SIN escanear el
  // corpus completo (O(n²) ≈ 27 s). Solo las divergencias reales caen al scan.
  const byPos = new Map();
  for (const c of corpus) { byPos.set(c.bank + '/' + c.prog, c); }
  const exByPos = new Map();
  for (const ex of knownExceptions) { exByPos.set(ex.bank + '/' + ex.prog, ex); }

  for (const t of dumps) {
    const key = t.bank + '/' + t.prog;
    const target = { unpacked: t.unpacked, bank: t.bank, prog: t.prog };
    let cls = null;
    let reason = null;

    const ex = exByPos.get(key);
    if (ex) {
      cls = RTE.KNOWN_EXCEPTION;
      reason = ex.reason;
    } else {
      const samePos = byPos.get(key);
      if (samePos && bytesEqual(t.unpacked, samePos.unpacked)) {
        cls = RTE.EXACT;
      }
    }

    // Divergencia real (o posición sin par): scan completo del corpus.
    if (cls === null) {
      const r = RTE.hardwareCanonicalEqual(target, corpus, { registry: REGISTRY, knownExceptions });
      cls = r.best;
      reason = (r.bestMatch && r.bestMatch.reason) || null;
    }

    const row = {
      bank: t.bank,
      prog: t.prog,
      classification: cls,
      reason,
    };
    report.classify.byPreset.push(row);
    report.classify.counts[cls] = (report.classify.counts[cls] || 0) + 1;
    if (cls === RTE.NO_MATCH) {
      report.errors.push(`Dumps [${t.bank}/${t.prog}]: desviación SIN clasificar contra el corpus (no_match)`);
    } else if (cls === RTE.SEMANTIC && !exByPos.has(key)) {
      // Divergencia clasificada como semantic SIN known_exception registrada: aviso
      // no-fatal (el manifest puede faltar o no documentar esta posición todavía).
      report.warnings = report.warnings || [];
      report.warnings.push(`Dumps [${t.bank}/${t.prog}]: semantic_match sin known_exception en manifest.json — verificar si debe registrarse`);
      console.warn(`⚠️ Dumps [${t.bank}/${t.prog}]: semantic_match sin known_exception en manifest.json`);
    }
  }

  report.ok = report.errors.length === 0;
  finishDumps(report, wantJson, outFile, report.ok ? 0 : 1);
}

function finishDumps(report, wantJson, outFile, exitCode) {
  const C = report.classify.counts;
  const lines = [
    '='.repeat(64),
    '🔧 ROUND-TRIP DUMPS (Nivel 3b) — dumps del hardware vs corpus de fábrica',
    '='.repeat(64),
    `Dumps: ${report.dumpsLoaded}/${report.corpusSize} presets (${report.dumpsDir})`,
    'Clasificación por preset:',
    `  exact_match: ${C.exact_match} · canonical_match: ${C.canonical_match} · semantic_match: ${C.semantic_match} · known_exception: ${C.known_exception} · no_match: ${C.no_match}`,
  ];
  if (report.knownExceptions.length > 0) {
    lines.push(`Known exceptions aplicadas (${report.knownExceptions.length}):`);
    for (const ex of report.knownExceptions) {
      lines.push(`  ${ex.bank}/${ex.prog} — ${ex.reason}`);
    }
  }
  if (report.errors.length > 0) {
    lines.push(`\n❌ ${report.errors.length} error(es):`);
    for (const err of report.errors) { lines.push(`  - ${err}`); }
  } else {
    lines.push('\n✅ Todos los presets del dump clasificados (sin no_match) — corpus y dumps consistentes.');
  }
  emitReport(report, lines, wantJson, outFile, exitCode);
}

// ────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────

function main() {
  const { banks, wantJson, wantClassify, outFile, dumpsDir } = parseArgs();

  // Modo Nivel 3b: clasificar dumps del hardware contra el corpus de fábrica.
  if (dumpsDir) {
    classifyDumps({ banks, dumpsDir, wantJson, outFile });
    return;
  }


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
    classify: null,       // { byPreset: [...], counts: {...} } — solo con --classify
  };

  // Los pares (hash → grupo de presets) alimentan la clasificación por preset:
  // presets con los mismos parámetros (mismo hash semántico).
  const bySemHash = new Map();

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
  //    (los resultados por preset se cachean para --classify)
  const level1 = report.levels.nivel1;
  const level1ByPos = new Map();
  for (const e of corpus) {
    level1.checked++;
    const rt = RTE.rawCodecEqual(e.unpacked, e.unpacked);
    const repacked = RTE.pack8to7(RTE.unpack7to8(e.packed));
    const pass = rt.roundTripExact.a && bytesEqual(repacked, e.packed);
    level1ByPos.set(posKey(e), pass);
    if (!pass) {
      level1.failed++;
      report.errors.push(`N1 codec_invariance [${posKey(e)}]: unpack7to8(pack8to7(x)) !== x`);
      continue;
    }
    level1.passed++;
  }

  // 3. Nivel 2 — estabilidad de re-encode + hermanos semánticos (hash O(n))
  //    (los resultados por preset se cachean para --classify)
  const level2 = report.levels.nivel2;
  const level2ByPos = new Map();
  for (const e of corpus) {
    level2.checked++;
    const sem = RTE.semanticEqual(e.unpacked, e.unpacked, { registry: REGISTRY });
    const stable = sem.reencodeStable;
    level2ByPos.set(posKey(e), stable);
    if (!stable) {
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

  // 5. Clasificación por preset (solo con --classify) — reutiliza bySemHash
  //    (clasificación O(n), sin escaneos O(n²) extra). Por preset:
  //      canonical_match → tiene duplicado byte-idéntico en otra posición (matchedWith)
  //      semantic_match  → mismos parámetros que otro preset, sin ser duplicado
  //      exact_match     → único en el corpus (solo se self-matchea)
  //    (no_match no puede darse: todo preset se self-matchea con exact en Nivel 3a.)
  //    Prioridad: canonical gana sobre semantic POR CONSTRUCCIÓN — dupPos se
  //    comprueba antes que siblingPos y los pares duplicados nunca solapan los de
  //    hermanos (bytesEqual hace early-continue en el bucle de grupos). No romper
  //    ese orden: los conteos del corpus (804/210/10) dependen de él.
  //    level1/level2 de cada fila = estado de VALIDACIÓN del preset (true si pasó
  //    el invariante de codec / re-encode en los bucles Nivel 1/2, false si falló).
  if (wantClassify) {
    const dupPos = new Set();
    const siblingPos = new Set();
    for (const d of report.duplicates) { dupPos.add(d.a); dupPos.add(d.b); }
    for (const s of report.semanticSiblings) { siblingPos.add(s.a); siblingPos.add(s.b); }

    const byPreset = [];
    for (const e of corpus) {
      const key = posKey(e);
      let classification = 'exact_match';
      let matchedWith = null;
      if (dupPos.has(key)) {
        classification = 'canonical_match';
        matchedWith = report.duplicates.find((d) => d.a === key || d.b === key);
      } else if (siblingPos.has(key)) {
        classification = 'semantic_match';
        matchedWith = report.semanticSiblings.find((s) => s.a === key || s.b === key);
      }
      byPreset.push({
        bank: e.bank,
        prog: e.prog,
        level1: level1ByPos.get(key),
        level2: level2ByPos.get(key),
        classification,
        // Posición del preset con el que comparte bytes (dup) o parámetros (sibling)
        matchedWith: matchedWith ? (matchedWith.a === key ? matchedWith.b : matchedWith.a) : null,
      });
    }

    // Los conteos del corpus de fábrica (105 pares duplicados ×2 + 5 hermanos ×2)
    // están fijados en el test: canonical 210, semantic 10, exact 804, no_match 0.
    const counts = { exact_match: 0, canonical_match: 0, semantic_match: 0, no_match: 0 };
    for (const p of byPreset) { counts[p.classification] = (counts[p.classification] || 0) + 1; }
    report.classify = { byPreset, counts };
  }

  // 6. Resumen
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
  if (report.classify) {
    const C = report.classify.counts;
    lines.push('\nClasificación por preset (--classify):');
    lines.push(`  exact_match: ${C.exact_match} · canonical_match: ${C.canonical_match} · semantic_match: ${C.semantic_match}`);
  }
  if (report.errors.length > 0) {
    lines.push(`\n❌ ${report.errors.length} error(es):`);
    for (const err of report.errors) { lines.push(`  - ${err}`); }
  } else {
    lines.push('\n✅ Todos los niveles verdes sobre el corpus completo.');
  }
  emitReport(report, lines, wantJson, outFile, exitCode);
}

/** Emisión compartida de reporte (consola + ::error:: + --json marker + --out). */
function emitReport(report, lines, wantJson, outFile, exitCode) {
  process.stdout.write(lines.join('\n') + '\n');
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
