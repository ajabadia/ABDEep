#!/usr/bin/env node
/**
 * security_scan.js — Audit estático XSS (plan v3.2 §4.1) sobre WebUI/js COMPLETO.
 *
 * Fase 3 migró 13 archivos a escapeHtml()/textContent; este script aplica la MISMA
 * lógica de detección del audit de domSanitize.test.js pero sobre TODOS los .js de
 * WebUI/js — no solo los migrados. Es la fuente de verdad única compartida:
 *
 *   - CLI  : node scripts/security_scan.js [--json] [--dir <path>]
 *            exit 0 = sin violaciones · exit 1 = hallazgos
 *   - Módulo: require('scripts/security_scan.js') → { auditSource, auditFile, scanDir }
 *            (reutilizado por WebUI/tests/domSanitize.test.js)
 *
 * Política (§4.1):
 *   - sinks dinámicos NO confiables → prohibido sin escape (innerHTML =, +=,
 *     insertAdjacentHTML, outerHTML, DOMParser).
 *   - valores dinámicos simples → textContent (seguro, no parsea HTML).
 *   - HTML estructurado con datos dinámicos → escapeHtml() obligatorio.
 *
 * El audit es por LÍNEA de sink: solo se inspeccionan las líneas que escriben en
 * innerHTML / insertAdjacentHTML / outerHTML / lcdSafeUpdate. Las asignaciones a
 * innerText/textContent se ignoran (no parsean HTML).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_DIR = path.join(ROOT, 'WebUI', 'js');

// Patrones de datos externos que NO deben aparecer interpolados en sinks sin escape.
// Mismos patrones que domSanitize.test.js (Fase 3 §4.1): nombre de patch/banco/preset,
// newName, searchTerm, saveAs, clipboard… — SIEMPRE deben pasar por escapeHtml().
const FORBIDDEN_INTERPOLATIONS = [
  /\$\{patch\.name/,
  /\$\{patchRef\.name/,
  /\+ patch\.name\.toUpperCase/,
  /\+ patchRef\.name\.toUpperCase/,
  /\$\{p\.name\}/,
  /\$\{newName/,
  /\$\{bankName\}/,
  /\$\{window\.currentActiveBank\}/,
  /\$\{saveAsSelectedBank\}/,
  /\+ String\(p\.name\)\.replace/,
  // FX preset names (localStorage) — hallazgos reales del scan sobre todo WebUI/js
  /\+ preset\.name/,
  /\+ presetData\.name/,
  /\$\{preset\.name/,
  /\$\{presetData\.name/,
];

const SINK_RE = /(innerHTML|insertAdjacentHTML|outerHTML|lcdSafeUpdate)/;
const SAFE_ASSIGN_RE = /innerText|textContent/;
// Líneas que ya escapan (escapeHtml/_escapeHtml) se consideran seguras: los patrones
// genéricos (p.ej. `+ preset.name`) matchean tanto usos escapados como sin escapar,
// así que una línea que invoca el escaper se descarta (mismo criterio que SAFE_ASSIGN_RE).
const ESCAPED_LINE_RE = /escapeHtml|_escapeHtml/;

/**
 * Audita el contenido de un archivo JS (string).
 * @returns {Array<{line:number, code:string, pattern:string, text:string}>}
 */
function auditSource(src) {
  const violations = [];
  const lines = String(src).split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!SINK_RE.test(line)) {continue;}              // no es línea de sink
    if (SAFE_ASSIGN_RE.test(line)) {continue;}        // asignación segura (textContent/innerText)
    if (ESCAPED_LINE_RE.test(line)) {continue;}       // línea que ya llama al escaper → segura
    for (const pattern of FORBIDDEN_INTERPOLATIONS) {
      if (pattern.test(line)) {
        violations.push({ line: i + 1, code: 'UNESCAPED_DATA_IN_SINK', pattern: String(pattern), text: line.trim() });
        break; // una violación por línea (primera que matchea)
      }
    }
  }
  return violations;
}

/**
 * Audita un archivo y anota su nombre.
 * @returns {Array<{file:string, line:number, code:string, pattern:string, text:string}>}
 */
function auditFile(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const base = path.basename(filePath);
  return auditSource(src).map((v) => ({ file: base, ...v }));
}

/**
 * Escanea todos los .js de un directorio (no recursivo — WebUI/js es plano).
 * @returns {Array} violaciones de todos los archivos
 */
function scanDir(dir = DEFAULT_DIR) {
  const results = [];
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch (err) {
    console.error(`[security-scan] No se pudo leer el directorio ${dir}: ${err.message}`);
    process.exit(2);
  }
  for (const entry of entries) {
    const full = path.join(dir, entry);
    if (!entry.endsWith('.js')) {continue;}
    if (!fs.statSync(full).isFile()) {continue;}
    results.push(...auditFile(full));
  }
  return results;
}

// ── CLI ──────────────────────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2);
  const useJson = args.includes('--json');
  const dirArgIdx = args.indexOf('--dir');
  const dir = dirArgIdx !== -1 && args[dirArgIdx + 1]
    ? path.resolve(args[dirArgIdx + 1])
    : DEFAULT_DIR;

  const violations = scanDir(dir);

  if (useJson) {
    console.log(JSON.stringify({ scannedDir: dir, filesChecked: fs.readdirSync(dir).filter((f) => f.endsWith('.js')).length, violations }, null, 2));
  } else if (violations.length === 0) {
    console.log(`[security-scan] OK — sin datos externos sin escapar en sinks (${dir})`);
  } else {
    console.log(`[security-scan] ${violations.length} violación(es) encontradas en ${dir}:`);
    for (const v of violations) {
      console.log(`  ${v.file}:${v.line} [${v.code}] ${v.pattern}`);
      console.log(`      → ${v.text}`);
    }
  }
  process.exit(violations.length === 0 ? 0 : 1);
}

module.exports = { FORBIDDEN_INTERPOLATIONS, SINK_RE, SAFE_ASSIGN_RE, ESCAPED_LINE_RE, auditSource, auditFile, scanDir };
