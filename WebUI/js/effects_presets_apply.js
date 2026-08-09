/**
 * @purpose FX preset application: applies a saved preset to the bridge and updates UI.
 * @classification Module/Effects/Presets/Apply
 */

window.applyFxPreset = function (presetData, slotNumber) {
  slotNumber = slotNumber || window._selectedFxSlot || 1;
  const bridge = getBridge();
  if (!bridge) { return; }

  bridge.setParameter('fx' + slotNumber + '_type', presetData.type);

  for (let i = 0; i < 12 && i < presetData.params.length; i++) {
    bridge.setParameter('fx' + slotNumber + '_param' + (i + 1), presetData.params[i]);
  }

  if (presetData.gain !== undefined) {
    bridge.setParameter('fx' + slotNumber + '_gain', presetData.gain);
  }

  const selectEl = document.querySelector('.fx-type-select[data-slot="' + slotNumber + '"]');
  if (selectEl) {
    const typeVal = Math.round(presetData.type * 56.0);
    selectEl.value = typeVal;
    const displayEl = document.getElementById('fx' + slotNumber + '-type-mini-display');
    if (displayEl) {
      displayEl.innerText = (window.FX_TYPE_NAMES && window.FX_TYPE_NAMES[typeVal]) || 'Bypass';
    }
  }

  if (typeof window._setGainSliderPos === 'function') {
    const offsetMap = { 1: 218, 2: 219, 3: 220, 4: 221 };
    window._setGainSliderPos('fx' + slotNumber + '_gain', offsetMap[slotNumber] || 221);
  }

  if (slotNumber === window._selectedFxSlot) {
    if (typeof window.renderActiveEffectParams === 'function') {
      window.renderActiveEffectParams();
    }
  }

  if (typeof window.lcdSafeUpdate === 'function') {
    const lcd = document.getElementById('lcd-screen-main');
    // Fase 3 §4.1: presetData.name viene de localStorage (dato externo) → escapar antes del sink
    const safeName = (typeof globalThis.escapeHtml === 'function') ? globalThis.escapeHtml(presetData.name) : presetData.name;
    if (lcd) {
      window.lcdSafeUpdate(lcd, 'FX Preset Loaded: ' + safeName + ' \u2192 FX' + slotNumber, null, { useQueue: false });
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { applyFxPreset: window.applyFxPreset };
}
