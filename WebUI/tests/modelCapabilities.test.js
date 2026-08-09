/**
 * modelCapabilities.test.js — Fase 5 (plan v3.2 §1.1): matriz formal de capabilities.
 *
 *   - Matriz canónica: dm12_hardware (35 FX estándar, sin extendidos) vs
 *     abyssmind_pro (35 + 21 avanzados, sequencer extendido, params AbyssMind).
 *   - resolveModel: mapea los 3 modos de UI al modelo canónico (fallback seguro).
 *   - getCapabilitiesForMode / isValidModelCapabilities.
 */

import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const { ModelCapabilities, MODEL_CAPABILITIES, MODELS, MODE_TO_MODEL } =
    require(path.join(ROOT, 'WebUI', 'js', 'model_capabilities.js'));

describe('ModelCapabilities (Fase 5 §1.1)', () => {
    it('matriz canónica con exactamente los dos modelos', () => {
        expect(MODELS).toEqual(['dm12_hardware', 'abyssmind_pro']);
    });

    it('dm12_hardware: 35 FX estándar, 0 avanzados, 8 slots mod, sin extendidos', () => {
        const dm = MODEL_CAPABILITIES.dm12_hardware;
        expect(dm.model).toBe('dm12_hardware');
        expect(dm.standardFxCount).toBe(35);
        expect(dm.advancedFxCount).toBe(0);
        expect(dm.modulationSlotCount).toBe(8);
        expect(dm.supportsExtendedSequencer).toBe(false);
        expect(dm.supportsAbyssMindParameters).toBe(false);
    });

    it('abyssmind_pro: 35 + 21 FX, 8 slots mod, sequencer y params AbyssMind', () => {
        const pro = MODEL_CAPABILITIES.abyssmind_pro;
        expect(pro.model).toBe('abyssmind_pro');
        expect(pro.standardFxCount).toBe(35);
        expect(pro.advancedFxCount).toBe(21);
        expect(pro.modulationSlotCount).toBe(8);
        expect(pro.supportsExtendedSequencer).toBe(true);
        expect(pro.supportsAbyssMindParameters).toBe(true);
    });

    it('resolveModel mapea los 3 modos de UI al modelo canónico', () => {
        expect(ModelCapabilities.resolveModel('deepmind_hw_controller')).toBe('dm12_hardware');
        expect(ModelCapabilities.resolveModel('deepmind_web_standalone')).toBe('dm12_hardware');
        expect(ModelCapabilities.resolveModel('abyssmind_pro')).toBe('abyssmind_pro');
        // Modelo canónico directo también es válido (idempotente).
        expect(ModelCapabilities.resolveModel('dm12_hardware')).toBe('dm12_hardware');
        // Desconocido → fallback seguro a abyssmind_pro.
        expect(ModelCapabilities.resolveModel('modo_inexistente')).toBe('abyssmind_pro');
        expect(ModelCapabilities.resolveModel(undefined)).toBe('abyssmind_pro');
    });

    it('MODE_TO_MODEL cubre los modos que maneja wasm_bridge.js', () => {
        expect(MODE_TO_MODEL).toHaveProperty('deepmind_hw_controller');
        expect(MODE_TO_MODEL).toHaveProperty('deepmind_web_standalone');
        expect(MODE_TO_MODEL).toHaveProperty('abyssmind_pro');
    });

    it('getCapabilitiesForMode devuelve la entrada canónica correcta', () => {
        expect(ModelCapabilities.getCapabilitiesForMode('deepmind_hw_controller').model).toBe('dm12_hardware');
        expect(ModelCapabilities.getCapabilitiesForMode('deepmind_web_standalone').supportsAbyssMindParameters).toBe(false);
        expect(ModelCapabilities.getCapabilitiesForMode('abyssmind_pro').supportsAbyssMindParameters).toBe(true);
        // Desconocido → abyssmind_pro (fallback).
        expect(ModelCapabilities.getCapabilitiesForMode('x').model).toBe('abyssmind_pro');
    });

    it('getModelCapabilities devuelve null para modelos inexistentes', () => {
        expect(ModelCapabilities.getModelCapabilities('nope')).toBeNull();
        expect(ModelCapabilities.getModelCapabilities(null)).toBeNull();
        expect(ModelCapabilities.getModelCapabilities('dm12_hardware')).not.toBeNull();
    });

    it('isValidModelCapabilities valida por campos, no por identidad', () => {
        // Clon plano (no congelado) de la entrada canónica → válido.
        const clone = Object.assign({}, MODEL_CAPABILITIES.abyssmind_pro);
        expect(ModelCapabilities.isValidModelCapabilities(clone)).toBe(true);
        // Campos incoherentes → inválido.
        expect(ModelCapabilities.isValidModelCapabilities({
            model: 'abyssmind_pro', standardFxCount: 10, advancedFxCount: 0,
            modulationSlotCount: 4, supportsExtendedSequencer: false,
            supportsAbyssMindParameters: false,
        })).toBe(false);
        expect(ModelCapabilities.isValidModelCapabilities(null)).toBe(false);
        expect(ModelCapabilities.isValidModelCapabilities('texto')).toBe(false);
        expect(ModelCapabilities.isValidModelCapabilities({ model: 'nope' })).toBe(false);
    });
});
