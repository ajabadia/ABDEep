/**
 * @purpose Tests for Bank-Level Compatibility, Pro Patch Detection, Conversion & Universal vs Classic File Reader
 * @classification Unit Test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    inspectBankCompatibility,
    convertBankToClassicDM12,
    parseImportedBankFile
} from '../js/browser_io_parse_import.js';
import {
    exportBankJson
} from '../js/browser_io_parse_export.js';

describe('Bank Compatibility & Universal Reader System', () => {
    it('classifies a bank with only standard patches as pure hardware', () => {
        const standardBank = [
            { name: 'Lead 1', params: { vcf_cutoff: 0.5, fx1_type: 2 / 56.0 } },
            { name: 'Pad 2', params: { vcf_cutoff: 0.8, fx1_type: 5 / 56.0 } }
        ];

        const check = inspectBankCompatibility('TestBank', standardBank);
        expect(check.isPureHardware).toBe(true);
        expect(check.hasProPatches).toBe(false);
        expect(check.proCount).toBe(0);
        expect(check.bankType).toBe('dm12_hardware');
    });

    it('detects Pro patches in a bank and reports indices', () => {
        const mixedBank = [
            { name: 'Standard 1', params: { vcf_cutoff: 0.5 } },
            { name: 'Pro FX 2', params: { fx1_type: 39 / 56.0 } },
            { name: 'Standard 3', params: { vcf_cutoff: 0.2 } },
            { name: 'Pro VCF 4', params: { vcf_model: 0.5 } }
        ];

        const check = inspectBankCompatibility('MixedBank', mixedBank);
        expect(check.isPureHardware).toBe(false);
        expect(check.hasProPatches).toBe(true);
        expect(check.proCount).toBe(2);
        expect(check.proIndices).toEqual([1, 3]);
        expect(check.bankType).toBe('abyss_pro');
    });

    it('convertBankToClassicDM12 converts all patches in a bank to Hardware OK', () => {
        const mixedBank = [
            { name: 'Standard 1', params: { vcf_cutoff: 0.5 } },
            { name: 'Pro FX 2', params: { fx1_type: 39 / 56.0 } },
            { name: 'Pro VCF 4', params: { vcf_model: 0.5 } }
        ];

        const classicBank = convertBankToClassicDM12('MixedBank', mixedBank);
        expect(classicBank).toHaveLength(3);

        const checkAfter = inspectBankCompatibility('ConvertedBank', classicBank);
        expect(checkAfter.isPureHardware).toBe(true);
        expect(checkAfter.hasProPatches).toBe(false);
        expect(checkAfter.proCount).toBe(0);
    });

    describe('parseImportedBankFile Universal vs Classic Mode', () => {
        const originalWindow = globalThis.window;

        beforeEach(() => {
            globalThis.window = globalThis.window || {};
        });

        afterEach(() => {
            globalThis.window = originalWindow;
        });

        it('Pro Mode reads JSON Pro Bank files natively', () => {
            globalThis.window.appMode = 'advanced';
            const jsonContent = JSON.stringify({
                bankName: 'Pro Bank',
                patches: [{ name: 'Space Echo Lead', params: { fx1_type: 39 / 56.0 } }]
            });

            const result = parseImportedBankFile(jsonContent, 'pro_bank.json');
            expect(result.bankName).toBe('Pro Bank');
            expect(result.isProBank).toBe(true);
            expect(result.patches).toHaveLength(1);
        });

        it('Standard Mode converts JSON Pro Bank file on confirmation', () => {
            globalThis.window.appMode = 'standard';
            globalThis.window.confirm = () => true;

            const jsonContent = JSON.stringify({
                bankName: 'Pro Bank',
                patches: [{ name: 'Space Echo Lead', params: { fx1_type: 39 / 56.0 } }]
            });

            const result = parseImportedBankFile(jsonContent, 'pro_bank.json');
            expect(result.bankName).toContain('(Classic)');
            expect(result.isProBank).toBe(false);
            expect(result.patches[0].params.fx1_type).toBe(22 / 56.0); // Convertido a Delay (22)
        });
    });
});
