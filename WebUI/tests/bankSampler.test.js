import { describe, it, expect } from 'vitest';
import { selectStratifiedPresetSample, runStratifiedBankValidation } from '../js/bank_sampler.js';

// Helper to create a fake patch
function createFakePatch(index, name = '', unpackedBytes = null) {
    const bytes = unpackedBytes || new Uint8Array(242);
    if (!unpackedBytes) {
        bytes.fill (64); // Fill with mid-range non-extreme values
    }
    return {
        index: index,
        name: name || `Patch ${index + 1}`,
        unpackedBytes: bytes
    };
}

// Helper to create a fake bank
function createFakeBank(numPatches = 128) {
    const bank = [];
    for (let i = 0; i < numPatches; i++) {
        bank.push(createFakePatch(i));
    }
    return bank;
}

describe('selectStratifiedPresetSample', () => {
    it('should return exactly the requested budget size without duplicates', () => {
        const bank = createFakeBank(128);
        const budget = 12;
        const result = selectStratifiedPresetSample(bank, { budget });

        expect(result.length).toBe(budget);
        
        const indices = result.map(item => item.index);
        const uniqueIndices = new Set(indices);
        expect(uniqueIndices.size).toBe(budget);
    });

    it('should always include expected edge indexes', () => {
        const bank = createFakeBank(128);
        const result = selectStratifiedPresetSample(bank, { budget: 12 });
        const indices = result.map(item => item.index);

        const expectedEdges = [0, 1, 63, 64, 126, 127];
        for (const edge of expectedEdges) {
            expect(indices).toContain(edge);
            
            // Check that reason contains edge-index
            const found = result.find(item => item.index === edge);
            expect(found.reasons).toContain('edge-index');
        }
    });

    it('should select patches with extreme critical bytes', () => {
        const bank = createFakeBank(128);
        
        // Let's modify patch 42 to have extreme values in critical bytes (e.g. offset 39 vcf_cutoff = 255)
        bank[42].unpackedBytes[39] = 255;
        
        const result = selectStratifiedPresetSample(bank, { budget: 12 });
        const indices = result.map(item => item.index);

        expect(indices).toContain(42);
        const found = result.find(item => item.index === 42);
        expect(found.reasons).toContain('critical-byte-extreme');
    });

    it('should select patches with complex names', () => {
        const bank = createFakeBank(128);
        
        // Let's give patch 88 a very complex and long name
        bank[88].name = 'SUPER DUPER LONG NAME WITH SPACES AND CHARS!';
        
        const result = selectStratifiedPresetSample(bank, { budget: 12 });
        const indices = result.map(item => item.index);

        expect(indices).toContain(88);
        const found = result.find(item => item.index === 88);
        expect(found.reasons).toContain('complex-name');
    });
});

describe('runStratifiedBankValidation', () => {
    it('should perform round-trip validation and report results', () => {
        // Mock window functions since they run in node/vitest environment
        global.window = global.window || {};
        
        // Mock packer functions to return successful match
        window.buildSingleSysex = (patch) => {
            const mockSysex = new Uint8Array(291);
            mockSysex.set(patch.unpackedBytes, 10);
            return mockSysex;
        };
        window.parseSyxFile = (bytes) => {
            const unpacked = bytes.slice(10, 10 + 242);
            return {
                patches: [{
                    index: 0,
                    name: 'Mock Rebuilt',
                    unpackedBytes: unpacked
                }]
            };
        };

        const bank = createFakeBank(128);
        // Modify some values to make them interesting
        bank[10].unpackedBytes[10] = 42;
        
        const results = runStratifiedBankValidation(bank, { budget: 12 });

        expect(results.sampleSize).toBe(12);
        expect(results.exactMatches).toBe(12);
        expect(results.mismatches).toBe(0);
        expect(results.perPatch.length).toBe(12);

        // Cleanup global mock
        delete global.window.buildSingleSysex;
        delete global.window.parseSyxFile;
    });
});
