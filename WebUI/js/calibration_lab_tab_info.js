// WebUI/js/calibration_lab_tab_info.js — Engine and Effective info tabs for CalibrationLabPage
// Extracted from calibration_lab_tabs.js

CalibrationLabPage.prototype.renderEngineTab = function (store) {
  const engineRows = store.getEngineRows();
  const voiceRows = store.getVoiceSummaryRows();

  const engineHtml = engineRows.map((row) => `
    <tr>
      <td>${escapeHtml(row.label)}</td>
      <td class="mono">${fmt(row.value)}</td>
    </tr>
  `).join('');

  const voiceHtml = voiceRows.map((row) => `
    <tr>
      <td>${escapeHtml(row.label)}</td>
      <td class="mono">${fmt(row.value)}</td>
    </tr>
  `).join('');

  return `
    <div class="cal-grid-2">
      <div>
        <h3 class="cal-section-title">Engine</h3>
        ${renderRowsTable(['Field', 'Value'], engineHtml)}
      </div>
      <div>
        <h3 class="cal-section-title">Selected Voice</h3>
        ${renderRowsTable(['Field', 'Value'], voiceHtml)}
      </div>
    </div>
  `;
};

CalibrationLabPage.prototype.renderEffectiveTab = function (store) {
  const state = store.getState();
  const rows = store.getEffectiveRowsScoped();

  const html = rows.map((row) => {
    const badge = row.contractVerified ? 'exact' : 'info';
    const rowKey = `eff-${row.key}`;
    const isSelected = state.selectedRowKey === rowKey;
    return `
      <tr class="cal-row cal-row-cursor${isSelected ? ' is-selected' : ''}" data-row-key="${rowKey}">
        <td>${escapeHtml(row.module)}</td>
        <td class="mono">${escapeHtml(row.key)}</td>
        <td>${escapeHtml(row.label)}</td>
        <td class="mono">${fmt(row.value)}</td>
        <td>${renderBadge(badge)}</td>
      </tr>
    `;
  }).join('');

  return `
    <div class="cal-note">
      Effective está limitado de forma intencional a campos confiables de VCF / HPF / drift.
    </div>
    ${renderRowsTable(['Module', 'Key', 'Label', 'Value', 'Contract'], html)}
  `;
};
