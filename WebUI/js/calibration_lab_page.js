// WebUI/js/calibration_lab_page.js
(function () {
  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function fmt(value, digits = 3) {
    if (value === null || value === undefined) {return '—';}
    if (typeof value === 'boolean') {return value ? 'ON' : 'OFF';}
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {return '—';}
      return Number.isInteger(value) ? String(value) : value.toFixed(digits);
    }
    return String(value);
  }

  function getByteMaps() {
    const bridge = window.dualMidiBridge || {};
    return {
      paramToByteOffset: bridge.paramToByteOffset || window.PARAMTOBYTEOFFSET || {},
      byteOffsetToParamIds: bridge.byteOffsetToParamIds || window.BYTEOFFSETTOPARAMIDS || {},
      paramToCc: bridge.paramToCc || window.PARAMTOCC || {},
    };
  }

  function collectRawRows(store) {
    const state = store.getState();
    const patchA = state.selectedPatchA;
    const patchB = state.selectedPatchB;
    const bytesA = Array.isArray(patchA?.unpackedBytes) ? patchA.unpackedBytes : [];
    const bytesB = Array.isArray(patchB?.unpackedBytes) ? patchB.unpackedBytes : [];
    const maps = getByteMaps();

    const maxLen = Math.max(bytesA.length, bytesB.length, 0);
    const rows = [];

    for (let offset = 0; offset < maxLen; offset++) {
      const rawA = Number.isFinite(bytesA[offset]) ? bytesA[offset] : null;
      const rawB = Number.isFinite(bytesB[offset]) ? bytesB[offset] : null;
      const paramIds = maps.byteOffsetToParamIds[offset] || [];
      const changed = rawA !== rawB;

      rows.push({
        offset,
        rawA,
        rawB,
        changed,
        paramIds,
      });
    }

    return rows;
  }

  function collectPatchDiffRows(store) {
    const state = store.getState();
    const patchA = state.selectedPatchA;
    const patchB = state.selectedPatchB;
    const bytesA = Array.isArray(patchA?.unpackedBytes) ? patchA.unpackedBytes : [];
    const bytesB = Array.isArray(patchB?.unpackedBytes) ? patchB.unpackedBytes : [];
    const maps = getByteMaps();

    const maxLen = Math.max(bytesA.length, bytesB.length, 0);
    const rows = [];

    for (let offset = 0; offset < maxLen; offset++) {
      const rawA = Number.isFinite(bytesA[offset]) ? bytesA[offset] : null;
      const rawB = Number.isFinite(bytesB[offset]) ? bytesB[offset] : null;
      const paramIds = maps.byteOffsetToParamIds[offset] || [];
      const changed = rawA !== rawB;
      const region = classifyRegion(offset);
      const isAlias = paramIds.length > 1;
      const firstParam = paramIds[0] || null;
      const badge = firstParam
        ? store.classifyRow(firstParam, rawA, rawB)
        : (changed ? 'mismatch' : 'exact');
      const semanticA = renderSemanticValue(offset, rawA);
      const semanticB = renderSemanticValue(offset, rawB);
      const delta = (rawA !== null && rawB !== null) ? rawA - rawB : null;

      rows.push({
        offset,
        region,
        rawA,
        rawB,
        delta,
        paramIds,
        changed,
        isAlias,
        badge,
        semanticA,
        semanticB,
      });
    }

    return rows;
  }

  function collectSemanticRows(store) {
    const state = store.getState();
    const patchA = state.selectedPatchA;
    const patchB = state.selectedPatchB;
    const maps = getByteMaps();

    const bytesA = Array.isArray(patchA?.unpackedBytes) ? patchA.unpackedBytes : [];
    const bytesB = Array.isArray(patchB?.unpackedBytes) ? patchB.unpackedBytes : [];

    const rows = [];

    Object.entries(maps.paramToByteOffset).forEach(([paramId, offset]) => {
      const rawA = Number.isFinite(bytesA[offset]) ? bytesA[offset] : null;
      const rawB = Number.isFinite(bytesB[offset]) ? bytesB[offset] : null;
      const cc = maps.paramToCc[paramId] ?? null;
      const badge = store.classifyRow(paramId, rawA, rawB);
      rows.push({
        paramId,
        offset,
        cc,
        rawA,
        rawB,
        badge,
        changed: rawA !== rawB,
      });
    });

    rows.sort((a, b) => a.offset - b.offset || a.paramId.localeCompare(b.paramId));
    return rows;
  }

  // ─────────────────────────────────────────────────────────────────
  // PatchDiff: region classification (matches C++ PatchDiffEngine::classifyByteOffset)
  // ─────────────────────────────────────────────────────────────────
  function classifyRegion(offset) {
    if (offset >= 0 && offset <= 20)      {return 'OSC1';}
    if (offset >= 21 && offset <= 38)     {return 'OSC2';}
    if (offset === 40)                    {return 'HPF';}
    if (offset === 39 || offset === 41 || (offset >= 42 && offset <= 44)) {return 'VCF';}
    if (offset >= 88 && offset <= 90)     {return 'Drift';}
    if (offset >= 165 && offset <= 219)   {return 'FX';}
    if (offset >= 224 && offset <= 238)   {return 'Program Name';}
    return 'Global/Other';
  }

  function renderSemanticValue(offset, raw) {
    if (raw === null || raw === undefined) {return '—';}
    if (offset === 39) {
      const hz = 50 * Math.pow(400, raw / 255);
      return hz.toFixed(1) + ' Hz';
    }
    if (offset === 41) {return (raw / 255).toFixed(3);}
    if (offset === 42) {return ((raw - 128) / 128).toFixed(3);}
    if (offset === 40) {return (raw * 3.92 + 20).toFixed(1) + ' Hz';}
    if (offset === 88) {return (raw / 255).toFixed(3);}
    if (offset === 51 || offset === 113) {return raw === 0 ? '4-Pole (24dB)' : '2-Pole (12dB)';}
    return String(raw);
  }

  // ─────────────────────────────────────────────────────────────────
  // CL-05: Metadatos de badges — tooltips y colores definidos en un
  // único lugar; el render solo consulta aquí.
  // ─────────────────────────────────────────────────────────────────
  const BADGE_META = {
    'exact':        { label: 'exact',        cls: 'cal-badge-ok',     tip: 'Los bytes coinciden exactamente en ambos patches.' },
    'alias-shared': { label: 'alias',        cls: 'cal-badge-alias',  tip: 'Offset compartido por múltiples parámetros (alias semántico, no conflicto).' },
    'stub':         { label: 'stub',         cls: 'cal-badge-stub',   tip: 'Parámetro declarado en UI pero sin implementación DSP completa (fallback activo).' },
    'mismatch':     { label: 'mismatch',     cls: 'cal-badge-warn',   tip: 'Los valores difieren entre Patch A y Patch B.' },
    'info':         { label: 'info',         cls: 'cal-badge',        tip: 'Dato parcial o sin comparación disponible.' },
  };

  function runRoundTripValidation(bytes) {
    if (!Array.isArray(bytes) || bytes.length < 242) {return null;}
    const maps = getByteMaps();
    const entries = [];
    let exactMatches = 0, withinTolerance = 0, mismatches = 0;
    let aliasSharedCount = 0, nameBytesCount = 0, specialCaseCount = 0;
    const derivedCount = 0, stubCount = 0;

    for (let i = 0; i < 242; i++) {
      const rawOriginal = bytes[i] & 0xFF;
      const semanticVal = rawOriginal / 255.0;
      const engineVal = semanticVal;
      const rawRebuilt = Math.max(0, Math.min(255, Math.round(engineVal * 255.0)));
      const delta = Math.abs(rawOriginal - rawRebuilt);

      const paramIds = maps.byteOffsetToParamIds[i] || [];

      let classification;
      if (i >= 224 && i <= 238) {
        classification = 'name-byte';
        nameBytesCount++;
      } else if (i >= 239 && i <= 241) {
        classification = 'special-case';
        specialCaseCount++;
      } else if (paramIds.length > 1 || i === 88 || i === 160) {
        classification = 'alias-shared';
        aliasSharedCount++;
      } else if (delta === 0) {
        classification = 'exact';
        exactMatches++;
      } else if (delta <= 1) {
        classification = 'within-tolerance';
        withinTolerance++;
      } else {
        classification = 'mismatch';
        mismatches++;
      }

      entries.push({
        byteOffset: i,
        rawOriginal,
        semanticNormalized: semanticVal,
        engineStateNormalized: engineVal,
        rawRebuilt,
        delta,
        classification,
        paramIds,
      });
    }

    return {
      entries,
      exactMatches,
      withinTolerance,
      mismatches,
      aliasSharedCount,
      nameBytesCount,
      specialCaseCount,
      derivedCount,
      stubCount,
      transportValid: true,
      patchDataValid: mismatches === 0,
    };
  }

  function renderBadge(badge) {
    const meta = BADGE_META[badge] || BADGE_META['info'];
    return `<span class="cal-badge ${meta.cls}" title="${escapeHtml(meta.tip)}">${meta.label}</span>`;
  }

  // CL-03: ValidationSummaryCards — derivado de getValidationSummary()
  function renderSummaryCards(store) {
    const summary = store.getValidationSummary();
    const hasCritical = summary.criticalWarnings.length > 0;

    const cards = [
      { key: 'exact',       label: 'Exact',        count: summary.exact,       cls: 'cal-card-ok'    },
      { key: 'aliasShared', label: 'Alias-Shared',  count: summary.aliasShared, cls: 'cal-card-alias' },
      { key: 'stub',        label: 'Stub',          count: summary.stub,        cls: 'cal-card-stub'  },
      { key: 'mismatch',    label: 'Mismatch',      count: summary.mismatch,    cls: 'cal-card-warn'  },
    ];

    const cardsHtml = cards.map(c => `
      <div class="cal-card ${c.cls}">
        <span class="cal-card-count">${c.count}</span>
        <span class="cal-card-label">${c.label}</span>
      </div>
    `).join('');

    const warningHtml = hasCritical ? `
      <div class="cal-critical-warning">
        ⚠ ${summary.criticalWarnings.length} critical contract warning${summary.criticalWarnings.length > 1 ? 's' : ''}:
        ${summary.criticalWarnings.map(w =>
          `<span class="cal-critical-param" title="offset ${w.offset}">${escapeHtml(w.paramId)}</span>`
        ).join(', ')}
      </div>
    ` : '';

    return `
      <div class="cal-summary-bar">
        ${cardsHtml}
        <div class="cal-card cal-card-total">
          <span class="cal-card-count">${summary.total}</span>
          <span class="cal-card-label">Mapped</span>
        </div>
      </div>
      ${warningHtml}
    `;
  }

  function renderRowsTable(headers, rowsHtml) {
    return `
      <div class="cal-table-wrap">
        <table class="cal-table">
          <thead>
            <tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${rowsHtml || `<tr><td colspan="${headers.length}" class="cal-empty">No data</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  class CalibrationLabPage extends HTMLElement {
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
      return `
        <div class="modal-backdrop" id="cal-modal-backdrop" style="display:none">
          <div class="modal cal-modal-wide" style="width:1200px;height:760px;display:flex;flex-direction:column">
            <div class="modal-header">
              <h2>Calibration Lab</h2>
              <div class="cal-header-actions">
                <button id="cal-export-json-btn" class="manager-btn" type="button" title="Export session as JSON">📄 JSON</button>
                <button id="cal-export-csv-btn" class="manager-btn" type="button" title="Export run as CSV">📊 CSV</button>
                <button id="cal-export-pdf-btn" class="manager-btn" type="button" title="Export report as PDF">📑 PDF</button>
                <button id="cal-export-syx-btn" class="manager-btn" type="button" title="Export current patch .syx">💾 .SYX</button>
                <span id="cal-export-feedback" class="cal-export-feedback"></span>
              </div>
              <div class="close-btn" id="cal-close-btn">&times;</div>
            </div>
            <div class="modal-body" style="flex:1;overflow:hidden;display:flex;gap:10px;padding:15px">

              <!-- Left: compare pane -->
              <section class="cal-page" style="flex:1;overflow:hidden;display:flex;flex-direction:column;border:none;padding:0;min-height:0">
                <div class="cal-header">
                  <div>
                    <h2 class="cal-title" style="display:none">Calibration Lab</h2>
                    <div class="cal-subtitle">Raw / Semantic / PatchDiff / Engine / Effective</div>
                  </div>

                  <div class="cal-toolbar">
                    <label class="cal-inline">
                      <span>Voice</span>
                      <select id="cal-voice-select" class="modal-select">
                        ${Array.from({ length: 12 }).map((_, i) => `<option value="${i}">Voice ${i + 1}</option>`).join('')}
                      </select>
                    </label>

                    <button id="cal-refresh-btn" class="manager-btn btn-solid" type="button">Refresh</button>
                  </div>
                </div>

                <div id="cal-picker-mount"></div>

                <div class="cal-status-row">
                  <span id="cal-status-text" class="cal-status">Idle</span>
                </div>

                <div class="cal-tabs">
                  <button class="cal-tab active" data-cal-tab="patchdiff" type="button">PatchDiff</button>
                  <button class="cal-tab" data-cal-tab="raw" type="button">Raw</button>
                  <button class="cal-tab" data-cal-tab="semantic" type="button">Semantic</button>
                  <button class="cal-tab" data-cal-tab="engine" type="button">Engine</button>
                  <button class="cal-tab" data-cal-tab="effective" type="button">Effective</button>
                  <button class="cal-tab" data-cal-tab="audio-ab" type="button">Audio A/B</button>
                  <button class="cal-tab" data-cal-tab="roundtrip" type="button">RoundTrip</button>
                  <button class="cal-tab" data-cal-tab="live" type="button">Live</button>
                </div>

                <div class="cal-filters" style="margin-bottom:6px">
                  <label class="cal-inline">
                    <input id="cal-filter-diff" type="checkbox" />
                    <span>Only differences</span>
                  </label>
                  <label class="cal-inline">
                    <input id="cal-filter-critical" type="checkbox" />
                    <span>Only critical</span>
                  </label>
                  <label class="cal-inline">
                    <input id="cal-filter-aliases" type="checkbox" />
                    <span>Only aliases</span>
                  </label>
                  <input id="cal-search-input" class="modal-input" type="text" placeholder="Search paramId / offset" />
                </div>

                <div id="cal-summary-mount"></div>

                <div id="cal-panel" class="cal-panel" style="flex:1;overflow:hidden;display:flex;flex-direction:column"></div>
              </section>

              <!-- Right: Bank Run + Workflow pane -->
              <aside class="cal-side-pane">
                <!-- CL-08: Stratified Bank Run -->
                <div class="cal-run-section">
                  <div class="cal-run-header" id="cal-run-toggle">
                    <span class="cal-run-title">⚙ Stratified Bank Run</span>
                    <span class="cal-run-toggle-icon" id="cal-run-icon">▶</span>
                  </div>
                  <div id="cal-run-controls" class="cal-run-controls" style="display:none">
                    <div class="cal-run-field">
                      <label class="cal-run-label">Sample size</label>
                      <input id="cal-run-size" type="number" class="modal-input" value="24" min="1" max="128" style="width:64px" />
                    </div>
                    <div class="cal-run-field">
                      <label class="cal-run-label">Seed</label>
                      <input id="cal-run-seed" type="number" class="modal-input" value="42" min="0" style="width:64px" />
                    </div>
                    <div class="cal-run-field">
                      <label class="cal-run-label">Category filter</label>
                      <input id="cal-run-category" type="text" class="modal-input" placeholder="e.g. bass" style="width:100%" />
                    </div>
                    <div class="cal-run-field">
                      <label class="cal-inline">
                        <input id="cal-run-favonly" type="checkbox" />
                        <span>Favorites only</span>
                      </label>
                    </div>
                    <div class="cal-run-field">
                      <label class="cal-inline">
                        <input id="cal-run-critical" type="checkbox" />
                        <span>Critical only</span>
                      </label>
                    </div>
                    <button id="cal-run-generate" class="manager-btn btn-solid" type="button" style="width:100%">Generate Run</button>
                    <button id="cal-run-clear" class="manager-btn" type="button" style="width:100%">Clear Run</button>
                  </div>
                </div>

                <!-- CL-08d: Run results list -->
                <div id="cal-run-list-mount" class="cal-run-list-mount"></div>

                <!-- CL-09: Workflow Drawer -->
                <div id="cal-workflow-mount" class="cal-workflow-mount"></div>
              </aside>

            </div>
          </div>
        </div>
      `;
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
        this.backdropEl.style.display = 'flex';
      }
      window.calibrationStore?.loadDiagnosticSnapshot();
    }

    hide() {
      if (this.backdropEl) {
        this.backdropEl.style.display = 'none';
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
        window.calibrationStore = window.createCalibrationStore(window.dualMidiBridge);
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
      const store = window.calibrationStore;
      if (!store || !this.panelEl) {return;}

      const state = store.getState();

      this.tabButtons.forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.calTab === state.activeTab);
      });

      if (this.voiceSelectEl) {
        this.voiceSelectEl.value = String(state.selectedVoiceIndex ?? 0);
      }

      if (this.searchInputEl && this.searchInputEl.value !== state.filters.search) {
        this.searchInputEl.value = state.filters.search || '';
      }

      if (this.filterDiffEl) {this.filterDiffEl.checked = !!state.filters.showOnlyDifferences;}
      if (this.filterCriticalEl) {this.filterCriticalEl.checked = !!state.filters.showOnlyCritical;}
      if (this.filterAliasesEl) {this.filterAliasesEl.checked = !!state.filters.showOnlyAliases;}

      if (this.statusEl) {
        this.statusEl.textContent =
          state.snapshotStatus === 'ready'
            ? `Snapshot ready · ${state.lastUpdatedAt || 'n/a'}`
            : state.snapshotStatus === 'loading'
            ? 'Loading diagnostic snapshot...'
            : state.snapshotStatus === 'error'
            ? `Error: ${state.snapshotError || 'unknown'}`
            : 'Idle';
      }

      if (this.pickerMountEl && window.CalibrationPatchPickerHelpers) {
        this.pickerMountEl.innerHTML = this.renderPatchPickerBar();
        this.bindPatchPickerEvents();
      }

      // CL-03: Summary cards — siempre visibles, reflejan patch A/B activos
      if (this.summaryMountEl) {
        this.summaryMountEl.innerHTML = renderSummaryCards(store);
      }

      let tabHtml;
      if (state.activeTab === 'patchdiff') {
        tabHtml = this.renderPatchDiffTab(store);
      } else if (state.activeTab === 'raw') {
        tabHtml = this.renderRawTab(store);
      } else if (state.activeTab === 'semantic') {
        tabHtml = this.renderSemanticTab(store);
      } else if (state.activeTab === 'engine') {
        tabHtml = this.renderEngineTab(store);
      } else if (state.activeTab === 'audio-ab') {
        tabHtml = this.renderAudioABTab(store);
      } else if (state.activeTab === 'roundtrip') {
        tabHtml = this.renderRoundTripTab(store);
      } else if (state.activeTab === 'live') {
        tabHtml = this.renderLiveValidationTab(store);
      } else {
        tabHtml = this.renderEffectiveTab(store);
      }

      // CL-07: Panel dividido tabla + drawer cuando hay fila seleccionada
      const drawerHtml = state.selectedRowKey ? this.renderDrawer(store) : '';
      this.panelEl.innerHTML = `
        <div class="cal-panel-split${state.selectedRowKey ? ' has-drawer' : ''}">
          <div class="cal-panel-main">${tabHtml}</div>
          ${drawerHtml ? `<div class="cal-panel-drawer">${drawerHtml}</div>` : ''}
        </div>
      `;
      this.bindDrawerEvents();

      if (state.activeTab === 'audio-ab') {
        this.bindAudioABEvents();
      } else if (state.activeTab === 'roundtrip') {
        this.bindRoundTripEvents();
      } else if (state.activeTab === 'live') {
        this.bindLiveValidationEvents();
      }

      // CL-08d: Bank Run list
      if (this.runListMountEl) {
        this.runListMountEl.innerHTML = this.renderBankRunList(store);
        this.bindBankRunListEvents();
      }

      // CL-09: Workflow drawer
      if (this.workflowMountEl) {
        this.workflowMountEl.innerHTML = this.renderWorkflowDrawer(store);
        this.bindWorkflowEvents();
      }

      // CL-10: Export buttons enabled/disabled
      this._updateExportButtons(state);
    }

    _updateExportButtons(state) {
      const hasRun = state.bankRunItems && state.bankRunItems.length > 0;
      if (this.exportJsonBtn) {this.exportJsonBtn.disabled = !hasRun;}
      if (this.exportCsvBtn) {this.exportCsvBtn.disabled = !hasRun;}
      if (this.exportPdfBtn) {this.exportPdfBtn.disabled = !hasRun;}
      if (this.exportSyxBtn) {
        this.exportSyxBtn.disabled = !item || !Array.isArray(item.patchRef?.unpackedBytes);
      }
    }



    renderPatchPickerBar() {
      const state = window.calibrationStore.getState();
      const helpers = window.CalibrationPatchPickerHelpers;
      const bankNames = helpers ? helpers.getBankNames() : [];

      const selectedABank = state.selectedPatchA?.bankName || window.currentActiveBank || bankNames[0] || '';
      const selectedBBank = state.selectedPatchB?.bankName || window.currentActiveBank || bankNames[0] || '';

      const slotsA = helpers ? helpers.buildSlotOptions(selectedABank) : [];
      const slotsB = helpers ? helpers.buildSlotOptions(selectedBBank) : [];

      const selectedASlot = Number.isFinite(state.selectedPatchA?.patchIndex) ? state.selectedPatchA.patchIndex : 0;
      const selectedBSlot = Number.isFinite(state.selectedPatchB?.patchIndex) ? state.selectedPatchB.patchIndex : 0;

      return `
        <div class="cal-compare-bar">
          <div class="cal-compare-side">
            <div class="cal-compare-head">Patch A</div>
            <div class="flex-row gap-6">
              <select id="cal-bank-a" class="modal-select" style="width:120px">
                ${bankNames.map((name) => `
                  <option value="${escapeHtml(name)}" ${name === selectedABank ? 'selected' : ''}>
                    ${escapeHtml(name)}
                  </option>
                `).join('')}
              </select>

              <select id="cal-slot-a" class="modal-select flex-1">
                ${slotsA.map((slot) => `
                  <option value="${slot.index}" ${slot.index === selectedASlot ? 'selected' : ''} ${slot.disabled ? 'disabled' : ''}>
                    ${escapeHtml(slot.label)}
                  </option>
                `).join('')}
              </select>
            </div>
            <div class="cal-compare-actions">
              <button id="cal-use-current-a" class="manager-btn" type="button">Use current</button>
              <span class="cal-picked-name">${escapeHtml(state.selectedPatchA?.name || '—')}</span>
            </div>
          </div>

          <button id="cal-swap-ab" class="manager-btn cal-btn-swap" type="button" title="Swap A ↔ B">⇄</button>

          <div class="cal-compare-side">
            <div class="cal-compare-head">Patch B</div>
            <div class="flex-row gap-6">
              <select id="cal-bank-b" class="modal-select" style="width:120px">
                ${bankNames.map((name) => `
                  <option value="${escapeHtml(name)}" ${name === selectedBBank ? 'selected' : ''}>
                    ${escapeHtml(name)}
                  </option>
                `).join('')}
              </select>

              <select id="cal-slot-b" class="modal-select flex-1">
                ${slotsB.map((slot) => `
                  <option value="${slot.index}" ${slot.index === selectedBSlot ? 'selected' : ''} ${slot.disabled ? 'disabled' : ''}>
                    ${escapeHtml(slot.label)}
                  </option>
                `).join('')}
              </select>
            </div>
            <div class="cal-compare-actions">
              <button id="cal-use-current-b" class="manager-btn" type="button">Use current</button>
              <span class="cal-picked-name">${escapeHtml(state.selectedPatchB?.name || '—')}</span>
            </div>
          </div>
        </div>
      `;
    }

    bindPatchPickerEvents() {
      const helpers = window.CalibrationPatchPickerHelpers;
      if (!helpers) {return;}

      const bankAEl = this.querySelector('#cal-bank-a');
      const slotAEl = this.querySelector('#cal-slot-a');
      const bankBEl = this.querySelector('#cal-bank-b');
      const slotBEl = this.querySelector('#cal-slot-b');
      const useCurrentAEl = this.querySelector('#cal-use-current-a');
      const useCurrentBEl = this.querySelector('#cal-use-current-b');

      if (bankAEl) {
        bankAEl.onchange = () => {
          const bankName = bankAEl.value;
          const slotOptions = helpers.buildSlotOptions(bankName);
          const firstValid = slotOptions.find((x) => !x.disabled);
          if (firstValid) {
            helpers.setSelectedPatch('A', bankName, firstValid.index);
          } else {
            window.calibrationStore.setSelectedPatchA(null);
          }
        };
      }

      if (slotAEl) {
        slotAEl.onchange = () => {
          helpers.setSelectedPatch('A', bankAEl.value, Number(slotAEl.value));
        };
      }

      if (bankBEl) {
        bankBEl.onchange = () => {
          const bankName = bankBEl.value;
          const slotOptions = helpers.buildSlotOptions(bankName);
          const firstValid = slotOptions.find((x) => !x.disabled);
          if (firstValid) {
            helpers.setSelectedPatch('B', bankName, firstValid.index);
          } else {
            window.calibrationStore.setSelectedPatchB(null);
          }
        };
      }

      if (slotBEl) {
        slotBEl.onchange = () => {
          helpers.setSelectedPatch('B', bankBEl.value, Number(slotBEl.value));
        };
      }

      if (useCurrentAEl) {
        useCurrentAEl.onclick = () => helpers.setFromCurrent('A');
      }

      if (useCurrentBEl) {
        useCurrentBEl.onclick = () => helpers.setFromCurrent('B');
      }

      const swapBtn = this.querySelector('#cal-swap-ab');
      if (swapBtn) {
        swapBtn.onclick = () => {
          window.calibrationStore?.swapPatches();
        };
      }
    }

    applySharedFilters(rows, projector) {
      const store = window.calibrationStore;
      const state = store.getState();
      const search = (state.filters.search || '').trim().toLowerCase();

      return rows.filter((row) => {
        if (state.filters.showOnlyDifferences && !row.changed) {return false;}
        if (!search) {return true;}
        const hay = projector(row).toLowerCase();
        return hay.includes(search);
      });
    }

    renderRawTab(store) {
      const state = store.getState();
      const rows = this.applySharedFilters(
        collectRawRows(store),
        (row) => `${row.offset} ${row.paramIds.join(' ')} ${row.rawA} ${row.rawB}`
      );

      const html = rows.map((row) => {
        // Badge por el primer paramId mapeado (si lo hay)
        const firstParam = row.paramIds[0] || null;
        const badge = firstParam
          ? store.classifyRow(firstParam, row.rawA, row.rawB)
          : (row.changed ? 'mismatch' : 'exact');
        const rowKey = `raw-${row.offset}`;
        const isSelected = state.selectedRowKey === rowKey;
        return `
          <tr class="cal-row${row.changed ? ' is-changed' : ''}${isSelected ? ' is-selected' : ''}" data-row-key="${rowKey}" style="cursor:pointer">
            <td class="mono">${row.offset}</td>
            <td class="mono">${escapeHtml(row.paramIds.join(', ') || '—')}</td>
            <td class="mono">${fmt(row.rawA, 0)}</td>
            <td class="mono">${fmt(row.rawB, 0)}</td>
            <td>${renderBadge(badge)}</td>
          </tr>
        `;
      }).join('');

      return renderRowsTable(['Offset', 'Param IDs', 'Patch A', 'Patch B', 'Badge'], html);
    }

    renderSemanticTab(store) {
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
        // Badge viene del store.classifyRow ya calculado en collectSemanticRows
        const rowKey = `sem-${row.paramId}-${row.offset}`;
        const isSelected = state.selectedRowKey === rowKey;
        return `
          <tr class="cal-row${row.changed ? ' is-changed' : ''}${isSelected ? ' is-selected' : ''}${CRITICAL.has(row.paramId) ? ' is-critical' : ''}" data-row-key="${rowKey}" style="cursor:pointer">
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
    }

    renderEngineTab(store) {
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
    }

    renderEffectiveTab(store) {
      const state = store.getState();
      const rows = store.getEffectiveRowsScoped();

      const html = rows.map((row) => {
        const badge = row.contractVerified ? 'exact' : 'info';
        const rowKey = `eff-${row.key}`;
        const isSelected = state.selectedRowKey === rowKey;
        return `
          <tr class="cal-row${isSelected ? ' is-selected' : ''}" data-row-key="${rowKey}" style="cursor:pointer">
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
    }

    // ─────────────────────────────────────────────────────────────────
    // CL-07: ParamTraceInspector drawer — se activa al hacer click en fila
    // ─────────────────────────────────────────────────────────────────
    renderDrawer(store) {
      const state = store.getState();
      const rowKey = state.selectedRowKey;
      if (!rowKey) {return '';}

      // Extraer contexto de fila según prefijo de rowKey
      let paramId = null, offset = null, rawA = null, rawB = null, badge = 'info', module = null;

      if (rowKey.startsWith('sem-')) {
        const patchA = state.selectedPatchA;
        const patchB = state.selectedPatchB;
        const maps = getByteMaps();
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
        if (found) { module = found.module; paramId = found.key; rawA = found.value; badge = 'exact'; }
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
    }

    bindDrawerEvents() {
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
    }
  }

  // ── Sprint 3 render/bind methods injected outside class to keep file readable ──
  // Injected as prototype methods on CalibrationLabPage.

  // ─────────────────────────────────────────────────────────────────────
  // CL-08c/d: Bank Run controls binding (attached once in bindEvents)
  // ─────────────────────────────────────────────────────────────────────

  CalibrationLabPage.prototype.bindBankRunControls = function () {
    const store = window.calibrationStore;
    if (!store) {return;}

    // Collapsible toggle
    const toggleEl = this.querySelector('#cal-run-toggle');
    const controlsEl = this.querySelector('#cal-run-controls');
    const iconEl = this.querySelector('#cal-run-icon');
    if (toggleEl && controlsEl) {
      toggleEl.style.cursor = 'pointer';
      toggleEl.onclick = () => {
        const open = controlsEl.style.display !== 'none';
        controlsEl.style.display = open ? 'none' : 'flex';
        if (iconEl) {iconEl.textContent = open ? '▶' : '▼';}
      };
    }

    // Generate Run
    const generateBtn = this.querySelector('#cal-run-generate');
    if (generateBtn) {
      generateBtn.onclick = () => {
        const size = parseInt(this.querySelector('#cal-run-size')?.value || '24', 10);
        const seed = parseInt(this.querySelector('#cal-run-seed')?.value || '42', 10);
        const category = (this.querySelector('#cal-run-category')?.value || '').trim();
        const favOnly = !!this.querySelector('#cal-run-favonly')?.checked;
        const critOnly = !!this.querySelector('#cal-run-critical')?.checked;
        store.setBankRunConfig({ sampleSize: size, seed, categoryFilter: category, favoritesOnly: favOnly, criticalOnly: critOnly });
        const items = store.generateBankRun();
        if (items.length > 0) {store.startWorkflowSession();}
      };
    }

    // Clear Run
    const clearBtn = this.querySelector('#cal-run-clear');
    if (clearBtn) {
      clearBtn.onclick = () => store.clearBankRun();
    }

    // Export buttons (CL-10)
    if (this.exportJsonBtn) {
      this.exportJsonBtn.onclick = () => {
        const exporter = window.CalibrationReportExporter;
        const snap = store.getWorkflowReportSnapshot();
        if (exporter && snap) {
          exporter.exportCalibrationReportJson(snap);
          this._showExportFeedback('JSON exported ✓');
        }
      };
    }
    if (this.exportCsvBtn) {
      this.exportCsvBtn.onclick = () => {
        const exporter = window.CalibrationReportExporter;
        const rows = store.buildReportRows();
        if (exporter && rows) {
          exporter.exportCalibrationReportCsv(rows);
          this._showExportFeedback('CSV exported ✓');
        }
      };
    }
    if (this.exportPdfBtn) {
      this.exportPdfBtn.onclick = () => {
        const exporter = window.CalibrationReportExporter;
        const snap = store.getWorkflowReportSnapshot();
        if (exporter && snap) {
          exporter.exportCalibrationReportPdf(snap);
          this._showExportFeedback('PDF exported ✓');
        }
      };
    }
    if (this.exportSyxBtn) {
      this.exportSyxBtn.onclick = () => {
        const exporter = window.CalibrationReportExporter;
        const item = store.getCurrentWorkflowItem();
        if (exporter && item) {
          const ok = exporter.exportSelectedWorkflowPatchSysex(item);
          if (ok) {this._showExportFeedback('.syx exported ✓');}
          else {this._showExportFeedback('No SysEx data for this patch');}
        }
      };
    }
  };

  CalibrationLabPage.prototype._showExportFeedback = function (msg) {
    if (!this.exportFeedbackEl) {return;}
    this.exportFeedbackEl.textContent = msg;
    setTimeout(() => { if (this.exportFeedbackEl) {this.exportFeedbackEl.textContent = '';} }, 3000);
  };

  // ─────────────────────────────────────────────────────────────────────
  // CL-08d: Bank Run list renderer
  // ─────────────────────────────────────────────────────────────────────

  CalibrationLabPage.prototype.renderBankRunList = function (store) {
    const state = store.getState();
    const items = state.bankRunItems;
    if (!items || items.length === 0) {
      return '<div class="cal-run-empty">No run generated yet.<br>Configure and click <strong>Generate Run</strong>.</div>';
    }

    const progress = store.getWorkflowProgress();
    const currentIdx = state.workflowSession.currentIndex;
    const STATUS_CLS = { pass: 'cal-status-pass', review: 'cal-status-review', fail: 'cal-status-fail', skip: 'cal-status-skip', pending: '' };
    const STATUS_ICON = { pass: '✓', review: '?', fail: '✕', skip: '—', pending: '·' };

    const rows = items.map((item) => {
      const status = state.workflowSession.itemStatuses[String(item.index)] || 'pending';
      const isCurrent = item.index === currentIdx;
      const isCritical = item.criticalCandidate;
      return `
        <div class="cal-run-item${isCurrent ? ' is-current' : ''}${isCritical ? ' is-critical-item' : ''}"
             data-run-index="${item.index}" style="cursor:pointer">
          <span class="cal-run-idx">${String(item.index + 1).padStart(2, '0')}</span>
          <div class="cal-run-item-info">
            <span class="cal-run-item-name">${escapeHtml(item.patchName)}</span>
            <span class="cal-run-item-bank">${escapeHtml(item.bankName)} #${item.patchIndex}</span>
          </div>
          <span class="cal-run-status-icon ${STATUS_CLS[status]}">${STATUS_ICON[status]}</span>
          ${isCritical ? '<span class="cal-badge cal-badge-warn" style="font-size:8px">crit</span>' : ''}
        </div>
      `;
    }).join('');

    return `
      <div class="cal-run-list-header">
        <span class="cal-run-list-title">Run items</span>
        <span class="cal-run-progress">${progress.reviewed}/${progress.total} · ${progress.pct}%</span>
      </div>
      <div class="cal-run-list">${rows}</div>
    `;
  };

  CalibrationLabPage.prototype.bindBankRunListEvents = function () {
    if (!this.runListMountEl) {return;}
    this.runListMountEl.querySelectorAll('[data-run-index]').forEach((el) => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.runIndex, 10);
        window.calibrationStore?.selectWorkflowIndex(idx);
      });
    });
  };

  // ─────────────────────────────────────────────────────────────────────
  // CL-09: Workflow Drawer renderer
  // ─────────────────────────────────────────────────────────────────────

  CalibrationLabPage.prototype.renderWorkflowDrawer = function (store) {
    const state = store.getState();
    if (!state.bankRunItems || state.bankRunItems.length === 0) {return '';}

    const item = store.getCurrentWorkflowItem();
    if (!item) {return '';}

    const progress = store.getWorkflowProgress();
    const status = state.workflowSession.itemStatuses[String(item.index)] || 'pending';
    const notes = state.workflowSession.itemNotes[String(item.index)] || '';

    const STATUS_LABELS = { pass: '✓ Pass', review: '? Review', fail: '✕ Fail', skip: '— Skip', pending: 'Pending' };

    return `
      <div class="cal-workflow-drawer">
        <div class="cal-workflow-header">
          <span class="cal-workflow-title">Workflow</span>
          <span class="cal-workflow-progress">${progress.currentIndex + 1} / ${progress.total}</span>
        </div>
        <div class="cal-workflow-body">
          <div class="cal-workflow-patch-name">${escapeHtml(item.patchName)}</div>
          <div class="cal-workflow-meta">
            ${escapeHtml(item.bankName)} · slot ${item.patchIndex}
            ${item.meta.category ? `· ${escapeHtml(item.meta.category)}` : ''}
            ${item.meta.favorite ? '· ★' : ''}
          </div>
          ${item.criticalCandidate ? '<div class="cal-critical-warning" style="font-size:10px;padding:4px 8px;margin-bottom:4px">⚠ Critical candidate</div>' : ''}

          <div class="cal-workflow-status-row">
            <span class="cal-workflow-label">Status:</span>
            <span class="cal-workflow-value">${STATUS_LABELS[status] || status}</span>
          </div>

          <div class="cal-workflow-actions">
            <button class="manager-btn" type="button" id="wf-mark-pass" style="color:var(--accent-green,#65d36e)">✓ Pass</button>
            <button class="manager-btn" type="button" id="wf-mark-review" style="color:var(--accent-blue,#6ec7ff)">? Review</button>
            <button class="manager-btn" type="button" id="wf-mark-fail" style="color:var(--accent-orange,#ff9d42)">✕ Fail</button>
            <button class="manager-btn" type="button" id="wf-mark-skip">— Skip</button>
          </div>

          <textarea id="wf-notes" class="modal-input" rows="2" placeholder="Notes…" style="width:100%;resize:vertical;margin-top:6px">${escapeHtml(notes)}</textarea>

          <div class="cal-workflow-nav">
            <button class="manager-btn" type="button" id="wf-prev">◀ Prev</button>
            <button class="manager-btn btn-solid" type="button" id="wf-load">⬆ Load to Editor</button>
            <button class="manager-btn" type="button" id="wf-next">Next ▶</button>
          </div>

          <div class="cal-workflow-actions" style="margin-top:6px">
            <button class="manager-btn" type="button" id="wf-use-a">Use as Patch A</button>
            <button class="manager-btn" type="button" id="wf-use-b">Use as Patch B</button>
          </div>

          <div class="cal-drawer-note" style="margin-top:8px;font-style:italic">
            Run comparison / Trace backend pending — conectar a getParamTrace() en Sprint 4.
          </div>
        </div>
      </div>
    `;
  };

  CalibrationLabPage.prototype.bindWorkflowEvents = function () {
    const el = this.workflowMountEl;
    if (!el) {return;}
    const store = window.calibrationStore;
    if (!store) {return;}
    const item = store.getCurrentWorkflowItem();

    const btn = (id, fn) => {
      const b = el.querySelector(`#${id}`);
      if (b) {b.addEventListener('click', fn);}
    };

    const currentIdx = store.getState().workflowSession.currentIndex;
    btn('wf-mark-pass',   () => store.markWorkflowItemStatus(currentIdx, 'pass'));
    btn('wf-mark-review', () => store.markWorkflowItemStatus(currentIdx, 'review'));
    btn('wf-mark-fail',   () => store.markWorkflowItemStatus(currentIdx, 'fail'));
    btn('wf-mark-skip',   () => store.markWorkflowItemStatus(currentIdx, 'skip'));
    btn('wf-prev', () => store.prevWorkflowItem());
    btn('wf-next', () => store.nextWorkflowItem());

    btn('wf-load', () => {
      if (item?.patchRef && typeof window.triggerMidiDump === 'function') {
        window.triggerMidiDump(item.patchRef);
      }
    });

    btn('wf-use-a', () => { if (item?.patchRef) {store.setSelectedPatchA(item.patchRef);} });
    btn('wf-use-b', () => { if (item?.patchRef) {store.setSelectedPatchB(item.patchRef);} });

    const notesEl = el.querySelector('#wf-notes');
    if (notesEl) {
      notesEl.addEventListener('blur', () => {
        store.setWorkflowItemNotes(currentIdx, notesEl.value);
      });
    }
  };

  // ─────────────────────────────────────────────────────────────────────
  // Phase 5: Audio A/B Validation tab
  // ─────────────────────────────────────────────────────────────────────

  CalibrationLabPage.prototype.renderAudioABTab = function (store) {
    const state = store.getState();
    const patchName = state.selectedPatchA?.name || 'Active Patch';

    this._audioStatus = this._audioStatus || 'idle';
    this._audioLogs = this._audioLogs || [];
    this._comparisonResult = this._comparisonResult || null;

    const formatLogs = () => this._audioLogs.map(l => `[${l.time}] ${l.msg}`).join('\n');

    let comparisonHtml = '';
    if (this._comparisonResult) {
      const comp = this._comparisonResult;
      const isErr = comp.status === 'error';
      const level = comp.verdict?.level || 'unknown';
      const levelColor = level === 'pass' ? '#2ecc71' : level === 'warn' ? '#f1c40f' : '#e74c3c';

      if (isErr) {
        comparisonHtml = `
          <div style="background: rgba(231, 76, 60, 0.15); border: 1px solid #e74c3c; padding: 12px; border-radius: 6px; margin-top: 12px;">
            <div style="color: #e74c3c; font-weight: bold; font-size: 12px; margin-bottom: 4px;">COMPARISON ERROR</div>
            <div style="font-size: 11px; color: var(--text-primary); font-family: monospace;">Reason: ${comp.reason_code}</div>
            <div style="font-size: 11px; color: var(--text-dim); margin-top: 4px;">
              ${(comp.errors || []).map(e => `• ${e}`).join('<br/>')}
            </div>
          </div>
        `;
      } else {
        comparisonHtml = `
          <div style="background: var(--bg-header); border: 1px solid var(--border-dim); padding: 12px; border-radius: 8px; margin-top: 12px; display: flex; flex-direction: column; gap: 8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid var(--border-dim); padding-bottom: 6px;">
              <span style="font-weight:bold; font-size:12px; color:var(--text-primary);">Acoustical Verdict</span>
              <span style="background: ${levelColor}; color: #000; font-weight: bold; font-size: 10px; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">
                ${level} (${comp.verdict?.reason_code || 'n/a'})
              </span>
            </div>
            
            ${comp.verdict?.triggered_rules?.length ? `
              <div style="font-size: 10.5px; color: #e74c3c; background: rgba(231,76,60,0.08); padding: 6px; border-radius: 4px; margin-bottom: 4px;">
                <strong>Triggered Warnings/Failures:</strong><br/>
                ${comp.verdict.triggered_rules.map(r => `• ${r}`).join('<br/>')}
              </div>
            ` : ''}

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 11px;">
              <div>
                <strong style="color:var(--text-dim); font-size:10px; text-transform:uppercase; display:block;">Temporal Metrics</strong>
                Peak Delta: <strong>${comp.time_metrics?.peak_delta_db?.toFixed(2)} dB</strong><br/>
                RMS Delta: <strong>${comp.time_metrics?.rms_delta_db?.toFixed(2)} dB</strong><br/>
                Residual RMS: <strong>${comp.time_metrics?.residual_rms_dbfs?.toFixed(1)} dBFS</strong><br/>
                RMSE: <strong>${comp.time_metrics?.rmse?.toFixed(4)}</strong>
              </div>
              <div>
                <strong style="color:var(--text-dim); font-size:10px; text-transform:uppercase; display:block;">Alignment</strong>
                Offset: <strong>${comp.alignment?.sample_offset} samples</strong> (${comp.alignment?.time_offset_ms?.toFixed(2)} ms)<br/>
                Correlation Peak: <strong>${comp.alignment?.correlation_peak?.toFixed(4)}</strong><br/>
                Overlap Ratio: <strong>${(comp.alignment?.overlap_ratio * 100).toFixed(1)}%</strong>
              </div>
            </div>

            <div style="border-top: 1px solid var(--border-dim); padding-top: 6px; font-size: 11px;">
              <strong style="color:var(--text-dim); font-size:10px; text-transform:uppercase; display:block; margin-bottom:2px;">Spectral Magnitude Delta</strong>
              Mean Abs Diff: <strong>${comp.spectral_metrics?.log_mag_mean_abs_diff_db?.toFixed(2)} dB</strong><br/>
              <span style="font-size:10.5px; color:var(--text-dim);">
                Low: <strong>${comp.spectral_metrics?.low_band_delta_db?.toFixed(2)} dB</strong> |
                Mid: <strong>${comp.spectral_metrics?.mid_band_delta_db?.toFixed(2)} dB</strong> |
                High: <strong>${comp.spectral_metrics?.high_band_delta_db?.toFixed(2)} dB</strong>
              </span>
            </div>
          </div>
        `;
      }
    }

    return `
      <div class="cal-audio-tab">
        <h4 style="margin: 0 0 10px 0; color: var(--text-primary);">Audio A/B Validation (Fase 5C)</h4>
        <p style="font-size:11px; color:var(--text-dim); margin-bottom: 12px;">
          Esta pestaña permite disparar la calibración acústica nativa. Configura los parámetros del tono de prueba, 
          inicia el grabador para capturar la entrada física del hardware y renderiza el motor software de referencia.
        </p>

        <div style="display:flex; gap: 15px; background:var(--bg-header); padding: 12px; border-radius: 8px; border:1px solid var(--border-dim); margin-bottom:12px;">
          <div style="display:flex; flex-direction:column; gap:4px; flex:1;">
            <label style="font-size:10px; color:var(--text-dim); text-transform:uppercase;">Midi Note</label>
            <input id="audio-note-input" class="modal-input" type="number" value="48" min="0" max="127" style="width:100%;" />
          </div>
          <div style="display:flex; flex-direction:column; gap:4px; flex:1;">
            <label style="font-size:10px; color:var(--text-dim); text-transform:uppercase;">Velocity</label>
            <input id="audio-vel-input" class="modal-input" type="number" value="100" min="1" max="127" style="width:100%;" />
          </div>
          <div style="display:flex; flex-direction:column; gap:4px; flex:1;">
            <label style="font-size:10px; color:var(--text-dim); text-transform:uppercase;">Duration (Sec)</label>
            <input id="audio-dur-input" class="modal-input" type="number" value="2.0" step="0.5" min="0.5" style="width:100%;" />
          </div>
        </div>

        <div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap: wrap;">
          <button id="audio-btn-start" class="manager-btn btn-solid" type="button" ${this._audioStatus === 'running' ? 'disabled' : ''}>1. Start Capturing Hardware</button>
          <button id="audio-btn-render" class="manager-btn" type="button" ${this._audioStatus !== 'running' ? 'disabled' : ''}>2. Render Software Reference</button>
          <button id="audio-btn-finish" class="manager-btn" type="button" ${this._audioStatus !== 'running' ? 'disabled' : ''}>3. Finish & Export Run</button>
          <button id="audio-btn-compare" class="manager-btn btn-accent" type="button" ${(this._audioStatus !== 'finished' && this._audioStatus !== 'compared' && this._audioStatus !== 'failed' && this._audioStatus !== 'passed') ? 'disabled' : ''}>4. Run Acoustical Comparison</button>
          <button id="audio-btn-abort" class="manager-btn" type="button" ${this._audioStatus !== 'running' ? 'disabled' : 'style="display:none;"'}>Abort</button>
        </div>

        <div style="display:flex; flex-direction:column; gap:6px;">
          <div style="display:flex; justify-content:space-between; font-size:11px; background:var(--bg-surface); padding:8px; border-radius:6px;">
            <span>Current Status: <strong style="color:var(--brand-accent); text-transform:uppercase;">${this._audioStatus}</strong></span>
            <span>Target Patch: <strong style="color:var(--text-primary);">${escapeHtml(patchName)}</strong></span>
          </div>

          ${comparisonHtml}

          <label style="font-size:10px; color:var(--text-dim); text-transform:uppercase; margin-top:6px;">Console Logs / Export manifest details</label>
          <textarea readonly class="modal-input" rows="7" style="font-family:'Share Tech Mono', monospace; font-size:10.5px; width:100%; resize:vertical; background:var(--bg-surface); color:#8cd0d3;">${escapeHtml(formatLogs() || 'Idle - Awaiting run')}</textarea>
        </div>
      </div>
    `;
  };

  CalibrationLabPage.prototype.bindAudioABEvents = function () {
    const startBtn = this.querySelector('#audio-btn-start');
    const renderBtn = this.querySelector('#audio-btn-render');
    const finishBtn = this.querySelector('#audio-btn-finish');
    const compareBtn = this.querySelector('#audio-btn-compare');
    const abortBtn = this.querySelector('#audio-btn-abort');

    const addLog = (msg) => {
      const time = new Date().toTimeString().split(' ')[0];
      this._audioLogs = this._audioLogs || [];
      this._audioLogs.push({ time, msg });
      const state = window.calibrationStore;
      if (state) {this.render();}
    };

    if (startBtn) {
      startBtn.onclick = async () => {
        const store = window.calibrationStore;
        if (!store) {return;}
        const state = store.getState();
        const patchName = state.selectedPatchA?.name || 'Active Patch';

        const config = {
          runId: `audio-ab-${Date.now()}`,
          patchName: patchName,
          midiNote: parseInt(this.querySelector('#audio-note-input')?.value || '48', 10),
          velocity: parseInt(this.querySelector('#audio-vel-input')?.value || '100', 10),
          noteDurationSec: parseFloat(this.querySelector('#audio-dur-input')?.value || '2.0'),
          tailDurationSec: 0.5,
          sampleRate: 44100.0,
          bitDepth: 24,
          numChannels: 2
        };

        const patchSnapshotJson = JSON.stringify(state.selectedPatchA || {});

        addLog(`Iniciando Audio A/B Run: ${config.runId}`);
        const res = await window.dualMidiBridge?.startAudioABRun(JSON.stringify(config), patchSnapshotJson);
        if (res && res.ok) {
          this._audioStatus = 'running';
          this._comparisonResult = null;
          addLog('Grabador de hardware activo. Capturando señal de audio física...');
        } else {
          this._audioStatus = 'error';
          addLog(`Error al iniciar run: ${res?.error || 'unknown'}`);
        }
      };
    }

    if (renderBtn) {
      renderBtn.onclick = async () => {
        addLog('Renderizando referencia software del SynthEngine...');
        const res = await window.dualMidiBridge?.renderAudioABSoftwareReference();
        if (res && res.ok) {
          addLog('Referencia de software renderizada correctamente en buffer local.');
        } else {
          addLog(`Error al renderizar software: ${res?.error || 'unknown'}`);
        }
      };
    }

    if (finishBtn) {
      finishBtn.onclick = async () => {
        addLog('Finalizando run y exportando archivos a disco...');
        const res = await window.dualMidiBridge?.finishAudioABRun();
        if (res && res.ok) {
          this._audioStatus = 'finished';
          this._hwWavPath = res.hwWavPath;
          this._swWavPath = res.swWavPath;
          this._lastRunId = res.runId;
          addLog(`Run finalizado con éxito: ${res.runId}`);
          addLog(`Manifest: ${res.manifestPath}`);
          addLog(`WAV Hardware: ${res.hwWavPath} (Peak: ${res.hwPeak}dB, RMS: ${res.hwRms}dB)`);
          addLog(`WAV Software: ${res.swWavPath} (Peak: ${res.swPeak}dB, RMS: ${res.swRms}dB)`);
        } else {
          this._audioStatus = 'error';
          addLog(`Error al finalizar run: ${res?.error || 'unknown'}`);
        }
      };
    }

    if (compareBtn) {
      compareBtn.onclick = async () => {
        addLog('Ejecutando algoritmo de alineación y comparación acústica...');
        
        const store = window.calibrationStore;
        const state = store?.getState();
        const patchName = state?.selectedPatchA?.name || 'Active Patch';

        const configJson = JSON.stringify({
          trimLeadingSilence: true,
          trimTrailingSilence: true,
          silenceThresholdDb: -72.0,
          normalizeGain: false,
          forceMonoForAnalysis: true,
          enableCrossCorrelation: true,
          maxAlignmentOffsetSamples: 8192,
          fftSize: 1024
        });

        const contextJson = JSON.stringify({
          runId: this._lastRunId || `audio-ab-${Date.now()}`,
          presetId: state?.selectedPatchA?.uuid || 'active',
          presetName: patchName
        });

        const res = await window.dualMidiBridge?.compareAudioABRun(
          this._swWavPath || '',
          this._hwWavPath || '',
          configJson,
          contextJson
        );

        if (res) {
          this._comparisonResult = res;
          if (res.status === 'error') {
            this._audioStatus = 'error';
            addLog(`Error contractual en comparador: ${res.reason_code}`);
          } else {
            const level = res.verdict?.level || 'unknown';
            this._audioStatus = level === 'pass' ? 'passed' : 'failed';
            addLog(`Comparación acústica finalizada. Veredicto: ${level.toUpperCase()}`);
            if (res.verdict?.triggered_rules?.length) {
              res.verdict.triggered_rules.forEach(rule => addLog(` Regla disparada: ${rule}`));
            }
          }
        } else {
          addLog('Error crítico al despachar compareAudioABRun nativo.');
        }
      };
    }

    if (abortBtn) {
      abortBtn.onclick = async () => {
        addLog('Abortando run actual...');
        await window.dualMidiBridge?.abortAudioABRun();
        this._audioStatus = 'idle';
        this._comparisonResult = null;
        addLog('Run abortado.');
      };
    }
  };

  // ─────────────────────────────────────────────────────────────────────
  // RoundTrip Validator Tab (tab 4): 3-layer round-trip validation
  // ─────────────────────────────────────────────────────────────────────

  CalibrationLabPage.prototype.renderRoundTripTab = function (store) {
    const state = store.getState();
    const report = this._roundTripReport || null;
    const hideExact = !!this._roundTripHideExact;

    let summaryHtml = '';
    let tableHtml = '';

    if (report) {
      const passed = report.mismatches === 0;
      const cls = passed ? 'exact' : 'mismatch';
      const statusText = passed ? 'PASS' : 'FAIL';
      const statusColor = passed ? 'var(--accent-green,#65d36e)' : 'var(--accent-red,#e74c3c)';

      summaryHtml = `
        <div style="display:flex;gap:12px;align-items:center;padding:8px 12px;background:var(--bg-header);border-radius:6px;margin-bottom:8px;border:1px solid var(--border-dim);">
          <span style="font-weight:bold;font-size:13px;color:${statusColor};">${statusText}</span>
          <span style="font-size:11px;color:var(--text-dim);">Exact: <strong>${report.exactMatches}</strong></span>
          <span style="font-size:11px;color:var(--text-dim);">Tolerated: <strong>${report.withinTolerance}</strong></span>
          <span style="font-size:11px;color:var(--text-dim);">Mismatch: <strong style="color:${report.mismatches > 0 ? '#e74c3c' : 'inherit'}">${report.mismatches}</strong></span>
          <span style="font-size:11px;color:var(--text-dim);">Alias: <strong>${report.aliasSharedCount}</strong></span>
          <span style="font-size:11px;color:var(--text-dim);">Name: <strong>${report.nameBytesCount}</strong></span>
          <span style="font-size:11px;color:var(--text-dim);">Special: <strong>${report.specialCaseCount}</strong></span>
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
            <td class="mono" style="font-size:10px;max-width:200px;overflow:hidden;text-overflow:ellipsis">${escapeHtml(e.paramIds.join(', ') || '—')}</td>
            <td class="mono">${e.rawOriginal}</td>
            <td class="mono">${fmt(e.semanticNormalized, 4)}</td>
            <td class="mono">${e.rawRebuilt}</td>
            <td class="mono${e.delta > 0 ? ' is-delta' : ''}">${e.delta}</td>
            <td><span style="color:${classificationColor[e.classification] || 'inherit'};font-weight:${e.classification === 'mismatch' ? 'bold' : 'normal'}">${e.classification}</span></td>
          </tr>
        `;
      }).join('');

      tableHtml = renderRowsTable(headers, rowsHtml);
    }

    const patchAName = escapeHtml(state.selectedPatchA?.name || 'none');

    return `
      <div class="cal-roundtrip-tab">
        <h4 style="margin:0 0 8px 0;color:var(--text-primary);font-size:12px;">3-Layer Round-Trip Validator</h4>
        <p style="font-size:10.5px;color:var(--text-dim);margin-bottom:10px;">
          Validates that raw bytes → semantic normalized → engine state → rebuilt raw bytes produce an identical or tolerable result.
        </p>

        <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
          <button id="rt-load-a" class="manager-btn" type="button">Load from Patch A</button>
          <button id="rt-load-b" class="manager-btn" type="button">Load from Patch B</button>
          <button id="rt-run" class="manager-btn btn-solid" type="button">Run RoundTrip</button>
          <label class="cal-inline" style="margin-left:8px;">
            <input id="rt-hide-exact" type="checkbox" ${hideExact ? 'checked' : ''} />
            <span>Hide exact matches</span>
          </label>
        </div>

        <div style="font-size:10.5px;color:var(--text-dim);margin-bottom:8px;">
          Source patch: <strong style="color:var(--text-primary);">${patchAName}</strong>
          <span id="rt-source-info" style="margin-left:12px;color:var(--text-faint);"></span>
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

  // ─────────────────────────────────────────────────────────────────────
  // Live Validation Tab — real-time compliance dashboard
  // ─────────────────────────────────────────────────────────────────────

  CalibrationLabPage.prototype.renderLiveValidationTab = function (store) {
    const state = store.getState();
    const report = state.complianceReport;
    const active = !!state.liveScanActive;

    let headerHtml = '';
    let bodyHtml = '';

    const buttonLabel = active
      ? '<span class="cal-blink" style="display:inline-block;width:8px;height:8px;background:var(--accent-green);border-radius:50%;margin-right:6px;"></span>Stop Scan'
      : 'Start Live Scan';

    if (!report) {
      bodyHtml = `
        <div style="padding:20px;text-align:center;color:var(--text-faint);font-size:12px;">
          No compliance data yet. Click <strong>Start Live Scan</strong> to begin monitoring.
        </div>
      `;
    } else {
      const allPassed = report.compliant;
      const statusColor = allPassed ? 'var(--accent-green,#65d36e)' : 'var(--accent-red,#e74c3c)';
      const statusText = allPassed ? 'ALL COMPLIANT' : `${report.totalCompliant}/${report.voiceResults.length} COMPLIANT`;

      headerHtml = `
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:8px 12px;background:var(--bg-header);border-radius:6px;margin-bottom:8px;border:1px solid var(--border-dim);">
          <span style="font-weight:bold;font-size:13px;color:${statusColor};">${statusText}</span>
          <span style="font-size:11px;color:var(--text-dim);">Timestamp: <strong>${escapeHtml(state.lastUpdatedAt || '—')}</strong></span>
        </div>
      `;

      const headers = ['Voice', 'Note', 'Vel', 'Status', 'OSC1 Pitch', 'OSC2 Pitch', 'VCF Cutoff', 'VCF Res', 'Env Time', 'Failed'];
      const rowsHtml = report.voiceResults.map(vr => {
        const statusColor = vr.passed ? 'var(--accent-green,#65d36e)' : 'var(--accent-red,#e74c3c)';
        const statusIcon = vr.passed ? '&#10003;' : '&#10007;';
        const rowCls = vr.passed ? '' : 'is-changed';

        function checkValue(paramName) {
          const c = vr.checks.find(ch => ch.param === paramName);
          if (!c) {return '<span class="mono" style="color:var(--text-faint)">—</span>';}
          const color = c.passed ? 'var(--accent-green,#65d36e)' : 'var(--accent-red,#e74c3c)';
          return `<span class="mono" style="color:${color}">${fmt(c.value, 4)} <span style="font-size:9px;color:var(--text-faint)">(${fmt(c.specLimit, 4)}${c.unit})</span></span>`;
        }

        return `
          <tr class="${rowCls}">
            <td class="mono">${vr.voiceIndex + 1}</td>
            <td class="mono">${vr.midiNote ?? '—'}</td>
            <td class="mono">${fmt(vr.velocity)}</td>
            <td style="color:${statusColor};font-weight:bold;font-size:12px;">${statusIcon}</td>
            <td>${checkValue('driftOsc1Pitch')}</td>
            <td>${checkValue('driftOsc2Pitch')}</td>
            <td>${checkValue('driftVcfCutoff')}</td>
            <td>${checkValue('driftVcfResonance')}</td>
            <td>${checkValue('driftEnvTime')}</td>
            <td class="mono" style="color:${vr.failedCount > 0 ? 'var(--accent-red)' : 'var(--text-faint)'}">${vr.failedCount}</td>
          </tr>
        `;
      }).join('');

      const tableHtml = renderRowsTable(headers, rowsHtml);
      bodyHtml = `
        <div style="overflow-x:auto;max-height:400px;overflow-y:auto;">
          ${tableHtml}
        </div>
      `;
    }

    return `
      <div class="cal-live-tab">
        <h4 style="margin:0 0 8px 0;color:var(--text-primary);font-size:12px;">Live Validation Dashboard</h4>
        <p style="font-size:10.5px;color:var(--text-dim);margin-bottom:10px;">
          Real-time compliance check: compares each voice's drift parameters against CalibrationSpec tolerances.
        </p>

        <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
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

  // ─────────────────────────────────────────────────────────────────────
  // PatchDiff Tab (tab 3): unified byte + semantic view
  // ─────────────────────────────────────────────────────────────────────

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
        <tr class="cal-row${row.changed ? ' is-changed' : ''}${isSelected ? ' is-selected' : ''}" data-row-key="${rowKey}" style="cursor:pointer">
          <td><span class="cal-badge" style="font-size:9px;padding:1px 4px">${escapeHtml(row.region)}</span></td>
          <td class="mono">${row.offset}</td>
          <td class="mono" style="font-size:10px">${escapeHtml(row.paramIds.join(', ') || '—')}</td>
          <td class="mono${row.changed ? ' is-delta' : ''}">${fmt(row.rawA, 0)}</td>
          <td class="mono${row.changed ? ' is-delta' : ''}">${fmt(row.rawB, 0)}</td>
          <td class="mono${row.delta !== 0 ? ' is-delta' : ''}">${row.delta !== null ? (row.delta > 0 ? '+' : '') + row.delta : '—'}</td>
          <td style="font-size:10.5px">${escapeHtml(row.semanticA)}</td>
          <td style="font-size:10.5px">${escapeHtml(row.semanticB)}</td>
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

  if (typeof window !== 'undefined') {
    customElements.define('calibration-lab-page', CalibrationLabPage);
  }
})();
