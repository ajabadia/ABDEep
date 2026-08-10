/**
 * hwDumpValidate.test.js — Nivel 3b E-1 · validación OFFLINE de dumps commiteados
 *
 * Ejecuta `scripts/hw_bank_dump.js --validate-committed` como subproceso (SIN
 * hardware — el modo offline no abre MIDI) y verifica:
 *   - Exit 0 con los 8 bancos A-H consistentes vs manifest.json y el corpus.
 *   - Reporte --json con la estructura esperada (banks[8], ok:true, mode).
 *   - Invariante de divergencia conocida: B/1 registrada en el manifest
 *     (payloadDiffPrograms [{prog:1, diffBytes:2}]) — known_exception.
 *   - Banco manipulado (hash diverge) → exit 1 con ::error::hw-dump-validate.
 *
 * Los tests dependen de los dumps commiteados y del corpus local — se saltan si
 * no existen.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const DUMPS_DIR = path.join(ROOT, 'resources', 'hardware_dumps', '2026-08-10');
const BANKS_DIR = path.join(ROOT, 'resources', 'banks', 'Factory Banks V1.1.2');
const hasDumps = fs.existsSync(path.join(DUMPS_DIR, 'manifest.json'));
const hasCorpus = fs.existsSync(BANKS_DIR);
const SCRIPT = path.join(ROOT, 'scripts', 'hw_bank_dump.js');

function runScript(args) {
  let stdout = '';
  let stderr = '';
  let status = 0;
  try {
    stdout = execFileSync(process.execPath, [SCRIPT, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    status = e.status ?? 1;
    stdout = String(e.stdout || '');
    stderr = String(e.stderr || '');
  }
  return { status, stdout, stderr };
}

function extractJson(stdout) {
  const marker = '---JSON---';
  const idx = stdout.indexOf(marker);
  if (idx === -1) { return null; }
  return JSON.parse(stdout.slice(idx + marker.length).trim());
}

describe.skipIf(!hasDumps || !hasCorpus)('hw_bank_dump.js --validate-committed (offline, sin hardware)', () => {
  it('exit 0: los 8 bancos A-H consistentes vs manifest.json y el corpus', () => {
    const { status, stdout } = runScript(['--validate-committed', '--out', DUMPS_DIR]);
    expect(status, stdout).toBe(0);
    for (const b of 'ABCDEFGH') {
      expect(stdout).toContain(`✅ ${b}: 37248 B`);
    }
    expect(stdout).toContain('Validación de dumps commiteados');
  });

  it('--json: reporte con banks[8], ok:true, mode validate-committed', () => {
    const { status, stdout } = runScript(['--validate-committed', '--out', DUMPS_DIR, '--json']);
    expect(status).toBe(0);
    const r = extractJson(stdout);
    expect(r).not.toBeNull();
    expect(r.mode).toBe('validate-committed');
    expect(r.banks).toHaveLength(8);
    expect(r.ok).toBe(true);
    for (const b of r.banks) {
      expect(b.size).toBe(37248);
      expect(b.sizeOk).toBe(true);
      expect(b.hashMatch).toBe(true);
      expect(b.payloadConsistent).toBe(true);
      expect(b.consistent).toBe(true);
    }
  });

  it('invariante de divergencia conocida: B/1 registrada como known_exception (2 bytes)', () => {
    const { status, stdout } = runScript(['--validate-committed', '--out', DUMPS_DIR, '--json']);
    expect(status).toBe(0);
    const r = extractJson(stdout);
    const bankB = r.banks.find((b) => b.bank === 'B');
    expect(bankB.payloadDiffPrograms).toEqual([{ prog: 1, diffBytes: 2 }]);
    const manifest = JSON.parse(fs.readFileSync(path.join(DUMPS_DIR, 'manifest.json'), 'utf8'));
    expect(manifest.banks.B.payloadDiffPrograms).toEqual([{ prog: 1, diffBytes: 2 }]);
    expect(manifest.resumen.divergencias[0].clasificacion).toBe('known_exception');
  });

  it('auto-detección del directorio más reciente (sin --out) encuentra los dumps', () => {
    const { status, stdout } = runScript(['--validate-committed']);
    expect(status, stdout).toBe(0);
    expect(stdout).toContain('✅ H: 37248 B');
  });

  it('banco manipulado (hash diverge) → exit 1 con ::error::hw-dump-validate', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hwval-'));
    try {
      fs.cpSync(DUMPS_DIR, tmp, { recursive: true });
      // Tocar un byte del payload del banco A (offset 100, dentro de 10..-3).
      const fd = fs.openSync(path.join(tmp, 'Synth Bank A.syx'), 'r+');
      fs.writeSync(fd, Buffer.from([0x7f]), 0, 1, 100);
      fs.closeSync(fd);
      const { status, stderr } = runScript(['--validate-committed', '--out', tmp]);
      expect(status).toBe(1);
      expect(stderr).toContain('::error::hw-dump-validate');
      expect(stderr).toContain('A: inconsistencia');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('manifest.json ausente → exit 1 (no valida contra nada)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hwval-'));
    try {
      fs.cpSync(DUMPS_DIR, tmp, { recursive: true });
      fs.rmSync(path.join(tmp, 'manifest.json'));
      const { status, stderr } = runScript(['--validate-committed', '--out', tmp]);
      expect(status).toBe(1);
      expect(stderr).toContain('::error::hw-dump-validate');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
