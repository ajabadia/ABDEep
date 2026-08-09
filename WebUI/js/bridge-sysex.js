/**
 * @purpose Core SysEx request protocol for DualMidiBridge: requestMidiDump and requestSysEx.
 * Global dump parsing, bank dump, and auto-dump handlers have been extracted
 * to bridge-sysex-handlers.js.
 * @classification Module/SysEx
 * @complexity Medium
 */

(function() {
    if (typeof DualMidiBridge === 'undefined') {
        console.warn('[Bridge-SysEx] DualMidiBridge not found — deferring...');
        return;
    }

    const Logger = globalThis.Logger || console;

    DualMidiBridge.prototype.requestMidiDump = async function(type, timeoutMs = 3000, retries = 2) {
        if (this.isJuce) {
            if (window.juce && typeof window.juce.requestMidiDump === 'function') {
                return window.juce.requestMidiDump(type);
            }
            return null;
        }

        if (!this.midiOutput || !this.midiInput) {
            Logger.warn('[SysEx] No MIDI ports available for dump request');
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
            Logger.warn('[SysEx] Unknown dump type: ' + type);
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
                Logger.log('[SysEx] Solicitando dump ' + type + ' (intento ' + attempt + '/' + (retries + 1) + ') con timeout ' + timeoutMs + 'ms...');
                const response = await this.requestSysEx(requestBytes, timeoutMs, isDumpResponse);
                return response;
            } catch (err) {
                if (attempt <= retries) {
                    Logger.warn('[SysEx] Intento ' + attempt + ' falló, re-intentando en 500ms: ' + err.message);
                    await new Promise(r => setTimeout(r, 500));
                } else {
                    Logger.error('[SysEx] Todos los intentos fallaron para dump ' + type + ': ' + err.message);
                    return null;
                }
            }
        }
        return null;
    };


    DualMidiBridge.prototype.requestSysEx = async function(requestBytes, timeoutMs = 3000, predicate = null) {
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
                done(new Error('[SysEx] Timeout after ' + elapsed + 'ms waiting for response'), null);
            }, timeoutMs);

            entry.timer = timer;
            this._pendingSysExRequests.push(entry);

            this._signalMidiActivity();
            this.midiOutput.send(requestBytes);
        });
    };

    DualMidiBridge.prototype.sendPatchToHardware = function(patch) {
        if (!patch) { return false; }
        if (typeof window.inspectPatchAdvancedFeatures === 'function') {
            const check = window.inspectPatchAdvancedFeatures(patch);
            if (check.isAdvanced) {
                Logger.warn('[SysEx] Bloqueado envío de preset Pro a hardware DM12:', check.reasons);
                const lcdUpdate = window.lcdSafeUpdate || function() {};
                lcdUpdate('⚠️ PRO PATCH: CANNOT SEND TO DM12 HW');
                alert(
                    `⚠️ No se puede enviar el preset "${patch.name || 'Pro'}" al sintetizador físico DeepMind 12 por incluir funciones Pro:\n\n` +
                    `- ${check.reasons.join('\n- ')}\n\n` +
                    'Utiliza "Convert to Classic DM12" para exportar o transmitir una versión compatible.'
                );
                return false;
            }
        }
        if (this.midiOutput && patch.unpackedBytes) {
            // Fase 3 (§4.2): el nombre transmitido al hardware se limita a 16 chars
            // ASCII imprimibles SIN mutar el patch original (se envía una copia saneada).
            const exportPrep = (typeof window.HardwareExporter === 'object' && window.HardwareExporter)
                ? window.HardwareExporter.prepareForSysEx(patch)
                : null;
            const txPatch = (exportPrep && exportPrep.patch) ? exportPrep.patch : patch;
            const syxMsg = window.buildSingleSysex ? window.buildSingleSysex(txPatch) : txPatch.unpackedBytes;
            this.midiOutput.send(syxMsg);
            return true;
        }
        return false;
    };

    Logger.log('[Bridge] SysEx core module loaded');
})();
