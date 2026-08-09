/**
 * @purpose SysExAssembler (Fase 2, plan v3.2 §2.2): FSM independiente de ensamblado de
 * mensajes SysEx. Estados: waiting → collecting → complete | malformed | timeout.
 * Independiente del puerto MIDI: recibe bytes sueltos y emite mensajes completos.
 * @purpose_en SysExAssembler (plan Fase 2 §2.2): standalone SysEx message FSM.
 * @classification Module/MIDI/FSM
 * @complexity Medium
 *
 * FSM:
 *   waiting ─(F0)→ collecting ─(F7)→ complete
 *   collecting ─(bytes)→ collecting (hasta límite)
 *   collecting ─(sin F7 en timeoutMs)→ timeout
 *   waiting ─(bytes sin F0 / F7 suelto)→ malformed
 *   collecting ─(desbordamiento de buffer)→ malformed
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) { module.exports = api; }
    if (typeof window !== 'undefined') {
        window.SysExAssembler = api.SysExAssembler;
        window.SysExAssemblerModule = api;
    } else if (root) {
        root.SysExAssembler = api.SysExAssembler;
        root.SysExAssemblerModule = api;
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const ASSEMBLER_STATES = ['waiting', 'collecting', 'complete', 'malformed', 'timeout'];
    const SYSEX_START = 0xF0;
    const SYSEX_END = 0xF7;

    class SysExAssembler {
        /**
         * @param {object} [opts]
         * @param {number} [opts.timeoutMs]  TTL sin F7 → 'timeout' (0 = sin timeout)
         * @param {number} [opts.maxMessageLength]  límite del buffer (default 1024)
         * @param {function} [opts.onComplete]  cb(bytes, assembler)
         * @param {function} [opts.onMalformed] cb(reason, assembler)
         * @param {function} [opts.onTimeout]   cb(assembler)
         * @param {function} [opts.now] reloj inyectable (tests)
         * @param {function} [opts.setTimer] setTimeout inyectable (tests)
         * @param {function} [opts.clearTimer] clearTimeout inyectable (tests)
         */
        constructor(opts) {
            opts = opts || {};
            this.timeoutMs = opts.timeoutMs !== undefined ? opts.timeoutMs : 0;
            this.maxMessageLength = opts.maxMessageLength !== undefined ? opts.maxMessageLength : 1024;
            this._onComplete = typeof opts.onComplete === 'function' ? opts.onComplete : null;
            this._onMalformed = typeof opts.onMalformed === 'function' ? opts.onMalformed : null;
            this._onTimeout = typeof opts.onTimeout === 'function' ? opts.onTimeout : null;
            this._now = (typeof opts.now === 'function') ? opts.now : function () { return Date.now(); };
            this._setTimerFn = (typeof opts.setTimer === 'function') ? opts.setTimer : function (fn, ms) { return setTimeout(fn, ms); };
            this._clearTimerFn = (typeof opts.clearTimer === 'function') ? opts.clearTimer : function (t) { clearTimeout(t); };

            this._state = 'waiting';
            this._buffer = [];
            this._startedAt = null;
            this._timer = null;
        }

        getState() { return this._state; }

        /**
         * @param {function} cb recibe { from, to, reason?, bytes?, ts }
         * @returns {function} unsubscribe
         */
        onStateChange(cb) {
            if (typeof cb !== 'function') { return function () {}; }
            this._listeners = this._listeners || [];
            this._listeners.push(cb);
            return () => {
                const i = this._listeners.indexOf(cb);
                if (i !== -1) { this._listeners.splice(i, 1); }
            };
        }

        _emit(evt) {
            if (!this._listeners) { return; }
            for (const cb of this._listeners) {
                try { cb(evt); } catch (e) { /* noop */ }
            }
        }

        _setState(to, reason) {
            const from = this._state;
            this._state = to;
            this._emit({ from: from, to: to, reason: reason || null, ts: this._now() });
        }

        /**
         * Alimenta el ensamblador con bytes. Acepta Uint8Array, Array o número.
         * @param {Uint8Array|Array|number} data
         * @returns {string} estado resultante
         */
        feed(data) {
            if (data === null || data === undefined) { return this._state; }
            const bytes = (typeof data === 'number') ? [data] : Array.from(data);
            for (const byte of bytes) {
                this._feedByte(byte);
                if (this._state === 'complete' || this._state === 'malformed') {
                    break; // un mensaje por llamada: reiniciar requiere reset()/siguiente feed
                }
            }
            return this._state;
        }

        _feedByte(byte) {
            if (this._state === 'complete' || this._state === 'malformed' || this._state === 'timeout') {
                // Mensaje previo terminado: un nuevo F0 reinicia automáticamente
                if (byte === SYSEX_START) {
                    this.reset();
                } else {
                    return;
                }
            }

            if (this._state === 'waiting') {
                if (byte === SYSEX_START) {
                    this._buffer = [byte];
                    this._startedAt = this._now();
                    this._setState('collecting');
                    this._armTimeout();
                } else if (byte === SYSEX_END) {
                    // F7 suelto sin F0
                    this._setState('malformed', 'stray_eox');
                    this._fireMalformed('stray_eox');
                } else {
                    // Basura previa al F0: se descarta (tolerante)
                }
                return;
            }

            // collecting
            if (byte === SYSEX_END) {
                this._buffer.push(byte);
                this._clearTimer();
                this._setState('complete');
                if (this._onComplete) { this._onComplete(this._buffer.slice(), this); }
                return;
            }
            if (byte === SYSEX_START) {
                // Doble F0: reinicia (mensaje corrupto intercalado)
                this._buffer = [byte];
                this._armTimeout();
                return;
            }
            if (this._buffer.length >= this.maxMessageLength) {
                this._clearTimer();
                this._setState('malformed', 'overflow');
                this._fireMalformed('overflow');
                return;
            }
            this._buffer.push(byte);
        }

        _armTimeout() {
            this._clearTimer();
            if (!this.timeoutMs) { return; }
            this._timer = this._setTimerFn(() => {
                if (this._state !== 'collecting') { return; }
                this._setState('timeout', 'no_eox');
                if (this._onTimeout) { this._onTimeout(this); }
            }, this.timeoutMs);
        }

        _clearTimer() {
            if (this._timer !== null) {
                this._clearTimerFn(this._timer);
                this._timer = null;
            }
        }

        _fireMalformed(reason) {
            if (this._onMalformed) { this._onMalformed(reason, this); }
        }

        /**
         * Reinicia a 'waiting'. Devuelve el mensaje parcial si lo había.
         * @returns {number[]|null}
         */
        reset() {
            this._clearTimer();
            const partial = this._buffer.length ? this._buffer.slice() : null;
            this._buffer = [];
            this._startedAt = null;
            this._setState('waiting');
            return partial;
        }

        /**
         * Mensaje completo ensamblado (incluye F0 y F7), o null si no hay.
         * @returns {number[]|null}
         */
        getMessage() {
            if (this._state === 'complete') { return this._buffer.slice(); }
            return null;
        }

        /**
         * Snapshot serializable del ensamblador.
         */
        inspect() {
            return {
                state: this._state,
                bufferLength: this._buffer.length,
                startedAt: this._startedAt,
                timeoutMs: this.timeoutMs,
                maxMessageLength: this.maxMessageLength,
                message: this._state === 'complete' ? this._buffer.slice() : null,
            };
        }
    }

    return {
        SysExAssembler: SysExAssembler,
        ASSEMBLER_STATES: ASSEMBLER_STATES,
        SYSEX_START: SYSEX_START,
        SYSEX_END: SYSEX_END,
    };
});
