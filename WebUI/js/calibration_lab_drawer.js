// WebUI/js/calibration_lab_drawer.js — Param trace inspector drawer for CalibrationLabPage
// Extracted from calibration_lab_page.js (renderDrawer, bindDrawerEvents)

/* global CalibrationLabPage escapeHtml fmt getByteMaps renderBadge */

CalibrationLabPage.prototype.renderDrawer = function (store) {
  const state = store.getState();
  const rowKey = state.selectedRowKey;
  if (!rowKey) {return '';}

  // Extract row context based on rowKey prefix
  let paramId = null, offset = null, rawA = null, rawB = null, badge = 'info';

  if (rowKey.startsWith('sem-')) {
    const patchA = state.selectedPatchA;
    const patchB = state.selectedPatchB;
    const _maps = getByteMaps();
    const parts = rowKey.replace('sem-', '').split('-');
    paramId = parts.slice(0, -1).join('-') || parts[0];
    offset = parseInt(parts[parts.length - 1], 10);
    const bytesA = Array.isArray(patchA?.unpackedBytes) ? patchA.unpackedBytes : [];
    const bytesB = Array.isArray(patchB?.unpackedBytes) ? patchB.unpackedBytes : [];
    rawA = Number.isFinite(bytesA[offset]) ? bytesA[offset] : null;
    rawB = Number.isFinite(bytesB[offset]) ? bytesB[offset] : null;
    badge = store.classifyRow(paramId, rawA, rawB);
  } else if (rowKey.startsWith('raw-')) {
    offset = parseInt(rowKey.replace('raw-', ''), 10);
    const maps = getByteMaps();
    paramId = (maps.byteOffsetToParamIds[offset] || []).join(', ') || null;
    const patchA = state.selectedPatchA;
    const patchB = state.selectedPatchB;
    const bytesA = Array.isArray(patchA?.unpackedBytes) ? patchA.unpackedBytes : [];
    const bytesB = Array.isArray(patchB?.unpackedBytes) ? patchB.unpackedBytes : [];
    rawA = Number.isFinite(bytesA[offset]) ? bytesA[offset] : null;
    rawB = Number.isFinite(bytesB[offset]) ? bytesB[offset] : null;
    badge = rawA === rawB ? 'exact' : 'mismatch';
  } else if (rowKey.startsWith('eff-')) {
    const key = rowKey.replace('eff-', '');
    const effRows = store.getEffectiveRowsScoped();
    const found = effRows.find(r => r.key === key);
    if (found) { paramId = found.key; rawA = found.value; badge = 'exact'; }
  }

  const BADGE_TIPS = {
    'exact': 'Los bytes coinciden. No hay divergencia entre Patch A y Patch B.',
    'alias-shared': 'Este offset es compartido por múltiples parámetros (alias semántico). No es un conflicto.',
    'stub': 'Parámetro sin implementación DSP completa — el engine aplica un fallback (ej. vcfpolemode → 4-pole).',
    'mismatch': 'Los valores difieren entre Patch A y Patch B. Revisión recomendada.',
    'info': 'Dato parcial o sin comparación disponible.',
  };

  const trace = store.getParamTrace(paramId);

  function traceRow(label, value, suffix) {
    return `<div class="cal-drawer-row"><span class="cal-drawer-label">${label}</span>` +
      `<span class="cal-drawer-value mono">${fmt(value, 4)}${suffix || ''}</span></div>`;
  }

  function traceSection(title, html) {
    return `<div class="cal-drawer-section"><div class="cal-drawer-section-title">${title}</div>${html}</div>`;
  }

  let liveHtml = '';
  if (trace.liveValue !== null && trace.liveValue !== undefined) {
    const moduleTag = trace.module
      ? `<span class="cal-badge cal-badge-module">${escapeHtml(trace.module)}</span>`
      : '';
    liveHtml += traceRow('Live DSP Value', trace.liveValue, moduleTag);
    if (trace.derivedContributions.length > 0) {
      liveHtml += '<div class="cal-drawer-subsection">Contribuciones al cutoff:</div>';
      trace.derivedContributions.forEach(c => {
        liveHtml += traceRow(c.key, c.value, ` ${c.unit}`);
      });
    }
  }

  let engineHtml = '';
  if (trace.engineState && Object.keys(trace.engineState).length > 0) {
    const e = trace.engineState;
    engineHtml += traceRow('VCF OverSample', e.vcfOversample);
    engineHtml += traceRow('VCF Voicing', e.vcfVoicingMode);
    engineHtml += traceRow('Drift Amount', e.driftAmount);
    engineHtml += traceRow('Voice Mode', e.voiceMode);
    engineHtml += traceRow('Pitch Bend', e.pitchBend);
    engineHtml += traceRow('Mod Wheel', e.modWheel);
    engineHtml += traceRow('Peak Level', e.peakLevel);
  }

  return `
    <div class="cal-drawer">
      <div class="cal-drawer-header">
        <span class="cal-drawer-title">Param Trace <span class="cal-badge cal-badge-dsp">LIVE</span></span>
        <button class="cal-drawer-close" id="cal-drawer-close" type="button">✕</button>
      </div>
      <div class="cal-drawer-body">
        <div class="cal-drawer-row">
          <span class="cal-drawer-label">paramId</span>
          <span class="cal-drawer-value mono">${escapeHtml(String(paramId ?? '—'))}</span>
        </div>
        ${offset !== null ? `
        <div class="cal-drawer-row">
          <span class="cal-drawer-label">Byte offset</span>
          <span class="cal-drawer-value mono">${offset}</span>
        </div>` : ''}
        ${rawA !== null ? `
        <div class="cal-drawer-row">
          <span class="cal-drawer-label">Raw A</span>
          <span class="cal-drawer-value mono">${fmt(rawA, 0)}</span>
        </div>` : ''}
        ${rawB !== null ? `
        <div class="cal-drawer-row">
          <span class="cal-drawer-label">Raw B</span>
          <span class="cal-drawer-value mono">${fmt(rawB, 0)}</span>
        </div>` : ''}
        <div class="cal-drawer-row">
          <span class="cal-drawer-label">Badge</span>
          <span class="cal-drawer-value">${renderBadge(badge)}</span>
        </div>
        <div class="cal-drawer-note">
          ${escapeHtml(BADGE_TIPS[badge] || '')}
        </div>
        ${liveHtml ? traceSection('Live DSP Trace', liveHtml) : ''}
        ${engineHtml ? traceSection('Engine State', engineHtml) : ''}
      </div>
    </div>
  `;
};

CalibrationLabPage.prototype.bindDrawerEvents = function () {
  // Click en filas de tabla → seleccionar/deseleccionar fila
  this.panelEl.querySelectorAll('[data-row-key]').forEach(tr => {
    tr.addEventListener('click', () => {
      const key = tr.dataset.rowKey;
      const current = window.calibrationStore?.getState().selectedRowKey;
      window.calibrationStore?.setSelectedRow(current === key ? null : key);
    });
  });
  // Botón de cierre del drawer
  const closeBtn = this.panelEl.querySelector('#cal-drawer-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.calibrationStore?.setSelectedRow(null);
    });
  }
};
