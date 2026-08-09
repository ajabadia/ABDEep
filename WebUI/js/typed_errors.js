/**
 * typed_errors.js — Fase 3 (plan v3.2 §4.3): errores tipados para SysEx, MIDI e
 * importación JSON.
 *
 * Contrato:
 *   - ABDError            : clase base — todo error del proyecto extiende Error y
 *                           lleva { code, category, context, timestamp }.
 *   - SysExError          : category 'sysex' (protocolo de volcados/presets).
 *   - MidiError           : category 'midi' (acceso a dispositivos Web MIDI).
 *   - PatchImportError    : category 'import' (parseo de .syx/.json importados).
 *   - asTypedError(err)   : envuelve un error plano (p.ej. JSON.parse) en la clase
 *                           tipada correspondiente sin perder el mensaje original.
 *
 * Uso:
 *   throw new SysExError('SYSEX_TIMEOUT', 'esperando response de edit dump', { timeoutMs });
 *   catch (err) → err.category === 'sysex', err.code === 'SYSEX_TIMEOUT'
 *
 * Compatibilidad: son subclases de Error (message/stack intactos), así que los
 * catch existentes que solo leen err.message siguen funcionando sin cambios.
 */

// ── Códigos canónicos ────────────────────────────────────────────────────────
const ERROR_CODES = Object.freeze({
    // SysEx
    SYSEX_NO_PORT: 'SYSEX_NO_PORT',
    SYSEX_TIMEOUT: 'SYSEX_TIMEOUT',
    SYSEX_UNKNOWN_DUMP_TYPE: 'SYSEX_UNKNOWN_DUMP_TYPE',
    SYSEX_MALFORMED_RESPONSE: 'SYSEX_MALFORMED_RESPONSE',
    SYSEX_BLOCKED_PRO_PATCH: 'SYSEX_BLOCKED_PRO_PATCH',
    // MIDI
    MIDI_NO_ACCESS: 'MIDI_NO_ACCESS',
    MIDI_NO_OUTPUT: 'MIDI_NO_OUTPUT',
    MIDI_RECONNECT_FAILED: 'MIDI_RECONNECT_FAILED',
    // Import
    IMPORT_INVALID_JSON: 'IMPORT_INVALID_JSON',
    IMPORT_UNSUPPORTED_FORMAT: 'IMPORT_UNSUPPORTED_FORMAT',
    IMPORT_REJECTED: 'IMPORT_REJECTED',
});

/** Clase base: Error + metadatos tipados serializables. */
class ABDError extends Error {
    constructor(code, message, context) {
        super(message || code);
        this.name = this.constructor.name;
        this.code = code;
        this.category = 'generic';
        this.context = (context == null) ? null : context;
        this.timestamp = Date.now();
        // Evita que la serialización del stack exponga internals del runtime
        if (Error.captureStackTrace) { Error.captureStackTrace(this, this.constructor); }
    }

    /** Devuelve un objeto plano serializable (p.ej. para el bridge o logs). */
    toJSON() {
        return {
            name: this.name,
            category: this.category,
            code: this.code,
            message: this.message,
            context: this.context,
            timestamp: this.timestamp,
        };
    }

    toString() {
        return `[${this.category}] ${this.code}: ${this.message}`;
    }
}

/** Error tipado de protocolo SysEx (volcados, envío de presets, timers). */
class SysExError extends ABDError {
    constructor(code, message, context) {
        super(code, message, context);
        this.category = 'sysex';
    }
}

/** Error tipado de acceso/sesiones Web MIDI (navigator.requestMIDIAccess…). */
class MidiError extends ABDError {
    constructor(code, message, context) {
        super(code, message, context);
        this.category = 'midi';
    }
}

/** Error tipado de importación de archivos (.syx / .json / bancos). */
class PatchImportError extends ABDError {
    constructor(code, message, context) {
        super(code, message, context);
        this.category = 'import';
    }
}

/**
 * Envuelve un error plano (p.ej. de JSON.parse o de la Web MIDI API) en la clase
 * tipada correspondiente. Si ya es un ABDError lo devuelve tal cual.
 *
 * @param {Error} err       error original
 * @param {string} category 'sysex' | 'midi' | 'import'
 * @param {string} code     código tipado (por defecto deriva de la categoría)
 * @returns {ABDError}
 */
function asTypedError(err, category, code) {
    if (err instanceof ABDError) { return err; }
    const fallbackCode = {
        sysex: ERROR_CODES.SYSEX_MALFORMED_RESPONSE,
        midi: ERROR_CODES.MIDI_NO_ACCESS,
        import: ERROR_CODES.IMPORT_INVALID_JSON,
    }[category] || 'UNKNOWN';
    const Ctor = {
        sysex: SysExError,
        midi: MidiError,
        import: PatchImportError,
    }[category] || ABDError;
    const msg = (err && err.message) ? err.message : String(err);
    const typed = new Ctor(code || fallbackCode, msg);
    typed.cause = err;
    return typed;
}

/** ¿El valor es un error tipado del proyecto? */
function isTypedError(value) {
    return value instanceof ABDError;
}

/**
 * Crea un error tipado por categoría SIN depender de que el módulo ya esté
 * cargado como global (fallback a Error plano con metadatos adosados, que
 * conserva el message real — a diferencia de `new (Ctor || Error)(code, msg)`,
 * que descarta el segundo argumento en el fallback).
 *
 * @param {string} category 'sysex' | 'midi' | 'import' | 'generic'
 * @param {string} code     código tipado (ERROR_CODES)
 * @param {string} message  mensaje legible
 * @param {object} [context] datos estructurados de depuración
 * @returns {ABDError|Error}
 */
function createTypedError(category, code, message, context) {
    const Ctor = {
        sysex: SysExError,
        midi: MidiError,
        import: PatchImportError,
        generic: ABDError,
    }[category] || ABDError;
    return new Ctor(code, message, context);
}

// ── Exports ──
if (typeof window !== 'undefined') {
    window.ABDError = ABDError;
    window.SysExError = SysExError;
    window.MidiError = MidiError;
    window.PatchImportError = PatchImportError;
    window.ERROR_CODES = ERROR_CODES;
    window.asTypedError = asTypedError;
    window.isTypedError = isTypedError;
    window.createTypedError = createTypedError;
}
if (typeof globalThis !== 'undefined') {
    globalThis.ABDError = ABDError;
    globalThis.SysExError = SysExError;
    globalThis.MidiError = MidiError;
    globalThis.PatchImportError = PatchImportError;
    globalThis.ERROR_CODES = ERROR_CODES;
    globalThis.asTypedError = asTypedError;
    globalThis.isTypedError = isTypedError;
    globalThis.createTypedError = createTypedError;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ABDError, SysExError, MidiError, PatchImportError,
        ERROR_CODES, asTypedError, isTypedError, createTypedError,
    };
}
