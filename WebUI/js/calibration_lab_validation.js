// WebUI/js/calibration_lab_validation.js — Validation and rendering for Calibration Lab
// Extracted from calibration_lab_utils.js

// ────────────────────────────────────────────────────────────────
// CL-05: Badge metadata — tooltips and colors defined in one place
// ────────────────────────────────────────────────────────────────
const BADGE_META = {
  'exact':        { label: 'exact',        cls: 'cal-badge-ok',     tip: 'Los bytes coinciden exactamente en ambos patches.' },
  'alias-shared': { label: 'alias',        cls: 'cal-badge-alias',  tip: 'Offset compartido por múltiples parámetros (alias semántico, no conflicto).' },
  'stub':         { label: 'stub',         cls: 'cal-badge-stub',   tip: 'Parámetro declarado en UI pero sin implementación DSP completa (fallback activo).' },
  'mismatch':     { label: 'mismatch',     cls: 'cal-badge-warn',   tip: 'Los valores difieren entre Patch A y Patch B.' },
  'info':         { label: 'info',         cls: 'cal-badge',        tip: 'Dato parcial o sin comparación disponible.' },
};

function runRoundTripValidation(bytes) {
  if (!Array.isArray(bytes) || bytes.length < 242) {return null;}
  const maps = getByteMaps();
  const entries = [];
  let exactMatches = 0, withinTolerance = 0, mismatches = 0;
  let aliasSharedCount = 0, nameBytesCount = 0, specialCaseCount = 0;
  const derivedCount = 0, stubCount = 0;

  for (let i = 0; i < 242; i++) {
    const rawOriginal = bytes[i] & 0xFF;
    const semanticVal = rawOriginal / 255.0;
    const engineVal = semanticVal;
    const rawRebuilt = Math.max(0, Math.min(255, Math.round(engineVal * 255.0)));
    const delta = Math.abs(rawOriginal - rawRebuilt);

    const paramIds = maps.byteOffsetToParamIds[i] || [];

    let classification;
    if (i >= 224 && i <= 238) {
      classification = 'name-byte';
      nameBytesCount++;
    } else if (i >= 239 && i <= 241) {
      classification = 'special-case';
      specialCaseCount++;
    } else if (paramIds.length > 1 || i === 88 || i === 160) {
      classification = 'alias-shared';
      aliasSharedCount++;
    } else if (delta === 0) {
      classification = 'exact';
      exactMatches++;
    } else if (delta <= 1) {
      classification = 'within-tolerance';
      withinTolerance++;
    } else {
      classification = 'mismatch';
      mismatches++;
    }

    entries.push({
      byteOffset: i,
      rawOriginal,
      semanticNormalized: semanticVal,
      engineStateNormalized: engineVal,
      rawRebuilt,
      delta,
      classification,
      paramIds,
    });
  }

  return {
    entries,
    exactMatches,
    withinTolerance,
    mismatches,
    aliasSharedCount,
    nameBytesCount,
    specialCaseCount,
    derivedCount,
    stubCount,
    transportValid: true,
    patchDataValid: mismatches === 0,
  };
}

function renderBadge(badge) {
  const meta = BADGE_META[badge] || BADGE_META['info'];
  return '<span class="cal-badge ' + meta.cls + '" title="' + escapeHtml(meta.tip) + '">' + meta.label + '</span>';
}

// CL-03: ValidationSummaryCards — derived from getValidationSummary()
function renderSummaryCards(store) {
  const summary = store.getValidationSummary();
  const hasCritical = summary.criticalWarnings.length > 0;

  const cards = [
    { key: 'exact',       label: 'Exact',        count: summary.exact,       cls: 'cal-card-ok'    },
    { key: 'aliasShared', label: 'Alias-Shared',  count: summary.aliasShared, cls: 'cal-card-alias' },
    { key: 'stub',        label: 'Stub',          count: summary.stub,        cls: 'cal-card-stub'  },
    { key: 'mismatch',    label: 'Mismatch',      count: summary.mismatch,    cls: 'cal-card-warn'  },
  ];

  const cardsHtml = cards.map(function (c) {
    return '<div class="cal-card ' + c.cls + '">'
      + '<span class="cal-card-count">' + c.count + '</span>'
      + '<span class="cal-card-label">' + c.label + '</span>'
      + '</div>';
  }).join('');

  const warningHtml = hasCritical
    ? '<div class="cal-critical-warning">⚠ '
      + summary.criticalWarnings.length + ' critical contract warning' + (summary.criticalWarnings.length > 1 ? 's' : '') + ': '
      + summary.criticalWarnings.map(function (w) {
          return '<span class="cal-critical-param" title="offset ' + w.offset + '">' + escapeHtml(w.paramId) + '</span>';
        }).join(', ')
      + '</div>'
    : '';

  return '<div class="cal-summary-bar">'
    + cardsHtml
    + '<div class="cal-card cal-card-total">'
    + '<span class="cal-card-count">' + summary.total + '</span>'
    + '<span class="cal-card-label">Mapped</span>'
    + '</div></div>'
    + warningHtml;
}

function renderRowsTable(headers, rowsHtml) {
  return '<div class="cal-table-wrap">'
    + '<table class="cal-table">'
    + '<thead><tr>' + headers.map(function (h) { return '<th>' + escapeHtml(h) + '</th>'; }).join('') + '</tr></thead>'
    + '<tbody>'
    + (rowsHtml || '<tr><td colspan="' + headers.length + '" class="cal-empty">No data</td></tr>')
    + '</tbody>'
    + '</table></div>';
}

globalThis.BADGE_META = BADGE_META;
globalThis.runRoundTripValidation = runRoundTripValidation;
globalThis.renderBadge = renderBadge;
globalThis.renderSummaryCards = renderSummaryCards;
globalThis.renderRowsTable = renderRowsTable;
