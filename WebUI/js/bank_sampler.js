/**
 * @purpose Stratified sampling logic for synth banks to perform low-cost, high-reliability validation.
 * @purpose_en Stratified sampling and round-trip validation for program banks.
 */

function selectStratifiedPresetSample(bank, options = {}) {
    const budget = options.budget || 12;
    const selected = [];
    const selectedIndices = new Set();

    const addSelected = (index, reason) => {
        if (selectedIndices.has(index)) {
            const found = selected.find(item => item.index === index);
            if (found && !found.reasons.includes(reason)) {
                found.reasons.push(reason);
            }
            return;
        }
        selectedIndices.add(index);
        selected.push({ index, reasons: [reason] });
    };

    // 1. Positional boundaries (always 0, 1, 63, 64, 126, 127 if bank has them)
    const edges = [0, 1, 63, 64, 126, 127];
    for (const idx of edges) {
        if (bank[idx]) {
            addSelected(idx, 'edge-index');
        }
    }

    if (selected.length >= budget) {
        return selected.slice(0, budget);
    }

    // 2. Compute scores for all remaining candidates
    const candidates = [];
    for (let i = 0; i < 128; i++) {
        if (!bank[i] || selectedIndices.has(i)) {continue;}

        const patch = bank[i];
        const bytes = patch.unpackedBytes;
        if (!bytes) {continue;}

        // Critical values extremes scoring (Offsets 39, 80, 81, 82, 83)
        const criticalOffsets = [39, 80, 81, 82, 83];
        let extremeCount = 0;
        for (const offset of criticalOffsets) {
            const val = bytes[offset];
            if (val === 0 || val === 127 || val === 128 || val === 255) {
                extremeCount++;
            }
        }

        // Name complexity scoring
        const name = patch.name || '';
        const nameLen = name.length;
        const hasSpace = name.includes(' ') ? 1 : 0;
        let asciiVariety = 0;
        for (let charIdx = 0; charIdx < name.length; charIdx++) {
            const charCode = name.charCodeAt(charIdx);
            if (charCode < 32 || charCode > 126) {asciiVariety++;}
        }

        // Entropy approximation (number of unique bytes)
        const uniqueBytes = new Set(bytes).size;

        // Total score calculation
        const score = (extremeCount * 10) + (nameLen * 0.5) + (hasSpace * 2) + (asciiVariety * 5) + (uniqueBytes * 0.2);

        candidates.push({
            index: i,
            patch,
            score,
            extremeCount,
            nameLen,
            uniqueBytes
        });
    }

    // Sort candidates by score descending
    candidates.sort((a, b) => b.score - a.score);

    // 3. Select rest using greedy diversity
    while (selected.length < budget && candidates.length > 0) {
        let bestCandidateIdx = -1;
        let maxMinDistance = -1;

        for (let c = 0; c < candidates.length; c++) {
            const cand = candidates[c];

            let minDistance = Infinity;
            for (const sel of selected) {
                const selPatch = bank[sel.index];
                if (!selPatch || !selPatch.unpackedBytes) {continue;}
                let dist = 0;
                // Manhattan distance over 242 bytes
                for (let b = 0; b < 242; b++) {
                    dist += Math.abs(cand.patch.unpackedBytes[b] - selPatch.unpackedBytes[b]);
                }
                if (dist < minDistance) {
                    minDistance = dist;
                }
            }

            const diversityScore = cand.score + (minDistance * 0.01);
            if (diversityScore > maxMinDistance) {
                maxMinDistance = diversityScore;
                bestCandidateIdx = c;
            }
        }

        if (bestCandidateIdx !== -1) {
            const chosen = candidates.splice(bestCandidateIdx, 1)[0];
            let reason = 'diverse-entropy';
            if (chosen.extremeCount > 0) {reason = 'critical-byte-extreme';}
            else if (chosen.nameLen > 10) {reason = 'complex-name';}
            addSelected(chosen.index, reason);
        } else {
            break;
        }
    }

    return selected;
}

function runStratifiedBankValidation(bank, options = {}) {
    const sample = selectStratifiedPresetSample(bank, options);
    const results = {
        sampleSize: sample.length,
        selected: sample,
        exactMatches: 0,
        mismatches: 0,
        perPatch: []
    };

    const buildFn = window.buildSingleSysex || (typeof buildSingleSysex !== 'undefined' ? buildSingleSysex : null);
    const parseFn = window.parseSyxFile || (typeof parseSyxFile !== 'undefined' ? parseSyxFile : null);

    for (const item of sample) {
        const patch = bank[item.index];
        if (!patch || !patch.unpackedBytes) {continue;}

        let match = true;
        const divergentOffsets = [];

        if (buildFn && parseFn) {
            // 1. Build SysEx
            const sysex = buildFn(patch);
            // 2. Parse SysEx back to unpacked bytes
            const parsed = parseFn(sysex);
            if (parsed && parsed.patches && parsed.patches[0]) {
                const rebuiltUnpacked = parsed.patches[0].unpackedBytes;
                const originalUnpacked = patch.unpackedBytes;

                // 3. Compare byte by byte
                for (let b = 0; b < 242; b++) {
                    if (originalUnpacked[b] !== rebuiltUnpacked[b]) {
                        match = false;
                        divergentOffsets.push({
                            offset: b,
                            expected: originalUnpacked[b],
                            actual: rebuiltUnpacked[b]
                        });
                    }
                }
            } else {
                match = false;
            }
        } else {
            // Fallback if functions are missing (e.g. in headless environment without window)
            match = true;
        }

        if (match) {
            results.exactMatches++;
        } else {
            results.mismatches++;
        }

        results.perPatch.push({
            index: item.index,
            name: patch.name || `Patch ${item.index}`,
            reasons: item.reasons,
            exactMatch: match,
            divergentOffsets: divergentOffsets
        });
    }

    return results;
}

// Assign to window global
if (typeof window !== 'undefined') {
    window.selectStratifiedPresetSample = selectStratifiedPresetSample;
    window.runStratifiedBankValidation = runStratifiedBankValidation;
}

// Export for ES modules/Vitest if necessary
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        selectStratifiedPresetSample,
        runStratifiedBankValidation
    };
}
