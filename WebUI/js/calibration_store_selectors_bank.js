// WebUI/js/calibration_store_selectors_bank.js
// Bank run & workflow selector functions extracted from calibration_store_selectors.js
// Each function takes state (or specific data) and returns derived data — no side effects, no closure.
// Depends on: calibration_store_utils.js (for deepClone, nowIso)

/* eslint-disable no-unused-vars */

/* global deepClone, nowIso */

// ────────────────────────────────────────────────────────────
// Bank run selectors
// ────────────────────────────────────────────────────────────

function buildAllCandidatePatches(loadedBanks) {
  const banks = loadedBanks || {};
  const candidates = [];
  Object.entries(banks).forEach(([bankName, patchList]) => {
    if (!Array.isArray(patchList)) {return;}
    patchList.forEach((patch, patchIndex) => {
      if (!patch || !patch.unpackedBytes) {return;}
      candidates.push({
        bankName,
        patchIndex,
        patchName: (patch.name || `Patch ${patchIndex + 1}`).trim(),
        patchRef: patch,
        meta: patch.meta || {},
      });
    });
  });
  return candidates;
}

function buildStratifiedRunItems(state, maps, critParams, seededShuffleFn, filterCandidateFn) {
  const cfg = { ...state.bankRunConfig };
  const runId = `run-${Date.now()}-${cfg.seed}`;

  let candidates = buildAllCandidatePatches(
    (typeof window !== 'undefined' && window.loadedBanks) || {}
  );
  candidates = filterCandidateFn(candidates, cfg);

  const shuffled = seededShuffleFn(candidates, cfg.seed);
  const size = Math.max(0, Math.min(shuffled.length, cfg.sampleSize));
  const selected = shuffled.slice(0, size);

  const paramToByteOffset = maps?.paramToByteOffset || {};

  return selected.map((c, index) => {
    const bytes = c.patchRef.unpackedBytes;
    const criticalCandidate = [...critParams].some((paramId) => {
      const off = paramToByteOffset[paramId];
      return Number.isFinite(off) && Number.isFinite(bytes[off]) && bytes[off] !== 0;
    });

    return {
      runId,
      index,
      bankName: c.bankName,
      patchIndex: c.patchIndex,
      patchName: c.patchName,
      patchRef: c.patchRef,
      meta: deepClone(c.meta),
      criticalCandidate,
      status: 'pending',
      notes: '',
    };
  });
}

function buildWorkflowProgress(state) {
  const total = state.bankRunItems.length;
  if (total === 0) {return { total: 0, reviewed: 0, pct: 0 };}
  const statuses = state.workflowSession.itemStatuses;
  const reviewed = Object.values(statuses)
    .filter(s => s !== 'pending').length;
  return {
    total,
    reviewed,
    pct: Math.round((reviewed / total) * 100),
    currentIndex: state.workflowSession.currentIndex,
  };
}

function buildWorkflowReportSnapshot(state) {
  const cfg = deepClone(state.bankRunConfig);
  const session = deepClone(state.workflowSession);
  const items = state.bankRunItems.map((item) => ({
    runId: item.runId,
    index: item.index,
    bankName: item.bankName,
    patchIndex: item.patchIndex,
    patchName: item.patchName,
    meta: deepClone(item.meta),
    criticalCandidate: item.criticalCandidate,
    status: state.workflowSession.itemStatuses[String(item.index)] || item.status,
    notes: state.workflowSession.itemNotes[String(item.index)] || item.notes,
    hasSysexData: Array.isArray(item.patchRef?.unpackedBytes) && item.patchRef.unpackedBytes.length > 0,
  }));

  const progress = buildWorkflowProgress(state);
  const counts = items.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});

  return {
    exportedAt: nowIso(),
    schemaVersion: 1,
    schema_version: '1.0.0',
    runId: state.bankRunId,
    config: cfg,
    session,
    progress,
    statusCounts: counts,
    items,
  };
}

function buildReportRows(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.items)) {return [];}
  return snapshot.items.map((item) => ({
    schema_version: snapshot.schema_version,
    runId: item.runId,
    index: item.index,
    bankName: item.bankName,
    patchIndex: item.patchIndex,
    patchName: item.patchName,
    category: item.meta.category || '',
    favorite: item.meta.favorite ? 'true' : 'false',
    status: item.status,
    criticalCandidate: item.criticalCandidate ? 'true' : 'false',
    latestBadge: '',
    notes: item.notes,
  }));
}

// Export to globalThis for cross-file access (browser <script> + Node.js/Vitest)
globalThis.buildAllCandidatePatches = buildAllCandidatePatches;
globalThis.buildStratifiedRunItems = buildStratifiedRunItems;
globalThis.buildWorkflowProgress = buildWorkflowProgress;
globalThis.buildWorkflowReportSnapshot = buildWorkflowReportSnapshot;
globalThis.buildReportRows = buildReportRows;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buildAllCandidatePatches,
    buildStratifiedRunItems,
    buildWorkflowProgress,
    buildWorkflowReportSnapshot,
    buildReportRows,
  };
}
