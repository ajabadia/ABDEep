/**
 * @purpose Tests for Pro patch inspection, SysEx safety, and Smart Classic Downgrade
 * @classification Unit Test
 */

import { describe, it, expect } from 'vitest';
import {
    inspectPatchAdvancedFeatures,
    convertPatchToClassicDM12
} from '../js/browser_io_parse_import.js';
import {
    exportSinglePatchJson
} from '../js/browser_io_parse_export.js';

describe('Patch Compatibility & Pro Inspection System', () => {
    it('classifies a standard patch as HARDWARE OK', () => {
        const standardPatch = {
            name: 'Standard Lead',
            params: {
                vcf_cutoff: 0.8,
                vcf_model: 0.0,
                fx1_type: 5 / 56.0, // Hall Reverb (ID 5)
                mod_matrix_slot1_src: 0.2,
                mod_matrix_slot1_dest: 0.5
            }
        };

        const result = inspectPatchAdvancedFeatures(standardPatch);
        expect(result.isAdvanced).toBe(false);
        expect(result.compatibilityLevel).toBe('hardware_ok');
        expect(result.reasons).toHaveLength(0);
    });

    it('detects Pro FX types (ID > 35) as PRO EXCLUSIVE', () => {
        const proFxPatch = {
            name: 'Space Echo Patch',
            params: {
                fx1_type: 39 / 56.0 // Space Echo RE-201 (ID 39)
            }
        };

        const result = inspectPatchAdvancedFeatures(proFxPatch);
        expect(result.isAdvanced).toBe(true);
        expect(result.compatibilityLevel).toBe('pro_exclusive');
        expect(result.reasons).toContain('FX1: Pro Type 39');
    });

    it('detects VCF Moog / Korg models as PRO EXCLUSIVE', () => {
        const proVcfPatch = {
            name: 'Moog Bass',
            params: {
                vcf_model: 0.5 // Moog Ladder (1 / 2.0 = 0.5)
            }
        };

        const result = inspectPatchAdvancedFeatures(proVcfPatch);
        expect(result.isAdvanced).toBe(true);
        expect(result.reasons).toContain('VCF: Moog Ladder');
    });

    it('detects ModMatrix slots 9–32 as PRO EXCLUSIVE', () => {
        const proModPatch = {
            name: 'Complex Mod Matrix',
            params: {
                mod_matrix_slot14_src: 0.4,
                mod_matrix_slot14_dest: 0.6
            }
        };

        const result = inspectPatchAdvancedFeatures(proModPatch);
        expect(result.isAdvanced).toBe(true);
        expect(result.reasons).toContain('ModMatrix: Slot 14');
    });

    it('convertPatchToClassicDM12 downgrades Pro patches to 100% Hardware OK', () => {
        const proPatch = {
            name: 'Pro Lead',
            unpackedBytes: new Uint8Array(242),
            params: {
                vcf_cutoff: 0.7,
                vcf_model: 0.5, // Moog Ladder
                fx1_type: 39 / 56.0, // Space Echo (39)
                mod_matrix_slot1_src: 0.1,
                mod_matrix_slot1_dest: 0.2,
                mod_matrix_slot12_src: 0.5,
                mod_matrix_slot12_dest: 0.8
            }
        };

        const classicPatch = convertPatchToClassicDM12(proPatch);
        expect(classicPatch).not.toBeNull();

        // 1. Cutoff y parámetros básicos conservados
        expect(classicPatch.params.vcf_cutoff).toBe(0.7);

        // 2. VCF Moog degradado a OTA (0)
        expect(classicPatch.params.vcf_model).toBe(0);

        // 3. FX Space Echo (39) degradado a Delay (22)
        expect(Math.round(classicPatch.params.fx1_type * 56)).toBe(22);

        // 4. ModMatrix slot 12 reseteado a 0
        expect(classicPatch.params.mod_matrix_slot12_src).toBe(0);

        // 5. El patch resultante pasa como HARDWARE OK
        const checkAfter = inspectPatchAdvancedFeatures(classicPatch);
        expect(checkAfter.isAdvanced).toBe(false);
        expect(checkAfter.compatibilityLevel).toBe('hardware_ok');
    });
});
