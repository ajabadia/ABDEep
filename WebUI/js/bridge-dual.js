/**
 * @purpose Puente de comunicación dual unificada entre la UI web y el backend nativo JUCE o la Web MIDI API.
 * @purpose_en Unified dual communication bridge between the web UI and the native JUCE backend or Web MIDI API.
 * @refactorable false
 * @classification Network/Communication Infrastructure
 * @complexity Medium
 * @fingerprint exports:1,imports:0,sig:1b2d07u
 * @lastUpdated 2026-07-04T20:00:00.000Z
 */
class DualMidiBridge {
    constructor() {
        this.isJuce = false;
        this.midiAccess = null;
        this.midiOutput = null;
        this.midiInput = null;
        this.midiChannel = 1; // Canal MIDI base (1-16)
        this.parameterCache = {};
        this.onParameterChangedCallbacks = [];

        this.init();
    }

    async init() {
        // Detectar si estamos en el entorno embebido de JUCE (Webview2)
        if (window.juce || window.__juce__ || window.__JUCE__) {
            this.isJuce = true;
            console.log("[Bridge] Entorno JUCE 8 detectado. Canal nativo activo.");
            this.setupJuceListeners();
        } else {
            console.log("[Bridge] Ejecución en Navegador Web detectada. Inicializando Web MIDI API...");
            await this.initWebMidi();
        }
    }

    // --- CONFIGURACIÓN ENTORNO JUCE ---
    setupJuceListeners() {
        // Escuchar eventos enviados desde el core C++ de JUCE
        window.onJuceEvent = (name, data) => {
            if (name === "onParameterChanged") {
                this.handleParameterChangeFromBackend(data.id, data.value);
            }
        };
    }

    // --- CONFIGURACIÓN ENTORNO WEB NATIVO ---
    async initWebMidi() {
        if (!navigator.requestMIDIAccess) {
            console.error("[WebMIDI] Este navegador no soporta Web MIDI API.");
            return;
        }

        try {
            this.midiAccess = await navigator.requestMIDIAccess({ sysex: true });
            console.log("[WebMIDI] Acceso MIDI concedido.");
            this.scanMidiDevices();

            // Escuchar si se conectan/desconectan dispositivos
            this.midiAccess.onstatechange = () => this.scanMidiDevices();
        } catch (err) {
            console.error("[WebMIDI] Error al acceder a los dispositivos MIDI:", err);
        }
    }

    scanMidiDevices() {
        const outputs = Array.from(this.midiAccess.outputs.values());
        const inputs = Array.from(this.midiAccess.inputs.values());

        console.log(`[WebMIDI] Dispositivos de salida encontrados: ${outputs.length}`);
        
        // Auto-seleccionar el primer dispositivo disponible (o uno que contenga 'DeepMind')
        const deepMindOut = outputs.find(o => o.name.toLowerCase().includes("deepmind"));
        this.midiOutput = deepMindOut || outputs[0] || null;

        const deepMindIn = inputs.find(i => i.name.toLowerCase().includes("deepmind"));
        this.midiInput = deepMindIn || inputs[0] || null;

        if (this.midiOutput) {
            console.log(`[WebMIDI] Salida seleccionada: ${this.midiOutput.name}`);
        }
        if (this.midiInput) {
            console.log(`[WebMIDI] Entrada seleccionada: ${this.midiInput.name}`);
            this.midiInput.onmidimessage = (msg) => this.handleIncomingMidi(msg);
        }
    }

    // --- ENVIAR PARÁMETRO (Hacia el Sinte / Hardware) ---
    setParameter(paramId, normalizedValue) {
        this.parameterCache[paramId] = normalizedValue;

        if (this.isJuce) {
            // Llamar a la función registrada nativamente en C++
            if (window.juce && typeof window.juce.setParameter === 'function') {
                window.juce.setParameter(paramId, normalizedValue);
            }
        } else {
            // Enviar mensaje MIDI directo usando la especificación de parámetros
            this.sendWebMidiParameter(paramId, normalizedValue);
        }
    }

    requestMidiDump(type) {
        if (this.isJuce) {
            if (window.juce && typeof window.juce.requestMidiDump === 'function') {
                window.juce.requestMidiDump(type);
            }
        } else {
            // En modo Web, enviar SysEx si está disponible
            if (this.midiOutput) {
                let msgBytes = [];
                if (type === "edit") {
                    msgBytes = [0xF0, 0x00, 0x20, 0x32, 0x20, 0x00, 0x03, 0xF7];
                } else if (type === "global") {
                    msgBytes = [0xF0, 0x00, 0x20, 0x32, 0x20, 0x00, 0x05, 0xF7];
                }
                if (msgBytes.length > 0) {
                    console.log(`[WebMIDI Send] SysEx Dump Request (${type})`);
                    this.midiOutput.send(msgBytes);
                }
            }
        }
    }

    sendWebMidiParameter(paramId, normalizedValue) {
        if (!this.midiOutput) return;

        // Mapeo básico de CC para OSC y VCF
        const ccMappings = {
            "osc1_saw_enable": 15,
            "osc1_square_enable": 16,
            "osc1_pwm_amount": 17,
            "osc2_tone_mod": 19,
            "osc2_pitch": 20,
            "osc2_level": 21,
            "vcf_cutoff": 23,
            "vcf_resonance": 24,
            "hpf_cutoff": 27
        };

        const cc = ccMappings[paramId];
        if (cc !== undefined) {
            const midiVal = Math.round(normalizedValue * 127);
            const statusByte = 0xB0 | (this.midiChannel - 1); // Control Change canal seleccionado
            
            console.log(`[WebMIDI Send] ${paramId} -> CC ${cc} = ${midiVal}`);
            this.midiOutput.send([statusByte, cc, midiVal]);
        }
    }

    // --- RECIBIR MIDI EN MODO WEB ---
    handleIncomingMidi(midiMessage) {
        const data = midiMessage.data;
        if (!data || data.length === 0) return;

        const status = data[0] & 0xF0;
        const channel = (data[0] & 0x0F) + 1;

        // Comprobar si es un mensaje SysEx completo de volcado de programa (291 bytes)
        if (data[0] === 0xF0 && data.length === 291) {
            // Cabecera Behringer DeepMind: F0 00 20 32 20 [DeviceID] [CommandType]
            // Si CommandType es 0x02 es un volcado de programa (program dump)
            if (data[1] === 0x00 && data[2] === 0x20 && data[3] === 0x32 && data[6] === 0x02) {
                // El banco y programa suelen venir en el payload desempaquetado o en el SysEx
                // En el DeepMind 12, los bytes de cabecera del payload desempaquetado de 242 bytes 
                // contienen la posición (byte 0 es banco [0-7], byte 1 es programa [0-127])
                
                // Extraer y desempaquetar payload (278 bytes) a partir del byte index 8
                const packedPayload = data.slice(8, 286);
                if (typeof window.unpack7to8 === 'function') {
                    const unpackedBytes = window.unpack7to8(packedPayload);
                    
                    // Extraer banco y programa de destino
                    const bankIndex = unpackedBytes[0] & 0x07;
                    const progIndex = unpackedBytes[1] & 0x7F;
                    
                    const bankLetter = String.fromCharCode(65 + bankIndex); // A, B, C...
                    
                    // Extraer nombre del preset
                    let nameChars = [];
                    for (let j = 265; j <= 281; j++) {
                        const b = data[j];
                        if (b > 0) nameChars.push(String.fromCharCode(b));
                    }
                    const patchName = nameChars.join('').trim() || `Hw Patch ${progIndex + 1}`;

                    if (window.hardwareBanks && window.hardwareBanks[bankLetter]) {
                        window.hardwareBanks[bankLetter][progIndex] = {
                            index: progIndex,
                            name: patchName,
                            unpackedBytes: unpackedBytes
                        };
                        
                        console.log(`[WebMIDI SysEx] Guardado preset de entrada en Hardware ${bankLetter}-${progIndex+1}: ${patchName}`);
                        
                        // Refrescar visor si el banco hardware activo coincide
                        if (typeof window.renderHardwarePatches === 'function' && window.currentHwBankLetter === bankLetter) {
                            window.renderHardwarePatches();
                        }
                    }
                }
            }
            return;
        }

        if (status === 0xB0) { // Control Change
            const cc = data[1];
            const val = data[2];
            const normalized = val / 127.0;

            // Encontrar el parámetro correspondiente
            const ccMappings = {
                15: "osc1_saw_enable",
                16: "osc1_square_enable",
                17: "osc1_pwm_amount",
                19: "osc2_tone_mod",
                20: "osc2_pitch",
                21: "osc2_level",
                23: "vcf_cutoff",
                24: "vcf_resonance",
                27: "hpf_cutoff"
            };

            const paramId = ccMappings[cc];
            if (paramId) {
                this.handleParameterChangeFromBackend(paramId, normalized);
            }
        }
    }

    handleParameterChangeFromBackend(paramId, normalizedValue) {
        this.parameterCache[paramId] = normalizedValue;
        this.onParameterChangedCallbacks.forEach(cb => cb(paramId, normalizedValue));
    }

    onParameterChanged(callback) {
        this.onParameterChangedCallbacks.push(callback);
    }
}

// Instancia Global
window.dualMidiBridge = new DualMidiBridge();
