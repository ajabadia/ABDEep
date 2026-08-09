/**
 * @purpose Stratified sampling logic for synth banks — pure algorithmic functions
 * for low-cost, high-reliability validation. Extracted from bank_sampler.js.
 * @purpose_en Stratified sampling and round-trip validation for program banks (pure logic).
 */

function selectStratifiedPresetSample(bank, options) {
    if (!options) { options = {}; }
    const budget = options.budget || 12;
    const selected = [];
    const selectedIndices = {};

    function addSelected(index, reason) {
        if (selectedIndices[index]) {
            let found = null;
            for (let si = 0; si < selected.length; si++) {
                if (selected[si].index === index) { found = selected[si]; break; }
            }
            if (found && found.reasons.indexOf(reason) === -1) {
                found.reasons.push(reason);
            }
            return;
        }
        selectedIndices[index] = true;
        selected.push({ index: index, reasons: [reason] });
    }

    // 1. Positional boundaries (always 0, 1, 63, 64, 126, 127 if bank has them)
    const edges = [0, 1, 63, 64, 126, 127];
    for (let ei = 0; ei < edges.length; ei++) {
        const idx = edges[ei];
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
        if (!bank[i] || selectedIndices[i]) { continue; }

        const patch = bank[i];
        const bytes = patch.unpackedBytes;
        if (!bytes) { continue; }

        // Critical values extremes scoring (Offsets 39, 80, 81, 82, 83)
        const criticalOffsets = [39, 80, 81, 82, 83];
        let extremeCount = 0;
        for (let co = 0; co < criticalOffsets.length; co++) {
            const val = bytes[criticalOffsets[co]];
            if (val === 0 || val === 127 || val === 128 || val === 255) {
                extremeCount++;
            }
        }

        // Name complexity scoring
        const name = patch.name || '';
        const nameLen = name.length;
        const hasSpace = name.indexOf(' ') !== -1 ? 1 : 0;
        let asciiVariety = 0;
        for (let ci = 0; ci < name.length; ci++) {
            const charCode = name.charCodeAt(ci);
            if (charCode < 32 || charCode > 126) { asciiVariety++; }
        }

        // Entropy approximation (number of unique bytes)
        const uniqueBytesSet = {};
        for (let bi = 0; bi < bytes.length; bi++) {
            uniqueBytesSet[bytes[bi]] = true;
        }
        let uniqueByteCount = 0;
        for (const u in uniqueBytesSet) {
            if (uniqueBytesSet.hasOwnProperty(u)) { uniqueByteCount++; }
        }

        // Total score calculation
        const score = (extremeCount * 10) + (nameLen * 0.5) + (hasSpace * 2) + (asciiVariety * 5) + (uniqueByteCount * 0.2);

        candidates.push({
            index: i,
            patch: patch,
            score: score,
            extremeCount: extremeCount,
            nameLen: nameLen,
            uniqueByteCount: uniqueByteCount
        });
    }

    // Sort candidates by score descending
    candidates.sort(function(a, b) { return b.score - a.score; });

    // 3. Select rest using greedy diversity
    while (selected.length < budget && candidates.length > 0) {
        let bestCandidateIdx = -1;
        let maxMinDistance = -1;

        for (let c = 0; c < candidates.length; c++) {
            const cand = candidates[c];

            let minDistance = Infinity;
            for (let si2 = 0; si2 < selected.length; si2++) {
                const selPatch = bank[selected[si2].index];
                if (!selPatch || !selPatch.unpackedBytes) { continue; }
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
            if (chosen.extremeCount > 0) { reason = 'critical-byte-extreme'; }
            else if (chosen.nameLen > 10) { reason = 'complex-name'; }
            addSelected(chosen.index, reason);
        } else {
            break;
        }
    }

    return selected;
}

function runStratifiedBankValidation(bank, options) {
    if (!options) { options = {}; }
    const sample = selectStratifiedPresetSample(bank, options);
    const results = {
        sampleSize: sample.length,
        selected: sample,
        exactMatches: 0,
        mismatches: 0,
        perPatch: []
    };

    const buildFn = (typeof window !== 'undefined' && window.buildSingleSysex) || (typeof buildSingleSysex !== 'undefined' ? buildSingleSysex : null);
    const parseFn = (typeof window !== 'undefined' && window.parseSyxFile) || (typeof parseSyxFile !== 'undefined' ? parseSyxFile : null);

    for (let si = 0; si < sample.length; si++) {
        const item = sample[si];
        const patch = bank[item.index];
        if (!patch || !patch.unpackedBytes) { continue; }

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
        }

        if (match) {
            results.exactMatches++;
        } else {
            results.mismatches++;
        }

        results.perPatch.push({
            index: item.index,
            name: patch.name || ('Patch ' + item.index),
            reasons: item.reasons,
            exactMatch: match,
            divergentOffsets: divergentOffsets
        });
    }

    return results;
}

// Export for ES modules/Vitest
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        selectStratifiedPresetSample: selectStratifiedPresetSample,
        runStratifiedBankValidation: runStratifiedBankValidation
    };
}
