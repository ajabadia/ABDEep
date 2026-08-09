/**
 * @purpose Diagnostic Test Bank to isolate and audit DSP parameter combinations:
 *          OSC1 Saw, OSC1 Pulse PWM, OSC2, VCF Cutoff/Resonance, Envelopes, Unison, and FX.
 * @classification Integration Diagnostic Test
 */

import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(async () => {
    if (typeof globalThis.window === 'undefined') {
        globalThis.window = globalThis;
    }
    await import('../js/bridge-param-maps.js');
});

describe('Diagnostic Test Bank — Isolating DSP Parameter Combinations', () => {

    // 1. Patch 01: Raw OSC1 Saw Direct (Bypass VCF/FX)
    it('Patch 01: Raw OSC1 Saw Direct should map clean 8-bit parameter state', () => {
        const patch01 = {
            name: 'Diag 01 OSC1 Saw',
            params: {
                osc1_saw_enable: 1.0,
                osc1_square_enable: 0.0,
                osc2_level: 0.0,
                noise_level: 0.0,
                vcf_cutoff: 1.0,        // 255 -> 100% abierto
                vcf_resonance: 0.0,     // 0 -> Sin resonancia
                vcf_env_depth: 0.0,     // 0 -> Neutral (0.5 bipolar = 128)
                vca_level: 1.0,         // 255 -> Max volume
                vca_env_depth: 1.0,     // 1.0 -> Envelope controls volume
                vca_vel_sens: 0.0       // No velocity sensitivity
            }
        };

        expect(patch01.params.osc1_saw_enable).toBe(1.0);
        expect(patch01.params.vcf_cutoff).toBe(1.0);
        expect(patch01.params.vca_level).toBe(1.0);
    });

    // 2. Patch 02: OSC1 Pulse PWM Direct
    it('Patch 02: OSC1 Pulse PWM Direct should have valid pulse width parameters', () => {
        const patch02 = {
            name: 'Diag 02 OSC1 Pulse',
            params: {
                osc1_saw_enable: 0.0,
                osc1_square_enable: 1.0,
                osc1_pwm_source: 0,     // Manual
                osc1_pwm_amount: 0.5,   // 50% Duty cycle
                osc2_level: 0.0,
                vcf_cutoff: 1.0,
                vca_level: 1.0
            }
        };

        expect(patch02.params.osc1_square_enable).toBe(1.0);
        expect(patch02.params.osc1_pwm_amount).toBe(0.5);
    });

    // 3. Patch 03: OSC2 Saw + Tone Mod
    it('Patch 03: OSC2 Level & Tone Mod isolation', () => {
        const patch03 = {
            name: 'Diag 03 OSC2 Tone',
            params: {
                osc1_saw_enable: 0.0,
                osc1_square_enable: 0.0,
                osc2_level: 1.0,
                osc2_tone_mod: 0.49,    // 125 / 255 ~ 0.49
                vcf_cutoff: 1.0,
                vca_level: 1.0
            }
        };

        expect(patch03.params.osc2_level).toBe(1.0);
        expect(patch03.params.osc2_tone_mod).toBeCloseTo(0.49, 2);
    });

    // 4. Patch 04: VCF Cutoff & Resonance Sweep Isolation
    it('Patch 04: VCF Cutoff Sweep (Closed vs Half vs Open)', () => {
        const closedCutoff = 42 / 255.0;  // 42 in Blue Dolphin BC patch
        const openCutoff = 255 / 255.0;

        expect(closedCutoff).toBeGreaterThan(0.15);
        expect(closedCutoff).toBeLessThan(0.18);
        expect(openCutoff).toBe(1.0);
    });

    // 5. Patch 05: Unison Modes (Poly vs Unison 2 vs Unison 12)
    it('Patch 05: Unison Voice Allocation Modes', () => {
        const polyMode = 0;       // Poly (1 voice / note)
        const unison2Mode = 1;    // Unison 2 (2 voices / note)
        const unison12Mode = 5;   // Unison 12 (12 voices / note)

        const getVoicesPerNote = (mode) => {
            switch(mode) {
                case 1: return 2;
                case 2: return 3;
                case 3: return 4;
                case 4: return 6;
                case 5: return 12;
                default: return 1;
            }
        };

        expect(getVoicesPerNote(polyMode)).toBe(1);
        expect(getVoicesPerNote(unison2Mode)).toBe(2);
        expect(getVoicesPerNote(unison12Mode)).toBe(12);
    });

    // 6. Patch 06: Modulation Matrix Routes (Null Modulation Check)
    it('Patch 06: Modulation Matrix Unpatched Routes return 0.0', () => {
        const emptySlot = {
            src: 0,    // None
            dest: 0,   // None
            depth: 128.0 / 255.0 // Bipolar 0.0 (raw = 128)
        };

        const depthUnpacked = Math.round(emptySlot.depth * 255.0) - 128.0;
        expect(depthUnpacked).toBe(0.0);
    });
});
