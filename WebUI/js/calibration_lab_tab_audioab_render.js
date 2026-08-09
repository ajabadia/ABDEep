/**
 * @purpose Audio A/B Validation tab renderer: generates HTML for the Audio A/B
 *          calibration tab including inputs, buttons, status, and comparison verdict.
 * @classification Module/Calibration/Tab
 * @dependencies calibration_lab_page.js (defines CalibrationLabPage)
 */

CalibrationLabPage.prototype.renderAudioABTab = function (store) {
  const state = store.getState();
  const patchName = (state.selectedPatchA && state.selectedPatchA.name) || 'Active Patch';

  this._audioStatus = this._audioStatus || 'idle';
  this._audioLogs = this._audioLogs || [];
  this._comparisonResult = this._comparisonResult || null;

  const formatLogs = function () {
    return this._audioLogs.map(function (l) { return '[' + l.time + '] ' + l.msg; }).join('\n');
  }.bind(this);

  let comparisonHtml = '';
  if (this._comparisonResult) {
    const comp = this._comparisonResult;
    const isErr = comp.status === 'error';
    const level = (comp.verdict && comp.verdict.level) || 'unknown';
    const levelColor = level === 'pass' ? '#2ecc71' : level === 'warn' ? '#f1c40f' : '#e74c3c';

    if (isErr) {
      comparisonHtml = '<div class="cal-audio-error">' +
        '<div class="cal-audio-error-title">COMPARISON ERROR</div>' +
        '<div class="cal-audio-error-reason">Reason: ' + comp.reason_code + '</div>' +
        '<div class="cal-audio-error-list">' +
        (comp.errors || []).map(function (e) { return '\u2022 ' + e; }).join('<br/>') +
        '</div></div>';
    } else {
      comparisonHtml = _buildComparisonVerdictHtml(comp, level, levelColor);
    }
  }

  return [
    '<div class="cal-audio-tab">',
    '  <h4 class="cal-audio-title">Audio A/B Validation (Fase 5C)</h4>',
    '  <p class="cal-audio-desc">Esta pestaña permite disparar la calibración acústica nativa. Configura los parámetros del tono de prueba, inicia el grabador para capturar la entrada física del hardware y renderiza el motor software de referencia.</p>',
    '  <div class="cal-audio-inputs">',
    '    <div class="cal-audio-input-group">',
    '      <label class="cal-audio-label">Midi Note</label>',
    '      <input id="audio-note-input" class="modal-input cal-input-full" type="number" value="48" min="0" max="127" />',
    '    </div>',
    '    <div class="cal-audio-input-group">',
    '      <label class="cal-audio-label">Velocity</label>',
    '      <input id="audio-vel-input" class="modal-input cal-input-full" type="number" value="100" min="1" max="127" />',
    '    </div>',
    '    <div class="cal-audio-input-group">',
    '      <label class="cal-audio-label">Duration (Sec)</label>',
    '      <input id="audio-dur-input" class="modal-input cal-input-full" type="number" value="2.0" step="0.5" min="0.5" />',
    '    </div>',
    '  </div>',
    '  <div class="cal-audio-buttons">',
    '    <button id="audio-btn-start" class="manager-btn btn-solid" type="button" ' + (this._audioStatus === 'running' ? 'disabled' : '') + '>1. Start Capturing Hardware</button>',
    '    <button id="audio-btn-render" class="manager-btn" type="button" ' + (this._audioStatus !== 'running' ? 'disabled' : '') + '>2. Render Software Reference</button>',
    '    <button id="audio-btn-finish" class="manager-btn" type="button" ' + (this._audioStatus !== 'running' ? 'disabled' : '') + '>3. Finish &amp; Export Run</button>',
    '    <button id="audio-btn-compare" class="manager-btn btn-accent" type="button" ' + ((this._audioStatus !== 'finished' && this._audioStatus !== 'compared' && this._audioStatus !== 'failed' && this._audioStatus !== 'passed') ? 'disabled' : '') + '>4. Run Acoustical Comparison</button>',
    '    <button id="audio-btn-abort" class="manager-btn ' + (this._audioStatus === 'running' ? '' : 'hidden') + '" type="button" ' + (this._audioStatus !== 'running' ? 'disabled' : '') + '>Abort</button>',
    '  </div>',
    '  <div class="cal-audio-status-col">',
    '    <div class="cal-audio-status-row">',
    '      <span>Current Status: <strong class="text-accent text-uppercase">' + this._audioStatus + '</strong></span>',
    '      <span>Target Patch: <strong class="text-primary">' + escapeHtml(patchName) + '</strong></span>',
    '    </div>',
    comparisonHtml,
    '    <label class="cal-audio-logs-label">Console Logs / Export manifest details</label>',
    '    <textarea readonly class="modal-input cal-audio-logs" rows="7">' + (escapeHtml(formatLogs()) || 'Idle - Awaiting run') + '</textarea>',
    '  </div>',
    '</div>'
  ].join('\n');
};

/** @private Builds comparison verdict HTML block */
function _buildComparisonVerdictHtml(comp, level, levelColor) {
  let html = '<div class="cal-audio-verdict">';
  html += '<div class="cal-audio-verdict-header">';
  html += '<span class="cal-audio-verdict-title">Acoustical Verdict</span>';
  html += '<span class="cal-audio-verdict-badge" style="--cal-badge-bg: ' + levelColor + ';">';
  html += level + ' (' + (comp.verdict.reason_code || 'n/a') + ')';
  html += '</span></div>';

  if (comp.verdict.triggered_rules && comp.verdict.triggered_rules.length) {
    html += '<div class="cal-audio-warning-box"><strong>Triggered Warnings/Failures:</strong><br/>';
    html += comp.verdict.triggered_rules.map(function (r) { return '\u2022 ' + r; }).join('<br/>');
    html += '</div>';
  }

  html += '<div class="cal-audio-metrics">';
  html += '<div class="cal-audio-metric-col">';
  html += '<strong class="cal-audio-section-label">Temporal Metrics</strong><br/>';
  html += 'Peak Delta: <strong>' + _fmtDb(comp.time_metrics, 'peak_delta_db') + ' dB</strong><br/>';
  html += 'RMS Delta: <strong>' + _fmtDb(comp.time_metrics, 'rms_delta_db') + ' dB</strong><br/>';
  html += 'Residual RMS: <strong>' + _fmtDbfs(comp.time_metrics, 'residual_rms_dbfs') + ' dBFS</strong><br/>';
  html += 'RMSE: <strong>' + _fmtNum(comp.time_metrics, 'rmse', 4) + '</strong>';
  html += '</div>';
  html += '<div class="cal-audio-metric-col">';
  html += '<strong class="cal-audio-section-label">Alignment</strong><br/>';
  html += 'Offset: <strong>' + (comp.alignment ? comp.alignment.sample_offset : '?') + ' samples</strong> (' + _fmtMs(comp.alignment) + ' ms)<br/>';
  html += 'Correlation Peak: <strong>' + _fmtNum(comp.alignment, 'correlation_peak', 4) + '</strong><br/>';
  html += 'Overlap Ratio: <strong>' + _fmtPct(comp.alignment) + '%</strong>';
  html += '</div></div>';

  html += '<div class="cal-audio-spectral">';
  html += '<strong class="cal-audio-section-label">Spectral Magnitude Delta</strong><br/>';
  html += 'Mean Abs Diff: <strong>' + _fmtDb(comp.spectral_metrics, 'log_mag_mean_abs_diff_db') + ' dB</strong><br/>';
  html += '<span class="cal-audio-spectral-dim">';
  html += 'Low: <strong>' + _fmtDb(comp.spectral_metrics, 'low_band_delta_db') + ' dB</strong> | ';
  html += 'Mid: <strong>' + _fmtDb(comp.spectral_metrics, 'mid_band_delta_db') + ' dB</strong> | ';
  html += 'High: <strong>' + _fmtDb(comp.spectral_metrics, 'high_band_delta_db') + ' dB</strong>';
  html += '</span></div></div>';

  return html;
}

/** @private */
function _fmtDb(obj, key) {
  return (obj && obj[key] != null) ? obj[key].toFixed(2) : '?';
}
/** @private */
function _fmtDbfs(obj, key) {
  return (obj && obj[key] != null) ? obj[key].toFixed(1) : '?';
}
/** @private */
function _fmtNum(obj, key, decimals) {
  return (obj && obj[key] != null) ? obj[key].toFixed(decimals || 2) : '?';
}
/** @private */
function _fmtMs(alignment) {
  return (alignment && alignment.time_offset_ms != null) ? alignment.time_offset_ms.toFixed(2) : '?';
}
/** @private */
function _fmtPct(alignment) {
  return (alignment && alignment.overlap_ratio != null) ? (alignment.overlap_ratio * 100).toFixed(1) : '?';
}
