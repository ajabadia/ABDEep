// WebUI/js/calibration_lab_format.js — Formatting utilities for Calibration Lab
// Extracted from calibration_lab_utils.js

function escapeHtml(value) {
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

globalThis.escapeHtml = escapeHtml;
globalThis.fmt = fmt;
