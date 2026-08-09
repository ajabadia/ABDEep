/**
 * @purpose FX preset bank extraction: scans patches from a bank dump and extracts
 *          new FX and sequencer presets that don't already exist.
 * @classification Module/Effects/Presets/BankExtract
 */

var Logger = globalThis.Logger || console;

window.extractAndSaveNewPresetsFromBank = function (bankName, patches) {
  if (!Array.isArray(patches)) { return; }

  const userFxPresets = (typeof window._loadAllFxPresets === 'function') ? window._loadAllFxPresets() : [];
  const userSeqPresets = (typeof window._loadUserSeqPresets === 'function') ? window._loadUserSeqPresets() : [];
  let newFxCount = 0;
  let newSeqCount = 0;

  const fxSlotConfigs = [
    { id: 1, typeByte: 166, paramStart: 167, gainByte: 218 },
    { id: 2, typeByte: 179, paramStart: 180, gainByte: 219 },
    { id: 3, typeByte: 192, paramStart: 193, gainByte: 220 },
    { id: 4, typeByte: 205, paramStart: 206, gainByte: 221 }
  ];

  for (let pi = 0; pi < patches.length; pi++) {
    const patch = patches[pi];
    if (!patch || !patch.unpackedBytes) { continue; }
    const b = patch.unpackedBytes;

    // Scan FX slots
    for (let si = 0; si < fxSlotConfigs.length; si++) {
      const slot = fxSlotConfigs[si];
      const typeVal = b[slot.typeByte];
      const typeNames = window.FX_TYPE_NAMES;
      if (typeVal > 0 && typeNames && typeVal < typeNames.length) {
        const typeName = typeNames[typeVal];
        const typeValNorm = typeVal / 56.0;
        const gain = b[slot.gainByte] / 255.0;
        const params = [];
        for (let p = 0; p < 12; p++) {
          params.push(b[slot.paramStart + p] / 255.0);
        }

        const alreadyExists = (typeof window._isFxPresetDuplicate === 'function')
          ? window._isFxPresetDuplicate(typeVal, gain, params, userFxPresets)
          : false;

        if (!alreadyExists) {
          userFxPresets.push({
            name: typeName + ' (' + patch.name + ')',
            slot: slot.id,
            type: typeValNorm,
            gain: gain,
            params: params,
            created: Date.now()
          });
          newFxCount++;
        }
      }
    }

    // Scan sequencer steps
    const steps = [];
    let max = 0;
    let min = 255;
    let isZero = true;
    for (let s = 0; s < 32; s++) {
      const val = b[123 + s];
      steps.push(val);
      if (val !== 128) { isZero = false; }
      if (val > max) { max = val; }
      if (val < min) { min = val; }
    }

    if (!isZero && (max - min) >= 15) {
      const seqExists = (typeof window._isSeqPresetDuplicate === 'function')
        ? window._isSeqPresetDuplicate(steps, userSeqPresets)
        : false;

      if (!seqExists) {
        userSeqPresets.push({ name: patch.name + ' Seq', steps: steps });
        newSeqCount++;
      }
    }
  }

  if (newFxCount > 0) {
    try { localStorage.setItem('abd-eep-fx-presets', JSON.stringify(userFxPresets)); } catch (e) { /* ignore */ }
    if (typeof window._renderFxPresetList === 'function') { window._renderFxPresetList(); }
  }
  if (newSeqCount > 0) {
    try { localStorage.setItem('abd-eep-seq-presets', JSON.stringify(userSeqPresets)); } catch (e) { /* ignore */ }
    if (typeof window.initSequencerPresets === 'function') { window.initSequencerPresets(); }
  }

  if (newFxCount > 0 || newSeqCount > 0) {
    Logger.log('[AutoExtractor] Extracted from bank \'' + bankName + '\': ' + newFxCount + ' new FX presets and ' + newSeqCount + ' new Sequence presets.');
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { extractAndSaveNewPresetsFromBank: window.extractAndSaveNewPresetsFromBank };
}
