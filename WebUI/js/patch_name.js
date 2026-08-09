/**
 * patch_name.js — Fase 3 (plan v3.2 §4.2): saneamiento del nombre de preset para hardware.
 *
 * Contrato SysEx verificado (0.2.4, 1024 dumps de fábrica): el nombre del preset ocupa
 * los bytes 223-238 del preset desempaquetado (16 caracteres ASCII, relleno con 0x20).
 *
 *   - PatchNameValidator : valida un nombre según el protocolo SysEx (longitud, ASCII imprimible).
 *   - PatchNameRenderer  : inserción segura en UI vía textContent (nunca innerHTML).
 *   - HardwareExporter   : produce una COPIA del patch cuyo campo de nombre (223-238) queda
 *                          limitado a 16 chars ASCII imprimibles, SIN alterar el modelo
 *                          original (patch.name y patch.unpackedBytes del objeto fuente
 *                          permanecen intactos).
 */

const PATCH_NAME_OFFSET = 223;   // primer byte del campo de nombre (unpacked)
const PATCH_NAME_LENGTH = 16;    // 16 chars ASCII verificados en dumps reales
const PATCH_NAME_SPACE = 0x20;   // relleno (espacio)

/** ¿Es un carácter ASCII imprimible (0x20-0x7E)? */
function isPrintableAsciiCharCode(c) {
    return c >= 0x20 && c <= 0x7E;
}

const PatchNameValidator = {
    /** Longitud máxima del campo de nombre según el protocolo SysEx (bytes 223-238). */
    maxLength: PATCH_NAME_LENGTH,

    /**
     * Valida un nombre de preset contra el protocolo SysEx.
     * @returns {{ valid: boolean, errors: string[], warnings: string[], sanitized: string }}
     */
    validate(name) {
        const errors = [];
        const warnings = [];

        if (name == null) {
            return { valid: false, errors: ['El nombre es nulo o indefinido'], warnings, sanitized: '' };
        }

        const str = String(name);

        if (str.length === 0) {
            errors.push('El nombre no puede estar vacío');
        }

        // 1) Caracteres no imprimibles o no ASCII → error estructural
        for (const ch of str) {
            const code = ch.codePointAt(0);
            if (code > 0x7E) {
                errors.push(`Carácter no-ASCII (U+${code.toString(16).toUpperCase().padStart(4, '0')}) — el hardware DM12 solo admite ASCII imprimible`);
                break;
            }
            if (!isPrintableAsciiCharCode(code)) {
                errors.push(`Carácter de control (0x${code.toString(16).padStart(2, '0')}) no permitido en el nombre SysEx`);
                break;
            }
        }

        // 2) Longitud (16 chars máx, verificado en dumps)
        if (str.length > PATCH_NAME_LENGTH) {
            errors.push(`El nombre excede ${PATCH_NAME_LENGTH} caracteres (protocolo SysEx bytes 223-238)`);
        }

        // 3) Advertencias no bloqueantes
        if (str !== str.trim()) {
            warnings.push('El nombre tiene espacios al inicio o final; se recortarán en el export');
        }
        if (str.length === PATCH_NAME_LENGTH && !errors.length) {
            warnings.push(`El nombre usa exactamente ${PATCH_NAME_LENGTH} chars (límite del protocolo)`);
        }

        const sanitized = PatchNameValidator.sanitize(str);
        return { valid: errors.length === 0, errors, warnings, sanitized };
    },

    /**
     * Normaliza un nombre al dominio hardware: ASCII imprimible, recortado, máximo 16 chars.
     * No rellena con espacios (el padding ocurre al escribir los bytes).
     */
    sanitize(name) {
        if (name == null) {return '';}
        let out = '';
        for (const ch of String(name)) {
            const code = ch.codePointAt(0);
            if (code > 0x7E || !isPrintableAsciiCharCode(code)) {continue;}
            out += ch;
        }
        return out.trim().slice(0, PATCH_NAME_LENGTH);
    },

    /**
     * Escribe un nombre en el campo 223-238 de un buffer unpacked de 242 bytes
     * (relleno con 0x20). Devuelve el buffer (muta el Uint8Array recibido).
     */
    writeIntoUnpacked(unpacked, name) {
        const safe = PatchNameValidator.sanitize(name);
        for (let k = 0; k < PATCH_NAME_LENGTH; k++) {
            unpacked[PATCH_NAME_OFFSET + k] = k < safe.length ? safe.charCodeAt(k) : PATCH_NAME_SPACE;
        }
        return unpacked;
    },

    /**
     * Lee el nombre desde un buffer unpacked (bytes 223-238), recortado.
     * Devuelve el string crudo si el byte no es ASCII imprimible (byte 0 = fin).
     */
    readFromUnpacked(unpacked) {
        const chars = [];
        for (let k = 0; k < PATCH_NAME_LENGTH; k++) {
            const c = unpacked[PATCH_NAME_OFFSET + k];
            if (c === 0) {break;}
            if (isPrintableAsciiCharCode(c)) {
                chars.push(String.fromCharCode(c));
            }
        }
        return chars.join('').trim();
    },
};

const PatchNameRenderer = {
    /**
     * Inserta un nombre en un elemento DOM usando textContent (nunca innerHTML).
     * Devuelve el elemento o null si no existe.
     */
    render(el, name) {
        if (!el) {return null;}
        el.textContent = (name == null) ? '' : String(name);
        return el;
    },
};

const HardwareExporter = {
    /**
     * Devuelve una COPIA del patch con el campo de nombre (223-238) limitado a
     * 16 chars ASCII imprimibles. El modelo original (patch.name / patch.unpackedBytes)
     * NO se modifica — la copia comparte params/state por referencia pero recibe un
     * Uint8Array nuevo para los bytes.
     *
     * @returns {{ patch: object, name: string, truncated: boolean, changed: boolean }}
     */
    prepareForSysEx(patch) {
        if (!patch) {return null;}

        // Si el modelo no tiene nombre pero los bytes sí lo llevan embebido (parches
        // construidos como {unpackedBytes} sin .name), se conserva el nombre de los
        // bytes — evita borrarlo al exportar (comportamiento histórico de buildSingleSysex).
        const embedded = (patch.unpackedBytes && patch.unpackedBytes.length >= 242)
            ? PatchNameValidator.readFromUnpacked(patch.unpackedBytes)
            : '';
        const originalName = (patch.name == null || String(patch.name) === '')
            ? embedded
            : String(patch.name);
        const safeName = PatchNameValidator.sanitize(originalName);
        const truncated = safeName !== originalName;
        const changed = truncated || safeName !== embedded;

        const unpackedCopy = new Uint8Array(242);
        if (patch.unpackedBytes) {
            unpackedCopy.set(patch.unpackedBytes.subarray(0, Math.min(242, patch.unpackedBytes.length)));
        }
        PatchNameValidator.writeIntoUnpacked(unpackedCopy, safeName);

        const exportedPatch = Object.assign({}, patch, { unpackedBytes: unpackedCopy });
        return { patch: exportedPatch, name: safeName, truncated, changed };
    },

    /** Valida + prepara en un solo paso (para mensajes de alerta con detalle). */
    inspect(patch) {
        if (!patch) {return null;}
        const name = (patch.name == null) ? '' : String(patch.name);
        const result = PatchNameValidator.validate(name);
        const prepared = HardwareExporter.prepareForSysEx(patch);
        return {
            valid: result.valid,
            errors: result.errors,
            warnings: result.warnings,
            hardwareName: prepared.name,
            truncated: prepared.truncated,
            changed: prepared.changed,
        };
    },
};

// ── Exports ──
if (typeof window !== 'undefined') {
    window.PatchNameValidator = PatchNameValidator;
    window.PatchNameRenderer = PatchNameRenderer;
    window.HardwareExporter = HardwareExporter;
}
if (typeof globalThis !== 'undefined') {
    globalThis.PatchNameValidator = PatchNameValidator;
    globalThis.PatchNameRenderer = PatchNameRenderer;
    globalThis.HardwareExporter = HardwareExporter;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PatchNameValidator, PatchNameRenderer, HardwareExporter };
}
