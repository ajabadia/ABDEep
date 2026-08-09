/**
 * dom_sanitize.js — Fase 3 (plan v3.2 §4.1): saneamiento DOM canónico.
 *
 * Política XSS del proyecto:
 *   - Prohibido insertar datos externos/importados en sinks dinámicos sin escape
 *     (innerHTML =, innerHTML +=, insertAdjacentHTML, outerHTML, DOMParser).
 *   - Uso obligatorio de textContent para valores dinámicos; cuando se requiere
 *     HTML estructurado (grids, badges, LCD), TODO valor dinámico debe pasar por
 *     escapeHtml().
 *
 * Este módulo es la implementación canónica del escaper; cargar ANTES que los
 * módulos que renderizan parches (browser_render.js, script_controllers_lcd.js…).
 *
 * Consolidación (prep Fase 6): browser_modals_templates._escapeHtml,
 * effects_presets_data.escapeHtml y calibration_lab_format.escapeHtml DELEGAN en
 * este helper (y ya no lo reimplementan). Este módulo es la ÚNICA implementación.
 */

/** Escapa una cadena para inserción segura en HTML (atributos incluidos). */
function escapeHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Exponer en window para uso en módulos del navegador
if (typeof window !== 'undefined') {
    window.escapeHtml = escapeHtml;
}
if (typeof globalThis !== 'undefined') {
    globalThis.escapeHtml = escapeHtml;
}

// Node.js exports para tests
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { escapeHtml };
}
