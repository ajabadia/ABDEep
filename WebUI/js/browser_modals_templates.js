/**
 * @purpose Templates HTML para menús contextuales y modales del browser.
 * Extraído de browser_modals.js como parte de la modularización.
 * @purpose_en HTML template functions for browser context menus and modals.
 */

/** Escapa HTML para prevenir XSS en nombres de patches.
 * Consolidación (prep Fase 6): delega en el canónico de dom_sanitize.js (cargado primero
 * en index.html). El fallback solo cubre la carga standalone sin dom_sanitize.js.
 */
function _escapeHtml(str) {
    const canonical = (typeof window !== 'undefined' && typeof window.escapeHtml === 'function')
        ? window.escapeHtml
        : (typeof globalThis !== 'undefined' && typeof globalThis.escapeHtml === 'function' ? globalThis.escapeHtml : null);
    if (canonical) {return canonical(str);}
    if (typeof str !== 'string') {return '';}
    // Fallback con paridad EXACTA con el canónico (&#039;, no &#39;) para que la
    // salida standalone sea idéntica a la del navegador.
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

/**
 * Construye el contenedor HTML del menú contextual.
 * @param {string} patchName - Nombre del patch (se escapa automáticamente)
 * @param {string} itemsHtml - HTML concatenado de los items del menú
 * @param {number} clientX - Posición X del click
 * @param {number} clientY - Posición Y del click
 * @returns {string} HTML completo del menú contextual
 */
function _buildCtxMenuHtml(patchName, itemsHtml, clientX, clientY) {
    const left = Math.min(clientX, window.innerWidth - 180);
    const top = Math.min(clientY, window.innerHeight - 120);
    return '<div class="ctx-menu-container patch-context-menu" style="left:' + left + 'px;top:' + top + 'px">' +
        '<div class="ctx-menu-title">' + _escapeHtml(patchName) + '</div>' +
        itemsHtml +
        '</div>';
}

/**
 * Construye el HTML de un item del menú contextual.
 * @param {string} text - Texto del item (se escapa automáticamente)
 * @returns {string} HTML del item
 */
function _buildCtxMenuItemHtml(text) {
    return '<div class="ctx-menu-item">' + _escapeHtml(text) + '</div>';
}

/**
 * Construye el HTML del aviso "PRO EXCLUSIVE PATCH".
 * @returns {string} HTML del aviso
 */
function _buildProNoticeHtml() {
    return '<div class="ctx-menu-title" style="color:var(--accent-red,#ff4d4d);font-size:9px">&#9889; PRO EXCLUSIVE PATCH</div>';
}

/**
 * Construye el HTML de un botón del selector de categoría.
 * @param {string} category - Nombre de la categoría (se escapa automáticamente)
 * @param {boolean} isActive - Si es la categoría activa actualmente
 * @returns {string} HTML del botón
 */
function _buildCatPickerBtnHtml(category, isActive) {
    const escaped = _escapeHtml(category);
    const activeClass = isActive ? ' active' : '';
    const checkHtml = isActive ? '<span>&#10003; Selected</span>' : '';
    return '<button class="manager-btn cat-picker-btn' + activeClass + '"><span>' + escaped + '</span>' + checkHtml + '</button>';
}

// Exponer globalmente
window._buildCtxMenuHtml = _buildCtxMenuHtml;
window._buildCtxMenuItemHtml = _buildCtxMenuItemHtml;
window._buildProNoticeHtml = _buildProNoticeHtml;
window._buildCatPickerBtnHtml = _buildCatPickerBtnHtml;
