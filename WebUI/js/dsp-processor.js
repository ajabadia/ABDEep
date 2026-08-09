/**
 * dsp-processor.js — AudioWorkletProcessor for ABDEep WASM DSP Engine.
 * 
 * Runs in the browser's high-priority audio thread.
 * Loads the WebAssembly DSP module and processes audio blocks in real-time.
 */

// Import the Emscripten-generated JS wrapper
import '../wasm/abdeep_dsp.js';

class ABDEepWasmProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();

        this.wasmModule = null;
        this.dsp = null; // C++ functions bound via cwrap
        this.sampleRate = options.processorOptions?.sampleRate || 44100;
        this.blockSize = 128; // Web Audio API standard block size

        // Pre-allocate WebAssembly heap buffers for outL and outR
        this.outLPtr = 0;
        this.outRPtr = 0;
        this.outLBuffer = null;
        this.outRBuffer = null;
        this.isWasmReady = false;

        // Listen for MIDI events and parameters from the main UI thread
        this.port.onmessage = this.handleMessage.bind(this);

        this.initWasm();
    }

    async initWasm() {
        try {
            // Instanciar el módulo de Emscripten
            const module = await ABDEepDSP({
                locateFile: (path) => {
                    // Cargar el archivo .wasm desde el directorio /wasm/ relativo al servidor
                    if (path.endsWith('.wasm')) {return 'wasm/' + path;}
                    return path;
                }
            });

            this.wasmModule = module;

            // Enlazar las funciones exportadas de C++ con cwrap/ccall
            this.dsp = {
                init: module.cwrap('wasm_init_engine', 'void', ['number', 'number']),
                process: module.cwrap('wasm_process_audio', 'void', ['number', 'number', 'number']),
                setParameter: module.cwrap('wasm_set_parameter', 'void', ['string', 'number']),
                noteOn: module.cwrap('wasm_note_on', 'void', ['number', 'number']),
                noteOff: module.cwrap('wasm_note_off', 'void', ['number']),
                pitchBend: module.cwrap('wasm_pitch_bend', 'void', ['number']),
                panic: module.cwrap('wasm_panic', 'void', [])
            };

            // Inicializar el motor DSP de C++ (sampleRate, blockSize)
            this.dsp.init(this.sampleRate, this.blockSize);

            // Reservar memoria en el HEAP de WASM para los 2 canales de salida (float * 128 samples)
            const numBytes = this.blockSize * 4; // 128 * sizeof(float)
            this.outLPtr = module._malloc(numBytes);
            this.outRPtr = module._malloc(numBytes);

            // Crear vistas Float32Array mapeadas sobre el HEAP de Emscripten
            this.outLBuffer = new Float32Array(module.HEAPF32.buffer, this.outLPtr, this.blockSize);
            this.outRBuffer = new Float32Array(module.HEAPF32.buffer, this.outRPtr, this.blockSize);

            this.isWasmReady = true;
            this.port.postMessage({ type: 'status', ready: true });
            console.log('[WasmProcessor] Motor DSP C++ inicializado correctamente en AudioWorklet.');
        } catch (e) {
            console.error('[WasmProcessor] Error inicializando motor WebAssembly:', e);
        }
    }

    handleMessage(event) {
        if (!this.isWasmReady || !this.dsp) {return;}

        const data = event.data;
        switch (data.type) {
            case 'note_on':
                this.dsp.noteOn(data.note, data.velocity || 0.8);
                break;
            case 'note_off':
                this.dsp.noteOff(data.note);
                break;
            case 'set_param':
                this.dsp.setParameter(data.paramId, data.value);
                break;
            case 'pitch_bend':
                this.dsp.pitchBend(data.value);
                break;
            case 'panic':
                this.dsp.panic();
                break;
        }
    }

    process(inputs, outputs, parameters) {
        if (!this.isWasmReady || !this.dsp) {
            // Si el motor WASM no está listo, emitimos silencio
            return true; 
        }

        const output = outputs[0];
        const outputChannelL = output[0];
        const outputChannelR = output[1];

        // Re-crear vistas de buffer si la memoria WASM creció o se desenganchó el buffer
        if (!this.outLBuffer || this.outLBuffer.buffer.byteLength === 0) {
            this.outLBuffer = new Float32Array(this.wasmModule.HEAPF32.buffer, this.outLPtr, this.blockSize);
            this.outRBuffer = new Float32Array(this.wasmModule.HEAPF32.buffer, this.outRPtr, this.blockSize);
        }

        // Procesar un bloque de audio llamando a C++
        // Esto escribe los resultados en outLPtr y outRPtr
        this.dsp.process(this.outLPtr, this.outRPtr, this.blockSize);

        // Copiar las muestras calculadas por el motor C++ a los buffers de salida del navegador
        if (outputChannelL) {outputChannelL.set(this.outLBuffer);}
        if (outputChannelR) {outputChannelR.set(this.outRBuffer);}

        return true;
    }
}

registerProcessor('abdeep-dsp-processor', ABDEepWasmProcessor);
