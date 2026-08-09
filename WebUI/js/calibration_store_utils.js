// WebUI/js/calibration_store_utils.js
// Core utility functions for Calibration Store — reduced version.
// Data constants → calibration_store_data.js
// Snapshot normalization → calibration_store_normalize.js
// Validation/compliance → calibration_store_validation.js

/* eslint-disable no-unused-vars */

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nowIso() {
  return new Date().toISOString();
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Deterministic shuffle using mulberry32 PRNG.
 * @param {Array} items
 * @param {number} seed
 * @returns {Array}
 */
function seededShuffle(items, seed) {
  const arr = [].concat(items);
  let s = (seed >>> 0) + 0x6d2b79f5;
  function next() {
    s = Math.imul(s ^ (s >>> 15), s | 1);
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
    return ((s ^ (s >>> 14)) >>> 0) / 0x100000000;
  }
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/**
 * Filters candidate patches by bank name, category, and favorites.
 * @param {Array} candidates
 * @param {{bankNames: string[], categoryFilter: string, favoritesOnly: boolean}} config
 * @returns {Array}
 */
function filterCandidatePatches(candidates, config) {
  const bankNames = config.bankNames;
  const categoryFilter = config.categoryFilter;
  const favoritesOnly = config.favoritesOnly;
  return candidates.filter(function(c) {
    if (bankNames.length > 0 && bankNames.indexOf(c.bankName) === -1) { return false; }
    if (favoritesOnly && !c.meta.favorite) { return false; }
    if (categoryFilter) {
      const cat = (c.meta.category || '').toLowerCase();
      if (cat.indexOf(categoryFilter.toLowerCase()) === -1) { return false; }
    }
    return true;
  });
}

// ── Exports ──
globalThis.deepClone = deepClone;
globalThis.nowIso = nowIso;
globalThis.isObject = isObject;
globalThis.seededShuffle = seededShuffle;
globalThis.filterCandidatePatches = filterCandidatePatches;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    deepClone: deepClone,
    nowIso: nowIso,
    isObject: isObject,
    seededShuffle: seededShuffle,
    filterCandidatePatches: filterCandidatePatches,
  };
}
