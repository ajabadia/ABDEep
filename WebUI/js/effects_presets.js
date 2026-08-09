// eslint-disable-next-line no-var
var Logger = globalThis.Logger || console;

/**
 * @purpose Facade for FX presets library. Actual implementation in:
 *          - effects_presets_storage.js     (_loadAllFxPresets)
 *          - effects_presets_apply.js       (applyFxPreset)
 *          - effects_presets_bank_extract.js (extractAndSaveNewPresetsFromBank)
 *          - effects_presets_data.js        (DEFAULT_FX_PRESETS, escapeHtml)
 *          - effects_presets_render.js      (_renderFxPresetList, findMatchingFxPresetName)
 *          - effects_presets_filter.js      (filtering helpers)
 * @purpose_en FX presets library service — facade.
 */

window.saveFxPreset = function (presetName, slotNumber) {
  if (!presetName || presetName.trim() === '') { return; }
  presetName = presetName.trim().replace(/[<>"'&]/g, '');
  if (!presetName) { return; }
  slotNumber = slotNumber || window._selectedFxSlot || 1;
  const bridge = getBridge();
  if (!bridge || !bridge.parameterCache) { return; }

  const preset = {
    name: presetName.trim(),
    slot: slotNumber,
    type: _readFxParam('fx' + slotNumber + '_type', slotNumber === 1 ? 166 : (slotNumber === 2 ? 179 : (slotNumber === 3 ? 192 : 205)), 0.0),
    params: [],
    created: Date.now()
  };
  for (let i = 1; i <= 12; i++) {
    const offsetStart = slotNumber === 1 ? 167 : (slotNumber === 2 ? 180 : (slotNumber === 3 ? 193 : 206));
    preset.params.push(_readFxParam('fx' + slotNumber + '_param' + i, offsetStart + i - 1, 0.5));
  }
  preset.gain = _readFxParam('fx' + slotNumber + '_gain', slotNumber === 1 ? 218 : (slotNumber === 2 ? 219 : (slotNumber === 3 ? 220 : 221)), 1.0);

  const allPresets = _loadAllFxPresets();
  let existingIdx = -1;
  for (let j = 0; j < allPresets.length; j++) {
    if (allPresets[j].name === preset.name) { existingIdx = j; break; }
  }
  if (existingIdx >= 0) {
    allPresets[existingIdx] = preset;
  } else {
    allPresets.push(preset);
  }

  try {
    localStorage.setItem('abd-eep-fx-presets', JSON.stringify(allPresets));
  } catch (e) {
    Logger.warn('[FX Presets] Error saving to localStorage:', e);
  }

  if (typeof window._renderFxPresetList === 'function') { window._renderFxPresetList(); }
  if (typeof window.syncFxPresetDropdowns === 'function') { window.syncFxPresetDropdowns(); }
  if (typeof window.lcdSafeUpdate === 'function') {
    const lcd = document.getElementById('lcd-screen-main');
    // Fase 3 §4.1: preset.name viene de localStorage (dato externo) → escapar antes del sink
    const safeName = (typeof globalThis.escapeHtml === 'function') ? globalThis.escapeHtml(preset.name) : preset.name;
    if (lcd) { window.lcdSafeUpdate(lcd, 'FX Preset Saved: ' + safeName, null, { useQueue: false }); }
  }
};

/** @private Reads an FX param value from the bridge parameterCache */
function _readFxParam(paramId, defaultOffset, fallback) {
  const bridge = getBridge();
  if (!bridge || !bridge.parameterCache) { return fallback; }
  const val = bridge.parameterCache[paramId];
  return (val !== undefined && val !== null) ? val : fallback;
}

window.deleteFxPreset = function (presetName) {
  const allPresets = _loadAllFxPresets();
  const filtered = [];
  for (let i = 0; i < allPresets.length; i++) {
    if (allPresets[i].name !== presetName) {
      filtered.push(allPresets[i]);
    }
  }
  if (filtered.length !== allPresets.length) {
    try {
      localStorage.setItem('abd-eep-fx-presets', JSON.stringify(filtered));
    } catch (e) { /* ignore */ }
    if (typeof window._renderFxPresetList === 'function') { window._renderFxPresetList(); }
    if (typeof window.syncFxPresetDropdowns === 'function') { window.syncFxPresetDropdowns(); }
  }
};

// Fallback stubs (loaded before effects_presets_render.js in index.html)
window._renderFxPresetList = window._renderFxPresetList || function () {};
window.findMatchingFxPresetName = window.findMatchingFxPresetName || function () { return null; };
