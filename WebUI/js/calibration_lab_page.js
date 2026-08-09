class CalibrationLabPage extends HTMLElement {
// WebUI/js/calibration_lab_page.js — Core CalibrationLabPage custom element class
  constructor() {
    super();
    this.unsubscribe = null;
    this.pollTimer = null;
    this.boundRender = () => this.render();
  }

  connectedCallback() {
    if (!this.children.length) {
      this.innerHTML = this.template();
    }

    this.cacheDom();
    this.bindEvents();
    this.initStore();
    this.render();
  }

  disconnectedCallback() {
    if (typeof this.unsubscribe === 'function') {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  template() {
    return typeof window._getCalibrationLabTemplate === 'function'
      ? window._getCalibrationLabTemplate()
      : '';
  }

  cacheDom() {
    this.backdropEl = this.querySelector('#cal-modal-backdrop');
    this.closeBtn = this.querySelector('#cal-close-btn');
    this.panelEl = this.querySelector('#cal-panel');
    this.summaryMountEl = this.querySelector('#cal-summary-mount');
    this.statusEl = this.querySelector('#cal-status-text');
    this.voiceSelectEl = this.querySelector('#cal-voice-select');
    this.refreshBtn = this.querySelector('#cal-refresh-btn');
    this.searchInputEl = this.querySelector('#cal-search-input');
    this.filterDiffEl = this.querySelector('#cal-filter-diff');
    this.filterCriticalEl = this.querySelector('#cal-filter-critical');
    this.filterAliasesEl = this.querySelector('#cal-filter-aliases');
    this.tabButtons = Array.from(this.querySelectorAll('[data-cal-tab]'));
    this.pickerMountEl = this.querySelector('#cal-picker-mount');
    // Sprint 3
    this.runListMountEl = this.querySelector('#cal-run-list-mount');
    this.workflowMountEl = this.querySelector('#cal-workflow-mount');
    this.exportJsonBtn = this.querySelector('#cal-export-json-btn');
    this.exportCsvBtn = this.querySelector('#cal-export-csv-btn');
    this.exportPdfBtn = this.querySelector('#cal-export-pdf-btn');
    this.exportSyxBtn = this.querySelector('#cal-export-syx-btn');
    this.exportFeedbackEl = this.querySelector('#cal-export-feedback');
  }

  show() {
    if (this.backdropEl) {
      this.backdropEl.classList.remove('hidden');
    }
    window.calibrationStore?.loadDiagnosticSnapshot();
  }

  hide() {
    if (this.backdropEl) {
      this.backdropEl.classList.add('hidden');
    }
  }

  bindEvents() {
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.hide());
    }

    this.tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!window.calibrationStore) {return;}
        window.calibrationStore.setActiveTab(btn.dataset.calTab);
      });
    });

    if (this.voiceSelectEl) {
      this.voiceSelectEl.addEventListener('change', () => {
        window.calibrationStore?.setSelectedVoiceIndex(Number(this.voiceSelectEl.value));
      });
    }

    if (this.refreshBtn) {
      this.refreshBtn.addEventListener('click', () => {
        window.calibrationStore?.loadDiagnosticSnapshot();
      });
    }

    if (this.searchInputEl) {
      this.searchInputEl.addEventListener('input', () => {
        window.calibrationStore?.setFilters({ search: this.searchInputEl.value || '' });
      });
    }

    if (this.filterDiffEl) {
      this.filterDiffEl.addEventListener('change', () => {
        window.calibrationStore?.setFilters({ showOnlyDifferences: !!this.filterDiffEl.checked });
      });
    }

    if (this.filterCriticalEl) {
      this.filterCriticalEl.addEventListener('change', () => {
        window.calibrationStore?.setFilters({ showOnlyCritical: !!this.filterCriticalEl.checked });
      });
    }

    if (this.filterAliasesEl) {
      this.filterAliasesEl.addEventListener('change', () => {
        window.calibrationStore?.setFilters({ showOnlyAliases: !!this.filterAliasesEl.checked });
      });
    }

    // Sprint 3: Bank Run controls + Export buttons
    this.bindBankRunControls();
  }

  initStore() {
    if (!window.calibrationStore && typeof window.createCalibrationStore === 'function') {
      window.calibrationStore = window.createCalibrationStore(getBridge());
    }

    if (window.calibrationStore) {
      this.unsubscribe = window.calibrationStore.subscribe(this.boundRender);
    }

    if (!this.pollTimer && window.calibrationStore) {
      this.pollTimer = setInterval(() => {
        const state = window.calibrationStore.getState();
        if (state.activeTab === 'engine' || state.activeTab === 'effective') {
          window.calibrationStore.loadDiagnosticSnapshot();
        }
      }, 1500);
    }

    this.seedInitialComparePatches();
  }

  seedInitialComparePatches() {
    const helpers = window.CalibrationPatchPickerHelpers;
    if (!helpers || !window.calibrationStore) {return;}

    const state = window.calibrationStore.getState();
    if (!state.selectedPatchA && window.currentActiveBank && window.currentActivePatchIndex >= 0) {
      helpers.setFromCurrent('A');
    }

    if (!state.selectedPatchB && window.currentActiveBank) {
      const bank = window.loadedBanks?.[window.currentActiveBank];
      if (bank && Array.isArray(bank)) {
        const start = Math.max(0, Number(window.currentActivePatchIndex) || 0);
        for (let i = 0; i < bank.length; i++) {
          const idx = (start + i + 1) % bank.length;
          if (bank[idx] && bank[idx].unpackedBytes) {
            helpers.setSelectedPatch('B', window.currentActiveBank, idx);
            break;
          }
        }
      }
    }
  }

  render() {
    if (typeof window._renderCalibrationLab === 'function') {
      window._renderCalibrationLab(this);
    }
  }

  _updateExportButtons(state) {
    if (typeof window._updateCalibrationExportButtons === 'function') {
      window._updateCalibrationExportButtons(this, state);
    }
  }
}

// Export class to globalThis for cross-file access (prototype methods in tabs.js, picker.js, drawer.js & workflow.js)
globalThis.CalibrationLabPage = CalibrationLabPage;
