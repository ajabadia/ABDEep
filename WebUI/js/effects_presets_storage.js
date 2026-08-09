/**
 * @purpose FX presets storage: loads presets from localStorage and merges with
 *          DEFAULT_FX_PRESETS and FACTORY_FX_PRESETS.
 * @classification Module/Effects/Presets/Storage
 */

var Logger = globalThis.Logger || console;

function _loadAllFxPresets() {
  let userPresets = [];
  try {
    const raw = localStorage.getItem('abd-eep-fx-presets');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) { userPresets = parsed; }
    }
  } catch (e) { /* ignore JSON parse errors */ }

  const list = [].concat(userPresets);
  const existingNames = {};
  for (let ui = 0; ui < userPresets.length; ui++) {
    existingNames[userPresets[ui].name] = true;
  }

  const defaults = globalThis.DEFAULT_FX_PRESETS || [];
  for (let di = 0; di < defaults.length; di++) {
    if (!existingNames[defaults[di].name]) {
      list.push(defaults[di]);
      existingNames[defaults[di].name] = true;
    }
  }

  const factory = (typeof window !== 'undefined' && Array.isArray(window.FACTORY_FX_PRESETS)) ? window.FACTORY_FX_PRESETS : [];
  for (let fi = 0; fi < factory.length; fi++) {
    if (!existingNames[factory[fi].name]) {
      list.push(factory[fi]);
      existingNames[factory[fi].name] = true;
    }
  }

  return list;
}

window._loadAllFxPresets = _loadAllFxPresets;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { _loadAllFxPresets: _loadAllFxPresets };
}
