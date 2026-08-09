/**
 * @purpose Calibration Lab workflow event handlers: bank run controls, bank run list click,
 *          workflow buttons (mark status, nav, load, use A/B).
 * @classification Module/Calibration/Workflow/Events
 * @dependencies calibration_lab_page.js (defines CalibrationLabPage)
 */

CalibrationLabPage.prototype._showExportFeedback = function (msg) {
  if (!this.exportFeedbackEl) { return; }
  const self = this;
  this.exportFeedbackEl.textContent = msg;
  setTimeout(function () {
    if (self.exportFeedbackEl) { self.exportFeedbackEl.textContent = ''; }
  }, 3000);
};

CalibrationLabPage.prototype.bindBankRunControls = function () {
  const store = window.calibrationStore;
  if (!store) { return; }
  const self = this;

  // Collapsible toggle
  const toggleEl = this.querySelector('#cal-run-toggle');
  const controlsEl = this.querySelector('#cal-run-controls');
  const iconEl = this.querySelector('#cal-run-icon');
  if (toggleEl && controlsEl) {
    toggleEl.classList.add('cursor-pointer');
    toggleEl.onclick = function () {
      const open = !controlsEl.classList.contains('hidden');
      controlsEl.classList.toggle('hidden');
      if (iconEl) { iconEl.textContent = open ? '\u25B6' : '\u25BC'; }
    };
  }

  // Generate Run
  const generateBtn = this.querySelector('#cal-run-generate');
  if (generateBtn) {
    generateBtn.onclick = function () {
      const size = parseInt((self.querySelector('#cal-run-size') && self.querySelector('#cal-run-size').value) || '24', 10);
      const seed = parseInt((self.querySelector('#cal-run-seed') && self.querySelector('#cal-run-seed').value) || '42', 10);
      const category = ((self.querySelector('#cal-run-category') && self.querySelector('#cal-run-category').value) || '').trim();
      const favOnly = !!(self.querySelector('#cal-run-favonly') && self.querySelector('#cal-run-favonly').checked);
      const critOnly = !!(self.querySelector('#cal-run-critical') && self.querySelector('#cal-run-critical').checked);
      store.setBankRunConfig({ sampleSize: size, seed: seed, categoryFilter: category, favoritesOnly: favOnly, criticalOnly: critOnly });
      const items = store.generateBankRun();
      if (items.length > 0) { store.startWorkflowSession(); }
    };
  }

  // Clear Run
  const clearBtn = this.querySelector('#cal-run-clear');
  if (clearBtn) {
    clearBtn.onclick = function () { store.clearBankRun(); };
  }

  // Export buttons (CL-10)
  _wireExportButton(self, this.exportJsonBtn, function (store) {
    const exporter = window.CalibrationReportExporter;
    const snap = store.getWorkflowReportSnapshot();
    if (exporter && snap) { exporter.exportCalibrationReportJson(snap); return true; }
    return false;
  });
  _wireExportButton(self, this.exportCsvBtn, function (store) {
    const exporter = window.CalibrationReportExporter;
    const rows = store.buildReportRows();
    if (exporter && rows) { exporter.exportCalibrationReportCsv(rows); return true; }
    return false;
  });
  _wireExportButton(self, this.exportPdfBtn, function (store) {
    const exporter = window.CalibrationReportExporter;
    const snap = store.getWorkflowReportSnapshot();
    if (exporter && snap) { exporter.exportCalibrationReportPdf(snap); return true; }
    return false;
  });
  _wireExportButton(self, this.exportSyxBtn, function (store) {
    const exporter = window.CalibrationReportExporter;
    const item = store.getCurrentWorkflowItem();
    if (exporter && item) {
      const ok = exporter.exportSelectedWorkflowPatchSysex(item);
      return ok;
    }
    return false;
  });
};

/** @private Wires a single export button to its handler */
function _wireExportButton(self, btn, handler) {
  if (!btn) { return; }
  btn.onclick = function () {
    const store = window.calibrationStore;
    if (!store) { return; }
    const ok = handler(store);
    if (ok) { self._showExportFeedback('Exported \u2713'); }
    else { self._showExportFeedback('No data to export'); }
  };
}

CalibrationLabPage.prototype.bindBankRunListEvents = function () {
  if (!this.runListMountEl) { return; }
  const store = window.calibrationStore;
  if (!store) { return; }
  const els = this.runListMountEl.querySelectorAll('[data-run-index]');
  for (let i = 0; i < els.length; i++) {
    (function (el) {
      el.addEventListener('click', function () {
        const idx = parseInt(el.dataset.runIndex, 10);
        store.selectWorkflowIndex(idx);
      });
    })(els[i]);
  }
};

CalibrationLabPage.prototype.bindWorkflowEvents = function () {
  const el = this.workflowMountEl;
  if (!el) { return; }
  const store = window.calibrationStore;
  if (!store) { return; }
  const self = this;

  const currentIdx = store.getState().workflowSession.currentIndex;

  function btn(id, fn) {
    const b = el.querySelector('#' + id);
    if (b) { b.addEventListener('click', fn); }
  }

  btn('wf-mark-pass',   function () { store.markWorkflowItemStatus(currentIdx, 'pass'); });
  btn('wf-mark-review', function () { store.markWorkflowItemStatus(currentIdx, 'review'); });
  btn('wf-mark-fail',   function () { store.markWorkflowItemStatus(currentIdx, 'fail'); });
  btn('wf-mark-skip',   function () { store.markWorkflowItemStatus(currentIdx, 'skip'); });
  btn('wf-prev', function () { store.prevWorkflowItem(); });
  btn('wf-next', function () { store.nextWorkflowItem(); });

  btn('wf-load', function () {
    const item = store.getCurrentWorkflowItem();
    if (item && item.patchRef && typeof window.triggerMidiDump === 'function') {
      window.triggerMidiDump(item.patchRef);
    }
  });

  btn('wf-use-a', function () {
    const item = store.getCurrentWorkflowItem();
    if (item && item.patchRef) { store.setSelectedPatchA(item.patchRef); }
  });

  btn('wf-use-b', function () {
    const item = store.getCurrentWorkflowItem();
    if (item && item.patchRef) { store.setSelectedPatchB(item.patchRef); }
  });

  const notesEl = el.querySelector('#wf-notes');
  if (notesEl) {
    notesEl.addEventListener('blur', function () {
      const idx = store.getState().workflowSession.currentIndex;
      store.setWorkflowItemNotes(idx, notesEl.value);
    });
  }
};
