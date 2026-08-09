import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('WasmBridge Operating Modes & AudioWorklet Manager', () => {
    let window;

    beforeEach(() => {
        window = {
            localStorage: {
                _store: {},
                getItem(k) { return this._store[k] || null; },
                setItem(k, v) { this._store[k] = String(v); }
            },
            document: {
                getElementById() { return null; },
                addEventListener() {}
            },
            appMode: 'advanced',
            addEventListener() {}
        };
        global.window = window;
        global.localStorage = window.localStorage;
        global.document = window.document;

        const code = fs.readFileSync(path.resolve(__dirname, '../js/wasm_bridge.js'), 'utf-8');
        eval(code);
    });

    it('initializes default mode to abyssmind_pro when no stored preference', () => {
        expect(window.wasmBridge).toBeDefined();
        expect(window.wasmBridge.getMode()).toBe('abyssmind_pro');
    });

    it('allows changing mode to deepmind_hw_controller', () => {
        window.wasmBridge.setMode('deepmind_hw_controller');
        expect(window.wasmBridge.getMode()).toBe('deepmind_hw_controller');
        expect(window.appMode).toBe('standard');
    });

    it('allows changing mode to deepmind_web_standalone', () => {
        window.wasmBridge.setMode('deepmind_web_standalone');
        expect(window.wasmBridge.getMode()).toBe('deepmind_web_standalone');
        expect(window.appMode).toBe('advanced');
    });

    it('handles noteOn, noteOff, and panic safely before AudioContext init', () => {
        expect(() => window.wasmBridge.noteOn(60, 0.8)).not.toThrow();
        expect(() => window.wasmBridge.noteOff(60)).not.toThrow();
        expect(() => window.wasmBridge.panic()).not.toThrow();
    });

    it('exposes ModelCapabilities resolved per mode when module is loaded', () => {
        // Fase 5 §1.1: con model_capabilities.js cargado, wasmBridge expone las
        // capabilities del modelo vigente y las actualiza al cambiar de modo.
        const mcCode = fs.readFileSync(path.resolve(__dirname, '../js/model_capabilities.js'), 'utf-8');
        eval(mcCode);
        const code = fs.readFileSync(path.resolve(__dirname, '../js/wasm_bridge.js'), 'utf-8');
        eval(code);

        expect(window.wasmBridge.getCapabilities()).not.toBeNull();
        expect(window.wasmBridge.getCapabilities().model).toBe('abyssmind_pro');
        expect(window.wasmBridge.getCapabilities().supportsAbyssMindParameters).toBe(true);

        window.wasmBridge.setMode('deepmind_hw_controller');
        expect(window.wasmBridge.getCapabilities().model).toBe('dm12_hardware');
        expect(window.wasmBridge.getCapabilities().advancedFxCount).toBe(0);
        expect(window.wasmBridge.getCapabilities().supportsExtendedSequencer).toBe(false);
    });

    it('notifies the worklet with set_model (0 dm12 / 1 abyssmind) on mode change', () => {
        // Fase 5 §1.1: setMode postea {type:'set_model', model} al worklet para que
        // el bridge JS y el motor C++ (wasm_set_model) no diverjan.
        const sent = [];
        window.wasmBridge.workletNode = { port: { postMessage: (m) => sent.push(m) } };

        window.wasmBridge.setMode('deepmind_hw_controller');
        expect(sent.some((m) => m.type === 'set_model' && m.model === 0)).toBe(true);

        window.wasmBridge.setMode('abyssmind_pro');
        expect(sent.some((m) => m.type === 'set_model' && m.model === 1)).toBe(true);
    });

    it('capabilities stay null (sin lanzar) cuando ModelCapabilities no está cargado', () => {
        // El mock window de beforeEach NO tiene ModelCapabilities → null sin error.
        expect(window.wasmBridge.getCapabilities()).toBeNull();
    });
});
