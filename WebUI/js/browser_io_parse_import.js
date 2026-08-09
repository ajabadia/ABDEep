/**
 * @purpose Pro patch inspection, classic DM12 conversion, bank compatibility, and file import handling.
 * Extracted from browser_io_parse.js for SRP.
 * @depends browser_io_parse.js — parseSysexText, parseSysexBytes, parseSyxFile
 * @classification Module/Import
 */

/* global parseSysexText, parseSysexBytes, parseSyxFile */

// ─────────────────────────────────────────────────────────────────────
// inspectPatchAdvancedFeatures: Analiza si un patch utiliza funciones Pro
// ─────────────────────────────────────────────────────────────────────
function inspectPatchAdvancedFeatures(patch) {
    const result = {
        isAdvanced: false,
        reasons: [],
        compatibilityLevel: 'hardware_ok'
    };

    if (!patch) { return result; }

    const params = patch.params || patch.parameterState || {};
    const unpacked = patch.unpackedBytes;

    // 1. FX Types (IDs 36..56)
    for (let slot = 1; slot <= 4; slot++) {
        let fxType = params[`fx${slot}_type`] !== undefined ? Math.round(params[`fx${slot}_type`] * 56) : undefined;
        if (fxType === undefined && unpacked && unpacked.length >= 220) {
            const offset = 165 + (slot - 1) * 13;
            fxType = unpacked[offset] !== undefined ? Math.round((unpacked[offset] / 255.0) * 56) : 0;
        }
        if (fxType !== undefined && fxType > 35) {
            result.isAdvanced = true;
            result.reasons.push(`FX${slot}: Pro Type ${fxType}`);
        }
    }

    // 2. VCF Model (1 = Moog Ladder, 2 = Korg MS-20)
    const vcfModel = params['vcf_model'];
    if (vcfModel !== undefined && Math.round(vcfModel * 2) > 0) {
        const modelName = Math.round(vcfModel * 2) === 1 ? 'Moog Ladder' : 'Korg MS-20';
        result.isAdvanced = true;
        result.reasons.push(`VCF: ${modelName}`);
    }

    // 3. ModMatrix Slots 9..32
    for (let slot = 9; slot <= 32; slot++) {
        const src = params[`mod_matrix_slot${slot}_src`];
        const dest = params[`mod_matrix_slot${slot}_dest`];
        if ((src !== undefined && src > 0) || (dest !== undefined && dest > 0)) {
            result.isAdvanced = true;
            result.reasons.push(`ModMatrix: Slot ${slot}`);
        }
    }

    if (result.isAdvanced) {
        result.compatibilityLevel = 'pro_exclusive';
    }

    return result;
}

// ─────────────────────────────────────────────────────────────────────
// convertPatchToClassicDM12: Degradado suave a formato canónico Hardware DM12
// ─────────────────────────────────────────────────────────────────────
function convertPatchToClassicDM12(patch) {
    if (!patch) { return null; }
    const clone = JSON.parse(JSON.stringify(patch));
    if (patch.unpackedBytes) {
        clone.unpackedBytes = new Uint8Array(patch.unpackedBytes);
    }
    const params = clone.params || clone.parameterState || {};

    // Mapa de degradado de efectos Pro (36..56 -> 0..35)
    const fxDowngradeMap = {
        36: 28, 37: 29, 38: 32, 39: 22, 40: 22, 41: 27, 42: 23, 43: 24, 44: 22, 45: 22,
        46: 31, 47: 15, 48: 15, 49: 17, 50: 18, 51: 17, 52: 2, 53: 5, 54: 1, 55: 28, 56: 28
    };

    for (let slot = 1; slot <= 4; slot++) {
        const fxType = params[`fx${slot}_type`] !== undefined ? Math.round(params[`fx${slot}_type`] * 56) : undefined;
        if (fxType !== undefined && fxType > 35) {
            const mappedType = fxDowngradeMap[fxType] || 0;
            params[`fx${slot}_type`] = mappedType / 56.0;
        }
    }

    // Convertir VCF Model a OTA Nativo (0)
    if (params['vcf_model'] !== undefined) {
        params['vcf_model'] = 0.0;
    }

    // Compactar y truncar ModMatrix a slots 1..8
    if (typeof window !== 'undefined' && typeof window.compactModMatrix === 'function') {
        window.compactModMatrix(params);
    }
    for (let slot = 9; slot <= 32; slot++) {
        params[`mod_matrix_slot${slot}_src`] = 0.0;
        params[`mod_matrix_slot${slot}_dest`] = 0.0;
        params[`mod_matrix_slot${slot}_depth`] = 0.5;
    }

    clone.params = params;
    if (clone.meta) {
        clone.meta.targetModel = 'Standard';
        clone.meta.isAdvanced = false;
    }
    return clone;
}

// ─────────────────────────────────────────────────────────────────────
// inspectBankCompatibility: Inspecciona la compatibilidad Pro de todo un banco
// ─────────────────────────────────────────────────────────────────────
function inspectBankCompatibility(bankName, bankPatches) {
    const patches = bankPatches || (typeof window !== 'undefined' && window.loadedBanks ? window.loadedBanks[bankName] : []) || [];
    let proCount = 0;
    const proIndices = [];

    patches.forEach((patch, idx) => {
        if (patch && inspectPatchAdvancedFeatures(patch).isAdvanced) {
            proCount++;
            proIndices.push(idx);
        }
    });

    return {
        isPureHardware: proCount === 0,
        hasProPatches: proCount > 0,
        proCount: proCount,
        proIndices: proIndices,
        bankType: proCount === 0 ? 'dm12_hardware' : 'abyss_pro'
    };
}

// ─────────────────────────────────────────────────────────────────────
// convertBankToClassicDM12: Convierte todos los parches de un banco a Clásico DM12
// ─────────────────────────────────────────────────────────────────────
function convertBankToClassicDM12(bankName, bankPatches) {
    const patches = bankPatches || (typeof window !== 'undefined' && window.loadedBanks ? window.loadedBanks[bankName] : []) || [];
    return patches.map(patch => patch ? convertPatchToClassicDM12(patch) : null);
}

// ─────────────────────────────────────────────────────────────────────
// parseImportedBankFile: Parsea archivos importados (.syx, .json, .abyssbank.json)
// segun el modo activo (Universal en Pro, Estricto/Adaptativo en Clásico)
// ─────────────────────────────────────────────────────────────────────
function parseImportedBankFile(fileContent, fileName) {
    const isAdvancedMode = (typeof window !== 'undefined' && window.appMode === 'advanced');

    // Si el contenido es una cadena JSON
    if (typeof fileContent === 'string' && (fileContent.trim().startsWith('{') || fileContent.trim().startsWith('['))) {
        try {
            const data = JSON.parse(fileContent);

            // Banco completo en JSON (.abyssbank.json)
            if (data.bankName || Array.isArray(data.patches)) {
                const bankCheck = inspectBankCompatibility(data.bankName || 'Imported Bank', data.patches || []);

                if (bankCheck.hasProPatches && !isAdvancedMode) {
                    const confirmConvert = (typeof window !== 'undefined' && window.confirm)
                        ? window.confirm(
                            `⚠️ El banco "${data.bankName || fileName}" contiene parches Pro (AbyssMind Pro).\n\n` +
                            'Estás en MODO CLÁSICO (DeepMind 12).\n' +
                            '• Pulse [Aceptar] para ADAPTAR el banco al estándar clásico.\n' +
                            '• Pulse [Cancelar] para rechazar la importación.'
                        )
                        : true;

                    if (!confirmConvert) {
                        return { error: 'Bank import rejected in standard mode', patches: [] };
                    }
                    const convertedPatches = convertBankToClassicDM12(data.bankName || fileName, data.patches);
                    return { bankName: (data.bankName || fileName) + ' (Classic)', patches: convertedPatches, isProBank: false };
                }

                return { bankName: data.bankName || fileName, patches: data.patches, isProBank: bankCheck.hasProPatches };
            }

            // Patch individual en JSON (.abyss.json)
            if (data.name && (data.params || data.unpackedBytes)) {
                const patchCheck = inspectPatchAdvancedFeatures(data);
                if (patchCheck.isAdvanced && !isAdvancedMode) {
                    const confirmConvert = (typeof window !== 'undefined' && window.confirm)
                        ? window.confirm(
                            `⚠️ El preset "${data.name}" incluye funciones Pro (${patchCheck.reasons.join(', ')}).\n\n` +
                            'Estás en MODO CLÁSICO (DeepMind 12).\n' +
                            '• Pulse [Aceptar] para ADAPTAR el preset a clásico.\n' +
                            '• Pulse [Cancelar] para rechazar la importación.'
                        )
                        : true;

                    if (!confirmConvert) {
                        return { error: 'Patch import rejected in standard mode', patches: [] };
                    }
                    const converted = convertPatchToClassicDM12(data);
                    return { patches: [converted], isSinglePatch: true, isProBank: false };
                }
                return { patches: [data], isSinglePatch: true, isProBank: patchCheck.isAdvanced };
            }
        } catch (err) {
            Logger.error('[BrowserParse] Error parseando JSON:', err);
        }
    }

    // Archivo SysEx clásico (.syx)
    const bytes = (fileContent instanceof Uint8Array) ? fileContent : parseSysexText(fileContent);
    if (bytes) {
        return parseSyxFile(bytes);
    }

    return { error: 'Formato de archivo no soportado', patches: [] };
}

// ── Exportar a globalThis para compatibilidad cross-file ──
globalThis.inspectPatchAdvancedFeatures = inspectPatchAdvancedFeatures;
globalThis.convertPatchToClassicDM12 = convertPatchToClassicDM12;
globalThis.inspectBankCompatibility = inspectBankCompatibility;
globalThis.convertBankToClassicDM12 = convertBankToClassicDM12;
globalThis.parseImportedBankFile = parseImportedBankFile;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        inspectPatchAdvancedFeatures: inspectPatchAdvancedFeatures,
        convertPatchToClassicDM12: convertPatchToClassicDM12,
        inspectBankCompatibility: inspectBankCompatibility,
        convertBankToClassicDM12: convertBankToClassicDM12,
        parseImportedBankFile: parseImportedBankFile,
    };
}
