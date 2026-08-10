// var (no let): los scripts clásicos comparten el global lexical env; un `let
// Logger` top-level colisiona con las declaraciones var Logger de otros scripts
// (SyntaxError: Identifier 'Logger' has already been declared).
// eslint-disable-next-line no-var
var Logger = globalThis.Logger || console;

// WebUI/js/calibration_store.js — Calibration Store factory (reduced)
// Actions extracted to calibration_store_actions.js
// Depends on: calibration_store_utils.js (DEFAULT_STATE, deepClone, etc.)
// Depends on: calibration_store_selectors.js (pure selector functions)
// Depends on: calibration_store_actions.js (window._calStoreActions)

/* global
  deepClone, DEFAULT_STATE,
  nowIso, normalizeSnapshot, validateLiveCompliance,
  getSelectedVoiceSnapshot, buildEngineRows, buildEffectiveRows,
  buildVoiceSummaryRows, buildParamTrace, buildValidationSummary,
  buildAllCandidatePatches, buildStratifiedRunItems, buildWorkflowProgress,
  buildWorkflowReportSnapshot, buildReportRows, getCurrentWorkflowItem
*/

(function () {
  function createCalibrationStore(bridge) {
    let state = deepClone(DEFAULT_STATE);
    const listeners = new Set();

    function emit() {
      const snapshot = api.getState();
      listeners.forEach(function (listener) {
        try {
          listener(snapshot);
        } catch (err) {
          Logger.error('[CalibrationStore] listener error:', err);
        }
      });
    }

    function setState(patch) {
      state = {
        ...state,
        ...patch,
      };
      emit();
    }

    function getBridgeMaps() {
      return (typeof window !== 'undefined' && getBridge())
        ? {
            paramToByteOffset: getBridge().paramToByteOffset || {},
            byteOffsetToParamIds: getBridge().byteOffsetToParamIds || {},
          }
        : { paramToByteOffset: {}, byteOffsetToParamIds: {} };
    }

    // State ref object for external setters
    const stateRef = {
      get: function () { return state; },
      set: function (patch) { setState(patch); },
    };

    // Build context for action delegation
    function actionCtx() {
      return {
        state: state,
        setState: setState,
        getBridgeMaps: getBridgeMaps,
        bridge: bridge,
      };
    }

    const ACTIONS = (typeof window !== 'undefined' && window._calStoreActions) ||
                   (typeof global !== 'undefined' && global._calStoreActions) || {};

    function delegate(name) {
      const fn = ACTIONS[name];
      if (typeof fn !== 'function') {
        Logger.warn('[CalibrationStore] Action "' + name + '" not found in _calStoreActions');
        return function () {};
      }
      return function () {
        return fn(api, actionCtx(), arguments[0], arguments[1], arguments[2], arguments[3]);
      };
    }

const api = {
      // ── Core API ──
      getState: function () {
        return deepClone(state);
      },

      subscribe: function (listener) {
        listeners.add(listener);
        return function unsubscribe() {
          listeners.delete(listener);
        };
      },

      // ── Selectors (inline, delegate to pure functions) ──

      getSelectedVoiceSnapshot: function () {
        return getSelectedVoiceSnapshot(state);
      },

      getEngineRows: function () {
        return buildEngineRows(state.diagnosticSnapshot);
      },

      getEffectiveRowsScoped: function () {
        const voice = getSelectedVoiceSnapshot(state);
        return buildEffectiveRows(voice);
      },

      getVoiceSummaryRows: function () {
        const voice = getSelectedVoiceSnapshot(state);
        return buildVoiceSummaryRows(voice);
      },

      PARAM_TO_VOICE: globalThis.PARAM_VOICE_MAP,

      getParamTrace: function (paramId) {
        return buildParamTrace(paramId, state, globalThis.PARAM_VOICE_MAP || {}, globalThis.classifyRow);
      },

      classifyRow: function (paramId, rawA, rawB) {
        return globalThis.classifyRow(paramId, rawA, rawB);
      },

      getValidationSummary: function () {
        const maps = getBridgeMaps();
        return buildValidationSummary(state, maps, globalThis.CRITICAL_PARAM_IDS || new Set(), globalThis.classifyRow);
      },

      // ── Actions (delegated to calibration_store_actions.js) ──

      startLiveScan: delegate('startLiveScan'),
      stopLiveScan: delegate('stopLiveScan'),
      updateLiveScan: delegate('updateLiveScan'),
      loadDiagnosticSnapshot: delegate('loadDiagnosticSnapshot'),

      buildStratifiedRun: delegate('buildStratifiedRun'),
      getAllCandidatePatches: delegate('getAllCandidatePatches'),
      filterCandidatePatches: delegate('filterCandidatePatches'),
      seededShuffle: delegate('seededShuffle'),
      setBankRunConfig: delegate('setBankRunConfig'),
      generateBankRun: delegate('generateBankRun'),
      clearBankRun: delegate('clearBankRun'),

      startWorkflowSession: delegate('startWorkflowSession'),
      selectWorkflowIndex: delegate('selectWorkflowIndex'),
      nextWorkflowItem: delegate('nextWorkflowItem'),
      prevWorkflowItem: delegate('prevWorkflowItem'),
      markWorkflowItemStatus: delegate('markWorkflowItemStatus'),
      setWorkflowItemNotes: delegate('setWorkflowItemNotes'),
      getCurrentWorkflowItem: delegate('getCurrentWorkflowItem'),
      getWorkflowProgress: delegate('getWorkflowProgress'),

      getWorkflowReportSnapshot: delegate('getWorkflowReportSnapshot'),
      buildReportRows: delegate('buildReportRows'),

      // ── Reset (inline — needs direct state reassignment) ──

      reset: function () {
        state = deepClone(DEFAULT_STATE);
        emit();
      },
    };

    // ── Mix in simple setters (factory inline para evitar dependencia de carga externa) ──
    (function () {
      const validTabs = ['raw', 'semantic', 'engine', 'effective', 'audio-ab', 'patchdiff', 'roundtrip', 'live'];
      const validFilterKeys = ['showOnlyDifferences', 'showOnlyCritical', 'showOnlyAliases', 'search'];

      api.setActiveTab = function (tab) {
        if (validTabs.indexOf(tab) === -1) { return; }
        setState({ activeTab: tab });
      };

      api.setSelectedVoiceIndex = function (index) {
        const safeIndex = Math.max(0, Math.min(11, Number(index) || 0));
        setState({ selectedVoiceIndex: safeIndex });
      };

      api.setSelectedPatchA = function (patch) {
        setState({ selectedPatchA: patch || null });
      };

      api.setSelectedPatchB = function (patch) {
        setState({ selectedPatchB: patch || null });
      };

      api.setFilters = function (partialFilters) {
        const cleaned = {};
        for (let ki = 0; ki < validFilterKeys.length; ki++) {
          const key = validFilterKeys[ki];
          if (partialFilters && key in partialFilters) { cleaned[key] = partialFilters[key]; }
        }
        setState({ filters: { ...state.filters, ...cleaned } });
      };

      api.setSelectedRow = function (key) {
        setState({ selectedRowKey: key || null });
      };

      api.swapPatches = function () {
        const a = state.selectedPatchA;
        const b = state.selectedPatchB;
        setState({ selectedPatchA: b, selectedPatchB: a });
      };

      api.setCalibrationSpec = function (spec) {
        setState({ calibrationSpec: (typeof spec === 'object' && spec !== null) ? spec : null });
      };

      api.setLiveScanActive = function (active) {
        const wasActive = state.liveScanActive;
        if (active && !wasActive) {
          setState({ liveScanActive: true });
          api.startLiveScan();
        } else if (!active && wasActive) {
          api.stopLiveScan();
          setState({ liveScanActive: false, liveScanTimerId: null });
        }
      };

      api.setComplianceReport = function (report) {
        setState({ complianceReport: report });
      };
    })();

    return api;
  }

  if (typeof window !== 'undefined') {
    window.createCalibrationStore = createCalibrationStore;
  }
  if (typeof global !== 'undefined') {
    global.createCalibrationStore = createCalibrationStore;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createCalibrationStore: createCalibrationStore };
  }
})();
