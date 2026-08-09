// WebUI/js/calibration_lab_tab_live.js — Live Validation Dashboard tab for CalibrationLabPage
// Extracted from calibration_lab_tabs.js

CalibrationLabPage.prototype.renderLiveValidationTab = function (store) {
  const state = store.getState();
  const report = state.complianceReport;
  const active = !!state.liveScanActive;

  let headerHtml = '';
  let bodyHtml = '';

  const buttonLabel = active
    ? '<span class="cal-blink cal-live-blink-dot"></span>Stop Scan'
    : 'Start Live Scan';

  if (!report) {
    bodyHtml = `
      <div class="cal-live-empty">
        No compliance data yet. Click <strong>Start Live Scan</strong> to begin monitoring.
      </div>
    `;
  } else {
    const allPassed = report.compliant;
    const statusColor = allPassed ? 'var(--accent-green,#65d36e)' : 'var(--accent-red,#e74c3c)';
    const statusText = allPassed ? 'ALL COMPLIANT' : `${report.totalCompliant}/${report.voiceResults.length} COMPLIANT`;

    headerHtml = `
      <div class="cal-live-header">
        <span class="cal-live-status" style="--cal-live-status-color: ${statusColor};">${statusText}</span>
        <span class="cal-live-header-meta">Timestamp: <strong>${escapeHtml(state.lastUpdatedAt || '—')}</strong></span>
      </div>
    `;

    const headers = ['Voice', 'Note', 'Vel', 'Status', 'OSC1 Pitch', 'OSC2 Pitch', 'VCF Cutoff', 'VCF Res', 'Env Time', 'Failed'];
    const rowsHtml = report.voiceResults.map(vr => {
      const statusColor = vr.passed ? 'var(--accent-green,#65d36e)' : 'var(--accent-red,#e74c3c)';
      const statusIcon = vr.passed ? '&#10003;' : '&#10007;';
      const rowCls = vr.passed ? '' : 'is-changed';

      function checkValue(paramName) {
        const c = vr.checks.find(ch => ch.param === paramName);
        if (!c) {return '<span class="mono text-faint">—</span>';}
        const color = c.passed ? 'var(--accent-green,#65d36e)' : 'var(--accent-red,#e74c3c)';
        return `<span class="mono" style="--cal-check-color: ${color};">${fmt(c.value, 4)} <span class="cal-live-check-value">(${fmt(c.specLimit, 4)}${c.unit})</span></span>`;
      }

      return `
        <tr class="${rowCls}">
          <td class="mono">${vr.voiceIndex + 1}</td>
          <td class="mono">${vr.midiNote ?? '—'}</td>
          <td class="mono">${fmt(vr.velocity)}</td>
          <td class="cal-live-cell" style="--cal-live-status-color: ${statusColor};">${statusIcon}</td>
          <td>${checkValue('driftOsc1Pitch')}</td>
          <td>${checkValue('driftOsc2Pitch')}</td>
          <td>${checkValue('driftVcfCutoff')}</td>
          <td>${checkValue('driftVcfResonance')}</td>
          <td>${checkValue('driftEnvTime')}</td>
          <td class="mono cal-live-fail-count" style="--cal-fail-count-color: ${vr.failedCount > 0 ? 'var(--accent-red)' : 'var(--text-faint)'}">${vr.failedCount}</td>
        </tr>
      `;
    }).join('');

    const tableHtml = renderRowsTable(headers, rowsHtml);
    bodyHtml = `
      <div class="cal-live-table-wrap">
        ${tableHtml}
      </div>
    `;
  }

  return `
    <div class="cal-live-tab">
      <h4 class="cal-live-title">Live Validation Dashboard</h4>
      <p class="cal-live-desc">
        Real-time compliance check: compares each voice's drift parameters against CalibrationSpec tolerances.
      </p>

      <div class="cal-live-actions">
        <button id="lv-toggle-scan" class="manager-btn btn-solid" type="button">${buttonLabel}</button>
      </div>

      ${headerHtml}
      ${bodyHtml}
    </div>
  `;
};

CalibrationLabPage.prototype.bindLiveValidationEvents = function () {
  const toggleBtn = this.querySelector('#lv-toggle-scan');
  if (!toggleBtn) {return;}

  const store = window.calibrationStore;
  if (!store) {return;}

  toggleBtn.onclick = async () => {
    const state = store.getState();
    if (state.liveScanActive) {
      store.setLiveScanActive(false);
    } else {
      const bridge = window.dualMidiBridge;
      if (bridge && typeof bridge.getCalibrationSpec === 'function') {
        try {
          const spec = await bridge.getCalibrationSpec();
          if (spec && spec.specJson) {
            store.setCalibrationSpec(spec.specJson);
          }
        } catch (e) {
          // use defaults
        }
      }
      store.setLiveScanActive(true);
    }
  };
};
