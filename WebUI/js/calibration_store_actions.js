/**
 * @purpose Calibration Store Actions — state-mutating methods extracted from calibration_store.js.
 * Each action receives (api, ctx) where ctx = { state, setState, getBridgeMaps, bridge }.
 * The `api` parameter allows self-referencing calls (e.g. startLiveScan → updateLiveScan).
 *
 * @depends calibration_store_utils.js (deepClone, DEFAULT_STATE, DEFAULT_CALIBRATION_SPEC,
 *   normalizeSnapshot, validateLiveCompliance, nowIso, isObject)
 * @depends calibration_store_selectors.js (getCurrentWorkflowItem, buildWorkflowProgress)
 * @depends calibration_store_selectors_bank.js (buildAllCandidatePatches, buildStratifiedRunItems,
 *   buildWorkflowReportSnapshot, buildReportRows)
 */

(function () {
  'use strict';

  const Logger = globalThis.Logger || console;

  /**
   * Action registry — each function receives (api, ctx) and returns the appropriate value.
   * When `api` or `ctx` is unused in a function body, the parameter is suffixed with _.
   * This avoids `(void)` expressions which some bundlers reject.
   * @type {Object<string, function>}
   */
  const actions = {
    // ── Live validation ──

    startLiveScan: function (api, ctx) {
      if (ctx.state.liveScanTimerId) { return; }
      const timerId = setInterval(function () {
        api.updateLiveScan();
      }, 250);
      ctx.setState({ liveScanTimerId: timerId });
      api.updateLiveScan();
    },

    stopLiveScan: function (api_, ctx) {
      if (ctx.state.liveScanTimerId) {
        clearInterval(ctx.state.liveScanTimerId);
      }
      ctx.setState({ liveScanTimerId: null });
    },

    updateLiveScan: async function (api_, ctx) {
      if (!ctx.bridge || typeof ctx.bridge.getDiagnosticSnapshot !== 'function') { return; }
      try {
        const raw = await ctx.bridge.getDiagnosticSnapshot();
        const normalized = normalizeSnapshot(raw);
        const spec = ctx.state.calibrationSpec || DEFAULT_CALIBRATION_SPEC;
        const report = validateLiveCompliance(normalized, spec);
        ctx.setState({
          complianceReport: report,
          diagnosticSnapshot: normalized,
          snapshotStatus: 'ready',
          lastUpdatedAt: nowIso(),
        });
      } catch (err) {
        // silent
      }
    },

    // ── Diagnostic snapshots ──

    loadDiagnosticSnapshot: async function (api_, ctx) {
      ctx.setState({ snapshotStatus: 'loading', snapshotError: null });

      try {
        if (!ctx.bridge || typeof ctx.bridge.getDiagnosticSnapshot !== 'function') {
          throw new Error('dualMidiBridge.getDiagnosticSnapshot() no disponible');
        }

        if (typeof ctx.bridge.waitForReady === 'function') {
          await ctx.bridge.waitForReady(3000);
        }

        const raw = await ctx.bridge.getDiagnosticSnapshot();
        const normalized = normalizeSnapshot(raw);

        ctx.setState({
          diagnosticSnapshot: normalized,
          snapshotStatus: 'ready',
          snapshotError: null,
          lastUpdatedAt: nowIso(),
        });

        return normalized;
      } catch (error) {
        ctx.setState({
          snapshotStatus: 'error',
          snapshotError: error && error.message !== undefined ? error.message : String(error),
        });
        return null;
      }
    },

    // ── Bank run management ──

    buildStratifiedRun: function (api_, ctx, config) {
      const maps = ctx.getBridgeMaps();
      const critParams = globalThis.CRITICAL_PARAM_IDS || new Set([
        'vcfcutoff', 'vcfresonance', 'vcfenvdepth', 'hpfcutoff',
        'vcfpolemode', 'voicedrift', 'oscdrift',
      ]);
      const tempConfig = { ...ctx.state.bankRunConfig, ...(config || {}) };
      const tempState = { ...ctx.state, bankRunConfig: tempConfig };
      return buildStratifiedRunItems(
        tempState, maps, critParams,
        globalThis.seededShuffle,
        globalThis.filterCandidatePatches
      );
    },

    getAllCandidatePatches: function (api_, ctx) {
      const banks = (typeof window !== 'undefined' && window.loadedBanks) || {};
      return buildAllCandidatePatches(banks);
    },

    filterCandidatePatches: function (api_, ctx_, candidates, config) {
      if (typeof globalThis.filterCandidatePatches === 'function') {
        return globalThis.filterCandidatePatches(candidates, config);
      }
      return candidates || [];
    },

    seededShuffle: function (api_, ctx_, items, seed) {
      if (typeof globalThis.seededShuffle === 'function') {
        return globalThis.seededShuffle(items, seed);
      }
      return [].concat(items || []);
    },

    setBankRunConfig: function (api_, ctx, partial) {
      ctx.setState({ bankRunConfig: { ...ctx.state.bankRunConfig, ...(partial || {}) } });
    },

    generateBankRun: function (api_, ctx) {
      const maps = ctx.getBridgeMaps();
      const critParams = globalThis.CRITICAL_PARAM_IDS || new Set([
        'vcfcutoff', 'vcfresonance', 'vcfenvdepth', 'hpfcutoff',
        'vcfpolemode', 'voicedrift', 'oscdrift',
      ]);
      const items = buildStratifiedRunItems(
        ctx.state, maps, critParams,
        globalThis.seededShuffle,
        globalThis.filterCandidatePatches
      );
      const runId = items.length > 0 ? items[0].runId : 'run-empty-' + Date.now();
      ctx.setState({ bankRunItems: items, bankRunId: runId });
      return items;
    },

    clearBankRun: function (api_, ctx) {
      ctx.setState({ bankRunItems: [], bankRunId: null });
      if (ctx.state.workflowSession.runId === ctx.state.bankRunId) {
        ctx.setState({ workflowSession: deepClone(DEFAULT_STATE.workflowSession) });
      }
    },

    // ── Workflow session ──

    startWorkflowSession: function (api_, ctx, runId) {
      const targetRunId = runId || ctx.state.bankRunId;
      ctx.setState({
        workflowSession: {
          runId: targetRunId,
          currentIndex: 0,
          startedAt: nowIso(),
          completedAt: null,
          itemStatuses: {},
          itemNotes: {},
        },
      });
    },

    selectWorkflowIndex: function (api_, ctx, index) {
      const max = Math.max(0, ctx.state.bankRunItems.length - 1);
      const safe = Math.max(0, Math.min(max, Number(index) || 0));
      ctx.setState({ workflowSession: { ...ctx.state.workflowSession, currentIndex: safe } });
    },

    nextWorkflowItem: function (api, ctx) {
      const next = ctx.state.workflowSession.currentIndex + 1;
      if (next < ctx.state.bankRunItems.length) { api.selectWorkflowIndex(next); }
    },

    prevWorkflowItem: function (api, ctx) {
      const prev = ctx.state.workflowSession.currentIndex - 1;
      if (prev >= 0) { api.selectWorkflowIndex(prev); }
    },

    markWorkflowItemStatus: function (api_, ctx, index, status) {
      const VALID = ['pass', 'review', 'fail', 'skip', 'pending'];
      if (VALID.indexOf(status) === -1) { return; }
      const newStatuses = {
        ...ctx.state.workflowSession.itemStatuses,
        [String(index)]: status,
      };
      const newItems = ctx.state.bankRunItems.map(function (item) {
        return item.index === index ? { ...item, status: status } : item;
      });
      ctx.setState({
        bankRunItems: newItems,
        workflowSession: { ...ctx.state.workflowSession, itemStatuses: newStatuses },
      });
    },

    setWorkflowItemNotes: function (api_, ctx, index, notes) {
      const noteStr = String(notes || '');
      const newNotes = {
        ...ctx.state.workflowSession.itemNotes,
        [String(index)]: noteStr,
      };
      const newItems = ctx.state.bankRunItems.map(function (item) {
        return item.index === index ? { ...item, notes: noteStr } : item;
      });
      ctx.setState({
        bankRunItems: newItems,
        workflowSession: { ...ctx.state.workflowSession, itemNotes: newNotes },
      });
    },

    getCurrentWorkflowItem: function (api_, ctx) {
      return getCurrentWorkflowItem(ctx.state);
    },

    getWorkflowProgress: function (api_, ctx) {
      return buildWorkflowProgress(ctx.state);
    },

    // ── Report / Export ──

    getWorkflowReportSnapshot: function (api_, ctx) {
      return buildWorkflowReportSnapshot(ctx.state);
    },

    buildReportRows: function (api_, ctx) {
      const snap = buildWorkflowReportSnapshot(ctx.state);
      return buildReportRows(snap);
    },
  };

  // Export to global scope for the calibration_store.js factory
  if (typeof window !== 'undefined') {
    window._calStoreActions = actions;
  }
  if (typeof global !== 'undefined') {
    global._calStoreActions = actions;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { _calStoreActions: actions };
  }
})();
