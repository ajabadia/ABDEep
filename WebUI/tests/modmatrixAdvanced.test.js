/**
 * @purpose Tests for 32-slot Modulation Matrix (AbyssMind Pro extension)
 * @classification Unit Test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MOD_BLOCKS, compactModMatrix } from '../js/modmatrix_data.js';

describe('Modulation Matrix 32 Slots (AbyssMind Pro)', () => {
    it('defines 4 block ranges covering 32 slots', () => {
        expect(MOD_BLOCKS).toHaveLength(4);
        expect(MOD_BLOCKS[0].range).toEqual([1, 8]);
        expect(MOD_BLOCKS[1].range).toEqual([9, 16]);
        expect(MOD_BLOCKS[2].range).toEqual([17, 24]);
        expect(MOD_BLOCKS[3].range).toEqual([25, 32]);
    });

    it('compactModMatrix shifts active slots to the beginning and clears intermediate gaps', () => {
        const state = {};
        // Configurar slots 3 y 18 activos (huecos intermedios)
        state['mod_matrix_slot3_src'] = 0.5;
        state['mod_matrix_slot3_dest'] = 0.8;
        state['mod_matrix_slot3_depth'] = 0.7;

        state['mod_matrix_slot18_src'] = 0.2;
        state['mod_matrix_slot18_dest'] = 0.4;
        state['mod_matrix_slot18_depth'] = 0.9;

        const activeCount = compactModMatrix(state);
        expect(activeCount).toBe(2);

        // Los slots 1 y 2 deben contener ahora las 2 modulaciones activas
        expect(state['mod_matrix_slot1_src']).toBe(0.5);
        expect(state['mod_matrix_slot1_dest']).toBe(0.8);
        expect(state['mod_matrix_slot1_depth']).toBe(0.7);

        expect(state['mod_matrix_slot2_src']).toBe(0.2);
        expect(state['mod_matrix_slot2_dest']).toBe(0.4);
        expect(state['mod_matrix_slot2_depth']).toBe(0.9);

        // El slot 3 previo debe haber quedado reseteado
        expect(state['mod_matrix_slot3_src']).toBe(0);
        expect(state['mod_matrix_slot3_dest']).toBe(0);
        expect(state['mod_matrix_slot3_depth']).toBe(0.5);
    });
});
