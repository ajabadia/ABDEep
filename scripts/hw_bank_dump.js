#!/usr/bin/env node
/**
 * @file hw_bank_dump.js
 * @purpose Captura de dumps de banco REALES del hardware DeepMind 12 (Nivel 3b §5, checklist E-1).
 *
 * El cliente MCP (patchwork-deepmind) solo expone operaciones de edit-buffer; esta
 * herramienta habla el protocolo SysEx directamente (paquete `midi`, ya en
 * node_modules) para pedir cada programa de un banco y ensamblar el archivo `.syx`
 * canónico de 128 × 291 B (mismo formato que el corpus de fábrica).
 *
 *   node scripts/hw_bank_dump.js                    # bancos A-H a resources/hardware_dumps/YYYYMMDD/
 *   node scripts/hw_bank_dump.js --banks A,B        # solo bancos indicados
 *   node scripts/hw_bank_dump.js --check-hashes     # + comparar SHA-256 con schemas/corpus-hashes.json
 *   node scripts/hw_bank_dump.js --out tmp/hw       # directorio de salida
 *   node scripts/hw_bank_dump.js --json             # reporte JSON en stdout
 *
 * Formato del request (idéntico a `requestBankDump` de la WebUI):
 *   F0 00 20 32 20 <devId> 01 <bank> <prog> F7     (01 = Program Dump Request)
 * Respuesta (0x02, 291 B): F0 00 20 32 20 <dev> 02 <proto> <bank> <prog> <278B> 00 00 F7
 *
 * Exit code: 0 = OK · 1 = captura incompleta o violación de hashes · 2 = uso.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_HASHES = path.resolve(__dirname, '..', 'schemas', 'corpus-hashes.json');
const DEFAULT_OUT_ROOT = path.resolve(__dirname, '..', 'resources', 'hardware_dumps');

// ── CLI ─────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  // devId por defecto 0x00: este DM12 responde a su Device ID configurado (0, el
  // mismo del MCP), NO a broadcast 0x7F (verificado en vivo 2026-08-10).
  const opts = { banks: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], out: null, checkHashes: false, checkPayloads: false, wantJson: false, devId: 0x00, normalizeDev: null, spacingMs: 35, perBankTimeoutMs: 20000, maxSweeps: 3 };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--banks') { opts.banks = String(args[++i]).split(',').map((s) => s.trim().toUpperCase()); }
    else if (a === '--out') { opts.out = path.resolve(args[++i]); }
    else if (a === '--check-hashes') { opts.checkHashes = true; }
    else if (a === '--check-payloads') { opts.checkPayloads = true; }
    else if (a === '--json') { opts.wantJson = true; }
    else if (a === '--dev') { opts.devId = parseInt(args[++i], 16); }
    else if (a === '--normalize-dev') { opts.normalizeDev = parseInt(args[++i], 16); }
    else if (a === '--spacing') { opts.spacingMs = Number(args[++i]); }
    else { console.error(`Argumento desconocido: ${a}`); usage(); process.exit(2); }
  }
  for (const b of opts.banks) {
    if (!/^[A-H]$/.test(b)) { console.error(`Banco inválido: ${b} (esperaba A-H)`); process.exit(2); }
  }
  return opts;
}

function usage() {
  console.error('Uso: node scripts/hw_bank_dump.js [--banks A,B] [--out dir] [--check-hashes] [--check-payloads] [--normalize-dev 7F] [--dev 0] [--json]');
}

// ── MIDI ────────────────────────────────────────────────────────────────────

/** Abre el puerto MIDI del DeepMind (detección por nombre; fallback a primer puerto). */
async function openMidi() {
  const midi = (await import('midi')).default;
  const input = new midi.Input();
  const output = new midi.Output();

  const ins = [];
  for (let i = 0; i < input.getPortCount(); i++) { ins.push({ index: i, name: input.getPortName(i) }); }
  const outs = [];
  for (let i = 0; i < output.getPortCount(); i++) { outs.push({ index: i, name: output.getPortName(i) }); }

  const pick = (ports, kind) => {
    if (ports.length === 0) { throw new Error(`No hay puertos MIDI ${kind} disponibles`); }
    const named = ports.find((p) => p.name.toLowerCase().includes('deepmind'));
    return (named || ports[0]).index;
  };
  const inIdx = pick(ins, 'IN');
  const outIdx = pick(outs, 'OUT');

  input.openPort(inIdx);
  output.openPort(outIdx);
  input.ignoreTypes(false, false, false); // OBLIGATORIO: recibir SysEx
  console.log(`🎹 MIDI: IN #${inIdx} "${ins.find((p) => p.index === inIdx).name}" · OUT #${outIdx} "${outs.find((p) => p.index === outIdx).name}"`);
  return { input, output };
}

// ── Captura por banco ───────────────────────────────────────────────────────

function makeProgramRequest(devId, bankIndex, program) {
  return Uint8Array.from([0xf0, 0x00, 0x20, 0x32, 0x20, devId & 0x7f, 0x01, bankIndex & 0x07, program & 0x7f, 0xf7]);
}

/** Clasifica un mensaje entrante: {bank, prog, raw} si es un programa dump (0x02), null si no. */
function parseProgramDump(msg) {
  const b = Array.from(msg);
  if (b.length < 12 || b[0] !== 0xf0 || b[b.length - 1] !== 0xf7) { return null; }
  if (!(b[1] === 0x00 && b[2] === 0x20 && b[3] === 0x32 && b[4] === 0x20)) { return null; }
  if (b[6] !== 0x02) { return null; } // Program Dump Response
  return { bank: b[8] & 0x07, prog: b[9] & 0x7f, raw: b };
}

/** Pide un banco completo: barridos de 128 requests hasta completar o agotar sweeps. */
async function captureBank({ input, output, devId, bankIndex, spacingMs, perBankTimeoutMs, maxSweeps }) {
  const collected = new Map(); // prog -> raw message
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const onMessage = (dt, msg) => {
    const parsed = parseProgramDump(msg);
    if (parsed && parsed.bank === bankIndex && !collected.has(parsed.prog)) {
      collected.set(parsed.prog, parsed.raw);
    }
  };
  input.on('message', onMessage);

  try {
    for (let sweep = 0; sweep < maxSweeps && collected.size < 128; sweep++) {
      const missing = [];
      for (let p = 0; p < 128; p++) { if (!collected.has(p)) { missing.push(p); } }
      if (sweep > 0) { console.log(`  [sweep ${sweep + 1}] faltan ${missing.length} programas…`); }
      for (const p of missing) {
        if (collected.size >= 128) { break; }
        output.sendMessage(Array.from(makeProgramRequest(devId, bankIndex, p)));
        await sleep(spacingMs); // pacing: evita sobrecargar el firmware del synth
      }
      // Espera: continúa recogiendo hasta completar o agotar el timeout del banco
      const deadline = Date.now() + perBankTimeoutMs;
      while (collected.size < 128 && Date.now() < deadline) {
        await sleep(50);
      }
    }
  } finally {
    input.removeListener('message', onMessage);
  }

  if (collected.size < 128) {
    throw new Error(`Banco ${bankIndex}: solo se capturaron ${collected.size}/128 programas`);
  }
  // Orden canónico por programa
  const ordered = [];
  for (let p = 0; p < 128; p++) { ordered.push(collected.get(p)); }
  return ordered;
}

// ── Ensamblado y hashes ─────────────────────────────────────────────────────

function assembleSyx(orderedPrograms) {
  const messages = orderedPrograms.map((raw) => Buffer.from(raw));
  // Validar longitud canónica 291 B (cabecera 10 + payload 278 + cola 3)
  const nonCanonical = messages.filter((m) => m.length !== 291);
  if (nonCanonical.length > 0) {
    const lens = [...new Set(nonCanonical.map((m) => m.length))];
    throw new Error(`Mensajes no canónicos (${nonCanonical.length}): longitudes ${lens.join(', ')}`);
  }
  return Buffer.concat(messages);
}

/**
 * Copia normalizada: reescribe el byte de device ID (índice 5 de cada mensaje de
 * 291 B) al valor canónico (p.ej. 0x7F como en los archivos de fábrica) para que el
 * SHA-256 del archivo sea directamente comparable con schemas/corpus-hashes.json.
 */
function normalizeDeviceId(syx, devId) {
  const buf = Buffer.from(syx);
  for (let i = 5; i < buf.length; i += 291) { buf[i] = devId & 0x7f; }
  return buf;
}

function sha256(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }
function hash0(h) { return String(h).slice(0, 12); }

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();
  const report = { tool: 'hw_bank_dump', banks: [], errors: [], ok: true };

  const outDir = opts.out || path.join(DEFAULT_OUT_ROOT, new Date().toISOString().slice(0, 10).replace(/-/g, ''));
  fs.mkdirSync(outDir, { recursive: true });

  const { input, output } = await openMidi();

  try {
    for (const bankLetter of opts.banks) {
      const bankIndex = bankLetter.charCodeAt(0) - 65;
      console.log(`📦 Capturando banco ${bankLetter} (${bankIndex})…`);
      const ordered = await captureBank({ input, output, devId: opts.devId, bankIndex, spacingMs: opts.spacingMs, perBankTimeoutMs: opts.perBankTimeoutMs, maxSweeps: opts.maxSweeps });
      const syx = assembleSyx(ordered);
      const filePath = path.join(outDir, `Synth Bank ${bankLetter}.syx`);
      fs.writeFileSync(filePath, syx);
      const entry = { bank: bankLetter, file: filePath, size: syx.length, sha256: sha256(syx), deviceId: opts.devId };
      if (opts.normalizeDev !== null) {
        const norm = normalizeDeviceId(syx, opts.normalizeDev);
        const normDir = path.join(outDir, 'normalized');
        fs.mkdirSync(normDir, { recursive: true });
        const normPath = path.join(normDir, `Synth Bank ${bankLetter}.syx`);
        fs.writeFileSync(normPath, norm);
        entry.normalizedFile = normPath;
        entry.normalizedSha256 = sha256(norm);
      }
      console.log(`  ✅ ${bankLetter}: 128/128 · ${syx.length} B · SHA-256 ${hash0(entry.sha256)}${entry.normalizedSha256 ? ' · norm ' + hash0(entry.normalizedSha256) : ''}`);
      report.banks.push(entry);
    }
  } finally {
    try { input.closePort(); } catch (e) { /* ignore */ }
    try { output.closePort(); } catch (e) { /* ignore */ }
  }

  // ── Paridad de payload (10..-3) vs corpus de fábrica ──
  // La comparación SIGNIFICATIVA: los archivos del corpus llevan bank byte 0x00 en la
  // cabecera de todos sus mensajes (quirk de exportación), por lo que el hash completo
  // solo coincide en el banco A. El payload (bytes 10..-3 de cada mensaje de 291 B) sí
  // es comparable byte a byte para los 8 bancos.
  if (opts.checkPayloads) {
    const corpusDir = path.resolve(__dirname, '..', 'resources', 'banks', 'Factory Banks V1.1.2');
    for (const b of report.banks) {
      const corpusPath = path.join(corpusDir, `Synth Bank ${b.bank}.syx`);
      if (!fs.existsSync(corpusPath)) { report.errors.push(`${b.bank}: corpus no encontrado (${corpusPath})`); report.ok = false; continue; }
      const corpusBuf = fs.readFileSync(corpusPath);
      const hwBuf = fs.readFileSync(b.file);
      const diffPrograms = [];
      for (let p = 0; p < 128; p++) {
        const a = corpusBuf.subarray(p * 291 + 10, (p + 1) * 291 - 3);
        const c = hwBuf.subarray(p * 291 + 10, (p + 1) * 291 - 3);
        let d = 0;
        for (let i = 0; i < a.length; i++) { if (a[i] !== c[i]) {d++;} }
        if (d > 0) { diffPrograms.push({ prog: p, diffBytes: d }); }
      }
      b.payloadDiffs = diffPrograms;
      const okPayload = diffPrograms.length === 0;
      console.log(`${okPayload ? '  ✅' : '  ⚠️'} payload ${b.bank}: ${128 - diffPrograms.length}/128 idénticos${diffPrograms.length ? ' -> ' + diffPrograms.map((x) => x.prog + ':' + x.diffBytes).join(' ') : ''}`);
      if (!okPayload) { report.ok = false; }
    }
  }

  // ── Comparación de hashes (referencia de regresión) ──
  if (opts.checkHashes) {
    let reference;
    try { reference = JSON.parse(fs.readFileSync(DEFAULT_HASHES, 'utf8')); }
    catch (e) { report.errors.push(`no se pudo leer ${DEFAULT_HASHES}: ${e.message}`); report.ok = false; }
    if (reference) {
      for (const b of report.banks) {
        const expected = reference.banks[b.bank];
        if (!expected) { report.errors.push(`${b.bank}: sin hash de referencia en corpus-hashes.json`); report.ok = false; continue; }
        // Si se normalizó el device ID, el hash comparable es el normalizado.
        const actualHash = b.normalizedSha256 || b.sha256;
        const match = actualHash === expected;
        const kind = b.normalizedSha256 ? 'norm' : 'raw';
        console.log(`${match ? '  ✅' : '  ⚠️'} hash ${b.bank} (${kind}): ${match ? 'coincide' : 'DIVERGE'} (${hash0(actualHash)}… vs corpus ${hash0(expected)}…)`);
        b.hashMatch = match;
        if (!match) { report.ok = false; }
      }
    }
  }

  console.log(`📁 Dumps guardados en: ${outDir}`);
  report.ok = report.ok && report.errors.length === 0 && report.banks.length > 0;
  if (opts.wantJson) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  }
  process.exitCode = report.ok ? 0 : 1;
}

main().catch((e) => { console.error('❌ ' + e.message); process.exit(1); });
