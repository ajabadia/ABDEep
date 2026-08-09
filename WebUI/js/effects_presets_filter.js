/**
 * @purpose FX Presets filtering logic: duplicate detection, matching.
 * Extracted from effects_presets.js for modularization.
 * @classification Module/Effects/Presets
 */

/**
 * Check if an FX preset configuration already exists in a given preset list.
 * Compares by type (rounded), gain (within 0.03 tolerance), and 12 params (within 0.03 tolerance).
 * @param {number} typeVal - Raw FX type value (0-56)
 * @param {number} gain - Gain value (0-1)
 * @param {number[]} params - Array of 12 param values (0-1)
 * @param {object[]} presetList - Array of preset objects with type, gain, params
 * @returns {boolean} true if matching preset found
 */
window._findMatchingFxPreset = function(typeVal, gain, params, presetList) {
    if (!Array.isArray(presetList)) { return false; }
    for (let i = 0; i < presetList.length; i++) {
        const p = presetList[i];
        if (Math.round(p.type * 56) === typeVal) {
            if (Math.abs(p.gain - gain) > 0.03) { continue; }
            let match = true;
            for (let j = 0; j < 12; j++) {
                if (Math.abs(p.params[j] - params[j]) > 0.03) {
                    match = false;
                    break;
                }
            }
            if (match) { return true; }
        }
    }
    return false;
};

/**
 * Check if an FX preset config is a duplicate across factory AND user presets.
 * @param {number} typeVal - Raw FX type value
 * @param {number} gain - Gain value
 * @param {number[]} params - Array of 12 param values
 * @param {object[]} userPresets - User FX presets array
 * @returns {boolean} true if already exists in factory or user presets
 */
window._isFxPresetDuplicate = function(typeVal, gain, params, userPresets) {
    // Check factory presets
    if (Array.isArray(window.FACTORY_FX_PRESETS)) {
        if (window._findMatchingFxPreset(typeVal, gain, params, window.FACTORY_FX_PRESETS)) {
            return true;
        }
    }
    // Check user presets
    return window._findMatchingFxPreset(typeVal, gain, params, userPresets);
};

/**
 * Check if a SEQ preset (32 steps) already exists in a given preset list.
 * Compares steps with tolerance of 5.
 * @param {number[]} steps - Array of 32 step values (0-255)
 * @param {object[]} presetList - Array of seq preset objects with steps property
 * @returns {boolean} true if matching preset found
 */
window._findMatchingSeqPreset = function(steps, presetList) {
    if (!Array.isArray(presetList)) { return false; }
    for (let i = 0; i < presetList.length; i++) {
        const p = presetList[i];
        if (!p.steps || p.steps.length < 32) { continue; }
        let match = true;
        for (let j = 0; j < 32; j++) {
            if (Math.abs(p.steps[j] - steps[j]) > 5) {
                match = false;
                break;
            }
        }
        if (match) { return true; }
    }
    return false;
};

/**
 * Check if a SEQ preset config is a duplicate across factory AND user presets.
 * @param {number[]} steps - Array of 32 step values
 * @param {object[]} userSeqPresets - User SEQ presets array
 * @returns {boolean} true if already exists in factory or user presets
 */
window._isSeqPresetDuplicate = function(steps, userSeqPresets) {
    // Check factory presets
    if (window.FACTORY_SEQ_PRESETS) {
        if (window._findMatchingSeqPreset(steps, window.FACTORY_SEQ_PRESETS)) {
            return true;
        }
    }
    // Check user presets
    return window._findMatchingSeqPreset(steps, userSeqPresets);
};
