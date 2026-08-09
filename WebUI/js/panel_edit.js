/**
 * @purpose Módulo de control del panel de edición detallada deslizable izquierdo (fachada).
 * La lógica se ha extraído a:
 *   - panel_edit_state.js   — estado compartido
 *   - panel_edit_buttons.js — botones de modo + chord/polychord + cierre
 *   - panel_edit_scope.js   — toggles de pantalla/scope + toolbar
 *   - panel_animations.js   — canvas loop + audio polling
 *   - panel_param_handler.js — cambios de parámetros en tiempo real
 *   - panel_controls_binder.js — bindings de sliders + selectores
 *   - panel_graphics.js     — renderizado canvas de formas de onda
 * @purpose_en Facade that initializes all detail panel sub-modules.
 */

/* global initPanelButtons, initPanelScope */

document.addEventListener('DOMContentLoaded', () => {
    initDetailPanel();
});

function initDetailPanel() {
    const panel = document.getElementById('detail-edit-panel');
    const closeBtn = document.getElementById('panel-close-btn');

    if (!panel || !closeBtn) {return;}

    // Initialize sub-modules
    initPanelButtons(panel);
    initPanelScope();

    // Escuchar cambios de parámetros en tiempo real (delegado a panel_param_handler.js)
    if (getBridge()) {
        getBridge().onParameterChanged(window._handlePanelParamChange);
    }

    // Observer y animaciones (delegado a panel_animations.js)
    if (typeof window._initPanelObserver === 'function') {
        window._initPanelObserver();
    }
}
