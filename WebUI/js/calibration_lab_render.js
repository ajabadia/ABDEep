/**
 * @purpose Calibration Lab render orchestrator and export button updater.
 * Extracted from calibration_lab_page.js render() and _updateExportButtons().
 * Takes pageEl (CalibrationLabPage instance) as first parameter.
 */

window._renderCalibrationLab = function(pageEl) {
    const store = window.calibrationStore;
    if (!store || !pageEl.panelEl) {return;}

    const state = store.getState();

    pageEl.tabButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.calTab === state.activeTab);
    });

    if (pageEl.voiceSelectEl) {
      pageEl.voiceSelectEl.value = String(state.selectedVoiceIndex ?? 0);
    }

    if (pageEl.searchInputEl && pageEl.searchInputEl.value !== state.filters.search) {
      pageEl.searchInputEl.value = state.filters.search || '';
    }

    if (pageEl.filterDiffEl) {pageEl.filterDiffEl.checked = !!state.filters.showOnlyDifferences;}
    if (pageEl.filterCriticalEl) {pageEl.filterCriticalEl.checked = !!state.filters.showOnlyCritical;}
    if (pageEl.filterAliasesEl) {pageEl.filterAliasesEl.checked = !!state.filters.showOnlyAliases;}

    if (pageEl.statusEl) {
      pageEl.statusEl.textContent =
        state.snapshotStatus === 'ready'
          ? `Snapshot ready · ${state.lastUpdatedAt || 'n/a'}`
          : state.snapshotStatus === 'loading'
          ? 'Loading diagnostic snapshot...'
          : state.snapshotStatus === 'error'
          ? `Error: ${state.snapshotError || 'unknown'}`
          : 'Idle';
    }

    if (pageEl.pickerMountEl && window.CalibrationPatchPickerHelpers) {
      pageEl.pickerMountEl.innerHTML = pageEl.renderPatchPickerBar();
      pageEl.bindPatchPickerEvents();
    }

    // CL-03: Summary cards — siempre visibles, reflejan patch A/B activos
    if (pageEl.summaryMountEl) {
      pageEl.summaryMountEl.innerHTML = renderSummaryCards(store);
    }

    let tabHtml;
    if (state.activeTab === 'patchdiff') {
      tabHtml = pageEl.renderPatchDiffTab(store);
    } else if (state.activeTab === 'raw') {
      tabHtml = pageEl.renderRawTab(store);
    } else if (state.activeTab === 'semantic') {
      tabHtml = pageEl.renderSemanticTab(store);
    } else if (state.activeTab === 'engine') {
      tabHtml = pageEl.renderEngineTab(store);
    } else if (state.activeTab === 'audio-ab') {
      tabHtml = pageEl.renderAudioABTab(store);
    } else if (state.activeTab === 'roundtrip') {
      tabHtml = pageEl.renderRoundTripTab(store);
    } else if (state.activeTab === 'live') {
      tabHtml = pageEl.renderLiveValidationTab(store);
    } else {
      tabHtml = pageEl.renderEffectiveTab(store);
    }

    // CL-07: Panel dividido tabla + drawer cuando hay fila seleccionada
    const drawerHtml = state.selectedRowKey ? pageEl.renderDrawer(store) : '';
    pageEl.panelEl.innerHTML = `
      <div class="cal-panel-split${state.selectedRowKey ? ' has-drawer' : ''}">
        <div class="cal-panel-main">${tabHtml}</div>
        ${drawerHtml ? `<div class="cal-panel-drawer">${drawerHtml}</div>` : ''}
      </div>
    `;
    pageEl.bindDrawerEvents();

    if (state.activeTab === 'audio-ab') {
      pageEl.bindAudioABEvents();
    } else if (state.activeTab === 'roundtrip') {
      pageEl.bindRoundTripEvents();
    } else if (state.activeTab === 'live') {
      pageEl.bindLiveValidationEvents();
    }

    // CL-08d: Bank Run list
    if (pageEl.runListMountEl) {
      pageEl.runListMountEl.innerHTML = pageEl.renderBankRunList(store);
      pageEl.bindBankRunListEvents();
    }

    // CL-09: Workflow drawer
    if (pageEl.workflowMountEl) {
      pageEl.workflowMountEl.innerHTML = pageEl.renderWorkflowDrawer(store);
      pageEl.bindWorkflowEvents();
    }

    // CL-10: Export buttons enabled/disabled
    if (typeof window._updateCalibrationExportButtons === 'function') {
      window._updateCalibrationExportButtons(pageEl, state);
    }
};

window._updateCalibrationExportButtons = function(pageEl, state) {
    const hasRun = state.bankRunItems && state.bankRunItems.length > 0;
    if (pageEl.exportJsonBtn) {pageEl.exportJsonBtn.disabled = !hasRun;}
    if (pageEl.exportCsvBtn) {pageEl.exportCsvBtn.disabled = !hasRun;}
    if (pageEl.exportPdfBtn) {pageEl.exportPdfBtn.disabled = !hasRun;}
    if (pageEl.exportSyxBtn) {
      const store = window.calibrationStore;
      const item = store ? store.getCurrentWorkflowItem() : null;
      pageEl.exportSyxBtn.disabled = !item || !Array.isArray(item?.patchRef?.unpackedBytes);
    }
};
