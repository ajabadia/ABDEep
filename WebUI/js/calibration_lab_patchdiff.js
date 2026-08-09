// WebUI/js/calibration_lab_patchdiff.js — Patch diff data collection and classification
// Extracted from calibration_lab_utils.js

function getByteMaps() {
  const bridge = getBridge() || {};
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

// ────────────────────────────────────────────────────────────────
// PatchDiff: region classification (matches C++ PatchDiffEngine::classifyByteOffset)
// ────────────────────────────────────────────────────────────────
function classifyRegion(offset) {
  if (offset >= 0 && offset <= 20)      {return 'OSC1';}
  if (offset >= 21 && offset <= 38)     {return 'OSC2';}
  if (offset === 40)                    {return 'HPF';}
  if (offset === 39 || offset === 41 || (offset >= 42 && offset <= 44)) {return 'VCF';}
  if (offset >= 88 && offset <= 90)     {return 'Drift';}
  if (offset >= 165 && offset <= 219)   {return 'FX';}
  if (offset >= 223 && offset <= 238)   {return 'Program Name';}
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

globalThis.getByteMaps = getByteMaps;
globalThis.collectRawRows = collectRawRows;
globalThis.collectPatchDiffRows = collectPatchDiffRows;
globalThis.collectSemanticRows = collectSemanticRows;
globalThis.classifyRegion = classifyRegion;
globalThis.renderSemanticValue = renderSemanticValue;
