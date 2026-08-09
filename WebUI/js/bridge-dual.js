// eslint-disable-next-line no-var
var Logger = globalThis.Logger || console;

/**
 * @purpose Puente de comunicación dual unificada entre la UI web y el backend nativo JUCE o la Web MIDI API.
 * @purpose_en Unified dual communication bridge between the web UI and the native JUCE backend or Web MIDI API.
 * @classification Network/Communication Infrastructure
 * @complexity Medium
 *
 * Methods have been extracted into separate modules loaded after this file:
 *   - bridge-dual_init.js:     init(), waitForReady(), setupJuceListeners()
 *   - bridge-dual_params.js:   setParameter(), readFactoryBankFile(),
 *                              handleParameterChangeFromBackend(),
 *                              onParameterChanged(), offParameterChanged()
 *   - bridge-sysex.js:         requestMidiDump, requestSysEx, _parseGlobalDump, etc.
 *   - bridge-midi-rx.js:       handleIncomingMidi, sendNRPN, _nrpn*, _applyMidiLearnMapping, etc.
 *   - bridge-connection.js:    initWebMidi, scanMidiDevices, pianoNoteOn/Off, panic,
 *                              isConnected, resetMidiConnection, startAutoReconnect, etc.
 *   - bridge-midi-learn.js:    toggleMidiLearn, startMidiLearn, stopMidiLearn, etc.
 *   - bridge-engines.js:       initArpEngine, initSeqEngine, _updateSeqEngine, etc.
 */
class DualMidiBridge {
    get isJuce() {
        return this._isJuce || !!(window.__JUCE__ && window.__JUCE__.backend);
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
                Logger.log('[Bridge] JUCE native found after ' + (i * 20) + 'ms');
                break;
            }
            await new Promise(r => setTimeout(r, 20));
        }

        // Log final detection state for diagnostics
        Logger.log('[Bridge] Detection result: __juce__=' + typeof window.__juce__
            + ' __JUCE__=' + typeof window.__JUCE__
            + ' juce=' + typeof window.juce
            + ' chrome.webview=' + typeof (window.chrome && window.chrome.webview));

        // Detectar si estamos en el entorno embebido de JUCE (Webview2)
        if (isJuceAvailable()) {
            this.isJuce = true;
            this._connected = true;

            Logger.log('[Bridge] Entorno JUCE 8 detectado. Canal nativo activo.');
            this.setupJuceListeners();
            this._ready = true;
            this._resolveReady(true);
            // _updateConnectionUI is defined in bridge-connection.js (loaded after this file)
            if (typeof this._updateConnectionUI === 'function') {
                this._updateConnectionUI();
            }
        } else {
            Logger.log('[Bridge] Ejecución en Navegador Web detectada. Inicializando Web MIDI API...');
            if (typeof this.initWebMidi === 'function') {
                await this.initWebMidi();
            }
            this._ready = true;
            this._resolveReady(true);
        }
    }

    // --- RAW <-> NORMALIZED CONVERSIÓN ---
    _rawToNormalized(byteOffset, rawValue) {
        return window.BRIDGE_PARAM_MAPS ? window.BRIDGE_PARAM_MAPS.rawToNormalized(byteOffset, rawValue) : rawValue / 255.0;
    }

    _normalizedToRaw(byteOffset, normalizedValue) {
        return window.BRIDGE_PARAM_MAPS ? window.BRIDGE_PARAM_MAPS.normalizedToRaw(byteOffset, normalizedValue) : Math.round(normalizedValue * 255);
    }
}

// Exportar clase a globalThis para que los módulos IIFE (bridge-sysex.js, bridge-midi-rx.js, bridge-connection.js)
// puedan encontrar DualMidiBridge incluso en entornos module-scoped (tests con eval/require)
globalThis.DualMidiBridge = DualMidiBridge;

// ══════════════════════════════════════════════════════════════════
// Fase 6 (plan v3.2 §6): acceso canónico + retirada del alias legacy
//
// window.dualMidiBridge queda como ALIAS DEPRECADO (getter con aviso único
// vía Logger.deprecation). El acceso canónico es getBridge(), que lee la
// instancia privada directamente — sin deprecation y sin coste extra.
// ══════════════════════════════════════════════════════════════════

/** Instancia canónica privada (el alias legacy es un getter sobre esta). */
const _canonicalBridge = new DualMidiBridge();

/**
 * Acceso canónico al bridge (Fase 6). Los módulos de UI deben usar getBridge()
 * en lugar de window.dualMidiBridge. En entornos de test donde solo se stubbea
 * window.dualMidiBridge o window._bridgeInstance, cae a ellos como compatibilidad.
 * @returns {DualMidiBridge}
 */
function getBridge() {
    // En producción _canonicalBridge SIEMPRE gana (el constructor asigna
    // window._bridgeInstance en init(), pero getBridge() no lo lee). Los fallbacks
    // solo se alcanzan en entornos donde este módulo no se evaluó (tests que
    // stubbean el alias) — no asignar window._bridgeInstance manualmente esperando
    // que getBridge() lo devuelva: _canonicalBridge tiene prioridad.
    if (_canonicalBridge) { return _canonicalBridge; }
    if (typeof window !== 'undefined') {
        if (window._bridgeInstance) { return window._bridgeInstance; }
        return window.dualMidiBridge;
    }
    return null;
}

// Exponer acceso canónico en window y globalThis (tests eval en global scope).
if (typeof window !== 'undefined') {
    window.getBridge = getBridge;
}
globalThis.getBridge = getBridge;

// Alias legacy deprecado: getter que reporta el desuso UNA vez (Logger.deprecation).
if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'dualMidiBridge', {
        configurable: true,
        enumerable: true,
        get: function() {
            const LoggerRef = (typeof globalThis !== 'undefined' && globalThis.Logger) || console;
            if (LoggerRef && typeof LoggerRef.deprecation === 'function') {
                LoggerRef.deprecation('window.dualMidiBridge', {
                    replacementId: 'getBridge()',
                    since: '0.2.35',
                    note: 'Fase 6 — retirada progresiva de compatibilidad legacy'
                });
            }
            return _canonicalBridge;
        },
        set: function() {
            // Escrituras al alias legacy se ignoran: la instancia canónica es privada.
        }
    });
}
