// WebUI/js/calibration_patch_picker.js
(function () {
  function getLoadedBanksSafe() {
    return window.loadedBanks && typeof window.loadedBanks === 'object'
      ? window.loadedBanks
      : {};
  }

  function getBankNames() {
    return Object.keys(getLoadedBanksSafe());
  }

  function getPatchFromBank(bankName, patchIndex) {
    const banks = getLoadedBanksSafe();
    const bank = banks[bankName];
    if (!bank || !bank[patchIndex]) {return null;}
    return bank[patchIndex];
  }

  function clonePatchRef(bankName, patchIndex, patch) {
    if (!patch) {return null;}
    return {
      bankName,
      patchIndex,
      name: patch.name || `Patch ${patchIndex + 1}`,
      unpackedBytes: patch.unpackedBytes ? new Uint8Array(patch.unpackedBytes) : null,
      meta: patch.meta ? JSON.parse(JSON.stringify(patch.meta)) : null,
    };
  }

  function buildSlotOptions(bankName) {
    const banks = getLoadedBanksSafe();
    const bank = banks[bankName] || [];
    const options = [];

    for (let i = 0; i < 128; i++) {
      const patch = bank[i] || { name: `Empty Slot ${i + 1}`, unpackedBytes: null };
      const hasData = !!patch.unpackedBytes;
      options.push({
        index: i,
        label: `${String(i + 1).padStart(3, '0')} ${patch.name || `Patch ${i + 1}`}${hasData ? '' : ' · empty'}`,
        disabled: !hasData,
      });
    }

    return options;
  }

  function setSelectedPatch(side, bankName, patchIndex) {
    const patch = getPatchFromBank(bankName, patchIndex);
    const cloned = clonePatchRef(bankName, patchIndex, patch);

    if (!window.calibrationStore) {return;}

    if (side === 'A') {
      window.calibrationStore.setSelectedPatchA(cloned);
    } else {
      window.calibrationStore.setSelectedPatchB(cloned);
    }
  }

  function setFromCurrent(side) {
    const bankName = window.currentActiveBank;
    const patchIndex = Number(window.currentActivePatchIndex);

    if (!bankName || !Number.isFinite(patchIndex) || patchIndex < 0) {return;}
    setSelectedPatch(side, bankName, patchIndex);
  }

  if (typeof window !== 'undefined') {
    window.CalibrationPatchPickerHelpers = {
      getBankNames,
      buildSlotOptions,
      setSelectedPatch,
      setFromCurrent,
    };
  }
})();
