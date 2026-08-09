// WebUI/js/calibration_lab_tab_roundtrip.js — Round-Trip Validator tab for CalibrationLabPage
// Extracted from calibration_lab_tabs.js

CalibrationLabPage.prototype.renderRoundTripTab = function (store) {
  const state = store.getState();
  const report = this._roundTripReport || null;
  const hideExact = !!this._roundTripHideExact;

  let summaryHtml = '';
  let tableHtml = '';

  if (report) {
    const passed = report.mismatches === 0;
    const _cls = passed ? 'exact' : 'mismatch';
    const statusText = passed ? 'PASS' : 'FAIL';
    const statusColor = passed ? 'var(--accent-green,#65d36e)' : 'var(--accent-red,#e74c3c)';

    summaryHtml = `
      <div class="cal-rt-summary">
        <span class="cal-rt-status" style="--cal-rt-status-color: ${statusColor};">${statusText}</span>
        <span class="cal-rt-summary-count">Exact: <strong>${report.exactMatches}</strong></span>
        <span class="cal-rt-summary-count">Tolerated: <strong>${report.withinTolerance}</strong></span>
        <span class="cal-rt-summary-count">Mismatch: <strong class="cal-mismatch-count" style="--cal-mismatch-color: ${report.mismatches > 0 ? '#e74c3c' : 'inherit'};">${report.mismatches}</strong></span>
        <span class="cal-rt-summary-count">Alias: <strong>${report.aliasSharedCount}</strong></span>
        <span class="cal-rt-summary-count">Name: <strong>${report.nameBytesCount}</strong></span>
        <span class="cal-rt-summary-count">Special: <strong>${report.specialCaseCount}</strong></span>
      </div>
    `;

    let filtered = report.entries;
    if (hideExact) {
      filtered = filtered.filter(e => e.classification !== 'exact');
    }

    const headers = ['Offset', 'Param IDs', 'Original Raw', 'Normalized', 'Rebuilt Raw', 'Delta', 'Classification'];

    const rowsHtml = filtered.map(e => {
      const clsMap = {
        'exact': '',
        'within-tolerance': 'is-delta',
        'alias-shared': '',
        'name-byte': '',
        'special-case': '',
        'mismatch': 'is-changed',
      };
      const rowCls = clsMap[e.classification] || '';

      const classificationColor = {
        'exact': 'var(--accent-green,#65d36e)',
        'within-tolerance': 'var(--accent-yellow,#f1c40f)',
        'alias-shared': 'var(--accent-teal,#1abc9c)',
        'name-byte': 'var(--accent-blue,#6ec7ff)',
        'special-case': 'var(--text-faint,#555)',
        'mismatch': 'var(--accent-red,#e74c3c)',
      };

      return `
        <tr class="${rowCls}">
          <td class="mono">${e.byteOffset}</td>
          <td class="mono cal-rt-table-param">${escapeHtml(e.paramIds.join(', ') || '—')}</td>
          <td class="mono">${e.rawOriginal}</td>
          <td class="mono">${fmt(e.semanticNormalized, 4)}</td>
          <td class="mono">${e.rawRebuilt}</td>
          <td class="mono${e.delta > 0 ? ' is-delta' : ''}">${e.delta}</td>
          <td><span class="cal-rt-classification${e.classification === 'mismatch' ? ' mismatch' : ''}" style="--cal-rt-class-color: ${classificationColor[e.classification] || 'inherit'};">${e.classification}</span></td>
        </tr>
      `;
    }).join('');

    tableHtml = renderRowsTable(headers, rowsHtml);
  }

  const patchAName = escapeHtml(state.selectedPatchA?.name || 'none');

  return `
    <div class="cal-roundtrip-tab">
      <h4 class="cal-rt-title">3-Layer Round-Trip Validator</h4>
      <p class="cal-rt-desc">
        Validates that raw bytes → semantic normalized → engine state → rebuilt raw bytes produce an identical or tolerable result.
      </p>

      <div class="cal-rt-actions">
        <button id="rt-load-a" class="manager-btn" type="button">Load from Patch A</button>
        <button id="rt-load-b" class="manager-btn" type="button">Load from Patch B</button>
        <button id="rt-run" class="manager-btn btn-solid" type="button">Run RoundTrip</button>
        <label class="cal-inline ml-8">
          <input id="rt-hide-exact" type="checkbox" ${hideExact ? 'checked' : ''} />
          <span>Hide exact matches</span>
        </label>
      </div>

      <div class="cal-rt-source">
        Source patch: <strong class="cal-rt-source-name">${patchAName}</strong>
        <span id="rt-source-info" class="cal-rt-source-info"></span>
      </div>

      ${summaryHtml}
      ${tableHtml}
    </div>
  `;
};

CalibrationLabPage.prototype.bindRoundTripEvents = function () {
  const loadA = this.querySelector('#rt-load-a');
  const loadB = this.querySelector('#rt-load-b');
  const runBtn = this.querySelector('#rt-run');
  const hideExactCb = this.querySelector('#rt-hide-exact');
  const sourceInfo = this.querySelector('#rt-source-info');

  const loadFromPatch = (side) => {
    const store = window.calibrationStore;
    if (!store) {return;}
    const state = store.getState();
    const patch = side === 'A' ? state.selectedPatchA : state.selectedPatchB;
    if (!patch || !Array.isArray(patch.unpackedBytes) || patch.unpackedBytes.length < 242) {
      if (sourceInfo) {sourceInfo.textContent = `Patch ${side} has no valid unpackedBytes`;}
      return;
    }
    this._roundTripBytes = patch.unpackedBytes.slice(0, 242);
    if (sourceInfo) {sourceInfo.textContent = `Loaded ${patch.name || 'unnamed'} (${side}) — ${this._roundTripBytes.length} bytes`;}
    this._roundTripReport = null;
    this.render();
  };

  if (loadA) {loadA.onclick = () => loadFromPatch('A');}
  if (loadB) {loadB.onclick = () => loadFromPatch('B');}

  if (runBtn) {
    runBtn.onclick = async () => {
      if (!this._roundTripBytes || this._roundTripBytes.length < 242) {
        if (sourceInfo) {sourceInfo.textContent = 'Load a patch first';}
        return;
      }
      const bridge = window.dualMidiBridge;
      let report;
      if (bridge && typeof bridge.runRoundTripValidator === 'function') {
        const raw = await bridge.runRoundTripValidator(JSON.stringify(this._roundTripBytes));
        if (raw) {
          report = raw;
        }
      }
      if (!report) {
        report = runRoundTripValidation(this._roundTripBytes);
      }
      this._roundTripReport = report;
      this.render();
    };
  }

  if (hideExactCb) {
    hideExactCb.onchange = () => {
      this._roundTripHideExact = !!hideExactCb.checked;
      this.render();
    };
  }
};
