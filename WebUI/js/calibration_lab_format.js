// WebUI/js/calibration_lab_format.js — Formatting utilities for Calibration Lab
// Extracted from calibration_lab_utils.js

// Consolidación (prep Fase 6): el escaper canónico vive en dom_sanitize.js (cargado primero
// en index.html). Este módulo DELEGA en él; el fallback solo cubre la carga standalone
// (tests/Node) sin dom_sanitize.js. Comportamiento unificado: null/undefined → ''.
// NOTA IMPORTANTE: la función local se llama `escapeHtmlCal` (NO `escapeHtml`) porque
// en scripts clásicos una `function escapeHtml` top-level crea un binding global HOISTEADO
// que sobrescribe el canónico de dom_sanitize.js ANTES de capturar `_canonicalEscapeHtmlCal`,
// provocando recursión infinita (stack overflow).
const _canonicalEscapeHtmlCal = (typeof globalThis !== 'undefined' && typeof globalThis.escapeHtml === 'function')
    ? globalThis.escapeHtml
    : null;

function escapeHtmlCal(value) {
  if (_canonicalEscapeHtmlCal) {return _canonicalEscapeHtmlCal(value);}
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function fmt(value, digits) {
  if (digits === undefined) { digits = 3; }
  if (value === null || value === undefined) {return '—';}
  if (typeof value === 'boolean') {return value ? 'ON' : 'OFF';}
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {return '—';}
    return Number.isInteger(value) ? String(value) : value.toFixed(digits);
  }
  return String(value);
}

// Exponer escapeHtml SOLO si el canónico (dom_sanitize.js) aún no lo definió:
// en el navegador dom_sanitize carga primero y esta línea no lo clobberea; en
// entornos Node/standalone sin dom_sanitize provee el fallback con mismo comportamiento.
if (typeof globalThis !== 'undefined' && typeof globalThis.escapeHtml !== 'function') {
    globalThis.escapeHtml = escapeHtmlCal;
}
globalThis.fmt = fmt;
