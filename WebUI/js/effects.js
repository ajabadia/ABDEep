/**
 * @purpose Controlador del módulo de efectos (Effects Engine Rack) central (fachada).
 * La lógica se ha extraído a:
 *   - effects_data.js       — nombres de tipo, derivados del contrato compartido
 *   - effects_controls.js   — controles del modal (apertura, slots, tipos, routing, páginas, modos)
 *   - effects_sliders.js    — sliders de envío y parámetros de slot
 *   - effects_modal_sync.js — sincronización de la UI del modal
 *   - effects_presets.js    — gestión de presets de efectos (guardar/cargar/eliminar)
 *   - effects_templates.js  — plantillas HTML + renderizado de parámetros activos
 * @purpose_en Central Effects Engine Rack controller (facade).
 */

/* global initEffectsControls, initEffectsSliders */

document.addEventListener('DOMContentLoaded', () => {
    initEffectsModal();
});

function initEffectsModal() {
    const backdrop = document.getElementById('fx-modal-backdrop');

    // OJO LA CONDICION DE ARRIBA. Comprobaba ademas que existiera la pantalla
    // de parametros del hueco seleccionado, y como se quito (sus renderers
    // estaban numerados contra una tabla de efectos que ya no es la del motor),
    // esta comprobacion hacia que `initEffectsModal` se retornara SIN
    // INICIALIZAR NADA: el backdrop existia, el elemento no, y el modal entero
    // se quedaba muerto sin decir nada. Ahora la unica cosa que tiene que
    // existir es el modal, y la rejilla se pinta despues.
    if (!backdrop) {return;}

    window._selectedFxSlot = 1;

    // Inicializar submódulos
    initEffectsControls();
    initEffectsSliders();

    // Sync UI (delegado a effects_modal_sync.js)
    if (typeof window.syncFxModalUIFromState === 'function') {
        window.syncFxModalUIFromState();
    }
    if (typeof window.syncFxModalUI === 'function') {
        window.syncFxModalUI();
    }

    // Bridge parameter listener
    if (getBridge() && typeof getBridge().onParameterChanged === 'function') {
        getBridge().onParameterChanged(function(paramId) {
            if (backdrop.style.display === 'none') {return;}
            if (paramId.startsWith('fx')) {
                if (paramId.endsWith('_type')) {
                    if (typeof window.syncFxModalUI === 'function') {window.syncFxModalUI();}
                } else {
                    const slotPrefix = 'fx' + window._selectedFxSlot;
                    if (paramId.startsWith(slotPrefix)) {
                        if (typeof window.renderActiveEffectParams === 'function') {
                            window.renderActiveEffectParams();
                        }
                    }
                }
            }
        });
    }
}

window.fxPresetManager = {
    load: function(presetIndex, slot) {
        if (typeof window.applyFxPreset === 'function' && typeof window._loadAllFxPresets === 'function') {
            const allPresets = window._loadAllFxPresets();
            if (allPresets[presetIndex]) {
                window.applyFxPreset(allPresets[presetIndex], slot);
            }
        }
    },
    save: function(presetName, slot) {
        if (typeof window.saveFxPreset === 'function') {
            window.saveFxPreset(presetName, slot);
        }
    },
    delete: function(presetName) {
        if (typeof window.deleteFxPreset === 'function') {
            window.deleteFxPreset(presetName);
        }
    },
    getAll: function() {
        if (typeof window._loadAllFxPresets === 'function') {
            return window._loadAllFxPresets();
        }
        return [];
    }
};
