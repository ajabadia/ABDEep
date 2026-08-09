/**
 * @purpose Web Audio API AudioWorkletProcessor running the compiled WebAssembly C++ Synth Engine.
 * Runs in a high-priority background audio thread.
 */

class WasmAudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.wasmEngineReady = false;
        this.port.onmessage = (e) => this.handleMessage(e.data);
    }

    handleMessage(data) {
        if (!data) {return;}
        if (data.type === 'init_wasm') {
            this.wasmEngineReady = true;
        } else if (data.type === 'note_on') {
            if (globalThis._wasm_note_on) {
                globalThis._wasm_note_on(data.note, data.velocity || 0.8);
            }
        } else if (data.type === 'note_off') {
            if (globalThis._wasm_note_off) {
                globalThis._wasm_note_off(data.note);
            }
        } else if (data.type === 'set_param') {
            if (globalThis._wasm_set_parameter) {
                globalThis._wasm_set_parameter(data.paramId, data.value);
            }
        } else if (data.type === 'pitch_bend') {
            if (globalThis._wasm_pitch_bend) {
                globalThis._wasm_pitch_bend(data.value);
            }
        } else if (data.type === 'panic') {
            if (globalThis._wasm_panic) {
                globalThis._wasm_panic();
            }
        }
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        if (!output || output.length < 2) {return true;}

        const outL = output[0];
        const outR = output[1];
        const numSamples = outL.length;

        if (this.wasmEngineReady && globalThis._wasm_process_audio) {
            // Memory heap buffers passed to WASM
            globalThis._wasm_process_audio(outL, outR, numSamples);
        } else {
            // Silence buffer while engine initializes
            outL.fill(0);
            outR.fill(0);
        }

        return true;
    }
}

registerProcessor('wasm-audio-processor', WasmAudioProcessor);
