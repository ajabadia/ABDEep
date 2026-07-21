/**
 * @purpose Puente de comunicación dual unificada entre la UI web y el backend nativo JUCE o la Web MIDI API.
 * @purpose_en Unified dual communication bridge between the web UI and the native JUCE backend or Web MIDI API.
 * @refactorable false
 * @classification Network/Communication Infrastructure
 * @complexity Medium
 * @fingerprint exports:1,imports:0,sig:1b2d07u
 * @lastUpdated 2026-07-12T01:50:00.000Z
 */
class DualMidiBridge {
    get isJuce() {
        return this._isJuce || (window.juce !== undefined || window.__juce__ !== undefined || window.__JUCE__ !== undefined);
    }
    set isJuce(val) {
        this._isJuce = val;
    }
    constructor() {
        this._isJuce = false;
        this.midiAccess = null;
        this.midiOutput = null;
        this.midiInput = null;
        this.midiChannel = 1; // Canal MIDI base (1-16)
        this.parameterCache = {};
        this._globalParams = {};
        this.onParameterChangedCallbacks = [];

        // Sistema de peticiones SysEx con timeout
        this._pendingSysExRequests = [];
        this._connected = false;

        // Variables de MIDI Learn
        this.midiLearnActive = false;
        this.midiLearnTargetParam = null;
        this.midiLearnPendingCC = null;
        this.midiLearnMappings = {};
        this.midiLearnChangeCallbacks = [];

        // Info de hardware capturada
        this._hardwareInfo = {
            hostVersion: '-',
            voiceVersion: '-',
            dspVersion: '-',
            bootVersion: '-',
            wifiVersion: '-',
            deviceId: '0',
            midiChannel: 1,
            connectionType: '-',
            globalDumpBytes: null  // Bytes crudos del Global Dump
        };

        // Cache de envío de NRPN
        this._lastNrpnMsb = null;
        this._lastNrpnLsb = null;
        this._lastNrpnValue = null;
        this._lastNrpnByte = null;

        // Estado NRPN entrante (para decode desde hardware)
        this._nrpnInMsb = null;      // último CC99 recibido
        this._nrpnInLsb = null;      // último CC98 recibido
        this._nrpnInDataMsb = 0;     // último CC6 recibido
        this._nrpnInTimestamp = 0;   // timestamp del último CC99/CC98

        // Tráfico NRPN
        this._nrpnTxBytes = 0;
        this._nrpnRxBytes = 0;
        this._nrpnPktCount = 0;
        this._nrpnTrafficCallbacks = [];

        // Estado de cambio de banco/programa para auto-dump
        this._lastBankSelectMSB = null;
        this._lastBankSelectLSB = null;
        this._lastProgramChange = null;
        this._autoDumpTimer = null;

        // Colección de bank dump
        this._bankDumpInProgress = false;
        this._bankDumpCallback = null;
        this._bankDumpCancel = false;
        this._bankDumpResolve = null;
        this._bankDumpTimeout = null;

        this.init();
    }

    async init() {
        // NOTE: Do NOT overwrite window.juce — the bootstrap sets up the JUCE 8
        // compatibility shim with event-based native function wrappers.
        this._ready = false;
        this._readyPromise = new Promise((resolve) => {
            this._resolveReady = resolve;
        });

        // Expose bridge instance for bootstrap event callbacks
        window._bridgeInstance = this;

        // Helper: check if any JUCE native bridge is available
        const isJuceAvailable = () => !!(window.juce || window.__juce__ || window.__JUCE__);

        // Detectar si la URL o el UA sugieren entorno JUCE
        const isJuceHost = window.location.protocol === 'juce:' || 
                           (window.location.hostname === 'localhost' && window.location.port === '') ||
                           window.navigator.userAgent.includes('WebView') ||
                           window.navigator.userAgent.includes('Edge/');
        const maxAttempts = isJuceHost ? 150 : 5; // hasta 3 segundos en JUCE, 100ms en navegador normal

        // Esperar por JUCE native bridge de forma asíncrona
        for (let i = 0; i < maxAttempts; i++) {
            if (isJuceAvailable()) {
                console.log('[Bridge] JUCE native found after ' + (i * 20) + 'ms');
                break;
            }
            await new Promise(r => setTimeout(r, 20));
        }

        // Log final detection state for diagnostics
        console.log('[Bridge] Detection result: __juce__=' + typeof window.__juce__
            + ' __JUCE__=' + typeof window.__JUCE__
            + ' juce=' + typeof window.juce
            + ' chrome.webview=' + typeof (window.chrome && window.chrome.webview));

        // Detectar si estamos en el entorno embebido de JUCE (Webview2)
        if (isJuceAvailable()) {
            this.isJuce = true;
            this._connected = true;
            
            // Console redirect is handled by webview-bootstrap.js.
            // No duplicate override here.

            console.log('[Bridge] Entorno JUCE 8 detectado. Canal nativo activo.');
            this.setupJuceListeners();
            this._ready = true;
            this._resolveReady(true);
            this._updateConnectionUI();
        } else {
            console.log('[Bridge] Ejecución en Navegador Web detectada. Inicializando Web MIDI API...');
            await this.initWebMidi();
            this._ready = true;
            this._resolveReady(true);
        }
    }

    /**
     * Espera a que el bridge esté completamente listo (_ready = true).
     * @param {number} [timeoutMs=10000] - Timeout máximo de espera en ms.
     * @returns {Promise<boolean>} true si el bridge está listo, false si timeout.
     */
    async waitForReady(timeoutMs = 10000) {
        if (this._ready) {return true;}
        try {
            await Promise.race([
                this._readyPromise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))
            ]);
            return true;
        } catch (e) {
            console.warn('[Bridge] waitForReady timeout after ' + timeoutMs + 'ms — proceeding anyway');
            return false;
        }
    }

    // --- CONFIGURACIÓN ENTORNO JUCE ---
    setupJuceListeners() {
        // JUCE 8 uses window.__JUCE__.backend.addEventListener for C++ → JS events.
        // The bootstrap already installs an "onParameterChanged" listener that calls
        // window._bridgeInstance.handleParameterChangeFromBackend().
        // We also add a fallback for the old window.onJuceEvent API (pre-JUCE-8).
        if (window.__JUCE__ && window.__JUCE__.backend) {
            // JUCE 8 event-based listener (primary)
            window.__JUCE__.backend.addEventListener('onParameterChanged', (data) => {
                this.handleParameterChangeFromBackend(data.id, data.value);
            });
        }
        // Legacy fallback
        window.onJuceEvent = (name, data) => {
            if (name === 'onParameterChanged') {
                this.handleParameterChangeFromBackend(data.id, data.value);
            }
        };
    }

    // --- CONFIGURACIÓN ENTORNO WEB NATIVO ---
    async initWebMidi() {
        if (!navigator.requestMIDIAccess) {
            console.error('[WebMIDI] Este navegador no soporta Web MIDI API.');
            return;
        }

        try {
            this.midiAccess = await navigator.requestMIDIAccess({ sysex: true });
            console.log('[WebMIDI] Acceso MIDI concedido.');
            this.scanMidiDevices();

            // Verificar si el hardware DeepMind 12 responde
            setTimeout(async () => {
                const connected = await this.isConnected();
                this._connected = connected;
                this._updateConnectionUI();
                if (connected) {
                    console.log('[Bridge] ✅ DeepMind 12 listo para comunicación');
                    try {
                        const globalDump = await this.requestMidiDump('global', 3000, 1);
                        if (globalDump && globalDump.length >= 30) {
                            this._parseGlobalDump(globalDump);
                            if (typeof window._updateSettingsHardwareInfo === 'function') {
                                window._updateSettingsHardwareInfo();
                            }
                        }
                    } catch (e) {
                        console.warn('[Bridge] No se pudo obtener Global Dump inicial:', e.message);
                    }
                } else {
                    console.warn('[Bridge] ⚠️ DeepMind 12 no detectado. Solo modo editor local.');
                }
            }, 500);

            // Escuchar si se conectan/desconectan dispositivos
            this.midiAccess.onstatechange = () => this.scanMidiDevices();
        } catch (err) {
            console.error('[WebMIDI] Error al acceder a los dispositivos MIDI:', err);
        }
    }

    _isLikelyVirtualPort(name) {
        const lower = name.toLowerCase();
        return lower.includes('virtual') || lower.includes('iac driver');
    }

    _detectConnectionType(portName) {
        if (!portName) {return 'Unknown';}
        const lower = portName.toLowerCase();
        if (lower.includes('deepmind') || lower.includes('u2midi')) {
            return 'USB MIDI';
        }
        if (lower.includes('wifi') || lower.includes('wireless') || lower.includes('network') || lower.includes('rtpmidi')) {
            return 'WiFi MIDI';
        }
        if (lower.includes('usb') || lower.includes('usb midi')) {
            return 'USB MIDI';
        }
        if (lower.includes('midi') && (lower.includes('in') || lower.includes('out') || lower.includes('port'))) {
            return 'MIDI DIN';
        }
        return 'MIDI DIN';
    }

    _selectMidiPort(ports, kind = 'output') {
        if (!ports || ports.size === 0) {return null;}
        const list = Array.from(ports.values());
        const preferredNeedles = ['deepmind', 'u2midi'];

        for (const needle of preferredNeedles) {
            const match = list.find(p => p.name.toLowerCase().includes(needle));
            if (match) {
                console.log(`[WebMIDI] ${kind} seleccionado por coincidencia "${needle}": ${match.name}`);
                return match;
            }
        }

        const nonVirtual = list.find(p => !this._isLikelyVirtualPort(p.name));
        if (nonVirtual) {
            console.log(`[WebMIDI] ${kind} seleccionado (no-virtual): ${nonVirtual.name}`);
            return nonVirtual;
        }

        return list[0] || null;
    }

    scanMidiDevices() {
        const outputs = this.midiAccess.outputs;
        const inputs = this.midiAccess.inputs;

        // Clean up old handlers to prevent memory leaks on rescan
        if (this.midiInput) {
            this.midiInput.onmidimessage = null;
        }

        this.midiOutput = this._selectMidiPort(outputs, 'output');
        this.midiInput = this._selectMidiPort(inputs, 'input');

        if (this.midiOutput) {
            console.log(`[WebMIDI] Salida seleccionada: ${this.midiOutput.name}`);
        }
        if (this.midiInput) {
            console.log(`[WebMIDI] Entrada seleccionada: ${this.midiInput.name}`);
            this.midiInput.onmidimessage = (msg) => this.handleIncomingMidi(msg);
        }
    }

    // --- ENVIAR PARÁMETRO (Hacia el Sinte / Hardware) ---
    setParameter(paramId, normalizedValue, forceResend) {
        // Nivel 1: Evitar envío si el valor no cambia significativamente (excepto en carga forzada)
        const cached = this.parameterCache[paramId];
        if (!forceResend && cached !== undefined && Math.abs(cached - normalizedValue) < 0.001) {
            this.parameterCache[paramId] = normalizedValue;
            return;
        }

        this.parameterCache[paramId] = normalizedValue;

        if (this.isJuce) {
            if (window.juce && typeof window.juce.setParameter === 'function') {
                window.juce.setParameter(paramId, normalizedValue);
            }
            this.handleParameterChangeFromBackend(paramId, normalizedValue);
        } else {
            this.sendWebMidiParameter(paramId, normalizedValue);
            this.handleParameterChangeFromBackend(paramId, normalizedValue);
        }
    }

    async readFactoryBankFile(letter) {
        if (this.isJuce) {
            if (window.juce && typeof window.juce.readFactoryBankFile === 'function') {
                return window.juce.readFactoryBankFile(letter);
            }
        }
        return null;
    }

    async requestMidiDump(type, timeoutMs = 3000, retries = 2) {
        if (this.isJuce) {
            if (window.juce && typeof window.juce.requestMidiDump === 'function') {
                return window.juce.requestMidiDump(type);
            }
            return null;
        }

        if (!this.midiOutput || !this.midiInput) {
            console.warn('[SysEx] No MIDI ports available for dump request');
            return null;
        }

        let requestBytes = [];
        let dumpCommand = 0;
        const devId = parseInt(this._hardwareInfo.deviceId) || 0;

        if (type === 'edit') {
            requestBytes = [0xF0, 0x00, 0x20, 0x32, 0x20, devId & 0x0F, 0x03, 0xF7];
            dumpCommand = 0x04;
        } else if (type === 'global') {
            requestBytes = [0xF0, 0x00, 0x20, 0x32, 0x20, devId & 0x0F, 0x05, 0xF7];
            dumpCommand = 0x06;
        } else {
            console.warn(`[SysEx] Unknown dump type: ${type}`);
            return null;
        }

        const isDumpResponse = (msg) => {
            return msg.length >= 10 &&
                   msg[0] === 0xF0 &&
                   msg[1] === 0x00 &&
                   msg[2] === 0x20 &&
                   msg[3] === 0x32 &&
                   msg[6] === dumpCommand;
        };

        for (let attempt = 1; attempt <= Math.max(1, retries + 1); attempt++) {
            try {
                console.log(`[SysEx] Solicitando dump ${type} (intento ${attempt}/${retries + 1}) con timeout ${timeoutMs}ms...`);
                const response = await this.requestSysEx(requestBytes, timeoutMs, isDumpResponse);
                return response;
            } catch (err) {
                if (attempt <= retries) {
                    console.warn(`[SysEx] Intento ${attempt} falló, re-intentando en 500ms: ${err.message}`);
                    await new Promise(r => setTimeout(r, 500));
                } else {
                    console.error(`[SysEx] Todos los intentos fallaron para dump ${type}: ${err.message}`);
                    return null;
                }
            }
        }
        return null;
    }

    async requestSysEx(requestBytes, timeoutMs = 3000, predicate = null) {
        if (!this.midiOutput || !this.midiInput) {
            throw new Error('[SysEx] No MIDI port available');
        }

        return new Promise((resolve, reject) => {
            const start = Date.now();
            let timer = null;
            let disposed = false;

            const done = (err, msg) => {
                if (disposed) {return;}
                disposed = true;
                if (timer) {clearTimeout(timer);}
                this._pendingSysExRequests = this._pendingSysExRequests.filter(r => r !== entry);
                if (err) {return reject(err);}
                resolve(msg);
            };

            const entry = {
                predicate: predicate || (() => true),
                resolve: (msg) => done(null, msg),
                reject: (err) => done(err),
                timer: null
            };

            timer = setTimeout(() => {
                const elapsed = Date.now() - start;
                done(new Error(`[SysEx] Timeout after ${elapsed}ms waiting for response`), null);
            }, timeoutMs);

            entry.timer = timer;
            this._pendingSysExRequests.push(entry);

            this._signalMidiActivity();
            this.midiOutput.send(requestBytes);
        });
    }

    _parseGlobalDump(dump) {
        if (!dump || dump.length < 15) {return;}
        
        let payload = [];
        for (let i = 8; i < dump.length - 1; i++) {
            payload.push(dump[i]);
        }

        // Unpack payload if unpack7to8 is available
        if (typeof window.unpack7to8 === 'function') {
            try {
                const unpacked = window.unpack7to8(new Uint8Array(payload));
                payload = Array.from(unpacked);
            } catch (e) {
                console.warn('[Bridge] Error unpacking global dump:', e);
            }
        }

        this._hardwareInfo.globalDumpBytes = payload;

        if (payload.length >= 3) {
            const ch = payload[0] & 0x0F;
            if (ch >= 0 && ch <= 15) {
                this._hardwareInfo.midiChannel = ch + 1;
            }
            const devId = (payload[0] >> 4) & 0x0F;
            if (devId >= 0 && devId <= 15) {
                this._hardwareInfo.deviceId = String(devId);
            }

            const tuneVal = payload[1];
            const transpRaw = Math.min(payload[2], 96);
            const velCurveRaw = payload.length > 3 ? Math.min(payload[3], 4) : 0;
            const pedalRaw = payload.length > 4 ? payload[4] : 0;
            const contrastRaw = payload.length > 5 ? Math.min(payload[5], 14) : 10;

            const globals = this._globalParams || {};

            // Preserve localStorage values over hardware Global Dump
            // User settings from Settings modal should take priority
            const lsTune = typeof localStorage !== 'undefined' ? localStorage.getItem('abd-eep-master-tune') : null;
            const lsTranspose = typeof localStorage !== 'undefined' ? localStorage.getItem('abd-eep-transpose') : null;

            globals['global_tune'] = lsTune !== null ? globals['global_tune'] : tuneVal / 255.0;
            globals['transpose'] = lsTranspose !== null ? globals['transpose'] : transpRaw / 96.0;
            globals['velocity_curve'] = velCurveRaw / 4.0;
            globals['pedal_polarity'] = pedalRaw > 0 ? 1.0 : 0.0;
            globals['lcd_contrast'] = contrastRaw / 14.0;
            this._globalParams = globals;

            if (this.parameterCache) {
                this.parameterCache['global_tune'] = lsTune !== null ? this.parameterCache['global_tune'] : tuneVal / 255.0;
                this.parameterCache['transpose'] = lsTranspose !== null ? this.parameterCache['transpose'] : transpRaw / 96.0;
                this.parameterCache['velocity_curve'] = velCurveRaw / 4.0;
                this.parameterCache['pedal_polarity'] = pedalRaw > 0 ? 1.0 : 0.0;
                this.parameterCache['lcd_contrast'] = contrastRaw / 14.0;
            }
        }
    }

    sendGlobalDump(payloadBytes) {
        if (!this.midiOutput || !payloadBytes || payloadBytes.length < 3) {return;}

        const devId = parseInt(this._hardwareInfo.deviceId) || 0;
        const msg = new Uint8Array(8 + payloadBytes.length + 1);
        msg[0] = 0xF0;
        msg[1] = 0x00;
        msg[2] = 0x20;
        msg[3] = 0x32;
        msg[4] = 0x20;
        msg[5] = devId & 0x0F;
        msg[6] = 0x06;
        msg[7] = 0x06;

        for (let i = 0; i < payloadBytes.length; i++) {
            msg[8 + i] = payloadBytes[i];
        }
        msg[msg.length - 1] = 0xF7;

        this._signalMidiActivity();
        this.midiOutput.send(msg);
        console.log(`[Bridge] Global Dump escrito vía SysEx (${payloadBytes.length} bytes, devId=${devId})`);
    }

    getGlobalParameter(paramId) {
        if (this._globalParams && paramId in this._globalParams) {
            return this._globalParams[paramId];
        }
        return this.parameterCache[paramId];
    }

    setGlobalParameter(paramId, normalizedValue) {
        if (this._globalParams) {
            this._globalParams[paramId] = normalizedValue;
        }
        this.parameterCache[paramId] = normalizedValue;
        this.handleParameterChangeFromBackend(paramId, normalizedValue);

        let raw8Bit = -1;
        let byteOffset = -1;
        if (paramId === 'device_id') {
            const devId = Math.round(normalizedValue * 15);
            if (this._hardwareInfo && this._hardwareInfo.globalDumpBytes) {
                const cached = this._hardwareInfo.globalDumpBytes;
                const ch = (cached[0] & 0x0F);
                const bytes = new Uint8Array(cached);
                bytes[0] = ((devId & 0x0F) << 4) | ch;
                this.sendGlobalDump(Array.from(bytes));
            }
            return;
        } else if (paramId === 'global_tune') {
            raw8Bit = Math.round(normalizedValue * 255);
            byteOffset = 1;
        } else if (paramId === 'transpose') {
            raw8Bit = Math.round(normalizedValue * 96);
            byteOffset = 2;
        } else if (paramId === 'velocity_curve') {
            raw8Bit = Math.round(normalizedValue * 4);
            byteOffset = 3;
        } else if (paramId === 'pedal_polarity') {
            raw8Bit = normalizedValue > 0.5 ? 1 : 0;
            byteOffset = 4;
        } else if (paramId === 'lcd_contrast') {
            raw8Bit = Math.round(normalizedValue * 14);
            byteOffset = 5;
        }

        if (byteOffset >= 0 && this._hardwareInfo && this._hardwareInfo.globalDumpBytes) {
            const cached = this._hardwareInfo.globalDumpBytes;
            if (cached && cached.length > byteOffset) {
                const bytes = new Uint8Array(cached);
                bytes[byteOffset] = Math.min(255, Math.max(0, raw8Bit));
                this.sendGlobalDump(Array.from(bytes));
                return;
            }
        }

        if (this.isJuce) {
            if (window.juce && typeof window.juce.setParameter === 'function') {
                window.juce.setParameter(paramId, normalizedValue);
            }
        } else {
            this.sendWebMidiParameter(paramId, normalizedValue);
        }
    }

    pianoNoteOn(note, velocity) {
        if (this.isJuce) {
            if (window.juce && typeof window.juce.pianoNoteOn === 'function') {
                window.juce.pianoNoteOn(note, velocity || 100);
            }
        } else {
            velocity = velocity === undefined ? 100 : Math.round(Math.max(1, Math.min(127, velocity * 127)));
            console.log(`[Bridge Web-MIDI] Note On: ${note} (vel=${velocity})`);
            if (this.midiOutput) {
                const channel = (this.midiChannel ? this.midiChannel - 1 : 0) & 0x0F;
                this.midiOutput.send([0x90 | channel, note, velocity]);
                this._signalMidiActivity();
            }
        }
        
        // Mostrar nota en el LCD del Programmer (modo navegador: no hay C++ timer que llame a _handleEngineActiveNotes)
        this._showNoteOnLcd(note, velocity);
    }

    pianoNoteOff(note) {
        if (this.isJuce) {
            if (window.juce && typeof window.juce.pianoNoteOff === 'function') {
                window.juce.pianoNoteOff(note);
            }
        } else {
            console.log(`[Bridge Web-MIDI] Note Off: ${note}`);
            if (this.midiOutput) {
                const channel = (this.midiChannel ? this.midiChannel - 1 : 0) & 0x0F;
                this.midiOutput.send([0x80 | channel, note, 0]);
                this._signalMidiActivity();
            }
        }
    }

    panic() {
        if (this.isJuce) {
            if (window.juce && typeof window.juce.panic === 'function') {
                window.juce.panic();
            }
        }
    }

    async getVoiceState() {
        if (this.isJuce && window.juce && typeof window.juce.getVoiceState === 'function') {
            return await window.juce.getVoiceState();
        }
        return null;
    }

    async getAudioWaveform() {
        if (this.isJuce && window.juce && typeof window.juce.getAudioWaveform === 'function') {
            return await window.juce.getAudioWaveform();
        }
        return null;
    }

    async getDiagnosticSnapshot() {
        if (this.isJuce && window.juce && typeof window.juce.getDiagnosticSnapshot === 'function') {
            return await window.juce.getDiagnosticSnapshot();
        }
        return null;
    }

    getCalibration(callback) {
        if (this.isJuce && window.juce && typeof window.juce.getCalibration === 'function') {
            window.juce.getCalibration().then(function(json) { callback(json); }).catch(function() { callback(null); });
        } else {
            callback(null);
        }
    }

    setCalibration(jsonString, callback) {
        if (this.isJuce && window.juce && typeof window.juce.setCalibration === 'function') {
            window.juce.setCalibration(jsonString).then(function(ok) { callback(ok); }).catch(function() { callback(false); });
        } else {
            callback(false);
        }
    }

    async startAudioABRun(configJson, snapshotJson) {
        if (this.isJuce && window.juce && typeof window.juce.startAudioABRun === 'function') {
            return await window.juce.startAudioABRun(configJson, snapshotJson);
        }
        return { ok: false, error: 'Bridge not running under JUCE/WebView2' };
    }

    async renderAudioABSoftwareReference() {
        if (this.isJuce && window.juce && typeof window.juce.renderAudioABSoftwareReference === 'function') {
            return await window.juce.renderAudioABSoftwareReference();
        }
        return { ok: false, error: 'Bridge not running under JUCE/WebView2' };
    }

    async finishAudioABRun() {
        if (this.isJuce && window.juce && typeof window.juce.finishAudioABRun === 'function') {
            return await window.juce.finishAudioABRun();
        }
        return { ok: false, error: 'Bridge not running under JUCE/WebView2' };
    }

    async abortAudioABRun() {
        if (this.isJuce && window.juce && typeof window.juce.abortAudioABRun === 'function') {
            return await window.juce.abortAudioABRun();
        }
        return { ok: false, error: 'Bridge not running under JUCE/WebView2' };
    }

    async compareAudioABRun(refWavPath, capWavPath, configJson, contextJson) {
        if (this.isJuce && window.juce && typeof window.juce.compareAudioABRun === 'function') {
            return await window.juce.compareAudioABRun(refWavPath, capWavPath, configJson, contextJson);
        }
        return { status: 'error', reason_code: 'WAV_MISSING', errors: ['Bridge not running under JUCE/WebView2'] };
    }

    async runRoundTripValidator(unpackedBytesJson) {
        if (this.isJuce && window.juce && typeof window.juce.runRoundTripValidator === 'function') {
            return await window.juce.runRoundTripValidator(unpackedBytesJson);
        }
        return null;
    }

    getHardwareInfo() {
        return this._hardwareInfo;
    }

    async isConnected() {
        if (this.isJuce) {
            this._connected = true;
            this._updateConnectionUI();
            return true;
        }
        if (!this.midiOutput || !this.midiInput) {
            this._connected = false;
            this._updateConnectionUI();
            return false;
        }

        const inquiry = [0xF0, 0x7E, 0x7F, 0x06, 0x01, 0xF7];
        const isIdentityReply = (msg) => {
            return msg.length >= 10 &&
                   msg[0] === 0xF0 &&
                   msg[1] === 0x7E &&
                   msg[3] === 0x06 &&
                   msg[4] === 0x02 &&
                   msg[5] === 0x00 &&
                   msg[6] === 0x20 &&
                   msg[7] === 0x32;
        };

        try {
            const response = await this.requestSysEx(inquiry, 2000, isIdentityReply);
            const isDeepMind = response[8] === 0x20 && response[9] === 0x00;

            if (response.length >= 16) {
                const deviceId = response[2] & 0x0F;
                this._hardwareInfo.deviceId = String(deviceId);
                this._hardwareInfo.midiChannel = deviceId + 1;
                this._hardwareInfo.connectionType = this._detectConnectionType(this.midiOutput.name);

                // Parse firmware versions from Identity Reply
                const mainMajor = response[12] >> 4;
                const mainMinor = response[12] & 0x0F;
                this._hardwareInfo.hostVersion = mainMajor + '.' + mainMinor;
                this._hardwareInfo.voiceVersion = response[14] + '.' + response[15];

                if (typeof window._updateSettingsHardwareInfo === 'function') {
                    window._hardwareInfo = this._hardwareInfo;
                    window._updateSettingsHardwareInfo();
                }
            }

            this._connected = isDeepMind;
            this._updateConnectionUI();
            return isDeepMind;
        } catch (err) {
            this._connected = false;
            this._updateConnectionUI();
            return false;
        }
    }

    _updateConnectionUI() {
        const indicator = document.getElementById('midi-connection-indicator');
        const statusBtn = document.getElementById('settings-connection-status');
        const reconnectBtn = document.getElementById('reconnect-hw-btn');
        const connected = this._connected && (this.isJuce || (this.midiOutput && this.midiInput));
        const hasHardware = this._hardwareInfo && this._hardwareInfo.globalDumpBytes;

        let color = 'var(--color-danger)';
        let shadow = '0 0 4px var(--color-danger)';
        let statusText = 'Disconnected';
        let tooltipText = 'MIDI: Disconnected';
        let statusColor = 'var(--text-primary)';
        let statusBorder = '1px solid var(--color-danger)';

        if (connected) {
            if (this.isJuce && !hasHardware) {
                color = '#00d2ff'; // Cyan/Azul brillante para motor local sin hardware
                shadow = '0 0 6px #00d2ff';
                statusText = 'Local DSP Active';
                tooltipText = 'Engine: Connected (Emulator Mode)';
                statusColor = '#00d2ff';
                statusBorder = '1px solid #00d2ff';
            } else {
                color = 'var(--accent-green)';
                shadow = '0 0 6px var(--accent-green)';
                statusText = 'Connected';
                tooltipText = 'MIDI: Connected to Hardware';
                statusColor = 'var(--accent-green)';
                statusBorder = '1px solid var(--accent-green)';
            }
        }

        if (indicator) {
            indicator.style.backgroundColor = color;
            indicator.style.boxShadow = shadow;
            indicator.setAttribute('data-ctrl-tooltip', tooltipText);
        }
        if (statusBtn) {
            statusBtn.textContent = statusText;
            statusBtn.style.color = statusColor;
            statusBtn.style.border = statusBorder;
        }
        if (reconnectBtn) {
            reconnectBtn.style.display = connected ? 'none' : 'inline-block';
            if (!reconnectBtn._wired) {
                reconnectBtn._wired = true;
                reconnectBtn.addEventListener('click', async () => {
                    reconnectBtn.textContent = 'CONNECTING...';
                    reconnectBtn.disabled = true;
                    try {
                        const ok = await this.resetMidiConnection();
                        if (!ok) {
                            throw new Error('Reconnection failed');
                        }
                    } catch (e) {
                        console.warn('[Bridge] Reconnection failed, opening settings:', e.message);
                        const modal = document.getElementById('settings-modal-backdrop');
                        if (modal) {
                            modal.style.display = 'flex';
                            if (typeof window.populateMidiPortsLists === 'function') {
                                window.populateMidiPortsLists();
                            }
                            if (typeof window._updateSettingsHardwareInfo === 'function') {
                                window._updateSettingsHardwareInfo();
                            }
                            const connTabBtn = document.querySelector('.btn[data-tab="connections"]');
                            if (connTabBtn) {
                                connTabBtn.click();
                            }
                        }
                    } finally {
                        reconnectBtn.textContent = 'RE-CONNECT HARDWARE';
                        reconnectBtn.disabled = false;
                        this._updateConnectionUI();
                    }
                });
            }
        }
    }

    _signalMidiActivity() {
        const led = document.getElementById('midi-activity-led');
        if (!led) {return;}
        if (led._midiTimer) {
            clearTimeout(led._midiTimer);
        }
        led.style.opacity = '1';
        led.style.boxShadow = '0 0 6px var(--accent-green)';
        led._midiTimer = setTimeout(() => {
            led.style.opacity = '0.15';
            led.style.boxShadow = 'none';
            led._midiTimer = null;
        }, 80);
    }

    // --- MAPAS DE PARÁMETROS ---
    get paramToByteOffset() {
        return window.BRIDGE_PARAM_MAPS ? window.BRIDGE_PARAM_MAPS.PARAM_TO_BYTE_OFFSET : {};
    }

    get byteOffsetToParamIds() {
        return window.BRIDGE_PARAM_MAPS ? window.BRIDGE_PARAM_MAPS.BYTE_OFFSET_TO_PARAM_IDS : {};
    }

    get paramToCC() {
        return window.BRIDGE_PARAM_MAPS ? window.BRIDGE_PARAM_MAPS.PARAM_TO_CC : {};
    }

    get ccToParam() {
        return window.BRIDGE_PARAM_MAPS ? window.BRIDGE_PARAM_MAPS.CC_TO_PARAM : {};
    }

    _rawToNormalized(byteOffset, rawValue) {
        return window.BRIDGE_PARAM_MAPS ? window.BRIDGE_PARAM_MAPS.rawToNormalized(byteOffset, rawValue) : rawValue / 255.0;
    }

    _normalizedToRaw(byteOffset, normalizedValue) {
        return window.BRIDGE_PARAM_MAPS ? window.BRIDGE_PARAM_MAPS.normalizedToRaw(byteOffset, normalizedValue) : Math.round(normalizedValue * 255);
    }

    // --- ENVIAR NRPN ---
    sendNRPN(byteOffset, rawValue, channel = this.midiChannel) {
        if (!this.midiOutput) {return;}

        // Nivel 1: Evitar envío si es el mismo byte con el mismo valor
        if (this._lastNrpnByte === byteOffset && this._lastNrpnValue === rawValue) {
            return;
        }

        const msb = byteOffset < 128 ? 0 : 1;
        const lsb = byteOffset < 128 ? byteOffset : (byteOffset - 128);
        const dataMsb = (rawValue >> 7) & 0x7F;
        const dataLsb = rawValue & 0x7F;
        const ch = (channel - 1) & 0x0F;

        const bytes = [];
        bytes.push(0xB0 | ch, 99, msb & 0x7F);
        bytes.push(0xB0 | ch, 98, lsb & 0x7F);
        bytes.push(0xB0 | ch, 6, dataMsb);
        bytes.push(0xB0 | ch, 38, dataLsb);

        this._lastNrpnByte = byteOffset;
        this._lastNrpnValue = rawValue;

        this._nrpnTxBytes += bytes.length;
        this._nrpnPktCount++;
        this._notifyNrpnTraffic();

        this._signalMidiActivity();
        this.midiOutput.send(bytes);
    }

    _onNrpnTraffic(cb) {
        this._nrpnTrafficCallbacks.push(cb);
    }

    _notifyNrpnTraffic() {
        this._nrpnTrafficCallbacks.forEach(cb => cb({
            tx: this._nrpnTxBytes,
            rx: this._nrpnRxBytes,
            pkts: this._nrpnPktCount
        }));
    }

    _resetNrpnCounters() {
        this._nrpnTxBytes = 0;
        this._nrpnRxBytes = 0;
        this._nrpnPktCount = 0;
        this._notifyNrpnTraffic();
    }

    _resetNrpnCache() {
        this._lastNrpnMsb = null;
        this._lastNrpnLsb = null;
        this._lastNrpnValue = null;
        this._lastNrpnByte = null;
        this._nrpnInMsb = null;
        this._nrpnInLsb = null;
        this._nrpnInDataMsb = 0;
        this._nrpnInTimestamp = 0;
        console.log('[Bridge] NRPN cache reset');
    }

    async resetMidiConnection() {
        if (this.isJuce) {return true;}
        if (!this.midiAccess) {
            console.warn('[Bridge] No MIDI Access disponible. Inicializando...');
            try {
                this.midiAccess = await navigator.requestMIDIAccess({ sysex: true });
                this.midiAccess.onstatechange = () => this.scanMidiDevices();
            } catch (err) {
                console.error('[Bridge] Error al reinicializar MIDI Access:', err);
                return false;
            }
        }

        this._resetNrpnCache();
        this._resetNrpnCounters();

        const savedCh = localStorage.getItem('abd-eep-midi-channel');
        if (savedCh) {
            const parsed = parseInt(savedCh);
            if (parsed >= 1 && parsed <= 16) {
                this.midiChannel = parsed;
                this._hardwareInfo.midiChannel = parsed;
                console.log('[Bridge] MIDI Channel restaurado desde localStorage: ch ' + parsed);
            }
        }

        this.scanMidiDevices();
        const connected = await this.isConnected();
        this._connected = connected;
        this._updateConnectionUI();
        if (connected) {
            console.log('[Bridge] ✅ Reconexión MIDI exitosa — DeepMind 12 detectado');
            if (this.midiOutput) {
                this._hardwareInfo.connectionType = this._detectConnectionType(this.midiOutput.name);
            }
            try {
                const globalDump = await this.requestMidiDump('global', 3000, 1);
                if (globalDump && globalDump.length >= 30) {
                    this._parseGlobalDump(globalDump);
                }
            } catch (e) {
                console.warn('[Bridge] No se pudo obtener Global Dump para versiones:', e.message);
            }
        } else {
            console.warn('[Bridge] ⚠️ Reconexión MIDI: DeepMind 12 no responde');
        }
        return connected;
    }

    /**
     * Muestra la nota presionada en el LCD del Programmer.
     * Necesario porque _handleEngineActiveNotes solo se llama desde el timer C++ en modo JUCE.
     * Usa "._bridgeLcdNote" / "._bridgeLcdRestore" / "._bridgeLcdTimer" en el elemento
     * para evitar conflictos con otros mecanismos LCD (keyboard.js, keyboard_active_notes.js).
     */
    _showNoteOnLcd(midiNote, velocity) {
        const lcdText = document.getElementById('lcd-text');
        if (!lcdText) {return;}
        
        const velNorm = (velocity === undefined) ? 1.0 : (velocity > 1.0 ? velocity / 127.0 : velocity);
        const velInt = Math.round(velNorm * 100);
        const html = '<span style="font-size:10px; opacity:0.6;">KEY PLAY</span><br>'
            + '<strong style="font-size:18px; color:var(--brand-accent); letter-spacing:1px;">'
            + this._midiNoteToName(midiNote) + ' <span style="font-size:11px; color:var(--text-dim);">(MIDI #' + midiNote + ')</span></strong><br>'
            + '<span style="font-size:10px; color:var(--text-dim);">Vel ' + velInt + '%</span>';
        
        // Usar LcdQueue para que el bucle _updateCtrlOverlay (60fps) respete este mensaje
        // en lugar de sobrescribirlo con el nombre del patch.
        if (typeof window.LcdQueue !== 'undefined' && window.LcdQueue && typeof window.LcdQueue.push === 'function') {
            window.LcdQueue.push('key_play', html, 1, { duration: 8000 });
        } else {
            // Fallback si LcdQueue no existe
            lcdText.innerHTML = html;
        }
        
        console.log('[LCD] _showNoteOnLcd: ' + this._midiNoteToName(midiNote) + ' (#' + midiNote + ') vel=' + velInt + '%');
    }
    
    /**
     * Convierte un número de nota MIDI (0-127) a nombre legible (Ej: C#4).
     */
    _midiNoteToName(midiNote) {
        const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
        if (midiNote === undefined || midiNote === null) {return '\u2014';}
        if (midiNote < 0 || midiNote > 127) {return '\u2014';}
        return NOTE_NAMES[midiNote % 12] + (Math.floor(midiNote / 12) - 1);
    }

    /**
     * Inicia el monitoreo periódico de la conexión MIDI para reconexión automática.
     * En modo JUCE la conexión es siempre activa vía el bridge nativo, no se necesita.
     * En modo Web MIDI, verifica cada 5s si la conexión se perdió y reconecta.
     */
    startAutoReconnect() {
        // En modo JUCE el bridge nativo siempre está conectado
        if (this.isJuce) {return;}
        
        // Evitar timers duplicados
        if (this._autoReconnectTimer) {return;}
        
        this._autoReconnectAttempts = 0;
        this._autoReconnectTimer = setInterval(async () => {
            // Solo intentar reconexión si tenemos MIDI Access pero perdimos conexión
            if (this.midiAccess && !this._connected) {
                // Backoff progresivo: 5s, 10s, 20s, 40s, max 120s
                // Solo incrementa el contador cuando realmente se va a intentar
                const attempted = this._lastReconnectAttempt || 0;
                const elapsed = Date.now() - attempted;
                const nextDelay = Math.min(5000 * Math.pow(2, this._autoReconnectAttempts || 0), 120000);
                if (elapsed < nextDelay) {return;}
                
                this._autoReconnectAttempts = (this._autoReconnectAttempts || 0) + 1;
                
                this._lastReconnectAttempt = Date.now();
                console.log('[Bridge] Auto-reconnect: intento #' + this._autoReconnectAttempts + ' (backoff ' + Math.round(nextDelay / 1000) + 's)...');
                try {
                    await this.resetMidiConnection();
                    if (this._connected) {
                        this._autoReconnectAttempts = 0; // Resetear backoff al reconectar
                    }
                } catch (e) {
                    console.warn('[Bridge] Auto-reconnect falló:', e.message);
                }
            }
        }, 5000);
        
        // Limpiar timer al descargar la página
        window.addEventListener('beforeunload', () => {
            if (this._autoReconnectTimer) {
                clearInterval(this._autoReconnectTimer);
                this._autoReconnectTimer = null;
            }
        });
    }

    async requestBankDump(bankNumber, options = {}) {
        if (this.isJuce) {
            return window.juce && typeof window.juce.requestBankDump === 'function'
                ? window.juce.requestBankDump(bankNumber)
                : 0;
        }

        if (!this.midiOutput) {
            console.warn('[BankDump] No MIDI output available');
            return 0;
        }

        const { patchSpacingMs = 35, timeoutMs = 45000, onProgress = null } = options;

        if (this._bankDumpInProgress) {
            throw new Error('[BankDump] A bank dump is already in progress');
        }

        const bankIndex = typeof bankNumber === 'string'
            ? bankNumber.toUpperCase().charCodeAt(0) - 65
            : bankNumber;
        if (bankIndex < 0 || bankIndex > 7) {
            throw new Error('[BankDump] Invalid bank number: ' + bankNumber);
        }

        this._bankDumpInProgress = true;
        this._bankDumpCancel = false;
        let collectedCount = 0;
        const bankLetter = String.fromCharCode(65 + bankIndex);

        console.log('[BankDump] Solicitando banco ' + bankLetter + ' (' + bankIndex + ') — 128 programas');

        try {
            const result = await new Promise((resolve) => {
                this._bankDumpResolve = resolve;

                const bankDumpTimeout = setTimeout(() => {
                    this._bankDumpInProgress = false;
                    this._bankDumpCallback = null;
                    this._bankDumpTimeout = null;
                    console.warn('[BankDump] Timeout: recogidos ' + collectedCount + '/128 patches');
                    resolve(collectedCount);
                }, timeoutMs);
                this._bankDumpTimeout = bankDumpTimeout;

                this._bankDumpCallback = (patchData) => {
                    if (this._bankDumpCancel) {return;}
                    collectedCount++;
                    if (onProgress) {onProgress(collectedCount, 128);}
                    if (collectedCount >= 128) {
                        clearTimeout(bankDumpTimeout);
                        this._bankDumpTimeout = null;
                        this._bankDumpInProgress = false;
                        this._bankDumpCallback = null;
                        this._bankDumpResolve = null;
                        console.log('[BankDump] Banco ' + bankLetter + ' completo: 128/128 patches recibidos');
                        resolve(128);
                    }
                };

                for (let i = 0; i < 128; i++) {
                    setTimeout(() => {
                        if (this._bankDumpCancel || !this._bankDumpInProgress) {return;}
                        const req = new Uint8Array([
                            0xF0, 0x00, 0x20, 0x32, 0x20,
                            0x7F, // broadcast device ID
                            0x01, // Program Dump Request
                            bankIndex,
                            i,
                            0xF7
                        ]);
                        this._signalMidiActivity();
                        this.midiOutput.send(req);
                    }, i * patchSpacingMs);
                }
            });

            return result;
        } catch (err) {
            this._bankDumpInProgress = false;
            this._bankDumpCallback = null;
            console.error('[BankDump] Error:', err.message);
            throw err;
        }
    }

    cancelBankDump() {
        if (!this._bankDumpInProgress) {return;}
        this._bankDumpCancel = true;
        this._bankDumpInProgress = false;
        this._bankDumpCallback = null;
        if (this._bankDumpTimeout) {
            clearTimeout(this._bankDumpTimeout);
            this._bankDumpTimeout = null;
        }
        if (this._bankDumpResolve) {
            this._bankDumpResolve(0);
            this._bankDumpResolve = null;
        }
        console.log('[BankDump] Cancelado por el usuario');
    }

    _scheduleAutoDump() {
        if (this._autoDumpTimer) {clearTimeout(this._autoDumpTimer);}
        this._autoDumpTimer = setTimeout(() => {
            if (!this.midiOutput || !this.midiInput) {return;}
            console.log('[Bridge] Auto-dump triggered by Bank/Program change → requesting edit buffer dump');
            this.requestMidiDump('edit', 4000, 1).then((response) => {
                if (!response) {
                    console.warn('[Bridge] Auto-dump failed — no response from hardware');
                }
            }).catch((err) => {
                console.warn('[Bridge] Auto-dump error:', err.message || err);
            });
        }, 200);
    }

    sendWebMidiParameter(paramId, normalizedValue) {
        if (!this.midiOutput) {return;}

        // Para acordes o polychord, reenviar dump SysEx al hardware
        if (paramId === 'chord_enable' || paramId === 'poly_chord_enable' || paramId === 'chord_key' || paramId === 'chord_type') {
            setTimeout(() => {
                if (paramId === 'chord_enable' || paramId === 'chord_key' || paramId === 'chord_type') {
                    const chordNotes = this.parameterCache['chord_notes'] || new Array(28).fill(0xFF);
                    const keyVal = Math.round((this.parameterCache['chord_key'] || 0.0) * 11.0);
                    const typeVal = Math.round((this.parameterCache['chord_type'] || 0.0) * 11.0);

                    const unpacked = new Uint8Array(26);
                    unpacked[0] = keyVal;
                    unpacked[1] = typeVal;
                    let noteIdx = 2;
                    chordNotes.forEach(note => {
                        if (note !== 0xFF && noteIdx < 26) {
                            unpacked[noteIdx++] = note;
                        }
                    });
                    while (noteIdx < 26) { unpacked[noteIdx++] = 0xFF; }

                    if (typeof window.pack8to7 === 'function') {
                        const packed = window.pack8to7(unpacked);
                        const header = [0xF0, 0x00, 0x20, 0x32, 0x20, 0x01, 0x1C, 0x06];
                        const footer = [0xF7];
                        const msg = new Uint8Array(header.length + 32 + footer.length);
                        msg.set(header, 0);
                        msg.set(packed.slice(0, 32), header.length);
                        msg.set(footer, header.length + 32);
                        this.midiOutput.send(msg);
                    }
                } else if (paramId === 'poly_chord_enable') {
                    const polyNotes = this.parameterCache['poly_chord_notes'] || new Array(512).fill(0xFF);
                    const unpacked = new Uint8Array(512);
                    for (let i = 0; i < 512; i++) {
                        unpacked[i] = polyNotes[i] !== undefined ? polyNotes[i] : 0xFF;
                    }
                    const packed = new Uint8Array(592);
                    let readIdx = 0;
                    let writeIdx = 0;
                    while (readIdx < 512 && writeIdx < 592) {
                        let msbFlags = 0;
                        const startWriteIdx = writeIdx;
                        writeIdx++;
                        for (let k = 1; k < 8; k++) {
                            let val = 0xFF;
                            if (readIdx < 512) {
                                val = unpacked[readIdx++];
                            }
                            if (val & 0x80) {
                                msbFlags |= (1 << (k - 1));
                                val &= 0x7F;
                            }
                            packed[startWriteIdx + k] = val;
                            writeIdx++;
                        }
                        packed[startWriteIdx] = msbFlags;
                    }

                    const header = [0xF0, 0x00, 0x20, 0x32, 0x20, 0x01, 0x1E, 0x06];
                    const footer = [0xF7];
                    const msg = new Uint8Array(header.length + 592 + footer.length);
                    msg.set(header, 0);
                    msg.set(packed, header.length);
                    msg.set(footer, header.length + 592);
                    this.midiOutput.send(msg);
                }
            }, 50);
            return;
        }

        // Mapeo básico de CC para OSC y VCF o envío por NRPN
        const byteOffset = this.paramToByteOffset[paramId];
        if (byteOffset !== undefined) {
            const rawValue = this._normalizedToRaw(byteOffset, normalizedValue);
            this.sendNRPN(byteOffset, rawValue);
            return;
        }

        const cc = this.paramToCC[paramId];
        if (cc !== undefined) {
            const midiVal = Math.round(normalizedValue * 127);
            const statusByte = 0xB0 | (this.midiChannel - 1);
            this.midiOutput.send([statusByte, cc, midiVal]);
        }
    }

    _applyMidiLearnMapping(key, val, nrpnInfo) {
        if (typeof window.dualMidiBridge._applyMidiLearnMappingInternal === 'function') {
            return window.dualMidiBridge._applyMidiLearnMappingInternal(key, val, nrpnInfo);
        }
        const paramId = this.midiLearnMappings ? this.midiLearnMappings[key] : null;
        if (!paramId) {return false;}

        const byteOffset = this.paramToByteOffset[paramId];
        let normalized;
        if (byteOffset !== undefined) {
            const rawVal = nrpnInfo ? (val & 0xFF) : Math.round(val * 255.0 / 127.0);
            normalized = this._rawToNormalized(byteOffset, rawVal);
        } else {
            normalized = val / 127.0;
        }

        this.setParameter(paramId, normalized);
        return true;
    }

    _captureMidiLearnMessage(ccNum, val, nrpnInfo) {
        if (typeof window.dualMidiBridge._captureMidiLearnMessageInternal === 'function') {
            window.dualMidiBridge._captureMidiLearnMessageInternal(ccNum, val, nrpnInfo);
        }
    }

    // --- RECIBIR MIDI EN MODO WEB ---
    handleIncomingMidi(midiMessage) {
        this._signalMidiActivity();
        const data = midiMessage.data;
        if (!data || data.length === 0) {return;}

        // 1) Despachar a solicitudes SysEx pendientes
        if (data[0] === 0xF0 && data[data.length - 1] === 0xF7) {
            const msg = new Uint8Array(data);
            const pending = [...this._pendingSysExRequests];
            for (const req of pending) {
                try {
                    if (req.predicate(msg)) {
                        req.resolve(msg);
                        return;
                    }
                } catch (e) {
                    console.warn('[SysEx] Error en predicate:', e);
                }
            }
        }

        const status = data[0] & 0xF0;
        // 2) Comprobar si es un mensaje SysEx de volcado de programa o edit buffer
        if (data[0] === 0xF0 && data[1] === 0x00 && data[2] === 0x20 && data[3] === 0x32) {
            const cmd = data[6];
            if (cmd === 0x02 || cmd === 0x04) {
                const headerLen = (cmd === 0x02) ? 10 : 8;
                const payloadLen = 278;
                const expectedMinLen = headerLen + payloadLen + 1; // Cabecera + Payload + F7
                
                if (data.length < expectedMinLen) {
                    console.warn(`[WebMIDI SysEx] Ignorando dump cmd 0x0${cmd} por longitud insuficiente: ${data.length} bytes (mínimo esperado ${expectedMinLen})`);
                    return;
                }

                const packedPayload = data.slice(headerLen, headerLen + payloadLen);
                if (typeof window.unpack7to8 === 'function') {
                    const unpackedBytes = window.unpack7to8(packedPayload);
                    
                    let bankIndex = 0;
                    let progIndex = 0;
                    let bankLetter = 'A';
                    
                    if (cmd === 0x02) {
                        bankIndex = data[7] & 0x07;  // Leer banco desde el byte 7 del encabezado
                        progIndex = data[8] & 0x7F;  // Leer programa desde el byte 8 del encabezado
                        bankLetter = String.fromCharCode(65 + bankIndex);
                    }

                    const patchName = (typeof window.extractNameFromRawSysex === 'function'
                        ? window.extractNameFromRawSysex(data, cmd === 0x02 ? 0 : -2)
                        : undefined) || `Hw Patch ${progIndex + 1}`;

                    if (this._bankDumpInProgress) {
                        if (this._bankDumpCallback) {
                            try {
                                this._bankDumpCallback({
                                    bankIndex: bankIndex,
                                    bankLetter: bankLetter,
                                    progIndex: progIndex,
                                    patchName: patchName,
                                    unpackedBytes: unpackedBytes
                                });
                            } catch (e) {
                                console.warn('[SysEx] Error en bankDumpCallback:', e);
                            }
                        }

                        if (window.hardwareBanks && window.hardwareBanks[bankLetter]) {
                            window.hardwareBanks[bankLetter][progIndex] = {
                                index: progIndex,
                                name: patchName,
                                unpackedBytes: unpackedBytes
                            };
                            console.log(`[WebMIDI SysEx] Guardado preset de entrada en Hardware ${bankLetter}-${progIndex+1}: ${patchName}`);
                            if (typeof window.renderHardwarePatches === 'function' && window.currentHwBankLetter === bankLetter) {
                                window.renderHardwarePatches();
                            }
                        }
                    } else {
                        // Carga espontánea en el editor principal
                        if (typeof window.triggerMidiDump === 'function') {
                            window.triggerMidiDump({
                                name: patchName,
                                unpackedBytes: unpackedBytes
                            });
                            console.log(`[Bridge] Spontaneous program dump (cmd=0x${data[6].toString(16)}) loaded into UI: ${patchName}`);
                        }
                    }
                }
            }
            return;
        }

        // 2b) Comprobar si es un mensaje SysEx de volcado de Chord (0x1C) o Poly Chord (0x1E)
        if (data[0] === 0xF0 && data[1] === 0x00 && data[2] === 0x20 && data[3] === 0x32) {
            const command = data[6];
            if (command === 0x1C) {
                console.log(`[WebMIDI SysEx] Recibido Chord Memory Dump del hardware (${data.length} bytes)`);
                if (typeof window.unpack7to8 === 'function' && data.length >= 40) {
                    const packed = data.slice(8, 40);
                    const unpacked = window.unpack7to8(packed);
                    this.parameterCache['chord_notes'] = Array.from(unpacked);
                    this.handleParameterChangeFromBackend('chord_notes', Array.from(unpacked));
                }
            } else if (command === 0x1E) {
                console.log(`[WebMIDI SysEx] Recibido Poly Chord Memory Dump del hardware (${data.length} bytes)`);
                if (typeof window.unpack7to8 === 'function' && data.length >= 600) {
                    const packed = data.slice(8, 600);
                    const unpacked = window.unpack7to8(packed);
                    this.parameterCache['poly_chord_notes'] = Array.from(unpacked);
                    this.handleParameterChangeFromBackend('poly_chord_notes', Array.from(unpacked));
                }
            }
            return;
        }

        if (status === 0xB0) {
            const cc = data[1];
            const val = data[2];

            // --- NRPN INCOMING ---
            if (cc === 99) {
                this._nrpnInMsb = val;
                this._nrpnInDataMsb = 0;
                this._nrpnInTimestamp = Date.now();
                this._lastNrpnMsb = null;
                this._lastNrpnLsb = null;
                this._lastNrpnByte = null;
                return;
            }
            if (cc === 98) {
                this._nrpnInLsb = val;
                this._nrpnInDataMsb = 0;
                this._nrpnInTimestamp = Date.now();
                this._lastNrpnMsb = null;
                this._lastNrpnLsb = null;
                this._lastNrpnByte = null;
                return;
            }
            if (cc === 6) {
                this._nrpnInDataMsb = val;
                return;
            }
            if (cc === 38) {
                const addressValid = (this._nrpnInMsb !== null && this._nrpnInLsb !== null);
                if (addressValid) {
                    const nrpnMsb = this._nrpnInMsb;
                    const nrpnLsb = this._nrpnInLsb;
                    const byteOffset = (nrpnMsb << 7) + nrpnLsb;
                    const raw14 = (this._nrpnInDataMsb << 7) | val;
                    const rawValue = raw14 & 0xFF;

                    if (this.midiLearnActive) {
                        this._captureMidiLearnMessage(cc, rawValue, { msb: nrpnMsb, lsb: nrpnLsb });
                        this._nrpnInDataMsb = 0;
                        return;
                    }

                    const nrpnKey = 'nrpn:' + nrpnMsb + ':' + nrpnLsb;
                    if (this._applyMidiLearnMapping(nrpnKey, rawValue, { msb: nrpnMsb, lsb: nrpnLsb })) {
                        this._nrpnInDataMsb = 0;
                        return;
                    }

                    const rev = this.byteOffsetToParamIds;
                    const paramIds = rev[byteOffset];
                    if (paramIds && paramIds.length > 0) {
                        const normalized = this._rawToNormalized(byteOffset, rawValue);
                        paramIds.forEach(pid => {
                            this.handleParameterChangeFromBackend(pid, normalized);
                        });
                    }

                    this._nrpnRxBytes += 12;
                    this._nrpnPktCount++;
                    this._notifyNrpnTraffic();

                    this._nrpnInDataMsb = 0;
                }
                return;
            }

            // --- CC 0/32: Bank Select ---
            if (cc === 0 || cc === 32) {
                const bankKey = cc === 0 ? '_lastBankSelectMSB' : '_lastBankSelectLSB';
                const prev = this[bankKey];
                this[bankKey] = val;
                if (prev !== val) {
                    console.log(`[Bridge] Bank Select CC${cc} changed: ${prev} → ${val}`);
                    this._scheduleAutoDump();
                }
                return;
            }

            // MIDI Learn CC intercept
            if (this.midiLearnActive && cc !== 0 && cc !== 32) {
                this._captureMidiLearnMessage(cc, val, null);
                return;
            }

            // Stored CC MIDI Learn mapping
            const ccKey = 'cc:' + cc;
            if (this._applyMidiLearnMapping(ccKey, val, null)) {
                return;
            }

            // CC estándar fallback
            const normalized = val / 127.0;
            const paramId = this.ccToParam[cc];
            if (paramId) {
                // Route global params through setGlobalParameter for proper _globalParams + SysEx
                if (paramId === 'global_tune' || paramId === 'transpose' ||
                    paramId === 'velocity_curve' || paramId === 'pedal_polarity' ||
                    paramId === 'lcd_contrast') {
                    this.setGlobalParameter(paramId, normalized);
                } else {
                    this.handleParameterChangeFromBackend(paramId, normalized);
                }
            }
        }

        // 4) Program Change
        if (status === 0xC0) {
            const prog = data[1];
            if (this._lastProgramChange !== prog) {
                console.log(`[Bridge] Program Change: ${this._lastProgramChange} → ${prog}`);
                this._lastProgramChange = prog;
                this._scheduleAutoDump();
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

    offParameterChanged(callback) {
        const idx = this.onParameterChangedCallbacks.indexOf(callback);
        if (idx !== -1) {
            this.onParameterChangedCallbacks.splice(idx, 1);
        }
    }
}

// Instancia Global
window.dualMidiBridge = new DualMidiBridge();
