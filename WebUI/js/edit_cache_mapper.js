/**
 * @purpose Maps parameter cache values back into raw unpacked Behringer DeepMind 12 SysEx payload bytes.
 * Iterates over CACHE_MAP data array (defined in edit_cache_mapper_data.js).
 * @purpose_en Parameter Cache to SysEx bytes mapper (data-driven).
 */

window.updateUnpackedBytesFromCache = function(unpackedBytes) {
    if (!getBridge()) { return; }
    if (!window.CACHE_MAP) { return; }
    const cache = getBridge().parameterCache;

    const set = function(idx, val) {
        if (val !== undefined && val !== null && !isNaN(val)) {
            unpackedBytes[idx] = Math.round(Math.max(0, Math.min(255, val)));
        }
    };

    // Hardware DeepMind 12 only understands FX types 0-35 (36 standard types).
    // The UI keeps 57 names for advanced types, so clamp anything above
    // the hardware range to 56 before writing the SysEx byte.
    const fxTypeToHardwareByte = function(val) { return Math.min(val, 1.0) * 56; };

    for (let i = 0; i < window.CACHE_MAP.length; i++) {
        const entry = window.CACHE_MAP[i];
        const raw = cache[entry.param];

        if (raw === undefined && entry.default !== undefined) {
            set(entry.byte, entry.default);
        } else if (entry.bipolar) {
            // Bipolar depth: normalized 0..1 → SysEx bipolar 1..255 (center=128)
            set(entry.byte, ((raw * 2 - 1) * 127) + 128);
        } else if (entry.formula === 'fxType') {
            // FX type: clamp UI range (0..56) to hardware byte
            set(entry.byte, fxTypeToHardwareByte(raw));
        } else {
            set(entry.byte, raw * (entry.scale || 255));
        }
    }
};
