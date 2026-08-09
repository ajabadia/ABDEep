/**
 * @purpose SysEx bank dump + auto-dump handlers for DualMidiBridge.
 * Extraído de bridge-sysex-handlers.js.
 */

(function() {
    if (typeof DualMidiBridge === 'undefined') {
        console.warn('[Bridge-SysEx-Dump] DualMidiBridge not found — deferring...');
        return;
    }

    const Logger = globalThis.Logger || console;

    DualMidiBridge.prototype.requestBankDump = async function(bankNumber, options = {}) {
        if (this.isJuce) {
            return window.juce && typeof window.juce.requestBankDump === 'function'
                ? window.juce.requestBankDump(bankNumber)
                : 0;
        }

        if (!this.midiOutput) {
            Logger.warn('[BankDump] No MIDI output available');
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

        Logger.log('[BankDump] Solicitando banco ' + bankLetter + ' (' + bankIndex + ') — 128 programas');

        try {
            const result = await new Promise((resolve) => {
                this._bankDumpResolve = resolve;

                const bankDumpTimeout = setTimeout(() => {
                    this._bankDumpInProgress = false;
                    this._bankDumpCallback = null;
                    this._bankDumpTimeout = null;
                    Logger.warn('[BankDump] Timeout: recogidos ' + collectedCount + '/128 patches');
                    resolve(collectedCount);
                }, timeoutMs);
                this._bankDumpTimeout = bankDumpTimeout;

                this._bankDumpCallback = (_patchData) => {
                    if (this._bankDumpCancel) {return;}
                    collectedCount++;
                    if (onProgress) {onProgress(collectedCount, 128);}
                    if (collectedCount >= 128) {
                        clearTimeout(bankDumpTimeout);
                        this._bankDumpTimeout = null;
                        this._bankDumpInProgress = false;
                        this._bankDumpCallback = null;
                        this._bankDumpResolve = null;
                        Logger.log('[BankDump] Banco ' + bankLetter + ' completo: 128/128 patches recibidos');
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
            Logger.error('[BankDump] Error:', err.message);
            throw err;
        }
    };


    DualMidiBridge.prototype.cancelBankDump = function() {
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
        Logger.log('[BankDump] Cancelado por el usuario');
    };


    DualMidiBridge.prototype._scheduleAutoDump = function() {
        if (this._autoDumpTimer) {clearTimeout(this._autoDumpTimer);}
        this._autoDumpTimer = setTimeout(() => {
            if (!this.midiOutput || !this.midiInput) {return;}
            Logger.log('[Bridge] Auto-dump triggered by Bank/Program change → requesting edit buffer dump');
            if (typeof this.requestMidiDump === 'function') {
                this.requestMidiDump('edit', 4000, 1).then((response) => {
                    if (!response) {
                        Logger.warn('[Bridge] Auto-dump failed — no response from hardware');
                    }
                }).catch((err) => {
                    Logger.warn('[Bridge] Auto-dump error:', err.message || err);
                });
            }
        }, 200);
    };


    Logger.log('[Bridge] SysEx dump handlers module loaded');
})();
