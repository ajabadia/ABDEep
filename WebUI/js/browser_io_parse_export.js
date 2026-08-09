/**
 * @purpose Export functions for Bank/Patch JSON and SysEx — extracted from browser_io_parse.js
 * @depends browser_io_parse.js — inspectPatchAdvancedFeatures, convertPatchToClassicDM12
 * @classification Module/Export
 */

/* global inspectPatchAdvancedFeatures, convertPatchToClassicDM12 */

// ─────────────────────────────────────────────────────────────────────
// exportBankJson: Exporta un banco completo en JSON (AbyssMind Pro)
// ─────────────────────────────────────────────────────────────────────
function exportBankJson(bankName, fileName, bankPatches) {
    const patches = bankPatches || (typeof window !== 'undefined' && window.loadedBanks ? window.loadedBanks[bankName] : []) || [];
    const bankData = {
        bankName: bankName || 'User Bank',
        targetModel: 'AbyssMind Pro',
        created: Date.now(),
        patchesCount: patches.length,
        patches: patches.map(function(patch) {
            return patch ? {
                name: patch.name || 'Patch',
                params: patch.params || patch.parameterState || {},
                unpackedBytes: Array.from(patch.unpackedBytes || [])
            } : null;
        })
    };

    const jsonStr = JSON.stringify(bankData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName || ((bankName || 'User_Bank').replace(/[^a-zA-Z0-9_\-]/g, '_') + '.abyssbank.json');
    link.click();
    setTimeout(function() { URL.revokeObjectURL(link.href); }, 5000);
    return true;
}

// ─────────────────────────────────────────────────────────────────────
// exportSinglePatchJson: Exporta patch completo en JSON (AbyssMind Pro)
// ─────────────────────────────────────────────────────────────────────
function exportSinglePatchJson(patch, fileName) {
    const patchData = {
        name: patch.name || 'AbyssMind Patch',
        targetModel: 'AbyssMind Pro',
        isAdvanced: true,
        created: Date.now(),
        params: patch.params || patch.parameterState || {},
        unpackedBytes: Array.from(patch.unpackedBytes || [])
    };
    const jsonStr = JSON.stringify(patchData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName || (patch.name.replace(/[^a-zA-Z0-9_\-]/g, '_') + '.abyss.json');
    link.click();
    setTimeout(function() { URL.revokeObjectURL(link.href); }, 5000);
    return true;
}

// ─────────────────────────────────────────────────────────────────────
// exportSinglePatch: Exporta un patch individual (.syx o .json según compatibilidad)
// ─────────────────────────────────────────────────────────────────────
function exportSinglePatch(patch, fileName, forceJson) {
    if (!patch || !patch.unpackedBytes) {
        alert('No patch data to export.');
        return false;
    }

    const analysis = inspectPatchAdvancedFeatures(patch);
    if (analysis.isAdvanced && !forceJson) {
        const confirmConvert = confirm(
            '\u26A0\uFE0F Este preset incluye caracter\u00EDsticas Pro (' + analysis.reasons.join(', ') + ').\n\n' +
            '\u2022 Pulse [Aceptar] para CONVERTIR a formato can\u00F3nico DeepMind 12 y exportar como .syx.\n' +
            '\u2022 Pulse [Cancelar] para EXPORTAR como .json completo para AbyssMind Pro.'
        );
        if (confirmConvert) {
            const classicPatch = convertPatchToClassicDM12(patch);
            return exportSinglePatch(classicPatch, fileName, false);
        } else {
            return exportSinglePatchJson(patch, fileName);
        }
    }

    if (forceJson) {
        return exportSinglePatchJson(patch, fileName);
    }

    // Fase 3 (§4.2): el nombre exportado a hardware se limita a 16 chars ASCII
    // imprimibles SIN alterar el modelo original (se exporta una copia saneada).
    const exportPrep = (typeof window.HardwareExporter === 'object' && window.HardwareExporter)
        ? window.HardwareExporter.prepareForSysEx(patch)
        : null;
    const exportPatch = (exportPrep && exportPrep.patch) ? exportPrep.patch : patch;

    const syxMsg = window.buildSingleSysex ? window.buildSingleSysex(exportPatch) : exportPatch.unpackedBytes;
    const blob = new Blob([syxMsg], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName || (patch.name.replace(/[^a-zA-Z0-9_\-]/g, '_') + '.syx');
    link.click();
    setTimeout(function() { URL.revokeObjectURL(link.href); }, 5000);
    return true;
}

// ── Exportar a globalThis para compatibilidad cross-file ──
globalThis.exportBankJson = exportBankJson;
globalThis.exportSinglePatchJson = exportSinglePatchJson;
globalThis.exportSinglePatch = exportSinglePatch;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        exportBankJson: exportBankJson,
        exportSinglePatchJson: exportSinglePatchJson,
        exportSinglePatch: exportSinglePatch,
    };
}
