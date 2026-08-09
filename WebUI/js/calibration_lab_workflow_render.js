/**
 * @purpose Calibration Lab workflow render functions: bank run list and workflow drawer HTML templates.
 * @classification Module/Calibration/Workflow/Render
 * @dependencies calibration_lab_page.js (defines CalibrationLabPage)
 */

CalibrationLabPage.prototype.renderBankRunList = function (store) {
  const state = store.getState();
  const items = state.bankRunItems;
  if (!items || items.length === 0) {
    return '<div class="cal-run-empty">No run generated yet.<br>Configure and click <strong>Generate Run</strong>.</div>';
  }

  const progress = store.getWorkflowProgress();
  const currentIdx = state.workflowSession.currentIndex;
  const STATUS_CLS = { pass: 'cal-status-pass', review: 'cal-status-review', fail: 'cal-status-fail', skip: 'cal-status-skip', pending: '' };
  const STATUS_ICON = { pass: '\u2713', review: '?', fail: '\u2715', skip: '\u2014', pending: '\u00B7' };

  const rows = items.map(function (item) {
    const status = state.workflowSession.itemStatuses[String(item.index)] || 'pending';
    const isCurrent = item.index === currentIdx;
    const isCritical = item.criticalCandidate;
    const cls = 'cal-run-item cal-run-item-cursor' +
      (isCurrent ? ' is-current' : '') +
      (isCritical ? ' is-critical-item' : '');
    return [
      '<div class="' + cls + '" data-run-index="' + item.index + '">',
      '  <span class="cal-run-idx">' + _pad2(item.index + 1) + '</span>',
      '  <div class="cal-run-item-info">',
      '    <span class="cal-run-item-name">' + escapeHtml(item.patchName) + '</span>',
      '    <span class="cal-run-item-bank">' + escapeHtml(item.bankName) + ' #' + item.patchIndex + '</span>',
      '  </div>',
      '  <span class="cal-run-status-icon ' + STATUS_CLS[status] + '">' + STATUS_ICON[status] + '</span>',
      (isCritical ? '<span class="cal-badge cal-badge-warn cal-badge-crit">crit</span>' : ''),
      '</div>'
    ].join('');
  }).join('');

  return [
    '<div class="cal-run-list-header">',
    '  <span class="cal-run-list-title">Run items</span>',
    '  <span class="cal-run-progress">' + progress.reviewed + '/' + progress.total + ' \u00B7 ' + progress.pct + '%</span>',
    '</div>',
    '<div class="cal-run-list">' + rows + '</div>'
  ].join('');
};

CalibrationLabPage.prototype.renderWorkflowDrawer = function (store) {
  const state = store.getState();
  if (!state.bankRunItems || state.bankRunItems.length === 0) { return ''; }

  const item = store.getCurrentWorkflowItem();
  if (!item) { return ''; }

  const progress = store.getWorkflowProgress();
  const status = state.workflowSession.itemStatuses[String(item.index)] || 'pending';
  const notes = state.workflowSession.itemNotes[String(item.index)] || '';

  const STATUS_LABELS = { pass: '\u2713 Pass', review: '? Review', fail: '\u2715 Fail', skip: '\u2014 Skip', pending: 'Pending' };

  const critWarning = item.criticalCandidate
    ? '<div class="cal-critical-warning cal-wf-warning">\u26A0 Critical candidate</div>'
    : '';

  return [
    '<div class="cal-workflow-drawer">',
    '  <div class="cal-workflow-header">',
    '    <span class="cal-workflow-title">Workflow</span>',
    '    <span class="cal-workflow-progress">' + (progress.currentIndex + 1) + ' / ' + progress.total + '</span>',
    '  </div>',
    '  <div class="cal-workflow-body">',
    '    <div class="cal-workflow-patch-name">' + escapeHtml(item.patchName) + '</div>',
    '    <div class="cal-workflow-meta">',
             escapeHtml(item.bankName) + ' \u00B7 slot ' + item.patchIndex +
             (item.meta && item.meta.category ? ' \u00B7 ' + escapeHtml(item.meta.category) : '') +
             (item.meta && item.meta.favorite ? ' \u00B7 \u2605' : ''),
    '    </div>',
             critWarning,
    '    <div class="cal-workflow-status-row">',
    '      <span class="cal-workflow-label">Status:</span>',
    '      <span class="cal-workflow-value">' + (STATUS_LABELS[status] || status) + '</span>',
    '    </div>',
    '    <div class="cal-workflow-actions">',
    '      <button class="manager-btn" type="button" id="wf-mark-pass">\u2713 Pass</button>',
    '      <button class="manager-btn" type="button" id="wf-mark-review">? Review</button>',
    '      <button class="manager-btn" type="button" id="wf-mark-fail">\u2715 Fail</button>',
    '      <button class="manager-btn" type="button" id="wf-mark-skip">\u2014 Skip</button>',
    '    </div>',
    '    <textarea id="wf-notes" class="modal-input cal-wf-notes" rows="2" placeholder="Notes\u2026">' + escapeHtml(notes) + '</textarea>',
    '    <div class="cal-workflow-nav">',
    '      <button class="manager-btn" type="button" id="wf-prev">\u25C0 Prev</button>',
    '      <button class="manager-btn btn-solid" type="button" id="wf-load">\u2B06 Load to Editor</button>',
    '      <button class="manager-btn" type="button" id="wf-next">Next \u25B6</button>',
    '    </div>',
    '    <div class="cal-workflow-actions cal-wf-actions-mt">',
    '      <button class="manager-btn" type="button" id="wf-use-a">Use as Patch A</button>',
    '      <button class="manager-btn" type="button" id="wf-use-b">Use as Patch B</button>',
    '    </div>',
    '    <div class="cal-drawer-note cal-drawer-note-mt">',
    '      Run comparison / Trace backend pending \u2014 conectar a getParamTrace() en Sprint 4.',
    '    </div>',
    '  </div>',
    '</div>'
  ].join('');
};

/** @private Pad number to 2 digits */
function _pad2(n) {
  return n < 10 ? '0' + n : String(n);
}
