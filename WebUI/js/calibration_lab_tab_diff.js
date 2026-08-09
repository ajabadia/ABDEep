// WebUI/js/calibration_lab_tab_diff.js — PatchDiff, Raw, Semantic comparison tabs for CalibrationLabPage
// Extracted from calibration_lab_tabs.js

CalibrationLabPage.prototype.renderPatchDiffTab = function (store) {
  const state = store.getState();
  let rows = collectPatchDiffRows(store);

  if (state.filters.showOnlyAliases) {
    rows = rows.filter(r => r.isAlias);
  }

  if (state.filters.showOnlyDifferences) {
    rows = rows.filter(r => r.changed);
  }

  const search = (state.filters.search || '').trim().toLowerCase();
  if (search) {
    rows = rows.filter(r =>
      String(r.offset).includes(search) ||
      r.region.toLowerCase().includes(search) ||
      r.paramIds.some(p => p.toLowerCase().includes(search))
    );
  }

  const html = rows.map(row => {
    const rowKey = 'pd-' + row.offset;
    const isSelected = state.selectedRowKey === rowKey;
    return `
      <tr class="cal-row cal-row-cursor${row.changed ? ' is-changed' : ''}${isSelected ? ' is-selected' : ''}" data-row-key="${rowKey}">
        <td><span class="cal-badge cal-badge-region">${escapeHtml(row.region)}</span></td>
        <td class="mono">${row.offset}</td>
        <td class="mono cal-rt-table-param">${escapeHtml(row.paramIds.join(', ') || '—')}</td>
        <td class="mono${row.changed ? ' is-delta' : ''}">${fmt(row.rawA, 0)}</td>
        <td class="mono${row.changed ? ' is-delta' : ''}">${fmt(row.rawB, 0)}</td>
        <td class="mono${row.delta !== 0 ? ' is-delta' : ''}">${row.delta !== null ? (row.delta > 0 ? '+' : '') + row.delta : '—'}</td>
        <td class="cal-patchdiff-semantic">${escapeHtml(row.semanticA)}</td>
        <td class="cal-patchdiff-semantic">${escapeHtml(row.semanticB)}</td>
        <td>${renderBadge(row.badge)}</td>
      </tr>
    `;
  }).join('');

  const headers = ['Region', 'Offset', 'Param IDs', 'Raw A', 'Raw B', 'Δ', 'Semantic A', 'Semantic B', 'Badge'];
  return `
    <div class="cal-note">
      Unified byte + semantic diff — sorted by offset.
    </div>
    ${renderRowsTable(headers, html)}
  `;
};

CalibrationLabPage.prototype.renderRawTab = function (store) {
  const state = store.getState();
  const rows = this.applySharedFilters(
    collectRawRows(store),
    (row) => `${row.offset} ${row.paramIds.join(' ')} ${row.rawA} ${row.rawB}`
  );

  const html = rows.map((row) => {
    const firstParam = row.paramIds[0] || null;
    const badge = firstParam
      ? store.classifyRow(firstParam, row.rawA, row.rawB)
      : (row.changed ? 'mismatch' : 'exact');
    const rowKey = `raw-${row.offset}`;
    const isSelected = state.selectedRowKey === rowKey;
    return `
      <tr class="cal-row cal-row-cursor${row.changed ? ' is-changed' : ''}${isSelected ? ' is-selected' : ''}" data-row-key="${rowKey}">
        <td class="mono">${row.offset}</td>
        <td class="mono">${escapeHtml(row.paramIds.join(', ') || '—')}</td>
        <td class="mono">${fmt(row.rawA, 0)}</td>
        <td class="mono">${fmt(row.rawB, 0)}</td>
        <td>${renderBadge(badge)}</td>
      </tr>
    `;
  }).join('');

  return renderRowsTable(['Offset', 'Param IDs', 'Patch A', 'Patch B', 'Badge'], html);
};

CalibrationLabPage.prototype.renderSemanticTab = function (store) {
  const CRITICAL = new Set(['vcfcutoff','vcfresonance','vcfenvdepth','hpfcutoff','vcfpolemode','voicedrift','oscdrift']);
  const state = store.getState();

  let rows = collectSemanticRows(store);

  if (state.filters.showOnlyCritical) {
    rows = rows.filter((row) => CRITICAL.has(row.paramId));
  }

  rows = this.applySharedFilters(
    rows,
    (row) => `${row.paramId} ${row.offset} ${row.cc ?? ''} ${row.rawA} ${row.rawB}`
  );

  const html = rows.map((row) => {
    const rowKey = `sem-${row.paramId}-${row.offset}`;
    const isSelected = state.selectedRowKey === rowKey;
    return `
      <tr class="cal-row cal-row-cursor${row.changed ? ' is-changed' : ''}${isSelected ? ' is-selected' : ''}${CRITICAL.has(row.paramId) ? ' is-critical' : ''}" data-row-key="${rowKey}">
        <td class="mono">${escapeHtml(row.paramId)}</td>
        <td class="mono">${fmt(row.offset, 0)}</td>
        <td class="mono">${row.cc === null ? '—' : fmt(row.cc, 0)}</td>
        <td class="mono">${fmt(row.rawA, 0)}</td>
        <td class="mono">${fmt(row.rawB, 0)}</td>
        <td>${renderBadge(row.badge)}</td>
      </tr>
    `;
  }).join('');

  return renderRowsTable(['Param', 'Offset', 'CC', 'Patch A', 'Patch B', 'Badge'], html);
};
