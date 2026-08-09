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
});
